-- Migration: 014_status_cleanup.sql
-- Purpose: Standardize sub_status values and add timestamp columns for deactivation/reactivation
-- Date: 2025-12-29

-- 1. Add deactivated_at and reactivated_at columns to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMP WITH TIME ZONE;

-- 2. Update all 'completed' sub_status to 'complete' for consistency
-- (Applicant sub_status should use 'complete' like Camper)
UPDATE applications
SET sub_status = 'complete'
WHERE sub_status = 'completed';

-- 3. Drop old check constraint and add new one with standardized values
-- Old constraint allowed: not_started, incomplete, completed, under_review, waitlist, complete, deferred, withdrawn, rejected
-- New constraint allows: not_started, incomplete, complete, under_review, waitlist, inactive
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_sub_status_check;

-- 4. Update any legacy 'deferred', 'withdrawn', 'rejected' sub_statuses to 'inactive'
-- These are now all consolidated under status='inactive', sub_status='inactive'
-- Note: Keeping the original values in their respective timestamp columns for historical reference
UPDATE applications
SET sub_status = 'inactive',
    deactivated_at = COALESCE(deferred_at, withdrawn_at, rejected_at, NOW())
WHERE status = 'inactive' AND sub_status IN ('deferred', 'withdrawn', 'rejected');

-- 5. Add new constraint with the standardized sub_status values
ALTER TABLE applications ADD CONSTRAINT applications_sub_status_check
CHECK (sub_status IN ('not_started', 'incomplete', 'complete', 'under_review', 'waitlist', 'inactive'));
