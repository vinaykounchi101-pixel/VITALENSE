"""Tests for Permanent Device Source ID Replay Protection.

Verifies:
1. Replay after tombstone pruning cannot resurrect deleted records (proven against PostgreSQL).
2. Different valid records can still be ingested after a previous record is deleted and pruned.
3. Same-person duplicates are suppressed.
4. Concurrent duplicate ingestion is concurrency-safe via unique constraint and savepoints.
5. Different people using the same external ID do not conflict (tenant isolation).
6. Different source devices using the same external ID do not conflict.
7. NULL device_record_id allows multiple manual entries without conflict.
8. Explicit idempotency keys provide deduplication.
9. Raw payload pruning preserves permanent replay protection.
10. Immutable corrections with new device record IDs succeed.
11. In-batch deletion precedence ensures deletion wins over observation replay.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from services.auth.service import AuthService
from services.sync.service import SyncService
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


@pytest.mark.integration
@pytest.mark.asyncio
async def test_replay_after_tombstone_pruned_cannot_resurrect_and_different_record_succeeds() -> None:
    """Critical verification:
    1. Ingest observation with stable device source ID.
    2. Delete it and create tombstone.
    3. Prune tombstone (simulating >30 day tombstone retention expiry).
    4. Replay original device source ID -> Prove deleted record cannot be recreated.
    5. Ingest different valid record -> Prove new records can still be ingested cleanly.
    """
    engine = get_engine()
    async with AsyncSession(engine) as session:
        # Register user
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"prune_test_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        stable_device_record_id = f"wearable-id-{uuid.uuid4()}"

        # 1. Ingest observation
        batch_1 = BatchSyncRequest(
            device_id="wearable-device-1",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=4500.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=3),
                    device_record_id=stable_device_record_id,
                )
            ],
        )
        res_1 = await SyncService.synchronize(session, person_id, batch_1)
        await session.commit()
        assert res_1.processed_count == 1
        assert res_1.duplicate_count == 0

        # Query created HealthRecord
        hr_stmt = select(HealthRecord).where(
            HealthRecord.person_id == person_id,
            HealthRecord.metric_id == "steps",
        )
        hr_row = (await session.execute(hr_stmt)).scalar_one()
        hr_id = hr_row.id

        # 2. Delete the record via tombstone
        del_batch = BatchSyncRequest(
            device_id="wearable-device-1",
            tombstones=[
                TombstoneItem(
                    target_record_id=hr_id,
                    record_type="health_record",
                    deleted_at=utc_now(),
                )
            ],
        )
        res_del = await SyncService.synchronize(session, person_id, del_batch)
        await session.commit()
        assert res_del.tombstones_processed == 1

        # Verify HealthRecord is deleted from DB
        hr_check = await session.execute(select(HealthRecord).where(HealthRecord.id == hr_id))
        assert hr_check.scalar_one_or_none() is None

        # Verify SyncTombstone was created
        ts_check = await session.execute(
            select(SyncTombstone).where(
                SyncTombstone.person_id == person_id,
                SyncTombstone.device_record_id == stable_device_record_id,
            )
        )
        assert ts_check.scalar_one_or_none() is not None

        # 3. Prune the tombstone (simulate 30-day retention worker deletion)
        await session.execute(
            delete(SyncTombstone).where(SyncTombstone.person_id == person_id)
        )
        await session.commit()

        # Confirm tombstone is now gone
        ts_gone = await session.execute(
            select(SyncTombstone).where(SyncTombstone.person_id == person_id)
        )
        assert ts_gone.scalar_one_or_none() is None

        # 4. Replay the original device_record_id (without idempotency key, new sync session)
        replay_batch = BatchSyncRequest(
            device_id="wearable-device-1",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=4500.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=3),
                    device_record_id=stable_device_record_id,
                )
            ],
        )
        res_replay = await SyncService.synchronize(session, person_id, replay_batch)
        await session.commit()

        # PROOF 1: The deleted record was NOT recreated!
        assert res_replay.processed_count == 0
        assert res_replay.duplicate_count == 1

        # PROOF 2: HealthRecord table has zero records for this person
        hr_after_replay = await session.execute(
            select(HealthRecord).where(HealthRecord.person_id == person_id)
        )
        assert hr_after_replay.fetchall() == []

        # 5. Ingest a DIFFERENT valid record
        new_device_record_id = f"wearable-id-{uuid.uuid4()}"
        new_batch = BatchSyncRequest(
            device_id="wearable-device-1",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=6200.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=1),
                    device_record_id=new_device_record_id,
                )
            ],
        )
        res_new = await SyncService.synchronize(session, person_id, new_batch)
        await session.commit()

        # PROOF 3: The new valid observation ingested successfully!
        assert res_new.processed_count == 1
        assert res_new.duplicate_count == 0

        hr_new_check = await session.execute(
            select(HealthRecord).where(HealthRecord.person_id == person_id)
        )
        active_records = hr_new_check.scalars().all()
        assert len(active_records) == 1
        assert active_records[0].value == 6200.0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_same_person_duplicates_suppressed() -> None:
    """Verify in-flight duplicate submission for the same person is suppressed."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"dup_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        dev_id = f"dev-rec-{uuid.uuid4()}"
        batch = BatchSyncRequest(
            device_id="device-test",
            observations=[
                ObservationItem(
                    metric_name="heart_rate",
                    value=72.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(minutes=10),
                    device_record_id=dev_id,
                )
            ],
        )
        res_1 = await SyncService.synchronize(session, person_id, batch)
        await session.commit()
        assert res_1.processed_count == 1

        # Second submission
        res_2 = await SyncService.synchronize(session, person_id, batch)
        await session.commit()
        assert res_2.processed_count == 0
        assert res_2.duplicate_count == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_concurrent_duplicate_ingestion() -> None:
    """Verify simultaneous duplicate ingestion is concurrency-safe without 500 errors."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"concurrent_ingest_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

    shared_dev_id = f"concurrent-dev-{uuid.uuid4()}"
    batch = BatchSyncRequest(
        device_id="concurrent-device",
        observations=[
            ObservationItem(
                metric_name="blood_oxygen_saturation",
                value=98.0,
                unit="percentage",
                measured_at=utc_now() - timedelta(minutes=5),
                device_record_id=shared_dev_id,
            )
        ],
    )

    async def ingest_attempt() -> BatchSyncResponse:
        async with AsyncSession(engine) as s:
            res = await SyncService.synchronize(s, person_id, batch)
            await s.commit()
            return res

    results = await asyncio.gather(ingest_attempt(), ingest_attempt())
    processed_total = sum(r.processed_count for r in results)
    duplicate_total = sum(r.duplicate_count for r in results)

    # Exactly one succeeded and one was suppressed
    assert processed_total == 1
    assert duplicate_total == 1

    # Verify only 1 HealthRecord exists in DB
    async with AsyncSession(engine) as s:
        hr_count = (
            await s.execute(
                select(HealthRecord).where(
                    HealthRecord.person_id == person_id,
                    HealthRecord.metric_id == "blood_oxygen_saturation",
                )
            )
        ).scalars().all()
        assert len(hr_count) == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_different_people_with_same_device_record_id() -> None:
    """Verify tenant isolation: two different users with identical device_record_id do not collide."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_a = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"user_a_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        reg_b = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"user_b_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_a = reg_a.person_id
        person_b = reg_b.person_id
        await session.commit()

        shared_id = f"wearable-id-{uuid.uuid4()}"
        batch = BatchSyncRequest(
            device_id="wearable-source",
            observations=[
                ObservationItem(
                    metric_name="heart_rate",
                    value=65.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(minutes=15),
                    device_record_id=shared_id,
                )
            ],
        )

        res_a = await SyncService.synchronize(session, person_a, batch)
        await session.commit()
        assert res_a.processed_count == 1

        res_b = await SyncService.synchronize(session, person_b, batch)
        await session.commit()
        assert res_b.processed_count == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_different_sources_with_same_device_record_id() -> None:
    """Verify source isolation: same person using two devices with identical local ID does not collide."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"user_src_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        shared_local_id = "device-local-id-1"

        batch_source_1 = BatchSyncRequest(
            device_id="apple-watch-source",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=1200.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(minutes=30),
                    device_record_id=shared_local_id,
                )
            ],
        )
        res_1 = await SyncService.synchronize(session, person_id, batch_source_1)
        await session.commit()
        assert res_1.processed_count == 1

        batch_source_2 = BatchSyncRequest(
            device_id="pixel-watch-source",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=1500.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(minutes=20),
                    device_record_id=shared_local_id,
                )
            ],
        )
        res_2 = await SyncService.synchronize(session, person_id, batch_source_2)
        await session.commit()
        assert res_2.processed_count == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_null_source_ids_multiple_entries_allowed() -> None:
    """Verify observations with NULL device_record_id (e.g. manual entries) can be ingested repeatedly."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"null_src_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        for val in [95.0, 105.0, 110.0]:
            batch = BatchSyncRequest(
                device_id="web-manual-entry",
                observations=[
                    ObservationItem(
                        metric_name="blood_glucose",
                        value=val,
                        unit="mg/dL",
                        measured_at=utc_now() - timedelta(hours=1),
                        device_record_id=None,
                    )
                ],
            )
            res = await SyncService.synchronize(session, person_id, batch)
            await session.commit()
            assert res.processed_count == 1

        # Verify 3 records exist
        all_glucose = (
            await session.execute(
                select(HealthRecord).where(
                    HealthRecord.person_id == person_id,
                    HealthRecord.metric_id == "blood_glucose",
                )
            )
        ).scalars().all()
        assert len(all_glucose) == 3


@pytest.mark.integration
@pytest.mark.asyncio
async def test_explicit_idempotency_keys_deduplication() -> None:
    """Verify deduplication when client provides explicit idempotency_key without device_record_id."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"idem_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        custom_key = f"client-idem-{uuid.uuid4()}"
        batch = BatchSyncRequest(
            device_id="web-client",
            observations=[
                ObservationItem(
                    metric_name="resting_heart_rate",
                    value=58.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(minutes=10),
                    idempotency_key=custom_key,
                )
            ],
        )

        res_1 = await SyncService.synchronize(session, person_id, batch)
        await session.commit()
        assert res_1.processed_count == 1

        res_2 = await SyncService.synchronize(session, person_id, batch)
        await session.commit()
        assert res_2.processed_count == 0
        assert res_2.duplicate_count == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_raw_payload_pruning_preserves_replay_protection() -> None:
    """Verify that after raw_payload is pruned to NULL, replay protection still holds."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"payload_prune_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        stable_id = f"payload-prune-dev-{uuid.uuid4()}"
        batch = BatchSyncRequest(
            device_id="wearable-prune",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=8000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(days=35),
                    device_record_id=stable_id,
                )
            ],
        )
        res_1 = await SyncService.synchronize(session, person_id, batch)
        await session.commit()
        assert res_1.processed_count == 1

        # Simulate retention worker setting raw_payload = NULL
        await session.execute(
            update(SourceRecord)
            .where(
                SourceRecord.person_id == person_id,
                SourceRecord.source_record_id == stable_id,
            )
            .values(raw_payload=None)
        )
        await session.commit()

        # Verify raw_payload is NULL but row exists
        sr_row = (
            await session.execute(
                select(SourceRecord).where(
                    SourceRecord.person_id == person_id,
                    SourceRecord.source_record_id == stable_id,
                )
            )
        ).scalar_one()
        assert sr_row.raw_payload is None
        assert sr_row.source_record_id == stable_id

        # Now replay the observation
        res_replay = await SyncService.synchronize(session, person_id, batch)
        await session.commit()
        assert res_replay.processed_count == 0
        assert res_replay.duplicate_count == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_immutable_corrections_with_new_device_id_succeeds() -> None:
    """Verify manual correction with a new device_record_id correctly supersedes target record."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"correction_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        # 1. Ingest original record
        orig_batch = BatchSyncRequest(
            device_id="device-corr",
            observations=[
                ObservationItem(
                    metric_name="resting_heart_rate",
                    value=65.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(hours=1),
                    device_record_id=f"orig-{uuid.uuid4()}",
                )
            ],
        )
        res_orig = await SyncService.synchronize(session, person_id, orig_batch)
        await session.commit()
        assert res_orig.processed_count == 1

        # Query original record ID
        orig_row = (
            await session.execute(
                select(HealthRecord).where(
                    HealthRecord.person_id == person_id,
                    HealthRecord.metric_id == "resting_heart_rate",
                )
            )
        ).scalar_one()
        orig_id = orig_row.id

        # 2. Submit correction
        corr_batch = BatchSyncRequest(
            device_id="device-corr",
            observations=[
                ObservationItem(
                    metric_name="resting_heart_rate",
                    value=62.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(hours=1),
                    device_record_id=f"corr-{uuid.uuid4()}",
                    correction_state="corrected",
                    supersedes_record_id=orig_id,
                )
            ],
        )
        res_corr = await SyncService.synchronize(session, person_id, corr_batch)
        await session.commit()
        assert res_corr.processed_count == 1

        # Verify lineage
        refreshed_orig = (
            await session.execute(select(HealthRecord).where(HealthRecord.id == orig_id))
        ).scalar_one()
        assert refreshed_orig.correction_state == "superseded"
        assert refreshed_orig.superseded_by_id is not None

        new_record = (
            await session.execute(
                select(HealthRecord).where(HealthRecord.id == refreshed_orig.superseded_by_id)
            )
        ).scalar_one()
        assert new_record.value == 62.0
        assert new_record.correction_state == "corrected"
        assert new_record.event_timestamp == refreshed_orig.event_timestamp


@pytest.mark.integration
@pytest.mark.asyncio
async def test_deletion_precedence_in_same_batch() -> None:
    """Verify in-batch deletion ordering: tombstone executes before observation, suppressing re-insertion."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"precedence_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        # Ingest initial record
        dev_id = f"prec-dev-{uuid.uuid4()}"
        init_batch = BatchSyncRequest(
            device_id="device-prec",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=5000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=2),
                    device_record_id=dev_id,
                )
            ],
        )
        res_init = await SyncService.synchronize(session, person_id, init_batch)
        await session.commit()
        assert res_init.processed_count == 1

        orig_row = (
            await session.execute(
                select(HealthRecord).where(
                    HealthRecord.person_id == person_id,
                    HealthRecord.metric_id == "steps",
                )
            )
        ).scalar_one()
        orig_id = orig_row.id

        # Submit batch containing BOTH tombstone for orig_id AND observation with same dev_id
        same_batch = BatchSyncRequest(
            device_id="device-prec",
            tombstones=[
                TombstoneItem(
                    target_record_id=orig_id,
                    record_type="health_record",
                    deleted_at=utc_now(),
                )
            ],
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=5000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=2),
                    device_record_id=dev_id,
                )
            ],
        )
        res_same = await SyncService.synchronize(session, person_id, same_batch)
        await session.commit()

        # Deletion processed, observation suppressed
        assert res_same.tombstones_processed == 1
        assert res_same.processed_count == 0
        assert res_same.duplicate_count == 1

        # Verify no HealthRecord remains
        remaining = (
            await session.execute(select(HealthRecord).where(HealthRecord.person_id == person_id))
        ).scalars().all()
        assert len(remaining) == 0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_first_ingestion_and_subsequent_duplicate_retry() -> None:
    """Verify first ingestion succeeds and immediate identical re-submission is cleanly marked duplicate."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"first_ingest_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        stable_id = f"dev-first-{uuid.uuid4()}"
        batch = BatchSyncRequest(
            device_id="sensor-watch",
            observations=[
                ObservationItem(
                    metric_name="heart_rate",
                    value=72.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(minutes=10),
                    device_record_id=stable_id,
                )
            ],
        )

        # First ingestion
        res_1 = await SyncService.synchronize(session, person_id, batch)
        await session.commit()
        assert res_1.processed_count == 1
        assert res_1.duplicate_count == 0

        # Duplicate ingestion retry
        res_2 = await SyncService.synchronize(session, person_id, batch)
        await session.commit()
        assert res_2.processed_count == 0
        assert res_2.duplicate_count == 1

        # Verify only 1 HealthRecord exists
        records = (
            await session.execute(
                select(HealthRecord).where(
                    HealthRecord.person_id == person_id,
                    HealthRecord.metric_id == "heart_rate",
                )
            )
        ).scalars().all()
        assert len(records) == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_retry_after_transaction_failure_succeeds_without_partial_records() -> None:
    """Verify that if a transaction fails (e.g. invalid validation on later record),
    the session rolls back cleanly, leaves zero partial records, and a subsequent corrected retry succeeds."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"tx_fail_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        stable_id_1 = f"dev-tx-1-{uuid.uuid4()}"
        stable_id_2 = f"dev-tx-2-{uuid.uuid4()}"
        now = utc_now()

        # Batch with valid first observation, but invalid second observation (end_timestamp precedes measured_at)
        invalid_batch = BatchSyncRequest(
            device_id="sensor-tx",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=1500.0,
                    unit="count",
                    measured_at=now - timedelta(hours=2),
                    device_record_id=stable_id_1,
                ),
                ObservationItem(
                    metric_name="steps",
                    value=2000.0,
                    unit="count",
                    measured_at=now - timedelta(hours=1),
                    end_timestamp=now - timedelta(hours=3),  # Inverted duration triggers 422
                    device_record_id=stable_id_2,
                ),
            ],
        )

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await SyncService.synchronize(session, person_id, invalid_batch)
        assert exc_info.value.status_code == 422
        await session.rollback()

        # Verify transaction rollback left zero records
        source_count = (
            await session.execute(
                select(SourceRecord).where(SourceRecord.person_id == person_id)
            )
        ).scalars().all()
        health_count = (
            await session.execute(
                select(HealthRecord).where(HealthRecord.person_id == person_id)
            )
        ).scalars().all()
        assert len(source_count) == 0
        assert len(health_count) == 0

        # Now retry with a corrected valid batch using the original device IDs
        corrected_batch = BatchSyncRequest(
            device_id="sensor-tx",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=1500.0,
                    unit="count",
                    measured_at=now - timedelta(hours=2),
                    device_record_id=stable_id_1,
                ),
                ObservationItem(
                    metric_name="steps",
                    value=2000.0,
                    unit="count",
                    measured_at=now - timedelta(hours=1),
                    end_timestamp=now - timedelta(minutes=30),  # Valid duration
                    device_record_id=stable_id_2,
                ),
            ],
        )
        res_corrected = await SyncService.synchronize(session, person_id, corrected_batch)
        await session.commit()

        assert res_corrected.processed_count == 2
        assert res_corrected.duplicate_count == 0

        final_health_records = (
            await session.execute(
                select(HealthRecord).where(HealthRecord.person_id == person_id)
            )
        ).scalars().all()
        assert len(final_health_records) == 2

