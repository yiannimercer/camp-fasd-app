-- Add medication_list and allergy_list to question_type check constraint
-- Migration: 009_add_medication_allergy_question_types

-- Drop the existing check constraint
ALTER TABLE application_questions DROP CONSTRAINT IF EXISTS application_questions_question_type_check;

-- Add the new check constraint with medication_list and allergy_list included
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
  'date',
  'email',
  'phone',
  'signature'
));

COMMENT ON CONSTRAINT application_questions_question_type_check ON application_questions IS 'Ensures question_type is one of the allowed values including medication_list and allergy_list';
