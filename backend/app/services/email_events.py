"""
Email Event Firing Service

This service handles firing email automation events when application
lifecycle changes occur. It checks for active automations matching
the event and queues/sends the appropriate emails.

USAGE:
    from app.services.email_events import fire_email_event

    # In your API endpoint or service:
    await fire_email_event(
        db=db,
        event='promoted_to_camper',
        application_id=app.id,
        user_id=app.user_id
    )

AVAILABLE EVENTS:
    Application Lifecycle:
        - application_created

    Applicant Stage Changes:
        - applicant_incomplete
        - applicant_complete
        - applicant_under_review
        - applicant_waitlisted

    Status Changes:
        - promoted_to_camper
        - application_deactivated
        - application_reactivated

    Camper Stage Changes:
        - camper_incomplete
        - camper_complete

    Payment Events:
        - payment_received
        - invoice_generated

    Section Events:
        - section_completed

    Admin Actions:
        - admin_note_added
        - team_approval_added
        - all_teams_approved
"""

from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.super_admin import EmailAutomation, EmailTemplate
from app.models.user import User
from app.models.application import Application
from app.services import email_service
import logging

logger = logging.getLogger(__name__)


async def fire_email_event(
    db: Session,
    event: str,
    application_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    extra_context: Optional[dict] = None
) -> int:
    """
    Fire an email event and process any matching automations.

    Args:
        db: Database session
        event: The event name (e.g., 'application_created', 'promoted_to_camper')
        application_id: Optional application ID for context
        user_id: Optional user ID for context
        extra_context: Optional additional context data

    Returns:
        Number of emails queued/sent
    """
    emails_sent = 0

    try:
        # Find active automations matching this event
        automations = db.query(EmailAutomation).filter(
            EmailAutomation.is_active == True,
            EmailAutomation.trigger_type == 'event',
            EmailAutomation.trigger_event == event
        ).all()

        if not automations:
            logger.debug(f"No active automations found for event: {event}")
            return 0

        logger.info(f"Found {len(automations)} automations for event: {event}")

        # Get application and user context
        application = None
        user = None

        if application_id:
            application = db.query(Application).filter(Application.id == application_id).first()

        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        elif application:
            user = db.query(User).filter(User.id == application.user_id).first()

        for automation in automations:
            try:
                # Get the template
                template = db.query(EmailTemplate).filter(
                    EmailTemplate.key == automation.template_key,
                    EmailTemplate.is_active == True
                ).first()

                if not template:
                    logger.warning(f"Template '{automation.template_key}' not found or inactive for automation '{automation.name}'")
                    continue

                # Determine recipients based on audience_filter
                recipients = get_recipients_for_automation(db, automation, user, application)

                if not recipients:
                    logger.debug(f"No recipients for automation '{automation.name}'")
                    continue

                # Build email context for variable substitution
                context = build_email_context(user, application, extra_context)

                # Send to each recipient using send_template_email
                # This properly handles both HTML and Markdown templates
                for recipient in recipients:
                    try:
                        # Build recipient-specific variables
                        recipient_vars = {
                            **context,
                            'firstName': recipient.get('first_name', ''),
                            'lastName': recipient.get('last_name', ''),
                            'email': recipient.get('email', ''),
                        }

                        # Add camper name from recipient if available
                        if recipient.get('camper_name'):
                            recipient_vars['camperName'] = recipient['camper_name']

                        # Use send_template_email which properly handles:
                        # - Markdown vs HTML templates (use_markdown flag)
                        # - Variable substitution in both subject and content
                        # - Branded email wrapping
                        # - Email logging
                        result = email_service.send_template_email(
                            db=db,
                            to_email=recipient['email'],
                            template_key=automation.template_key,
                            variables=recipient_vars,
                            to_name=f"{recipient.get('first_name', '')} {recipient.get('last_name', '')}".strip(),
                            user_id=recipient.get('user_id'),
                            application_id=application_id,
                        )

                        if result.get('success'):
                            emails_sent += 1
                            logger.info(f"Sent email for automation '{automation.name}' to {recipient['email']}")
                        else:
                            logger.error(f"Failed to send email: {result.get('error')}")

                    except Exception as e:
                        logger.error(f"Error sending to {recipient.get('email')}: {str(e)}")

            except Exception as e:
                logger.error(f"Error processing automation '{automation.name}': {str(e)}")

        return emails_sent

    except Exception as e:
        logger.error(f"Error firing email event '{event}': {str(e)}")
        return 0


def get_recipients_for_automation(
    db: Session,
    automation: EmailAutomation,
    context_user: Optional[User],
    context_application: Optional[Application]
) -> list:
    """
    Get recipients based on automation's audience_filter.

    Returns list of recipient dicts with: email, first_name, last_name, user_id
    """
    audience_filter = automation.audience_filter or {}

    # Empty filter = trigger context (the person who triggered the event)
    if not audience_filter or len(audience_filter) == 0:
        if context_user:
            return [{
                'email': context_user.email,
                'first_name': context_user.first_name,
                'last_name': context_user.last_name,
                'user_id': str(context_user.id)
            }]
        return []

    # Build query based on filter
    recipients = []

    # Admin audience
    if audience_filter.get('role') == 'admin':
        admins = db.query(User).filter(
            User.role.in_(['admin', 'super_admin']),
            User.email.isnot(None)
        ).all()
        for admin in admins:
            recipients.append({
                'email': admin.email,
                'first_name': admin.first_name,
                'last_name': admin.last_name,
                'user_id': str(admin.id)
            })
        return recipients

    # Application-based audiences
    query = db.query(Application, User).join(User, Application.user_id == User.id)

    if audience_filter.get('status'):
        query = query.filter(Application.status == audience_filter['status'])

    if audience_filter.get('sub_status'):
        query = query.filter(Application.sub_status == audience_filter['sub_status'])

    if 'paid_invoice' in audience_filter:
        if audience_filter['paid_invoice']:
            query = query.filter(Application.paid_invoice == True)
        else:
            query = query.filter(
                (Application.paid_invoice == False) | (Application.paid_invoice.is_(None))
            )

    results = query.all()

    for app, user in results:
        recipients.append({
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'user_id': str(user.id),
            'application_id': str(app.id),
            'camper_name': f"{app.camper_first_name or ''} {app.camper_last_name or ''}".strip()
        })

    return recipients


def build_email_context(
    user: Optional[User],
    application: Optional[Application],
    extra_context: Optional[dict]
) -> dict:
    """Build context dict for variable substitution."""
    context = extra_context or {}

    if user:
        context['firstName'] = user.first_name or ''
        context['lastName'] = user.last_name or ''
        context['email'] = user.email or ''

    if application:
        context['camperName'] = f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip()
        context['camperFirstName'] = application.camper_first_name or ''
        context['camperLastName'] = application.camper_last_name or ''
        context['applicationId'] = str(application.id)
        context['status'] = application.status or ''
        context['subStatus'] = application.sub_status or ''
        context['completionPercentage'] = application.completion_percentage or 0

    return context
