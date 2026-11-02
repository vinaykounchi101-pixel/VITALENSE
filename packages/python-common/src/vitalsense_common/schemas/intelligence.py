"""AI intelligence and ML forecasting schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

MANDATORY_MEDICAL_DISCLAIMER = (
    "Insights are for educational and wellness tracking only, never medical diagnosis."
)


class DailyBriefingResponse(BaseModel):
    """Daily health intelligence briefing with mandatory non-diagnostic disclaimer."""

    person_id: uuid.UUID
    insight_date: date
    headline: str
    summary_text: str
    recovery_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    key_metrics: Dict[str, Any] = Field(default_factory=dict)
    recommendations: List[str] = Field(default_factory=list)
    provider: str
    disclaimer: str = Field(default=MANDATORY_MEDICAL_DISCLAIMER)
    generated_at: datetime


class MLForecastPoint(BaseModel):
    """A projected time-series point with statistical uncertainty bounds."""

    date: str
    predicted_value: float
    lower_bound: float
    upper_bound: float
    confidence_level: float = Field(default=0.95)


class HealthForecastResponse(BaseModel):
    """Statistical health trend projection and anomaly detection."""

    model_config = {"protected_namespaces": ()}

    metric_name: str
    unit: str
    forecast_days: int
    history_days_used: int
    has_sufficient_history: bool
    model_type: str = Field(
        default="statistical_rolling_ols",
        description="Explicit statistical methodology: linear rolling OLS with t-distribution bounds",
    )
    trend_direction: str
    trend_slope_per_day: float
    anomalies_detected: int = Field(default=0)
    projections: List[MLForecastPoint] = Field(default_factory=list)
    disclaimer: str = Field(default=MANDATORY_MEDICAL_DISCLAIMER)
