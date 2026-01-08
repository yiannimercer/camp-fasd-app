"""
Audit Logging Utilities

Provides a reusable helper for recording audit log entries.
Usage:
    from app.core.audit import log_audit_event

    log_audit_event(
        db=db,
        entity_type="application",
        action="status_changed",
        actor_id=current_user.id,
        entity_id=application.id,
        details={"old_status": "applicant", "new_status": "camper"},
        request=request  # Optional - extracts IP and user agent
    )
"""

from typing import Optional, Any, Dict
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import Request
from app.models.super_admin import AuditLog


# Entity type constants (maps to frontend "category")
ENTITY_USER = "user"
ENTITY_APPLICATION = "application"
ENTITY_SYSTEM = "system"
ENTITY_EMAIL = "email"
ENTITY_SECURITY = "security"
ENTITY_TEAM = "team"
ENTITY_CONFIGURATION = "configuration"
ENTITY_EMAIL_TEMPLATE = "email_template"

# Action constants
# User actions
ACTION_USER_CREATED = "user_created"
ACTION_USER_UPDATED = "user_updated"
ACTION_ROLE_CHANGED = "role_changed"
ACTION_STATUS_CHANGED = "status_changed"

# Application actions
ACTION_APPLICATION_CREATED = "application_created"
ACTION_APPLICATION_UPDATED = "application_updated"
ACTION_RESPONSES_SAVED = "responses_saved"
ACTION_STATUS_PROMOTED = "status_promoted"
ACTION_STATUS_WAITLISTED = "status_waitlisted"
ACTION_STATUS_DEFERRED = "status_deferred"
ACTION_STATUS_WITHDRAWN = "status_withdrawn"
ACTION_STATUS_REJECTED = "status_rejected"
ACTION_STATUS_REACTIVATED = "status_reactivated"
ACTION_TEAM_APPROVED = "team_approved"
ACTION_TEAM_DECLINED = "team_declined"
ACTION_NOTE_ADDED = "note_added"
ACTION_NOTE_DELETED = "note_deleted"
ACTION_CABIN_ASSIGNED = "cabin_assigned"

# Security actions
ACTION_LOGIN_SUCCESS = "login_success"
ACTION_LOGIN_FAILED = "login_failed"
ACTION_PASSWORD_CHANGED = "password_changed"
ACTION_PASSWORD_RESET = "password_reset"
ACTION_TOKEN_REFRESHED = "token_refreshed"
ACTION_LOGOUT = "logout"

# System actions
ACTION_ANNUAL_RESET = "annual_reset"
ACTION_CONFIG_UPDATED = "config_updated"
ACTION_TEMPLATE_UPDATED = "template_updated"

# Team actions
ACTION_TEAM_CREATED = "team_created"
ACTION_TEAM_UPDATED = "team_updated"


def log_audit_event(
    db: Session,
    entity_type: str,
    action: str,
    actor_id: Optional[UUID] = None,
    entity_id: Optional[UUID] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> AuditLog:
    """
    Log an audit event to the database.

    Args:
        db: Database session
        entity_type: Type of entity (user, application, system, security, etc.)
        action: The action performed
        actor_id: ID of the user performing the action (None for system events)
        entity_id: ID of the affected entity (None for general events)
        details: Additional details as a dictionary (stored as JSONB)
        request: FastAPI request object (for extracting IP and user agent)
        ip_address: Override IP address (if not using request)
        user_agent: Override user agent (if not using request)

    Returns:
        The created AuditLog object
    """
    # Extract IP and user agent from request if provided
    if request:
        if not ip_address:
            # Try to get real IP from X-Forwarded-For header (for proxied requests)
            forwarded_for = request.headers.get("x-forwarded-for")
            if forwarded_for:
                ip_address = forwarded_for.split(",")[0].strip()
            elif request.client:
                ip_address = request.client.host

        if not user_agent:
            user_agent = request.headers.get("user-agent")

    audit_log = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )

    db.add(audit_log)
    db.commit()

    return audit_log


def log_user_event(
    db: Session,
    action: str,
    user_id: UUID,
    actor_id: Optional[UUID] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> AuditLog:
    """Convenience wrapper for user-related audit events."""
    return log_audit_event(
        db=db,
        entity_type=ENTITY_USER,
        action=action,
        entity_id=user_id,
        actor_id=actor_id,
        details=details,
        request=request
    )


def log_application_event(
    db: Session,
    action: str,
    application_id: UUID,
    actor_id: Optional[UUID] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> AuditLog:
    """Convenience wrapper for application-related audit events."""
    return log_audit_event(
        db=db,
        entity_type=ENTITY_APPLICATION,
        action=action,
        entity_id=application_id,
        actor_id=actor_id,
        details=details,
        request=request
    )


def log_security_event(
    db: Session,
    action: str,
    actor_id: Optional[UUID] = None,
    entity_id: Optional[UUID] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> AuditLog:
    """Convenience wrapper for security-related audit events."""
    return log_audit_event(
        db=db,
        entity_type=ENTITY_SECURITY,
        action=action,
        entity_id=entity_id,
        actor_id=actor_id,
        details=details,
        request=request
    )


def log_system_event(
    db: Session,
    action: str,
    actor_id: Optional[UUID] = None,
    entity_id: Optional[UUID] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> AuditLog:
    """Convenience wrapper for system-related audit events."""
    return log_audit_event(
        db=db,
        entity_type=ENTITY_SYSTEM,
        action=action,
        entity_id=entity_id,
        actor_id=actor_id,
        details=details,
        request=request
    )
