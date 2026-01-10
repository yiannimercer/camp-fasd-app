-- Migration: Fix Google OAuth name extraction
-- Purpose: Update trigger to extract names from ALL possible Google OAuth metadata fields
-- Google may provide: full_name, name, given_name, family_name (varies by account type)
-- Date: 2026-01-10

CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  existing_user_id uuid;
  extracted_first_name text;
  extracted_last_name text;
  full_name_value text;
  name_parts text[];
BEGIN
  -- Try specific first_name/given_name fields first (manual signup or some OAuth providers)
  extracted_first_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'given_name', '')
  );

  extracted_last_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'family_name', '')
  );

  -- If we don't have first/last name, try to parse from full_name or name
  -- Google often provides only 'full_name' or 'name' as "FirstName LastName"
  IF (extracted_first_name IS NULL OR extracted_first_name = '') THEN
    full_name_value := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', '')
    );

    IF full_name_value IS NOT NULL AND full_name_value != '' THEN
      -- Split on first space: "Yianni Mercer" -> ["Yianni", "Mercer"]
      name_parts := string_to_array(full_name_value, ' ');
      extracted_first_name := name_parts[1];
      -- Join remaining parts as last name (handles "Mary Jane Watson" -> "Jane Watson")
      IF array_length(name_parts, 1) > 1 THEN
        extracted_last_name := array_to_string(name_parts[2:], ' ');
      END IF;
    END IF;
  END IF;

  -- Default to empty string if still null
  extracted_first_name := COALESCE(extracted_first_name, '');
  extracted_last_name := COALESCE(extracted_last_name, '');

  -- Check if email already exists in our users table (for linking existing accounts)
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE email = NEW.email;

  IF existing_user_id IS NOT NULL THEN
    -- Link existing user to Supabase auth
    -- Also update name if we have it from OAuth and existing record doesn't have it
    UPDATE public.users
    SET
      supabase_auth_id = NEW.id,
      email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
      first_name = CASE
        WHEN (first_name IS NULL OR first_name = '') AND extracted_first_name != ''
        THEN extracted_first_name
        ELSE first_name
      END,
      last_name = CASE
        WHEN (last_name IS NULL OR last_name = '') AND extracted_last_name != ''
        THEN extracted_last_name
        ELSE last_name
      END,
      updated_at = NOW()
    WHERE id = existing_user_id;
  ELSE
    -- Determine role based on email domain
    -- @fasdcamp.org users automatically become admins
    IF NEW.email LIKE '%@fasdcamp.org' THEN
      user_role := 'admin';
    ELSE
      user_role := 'user';
    END IF;

    -- Create new user record
    INSERT INTO public.users (
      email,
      supabase_auth_id,
      first_name,
      last_name,
      role,
      email_verified,
      status,
      created_at,
      updated_at
    ) VALUES (
      NEW.email,
      NEW.id,
      extracted_first_name,
      extracted_last_name,
      user_role,
      COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
      'active',
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- BACKFILL: Update existing users who signed up via Google with blank names
-- ============================================================================
-- This updates users whose first_name is blank but have name data in auth.users

UPDATE public.users u
SET
  first_name = split_part(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'given_name'), ' ', 1),
  last_name = CASE
    -- If we have family_name, use it directly
    WHEN au.raw_user_meta_data->>'family_name' IS NOT NULL AND au.raw_user_meta_data->>'family_name' != ''
    THEN au.raw_user_meta_data->>'family_name'
    -- Otherwise parse from full_name/name (take everything after first space)
    WHEN array_length(string_to_array(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name'), ' '), 1) > 1
    THEN array_to_string((string_to_array(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name'), ' '))[2:], ' ')
    ELSE ''
  END,
  updated_at = NOW()
FROM auth.users au
WHERE u.supabase_auth_id = au.id
  AND (u.first_name IS NULL OR u.first_name = '')
  AND (
    au.raw_user_meta_data->>'full_name' IS NOT NULL
    OR au.raw_user_meta_data->>'name' IS NOT NULL
    OR au.raw_user_meta_data->>'given_name' IS NOT NULL
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running, verify with:
-- SELECT email, first_name, last_name FROM public.users WHERE first_name != '' ORDER BY created_at DESC LIMIT 10;
