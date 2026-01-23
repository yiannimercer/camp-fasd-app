"""
Supabase Storage Service
Handles file uploads and downloads to Supabase Storage

Security: All filenames are sanitized to prevent path traversal attacks.
"""

import re
from typing import BinaryIO, Optional, Union
from supabase import create_client, Client
from ..core.config import get_settings
from ..core.security_utils import generate_safe_storage_path, is_path_traversal_attempt

settings = get_settings()

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

# Bucket name for application files
BUCKET_NAME = "application-files"


def _storage_error_status(exc: Exception) -> Optional[int]:
    """
    Attempt to extract an HTTP status code from a Supabase storage exception.
    """
    status = getattr(exc, "status", None)
    if isinstance(status, int):
        return status

    # Fallback: parse message such as "{'statusCode': 404, ...}"
    message = str(exc)
    match = re.search(r"['\"]statusCode['\"]\s*[:=]\s*(\d+)", message)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def _storage_error_details(exc: Exception) -> str:
    """
    Return a human-readable description of a Supabase storage error.
    """
    status = _storage_error_status(exc)
    code = getattr(exc, "code", None)
    message = getattr(exc, "message", None) or str(exc)
    return f"status={status} code={code} message={message}"


def _is_missing_bucket_error(exc: Exception) -> bool:
    """
    Detect whether an exception indicates a missing storage bucket.
    """
    status = _storage_error_status(exc)
    message = (getattr(exc, "message", None) or str(exc)).lower()
    return (
        status in (400, 404)
        and "bucket" in message
        and "not found" in message
    )


def ensure_bucket_exists() -> None:
    """
    Ensure the storage bucket exists, create if it doesn't
    """
    try:
        # Try to get bucket info
        supabase.storage.get_bucket(BUCKET_NAME)
        return
    except Exception as exc:
        # Only attempt to create the bucket when it truly does not exist
        status = _storage_error_status(exc)
        if status == 401:
            raise Exception(
                "Supabase credentials lack storage permissions. "
                "Set SUPABASE_KEY to the service role key so the API can manage buckets."
            ) from exc
        if not _is_missing_bucket_error(exc):
            raise

    try:
        supabase.storage.create_bucket(
            BUCKET_NAME,
            options={
                "public": False,
                "allowed_mime_types": [
                    "application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "image/jpeg",
                    "image/jpg",
                    "image/png",
                ],
                "file_size_limit": 10485760,  # 10MB in bytes
            },
        )
        # Verify bucket is now accessible; raises if not
        supabase.storage.get_bucket(BUCKET_NAME)
    except Exception as exc:
        # Ignore conflict errors caused by race conditions; re-raise everything else
        status = _storage_error_status(exc)
        if status == 401:
            raise Exception(
                "Supabase rejected bucket creation (401). "
                "Ensure SUPABASE_KEY is the service role key."
            ) from exc
        if status != 409:
            raise


def upload_file(
    file: Union[bytes, BinaryIO],
    filename: str,
    application_id: str,
    question_id: str,
    content_type: str
) -> dict:
    """
    Upload a file to Supabase Storage

    Args:
        file: File binary data (bytes or BinaryIO)
        filename: Original filename
        application_id: UUID of the application
        question_id: UUID of the question
        content_type: MIME type of the file

    Returns:
        dict with file path and public URL
    """
    # Ensure bucket exists
    ensure_bucket_exists()

    # Security: Generate sanitized file path to prevent path traversal attacks
    # The original filename is sanitized and prefixed with a UUID for uniqueness
    file_path = generate_safe_storage_path(
        application_id=application_id,
        question_id=question_id,
        original_filename=filename,
        add_uuid_prefix=True
    )

    # Additional security check for path traversal attempts
    if is_path_traversal_attempt(filename):
        raise Exception(f"Invalid filename: potential path traversal detected")

    if isinstance(file, (bytes, bytearray)):
        file_bytes = file
    else:
        # Normalize any file-like object to raw bytes for reliability
        file_bytes = file.read()
        if hasattr(file, "seek"):
            file.seek(0)

    def _upload_once(payload: bytes) -> None:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=payload,
            file_options={
                "content-type": content_type,
                "upsert": "true"  # Replace if file already exists; storage API expects strings
            }
        )

    try:
        # Upload file to Supabase Storage
        _upload_once(file_bytes)

        # Get signed URL (valid for 1 hour - security: shorter expiration reduces exposure window)
        signed_url = supabase.storage.from_(BUCKET_NAME).create_signed_url(
            file_path,
            expires_in=3600  # 1 hour in seconds
        )

        return {
            "path": file_path,
            "url": signed_url.get("signedURL") if signed_url else None,
            "success": True
        }
    except Exception as exc:
        status = _storage_error_status(exc)

        if _is_missing_bucket_error(exc):
            # If the bucket was missing, recreate and retry once
            ensure_bucket_exists()
            try:
                _upload_once(file_bytes)
                signed_url = supabase.storage.from_(BUCKET_NAME).create_signed_url(
                    file_path,
                    expires_in=3600  # 1 hour
                )
                return {
                    "path": file_path,
                    "url": signed_url.get("signedURL") if signed_url else None,
                    "success": True
                }
            except Exception as retry_exc:
                raise Exception(f"Failed to upload file after ensuring bucket: {str(retry_exc)}") from retry_exc

        raise Exception(
            f"Failed to upload file to Supabase ({_storage_error_details(exc)})"
        ) from exc


def download_file(file_path: str) -> bytes:
    """
    Download a file from Supabase Storage

    Args:
        file_path: Path to the file in storage

    Returns:
        File binary data
    """
    try:
        result = supabase.storage.from_(BUCKET_NAME).download(file_path)
        return result
    except Exception as e:
        raise Exception(f"Failed to download file: {str(e)}")


def delete_file(file_path: str) -> bool:
    """
    Delete a file from Supabase Storage

    Args:
        file_path: Path to the file in storage

    Returns:
        True if successful
    """
    try:
        supabase.storage.from_(BUCKET_NAME).remove([file_path])
        return True
    except Exception as e:
        raise Exception(f"Failed to delete file: {str(e)}")


def get_signed_url(file_path: str, expires_in: int = 3600) -> str:
    """
    Get a signed URL for accessing a private file

    Args:
        file_path: Path to the file in storage
        expires_in: URL expiration time in seconds (default 1 hour)

    Returns:
        Signed URL
    """
    try:
        result = supabase.storage.from_(BUCKET_NAME).create_signed_url(
            file_path,
            expires_in=expires_in
        )
        return result.get("signedURL", "")
    except Exception as e:
        raise Exception(f"Failed to generate signed URL: {str(e)}")
