"""
Supabase Admin Service
Handles privileged user management operations using the Supabase Admin API

This service uses the service_role key to perform admin operations like:
- Creating users with invitations
- Banning/unbanning users (suspend/activate)
- Deleting users from Supabase Auth
- Sending password reset emails
- Resending invitation emails

Documentation: https://supabase.com/docs/reference/python/auth-admin-createuser
"""

from typing import Optional, Dict, Any
from supabase import create_client, Client
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.config import get_settings
from ..models.user import User

settings = get_settings()

# Initialize Supabase Admin client with service_role key
# The service_role key has admin privileges and bypasses RLS
_supabase_admin: Optional[Client] = None


def get_supabase_admin() -> Client:
    """Get or create Supabase admin client with service_role key"""
    global _supabase_admin
    if _supabase_admin is None:
        _supabase_admin = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY  # This should be the service_role key in production
        )
    return _supabase_admin


def ban_user(supabase_auth_id: str) -> Dict[str, Any]:
    """
    Ban a user in Supabase Auth, preventing them from logging in.

    Args:
        supabase_auth_id: The Supabase auth.users.id (UUID)

    Returns:
        dict with success status and any error message
    """
    try:
        client = get_supabase_admin()
        # Update user to banned status
        response = client.auth.admin.update_user_by_id(
            supabase_auth_id,
            {"ban_duration": "876600h"}  # ~100 years = effectively permanent ban
        )
        return {
            'success': True,
            'user': response.user if response else None,
            'error': None
        }
    except Exception as e:
        return {
            'success': False,
            'user': None,
            'error': str(e)
        }


def unban_user(supabase_auth_id: str) -> Dict[str, Any]:
    """
    Unban a user in Supabase Auth, allowing them to log in again.

    Args:
        supabase_auth_id: The Supabase auth.users.id (UUID)

    Returns:
        dict with success status and any error message
    """
    try:
        client = get_supabase_admin()
        # Remove ban by setting ban_duration to "none"
        response = client.auth.admin.update_user_by_id(
            supabase_auth_id,
            {"ban_duration": "none"}
        )
        return {
            'success': True,
            'user': response.user if response else None,
            'error': None
        }
    except Exception as e:
        return {
            'success': False,
            'user': None,
            'error': str(e)
        }


def delete_auth_user(supabase_auth_id: str) -> Dict[str, Any]:
    """
    Delete a user from Supabase Auth.
    Note: This only deletes from auth.users, not from our public.users table.

    Args:
        supabase_auth_id: The Supabase auth.users.id (UUID)

    Returns:
        dict with success status and any error message
    """
    try:
        client = get_supabase_admin()
        client.auth.admin.delete_user(supabase_auth_id)
        return {
            'success': True,
            'error': None
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def send_password_reset(email: str) -> Dict[str, Any]:
    """
    Generate and send a password reset email to the user.
    Uses Supabase's built-in password reset flow.

    Args:
        email: User's email address

    Returns:
        dict with success status and any error message
    """
    try:
        client = get_supabase_admin()
        # Generate a password reset link - this sends an email automatically
        response = client.auth.admin.generate_link({
            "type": "recovery",
            "email": email,
            "options": {
                "redirect_to": f"{settings.FRONTEND_URL}/auth/reset-password"
            }
        })
        return {
            'success': True,
            'link': response.properties.action_link if response and response.properties else None,
            'error': None
        }
    except Exception as e:
        return {
            'success': False,
            'link': None,
            'error': str(e)
        }


def create_user_with_invitation(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    role: str = 'user',
    team: Optional[str] = None,
    phone: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new user in Supabase Auth and send them an invitation email.
    The user will need to set their password via the invitation link.

    Args:
        email: User's email address
        first_name: User's first name (optional)
        last_name: User's last name (optional)
        role: User role (user, admin, super_admin)
        team: Team assignment for admins (optional)
        phone: User's phone number (optional)

    Returns:
        dict with success status, user data, and any error message
    """
    try:
        client = get_supabase_admin()

        # Create user with invite - Supabase sends the invitation email
        response = client.auth.admin.invite_user_by_email(
            email,
            options={
                "data": {
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role,
                    "team": team,
                    "phone": phone
                },
                "redirect_to": f"{settings.FRONTEND_URL}/auth/set-password"
            }
        )

        return {
            'success': True,
            'user': response.user if response else None,
            'error': None
        }
    except Exception as e:
        error_msg = str(e)
        # Check for common errors
        if "already been registered" in error_msg.lower() or "already exists" in error_msg.lower():
            return {
                'success': False,
                'user': None,
                'error': 'A user with this email already exists'
            }
        return {
            'success': False,
            'user': None,
            'error': error_msg
        }


def resend_invitation(email: str) -> Dict[str, Any]:
    """
    Resend an invitation email to a user who hasn't completed signup.

    Args:
        email: User's email address

    Returns:
        dict with success status and any error message
    """
    try:
        client = get_supabase_admin()

        # Generate a new invite link - this will resend the invitation
        response = client.auth.admin.generate_link({
            "type": "invite",
            "email": email,
            "options": {
                "redirect_to": f"{settings.FRONTEND_URL}/auth/set-password"
            }
        })

        return {
            'success': True,
            'link': response.properties.action_link if response and response.properties else None,
            'error': None
        }
    except Exception as e:
        return {
            'success': False,
            'link': None,
            'error': str(e)
        }


def get_auth_user(supabase_auth_id: str) -> Dict[str, Any]:
    """
    Get user details from Supabase Auth.

    Args:
        supabase_auth_id: The Supabase auth.users.id (UUID)

    Returns:
        dict with success status, user data, and any error message
    """
    try:
        client = get_supabase_admin()
        response = client.auth.admin.get_user_by_id(supabase_auth_id)
        return {
            'success': True,
            'user': response.user if response else None,
            'error': None
        }
    except Exception as e:
        return {
            'success': False,
            'user': None,
            'error': str(e)
        }


def cascade_delete_user(db: Session, user_id: str, supabase_auth_id: Optional[str]) -> Dict[str, Any]:
    """
    Fully delete a user and all their associated data.

    This performs a cascade delete:
    1. Delete from Supabase Auth (if supabase_auth_id exists)
    2. Delete user's applications and all related data (responses, files, notes, etc.)
    3. Delete the user record from our database

    Args:
        db: Database session
        user_id: Our internal user ID
        supabase_auth_id: The Supabase auth.users.id (can be None for legacy users)

    Returns:
        dict with success status, deletion summary, and any error message
    """
    summary = {
        'supabase_auth_deleted': False,
        'applications_deleted': 0,
        'files_deleted': 0,
        'user_deleted': False,
        'errors': []
    }

    try:
        # Step 1: Delete from Supabase Auth if applicable
        if supabase_auth_id:
            auth_result = delete_auth_user(str(supabase_auth_id))
            if auth_result['success']:
                summary['supabase_auth_deleted'] = True
            else:
                summary['errors'].append(f"Supabase Auth deletion failed: {auth_result['error']}")

        # Step 2: Get applications for this user
        from ..models.application import Application, File
        from ..services import storage_service

        applications = db.query(Application).filter(Application.user_id == user_id).all()

        for app in applications:
            # Delete files from storage
            files = db.query(File).filter(File.application_id == app.id).all()
            for file in files:
                if file.storage_path:
                    try:
                        storage_service.delete_file(file.storage_path)
                        summary['files_deleted'] += 1
                    except Exception as e:
                        summary['errors'].append(f"File deletion error: {str(e)}")

            # Delete email logs for this application
            db.execute(
                text("DELETE FROM email_logs WHERE application_id = :app_id"),
                {'app_id': str(app.id)}
            )

            # Delete the application (CASCADE handles related records)
            db.delete(app)
            summary['applications_deleted'] += 1

        # Step 3: Delete email logs for this user (not tied to applications)
        db.execute(
            text("DELETE FROM email_logs WHERE user_id = :user_id"),
            {'user_id': user_id}
        )

        # Step 4: Delete audit logs where this user is the actor
        db.execute(
            text("DELETE FROM audit_logs WHERE actor_id = :user_id"),
            {'user_id': user_id}
        )

        # Step 5: Delete the user record
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.delete(user)
            summary['user_deleted'] = True

        db.commit()

        return {
            'success': True,
            'summary': summary,
            'error': None
        }

    except Exception as e:
        db.rollback()
        summary['errors'].append(str(e))
        return {
            'success': False,
            'summary': summary,
            'error': str(e)
        }
