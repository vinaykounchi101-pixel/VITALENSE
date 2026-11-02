"""Cryptographic Token Generation, Hashing, and JWT Lifecycle.

Implements SEC-003, SEC-004, SEC-005, SEC-006, and OD-18:
- HMAC-SHA256 JWT access tokens (15-minute expiry)
- Cryptographically secure 32-byte refresh tokens
- SHA-256 token hashing for secure database persistence
- Rotating refresh token validation
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

import jwt

from vitalsense_common.config import settings


class TokenSecurityError(Exception):
    """Base exception for token-related authentication failures."""


class TokenExpiredError(TokenSecurityError):
    """Raised when an access token or refresh token has expired."""


class TokenInvalidError(TokenSecurityError):
    """Raised when an access token signature, format, or claims are invalid."""


def generate_refresh_token() -> str:
    """Generate a cryptographically secure 32-byte URL-safe refresh token string."""
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    """Compute the SHA-256 hexadecimal digest of a plaintext refresh token.

    Refresh tokens must never be persisted in plaintext. Only the SHA-256
    hash is stored in the database.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(
    user_account_id: Union[str, uuid.UUID],
    person_id: Union[str, uuid.UUID],
    role: str = "user",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed HMAC-SHA256 JWT access token.

    Args:
        user_account_id: The UUID of the user account (sub claim).
        person_id: The UUID of the associated Person profile.
        role: RBAC role assigned to the user.
        expires_delta: Optional custom lifetime (defaults to ACCESS_TOKEN_EXPIRE_MINUTES).

    Returns:
        Encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    if expires_delta is not None:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": str(user_account_id),
        "person_id": str(person_id),
        "role": role,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(
        payload,
        settings.AUTH_SECRET_KEY,
        algorithm=settings.AUTH_ALGORITHM,
    )


def decode_access_token(token: str) -> Dict[str, Any]:
    """Verify and decode a JWT access token.

    Args:
        token: Encoded JWT string.

    Returns:
        Decoded claims dictionary.

    Raises:
        TokenExpiredError: If token expiration has elapsed.
        TokenInvalidError: If token is malformed, has invalid signature, or wrong algorithm.
    """
    try:
        payload = jwt.decode(
            token,
            settings.AUTH_SECRET_KEY,
            algorithms=[settings.AUTH_ALGORITHM],
            options={"require": ["sub", "person_id", "exp", "iat"]},
        )
        return payload
    except jwt.ExpiredSignatureError as e:
        raise TokenExpiredError("Access token has expired.") from e
    except (jwt.InvalidTokenError, jwt.DecodeError) as e:
        raise TokenInvalidError("Invalid access token.") from e


def create_password_reset_token(
    user_account_id: Union[str, uuid.UUID],
    expires_minutes: int = 15,
) -> str:
    """Create a signed, single-use, expiring HMAC-SHA256 JWT password reset token.

    Args:
        user_account_id: The UUID of the user account.
        expires_minutes: Token validity lifetime (default: 15 minutes).

    Returns:
        Encoded JWT reset token string.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes)

    payload: Dict[str, Any] = {
        "sub": str(user_account_id),
        "purpose": "password_reset",
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(
        payload,
        settings.AUTH_SECRET_KEY,
        algorithm=settings.AUTH_ALGORITHM,
    )


def decode_password_reset_token(token: str) -> Dict[str, Any]:
    """Verify and decode a password reset JWT token.

    Args:
        token: Encoded JWT string.

    Returns:
        Decoded claims dictionary.

    Raises:
        TokenExpiredError: If reset token has expired.
        TokenInvalidError: If token is malformed, has invalid signature, or wrong purpose.
    """
    try:
        payload = jwt.decode(
            token,
            settings.AUTH_SECRET_KEY,
            algorithms=[settings.AUTH_ALGORITHM],
            options={"require": ["sub", "purpose", "exp", "iat"]},
        )
        if payload.get("purpose") != "password_reset":
            raise TokenInvalidError("Token is not valid for password reset.")
        return payload
    except jwt.ExpiredSignatureError as e:
        raise TokenExpiredError("Password reset token has expired.") from e
    except (jwt.InvalidTokenError, jwt.DecodeError) as e:
        raise TokenInvalidError("Invalid password reset token.") from e


