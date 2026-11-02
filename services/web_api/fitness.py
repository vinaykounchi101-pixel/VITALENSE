"""Fitness and Workout Endpoints."""

from __future__ import annotations

from typing import Tuple

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from services.auth.dependencies import get_current_user_and_person, verify_csrf_double_submit
from services.fitness.service import FitnessService
from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.envelope import SuccessResponse
from vitalsense_common.schemas.fitness import (
    CreateWorkoutRequest,
    WorkoutDTO,
    WorkoutListResponse,
)

router = APIRouter(prefix="/fitness", tags=["Fitness & Workouts"])


@router.post(
    "/workouts",
    response_model=SuccessResponse[WorkoutDTO],
    summary="Log Structured Workout Session",
    dependencies=[Depends(verify_csrf_double_submit)],
)
async def log_workout(
    request: CreateWorkoutRequest,
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[WorkoutDTO]:
    """Record workout session with exercise details, sets, reps, and targeted muscle groups."""
    _, person = auth
    workout = await FitnessService.log_workout(session, person.id, request)
    return SuccessResponse(data=workout)


@router.get(
    "/workouts",
    response_model=SuccessResponse[WorkoutListResponse],
    summary="List Logged Workouts",
)
async def list_workouts(
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[WorkoutListResponse]:
    """Retrieve logged workouts for the authenticated person."""
    _, person = auth
    workouts = await FitnessService.list_workouts(session, person.id)
    return SuccessResponse(data=workouts)

