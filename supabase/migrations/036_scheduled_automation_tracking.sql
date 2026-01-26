-- Migration: Add tracking columns for scheduled email automations
--
-- This adds the ability to track when each scheduled automation last ran,
-- preventing duplicate sends and enabling proper scheduling.

-- Add last_sent_at column to track when automation last executed
ALTER TABLE email_automations ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN email_automations.last_sent_at IS 'Timestamp of when this scheduled automation last ran successfully. Used to prevent duplicate sends.';

-- Create index for efficient querying of due scheduled automations
-- This index helps quickly find active scheduled automations by day/hour
CREATE INDEX IF NOT EXISTS idx_email_automations_scheduled
ON email_automations(trigger_type, schedule_day, schedule_hour, is_active)
WHERE trigger_type = 'scheduled' AND is_active = true;

-- Create index for last_sent_at to efficiently check recently run automations
CREATE INDEX IF NOT EXISTS idx_email_automations_last_sent
ON email_automations(last_sent_at)
WHERE trigger_type = 'scheduled';
