"""Fitness and Workout Domain Service.

Calculates total volume (sets * reps * weight), tracks muscle group targeting,
and records structured workouts.
"""

from __future__ import annotations

import uuid
from typing import List

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from services.sync.service import SyncService
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.extended import WorkoutDetail
from vitalsense_common.models.health_record import HealthRecord
from vitalsense_common.schemas.fitness import (
    CreateWorkoutRequest,
    WorkoutDTO,
    WorkoutListResponse,
)
from vitalsense_common.schemas.sync import BatchSyncRequest, ObservationItem


class FitnessService:
    """Service for workout tracking and anatomical muscle engagement."""

    @classmethod
    async def log_workout(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
        request: CreateWorkoutRequest,
    ) -> WorkoutDTO:
        """Record workout session, compute total volume, and link canonical health record."""
        now = request.measured_at or utc_now()

        # Compute total volume in kg
        total_vol = 0.0
        exercises_json = []
        targeted_muscles = set(request.muscle_groups)

        for ex in request.exercises:
            targeted_muscles.add(ex.target_muscle)
            ex_dict = ex.model_dump(mode="json")
            for s in ex.sets:
                if s.weight_kg and s.reps:
                    total_vol += s.weight_kg * s.reps
            exercises_json.append(ex_dict)

        # 1. Ingest canonical workout_session health record via SyncService
        hr_batch = BatchSyncRequest(
            device_id="manual-workout-entry",
            observations=[
                ObservationItem(
                    metric_name="workout_session",
                    value=request.duration_minutes * 60.0,
                    unit="seconds",
                    measured_at=now,
                )
            ],
        )
        sync_res = await SyncService.synchronize(session, person_id, hr_batch)

        # Find the created HealthRecord id
        hr_query = (
            select(HealthRecord.id)
            .where(
                HealthRecord.person_id == person_id,
                HealthRecord.metric_id == "workout_session",
                HealthRecord.event_timestamp == now,
            )
            .order_by(desc(HealthRecord.created_at))
        )
        hr_id = (await session.execute(hr_query)).scalar_one_or_none()

        # 2. Record WorkoutDetail
        workout = WorkoutDetail(
            person_id=person_id,
            health_record_id=hr_id,
            workout_type=request.workout_type,
            duration_minutes=request.duration_minutes,
            exercises=exercises_json,
            muscle_groups=sorted(list(targeted_muscles)),
            total_volume_kg=round(total_vol, 2) if total_vol > 0 else None,
        )
        session.add(workout)
        await session.flush()

        return WorkoutDTO(
            id=workout.id,
            person_id=workout.person_id,
            workout_type=workout.workout_type,
            duration_minutes=float(workout.duration_minutes),
            exercises=workout.exercises,
            muscle_groups=workout.muscle_groups,
            total_volume_kg=float(workout.total_volume_kg) if workout.total_volume_kg is not None else None,
            created_at=workout.created_at,
        )

    @classmethod
    async def list_workouts(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
    ) -> WorkoutListResponse:
        """List recent workouts for a person."""
        query = (
            select(WorkoutDetail)
            .where(WorkoutDetail.person_id == person_id)
            .order_by(desc(WorkoutDetail.created_at))
        )
        res = await session.execute(query)
        workouts = res.scalars().all()

        dtos = [
            WorkoutDTO(
                id=w.id,
                person_id=w.person_id,
                workout_type=w.workout_type,
                duration_minutes=float(w.duration_minutes),
                exercises=w.exercises,
                muscle_groups=w.muscle_groups,
                total_volume_kg=float(w.total_volume_kg) if w.total_volume_kg is not None else None,
                created_at=w.created_at,
            )
            for w in workouts
        ]
        return WorkoutListResponse(workouts=dtos, total_count=len(dtos))
