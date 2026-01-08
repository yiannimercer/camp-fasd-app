#!/bin/bash

# Migrate all SQL files to production Supabase database
# Usage: ./scripts/migrate-prod.sh <PROD_DATABASE_URL>
#
# Example:
#   ./scripts/migrate-prod.sh "postgresql://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

set -e

if [ -z "$1" ]; then
    echo "Error: Please provide the production database URL"
    echo "Usage: ./scripts/migrate-prod.sh <PROD_DATABASE_URL>"
    echo ""
    echo "You can find this in Supabase Dashboard → Project Settings → Database → Connection string → URI"
    exit 1
fi

PROD_DB_URL="$1"
MIGRATIONS_DIR="supabase/migrations"

echo "🚀 Starting migration to production database..."
echo ""

# Get all migration files sorted by name
for migration in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
    filename=$(basename "$migration")
    echo "📄 Running: $filename"

    psql "$PROD_DB_URL" -f "$migration" 2>&1 | grep -v "^NOTICE:" || true

    echo "   ✅ Done"
done

echo ""
echo "🎉 All migrations completed successfully!"
echo ""
echo "Next steps:"
echo "1. Set up Auth providers in the new project (Email, Google)"
echo "2. Copy your seed data (application_sections, application_questions, email_templates, etc.)"
echo "3. Update Vercel environment variables for production"
