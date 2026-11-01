"""Authentication and Session Pydantic Schemas.

Implements SEC-001 through SEC-011, OD-18, and FR-AUTH-001 through FR-AUTH-008:
- Registration and login requests
- Token issuance and rotation responses
- Active session inspection and revocation
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    """Payload for user account registration."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(
        ...,
        description="User email address (canonical identity).",
        examples=["user@example.com"],
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Plaintext password meeting complexity criteria (minimum 8 characters).",
        examples=["CorrectHorseBatteryStaple123!"],
    )
    display_name: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Optional user display name.",
        examples=["Alice"],
    )
    device_id: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Unique device identifier registering the account.",
    )
    device_name: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Human-readable device name (e.g. 'Pixel 8', 'MacBook Pro').",
    )


class LoginRequest(BaseModel):
    """Payload for user authentication."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(
        ...,
        description="User email address.",
        examples=["user@example.com"],
    )
    password: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="User password.",
    )
    device_id: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Unique client device identifier.",
    )
    device_name: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Human-readable device label.",
    )


class TokenResponse(BaseModel):
    """Payload returned upon successful authentication or token refresh."""

    model_config = ConfigDict(extra="forbid")

    access_token: str = Field(
        ...,
        description="Signed HMAC-SHA256 JWT access token (15-minute expiration).",
    )
    refresh_token: str = Field(
        ...,
        description="Rotating cryptographically secure 32-byte URL-safe refresh token.",
    )
    token_type: str = Field(
        default="Bearer",
        description="Token type header prefix.",
    )
    expires_in: int = Field(
        ...,
        description="Access token lifetime in seconds (e.g. 900 for 15 minutes).",
    )
    user_account_id: uuid.UUID = Field(
        ...,
        description="Primary user account UUID.",
    )
    person_id: uuid.UUID = Field(
        ...,
        description="Associated canonical person UUID.",
    )


class RefreshTokenRequest(BaseModel):
    """Payload for rotating refresh token exchange."""

    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(
        ...,
        description="Plaintext refresh token received from previous login/refresh.",
    )
    device_id: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Client device identifier requesting rotation.",
    )


class SessionItem(BaseModel):
    """Representation of an active or historical device session family."""

    model_config = ConfigDict(extra="forbid")

    family_id: uuid.UUID = Field(
        ...,
        description="Unique session family identifier.",
    )
    device_id: Optional[str] = Field(
        default=None,
        description="Device identifier.",
    )
    device_name: Optional[str] = Field(
        default=None,
        description="Device label.",
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp when the session family was established.",
    )
    expires_at: datetime = Field(
        ...,
        description="Expiration timestamp of the latest active refresh token in the family.",
    )
    is_active: bool = Field(
        ...,
        description="Whether the session family contains valid, unrevoked tokens.",
    )


class RevokeSessionRequest(BaseModel):
    """Payload to revoke a specific session family."""

    model_config = ConfigDict(extra="forbid")

    family_id: uuid.UUID = Field(
        ...,
        description="Session family UUID to revoke across all rotated tokens.",
    )


class UserProfileResponse(BaseModel):
    """User profile response returning account and person metadata."""

    model_config = ConfigDict(extra="forbid")

    user_account_id: uuid.UUID = Field(..., description="User account UUID.")
    email: str = Field(..., description="Account email.")
    person_id: uuid.UUID = Field(..., description="Person profile UUID.")
    display_name: Optional[str] = Field(default=None, description="Display name.")
    role: str = Field(..., description="Role assigned.")
    created_at: datetime = Field(..., description="Account creation timestamp.")


class PasswordResetRequest(BaseModel):
    """Payload to request password reset token."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(
        ...,
        description="Canonical account email address.",
        examples=["user@example.com"],
    )


class PasswordResetConfirmRequest(BaseModel):
    """Payload to confirm password reset with token."""

    model_config = ConfigDict(extra="forbid")

    token: str = Field(
        ...,
        description="Expiring single-use password reset token.",
    )
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New plaintext password meeting complexity criteria.",
        examples=["NewSecurePassword123!"],
    )


class PasswordResetResponse(BaseModel):
    """Response returned upon password reset request."""

    model_config = ConfigDict(extra="forbid")

    message: str = Field(
        ...,
        description="Status message regarding the password reset process.",
    )
    reset_token: Optional[str] = Field(
        default=None,
        description="In development or testing environments, the generated reset token for verification.",
    )


