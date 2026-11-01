"""Cross-Platform Health Data Ingestion and Synchronization Schemas.

Implements OD-01, OD-04, OD-07, OD-14, OD-16, and SYNC-001 through SYNC-019:
- Phase 1 ten approved metrics
- Paired blood pressure systolic/diastolic observation handling
- Immutable revision tracking (original measured_at, correction_state, superseded_by_id)
- Idempotent deduplication via idempotency keys
- Deletion tombstones and client cursor tracking
- Safe resynchronization on SYNC_CURSOR_EXPIRED preserving local offline drafts
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


# Approved Phase 1 metric categories (OD-01 Option B)
APPROVED_PHASE1_METRICS = {
    "steps",
    "heart_rate",
    "sleep_session",
    "active_energy",
    "workout_session",
    "resting_heart_rate",
    "blood_pressure_systolic",
    "blood_pressure_diastolic",
    "blood_oxygen_saturation",
    "blood_glucose",
}


class ObservationItem(BaseModel):
    """Client observation submission payload item for batch ingestion."""

    model_config = ConfigDict(extra="forbid")

    metric_name: str = Field(
        ...,
        description="Metric category identifier. Must be one of the approved Phase 1 metrics.",
        examples=["steps", "heart_rate", "blood_pressure_systolic"],
    )
    value: float = Field(
        ...,
        description="Numeric measurement value.",
    )
    unit: str = Field(
        ...,
        description="Measurement unit corresponding to the metric definition.",
        examples=["count", "bpm", "mmHg", "mg/dL", "percent", "kcal"],
    )
    measured_at: datetime = Field(
        ...,
        description="Authoritative UTC timestamp when the measurement took place. Preserved during corrections.",
    )
    end_timestamp: Optional[datetime] = Field(
        default=None,
        description="End UTC timestamp for duration metrics (e.g. workout_session, sleep_session).",
    )
    source_timezone: Optional[str] = Field(
        default="UTC",
        description="Timezone string where the measurement was recorded (e.g. 'America/New_York').",
    )
    origin: Literal["device_sync", "user_entered", "calculated", "imported"] = Field(
        default="device_sync",
        description="Provenance of the observation. Controlled manual entries must use 'user_entered'.",
    )
    correction_state: Literal["original", "corrected", "superseded"] = Field(
        default="original",
        description="Revision state of the observation.",
    )
    supersedes_record_id: Optional[uuid.UUID] = Field(
        default=None,
        description="If correcting an existing record, the UUID of the record being superseded.",
    )
    device_record_id: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Client device's local record UUID or primary key.",
    )
    idempotency_key: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Unique idempotency key ensuring deduplication across repeated sync attempts.",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Extensible metadata payload (e.g. workout type, sleep stage breakdown).",
    )

    @model_validator(mode="after")
    def validate_metric_and_correction(self) -> ObservationItem:
        if self.metric_name not in APPROVED_PHASE1_METRICS:
            raise ValueError(
                f"Metric '{self.metric_name}' is not in the approved Phase 1 metric set: "
                f"{sorted(list(APPROVED_PHASE1_METRICS))}"
            )
        if self.correction_state == "corrected" and not self.supersedes_record_id:
            raise ValueError("Corrected observations must specify 'supersedes_record_id'.")
        if self.origin == "user_entered" and self.correction_state == "corrected":
            # Manual corrections are valid
            pass
        return self


class TombstoneItem(BaseModel):
    """Client-submitted deletion tombstone to propagate to canonical server."""

    model_config = ConfigDict(extra="forbid")

    target_record_id: uuid.UUID = Field(
        ...,
        description="UUID of the health record being deleted.",
    )
    record_type: str = Field(
        default="health_record",
        description="Type of record deleted.",
    )
    deleted_at: datetime = Field(
        ...,
        description="UTC timestamp of the deletion action.",
    )


class TombstoneDTO(BaseModel):
    """Server-side tombstone dispatched to clients to purge local cache."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    target_record_id: uuid.UUID
    record_type: str
    deleted_at: datetime


class ObservationDTO(BaseModel):
    """Server-side health observation record dispatched to client devices."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    person_id: uuid.UUID
    metric_name: str
    value: float
    unit: str
    measured_at: datetime
    end_timestamp: Optional[datetime] = None
    source_timezone: Optional[str] = None
    origin: str
    correction_state: str
    superseded_by_id: Optional[uuid.UUID] = None
    device_record_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]] = None


class BatchSyncRequest(BaseModel):
    """Batch payload submitted by client devices (Android, iOS, Windows, macOS, Web)."""

    model_config = ConfigDict(extra="forbid")

    device_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Client device identifier.",
    )
    last_sync_timestamp: Optional[datetime] = Field(
        default=None,
        description="Latest sync timestamp acknowledged by client device. None for initial sync.",
    )
    observations: List[ObservationItem] = Field(
        default_factory=list,
        max_length=500,
        description="Batch of health observations captured or corrected offline. Maximum batch size is 500.",
    )
    tombstones: List[TombstoneItem] = Field(
        default_factory=list,
        max_length=500,
        description="Deletions performed locally on the client to propagate upstream. Maximum batch size is 500.",
    )


class BatchSyncResponse(BaseModel):
    """Synchronization outcome containing upstream deltas, tombstones, and updated cursor."""

    model_config = ConfigDict(extra="forbid")

    server_timestamp: datetime = Field(
        ...,
        description="Current server UTC timestamp.",
    )
    processed_count: int = Field(
        ...,
        description="Number of newly inserted or corrected observations.",
    )
    duplicate_count: int = Field(
        ...,
        description="Number of idempotent duplicate records safely skipped.",
    )
    tombstones_processed: int = Field(
        ...,
        description="Number of client deletions recorded.",
    )
    next_sync_cursor: datetime = Field(
        ...,
        description="Authoritative sync cursor timestamp to persist on the client device.",
    )
    server_observations: List[ObservationDTO] = Field(
        default_factory=list,
        description="Health observations created or modified on other devices since last_sync_timestamp.",
    )
    server_tombstones: List[TombstoneDTO] = Field(
        default_factory=list,
        description="Deletions committed on the server that must be pruned from client local SQLite storage.",
    )


class SyncCursorExpiredResponse(BaseModel):
    """Response returned with HTTP 409 when client cursor exceeds 30-day retention window."""

    model_config = ConfigDict(extra="forbid")

    code: Literal["SYNC_CURSOR_EXPIRED"] = "SYNC_CURSOR_EXPIRED"
    message: str = Field(
        default="Client synchronization cursor has expired (>30 days offline). Full resynchronization required.",
        description="Detailed explanation of the expiration.",
    )
    requires_full_resync: bool = Field(
        default=True,
        description="Flag indicating client must reset cursor and perform full download.",
    )
    preserve_local_drafts: bool = Field(
        default=True,
        description="MANDATORY: Client MUST NOT wipe pending offline changes or drafts.",
    )
    instructions: str = Field(
        default=(
            "1. Preserve all un-synced local changes, drafts, and pending uploads. "
            "2. Fetch authoritative records from server. "
            "3. Reconcile server records with local SQLite cache. "
            "4. Upload un-synced local records with fresh idempotency keys. "
            "5. Update local cursor to server_timestamp."
        ),
        description="Explicit recovery sequence ensuring zero data loss during cursor expiration.",
    )
    server_timestamp: datetime = Field(
        ...,
        description="Current server UTC timestamp to use for new sync baseline.",
    )

