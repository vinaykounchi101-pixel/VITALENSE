"""Statistical Health Trend Forecasting and Anomaly Detection.

Implements transparent, honest statistical forecasting:
- Rolling Ordinary Least Squares (OLS) regression across observed time-series.
- Two-sigma (95%) confidence prediction intervals based on standard error of the estimate.
- Outlier and anomaly detection for measurements exceeding 2 standard deviations.
- Strict data sufficiency gating (minimum 3 observations required).
- Mandatory non-diagnostic disclaimer.
"""

from __future__ import annotations

import math
import statistics
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.models.base import utc_now
from vitalsense_common.models.health_record import HealthRecord
from vitalsense_common.schemas.intelligence import (
    MANDATORY_MEDICAL_DISCLAIMER,
    HealthForecastResponse,
    MLForecastPoint,
)


class MLForecastingService:
    """Service for statistical trend projections and anomaly detection."""

    @classmethod
    async def forecast_metric(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
        metric_name: str,
        forecast_days: int = 7,
        history_days: int = 30,
    ) -> HealthForecastResponse:
        """Compute statistical trend projection using linear regression and prediction intervals."""
        now = utc_now()
        start_date = now - timedelta(days=history_days)

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

        # Insufficient data guard: require at least 3 points
        if len(records) < 3:
            return HealthForecastResponse(
                metric_name=metric_name,
                unit=unit,
                forecast_days=forecast_days,
                history_days_used=history_days,
                has_sufficient_history=False,
                model_type="statistical_rolling_ols",
                trend_direction="insufficient_data",
                trend_slope_per_day=0.0,
                anomalies_detected=0,
                projections=[],
                disclaimer=MANDATORY_MEDICAL_DISCLAIMER,
            )

        # X in days from start, Y in float values
        t0 = records[0].event_timestamp
        x_vals = [(r.event_timestamp - t0).total_seconds() / 86400.0 for r in records]
        y_vals = [float(r.value) for r in records]
        n = len(records)

        # Calculate Mean and Standard Deviation
        mean_y = statistics.mean(y_vals)
        std_y = statistics.stdev(y_vals) if n >= 2 else 0.0

        # Anomaly detection: observations > 2 standard deviations away
        anomalies = [y for y in y_vals if abs(y - mean_y) > 2.0 * std_y]

        # Simple linear OLS regression: y = slope * x + intercept
        mean_x = statistics.mean(x_vals)
        denom = sum((x - mean_x) ** 2 for x in x_vals)

        if denom == 0:
            slope = 0.0
            intercept = mean_y
        else:
            slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_vals, y_vals)) / denom
            intercept = mean_y - slope * mean_x

        # Residual standard error
        residuals = [y - (slope * x + intercept) for x, y in zip(x_vals, y_vals)]
        rss = sum(r**2 for r in residuals)
        deg_freedom = max(1, n - 2)
        residual_std_error = math.sqrt(rss / deg_freedom)

        # Trend direction
        if slope > 0.05 * (mean_y if mean_y != 0 else 1.0):
            trend_direction = "rising"
        elif slope < -0.05 * (mean_y if mean_y != 0 else 1.0):
            trend_direction = "falling"
        else:
            trend_direction = "stable"

        # Generate future projections with 95% uncertainty interval (1.96 * SE)
        last_x = x_vals[-1]
        projections: List[MLForecastPoint] = []
        for d in range(1, forecast_days + 1):
            future_x = last_x + d
            future_date = (records[-1].event_timestamp + timedelta(days=d)).date().isoformat()
            pred = slope * future_x + intercept

            # Clamping negative projections for non-negative health metrics
            lower = max(0.0, pred - 1.96 * residual_std_error)
            upper = pred + 1.96 * residual_std_error

            projections.append(
                MLForecastPoint(
                    date=future_date,
                    predicted_value=round(pred, 2),
                    lower_bound=round(lower, 2),
                    upper_bound=round(upper, 2),
                    confidence_level=0.95,
                )
            )

        return HealthForecastResponse(
            metric_name=metric_name,
            unit=unit,
            forecast_days=forecast_days,
            history_days_used=history_days,
            has_sufficient_history=True,
            model_type="statistical_rolling_ols",
            trend_direction=trend_direction,
            trend_slope_per_day=round(slope, 3),
            anomalies_detected=len(anomalies),
            projections=projections,
            disclaimer=MANDATORY_MEDICAL_DISCLAIMER,
        )
