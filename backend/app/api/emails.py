"""
Email API endpoints
Handles email sending, templates, logs, and queue management
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from pydantic import BaseModel, EmailStr
from uuid import UUID
import os

from app.core.database import get_db
from app.core.deps import get_current_super_admin_user, get_current_admin_user, get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.models.application import Application
from app.models.super_admin import EmailTemplate, EmailDocument, AuditLog
from app.services import email_service
from app.core.audit import log_audit_event, ENTITY_EMAIL

settings = get_settings()

router = APIRouter()


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class SendEmailRequest(BaseModel):
    """Request to send an email"""
    to_email: EmailStr
    to_name: Optional[str] = None
    subject: str
    html_content: str
    text_content: Optional[str] = None
    application_id: Optional[str] = None


class SendTemplateEmailRequest(BaseModel):
    """Request to send a templated email"""
    to_email: EmailStr
    to_name: Optional[str] = None
    template_key: str
    variables: Optional[dict] = None
    application_id: Optional[str] = None


class SendAdHocEmailRequest(BaseModel):
    """Request to send an ad-hoc email from application review"""
    application_id: str
    subject: str
    message: str  # Plain text message - will be wrapped in template


class MassEmailRecipient(BaseModel):
    """Recipient for mass email"""
    email: EmailStr
    name: Optional[str] = None
    user_id: Optional[str] = None
    application_id: Optional[str] = None
    variables: Optional[dict] = None


class SendMassEmailRequest(BaseModel):
    """Request to send mass emails"""
    subject: str
    html_content: str
    text_content: Optional[str] = None
    recipients: List[MassEmailRecipient]
    template_key: Optional[str] = None


class EmailLogResponse(BaseModel):
    """Email log entry"""
    id: str
    recipient_email: str
    recipient_name: Optional[str]
    subject: Optional[str]
    template_used: Optional[str]
    email_type: Optional[str]
    status: Optional[str]
    error_message: Optional[str]
    sent_at: Optional[datetime]
    user_id: Optional[str]
    application_id: Optional[str]


class EmailQueueResponse(BaseModel):
    """Email queue entry"""
    id: str
    recipient_email: str
    recipient_name: Optional[str]
    subject: str
    template_key: Optional[str]
    status: str
    priority: int
    attempts: int
    scheduled_for: Optional[datetime]
    created_at: datetime
    processed_at: Optional[datetime]
    error_message: Optional[str]


class QueueStatsResponse(BaseModel):
    """Email queue statistics"""
    pending: int
    processing: int
    completed: int
    failed: int


class EmailConfigResponse(BaseModel):
    """Email configuration"""
    enabled: bool
    from_email: str
    from_name: str
    camp_year: int
    organization_name: str
    organization_website: str
    production_url: str


class SendEmailResponse(BaseModel):
    """Response from sending an email"""
    success: bool
    resend_id: Optional[str] = None
    error: Optional[str] = None


# ============================================================================
# EMAIL SENDING ENDPOINTS
# ============================================================================

@router.post("/send", response_model=SendEmailResponse)
async def send_email(
    request: SendEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Send an email directly (admin only)"""

    result = email_service.send_email(
        db=db,
        to_email=request.to_email,
        subject=request.subject,
        html_content=request.html_content,
        text_content=request.text_content,
        to_name=request.to_name,
        user_id=current_user.id,
        application_id=UUID(request.application_id) if request.application_id else None,
        email_type='manual'
    )

    # Log the action
    log_audit_event(
        db=db,
        entity_type=ENTITY_EMAIL,
        action='email_sent',
        actor_id=current_user.id,
        details={
            'to_email': request.to_email,
            'subject': request.subject,
            'success': result['success']
        }
    )

    return SendEmailResponse(**result)


@router.post("/send-template", response_model=SendEmailResponse)
async def send_template_email(
    request: SendTemplateEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Send an email using a template (admin only)"""

    result = email_service.send_template_email(
        db=db,
        to_email=request.to_email,
        template_key=request.template_key,
        variables=request.variables,
        to_name=request.to_name,
        application_id=UUID(request.application_id) if request.application_id else None
    )

    return SendEmailResponse(**result)


@router.post("/send-adhoc", response_model=SendEmailResponse)
async def send_adhoc_email(
    request: SendAdHocEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Send an ad-hoc email from application review page"""

    # Get application and user details
    application = db.query(Application).filter(Application.id == request.application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    user = db.query(User).filter(User.id == application.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Build branded email content
    # Note: Greeting is NOT added here - it should be included in the message
    # from the frontend, allowing admins to customize or remove it
    inner_content = email_service.wrap_content_in_brand(
        db=db,
        content=request.message
    )
    html_content = email_service.get_branded_email_wrapper(
        db=db,
        content=inner_content,
        subject=request.subject
    )

    result = email_service.send_email(
        db=db,
        to_email=user.email,
        subject=request.subject,
        html_content=html_content,
        text_content=request.message,
        to_name=f"{user.first_name} {user.last_name}",
        user_id=user.id,
        application_id=application.id,
        email_type='adhoc'
    )

    # Log the action
    log_audit_event(
        db=db,
        entity_type=ENTITY_EMAIL,
        action='adhoc_email_sent',
        actor_id=current_user.id,
        entity_id=application.id,
        details={
            'to_email': user.email,
            'subject': request.subject,
            'success': result['success']
        }
    )

    return SendEmailResponse(**result)


# ============================================================================
# MASS EMAIL ENDPOINTS
# ============================================================================

@router.post("/send-mass")
async def send_mass_email(
    request: SendMassEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Send mass emails immediately (super admin only)"""

    sent_count = 0
    failed_count = 0
    errors = []

    # Get base variables for template substitution
    base_vars = email_service.get_base_variables(db)

    for recipient in request.recipients:
        try:
            # Build recipient-specific variables
            recipient_vars = {
                **base_vars,
                'firstName': recipient.name.split()[0] if recipient.name else '',
                'lastName': recipient.name.split()[-1] if recipient.name and ' ' in recipient.name else '',
            }
            # Add any recipient-specific variables
            if recipient.variables:
                recipient_vars.update(recipient.variables)

            # Substitute variables in subject and content
            rendered_subject = email_service.render_template(request.subject, recipient_vars)
            rendered_content = email_service.render_template(request.html_content, recipient_vars)

            # Wrap in branded template
            inner_content = email_service.wrap_content_in_brand(
                db=db,
                content=rendered_content,
                greeting=f"Dear {recipient.name.split()[0] if recipient.name else 'there'},"
            )
            branded_html = email_service.get_branded_email_wrapper(
                db=db,
                content=inner_content,
                subject=rendered_subject
            )

            # Render text content if provided
            rendered_text = email_service.render_template(request.text_content, recipient_vars) if request.text_content else None

            # Send the email directly
            result = email_service.send_email(
                db=db,
                to_email=recipient.email,
                subject=rendered_subject,
                html_content=branded_html,
                text_content=rendered_text,
                to_name=recipient.name,
                user_id=UUID(recipient.user_id) if recipient.user_id else None,
                application_id=UUID(recipient.application_id) if recipient.application_id else None,
                template_key=request.template_key,
                email_type='mass'
            )

            if result['success']:
                sent_count += 1
            else:
                failed_count += 1
                errors.append({'email': recipient.email, 'error': result.get('error')})

        except Exception as e:
            failed_count += 1
            errors.append({'email': recipient.email, 'error': str(e)})

    # Log the action
    log_audit_event(
        db=db,
        entity_type=ENTITY_EMAIL,
        action='mass_email_sent',
        actor_id=current_user.id,
        details={
            'subject': request.subject,
            'total_recipients': len(request.recipients),
            'sent': sent_count,
            'failed': failed_count
        }
    )

    return {
        "success": failed_count == 0,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "message": f"Sent {sent_count} emails" + (f", {failed_count} failed" if failed_count > 0 else ""),
        "errors": errors if errors else None
    }


@router.get("/audience")
async def get_email_audience(
    status_filter: Optional[str] = Query(None, description="Filter by status (applicant, camper, inactive)"),
    sub_status_filter: Optional[str] = Query(None, description="Filter by sub_status"),
    paid_filter: Optional[bool] = Query(None, description="Filter by payment status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get potential email recipients based on filters (super admin only)"""

    query = db.query(Application, User).join(User, Application.user_id == User.id)

    if status_filter:
        query = query.filter(Application.status == status_filter)

    if sub_status_filter:
        query = query.filter(Application.sub_status == sub_status_filter)

    if paid_filter is not None:
        query = query.filter(Application.paid_invoice == paid_filter)

    results = query.all()

    recipients = []
    for app, user in results:
        recipients.append({
            "email": user.email,
            "name": f"{user.first_name} {user.last_name}",
            "user_id": str(user.id),
            "application_id": str(app.id),
            "status": app.status,
            "sub_status": app.sub_status,
            "paid_invoice": app.paid_invoice,
            "camper_name": f"{app.camper_first_name or ''} {app.camper_last_name or ''}".strip() or None
        })

    return {
        "count": len(recipients),
        "recipients": recipients
    }


# ============================================================================
# EMAIL LOGS ENDPOINTS
# ============================================================================

@router.get("/logs", response_model=List[EmailLogResponse])
async def get_email_logs(
    email_type: Optional[str] = Query(None, description="Filter by email type"),
    recipient_email: Optional[str] = Query(None, description="Filter by recipient email"),
    application_id: Optional[str] = Query(None, description="Filter by application ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get email logs (super admin only)"""

    query = """
        SELECT id, recipient_email, recipient_name, subject, template_used,
               email_type, status, error_message, sent_at,
               user_id::text, application_id::text
        FROM email_logs
        WHERE 1=1
    """
    params = {}

    if email_type:
        query += " AND email_type = :email_type"
        params['email_type'] = email_type

    if recipient_email:
        query += " AND recipient_email ILIKE :recipient_email"
        params['recipient_email'] = f"%{recipient_email}%"

    if application_id:
        query += " AND application_id = :application_id"
        params['application_id'] = application_id

    query += " ORDER BY sent_at DESC NULLS LAST LIMIT :limit OFFSET :skip"
    params['limit'] = limit
    params['skip'] = skip

    result = db.execute(text(query), params)
    logs = result.fetchall()

    return [
        EmailLogResponse(
            id=str(log[0]),
            recipient_email=log[1],
            recipient_name=log[2],
            subject=log[3],
            template_used=log[4],
            email_type=log[5],
            status=log[6],
            error_message=log[7],
            sent_at=log[8],
            user_id=log[9],
            application_id=log[10]
        )
        for log in logs
    ]


@router.get("/logs/stats")
async def get_email_log_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get email log statistics (super admin only)"""

    result = db.execute(text("""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'sent') as sent,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '24 hours') as last_24h,
            COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days') as last_7d
        FROM email_logs
    """))

    row = result.fetchone()

    return {
        "total": row[0] or 0,
        "sent": row[1] or 0,
        "failed": row[2] or 0,
        "last_24h": row[3] or 0,
        "last_7d": row[4] or 0
    }


# ============================================================================
# EMAIL QUEUE ENDPOINTS
# ============================================================================

@router.get("/queue", response_model=List[EmailQueueResponse])
async def get_email_queue(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get email queue (super admin only)"""

    query = """
        SELECT id, recipient_email, recipient_name, subject, template_key,
               status, priority, attempts, scheduled_for, created_at,
               processed_at, error_message
        FROM email_queue
        WHERE 1=1
    """
    params = {}

    if status_filter:
        query += " AND status = :status"
        params['status'] = status_filter

    query += " ORDER BY priority DESC, created_at ASC LIMIT :limit OFFSET :skip"
    params['limit'] = limit
    params['skip'] = skip

    result = db.execute(text(query), params)
    queue = result.fetchall()

    return [
        EmailQueueResponse(
            id=str(item[0]),
            recipient_email=item[1],
            recipient_name=item[2],
            subject=item[3],
            template_key=item[4],
            status=item[5],
            priority=item[6],
            attempts=item[7],
            scheduled_for=item[8],
            created_at=item[9],
            processed_at=item[10],
            error_message=item[11]
        )
        for item in queue
    ]


@router.get("/queue/stats", response_model=QueueStatsResponse)
async def get_queue_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get email queue statistics (super admin only)"""

    stats = email_service.get_queue_stats(db)
    return QueueStatsResponse(**stats)


@router.post("/queue/process")
async def process_queue(
    batch_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Manually trigger queue processing (super admin only)"""

    result = email_service.process_email_queue(db, batch_size=batch_size)

    return {
        "success": True,
        **result
    }


@router.delete("/queue/{email_id}")
async def cancel_queued_email(
    email_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Cancel a pending queued email (super admin only)"""

    result = db.execute(
        text("""
            DELETE FROM email_queue
            WHERE id = :id AND status = 'pending'
            RETURNING id
        """),
        {'id': email_id}
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found or not in pending status"
        )

    return {"success": True, "message": "Email cancelled"}


# ============================================================================
# EMAIL CONFIG ENDPOINTS
# ============================================================================

@router.get("/config", response_model=EmailConfigResponse)
async def get_email_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Get email configuration (super admin only)"""

    config = email_service.get_email_config(db)
    return EmailConfigResponse(**config)


class PreviewEmailRequest(BaseModel):
    """Request to preview an email with branding"""
    subject: str
    content: str  # Plain text, simple HTML, or Markdown content
    is_markdown: bool = False  # Whether content is Markdown (converts to styled HTML)
    recipient_name: Optional[str] = "John"
    camper_first_name: Optional[str] = "Sarah"
    camper_last_name: Optional[str] = "Smith"
    variables: Optional[dict] = None  # Custom variables


@router.post("/preview")
async def preview_email(
    request: PreviewEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get a preview of how an email will look with full CAMP branding.
    Returns the complete HTML that would be sent to recipients.
    Substitutes {{variable}} placeholders with sample data.

    When is_markdown=True:
    1. Substitutes {{variables}} in markdown content
    2. Converts markdown to HTML with CAMP brand styling
    3. Wraps in branded email template (logo, header, footer)

    When is_markdown=False (default):
    1. Substitutes {{variables}} in content
    2. Wraps plain content with greeting/closing
    3. Wraps in branded email template
    """
    # Build sample variables for preview
    base_vars = email_service.get_base_variables(db)
    camper_first = request.camper_first_name or 'Sarah'
    camper_last = request.camper_last_name or 'Smith'
    preview_vars = {
        **base_vars,
        'firstName': request.recipient_name,
        'lastName': 'Doe',
        'camperName': f"{camper_first} {camper_last}".strip(),
        'camperFirstName': camper_first,
        'camperLastName': camper_last,
        'completionPercentage': 75,
        'status': 'camper',
        'subStatus': 'incomplete',
    }
    # Merge with any custom variables provided
    if request.variables:
        preview_vars.update(request.variables)

    # Substitute variables in subject (always the same)
    rendered_subject = email_service.render_template(request.subject, preview_vars)

    if request.is_markdown:
        # Markdown flow:
        # 1. Substitute variables in markdown
        rendered_markdown = email_service.render_template(request.content, preview_vars)

        # 2. Convert markdown to styled HTML
        styled_html = email_service.markdown_to_html(rendered_markdown)

        # 3. Wrap in branded template (logo, header, footer)
        branded_html = email_service.get_branded_email_wrapper(
            db=db,
            content=styled_html,
            subject=rendered_subject
        )
    else:
        # Plain text/HTML flow (existing behavior):
        rendered_content = email_service.render_template(request.content, preview_vars)

        inner_content = email_service.wrap_content_in_brand(
            db=db,
            content=rendered_content,
            greeting=f"Dear {request.recipient_name},"
        )
        branded_html = email_service.get_branded_email_wrapper(
            db=db,
            content=inner_content,
            subject=rendered_subject
        )

    return {
        "subject": rendered_subject,
        "html": branded_html
    }


@router.get("/preview/template/{template_key}")
async def preview_template(
    template_key: str,
    first_name: str = Query("John", description="Sample first name"),
    camper_name: str = Query("Sarah", description="Sample camper name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Preview a specific email template with sample data.
    Returns the rendered HTML that would be sent to recipients.
    """
    template = email_service.get_template_by_key(db, template_key)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template '{template_key}' not found"
        )

    # Build sample variables
    base_vars = email_service.get_base_variables(db)
    sample_vars = {
        **base_vars,
        'firstName': first_name,
        'camperName': camper_name,
        'completionPercentage': 75,
        'digestDate': datetime.now().strftime('%B %d, %Y'),
        'totalApplications': 42,
        'pendingReview': 8,
        'newThisWeek': 5,
        'unpaidCampers': 12,
    }

    # Render the template
    subject = email_service.render_template(template.subject, sample_vars)
    html_content = email_service.render_template(template.html_content, sample_vars)

    return {
        "template_key": template_key,
        "template_name": template.name,
        "subject": subject,
        "html": html_content
    }


@router.post("/test")
async def send_test_email(
    to_email: EmailStr = Query(..., description="Email address to send test to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """Send a test email to verify configuration (super admin only)"""

    config = email_service.get_email_config(db)

    # Create branded test email content
    test_content = f"""
        <h2 style="color: #316429; margin: 0 0 20px 0;">Test Email</h2>
        <p style="color: #333333; font-size: 16px; line-height: 1.6;">This is a test email to verify your email configuration is working correctly.</p>
        <div style="background-color: #f8f8f8; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="color: #333333; font-size: 14px; margin: 0 0 10px 0;"><strong>Configuration:</strong></p>
            <ul style="color: #666666; font-size: 14px; margin: 0; padding-left: 20px;">
                <li>From: {config['from_name']} &lt;{config['from_email']}&gt;</li>
                <li>Camp Year: {config['camp_year']}</li>
                <li>Sent at: {datetime.now(timezone.utc).strftime('%B %d, %Y at %I:%M %p UTC')}</li>
            </ul>
        </div>
        <p style="color: #316429; font-size: 16px; font-weight: bold;">✓ If you received this email, your email system is working correctly!</p>
    """

    html_content = email_service.get_branded_email_wrapper(
        db=db,
        content=test_content,
        subject=f"Test Email from {config['organization_name']}"
    )

    result = email_service.send_email(
        db=db,
        to_email=to_email,
        subject=f"Test Email from {config['organization_name']}",
        html_content=html_content,
        text_content="This is a test email to verify your email configuration is working correctly.",
        email_type='test'
    )

    return {
        "success": result['success'],
        "resend_id": result.get('resend_id'),
        "error": result.get('error'),
        "message": "Test email sent successfully" if result['success'] else f"Failed to send test email: {result.get('error')}"
    }


# ============================================================================
# EMAIL DELIVERABILITY VERIFICATION (User-Facing)
# ============================================================================

@router.post("/deliverability/send-test")
async def send_deliverability_test_email(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a test email to the current user to verify email deliverability.
    This helps ensure our emails don't go to spam.

    Rate limited to 3 emails per 24-hour window to prevent abuse.
    """
    # Rate limiting: Check how many deliverability test emails sent in last 24 hours
    RATE_LIMIT = 3
    RATE_LIMIT_WINDOW_HOURS = 24

    twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=RATE_LIMIT_WINDOW_HOURS)

    # Query email_logs for deliverability_test emails from this user in the window
    recent_tests_count = db.execute(
        text("""
            SELECT COUNT(*) FROM email_logs
            WHERE user_id = :user_id
            AND email_type = 'deliverability_test'
            AND sent_at >= :since
            AND status = 'sent'
        """),
        {"user_id": str(current_user.id), "since": twenty_four_hours_ago}
    ).scalar() or 0

    if recent_tests_count >= RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "rate_limit_exceeded",
                "message": f"You've reached the limit of {RATE_LIMIT} test emails in 24 hours.",
                "emails_sent": recent_tests_count,
                "limit": RATE_LIMIT,
                "retry_after_hours": RATE_LIMIT_WINDOW_HOURS
            }
        )

    config = email_service.get_email_config(db)

    # Create the test email content with spam prevention instructions
    test_content = f"""
        <h2 style="color: #316429; margin: 0 0 20px 0;">📬 Email Deliverability Test</h2>

        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hi {current_user.first_name or 'there'}! This is a test email to make sure you can receive important
            notifications about your camper's application.
        </p>

        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #316429;">
            <p style="color: #166534; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">
                ✓ Great news! If you're reading this in your inbox, our emails are working!
            </p>
            <p style="color: #15803d; font-size: 14px; margin: 0;">
                Return to your Account Settings and confirm you received this email.
            </p>
        </div>

        <div style="background-color: #fef3c7; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #f59e0b;">
            <p style="color: #92400e; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">
                ⚠️ Found this in your spam or junk folder?
            </p>
            <p style="color: #a16207; font-size: 14px; margin: 0 0 12px 0;">
                Please take these steps to ensure you receive all future emails:
            </p>
            <ol style="color: #a16207; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Mark this email as <strong>"Not Spam"</strong></li>
                <li>Add <strong style="color: #92400e;">apps@fasdcamp.org</strong> to your contacts or address book</li>
                <li>Move this email to your inbox</li>
            </ol>
        </div>

        <div style="background-color: #f8f8f8; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #666666; font-size: 13px; margin: 0;">
                <strong>From:</strong> {config['from_name']} &lt;{config['from_email']}&gt;<br>
                <strong>Sent:</strong> {datetime.now(timezone.utc).strftime('%B %d, %Y at %I:%M %p UTC')}
            </p>
        </div>
    """

    html_content = email_service.get_branded_email_wrapper(
        db=db,
        content=test_content,
        subject="Email Deliverability Test - CAMP FASD"
    )

    result = email_service.send_email(
        db=db,
        to_email=current_user.email,
        subject="Email Deliverability Test - CAMP FASD",
        html_content=html_content,
        text_content=f"Hi {current_user.first_name or 'there'}! This is a test email to verify you can receive notifications from CAMP FASD. If you found this in spam, please mark it as 'Not Spam' and add apps@fasdcamp.org to your contacts.",
        to_name=f"{current_user.first_name} {current_user.last_name}",
        user_id=current_user.id,
        email_type='deliverability_test'
    )

    if result['success']:
        # Update the user's test email timestamp
        current_user.email_test_sent_at = datetime.now(timezone.utc)
        db.commit()

    return {
        "success": result['success'],
        "error": result.get('error'),
        "message": "Test email sent! Check your inbox (and spam folder)." if result['success'] else f"Failed to send test email: {result.get('error')}"
    }


@router.post("/deliverability/confirm")
async def confirm_email_deliverability(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Confirm that the user received the test email and it wasn't in spam
    (or they fixed their spam settings).
    """
    # Check if they've actually requested a test email
    if not current_user.email_test_sent_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please send a test email first before confirming deliverability."
        )

    # Mark as confirmed
    current_user.email_deliverability_confirmed = True
    current_user.email_deliverability_confirmed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "message": "Email deliverability confirmed! You're all set to receive important notifications.",
        "confirmed_at": current_user.email_deliverability_confirmed_at.isoformat()
    }


@router.get("/deliverability/status")
async def get_email_deliverability_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current user's email deliverability status.
    """
    return {
        "email_deliverability_confirmed": current_user.email_deliverability_confirmed,
        "email_test_sent_at": current_user.email_test_sent_at.isoformat() if current_user.email_test_sent_at else None,
        "email_deliverability_confirmed_at": current_user.email_deliverability_confirmed_at.isoformat() if current_user.email_deliverability_confirmed_at else None
    }


# ============================================================================
# EMAIL DOCUMENTS MANAGEMENT
# ============================================================================

# Allowed file types for email documents
ALLOWED_DOCUMENT_TYPES = {
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
}

MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10MB


class EmailDocumentResponse(BaseModel):
    """Response model for email documents"""
    id: str
    name: str
    description: Optional[str]
    file_name: str
    file_size: int
    file_type: str
    url: Optional[str]  # Signed URL for accessing the file
    created_at: datetime
    uploaded_by_name: Optional[str]


class CreateDocumentRequest(BaseModel):
    """Request to create a document entry (after upload)"""
    name: str
    description: Optional[str] = None


@router.get("/documents", response_model=List[EmailDocumentResponse])
async def list_email_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    List all email documents available for linking in templates.
    Returns documents with signed URLs for access.
    """
    from supabase import create_client

    # Query documents with uploader info
    result = db.execute(
        text("""
            SELECT
                ed.id, ed.name, ed.description, ed.file_name,
                ed.file_size, ed.file_type, ed.storage_path,
                ed.created_at, u.first_name, u.last_name
            FROM email_documents ed
            LEFT JOIN users u ON ed.uploaded_by = u.id
            ORDER BY ed.created_at DESC
        """)
    )
    documents = result.fetchall()

    # Initialize Supabase client for signed URLs
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

    doc_responses = []
    for doc in documents:
        doc_id, name, description, file_name, file_size, file_type, storage_path, created_at, first_name, last_name = doc

        # Generate signed URL (valid for 1 year)
        try:
            signed_url_response = supabase.storage.from_('email-documents').create_signed_url(
                storage_path,
                60 * 60 * 24 * 365  # 1 year in seconds
            )
            url = signed_url_response.get('signedURL') if isinstance(signed_url_response, dict) else signed_url_response
        except Exception:
            url = None

        uploaded_by_name = f"{first_name} {last_name}".strip() if first_name else None

        doc_responses.append(EmailDocumentResponse(
            id=str(doc_id),
            name=name,
            description=description,
            file_name=file_name,
            file_size=file_size,
            file_type=file_type,
            url=url,
            created_at=created_at,
            uploaded_by_name=uploaded_by_name
        ))

    return doc_responses


@router.post("/documents", response_model=EmailDocumentResponse)
async def upload_email_document(
    name: str = Query(..., description="Display name for the document"),
    description: Optional[str] = Query(None, description="Optional description"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Upload a document that can be linked in email templates.
    Documents are stored in Supabase Storage and can be referenced using markdown syntax.

    Example markdown usage: [Medical Release Form](https://signed-url...)
    """
    from supabase import create_client
    import uuid

    # Validate file type
    if file.content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file.content_type}' not allowed. Allowed types: {', '.join(ALLOWED_DOCUMENT_TYPES.values())}"
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Validate file size
    if file_size > MAX_DOCUMENT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {MAX_DOCUMENT_SIZE // (1024 * 1024)}MB"
        )

    # Generate unique storage path
    file_ext = ALLOWED_DOCUMENT_TYPES.get(file.content_type, '')
    unique_id = str(uuid.uuid4())
    # Sanitize original filename
    safe_filename = "".join(c for c in file.filename if c.isalnum() or c in '._-')
    storage_path = f"{unique_id}/{safe_filename}"

    # Upload to Supabase Storage
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

    try:
        upload_result = supabase.storage.from_('email-documents').upload(
            storage_path,
            content,
            {"content-type": file.content_type}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )

    # Create database record
    result = db.execute(
        text("""
            INSERT INTO email_documents (name, description, file_name, storage_path, file_size, file_type, uploaded_by)
            VALUES (:name, :description, :file_name, :storage_path, :file_size, :file_type, :uploaded_by)
            RETURNING id, created_at
        """),
        {
            'name': name,
            'description': description,
            'file_name': file.filename,
            'storage_path': storage_path,
            'file_size': file_size,
            'file_type': file.content_type,
            'uploaded_by': str(current_user.id)
        }
    )
    db.commit()
    row = result.fetchone()
    doc_id, created_at = row

    # Generate signed URL
    try:
        signed_url_response = supabase.storage.from_('email-documents').create_signed_url(
            storage_path,
            60 * 60 * 24 * 365  # 1 year
        )
        url = signed_url_response.get('signedURL') if isinstance(signed_url_response, dict) else signed_url_response
    except Exception:
        url = None

    # Log the action
    log_audit_event(
        db=db,
        entity_type='email_document',
        action='document_uploaded',
        actor_id=current_user.id,
        entity_id=doc_id,
        details={
            'name': name,
            'file_name': file.filename,
            'file_size': file_size
        }
    )

    return EmailDocumentResponse(
        id=str(doc_id),
        name=name,
        description=description,
        file_name=file.filename,
        file_size=file_size,
        file_type=file.content_type,
        url=url,
        created_at=created_at,
        uploaded_by_name=f"{current_user.first_name} {current_user.last_name}".strip()
    )


@router.delete("/documents/{document_id}")
async def delete_email_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin_user)
):
    """
    Delete an email document from storage and database.
    """
    from supabase import create_client

    # Get the document
    result = db.execute(
        text("SELECT id, name, storage_path FROM email_documents WHERE id = :id"),
        {'id': document_id}
    )
    doc = result.fetchone()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    doc_id, name, storage_path = doc

    # Delete from Supabase Storage
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

    try:
        supabase.storage.from_('email-documents').remove([storage_path])
    except Exception as e:
        # Log but continue - file might not exist
        pass

    # Delete from database
    db.execute(
        text("DELETE FROM email_documents WHERE id = :id"),
        {'id': document_id}
    )
    db.commit()

    # Log the action
    log_audit_event(
        db=db,
        entity_type='email_document',
        action='document_deleted',
        actor_id=current_user.id,
        entity_id=doc_id,
        details={'name': name}
    )

    return {"success": True, "message": f"Document '{name}' deleted"}


@router.get("/documents/{document_id}/url")
async def get_document_signed_url(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get a fresh signed URL for a document.
    Useful for inserting links into email content.
    """
    from supabase import create_client

    # Get the document
    result = db.execute(
        text("SELECT storage_path, name FROM email_documents WHERE id = :id"),
        {'id': document_id}
    )
    doc = result.fetchone()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    storage_path, name = doc

    # Generate signed URL
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

    try:
        signed_url_response = supabase.storage.from_('email-documents').create_signed_url(
            storage_path,
            60 * 60 * 24 * 365  # 1 year
        )
        url = signed_url_response.get('signedURL') if isinstance(signed_url_response, dict) else signed_url_response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate signed URL: {str(e)}"
        )

    return {
        "document_id": document_id,
        "name": name,
        "url": url,
        "markdown": f"[{name}]({url})"  # Ready-to-use markdown link
    }
