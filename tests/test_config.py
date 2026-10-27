"""Tests for configuration parsing, type validation, and environment safety guards."""

import os
from unittest import mock

import pytest
from vitalsense_common.config import ConfigurationError, Settings


def test_default_settings():
    """Verify default development configuration is safe and sane."""
    cfg = Settings.from_env()
    assert cfg.ENVIRONMENT == "development"
    assert cfg.DEBUG is True
    assert cfg.WEB_API_PORT == 8000
    assert cfg.MOBILE_API_PORT == 8001
    assert cfg.FEATURE_FLAG_AI_ASSISTANT is False
    assert cfg.FEATURE_FLAG_PREDICTIVE_ML is False
    assert cfg.FEATURE_FLAG_MEDICAL_RECORDS is False
    assert cfg.FEATURE_FLAG_FAMILY_MANAGEMENT is False


def test_invalid_environment_rejected():
    """Verify unapproved ENVIRONMENT strings raise a ConfigurationError."""
    with mock.patch.dict(os.environ, {"ENVIRONMENT": "invalid_env"}):
        with pytest.raises(ConfigurationError, match="Invalid ENVIRONMENT"):
            Settings.from_env()


def test_production_guards():
    """Verify production environment prohibits DEBUG=true and weak secrets."""
    with mock.patch.dict(
        os.environ,
        {"ENVIRONMENT": "production", "DEBUG": "true"},
    ):
        with pytest.raises(ConfigurationError, match="DEBUG cannot be True in production"):
            Settings.from_env()

    with mock.patch.dict(
        os.environ,
        {
            "ENVIRONMENT": "production",
            "DEBUG": "false",
            "AUTH_SECRET_KEY": "dev_only_placeholder_key_insecure",
        },
    ):
        with pytest.raises(ConfigurationError, match="AUTH_SECRET_KEY must be a secure key"):
            Settings.from_env()


def test_cors_origins_parsing():
    """Verify CORS origins correctly parse JSON arrays or comma-delimited strings."""
    with mock.patch.dict(
        os.environ,
        {"WEB_API_CORS_ORIGINS": '["https://vitalsense.app", "https://admin.vitalsense.app"]'},
    ):
        cfg = Settings.from_env()
        assert cfg.WEB_API_CORS_ORIGINS == [
            "https://vitalsense.app",
            "https://admin.vitalsense.app",
        ]
