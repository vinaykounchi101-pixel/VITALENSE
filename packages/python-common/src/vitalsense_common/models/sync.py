"""Synchronization Tombstone and Cursor Tracking Models.

Implements OD-14, SYNC-001 through SYNC-019, and FR-PRIV-004:
- Deletion tombstone propagation for offline clients
- Per-device synchronization cursors
- Stale device detection (>30 days offline)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vitalsense_common.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now

if TYPE_CHECKING:
    from vitalsense_common.models.account import Person


class SyncTombstone(Base, UUIDPrimaryKeyMixin):
    """Immutable tombstone recording the deletion of a health observation.

    Used by offline sync clients to purge local SQLite records before uploading.
    """

    __tablename__ = "sync_tombstones"

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="CASCADE"),
        nullable=False,
    )
    record_type: Mapped[str] = mapped_column(
        String(50),
        default="health_record",
        nullable=False,
    )
    target_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    device_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    deleted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    person: Mapped[Person] = relationship(
        "Person",
        backref="sync_tombstones",
    )

    __table_args__ = (
        Index(
            "ix_sync_tombstones_person_deleted",
            "person_id",
            "deleted_at",
        ),
    )

    def __repr__(self) -> str:
        return f"<SyncTombstone target={self.target_record_id} deleted_at={self.deleted_at}>"


class ClientSyncCursor(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tracks the latest confirmed synchronization timestamp per client device."""

    __tablename__ = "client_sync_cursors"

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    last_sync_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Relationships
    person: Mapped[Person] = relationship(
        "Person",
        backref="sync_cursors",
    )

    __table_args__ = (
        UniqueConstraint(
            "person_id",
            "device_id",
            name="uq_client_sync_cursors_person_device",
        ),
    )

    def __repr__(self) -> str:
        return f"<ClientSyncCursor device={self.device_id} last_sync={self.last_sync_timestamp}>"

