"""Milestone 0.7.1 Security and Synchronization Hardening Verification Suite.

Validates:
- OD-18: SameSite=Strict, HttpOnly cookie flags, and double-submit CSRF protection
- SEC-002, SEC-008: Rate limiting and brute force protection
- SEC-007: Password reset single-use token lifecycle and cross-session revocation
- OD-01, SYNC-003: Strict metric unit validation against canonical units
- SYNC-004: Ingestion timestamp validation (future timestamp & inverted duration rejection)
- SYNC-012: Batch size limits (max 500 items)
- OD-07, SYNC-010: Account deletion precedence blocking synchronization
- OD-14, FR-PRIV-004: Resurrection prevention against active tombstones
- OD-07: Operational raw payload and tombstone retention pruning (30-day window)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.api.main import app
from services.auth.rate_limiter import auth_rate_limiter
from services.auth.service import AuthService
from services.sync.service import SyncService
from vitalsense_common.database import get_engine
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.health_record import HealthRecord, SourceRecord
from vitalsense_common.models.sync import SyncTombstone
from vitalsense_common.schemas.auth import (
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RegisterRequest,
)
from vitalsense_common.schemas.sync import (
    BatchSyncRequest,
    ObservationItem,
    TombstoneItem,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_limiter() -> None:
    """Reset rate limiter state before each test."""
    auth_rate_limiter.reset()


@pytest.mark.integration
def test_cookie_security_samesite_strict_and_httponly() -> None:
    """OD-18: Verify that auth cookies enforce SameSite=Strict, HttpOnly, and non-HttpOnly CSRF token."""
    email = f"strict_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecureStrictPassword123!"

    resp = client.post(
        "/api/v1/web/auth/register",
        json={"email": email, "password": pwd, "display_name": "Strict Cookie User"},
    )
    assert resp.status_code == 201

    # Inspect Set-Cookie headers
    set_cookie_headers = resp.headers.get_list("set-cookie")
    access_cookie_raw = next((h for h in set_cookie_headers if "vitalsense_access_token=" in h), "")
    refresh_cookie_raw = next((h for h in set_cookie_headers if "vitalsense_refresh_token=" in h), "")
    csrf_cookie_raw = next((h for h in set_cookie_headers if "vitalsense_csrf_token=" in h), "")

    # Access Token: HttpOnly and SameSite=Strict
    assert "HttpOnly" in access_cookie_raw or "httponly" in access_cookie_raw.lower()
    assert "samesite=strict" in access_cookie_raw.lower()

    # Refresh Token: HttpOnly and SameSite=Strict
    assert "HttpOnly" in refresh_cookie_raw or "httponly" in refresh_cookie_raw.lower()
    assert "samesite=strict" in refresh_cookie_raw.lower()

    # CSRF Token: NOT HttpOnly (accessible to client JS) and SameSite=Strict
    assert "httponly" not in csrf_cookie_raw.lower()
    assert "samesite=strict" in csrf_cookie_raw.lower()


@pytest.mark.integration
def test_csrf_double_submit_protection() -> None:
    """OD-18: Verify CSRF token double-submit verification for cookie-authenticated state-changing requests."""
    email = f"csrf_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecureCsrfPassword123!"

    # 1. Register and retrieve cookies
    resp = client.post(
        "/api/v1/web/auth/register",
        json={"email": email, "password": pwd, "display_name": "CSRF User"},
    )
    assert resp.status_code == 201
    cookies = resp.cookies
    csrf_token = cookies["vitalsense_csrf_token"]

    # 2. State-changing request with cookie but WITHOUT X-CSRF-Token header -> 403 Forbidden
    blocked_resp = client.post("/api/v1/web/auth/refresh", cookies=cookies)
    assert blocked_resp.status_code == 403
    assert "CSRF verification failed" in blocked_resp.json()["error"]["message"]

    # 3. State-changing request with cookie and MISMATCHED X-CSRF-Token -> 403 Forbidden
    mismatch_resp = client.post(
        "/api/v1/web/auth/refresh",
        cookies=cookies,
        headers={"X-CSRF-Token": "invalid_tampered_csrf_token"},
    )
    assert mismatch_resp.status_code == 403

    # 4. State-changing request with cookie and MATCHING X-CSRF-Token -> 200 OK
    ok_resp = client.post(
        "/api/v1/web/auth/refresh",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf_token},
    )
    assert ok_resp.status_code == 200

    # 5. Bearer token request bypasses CSRF requirement (for native / API clients)
    mob_login = client.post(
        "/api/v1/mobile/auth/login",
        json={"email": email, "password": pwd},
    )
    assert mob_login.status_code == 200
    bearer_token = mob_login.json()["data"]["access_token"]
    bearer_resp = client.post(
        "/api/v1/web/sync",
        headers={"Authorization": f"Bearer {bearer_token}"},
        json={"device_id": "test-device", "observations": [], "tombstones": []},
    )
    assert bearer_resp.status_code == 200


@pytest.mark.integration
def test_auth_rate_limiting() -> None:
    """SEC-002, SEC-008: Verify rate limiting triggers HTTP 429 when threshold is exceeded."""
    email = f"ratelimit_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SomePassword123!"

    # Send 10 rapid login attempts (up to limit)
    for _ in range(10):
        client.post(
            "/api/v1/web/auth/login",
            json={"email": email, "password": pwd},
        )

    # 11th request must be rejected with HTTP 429
    blocked_resp = client.post(
        "/api/v1/web/auth/login",
        json={"email": email, "password": pwd},
    )
    assert blocked_resp.status_code == 429
    assert "Rate limit exceeded" in blocked_resp.json()["error"]["message"]


@pytest.mark.integration
def test_password_reset_foundations() -> None:
    """SEC-007: Test single-use expiring password reset token, password update, and session family revocation."""
    email = f"pwdreset_{uuid.uuid4().hex[:8]}@example.com"
    old_pwd = "OldPassword123!"
    new_pwd = "NewSecurePassword456!"

    # 1. Register account via web client
    reg_resp = client.post(
        "/api/v1/web/auth/register",
        json={"email": email, "password": old_pwd, "display_name": "Reset User"},
    )
    assert reg_resp.status_code == 201
    # Verify web response body does NOT leak access or refresh tokens
    assert "access_token" not in reg_resp.json()["data"]
    assert "refresh_token" not in reg_resp.json()["data"]
    old_refresh_token = reg_resp.cookies["vitalsense_refresh_token"]

    # 2. Request password reset token
    reset_req_resp = client.post(
        "/api/v1/web/auth/password-reset/request",
        json={"email": email},
    )
    assert reset_req_resp.status_code == 200
    reset_token = reset_req_resp.json()["data"]["reset_token"]
    assert reset_token is not None

    # 3. Confirm password reset
    confirm_resp = client.post(
        "/api/v1/web/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": new_pwd},
    )
    assert confirm_resp.status_code == 200

    # 3b. REPLAY PREVENTION (SEC-007): Replaying the consumed reset token MUST fail
    replay_resp = client.post(
        "/api/v1/web/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": "AnotherPassword789!"},
    )
    assert replay_resp.status_code == 400
    assert "already been consumed" in replay_resp.json()["error"]["message"]

    # 4. Old password must fail
    fail_login = client.post(
        "/api/v1/web/auth/login",
        json={"email": email, "password": old_pwd},
    )
    assert fail_login.status_code == 401

    # 5. New password must succeed
    succ_login = client.post(
        "/api/v1/web/auth/login",
        json={"email": email, "password": new_pwd},
    )
    assert succ_login.status_code == 200

    # 6. Prior refresh token must be revoked (cross-device session invalidation on reset)
    revoked_refresh = client.post(
        "/api/v1/mobile/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert revoked_refresh.status_code == 401


@pytest.mark.integration
def test_batch_size_limit_rejection() -> None:
    """SYNC-012: Batch synchronization rejects batches exceeding 500 items with HTTP 422."""
    email = f"batchlimit_{uuid.uuid4().hex[:8]}@example.com"
    reg_resp = client.post(
        "/api/v1/mobile/auth/register",
        json={"email": email, "password": "SecurePassword123!", "display_name": "Batch User"},
    )
    assert reg_resp.status_code == 201
    bearer_token = reg_resp.json()["data"]["access_token"]

    now = utc_now()
    # Construct 501 observations
    oversized_observations = [
        {
            "metric_name": "steps",
            "value": float(i),
            "unit": "count",
            "measured_at": (now - timedelta(minutes=i + 1)).isoformat(),
        }
        for i in range(501)
    ]

    resp = client.post(
        "/api/v1/web/sync",
        headers={"Authorization": f"Bearer {bearer_token}"},
        json={"device_id": "test-device", "observations": oversized_observations},
    )
    assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_metric_unit_strict_validation() -> None:
    """OD-01, SYNC-003: Observations with incompatible units must be rejected with HTTP 422."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_req = RegisterRequest(
            email=f"unitval_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        # Submit 'steps' with 'meters' (canonical unit is 'count')
        invalid_batch = BatchSyncRequest(
            device_id="device-unit-test",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=1500.0,
                    unit="meters",
                    measured_at=utc_now(),
                )
            ],
        )

        with pytest.raises(Exception) as exc_info:
            await SyncService.synchronize(session, tokens.person_id, invalid_batch)
        assert "422" in str(exc_info.value)
        assert "Invalid unit 'meters' for metric 'steps'" in str(exc_info.value)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_future_and_inverted_duration_timestamp_validation() -> None:
    """SYNC-004: Ingestion rejects timestamps >5 minutes in the future or inverted durations."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_req = RegisterRequest(
            email=f"timeval_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        # 1. Future timestamp (>5 minutes)
        future_batch = BatchSyncRequest(
            device_id="device-future",
            observations=[
                ObservationItem(
                    metric_name="heart_rate",
                    value=72.0,
                    unit="bpm",
                    measured_at=utc_now() + timedelta(minutes=15),
                )
            ],
        )
        with pytest.raises(Exception) as exc_info1:
            await SyncService.synchronize(session, tokens.person_id, future_batch)
        assert "422" in str(exc_info1.value)
        assert "cannot be in the future" in str(exc_info1.value)

        # 2. Inverted duration (end_timestamp < measured_at)
        start = utc_now() - timedelta(hours=1)
        end = start - timedelta(minutes=30)
        inverted_batch = BatchSyncRequest(
            device_id="device-inverted",
            observations=[
                ObservationItem(
                    metric_name="workout_session",
                    value=2700.0,
                    unit="seconds",
                    measured_at=start,
                    end_timestamp=end,
                )
            ],
        )
        with pytest.raises(Exception) as exc_info2:
            await SyncService.synchronize(session, tokens.person_id, inverted_batch)
        assert "422" in str(exc_info2.value)
        assert "precedes measured_at" in str(exc_info2.value)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_sync_account_deletion_precedence() -> None:
    """OD-07, SYNC-010: Deleted or deletion_pending accounts are forbidden from syncing."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_req = RegisterRequest(
            email=f"delpending_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        # Set account status to 'deletion_pending'
        user_account = await session.get(UserAccount, tokens.user_account_id)
        assert user_account is not None
        user_account.status = "deletion_pending"
        await session.commit()

        # Attempt to synchronize
        batch = BatchSyncRequest(
            device_id="device-del",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=2000.0,
                    unit="count",
                    measured_at=utc_now(),
                )
            ],
        )
        with pytest.raises(Exception) as exc_info:
            await SyncService.synchronize(session, tokens.person_id, batch)
        assert "403" in str(exc_info.value)
        assert "Account is marked for deletion or deleted" in str(exc_info.value)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_resurrection_prevention_against_tombstone() -> None:
    """OD-14, FR-PRIV-004: Ingestion rejects attempting to supersede or resurrect a tombstoned record."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_req = RegisterRequest(
            email=f"resurrect_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        # 1. Ingest observation
        batch1 = BatchSyncRequest(
            device_id="device-1",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=3000.0,
                    unit="count",
                    measured_at=utc_now(),
                    device_record_id="local-rec-1",
                )
            ],
        )
        res1 = await SyncService.synchronize(session, tokens.person_id, batch1)
        await session.commit()
        assert res1.processed_count == 1

        # Query inserted record ID
        q = select(HealthRecord).where(HealthRecord.person_id == tokens.person_id)
        rec = (await session.execute(q)).scalars().first()
        assert rec is not None
        rec_id = rec.id

        # 2. Tombstone record
        tombstone_batch = BatchSyncRequest(
            device_id="device-1",
            tombstones=[
                TombstoneItem(
                    target_record_id=rec_id,
                    record_type="health_record",
                    deleted_at=utc_now(),
                )
            ],
        )
        await SyncService.synchronize(session, tokens.person_id, tombstone_batch)
        await session.commit()

        # 3. Attempt to supersede deleted record from another device -> 409 Conflict
        resurrect_batch = BatchSyncRequest(
            device_id="device-2",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=3500.0,
                    unit="count",
                    measured_at=utc_now(),
                    origin="user_entered",
                    correction_state="corrected",
                    supersedes_record_id=rec_id,
                )
            ],
        )
        with pytest.raises(Exception) as exc_info:
            await SyncService.synchronize(session, tokens.person_id, resurrect_batch)
        assert "409" in str(exc_info.value)
        assert "Cannot supersede or resurrect deleted record" in str(exc_info.value)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_operational_retention_pruning() -> None:
    """OD-07: Operational retention pruner sets raw_payload to None and cleans expired tombstones."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg_req = RegisterRequest(
            email=f"retention_{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPassword2026!",
        )
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        old_timestamp = utc_now() - timedelta(days=35)
        source_id = uuid.uuid4()
        tombstone_id = uuid.uuid4()

        # 1. Insert an expired SourceRecord (35 days old) with raw_payload
        old_source = SourceRecord(
            id=source_id,
            person_id=tokens.person_id,
            source_name="old_device",
            source_record_id="old_rec_1",
            idempotency_key=f"ret-{uuid.uuid4()}",
            ingestion_timestamp=old_timestamp,
            raw_payload={"sample": "sensitive_raw_data"},
        )
        session.add(old_source)

        # 2. Insert an expired SyncTombstone (35 days old)
        old_tombstone = SyncTombstone(
            id=tombstone_id,
            person_id=tokens.person_id,
            record_type="health_record",
            target_record_id=uuid.uuid4(),
            device_id="old_device",
            deleted_at=old_timestamp,
        )
        session.add(old_tombstone)
        await session.commit()

        # 3. Execute operational pruner (retention_days=30)
        pruned_payloads = await SyncService.prune_expired_raw_payloads(session, retention_days=30)
        pruned_tombstones = await SyncService.prune_expired_tombstones(session, retention_days=30)
        await session.commit()

        assert pruned_payloads >= 1
        assert pruned_tombstones >= 1

        # 4. Verify raw_payload was scrubbed while SourceRecord metadata persists
        q_src = select(SourceRecord.raw_payload, SourceRecord.source_name).where(
            SourceRecord.id == source_id
        )
        src_row = (await session.execute(q_src)).one_or_none()
        assert src_row is not None
        assert src_row[0] is None
        assert src_row[1] == "old_device"

        # 5. Verify tombstone was purged
        q_ts = select(SyncTombstone.id).where(SyncTombstone.id == tombstone_id)
        ts_row = (await session.execute(q_ts)).scalar_one_or_none()
        assert ts_row is None
