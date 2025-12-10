"""
Super Admin API endpoints
Only accessible by users with role = 'super_admin'
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from app.core.database import get_db
from app.core.deps import get_current_super_admin_user
from app.models.user import User
from app.models.application import Application, ApplicationResponse, ApplicationQuestion
from app.models.super_admin import SystemConfiguration, AuditLog, EmailTemplate, Team
from app.schemas.super_admin import (
    SystemConfiguration as SystemConfigurationSchema,
    SystemConfigurationCreate,
    SystemConfigurationUpdate,
    AuditLog as AuditLogSchema,
    AuditLogWithActor,
    EmailTemplate as EmailTemplateSchema,
    EmailTemplateCreate,
    EmailTemplateUpdate,
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
    AnnualResetApplicationResult
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
    """Get comprehensive dashboard statistics for super admin"""

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

    # Applications by status
    applications_in_progress = db.query(func.count(Application.id)).filter(
        Application.status == 'in_progress'
    ).scalar() or 0

    applications_under_review = db.query(func.count(Application.id)).filter(
        Application.status == 'under_review'
    ).scalar() or 0

    applications_accepted = db.query(func.count(Application.id)).filter(
        Application.status == 'accepted'
    ).scalar() or 0

    applications_paid = db.query(func.count(Application.id)).filter(
        Application.status == 'paid'
    ).scalar() or 0

    applications_declined = db.query(func.count(Application.id)).filter(
        Application.status == 'declined'
    ).scalar() or 0

    # Payment stats (placeholder - will be real when payment system exists)
    total_revenue = 0.0
    season_revenue = 0.0
    outstanding_payments = applications_accepted  # Accepted but not paid

    # Average completion time (from created to submitted)
    avg_completion_result = db.query(
        func.avg(func.extract('epoch', Application.updated_at - Application.created_at) / 86400)
    ).filter(
        Application.status.in_(['under_review', 'accepted', 'paid', 'declined'])
    ).scalar()
    avg_completion_days = float(avg_completion_result) if avg_completion_result else None

    # Average review time (from submitted to accepted)
    avg_review_result = db.query(
        func.avg(func.extract('epoch', Application.accepted_at - Application.updated_at) / 86400)
    ).filter(
        Application.accepted_at.isnot(None)
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
        applications_in_progress=applications_in_progress,
        applications_under_review=applications_under_review,
        applications_accepted=applications_accepted,
        applications_paid=applications_paid,
        applications_declined=applications_declined,
        total_revenue=total_revenue,
        season_revenue=season_revenue,
        outstanding_payments=outstanding_payments,
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
        # Count admins in this team
        admin_count = db.query(func.count(User.id)).filter(
            User.role == 'admin',
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
    """Suspend or activate user"""

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
        details={'old_status': old_status, 'new_status': status_data.status, 'reason': status_data.reason}
    )
    db.add(audit_log)
    db.commit()

    return UserResponse.model_validate(user)


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
    """Update system configuration"""

    config = db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )

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
        action='updated',
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
# TEAMS
# ============================================================================

@router.get("/teams", response_model=List[TeamWithAdminCount])
async def get_all_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get all teams with admin counts"""

    teams = db.query(Team).order_by(Team.order_index).all()
    result = []

    for team in teams:
        admin_count = db.query(func.count(User.id)).filter(
            User.role == 'admin',
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
    1. Resets all active applications to 'not_started' status
    2. Preserves responses for questions marked with persist_annually=True
    3. Deletes all other responses
    4. Resets approval tracking and timestamps
    5. Logs the action for audit purposes

    Use dry_run=True to preview changes without applying them.
    """

    # Determine archive year
    archive_year = reset_request.archive_year or datetime.now().year

    # Define which statuses to skip (terminal states that shouldn't be reset)
    skip_statuses = {'rejected', 'declined', 'withdrawn', 'deferred'}
    if not reset_request.include_paid:
        skip_statuses.add('paid')

    # Get all applications grouped by status
    all_applications = db.query(Application).all()

    # Track skipped applications by status
    skipped_by_status = {}
    applications_to_reset = []

    for app in all_applications:
        if app.status in skip_statuses:
            skipped_by_status[app.status] = skipped_by_status.get(app.status, 0) + 1
        else:
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

        total_responses_deleted += responses_deleted_count
        total_responses_preserved += responses_preserved_count

        # If not a dry run, actually make the changes
        if not reset_request.dry_run:
            # Delete non-persistent responses
            for response in responses_to_delete:
                db.delete(response)

            # Reset application state
            app.status = 'not_started'
            app.tier = 1
            app.completion_percentage = 0

            # Clear approval flags
            app.ops_approved = False
            app.behavioral_approved = False
            app.medical_approved = False
            app.ops_approved_by = None
            app.behavioral_approved_by = None
            app.medical_approved_by = None
            app.ops_approved_at = None
            app.behavioral_approved_at = None
            app.medical_approved_at = None

            # Clear timestamps (except created_at)
            app.completed_at = None
            app.under_review_at = None
            app.promoted_to_tier2_at = None
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
            responses_preserved=responses_preserved_count
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
        applications_reset=application_results,
        skipped_statuses=skipped_by_status
    )


@router.get("/annual-reset/preview", response_model=AnnualResetResult)
async def preview_annual_reset(
    include_paid: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Preview what the annual reset would do without making any changes.
    This is a convenience endpoint equivalent to POST with dry_run=True.
    """
    return await perform_annual_reset(
        AnnualResetRequest(dry_run=True, include_paid=include_paid),
        db=db,
        current_user=current_user
    )
