"""Workout and fitness schemas with muscle group targeting."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExerciseSet(BaseModel):
    """A single set within an exercise."""

    set_number: int
    reps: int
    weight_kg: Optional[float] = None
    rpe: Optional[float] = Field(default=None, ge=1.0, le=10.0, description="Rate of perceived exertion")


class ExerciseDetail(BaseModel):
    """An individual exercise performance log."""

    exercise_name: str
    target_muscle: str
    sets: List[ExerciseSet] = Field(default_factory=list)


class CreateWorkoutRequest(BaseModel):
    """Payload to log a detailed workout session."""

    workout_type: str = Field(..., description="e.g. strength, cardio, hiit, yoga")
    duration_minutes: float = Field(..., gt=0.0)
    measured_at: Optional[datetime] = None
    exercises: List[ExerciseDetail] = Field(default_factory=list)
    muscle_groups: List[str] = Field(default_factory=list, description="Targeted anatomical muscle groups")
    notes: Optional[str] = None


class WorkoutDTO(BaseModel):
    """Workout summary and muscle load analysis."""

    id: uuid.UUID
    person_id: uuid.UUID
    workout_type: str
    duration_minutes: float
    exercises: List[Dict[str, Any]] = Field(default_factory=list)
    muscle_groups: List[str] = Field(default_factory=list)
    total_volume_kg: Optional[float] = None
    created_at: datetime


class WorkoutListResponse(BaseModel):
    """List of logged workout sessions."""

    workouts: List[WorkoutDTO] = Field(default_factory=list)
    total_count: int = 0

