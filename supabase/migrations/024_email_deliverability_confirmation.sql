-- Migration: Add email deliverability confirmation field
-- This tracks whether a user has confirmed they can receive our emails (not spam)

-- Add email_deliverability_confirmed column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_deliverability_confirmed BOOLEAN DEFAULT false NOT NULL;

-- Add timestamp for when they sent the test email
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_test_sent_at TIMESTAMP WITH TIME ZONE;

-- Add timestamp for when they confirmed deliverability
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_deliverability_confirmed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN users.email_deliverability_confirmed IS 'Whether user has confirmed they receive our emails and we are not in spam';
COMMENT ON COLUMN users.email_test_sent_at IS 'When the user last requested a test email';
COMMENT ON COLUMN users.email_deliverability_confirmed_at IS 'When the user confirmed email deliverability';
