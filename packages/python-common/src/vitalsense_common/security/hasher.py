"""Argon2id Password Hashing and Verification.

Implements SEC-001, SEC-002, and OD-18:
- Standard Argon2id parameters: memory_cost=65536 (64 MiB), time_cost=3, parallelism=4
- Resistant against GPU/ASIC attacks
- Robust password strength verification
"""

from __future__ import annotations

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from vitalsense_common.config import settings

# Initialize Argon2id password hasher with configured parameters
_ph = PasswordHasher(
    time_cost=settings.ARGON2_TIME_COST,
    memory_cost=settings.ARGON2_MEMORY_COST,
    parallelism=settings.ARGON2_PARALLELISM,
    hash_len=32,
    type=Type.ID,
)


class PasswordValidationError(ValueError):
    """Raised when a candidate password fails policy validation."""


def validate_password_strength(password: str) -> None:
    """Validate that candidate password meets minimum security criteria.

    - Minimum 8 characters, maximum 128 characters
    - Must not be whitespace-only
    """
    if not password or not password.strip():
        raise PasswordValidationError("Password must not be empty or whitespace-only.")
    if len(password) < 8:
        raise PasswordValidationError("Password must contain at least 8 characters.")
    if len(password) > 128:
        raise PasswordValidationError("Password must not exceed 128 characters.")


def hash_password(plain_password: str) -> str:
    """Hash a plain text password using Argon2id with salt generation.

    Args:
        plain_password: The plaintext password to hash.

    Returns:
        Argon2id encoded hash string.
    """
    validate_password_strength(plain_password)
    return _ph.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify a candidate password against an Argon2id hash.

    Args:
        plain_password: The candidate plaintext password.
        password_hash: The stored Argon2id hash string.

    Returns:
        True if the password matches, False otherwise.
    """
    if not plain_password or not password_hash:
        return False
    try:
        return _ph.verify(password_hash, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False

