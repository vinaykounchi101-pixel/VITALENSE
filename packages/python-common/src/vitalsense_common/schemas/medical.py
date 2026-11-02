"""Medical and clinical record metadata schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

MANDATORY_MEDICAL_DISCLAIMER = (
    "Medical records and summaries are for personal documentation only, never medical diagnosis."
)


class CreateMedicalRecordRequest(BaseModel):
    """Payload to register a medical document or clinical result."""

    record_type: str = Field(..., description="e.g. lab_result, immunization, clinical_note, prescription")
    title: str = Field(..., max_length=255)
    provider_name: Optional[str] = Field(default=None, max_length=255)
    record_date: date
    document_metadata: Dict[str, Any] = Field(default_factory=dict)
    clinical_notes: Optional[str] = None


class MedicalRecordDTO(BaseModel):
    """Clinical document record transfer object."""

    id: uuid.UUID
    person_id: uuid.UUID
    record_type: str
    title: str
    provider_name: Optional[str] = None
    record_date: date
    document_metadata: Dict[str, Any] = Field(default_factory=dict)
    clinical_notes: Optional[str] = None
    disclaimer: str = Field(default=MANDATORY_MEDICAL_DISCLAIMER)
    created_at: datetime


class MedicalRecordListResponse(BaseModel):
    """List of clinical records for a person."""

    records: List[MedicalRecordDTO] = Field(default_factory=list)
    total_count: int = 0

