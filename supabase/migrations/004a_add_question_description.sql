-- Add description field to application_questions for long-form markdown content
-- This allows rich formatted content above questions (e.g., authorization text)

ALTER TABLE application_questions
ADD COLUMN description TEXT;

COMMENT ON COLUMN application_questions.description IS 'Long-form description supporting markdown, displayed above the question';
