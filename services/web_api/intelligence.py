"""AI Intelligence and ML Trend Forecasting Endpoints."""

from __future__ import annotations

from typing import Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from services.auth.dependencies import get_current_user_and_person
from services.intelligence.daily_briefing import DailyBriefingService
from services.intelligence.ml_forecasting import MLForecastingService
from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.envelope import SuccessResponse
from vitalsense_common.schemas.intelligence import (
    DailyBriefingResponse,
    HealthForecastResponse,
)

router = APIRouter(prefix="/intelligence", tags=["AI & ML Intelligence"])


@router.get(
    "/daily-briefing",
    response_model=SuccessResponse[DailyBriefingResponse],
    summary="Get Daily Health Intelligence Briefing",
)
async def get_daily_briefing(
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[DailyBriefingResponse]:
    """Retrieve or generate daily health intelligence briefing with non-diagnostic disclaimer."""
    _, person = auth
    briefing = await DailyBriefingService.get_or_generate_briefing(session, person.id)
    return SuccessResponse(data=briefing)


@router.get(
    "/forecast/{metric_name}",
    response_model=SuccessResponse[HealthForecastResponse],
    summary="Get Statistical Trend Forecast with Confidence Bounds",
)
async def get_metric_forecast(
    metric_name: str,
    forecast_days: int = Query(default=7, ge=1, le=30),
    history_days: int = Query(default=30, ge=7, le=90),
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[HealthForecastResponse]:
    """Generate statistical rolling OLS trend forecast with 95% uncertainty intervals."""
    _, person = auth
    forecast = await MLForecastingService.forecast_metric(
        session, person.id, metric_name, forecast_days=forecast_days, history_days=history_days
    )
    return SuccessResponse(data=forecast)

