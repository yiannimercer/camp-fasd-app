#!/usr/bin/env python3
"""
Cleanup script to remove test migration user data.
Run this before re-testing the migration.

Usage:
    python scripts/cleanup_test_user.py yjmercer@gmail.com
"""

import os
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from supabase import create_client, Client


def cleanup_user(email: str):
    """Remove all data for a user by email."""
    db_url = os.environ.get('DATABASE_URL')
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY')

    if not all([db_url, supabase_url, supabase_key]):
        print("ERROR: Missing environment variables. Check backend/.env")
        sys.exit(1)

    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    supabase: Client = create_client(supabase_url, supabase_key)

    print(f"\n{'='*60}")
    print(f"Cleaning up user: {email}")
    print(f"{'='*60}\n")

    with Session() as session:
        # 1. Find user in our users table
        result = session.execute(
            text("SELECT id, supabase_auth_id FROM users WHERE LOWER(email) = LOWER(:email)"),
            {'email': email}
        )
        user_row = result.fetchone()

        if user_row:
            user_id = str(user_row[0])
            supabase_auth_id = str(user_row[1]) if user_row[1] else None
            print(f"Found user: {user_id}")
            print(f"Supabase auth ID: {supabase_auth_id}")

            # 2. Find all applications for this user
            result = session.execute(
                text("SELECT id FROM applications WHERE user_id = :user_id"),
                {'user_id': user_id}
            )
            app_ids = [str(row[0]) for row in result.fetchall()]
            print(f"Found {len(app_ids)} applications")

            # 3. Delete application_responses for these applications
            for app_id in app_ids:
                result = session.execute(
                    text("DELETE FROM application_responses WHERE application_id = :app_id"),
                    {'app_id': app_id}
                )
                print(f"  Deleted {result.rowcount} responses for app {app_id}")

                # 4. Delete files for this application
                result = session.execute(
                    text("DELETE FROM files WHERE application_id = :app_id"),
                    {'app_id': app_id}
                )
                print(f"  Deleted {result.rowcount} files for app {app_id}")

                # 4b. Delete email_logs for this application
                result = session.execute(
                    text("DELETE FROM email_logs WHERE application_id = :app_id"),
                    {'app_id': app_id}
                )
                print(f"  Deleted {result.rowcount} email logs for app {app_id}")

            # 5. Delete applications
            result = session.execute(
                text("DELETE FROM applications WHERE user_id = :user_id"),
                {'user_id': user_id}
            )
            print(f"Deleted {result.rowcount} applications")

            # 5b. Delete email_logs for this user (not tied to applications)
            result = session.execute(
                text("DELETE FROM email_logs WHERE user_id = :user_id"),
                {'user_id': user_id}
            )
            print(f"Deleted {result.rowcount} user email logs")

            # 5c. Delete audit_logs for this user
            result = session.execute(
                text("DELETE FROM audit_logs WHERE actor_id = :user_id"),
                {'user_id': user_id}
            )
            print(f"Deleted {result.rowcount} audit logs")

            # 6. Delete user record
            result = session.execute(
                text("DELETE FROM users WHERE id = :user_id"),
                {'user_id': user_id}
            )
            print(f"Deleted user record")

            session.commit()

            # 7. Delete from Supabase Auth
            if supabase_auth_id:
                try:
                    supabase.auth.admin.delete_user(supabase_auth_id)
                    print(f"Deleted Supabase auth user: {supabase_auth_id}")
                except Exception as e:
                    print(f"Warning: Could not delete Supabase auth user: {e}")
        else:
            print(f"No user found with email: {email}")

            # Still try to clean up Supabase Auth in case it exists there
            try:
                # List users and find by email
                users_response = supabase.auth.admin.list_users()
                for user in users_response:
                    if hasattr(user, 'email') and user.email.lower() == email.lower():
                        supabase.auth.admin.delete_user(user.id)
                        print(f"Deleted orphaned Supabase auth user: {user.id}")
                        break
            except Exception as e:
                print(f"Could not search Supabase auth: {e}")

    print(f"\n{'='*60}")
    print("Cleanup complete!")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scripts/cleanup_test_user.py <email>")
        sys.exit(1)

    cleanup_user(sys.argv[1])
