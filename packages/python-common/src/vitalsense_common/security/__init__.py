"""VitalSense Cryptographic and Security Subsystem.

Provides Argon2id password hashing and JWT/refresh token authentication utilities.
"""

from vitalsense_common.security.hasher import (
    PasswordValidationError,
    hash_password,
    validate_password_strength,
    verify_password,
)
from vitalsense_common.security.tokens import (
    TokenExpiredError,
    TokenInvalidError,
    TokenSecurityError,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_refresh_token,
)

__all__ = [
    "PasswordValidationError",
    "validate_password_strength",
    "hash_password",
    "verify_password",
    "TokenSecurityError",
    "TokenExpiredError",
    "TokenInvalidError",
    "create_access_token",
    "decode_access_token",
    "generate_refresh_token",
    "hash_refresh_token",
]

