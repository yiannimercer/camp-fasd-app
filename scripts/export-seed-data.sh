#!/bin/bash

# Export seed/configuration data from dev database
# This data should be the same between dev and prod:
# - application_sections
# - application_questions
# - email_templates
# - system_configuration
# - teams
#
# Usage: ./scripts/export-seed-data.sh
#
# This will create supabase/seed-data.sql that you can run on prod

set -e

# Dev database connection (uses backend/.env)
source backend/.env

OUTPUT_FILE="supabase/seed-data.sql"

echo "📤 Exporting seed data from dev database..."
echo ""

cat > "$OUTPUT_FILE" << 'EOF'
-- Seed data exported from dev database
-- Run this on production after migrations
-- This contains configuration data that should be identical between environments

BEGIN;

EOF

# Export teams
echo "   Exporting teams..."
psql "$DATABASE_URL" -t -A -c "
SELECT 'INSERT INTO teams (id, key, name, description, color, is_active, order_index, created_at, updated_at) VALUES (' ||
       quote_literal(id) || ', ' ||
       quote_literal(key) || ', ' ||
       quote_literal(name) || ', ' ||
       COALESCE(quote_literal(description), 'NULL') || ', ' ||
       quote_literal(color) || ', ' ||
       is_active || ', ' ||
       order_index || ', ' ||
       quote_literal(created_at) || ', ' ||
       quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM teams;
" >> "$OUTPUT_FILE"

# Export application_sections
echo "   Exporting application_sections..."
psql "$DATABASE_URL" -t -A -c "
SELECT 'INSERT INTO application_sections (id, title, description, order_index, is_active, show_when_status, created_at, updated_at) VALUES (' ||
       quote_literal(id) || ', ' ||
       quote_literal(title) || ', ' ||
       COALESCE(quote_literal(description), 'NULL') || ', ' ||
       order_index || ', ' ||
       is_active || ', ' ||
       COALESCE(quote_literal(show_when_status), 'NULL') || ', ' ||
       quote_literal(created_at) || ', ' ||
       quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM application_sections ORDER BY order_index;
" >> "$OUTPUT_FILE"

# Export application_questions
echo "   Exporting application_questions..."
psql "$DATABASE_URL" -t -A -c "
SELECT 'INSERT INTO application_questions (id, section_id, question_text, question_type, description, options, is_required, order_index, is_active, show_if_question_id, show_if_answer, detail_prompt_trigger, detail_prompt_text, template_file_id, created_at, updated_at) VALUES (' ||
       quote_literal(id) || ', ' ||
       quote_literal(section_id) || ', ' ||
       quote_literal(question_text) || ', ' ||
       quote_literal(question_type) || ', ' ||
       COALESCE(quote_literal(description), 'NULL') || ', ' ||
       COALESCE(quote_literal(options::text), 'NULL') || ', ' ||
       is_required || ', ' ||
       order_index || ', ' ||
       is_active || ', ' ||
       COALESCE(quote_literal(show_if_question_id), 'NULL') || ', ' ||
       COALESCE(quote_literal(show_if_answer), 'NULL') || ', ' ||
       COALESCE(quote_literal(detail_prompt_trigger::text), 'NULL') || ', ' ||
       COALESCE(quote_literal(detail_prompt_text::text), 'NULL') || ', ' ||
       COALESCE(quote_literal(template_file_id), 'NULL') || ', ' ||
       quote_literal(created_at) || ', ' ||
       quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM application_questions ORDER BY section_id, order_index;
" >> "$OUTPUT_FILE"

# Export email_templates
echo "   Exporting email_templates..."
psql "$DATABASE_URL" -t -A -c "
SELECT 'INSERT INTO email_templates (id, key, name, subject, html_content, text_content, trigger_event, variables, is_active, created_at, updated_at, updated_by) VALUES (' ||
       quote_literal(id) || ', ' ||
       quote_literal(key) || ', ' ||
       quote_literal(name) || ', ' ||
       quote_literal(subject) || ', ' ||
       quote_literal(html_content) || ', ' ||
       COALESCE(quote_literal(text_content), 'NULL') || ', ' ||
       COALESCE(quote_literal(trigger_event), 'NULL') || ', ' ||
       COALESCE(quote_literal(variables::text), 'NULL') || ', ' ||
       is_active || ', ' ||
       quote_literal(created_at) || ', ' ||
       quote_literal(updated_at) || ', ' ||
       COALESCE(quote_literal(updated_by), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM email_templates;
" >> "$OUTPUT_FILE"

# Export system_configuration
echo "   Exporting system_configuration..."
psql "$DATABASE_URL" -t -A -c "
SELECT 'INSERT INTO system_configuration (id, key, value, description, data_type, category, is_public, created_at, updated_at, updated_by) VALUES (' ||
       quote_literal(id) || ', ' ||
       quote_literal(key) || ', ' ||
       quote_literal(value::text) || ', ' ||
       COALESCE(quote_literal(description), 'NULL') || ', ' ||
       quote_literal(data_type) || ', ' ||
       quote_literal(category) || ', ' ||
       is_public || ', ' ||
       quote_literal(created_at) || ', ' ||
       quote_literal(updated_at) || ', ' ||
       COALESCE(quote_literal(updated_by), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM system_configuration;
" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "COMMIT;" >> "$OUTPUT_FILE"

echo ""
echo "✅ Seed data exported to: $OUTPUT_FILE"
echo ""
echo "To import to production, run:"
echo "  psql <PROD_DATABASE_URL> -f $OUTPUT_FILE"
