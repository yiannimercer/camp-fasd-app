"""
Security utility functions for input sanitization and validation.

This module provides functions to sanitize user input to prevent:
- Path traversal attacks (../../../etc/passwd)
- Filename injection attacks
- Other file-based security vulnerabilities
"""

import os
import re
import uuid
from typing import Optional


def sanitize_filename(filename: str, max_length: int = 255) -> str:
    """
    Sanitize a filename to prevent path traversal and injection attacks.

    Security measures:
    1. Extracts only the basename (removes any path components)
    2. Removes or replaces dangerous characters
    3. Prevents null byte injection
    4. Limits filename length
    5. Handles edge cases (empty, dots only, etc.)

    Args:
        filename: The original filename from user input
        max_length: Maximum allowed length for the filename

    Returns:
        Sanitized filename safe for storage
    """
    if not filename:
        return f"unnamed_{uuid.uuid4().hex[:8]}"

    # Step 1: Get basename only - this removes path traversal like ../
    filename = os.path.basename(filename)

    # Step 2: Remove null bytes (can bypass security checks)
    filename = filename.replace('\x00', '')

    # Step 3: Replace or remove dangerous characters
    # Allow only alphanumeric, dash, underscore, dot, space
    # This regex removes characters that could cause issues in various filesystems
    filename = re.sub(r'[^\w\-_\. ]', '', filename)

    # Step 4: Handle multiple consecutive dots (prevent ../ reconstruction)
    filename = re.sub(r'\.{2,}', '.', filename)

    # Step 5: Remove leading/trailing dots and spaces
    filename = filename.strip('. ')

    # Step 6: Handle empty or invalid results
    if not filename or filename in ('.', '..'):
        return f"unnamed_{uuid.uuid4().hex[:8]}"

    # Step 7: Truncate if too long (preserve extension)
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        # Ensure extension fits within limit
        if len(ext) >= max_length:
            ext = ext[:10]  # Truncate extension if unreasonably long
        max_name_length = max_length - len(ext)
        filename = name[:max_name_length] + ext

    return filename


def generate_safe_storage_path(
    application_id: str,
    question_id: str,
    original_filename: str,
    add_uuid_prefix: bool = True
) -> str:
    """
    Generate a safe storage path for uploaded files.

    Security measures:
    1. Validates and sanitizes all path components
    2. Adds UUID prefix to prevent filename collisions and guessing
    3. Enforces consistent path structure

    Args:
        application_id: UUID of the application
        question_id: UUID of the question
        original_filename: Original filename from user
        add_uuid_prefix: Whether to add UUID prefix for uniqueness

    Returns:
        Safe storage path in format: applications/{app_id}/{q_id}/{uuid}_{filename}
    """
    # Sanitize the filename
    safe_filename = sanitize_filename(original_filename)

    # Validate UUIDs are alphanumeric (prevents injection via IDs)
    safe_app_id = re.sub(r'[^a-zA-Z0-9\-]', '', str(application_id))
    safe_question_id = re.sub(r'[^a-zA-Z0-9\-]', '', str(question_id))

    # Add UUID prefix for uniqueness and to prevent filename guessing
    if add_uuid_prefix:
        prefix = uuid.uuid4().hex[:8]
        safe_filename = f"{prefix}_{safe_filename}"

    return f"applications/{safe_app_id}/{safe_question_id}/{safe_filename}"


def validate_file_extension(filename: str, allowed_extensions: list) -> bool:
    """
    Validate that a file has an allowed extension.

    Args:
        filename: The filename to check
        allowed_extensions: List of allowed extensions (e.g., ['.pdf', '.jpg'])

    Returns:
        True if extension is allowed, False otherwise
    """
    if not filename:
        return False

    # Get extension (lowercase for case-insensitive comparison)
    _, ext = os.path.splitext(filename.lower())

    # Normalize allowed extensions to lowercase
    allowed = [e.lower() if e.startswith('.') else f'.{e.lower()}' for e in allowed_extensions]

    return ext in allowed


def validate_file_magic_bytes(file_content: bytes, declared_extension: str) -> tuple[bool, str]:
    """
    Validate that file content matches the declared file extension using magic bytes.

    This prevents attacks where a malicious file is disguised with a trusted extension.
    For example, an attacker might upload a PHP script named "image.jpg".

    Args:
        file_content: The raw file bytes
        declared_extension: The file extension claimed by the user (e.g., '.pdf')

    Returns:
        Tuple of (is_valid: bool, detected_type: str)
    """
    # Magic byte signatures for allowed file types
    # Format: (magic_bytes, offset, extension, mime_type)
    MAGIC_SIGNATURES = {
        # PDF files
        '.pdf': [
            (b'%PDF', 0, 'application/pdf'),
        ],
        # JPEG images
        '.jpg': [
            (b'\xff\xd8\xff', 0, 'image/jpeg'),
        ],
        '.jpeg': [
            (b'\xff\xd8\xff', 0, 'image/jpeg'),
        ],
        # PNG images
        '.png': [
            (b'\x89PNG\r\n\x1a\n', 0, 'image/png'),
        ],
        # Microsoft Word (DOCX) - ZIP-based format
        '.docx': [
            (b'PK\x03\x04', 0, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        ],
        # Microsoft Word (DOC) - OLE format
        '.doc': [
            (b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1', 0, 'application/msword'),
        ],
    }

    ext = declared_extension.lower()
    if ext not in MAGIC_SIGNATURES:
        # Unknown extension - allow but log
        return True, f"unknown:{ext}"

    signatures = MAGIC_SIGNATURES[ext]

    for magic_bytes, offset, mime_type in signatures:
        if len(file_content) < offset + len(magic_bytes):
            continue

        file_header = file_content[offset:offset + len(magic_bytes)]
        if file_header == magic_bytes:
            return True, mime_type

    # None of the signatures matched
    return False, f"mismatch:{ext}"


def validate_file_content(
    file_content: bytes,
    filename: str,
    allowed_extensions: list,
    max_size_bytes: int = 10 * 1024 * 1024,  # 10MB default
) -> tuple[bool, str]:
    """
    Comprehensive file validation including size, extension, and magic bytes.

    Args:
        file_content: Raw file bytes
        filename: Original filename
        allowed_extensions: List of allowed extensions (e.g., ['.pdf', '.jpg'])
        max_size_bytes: Maximum file size in bytes

    Returns:
        Tuple of (is_valid: bool, error_message: str or "valid")
    """
    # Check file size
    if len(file_content) > max_size_bytes:
        return False, f"File too large. Maximum size is {max_size_bytes / (1024*1024):.1f}MB"

    if len(file_content) == 0:
        return False, "File is empty"

    # Check extension
    if not validate_file_extension(filename, allowed_extensions):
        return False, f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"

    # Get the extension
    _, ext = os.path.splitext(filename.lower())

    # Validate magic bytes
    is_valid_magic, detected_type = validate_file_magic_bytes(file_content, ext)
    if not is_valid_magic:
        return False, f"File content does not match the declared file type ({ext})"

    return True, "valid"


def is_path_traversal_attempt(path: str) -> bool:
    """
    Check if a path contains path traversal patterns.

    This can be used as an additional check before processing paths.

    Args:
        path: The path to check

    Returns:
        True if path contains suspicious patterns, False otherwise
    """
    if not path:
        return False

    # Check for common path traversal patterns
    suspicious_patterns = [
        '..',           # Parent directory
        '//',           # Double slash
        '\\',           # Backslash (Windows path)
        '\x00',         # Null byte
        '%2e%2e',       # URL encoded ..
        '%252e%252e',   # Double URL encoded ..
        '..%c0%af',     # UTF-8 encoded ..
        '..%c1%9c',     # UTF-8 encoded ..
    ]

    path_lower = path.lower()
    return any(pattern in path_lower for pattern in suspicious_patterns)
