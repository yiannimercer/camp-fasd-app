"""
Email Service using Resend
Handles all email sending functionality including templating, logging, and queue processing

Documentation reference: https://resend.com/docs/send-with-python
"""

import re
import base64
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from uuid import UUID
import resend
import markdown2
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models.super_admin import EmailTemplate, SystemConfiguration

settings = get_settings()

# Initialize Resend with API key
resend.api_key = settings.RESEND_API_KEY


def get_system_config(db: Session, key: str, default: Any = None) -> Any:
    """Get a system configuration value"""
    config = db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
    if config:
        # Handle JSONB values (may be wrapped in quotes)
        value = config.value
        if isinstance(value, str):
            return value.strip('"')
        return value
    return default


def get_email_config(db: Session) -> Dict[str, Any]:
    """Get all email-related configuration"""
    return {
        'enabled': get_system_config(db, 'email_enabled', True),
        'from_email': get_system_config(db, 'email_from_address', settings.RESEND_FROM_EMAIL),
        'from_name': get_system_config(db, 'email_from_name', settings.RESEND_FROM_NAME),
        'camp_year': get_system_config(db, 'camp_year', datetime.now().year),
        'camp_fee': get_system_config(db, 'camp_fee', '1195'),
        'organization_name': get_system_config(db, 'organization_name', 'CAMP - A FASD Community'),
        'organization_website': get_system_config(db, 'organization_website', 'fasdcamp.org'),
        'production_url': get_system_config(db, 'production_url', 'app.fasdcamp.org'),
    }


def render_template(template: str, variables: Dict[str, Any]) -> str:
    """
    Render a template string with variable substitution.
    Variables use {{variable_name}} syntax.

    Args:
        template: Template string with {{variable}} placeholders
        variables: Dictionary of variable values

    Returns:
        Rendered template string
    """
    result = template
    for key, value in variables.items():
        # Handle both {{variable}} and {{ variable }} syntax
        pattern = r'\{\{\s*' + re.escape(key) + r'\s*\}\}'
        result = re.sub(pattern, str(value) if value is not None else '', result)
    return result


def markdown_to_html(markdown_text: str) -> str:
    """
    Convert markdown to HTML with inline styles for email compatibility.

    Email clients don't support external CSS or <style> blocks, so all styles
    must be inline. This function converts markdown to HTML and applies
    CAMP brand styling inline.

    Args:
        markdown_text: Raw markdown content

    Returns:
        HTML with inline styles suitable for email rendering
    """
    # CAMP brand colors
    forest_green = "#316429"
    orange = "#e26e15"
    text_color = "#333333"
    light_gray = "#f5f5f5"
    border_gray = "#e0e0e0"

    # Convert markdown to HTML using markdown2 with useful extras
    # - fenced-code-blocks: Support ```code``` syntax
    # - tables: Support markdown tables
    # - cuddled-lists: Better list handling
    # - target-blank-links: Add target="_blank" to links (safer)
    html = markdown2.markdown(
        markdown_text,
        extras=[
            'fenced-code-blocks',
            'tables',
            'cuddled-lists',
            'target-blank-links',
            'break-on-newline',
        ]
    )

    # Apply inline styles by replacing HTML tags with styled versions
    # The order matters - do more specific replacements first

    style_replacements = [
        # Headings - forest green with appropriate sizing
        (
            '<h1>',
            f'<h1 style="color: {forest_green}; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.3;">'
        ),
        (
            '<h2>',
            f'<h2 style="color: {forest_green}; font-size: 20px; font-weight: 600; margin: 24px 0 12px 0; line-height: 1.3;">'
        ),
        (
            '<h3>',
            f'<h3 style="color: {forest_green}; font-size: 18px; font-weight: 600; margin: 20px 0 10px 0; line-height: 1.3;">'
        ),
        (
            '<h4>',
            f'<h4 style="color: {text_color}; font-size: 16px; font-weight: 600; margin: 16px 0 8px 0; line-height: 1.3;">'
        ),

        # Paragraphs
        (
            '<p>',
            f'<p style="color: {text_color}; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">'
        ),

        # Links - orange accent color
        (
            '<a ',
            f'<a style="color: {orange}; text-decoration: underline;" '
        ),

        # Lists
        (
            '<ul>',
            f'<ul style="color: {text_color}; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; padding-left: 24px;">'
        ),
        (
            '<ol>',
            f'<ol style="color: {text_color}; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; padding-left: 24px;">'
        ),
        (
            '<li>',
            f'<li style="margin: 0 0 8px 0;">'
        ),

        # Blockquotes - left border with forest green
        (
            '<blockquote>',
            f'<blockquote style="border-left: 4px solid {forest_green}; margin: 16px 0; padding: 12px 20px; background-color: {light_gray}; color: {text_color}; font-style: italic;">'
        ),

        # Code blocks - monospace with background
        (
            '<pre>',
            f'<pre style="background-color: {light_gray}; border: 1px solid {border_gray}; border-radius: 4px; padding: 16px; overflow-x: auto; margin: 0 0 16px 0;">'
        ),
        (
            '<code>',
            f'<code style="font-family: \'Courier New\', Courier, monospace; font-size: 14px; background-color: {light_gray}; padding: 2px 6px; border-radius: 3px;">'
        ),

        # Tables - clean design with borders
        # Note: Email clients don't inherit CSS, so each element needs complete inline styles
        (
            '<table>',
            f'<table style="border-collapse: collapse; width: 100%; margin: 0 0 16px 0; font-size: 15px;">'
        ),
        (
            '<thead>',
            f'<thead style="background-color: {forest_green};">'
        ),
        (
            '<th>',
            f'<th style="padding: 12px 16px; text-align: left; font-weight: 600; border: 1px solid {border_gray}; background-color: {forest_green}; color: #ffffff;">'
        ),
        (
            '<td>',
            f'<td style="padding: 10px 16px; border: 1px solid {border_gray}; color: {text_color};">'
        ),
        (
            '<tr>',
            '<tr style="background-color: #ffffff;">'
        ),

        # Horizontal rule
        (
            '<hr>',
            f'<hr style="border: none; border-top: 2px solid {border_gray}; margin: 24px 0;">'
        ),
        (
            '<hr/>',
            f'<hr style="border: none; border-top: 2px solid {border_gray}; margin: 24px 0;"/>'
        ),
        (
            '<hr />',
            f'<hr style="border: none; border-top: 2px solid {border_gray}; margin: 24px 0;" />'
        ),

        # Bold and italic (usually don't need styling, but ensure color inheritance)
        (
            '<strong>',
            f'<strong style="font-weight: 700; color: inherit;">'
        ),
        (
            '<em>',
            f'<em style="font-style: italic; color: inherit;">'
        ),
    ]

    # Apply all style replacements
    for old_tag, new_tag in style_replacements:
        html = html.replace(old_tag, new_tag)

    # Handle alternating table row colors for better readability
    # Add zebra striping by finding <tr> tags in tbody (after first few)
    lines = html.split('\n')
    in_tbody = False
    row_count = 0
    styled_lines = []

    for line in lines:
        if '<tbody>' in line.lower():
            in_tbody = True
            row_count = 0
        elif '</tbody>' in line.lower():
            in_tbody = False
        elif in_tbody and '<tr' in line.lower():
            row_count += 1
            if row_count % 2 == 0:
                # Even rows get light background
                line = line.replace(
                    '<tr style="background-color: #ffffff;">',
                    f'<tr style="background-color: {light_gray};">'
                )
        styled_lines.append(line)

    html = '\n'.join(styled_lines)

    # Convert CTA button links to styled buttons (AFTER general link styling)
    # Format in markdown: [Button Text →](url "button:color")
    # After styling, links look like: <a style="..." href="url" title="button:color" ...>text</a>
    # We find these and replace with proper email-safe button HTML

    def replace_button_link(match):
        """Replace a button-style link with a properly styled CTA button."""
        href = match.group('href')
        color = match.group('color')
        text = match.group('text')

        # Choose button color based on the color parameter
        if color == 'green':
            bg_color = forest_green
        else:
            bg_color = orange  # Default to orange

        # Create email-safe button styling (uses table for maximum compatibility)
        # This is the bulletproof method that works in Gmail, Outlook, Apple Mail, etc.
        button_html = f'''<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 16px 0;">
  <tr>
    <td align="center" bgcolor="{bg_color}" style="border-radius: 6px;">
      <a href="{href}" target="_blank" style="display: inline-block; background-color: {bg_color}; color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 1.4; padding: 14px 28px; text-align: center; text-decoration: none; border-radius: 6px; -webkit-text-size-adjust: none; mso-hide: all;">{text}</a>
    </td>
  </tr>
</table>'''
        return button_html

    # Match links with button title attribute (flexible pattern to handle various attribute orders)
    # The style attribute is added by our earlier processing, so we need to account for it
    button_pattern = r'<a\s+[^>]*href="(?P<href>[^"]+)"[^>]*title="button:(?P<color>orange|green)"[^>]*>(?P<text>[^<]+)</a>'
    html = re.sub(button_pattern, replace_button_link, html)

    return html


def get_template_by_key(db: Session, key: str) -> Optional[EmailTemplate]:
    """Get an email template by its key"""
    return db.query(EmailTemplate).filter(
        EmailTemplate.key == key,
        EmailTemplate.is_active == True
    ).first()


def get_template_by_trigger(db: Session, trigger_event: str) -> Optional[EmailTemplate]:
    """Get an email template by its trigger event"""
    return db.query(EmailTemplate).filter(
        EmailTemplate.trigger_event == trigger_event,
        EmailTemplate.is_active == True
    ).first()


def get_base_variables(db: Session) -> Dict[str, Any]:
    """Get base variables available for all templates"""
    config = get_email_config(db)

    # Format tuition amount with currency formatting
    try:
        fee_raw = str(config['camp_fee']).replace(',', '').replace('$', '')
        fee_amount = float(fee_raw)
        tuition_formatted = f"${fee_amount:,.0f}"  # e.g., "$1,195"
    except (ValueError, TypeError):
        tuition_formatted = "$1,195"  # Fallback

    # Use FRONTEND_URL from environment (differs per environment: local/dev/prod)
    website_url = f"https://{config['organization_website']}"
    return {
        'campYear': config['camp_year'],
        'tuitionAmount': tuition_formatted,
        'organizationName': config['organization_name'],
        'websiteUrl': website_url,
        'appUrl': settings.FRONTEND_URL,  # Dynamic based on environment
        'paymentUrl': f"{settings.FRONTEND_URL}/dashboard",  # Payment link for families
        'parentInfoPacketUrl': f"{website_url}/parent-info",  # Parent information packet
        'currentYear': datetime.now().year,
    }


def get_branded_email_wrapper(db: Session, content: str, subject: str = "") -> str:
    """
    Wrap content in the branded CAMP email template.
    This ensures all emails have consistent branding with logo, colors, and signature.

    Args:
        db: Database session
        content: The main email content (HTML)
        subject: Optional subject to include in template

    Returns:
        Full branded HTML email
    """
    config = get_email_config(db)
    camp_year = config['camp_year']
    org_name = config['organization_name']
    website = config['organization_website']
    current_year = datetime.now().year

    # CAMP brand colors
    forest_green = "#316429"
    orange = "#e26e15"

    # Logo URL - served from Next.js public folder (no /images/ subfolder)
    logo_url = f"https://{config['production_url']}/camp-logo.png"

    branded_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 20px 0;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" align="center" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header with Logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, {forest_green} 0%, #3d7a32 100%); padding: 30px 40px; text-align: center;">
                            <img src="{logo_url}" alt="CAMP - A FASD Community" width="140" height="auto" style="width: 140px; max-width: 140px; height: auto;" />
                            <p style="color: #ffffff; font-size: 14px; margin: 10px 0 0 0; opacity: 0.9;">Camp Year {camp_year}</p>
                        </td>
                    </tr>

                    <!-- Orange Accent Bar -->
                    <tr>
                        <td style="background-color: {orange}; height: 4px;"></td>
                    </tr>

                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px;">
                            {content}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f8f8; padding: 30px 40px; border-top: 1px solid #eeeeee;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="text-align: center;">
                                        <p style="color: {forest_green}; font-weight: bold; font-size: 16px; margin: 0 0 10px 0;">{org_name}</p>
                                        <p style="color: #666666; font-size: 13px; margin: 0 0 5px 0;">PO Box 663, Tinley Park, IL 60477</p>
                                        <p style="color: #666666; font-size: 13px; margin: 0 0 15px 0;">
                                            <a href="https://{website}" style="color: {orange}; text-decoration: none;">{website}</a>
                                            &nbsp;|&nbsp;
                                            <a href="https://instagram.com/fasdcamp" style="color: {orange}; text-decoration: none;">@fasdcamp</a>
                                        </p>
                                        <p style="color: #999999; font-size: 11px; margin: 15px 0 0 0;">
                                            &copy; {current_year} {org_name}. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>'''

    return branded_html


def wrap_content_in_brand(db: Session, content: str, greeting: str = "", closing: str = "") -> str:
    """
    Wrap simple content with greeting and closing in branded style.

    Args:
        db: Database session
        content: The main message content
        greeting: e.g., "Dear John," (optional)
        closing: e.g., "Best regards," (optional)

    Returns:
        HTML content block (to be wrapped in full branded template)
    """
    config = get_email_config(db)
    forest_green = "#316429"

    parts = []

    if greeting:
        parts.append(f'<p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">{greeting}</p>')

    # Main content - preserve line breaks
    content_html = content.replace('\n', '<br/>')
    parts.append(f'<div style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">{content_html}</div>')

    if closing:
        parts.append(f'''
            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0 5px 0;">{closing}</p>
            <p style="color: {forest_green}; font-weight: bold; font-size: 16px; margin: 0;">{config["organization_name"]}</p>
        ''')
    else:
        parts.append(f'''
            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0 5px 0;">Best regards,</p>
            <p style="color: {forest_green}; font-weight: bold; font-size: 16px; margin: 0;">{config["organization_name"]}</p>
        ''')

    return '\n'.join(parts)


def send_email(
    db: Session,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    to_name: Optional[str] = None,
    user_id: Optional[UUID] = None,
    application_id: Optional[UUID] = None,
    template_key: Optional[str] = None,
    email_type: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send an email using Resend and log it to the database.

    Args:
        db: Database session
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML email content
        text_content: Plain text email content (optional)
        to_name: Recipient name (optional)
        user_id: Associated user ID (optional)
        application_id: Associated application ID (optional)
        template_key: Template key used (optional)
        email_type: Type of email (e.g., 'welcome', 'reminder', 'mass') (optional)
        reply_to: Reply-to email address (optional)

    Returns:
        dict with success status and resend_id
    """
    config = get_email_config(db)

    # Check if email is enabled
    if not config['enabled']:
        return {
            'success': False,
            'error': 'Email sending is disabled',
            'resend_id': None
        }

    # Check if API key is configured
    if not settings.RESEND_API_KEY:
        return {
            'success': False,
            'error': 'Resend API key not configured',
            'resend_id': None
        }

    # Build from address
    from_email = f"{config['from_name']} <{config['from_email']}>"

    try:
        # Send via Resend
        params = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }

        if text_content:
            params["text"] = text_content

        if reply_to:
            params["reply_to"] = reply_to

        result = resend.Emails.send(params)

        resend_id = result.get('id') if result else None

        # Log the email
        log_email(
            db=db,
            recipient_email=to_email,
            recipient_name=to_name,
            subject=subject,
            html_content=html_content,
            template_used=template_key,
            email_type=email_type,
            user_id=user_id,
            application_id=application_id,
            resend_id=resend_id,
            status='sent'
        )

        return {
            'success': True,
            'resend_id': resend_id,
            'error': None
        }

    except Exception as e:
        error_message = str(e)

        # Log the failed attempt
        log_email(
            db=db,
            recipient_email=to_email,
            recipient_name=to_name,
            subject=subject,
            html_content=html_content,
            template_used=template_key,
            email_type=email_type,
            user_id=user_id,
            application_id=application_id,
            status='failed',
            error_message=error_message
        )

        return {
            'success': False,
            'resend_id': None,
            'error': error_message
        }


def send_template_email(
    db: Session,
    to_email: str,
    template_key: str,
    variables: Optional[Dict[str, Any]] = None,
    to_name: Optional[str] = None,
    user_id: Optional[UUID] = None,
    application_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """
    Send an email using a template from the database.

    Supports both HTML and Markdown templates. If template.use_markdown is True,
    the markdown_content will be converted to HTML with CAMP branding.

    Flow for Markdown templates:
    1. render_template() - substitute {{variables}} in markdown
    2. markdown_to_html() - convert to styled HTML
    3. wrap_content_in_brand() - add greeting/closing
    4. get_branded_email_wrapper() - wrap in full branded template

    Args:
        db: Database session
        to_email: Recipient email address
        template_key: Key of the template to use
        variables: Variables to substitute in the template
        to_name: Recipient name (optional)
        user_id: Associated user ID (optional)
        application_id: Associated application ID (optional)

    Returns:
        dict with success status and resend_id
    """
    # Get template
    template = get_template_by_key(db, template_key)
    if not template:
        return {
            'success': False,
            'error': f'Template "{template_key}" not found or inactive',
            'resend_id': None
        }

    # Merge base variables with provided variables
    all_variables = get_base_variables(db)
    if variables:
        all_variables.update(variables)

    # Add recipient name to variables
    if to_name:
        all_variables['recipientName'] = to_name
        # Also add firstName if not present
        if 'firstName' not in all_variables:
            all_variables['firstName'] = to_name.split()[0] if to_name else ''

    # Render subject (always the same process)
    subject = render_template(template.subject, all_variables)

    # Check if we should use markdown content
    use_markdown = getattr(template, 'use_markdown', False) and getattr(template, 'markdown_content', None)

    if use_markdown:
        # Markdown flow:
        # 1. Substitute variables in markdown content
        rendered_markdown = render_template(template.markdown_content, all_variables)

        # 2. Convert markdown to styled HTML
        styled_html = markdown_to_html(rendered_markdown)

        # 3. Wrap in branded email template (logo, header, footer)
        html_content = get_branded_email_wrapper(db, styled_html, subject)
    else:
        # HTML flow (existing behavior):
        # Just render the HTML content with variables
        html_content = render_template(template.html_content, all_variables)

    # Handle text content
    text_content = render_template(template.text_content, all_variables) if template.text_content else None

    return send_email(
        db=db,
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        to_name=to_name,
        user_id=user_id,
        application_id=application_id,
        template_key=template_key,
        email_type=template.trigger_event
    )


def log_email(
    db: Session,
    recipient_email: str,
    subject: str,
    status: str = 'sent',
    recipient_name: Optional[str] = None,
    html_content: Optional[str] = None,
    template_used: Optional[str] = None,
    email_type: Optional[str] = None,
    user_id: Optional[UUID] = None,
    application_id: Optional[UUID] = None,
    resend_id: Optional[str] = None,
    error_message: Optional[str] = None,
    variables: Optional[Dict[str, Any]] = None,
) -> None:
    """Log an email to the email_logs table"""
    from sqlalchemy import text

    db.execute(
        text("""
            INSERT INTO email_logs (
                recipient_email, recipient_name, subject, html_content,
                template_used, email_type, user_id, application_id,
                resend_id, status, error_message, variables, sent_at
            ) VALUES (
                :recipient_email, :recipient_name, :subject, :html_content,
                :template_used, :email_type, :user_id, :application_id,
                :resend_id, :status, :error_message, :variables, NOW()
            )
        """),
        {
            'recipient_email': recipient_email,
            'recipient_name': recipient_name,
            'subject': subject,
            'html_content': html_content,
            'template_used': template_used,
            'email_type': email_type,
            'user_id': str(user_id) if user_id else None,
            'application_id': str(application_id) if application_id else None,
            'resend_id': resend_id,
            'status': status,
            'error_message': error_message,
            'variables': None,  # Could add JSON serialization if needed
        }
    )
    db.commit()


def queue_email(
    db: Session,
    recipient_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    recipient_name: Optional[str] = None,
    user_id: Optional[UUID] = None,
    application_id: Optional[UUID] = None,
    template_key: Optional[str] = None,
    variables: Optional[Dict[str, Any]] = None,
    priority: int = 0,
    scheduled_for: Optional[datetime] = None,
) -> UUID:
    """
    Add an email to the queue for async processing.

    Args:
        db: Database session
        recipient_email: Recipient email address
        subject: Email subject
        html_content: HTML email content
        text_content: Plain text email content (optional)
        recipient_name: Recipient name (optional)
        user_id: Associated user ID (optional)
        application_id: Associated application ID (optional)
        template_key: Template key used (optional)
        variables: Template variables (optional)
        priority: Higher priority emails are processed first (default 0)
        scheduled_for: When to send the email (default now)

    Returns:
        UUID of the queued email
    """
    from sqlalchemy import text
    import json

    result = db.execute(
        text("""
            INSERT INTO email_queue (
                recipient_email, recipient_name, user_id, application_id,
                template_key, subject, html_content, text_content,
                variables, priority, status, scheduled_for
            ) VALUES (
                :recipient_email, :recipient_name, :user_id, :application_id,
                :template_key, :subject, :html_content, :text_content,
                :variables, :priority, 'pending', :scheduled_for
            )
            RETURNING id
        """),
        {
            'recipient_email': recipient_email,
            'recipient_name': recipient_name,
            'user_id': str(user_id) if user_id else None,
            'application_id': str(application_id) if application_id else None,
            'template_key': template_key,
            'subject': subject,
            'html_content': html_content,
            'text_content': text_content,
            'variables': json.dumps(variables) if variables else None,
            'priority': priority,
            'scheduled_for': scheduled_for or datetime.now(timezone.utc),
        }
    )
    db.commit()

    row = result.fetchone()
    return row[0] if row else None


def process_email_queue(db: Session, batch_size: int = 10) -> Dict[str, Any]:
    """
    Process pending emails in the queue.

    Args:
        db: Database session
        batch_size: Maximum number of emails to process in one batch

    Returns:
        dict with processing results
    """
    from sqlalchemy import text

    # Get pending emails that are ready to send
    result = db.execute(
        text("""
            SELECT id, recipient_email, recipient_name, user_id, application_id,
                   template_key, subject, html_content, text_content, attempts, max_attempts
            FROM email_queue
            WHERE status = 'pending'
              AND (scheduled_for IS NULL OR scheduled_for <= NOW())
              AND attempts < max_attempts
            ORDER BY priority DESC, created_at ASC
            LIMIT :batch_size
            FOR UPDATE SKIP LOCKED
        """),
        {'batch_size': batch_size}
    )

    emails = result.fetchall()

    processed = 0
    succeeded = 0
    failed = 0

    for email in emails:
        email_id, recipient_email, recipient_name, user_id, application_id, \
            template_key, subject, html_content, text_content, attempts, max_attempts = email

        # Mark as processing
        db.execute(
            text("""
                UPDATE email_queue
                SET status = 'processing',
                    attempts = attempts + 1,
                    last_attempt_at = NOW()
                WHERE id = :id
            """),
            {'id': email_id}
        )
        db.commit()

        # Send the email
        send_result = send_email(
            db=db,
            to_email=recipient_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            to_name=recipient_name,
            user_id=user_id,
            application_id=application_id,
            template_key=template_key,
            email_type='queued'
        )

        if send_result['success']:
            # Mark as completed
            db.execute(
                text("""
                    UPDATE email_queue
                    SET status = 'completed',
                        resend_id = :resend_id,
                        processed_at = NOW()
                    WHERE id = :id
                """),
                {'id': email_id, 'resend_id': send_result.get('resend_id')}
            )
            succeeded += 1
        else:
            # Check if max attempts reached (use actual max_attempts from database)
            new_status = 'failed' if attempts + 1 >= max_attempts else 'pending'
            db.execute(
                text("""
                    UPDATE email_queue
                    SET status = :status,
                        error_message = :error
                    WHERE id = :id
                """),
                {'id': email_id, 'status': new_status, 'error': send_result.get('error')}
            )
            if new_status == 'failed':
                failed += 1

        db.commit()
        processed += 1

    return {
        'processed': processed,
        'succeeded': succeeded,
        'failed': failed
    }


def get_queue_stats(db: Session) -> Dict[str, int]:
    """Get current email queue statistics"""
    from sqlalchemy import text

    result = db.execute(
        text("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'processing') as processing,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM email_queue
        """)
    )

    row = result.fetchone()
    return {
        'pending': row[0] or 0,
        'processing': row[1] or 0,
        'completed': row[2] or 0,
        'failed': row[3] or 0
    }
