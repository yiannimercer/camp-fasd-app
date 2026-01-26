"""
File Management API Routes
Handles file uploads and downloads for application documents
"""

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Form
from sqlalchemy.orm import Session, joinedload
from typing import List

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.security_utils import validate_file_content
from ..models.user import User
from ..models.application import (
    Application,
    File as FileModel,
    ApplicationResponse,
    ApplicationQuestion,
)
from ..services import storage_service
from ..core.config import settings

router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("/upload-template")
async def upload_template_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a template file for a question

    Super admins can upload template files that families can download.
    These are not tied to a specific application.
    """
    # Only super admins can upload templates
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    # Read file content for validation
    file_content = await file.read()
    file_size = len(file_content)

    # Comprehensive file validation including size, extension, and magic bytes
    # This prevents malicious files disguised as trusted extensions
    is_valid, error_message = validate_file_content(
        file_content=file_content,
        filename=file.filename,
        allowed_extensions=settings.ALLOWED_FILE_TYPES,
        max_size_bytes=settings.MAX_FILE_SIZE,
    )

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=error_message
        )

    # Reset file pointer for upload
    await file.seek(0)

    try:
        # Upload to Supabase Storage in templates folder
        upload_result = storage_service.upload_file(
            file=file_content,
            filename=file.filename,
            application_id="templates",  # Special folder for templates
            question_id="templates",
            content_type=file.content_type or "application/octet-stream"
        )

        # Create File record without application_id (template files)
        file_record = FileModel(
            application_id=None,  # No application for templates
            uploaded_by=current_user.id,
            file_name=file.filename,
            storage_path=upload_result["path"],
            file_size=file_size,
            file_type=file.content_type or "application/octet-stream",
            section="template"
        )
        db.add(file_record)
        db.commit()
        db.refresh(file_record)

        return {
            "success": True,
            "file_id": str(file_record.id),
            "filename": file_record.file_name,
            "url": upload_result.get("url"),
            "message": "Template file uploaded successfully"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    application_id: str = Form(...),
    question_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file for an application question

    - Validates file type and size
    - Uploads to Supabase Storage
    - Creates ApplicationFile record
    - Links file to ApplicationResponse
    - Admins can upload files on behalf of families
    """
    # Check if user is admin
    is_admin = current_user.role in ["admin", "super_admin"]

    # Validate application exists and user has access
    if is_admin:
        # Admins can upload to any application
        application = db.query(Application).filter(
            Application.id == application_id
        ).first()
    else:
        # Regular users can only upload to their own applications
        application = db.query(Application).filter(
            Application.id == application_id,
            Application.user_id == current_user.id
        ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Read file content for validation
    file_content = await file.read()
    file_size = len(file_content)

    # Comprehensive file validation including size, extension, and magic bytes
    # This prevents malicious files disguised as trusted extensions
    is_valid, error_message = validate_file_content(
        file_content=file_content,
        filename=file.filename,
        allowed_extensions=settings.ALLOWED_FILE_TYPES,
        max_size_bytes=settings.MAX_FILE_SIZE,
    )

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=error_message
        )

    # Reset file pointer for upload
    await file.seek(0)

    question = db.query(ApplicationQuestion).options(
        joinedload(ApplicationQuestion.section)
    ).filter(
        ApplicationQuestion.id == question_id
    ).first()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    section_label = None
    if question.section and question.section.title:
        section_label = question.section.title[:100]

    try:
        # Upload to Supabase Storage
        upload_result = storage_service.upload_file(
            file=file_content,
            filename=file.filename,
            application_id=application_id,
            question_id=question_id,
            content_type=file.content_type or "application/octet-stream"
        )

        # Create File record
        file_record = FileModel(
            application_id=application_id,
            uploaded_by=current_user.id,
            file_name=file.filename,
            storage_path=upload_result["path"],
            file_size=file_size,
            file_type=file.content_type or "application/octet-stream",
            section=section_label
        )
        db.add(file_record)
        db.flush()  # Flush to get the file_record.id before using it

        # Update or create ApplicationResponse to link the file
        response = db.query(ApplicationResponse).filter(
            ApplicationResponse.application_id == application_id,
            ApplicationResponse.question_id == question_id
        ).first()

        if response:
            # Update existing response with file_id
            response.file_id = file_record.id
            response.response_value = None  # Clear text value when file is uploaded
        else:
            # Create new response with file
            response = ApplicationResponse(
                application_id=application_id,
                question_id=question_id,
                file_id=file_record.id
            )
            db.add(response)

        db.commit()
        db.refresh(file_record)

        return {
            "success": True,
            "file_id": file_record.id,
            "filename": file_record.file_name,
            "url": upload_result.get("url"),
            "message": "File uploaded successfully"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/template/{file_id}")
async def get_template_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get template file metadata and download URL

    Any authenticated user can download template files
    """
    # Get file record
    file_record = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.section == "template"
    ).first()

    if not file_record:
        raise HTTPException(status_code=404, detail="Template file not found")

    try:
        # Generate signed URL (uses default 15-minute expiration)
        signed_url = storage_service.get_signed_url(file_record.storage_path)

        return {
            "id": file_record.id,
            "filename": file_record.file_name,
            "size": file_record.file_size,
            "content_type": file_record.file_type,
            "url": signed_url,
            "created_at": file_record.created_at.isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get template file: {str(e)}")


@router.post("/batch")
async def get_files_batch(
    file_ids: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get multiple files' metadata and download URLs in a single request

    This is much faster than making individual requests for each file.
    """
    if not file_ids:
        return []

    print(f"[FILES BATCH] Requested {len(file_ids)} files: {file_ids}")

    # Get all file records in one query
    file_records = db.query(FileModel).filter(
        FileModel.id.in_(file_ids)
    ).all()

    found_ids = {str(f.id) for f in file_records}
    missing_ids = set(file_ids) - found_ids
    if missing_ids:
        print(f"[FILES BATCH] WARNING: {len(missing_ids)} file(s) not found in database: {missing_ids}")

    print(f"[FILES BATCH] Found {len(file_records)} file records")

    # Get all associated application IDs
    app_ids = [f.application_id for f in file_records if f.application_id]

    # Verify user has access to all applications (batch check)
    if app_ids:
        user_apps = db.query(Application.id).filter(
            Application.id.in_(app_ids),
            Application.user_id == current_user.id
        ).all()
        user_app_ids = {str(app.id) for app in user_apps}
    else:
        user_app_ids = set()

    results = []
    for file_record in file_records:
        # Check authorization
        if file_record.application_id:
            if str(file_record.application_id) not in user_app_ids and current_user.role not in ["admin", "super_admin"]:
                print(f"[FILES BATCH] Skipping file {file_record.id} - user lacks access (not owner and not admin)")
                continue  # Skip files user doesn't have access to

        try:
            # Generate signed URL (uses default 15-minute expiration)
            signed_url = storage_service.get_signed_url(file_record.storage_path)

            results.append({
                "id": str(file_record.id),
                "filename": file_record.file_name,
                "size": file_record.file_size,
                "content_type": file_record.file_type,
                "url": signed_url,
                "created_at": file_record.created_at.isoformat()
            })
        except Exception as e:
            # Log error but continue with other files
            print(f"[FILES BATCH] Failed to get signed URL for file {file_record.id} (path: {file_record.storage_path}): {e}")
            continue

    print(f"[FILES BATCH] Returning {len(results)} files")
    return results


@router.get("/{file_id}")
async def get_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get file metadata and download URL

    Returns file information and a signed URL for downloading
    """
    # Get file record
    file_record = db.query(FileModel).filter(
        FileModel.id == file_id
    ).first()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Verify user owns the application
    application = db.query(Application).filter(
        Application.id == file_record.application_id,
        Application.user_id == current_user.id
    ).first()

    if not application and current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        # Generate signed URL (uses default 15-minute expiration)
        signed_url = storage_service.get_signed_url(file_record.storage_path)

        return {
            "id": file_record.id,
            "filename": file_record.file_name,
            "size": file_record.file_size,
            "content_type": file_record.file_type,
            "url": signed_url,
            "created_at": file_record.created_at.isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get file: {str(e)}")


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a file

    Removes file from storage and database
    """
    # Get file record
    file_record = db.query(FileModel).filter(
        FileModel.id == file_id
    ).first()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Verify user owns the application
    application = db.query(Application).filter(
        Application.id == file_record.application_id,
        Application.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        # Delete from storage
        storage_service.delete_file(file_record.storage_path)

        # Remove file_id from any responses
        responses = db.query(ApplicationResponse).filter(
            ApplicationResponse.file_id == file_id
        ).all()
        for response in responses:
            response.file_id = None

        # Delete file record
        db.delete(file_record)
        db.commit()

        return {
            "success": True,
            "message": "File deleted successfully"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
