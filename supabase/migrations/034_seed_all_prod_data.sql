-- Migration: Seed ALL Production Data
-- Purpose: Ensure PROD has all necessary seed data (system config, templates, teams, automations)
-- This migration is IDEMPOTENT - safe to run multiple times using ON CONFLICT
-- Date: 2026-01-10

-- ============================================================================
-- 1. SYSTEM CONFIGURATION - Core Settings
-- ============================================================================
INSERT INTO system_configuration (key, value, description, data_type, category, is_public) VALUES
-- Camp Settings
('camp_fee', '500.00', 'Application fee charged upon acceptance (USD)', 'number', 'camp', false),
('camp_year', '2025', 'Current camp season year', 'number', 'camp', false),
('application_season_start', '"2025-01-01"', 'Date when applications open', 'date', 'camp', false),
('application_season_end', '"2025-06-30"', 'Date when applications close', 'date', 'camp', false),
('camp_start_date', '"2025-07-15"', 'Camp start date', 'date', 'camp', false),
('camp_end_date', '"2025-07-22"', 'Camp end date', 'date', 'camp', false),
('max_campers', '50', 'Maximum number of campers accepted per season', 'number', 'camp', false),

-- Workflow Settings
('auto_submit_enabled', 'true', 'Automatically submit applications when 100% complete', 'boolean', 'workflow', false),
('approval_required_count', '3', 'Number of approvals needed to enable Accept button', 'number', 'workflow', false),
('allow_family_edits_under_review', 'true', 'Allow families to edit applications in under_review status', 'boolean', 'workflow', false),

-- File Upload Settings
('max_file_size_mb', '10', 'Maximum file size in megabytes', 'number', 'files', false),
('allowed_file_types', '[".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png"]', 'Allowed file extensions', 'json', 'files', false),

-- Email Settings
('email_enabled', 'true', 'Enable email notifications', 'boolean', 'email', false),
('email_from_name', '"CAMP FASD"', 'Email sender name', 'string', 'email', false),
('email_from_address', '"noreply@fasdcamp.org"', 'Email sender address', 'string', 'email', false),

-- Contact Information
('contact_email', '"info@fasdcamp.org"', 'Public contact email', 'string', 'contact', false),
('contact_phone', '"(555) 123-4567"', 'Public contact phone', 'string', 'contact', false),
('contact_address_street', '"123 Camp Road"', 'Contact address street', 'string', 'contact', false),
('contact_address_city', '"Portland"', 'Contact address city', 'string', 'contact', false),
('contact_address_state', '"OR"', 'Contact address state', 'string', 'contact', false),
('contact_address_zip', '"97201"', 'Contact address zip', 'string', 'contact', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. STATUS COLORS CONFIGURATION
-- ============================================================================
INSERT INTO system_configuration (key, value, description, data_type, category, is_public)
VALUES (
    'status_colors',
    '{
        "applicant_not_started": {"bg": "#F3F4F6", "text": "#1F2937", "label": "Not Started"},
        "applicant_incomplete": {"bg": "#DBEAFE", "text": "#1E40AF", "label": "Incomplete"},
        "applicant_complete": {"bg": "#E0E7FF", "text": "#3730A3", "label": "Complete"},
        "applicant_under_review": {"bg": "#FEF3C7", "text": "#92400E", "label": "Under Review"},
        "applicant_waitlist": {"bg": "#FFEDD5", "text": "#9A3412", "label": "Waitlist"},
        "camper_incomplete": {"bg": "#CFFAFE", "text": "#0E7490", "label": "Incomplete"},
        "camper_complete": {"bg": "#D1FAE5", "text": "#065F46", "label": "Complete"},
        "inactive_withdrawn": {"bg": "#FFEDD5", "text": "#C2410C", "label": "Withdrawn"},
        "inactive_deferred": {"bg": "#FEF3C7", "text": "#B45309", "label": "Deferred"},
        "inactive_inactive": {"bg": "#F3F4F6", "text": "#4B5563", "label": "Deactivated"},
        "category_applicant": {"bg": "#EFF6FF", "text": "#1D4ED8", "label": "Applicant"},
        "category_camper": {"bg": "#F3E8FF", "text": "#7C3AED", "label": "Camper"},
        "category_inactive": {"bg": "#F3F4F6", "text": "#4B5563", "label": "Inactive"}
    }'::jsonb,
    'Customizable colors for application statuses and stages',
    'json',
    'appearance',
    true
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

-- ============================================================================
-- 3. ALLOW NEW APPLICATIONS CONFIG
-- ============================================================================
INSERT INTO system_configuration (key, value, description, data_type, category, is_public)
VALUES (
  'allow_new_applications',
  'true',
  'Control whether new applications can be created',
  'boolean',
  'application',
  true
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. TEAMS
-- ============================================================================
INSERT INTO teams (key, name, description, color, order_index) VALUES
('ops', 'Operations', 'Operational review and logistics', '#3B82F6', 1),
('med', 'Medical', 'Medical review and health assessment', '#10B981', 2),
('behavioral', 'Behavioral', 'Behavioral and psychological review', '#8B5CF6', 3),
('lit', 'Literacy', 'Educational and literacy assessment', '#F59E0B', 4)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 5. EMAIL TEMPLATES - Core Templates
-- ============================================================================

-- Welcome New User
INSERT INTO email_templates (key, name, subject, html_content, text_content, variables) VALUES
(
    'welcome_new_user',
    'Welcome New User',
    'Welcome to CAMP FASD, {user_name}!',
    '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #316429; color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #e26e15; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to CAMP FASD!</h1>
        </div>
        <div class="content">
            <p>Dear {user_name},</p>
            <p>Thank you for creating an account with CAMP FASD! We''re excited to help you through the application process.</p>

            <h3>What to Expect:</h3>
            <ul>
                <li><strong>17 Application Sections</strong> - Complete information about your camper</li>
                <li><strong>Document Uploads</strong> - Medical forms, IEP/504 plans, and authorizations</li>
                <li><strong>Auto-Save</strong> - Your progress is saved automatically</li>
                <li><strong>Review Process</strong> - Our team reviews applications within 2-3 weeks</li>
            </ul>

            <p style="text-align: center;">
                <a href="{dashboard_url}" class="button">Start Your Application</a>
            </p>

            <h3>Need Help?</h3>
            <p>If you have any questions, please contact us:</p>
            <ul>
                <li>Email: info@fasdcamp.org</li>
                <li>Phone: (555) 123-4567</li>
            </ul>

            <p>We look forward to welcoming your camper to CAMP FASD {camp_year}!</p>
            <p><strong>The CAMP FASD Team</strong></p>
        </div>
        <div class="footer">
            <p>This email was sent from CAMP FASD Application Portal</p>
        </div>
    </div>
</body>
</html>',
    'Dear {user_name},

Thank you for creating an account with CAMP FASD! We''re excited to help you through the application process.

What to Expect:
- 17 Application Sections - Complete information about your camper
- Document Uploads - Medical forms, IEP/504 plans, and authorizations
- Auto-Save - Your progress is saved automatically
- Review Process - Our team reviews applications within 2-3 weeks

Get started: {dashboard_url}

Need Help?
Email: info@fasdcamp.org
Phone: (555) 123-4567

We look forward to welcoming your camper to CAMP FASD {camp_year}!

The CAMP FASD Team',
    '["user_name", "dashboard_url", "camp_year"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Application Submitted
INSERT INTO email_templates (key, name, subject, html_content, text_content, variables) VALUES
(
    'application_submitted',
    'Application Submitted',
    'Your CAMP FASD Application Has Been Submitted',
    '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #316429; color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Application Submitted!</h1>
        </div>
        <div class="content">
            <p>Dear {family_name},</p>
            <p>Thank you for completing the application for <strong>{camper_name}</strong>.</p>
            <p>Our team will review your application and you can expect to hear from us within 2-3 weeks.</p>
            <p>Application ID: {application_id}<br>Submitted: {submission_date}</p>
            <p><strong>The CAMP FASD Team</strong></p>
        </div>
    </div>
</body>
</html>',
    'Dear {family_name},

Thank you for completing the application for {camper_name}.

Our team will review your application and you can expect to hear from us within 2-3 weeks.

Application ID: {application_id}
Submitted: {submission_date}

The CAMP FASD Team',
    '["family_name", "camper_name", "application_id", "submission_date"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Application Accepted
INSERT INTO email_templates (key, name, subject, html_content, text_content, variables) VALUES
(
    'application_accepted',
    'Application Accepted',
    '🎉 Congratulations! You''ve Been Accepted to CAMP FASD',
    '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #316429; color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #e26e15; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Congratulations!</h1>
        </div>
        <div class="content">
            <h2>Your application has been accepted!</h2>
            <p>Dear {family_name},</p>
            <p>We''re excited to welcome <strong>{camper_name}</strong> to CAMP FASD {camp_year}!</p>
            <p>We need a few more details to complete your registration. Please log in to complete:</p>
            <ul>
                <li>Travel arrangements</li>
                <li>T-shirt size and dietary information</li>
                <li>Emergency contact details</li>
            </ul>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{dashboard_url}" class="button">Complete Registration</a>
            </p>
            <p>Payment of ${payment_amount} will be required to reserve your spot.</p>
            <p><strong>The CAMP FASD Team</strong></p>
        </div>
    </div>
</body>
</html>',
    'Congratulations!

Dear {family_name},

We''re excited to welcome {camper_name} to CAMP FASD {camp_year}!

Complete your registration: {dashboard_url}

Payment of ${payment_amount} will be required to reserve your spot.

The CAMP FASD Team',
    '["family_name", "camper_name", "camp_year", "dashboard_url", "payment_amount"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 6. EMAIL TEMPLATES - Billing Templates
-- ============================================================================

-- Payment Received
INSERT INTO email_templates (key, name, subject, html_content, trigger_event, is_active, created_at, updated_at)
VALUES (
  'payment_received',
  'Payment Received Confirmation',
  'Payment Received - CAMP {{campYear}} Registration',
  '<h2>Thank You for Your Payment!</h2>
<p>Dear {{firstName}},</p>
<p>We have successfully received your payment for <strong>{{camperName}}</strong>''s CAMP {{campYear}} registration.</p>

<div style="background-color: #f0f9f0; border: 1px solid #316429; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="color: #316429; margin-top: 0;">Payment Details</h3>
  <p style="margin: 8px 0;"><strong>Amount Paid:</strong> ${{amountPaid}}</p>
  <p style="margin: 8px 0;"><strong>Remaining Balance:</strong> ${{remainingBalance}}</p>
</div>

<p>If you have any questions about your balance or payment, please don''t hesitate to contact us.</p>

<p>Thank you for being part of the CAMP FASD family!</p>

<p>Warm regards,<br>
The CAMP FASD Team</p>',
  'payment_received',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Scholarship Awarded
INSERT INTO email_templates (key, name, subject, html_content, trigger_event, is_active, created_at, updated_at)
VALUES (
  'scholarship_awarded',
  'Scholarship Awarded',
  'Great News! Scholarship Awarded for {{camperName}} - CAMP {{campYear}}',
  '<h2>Scholarship Awarded!</h2>
<p>Dear {{firstName}},</p>
<p>We are pleased to inform you that a scholarship has been applied to <strong>{{camperName}}</strong>''s CAMP {{campYear}} registration!</p>

<div style="background-color: #fff8e6; border: 1px solid #e26e15; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="color: #e26e15; margin-top: 0;">Scholarship Details</h3>
  <p style="margin: 8px 0;"><strong>Scholarship Amount:</strong> ${{scholarshipAmount}}</p>
  <p style="margin: 8px 0;"><strong>Original Tuition:</strong> ${{originalAmount}}</p>
  <p style="margin: 8px 0; font-size: 1.2em;"><strong>Your New Balance:</strong> <span style="color: #316429;">${{newAmount}}</span></p>
</div>

<p>Please complete your remaining payment at your earliest convenience. You can pay online through your application dashboard.</p>

<p>If you have any questions, please don''t hesitate to reach out.</p>

<p>Warm regards,<br>
The CAMP FASD Team</p>',
  'scholarship_awarded',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Admin Payment Received
INSERT INTO email_templates (key, name, subject, html_content, trigger_event, is_active, created_at, updated_at)
VALUES (
  'admin_payment_received',
  'Admin: Payment Received Notification',
  'Payment Received: {{camperName}} paid ${{amountPaid}}',
  '<h2>Payment Received</h2>
<p>A payment has been received for a CAMP {{campYear}} registration.</p>

<div style="background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="margin-top: 0;">Payment Details</h3>
  <p style="margin: 8px 0;"><strong>Camper:</strong> {{camperName}}</p>
  <p style="margin: 8px 0;"><strong>Amount Paid:</strong> ${{amountPaid}}</p>
  <p style="margin: 8px 0;"><strong>Remaining Balance:</strong> ${{remainingBalance}}</p>
</div>

<p style="text-align: center; margin: 24px 0;">
  <a href="{{appUrl}}{{applicationUrl}}" style="background-color: #316429; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px;">View Application</a>
</p>

<p style="color: #666; font-size: 0.9em;">This is an automated notification from the CAMP FASD application system.</p>',
  'admin_payment_received',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Payment Plan Created
INSERT INTO email_templates (key, name, subject, html_content, trigger_event, is_active, created_at, updated_at)
VALUES (
  'payment_plan_created',
  'Payment Plan Created',
  'Payment Plan Created for {{camperName}} - CAMP {{campYear}}',
  '<h2>Your Payment Plan is Ready!</h2>
<p>Dear {{firstName}},</p>
<p>A payment plan has been created for <strong>{{camperName}}</strong>''s CAMP {{campYear}} registration to help make payments more manageable.</p>

<div style="background-color: #f3e8ff; border: 1px solid #9333ea; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="color: #9333ea; margin-top: 0;">Payment Plan Details</h3>
  <p style="margin: 8px 0;"><strong>Total Amount:</strong> ${{totalAmount}}</p>
  <p style="margin: 8px 0;"><strong>Number of Payments:</strong> {{numberOfPayments}}</p>
  <p style="margin: 8px 0;"><strong>Payment Breakdown:</strong></p>
  <div style="background-color: white; padding: 12px; border-radius: 4px; margin-top: 8px;">
    {{paymentBreakdown}}
  </div>
</div>

<p>You can view your payment schedule and make payments through your application dashboard.</p>

<p style="text-align: center; margin: 24px 0;">
  <a href="{{appUrl}}/dashboard" style="display: inline-block; background-color: #316429; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">View Payment Plan</a>
</p>

<p>If you have any questions about your payment plan, please don''t hesitate to reach out.</p>

<p>Warm regards,<br>
The CAMP FASD Team</p>',
  'payment_plan_created',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 7. EMAIL AUTOMATIONS
-- ============================================================================

-- Generate automations from existing templates with trigger_events
INSERT INTO email_automations (name, description, template_key, trigger_type, trigger_event, audience_filter, is_active)
SELECT
    et.name || ' Automation',
    'Auto-generated from template trigger',
    et.key,
    CASE
        WHEN et.trigger_event IN ('admin_digest', 'payment_reminder', 'incomplete_reminder') THEN 'scheduled'
        ELSE 'event'
    END,
    et.trigger_event,
    CASE
        WHEN et.trigger_event = 'payment_reminder' THEN '{"status": "camper", "paid_invoice": false}'::jsonb
        WHEN et.trigger_event = 'incomplete_reminder' THEN '{"status": "applicant", "sub_status": "incomplete"}'::jsonb
        WHEN et.trigger_event = 'admin_digest' THEN '{"role": "admin"}'::jsonb
        ELSE '{}'::jsonb
    END,
    et.is_active
FROM email_templates et
WHERE et.trigger_event IS NOT NULL AND et.trigger_event != ''
ON CONFLICT DO NOTHING;

-- Specific billing automations (in case templates above didn't have trigger_event set yet)
INSERT INTO email_automations (template_key, name, trigger_event, trigger_type, audience_filter, is_active, created_at, updated_at)
VALUES
(
  'payment_received',
  'Send payment confirmation to family',
  'payment_received',
  'event',
  '{}',
  true,
  NOW(),
  NOW()
),
(
  'scholarship_awarded',
  'Send scholarship notification to family',
  'scholarship_awarded',
  'event',
  '{}',
  true,
  NOW(),
  NOW()
),
(
  'admin_payment_received',
  'Notify admins of payment received',
  'admin_payment_received',
  'event',
  '{"role": "admin"}',
  true,
  NOW(),
  NOW()
),
(
  'payment_plan_created',
  'Send payment plan notification to family',
  'payment_plan_created',
  'event',
  '{}',
  true,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Set default schedules for scheduled automations
UPDATE email_automations
SET schedule_day = 1, schedule_hour = 9 -- Monday 9 AM
WHERE trigger_type = 'scheduled' AND schedule_day IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES (run these after to confirm data exists)
-- ============================================================================
-- SELECT COUNT(*) as config_count FROM system_configuration;
-- SELECT COUNT(*) as teams_count FROM teams;
-- SELECT COUNT(*) as templates_count FROM email_templates;
-- SELECT COUNT(*) as automations_count FROM email_automations;
-- SELECT key FROM system_configuration ORDER BY key;
-- SELECT key FROM email_templates ORDER BY key;
-- SELECT key, name FROM teams ORDER BY order_index;
