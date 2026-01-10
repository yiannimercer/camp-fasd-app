-- Add template_file_id to application_questions for downloadable forms
ALTER TABLE application_questions
ADD COLUMN template_file_id UUID REFERENCES files(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_questions_template_file ON application_questions(template_file_id);

-- Add comment
COMMENT ON COLUMN application_questions.template_file_id IS 'Optional file that users can download as a template (e.g., doctor form to fill out)';
