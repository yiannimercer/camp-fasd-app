"""
Application API endpoints
"""

import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.application import (
    Application,
    ApplicationSection,
    ApplicationQuestion,
    ApplicationResponse,
    ApplicationApproval,
    ApplicationHeader
)
from app.schemas.application import (
    ApplicationSectionWithQuestions,
    ApplicationCreate,
    ApplicationUpdate,
    Application as ApplicationSchema,
    ApplicationWithResponses,
    ApplicationWithUser,
    ApplicationProgress,
    SectionProgress,
    ApplicationResponseCreate
)
from app.models.application import File as FileModel
from app.services import storage_service
from app.services import email_service
from app.services.email_events import fire_email_event

router = APIRouter()


@router.get("/sections", response_model=List[ApplicationSectionWithQuestions])
async def get_application_sections(
    application_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all active application sections with their questions

    Optionally filters sections/questions based on application status for conditional display.
    Pass application_id to get sections relevant to that application's current status.

    Returns sections in order with all active questions
    """
    # Get application status if application_id provided
    app_status = None  # 'applicant', 'camper', 'inactive'
    app_sub_status = None  # Progress within status
    if application_id:
        application = db.query(Application).filter(
            Application.id == application_id,
            Application.user_id == current_user.id
        ).first()
        if application:
            app_status = application.status
            app_sub_status = application.sub_status

    # Build query for sections with eager-loaded questions and headers (single query instead of N+1)
    sections_query = db.query(ApplicationSection).options(
        joinedload(ApplicationSection.questions),
        joinedload(ApplicationSection.headers)
    ).filter(
        ApplicationSection.is_active == True
    )

    # Filter sections by required_status (applicant vs camper)
    if app_status == 'applicant':
        # Applicants see sections with required_status=NULL or 'applicant'
        sections_query = sections_query.filter(
            (ApplicationSection.required_status == None) |
            (ApplicationSection.required_status == 'applicant')
        )
    # Campers see all sections (no required_status filter)

    sections = sections_query.order_by(ApplicationSection.order_index).all()

    # Filter questions and headers by is_active
    for section in sections:
        section.questions = [q for q in section.questions if q.is_active]
        section.headers = [h for h in section.headers if h.is_active]

    return sections


@router.post("", response_model=ApplicationSchema, status_code=status.HTTP_201_CREATED)
async def create_application(
    application_data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new application for the current user

    Users can create multiple applications (one per camper/child)
    """

    # Create new application with 'applicant' status and 'not_started' sub_status
    application = Application(
        user_id=current_user.id,
        camper_first_name=application_data.camper_first_name,
        camper_last_name=application_data.camper_last_name,
        status="applicant",
        sub_status="not_started"
    )

    db.add(application)
    db.commit()
    db.refresh(application)

    # Fire email automation event for application created
    try:
        await fire_email_event(
            db=db,
            event='application_created',
            application_id=application.id,
            user_id=current_user.id
        )
    except Exception as e:
        # Log error but don't fail the application creation
        print(f"Failed to fire application_created event: {e}")

    return application


@router.get("")
async def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all applications for the current user

    Includes profile_photo_url if the camper has uploaded a profile picture
    """
    applications = db.query(Application).filter(
        Application.user_id == current_user.id
    ).all()

    if not applications:
        return []

    # Get all profile picture question IDs
    profile_picture_questions = db.query(ApplicationQuestion.id).filter(
        ApplicationQuestion.question_type == 'profile_picture',
        ApplicationQuestion.is_active == True
    ).all()
    profile_picture_question_ids = [q.id for q in profile_picture_questions]

    # Get application IDs
    application_ids = [app.id for app in applications]

    # Get all responses for profile picture questions across all user's applications
    profile_responses = db.query(ApplicationResponse).filter(
        ApplicationResponse.application_id.in_(application_ids),
        ApplicationResponse.question_id.in_(profile_picture_question_ids),
        ApplicationResponse.file_id != None
    ).all()

    # Build a map of application_id -> file_id
    app_to_file_id = {resp.application_id: resp.file_id for resp in profile_responses}

    # Get all file records at once
    file_ids = list(set(app_to_file_id.values()))
    if file_ids:
        file_records = db.query(FileModel).filter(
            FileModel.id.in_(file_ids)
        ).all()
        file_map = {f.id: f for f in file_records}
    else:
        file_map = {}

    # Generate signed URLs and build response
    results = []
    for app in applications:
        app_dict = ApplicationSchema.model_validate(app).model_dump()

        # Add profile photo URL if available
        file_id = app_to_file_id.get(app.id)
        if file_id and file_id in file_map:
            file_record = file_map[file_id]
            try:
                # Generate signed URL (uses default 15-minute expiration)
                signed_url = storage_service.get_signed_url(file_record.storage_path)
                app_dict['profile_photo_url'] = signed_url
            except Exception as e:
                # Log error but continue - profile photo is non-critical
                print(f"Failed to get signed URL for profile photo: {e}")
                app_dict['profile_photo_url'] = None
        else:
            app_dict['profile_photo_url'] = None

        results.append(app_dict)

    return results


@router.get("/admin/sections", response_model=List[ApplicationSectionWithQuestions])
async def get_application_sections_admin(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Admin-only: Get all application sections for any application

    Unlike the regular sections endpoint, this doesn't filter by user ownership
    """
    # Get application status (admin can view any application)
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    app_status = application.status
    app_sub_status = application.sub_status

    # Build query for sections with eager-loaded questions and headers
    sections_query = db.query(ApplicationSection).options(
        joinedload(ApplicationSection.questions),
        joinedload(ApplicationSection.headers)
    ).filter(
        ApplicationSection.is_active == True
    )

    # Filter sections by required_status (applicant vs camper)
    if app_status == 'applicant':
        sections_query = sections_query.filter(
            (ApplicationSection.required_status == None) |
            (ApplicationSection.required_status == 'applicant')
        )
    # Campers see all sections

    sections = sections_query.order_by(ApplicationSection.order_index).all()

    # Filter questions and headers by is_active
    for section in sections:
        section.questions = [q for q in section.questions if q.is_active]
        section.headers = [h for h in section.headers if h.is_active]

    return sections


@router.get("/admin/all")
async def get_all_applications_admin(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by camper name or user email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Admin-only: Get all applications with filtering and user information

    Query Parameters:
    - status_filter: Filter by status in format "status:sub_status:payment" (e.g., "applicant", "applicant:under_review", "camper:complete:paid")
    - search: Search by camper name or user email
    """
    from sqlalchemy.orm import joinedload
    from datetime import date

    query = db.query(Application).join(User, Application.user_id == User.id).options(
        joinedload(Application.user),
        joinedload(Application.responses),
        joinedload(Application.approvals).joinedload(ApplicationApproval.admin),
        joinedload(Application.notes)
    )

    # Apply status filter with new format: "status:sub_status:payment"
    # Special value "open" excludes inactive applications
    if status_filter == 'open':
        # All Open = exclude inactive status
        query = query.filter(Application.status != 'inactive')
    elif status_filter:
        parts = status_filter.split(':')
        status = parts[0] if len(parts) > 0 else None
        sub_status = parts[1] if len(parts) > 1 else None
        payment = parts[2] if len(parts) > 2 else None

        if status:
            query = query.filter(Application.status == status)
        if sub_status:
            query = query.filter(Application.sub_status == sub_status)
        if payment == 'paid':
            query = query.filter(Application.paid_invoice == True)
        elif payment == 'unpaid':
            query = query.filter(Application.paid_invoice == False)

    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Application.camper_first_name.ilike(search_term),
                Application.camper_last_name.ilike(search_term),
                User.email.ilike(search_term),
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term)
            )
        )

    # Order by most recent first
    query = query.order_by(Application.updated_at.desc())

    applications = query.all()

    # Get question IDs for Legal Sex and Date of Birth to extract camper metadata
    legal_sex_question = db.query(ApplicationQuestion.id).filter(
        ApplicationQuestion.question_text == 'Legal Sex',
        ApplicationQuestion.is_active == True
    ).first()
    dob_question = db.query(ApplicationQuestion.id).filter(
        ApplicationQuestion.question_text == 'Date of Birth',
        ApplicationQuestion.is_active == True
    ).first()

    legal_sex_qid = str(legal_sex_question.id) if legal_sex_question else None
    dob_qid = str(dob_question.id) if dob_question else None

    # Convert to dict and add approval information
    result = []
    for app in applications:
        app_dict = ApplicationWithUser.model_validate(app).model_dump()

        # Add approval stats
        approvals = [a for a in app.approvals if a.approved]
        declines = [a for a in app.approvals if not a.approved]
        app_dict['approval_count'] = len(approvals)
        app_dict['decline_count'] = len(declines)
        app_dict['approved_by_teams'] = [a.admin.team for a in approvals if a.admin and a.admin.team]

        # Add note count
        app_dict['note_count'] = len(app.notes) if app.notes else 0

        # Extract camper_gender from Legal Sex response
        if legal_sex_qid and app.responses:
            for resp in app.responses:
                if str(resp.question_id) == legal_sex_qid and resp.response_value:
                    app_dict['camper_gender'] = resp.response_value
                    break

        # Extract and calculate camper_age from Date of Birth response
        if dob_qid and app.responses:
            for resp in app.responses:
                if str(resp.question_id) == dob_qid and resp.response_value:
                    try:
                        # Parse the date (expected format: YYYY-MM-DD)
                        dob = date.fromisoformat(resp.response_value)
                        today = date.today()
                        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                        app_dict['camper_age'] = age
                        app_dict['camper_dob'] = resp.response_value  # Also return DOB for tooltip display
                    except (ValueError, TypeError):
                        pass  # Invalid date format, skip
                    break

        result.append(app_dict)

    return result


@router.get("/admin/{application_id}", response_model=ApplicationWithUser)
async def get_application_admin(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Admin-only: Get any application with all responses and user info
    """
    from sqlalchemy.orm import joinedload

    application = db.query(Application).options(
        joinedload(Application.user),
        joinedload(Application.responses)
    ).filter(
        Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    return application


@router.get("/{application_id}", response_model=ApplicationWithResponses)
async def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific application with all responses (user must own the application)
    """
    from sqlalchemy.orm import joinedload

    application = db.query(Application).options(
        joinedload(Application.responses)
    ).filter(
        Application.id == application_id,
        Application.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    return application


@router.patch("/{application_id}", response_model=ApplicationSchema)
async def update_application(
    application_id: str,
    update_data: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update application and save responses (autosave)

    This endpoint handles:
    - Updating basic application info
    - Saving/updating responses to questions
    - Calculating completion percentage
    """
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    # Update basic info
    if update_data.camper_first_name is not None:
        application.camper_first_name = update_data.camper_first_name
    if update_data.camper_last_name is not None:
        application.camper_last_name = update_data.camper_last_name

    # Save responses if provided
    if update_data.responses:
        # OPTIMIZED: Pre-load all existing responses for this application in ONE query
        # This eliminates N individual queries (1 per response being saved)
        existing_responses_list = db.query(ApplicationResponse).filter(
            ApplicationResponse.application_id == application_id
        ).all()
        existing_responses_map = {str(r.question_id): r for r in existing_responses_list}

        # OPTIMIZED: Pre-load all questions being updated in ONE query
        # This eliminates N individual queries for camper name sync
        question_ids = [r.question_id for r in update_data.responses]
        questions_list = db.query(ApplicationQuestion).filter(
            ApplicationQuestion.id.in_(question_ids)
        ).all()
        questions_map = {str(q.id): q for q in questions_list}

        for response_data in update_data.responses:
            # Check if response already exists using pre-loaded map (O(1) lookup)
            # Use str() to ensure consistent key format (handles both UUID and string types)
            question_id_str = str(response_data.question_id)
            existing_response = existing_responses_map.get(question_id_str)

            if existing_response:
                # Update existing response
                existing_response.response_value = response_data.response_value
                existing_response.file_id = response_data.file_id
            else:
                # Create new response
                new_response = ApplicationResponse(
                    application_id=application_id,
                    question_id=response_data.question_id,
                    response_value=response_data.response_value,
                    file_id=response_data.file_id
                )
                db.add(new_response)

            # Sync camper name fields to applications table when those questions are updated
            # This keeps the denormalized columns in sync with the response values
            # OPTIMIZED: Use pre-loaded questions map (O(1) lookup instead of query)
            question = questions_map.get(question_id_str)
            if question:
                question_text_lower = (question.question_text or '').lower().strip()
                if question_text_lower == 'camper first name':
                    application.camper_first_name = response_data.response_value
                elif question_text_lower == 'camper last name':
                    application.camper_last_name = response_data.response_value

    # CRITICAL: Flush pending changes to DB before calculating completion
    # Without this, newly added responses may not be visible to the completion query
    # because SQLAlchemy's autoflush can be unreliable with complex queries
    db.flush()

    # Calculate completion percentage
    completion = calculate_completion_percentage(db, application_id)
    application.completion_percentage = completion

    # Auto sub_status transitions based on status and progress
    old_status = application.status
    old_sub_status = application.sub_status

    if old_status == 'applicant':
        # Applicant transitions
        if old_sub_status == 'not_started' and completion > 0:
            # First response → incomplete
            application.sub_status = 'incomplete'
        elif old_sub_status == 'incomplete' and completion == 100:
            # 100% complete → complete (ready for review)
            application.sub_status = 'complete'
            application.completed_at = datetime.now(timezone.utc)
    elif old_status == 'camper':
        # Camper transitions
        if old_sub_status == 'incomplete' and completion == 100:
            # Camper 100% complete → complete (still needs payment separately)
            application.sub_status = 'complete'

    db.commit()
    db.refresh(application)

    # Fire email events for sub_status transitions
    new_sub_status = application.sub_status
    if old_sub_status != new_sub_status:
        try:
            if old_status == 'applicant':
                if new_sub_status == 'incomplete':
                    await fire_email_event(db=db, event='applicant_incomplete', application_id=application.id, user_id=current_user.id)
                elif new_sub_status == 'complete':
                    await fire_email_event(db=db, event='applicant_complete', application_id=application.id, user_id=current_user.id)
            elif old_status == 'camper':
                if new_sub_status == 'complete':
                    await fire_email_event(db=db, event='camper_complete', application_id=application.id, user_id=current_user.id)
        except Exception as e:
            print(f"Failed to fire sub_status transition event: {e}")

    return application


def is_response_empty(response_value: str) -> bool:
    """
    Check if a response is effectively empty
    Empty means: None, empty string, empty array [], empty object {}, or whitespace only
    """
    if not response_value:
        return True

    # Strip whitespace and check common empty values
    cleaned = response_value.strip()
    if not cleaned:
        return True

    # Check for empty JSON structures
    if cleaned in ['[]', '{}', '""', "''", 'null']:
        return True

    # Check for JSON with only whitespace (e.g., "{ }" or "[ ]")
    if cleaned.startswith('[') and cleaned.endswith(']'):
        content = cleaned[1:-1].strip()
        if not content:
            return True

    if cleaned.startswith('{') and cleaned.endswith('}'):
        content = cleaned[1:-1].strip()
        if not content:
            return True

    return False


def extract_response_value(response_value: Optional[str]) -> Optional[str]:
    """
    Extract the actual answer value from a response that may be stored as JSON.

    Responses with detail prompts are stored as: {"value": "Yes", "detail": "..."}
    This function extracts just the "value" field for conditional logic matching.

    Returns the original value if it's not JSON or doesn't have a "value" field.
    """
    if not response_value:
        return response_value

    # Try to parse as JSON
    try:
        parsed = json.loads(response_value)
        # If it's a dict with a "value" key, return that
        if isinstance(parsed, dict) and 'value' in parsed:
            return parsed['value']
    except (json.JSONDecodeError, TypeError):
        pass

    # Not JSON or no "value" field, return as-is
    return response_value


@router.post("/{application_id}/reactivate", response_model=ApplicationSchema)
async def reactivate_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reactivate a deactivated application

    This endpoint allows users to reactivate their own deactivated applications.
    The sub_status is determined by the current state of responses:
    - not_started: No questions answered
    - incomplete: Some questions answered but not 100%
    - complete: All required questions answered (100%)

    Used for:
    - Users reactivating apps that admins deactivated
    - Next season restart when camper apps are reset to inactive
    """
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    if application.status != 'inactive':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only inactive applications can be reactivated"
        )

    # Recalculate completion percentage for applicant status
    # (we calculate as if they were an applicant to get proper completion)
    completion = calculate_completion_for_status(db, application_id, 'applicant')

    # Determine appropriate sub_status based on completion
    if completion == 0:
        new_sub_status = 'not_started'
    elif completion == 100:
        new_sub_status = 'complete'
    else:
        new_sub_status = 'incomplete'

    # Update application
    application.status = 'applicant'
    application.sub_status = new_sub_status
    application.completion_percentage = completion
    application.reactivated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(application)

    # Fire email event for reactivation
    try:
        await fire_email_event(
            db=db,
            event='application_reactivated',
            application_id=application.id,
            user_id=current_user.id
        )
    except Exception as e:
        print(f"Failed to fire application_reactivated event: {e}")

    return application


@router.post("/{application_id}/withdraw")
async def withdraw_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Withdraw an application (family-initiated)

    Sets status='inactive', sub_status='withdrawn' and records timestamp.
    This is a family-initiated withdrawal, different from admin deactivation.

    Can only withdraw applications that:
    - Belong to the current user
    - Are not already inactive
    - Are not campers who have paid
    """
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    # Can't withdraw if already inactive
    if application.status == 'inactive':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application is already inactive"
        )

    # Can't withdraw if camper has paid
    if application.status == 'camper' and application.paid_invoice == True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot withdraw after payment has been made. Please contact admin@fasdcamp.org"
        )

    old_status = application.status
    application.status = 'inactive'
    application.sub_status = 'withdrawn'
    application.withdrawn_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(application)

    # Fire email event for withdrawal
    try:
        await fire_email_event(
            db=db,
            event='application_withdrawn',
            application_id=application.id,
            user_id=current_user.id,
            extra_context={'previous_status': old_status, 'initiated_by': 'user'}
        )
    except Exception as e:
        print(f"Failed to fire application_withdrawn event: {e}")

    return {
        "message": "Application withdrawn successfully",
        "application_id": str(application.id),
        "status": application.status,
        "sub_status": application.sub_status,
        "withdrawn_at": application.withdrawn_at.isoformat()
    }


@router.get("/{application_id}/progress", response_model=ApplicationProgress)
async def get_application_progress(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed progress for an application

    Returns completion status for each section and overall progress
    """
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    # Get application status for conditional filtering
    app_status = application.status  # 'applicant', 'camper', 'inactive'
    app_sub_status = application.sub_status  # Progress within status

    # OPTIMIZED: Load sections with questions in ONE query (not N+1)
    sections_query = db.query(ApplicationSection).options(
        joinedload(ApplicationSection.questions)
    ).filter(
        ApplicationSection.is_active == True
    )

    # Filter sections by required_status (applicant vs camper)
    if app_status == 'applicant':
        sections_query = sections_query.filter(
            (ApplicationSection.required_status == None) |
            (ApplicationSection.required_status == 'applicant')
        )
    # Campers see all sections

    sections = sections_query.order_by(ApplicationSection.order_index).all()

    # Get all responses for this application (we need these to evaluate conditional logic)
    all_responses = db.query(ApplicationResponse).filter(
        ApplicationResponse.application_id == application_id
    ).all()

    # Create a dict of question_id -> response_value for quick lookup
    response_dict = {str(r.question_id): r.response_value for r in all_responses}

    # Helper function to check if a question should be shown based on conditional logic
    def should_show_question(question: ApplicationQuestion) -> bool:
        # If no conditional logic, always show
        if not question.show_if_question_id or not question.show_if_answer:
            return True

        # Get the trigger question's response
        trigger_response = response_dict.get(str(question.show_if_question_id))

        # Extract the actual value (handles JSON responses with detail prompts)
        # e.g., {"value": "Yes", "detail": "..."} -> "Yes"
        actual_value = extract_response_value(trigger_response)

        # Show the question only if the trigger response matches the expected answer
        return actual_value == question.show_if_answer

    section_progress_list = []
    completed_sections = 0
    sections_with_requirements = 0  # Only count sections that have required questions

    for section in sections:
        # OPTIMIZED: Filter questions in memory (already loaded via joinedload)
        questions = [q for q in section.questions if q.is_active]

        # Filter questions by conditional logic
        visible_questions = [q for q in questions if should_show_question(q)]

        total_questions = len(visible_questions)
        required_questions = sum(1 for q in visible_questions if q.is_required)

        # Get responses for visible questions only
        visible_question_ids = [q.id for q in visible_questions]
        responses = [r for r in all_responses if r.question_id in visible_question_ids]

        # Filter out empty responses - they don't count as answered
        # A response is "answered" if it has a non-empty response_value OR a file_id (for file uploads)
        non_empty_responses = [
            r for r in responses
            if not is_response_empty(r.response_value) or r.file_id is not None
        ]

        answered_questions = len(non_empty_responses)
        answered_required = sum(
            1 for r in non_empty_responses
            if any(q.id == r.question_id and q.is_required for q in visible_questions)
        )

        # Calculate section completion
        # ONLY required questions factor into completion - optional questions don't affect it
        if required_questions > 0:
            sections_with_requirements += 1
            section_percentage = int((answered_required / required_questions) * 100)
            is_complete = answered_required == required_questions
            if is_complete:
                completed_sections += 1
        else:
            # Section with NO required questions - excluded from overall % calculation
            # The frontend will hide progress indicators for these sections entirely
            section_percentage = 0  # 0% because there's nothing required to track
            is_complete = True  # Visually shown as complete, but doesn't count toward %

        section_progress_list.append(SectionProgress(
            section_id=section.id,
            section_title=section.title,
            total_questions=total_questions,
            required_questions=required_questions,
            answered_questions=answered_questions,
            answered_required=answered_required,
            completion_percentage=section_percentage,
            is_complete=is_complete
        ))

    # Calculate overall percentage based only on sections with required questions
    # Formula: completed sections / sections with requirements * 100
    total_sections = len(sections)
    if sections_with_requirements == 0:
        overall_percentage = 100  # No required questions anywhere = 100% complete
    else:
        overall_percentage = int((completed_sections / sections_with_requirements) * 100)

    return ApplicationProgress(
        application_id=application.id,
        total_sections=total_sections,
        completed_sections=completed_sections,
        overall_percentage=overall_percentage,
        section_progress=section_progress_list
    )


def calculate_completion_for_status(db: Session, application_id: str, target_status: str) -> int:
    """
    Calculate completion percentage assuming a specific status.

    This is useful for reactivation where we need to know completion
    as if the user were an applicant, even if they're currently inactive.

    Args:
        db: Database session
        application_id: The application ID
        target_status: The status to calculate for ('applicant' or 'camper')
    """
    # Get sections filtered for the target status
    sections_query = db.query(ApplicationSection).filter(
        ApplicationSection.is_active == True
    )

    if target_status == 'applicant':
        sections_query = sections_query.filter(
            (ApplicationSection.required_status == None) |
            (ApplicationSection.required_status == 'applicant')
        )

    sections = sections_query.all()

    if not sections:
        return 100

    # Get all responses for this application
    responses = db.query(ApplicationResponse).filter(
        ApplicationResponse.application_id == application_id
    ).all()

    response_dict = {str(r.question_id): r.response_value for r in responses}
    file_dict = {str(r.question_id): r.file_id for r in responses if r.file_id is not None}

    def is_question_answered(question_id: str) -> bool:
        if question_id in file_dict:
            return True
        response = response_dict.get(question_id)
        return response is not None and not is_response_empty(response)

    def should_show_question(question) -> bool:
        if not question.show_if_question_id or not question.show_if_answer:
            return True
        trigger_response = response_dict.get(str(question.show_if_question_id))
        # Extract the actual value (handles JSON responses with detail prompts)
        actual_value = extract_response_value(trigger_response)
        return actual_value is not None and actual_value == question.show_if_answer

    completed_sections = 0
    sections_with_requirements = 0

    for section in sections:
        questions = db.query(ApplicationQuestion).filter(
            ApplicationQuestion.section_id == section.id,
            ApplicationQuestion.is_active == True
        ).all()

        visible_questions = [q for q in questions if should_show_question(q)]
        required_questions = [q for q in visible_questions if q.is_required]

        if required_questions:
            sections_with_requirements += 1
            answered_required = sum(1 for q in required_questions if is_question_answered(str(q.id)))
            if answered_required == len(required_questions):
                completed_sections += 1

    if sections_with_requirements == 0:
        return 100
    return int((completed_sections / sections_with_requirements) * 100)


def calculate_completion_percentage(db: Session, application_id: str) -> int:
    """
    Calculate the completion percentage for an application.

    Formula: (sections 100% complete) / (sections with required questions) * 100

    Only sections that have at least one required question count toward the percentage.
    Sections with only optional questions are excluded from the calculation entirely.
    A section is "100% complete" when ALL its required questions are answered.

    Status filtering:
    - Applicants see: sections with required_status=NULL or required_status='applicant'
    - Campers see: all sections (required_status=NULL, 'applicant', or 'camper')
    """
    # Get the application to check its status
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        return 0

    app_status = application.status  # 'applicant', 'camper', or 'inactive'
    app_sub_status = application.sub_status

    # OPTIMIZED: Load all sections with questions in ONE query (not N+1)
    # This reduces 14+ queries down to 1 query
    sections_query = db.query(ApplicationSection).options(
        joinedload(ApplicationSection.questions)
    ).filter(
        ApplicationSection.is_active == True
    )

    # Filter sections by required_status
    # Applicant: Show sections with required_status=NULL or required_status='applicant'
    # Camper: Show all sections (no required_status filter needed)
    if app_status == 'applicant':
        sections_query = sections_query.filter(
            (ApplicationSection.required_status == None) |
            (ApplicationSection.required_status == 'applicant')
        )
    # For Camper/Inactive, include all sections (no required_status filter)

    # Order by order_index to ensure consistent ordering
    sections = sections_query.order_by(ApplicationSection.order_index).all()

    if not sections:
        return 100

    # Get all responses for this application
    responses = db.query(ApplicationResponse).filter(
        ApplicationResponse.application_id == application_id
    ).all()

    # Create dicts for quick lookup
    # response_dict: question_id -> response_value (for text responses)
    # file_dict: question_id -> file_id (for file uploads)
    response_dict = {str(r.question_id): r.response_value for r in responses}
    file_dict = {str(r.question_id): r.file_id for r in responses if r.file_id is not None}

    # Helper to check if a question is answered (text response OR file upload)
    def is_question_answered(question_id: str) -> bool:
        # Check for file upload first
        if question_id in file_dict:
            return True
        # Check for text response
        if question_id in response_dict and not is_response_empty(response_dict[question_id]):
            return True
        return False

    # Helper function to check if a question should be shown based on conditional logic
    def should_show_question(question: ApplicationQuestion) -> bool:
        if not question.show_if_question_id or not question.show_if_answer:
            return True
        trigger_response = response_dict.get(str(question.show_if_question_id))
        # Extract the actual value (handles JSON responses with detail prompts)
        # e.g., {"value": "Yes", "detail": "..."} -> "Yes"
        actual_value = extract_response_value(trigger_response)
        return actual_value == question.show_if_answer

    # Count sections with required questions and how many are complete
    sections_with_requirements = 0
    completed_sections = 0

    for section in sections:
        # OPTIMIZED: Filter questions in memory (already loaded via joinedload)
        # No database query needed - questions are pre-loaded with sections
        questions = [q for q in section.questions if q.is_active]

        # Sort by order_index (already sorted by relationship, but ensure consistency)
        questions = sorted(questions, key=lambda q: q.order_index or 0)

        # Filter by conditional logic (show_if_question_id / show_if_answer)
        visible_questions = [q for q in questions if should_show_question(q)]

        # Count required questions in this section
        required_questions = [q for q in visible_questions if q.is_required]

        # Only count sections that have at least one required question
        if required_questions:
            sections_with_requirements += 1
            # Section is complete when ALL required questions are answered
            answered_required = sum(
                1 for q in required_questions
                if is_question_answered(str(q.id))
            )
            if answered_required == len(required_questions):
                completed_sections += 1
        # Sections with no required questions are excluded from calculation entirely

    # Formula: completed sections / sections with requirements
    if sections_with_requirements == 0:
        return 100  # No required questions anywhere = 100% complete
    return int((completed_sections / sections_with_requirements) * 100)
