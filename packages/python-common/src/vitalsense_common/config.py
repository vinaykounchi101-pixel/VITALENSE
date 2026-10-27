"""Typed configuration and safe environment-variable validation.

Reads configuration from environment variables with safe defaults for development.
Adheres to AGENTS.md rules: no hardcoded secrets, no direct .env file access.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, List


class ConfigurationError(ValueError):
    """Raised when an environment configuration variable is invalid or missing."""


@dataclass(frozen=True)
class Settings:
    """Application settings loaded strictly from environment variables."""

    # Runtime Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # PostgreSQL Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://vitalsense_user:replace_with_secure_dev_password@localhost:5432/vitalsense_dev"
    )
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "vitalsense_dev"
    POSTGRES_USER: str = "vitalsense_user"
    POSTGRES_PASSWORD: str = "replace_with_secure_dev_password"
    POSTGRES_POOL_SIZE: int = 10
    POSTGRES_MAX_OVERFLOW: int = 20

    # API Services
    WEB_API_HOST: str = "0.0.0.0"
    WEB_API_PORT: int = 8000
    WEB_API_CORS_ORIGINS: List[str] = field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    MOBILE_API_HOST: str = "0.0.0.0"
    MOBILE_API_PORT: int = 8001
    MOBILE_API_CORS_ORIGINS: List[str] = field(default_factory=lambda: ["*"])

    # Authentication & Security
    AUTH_SECRET_KEY: str = (
        "dev_only_insecure_placeholder_key_do_not_use_in_production_32_bytes"
    )
    AUTH_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Observability
    ENABLE_STRUCTURED_LOGGING: bool = True
    CORRELATION_ID_HEADER: str = "X-Correlation-ID"

    # Gated Future Phases (Must remain False unless explicitly approved)
    FEATURE_FLAG_AI_ASSISTANT: bool = False
    FEATURE_FLAG_PREDICTIVE_ML: bool = False
    FEATURE_FLAG_MEDICAL_RECORDS: bool = False
    FEATURE_FLAG_FAMILY_MANAGEMENT: bool = False

    @classmethod
    def from_env(cls) -> Settings:
        """Construct Settings from environment variables with type casting and validation."""
        env = os.environ.get("ENVIRONMENT", "development").lower()
        if env not in ("development", "test", "staging", "production"):
            raise ConfigurationError(
                f"Invalid ENVIRONMENT '{env}'. Must be one of: development, test, staging, production."
            )

        debug = os.environ.get("DEBUG", "true").lower() in ("true", "1", "yes")

        # In production, debug must be False and secret key must not be default
        secret_key = os.environ.get(
            "AUTH_SECRET_KEY",
            "dev_only_insecure_placeholder_key_do_not_use_in_production_32_bytes",
        )
        if env == "production":
            if debug:
                raise ConfigurationError(
                    "DEBUG cannot be True in production environment."
                )
            if "placeholder" in secret_key or len(secret_key) < 32:
                raise ConfigurationError(
                    "AUTH_SECRET_KEY must be a secure key with at least 32 characters in production."
                )

        def _get_int(key: str, default: int) -> int:
            val = os.environ.get(key)
            if val is None:
                return default
            try:
                return int(val)
            except ValueError as e:
                raise ConfigurationError(
                    f"Invalid integer value for {key}: {val}"
                ) from e

        def _get_bool(key: str, default: bool) -> bool:
            val = os.environ.get(key)
            if val is None:
                return default
            return val.lower() in ("true", "1", "yes")

        def _get_list(key: str, default: List[str]) -> List[str]:
            val = os.environ.get(key)
            if val is None:
                return default
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed]
                return [str(parsed)]
            except json.JSONDecodeError:
                return [s.strip() for s in val.split(",") if s.strip()]

        return cls(
            ENVIRONMENT=env,
            DEBUG=debug,
            LOG_LEVEL=os.environ.get("LOG_LEVEL", "INFO").upper(),
            DATABASE_URL=os.environ.get(
                "DATABASE_URL",
                f"postgresql+asyncpg://{os.environ.get('POSTGRES_USER', 'vitalsense_user')}:{os.environ.get('POSTGRES_PASSWORD', 'replace_with_secure_dev_password')}@{os.environ.get('POSTGRES_HOST', 'localhost')}:{os.environ.get('POSTGRES_PORT', '5432')}/{os.environ.get('POSTGRES_DB', 'vitalsense_dev')}",
            ),
            POSTGRES_HOST=os.environ.get("POSTGRES_HOST", "localhost"),
            POSTGRES_PORT=_get_int("POSTGRES_PORT", 5432),
            POSTGRES_DB=os.environ.get("POSTGRES_DB", "vitalsense_dev"),
            POSTGRES_USER=os.environ.get("POSTGRES_USER", "vitalsense_user"),
            POSTGRES_PASSWORD=os.environ.get(
                "POSTGRES_PASSWORD", "replace_with_secure_dev_password"
            ),
            POSTGRES_POOL_SIZE=_get_int("POSTGRES_POOL_SIZE", 10),
            POSTGRES_MAX_OVERFLOW=_get_int("POSTGRES_MAX_OVERFLOW", 20),
            WEB_API_HOST=os.environ.get("WEB_API_HOST", "0.0.0.0"),
            WEB_API_PORT=_get_int("WEB_API_PORT", 8000),
            WEB_API_CORS_ORIGINS=_get_list(
                "WEB_API_CORS_ORIGINS", ["http://localhost:3000"]
            ),
            MOBILE_API_HOST=os.environ.get("MOBILE_API_HOST", "0.0.0.0"),
            MOBILE_API_PORT=_get_int("MOBILE_API_PORT", 8001),
            MOBILE_API_CORS_ORIGINS=_get_list("MOBILE_API_CORS_ORIGINS", ["*"]),
            AUTH_SECRET_KEY=secret_key,
            AUTH_ALGORITHM=os.environ.get("AUTH_ALGORITHM", "HS256"),
            ACCESS_TOKEN_EXPIRE_MINUTES=_get_int(
                "ACCESS_TOKEN_EXPIRE_MINUTES", 15
            ),
            REFRESH_TOKEN_EXPIRE_DAYS=_get_int("REFRESH_TOKEN_EXPIRE_DAYS", 7),
            ENABLE_STRUCTURED_LOGGING=_get_bool(
                "ENABLE_STRUCTURED_LOGGING", True
            ),
            CORRELATION_ID_HEADER=os.environ.get(
                "CORRELATION_ID_HEADER", "X-Correlation-ID"
            ),
            FEATURE_FLAG_AI_ASSISTANT=_get_bool(
                "FEATURE_FLAG_AI_ASSISTANT", False
            ),
            FEATURE_FLAG_PREDICTIVE_ML=_get_bool(
                "FEATURE_FLAG_PREDICTIVE_ML", False
            ),
            FEATURE_FLAG_MEDICAL_RECORDS=_get_bool(
                "FEATURE_FLAG_MEDICAL_RECORDS", False
            ),
            FEATURE_FLAG_FAMILY_MANAGEMENT=_get_bool(
                "FEATURE_FLAG_FAMILY_MANAGEMENT", False
            ),
        )


# Singleton settings instance
settings = Settings.from_env()
