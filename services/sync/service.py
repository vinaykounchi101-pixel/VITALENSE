"""VitalSense Health Data Ingestion and Synchronization Domain Service.

Implements OD-01, OD-04, OD-07, OD-14, OD-16, and SYNC-001 through SYNC-019:
- Authoritative validation for the 10 approved Phase 1 metrics
- Paired systolic/diastolic blood pressure clinical validation
- Raw payload retention with idempotent receipt deduplication
- Normalization into canonical health_records
- Immutable correction lineage: preserves original event_timestamp, sets superseded_by_id
- Deletion propagation via sync_tombstones with account-deletion precedence
- Stale device detection (>30 days offline) returning SYNC_CURSOR_EXPIRED
- Safe resynchronization preserving offline drafts
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.config import settings
from vitalsense_common.logging import logger
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.health_record import HealthRecord, SourceRecord
from vitalsense_common.models.metric import MetricDefinition
from vitalsense_common.models.sync import ClientSyncCursor, SyncTombstone
from vitalsense_common.schemas.sync import (
    APPROVED_PHASE1_METRICS,
    BatchSyncRequest,
    BatchSyncResponse,
    ObservationDTO,
    ObservationItem,
    SyncCursorExpiredResponse,
    TombstoneDTO,
    TombstoneItem,
)


class SyncService:
    """Core domain service for batch ingestion and multi-platform synchronization."""

    @staticmethod
    async def _get_metric_definitions(
        session: AsyncSession,
    ) -> Dict[str, MetricDefinition]:
        """Fetch all approved metric definitions indexed by canonical_id."""
        query = select(MetricDefinition)
        result = await session.execute(query)
        return {metric.canonical_id: metric for metric in result.scalars().all()}

    @classmethod
    async def synchronize(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
        request: BatchSyncRequest,
    ) -> BatchSyncResponse:
        """Execute full batch synchronization lifecycle for an authenticated person."""
        now = utc_now()
        source_name = request.device_id[:50]

        # ---------------------------------------------------------------------
        # 0. Account Status & Deletion Precedence Check (OD-07, SYNC-010)
        # ---------------------------------------------------------------------
        user_query = (
            select(UserAccount.status)
            .join(Person, Person.user_account_id == UserAccount.id)
            .where(Person.id == person_id)
        )
        user_res = await session.execute(user_query)
        user_status = user_res.scalar_one_or_none()
        if user_status in ("deleted", "deletion_pending"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is marked for deletion or deleted. Synchronization is disabled.",
            )

        # ---------------------------------------------------------------------
        # 1. Stale Device Cursor Check (>30 days offline, OD-14)
        # ---------------------------------------------------------------------
        if request.last_sync_timestamp is not None:
            max_age = timedelta(days=settings.SYNC_CURSOR_MAX_AGE_DAYS)
            if (now - request.last_sync_timestamp) > max_age:
                logger.warning(
                    "Sync cursor expired for device",
                    extra={
                        "device_id": request.device_id,
                        "person_id": str(person_id),
                        "last_sync": request.last_sync_timestamp.isoformat(),
                    },
                )
                expired_payload = SyncCursorExpiredResponse(server_timestamp=now)
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=expired_payload.model_dump(mode="json"),
                )

        # ---------------------------------------------------------------------
        # 2. Process Client Deletion Tombstones (OD-14, FR-PRIV-004)
        # ---------------------------------------------------------------------
        tombstones_processed = 0
        for tombstone in request.tombstones:
            # 2a. Resolve the original device_record_id BEFORE deleting the HealthRecord
            resolved_device_record_id = getattr(tombstone, "device_record_id", None)
            if not resolved_device_record_id:
                hr_source_query = (
                    select(SourceRecord.source_record_id)
                    .join(HealthRecord, HealthRecord.source_id == SourceRecord.id)
                    .where(
                        HealthRecord.id == tombstone.target_record_id,
                        HealthRecord.person_id == person_id,
                    )
                )
                resolved_device_record_id = (
                    await session.execute(hr_source_query)
                ).scalar_one_or_none()

            # 2b. Check if tombstone already exists to keep duplicate submissions idempotent
            existing_ts_query = select(SyncTombstone).where(
                SyncTombstone.person_id == person_id,
                SyncTombstone.target_record_id == tombstone.target_record_id,
            )
            existing_ts = (await session.execute(existing_ts_query)).scalar_one_or_none()
            if existing_ts:
                # Update device_record_id if previously missing
                if resolved_device_record_id and not existing_ts.device_record_id:
                    existing_ts.device_record_id = resolved_device_record_id
            else:
                ts_record = SyncTombstone(
                    person_id=person_id,
                    record_type=tombstone.record_type,
                    target_record_id=tombstone.target_record_id,
                    device_id=request.device_id,
                    device_record_id=resolved_device_record_id,
                    deleted_at=tombstone.deleted_at,
                )
                session.add(ts_record)

            # 2c. Delete target canonical health record
            delete_stmt = delete(HealthRecord).where(
                HealthRecord.id == tombstone.target_record_id,
                HealthRecord.person_id == person_id,
            )
            await session.execute(delete_stmt)
            tombstones_processed += 1

        # ---------------------------------------------------------------------
        # 3. Clinical & Ingestion Validation
        # ---------------------------------------------------------------------
        metric_defs = await cls._get_metric_definitions(session)

        # Check for paired blood pressure in current batch
        # If both systolic and diastolic are submitted for same timestamp, verify systolic > diastolic
        bp_systolic_map: Dict[datetime, float] = {}
        bp_diastolic_map: Dict[datetime, float] = {}

        for obs in request.observations:
            if obs.metric_name == "blood_pressure_systolic":
                bp_systolic_map[obs.measured_at] = obs.value
            elif obs.metric_name == "blood_pressure_diastolic":
                bp_diastolic_map[obs.measured_at] = obs.value

        for ts, sys_val in bp_systolic_map.items():
            if ts in bp_diastolic_map:
                dia_val = bp_diastolic_map[ts]
                if sys_val <= dia_val:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=(
                            f"Clinical validation failed: Systolic blood pressure ({sys_val}) "
                            f"must be greater than diastolic blood pressure ({dia_val}) at timestamp {ts.isoformat()}."
                        ),
                    )

        # ---------------------------------------------------------------------
        # 4. Ingest & Normalize Observations
        # ---------------------------------------------------------------------
        processed_count = 0
        duplicate_count = 0

        for obs in request.observations:
            # Verify metric is recognized
            metric_def = metric_defs.get(obs.metric_name)
            if not metric_def:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Unsupported metric category: '{obs.metric_name}'.",
                )

            # Validate strict metric unit (OD-01, SYNC-003)
            # Normalize clinically equivalent unit representations
            unit_aliases: Dict[str, str] = {
                "percent": "percentage",
                "%": "percentage",
            }
            resolved_unit = unit_aliases.get(obs.unit, obs.unit)
            if resolved_unit != metric_def.canonical_unit:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"Invalid unit '{obs.unit}' for metric '{obs.metric_name}'. "
                        f"Expected canonical unit '{metric_def.canonical_unit}'."
                    ),
                )

            # Validate timestamp bounds (cannot be more than 5 minutes in future)
            if obs.measured_at > now + timedelta(minutes=5):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Measurement timestamp {obs.measured_at.isoformat()} cannot be in the future.",
                )
            if obs.end_timestamp is not None and obs.end_timestamp < obs.measured_at:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"Invalid duration: end_timestamp ({obs.end_timestamp.isoformat()}) "
                        f"precedes measured_at ({obs.measured_at.isoformat()})."
                    ),
                )

            # Resurrection prevention (OD-14, FR-PRIV-004)
            # 1. Supersedes check: cannot supersede or resurrect a tombstoned record
            if obs.supersedes_record_id:
                ts_check = select(SyncTombstone.id).where(
                    SyncTombstone.person_id == person_id,
                    SyncTombstone.target_record_id == obs.supersedes_record_id,
                )
                ts_res = await session.execute(ts_check)
                if ts_res.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Cannot supersede or resurrect deleted record '{obs.supersedes_record_id}'.",
                    )

            # 2. Device record ID check: cannot resurrect a tombstoned device_record_id
            # Does not depend on joining deleted HealthRecord rows!
            if obs.device_record_id:
                tomb_conditions = [SyncTombstone.device_record_id == obs.device_record_id]
                try:
                    parsed_uuid = uuid.UUID(obs.device_record_id)
                    tomb_conditions.append(SyncTombstone.target_record_id == parsed_uuid)
                except (ValueError, AttributeError):
                    pass

                tomb_query = select(SyncTombstone.id).where(
                    SyncTombstone.person_id == person_id,
                    or_(*tomb_conditions),
                )
                tomb_res = await session.execute(tomb_query)
                if tomb_res.scalar_one_or_none():
                    # Suppress resurrection: skip re-inserting deleted observation
                    duplicate_count += 1
                    continue

            # Validate range bounds from metric_definition validation_rules
            rules = metric_def.validation_rules or {}
            min_val = rules.get("min_value")
            max_val = rules.get("max_value")
            if min_val is not None and obs.value < min_val:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Value {obs.value} for {obs.metric_name} is below valid range ({min_val}).",
                )
            if max_val is not None and obs.value > max_val:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Value {obs.value} for {obs.metric_name} exceeds valid range ({max_val}).",
                )

            # Idempotency check: prevent duplicate ingestion
            idempotency_key = obs.idempotency_key or f"auto-{uuid.uuid4()}"
            if obs.idempotency_key:
                existing_source_query = select(SourceRecord.id).where(
                    SourceRecord.person_id == person_id,
                    SourceRecord.source_name == source_name,
                    SourceRecord.idempotency_key == obs.idempotency_key,
                )
                res = await session.execute(existing_source_query)
                if res.scalar_one_or_none():
                    duplicate_count += 1
                    continue

            # Persist raw source record (OD-07: 30-day raw retention)
            source_record = SourceRecord(
                person_id=person_id,
                source_name=source_name,
                source_record_id=obs.device_record_id,
                idempotency_key=idempotency_key,
                source_timestamp=obs.measured_at,
                raw_payload=obs.model_dump(mode="json"),
            )
            session.add(source_record)
            await session.flush()

            # Handle Immutable Record Revision (OD-04)
            if obs.correction_state == "corrected" and obs.supersedes_record_id:
                # Query target record being superseded
                target_query = select(HealthRecord).where(
                    HealthRecord.id == obs.supersedes_record_id,
                    HealthRecord.person_id == person_id,
                )
                res = await session.execute(target_query)
                target_record = res.scalar_one_or_none()
                if not target_record:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Record to supersede '{obs.supersedes_record_id}' not found.",
                    )

                # OD-04 requirement: Corrections must preserve the original measurement timestamp
                new_record = HealthRecord(
                    person_id=person_id,
                    metric_id=metric_def.canonical_id,
                    value=obs.value,
                    unit=metric_def.canonical_unit,
                    event_timestamp=target_record.event_timestamp,  # PRESERVED ORIGINAL TIMESTAMP
                    end_timestamp=obs.end_timestamp or target_record.end_timestamp,
                    source_timezone=obs.source_timezone or target_record.source_timezone,
                    source_id=source_record.id,
                    source_name=source_name,
                    origin="user_entered",  # Manual correction
                    correction_state="corrected",
                    superseded_by_id=None,
                )
                session.add(new_record)
                await session.flush()

                # Mark target record as superseded
                target_record.superseded_by_id = new_record.id
                target_record.correction_state = "superseded"
                processed_count += 1
            else:
                # Normal newly captured observation
                new_record = HealthRecord(
                    person_id=person_id,
                    metric_id=metric_def.canonical_id,
                    value=obs.value,
                    unit=metric_def.canonical_unit,
                    event_timestamp=obs.measured_at,
                    end_timestamp=obs.end_timestamp,
                    source_timezone=obs.source_timezone,
                    source_id=source_record.id,
                    source_name=source_name,
                    origin="user_entered" if obs.origin == "user_entered" else "source_imported",
                    correction_state="active",
                    superseded_by_id=None,
                )
                session.add(new_record)
                processed_count += 1

        await session.flush()

        # ---------------------------------------------------------------------
        # 5. Fetch Upstream Server Observations for Client Delta
        # ---------------------------------------------------------------------
        if request.last_sync_timestamp is not None:
            # Incremental delta
            records_query = (
                select(HealthRecord)
                .where(
                    HealthRecord.person_id == person_id,
                    HealthRecord.updated_at > request.last_sync_timestamp,
                    HealthRecord.superseded_by_id.is_(None),
                )
                .order_by(HealthRecord.event_timestamp.asc())
            )
            tombstones_query = (
                select(SyncTombstone)
                .where(
                    SyncTombstone.person_id == person_id,
                    SyncTombstone.deleted_at > request.last_sync_timestamp,
                )
                .order_by(SyncTombstone.deleted_at.asc())
            )
            tomb_res = await session.execute(tombstones_query)
            tombstone_rows = tomb_res.scalars().all()
        else:
            # Initial baseline sync (all active non-superseded records)
            records_query = (
                select(HealthRecord)
                .where(
                    HealthRecord.person_id == person_id,
                    HealthRecord.superseded_by_id.is_(None),
                )
                .order_by(HealthRecord.event_timestamp.asc())
            )
            tombstone_rows = []

        rec_res = await session.execute(records_query)
        record_rows = rec_res.scalars().all()

        server_observations: List[ObservationDTO] = [
            ObservationDTO(
                id=rec.id,
                person_id=rec.person_id,
                metric_name=rec.metric_id,
                value=float(rec.value),
                unit=rec.unit,
                measured_at=rec.event_timestamp,
                end_timestamp=rec.end_timestamp,
                source_timezone=rec.source_timezone,
                origin=rec.origin,
                correction_state=rec.correction_state,
                superseded_by_id=rec.superseded_by_id,
                device_record_id=None,
                created_at=rec.created_at,
                updated_at=rec.updated_at,
                metadata=None,
            )
            for rec in record_rows
        ]

        server_tombstones: List[TombstoneDTO] = [
            TombstoneDTO(
                id=ts.id,
                target_record_id=ts.target_record_id,
                record_type=ts.record_type,
                deleted_at=ts.deleted_at,
                device_record_id=ts.device_record_id,
            )
            for ts in tombstone_rows
        ]

        # ---------------------------------------------------------------------
        # 6. Upsert Client Synchronization Cursor (OD-14)
        # ---------------------------------------------------------------------
        cursor_query = select(ClientSyncCursor).where(
            ClientSyncCursor.person_id == person_id,
            ClientSyncCursor.device_id == request.device_id,
        )
        cursor_res = await session.execute(cursor_query)
        cursor = cursor_res.scalar_one_or_none()
        if cursor:
            cursor.last_sync_timestamp = now
        else:
            cursor = ClientSyncCursor(
                person_id=person_id,
                device_id=request.device_id,
                last_sync_timestamp=now,
            )
            session.add(cursor)

        await session.flush()

        return BatchSyncResponse(
            server_timestamp=now,
            processed_count=processed_count,
            duplicate_count=duplicate_count,
            tombstones_processed=tombstones_processed,
            next_sync_cursor=now,
            server_observations=server_observations,
            server_tombstones=server_tombstones,
        )

    @staticmethod
    async def prune_expired_raw_payloads(
        session: AsyncSession, retention_days: int = 30
    ) -> int:
        """Prune raw payload contents older than retention window (OD-07).

        Sets raw_payload = None while preserving source metadata for lineage.
        """
        cutoff = utc_now() - timedelta(days=retention_days)
        stmt = (
            update(SourceRecord)
            .where(
                SourceRecord.ingestion_timestamp < cutoff,
                SourceRecord.raw_payload.is_not(None),
            )
            .values(raw_payload=None)
        )
        result = await session.execute(stmt)
        await session.flush()
        count = result.rowcount
        logger.info(
            "Pruned expired raw source payloads",
            extra={"pruned_count": count, "retention_days": retention_days},
        )
        return count

    @staticmethod
    async def prune_expired_tombstones(
        session: AsyncSession, retention_days: int = 30
    ) -> int:
        """Purge tombstones older than retention window (OD-07)."""
        cutoff = utc_now() - timedelta(days=retention_days)
        stmt = delete(SyncTombstone).where(SyncTombstone.deleted_at < cutoff)
        result = await session.execute(stmt)
        await session.flush()
        count = result.rowcount
        logger.info(
            "Pruned expired sync tombstones",
            extra={"pruned_count": count, "retention_days": retention_days},
        )
        return count

