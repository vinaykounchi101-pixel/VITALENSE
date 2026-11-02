"""Tests for AI Intelligence Briefing and ML Forecasting."""

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
from vitalsense_common.schemas.intelligence import MANDATORY_MEDICAL_DISCLAIMER
from vitalsense_common.schemas.sync import BatchSyncRequest, ObservationItem


@pytest.mark.integration
@pytest.mark.asyncio
async def test_intelligence_daily_briefing_and_ml_forecasting() -> None:
    """Verify daily health briefing and statistical trend forecasting with confidence intervals."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"intel_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

        # Ingest 5 days of heart rate observations for forecasting
        now = utc_now()
        observations = [
            ObservationItem(
                metric_name="resting_heart_rate",
                value=60.0 + i,
                unit="bpm",
                measured_at=now - timedelta(days=5 - i),
            )
            for i in range(5)
        ]
        # Add sleep and steps for briefing
        observations.append(
            ObservationItem(
                metric_name="steps",
                value=11200.0,
                unit="count",
                measured_at=now - timedelta(hours=1),
            )
        )
        observations.append(
            ObservationItem(
                metric_name="sleep_session",
                value=29160.0,
                unit="seconds",
                measured_at=now - timedelta(hours=6),
            )
        )

        batch = BatchSyncRequest(device_id="wearable-intel", observations=observations)
        await SyncService.synchronize(session, person_id, batch)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {reg.access_token}"}

        # 1. Daily Briefing
        briefing_resp = await client.get("/api/v1/web/intelligence/daily-briefing", headers=headers)
        assert briefing_resp.status_code == 200
        briefing = briefing_resp.json()["data"]

        assert briefing["disclaimer"] == MANDATORY_MEDICAL_DISCLAIMER
        assert "High Activity Day" in briefing["headline"]
        assert "Optimal Sleep Duration" in briefing["headline"]
        assert len(briefing["recommendations"]) >= 1
        assert briefing["recovery_score"] is not None

        # 2. ML Forecasting with sufficient history (5 days)
        fc_resp = await client.get(
            "/api/v1/web/intelligence/forecast/resting_heart_rate?forecast_days=7",
            headers=headers,
        )
        assert fc_resp.status_code == 200
        fc = fc_resp.json()["data"]

        assert fc["has_sufficient_history"] is True
        assert fc["disclaimer"] == MANDATORY_MEDICAL_DISCLAIMER
        assert fc["model_type"] == "statistical_rolling_ols"
        assert len(fc["projections"]) == 7
        assert fc["trend_slope_per_day"] > 0  # 60, 61, 62, 63, 64 is rising
        # Verify prediction intervals are populated (lower <= pred <= upper)
        for pt in fc["projections"]:
            assert pt["lower_bound"] <= pt["predicted_value"] <= pt["upper_bound"]

        # 3. ML Forecasting with INSUFFICIENT history (unrecorded metric)
        fc_empty = await client.get(
            "/api/v1/web/intelligence/forecast/blood_glucose",
            headers=headers,
        )
        assert fc_empty.status_code == 200
        empty_data = fc_empty.json()["data"]
        assert empty_data["has_sufficient_history"] is False
        assert len(empty_data["projections"]) == 0
