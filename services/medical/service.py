"""Medical Records Domain Service."""

from __future__ import annotations

import uuid
from typing import List

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.models.extended import MedicalRecord
from vitalsense_common.schemas.medical import (
    CreateMedicalRecordRequest,
    MedicalRecordDTO,
    MedicalRecordListResponse,
)


class MedicalService:
    """Service for managing clinical documents and laboratory results."""

    @classmethod
    async def create_record(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
        request: CreateMedicalRecordRequest,
    ) -> MedicalRecordDTO:
        """Add a new clinical record or document metadata."""
        record = MedicalRecord(
            person_id=person_id,
            record_type=request.record_type,
            title=request.title,
            provider_name=request.provider_name,
            record_date=request.record_date,
            document_metadata=request.document_metadata,
            clinical_notes=request.clinical_notes,
        )
        session.add(record)
        await session.flush()

        return MedicalRecordDTO(
            id=record.id,
            person_id=record.person_id,
            record_type=record.record_type,
            title=record.title,
            provider_name=record.provider_name,
            record_date=record.record_date,
            document_metadata=record.document_metadata,
            clinical_notes=record.clinical_notes,
            created_at=record.created_at,
        )

    @classmethod
    async def list_records(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
    ) -> MedicalRecordListResponse:
        """List all clinical records registered for a person."""
        query = (
            select(MedicalRecord)
            .where(MedicalRecord.person_id == person_id)
            .order_by(desc(MedicalRecord.record_date))
        )
        res = await session.execute(query)
        records = res.scalars().all()

        dtos = [
            MedicalRecordDTO(
                id=r.id,
                person_id=r.person_id,
                record_type=r.record_type,
                title=r.title,
                provider_name=r.provider_name,
                record_date=r.record_date,
                document_metadata=r.document_metadata,
                clinical_notes=r.clinical_notes,
                created_at=r.created_at,
            )
            for r in records
        ]

        return MedicalRecordListResponse(records=dtos, total_count=len(dtos))

