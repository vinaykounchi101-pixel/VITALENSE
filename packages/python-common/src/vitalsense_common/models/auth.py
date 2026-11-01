"""Authentication and Token Lifecycle Models.

Implements OD-18, SEC-001 through SEC-011, and FR-AUTH-001 through FR-AUTH-008:
- Self-hosted Argon2id password hash persistence
- Rotating refresh token families with theft reuse detection
- Session revocation tracking across devices
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vitalsense_common.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from vitalsense_common.models.account import UserAccount


class AuthCredential(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User account credentials storing Argon2id password hash and lockout metadata."""

    __tablename__ = "auth_credentials"

    user_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    # Argon2id password hash string (m=65536, t=3, p=4)
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user_account: Mapped[UserAccount] = relationship(
        "UserAccount",
        backref="credential",
    )

    def __repr__(self) -> str:
        return f"<AuthCredential user_account_id={self.user_account_id} locked={self.locked_until is not None}>"


class AuthRefreshToken(Base, UUIDPrimaryKeyMixin):
    """Hashed refresh token family record.

    Tokens rotate on every use. Reusing a consumed token invalidates the entire token family.
    """

    __tablename__ = "auth_refresh_tokens"

    user_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # SHA-256 hash of the 32-byte cryptographically secure random token string
    token_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )
    # Identifier grouping rotated tokens belonging to the same login session
    family_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    device_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    device_name: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_consumed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Relationships
    user_account: Mapped[UserAccount] = relationship(
        "UserAccount",
        backref="refresh_tokens",
    )

    def __repr__(self) -> str:
        return (
            f"<AuthRefreshToken id={self.id} family={self.family_id} "
            f"consumed={self.is_consumed} revoked={self.is_revoked}>"
        )

