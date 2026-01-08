-- Migration: 015_fasd_best_score.sql
-- Purpose: Add FASD BeST score calculation support
-- Date: 2025-12-29

-- 1. Add fasd_best_score column to applications table
-- This stores the calculated score (NULL if not all questions answered)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS fasd_best_score INTEGER;

-- 2. Add score_calculation_type to application_sections for robustness
-- This allows us to identify sections that need score calculation without relying on names
ALTER TABLE application_sections ADD COLUMN IF NOT EXISTS score_calculation_type VARCHAR(50);

-- 3. Mark the FASD Screener section with the 'fasd_best' calculation type
-- This makes the system robust to section name changes
UPDATE application_sections
SET score_calculation_type = 'fasd_best'
WHERE title ILIKE '%fasd%screener%' OR title ILIKE '%fasd screener%';

-- 4. Create a function to calculate FASD BeST score for an application
-- Returns NULL if any question in the FASD Screener section is unanswered
CREATE OR REPLACE FUNCTION calculate_fasd_best_score(app_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_section_id UUID;
    total_questions INTEGER;
    answered_questions INTEGER;
    score INTEGER := 0;
BEGIN
    -- Find the FASD BeST section by score_calculation_type
    SELECT id INTO v_section_id
    FROM application_sections
    WHERE score_calculation_type = 'fasd_best'
    AND is_active = true
    LIMIT 1;

    -- If no section found, return NULL
    IF v_section_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Count total active questions in the section
    SELECT COUNT(*) INTO total_questions
    FROM application_questions
    WHERE section_id = v_section_id
    AND is_active = true;

    -- Count answered questions and calculate score
    SELECT
        COUNT(*),
        COALESCE(SUM(
            CASE response_value
                WHEN 'Never' THEN 0
                WHEN 'Sometimes' THEN 1
                WHEN 'Frequently' THEN 2
                WHEN 'Always' THEN 3
                ELSE 0
            END
        ), 0)
    INTO answered_questions, score
    FROM application_responses ar
    JOIN application_questions aq ON ar.question_id = aq.id
    WHERE ar.application_id = app_id
    AND aq.section_id = v_section_id
    AND aq.is_active = true
    AND ar.response_value IS NOT NULL
    AND ar.response_value != '';

    -- Only return score if ALL questions are answered
    IF answered_questions >= total_questions THEN
        RETURN score;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Create a trigger function to auto-update the score when responses change
CREATE OR REPLACE FUNCTION update_fasd_best_score()
RETURNS TRIGGER AS $$
DECLARE
    affected_app_id UUID;
    section_calc_type VARCHAR(50);
BEGIN
    -- Get the application_id from the affected row
    IF TG_OP = 'DELETE' THEN
        affected_app_id := OLD.application_id;
    ELSE
        affected_app_id := NEW.application_id;
    END IF;

    -- Check if this response is for a question in a scored section
    SELECT s.score_calculation_type INTO section_calc_type
    FROM application_questions q
    JOIN application_sections s ON q.section_id = s.id
    WHERE q.id = COALESCE(NEW.question_id, OLD.question_id);

    -- Only recalculate if the question is in a scored section
    IF section_calc_type = 'fasd_best' THEN
        UPDATE applications
        SET fasd_best_score = calculate_fasd_best_score(affected_app_id)
        WHERE id = affected_app_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 6. Create the trigger on application_responses
DROP TRIGGER IF EXISTS trigger_update_fasd_best_score ON application_responses;
CREATE TRIGGER trigger_update_fasd_best_score
AFTER INSERT OR UPDATE OR DELETE ON application_responses
FOR EACH ROW
EXECUTE FUNCTION update_fasd_best_score();

-- 7. Calculate scores for all existing applications
UPDATE applications
SET fasd_best_score = calculate_fasd_best_score(id);
