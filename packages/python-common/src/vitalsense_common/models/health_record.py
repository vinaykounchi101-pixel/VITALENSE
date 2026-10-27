"""HealthRecord and SourceRecord Models.

Implements DATA-001 through DATA-004, FR-DATA-005 through FR-DATA-010,
and SYNC-015 through SYNC-018: Canonical health record persistence,
provenance preservation, source record receipts, and deterministic deduplication.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vitalsense_common.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now

if TYPE_CHECKING:
    from vitalsense_common.models.account import Person
    from vitalsense_common.models.metric import MetricDefinition


class SourceRecord(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Raw ingestion receipt preserving external platform records and idempotency.

    Implements FR-DATA-006, FR-DATA-009, and SYNC-016.
    """

    __tablename__ = "source_records"

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # Source platform: 'apple_health', 'health_connect', 'manual'
    source_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    # External record identifier provided by the source platform (when available)
    source_record_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    # Deterministic client/source key preventing duplicate ingestion (SYNC-016)
    idempotency_key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    source_timestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    ingestion_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    raw_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
    provenance: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Relationships
    person: Mapped[Person] = relationship(
        "Person",
        back_populates="source_records",
    )
    health_records: Mapped[list[HealthRecord]] = relationship(
        "HealthRecord",
        back_populates="source_receipt",
    )

    __table_args__ = (
        UniqueConstraint(
            "person_id",
            "source_name",
            "idempotency_key",
            name="uq_source_records_idempotency",
        ),
    )

    def __repr__(self) -> str:
        return f"<SourceRecord id={self.id} source={self.source_name} key={self.idempotency_key}>"


class HealthRecord(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Normalized, canonical health record.

    Implements DATA-001 (UUID), DATA-002 (UTC timestamps), DATA-003 (explicit units),
    FR-METRIC-001 (value origin), and FR-DATA-010 (correction state).
    """

    __tablename__ = "health_records"

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    metric_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("metric_definitions.canonical_id"),
        index=True,
        nullable=False,
    )
    # High-precision numeric measurement (e.g. 8452 steps, 72.5 bpm)
    value: Mapped[Optional[float]] = mapped_column(
        Numeric(14, 4),
        nullable=True,
    )
    # Explicit unit matching MetricDefinition.canonical_unit (DATA-003)
    unit: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    # Event measurement time in UTC (DATA-002, FR-DATA-007)
    event_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
        nullable=False,
    )
    # Optional end time for duration intervals (e.g. sleep duration, workout)
    end_timestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    # Source timezone context (e.g. 'America/New_York', '+05:30')
    source_timezone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    # Traceable link back to raw ingestion receipt (FR-QUAL-002)
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("source_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    # Origin: 'source_imported', 'user_entered', 'derived', 'corrected' (FR-DATA-010)
    origin: Mapped[str] = mapped_column(
        String(50),
        default="source_imported",
        nullable=False,
    )
    # Lifecycle: 'active', 'corrected', 'superseded' (SYNC-018)
    correction_state: Mapped[str] = mapped_column(
        String(50),
        default="active",
        nullable=False,
    )
    ingestion_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    person: Mapped[Person] = relationship(
        "Person",
        back_populates="health_records",
    )
    metric_definition: Mapped[MetricDefinition] = relationship(
        "MetricDefinition",
    )
    source_receipt: Mapped[Optional[SourceRecord]] = relationship(
        "SourceRecord",
        back_populates="health_records",
    )

    __table_args__ = (
        Index(
            "ix_health_records_person_metric_time",
            "person_id",
            "metric_id",
            "event_timestamp",
        ),
    )

    def __repr__(self) -> str:
        return f"<HealthRecord id={self.id} metric={self.metric_id} val={self.value} {self.unit}>"
