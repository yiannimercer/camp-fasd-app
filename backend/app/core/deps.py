"""
Dependency injection for FastAPI routes
Supports both Supabase Auth JWTs and legacy custom JWTs for backward compatibility
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User

# HTTP Bearer token security scheme
security = HTTPBearer()


def decode_supabase_token(token: str) -> Optional[str]:
    """
    Decode a Supabase JWT and return the user ID (sub claim).
    Supports both legacy HS256 tokens and new ES256 (ECC) tokens.

    Args:
        token: JWT token string from Supabase Auth

    Returns:
        Supabase auth user ID from token, or None if invalid
    """
    # First, try HS256 with legacy JWT secret (works for DEV and older PROD tokens)
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload.get("sub")
    except JWTError as e:
        print(f"HS256 decode failed: {e}, trying JWKS/ECC...")

    # If HS256 fails, try JWKS-based verification using PyJWT (for ECC keys)
    try:
        import jwt as pyjwt
        from jwt import PyJWKClient

        # Build JWKS URL from Supabase project URL
        project_ref = settings.SUPABASE_URL.replace("https://", "").split(".")[0]
        jwks_url = f"https://{project_ref}.supabase.co/auth/v1/.well-known/jwks.json"

        print(f"Attempting JWKS verification from: {jwks_url}")

        # Create client and get signing key
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and verify the token
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
        print(f"JWKS verification successful, sub: {payload.get('sub')}")
        return payload.get("sub")

    except ImportError as e:
        print(f"PyJWT import failed: {e}")
        return None
    except Exception as e:
        print(f"JWKS/ECC decode failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


def decode_legacy_token(token: str) -> Optional[str]:
    """
    Decode our legacy custom JWT and return the user ID.
    Kept for backward compatibility during migration.

    Args:
        token: Legacy JWT token string

    Returns:
        User ID from token, or None if invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload.get("sub")
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token.
    Supports both Supabase Auth tokens and legacy custom tokens.

    Args:
        credentials: Bearer token from Authorization header
        db: Database session

    Returns:
        User model instance

    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials
    user = None

    # Try Supabase token first (preferred method)
    supabase_user_id = decode_supabase_token(token)
    if supabase_user_id:
        # Look up user by Supabase auth ID
        user = db.query(User).filter(User.supabase_auth_id == supabase_user_id).first()

        # If not found by supabase_auth_id, the user might have just signed up
        # and the trigger hasn't run yet, or there's a sync issue
        if not user:
            print(f"User with supabase_auth_id {supabase_user_id} not found in database")

    # Fall back to legacy token if Supabase token didn't work
    if user is None:
        legacy_user_id = decode_legacy_token(token)
        if legacy_user_id:
            user = db.query(User).filter(User.id == legacy_user_id).first()

    # If still no user found, token is invalid
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (email verified)

    Args:
        current_user: Current user from token

    Returns:
        User model instance

    Raises:
        HTTPException: If user email is not verified
    """
    # For now, we'll allow unverified users
    # Uncomment below to require email verification
    # if not current_user.email_verified:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Email not verified"
    #     )
    return current_user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current user if they are admin or super_admin

    Args:
        current_user: Current user from token

    Returns:
        User model instance

    Raises:
        HTTPException: If user is not an admin
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_current_super_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current user if they are super_admin

    Args:
        current_user: Current user from token

    Returns:
        User model instance

    Raises:
        HTTPException: If user is not a super admin
    """
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return current_user
