"""
Authentication API endpoints
"""

from datetime import datetime
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.deps import get_current_user
from app.core.audit import (
    log_security_event, log_user_event,
    ACTION_LOGIN_SUCCESS, ACTION_LOGIN_FAILED, ACTION_USER_CREATED, ACTION_LOGOUT
)
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse, ProfileUpdate
from app.services import supabase_admin_service
from pydantic import BaseModel, EmailStr

router = APIRouter()


class CheckLegacyUserRequest(BaseModel):
    """Request to check if a user is a legacy user needing password setup"""
    email: EmailStr


class CheckLegacyUserResponse(BaseModel):
    """Response indicating if user needs password setup"""
    exists: bool
    is_legacy_user: bool
    needs_password_setup: bool
    password_reset_sent: bool = False
    message: str = ""


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Register a new user

    - **email**: Valid email address
    - **password**: Password (min 8 characters)
    - **first_name**: User's first name (optional)
    - **last_name**: User's last name (optional)
    - **phone**: Phone number (optional)
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        role="user",  # Default role
        email_verified=False
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Log user registration
    log_user_event(
        db=db,
        action=ACTION_USER_CREATED,
        user_id=db_user.id,
        actor_id=db_user.id,  # User created themselves
        details={"email": db_user.email, "registration_method": "email"},
        request=request
    )

    # Create access token
    access_token = create_access_token(subject=str(db_user.id))

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(db_user)
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Login with email and password

    - **email**: User's email address
    - **password**: User's password

    Returns JWT access token and user information
    """
    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not user.password_hash:
        # Log failed login attempt (user not found)
        log_security_event(
            db=db,
            action=ACTION_LOGIN_FAILED,
            details={"email": credentials.email, "reason": "user_not_found"},
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        # Log failed login attempt (wrong password)
        log_security_event(
            db=db,
            action=ACTION_LOGIN_FAILED,
            actor_id=user.id,
            entity_id=user.id,
            details={"email": credentials.email, "reason": "invalid_password"},
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    # Log successful login
    log_security_event(
        db=db,
        action=ACTION_LOGIN_SUCCESS,
        actor_id=user.id,
        entity_id=user.id,
        details={"email": user.email},
        request=request
    )

    # Create access token
    access_token = create_access_token(subject=str(user.id))

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/check-legacy-user", response_model=CheckLegacyUserResponse)
async def check_legacy_user(
    request_data: CheckLegacyUserRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Check if an email belongs to a legacy user who needs to set their password.

    This endpoint is called during login to provide a seamless experience for
    users migrated from the legacy WordPress system. If the user is a legacy
    user who hasn't set their password yet, it automatically sends them a
    password reset email.

    - **email**: Email address to check

    Returns:
        - exists: Whether a user with this email exists
        - is_legacy_user: Whether this is a migrated legacy user
        - needs_password_setup: Whether they need to set their password
        - password_reset_sent: Whether a password reset email was sent
        - message: User-friendly message to display
    """
    email = request_data.email.lower().strip()

    # Find user by email (case-insensitive)
    user = db.query(User).filter(User.email.ilike(email)).first()

    if not user:
        return CheckLegacyUserResponse(
            exists=False,
            is_legacy_user=False,
            needs_password_setup=False,
            message=""
        )

    # Check if this is a legacy user who needs password setup
    is_legacy = user.legacy_wp_user_id is not None
    needs_setup = getattr(user, 'needs_password_setup', False) or False

    if is_legacy and needs_setup:
        # Derive redirect URL from request origin so it works across all environments
        # (localhost, app-dev.fasdcamp.org, app.fasdcamp.org)
        origin = request.headers.get('origin') or request.headers.get('referer', '').rstrip('/')
        if origin:
            # Strip any path from referer, keep just the origin
            parsed = urlparse(origin)
            origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else None

        redirect_url = f"{origin}/auth/reset-password" if origin else None

        # Automatically send password reset email via Supabase
        reset_result = supabase_admin_service.send_password_reset(email, redirect_url=redirect_url)

        if reset_result.get('success'):
            return CheckLegacyUserResponse(
                exists=True,
                is_legacy_user=True,
                needs_password_setup=True,
                password_reset_sent=True,
                message="Welcome back! We've upgraded to a new system. Please check your email to set your new password."
            )
        else:
            return CheckLegacyUserResponse(
                exists=True,
                is_legacy_user=True,
                needs_password_setup=True,
                password_reset_sent=False,
                message="Welcome back! We've upgraded to a new system. Please use 'Forgot Password' to set your new password."
            )

    # Regular user or legacy user who already set their password
    return CheckLegacyUserResponse(
        exists=True,
        is_legacy_user=is_legacy,
        needs_password_setup=False,
        message=""
    )


@router.post("/mark-password-set")
async def mark_password_set(
    request_data: CheckLegacyUserRequest,
    db: Session = Depends(get_db)
):
    """
    Mark a legacy user's password as set after they complete the reset flow.

    This is called after a successful password reset to update the
    needs_password_setup flag so they won't be prompted again.
    """
    email = request_data.email.lower().strip()

    user = db.query(User).filter(User.email.ilike(email)).first()

    if user and getattr(user, 'needs_password_setup', False):
        user.needs_password_setup = False
        user.updated_at = datetime.utcnow()
        db.commit()
        return {"success": True, "message": "Password setup marked as complete"}

    return {"success": True, "message": "No update needed"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user information

    Requires authentication (Bearer token in Authorization header)
    """
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout (client should discard token)

    Note: JWT tokens are stateless, so logout is handled client-side
    by removing the token from storage.
    """
    return {"message": "Successfully logged out"}


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update current user's profile

    - **first_name**: User's first name
    - **last_name**: User's last name
    - **phone**: Phone number
    - **receive_emails**: Email notification preference
    """
    # Update fields if provided
    if profile_data.first_name is not None:
        current_user.first_name = profile_data.first_name
    if profile_data.last_name is not None:
        current_user.last_name = profile_data.last_name
    if profile_data.phone is not None:
        current_user.phone = profile_data.phone
    if profile_data.receive_emails is not None:
        current_user.receive_emails = profile_data.receive_emails

    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)

    return UserResponse.model_validate(current_user)
