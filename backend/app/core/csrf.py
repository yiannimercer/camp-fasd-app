"""
CSRF Protection Middleware

This middleware helps prevent Cross-Site Request Forgery attacks by requiring
an X-Requested-With header for state-changing requests (POST, PUT, DELETE, PATCH).

How it works:
1. Browsers include the Origin header on cross-origin requests
2. XMLHttpRequest/fetch can set custom headers only from same-origin or with CORS permission
3. Forms cannot set custom headers, so CSRF attacks via form submission are blocked

This is a defense-in-depth measure that works alongside:
- CORS restrictions (limit which origins can make requests)
- JWT authentication (validates user identity)
- SameSite cookies (if using cookie-based sessions)
"""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Callable


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to protect against CSRF attacks.

    Requires X-Requested-With header for state-changing requests.
    This header cannot be set by simple HTML forms, providing CSRF protection.
    """

    # HTTP methods that change state and require CSRF protection
    PROTECTED_METHODS = {"POST", "PUT", "DELETE", "PATCH"}

    # Paths that should be exempt from CSRF protection
    # (e.g., authentication endpoints that need to work from external OAuth flows)
    EXEMPT_PATHS = {
        "/api/auth/google",          # Google OAuth callback
        "/api/auth/login",           # Login endpoint
        "/api/auth/register",        # Registration endpoint
        "/api/auth/check-legacy-user",  # Legacy user check
        "/api/auth/mark-password-set",  # Password migration
        "/api/webhooks/stripe",      # Stripe webhooks (has its own signature verification)
        "/api/cron/",                # Cron jobs (have their own auth)
    }

    # Health check and public endpoints
    SAFE_PATHS = {
        "/",
        "/api/health",
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
        "/api/public/",
    }

    def __init__(self, app, debug: bool = False):
        super().__init__(app)
        self.debug = debug

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
        if request.method not in self.PROTECTED_METHODS:
            return await call_next(request)

        # Skip CSRF check for exempt paths
        path = request.url.path
        for exempt_path in self.EXEMPT_PATHS:
            if path.startswith(exempt_path):
                return await call_next(request)

        # Skip CSRF check for safe/public paths
        for safe_path in self.SAFE_PATHS:
            if path.startswith(safe_path):
                return await call_next(request)

        # In debug mode, allow requests without CSRF header
        if self.debug:
            return await call_next(request)

        # Require X-Requested-With header for CSRF protection
        x_requested_with = request.headers.get("X-Requested-With", "")

        if x_requested_with.lower() != "xmlhttprequest":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF validation failed: Missing or invalid X-Requested-With header"
            )

        return await call_next(request)
