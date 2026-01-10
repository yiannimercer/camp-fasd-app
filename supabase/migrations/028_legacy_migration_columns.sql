-- Migration: Add legacy WordPress IDs for data migration audit trail
-- Purpose: Track which Supabase records were migrated from WordPress
-- These columns allow us to:
--   1. Debug data issues by linking back to source records
--   2. Re-run migrations safely (check if already migrated)
--   3. Maintain audit trail for compliance

-- Add legacy WordPress user ID to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_wp_user_id INTEGER;

-- Add legacy WordPress camper/post ID to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS legacy_wp_camper_id INTEGER;

-- Create indexes for efficient lookup during migration and debugging
CREATE INDEX IF NOT EXISTS idx_users_legacy_wp_id ON users(legacy_wp_user_id);
CREATE INDEX IF NOT EXISTS idx_applications_legacy_wp_id ON applications(legacy_wp_camper_id);

-- Add needs_password_setup flag for legacy users
-- When true, the login flow will prompt the user to set their password
-- This is set to true for all migrated users, and false after they set their password
ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_password_setup BOOLEAN DEFAULT false;

-- Add comment documentation
COMMENT ON COLUMN users.legacy_wp_user_id IS 'WordPress user ID from legacy system migration (2025)';
COMMENT ON COLUMN applications.legacy_wp_camper_id IS 'WordPress camper post ID from legacy system migration (2025)';
COMMENT ON COLUMN users.needs_password_setup IS 'True for migrated users who need to set their password. Set to false after password is set.';
