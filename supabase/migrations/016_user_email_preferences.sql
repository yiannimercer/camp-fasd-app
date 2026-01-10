-- Migration: Add email preference toggle for users
-- This allows users to opt-out of automated emails (digests, reminders, etc.)

ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_emails BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN users.receive_emails IS 'Whether user receives automated emails (digests, reminders, notifications)';
