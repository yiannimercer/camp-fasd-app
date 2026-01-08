-- Migration: Add section headers (question group headers)
-- Allows visual grouping of related questions within a section

ALTER TABLE application_questions
ADD COLUMN header_text VARCHAR(255);

COMMENT ON COLUMN application_questions.header_text IS 'Optional header text to display before this question, creates visual grouping';

-- Example usage:
-- Section: "Camper Information"
--   Question 1: "First Name" (no header)
--   Question 2: "Last Name" (no header)
--   Question 3: "Street Address" (header_text: "Home Address")
--   Question 4: "City" (no header, grouped under "Home Address")
--   Question 5: "Does camper have allergies?" (header_text: "Medical Information")
--   Question 6: "List medications" (no header, grouped under "Medical Information")
