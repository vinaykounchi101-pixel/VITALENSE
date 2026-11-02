"""Tests for Analytics Domain Service and Endpoints."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from services.api.main import app
from services.auth.service import AuthService
from services.sync.service import SyncService
from vitalsense_common.database import get_engine
from vitalsense_common.models.base import utc_now
from vitalsense_common.schemas.auth import RegisterRequest
from vitalsense_common.schemas.sync import BatchSyncRequest, ObservationItem


@pytest.mark.integration
@pytest.mark.asyncio
async def test_analytics_dashboard_summary_and_trends() -> None:
    """Verify 10-metric dashboard summary, recovery score, and historical trends."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        # Register user
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"analytics_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        # Ingest observations for 3 metrics
        now = utc_now()
        batch = BatchSyncRequest(
            device_id="wearable-tracker",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=8500.0,
                    unit="count",
                    measured_at=now - timedelta(days=2),
                ),
                ObservationItem(
                    metric_name="steps",
                    value=10500.0,
                    unit="count",
                    measured_at=now - timedelta(days=1),
                ),
                ObservationItem(
                    metric_name="steps",
                    value=12000.0,
                    unit="count",
                    measured_at=now - timedelta(hours=2),
                ),
                ObservationItem(
                    metric_name="resting_heart_rate",
                    value=58.0,
                    unit="bpm",
                    measured_at=now - timedelta(hours=3),
                ),
                ObservationItem(
                    metric_name="sleep_session",
                    value=28080.0,
                    unit="seconds",
                    measured_at=now - timedelta(hours=8),
                ),
                ObservationItem(
                    metric_name="blood_oxygen_saturation",
                    value=98.0,
                    unit="percentage",
                    measured_at=now - timedelta(hours=4),
                ),
            ],
        )
        await SyncService.synchronize(session, person_id, batch)
        await session.commit()

    # Query via Web API endpoints using Bearer token
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {reg.access_token}"}

        # 1. Dashboard summary
        sum_resp = await client.get("/api/v1/web/analytics/dashboard-summary", headers=headers)
        assert sum_resp.status_code == 200
        data = sum_resp.json()["data"]

        assert data["person_id"] == str(person_id)
        assert data["recovery_score"] is not None
        assert data["recovery_score"] >= 80.0  # Optimal sleep (7.8) + low resting HR (58) + 98% SpO2

        metrics = data["metrics"]
        assert "steps" in metrics
        assert metrics["steps"]["latest_value"] == 12000.0
        assert metrics["steps"]["trend"] == "rising"
        assert metrics["steps"]["rolling_7d_avg"] is not None
        assert metrics["steps"]["rolling_7d_avg"] > 10000.0

        # Unrecorded metric has status 'insufficient_data'
        assert metrics["blood_glucose"]["status"] == "insufficient_data"

        # 2. Historical trends
        trend_resp = await client.get(
            "/api/v1/web/analytics/trends/steps?period_days=7", headers=headers
        )
        assert trend_resp.status_code == 200
        trend_data = trend_resp.json()["data"]
        assert trend_data["metric_name"] == "steps"
        assert len(trend_data["data_points"]) == 3
        assert trend_data["baseline_mean"] is not None
        assert trend_data["baseline_mean"] > 10000.0
