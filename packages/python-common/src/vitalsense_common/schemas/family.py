"""Family and dependent multi-person profile schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CreatePersonProfileRequest(BaseModel):
    """Payload to add a dependent or family member profile."""

    display_name: str = Field(..., min_length=1, max_length=100)
    relationship_type: str = Field(..., description="self, child, spouse, parent, dependent")


class PersonProfileDTO(BaseModel):
    """Person profile details."""

    id: uuid.UUID
    user_account_id: uuid.UUID
    display_name: str
    relationship_type: str
    is_primary: bool = False
    created_at: datetime


class FamilyProfilesResponse(BaseModel):
    """List of all authorized person profiles under the account."""

    profiles: List[PersonProfileDTO] = Field(default_factory=list)

