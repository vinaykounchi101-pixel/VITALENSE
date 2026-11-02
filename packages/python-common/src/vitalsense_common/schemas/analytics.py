"""Analytics schemas for health metric aggregations, baselines, and trends."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class MetricSummary(BaseModel):
    """Current snapshot and rolling average for a single metric."""

    metric_name: str
    latest_value: Optional[float] = None
    latest_timestamp: Optional[datetime] = None
    unit: str
    rolling_7d_avg: Optional[float] = None
    change_from_baseline_pct: Optional[float] = None
    status: str = Field(default="normal", description="Status category: normal, optimal, elevated, low, insufficient_data")
    trend: str = Field(default="stable", description="Trend direction: rising, falling, stable")


class DashboardSummaryResponse(BaseModel):
    """Comprehensive dashboard summary covering all 10 Phase 1 metrics and recovery score."""

    person_id: uuid.UUID
    generated_at: datetime
    metrics: Dict[str, MetricSummary]
    recovery_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    data_quality_score: float = Field(default=100.0, ge=0.0, le=100.0)
    days_tracked: int = Field(default=0)


class TrendDataPoint(BaseModel):
    """A single time-series bucket for chart rendering."""

    bucket_time: str
    value: float
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    rolling_avg: Optional[float] = None


class MetricTrendResponse(BaseModel):
    """Historical trend series with statistical baseline for charts."""

    metric_name: str
    canonical_unit: str
    period: str
    baseline_mean: Optional[float] = None
    baseline_std: Optional[float] = None
    data_points: List[TrendDataPoint] = Field(default_factory=list)

