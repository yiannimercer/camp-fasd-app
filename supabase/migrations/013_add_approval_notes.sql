-- Migration: Add note column to application_approvals table
-- Purpose: Allow admins to provide required notes when approving/declining applications
-- Date: 2025-12-16

-- Add note column to application_approvals
ALTER TABLE application_approvals
ADD COLUMN IF NOT EXISTS note TEXT;

-- Comment for documentation
COMMENT ON COLUMN application_approvals.note IS 'Required note explaining the approval/decline decision';
