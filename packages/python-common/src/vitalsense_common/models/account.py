"""UserAccount and Person Identity Models.

Implements ARCH-010 and FR-AUTH-009: Separation of authentication/account holder
from the Person represented by health records, providing the architectural foundation
for multi-profile and Phase 5 family health capabilities without cross-person leakage.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vitalsense_common.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from vitalsense_common.models.health_record import HealthRecord, SourceRecord


class UserAccount(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Authentication and account credential entity."""

    __tablename__ = "user_accounts"

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    # Status: active, suspended, deletion_pending, deleted (OD-07)
    status: Mapped[str] = mapped_column(
        String(50),
        default="active",
        nullable=False,
    )

    # Relationships: One account can own one or more Person entities (self, dependent)
    persons: Mapped[List[Person]] = relationship(
        "Person",
        back_populates="account",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<UserAccount id={self.id} email={self.email} status={self.status}>"


class Person(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Canonical health boundary representing the individual whose health data is recorded."""

    __tablename__ = "persons"

    user_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # Relationship type: 'self' (primary), 'dependent', 'caregiver_delegate'
    relationship_type: Mapped[str] = mapped_column(
        String(50),
        default="self",
        nullable=False,
    )
    display_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )

    # Relationships
    account: Mapped[UserAccount] = relationship(
        "UserAccount",
        back_populates="persons",
    )
    health_records: Mapped[List[HealthRecord]] = relationship(
        "HealthRecord",
        back_populates="person",
        cascade="all, delete-orphan",
    )
    source_records: Mapped[List[SourceRecord]] = relationship(
        "SourceRecord",
        back_populates="person",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Person id={self.id} account_id={self.user_account_id} type={self.relationship_type}>"
