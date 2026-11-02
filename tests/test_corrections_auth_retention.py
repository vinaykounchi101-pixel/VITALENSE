"""Milestone 0.7.1.1 Verification Test Suite.

Comprehensive tests covering:
1. Password Reset Single-Use Token Lifecycle (Replay, Expiry, Revocation, Concurrency)
2. Web Auth Response Token Exposure Removal (Strict WebAuthResponse vs Mobile TokenResponse)
3. Rate Limiter Hardening (Anti-Spoofing, Trusted Proxies, Memory Bounding)
4. Operational Retention Pruning Runner (CLI / Async Worker)
5. Stale Device Offline Reconciliation (>30 days cursor expiration & full resync)
"""

from __future__ import annotations

import asyncio
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import List
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.api.main import app
from services.auth.rate_limiter import InMemoryRateLimiter, auth_rate_limiter
from services.auth.service import AuthService
from services.sync.service import SyncService
from services.workers.retention_worker import run_retention_prune_job
from vitalsense_common.config import settings
from vitalsense_common.database import get_engine
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.models.auth import (
    AuthPasswordResetToken,
    AuthRefreshToken,
)
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
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> None:
    """Ensure rate limiter state is clear between tests."""
    auth_rate_limiter.reset()


# =============================================================================
# 1. Password Reset Single-Use Lifecycle & Replay Prevention
# =============================================================================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_password_reset_single_use_lifecycle_and_replay_prevention() -> None:
    """Verify single-use token lifecycle: consumption, replay rejection, and multi-token revocation."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        email = f"reset_lifecycle_{uuid.uuid4().hex[:8]}@example.com"
        initial_pw = "InitialSecretPassword123!"
        new_pw = "UpdatedSecretPassword456!"

        # Register user
        reg_req = RegisterRequest(email=email, password=initial_pw)
        reg_tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        # Request password reset token 1
        reset_token_1 = await AuthService.request_password_reset(session, email)
        assert reset_token_1 is not None

        # Verify token hash persisted in auth_password_resets table
        token_hash_1 = hashlib.sha256(reset_token_1.encode("utf-8")).hexdigest()
        stmt = select(AuthPasswordResetToken).where(
            AuthPasswordResetToken.token_hash == token_hash_1
        )
        reset_record_1 = (await session.execute(stmt)).scalar_one_or_none()
        assert reset_record_1 is not None
        assert reset_record_1.is_consumed is False
        assert reset_record_1.is_revoked is False
        assert reset_record_1.consumed_at is None

        # Request a second password reset token (e.g. user requested again)
        reset_token_2 = await AuthService.request_password_reset(session, email)
        assert reset_token_2 is not None
        assert reset_token_2 != reset_token_1

        # Confirm using reset_token_2
        await AuthService.confirm_password_reset(
            session, token=reset_token_2, new_password=new_pw
        )
        await session.commit()

        # Verify reset_token_2 is marked consumed
        token_hash_2 = hashlib.sha256(reset_token_2.encode("utf-8")).hexdigest()
        stmt_2 = select(AuthPasswordResetToken).where(
            AuthPasswordResetToken.token_hash == token_hash_2
        )
        reset_record_2 = (await session.execute(stmt_2)).scalar_one_or_none()
        assert reset_record_2 is not None
        assert reset_record_2.is_consumed is True
        assert reset_record_2.consumed_at is not None

        # Verify reset_token_1 was revoked when token 2 succeeded
        reset_record_1_fresh = (await session.execute(stmt)).scalar_one_or_none()
        assert reset_record_1_fresh is not None
        assert reset_record_1_fresh.is_revoked is True

        # REPLAY ATTEMPT 1: Re-using the consumed token_2 must fail
        with pytest.raises(Exception) as exc_info_replay:
            await AuthService.confirm_password_reset(
                session, token=reset_token_2, new_password=new_pw
            )
        assert "400" in str(exc_info_replay.value)
        assert "already been consumed" in str(exc_info_replay.value)

        # REPLAY ATTEMPT 2: Using the older revoked token_1 must fail
        with pytest.raises(Exception) as exc_info_revoked:
            await AuthService.confirm_password_reset(
                session, token=reset_token_1, new_password="AnotherPassword789!"
            )
        assert "400" in str(exc_info_revoked.value)
        assert "revoked" in str(exc_info_revoked.value)

        # Verify authentication with new password succeeds and old password fails
        login_new = await AuthService.authenticate_user(
            session, LoginRequest(email=email, password=new_pw)
        )
        assert login_new.user_account_id == reg_tokens.user_account_id

        with pytest.raises(Exception) as exc_info_old:
            await AuthService.authenticate_user(
                session, LoginRequest(email=email, password=initial_pw)
            )
        assert "401" in str(exc_info_old.value)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_password_reset_expired_and_invalid_tokens() -> None:
    """Verify expired and forged reset tokens are rejected with HTTP 400."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        email = f"expired_reset_{uuid.uuid4().hex[:8]}@example.com"
        reg_req = RegisterRequest(email=email, password="Password123!@#")
        reg_tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        # 1. Forged / invalid token
        with pytest.raises(Exception) as exc_invalid:
            await AuthService.confirm_password_reset(
                session, token="invalid.fake.jwt_token", new_password="NewPassword123!"
            )
        assert "400" in str(exc_invalid.value)
        assert "Invalid password reset token" in str(exc_invalid.value)

        # 2. Expired token in database
        valid_token = await AuthService.request_password_reset(session, email)
        assert valid_token is not None
        token_hash = hashlib.sha256(valid_token.encode("utf-8")).hexdigest()

        # Artificially expire the record in the database
        stmt = select(AuthPasswordResetToken).where(
            AuthPasswordResetToken.token_hash == token_hash
        )
        record = (await session.execute(stmt)).scalar_one()
        record.expires_at = utc_now() - timedelta(minutes=10)
        await session.commit()

        with pytest.raises(Exception) as exc_expired:
            await AuthService.confirm_password_reset(
                session, token=valid_token, new_password="NewPassword123!"
            )
        assert "400" in str(exc_expired.value)
        assert "expired" in str(exc_expired.value)


# =============================================================================
# 2. Web Auth Token Exposure Removal
# =============================================================================

@pytest.mark.integration
def test_web_auth_endpoints_omit_tokens_from_json_body() -> None:
    """Verify Web /register, /login, and /refresh never return tokens in response body."""
    email = f"web_body_test_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "WebSecurePassword123!"

    # 1. Web Register
    reg_resp = client.post(
        "/api/v1/web/auth/register",
        json={"email": email, "password": pwd, "display_name": "Web User"},
    )
    assert reg_resp.status_code == 201
    reg_body = reg_resp.json()
    assert "data" in reg_body
    # Crucial security assertion: tokens MUST NOT be in response JSON
    assert "access_token" not in reg_body["data"]
    assert "refresh_token" not in reg_body["data"]
    assert "user_account_id" in reg_body["data"]
    assert "person_id" in reg_body["data"]

    # Verify cookies ARE set
    set_cookies = reg_resp.headers.get_list("set-cookie")
    assert any("vitalsense_access_token=" in c for c in set_cookies)
    assert any("vitalsense_refresh_token=" in c for c in set_cookies)
    assert any("vitalsense_csrf_token=" in c for c in set_cookies)

    # 2. Web Login
    login_resp = client.post(
        "/api/v1/web/auth/login",
        json={"email": email, "password": pwd},
    )
    assert login_resp.status_code == 200
    login_body = login_resp.json()
    assert "data" in login_body
    assert "access_token" not in login_body["data"]
    assert "refresh_token" not in login_body["data"]
    assert "user_account_id" in login_body["data"]

    # Extract CSRF token cookie for refresh test
    cookies = login_resp.cookies
    csrf_token = cookies.get("vitalsense_csrf_token")
    assert csrf_token is not None

    # 3. Web Refresh
    refresh_resp = client.post(
        "/api/v1/web/auth/refresh",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf_token},
    )
    assert refresh_resp.status_code == 200
    refresh_body = refresh_resp.json()
    assert "data" in refresh_body
    assert "access_token" not in refresh_body["data"]
    assert "refresh_token" not in refresh_body["data"]
    assert "user_account_id" in refresh_body["data"]

    # 4. Mobile Auth: Must retain Bearer token JSON body
    mobile_login_resp = client.post(
        "/api/v1/mobile/auth/login",
        json={"email": email, "password": pwd},
    )
    assert mobile_login_resp.status_code == 200
    mobile_body = mobile_login_resp.json()
    assert "access_token" in mobile_body["data"]
    assert "refresh_token" in mobile_body["data"]
    assert mobile_body["data"]["token_type"] == "Bearer"


# =============================================================================
# 3. Rate Limiter Hardening & Anti-Spoofing
# =============================================================================

def test_rate_limiter_rejects_untrusted_forwarded_for_spoofing() -> None:
    """Untrusted clients cannot bypass IP limits by rotating X-Forwarded-For."""
    limiter = InMemoryRateLimiter(max_tracked_keys=100)

    # Mock request from untrusted client IP (e.g. 198.51.100.5)
    mock_request = MagicMock()
    mock_request.client.host = "198.51.100.5"

    # Client attempts spoofing with random IPs in X-Forwarded-For
    mock_request.headers = {"x-forwarded-for": "1.1.1.1"}
    resolved_ip_1 = limiter.resolve_client_ip(mock_request)
    assert resolved_ip_1 == "198.51.100.5", "Spoofed X-Forwarded-For was not ignored"

    # Send 3 requests with different spoofed headers
    for fake_ip in ["2.2.2.2", "3.3.3.3", "4.4.4.4"]:
        mock_request.headers = {"x-forwarded-for": fake_ip}
        limiter.check(
            mock_request,
            endpoint_key="auth_test",
            max_requests=3,
            window_seconds=60,
        )

    # 4th request from same physical client must trigger 429 despite new spoofed IP
    mock_request.headers = {"x-forwarded-for": "5.5.5.5"}
    with pytest.raises(Exception) as exc_limiter:
        limiter.check(
            mock_request,
            endpoint_key="auth_test",
            max_requests=3,
            window_seconds=60,
        )
    assert "429" in str(exc_limiter.value)


def test_rate_limiter_accepts_forwarded_for_from_trusted_proxy() -> None:
    """Trusted reverse proxy (127.0.0.1) allows client IP extraction from X-Forwarded-For."""
    limiter = InMemoryRateLimiter(max_tracked_keys=100)

    # Request arriving through trusted localhost reverse proxy
    mock_proxy_req = MagicMock()
    mock_proxy_req.client.host = "127.0.0.1"
    mock_proxy_req.headers = {"x-forwarded-for": "203.0.113.195, 10.0.0.1"}

    resolved_ip = limiter.resolve_client_ip(mock_proxy_req)
    assert resolved_ip == "203.0.113.195"


def test_rate_limiter_bounded_memory_capacity() -> None:
    """Rate limiter strictly bounds key storage and evicts oldest entries to prevent DoS."""
    max_capacity = 20
    limiter = InMemoryRateLimiter(max_tracked_keys=max_capacity)

    # Inject 50 distinct keys
    for i in range(50):
        limiter.is_rate_limited(f"key_{i}", max_requests=5, window_seconds=60)

    # Memory footprint must not exceed max_capacity
    assert len(limiter._requests) <= max_capacity


# =============================================================================
# 4. Operational Retention Pruning Worker
# =============================================================================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_operational_retention_prune_job_runner() -> None:
    """Verify run_retention_prune_job prunes expired raw payloads and tombstones."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        # Register user
        reg_tokens = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"retention_{uuid.uuid4().hex[:8]}@example.com",
                password="RetentionTest123!",
            ),
        )
        person_id = reg_tokens.person_id
        await session.commit()

        # 1. Insert aged source record (>40 days old) with raw_payload
        old_source_id = uuid.uuid4()
        fresh_source_id = uuid.uuid4()
        old_tombstone_id = uuid.uuid4()
        fresh_tombstone_id = uuid.uuid4()

        old_time = utc_now() - timedelta(days=40)
        old_source = SourceRecord(
            id=old_source_id,
            person_id=person_id,
            source_name="apple_health",
            source_record_id=f"rec-{uuid.uuid4()}",
            idempotency_key=str(uuid.uuid4()),
            raw_payload={"heart_rate": 72, "device": "Apple Watch"},
            ingestion_timestamp=old_time,
        )
        session.add(old_source)

        # 2. Insert fresh source record (5 days old) with raw_payload
        fresh_time = utc_now() - timedelta(days=5)
        fresh_source = SourceRecord(
            id=fresh_source_id,
            person_id=person_id,
            source_name="apple_health",
            source_record_id=f"rec-{uuid.uuid4()}",
            idempotency_key=str(uuid.uuid4()),
            raw_payload={"heart_rate": 75, "device": "Apple Watch"},
            ingestion_timestamp=fresh_time,
        )
        session.add(fresh_source)

        # 3. Insert aged tombstone (>40 days old)
        old_tombstone = SyncTombstone(
            id=old_tombstone_id,
            person_id=person_id,
            record_type="health_record",
            target_record_id=uuid.uuid4(),
            device_id="dev-old",
            deleted_at=old_time,
        )
        session.add(old_tombstone)

        # 4. Insert fresh tombstone (5 days old)
        fresh_tombstone = SyncTombstone(
            id=fresh_tombstone_id,
            person_id=person_id,
            record_type="health_record",
            target_record_id=uuid.uuid4(),
            device_id="dev-fresh",
            deleted_at=fresh_time,
        )
        session.add(fresh_tombstone)
        await session.commit()

        # Execute retention pruning runner with 30 days threshold
        metrics = await run_retention_prune_job(retention_days=30)
        assert metrics["raw_payloads_pruned"] >= 1
        assert metrics["tombstones_pruned"] >= 1

        # Verify old source record raw_payload was set to None, but lineage preserved
        old_src_check = (
            await session.execute(
                select(SourceRecord).where(SourceRecord.id == old_source_id)
            )
        ).scalar_one()
        assert old_src_check.raw_payload is None
        assert old_src_check.source_name == "apple_health"

        # Verify fresh source record raw_payload remains intact
        fresh_src_check = (
            await session.execute(
                select(SourceRecord).where(SourceRecord.id == fresh_source_id)
            )
        ).scalar_one()
        assert fresh_src_check.raw_payload is not None

        # Verify old tombstone is deleted
        old_ts_check = (
            await session.execute(
                select(SyncTombstone).where(SyncTombstone.id == old_tombstone_id)
            )
        ).scalar_one_or_none()
        assert old_ts_check is None

        # Verify fresh tombstone remains present
        fresh_ts_check = (
            await session.execute(
                select(SyncTombstone).where(SyncTombstone.id == fresh_tombstone_id)
            )
        ).scalar_one_or_none()
        assert fresh_ts_check is not None


# =============================================================================
# 5. Stale Device Offline Reconciliation (OD-14)
# =============================================================================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_stale_device_cursor_expiry_and_full_resync_reconciliation() -> None:
    """Stale device (>30 days offline) receives 409 and successfully reconciles via full resync."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        # Register user
        reg_tokens = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"stale_device_{uuid.uuid4().hex[:8]}@example.com",
                password="StaleDevicePass123!",
            ),
        )
        person_id = reg_tokens.person_id
        await session.commit()

        # Create active canonical health record on server
        initial_batch = BatchSyncRequest(
            device_id="server_initial",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=5000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(days=2),
                )
            ],
        )
        await SyncService.synchronize(session, person_id, initial_batch)
        await session.commit()

        # 1. Device that has been offline for 45 days attempts incremental sync
        stale_cursor = utc_now() - timedelta(days=45)
        stale_request = BatchSyncRequest(
            device_id="offline_phone_1",
            last_sync_timestamp=stale_cursor,
            observations=[],
        )

        with pytest.raises(Exception) as exc_expired:
            await SyncService.synchronize(session, person_id, stale_request)
        assert "409" in str(exc_expired.value)
        assert "SYNC_CURSOR_EXPIRED" in str(exc_expired.value)

        # 2. Client performs full resync reconciliation (last_sync_timestamp=None)
        # while uploading an un-synced offline draft observation
        full_resync_request = BatchSyncRequest(
            device_id="offline_phone_1",
            last_sync_timestamp=None,
            observations=[
                ObservationItem(
                    metric_name="heart_rate",
                    value=72.0,
                    unit="bpm",
                    measured_at=utc_now() - timedelta(hours=1),
                    device_record_id="local_offline_draft_1",
                )
            ],
        )

        resync_response = await SyncService.synchronize(
            session, person_id, full_resync_request
        )
        await session.commit()

        # Offline draft observation processed and ingested
        assert resync_response.processed_count == 1
        assert resync_response.next_sync_cursor is not None

        # Server observations return full active baseline (including server steps)
        assert len(resync_response.server_observations) >= 1
        metric_names = [o.metric_name for o in resync_response.server_observations]
        assert "steps" in metric_names
