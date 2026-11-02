"""Privacy, GDPR Data Export, and Cascading Account Purge Service."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.models.audit import AuditEvent
from vitalsense_common.models.auth import AuthCredential, AuthPasswordResetToken, AuthRefreshToken
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.extended import DailyInsight, ExternalImport, MedicalRecord, WorkoutDetail
from vitalsense_common.models.health_record import HealthRecord, SourceRecord
from vitalsense_common.models.sync import ClientSyncCursor, SyncTombstone
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
        """Generate a complete machine-readable export of all personal health records, domain entities, and metadata."""
        now = utc_now()

        # 1. Fetch user account metadata (strictly excluding credentials/hashes/secrets)
        u_res = await session.execute(
            select(UserAccount).where(UserAccount.id == user_account_id)
        )
        user = u_res.scalar_one_or_none()
        account_meta: Optional[Dict[str, Any]] = None
        if user:
            account_meta = {
                "id": str(user.id),
                "email": user.email,
                "status": user.status,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            }

        # 2. Fetch persons
        p_res = await session.execute(
            select(Person).where(Person.user_account_id == user_account_id)
        )
        persons = p_res.scalars().all()
        person_ids = [p.id for p in persons]

        person_dtos = [
            {
                "id": str(p.id),
                "display_name": p.display_name,
                "relationship_type": p.relationship_type,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in persons
        ]

        # 3. Fetch audit events associated with user
        a_res = await session.execute(
            select(AuditEvent)
            .where(AuditEvent.actor_id == user_account_id)
            .order_by(AuditEvent.timestamp.asc())
        )
        audit_events = a_res.scalars().all()
        audits_json = [
            {
                "id": str(a.id),
                "action": a.action,
                "target_type": a.target_type,
                "target_id": a.target_id,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "result": a.result,
            }
            for a in audit_events
        ]

        if not person_ids:
            manifest = {
                "version": "1.0",
                "export_timestamp": now.isoformat(),
                "data_categories": [
                    "account",
                    "person_profiles",
                    "health_records",
                    "source_records",
                    "medical_records",
                    "workouts",
                    "daily_insights",
                    "external_imports",
                    "sync_tombstones",
                    "audit_events",
                ],
                "record_counts": {
                    "person_profiles": len(person_dtos),
                    "health_records": 0,
                    "source_records": 0,
                    "medical_records": 0,
                    "workouts": 0,
                    "daily_insights": 0,
                    "external_imports": 0,
                    "sync_tombstones": 0,
                    "audit_events": len(audits_json),
                },
            }
            return ExportHealthDataResponse(
                account_id=user_account_id,
                export_timestamp=now,
                format_version="1.0",
                manifest=manifest,
                account=account_meta,
                person_profiles=person_dtos,
                records=[],
                source_records=[],
                medical_records=[],
                workouts=[],
                daily_insights=[],
                external_imports=[],
                tombstones=[],
                audit_events=audits_json,
                total_records=0,
            )

        # 4. Fetch all health records
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
                "event_timestamp": r.event_timestamp.isoformat() if r.event_timestamp else None,
                "end_timestamp": r.end_timestamp.isoformat() if r.end_timestamp else None,
                "origin": r.origin,
                "correction_state": r.correction_state,
                "superseded_by_id": str(r.superseded_by_id) if r.superseded_by_id else None,
                "source_id": str(r.source_id) if r.source_id else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in health_records
        ]

        # 5. Fetch source records
        sr_res = await session.execute(
            select(SourceRecord)
            .where(SourceRecord.person_id.in_(person_ids))
            .order_by(SourceRecord.created_at.asc())
        )
        source_records = sr_res.scalars().all()
        sources_json = [
            {
                "id": str(s.id),
                "person_id": str(s.person_id),
                "source_name": s.source_name,
                "source_record_id": s.source_record_id,
                "idempotency_key": s.idempotency_key,
                "raw_payload": s.raw_payload,
                "provenance": s.provenance,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in source_records
        ]

        # 6. Fetch medical records
        mr_res = await session.execute(
            select(MedicalRecord)
            .where(MedicalRecord.person_id.in_(person_ids))
            .order_by(MedicalRecord.record_date.asc())
        )
        medical_records = mr_res.scalars().all()
        medical_json = [
            {
                "id": str(m.id),
                "person_id": str(m.person_id),
                "record_type": m.record_type,
                "title": m.title,
                "provider_name": m.provider_name,
                "record_date": m.record_date.isoformat() if m.record_date else None,
                "document_metadata": m.document_metadata,
                "clinical_notes": m.clinical_notes,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in medical_records
        ]

        # 7. Fetch workout details
        wd_res = await session.execute(
            select(WorkoutDetail)
            .where(WorkoutDetail.person_id.in_(person_ids))
            .order_by(WorkoutDetail.created_at.asc())
        )
        workout_records = wd_res.scalars().all()
        workouts_json = [
            {
                "id": str(w.id),
                "person_id": str(w.person_id),
                "health_record_id": str(w.health_record_id) if w.health_record_id else None,
                "workout_type": w.workout_type,
                "duration_minutes": float(w.duration_minutes),
                "exercises": w.exercises,
                "muscle_groups": w.muscle_groups,
                "total_volume_kg": float(w.total_volume_kg) if w.total_volume_kg is not None else None,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
            for w in workout_records
        ]

        # 8. Fetch daily insights
        di_res = await session.execute(
            select(DailyInsight)
            .where(DailyInsight.person_id.in_(person_ids))
            .order_by(DailyInsight.insight_date.asc())
        )
        insights = di_res.scalars().all()
        insights_json = [
            {
                "id": str(d.id),
                "person_id": str(d.person_id),
                "insight_date": d.insight_date.isoformat() if d.insight_date else None,
                "headline": d.headline,
                "summary_text": d.summary_text,
                "recovery_score": float(d.recovery_score) if d.recovery_score is not None else None,
                "key_metrics": d.key_metrics,
                "recommendations": d.recommendations,
                "disclaimer": d.disclaimer,
                "provider": d.provider,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in insights
        ]

        # 9. Fetch external imports
        ei_res = await session.execute(
            select(ExternalImport)
            .where(ExternalImport.person_id.in_(person_ids))
            .order_by(ExternalImport.created_at.asc())
        )
        imports = ei_res.scalars().all()
        imports_json = [
            {
                "id": str(e.id),
                "person_id": str(e.person_id),
                "source_platform": e.source_platform,
                "filename": e.filename,
                "status": e.status,
                "record_count": e.record_count,
                "error_message": e.error_message,
                "imported_at": e.imported_at.isoformat() if e.imported_at else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in imports
        ]

        # 10. Fetch tombstones
        ts_res = await session.execute(
            select(SyncTombstone)
            .where(SyncTombstone.person_id.in_(person_ids))
            .order_by(SyncTombstone.deleted_at.asc())
        )
        tombstones = ts_res.scalars().all()
        tombstones_json = [
            {
                "target_record_id": str(t.target_record_id),
                "record_type": t.record_type,
                "device_id": t.device_id,
                "device_record_id": t.device_record_id,
                "deleted_at": t.deleted_at.isoformat() if t.deleted_at else None,
            }
            for t in tombstones
        ]

        # Build complete manifest
        manifest = {
            "version": "1.0",
            "export_timestamp": now.isoformat(),
            "data_categories": [
                "account",
                "person_profiles",
                "health_records",
                "source_records",
                "medical_records",
                "workouts",
                "daily_insights",
                "external_imports",
                "sync_tombstones",
                "audit_events",
            ],
            "record_counts": {
                "person_profiles": len(person_dtos),
                "health_records": len(records_json),
                "source_records": len(sources_json),
                "medical_records": len(medical_json),
                "workouts": len(workouts_json),
                "daily_insights": len(insights_json),
                "external_imports": len(imports_json),
                "sync_tombstones": len(tombstones_json),
                "audit_events": len(audits_json),
            },
        }

        return ExportHealthDataResponse(
            account_id=user_account_id,
            export_timestamp=now,
            format_version="1.0",
            manifest=manifest,
            account=account_meta,
            person_profiles=person_dtos,
            records=records_json,
            source_records=sources_json,
            medical_records=medical_json,
            workouts=workouts_json,
            daily_insights=insights_json,
            external_imports=imports_json,
            tombstones=tombstones_json,
            audit_events=audits_json,
            total_records=len(records_json),
        )

    @classmethod
    async def delete_account_permanently(
        cls,
        session: AsyncSession,
        user_account_id: uuid.UUID,
        confirmation_password: str,
    ) -> DeleteAccountResponse:
        """Authenticate password and execute cascading deletion of user account and all personal health data."""
        now = utc_now()

        # 1. Verify password
        cred_query = select(AuthCredential).where(AuthCredential.user_account_id == user_account_id)
        cred = (await session.execute(cred_query)).scalar_one_or_none()
        if not cred or not verify_password(confirmation_password, cred.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid confirmation password. Account deletion aborted.",
            )

        # 2. Identify all associated persons for explicit cascade guarantees
        p_res = await session.execute(
            select(Person.id).where(Person.user_account_id == user_account_id)
        )
        person_ids = p_res.scalars().all()

        if person_ids:
            # Explicitly delete dependent extended domain records
            await session.execute(delete(DailyInsight).where(DailyInsight.person_id.in_(person_ids)))
            await session.execute(delete(MedicalRecord).where(MedicalRecord.person_id.in_(person_ids)))
            await session.execute(delete(WorkoutDetail).where(WorkoutDetail.person_id.in_(person_ids)))
            await session.execute(delete(ExternalImport).where(ExternalImport.person_id.in_(person_ids)))

            # Delete sync tracking and tombstones
            await session.execute(delete(ClientSyncCursor).where(ClientSyncCursor.person_id.in_(person_ids)))
            await session.execute(delete(SyncTombstone).where(SyncTombstone.person_id.in_(person_ids)))

            # Delete clinical records and source tracking
            await session.execute(delete(HealthRecord).where(HealthRecord.person_id.in_(person_ids)))
            await session.execute(delete(SourceRecord).where(SourceRecord.person_id.in_(person_ids)))

            # Delete persons
            await session.execute(delete(Person).where(Person.user_account_id == user_account_id))

        # 3. Explicitly revoke and purge authentication sessions and credentials
        await session.execute(delete(AuthRefreshToken).where(AuthRefreshToken.user_account_id == user_account_id))
        await session.execute(delete(AuthPasswordResetToken).where(AuthPasswordResetToken.user_account_id == user_account_id))
        await session.execute(delete(AuthCredential).where(AuthCredential.user_account_id == user_account_id))

        # 4. Write an unidentifiable, anonymized audit tombstone for regulatory accounting
        anonymous_audit = AuditEvent(
            actor_id=None,
            actor_type="system",
            action="account.purged_gdpr_art17",
            target_type="user_account_tombstone",
            target_id="anonymized_erasure",
            timestamp=now,
            result="success",
        )
        session.add(anonymous_audit)

        # 5. Purge the root UserAccount record
        del_stmt = delete(UserAccount).where(UserAccount.id == user_account_id)
        await session.execute(del_stmt)
        await session.flush()

        return DeleteAccountResponse(
            status="deleted",
            message="Account and all associated personal health data have been irreversibly deleted.",
            deleted_at=now,
        )
