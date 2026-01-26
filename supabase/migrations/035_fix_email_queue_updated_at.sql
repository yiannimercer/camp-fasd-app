-- Fix email_queue table: add missing updated_at column
-- The table was created but the trigger expects updated_at column to exist

-- Add the column if it doesn't exist
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop and recreate the trigger to ensure it works properly
DROP TRIGGER IF EXISTS update_email_queue_updated_at ON email_queue;

-- Only create trigger if the function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_email_queue_updated_at
        BEFORE UPDATE ON email_queue
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
