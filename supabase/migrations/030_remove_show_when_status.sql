-- Migration: Remove show_when_status column
-- Purpose: Simplify visibility logic - only use required_status for section/question visibility
-- Date: 2026-01-10
--
-- required_status on sections is sufficient:
--   NULL = visible to all
--   'applicant' = applicants only
--   'camper' = accepted campers only

-- ============================================================================
-- PART 1: Remove show_when_status from application_sections
-- ============================================================================
ALTER TABLE application_sections DROP COLUMN IF EXISTS show_when_status;

-- ============================================================================
-- PART 2: Remove show_when_status from application_questions
-- ============================================================================
ALTER TABLE application_questions DROP COLUMN IF EXISTS show_when_status;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run after to verify columns are removed:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'application_sections' AND column_name = 'show_when_status';
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'application_questions' AND column_name = 'show_when_status';
