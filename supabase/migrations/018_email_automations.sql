-- Email Automations Table
-- Separates scheduling/trigger logic from template content
-- Allows flexible configuration of when emails are sent, to whom, using which template

CREATE TABLE IF NOT EXISTS email_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Which template to use
    template_key VARCHAR(100) NOT NULL REFERENCES email_templates(key) ON DELETE CASCADE,

    -- Trigger configuration
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('event', 'scheduled')),
    -- For event-based triggers: application_created, application_submitted, application_accepted
    trigger_event VARCHAR(100),

    -- For scheduled triggers (weekly recurring)
    schedule_day INTEGER CHECK (schedule_day >= 0 AND schedule_day <= 6), -- 0=Sunday, 6=Saturday
    schedule_hour INTEGER CHECK (schedule_hour >= 0 AND schedule_hour <= 23), -- 24-hour format

    -- Audience filter (who receives this email)
    -- Examples:
    -- { "status": "applicant", "sub_status": "incomplete" } - incomplete applicants
    -- { "status": "camper", "paid_invoice": false } - unpaid campers
    -- { "role": "admin" } - all admins
    -- {} or null - based on trigger context (e.g., the person who triggered the event)
    audience_filter JSONB DEFAULT '{}',

    -- Control
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Index for efficient lookups
CREATE INDEX idx_email_automations_trigger_type ON email_automations(trigger_type);
CREATE INDEX idx_email_automations_trigger_event ON email_automations(trigger_event) WHERE trigger_event IS NOT NULL;
CREATE INDEX idx_email_automations_is_active ON email_automations(is_active);
CREATE INDEX idx_email_automations_template_key ON email_automations(template_key);

-- Remove trigger_event from email_templates (it's now on automations)
-- We'll keep it for now for backward compatibility but it won't be used

-- Insert default automations based on existing trigger_events
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

-- Set default schedules for recurring automations
UPDATE email_automations
SET schedule_day = 1, schedule_hour = 9 -- Monday 9 AM
WHERE trigger_type = 'scheduled' AND schedule_day IS NULL;

-- Add comment explaining the table
COMMENT ON TABLE email_automations IS 'Configures when and to whom emails are automatically sent. Separates trigger logic from template content.';
COMMENT ON COLUMN email_automations.trigger_type IS 'event = triggered by application lifecycle events, scheduled = recurring on a schedule';
COMMENT ON COLUMN email_automations.trigger_event IS 'For event triggers: application_created, application_submitted, application_accepted';
COMMENT ON COLUMN email_automations.audience_filter IS 'JSON filter to determine recipients. Empty = contextual (person who triggered event)';
