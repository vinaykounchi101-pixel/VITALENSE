"""Milestone 0.7.1.2 Sync Integrity and Concurrency Verification Suite.

Validates:
1. Tombstone Resurrection Protection (Critical Bug Fix):
   - Delete record, then replay same device_record_id (suppressed without HealthRecord join)
   - Delete record, then submit correction referencing its ID (409 Conflict)
   - Replay after original HealthRecord has been deleted from database
   - Strict person/account isolation (another person's record ID does not interfere)
   - Duplicate deletion requests are completely idempotent
   - In-batch ordering: deletion wins over replayed observation in same batch
2. Full-Resync Deletion Reconciliation Backend Contract:
   - Stale cursor (>30 days) triggers 409 SYNC_CURSOR_EXPIRED
   - Full resync (last_sync_timestamp=None) returns authoritative active baseline
   - Deleted records are absent from baseline
   - Pending offline drafts are uploaded, ingested, and not discarded
   - Account deletion status overrides and blocks full resync (HTTP 403)
3. Password Reset Concurrency:
   - Concurrent confirmation attempts with two independent database sessions
   - Pessimistic row-level locking (SELECT FOR UPDATE) ensures exactly one succeeds
   - Losing attempt is rejected with HTTP 400
   - Refresh token families revoked, password state consistent
"""

from __future__ import annotations

import asyncio
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from services.auth.service import AuthService
from services.sync.service import SyncService
from vitalsense_common.database import get_engine
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.models.auth import AuthRefreshToken
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.health_record import HealthRecord, SourceRecord
from vitalsense_common.models.sync import SyncTombstone
from vitalsense_common.schemas.auth import LoginRequest, RegisterRequest
from vitalsense_common.schemas.sync import (
    BatchSyncRequest,
    ObservationItem,
    TombstoneItem,
)


# =============================================================================
# 1. Tombstone Resurrection Protection & Isolation
# =============================================================================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_tombstone_prevents_device_record_id_replay_after_health_record_deletion() -> None:
    """Verify deleted record cannot be resurrected by replaying original device_record_id.

    Crucial: Proves resurrection check works AFTER the original HealthRecord has been deleted,
    without requiring joins against deleted HealthRecord rows.
    """
    engine = get_engine()
    async with AsyncSession(engine) as session:
        # Register user
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"tomb_replay_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        device_record_id = f"local-dev-id-{uuid.uuid4()}"

        # 1. Ingest initial observation
        batch_1 = BatchSyncRequest(
            device_id="device-A",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=3400.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=2),
                    device_record_id=device_record_id,
                )
            ],
        )
        res_1 = await SyncService.synchronize(session, person_id, batch_1)
        await session.commit()
        assert res_1.processed_count == 1

        # Query canonical health record ID
        hr_stmt = select(HealthRecord).where(
            HealthRecord.person_id == person_id,
            HealthRecord.metric_id == "steps",
        )
        hr_record = (await session.execute(hr_stmt)).scalar_one()
        hr_id = hr_record.id

        # 2. Delete the record via tombstone
        tombstone_batch = BatchSyncRequest(
            device_id="device-A",
            tombstones=[
                TombstoneItem(
                    target_record_id=hr_id,
                    record_type="health_record",
                    deleted_at=utc_now(),
                )
            ],
        )
        res_tomb = await SyncService.synchronize(session, person_id, tombstone_batch)
        await session.commit()
        assert res_tomb.tombstones_processed == 1

        # Verify HealthRecord is completely deleted from the database
        hr_check = await session.get(HealthRecord, hr_id)
        assert hr_check is None, "HealthRecord must be deleted from table"

        # Verify SyncTombstone captured the original device_record_id
        ts_stmt = select(SyncTombstone).where(
            SyncTombstone.person_id == person_id,
            SyncTombstone.target_record_id == hr_id,
        )
        ts_record = (await session.execute(ts_stmt)).scalar_one()
        assert ts_record.device_record_id == device_record_id

        # 3. Replay attempt: Device attempts to re-upload using the same device_record_id
        replay_batch = BatchSyncRequest(
            device_id="device-A",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=3400.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=2),
                    device_record_id=device_record_id,
                )
            ],
        )
        res_replay = await SyncService.synchronize(session, person_id, replay_batch)
        await session.commit()

        # Ingestion must be suppressed: processed_count == 0, duplicate_count == 1
        assert res_replay.processed_count == 0
        assert res_replay.duplicate_count == 1

        # Confirm no resurrected record exists in health_records
        hr_resurrect_check = (await session.execute(hr_stmt)).scalar_one_or_none()
        assert hr_resurrect_check is None, "Record must NOT be resurrected"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_tombstone_blocks_superseding_correction_with_409() -> None:
    """A deleted record cannot be corrected or resurrected through supersedes_record_id."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"tomb_supersede_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        # Ingest observation
        batch = BatchSyncRequest(
            device_id="device-1",
            observations=[
                ObservationItem(
                    metric_name="heart_rate",
                    value=75.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(minutes=30),
                )
            ],
        )
        res = await SyncService.synchronize(session, person_id, batch)
        await session.commit()
        assert res.processed_count == 1

        # Find record ID
        hr = (
            await session.execute(
                select(HealthRecord).where(HealthRecord.person_id == person_id)
            )
        ).scalar_one()
        hr_id = hr.id

        # Tombstone record
        tomb_batch = BatchSyncRequest(
            device_id="device-1",
            tombstones=[
                TombstoneItem(
                    target_record_id=hr_id,
                    record_type="health_record",
                    deleted_at=utc_now(),
                )
            ],
        )
        await SyncService.synchronize(session, person_id, tomb_batch)
        await session.commit()

        # Submit correction targeting the deleted record -> must raise HTTP 409
        correction_batch = BatchSyncRequest(
            device_id="device-2",
            observations=[
                ObservationItem(
                    metric_name="heart_rate",
                    value=78.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(minutes=30),
                    origin="user_entered",
                    correction_state="corrected",
                    supersedes_record_id=hr_id,
                )
            ],
        )
        with pytest.raises(HTTPException) as exc_info:
            await SyncService.synchronize(session, person_id, correction_batch)
        assert exc_info.value.status_code == 409
        assert "Cannot supersede or resurrect deleted record" in str(exc_info.value.detail)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_person_isolation_on_tombstone_device_record_id() -> None:
    """Another person using the same device_record_id string is NOT blocked by Person A's tombstone."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        # Create Person A
        reg_a = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"person_a_{uuid.uuid4().hex[:8]}@example.com",
                password="PasswordA123!",
            ),
        )
        # Create Person B
        reg_b = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"person_b_{uuid.uuid4().hex[:8]}@example.com",
                password="PasswordB123!",
            ),
        )
        await session.commit()

        shared_device_record_id = f"common-local-id-{uuid.uuid4()}"

        # Person A ingests record with shared_device_record_id
        batch_a = BatchSyncRequest(
            device_id="phone-a",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=4000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=1),
                    device_record_id=shared_device_record_id,
                )
            ],
        )
        await SyncService.synchronize(session, reg_a.person_id, batch_a)
        await session.commit()

        hr_a = (
            await session.execute(
                select(HealthRecord).where(HealthRecord.person_id == reg_a.person_id)
            )
        ).scalar_one()

        # Person A deletes the record
        tomb_a = BatchSyncRequest(
            device_id="phone-a",
            tombstones=[
                TombstoneItem(
                    target_record_id=hr_a.id,
                    record_type="health_record",
                    deleted_at=utc_now(),
                )
            ],
        )
        await SyncService.synchronize(session, reg_a.person_id, tomb_a)
        await session.commit()

        # Person B uploads observation with the SAME shared_device_record_id
        batch_b = BatchSyncRequest(
            device_id="phone-b",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=6000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=1),
                    device_record_id=shared_device_record_id,
                )
            ],
        )
        res_b = await SyncService.synchronize(session, reg_b.person_id, batch_b)
        await session.commit()

        # Person B's ingestion MUST SUCCEED (person isolation)
        assert res_b.processed_count == 1
        assert res_b.duplicate_count == 0

        hr_b = (
            await session.execute(
                select(HealthRecord).where(HealthRecord.person_id == reg_b.person_id)
            )
        ).scalar_one_or_none()
        assert hr_b is not None
        assert float(hr_b.value) == 6000.0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_duplicate_tombstone_submissions_are_idempotent() -> None:
    """Submitting the same deletion tombstone multiple times is completely idempotent and safe."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"dup_tomb_{uuid.uuid4().hex[:8]}@example.com",
                password="Password123!@#",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        # Ingest record
        batch = BatchSyncRequest(
            device_id="dev-1",
            observations=[
                ObservationItem(
                    metric_name="active_energy",
                    value=250.0,
                    unit="kcal",
                    measured_at=utc_now() - timedelta(minutes=15),
                )
            ],
        )
        res = await SyncService.synchronize(session, person_id, batch)
        await session.commit()

        hr = (
            await session.execute(
                select(HealthRecord).where(HealthRecord.person_id == person_id)
            )
        ).scalar_one()

        tomb_item = TombstoneItem(
            target_record_id=hr.id,
            record_type="health_record",
            deleted_at=utc_now(),
        )

        # First deletion submission
        res_1 = await SyncService.synchronize(
            session, person_id, BatchSyncRequest(device_id="dev-1", tombstones=[tomb_item])
        )
        await session.commit()
        assert res_1.tombstones_processed == 1

        # Second deletion submission (duplicate e.g. re-sync from device or offline retry)
        res_2 = await SyncService.synchronize(
            session, person_id, BatchSyncRequest(device_id="dev-1", tombstones=[tomb_item])
        )
        await session.commit()
        assert res_2.tombstones_processed == 1

        # Exactly one SyncTombstone record exists
        tombstones = (
            await session.execute(
                select(SyncTombstone).where(
                    SyncTombstone.person_id == person_id,
                    SyncTombstone.target_record_id == hr.id,
                )
            )
        ).scalars().all()
        assert len(tombstones) == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_deletion_wins_over_observation_in_same_sync_batch() -> None:
    """If a sync batch contains both a tombstone and an observation for the same record, deletion wins."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"batch_order_{uuid.uuid4().hex[:8]}@example.com",
                password="Password123!@#",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        device_rec_id = f"same-batch-{uuid.uuid4()}"

        # Ingest record in batch 1
        b1 = BatchSyncRequest(
            device_id="dev-1",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=1500.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=1),
                    device_record_id=device_rec_id,
                )
            ],
        )
        await SyncService.synchronize(session, person_id, b1)
        await session.commit()

        hr = (
            await session.execute(
                select(HealthRecord).where(HealthRecord.person_id == person_id)
            )
        ).scalar_one()

        # Batch 2 contains BOTH a tombstone for hr.id AND an observation replaying device_rec_id
        mixed_batch = BatchSyncRequest(
            device_id="dev-1",
            tombstones=[
                TombstoneItem(
                    target_record_id=hr.id,
                    record_type="health_record",
                    deleted_at=utc_now(),
                )
            ],
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=1500.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=1),
                    device_record_id=device_rec_id,
                )
            ],
        )
        res_mixed = await SyncService.synchronize(session, person_id, mixed_batch)
        await session.commit()

        # Tombstone processed, observation suppressed
        assert res_mixed.tombstones_processed == 1
        assert res_mixed.processed_count == 0
        assert res_mixed.duplicate_count == 1

        # Record is deleted
        hr_check = await session.get(HealthRecord, hr.id)
        assert hr_check is None


# =============================================================================
# 2. Full-Resync Deletion Reconciliation Backend Contract
# =============================================================================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_resync_backend_contract_and_draft_preservation() -> None:
    """Backend contract test for full-resync reconciliation.

    Verifies:
    1. Stale cursor (>30 days) returns 409 SYNC_CURSOR_EXPIRED.
    2. Full resync (last_sync_timestamp=None) provides authoritative active baseline.
    3. Deleted records are NOT returned in server_observations.
    4. Un-synced offline drafts are ingested, incorporated, and preserved.
    """
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"full_resync_{uuid.uuid4().hex[:8]}@example.com",
                password="Password123!@#",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        # Active record 1 (kept)
        # Active record 2 (will be deleted on server while client is offline)
        initial_batch = BatchSyncRequest(
            device_id="server_init",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=7000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(days=10),
                    device_record_id="rec-kept-1",
                ),
                ObservationItem(
                    metric_name="heart_rate",
                    value=65.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(days=10),
                    device_record_id="rec-deleted-2",
                ),
            ],
        )
        await SyncService.synchronize(session, person_id, initial_batch)
        await session.commit()

        # Find record 2 to delete
        hr_2 = (
            await session.execute(
                select(HealthRecord).where(
                    HealthRecord.person_id == person_id,
                    HealthRecord.metric_id == "heart_rate",
                )
            )
        ).scalar_one()

        # Server deletes record 2 via tombstone
        del_batch = BatchSyncRequest(
            device_id="web_dashboard",
            tombstones=[
                TombstoneItem(
                    target_record_id=hr_2.id,
                    record_type="health_record",
                    deleted_at=utc_now() - timedelta(days=5),
                )
            ],
        )
        await SyncService.synchronize(session, person_id, del_batch)
        await session.commit()

        # 1. Device that has been offline for 40 days attempts incremental sync -> 409
        stale_cursor = utc_now() - timedelta(days=40)
        stale_req = BatchSyncRequest(
            device_id="mobile_offline_phone",
            last_sync_timestamp=stale_cursor,
            observations=[],
        )
        with pytest.raises(HTTPException) as exc_expired:
            await SyncService.synchronize(session, person_id, stale_req)
        assert exc_expired.value.status_code == 409
        assert "SYNC_CURSOR_EXPIRED" in str(exc_expired.value.detail)

        # 2. Client performs full resync reconciliation (last_sync_timestamp=None)
        # Submitting un-synced offline draft recorded while disconnected
        offline_draft_id = f"local-draft-{uuid.uuid4()}"
        full_resync_req = BatchSyncRequest(
            device_id="mobile_offline_phone",
            last_sync_timestamp=None,
            observations=[
                ObservationItem(
                    metric_name="blood_oxygen_saturation",
                    value=98.0,
                    unit="percentage",
                    measured_at=utc_now() - timedelta(hours=2),
                    device_record_id=offline_draft_id,
                )
            ],
        )
        resync_resp = await SyncService.synchronize(session, person_id, full_resync_req)
        await session.commit()

        # Draft was ingested
        assert resync_resp.processed_count == 1
        assert resync_resp.next_sync_cursor is not None

        # Authoritative active baseline returned
        returned_metric_names = [o.metric_name for o in resync_resp.server_observations]
        returned_ids = [o.id for o in resync_resp.server_observations]

        # Kept record is in baseline
        assert "steps" in returned_metric_names
        # Deleted record is NOT in baseline
        assert hr_2.id not in returned_ids
        # Tombstones list is empty during full baseline resync
        assert len(resync_resp.server_tombstones) == 0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_account_deletion_overrides_full_resync() -> None:
    """Account marked for deletion cannot perform full resync (HTTP 403)."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"del_override_{uuid.uuid4().hex[:8]}@example.com",
                password="Password123!@#",
            ),
        )
        person_id = reg.person_id

        # Mark user account as deletion_pending
        user = await session.get(UserAccount, reg.user_account_id)
        assert user is not None
        user.status = "deletion_pending"
        await session.commit()

        req = BatchSyncRequest(
            device_id="dev-blocked",
            last_sync_timestamp=None,
            observations=[],
        )
        with pytest.raises(HTTPException) as exc_info:
            await SyncService.synchronize(session, person_id, req)
        assert exc_info.value.status_code == 403
        assert "deletion" in str(exc_info.value.detail).lower()


# =============================================================================
# 3. Password Reset Concurrency Integration Test
# =============================================================================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_concurrent_password_reset_confirmation() -> None:
    """Verify concurrent confirmation of same reset token from two sessions: exactly one succeeds."""
    engine = get_engine()
    email = f"concur_reset_{uuid.uuid4().hex[:8]}@example.com"
    initial_password = "InitialPassword123!"
    pw_attempt_1 = "WinningPassword123!"
    pw_attempt_2 = "LosingPassword456!"

    # 1. Setup user and generate reset token
    async with AsyncSession(engine) as session:
        reg_tokens = await AuthService.register_user(
            session,
            RegisterRequest(email=email, password=initial_password),
        )
        user_account_id = reg_tokens.user_account_id
        await session.commit()

        reset_token = await AuthService.request_password_reset(session, email)
        assert reset_token is not None
        await session.commit()

    # 2. Concurrently attempt confirmation from two independent sessions
    async def confirm_task(new_password: str) -> Tuple[bool, Optional[str]]:
        async with AsyncSession(engine) as s:
            try:
                await AuthService.confirm_password_reset(
                    session=s,
                    token=reset_token,
                    new_password=new_password,
                )
                await s.commit()
                return (True, None)
            except Exception as exc:
                await s.rollback()
                return (False, str(exc))

    results = await asyncio.gather(
        confirm_task(pw_attempt_1),
        confirm_task(pw_attempt_2),
        return_exceptions=False,
    )

    successes = [r for r in results if r[0] is True]
    failures = [r for r in results if r[0] is False]

    # Exactly one confirmation succeeds, one fails
    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}"
    assert len(failures) == 1, f"Expected exactly 1 failure, got {len(failures)}"

    failure_error = failures[0][1]
    assert (
        "already been consumed" in failure_error
        or "revoked" in failure_error
        or "400" in failure_error
    )

    # 3. Verify consistent database state
    async with AsyncSession(engine) as verify_session:
        # Determine which password succeeded
        winning_password = pw_attempt_1 if results[0][0] is True else pw_attempt_2
        losing_password = pw_attempt_2 if results[0][0] is True else pw_attempt_1

        # Verify the original refresh token family was revoked by password reset
        orig_token_hash = hashlib.sha256(reg_tokens.refresh_token.encode("utf-8")).hexdigest()
        orig_refresh_stmt = select(AuthRefreshToken).where(
            AuthRefreshToken.token_hash == orig_token_hash
        )
        orig_refresh = (await verify_session.execute(orig_refresh_stmt)).scalar_one()
        assert orig_refresh.is_revoked is True, "Original refresh token family must be revoked"

        # Authenticate with winning password -> succeeds
        auth_win = await AuthService.authenticate_user(
            verify_session,
            LoginRequest(email=email, password=winning_password),
        )
        assert auth_win.user_account_id == user_account_id

        # Authenticate with initial password -> fails 401
        with pytest.raises(HTTPException) as exc_old:
            await AuthService.authenticate_user(
                verify_session,
                LoginRequest(email=email, password=initial_password),
            )
        assert exc_old.value.status_code == 401

        # Authenticate with losing password -> fails 401
        with pytest.raises(HTTPException) as exc_lose:
            await AuthService.authenticate_user(
                verify_session,
                LoginRequest(email=email, password=losing_password),
            )
        assert exc_lose.value.status_code == 401


# =============================================================================
# 4. SHA-256 Algorithm Migration & Backward Compatibility Integration Tests
# =============================================================================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_sha256_migration_deduplication_against_legacy_fnv1a_records() -> None:
    """Verify that observations previously ingested under legacy FNV-1a IDs are detected
    and deduplicated when re-imported under canonical SHA-256 IDs, preventing historical duplicates."""
    engine = get_engine()
    now = datetime.now(timezone.utc)
    email = f"migration_dedup_{uuid.uuid4().hex[:8]}@example.com"
    measured_time = now - timedelta(hours=2)

    legacy_fnv_id = "det_hc_heart_rate_2026-11-03T06_00_00Z_1a2b3c4d"
    canonical_sha_id = "det_hc_heart_rate_2026-11-03T06_00_00Z_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session, RegisterRequest(email=email, password="SecurePassword123!")
        )
        person_id = reg.person_id
        await session.commit()

        # Step 1: Pre-migration legacy client ingests observation under legacy FNV-1a ID
        legacy_batch = BatchSyncRequest(
            device_id="mobile_android_device",
            observations=[
                ObservationItem(
                    metric_name="heart_rate",
                    value=74.0,
                    unit="bpm",
                    measured_at=measured_time,
                    device_record_id=legacy_fnv_id,
                )
            ],
        )
        res_legacy = await SyncService.synchronize(session, person_id, legacy_batch)
        assert res_legacy.processed_count == 1
        assert res_legacy.duplicate_count == 0
        await session.commit()

        # Verify exactly 1 HealthRecord exists
        hr_count_1 = (
            await session.execute(
                select(func.count(HealthRecord.id)).where(HealthRecord.person_id == person_id)
            )
        ).scalar()
        assert hr_count_1 == 1

        # Step 2: Post-migration client upgrades to SHA-256 and re-imports same time window
        # Attaches legacy_source_record_id in metadata
        upgraded_batch = BatchSyncRequest(
            device_id="mobile_android_device",
            observations=[
                ObservationItem(
                    metric_name="heart_rate",
                    value=74.0,
                    unit="bpm",
                    measured_at=measured_time,
                    device_record_id=canonical_sha_id,
                    metadata={"legacy_source_record_id": legacy_fnv_id},
                )
            ],
        )
        res_upgraded = await SyncService.synchronize(session, person_id, upgraded_batch)
        # Duplicate must be detected and suppressed! Zero duplicate records created!
        assert res_upgraded.processed_count == 0
        assert res_upgraded.duplicate_count == 1
        await session.commit()

        # Verify NO duplicate HealthRecord was inserted
        hr_count_2 = (
            await session.execute(
                select(func.count(HealthRecord.id)).where(HealthRecord.person_id == person_id)
            )
        ).scalar()
        assert hr_count_2 == 1, "Duplicate historical HealthRecord must NOT be created during SHA-256 migration"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_sha256_migration_tombstone_resurrection_prevention() -> None:
    """Verify that when a legacy observation was deleted (has a tombstone for legacy FNV-1a ID),
    an upgraded client re-importing under canonical SHA-256 ID does NOT resurrect the deleted record."""
    engine = get_engine()
    now = datetime.now(timezone.utc)
    email = f"migration_tomb_{uuid.uuid4().hex[:8]}@example.com"
    measured_time = now - timedelta(hours=3)

    legacy_fnv_id = "det_hc_steps_2026-11-03T06_00_00Z_9f8e7d6c"
    canonical_sha_id = "det_hc_steps_2026-11-03T06_00_00Z_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session, RegisterRequest(email=email, password="SecurePassword123!")
        )
        person_id = reg.person_id
        await session.commit()

        # Step 1: Ingest observation under legacy FNV-1a ID
        legacy_batch = BatchSyncRequest(
            device_id="device_legacy",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=500.0,
                    unit="count",
                    measured_at=measured_time,
                    device_record_id=legacy_fnv_id,
                )
            ],
        )
        await SyncService.synchronize(session, person_id, legacy_batch)
        await session.commit()

        # Resolve target health record UUID
        hr_id = (
            await session.execute(
                select(HealthRecord.id).where(HealthRecord.person_id == person_id)
            )
        ).scalar_one()

        # Step 2: Delete observation (creates SyncTombstone with device_record_id = legacy_fnv_id)
        tomb_batch = BatchSyncRequest(
            device_id="device_legacy",
            tombstones=[
                TombstoneItem(
                    target_record_id=hr_id,
                    record_type="health_record",
                    deleted_at=now,
                    device_record_id=legacy_fnv_id,
                )
            ],
        )
        res_del = await SyncService.synchronize(session, person_id, tomb_batch)
        assert res_del.tombstones_processed == 1
        await session.commit()

        # Verify health record is deleted
        hr_check = (
            await session.execute(
                select(HealthRecord.id).where(HealthRecord.person_id == person_id)
            )
        ).scalar_one_or_none()
        assert hr_check is None

        # Step 3: Upgraded client re-imports under canonical SHA-256 ID with legacy ID metadata
        upgraded_batch = BatchSyncRequest(
            device_id="device_upgraded",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=500.0,
                    unit="count",
                    measured_at=measured_time,
                    device_record_id=canonical_sha_id,
                    metadata={"legacy_source_record_id": legacy_fnv_id},
                )
            ],
        )
        res_upgraded = await SyncService.synchronize(session, person_id, upgraded_batch)
        # Resurrection MUST be suppressed!
        assert res_upgraded.processed_count == 0
        assert res_upgraded.duplicate_count == 1
        await session.commit()

        # Verify health record was NOT resurrected
        hr_resurrected = (
            await session.execute(
                select(HealthRecord.id).where(HealthRecord.person_id == person_id)
            )
        ).scalar_one_or_none()
        assert hr_resurrected is None, "Deleted record must NOT be resurrected during SHA-256 migration"

