-- Create email_queue table for async email processing
-- Emails can be queued for later sending (scheduled) or batch processing
-- The cron job processes this queue periodically

CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Recipient info
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,

    -- Email content
    template_key VARCHAR(100),
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    variables JSONB,

    -- Queue management
    priority INTEGER DEFAULT 0,  -- Higher = processed first
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),  -- When to send the email

    -- Processing tracking
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    resend_id VARCHAR(255),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_for ON email_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_application_id ON email_queue(application_id);

-- Index for finding pending emails ready to process
CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON email_queue(status, scheduled_for, attempts)
    WHERE status = 'pending';

-- Enable RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
CREATE TRIGGER update_email_queue_updated_at BEFORE UPDATE ON email_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE email_queue IS 'Queue for async email processing with retry logic and scheduling';
COMMENT ON COLUMN email_queue.priority IS 'Higher priority emails are processed first. Default 0.';
COMMENT ON COLUMN email_queue.max_attempts IS 'Maximum number of send attempts before marking as failed';
