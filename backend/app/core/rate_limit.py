"""
Rate limiting configuration for API endpoints.

Uses slowapi library for rate limiting based on IP address and/or user.

Rate limits help prevent:
- Brute force attacks on login/registration
- DDoS attacks
- Resource exhaustion
- API abuse

Usage:
    from app.core.rate_limit import limiter, rate_limit_exceeded_handler

    # In main.py:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

    # In route:
    @router.post("/login")
    @limiter.limit("5/minute")
    async def login(request: Request, ...):
        ...
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse
from typing import Optional


def get_user_or_ip(request: Request) -> str:
    """
    Get rate limit key based on user ID (if authenticated) or IP address.

    This allows authenticated users to have separate rate limits from
    anonymous users, and prevents one malicious user from affecting others.
    """
    # Try to get user ID from request state (set by auth middleware)
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"

    # Fall back to IP address
    return get_remote_address(request)


# Create limiter instance
# Uses IP address as the default key function
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],  # Default rate limit for all endpoints
    storage_uri="memory://",  # In-memory storage (use Redis for production scale)
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom handler for rate limit exceeded errors.

    Returns a user-friendly JSON response with retry information.
    """
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please wait and try again.",
            "retry_after": exc.detail,
        },
        headers={
            "Retry-After": str(getattr(exc, "retry_after", 60)),
        },
    )


# Rate limit configurations for different endpoint types
class RateLimits:
    """Predefined rate limit configurations."""

    # Authentication endpoints (strict limits to prevent brute force)
    AUTH_LOGIN = "5/minute"
    AUTH_REGISTER = "3/minute"
    AUTH_PASSWORD_RESET = "3/minute"
    AUTH_CHECK_EMAIL = "10/minute"

    # File operations (moderate limits for resource protection)
    FILE_UPLOAD = "10/minute"
    FILE_DOWNLOAD = "30/minute"

    # API operations (standard limits)
    API_READ = "60/minute"
    API_WRITE = "30/minute"

    # Admin operations (slightly higher limits for admin tasks)
    ADMIN_READ = "120/minute"
    ADMIN_WRITE = "60/minute"

    # Email operations (strict to prevent spam)
    EMAIL_SEND = "10/minute"
    EMAIL_MASS = "1/minute"

    # Public endpoints (strict to prevent abuse)
    PUBLIC = "30/minute"


def get_rate_limit_key_with_user(request: Request) -> str:
    """
    Alternative key function that includes user ID for per-user limiting.
    """
    return get_user_or_ip(request)
