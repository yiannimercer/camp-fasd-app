"""
Standardized exception handling for security.

This module provides utilities for secure error handling that:
1. Logs full error details server-side for debugging
2. Returns only sanitized messages to clients
3. Uses correlation IDs to link client errors to server logs
4. Prevents information leakage through error messages
"""

import uuid
import logging
import traceback
from typing import Optional, Any
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# Configure logging
logger = logging.getLogger("camp_fasd.errors")


def generate_correlation_id() -> str:
    """Generate a unique correlation ID for error tracking."""
    return f"err_{uuid.uuid4().hex[:12]}"


class SecureHTTPException(HTTPException):
    """
    HTTP exception that separates internal details from client-facing messages.

    Usage:
        raise SecureHTTPException(
            status_code=500,
            detail="Something went wrong",  # This goes to client
            internal_message="Database connection failed: {e}",  # This goes to logs
            extra_data={"user_id": user.id}  # Additional context for logs
        )
    """
    def __init__(
        self,
        status_code: int,
        detail: str,
        internal_message: Optional[str] = None,
        extra_data: Optional[dict] = None,
        headers: Optional[dict] = None,
    ):
        self.internal_message = internal_message or detail
        self.extra_data = extra_data or {}
        self.correlation_id = generate_correlation_id()
        super().__init__(status_code=status_code, detail=detail, headers=headers)


def log_error(
    correlation_id: str,
    message: str,
    exception: Optional[Exception] = None,
    extra_data: Optional[dict] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Log an error with full details server-side.

    Args:
        correlation_id: Unique ID for tracking this error
        message: Human-readable error description
        exception: The exception that occurred (if any)
        extra_data: Additional context (user_id, endpoint, etc.)
        request: The FastAPI request object (if available)
    """
    log_data = {
        "correlation_id": correlation_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "error_message": message,  # Note: "message" is reserved by Python's LogRecord
    }

    if extra_data:
        log_data["extra"] = extra_data

    if request:
        log_data["request"] = {
            "method": request.method,
            "path": str(request.url.path),
            "client_ip": request.client.host if request.client else None,
        }

    if exception:
        log_data["exception"] = {
            "type": type(exception).__name__,
            "message": str(exception),
            "traceback": traceback.format_exc(),
        }

    logger.error(f"[{correlation_id}] {message}", extra=log_data)


def sanitize_error_response(
    status_code: int,
    correlation_id: str,
    user_message: str,
    debug_mode: bool = False,
    internal_message: Optional[str] = None,
) -> dict:
    """
    Create a sanitized error response for the client.

    In production (debug_mode=False):
        - Returns only the user-safe message and correlation ID

    In development (debug_mode=True):
        - Also includes internal details for easier debugging
    """
    response = {
        "detail": user_message,
        "reference_id": correlation_id,
    }

    if debug_mode and internal_message:
        response["debug_info"] = internal_message

    return response


# Common error messages that don't reveal implementation details
ERROR_MESSAGES = {
    "auth_failed": "Authentication failed",
    "not_found": "Resource not found",
    "forbidden": "Access denied",
    "validation": "Invalid request data",
    "server_error": "An unexpected error occurred. Please try again or contact support.",
    "database_error": "A database error occurred. Please try again.",
    "external_service": "An external service error occurred. Please try again.",
    "rate_limited": "Too many requests. Please wait and try again.",
    "file_upload": "File upload failed. Please try again.",
}


def handle_exception_safely(
    exception: Exception,
    request: Optional[Request] = None,
    user_message: Optional[str] = None,
    extra_data: Optional[dict] = None,
    debug_mode: bool = False,
) -> JSONResponse:
    """
    Handle an exception safely, logging details server-side and returning sanitized response.

    Usage in route handlers:
        try:
            # ... operation that might fail
        except Exception as e:
            return handle_exception_safely(e, request=request, user_message="Upload failed")
    """
    correlation_id = generate_correlation_id()

    # Log the full error server-side
    log_error(
        correlation_id=correlation_id,
        message=str(exception),
        exception=exception,
        extra_data=extra_data,
        request=request,
    )

    # Determine appropriate status code
    if isinstance(exception, HTTPException):
        status_code = exception.status_code
    else:
        status_code = 500

    # Use provided message or default based on exception type
    if user_message:
        message = user_message
    elif isinstance(exception, HTTPException):
        message = exception.detail
    else:
        message = ERROR_MESSAGES["server_error"]

    response_data = sanitize_error_response(
        status_code=status_code,
        correlation_id=correlation_id,
        user_message=message,
        debug_mode=debug_mode,
        internal_message=str(exception) if debug_mode else None,
    )

    return JSONResponse(status_code=status_code, content=response_data)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to catch unhandled exceptions and return sanitized responses.

    Add to FastAPI app:
        app.add_middleware(ErrorHandlingMiddleware, debug=settings.DEBUG)
    """

    def __init__(self, app, debug: bool = False):
        super().__init__(app)
        self.debug = debug

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:
            # Don't catch HTTPExceptions - let FastAPI handle them normally
            if isinstance(exc, HTTPException):
                raise

            return handle_exception_safely(
                exception=exc,
                request=request,
                debug_mode=self.debug,
            )
