"""Privacy, data export, and account deletion schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExportHealthDataResponse(BaseModel):
    """Machine-readable JSON export of all personal health records and metadata."""

    account_id: uuid.UUID
    export_timestamp: datetime
    format_version: str = "1.0"
    manifest: Dict[str, Any] = Field(default_factory=dict)
    account: Optional[Dict[str, Any]] = None
    person_profiles: List[Dict[str, Any]] = Field(default_factory=list)
    records: List[Dict[str, Any]] = Field(default_factory=list)
    source_records: List[Dict[str, Any]] = Field(default_factory=list)
    medical_records: List[Dict[str, Any]] = Field(default_factory=list)
    workouts: List[Dict[str, Any]] = Field(default_factory=list)
    daily_insights: List[Dict[str, Any]] = Field(default_factory=list)
    external_imports: List[Dict[str, Any]] = Field(default_factory=list)
    tombstones: List[Dict[str, Any]] = Field(default_factory=list)
    audit_events: List[Dict[str, Any]] = Field(default_factory=list)
    total_records: int = 0


class DeleteAccountRequest(BaseModel):
    """Payload to confirm irreversible account deletion."""

    password: str = Field(..., description="Confirmation password to prevent accidental deletion")


class DeleteAccountResponse(BaseModel):
    """Confirmation of cascading account deletion."""

    status: str = "deleted"
    message: str = "Account and all associated personal health data have been irreversibly deleted."
    deleted_at: datetime
