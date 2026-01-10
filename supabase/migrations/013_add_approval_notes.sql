-- Migration: Create application_approvals table for admin voting system
-- Purpose: Allow individual admins to approve/decline applications with required notes
-- Date: 2025-12-16
-- Fixed: Table was referenced in model but never created in migrations

-- ============================================================================
-- PART 1: Create application_approvals table
-- ============================================================================

CREATE TABLE IF NOT EXISTS application_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES users(id),
    approved BOOLEAN NOT NULL,  -- True = approve, False = decline
    note TEXT,                  -- Note explaining the decision
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_app_approvals_application ON application_approvals(application_id);
CREATE INDEX IF NOT EXISTS idx_app_approvals_admin ON application_approvals(admin_id);
CREATE INDEX IF NOT EXISTS idx_app_approvals_created ON application_approvals(created_at);

-- Unique constraint: one vote per admin per application
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_approvals_unique_vote
ON application_approvals(application_id, admin_id);

-- ============================================================================
-- PART 2: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE application_approvals IS 'Individual admin approval/decline votes on applications';
COMMENT ON COLUMN application_approvals.approved IS 'True = approve, False = decline';
COMMENT ON COLUMN application_approvals.note IS 'Required note explaining the approval/decline decision';
