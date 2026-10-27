"""Metric Definition Registry Model.

Implements FR-METRIC-004 and DATA-003: Maintain a central registry describing
canonical metric IDs, value types, validation boundaries, canonical units,
and display rules.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from vitalsense_common.models.base import Base, utc_now


class MetricDefinition(Base):
    """Authoritative registry of supported health and wellness metrics."""

    __tablename__ = "metric_definitions"

    canonical_id: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
    )
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    # Category: activity, cardiovascular, sleep, body, vital
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    # Data type: numeric, duration, categorical, composite
    data_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    # Canonical unit: count, bpm, seconds, kcal, mg/dL, mmHg
    canonical_unit: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    # Validation constraints: {"min": 0, "max": 100000}
    validation_rules: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
    # Display configuration: {"decimals": 0, "icon": "footsteps"}
    display_rules: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    created_at: Mapped[Any] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<MetricDefinition id={self.canonical_id} unit={self.canonical_unit}>"
