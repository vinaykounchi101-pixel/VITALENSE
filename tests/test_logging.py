"""Tests for structured JSON logging and privacy redaction rules (NFR-OBS-001, PRV-011)."""

import json
import logging
from vitalsense_common.logging import (
    JSONFormatter,
    set_correlation_id,
)


def test_json_formatter_structure():
    """Verify JSONFormatter outputs valid JSON with expected core fields."""
    formatter = JSONFormatter()
    set_correlation_id("test-corr-id-12345")

    record = logging.LogRecord(
        name="vitalsense.test",
        level=logging.INFO,
        pathname="test_file.py",
        lineno=42,
        msg="Test event message",
        args=(),
        exc_info=None,
    )

    output = formatter.format(record)
    parsed = json.loads(output)

    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "vitalsense.test"
    assert parsed["message"] == "Test event message"
    assert parsed["correlation_id"] == "test-corr-id-12345"
    assert "timestamp" in parsed


def test_privacy_redaction_of_sensitive_keys():
    """Verify sensitive fields in extra metadata are automatically redacted."""
    formatter = JSONFormatter()

    record = logging.LogRecord(
        name="vitalsense.security",
        level=logging.WARNING,
        pathname="auth.py",
        lineno=10,
        msg="Failed login attempt",
        args=(),
        exc_info=None,
    )
    record.extra = {
        "user_email": "user@example.test",
        "password": "super_secret_password",
        "token": "jwt_secret_token",
        "heart_rate": 88,
        "raw_payload": {"measure": 123},
    }

    output = formatter.format(record)
    parsed = json.loads(output)

    metadata = parsed["metadata"]
    assert metadata["user_email"] == "user@example.test"
    assert metadata["password"] == "[REDACTED]"
    assert metadata["token"] == "[REDACTED]"
    assert metadata["heart_rate"] == "[REDACTED]"
    assert metadata["raw_payload"] == "[REDACTED]"
