-- Create application_headers table for standalone header cards
CREATE TABLE IF NOT EXISTS application_headers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES application_sections(id) ON DELETE CASCADE,
    header_text VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by section
CREATE INDEX idx_application_headers_section_id ON application_headers(section_id);

-- Create index for ordering
CREATE INDEX idx_application_headers_order ON application_headers(section_id, order_index);

-- Remove header_text from application_questions since it's now in its own table
ALTER TABLE application_questions DROP COLUMN IF EXISTS header_text;
