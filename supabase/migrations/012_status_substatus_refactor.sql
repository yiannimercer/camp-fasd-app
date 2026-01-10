-- Status/Sub-status Refactor Migration
-- This migration refactors from tier-based (Tier 1/Tier 2) to status-based (Applicant/Camper/Inactive)
--
-- NEW STRUCTURE:
-- status: 'applicant' | 'camper' | 'inactive'
-- sub_status: progress within status
-- paid_invoice: NULL (no invoice) | FALSE (unpaid) | TRUE (paid)
--
-- STATUS FLOW:
-- Applicant: not_started → incomplete → completed → under_review → waitlist → [promoted]
-- Camper: incomplete → complete (paid_invoice tracks payment separately)
-- Inactive: deferred | withdrawn | rejected

-- ============================================================================
-- 1. Add new columns
-- ============================================================================

-- Sub-status column to track progress within a status
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS sub_status VARCHAR(50);

-- Payment tracking - NULL for applicants, FALSE when invoice generated, TRUE when paid
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS paid_invoice BOOLEAN DEFAULT NULL;

-- Stripe invoice ID for payment tracking
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(255);

-- Rename promoted_to_tier2_at to promoted_to_camper_at
ALTER TABLE applications
RENAME COLUMN promoted_to_tier2_at TO promoted_to_camper_at;

-- ============================================================================
-- 2. Migrate existing data to new status/sub_status structure
-- ============================================================================

-- Applicant statuses (was Tier 1)
UPDATE applications
SET sub_status = 'not_started', status = 'applicant'
WHERE status = 'not_started';

UPDATE applications
SET sub_status = 'incomplete', status = 'applicant'
WHERE status = 'incomplete';

UPDATE applications
SET sub_status = 'completed', status = 'applicant'
WHERE status = 'complete';

UPDATE applications
SET sub_status = 'under_review', status = 'applicant'
WHERE status = 'under_review';

UPDATE applications
SET sub_status = 'waitlist', status = 'applicant'
WHERE status = 'waitlist';

-- Camper statuses (was Tier 2)
UPDATE applications
SET sub_status = 'incomplete', status = 'camper', paid_invoice = FALSE
WHERE status = 'tier2_incomplete';

UPDATE applications
SET sub_status = 'complete', status = 'camper', paid_invoice = FALSE
WHERE status = 'unpaid';

UPDATE applications
SET sub_status = 'complete', status = 'camper', paid_invoice = TRUE
WHERE status = 'paid';

-- Inactive statuses
UPDATE applications
SET sub_status = 'deferred', status = 'inactive'
WHERE status = 'deferred';

UPDATE applications
SET sub_status = 'withdrawn', status = 'inactive'
WHERE status = 'withdrawn';

UPDATE applications
SET sub_status = 'rejected', status = 'inactive'
WHERE status = 'rejected';

-- ============================================================================
-- 3. Update status constraint
-- ============================================================================

-- Drop old status constraint
ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_status_check;

-- Add new status constraint (only 3 values now)
ALTER TABLE applications
ADD CONSTRAINT applications_status_check CHECK (status IN (
    'applicant',    -- Initial application phase
    'camper',       -- Accepted and in camper phase
    'inactive'      -- Deferred, withdrawn, or rejected
));

-- Add sub_status constraint
ALTER TABLE applications
ADD CONSTRAINT applications_sub_status_check CHECK (sub_status IN (
    -- Applicant sub-statuses
    'not_started',      -- App created, no questions answered
    'incomplete',       -- At least 1 question answered, < 100% complete
    'completed',        -- 100% complete, awaiting admin review
    'under_review',     -- At least 1 admin action (note/approve/deny)
    'waitlist',         -- Admin moved to waitlist
    -- Camper sub-statuses
    'complete',         -- Camper sections 100% complete (note: different from 'completed')
    -- Inactive sub-statuses
    'deferred',         -- Deferred to next year
    'withdrawn',        -- Withdrew application
    'rejected'          -- Admin rejected
));

-- ============================================================================
-- 4. Update section tier column to use status values
-- ============================================================================

-- First, add new column for status-based visibility
ALTER TABLE application_sections
ADD COLUMN IF NOT EXISTS required_status VARCHAR(50);

-- Migrate tier values to required_status
UPDATE application_sections
SET required_status = 'applicant'
WHERE tier = 1;

UPDATE application_sections
SET required_status = 'camper'
WHERE tier = 2;

-- required_status = NULL means visible to all (both applicant and camper)

-- Add constraint for required_status
ALTER TABLE application_sections
ADD CONSTRAINT sections_required_status_check
CHECK (required_status IS NULL OR required_status IN ('applicant', 'camper'));

-- ============================================================================
-- 5. Update show_when_status constraints for sections and questions
-- ============================================================================

-- Drop old constraints
ALTER TABLE application_sections
DROP CONSTRAINT IF EXISTS check_section_show_when_status;

ALTER TABLE application_questions
DROP CONSTRAINT IF EXISTS check_question_show_when_status;

-- Add new constraints with updated status values
-- Note: show_when_status uses sub_status values for conditional visibility
ALTER TABLE application_sections
ADD CONSTRAINT check_section_show_when_status
CHECK (show_when_status IS NULL OR show_when_status IN (
    'completed', 'under_review', 'waitlist',    -- Applicant sub-statuses
    'incomplete', 'complete',                    -- Camper sub-statuses (note: camper 'incomplete' different context)
    'accepted'                                   -- Keep for backwards compatibility
));

ALTER TABLE application_questions
ADD CONSTRAINT check_question_show_when_status
CHECK (show_when_status IS NULL OR show_when_status IN (
    'completed', 'under_review', 'waitlist',
    'incomplete', 'complete',
    'accepted'
));

-- ============================================================================
-- 6. Drop old tier column (now using status directly)
-- ============================================================================

-- Drop tier constraint first
ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_tier_check;

-- Drop tier index
DROP INDEX IF EXISTS idx_applications_tier;

-- Drop tier column
ALTER TABLE applications
DROP COLUMN IF EXISTS tier;

-- Drop tier column from sections (replaced by required_status)
ALTER TABLE application_sections
DROP CONSTRAINT IF EXISTS sections_tier_check;

DROP INDEX IF EXISTS idx_sections_tier;

ALTER TABLE application_sections
DROP COLUMN IF EXISTS tier;

-- ============================================================================
-- 7. Create new indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_sub_status ON applications(sub_status);
CREATE INDEX IF NOT EXISTS idx_applications_paid_invoice ON applications(paid_invoice);
CREATE INDEX IF NOT EXISTS idx_sections_required_status ON application_sections(required_status);

-- ============================================================================
-- 8. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN applications.status IS
'Application status: applicant (initial phase), camper (accepted), inactive (deferred/withdrawn/rejected)';

COMMENT ON COLUMN applications.sub_status IS
'Progress within status: not_started, incomplete, completed, under_review, waitlist (applicant); incomplete, complete (camper); deferred, withdrawn, rejected (inactive)';

COMMENT ON COLUMN applications.paid_invoice IS
'Payment status: NULL (no invoice yet - applicant), FALSE (invoice generated - unpaid), TRUE (paid via Stripe)';

COMMENT ON COLUMN applications.stripe_invoice_id IS
'Stripe invoice ID for payment tracking';

COMMENT ON COLUMN applications.promoted_to_camper_at IS
'Timestamp when application was promoted from applicant to camper status';

COMMENT ON COLUMN application_sections.required_status IS
'Which status can see this section: NULL (all), applicant (applicant only), camper (camper only)';
