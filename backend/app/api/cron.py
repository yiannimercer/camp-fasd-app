"""
Cron Job API endpoints
Handles scheduled email sending triggered by Vercel Cron Jobs

Vercel Cron Configuration (vercel.json):
{
  "crons": [
    { "path": "/api/cron/process-queue", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/scheduled-automations", "schedule": "0 * * * *" }
  ]
}

The scheduled-automations endpoint is called hourly and processes email automations
from the email_automations table based on their configured schedule_day and schedule_hour.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.application import Application
from app.models.super_admin import SystemConfiguration
from app.services import email_service
from app.services.scheduled_emails import process_all_due_automations

router = APIRouter()


def verify_cron_secret(authorization: Optional[str] = Header(None)):
    """
    Verify the cron job is being called by Vercel or an authorized source.
    In production, Vercel cron jobs must include an authorization header.

    Security: This prevents unauthorized users from triggering email operations.

    Expected header format: Authorization: Bearer <CRON_SECRET>
    """
    # In development mode without CRON_SECRET configured, allow requests
    if settings.DEBUG and not settings.CRON_SECRET:
        return True

    # In production, CRON_SECRET must be set
    if not settings.CRON_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: CRON_SECRET not set"
        )

    # Verify the authorization header is present
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )

    # Parse Bearer token
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>"
        )

    token = parts[1]

    # Constant-time comparison to prevent timing attacks
    import hmac
    if not hmac.compare_digest(token, settings.CRON_SECRET):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cron secret"
        )

    return True


def get_config_value(db: Session, key: str, default=None):
    """Get a system configuration value"""
    config = db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
    if config:
        value = config.value
        if isinstance(value, str):
            return value.strip('"')
        return value
    return default


@router.get("/process-queue")
async def process_email_queue(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_cron_secret)
):
    """
    Process pending emails in the queue.
    Should be called every 5 minutes by Vercel Cron.
    """
    result = email_service.process_email_queue(db, batch_size=20)

    return {
        "success": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **result
    }


@router.post("/weekly-emails")
async def send_weekly_emails(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_cron_secret)
):
    """
    Send weekly scheduled emails:
    - Admin digest
    - Payment reminders
    - Incomplete application reminders

    Should be called weekly (e.g., Monday 9 AM) by Vercel Cron.
    """
    results = {
        "admin_digest": {"sent": 0, "skipped": False, "error": None},
        "payment_reminders": {"sent": 0, "skipped": False, "error": None},
        "incomplete_reminders": {"sent": 0, "skipped": False, "error": None}
    }

    camp_year = get_config_value(db, 'camp_year', datetime.now().year)

    # 1. Admin Digest
    if get_config_value(db, 'admin_digest_enabled', True):
        try:
            results["admin_digest"] = await send_admin_digest(db, camp_year)
        except Exception as e:
            results["admin_digest"]["error"] = str(e)
    else:
        results["admin_digest"]["skipped"] = True

    # 2. Payment Reminders
    if get_config_value(db, 'payment_reminder_enabled', True):
        try:
            results["payment_reminders"] = await send_payment_reminders(db, camp_year)
        except Exception as e:
            results["payment_reminders"]["error"] = str(e)
    else:
        results["payment_reminders"]["skipped"] = True

    # 3. Incomplete Application Reminders
    if get_config_value(db, 'incomplete_reminder_enabled', True):
        try:
            results["incomplete_reminders"] = await send_incomplete_reminders(db, camp_year)
        except Exception as e:
            results["incomplete_reminders"]["error"] = str(e)
    else:
        results["incomplete_reminders"]["skipped"] = True

    return {
        "success": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": results
    }


async def send_admin_digest(db: Session, camp_year: int) -> dict:
    """Send weekly digest to all admins and super admins"""

    # Get all admins and super admins who have email enabled
    admins = db.query(User).filter(
        User.role.in_(['admin', 'super_admin']),
        User.status == 'active',
        User.receive_emails == True
    ).all()

    if not admins:
        return {"sent": 0, "error": "No active admins found"}

    # Calculate statistics
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    total_applications = db.query(func.count(Application.id)).scalar() or 0

    new_this_week = db.query(func.count(Application.id)).filter(
        Application.created_at >= week_ago
    ).scalar() or 0

    not_started = db.query(func.count(Application.id)).filter(
        Application.status == 'applicant',
        Application.sub_status == 'not_started'
    ).scalar() or 0

    incomplete = db.query(func.count(Application.id)).filter(
        Application.status == 'applicant',
        Application.sub_status == 'incomplete'
    ).scalar() or 0

    complete = db.query(func.count(Application.id)).filter(
        Application.status == 'applicant',
        Application.sub_status == 'complete'
    ).scalar() or 0

    under_review = db.query(func.count(Application.id)).filter(
        Application.status == 'applicant',
        Application.sub_status == 'under_review'
    ).scalar() or 0

    waitlisted = db.query(func.count(Application.id)).filter(
        Application.status == 'waitlist'
    ).scalar() or 0

    accepted_campers = db.query(func.count(Application.id)).filter(
        Application.status == 'camper'
    ).scalar() or 0

    unpaid_campers = db.query(func.count(Application.id)).filter(
        Application.status == 'camper',
        Application.paid_invoice != True
    ).scalar() or 0

    paid_campers = db.query(func.count(Application.id)).filter(
        Application.status == 'camper',
        Application.paid_invoice == True
    ).scalar() or 0

    digest_date = datetime.now().strftime('%B %d, %Y')

    sent_count = 0
    for admin in admins:
        try:
            email_service.send_template_email(
                db=db,
                to_email=admin.email,
                template_key='admin_digest',
                variables={
                    'campYear': camp_year,
                    'digestDate': digest_date,
                    'totalApplications': total_applications,
                    'newThisWeek': new_this_week,
                    'notStarted': not_started,
                    'incomplete': incomplete,
                    'complete': complete,
                    'underReview': under_review,
                    'waitlisted': waitlisted,
                    'acceptedCampers': accepted_campers,
                    'unpaidCampers': unpaid_campers,
                    'paidCampers': paid_campers,
                },
                to_name=f"{admin.first_name} {admin.last_name}",
                user_id=admin.id
            )
            sent_count += 1
        except Exception as e:
            print(f"Failed to send digest to {admin.email}: {e}")

    return {"sent": sent_count}


async def send_payment_reminders(db: Session, camp_year: int) -> dict:
    """Send payment reminders to accepted but unpaid campers"""

    # Get all campers with unpaid invoices (who have email enabled)
    unpaid_applications = db.query(Application, User).join(
        User, Application.user_id == User.id
    ).filter(
        Application.status == 'camper',
        Application.paid_invoice != True,
        User.receive_emails == True
    ).all()

    sent_count = 0
    for app, user in unpaid_applications:
        try:
            camper_first = app.camper_first_name or ''
            camper_last = app.camper_last_name or ''
            camper_name = f"{camper_first} {camper_last}".strip() or "your camper"
            email_service.send_template_email(
                db=db,
                to_email=user.email,
                template_key='payment_reminder',
                variables={
                    'firstName': user.first_name,
                    'camperName': camper_name,
                    'camperFirstName': camper_first,
                    'camperLastName': camper_last,
                    'campYear': camp_year,
                },
                to_name=f"{user.first_name} {user.last_name}",
                user_id=user.id,
                application_id=app.id
            )
            sent_count += 1
        except Exception as e:
            print(f"Failed to send payment reminder to {user.email}: {e}")

    return {"sent": sent_count}


async def send_incomplete_reminders(db: Session, camp_year: int) -> dict:
    """Send reminders to applicants with incomplete applications"""

    # Get all applicants with incomplete applications (who have email enabled)
    incomplete_applications = db.query(Application, User).join(
        User, Application.user_id == User.id
    ).filter(
        Application.status == 'applicant',
        Application.sub_status.in_(['not_started', 'incomplete']),
        Application.completion_percentage < 100,
        User.receive_emails == True
    ).all()

    sent_count = 0
    for app, user in incomplete_applications:
        try:
            camper_first = app.camper_first_name or ''
            camper_last = app.camper_last_name or ''
            camper_name = f"{camper_first} {camper_last}".strip() or "your camper"
            email_service.send_template_email(
                db=db,
                to_email=user.email,
                template_key='incomplete_reminder',
                variables={
                    'firstName': user.first_name,
                    'camperName': camper_name,
                    'camperFirstName': camper_first,
                    'camperLastName': camper_last,
                    'campYear': camp_year,
                    'completionPercentage': app.completion_percentage,
                },
                to_name=f"{user.first_name} {user.last_name}",
                user_id=user.id,
                application_id=app.id
            )
            sent_count += 1
        except Exception as e:
            print(f"Failed to send incomplete reminder to {user.email}: {e}")

    return {"sent": sent_count}


@router.post("/admin-digest")
async def trigger_admin_digest(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_cron_secret)
):
    """Manually trigger admin digest (for testing)"""
    camp_year = get_config_value(db, 'camp_year', datetime.now().year)
    result = await send_admin_digest(db, camp_year)
    return {"success": True, **result}


@router.post("/payment-reminders")
async def trigger_payment_reminders(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_cron_secret)
):
    """Manually trigger payment reminders (for testing)"""
    camp_year = get_config_value(db, 'camp_year', datetime.now().year)
    result = await send_payment_reminders(db, camp_year)
    return {"success": True, **result}


@router.post("/incomplete-reminders")
async def trigger_incomplete_reminders(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_cron_secret)
):
    """Manually trigger incomplete reminders (for testing)"""
    camp_year = get_config_value(db, 'camp_year', datetime.now().year)
    result = await send_incomplete_reminders(db, camp_year)
    return {"success": True, **result}


@router.get("/scheduled-automations")
async def send_scheduled_automations(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_cron_secret)
):
    """
    Process scheduled email automations from the database.

    This endpoint is called hourly by Vercel Cron. It queries the email_automations
    table for automations where:
    - trigger_type = 'scheduled'
    - is_active = True
    - schedule_day matches current UTC day (0=Sunday, 6=Saturday)
    - schedule_hour matches current UTC hour (0-23)
    - last_sent_at is null or > 7 days ago (prevents duplicates)

    Each matching automation sends emails to recipients based on its audience_filter
    using the configured email template.

    This is the data-driven replacement for the hardcoded weekly-emails endpoint,
    allowing admins to configure scheduled emails via the super admin UI.
    """
    camp_year = get_config_value(db, 'camp_year', datetime.now().year)
    results = await process_all_due_automations(db, camp_year)

    return {
        "success": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **results
    }
