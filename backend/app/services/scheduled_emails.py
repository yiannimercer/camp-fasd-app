"""
Scheduled Email Automation Service

This service processes scheduled email automations that are configured via the
super admin UI. Unlike event-based automations which fire immediately when an
event occurs, scheduled automations run at specific times (day + hour).

The cron job calls process_all_due_automations() hourly, which:
1. Determines the current day/hour in America/Chicago timezone (CST/CDT)
2. Queries email_automations table for matching scheduled automations
3. Filters out recently-run automations (using last_sent_at)
4. Sends emails to recipients based on audience_filter
5. Updates last_sent_at to prevent duplicates

TIMEZONE: All schedule_day and schedule_hour values are interpreted as
America/Chicago (Central Time). This automatically handles CST/CDT transitions.

Day of Week Mapping:
    Database (matching frontend UI):
        0 = Sunday, 1 = Monday, ..., 6 = Saturday
    Python datetime.weekday():
        0 = Monday, 1 = Tuesday, ..., 6 = Sunday
    Conversion: db_day = (python_weekday + 1) % 7
"""

from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging

from sqlalchemy import func

from app.models.super_admin import EmailAutomation, EmailTemplate, SystemConfiguration
from app.models.user import User
from app.models.application import Application
from app.services import email_service
from app.services.email_events import get_recipients_for_automation, build_email_context

logger = logging.getLogger(__name__)


def get_template_specific_variables(db: Session, template_key: str, camp_year: int) -> Dict[str, Any]:
    """
    Compute template-specific variables that require database queries.

    Different email templates need different computed values. For example,
    admin_digest needs application statistics, while payment_reminder needs
    invoice details.

    Args:
        db: Database session
        template_key: The email template key
        camp_year: Current camp year

    Returns:
        Dict of computed variables specific to this template
    """
    variables = {}

    if template_key == 'admin_digest':
        # Compute all statistics for admin digest
        # IMPORTANT: Exclude inactive applications from all counts
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)

        variables['digestDate'] = datetime.now().strftime('%B %d, %Y')

        # Total active applications (exclude inactive status)
        variables['totalApplications'] = db.query(func.count(Application.id)).filter(
            Application.status != 'inactive'
        ).scalar() or 0

        # New this week (exclude inactive)
        variables['newThisWeek'] = db.query(func.count(Application.id)).filter(
            Application.created_at >= week_ago,
            Application.status != 'inactive'
        ).scalar() or 0

        variables['notStarted'] = db.query(func.count(Application.id)).filter(
            Application.status == 'applicant',
            Application.sub_status == 'not_started'
        ).scalar() or 0

        variables['incomplete'] = db.query(func.count(Application.id)).filter(
            Application.status == 'applicant',
            Application.sub_status == 'incomplete'
        ).scalar() or 0

        variables['complete'] = db.query(func.count(Application.id)).filter(
            Application.status == 'applicant',
            Application.sub_status == 'complete'
        ).scalar() or 0

        variables['underReview'] = db.query(func.count(Application.id)).filter(
            Application.status == 'applicant',
            Application.sub_status == 'under_review'
        ).scalar() or 0

        variables['waitlisted'] = db.query(func.count(Application.id)).filter(
            Application.status == 'waitlist'
        ).scalar() or 0

        variables['acceptedCampers'] = db.query(func.count(Application.id)).filter(
            Application.status == 'camper'
        ).scalar() or 0

        variables['unpaidCampers'] = db.query(func.count(Application.id)).filter(
            Application.status == 'camper',
            Application.paid_invoice != True
        ).scalar() or 0

        variables['paidCampers'] = db.query(func.count(Application.id)).filter(
            Application.status == 'camper',
            Application.paid_invoice == True
        ).scalar() or 0

    return variables


def get_application_payment_variables(db: Session, application_id) -> Dict[str, Any]:
    """
    Compute payment-related variables for a specific application.

    These variables require querying the invoices table for the application.

    Returns:
        Dict with payment variables:
        - remainingBalance: Total unpaid amount
        - amountPaid: Total paid amount
        - totalAmount: Sum of all invoice amounts
        - scholarshipAmount: Total discount applied
        - originalAmount: Total before scholarships
        - newAmount: Total after scholarships
        - numberOfPayments: Number of payments in plan
        - paymentBreakdown: Formatted breakdown string
    """
    from app.models.application import Invoice
    from decimal import Decimal

    variables = {
        'remainingBalance': '$0',
        'amountPaid': '$0',
        'totalAmount': '$0',
        'scholarshipAmount': '$0',
        'originalAmount': '$0',
        'newAmount': '$0',
        'numberOfPayments': 1,
        'paymentBreakdown': 'N/A',
    }

    if not application_id:
        return variables

    # Query all invoices for this application
    invoices = db.query(Invoice).filter(
        Invoice.application_id == application_id
    ).order_by(Invoice.payment_number).all()

    if not invoices:
        return variables

    # Calculate totals
    total_amount = Decimal('0')
    paid_amount = Decimal('0')
    scholarship_amount = Decimal('0')

    payment_breakdown_parts = []

    for inv in invoices:
        amount = Decimal(str(inv.amount)) if inv.amount else Decimal('0')
        discount = Decimal(str(inv.discount_amount)) if inv.discount_amount else Decimal('0')

        total_amount += amount
        scholarship_amount += discount

        if inv.status == 'paid':
            paid_amount += amount

        # Build breakdown for payment plans
        if inv.total_payments > 1:
            status_str = "✓ Paid" if inv.status == 'paid' else "Pending"
            due_str = inv.due_date.strftime('%b %d') if inv.due_date else "TBD"
            payment_breakdown_parts.append(
                f"Payment {inv.payment_number}/{inv.total_payments}: ${amount:,.2f} ({due_str}) - {status_str}"
            )

    remaining = total_amount - paid_amount
    original_amount = total_amount + scholarship_amount  # Before scholarship
    new_amount = total_amount  # After scholarship

    # Format as currency strings
    variables['remainingBalance'] = f"${remaining:,.2f}"
    variables['amountPaid'] = f"${paid_amount:,.2f}"
    variables['totalAmount'] = f"${total_amount:,.2f}"
    variables['scholarshipAmount'] = f"${scholarship_amount:,.2f}"
    variables['originalAmount'] = f"${original_amount:,.2f}"
    variables['newAmount'] = f"${new_amount:,.2f}"
    variables['numberOfPayments'] = invoices[0].total_payments if invoices else 1

    if payment_breakdown_parts:
        variables['paymentBreakdown'] = "\n".join(payment_breakdown_parts)
    else:
        variables['paymentBreakdown'] = f"Single payment: ${total_amount:,.2f}"

    return variables

# Timezone for scheduled automations - Central Time (Chicago)
# This automatically handles CST (UTC-6) and CDT (UTC-5) transitions
SCHEDULE_TIMEZONE = ZoneInfo("America/Chicago")


def python_weekday_to_db_day(python_weekday: int) -> int:
    """
    Convert Python's weekday (Mon=0, Sun=6) to database format (Sun=0, Sat=6).

    This matches the frontend UI where Sunday is shown as day 0.
    """
    return (python_weekday + 1) % 7


def get_due_scheduled_automations(
    db: Session,
    current_day: int,
    current_hour: int,
    min_interval_hours: int = 167  # ~7 days - ensures weekly automations don't re-run
) -> List[EmailAutomation]:
    """
    Get scheduled automations that should run at the current day/hour.

    Filters:
    - trigger_type = 'scheduled'
    - is_active = True
    - schedule_day matches current_day
    - schedule_hour matches current_hour
    - last_sent_at is NULL OR last_sent_at < (now - min_interval_hours)

    Args:
        db: Database session
        current_day: Day of week (0=Sunday, 6=Saturday) in Chicago time
        current_hour: Hour of day (0-23) in Chicago time
        min_interval_hours: Minimum hours between runs (default ~7 days for weekly)

    Returns:
        List of EmailAutomation objects ready to be processed
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=min_interval_hours)

    automations = db.query(EmailAutomation).filter(
        EmailAutomation.trigger_type == 'scheduled',
        EmailAutomation.is_active == True,
        EmailAutomation.schedule_day == current_day,
        EmailAutomation.schedule_hour == current_hour,
        or_(
            EmailAutomation.last_sent_at.is_(None),
            EmailAutomation.last_sent_at < cutoff_time
        )
    ).all()

    logger.info(
        f"Found {len(automations)} due scheduled automations "
        f"for day={current_day}, hour={current_hour}"
    )

    return automations


async def process_scheduled_automation(
    db: Session,
    automation: EmailAutomation,
    camp_year: int
) -> Dict[str, Any]:
    """
    Process a single scheduled automation: find recipients and send emails.

    Args:
        db: Database session
        automation: The EmailAutomation to process
        camp_year: Current camp year for email variables

    Returns:
        Dict with results: {'sent': int, 'errors': list, 'automation_name': str}
    """
    result = {
        'automation_id': str(automation.id),
        'automation_name': automation.name,
        'sent': 0,
        'errors': []
    }

    try:
        # Get the template
        template = db.query(EmailTemplate).filter(
            EmailTemplate.key == automation.template_key,
            EmailTemplate.is_active == True
        ).first()

        if not template:
            error_msg = f"Template '{automation.template_key}' not found or inactive"
            logger.warning(f"Automation '{automation.name}': {error_msg}")
            result['errors'].append(error_msg)
            return result

        # Get recipients using the shared function from email_events
        # Pass None for context_user and context_application since scheduled
        # automations typically use audience_filter to determine recipients
        recipients = get_recipients_for_automation(db, automation, None, None)

        if not recipients:
            logger.info(f"Automation '{automation.name}': No recipients found")
            result['recipients_found'] = 0
            # Still mark as sent to prevent constant re-checking
            update_last_sent_at(db, automation.id)
            return result

        result['recipients_found'] = len(recipients)
        logger.info(f"Automation '{automation.name}': Found {len(recipients)} recipients")

        # Build base context with ALL standard variables
        base_context = email_service.get_base_variables(db)

        # Add template-specific computed variables (e.g., statistics for admin_digest)
        template_vars = get_template_specific_variables(db, automation.template_key, camp_year)
        base_context.update(template_vars)

        # Send to each recipient
        for recipient in recipients:
            try:
                # Check if user has email receiving enabled
                user_id = recipient.get('user_id')
                if user_id:
                    user = db.query(User).filter(User.id == user_id).first()
                    if user and not getattr(user, 'receive_emails', True):
                        logger.debug(f"Skipping {recipient['email']} - receive_emails disabled")
                        continue

                # Build recipient-specific variables
                recipient_vars = {
                    **base_context,
                    'firstName': recipient.get('first_name', ''),
                    'lastName': recipient.get('last_name', ''),
                    'email': recipient.get('email', ''),
                }

                # Add camper info if available from application
                if recipient.get('application_id'):
                    app_id = recipient['application_id']
                    # Get application details for more variables
                    app = db.query(Application).filter(
                        Application.id == app_id
                    ).first()
                    if app:
                        camper_first = app.camper_first_name or ''
                        camper_last = app.camper_last_name or ''
                        camper_name = f"{camper_first} {camper_last}".strip() or "your camper"
                        recipient_vars['camperFirstName'] = camper_first
                        recipient_vars['camperLastName'] = camper_last
                        recipient_vars['camperName'] = camper_name
                        recipient_vars['completionPercentage'] = app.completion_percentage or 0
                        recipient_vars['status'] = app.status or ''
                        recipient_vars['subStatus'] = app.sub_status or ''

                        # Add application-specific URL
                        recipient_vars['applicationUrl'] = f"{base_context.get('appUrl', '')}/dashboard/application/{app_id}"

                    # Add payment variables from invoices
                    payment_vars = get_application_payment_variables(db, app_id)
                    recipient_vars.update(payment_vars)
                elif recipient.get('camper_name'):
                    # Fallback if camper_name passed directly
                    recipient_vars['camperName'] = recipient['camper_name']

                # Send email using the template
                send_result = email_service.send_template_email(
                    db=db,
                    to_email=recipient['email'],
                    template_key=automation.template_key,
                    variables=recipient_vars,
                    to_name=f"{recipient.get('first_name', '')} {recipient.get('last_name', '')}".strip(),
                    user_id=user_id,
                    application_id=recipient.get('application_id'),
                )

                if send_result.get('success'):
                    result['sent'] += 1
                    logger.debug(f"Sent scheduled email to {recipient['email']}")
                else:
                    error = send_result.get('error', 'Unknown error')
                    result['errors'].append(f"{recipient['email']}: {error}")
                    logger.error(f"Failed to send to {recipient['email']}: {error}")

            except Exception as e:
                error_msg = f"{recipient.get('email', 'unknown')}: {str(e)}"
                result['errors'].append(error_msg)
                logger.error(f"Error sending scheduled email: {e}")

        # Update last_sent_at after processing
        update_last_sent_at(db, automation.id)

        logger.info(
            f"Automation '{automation.name}' completed: "
            f"sent={result['sent']}, errors={len(result['errors'])}"
        )

    except Exception as e:
        error_msg = f"Failed to process automation: {str(e)}"
        result['errors'].append(error_msg)
        logger.error(f"Error processing automation '{automation.name}': {e}")

    return result


def update_last_sent_at(db: Session, automation_id: UUID) -> None:
    """Update the last_sent_at timestamp for an automation."""
    from sqlalchemy import text

    db.execute(
        text("""
            UPDATE email_automations
            SET last_sent_at = NOW(),
                updated_at = NOW()
            WHERE id = :id
        """),
        {'id': str(automation_id)}
    )
    db.commit()


async def process_all_due_automations(
    db: Session,
    camp_year: int
) -> Dict[str, Any]:
    """
    Main entry point: process all scheduled automations that are due to run.

    Called by the cron job endpoint hourly.

    IMPORTANT: All schedule matching is done in America/Chicago timezone (CST/CDT).
    This means schedule_day=1 (Monday), schedule_hour=9 will run at 9 AM Chicago time,
    regardless of whether Chicago is in CST (UTC-6) or CDT (UTC-5).

    Args:
        db: Database session
        camp_year: Current camp year from system configuration

    Returns:
        Dict with overall results including list of processed automations
    """
    # Get current time in Chicago timezone (CST/CDT)
    now_chicago = datetime.now(SCHEDULE_TIMEZONE)
    current_hour = now_chicago.hour
    current_day = python_weekday_to_db_day(now_chicago.weekday())

    logger.info(
        f"Processing scheduled automations: "
        f"Chicago time={now_chicago.isoformat()}, day={current_day}, hour={current_hour}"
    )

    # Get all due automations
    automations = get_due_scheduled_automations(db, current_day, current_hour)

    results = {
        'timestamp': now_chicago.isoformat(),
        'timezone': 'America/Chicago',
        'chicago_day': current_day,
        'chicago_hour': current_hour,
        'automations_found': len(automations),
        'automations_processed': [],
        'total_sent': 0,
        'total_errors': 0,
    }

    # Process each automation
    for automation in automations:
        automation_result = await process_scheduled_automation(db, automation, camp_year)
        results['automations_processed'].append(automation_result)
        results['total_sent'] += automation_result['sent']
        results['total_errors'] += len(automation_result['errors'])

    logger.info(
        f"Scheduled automation processing complete: "
        f"processed={len(automations)}, sent={results['total_sent']}, "
        f"errors={results['total_errors']}"
    )

    return results


def get_config_value(db: Session, key: str, default=None):
    """Get a system configuration value."""
    config = db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
    if config:
        value = config.value
        if isinstance(value, str):
            return value.strip('"')
        return value
    return default
