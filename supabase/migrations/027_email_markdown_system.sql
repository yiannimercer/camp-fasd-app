-- Migration: Email Markdown System
-- Description: Add markdown support to email templates and create email_documents table
-- This allows templates to use Markdown instead of HTML for easier editing

-- ============================================================================
-- PART 1: Add markdown fields to email_templates
-- ============================================================================

-- Add markdown_content column for storing markdown source
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS markdown_content TEXT;

-- Add use_markdown flag to control which content field to use
-- Defaults to false so existing templates continue using html_content
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS use_markdown BOOLEAN DEFAULT false;

COMMENT ON COLUMN email_templates.markdown_content IS 'Markdown source content for the email template';
COMMENT ON COLUMN email_templates.use_markdown IS 'When true, use markdown_content instead of html_content';

-- ============================================================================
-- PART 2: Create email_documents table for document management
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Document metadata
    name VARCHAR(255) NOT NULL,                    -- Display name (e.g., "Medical Release Form")
    description TEXT,                              -- Optional description

    -- File information
    file_name VARCHAR(255) NOT NULL,               -- Original filename
    storage_path VARCHAR(500) NOT NULL,            -- Path in Supabase Storage
    file_size INTEGER NOT NULL,                    -- Size in bytes
    file_type VARCHAR(100) NOT NULL,               -- MIME type

    -- Tracking
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_documents_created_at ON email_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_documents_name ON email_documents(name);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_email_documents_updated_at ON email_documents;
CREATE TRIGGER update_email_documents_updated_at
    BEFORE UPDATE ON email_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE email_documents IS 'Documents that can be linked in email templates using markdown syntax [Name](url)';

-- ============================================================================
-- PART 3: Create storage bucket for email documents (if not exists)
-- ============================================================================
-- Note: This may need to be done via Supabase dashboard or separate script
-- The bucket should be named 'email-documents' with public access for reading

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'email_templates' AND column_name IN ('markdown_content', 'use_markdown');
-- SELECT * FROM email_documents LIMIT 1;
