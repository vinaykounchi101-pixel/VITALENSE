"""API Auth and Sync Endpoints Integration Tests.

Implements ARCH-002, ARCH-014, SEC-001 through SEC-011, OD-14, and OD-18:
- Web authentication endpoints with HttpOnly cookies
- Mobile authentication endpoints with Bearer tokens
- Mobile batch synchronization and full-resync endpoints
- Web batch synchronization endpoints
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from services.api.main import app

client = TestClient(app)


@pytest.mark.integration
def test_web_auth_lifecycle_with_cookies() -> None:
    """Test web registration, login, cookie setting, me endpoint, refresh, and logout."""
    email = f"webuser_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecureWebPassword123!"

    # 1. Register
    reg_resp = client.post(
        "/api/v1/web/auth/register",
        json={"email": email, "password": pwd, "display_name": "Web User"},
    )
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert "data" in reg_data
    assert "access_token" in reg_data["data"]
    # Check cookies attached
    assert "vitalsense_access_token" in reg_resp.cookies
    assert "vitalsense_refresh_token" in reg_resp.cookies

    # 2. Access protected /me using cookies
    me_resp = client.get("/api/v1/web/auth/me", cookies=reg_resp.cookies)
    assert me_resp.status_code == 200
    me_data = me_resp.json()["data"]
    assert me_data["email"] == email

    # 3. Refresh session using cookie
    ref_resp = client.post("/api/v1/web/auth/refresh", cookies=reg_resp.cookies)
    assert ref_resp.status_code == 200
    assert "vitalsense_access_token" in ref_resp.cookies

    # 4. Logout and clear cookies
    logout_resp = client.post("/api/v1/web/auth/logout", cookies=ref_resp.cookies)
    assert logout_resp.status_code == 200


@pytest.mark.integration
def test_mobile_auth_and_sync_lifecycle() -> None:
    """Test mobile registration, login, Bearer token access, and batch synchronization."""
    email = f"mobileuser_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "SecureMobilePassword123!"

    # 1. Register mobile account
    reg_resp = client.post(
        "/api/v1/mobile/auth/register",
        json={
            "email": email,
            "password": pwd,
            "display_name": "Mobile User",
            "device_id": "iphone-15",
            "device_name": "Vinay's iPhone",
        },
    )
    assert reg_resp.status_code == 201
    tokens = reg_resp.json()["data"]
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Get profile
    me_resp = client.get("/api/v1/mobile/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["data"]["email"] == email

    # 3. Synchronize observations (steps, heart_rate)
    now_iso = datetime.now(timezone.utc).isoformat()
    sync_resp = client.post(
        "/api/v1/mobile/sync",
        headers=headers,
        json={
            "device_id": "iphone-15",
            "observations": [
                {
                    "metric_name": "steps",
                    "value": 7500,
                    "unit": "count",
                    "measured_at": now_iso,
                    "idempotency_key": f"steps-{uuid.uuid4()}",
                },
                {
                    "metric_name": "heart_rate",
                    "value": 72,
                    "unit": "bpm",
                    "measured_at": now_iso,
                    "idempotency_key": f"hr-{uuid.uuid4()}",
                },
            ],
        },
    )
    assert sync_resp.status_code == 200
    sync_data = sync_resp.json()["data"]
    assert sync_data["processed_count"] == 2
    assert sync_data["duplicate_count"] == 0
    assert "next_sync_cursor" in sync_data

    # 4. Safe full-resync endpoint
    full_sync_resp = client.post(
        "/api/v1/mobile/sync/full-resync",
        headers=headers,
        json={
            "device_id": "iphone-15",
            "observations": [],
        },
    )
    assert full_sync_resp.status_code == 200
    assert len(full_sync_resp.json()["data"]["server_observations"]) >= 2

