"""
Dependency injection for FastAPI routes
Supports both Supabase Auth JWTs and legacy custom JWTs for backward compatibility
"""

from typing import Optional
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError, jwk
from jose.exceptions import JWKError
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User

# HTTP Bearer token security scheme
security = HTTPBearer()

# Cache for JWKS to avoid fetching on every request
_jwks_cache = None
_jwks_cache_time = 0
JWKS_CACHE_TTL = 3600  # 1 hour


def get_supabase_jwks():
    """
    Fetch JWKS from Supabase for ES256 token verification.
    Caches the result to avoid repeated HTTP calls.
    """
    global _jwks_cache, _jwks_cache_time
    import time

    current_time = time.time()
    if _jwks_cache and (current_time - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache

    try:
        # Extract project ref from SUPABASE_URL
        # URL format: https://<project-ref>.supabase.co
        project_ref = settings.SUPABASE_URL.replace("https://", "").split(".")[0]
        jwks_url = f"https://{project_ref}.supabase.co/auth/v1/.well-known/jwks.json"

        response = httpx.get(jwks_url, timeout=10)
        if response.status_code == 200:
            _jwks_cache = response.json()
            _jwks_cache_time = current_time
            return _jwks_cache
    except Exception as e:
        print(f"Failed to fetch JWKS: {e}")

    return None


def decode_supabase_token(token: str) -> Optional[str]:
    """
    Decode a Supabase JWT and return the user ID (sub claim).
    Supports both legacy HS256 tokens and new ES256 (ECC) tokens.

    Args:
        token: JWT token string from Supabase Auth

    Returns:
        Supabase auth user ID from token, or None if invalid
    """
    # First, try decoding with the legacy HS256 secret
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload.get("sub")
    except JWTError as e:
        print(f"HS256 decode failed: {e}, trying JWKS...")

    # If HS256 fails, try JWKS-based verification (ES256)
    try:
        # Get the unverified header to find the key ID
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        alg = unverified_header.get("alg", "ES256")

        print(f"Token uses algorithm: {alg}, kid: {kid}")

        jwks = get_supabase_jwks()
        if not jwks:
            print("Could not fetch JWKS")
            return None

        # Find the matching key
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid or kid is None:
                try:
                    public_key = jwk.construct(key)
                    break
                except JWKError as e:
                    print(f"Failed to construct key: {e}")
                    continue

        if not public_key:
            print(f"No matching key found for kid: {kid}")
            return None

        # Verify and decode the token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[alg, "ES256", "RS256"],
            audience="authenticated",
        )
        return payload.get("sub")

    except JWTError as e:
        print(f"JWKS decode also failed: {e}")
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
