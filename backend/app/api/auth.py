"""
Authentication API endpoints
"""

from datetime import datetime
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

router = APIRouter()


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
