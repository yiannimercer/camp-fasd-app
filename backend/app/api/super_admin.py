"""
Super Admin API endpoints
Only accessible by users with role = 'super_admin'
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, text
from app.core.database import get_db
from app.core.deps import get_current_super_admin_user
from app.models.user import User
from app.models.application import Application, ApplicationResponse, ApplicationQuestion, AdminNote, File, Invoice, ApplicationApproval
from app.models.super_admin import SystemConfiguration, AuditLog, EmailTemplate, EmailAutomation, Team
from app.services import stripe_service, storage_service
from app.schemas.super_admin import (
    SystemConfiguration as SystemConfigurationSchema,
    SystemConfigurationCreate,
    SystemConfigurationUpdate,
    AuditLog as AuditLogSchema,
    AuditLogWithActor,
    EmailTemplate as EmailTemplateSchema,
    EmailTemplateCreate,
    EmailTemplateUpdate,
    EmailAutomation as EmailAutomationSchema,
    EmailAutomationCreate,
    EmailAutomationUpdate,
    EmailAutomationWithTemplate,
    Team as TeamSchema,
    TeamCreate,
    TeamUpdate,
    TeamWithAdminCount,
    UserUpdate,
    UserStatusUpdate,
    UserRoleUpdate,
    DashboardStats,
    TeamPerformance,
    BulkUserAction,
    BulkActionResult,
    AnnualResetRequest,
    AnnualResetResult,
    AnnualResetApplicationResult,
    CreateUserRequest,
    DirectEmailRequest,
    UserActionResult,
    UserDeletionResult
)
from app.schemas.user import UserResponse

router = APIRouter()


# ============================================================================
# DASHBOARD & STATISTICS
# ============================================================================

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Get comprehensive dashboard statistics for super admin.

    Uses the correct status/sub_status model:
    - status: 'applicant', 'camper', 'inactive'
    - sub_status: 'not_started', 'incomplete', 'complete', 'under_review', 'waitlisted', 'withdrawn', 'deferred', 'inactive'
    - paid_invoice: NULL (no invoice), False (unpaid), True (paid)
    """

    # User counts
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_families = db.query(func.count(User.id)).filter(User.role == 'user').scalar() or 0
    total_admins = db.query(func.count(User.id)).filter(User.role == 'admin').scalar() or 0
    total_super_admins = db.query(func.count(User.id)).filter(User.role == 'super_admin').scalar() or 0

    # New users this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_users_this_week = db.query(func.count(User.id)).filter(User.created_at >= week_ago).scalar() or 0

    # Application counts
    total_applications = db.query(func.count(Application.id)).scalar() or 0

    # Get current season year from config (default to current year)
    current_year = datetime.now().year
    config = db.query(SystemConfiguration).filter(SystemConfiguration.key == 'camp_year').first()
    if config:
        current_year = int(config.value)

    # Applications this season (created this year)
    season_start = datetime(current_year, 1, 1, tzinfo=timezone.utc)
    applications_this_season = db.query(func.count(Application.id)).filter(
        Application.created_at >= season_start
    ).scalar() or 0

    # ========================================================================
    # APPLICANT STAGES (status='applicant')
    # ========================================================================
    applicant_not_started = db.query(func.count(Application.id)).filter(
        Application.status == 'applicant',
        Application.sub_status == 'not_started'
    ).scalar() or 0

    applicant_incomplete = db.query(func.count(Application.id)).filter(
        Application.status == 'applicant',
        Application.sub_status == 'incomplete'
    ).scalar() or 0

    applicant_complete = db.query(func.count(Application.id)).filter(
        Application.status == 'applicant',
        Application.sub_status == 'complete'
    ).scalar() or 0

    applicant_under_review = db.query(func.count(Application.id)).filter(
        Application.status == 'applicant',
        Application.sub_status == 'under_review'
    ).scalar() or 0

    applicant_waitlisted = db.query(func.count(Application.id)).filter(
        Application.status == 'applicant',
        Application.sub_status == 'waitlisted'
    ).scalar() or 0

    # ========================================================================
    # CAMPER STAGES (status='camper')
    # ========================================================================
    camper_total = db.query(func.count(Application.id)).filter(
        Application.status == 'camper'
    ).scalar() or 0

    camper_incomplete = db.query(func.count(Application.id)).filter(
        Application.status == 'camper',
        Application.sub_status == 'incomplete'
    ).scalar() or 0

    camper_complete = db.query(func.count(Application.id)).filter(
        Application.status == 'camper',
        Application.sub_status == 'complete'
    ).scalar() or 0

    camper_unpaid = db.query(func.count(Application.id)).filter(
        Application.status == 'camper',
        Application.paid_invoice == False
    ).scalar() or 0

    camper_paid = db.query(func.count(Application.id)).filter(
        Application.status == 'camper',
        Application.paid_invoice == True
    ).scalar() or 0

    # ========================================================================
    # INACTIVE STAGES (status='inactive')
    # ========================================================================
    inactive_withdrawn = db.query(func.count(Application.id)).filter(
        Application.status == 'inactive',
        Application.sub_status == 'withdrawn'
    ).scalar() or 0

    inactive_deferred = db.query(func.count(Application.id)).filter(
        Application.status == 'inactive',
        Application.sub_status == 'deferred'
    ).scalar() or 0

    inactive_deactivated = db.query(func.count(Application.id)).filter(
        Application.status == 'inactive',
        Application.sub_status == 'inactive'
    ).scalar() or 0

    # ========================================================================
    # REVENUE & PERFORMANCE
    # ========================================================================
    # Get tuition amount from system config
    tuition_config = db.query(SystemConfiguration).filter(SystemConfiguration.key == 'tuition_amount').first()
    tuition_amount = float(tuition_config.value) if tuition_config else 0.0

    # Calculate revenue based on paid campers
    total_revenue = camper_paid * tuition_amount
    season_revenue = total_revenue  # TODO: Filter by season if needed

    # Average completion time (from created to completed_at or under_review_at)
    avg_completion_result = db.query(
        func.avg(func.extract('epoch', Application.completed_at - Application.created_at) / 86400)
    ).filter(
        Application.completed_at.isnot(None)
    ).scalar()
    avg_completion_days = float(avg_completion_result) if avg_completion_result else None

    # Average review time (from under_review_at to promoted_to_camper_at)
    avg_review_result = db.query(
        func.avg(func.extract('epoch', Application.promoted_to_camper_at - Application.under_review_at) / 86400)
    ).filter(
        Application.promoted_to_camper_at.isnot(None),
        Application.under_review_at.isnot(None)
    ).scalar()
    avg_review_days = float(avg_review_result) if avg_review_result else None

    return DashboardStats(
        total_users=total_users,
        total_families=total_families,
        total_admins=total_admins,
        total_super_admins=total_super_admins,
        new_users_this_week=new_users_this_week,
        total_applications=total_applications,
        applications_this_season=applications_this_season,
        # Applicant stages
        applicant_not_started=applicant_not_started,
        applicant_incomplete=applicant_incomplete,
        applicant_complete=applicant_complete,
        applicant_under_review=applicant_under_review,
        applicant_waitlisted=applicant_waitlisted,
        # Camper stages
        camper_total=camper_total,
        camper_incomplete=camper_incomplete,
        camper_complete=camper_complete,
        camper_unpaid=camper_unpaid,
        camper_paid=camper_paid,
        # Inactive stages
        inactive_withdrawn=inactive_withdrawn,
        inactive_deferred=inactive_deferred,
        inactive_deactivated=inactive_deactivated,
        # Revenue
        total_revenue=total_revenue,
        season_revenue=season_revenue,
        # Performance
        avg_completion_days=avg_completion_days,
        avg_review_days=avg_review_days
    )


@router.get("/dashboard/team-performance", response_model=List[TeamPerformance])
async def get_team_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get performance metrics for each team"""

    teams = db.query(Team).filter(Team.is_active == True).all()
    performance = []

    for team in teams:
        # Count admins and super_admins in this team
        admin_count = db.query(func.count(User.id)).filter(
            User.role.in_(['admin', 'super_admin']),
            User.team == team.key
        ).scalar() or 0

        # Count applications reviewed by this team (placeholder - needs approval tracking)
        applications_reviewed = 0

        performance.append(TeamPerformance(
            team_key=team.key,
            team_name=team.name,
            admin_count=admin_count,
            applications_reviewed=applications_reviewed,
            avg_review_time_days=None,
            approval_rate=None
        ))

    return performance


# ============================================================================
# USER MANAGEMENT
# ============================================================================

@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    role: Optional[str] = Query(None, description="Filter by role: user, admin, super_admin"),
    status: Optional[str] = Query(None, description="Filter by status: active, inactive, suspended"),
    team: Optional[str] = Query(None, description="Filter by team (for admins)"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get all users with filtering and pagination"""

    query = db.query(User)

    # Apply filters
    if role:
        query = query.filter(User.role == role)

    if status:
        query = query.filter(User.status == status)

    if team:
        query = query.filter(User.team == team)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.first_name.ilike(search_pattern),
                User.last_name.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )

    # Get total count
    total = query.count()

    # Apply pagination
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    return [UserResponse.model_validate(user) for user in users]


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Update user information"""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent modifying own role
    if str(user.id) == str(current_user.id) and user_data.role and user_data.role != user.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own role"
        )

    # Update fields
    if user_data.first_name is not None:
        user.first_name = user_data.first_name
    if user_data.last_name is not None:
        user.last_name = user_data.last_name
    if user_data.email is not None:
        # Check if email is already taken
        existing = db.query(User).filter(User.email == user_data.email, User.id != user_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        user.email = user_data.email
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.team is not None:
        user.team = user_data.team
    if user_data.status is not None:
        user.status = user_data.status
        if user_data.status == 'suspended':
            user.suspended_at = datetime.now(timezone.utc)
            user.suspended_by = current_user.id
    if user_data.receive_emails is not None:
        user.receive_emails = user_data.receive_emails

    db.commit()
    db.refresh(user)

    # Create audit log
    audit_log = AuditLog(
        entity_type='user',
        entity_id=user.id,
        action='updated',
        actor_id=current_user.id,
        details={'updated_fields': user_data.model_dump(exclude_unset=True)}
    )
    db.add(audit_log)
    db.commit()

    return UserResponse.model_validate(user)


@router.post("/users/{user_id}/change-role", response_model=UserResponse)
async def change_user_role(
    user_id: str,
    role_data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Change user role with team assignment"""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent modifying own role
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own role"
        )

    # Validate role
    if role_data.role not in ['user', 'admin', 'super_admin']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )

    # If promoting to admin, team is required
    if role_data.role == 'admin' and not role_data.team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team assignment required for admin role"
        )

    old_role = user.role
    user.role = role_data.role

    if role_data.role == 'admin':
        user.team = role_data.team
    else:
        user.team = None

    db.commit()
    db.refresh(user)

    # Create audit log
    audit_log = AuditLog(
        entity_type='user',
        entity_id=user.id,
        action='role_changed',
        actor_id=current_user.id,
        details={'old_role': old_role, 'new_role': role_data.role, 'team': role_data.team}
    )
    db.add(audit_log)
    db.commit()

    return UserResponse.model_validate(user)


@router.post("/users/{user_id}/suspend", response_model=UserResponse)
async def suspend_user(
    user_id: str,
    status_data: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Suspend or activate a user.

    This endpoint:
    1. Updates the user's status in our database
    2. Bans/unbans the user in Supabase Auth (if they have a supabase_auth_id)

    When suspended, users cannot log in to the application.
    """
    from app.services import supabase_admin_service

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent modifying own status
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own status"
        )

    old_status = user.status

    # Update Supabase Auth ban status if user has supabase_auth_id
    supabase_result = None
    if user.supabase_auth_id:
        if status_data.status == 'suspended':
            supabase_result = supabase_admin_service.ban_user(str(user.supabase_auth_id))
        elif status_data.status == 'active':
            supabase_result = supabase_admin_service.unban_user(str(user.supabase_auth_id))

        # Log any Supabase errors but don't fail the request
        if supabase_result and not supabase_result['success']:
            print(f"Supabase ban/unban warning: {supabase_result['error']}")

    # Update our database
    user.status = status_data.status

    if status_data.status == 'suspended':
        user.suspended_at = datetime.now(timezone.utc)
        user.suspended_by = current_user.id
        user.suspension_reason = status_data.reason
    else:
        user.suspended_at = None
        user.suspended_by = None
        user.suspension_reason = None

    db.commit()
    db.refresh(user)

    # Create audit log
    audit_log = AuditLog(
        entity_type='user',
        entity_id=user.id,
        action='status_changed',
        actor_id=current_user.id,
        details={
            'old_status': old_status,
            'new_status': status_data.status,
            'reason': status_data.reason,
            'supabase_auth_updated': supabase_result['success'] if supabase_result else False
        }
    )
    db.add(audit_log)
    db.commit()

    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", response_model=UserDeletionResult)
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Permanently delete a user and all associated data.

    This is a DESTRUCTIVE operation that:
    1. Deletes the user from Supabase Auth (if applicable)
    2. Deletes all user's applications and related data (cascade)
    3. Deletes the user record from our database

    This action CANNOT be undone.
    """
    from app.services import supabase_admin_service

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent deleting yourself
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    # Store user info for audit log
    user_email = user.email
    user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user_email

    # Perform cascade delete
    result = supabase_admin_service.cascade_delete_user(
        db=db,
        user_id=str(user.id),
        supabase_auth_id=str(user.supabase_auth_id) if user.supabase_auth_id else None
    )

    if result['success']:
        # Create audit log
        audit_log = AuditLog(
            entity_type='user',
            entity_id=None,  # User no longer exists
            action='deleted',
            actor_id=current_user.id,
            details={
                'deleted_user_id': user_id,
                'deleted_user_email': user_email,
                'deleted_user_name': user_name,
                'summary': result['summary']
            }
        )
        db.add(audit_log)
        db.commit()

        return UserDeletionResult(
            success=True,
            message=f"User {user_name} ({user_email}) has been permanently deleted",
            summary=result['summary']
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {result['error']}"
        )


@router.post("/users/{user_id}/reset-password", response_model=UserActionResult)
async def reset_user_password(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Send a password reset email to a user.

    Uses Supabase Auth's built-in password reset flow.
    The user will receive an email with a link to set a new password.
    """
    from app.services import supabase_admin_service

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Send password reset email via Supabase
    result = supabase_admin_service.send_password_reset(user.email)

    if result['success']:
        # Create audit log
        audit_log = AuditLog(
            entity_type='user',
            entity_id=user.id,
            action='password_reset_sent',
            actor_id=current_user.id,
            details={'email': user.email}
        )
        db.add(audit_log)
        db.commit()

        return UserActionResult(
            success=True,
            message=f"Password reset email sent to {user.email}",
            user_id=user.id
        )
    else:
        return UserActionResult(
            success=False,
            message="Failed to send password reset email",
            user_id=user.id,
            error=result['error']
        )


@router.post("/users/create", response_model=UserActionResult, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Create a new user and send them an invitation email.

    This endpoint:
    1. Creates the user in Supabase Auth with an invitation
    2. Creates the user record in our database
    3. Sends an invitation email (user sets their own password)

    The user will receive an email with a link to complete their registration.
    """
    from app.services import supabase_admin_service

    # Check if email already exists in our database
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )

    # Validate admin role requires team
    if user_data.role == 'admin' and not user_data.team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team assignment is required for admin role"
        )

    # Validate role
    if user_data.role not in ['user', 'admin', 'super_admin']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'user', 'admin', or 'super_admin'"
        )

    # Create user in Supabase Auth with invitation
    supabase_result = supabase_admin_service.create_user_with_invitation(
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        team=user_data.team,
        phone=user_data.phone
    )

    if not supabase_result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=supabase_result['error'] or 'Failed to create user in Supabase Auth'
        )

    # Get the Supabase auth user ID
    supabase_auth_id = supabase_result['user'].id if supabase_result['user'] else None

    # Create user record in our database
    new_user = User(
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        role=user_data.role,
        team=user_data.team if user_data.role == 'admin' else None,
        supabase_auth_id=supabase_auth_id,
        status='active',
        email_verified=False  # Will be verified when they complete invitation
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create audit log
    audit_log = AuditLog(
        entity_type='user',
        entity_id=new_user.id,
        action='created_by_admin',
        actor_id=current_user.id,
        details={
            'email': new_user.email,
            'role': new_user.role,
            'team': new_user.team,
            'invitation_sent': user_data.send_invitation
        }
    )
    db.add(audit_log)
    db.commit()

    return UserActionResult(
        success=True,
        message=f"User created successfully. Invitation email sent to {user_data.email}",
        user_id=new_user.id,
        details={
            'email': new_user.email,
            'role': new_user.role,
            'invitation_sent': user_data.send_invitation
        }
    )


@router.post("/users/{user_id}/resend-invitation", response_model=UserActionResult)
async def resend_invitation(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Resend an invitation email to a user who hasn't completed their registration.

    This is useful when:
    - The original invitation expired
    - The user never received the original email
    - The user accidentally deleted the invitation
    """
    from app.services import supabase_admin_service

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Resend invitation via Supabase
    result = supabase_admin_service.resend_invitation(user.email)

    if result['success']:
        # Create audit log
        audit_log = AuditLog(
            entity_type='user',
            entity_id=user.id,
            action='invitation_resent',
            actor_id=current_user.id,
            details={'email': user.email}
        )
        db.add(audit_log)
        db.commit()

        return UserActionResult(
            success=True,
            message=f"Invitation email resent to {user.email}",
            user_id=user.id
        )
    else:
        return UserActionResult(
            success=False,
            message="Failed to resend invitation",
            user_id=user.id,
            error=result['error']
        )


@router.post("/users/{user_id}/send-email", response_model=UserActionResult)
async def send_direct_email(
    user_id: str,
    email_data: DirectEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Send a direct email to a specific user.

    The email will be wrapped in CAMP's branded email template
    with proper headers, footers, and styling.
    """
    from app.services.email_service import (
        send_email as send_email_service,
        get_branded_email_wrapper,
        wrap_content_in_brand
    )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Build email content
    user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email

    if email_data.include_greeting:
        greeting = f"Dear {user.first_name or 'Friend'},"
    else:
        greeting = ""

    # Wrap the message in branded content block
    content_html = wrap_content_in_brand(
        db=db,
        content=email_data.message,
        greeting=greeting,
        closing="Best regards,"
    )

    # Wrap in full branded email template
    html_content = get_branded_email_wrapper(
        db=db,
        content=content_html,
        subject=email_data.subject
    )

    # Send the email
    result = send_email_service(
        db=db,
        to_email=user.email,
        subject=email_data.subject,
        html_content=html_content,
        to_name=user_name,
        user_id=user.id,
        email_type='direct_admin_email',
        reply_to=current_user.email  # Allow user to reply to the admin who sent it
    )

    if result['success']:
        # Create audit log
        audit_log = AuditLog(
            entity_type='user',
            entity_id=user.id,
            action='direct_email_sent',
            actor_id=current_user.id,
            details={
                'recipient_email': user.email,
                'subject': email_data.subject,
                'resend_id': result.get('resend_id')
            }
        )
        db.add(audit_log)
        db.commit()

        return UserActionResult(
            success=True,
            message=f"Email sent successfully to {user.email}",
            user_id=user.id,
            details={'resend_id': result.get('resend_id')}
        )
    else:
        return UserActionResult(
            success=False,
            message="Failed to send email",
            user_id=user.id,
            error=result.get('error')
        )


# ============================================================================
# SYSTEM CONFIGURATION
# ============================================================================

@router.get("/config", response_model=List[SystemConfigurationSchema])
async def get_all_configurations(
    category: Optional[str] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get all system configurations"""

    query = db.query(SystemConfiguration)

    if category:
        query = query.filter(SystemConfiguration.category == category)

    configs = query.order_by(SystemConfiguration.category, SystemConfiguration.key).all()
    return [SystemConfigurationSchema.model_validate(config) for config in configs]


@router.get("/config/{key}", response_model=SystemConfigurationSchema)
async def get_configuration(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get single configuration by key"""

    config = db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )

    return SystemConfigurationSchema.model_validate(config)


@router.patch("/config/{key}", response_model=SystemConfigurationSchema)
async def update_configuration(
    key: str,
    config_data: SystemConfigurationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Update or create system configuration (upsert)"""

    config = db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
    is_new = config is None
    old_value = None

    if is_new:
        # Create new configuration
        config = SystemConfiguration(
            key=key,
            value=config_data.value if config_data.value is not None else '',
            description=config_data.description or '',
            data_type='string',  # Default to string type
            category=config_data.category or 'general',
            is_public=config_data.is_public if config_data.is_public is not None else False,
            updated_by=current_user.id
        )
        db.add(config)
    else:
        old_value = config.value

        # Update fields
        if config_data.value is not None:
            config.value = config_data.value
        if config_data.description is not None:
            config.description = config_data.description
        if config_data.category is not None:
            config.category = config_data.category
        if config_data.is_public is not None:
            config.is_public = config_data.is_public

        config.updated_at = datetime.now(timezone.utc)
        config.updated_by = current_user.id

    db.commit()
    db.refresh(config)

    # Create audit log
    audit_log = AuditLog(
        entity_type='configuration',
        entity_id=config.id,
        action='created' if is_new else 'updated',
        actor_id=current_user.id,
        details={'key': key, 'old_value': old_value, 'new_value': config.value}
    )
    db.add(audit_log)
    db.commit()

    return SystemConfigurationSchema.model_validate(config)


# ============================================================================
# EMAIL TEMPLATES
# ============================================================================

@router.get("/email-templates", response_model=List[EmailTemplateSchema])
async def get_all_email_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get all email templates"""

    templates = db.query(EmailTemplate).order_by(EmailTemplate.key).all()
    return [EmailTemplateSchema.model_validate(template) for template in templates]


@router.post("/email-templates", response_model=EmailTemplateSchema, status_code=status.HTTP_201_CREATED)
async def create_email_template(
    template_data: EmailTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Create a new email template"""

    # Check if key already exists
    existing = db.query(EmailTemplate).filter(EmailTemplate.key == template_data.key).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template key already exists"
        )

    template = EmailTemplate(
        key=template_data.key,
        name=template_data.name,
        subject=template_data.subject,
        html_content=template_data.html_content,
        text_content=template_data.text_content,
        markdown_content=template_data.markdown_content,
        use_markdown=template_data.use_markdown,
        trigger_event=template_data.trigger_event,
        variables=template_data.variables,
        is_active=template_data.is_active,
        updated_by=current_user.id
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    # Create audit log
    audit_log = AuditLog(
        entity_type='email_template',
        entity_id=template.id,
        action='created',
        actor_id=current_user.id,
        details={'key': template.key, 'name': template.name}
    )
    db.add(audit_log)
    db.commit()

    return EmailTemplateSchema.model_validate(template)


@router.get("/email-templates/{key}", response_model=EmailTemplateSchema)
async def get_email_template(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get single email template by key"""

    template = db.query(EmailTemplate).filter(EmailTemplate.key == key).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email template not found"
        )

    return EmailTemplateSchema.model_validate(template)


@router.patch("/email-templates/{key}", response_model=EmailTemplateSchema)
async def update_email_template(
    key: str,
    template_data: EmailTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Update email template"""

    template = db.query(EmailTemplate).filter(EmailTemplate.key == key).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email template not found"
        )

    # Update fields
    if template_data.name is not None:
        template.name = template_data.name
    if template_data.subject is not None:
        template.subject = template_data.subject
    if template_data.html_content is not None:
        template.html_content = template_data.html_content
    if template_data.text_content is not None:
        template.text_content = template_data.text_content
    if template_data.markdown_content is not None:
        template.markdown_content = template_data.markdown_content
    if template_data.use_markdown is not None:
        template.use_markdown = template_data.use_markdown
    if template_data.trigger_event is not None:
        template.trigger_event = template_data.trigger_event
    if template_data.variables is not None:
        template.variables = template_data.variables
    if template_data.is_active is not None:
        template.is_active = template_data.is_active

    template.updated_at = datetime.now(timezone.utc)
    template.updated_by = current_user.id

    db.commit()
    db.refresh(template)

    # Create audit log
    audit_log = AuditLog(
        entity_type='email_template',
        entity_id=template.id,
        action='updated',
        actor_id=current_user.id,
        details={'key': key}
    )
    db.add(audit_log)
    db.commit()

    return EmailTemplateSchema.model_validate(template)


# ============================================================================
# EMAIL AUTOMATIONS
# ============================================================================

@router.get("/email-automations", response_model=List[EmailAutomationWithTemplate])
async def get_all_email_automations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get all email automations with template details"""

    automations = db.query(EmailAutomation).order_by(EmailAutomation.name).all()
    result = []

    for automation in automations:
        # Get template details
        template = db.query(EmailTemplate).filter(EmailTemplate.key == automation.template_key).first()

        automation_dict = EmailAutomationWithTemplate.model_validate(automation).model_dump()
        if template:
            automation_dict['template_name'] = template.name
            automation_dict['template_subject'] = template.subject
        result.append(EmailAutomationWithTemplate(**automation_dict))

    return result


@router.get("/email-automations/{automation_id}", response_model=EmailAutomationWithTemplate)
async def get_email_automation(
    automation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get single email automation by ID"""

    automation = db.query(EmailAutomation).filter(EmailAutomation.id == automation_id).first()
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email automation not found"
        )

    # Get template details
    template = db.query(EmailTemplate).filter(EmailTemplate.key == automation.template_key).first()

    automation_dict = EmailAutomationWithTemplate.model_validate(automation).model_dump()
    if template:
        automation_dict['template_name'] = template.name
        automation_dict['template_subject'] = template.subject

    return EmailAutomationWithTemplate(**automation_dict)


@router.post("/email-automations", response_model=EmailAutomationSchema, status_code=status.HTTP_201_CREATED)
async def create_email_automation(
    automation_data: EmailAutomationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Create a new email automation"""

    # Verify template exists
    template = db.query(EmailTemplate).filter(EmailTemplate.key == automation_data.template_key).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template '{automation_data.template_key}' not found"
        )

    # Validate trigger_type
    if automation_data.trigger_type not in ['event', 'scheduled']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="trigger_type must be 'event' or 'scheduled'"
        )

    # Validate scheduled automations have schedule_day and schedule_hour
    if automation_data.trigger_type == 'scheduled':
        if automation_data.schedule_day is None or automation_data.schedule_hour is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Scheduled automations require schedule_day and schedule_hour"
            )

    automation = EmailAutomation(
        name=automation_data.name,
        description=automation_data.description,
        template_key=automation_data.template_key,
        trigger_type=automation_data.trigger_type,
        trigger_event=automation_data.trigger_event,
        schedule_day=automation_data.schedule_day,
        schedule_hour=automation_data.schedule_hour,
        audience_filter=automation_data.audience_filter or {},
        is_active=automation_data.is_active,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(automation)
    db.commit()
    db.refresh(automation)

    # Create audit log
    audit_log = AuditLog(
        entity_type='email_automation',
        entity_id=automation.id,
        action='created',
        actor_id=current_user.id,
        details={'name': automation.name, 'template_key': automation.template_key}
    )
    db.add(audit_log)
    db.commit()

    return EmailAutomationSchema.model_validate(automation)


@router.patch("/email-automations/{automation_id}", response_model=EmailAutomationSchema)
async def update_email_automation(
    automation_id: str,
    automation_data: EmailAutomationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Update email automation"""

    automation = db.query(EmailAutomation).filter(EmailAutomation.id == automation_id).first()
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email automation not found"
        )

    # If changing template_key, verify new template exists
    if automation_data.template_key is not None:
        template = db.query(EmailTemplate).filter(EmailTemplate.key == automation_data.template_key).first()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Template '{automation_data.template_key}' not found"
            )

    # Update fields
    if automation_data.name is not None:
        automation.name = automation_data.name
    if automation_data.description is not None:
        automation.description = automation_data.description
    if automation_data.template_key is not None:
        automation.template_key = automation_data.template_key
    if automation_data.trigger_type is not None:
        automation.trigger_type = automation_data.trigger_type
    if automation_data.trigger_event is not None:
        automation.trigger_event = automation_data.trigger_event
    if automation_data.schedule_day is not None:
        automation.schedule_day = automation_data.schedule_day
    if automation_data.schedule_hour is not None:
        automation.schedule_hour = automation_data.schedule_hour
    if automation_data.audience_filter is not None:
        automation.audience_filter = automation_data.audience_filter
    if automation_data.is_active is not None:
        automation.is_active = automation_data.is_active

    automation.updated_at = datetime.now(timezone.utc)
    automation.updated_by = current_user.id

    db.commit()
    db.refresh(automation)

    # Create audit log
    audit_log = AuditLog(
        entity_type='email_automation',
        entity_id=automation.id,
        action='updated',
        actor_id=current_user.id,
        details={'name': automation.name}
    )
    db.add(audit_log)
    db.commit()

    return EmailAutomationSchema.model_validate(automation)


@router.delete("/email-automations/{automation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_automation(
    automation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Delete an email automation"""

    automation = db.query(EmailAutomation).filter(EmailAutomation.id == automation_id).first()
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email automation not found"
        )

    automation_name = automation.name

    db.delete(automation)
    db.commit()

    # Create audit log
    audit_log = AuditLog(
        entity_type='email_automation',
        entity_id=None,
        action='deleted',
        actor_id=current_user.id,
        details={'name': automation_name, 'id': automation_id}
    )
    db.add(audit_log)
    db.commit()

    return None


# ============================================================================
# TEAMS
# ============================================================================

@router.get("/teams", response_model=List[TeamWithAdminCount])
async def get_all_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get all teams with member counts (admins + super_admins)"""

    teams = db.query(Team).order_by(Team.order_index).all()
    result = []

    for team in teams:
        # Count both admins and super_admins in this team
        admin_count = db.query(func.count(User.id)).filter(
            User.role.in_(['admin', 'super_admin']),
            User.team == team.key
        ).scalar() or 0

        team_dict = TeamWithAdminCount.model_validate(team).model_dump()
        team_dict['admin_count'] = admin_count
        result.append(TeamWithAdminCount(**team_dict))

    return result


@router.post("/teams", response_model=TeamSchema, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Create new team"""

    # Check if key already exists
    existing = db.query(Team).filter(Team.key == team_data.key).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team key already exists"
        )

    team = Team(**team_data.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)

    # Create audit log
    audit_log = AuditLog(
        entity_type='team',
        entity_id=team.id,
        action='created',
        actor_id=current_user.id,
        details={'key': team.key, 'name': team.name}
    )
    db.add(audit_log)
    db.commit()

    return TeamSchema.model_validate(team)


@router.patch("/teams/{team_id}", response_model=TeamSchema)
async def update_team(
    team_id: str,
    team_data: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Update team"""

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )

    # Update fields
    if team_data.name is not None:
        team.name = team_data.name
    if team_data.description is not None:
        team.description = team_data.description
    if team_data.color is not None:
        team.color = team_data.color
    if team_data.is_active is not None:
        team.is_active = team_data.is_active
    if team_data.order_index is not None:
        team.order_index = team_data.order_index

    team.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(team)

    # Create audit log
    audit_log = AuditLog(
        entity_type='team',
        entity_id=team.id,
        action='updated',
        actor_id=current_user.id,
        details={'key': team.key}
    )
    db.add(audit_log)
    db.commit()

    return TeamSchema.model_validate(team)


# ============================================================================
# AUDIT LOGS
# ============================================================================

@router.get("/audit-logs", response_model=List[AuditLogWithActor])
async def get_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    actor_id: Optional[str] = Query(None, description="Filter by actor ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get audit logs with filtering"""

    query = db.query(AuditLog)

    # Apply filters
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)

    # Get logs with pagination
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    # Enrich with actor information
    result = []
    for log in logs:
        log_dict = AuditLogWithActor.model_validate(log).model_dump()
        if log.actor:
            log_dict['actor_name'] = f"{log.actor.first_name} {log.actor.last_name}"
            log_dict['actor_email'] = log.actor.email
        result.append(AuditLogWithActor(**log_dict))

    return result


# ============================================================================
# ANNUAL RESET
# ============================================================================

@router.post("/annual-reset", response_model=AnnualResetResult)
async def perform_annual_reset(
    reset_request: AnnualResetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Perform annual reset of applications for the new camp season.

    This endpoint:
    1. Resets all active applications to status='applicant', sub_status='not_started'
    2. Preserves responses for questions marked with persist_annually=True
    3. Deletes all other responses and admin notes
    4. Resets approval tracking, timestamps, and payment tracking
    5. Logs the action for audit purposes

    By default, paid campers ARE reset (since they're returning campers).
    Use exclude_paid=True to skip campers who have paid.
    Use dry_run=True to preview changes without applying them.
    """

    # Determine archive year
    archive_year = reset_request.archive_year or datetime.now().year

    # Get all applications
    all_applications = db.query(Application).all()

    # Track skipped applications by status/sub_status
    skipped_by_status = {}
    applications_to_reset = []

    for app in all_applications:
        # Skip inactive applications (deferred, withdrawn, rejected)
        if app.status == 'inactive':
            key = f"inactive/{app.sub_status}"
            skipped_by_status[key] = skipped_by_status.get(key, 0) + 1
            continue

        # Skip paid campers if exclude_paid is True
        if reset_request.exclude_paid and app.status == 'camper' and app.paid_invoice is True:
            skipped_by_status['camper/paid'] = skipped_by_status.get('camper/paid', 0) + 1
            continue

        applications_to_reset.append(app)

    # Get all question IDs that should persist annually
    persistent_question_ids = set(
        str(q.id) for q in db.query(ApplicationQuestion).filter(
            ApplicationQuestion.persist_annually == True
        ).all()
    )

    # Process each application
    application_results = []
    total_responses_deleted = 0
    total_responses_preserved = 0
    total_notes_deleted = 0

    for app in applications_to_reset:
        camper_name = f"{app.camper_first_name or ''} {app.camper_last_name or ''}".strip() or "Unknown"
        previous_status = app.status

        # Get all responses for this application
        responses = db.query(ApplicationResponse).filter(
            ApplicationResponse.application_id == app.id
        ).all()

        responses_to_delete = []
        responses_to_keep = []

        for response in responses:
            if str(response.question_id) in persistent_question_ids:
                responses_to_keep.append(response)
            else:
                responses_to_delete.append(response)

        responses_deleted_count = len(responses_to_delete)
        responses_preserved_count = len(responses_to_keep)

        # Get admin notes for this application
        notes = db.query(AdminNote).filter(
            AdminNote.application_id == app.id
        ).all()
        notes_deleted_count = len(notes)

        total_responses_deleted += responses_deleted_count
        total_responses_preserved += responses_preserved_count
        total_notes_deleted += notes_deleted_count

        # If not a dry run, actually make the changes
        if not reset_request.dry_run:
            # Delete non-persistent responses
            for response in responses_to_delete:
                db.delete(response)

            # Delete admin notes (they're season-specific)
            for note in notes:
                db.delete(note)

            # Reset application state using new status/sub_status system
            app.status = 'applicant'
            app.sub_status = 'not_started'
            app.completion_percentage = 0

            # Reset payment tracking (paid_invoice becomes NULL for applicants)
            app.paid_invoice = None
            app.stripe_invoice_id = None

            # Mark as returning camper since they had a previous application
            app.is_returning_camper = True

            # Clear approval records from application_approvals table
            db.query(ApplicationApproval).filter(
                ApplicationApproval.application_id == app.id
            ).delete()

            # Clear timestamps (except created_at)
            app.completed_at = None
            app.under_review_at = None
            app.promoted_to_camper_at = None
            app.waitlisted_at = None
            app.deferred_at = None
            app.withdrawn_at = None
            app.rejected_at = None
            app.paid_at = None
            app.accepted_at = None
            app.declined_at = None

            # Update timestamp
            app.updated_at = datetime.now(timezone.utc)

        application_results.append(AnnualResetApplicationResult(
            application_id=app.id,
            camper_name=camper_name,
            previous_status=previous_status,
            responses_deleted=responses_deleted_count,
            responses_preserved=responses_preserved_count,
            notes_deleted=notes_deleted_count
        ))

    # Commit changes if not a dry run
    if not reset_request.dry_run:
        db.commit()

        # Create audit log
        audit_log = AuditLog(
            entity_type='system',
            entity_id=None,
            action='annual_reset',
            actor_id=current_user.id,
            details={
                'archive_year': archive_year,
                'applications_reset': len(applications_to_reset),
                'responses_deleted': total_responses_deleted,
                'responses_preserved': total_responses_preserved,
                'notes_deleted': total_notes_deleted,
                'skipped_statuses': skipped_by_status
            }
        )
        db.add(audit_log)
        db.commit()

    return AnnualResetResult(
        dry_run=reset_request.dry_run,
        archive_year=archive_year,
        total_applications_processed=len(applications_to_reset),
        total_responses_deleted=total_responses_deleted,
        total_responses_preserved=total_responses_preserved,
        total_notes_deleted=total_notes_deleted,
        applications_reset=application_results,
        skipped_statuses=skipped_by_status
    )


@router.get("/annual-reset/preview", response_model=AnnualResetResult)
async def preview_annual_reset(
    exclude_paid: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Preview what the annual reset would do without making any changes.
    This is a convenience endpoint equivalent to POST with dry_run=True.

    By default, paid applications ARE included in the reset preview
    (since they're returning campers who need to reapply).
    Set exclude_paid=True to skip paid applications.
    """
    return await perform_annual_reset(
        AnnualResetRequest(dry_run=True, exclude_paid=exclude_paid),
        db=db,
        current_user=current_user
    )


# ============================================================================
# APPLICATION DELETION (Super Admin Only)
# ============================================================================

@router.delete("/applications/{application_id}")
async def delete_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Permanently delete an application and all associated data.

    This is a DESTRUCTIVE operation that:
    1. Voids any open invoices in Stripe (for campers)
    2. Deletes all files from Supabase Storage
    3. Deletes the application and all related data (CASCADE):
       - Application responses
       - Files (DB records)
       - Admin notes
       - Invoices (DB records)
       - Medications and allergies

    This action CANNOT be undone.

    Only super admins can perform this action.
    """
    # Get the application with related data
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    # Collect deletion summary for audit log
    deletion_summary = {
        'application_id': str(application.id),
        'camper_name': f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip() or 'Unknown',
        'status': application.status,
        'sub_status': application.sub_status,
        'user_id': str(application.user_id),
        'files_deleted': 0,
        'invoices_voided': 0,
        'invoices_already_paid': 0,
        'storage_errors': []
    }

    # Step 1: Void open invoices if this is a camper (has invoices)
    invoices = db.query(Invoice).filter(Invoice.application_id == application_id).all()
    for invoice in invoices:
        if invoice.status == 'open':
            try:
                result = stripe_service.void_invoice(
                    db=db,
                    invoice_id=invoice.id,
                    reason=f"Application deleted by super admin {current_user.email}",
                    admin_id=current_user.id
                )
                if result.get('success'):
                    deletion_summary['invoices_voided'] += 1
            except Exception as e:
                # Log error but continue with deletion
                deletion_summary['storage_errors'].append(f"Failed to void invoice {invoice.id}: {str(e)}")
        elif invoice.status == 'paid':
            deletion_summary['invoices_already_paid'] += 1

    # Step 2: Delete files from Supabase Storage
    files = db.query(File).filter(File.application_id == application_id).all()
    for file in files:
        if file.storage_path:
            try:
                storage_service.delete_file(file.storage_path)
                deletion_summary['files_deleted'] += 1
            except Exception as e:
                # Log error but continue with deletion
                deletion_summary['storage_errors'].append(f"Failed to delete file {file.storage_path}: {str(e)}")

    # Step 3: Delete email_logs (no CASCADE on this table's FK)
    db.execute(
        text("DELETE FROM email_logs WHERE application_id = :app_id"),
        {'app_id': application_id}
    )

    # Step 4: Delete the application (CASCADE handles related records)
    db.delete(application)
    db.commit()

    # Step 5: Create audit log
    audit_log = AuditLog(
        entity_type='application',
        entity_id=None,  # Application no longer exists
        action='deleted',
        actor_id=current_user.id,
        details=deletion_summary
    )
    db.add(audit_log)
    db.commit()

    return {
        'success': True,
        'message': f"Application for {deletion_summary['camper_name']} has been permanently deleted",
        'summary': deletion_summary
    }
