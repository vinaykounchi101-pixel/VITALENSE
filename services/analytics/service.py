"""VitalSense Analytics Domain Service.

Calculates statistical rollups, rolling baselines, variability, and trend summaries
across all 10 approved Phase 1 health metrics.
"""

from __future__ import annotations

import statistics
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.models.base import utc_now
from vitalsense_common.models.health_record import HealthRecord
from vitalsense_common.schemas.analytics import (
    DashboardSummaryResponse,
    MetricSummary,
    MetricTrendResponse,
    TrendDataPoint,
)
from vitalsense_common.schemas.sync import APPROVED_PHASE1_METRICS


class AnalyticsService:
    """Core domain service for health data aggregations and analytics."""

    @staticmethod
    def _calculate_recovery_score(
        resting_hr: Optional[float],
        sleep_hours: Optional[float],
        spo2: Optional[float],
    ) -> Optional[float]:
        """Data-supported heuristic recovery score (0-100).

        Combines resting HR (lower is better, baseline ~60), sleep duration (optimal 7-9h),
        and blood oxygen saturation (optimal 95-100%).
        """
        score = 70.0
        factors = 0

        if resting_hr is not None:
            factors += 1
            if resting_hr <= 60:
                score += 15.0
            elif resting_hr <= 70:
                score += 5.0
            elif resting_hr > 80:
                score -= 15.0

        if sleep_hours is not None:
            factors += 1
            if 7.0 <= sleep_hours <= 9.0:
                score += 15.0
            elif 6.0 <= sleep_hours < 7.0:
                score += 5.0
            elif sleep_hours < 6.0:
                score -= 20.0

        if spo2 is not None:
            factors += 1
            if spo2 >= 97.0:
                score += 5.0
            elif spo2 < 93.0:
                score -= 20.0

        if factors == 0:
            return None

        return round(max(0.0, min(100.0, score)), 1)

    @classmethod
    async def get_dashboard_summary(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
    ) -> DashboardSummaryResponse:
        """Fetch current summary and 7-day rolling baselines for all Phase 1 metrics."""
        now = utc_now()
        seven_days_ago = now - timedelta(days=7)

        # Query all active non-superseded records for person
        query = (
            select(HealthRecord)
            .where(
                HealthRecord.person_id == person_id,
                HealthRecord.superseded_by_id.is_(None),
            )
            .order_by(desc(HealthRecord.event_timestamp))
        )
        res = await session.execute(query)
        all_records = res.scalars().all()

        records_by_metric: Dict[str, List[HealthRecord]] = {}
        for r in all_records:
            records_by_metric.setdefault(r.metric_id, []).append(r)

        metrics_summary: Dict[str, MetricSummary] = {}
        canonical_units = {
            "steps": "count",
            "heart_rate": "bpm",
            "sleep_session": "seconds",
            "active_energy": "kcal",
            "workout_session": "seconds",
            "resting_heart_rate": "bpm",
            "blood_pressure_systolic": "mmHg",
            "blood_pressure_diastolic": "mmHg",
            "blood_oxygen_saturation": "percentage",
            "blood_glucose": "mg/dL",
        }

        latest_resting_hr: Optional[float] = None
        latest_sleep_hours: Optional[float] = None
        latest_spo2: Optional[float] = None

        for metric in APPROVED_PHASE1_METRICS:
            m_records = records_by_metric.get(metric, [])
            unit = canonical_units.get(metric, "unit")

            if not m_records:
                metrics_summary[metric] = MetricSummary(
                    metric_name=metric,
                    latest_value=None,
                    latest_timestamp=None,
                    unit=unit,
                    rolling_7d_avg=None,
                    change_from_baseline_pct=None,
                    status="insufficient_data",
                    trend="stable",
                )
                continue

            latest = m_records[0]
            val = float(latest.value)

            if metric == "resting_heart_rate":
                latest_resting_hr = val
            elif metric == "sleep_session":
                latest_sleep_hours = val / 3600.0
            elif metric == "blood_oxygen_saturation":
                latest_spo2 = val

            # 7-day values for average
            recent_vals = [float(r.value) for r in m_records if r.event_timestamp >= seven_days_ago]
            rolling_avg = round(statistics.mean(recent_vals), 2) if recent_vals else round(val, 2)

            # Trend direction
            if len(m_records) >= 2:
                prev_val = float(m_records[1].value)
                if val > prev_val * 1.03:
                    trend_dir = "rising"
                elif val < prev_val * 0.97:
                    trend_dir = "falling"
                else:
                    trend_dir = "stable"
            else:
                trend_dir = "stable"

            # Status category
            status_cat = "normal"
            if metric == "blood_pressure_systolic" and val >= 130:
                status_cat = "elevated"
            elif metric == "blood_pressure_diastolic" and val >= 85:
                status_cat = "elevated"
            elif metric == "blood_glucose" and (val < 70 or val > 140):
                status_cat = "elevated" if val > 140 else "low"
            elif metric == "blood_oxygen_saturation" and val < 95:
                status_cat = "low"

            pct_change = None
            if rolling_avg and rolling_avg > 0:
                pct_change = round(((val - rolling_avg) / rolling_avg) * 100.0, 1)

            metrics_summary[metric] = MetricSummary(
                metric_name=metric,
                latest_value=val,
                latest_timestamp=latest.event_timestamp,
                unit=unit,
                rolling_7d_avg=rolling_avg,
                change_from_baseline_pct=pct_change,
                status=status_cat,
                trend=trend_dir,
            )

        recovery = cls._calculate_recovery_score(latest_resting_hr, latest_sleep_hours, latest_spo2)

        return DashboardSummaryResponse(
            person_id=person_id,
            generated_at=now,
            metrics=metrics_summary,
            recovery_score=recovery,
            data_quality_score=100.0 if all_records else 0.0,
            days_tracked=min(30, max(1, len(set(r.event_timestamp.date() for r in all_records)))) if all_records else 0,
        )

    @classmethod
    async def get_metric_trends(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
        metric_name: str,
        period_days: int = 30,
    ) -> MetricTrendResponse:
        """Fetch historical time-series observations with baseline mean and standard deviation."""
        now = utc_now()
        start_date = now - timedelta(days=period_days)

        query = (
            select(HealthRecord)
            .where(
                HealthRecord.person_id == person_id,
                HealthRecord.metric_id == metric_name,
                HealthRecord.event_timestamp >= start_date,
                HealthRecord.superseded_by_id.is_(None),
            )
            .order_by(HealthRecord.event_timestamp.asc())
        )
        res = await session.execute(query)
        records = res.scalars().all()

        canonical_units = {
            "steps": "count",
            "heart_rate": "bpm",
            "sleep_session": "seconds",
            "active_energy": "kcal",
            "workout_session": "seconds",
            "resting_heart_rate": "bpm",
            "blood_pressure_systolic": "mmHg",
            "blood_pressure_diastolic": "mmHg",
            "blood_oxygen_saturation": "percentage",
            "blood_glucose": "mg/dL",
        }
        unit = canonical_units.get(metric_name, "unit")

        if not records:
            return MetricTrendResponse(
                metric_name=metric_name,
                canonical_unit=unit,
                period=f"{period_days}d",
                baseline_mean=None,
                baseline_std=None,
                data_points=[],
            )

        values = [float(r.value) for r in records]
        mean_val = round(statistics.mean(values), 2)
        std_val = round(statistics.stdev(values), 2) if len(values) >= 2 else 0.0

        # Construct time series with 3-point rolling average
        data_points: List[TrendDataPoint] = []
        for i, r in enumerate(records):
            window = values[max(0, i - 2) : i + 1]
            rolling_avg = round(statistics.mean(window), 2)
            data_points.append(
                TrendDataPoint(
                    bucket_time=r.event_timestamp.strftime("%Y-%m-%d %H:%M"),
                    value=float(r.value),
                    min_value=float(r.value),
                    max_value=float(r.value),
                    rolling_avg=rolling_avg,
                )
            )

        return MetricTrendResponse(
            metric_name=metric_name,
            canonical_unit=unit,
            period=f"{period_days}d",
            baseline_mean=mean_val,
            baseline_std=std_val,
            data_points=data_points,
        )
