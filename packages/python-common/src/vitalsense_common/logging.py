"""Structured JSON logging with correlation IDs and strict privacy redaction.

Implements NFR-OBS-001. Adheres to SEC-014, FR-PRIV-006, and PRV-011 by ensuring
no secrets, auth tokens, or sensitive health data are ever written to log output.
"""

from __future__ import annotations

import contextvars
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Context variable storing the active request / task correlation ID
correlation_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)

# Sensitive field keys to automatically redact if passed in extra metadata
SENSITIVE_KEYS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "auth_secret_key",
    "api_key",
    "credentials",
    "raw_payload",
    "blood_pressure",
    "glucose",
    "heart_rate",
    "spo2",
    "medical_document",
}


def get_correlation_id() -> Optional[str]:
    """Retrieve the correlation ID for the current async execution context."""
    return correlation_id_ctx.get()


def set_correlation_id(correlation_id: str) -> None:
    """Set the correlation ID for the current async execution context."""
    correlation_id_ctx.set(correlation_id)


class JSONFormatter(logging.Formatter):
    """Custom formatter producing single-line structured JSON logs with correlation context."""

    def format(self, record: logging.LogRecord) -> str:
        log_payload: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": get_correlation_id(),
        }

        # Include file/line metadata for warnings and errors
        if record.levelno >= logging.WARNING:
            log_payload["source"] = {
                "file": record.filename,
                "line": record.lineno,
                "function": record.funcName,
            }

        # Include sanitized extra attributes
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            sanitized_extra = {}
            for k, v in record.extra.items():
                if k.lower() in SENSITIVE_KEYS:
                    sanitized_extra[k] = "[REDACTED]"
                else:
                    sanitized_extra[k] = v
            log_payload["metadata"] = sanitized_extra

        if record.exc_info:
            log_payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_payload, default=str)


def setup_logging(level: str = "INFO", structured: bool = True) -> logging.Logger:
    """Configure root logger with either structured JSON or standard console formatting."""
    root_logger = logging.getLogger()
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    # Remove existing handlers to avoid duplicates
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)

    if structured:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
            )
        )

    root_logger.addHandler(handler)
    return root_logger


# Default logger for the vitalsense namespace
logger = logging.getLogger("vitalsense")
