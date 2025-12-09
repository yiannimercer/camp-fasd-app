"""
Application API endpoints
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.application import (
    Application,
    ApplicationSection,
    ApplicationQuestion,
    ApplicationResponse,
    ApplicationApproval
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
    app_status = None
    if application_id:
        application = db.query(Application).filter(
            Application.id == application_id,
            Application.user_id == current_user.id
        ).first()
        if application:
            app_status = application.status

    # Build query for sections
    sections_query = db.query(ApplicationSection).filter(
        ApplicationSection.is_active == True
    )

    # Filter sections by status if applicable
    if app_status:
        # Show sections that have no status requirement OR match the current status
        sections_query = sections_query.filter(
            (ApplicationSection.show_when_status == None) |
            (ApplicationSection.show_when_status == app_status)
        )
    else:
        # If no application or status, only show sections with no status requirement
        sections_query = sections_query.filter(
            ApplicationSection.show_when_status == None
        )

    sections = sections_query.order_by(ApplicationSection.order_index).all()

    # Filter questions within each section
    if app_status:
        for section in sections:
            # Filter questions to only show those matching the status
            section.questions = [
                q for q in section.questions
                if q.is_active and (q.show_when_status is None or q.show_when_status == app_status)
            ]
    else:
        for section in sections:
            # Only show questions with no status requirement
            section.questions = [
                q for q in section.questions
                if q.is_active and q.show_when_status is None
            ]

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

    # Create new application
    application = Application(
        user_id=current_user.id,
        camper_first_name=application_data.camper_first_name,
        camper_last_name=application_data.camper_last_name,
        status="in_progress"
    )

    db.add(application)
    db.commit()
    db.refresh(application)

    return application


@router.get("", response_model=List[ApplicationSchema])
async def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all applications for the current user
    """
    applications = db.query(Application).filter(
        Application.user_id == current_user.id
    ).all()

    return applications


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
    - status_filter: Filter by application status (in_progress, under_review, approved, etc.)
    - search: Search by camper name or user email
    """
    from sqlalchemy.orm import joinedload

    query = db.query(Application).join(User, Application.user_id == User.id).options(
        joinedload(Application.user),
        joinedload(Application.responses),
        joinedload(Application.approvals).joinedload(ApplicationApproval.admin)
    )

    # Apply status filter
    if status_filter:
        query = query.filter(Application.status == status_filter)

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

    # Convert to dict and add approval information
    result = []
    for app in applications:
        app_dict = ApplicationWithUser.model_validate(app).model_dump()

        # Add approval stats
        approvals = [a for a in app.approvals if a.approved]
        app_dict['approval_count'] = len(approvals)
        app_dict['approved_by_teams'] = [a.admin.team for a in approvals if a.admin and a.admin.team]

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
        for response_data in update_data.responses:
            # Check if response already exists
            existing_response = db.query(ApplicationResponse).filter(
                ApplicationResponse.application_id == application_id,
                ApplicationResponse.question_id == response_data.question_id
            ).first()

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

    # Calculate completion percentage
    completion = calculate_completion_percentage(db, application_id)
    application.completion_percentage = completion

    # Auto-mark as under_review when 100% complete
    if completion == 100 and application.status == "in_progress":
        application.status = "under_review"
        application.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(application)

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
    app_status = application.status

    # Get sections filtered by status
    sections_query = db.query(ApplicationSection).filter(
        ApplicationSection.is_active == True
    )

    # Filter sections by status
    if app_status:
        sections_query = sections_query.filter(
            (ApplicationSection.show_when_status == None) |
            (ApplicationSection.show_when_status == app_status)
        )
    else:
        sections_query = sections_query.filter(
            ApplicationSection.show_when_status == None
        )

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

        # Show the question only if the trigger response matches the expected answer
        return trigger_response == question.show_if_answer

    section_progress_list = []
    completed_sections = 0

    for section in sections:
        # Get questions for this section, filtered by status
        questions_query = db.query(ApplicationQuestion).filter(
            ApplicationQuestion.section_id == section.id,
            ApplicationQuestion.is_active == True
        )

        # Filter questions by status
        if app_status:
            questions_query = questions_query.filter(
                (ApplicationQuestion.show_when_status == None) |
                (ApplicationQuestion.show_when_status == app_status)
            )
        else:
            questions_query = questions_query.filter(
                ApplicationQuestion.show_when_status == None
            )

        questions = questions_query.all()

        # Filter questions by conditional logic
        visible_questions = [q for q in questions if should_show_question(q)]

        total_questions = len(visible_questions)
        required_questions = sum(1 for q in visible_questions if q.is_required)

        # Get responses for visible questions only
        visible_question_ids = [q.id for q in visible_questions]
        responses = [r for r in all_responses if r.question_id in visible_question_ids]

        # Filter out empty responses - they don't count as answered
        non_empty_responses = [r for r in responses if not is_response_empty(r.response_value)]

        answered_questions = len(non_empty_responses)
        answered_required = sum(
            1 for r in non_empty_responses
            if any(q.id == r.question_id and q.is_required for q in visible_questions)
        )

        # Calculate section completion
        # For sections with required questions: complete when all required are answered
        # For sections with NO required questions: complete when ALL questions are answered
        if required_questions > 0:
            section_percentage = int((answered_required / required_questions) * 100)
            is_complete = answered_required == required_questions
        else:
            # No required questions - must answer ALL questions to be complete
            if total_questions > 0:
                section_percentage = int((answered_questions / total_questions) * 100)
                is_complete = answered_questions == total_questions
            else:
                # Section with no questions at all is complete
                section_percentage = 100
                is_complete = True

        if is_complete:
            completed_sections += 1

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

    # Calculate overall percentage
    total_sections = len(sections)
    overall_percentage = int((completed_sections / total_sections) * 100) if total_sections > 0 else 0

    return ApplicationProgress(
        application_id=application.id,
        total_sections=total_sections,
        completed_sections=completed_sections,
        overall_percentage=overall_percentage,
        section_progress=section_progress_list
    )


def calculate_completion_percentage(db: Session, application_id: str) -> int:
    """
    Calculate the completion percentage for an application
    Based on COMPLETED SECTIONS / TOTAL SECTIONS
    A section is complete when all its required questions are answered.

    This matches the progress endpoint calculation for consistency.
    """
    # Get the application to check its status
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        return 0

    app_status = application.status

    # Get sections filtered by status
    sections_query = db.query(ApplicationSection).filter(
        ApplicationSection.is_active == True
    )

    if app_status:
        sections_query = sections_query.filter(
            (ApplicationSection.show_when_status == None) |
            (ApplicationSection.show_when_status == app_status)
        )
    else:
        sections_query = sections_query.filter(
            ApplicationSection.show_when_status == None
        )

    sections = sections_query.all()

    if not sections:
        return 100

    # Get all responses for this application
    responses = db.query(ApplicationResponse).filter(
        ApplicationResponse.application_id == application_id
    ).all()

    # Create a dict of question_id -> response_value for quick lookup
    response_dict = {str(r.question_id): r.response_value for r in responses}

    # Helper function to check if a question should be shown based on conditional logic
    def should_show_question(question: ApplicationQuestion) -> bool:
        if not question.show_if_question_id or not question.show_if_answer:
            return True
        trigger_response = response_dict.get(str(question.show_if_question_id))
        return trigger_response == question.show_if_answer

    # Count completed sections
    completed_sections = 0

    for section in sections:
        # Get questions for this section, filtered by status
        questions_query = db.query(ApplicationQuestion).filter(
            ApplicationQuestion.section_id == section.id,
            ApplicationQuestion.is_active == True
        )

        if app_status:
            questions_query = questions_query.filter(
                (ApplicationQuestion.show_when_status == None) |
                (ApplicationQuestion.show_when_status == app_status)
            )
        else:
            questions_query = questions_query.filter(
                ApplicationQuestion.show_when_status == None
            )

        questions = questions_query.all()

        # Filter by conditional logic
        visible_questions = [q for q in questions if should_show_question(q)]

        # Count required questions in this section
        required_questions = [q for q in visible_questions if q.is_required]
        total_questions = len(visible_questions)

        if required_questions:
            # Has required questions - check if all required are answered
            answered_required = sum(
                1 for q in required_questions
                if str(q.id) in response_dict and not is_response_empty(response_dict[str(q.id)])
            )
            if answered_required == len(required_questions):
                completed_sections += 1
        elif total_questions > 0:
            # No required questions but has optional questions - must answer ALL
            answered_questions = sum(
                1 for q in visible_questions
                if str(q.id) in response_dict and not is_response_empty(response_dict[str(q.id)])
            )
            if answered_questions == total_questions:
                completed_sections += 1
        else:
            # Section with no questions at all is complete
            completed_sections += 1

    total_sections = len(sections)
    return int((completed_sections / total_sections) * 100) if total_sections > 0 else 100
