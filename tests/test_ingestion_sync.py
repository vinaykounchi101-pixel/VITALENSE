"""Health Data Ingestion and Synchronization Domain Service Tests.

Implements OD-01, OD-04, OD-07, OD-14, OD-16, and SYNC-001 through SYNC-019:
- Approved Phase 1 metric validation
- Paired systolic/diastolic blood pressure clinical validation
- Ingestion deduplication via idempotency keys
- Immutable manual corrections and revision lineage (superseded_by_id)
- Deletion tombstone propagation
- Cursor tracking and 30-day expiration (SYNC_CURSOR_EXPIRED)
- Safe full-resynchronization workflow preserving offline drafts
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.database import get_engine
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.health_record import HealthRecord, SourceRecord
from vitalsense_common.models.sync import SyncTombstone
from vitalsense_common.schemas.auth import RegisterRequest
from vitalsense_common.schemas.sync import (
    BatchSyncRequest,
    ObservationItem,
    TombstoneItem,
)
from services.auth.service import AuthService
from services.sync.service import SyncService


@pytest.mark.integration
@pytest.mark.asyncio
async def test_paired_blood_pressure_validation() -> None:
    """Systolic blood pressure must strictly exceed diastolic blood pressure at the same timestamp."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        # Register a test person
        reg_req = RegisterRequest(
            email=f"bp_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        ts = utc_now()
        # Invalid: systolic (110) <= diastolic (120)
        invalid_batch = BatchSyncRequest(
            device_id="device-bp-test",
            observations=[
                ObservationItem(
                    metric_name="blood_pressure_systolic",
                    value=110.0,
                    unit="mmHg",
                    measured_at=ts,
                ),
                ObservationItem(
                    metric_name="blood_pressure_diastolic",
                    value=120.0,
                    unit="mmHg",
                    measured_at=ts,
                ),
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await SyncService.synchronize(session, tokens.person_id, invalid_batch)
        assert exc_info.value.status_code == 422
        assert "systolic" in exc_info.value.detail.lower()

        # Valid: systolic (120) > diastolic (80)
        valid_batch = BatchSyncRequest(
            device_id="device-bp-test",
            observations=[
                ObservationItem(
                    metric_name="blood_pressure_systolic",
                    value=120.0,
                    unit="mmHg",
                    measured_at=ts,
                    idempotency_key=f"sys-{uuid.uuid4()}",
                ),
                ObservationItem(
                    metric_name="blood_pressure_diastolic",
                    value=80.0,
                    unit="mmHg",
                    measured_at=ts,
                    idempotency_key=f"dia-{uuid.uuid4()}",
                ),
            ],
        )
        resp = await SyncService.synchronize(session, tokens.person_id, valid_batch)
        await session.commit()
        assert resp.processed_count == 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_idempotent_deduplication() -> None:
    """Submitting observations with an identical idempotency_key must skip duplicate insertion."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_req = RegisterRequest(
            email=f"idemp_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        key = f"key-{uuid.uuid4()}"
        batch = BatchSyncRequest(
            device_id="device-idemp",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=5000.0,
                    unit="count",
                    measured_at=utc_now(),
                    idempotency_key=key,
                )
            ],
        )

        # First submission
        res1 = await SyncService.synchronize(session, tokens.person_id, batch)
        await session.commit()
        assert res1.processed_count == 1
        assert res1.duplicate_count == 0

        # Second submission with same idempotency key
        res2 = await SyncService.synchronize(session, tokens.person_id, batch)
        await session.commit()
        assert res2.processed_count == 0
        assert res2.duplicate_count == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_immutable_manual_correction_lineage() -> None:
    """Corrected observation creates new record, preserves measured_at, and sets superseded_by_id (OD-04)."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_req = RegisterRequest(
            email=f"corr_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        orig_timestamp = datetime(2026, 10, 15, 10, 30, tzinfo=timezone.utc)

        # 1. Ingest original observation
        batch1 = BatchSyncRequest(
            device_id="device-corr",
            observations=[
                ObservationItem(
                    metric_name="resting_heart_rate",
                    value=65.0,
                    unit="bpm",
                    measured_at=orig_timestamp,
                    origin="device_sync",
                    idempotency_key=f"orig-{uuid.uuid4()}",
                )
            ],
        )
        res1 = await SyncService.synchronize(session, tokens.person_id, batch1)
        await session.commit()
        assert res1.processed_count == 1

        # Query inserted original record
        q = select(HealthRecord).where(
            HealthRecord.person_id == tokens.person_id,
            HealthRecord.superseded_by_id.is_(None),
        )
        res = await session.execute(q)
        orig_record = res.scalars().first()
        assert orig_record is not None
        orig_id = orig_record.id

        # 2. Ingest manual correction (OD-04: origin = user_entered)
        # Notice we pass measured_at as current time in request, but service MUST preserve original timestamp!
        correction_batch = BatchSyncRequest(
            device_id="web-client",
            observations=[
                ObservationItem(
                    metric_name="resting_heart_rate",
                    value=62.0,
                    unit="bpm",
                    measured_at=utc_now(),  # Sent by UI, but superseded record's measured_at must be preserved
                    origin="user_entered",
                    correction_state="corrected",
                    supersedes_record_id=orig_id,
                    idempotency_key=f"corr-{uuid.uuid4()}",
                )
            ],
        )
        res2 = await SyncService.synchronize(session, tokens.person_id, correction_batch)
        await session.commit()
        assert res2.processed_count == 1

        # Query updated records
        orig_reloaded = await session.get(HealthRecord, orig_id)
        assert orig_reloaded.correction_state == "superseded"
        assert orig_reloaded.superseded_by_id is not None

        new_record = await session.get(HealthRecord, orig_reloaded.superseded_by_id)
        assert new_record.correction_state == "corrected"
        assert new_record.origin == "user_entered"
        assert float(new_record.value) == 62.0
        # CRITICAL OD-04 ASSERTION: Original event_timestamp is preserved!
        assert new_record.event_timestamp == orig_timestamp


@pytest.mark.integration
@pytest.mark.asyncio
async def test_deletion_tombstone_propagation() -> None:
    """Tombstone removes record from health_records and creates an entry in sync_tombstones (OD-14)."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_req = RegisterRequest(
            email=f"del_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        # Ingest record
        batch = BatchSyncRequest(
            device_id="device-del",
            observations=[
                ObservationItem(
                    metric_name="blood_oxygen_saturation",
                    value=98.0,
                    unit="percent",
                    measured_at=utc_now(),
                    idempotency_key=f"spo2-{uuid.uuid4()}",
                )
            ],
        )
        res = await SyncService.synchronize(session, tokens.person_id, batch)
        await session.commit()
        assert res.processed_count == 1

        q = select(HealthRecord).where(HealthRecord.person_id == tokens.person_id)
        rec = (await session.execute(q)).scalars().first()
        assert rec is not None
        rec_id = rec.id

        # Delete via tombstone
        del_batch = BatchSyncRequest(
            device_id="device-del",
            tombstones=[
                TombstoneItem(
                    target_record_id=rec_id,
                    record_type="health_record",
                    deleted_at=utc_now(),
                )
            ],
        )
        del_res = await SyncService.synchronize(session, tokens.person_id, del_batch)
        await session.commit()
        assert del_res.tombstones_processed == 1

        # Verify record removed from health_records
        rec_after = await session.get(HealthRecord, rec_id)
        assert rec_after is None

        # Verify tombstone exists
        ts_q = select(SyncTombstone).where(SyncTombstone.target_record_id == rec_id)
        ts_entry = (await session.execute(ts_q)).scalars().first()
        assert ts_entry is not None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_cursor_expiration_returns_409() -> None:
    """If client's last_sync_timestamp is older than 30 days, return 409 SYNC_CURSOR_EXPIRED."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_req = RegisterRequest(
            email=f"cursor_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        # 31 days ago
        stale_timestamp = utc_now() - timedelta(days=31)

        batch = BatchSyncRequest(
            device_id="device-stale",
            last_sync_timestamp=stale_timestamp,
        )

        with pytest.raises(HTTPException) as exc_info:
            await SyncService.synchronize(session, tokens.person_id, batch)
        assert exc_info.value.status_code == 409
        detail = exc_info.value.detail
        assert detail["code"] == "SYNC_CURSOR_EXPIRED"
        assert detail["preserve_local_drafts"] is True
        assert "instructions" in detail
