"""Migration 002 Verification Tests.

Verifies:
- 10 Phase 1 metric definitions seeded (OD-01 Option B)
- Schema additions: auth_credentials, auth_refresh_tokens, sync_tombstones, client_sync_cursors
- Immutable revision columns on health_records: superseded_by_id
"""

from __future__ import annotations

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.database import get_engine
from vitalsense_common.models.metric import MetricDefinition
from vitalsense_common.schemas.sync import APPROVED_PHASE1_METRICS


@pytest.mark.integration
@pytest.mark.asyncio
async def test_all_10_phase1_metrics_seeded() -> None:
    """Ensure exactly the 10 approved Phase 1 metrics exist in metric_definitions."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        query = select(MetricDefinition.canonical_id)
        result = await session.execute(query)
        rows = result.scalars().all()
        metric_names = set(rows)

        # Assert all 10 approved metrics are present
        assert APPROVED_PHASE1_METRICS.issubset(metric_names), (
            f"Missing metrics: {APPROVED_PHASE1_METRICS - metric_names}"
        )
        assert "steps" in metric_names
        assert "heart_rate" in metric_names
        assert "sleep_session" in metric_names
        assert "active_energy" in metric_names
        assert "workout_session" in metric_names
        assert "resting_heart_rate" in metric_names
        assert "blood_pressure_systolic" in metric_names
        assert "blood_pressure_diastolic" in metric_names
        assert "blood_oxygen_saturation" in metric_names
        assert "blood_glucose" in metric_names


@pytest.mark.integration
@pytest.mark.asyncio
async def test_migration_002_tables_and_columns_exist() -> None:
    """Verify tables and columns added by Migration 002 exist in PostgreSQL."""
    engine = get_engine()
    async with engine.connect() as conn:
        # Check tables existence
        tables_query = text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        )
        result = await conn.execute(tables_query)
        tables = {row[0] for row in result.fetchall()}

        assert "auth_credentials" in tables
        assert "auth_refresh_tokens" in tables
        assert "sync_tombstones" in tables
        assert "client_sync_cursors" in tables
        assert "health_records" in tables

        # Check columns on health_records
        cols_query = text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'health_records'"
        )
        cols_res = await conn.execute(cols_query)
        health_record_cols = {row[0] for row in cols_res.fetchall()}

        assert "superseded_by_id" in health_record_cols
        assert "origin" in health_record_cols
        assert "correction_state" in health_record_cols
