-- Migration: Cleanup approval system columns
-- Purpose:
--   1. Add admin_name and admin_team to application_approvals for denormalized lookup
--   2. Remove unused team-based approval columns from applications table
-- Date: 2026-01-09

-- ============================================================================
-- PART 1: Add admin info columns to application_approvals
-- ============================================================================

-- Add admin_name to store the approving admin's name at time of approval
ALTER TABLE application_approvals
ADD COLUMN IF NOT EXISTS admin_name VARCHAR(255);

-- Add admin_team to store which team the admin belongs to
ALTER TABLE application_approvals
ADD COLUMN IF NOT EXISTS admin_team VARCHAR(50);

COMMENT ON COLUMN application_approvals.admin_name IS 'Admin full name at time of approval (denormalized for history)';
COMMENT ON COLUMN application_approvals.admin_team IS 'Admin team at time of approval: ops, behavioral, med, lit';

-- ============================================================================
-- PART 2: Remove unused team approval columns from applications
-- ============================================================================

-- Drop the team-based boolean flags (not used - approval_approvals table is used instead)
ALTER TABLE applications DROP COLUMN IF EXISTS ops_approved;
ALTER TABLE applications DROP COLUMN IF EXISTS behavioral_approved;
ALTER TABLE applications DROP COLUMN IF EXISTS medical_approved;

-- Drop the team-based approved_by foreign keys (not used)
ALTER TABLE applications DROP COLUMN IF EXISTS ops_approved_by;
ALTER TABLE applications DROP COLUMN IF EXISTS behavioral_approved_by;
ALTER TABLE applications DROP COLUMN IF EXISTS medical_approved_by;

-- Drop the team-based timestamp columns (not used)
ALTER TABLE applications DROP COLUMN IF EXISTS ops_approved_at;
ALTER TABLE applications DROP COLUMN IF EXISTS behavioral_approved_at;
ALTER TABLE applications DROP COLUMN IF EXISTS medical_approved_at;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running, verify with:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'application_approvals';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'applications' WHERE column_name LIKE '%approved%';
