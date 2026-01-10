-- Migration: Add team column to users table
-- Purpose: Add missing team column that the SQLAlchemy model expects
-- The team field is used for admin team assignment (ops, behavioral, med, lit)
-- Date: 2026-01-10

-- Add the team column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS team VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN users.team IS 'Admin team assignment: ops, behavioral, med, lit (nullable for non-admin users)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run after to verify column exists:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'team';
