"""
Admin API routes for application management
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_admin_user
from app.core.audit import (
    log_application_event,
    ACTION_TEAM_APPROVED, ACTION_TEAM_DECLINED,
    ACTION_STATUS_PROMOTED, ACTION_STATUS_WAITLISTED,
    ACTION_STATUS_DEFERRED, ACTION_STATUS_WITHDRAWN,
    ACTION_STATUS_REJECTED, ACTION_NOTE_ADDED
)
from app.models.user import User
from app.models.application import Application, AdminNote, ApplicationApproval, ApplicationResponse, ApplicationQuestion
from app.schemas.admin_note import AdminNote as AdminNoteSchema, AdminNoteCreate
from app.schemas.application import ApplicationUpdate, Application as ApplicationSchema, ApplicationProgress
from app.services import email_service
from app.services.email_events import fire_email_event

router = APIRouter(prefix="/admin", tags=["admin"])


class ApprovalRequest(BaseModel):
    """Request body for approving/declining an application"""
    note: str  # Required note explaining the decision


@router.get("/applications/{application_id}/progress", response_model=ApplicationProgress)
async def get_application_progress_admin(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get detailed progress for an application (admin version)

    Returns completion status for each section and overall progress.
    Admin can view progress for any application.
    """
    # Import here to avoid circular dependency
    from app.api.applications import (
        ApplicationSection,
        ApplicationQuestion,
        ApplicationResponse as AppResponse,
        SectionProgress
    )

    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    # Get application status for conditional filtering
    app_status = application.status  # 'applicant', 'camper', 'inactive'
    app_sub_status = application.sub_status  # Progress within status

    # Get sections filtered by required_status and show_when_status
    sections_query = db.query(ApplicationSection).filter(
        ApplicationSection.is_active == True
    )

    # Filter sections by required_status (applicant vs camper)
    if app_status == 'applicant':
        sections_query = sections_query.filter(
            (ApplicationSection.required_status == None) |
            (ApplicationSection.required_status == 'applicant')
        )
    # Campers see all sections

    # Filter sections by show_when_status (uses sub_status)
    if app_sub_status:
        sections_query = sections_query.filter(
            (ApplicationSection.show_when_status == None) |
            (ApplicationSection.show_when_status == app_sub_status)
        )
    else:
        sections_query = sections_query.filter(
            ApplicationSection.show_when_status == None
        )

    sections = sections_query.order_by(ApplicationSection.order_index).all()

    # Get all responses for this application
    all_responses = db.query(AppResponse).filter(
        AppResponse.application_id == application_id
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
        # Get questions for this section, filtered by sub_status
        questions_query = db.query(ApplicationQuestion).filter(
            ApplicationQuestion.section_id == section.id,
            ApplicationQuestion.is_active == True
        )

        # Filter questions by show_when_status (uses sub_status)
        if app_sub_status:
            questions_query = questions_query.filter(
                (ApplicationQuestion.show_when_status == None) |
                (ApplicationQuestion.show_when_status == app_sub_status)
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

        answered_questions = len(responses)
        answered_required = sum(
            1 for r in responses
            if any(q.id == r.question_id and q.is_required for q in visible_questions)
        )

        # Calculate section completion
        if required_questions > 0:
            section_percentage = int((answered_required / required_questions) * 100)
        else:
            section_percentage = 100 if answered_questions == total_questions else 0

        is_complete = answered_required == required_questions

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


@router.get("/applications/{application_id}/approval-status")
async def get_approval_status(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get approval status for an application
    Returns approval count, decline count, and current user's vote
    """
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        # Get all approvals with admin info
        approvals = db.query(ApplicationApproval).options(
            joinedload(ApplicationApproval.admin)
        ).filter(
            ApplicationApproval.application_id == application_id
        ).all()

        # Count approvals and declines
        approval_count = sum(1 for a in approvals if a.approved)
        decline_count = sum(1 for a in approvals if not a.approved)

        # Check current user's vote
        current_user_vote = None
        for approval in approvals:
            if approval.admin_id == current_user.id:
                current_user_vote = "approved" if approval.approved else "declined"
                break

        # Get list of admins who approved/declined (including their notes)
        approved_by = [
            {
                "admin_id": str(a.admin_id),
                "name": f"{a.admin.first_name} {a.admin.last_name}" if a.admin else "Unknown",
                "team": a.admin.team if a.admin else None,
                "note": a.note
            }
            for a in approvals if a.approved
        ]

        declined_by = [
            {
                "admin_id": str(a.admin_id),
                "name": f"{a.admin.first_name} {a.admin.last_name}" if a.admin else "Unknown",
                "team": a.admin.team if a.admin else None,
                "note": a.note
            }
            for a in approvals if not a.approved
        ]

        return {
            "application_id": str(application_id),
            "approval_count": approval_count,
            "decline_count": decline_count,
            "current_user_vote": current_user_vote,
            "approved_by": approved_by,
            "declined_by": declined_by,
            "status": application.status
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting approval status: {str(e)}"
        )


@router.post("/applications/{application_id}/notes", response_model=AdminNoteSchema)
async def create_note(
    application_id: str,
    note_data: AdminNoteCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Create a new admin note on an application
    Admin-only endpoint
    """
    # Verify application exists
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    # Create note
    note = AdminNote(
        application_id=application_id,
        admin_id=current_user.id,
        note=note_data.note
    )
    db.add(note)

    # Auto-transition sub_status 'complete' → 'under_review' on first admin action (note)
    if application.status == 'applicant' and application.sub_status == 'complete':
        application.sub_status = 'under_review'
        application.under_review_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(note)

    # Log audit event
    log_application_event(
        db=db,
        action=ACTION_NOTE_ADDED,
        application_id=application.id,
        actor_id=current_user.id,
        details={
            "camper_name": f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip(),
            "note_preview": note_data.note[:100] + "..." if len(note_data.note) > 100 else note_data.note
        },
        request=request
    )

    # Fire email events
    try:
        # Fire admin note added event
        await fire_email_event(
            db=db,
            event='admin_note_added',
            application_id=application.id,
            user_id=application.user_id
        )
        # If transitioned to under_review, fire that event too
        if application.sub_status == 'under_review':
            await fire_email_event(
                db=db,
                event='applicant_under_review',
                application_id=application.id,
                user_id=application.user_id
            )
    except Exception as e:
        print(f"Failed to fire email events: {e}")

    # Load admin info
    note = db.query(AdminNote).options(
        joinedload(AdminNote.admin)
    ).filter(AdminNote.id == note.id).first()

    return note


@router.get("/applications/{application_id}/notes", response_model=List[AdminNoteSchema])
async def get_notes(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get all notes for an application
    Admin-only endpoint
    """
    # Verify application exists
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    # Get notes with admin info, ordered by most recent first
    notes = db.query(AdminNote).options(
        joinedload(AdminNote.admin)
    ).filter(
        AdminNote.application_id == application_id
    ).order_by(AdminNote.created_at.desc()).all()

    return notes


@router.post("/applications/{application_id}/approve")
async def approve_application(
    application_id: str,
    approval_request: ApprovalRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Approve an application (admin marks their approval)
    - Creates/updates approval record for this admin with required note
    - Auto-transitions sub_status 'completed' → 'under_review' on first approval
    - 3 approvals (or 1 super admin) enables the Promote to Camper button
    Admin-only endpoint
    """
    try:
        if not approval_request.note or not approval_request.note.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A note is required when approving an application"
            )

        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        # Check if this admin already has an approval/decline record
        existing = db.query(ApplicationApproval).filter(
            ApplicationApproval.application_id == application_id,
            ApplicationApproval.admin_id == current_user.id
        ).first()

        # Build admin name for denormalized storage
        admin_full_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email

        if existing:
            # Update existing record
            existing.approved = True
            existing.note = approval_request.note.strip()
            existing.admin_name = admin_full_name
            existing.admin_team = current_user.team
            existing.created_at = datetime.now(timezone.utc)  # Update timestamp
        else:
            # Create new approval record
            approval = ApplicationApproval(
                application_id=application_id,
                admin_id=current_user.id,
                approved=True,
                note=approval_request.note.strip(),
                admin_name=admin_full_name,
                admin_team=current_user.team
            )
            db.add(approval)

        db.flush()  # Flush to get the record in the session

        # Count total approvals (approved=True)
        approval_count = db.query(ApplicationApproval).filter(
            ApplicationApproval.application_id == application_id,
            ApplicationApproval.approved == True
        ).count()

        # Auto-transition sub_status 'complete' → 'under_review' on first approval
        if application.status == 'applicant' and application.sub_status == 'complete' and approval_count == 1:
            application.sub_status = 'under_review'
            application.under_review_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(application)

        # Log audit event
        log_application_event(
            db=db,
            action=ACTION_TEAM_APPROVED,
            application_id=application.id,
            actor_id=current_user.id,
            details={
                "camper_name": f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip(),
                "team": current_user.team,
                "approval_count": approval_count
            },
            request=request
        )

        # Fire email events
        try:
            # Fire team approval event
            await fire_email_event(
                db=db,
                event='team_approval_added',
                application_id=application.id,
                user_id=application.user_id,
                extra_context={'team': current_user.team, 'approval_count': approval_count}
            )
            # If transitioned to under_review, fire that event
            if application.sub_status == 'under_review':
                await fire_email_event(
                    db=db,
                    event='applicant_under_review',
                    application_id=application.id,
                    user_id=application.user_id
                )
            # If all 3 teams approved, fire that event
            if approval_count >= 3:
                await fire_email_event(
                    db=db,
                    event='all_teams_approved',
                    application_id=application.id,
                    user_id=application.user_id
                )
        except Exception as e:
            print(f"Failed to fire email events: {e}")

        return {
            "message": "Application approved successfully",
            "application_id": str(application.id),
            "status": application.status,
            "sub_status": application.sub_status,
            "approval_count": approval_count,
            "promote_button_enabled": approval_count >= 3 or current_user.role == 'super_admin'
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error approving application: {str(e)}"
        )


@router.post("/applications/{application_id}/decline")
async def decline_application(
    application_id: str,
    approval_request: ApprovalRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Decline an application (admin marks their decline)
    - Creates/updates decline record for this admin with required note
    - Does NOT change application status (status stays 'under_review')
    - Decline is tracked per-admin like approvals
    Admin-only endpoint
    """
    try:
        if not approval_request.note or not approval_request.note.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A note is required when declining an application"
            )

        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        # Check if this admin already has an approval/decline record
        existing = db.query(ApplicationApproval).filter(
            ApplicationApproval.application_id == application_id,
            ApplicationApproval.admin_id == current_user.id
        ).first()

        # Build admin name for denormalized storage
        admin_full_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email

        if existing:
            # Update existing record to declined
            existing.approved = False
            existing.note = approval_request.note.strip()
            existing.admin_name = admin_full_name
            existing.admin_team = current_user.team
            existing.created_at = datetime.now(timezone.utc)
        else:
            # Create new decline record
            decline = ApplicationApproval(
                application_id=application_id,
                admin_id=current_user.id,
                approved=False,
                note=approval_request.note.strip(),
                admin_name=admin_full_name,
                admin_team=current_user.team
            )
            db.add(decline)

        # Auto-transition sub_status 'complete' → 'under_review' on first admin action (decline)
        if application.status == 'applicant' and application.sub_status == 'complete':
            application.sub_status = 'under_review'
            application.under_review_at = datetime.now(timezone.utc)

        db.commit()

        # Count approvals and declines
        approval_count = db.query(ApplicationApproval).filter(
            ApplicationApproval.application_id == application_id,
            ApplicationApproval.approved == True
        ).count()

        decline_count = db.query(ApplicationApproval).filter(
            ApplicationApproval.application_id == application_id,
            ApplicationApproval.approved == False
        ).count()

        # Log audit event
        log_application_event(
            db=db,
            action=ACTION_TEAM_DECLINED,
            application_id=application.id,
            actor_id=current_user.id,
            details={
                "camper_name": f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip(),
                "team": current_user.team,
                "decline_count": decline_count
            },
            request=request
        )

        return {
            "message": "Application declined",
            "application_id": str(application.id),
            "status": application.status,
            "approval_count": approval_count,
            "decline_count": decline_count
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error declining application: {str(e)}"
        )


@router.post("/applications/{application_id}/accept")
async def accept_application(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Legacy endpoint - redirects to promote-to-camper
    Kept for backwards compatibility
    """
    return await promote_to_camper(application_id, request, db, current_user)


@router.post("/applications/{application_id}/promote-to-tier2")
async def promote_to_tier2_legacy(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Legacy endpoint - redirects to promote-to-camper
    Kept for backwards compatibility
    """
    return await promote_to_camper(application_id, request, db, current_user)


@router.post("/applications/{application_id}/promote-to-camper")
async def promote_to_camper(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Promote an application from Applicant to Camper status
    - Requires 3 approvals from 3 different teams, OR 1 super admin can bypass
    - Sets status='camper', sub_status='incomplete', paid_invoice=False
    - Triggers Camper sections to appear
    - Recalculates completion percentage (may decrease due to new sections)
    - Generates Stripe invoice immediately (TODO: Stripe integration)
    Admin/Super Admin only endpoint
    """
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        # Verify application is an applicant in a valid sub_status for promotion
        if application.status != 'applicant':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Application must be 'applicant' status to promote. Current status: {application.status}"
            )

        valid_sub_statuses = ['under_review', 'waitlist']
        if application.sub_status not in valid_sub_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Application must have sub_status 'under_review' or 'waitlist' to promote. Current sub_status: {application.sub_status}"
            )

        # Count approvals and verify 3 approvals from different teams (unless super admin)
        approvals = db.query(ApplicationApproval).options(
            joinedload(ApplicationApproval.admin)
        ).filter(
            ApplicationApproval.application_id == application_id,
            ApplicationApproval.approved == True
        ).all()

        approval_count = len(approvals)
        teams = set(a.admin.team for a in approvals if a.admin and a.admin.team)

        # Super admin can bypass 3-approval requirement
        if current_user.role != 'super_admin':
            if approval_count < 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Application requires 3 approvals. Current approvals: {approval_count}"
                )

            # Verify approvals are from 3 different teams
            if len(teams) < 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Application requires approvals from 3 different teams. Current teams: {', '.join(teams)}"
                )

        # Promote to Camper status
        application.status = 'camper'
        application.sub_status = 'incomplete'
        application.paid_invoice = False  # Invoice generated, awaiting payment
        application.promoted_to_camper_at = datetime.now(timezone.utc)
        # Keep legacy field for reference
        application.accepted_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(application)

        # Recalculate progress - will now include Camper sections
        from app.api.applications import calculate_completion_percentage
        new_progress = calculate_completion_percentage(db, application_id)
        application.completion_percentage = new_progress
        db.commit()

        # Generate Stripe invoice automatically
        invoice_result = None
        try:
            from app.services import stripe_service
            user = db.query(User).filter(User.id == application.user_id).first()
            if user:
                invoice_result = stripe_service.create_invoice_for_application(
                    db=db,
                    application=application,
                    user=user,
                    created_by=current_user.id
                )
                if invoice_result['success']:
                    print(f"Invoice created for application {application_id}: {invoice_result['stripe_invoice_id']}")
                else:
                    print(f"Invoice creation failed for application {application_id}: {invoice_result.get('error')}")
        except Exception as e:
            print(f"Failed to create invoice for application {application_id}: {e}")
            invoice_result = {'success': False, 'error': str(e)}

        # Fire email event for promotion to camper
        try:
            # Get the payment URL from invoice result, fallback to dashboard
            payment_url = None
            if invoice_result and invoice_result.get('success'):
                payment_url = invoice_result.get('hosted_invoice_url')
            if not payment_url:
                from app.core.config import get_settings
                payment_url = f"{get_settings().FRONTEND_URL}/dashboard"

            await fire_email_event(
                db=db,
                event='promoted_to_camper',
                application_id=application.id,
                user_id=application.user_id,
                extra_context={
                    'approved_by_teams': list(teams),
                    'super_admin_override': current_user.role == 'super_admin' and approval_count < 3,
                    'paymentUrl': payment_url
                }
            )
        except Exception as e:
            print(f"Failed to fire promoted_to_camper event: {e}")

        # Log audit event
        log_application_event(
            db=db,
            action=ACTION_STATUS_PROMOTED,
            application_id=application.id,
            actor_id=current_user.id,
            details={
                "camper_name": f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip(),
                "new_status": "camper",
                "approved_by_teams": list(teams),
                "super_admin_override": current_user.role == 'super_admin' and approval_count < 3
            },
            request=request
        )

        return {
            "message": "Application promoted to Camper - new sections now available, invoice generated",
            "application_id": str(application.id),
            "status": application.status,
            "sub_status": application.sub_status,
            "paid_invoice": application.paid_invoice,
            "promoted_at": application.promoted_to_camper_at.isoformat(),
            "approved_by_teams": list(teams),
            "new_completion_percentage": new_progress,
            "super_admin_override": current_user.role == 'super_admin' and approval_count < 3,
            "invoice": invoice_result if invoice_result else None
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error promoting application: {str(e)}"
        )


@router.patch("/applications/{application_id}", response_model=ApplicationSchema)
async def update_application_admin(
    application_id: str,
    update_data: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Update application as admin (can edit any application)
    Admin-only endpoint
    """
    try:
        application = db.query(Application).filter(
            Application.id == application_id
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

        db.commit()
        db.refresh(application)

        return application
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating application: {str(e)}"
        )


# ============================================================================
# Status Transition Endpoints - Tiered Status System
# ============================================================================

@router.post("/applications/{application_id}/waitlist")
async def add_to_waitlist(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Move an application to the waitlist
    - Can only be called from 'under_review' sub_status
    - Sets sub_status='waitlist' and records timestamp
    Admin-only endpoint
    """
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        valid_sub_statuses = ['complete', 'under_review']
        if application.status != 'applicant' or application.sub_status not in valid_sub_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Application must be 'applicant' with sub_status 'complete' or 'under_review' to add to waitlist. Current: {application.status}/{application.sub_status}"
            )

        # Store the original sub_status so we can restore it when returning from waitlist
        pre_waitlist_sub_status = application.sub_status
        app_data = dict(application.application_data) if application.application_data else {}
        app_data['pre_waitlist_sub_status'] = pre_waitlist_sub_status
        application.application_data = app_data

        application.sub_status = 'waitlist'
        application.waitlisted_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(application)

        # Log audit event
        log_application_event(
            db=db,
            action=ACTION_STATUS_WAITLISTED,
            application_id=application.id,
            actor_id=current_user.id,
            details={
                "camper_name": f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip(),
            },
            request=request
        )

        # Fire email event for waitlisting
        try:
            await fire_email_event(
                db=db,
                event='applicant_waitlisted',
                application_id=application.id,
                user_id=application.user_id
            )
        except Exception as e:
            print(f"Failed to fire applicant_waitlisted event: {e}")

        return {
            "message": "Application added to waitlist",
            "application_id": str(application.id),
            "status": application.status,
            "sub_status": application.sub_status,
            "waitlisted_at": application.waitlisted_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding to waitlist: {str(e)}"
        )


@router.post("/applications/{application_id}/remove-from-waitlist")
async def remove_from_waitlist(
    application_id: str,
    action: str,  # 'promote' or 'return_review'
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Remove an application from the waitlist
    - action='promote' → Promote directly to Camper (requires 3 approvals or super admin)
    - action='return_review' → Return to under_review sub_status
    Admin-only endpoint
    """
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        if application.status != 'applicant' or application.sub_status != 'waitlist':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Application must be 'applicant/waitlist' to remove. Current: {application.status}/{application.sub_status}"
            )

        if action == 'promote':
            # Promote directly to Camper (uses existing promote logic)
            return await promote_to_camper(application_id, request, db, current_user)

        elif action == 'return_review':
            # Restore the original sub_status from before waitlisting
            app_data = application.application_data or {}
            original_sub_status = app_data.get('pre_waitlist_sub_status', 'complete')
            application.sub_status = original_sub_status
            application.waitlisted_at = None  # Clear waitlist timestamp

            # Clean up the stored pre_waitlist_sub_status
            if 'pre_waitlist_sub_status' in app_data:
                del app_data['pre_waitlist_sub_status']
                application.application_data = app_data

            db.commit()
            db.refresh(application)

            return {
                "message": f"Application returned to {original_sub_status.replace('_', ' ')}",
                "application_id": str(application.id),
                "status": application.status,
                "sub_status": application.sub_status
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action: {action}. Must be 'promote' or 'return_review'"
            )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing from waitlist: {str(e)}"
        )


@router.post("/applications/{application_id}/defer")
async def defer_application(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Defer an application to next year
    - Sets status='inactive', sub_status='deferred' and records timestamp
    - Can be done from most statuses
    Admin-only endpoint
    """
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        # Can't defer if already in inactive state or camper who has paid
        if application.status == 'inactive':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot defer application already in inactive status ({application.sub_status})"
            )
        if application.status == 'camper' and application.paid_invoice == True:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot defer a camper who has already paid"
            )

        old_status = application.status
        application.status = 'inactive'
        application.sub_status = 'deferred'
        application.deferred_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(application)

        # Log audit event
        log_application_event(
            db=db,
            action=ACTION_STATUS_DEFERRED,
            application_id=application.id,
            actor_id=current_user.id,
            details={
                "camper_name": f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip(),
                "previous_status": old_status
            },
            request=request
        )

        # Fire email event for deactivation
        try:
            await fire_email_event(
                db=db,
                event='application_deactivated',
                application_id=application.id,
                user_id=application.user_id,
                extra_context={'reason': 'deferred', 'previous_status': old_status}
            )
        except Exception as e:
            print(f"Failed to fire application_deactivated event: {e}")

        return {
            "message": "Application deferred to next year",
            "application_id": str(application.id),
            "status": application.status,
            "sub_status": application.sub_status,
            "deferred_at": application.deferred_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deferring application: {str(e)}"
        )


@router.post("/applications/{application_id}/withdraw")
async def withdraw_application(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Withdraw an application
    - Sets status='inactive', sub_status='withdrawn' and records timestamp
    - Can be done from most statuses
    Admin-only endpoint
    """
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        # Can't withdraw if already in inactive state or camper who has paid
        if application.status == 'inactive':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot withdraw application already in inactive status ({application.sub_status})"
            )
        if application.status == 'camper' and application.paid_invoice == True:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot withdraw a camper who has already paid"
            )

        old_status = application.status
        application.status = 'inactive'
        application.sub_status = 'withdrawn'
        application.withdrawn_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(application)

        # Log audit event
        log_application_event(
            db=db,
            action=ACTION_STATUS_WITHDRAWN,
            application_id=application.id,
            actor_id=current_user.id,
            details={
                "camper_name": f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip(),
                "previous_status": old_status
            },
            request=request
        )

        # Fire email event for deactivation
        try:
            await fire_email_event(
                db=db,
                event='application_deactivated',
                application_id=application.id,
                user_id=application.user_id,
                extra_context={'reason': 'withdrawn', 'previous_status': old_status}
            )
        except Exception as e:
            print(f"Failed to fire application_deactivated event: {e}")

        return {
            "message": "Application withdrawn",
            "application_id": str(application.id),
            "status": application.status,
            "sub_status": application.sub_status,
            "withdrawn_at": application.withdrawn_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error withdrawing application: {str(e)}"
        )


@router.post("/applications/{application_id}/reject")
async def reject_application(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Reject an application
    - Sets status='inactive', sub_status='rejected' and records timestamp
    - Can only be done from Applicant status (not Camper)
    Admin-only endpoint
    """
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        # Can only reject Applicant status applications
        if application.status == 'camper':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reject an application that has already been promoted to Camper status"
            )

        if application.status == 'inactive':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject application already in inactive status ({application.sub_status})"
            )

        application.status = 'inactive'
        application.sub_status = 'rejected'
        application.rejected_at = datetime.now(timezone.utc)
        # Keep legacy field for reference
        application.declined_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(application)

        # Log audit event
        log_application_event(
            db=db,
            action=ACTION_STATUS_REJECTED,
            application_id=application.id,
            actor_id=current_user.id,
            details={
                "camper_name": f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip(),
            },
            request=request
        )

        # Fire email event for deactivation/rejection
        try:
            await fire_email_event(
                db=db,
                event='application_deactivated',
                application_id=application.id,
                user_id=application.user_id,
                extra_context={'reason': 'rejected'}
            )
        except Exception as e:
            print(f"Failed to fire application_deactivated event: {e}")

        return {
            "message": "Application rejected",
            "application_id": str(application.id),
            "status": application.status,
            "sub_status": application.sub_status,
            "rejected_at": application.rejected_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error rejecting application: {str(e)}"
        )


@router.post("/applications/{application_id}/deactivate")
async def deactivate_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Deactivate an application
    - Sets status='inactive' and sub_status='inactive'
    - Generic action for withdrawing, deferring, or closing an application
    - Hidden from default views, doesn't count in statistics
    Admin-only endpoint
    """
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )

        # Can't deactivate if already inactive or camper who has paid
        if application.status == 'inactive':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Application is already deactivated"
            )
        if application.status == 'camper' and application.paid_invoice == True:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate a camper who has already paid"
            )

        old_status = application.status
        application.status = 'inactive'
        application.sub_status = 'inactive'
        application.deactivated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(application)

        # Fire email event for deactivation
        try:
            await fire_email_event(
                db=db,
                event='application_deactivated',
                application_id=application.id,
                user_id=application.user_id,
                extra_context={'reason': 'deactivated', 'previous_status': old_status}
            )
        except Exception as e:
            print(f"Failed to fire application_deactivated event: {e}")

        return {
            "message": "Application deactivated",
            "application_id": str(application.id),
            "status": application.status,
            "sub_status": application.sub_status,
            "deactivated_at": application.deactivated_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deactivating application: {str(e)}"
        )
