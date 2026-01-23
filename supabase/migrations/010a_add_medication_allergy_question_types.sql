-- Add medication_list, allergy_list, and table to question_type check constraint
-- Migration: 010a_add_medication_allergy_question_types

-- Drop the existing check constraint
ALTER TABLE application_questions DROP CONSTRAINT IF EXISTS application_questions_question_type_check;

-- Add the new check constraint with all custom question types
ALTER TABLE application_questions
ADD CONSTRAINT application_questions_question_type_check
CHECK (question_type IN (
  'text',
  'textarea',
  'dropdown',
  'multiple_choice',
  'checkbox',
  'file_upload',
  'profile_picture',
  'medication_list',
  'allergy_list',
  'table',
  'date',
  'email',
  'phone',
  'signature'
));

COMMENT ON CONSTRAINT application_questions_question_type_check ON application_questions IS 'Ensures question_type is one of the allowed values including medication_list, allergy_list, and table';
