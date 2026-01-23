"""
Scheduled Email Automation Service

This service processes scheduled email automations that are configured via the
super admin UI. Unlike event-based automations which fire immediately when an
event occurs, scheduled automations run at specific times (day + hour).

The cron job calls process_all_due_automations() hourly, which:
1. Determines the current UTC day/hour
2. Queries email_automations table for matching scheduled automations
3. Filters out recently-run automations (using last_sent_at)
4. Sends emails to recipients based on audience_filter
5. Updates last_sent_at to prevent duplicates

Day of Week Mapping:
    Database (matching frontend UI):
        0 = Sunday, 1 = Monday, ..., 6 = Saturday
    Python datetime.weekday():
        0 = Monday, 1 = Tuesday, ..., 6 = Sunday
    Conversion: db_day = (python_weekday + 1) % 7
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging

from app.models.super_admin import EmailAutomation, EmailTemplate, SystemConfiguration
from app.models.user import User
from app.models.application import Application
from app.services import email_service
from app.services.email_events import get_recipients_for_automation, build_email_context

logger = logging.getLogger(__name__)


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
        current_day: Day of week (0=Sunday, 6=Saturday)
        current_hour: Hour of day (0-23 in UTC)
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

        # Build base context for email variables
        base_context = {
            'campYear': camp_year,
        }

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

                # Add camper info if available
                if recipient.get('camper_name'):
                    recipient_vars['camperName'] = recipient['camper_name']
                if recipient.get('application_id'):
                    # Get application details for more variables
                    app = db.query(Application).filter(
                        Application.id == recipient['application_id']
                    ).first()
                    if app:
                        recipient_vars['camperFirstName'] = app.camper_first_name or ''
                        recipient_vars['camperLastName'] = app.camper_last_name or ''
                        recipient_vars['completionPercentage'] = app.completion_percentage or 0

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

    Args:
        db: Database session
        camp_year: Current camp year from system configuration

    Returns:
        Dict with overall results including list of processed automations
    """
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    current_day = python_weekday_to_db_day(now.weekday())

    logger.info(
        f"Processing scheduled automations: "
        f"UTC time={now.isoformat()}, day={current_day}, hour={current_hour}"
    )

    # Get all due automations
    automations = get_due_scheduled_automations(db, current_day, current_hour)

    results = {
        'timestamp': now.isoformat(),
        'utc_day': current_day,
        'utc_hour': current_hour,
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
