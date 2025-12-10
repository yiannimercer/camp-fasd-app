-- Tiered Application Status System Migration
-- This migration introduces a two-tier application lifecycle:
-- Tier 1 (Applicant): not_started, incomplete, complete, under_review, waitlist
-- Tier 2 (Camper): tier2_incomplete, unpaid, paid
-- Inactive: deferred, withdrawn, rejected

-- ============================================================================
-- 1. Add tier column to applications
-- ============================================================================

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1;

-- Add constraint for tier values
ALTER TABLE applications
ADD CONSTRAINT applications_tier_check
CHECK (tier IN (1, 2));

-- ============================================================================
-- 2. Add metadata columns to applications for admin table
-- ============================================================================

-- Camper age (calculated from birthdate, stored for querying)
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS camper_age INTEGER;

-- Camper gender
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS camper_gender VARCHAR(50);

-- Tuition status for payment tracking
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS tuition_status VARCHAR(50);

-- ============================================================================
-- 3. Add timestamp columns for status transitions
-- ============================================================================

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS under_review_at TIMESTAMP;

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS promoted_to_tier2_at TIMESTAMP;

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS waitlisted_at TIMESTAMP;

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS deferred_at TIMESTAMP;

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP;

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

-- ============================================================================
-- 4. Add tier column to application_sections
-- ============================================================================

ALTER TABLE application_sections
ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT NULL;

-- Constraint: tier can be NULL (visible to all), 1 (Tier 1 only), or 2 (Tier 2 only)
ALTER TABLE application_sections
ADD CONSTRAINT sections_tier_check
CHECK (tier IS NULL OR tier IN (1, 2));

-- ============================================================================
-- 5. Add persist_annually column to application_questions
-- ============================================================================

-- This column marks questions whose responses should be kept during annual reset
-- Default is FALSE - most responses are cleared annually
ALTER TABLE application_questions
ADD COLUMN IF NOT EXISTS persist_annually BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN application_questions.persist_annually IS
'If TRUE, responses to this question are preserved during annual application reset';

-- ============================================================================
-- 6. Update applications status constraint
-- ============================================================================

-- Drop old status constraint
ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_status_check;

-- Add new status constraint with all 10 statuses
ALTER TABLE applications
ADD CONSTRAINT applications_status_check CHECK (status IN (
    -- Tier 1 (Applicant)
    'not_started',      -- Application created, 0 questions answered
    'incomplete',       -- 1+ questions answered, < 100% complete
    'complete',         -- 100% complete, awaiting first admin review
    'under_review',     -- At least one admin approval received
    'waitlist',         -- Admin moved to waitlist from under_review
    -- Tier 2 (Camper)
    'tier2_incomplete', -- Promoted to Tier 2, new sections available, < 100%
    'unpaid',           -- Tier 2 complete, awaiting payment
    'paid',             -- Payment received, fully complete
    -- Inactive states
    'deferred',         -- Applicant chose to defer to next year
    'withdrawn',        -- Applicant withdrew application
    'rejected'          -- Admin rejected application (replaces 'declined')
));

-- ============================================================================
-- 7. Update show_when_status constraints for sections and questions
-- ============================================================================

-- Drop old constraints
ALTER TABLE application_sections
DROP CONSTRAINT IF EXISTS check_section_show_when_status;

ALTER TABLE application_questions
DROP CONSTRAINT IF EXISTS check_question_show_when_status;

-- Add new constraints with expanded status options
ALTER TABLE application_sections
ADD CONSTRAINT check_section_show_when_status
CHECK (show_when_status IS NULL OR show_when_status IN (
    'complete', 'under_review', 'waitlist',
    'tier2_incomplete', 'unpaid', 'paid',
    'accepted'  -- Keep for backwards compatibility during transition
));

ALTER TABLE application_questions
ADD CONSTRAINT check_question_show_when_status
CHECK (show_when_status IS NULL OR show_when_status IN (
    'complete', 'under_review', 'waitlist',
    'tier2_incomplete', 'unpaid', 'paid',
    'accepted'  -- Keep for backwards compatibility during transition
));

-- ============================================================================
-- 8. Create indexes for new columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_applications_tier ON applications(tier);
CREATE INDEX IF NOT EXISTS idx_applications_camper_age ON applications(camper_age);
CREATE INDEX IF NOT EXISTS idx_applications_camper_gender ON applications(camper_gender);
CREATE INDEX IF NOT EXISTS idx_applications_tuition_status ON applications(tuition_status);
CREATE INDEX IF NOT EXISTS idx_sections_tier ON application_sections(tier);
CREATE INDEX IF NOT EXISTS idx_questions_persist_annually ON application_questions(persist_annually);

-- ============================================================================
-- 9. Migrate existing data
-- ============================================================================

-- Set tier to 1 for all existing applications (if not already set)
UPDATE applications SET tier = 1 WHERE tier IS NULL;

-- Migrate 'in_progress' to appropriate new status based on completion
-- Applications with 0% stay as 'not_started' (we'll set this below)
-- Applications with 1-99% become 'incomplete' (which is the same as in_progress)
-- Applications with 100% become 'complete'
UPDATE applications
SET status = 'not_started'
WHERE status = 'in_progress' AND completion_percentage = 0;

UPDATE applications
SET status = 'incomplete'
WHERE status = 'in_progress' AND completion_percentage > 0 AND completion_percentage < 100;

UPDATE applications
SET status = 'complete', completed_at = updated_at
WHERE status = 'in_progress' AND completion_percentage = 100;

-- Migrate 'accepted' to tier2_incomplete and set tier = 2
UPDATE applications
SET
    tier = 2,
    status = 'tier2_incomplete',
    promoted_to_tier2_at = accepted_at
WHERE status = 'accepted';

-- Migrate 'declined' to 'rejected'
UPDATE applications
SET status = 'rejected', rejected_at = declined_at
WHERE status = 'declined';

-- Applications with 'paid' status stay as 'paid' but set tier = 2
UPDATE applications
SET tier = 2, paid_at = updated_at
WHERE status = 'paid';

-- Applications with 'under_review' stay as 'under_review', set timestamp
UPDATE applications
SET under_review_at = updated_at
WHERE status = 'under_review' AND under_review_at IS NULL;

-- ============================================================================
-- 10. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN applications.tier IS
'Application tier: 1=Applicant (initial application), 2=Camper (accepted and filling additional info)';

COMMENT ON COLUMN applications.camper_age IS
'Calculated camper age for admin filtering';

COMMENT ON COLUMN applications.camper_gender IS
'Camper gender for cabin assignment';

COMMENT ON COLUMN applications.tuition_status IS
'Payment/tuition status: full, scholarship, payment_plan, etc.';

COMMENT ON COLUMN application_sections.tier IS
'Section tier requirement: NULL=all tiers, 1=Tier 1 only, 2=Tier 2 only';
