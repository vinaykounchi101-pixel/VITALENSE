"""Analytics Endpoints for Web and Mobile clients."""

from __future__ import annotations

from typing import Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from services.analytics.service import AnalyticsService
from services.auth.dependencies import get_current_user_and_person
from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.analytics import (
    DashboardSummaryResponse,
    MetricTrendResponse,
)
from vitalsense_common.schemas.envelope import SuccessResponse

router = APIRouter(prefix="/analytics", tags=["Analytics & Visualizations"])


@router.get(
    "/dashboard-summary",
    response_model=SuccessResponse[DashboardSummaryResponse],
    summary="Get 10-Metric Dashboard Summary and Recovery Score",
)
async def get_dashboard_summary(
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[DashboardSummaryResponse]:
    """Retrieve rolling 7-day baselines, current metrics, and recovery score."""
    _, person = auth
    summary = await AnalyticsService.get_dashboard_summary(session, person.id)
    return SuccessResponse(data=summary)


@router.get(
    "/trends/{metric_name}",
    response_model=SuccessResponse[MetricTrendResponse],
    summary="Get Metric Historical Trend and Baseline Statistics",
)
async def get_metric_trends(
    metric_name: str,
    period_days: int = Query(default=30, ge=1, le=365),
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[MetricTrendResponse]:
    """Retrieve historical time series with rolling average and standard deviation."""
    _, person = auth
    trends = await AnalyticsService.get_metric_trends(
        session, person.id, metric_name, period_days=period_days
    )
    return SuccessResponse(data=trends)

