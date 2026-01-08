-- Migration: Add allow_new_applications configuration
-- Description: Controls whether new applications can be created
-- When disabled, existing users can still complete in-progress applications
-- but cannot start new ones.

-- Insert the allow_new_applications config if it doesn't exist
INSERT INTO system_configuration (key, value, description, data_type, category, is_public)
VALUES (
  'allow_new_applications',
  'true',
  'Control whether new applications can be created. When disabled, existing users can still complete in-progress applications but cannot start new ones.',
  'boolean',
  'application',
  true
)
ON CONFLICT (key) DO NOTHING;
