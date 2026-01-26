-- Migration: Seed default scheduled automations with proper schedule settings
--
-- The previous migration (034) created automations with trigger_type='scheduled'
-- but didn't set schedule_day and schedule_hour. This migration:
-- 1. Updates existing scheduled automations with the default Monday 9AM UTC schedule
-- 2. Creates the automations if they don't exist (for fresh installs)
--
-- Schedule defaults (matching the original hardcoded cron schedule):
-- - Day: 1 (Monday, where 0=Sunday, 6=Saturday)
-- - Hour: 9 (9 AM UTC)

-- ============================================================================
-- 1. UPDATE EXISTING SCHEDULED AUTOMATIONS
-- ============================================================================

-- Update admin_digest automation
UPDATE email_automations
SET schedule_day = 1,
    schedule_hour = 9,
    updated_at = NOW()
WHERE trigger_type = 'scheduled'
  AND trigger_event = 'admin_digest'
  AND (schedule_day IS NULL OR schedule_hour IS NULL);

-- Update payment_reminder automation
UPDATE email_automations
SET schedule_day = 1,
    schedule_hour = 9,
    updated_at = NOW()
WHERE trigger_type = 'scheduled'
  AND trigger_event = 'payment_reminder'
  AND (schedule_day IS NULL OR schedule_hour IS NULL);

-- Update incomplete_reminder automation
UPDATE email_automations
SET schedule_day = 1,
    schedule_hour = 9,
    updated_at = NOW()
WHERE trigger_type = 'scheduled'
  AND trigger_event = 'incomplete_reminder'
  AND (schedule_day IS NULL OR schedule_hour IS NULL);

-- ============================================================================
-- 2. CREATE SCHEDULED AUTOMATIONS IF THEY DON'T EXIST
-- ============================================================================

-- Admin Digest - Weekly digest sent to admins with application statistics
INSERT INTO email_automations (
    name,
    description,
    template_key,
    trigger_type,
    trigger_event,
    schedule_day,
    schedule_hour,
    audience_filter,
    is_active,
    created_at,
    updated_at
)
SELECT
    'Admin Weekly Digest',
    'Send weekly statistics and status summary to all admins. Runs every Monday at 9 AM UTC.',
    'admin_digest',
    'scheduled',
    'admin_digest',
    1,  -- Monday
    9,  -- 9 AM UTC
    '{"role": "admin"}'::jsonb,
    true,
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM email_templates WHERE key = 'admin_digest')
  AND NOT EXISTS (
    SELECT 1 FROM email_automations
    WHERE trigger_type = 'scheduled'
      AND trigger_event = 'admin_digest'
  );

-- Payment Reminder - Sent to accepted campers with unpaid invoices
INSERT INTO email_automations (
    name,
    description,
    template_key,
    trigger_type,
    trigger_event,
    schedule_day,
    schedule_hour,
    audience_filter,
    is_active,
    created_at,
    updated_at
)
SELECT
    'Payment Reminder',
    'Send weekly payment reminders to accepted campers who have not yet paid. Runs every Monday at 9 AM UTC.',
    'payment_reminder',
    'scheduled',
    'payment_reminder',
    1,  -- Monday
    9,  -- 9 AM UTC
    '{"status": "camper", "paid_invoice": false}'::jsonb,
    true,
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM email_templates WHERE key = 'payment_reminder')
  AND NOT EXISTS (
    SELECT 1 FROM email_automations
    WHERE trigger_type = 'scheduled'
      AND trigger_event = 'payment_reminder'
  );

-- Incomplete Application Reminder - Sent to applicants with incomplete applications
INSERT INTO email_automations (
    name,
    description,
    template_key,
    trigger_type,
    trigger_event,
    schedule_day,
    schedule_hour,
    audience_filter,
    is_active,
    created_at,
    updated_at
)
SELECT
    'Incomplete Application Reminder',
    'Send weekly reminders to families with incomplete applications. Runs every Monday at 9 AM UTC.',
    'incomplete_reminder',
    'scheduled',
    'incomplete_reminder',
    1,  -- Monday
    9,  -- 9 AM UTC
    '{"status": "applicant", "sub_status": "incomplete"}'::jsonb,
    true,
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM email_templates WHERE key = 'incomplete_reminder')
  AND NOT EXISTS (
    SELECT 1 FROM email_automations
    WHERE trigger_type = 'scheduled'
      AND trigger_event = 'incomplete_reminder'
  );

-- ============================================================================
-- 3. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN email_automations.schedule_day IS
    'Day of week for scheduled automations. 0=Sunday, 1=Monday, ..., 6=Saturday. Matches frontend UI.';

COMMENT ON COLUMN email_automations.schedule_hour IS
    'Hour of day (0-23) in UTC for scheduled automations. When combined with schedule_day, determines when the automation runs.';
