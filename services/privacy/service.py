"""Privacy, GDPR Data Export, and Cascading Account Purge Service."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.models.audit import AuditEvent
from vitalsense_common.models.auth import AuthCredential
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.extended import DailyInsight, MedicalRecord, WorkoutDetail
from vitalsense_common.models.health_record import HealthRecord, SourceRecord
from vitalsense_common.models.sync import SyncTombstone
from vitalsense_common.schemas.privacy import (
    DeleteAccountResponse,
    ExportHealthDataResponse,
)
from vitalsense_common.security import verify_password


class PrivacyService:
    """Service handling personal data portability (GDPR Art 20) and erasure (Art 17)."""

    @classmethod
    async def export_all_data(
        cls,
        session: AsyncSession,
        user_account_id: uuid.UUID,
    ) -> ExportHealthDataResponse:
        """Generate a complete machine-readable export of all personal health records."""
        now = utc_now()

        # 1. Fetch persons
        p_res = await session.execute(select(Person).where(Person.user_account_id == user_account_id))
        persons = p_res.scalars().all()
        person_ids = [p.id for p in persons]

        person_dtos = [
            {
                "id": str(p.id),
                "display_name": p.display_name,
                "relationship_type": p.relationship_type,
                "created_at": p.created_at.isoformat(),
            }
            for p in persons
        ]

        if not person_ids:
            return ExportHealthDataResponse(
                account_id=user_account_id,
                export_timestamp=now,
                person_profiles=[],
                records=[],
                tombstones=[],
                total_records=0,
            )

        # 2. Fetch all health records
        hr_res = await session.execute(
            select(HealthRecord)
            .where(HealthRecord.person_id.in_(person_ids))
            .order_by(HealthRecord.event_timestamp.asc())
        )
        health_records = hr_res.scalars().all()

        records_json = [
            {
                "id": str(r.id),
                "person_id": str(r.person_id),
                "metric_id": r.metric_id,
                "value": float(r.value),
                "unit": r.unit,
                "event_timestamp": r.event_timestamp.isoformat(),
                "end_timestamp": r.end_timestamp.isoformat() if r.end_timestamp else None,
                "origin": r.origin,
                "correction_state": r.correction_state,
                "superseded_by_id": str(r.superseded_by_id) if r.superseded_by_id else None,
            }
            for r in health_records
        ]

        # 3. Fetch tombstones
        ts_res = await session.execute(
            select(SyncTombstone).where(SyncTombstone.person_id.in_(person_ids))
        )
        tombstones = ts_res.scalars().all()
        tombstones_json = [
            {
                "target_record_id": str(t.target_record_id),
                "record_type": t.record_type,
                "device_record_id": t.device_record_id,
                "deleted_at": t.deleted_at.isoformat(),
            }
            for t in tombstones
        ]

        return ExportHealthDataResponse(
            account_id=user_account_id,
            export_timestamp=now,
            person_profiles=person_dtos,
            records=records_json,
            tombstones=tombstones_json,
            total_records=len(records_json),
        )

    @classmethod
    async def delete_account_permanently(
        cls,
        session: AsyncSession,
        user_account_id: uuid.UUID,
        confirmation_password: str,
    ) -> DeleteAccountResponse:
        """Authenticate password and execute cascading deletion of user account and all health data."""
        now = utc_now()

        # 1. Verify password
        cred_query = select(AuthCredential).where(AuthCredential.user_account_id == user_account_id)
        cred = (await session.execute(cred_query)).scalar_one_or_none()
        if not cred or not verify_password(confirmation_password, cred.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid confirmation password. Account deletion aborted.",
            )

        # 2. Write audit event
        audit = AuditEvent(
            actor_id=user_account_id,
            actor_type="user",
            action="account.deleted",
            target_type="user_account",
            target_id=str(user_account_id),
            timestamp=now,
            result="success",
        )
        session.add(audit)
        await session.flush()

        # 3. Cascade delete UserAccount (all relational tables have ondelete='CASCADE')
        del_stmt = delete(UserAccount).where(UserAccount.id == user_account_id)
        await session.execute(del_stmt)
        await session.flush()

        return DeleteAccountResponse(
            status="deleted",
            message="Account and all associated personal health data have been irreversibly deleted.",
            deleted_at=now,
        )
