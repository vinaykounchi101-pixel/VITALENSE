"""Tests for Medical Records and Workout / Fitness Logging."""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from services.api.main import app
from services.auth.service import AuthService
from vitalsense_common.database import get_engine
from vitalsense_common.schemas.auth import RegisterRequest


@pytest.mark.integration
@pytest.mark.asyncio
async def test_medical_and_fitness_flows() -> None:
    """Verify medical record creation/listing and workout session volume calculation."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"medfit_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {reg.access_token}"}

        # 1. Create Medical Record
        med_payload = {
            "record_type": "lab_result",
            "title": "Comprehensive Metabolic Panel",
            "provider_name": "Quest Diagnostics",
            "record_date": "2026-10-20",
            "document_metadata": {"fasting": True, "glucose_fasting_mg_dl": 92},
            "clinical_notes": "All serum values within standard reference ranges.",
        }
        med_resp = await client.post("/api/v1/web/medical/records", headers=headers, json=med_payload)
        assert med_resp.status_code == 200
        med_data = med_resp.json()["data"]
        assert med_data["title"] == "Comprehensive Metabolic Panel"
        assert "never medical diagnosis" in med_data["disclaimer"]

        # List Medical Records
        med_list = await client.get("/api/v1/web/medical/records", headers=headers)
        assert med_list.status_code == 200
        assert med_list.json()["data"]["total_count"] == 1

        # 2. Log Workout Session
        workout_payload = {
            "workout_type": "strength_training",
            "duration_minutes": 45.0,
            "exercises": [
                {
                    "exercise_name": "Barbell Bench Press",
                    "target_muscle": "chest",
                    "sets": [
                        {"set_number": 1, "reps": 10, "weight_kg": 60.0},
                        {"set_number": 2, "reps": 8, "weight_kg": 70.0},
                    ],
                },
                {
                    "exercise_name": "Incline Dumbbell Fly",
                    "target_muscle": "chest",
                    "sets": [
                        {"set_number": 1, "reps": 12, "weight_kg": 15.0},
                    ],
                },
            ],
            "muscle_groups": ["chest", "triceps", "anterior_deltoid"],
        }
        # Expected volume: (10*60) + (8*70) + (12*15) = 600 + 560 + 180 = 1340 kg
        w_resp = await client.post("/api/v1/web/fitness/workouts", headers=headers, json=workout_payload)
        assert w_resp.status_code == 200
        w_data = w_resp.json()["data"]
        assert w_data["total_volume_kg"] == 1340.0
        assert "chest" in w_data["muscle_groups"]
        assert "triceps" in w_data["muscle_groups"]

        # List Workouts
        w_list = await client.get("/api/v1/web/fitness/workouts", headers=headers)
        assert w_list.status_code == 200
        assert w_list.json()["data"]["total_count"] == 1

        # 3. Family Profiles
        fam_resp = await client.post(
            "/api/v1/web/family/profiles",
            headers=headers,
            json={"display_name": "Emma Doe", "relationship_type": "child"},
        )
        assert fam_resp.status_code == 200
        fam_data = fam_resp.json()["data"]
        assert fam_data["display_name"] == "Emma Doe"

        fam_list = await client.get("/api/v1/web/family/profiles", headers=headers)
        assert fam_list.status_code == 200
        profiles = fam_list.json()["data"]["profiles"]
        assert len(profiles) == 2  # self + child
