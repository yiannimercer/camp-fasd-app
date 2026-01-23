"""
Logging configuration for CAMP FASD application.

Security considerations:
- Never log sensitive data (passwords, tokens, PII)
- Use structured logging for easier analysis
- Log levels:
  - DEBUG: Detailed diagnostic info (development only)
  - INFO: General operational info
  - WARNING: Unexpected but handled situations
  - ERROR: Errors that need attention
  - CRITICAL: System failures
"""

import logging
import sys
from typing import Optional


def setup_logging(debug: bool = False) -> None:
    """
    Configure application-wide logging.

    Args:
        debug: If True, enables DEBUG level logging
    """
    log_level = logging.DEBUG if debug else logging.INFO

    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )

    # Reduce noise from third-party libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger for a specific module.

    Usage:
        from app.core.logging_config import get_logger
        logger = get_logger(__name__)
        logger.info("Something happened")
        logger.error("Error occurred", exc_info=True)

    Args:
        name: Usually __name__ of the calling module

    Returns:
        Configured logger instance
    """
    return logging.getLogger(f"camp_fasd.{name}")


# Convenience function for security-related logging
def log_security_event(
    event_type: str,
    message: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    extra: Optional[dict] = None,
) -> None:
    """
    Log security-relevant events.

    These logs should be monitored and may be used for audit trails.

    Args:
        event_type: Type of security event (e.g., "auth_failure", "rate_limit", "access_denied")
        message: Human-readable description
        user_id: User ID if known
        ip_address: Client IP address
        extra: Additional context
    """
    logger = logging.getLogger("camp_fasd.security")

    log_data = {
        "event_type": event_type,
        "user_id": user_id,
        "ip_address": ip_address,
    }
    if extra:
        log_data.update(extra)

    logger.warning(f"SECURITY: {event_type} - {message}", extra=log_data)
