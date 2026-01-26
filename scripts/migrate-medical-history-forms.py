#!/usr/bin/env python3
"""
Migration Script: Upload Missing Medical History Forms to Supabase

This script:
1. Reads the WordPress export to find campers with medical history forms
2. Maps WordPress users to Supabase users via email
3. Finds applications missing the Medical History Form upload
4. Uploads files from local _private/ folder to Supabase storage
5. Creates file records and links them to application responses

Usage:
    python scripts/migrate-medical-history-forms.py --dry-run  # Preview changes
    python scripts/migrate-medical-history-forms.py            # Execute migration
"""

import os
import sys
import json
import uuid
import argparse
import mimetypes
from datetime import datetime

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client

# Configuration
MIGRATION_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'migration-data')
CAMPER_EXPORT_FILE = os.path.join(MIGRATION_DATA_DIR, 'camper_export_2025-12-29.json')
USERS_EXPORT_FILE = os.path.join(MIGRATION_DATA_DIR, 'users_export_2025-12-29.json')
PRIVATE_FILES_DIR = os.path.join(MIGRATION_DATA_DIR, '_private')

# Medical History Form question (hardcoded - this is the question in the app)
MEDICAL_HISTORY_QUESTION_TEXT = 'Upload completed Medical History Form'

# Supabase bucket
BUCKET_NAME = 'application-files'

# Emails to exclude from migration (test accounts)
EXCLUDE_EMAILS = [
    'yianni@fasdcamp.org',
]


def load_wordpress_data():
    """Load WordPress export data"""
    print("Loading WordPress export data...")

    with open(CAMPER_EXPORT_FILE, 'r') as f:
        campers = json.load(f)

    with open(USERS_EXPORT_FILE, 'r') as f:
        users = json.load(f)

    # Create WP user ID -> email mapping
    wp_user_to_email = {}
    for user in users:
        wp_user_to_email[str(user['id'])] = user.get('email', '').lower()

    print(f"  Loaded {len(campers)} campers and {len(users)} users")
    return campers, wp_user_to_email


def find_campers_with_medical_forms(campers, wp_user_to_email):
    """Find all campers that have medical history forms in WordPress"""
    medical_forms = []

    for camper in campers:
        fields = camper.get('fields', {})
        medical_form = fields.get('medical_history_confirmation_form')

        if medical_form and medical_form.get('filename'):
            wp_author_id = str(medical_form.get('author', ''))
            email = wp_user_to_email.get(wp_author_id)

            if email:
                medical_forms.append({
                    'camper_name': camper.get('post_title'),
                    'wp_user_id': wp_author_id,
                    'email': email,
                    'filename': medical_form.get('filename'),
                    'local_path': os.path.join(PRIVATE_FILES_DIR, wp_author_id, medical_form.get('filename')),
                    'mime_type': medical_form.get('mime_type', 'application/pdf'),
                    'filesize': medical_form.get('filesize', 0),
                })

    print(f"  Found {len(medical_forms)} campers with medical history forms")
    return medical_forms


def get_db_connection(database_url):
    """Get database connection"""
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)


def find_missing_uploads(conn, medical_forms):
    """Find which medical forms are missing in Supabase"""
    missing = []

    with conn.cursor() as cur:
        # Get the Medical History Form question ID
        cur.execute("""
            SELECT id FROM application_questions
            WHERE question_text ILIKE %s
            LIMIT 1
        """, (f'%{MEDICAL_HISTORY_QUESTION_TEXT}%',))
        result = cur.fetchone()

        if not result:
            print("ERROR: Could not find Medical History Form question in database!")
            return []

        question_id = result['id']
        print(f"  Medical History Form question ID: {question_id}")

        for form in medical_forms:
            # Skip excluded emails (test accounts)
            if form['email'].lower() in [e.lower() for e in EXCLUDE_EMAILS]:
                continue

            # Find Supabase user by email
            cur.execute("""
                SELECT id FROM users WHERE LOWER(email) = %s
            """, (form['email'].lower(),))
            user_result = cur.fetchone()

            if not user_result:
                continue  # User not yet in Supabase

            supabase_user_id = user_result['id']

            # Find their application
            cur.execute("""
                SELECT id FROM applications
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (supabase_user_id,))
            app_result = cur.fetchone()

            if not app_result:
                continue  # No application yet

            app_id = app_result['id']

            # Check if Medical History Form is properly uploaded
            cur.execute("""
                SELECT ar.id, ar.file_id, ar.response_value, f.id as file_exists
                FROM application_responses ar
                LEFT JOIN files f ON f.id = ar.file_id
                WHERE ar.application_id = %s AND ar.question_id = %s
            """, (app_id, question_id))
            response_result = cur.fetchone()

            # Check if file is missing or orphaned
            needs_upload = False
            response_id = None

            if response_result:
                response_id = response_result['id']
                if response_result['file_id'] and response_result['file_exists']:
                    # Properly linked - skip
                    continue
                elif response_result['file_id'] is None and response_result['response_value']:
                    # Orphaned UUID - needs fix
                    needs_upload = True
                elif response_result['file_id'] and not response_result['file_exists']:
                    # File record missing - needs fix
                    needs_upload = True
            else:
                # No response at all - needs upload
                needs_upload = True

            if needs_upload:
                # Check if local file exists
                if os.path.exists(form['local_path']):
                    missing.append({
                        **form,
                        'supabase_user_id': str(supabase_user_id),
                        'application_id': str(app_id),
                        'question_id': str(question_id),
                        'response_id': str(response_id) if response_id else None,
                    })
                else:
                    print(f"  WARNING: Local file not found: {form['local_path']}")

    print(f"  Found {len(missing)} applications needing Medical History Form upload")
    return missing


def sanitize_filename(filename):
    """Remove special characters from filename that Supabase doesn't like"""
    import re
    # Replace problematic characters with safe alternatives
    # Keep alphanumeric, dash, underscore, dot
    sanitized = re.sub(r'[^\w\-_.]', '_', filename)
    # Remove consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    return sanitized


def upload_file_to_supabase_direct(supabase_url, supabase_key, file_path, storage_path, content_type):
    """Upload a file to Supabase storage using requests (avoids SDK HTTP/2 bugs)"""
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    import time

    with open(file_path, 'rb') as f:
        file_data = f.read()

    file_size_mb = len(file_data) / (1024 * 1024)
    print(f"  File size: {file_size_mb:.2f} MB, content-type: {content_type}")

    # Use requests library directly (HTTP/1.1, more reliable for large files)
    url = f"{supabase_url}/storage/v1/object/{BUCKET_NAME}/{storage_path}"

    headers = {
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': content_type,
        'x-upsert': 'true',
    }

    # Create session with retry strategy for large files
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=2, status_forcelist=[500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries))

    # For large files (>5MB), use longer timeout
    timeout = 600 if file_size_mb > 5 else 300

    for attempt in range(3):
        try:
            print(f"  Upload attempt {attempt + 1}/3...")
            response = session.post(url, data=file_data, headers=headers, timeout=timeout)

            if response.status_code in [200, 201]:
                print(f"  Upload successful: {response.status_code}")
                return {'path': storage_path}
            else:
                print(f"  Upload failed: {response.status_code} - {response.text}")
                if attempt < 2:
                    time.sleep(5)  # Wait before retry
                    continue
                raise Exception(f"Upload failed: {response.status_code} - {response.text}")
        except requests.exceptions.RequestException as e:
            print(f"  Attempt {attempt + 1} failed: {e}")
            if attempt < 2:
                time.sleep(5)
                continue
            raise


def migrate_medical_forms(conn, supabase_url, supabase_key, missing_uploads, dry_run=False):
    """Upload missing medical forms and create database records"""
    results = {
        'success': [],
        'failed': [],
    }

    for upload in missing_uploads:
        print(f"\nProcessing: {upload['camper_name']} ({upload['email']})")
        print(f"  Application: {upload['application_id']}")
        print(f"  Local file: {upload['local_path']}")

        if dry_run:
            print("  [DRY RUN] Would upload and create records")
            results['success'].append(upload)
            continue

        try:
            # Generate file ID and storage path
            file_id = str(uuid.uuid4())
            original_filename = os.path.basename(upload['local_path'])
            safe_filename = sanitize_filename(original_filename)
            storage_path = f"applications/{upload['application_id']}/{upload['question_id']}/{file_id}_{safe_filename}"

            # Upload to Supabase storage
            print(f"  Uploading to: {storage_path}")
            upload_file_to_supabase_direct(
                supabase_url,
                supabase_key,
                upload['local_path'],
                storage_path,
                upload['mime_type']
            )

            # Create file record in database
            file_size = os.path.getsize(upload['local_path'])

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO files (id, application_id, uploaded_by, file_name, storage_path, file_size, file_type, section)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    file_id,
                    upload['application_id'],
                    upload['supabase_user_id'],
                    safe_filename,
                    storage_path,
                    file_size,
                    upload['mime_type'],
                    'Medical History'
                ))

                # Update or create application response
                if upload['response_id']:
                    # Update existing response
                    cur.execute("""
                        UPDATE application_responses
                        SET file_id = %s, response_value = NULL, updated_at = NOW()
                        WHERE id = %s
                    """, (file_id, upload['response_id']))
                else:
                    # Create new response
                    cur.execute("""
                        INSERT INTO application_responses (application_id, question_id, file_id)
                        VALUES (%s, %s, %s)
                    """, (upload['application_id'], upload['question_id'], file_id))

                conn.commit()

            print(f"  ✓ Success! File ID: {file_id}")
            results['success'].append(upload)

        except Exception as e:
            print(f"  ✗ Failed: {e}")
            conn.rollback()
            results['failed'].append({**upload, 'error': str(e)})

    return results


def load_env_file(env_path):
    """Load environment variables from a .env file"""
    env_vars = {}
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip()
                # Strip surrounding quotes if present
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                env_vars[key.strip()] = value
    return env_vars


def main():
    parser = argparse.ArgumentParser(description='Migrate missing Medical History Forms to Supabase')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without executing')
    parser.add_argument('--prod', action='store_true', help='Use production credentials from backend/.env')
    parser.add_argument('--database-url', help='PostgreSQL connection URL')
    parser.add_argument('--supabase-url', help='Supabase project URL')
    parser.add_argument('--supabase-key', help='Supabase service role key')
    args = parser.parse_args()

    # Load from .env file if --prod flag is used
    if args.prod:
        env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
        env_vars = load_env_file(env_path)
        args.database_url = env_vars.get('DATABASE_PROD_URL')
        args.supabase_url = env_vars.get('SUPABASE_PROD_URL')
        args.supabase_key = env_vars.get('SUPABASE_PROD_KEY')
        print("Using PRODUCTION credentials from backend/.env")

    # Validate required args
    if not all([args.database_url, args.supabase_url, args.supabase_key]):
        parser.error("Either use --prod flag or provide all three: --database-url, --supabase-url, --supabase-key")

    print("=" * 60)
    print("Medical History Form Migration Script")
    print("=" * 60)

    if args.dry_run:
        print("\n*** DRY RUN MODE - No changes will be made ***\n")

    # Load WordPress data
    campers, wp_user_to_email = load_wordpress_data()

    # Find campers with medical forms
    medical_forms = find_campers_with_medical_forms(campers, wp_user_to_email)

    # Connect to database
    print("\nConnecting to database...")
    conn = get_db_connection(args.database_url)

    # Initialize Supabase client
    print("Connecting to Supabase...")
    supabase = create_client(args.supabase_url, args.supabase_key)

    # Find missing uploads
    print("\nFinding missing uploads...")
    missing_uploads = find_missing_uploads(conn, medical_forms)

    if not missing_uploads:
        print("\n✓ No missing Medical History Form uploads found!")
        conn.close()
        return

    print("\n" + "=" * 60)
    print(f"Found {len(missing_uploads)} missing uploads:")
    print("=" * 60)
    for upload in missing_uploads:
        print(f"  - {upload['camper_name']} ({upload['email']})")

    # Migrate files
    print("\n" + "=" * 60)
    print("Migrating files...")
    print("=" * 60)
    results = migrate_medical_forms(conn, args.supabase_url, args.supabase_key, missing_uploads, dry_run=args.dry_run)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Successful: {len(results['success'])}")
    print(f"  Failed: {len(results['failed'])}")

    if results['failed']:
        print("\nFailed uploads:")
        for failed in results['failed']:
            print(f"  - {failed['camper_name']}: {failed['error']}")

    conn.close()
    print("\nDone!")


if __name__ == '__main__':
    main()
