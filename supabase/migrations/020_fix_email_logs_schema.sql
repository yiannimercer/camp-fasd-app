-- Fix email_logs schema to match what the email service expects
-- The initial schema was minimal; the email_service.py log_email() function needs additional columns

-- Add missing columns to email_logs table
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS email_type VARCHAR(100);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS resend_id VARCHAR(255);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS variables JSONB;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_application_id ON email_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- Add comment explaining the table
COMMENT ON TABLE email_logs IS 'Log of all emails sent through the system with full details for debugging and tracking';
