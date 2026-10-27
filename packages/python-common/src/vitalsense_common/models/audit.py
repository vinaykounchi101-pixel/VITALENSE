"""AuditEvent Operational and Security Audit Model.

Implements FR-OPS-002, FR-OPS-003, SEC-014, and PRV-016: Immutable audit logging
for security, access, lifecycle, and administrative events with strictly redacted metadata.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from vitalsense_common.models.base import Base, UUIDPrimaryKeyMixin, utc_now


class AuditEvent(Base, UUIDPrimaryKeyMixin):
    """Immutable record of security and data lifecycle events."""

    __tablename__ = "audit_events"

    # Actor reference (UserAccount.id, or null for system/anonymous requests)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    # Actor type: 'user', 'system', 'admin', 'unauthenticated'
    actor_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    # Action: 'auth.login', 'auth.failed', 'data.export_requested', 'data.deleted', etc.
    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    # Target resource classification: 'user_account', 'person', 'health_record', 'system'
    target_type: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    target_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )
    # Outcome: 'success', 'failure', 'blocked'
    result: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    # Redacted contextual metadata (FR-OPS-003: NEVER contains health values or secrets)
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<AuditEvent id={self.id} action={self.action} result={self.result}>"
