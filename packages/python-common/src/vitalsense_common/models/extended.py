"""Extended domain models for insights, medical records, workouts, and imports."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from vitalsense_common.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now


class DailyInsight(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Stores AI-generated daily briefings and structured health insights."""

    __tablename__ = "daily_insights"

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    insight_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    headline: Mapped[str] = mapped_column(String(255), nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    recovery_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    key_metrics: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    recommendations: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=list)
    disclaimer: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="Insights are for educational and wellness tracking only, never medical diagnosis.",
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="deterministic_heuristic")

    __table_args__ = (
        UniqueConstraint("person_id", "insight_date", name="uq_daily_insights_person_date"),
    )


class MedicalRecord(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Metadata for clinical documents, lab results, and physician notes."""

    __tablename__ = "medical_records"

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    record_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    document_metadata: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    clinical_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class WorkoutDetail(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Workout session breakdown: exercises, sets, reps, and muscle groups."""

    __tablename__ = "workout_details"

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    health_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("health_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    workout_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    duration_minutes: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    exercises: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    muscle_groups: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=list)
    total_volume_kg: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)


class ExternalImport(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Audit log of external health data file imports."""

    __tablename__ = "external_imports"

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="completed")
    total_records: Mapped[int] = mapped_column(default=0)
    imported_records: Mapped[int] = mapped_column(default=0)
    rejected_records: Mapped[int] = mapped_column(default=0)
    error_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

