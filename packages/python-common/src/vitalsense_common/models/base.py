"""SQLAlchemy Declarative Base and Reusable Mixins.

Implements DATA-001 (stable UUIDs) and DATA-002 (UTC timezone conventions).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy domain models."""

    def to_dict(self) -> dict[str, Any]:
        """Convert model attributes to a dictionary representation."""
        return {
            c.name: getattr(self, c.name) for c in self.__table__.columns
        }


def utc_now() -> datetime:
    """Return current timestamp in UTC timezone."""
    return datetime.now(timezone.utc)


class UUIDPrimaryKeyMixin:
    """Mixin providing a stable, immutable UUID primary key (DATA-001)."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        sort_order=-10,
    )


class TimestampMixin:
    """Mixin providing created_at and updated_at audit timestamps in UTC (DATA-002)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )
