-- Migration: Supabase Auth Integration
-- This migration adds support for Supabase Auth while maintaining our existing users table

-- Add supabase_auth_id column to link our users table with Supabase auth.users
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_auth_id UUID UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id);

-- Comment explaining the column
COMMENT ON COLUMN users.supabase_auth_id IS 'Links to Supabase auth.users.id for authentication';

-- Create a function to handle new Supabase auth user creation
-- This will be called via trigger when a user signs up through Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  existing_user_id uuid;
BEGIN
  -- Check if email already exists in our users table (from old system)
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE email = NEW.email;

  IF existing_user_id IS NOT NULL THEN
    -- Link existing user to Supabase auth
    UPDATE public.users
    SET
      supabase_auth_id = NEW.id,
      email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
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
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
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

-- Create trigger to automatically create user record when Supabase auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_supabase_user();

-- Create a function to handle Supabase auth user updates (email verification, etc.)
CREATE OR REPLACE FUNCTION public.handle_supabase_user_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET
    email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    updated_at = NOW()
  WHERE supabase_auth_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_supabase_user_update();
