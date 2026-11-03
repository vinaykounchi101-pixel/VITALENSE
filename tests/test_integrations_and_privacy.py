"""Tests for External File Imports, GDPR Data Portability, and Account Deletion."""

from __future__ import annotations

import io
import uuid
import zipfile
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from services.api.main import app
from services.auth.service import AuthService
from services.privacy.service import PrivacyService
from services.sync.service import SyncService
from vitalsense_common.database import get_engine
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.models.audit import AuditEvent
from vitalsense_common.models.auth import AuthCredential
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.extended import DailyInsight, MedicalRecord, WorkoutDetail
from vitalsense_common.models.health_record import HealthRecord, SourceRecord
from vitalsense_common.models.sync import SyncTombstone
from vitalsense_common.schemas.auth import RegisterRequest, RefreshTokenRequest, LoginRequest
from vitalsense_common.schemas.sync import BatchSyncRequest, ObservationItem


@pytest.mark.integration
@pytest.mark.asyncio
async def test_csv_and_apple_health_xml_import() -> None:
    """Verify importing CSV and Apple Health XML files parses and ingests valid records."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"import_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {reg.access_token}"}

        # 1. Upload CSV
        csv_content = (
            "metric_name,value,unit,timestamp,device_record_id\n"
            "steps,7500,count,2026-10-25T10:00:00+00:00,csv-step-1\n"
            "resting_heart_rate,64,bpm,2026-10-25T08:00:00+00:00,csv-hr-1\n"
        ).encode("utf-8")

        files = {"file": ("health_export.csv", csv_content, "text/csv")}
        resp_csv = await client.post("/api/v1/web/integrations/upload", headers=headers, files=files)
        assert resp_csv.status_code == 200
        csv_res = resp_csv.json()["data"]
        assert csv_res["imported_records"] == 2
        assert csv_res["rejected_records"] == 0

        # 2. Upload Apple Health XML
        apple_xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<HealthData locale="en_US">\n'
            '  <Record type="HKQuantityTypeIdentifierStepCount" value="8200" unit="count" startDate="2026-10-26 09:00:00 -0400" uuid="apple-uuid-1"/>\n'
            '  <Record type="HKQuantityTypeIdentifierOxygenSaturation" value="0.98" unit="%" startDate="2026-10-26 09:30:00 -0400" uuid="apple-uuid-2"/>\n'
            '  <Record type="HKQuantityTypeIdentifierUnrecognizedType" value="10" unit="count" startDate="2026-10-26 09:00:00 -0400"/>\n'
            '</HealthData>'
        ).encode("utf-8")

        files_xml = {"file": ("export.xml", apple_xml, "text/xml")}
        resp_xml = await client.post("/api/v1/web/integrations/upload", headers=headers, files=files_xml)
        assert resp_xml.status_code == 200
        xml_res = resp_xml.json()["data"]
        assert xml_res["imported_records"] == 2
        assert xml_res["rejected_records"] == 1  # 1 unrecognized type rejected safely


@pytest.mark.integration
@pytest.mark.asyncio
async def test_privacy_export_and_cascading_deletion() -> None:
    """Verify GDPR data export across all 8 domain entities and complete cascading account erasure."""
    engine = get_engine()
    test_email = f"privacy_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=test_email,
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        user_id = reg.user_account_id
        await session.commit()

        # Ingest one health observation
        batch = BatchSyncRequest(
            device_id="device-priv-001",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=5000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=1),
                    device_record_id="step-rec-priv-1",
                )
            ],
        )
        await SyncService.synchronize(session, person_id, batch)

        # Ingest a medical record
        med = MedicalRecord(
            person_id=person_id,
            record_type="lab_result",
            title="Comprehensive Metabolic Panel",
            provider_name="Memorial Health",
            record_date=date(2026, 10, 20),
            document_metadata={"glucose": 92, "fasting": True},
            clinical_notes="Fasting blood glucose normal.",
        )
        session.add(med)

        # Ingest a workout detail
        workout = WorkoutDetail(
            person_id=person_id,
            workout_type="strength_training",
            duration_minutes=45.0,
            exercises=[{"name": "Barbell Squat", "sets": 3, "reps": 10, "weight_kg": 100.0}],
            muscle_groups=["quadriceps", "glutes"],
            total_volume_kg=3000.0,
        )
        session.add(workout)

        # Ingest a daily insight
        insight = DailyInsight(
            person_id=person_id,
            insight_date=date(2026, 10, 25),
            headline="Optimal Recovery",
            summary_text="Resting heart rate remains stable with good recovery markers.",
            recovery_score=88.5,
            key_metrics={"steps": 5000, "rhr": 60},
            recommendations=["Maintain hydration throughout cardiovascular session."],
            disclaimer="Insights are for educational and wellness tracking only, never medical diagnosis.",
            provider="deterministic_heuristic",
        )
        session.add(insight)

        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {reg.access_token}"}

        # 1. Export Data & verify comprehensive manifest
        export_resp = await client.get("/api/v1/web/privacy/export", headers=headers)
        assert export_resp.status_code == 200
        export_data = export_resp.json()["data"]

        # Check manifest
        assert export_data["manifest"]["version"] == "1.0"
        assert "health_records" in export_data["manifest"]["data_categories"]
        assert "medical_records" in export_data["manifest"]["data_categories"]
        assert "workouts" in export_data["manifest"]["data_categories"]
        assert "daily_insights" in export_data["manifest"]["data_categories"]

        # Check counts and entity structures
        assert export_data["total_records"] >= 1
        assert len(export_data["records"]) >= 1
        assert len(export_data["person_profiles"]) == 1
        assert len(export_data["medical_records"]) == 1
        assert export_data["medical_records"][0]["title"] == "Comprehensive Metabolic Panel"
        assert len(export_data["workouts"]) == 1
        assert export_data["workouts"][0]["workout_type"] == "strength_training"
        assert len(export_data["daily_insights"]) == 1
        assert export_data["daily_insights"][0]["recovery_score"] == 88.5

        # Check account metadata (strictly zero password hashes or refresh token secrets)
        assert export_data["account"] is not None
        assert export_data["account"]["email"] == test_email
        assert "password" not in export_data["account"]
        assert "password_hash" not in export_data["account"]
        assert "refresh_token" not in export_data["account"]

        # 2. Delete Account with wrong password -> 400
        wrong_del = await client.post(
            "/api/v1/web/privacy/delete-account",
            headers=headers,
            json={"password": "WrongPassword!"},
        )
        assert wrong_del.status_code == 400

        # 3. Delete Account with correct password -> 200
        del_resp = await client.post(
            "/api/v1/web/privacy/delete-account",
            headers=headers,
            json={"password": "SecurePassword123!"},
        )
        assert del_resp.status_code == 200
        assert del_resp.json()["data"]["status"] == "deleted"

    # Verify user account and all personal records across all domain tables are completely erased
    async with AsyncSession(engine) as session:
        u_check = await session.execute(select(UserAccount).where(UserAccount.id == user_id))
        assert u_check.scalar_one_or_none() is None

        p_check = await session.execute(select(Person).where(Person.user_account_id == user_id))
        assert p_check.fetchall() == []

        hr_check = await session.execute(select(HealthRecord).where(HealthRecord.person_id == person_id))
        assert hr_check.fetchall() == []

        mr_check = await session.execute(select(MedicalRecord).where(MedicalRecord.person_id == person_id))
        assert mr_check.fetchall() == []

        wd_check = await session.execute(select(WorkoutDetail).where(WorkoutDetail.person_id == person_id))
        assert wd_check.fetchall() == []

        di_check = await session.execute(select(DailyInsight).where(DailyInsight.person_id == person_id))
        assert di_check.fetchall() == []

        cred_check = await session.execute(select(AuthCredential).where(AuthCredential.user_account_id == user_id))
        assert cred_check.scalar_one_or_none() is None

        # Confirm anonymized audit tombstone exists without linking to user ID
        tombstone_check = await session.execute(
            select(AuditEvent).where(
                AuditEvent.action == "account.purged_gdpr_art17",
                AuditEvent.target_type == "user_account_tombstone",
            )
        )
        tombstones = tombstone_check.scalars().all()
        assert len(tombstones) >= 1
        assert any(t.actor_id is None for t in tombstones)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_account_deletion_transaction_rollback_on_failure(monkeypatch) -> None:
    """Verify that an unexpected error during cascading deletion rolls back completely, preserving user data."""
    engine = get_engine()
    test_email = f"rollback_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(email=test_email, password="SecurePassword123!"),
        )
        person_id = reg.person_id
        user_id = reg.user_account_id
        await session.commit()

        # Ingest one health observation
        batch = BatchSyncRequest(
            device_id="device-rollback-test",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=4000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(minutes=10),
                    device_record_id="step-rec-rb-1",
                )
            ],
        )
        await SyncService.synchronize(session, person_id, batch)
        await session.commit()

    # Simulate an error during execution of deletion (database error when deleting Person)
    original_execute = AsyncSession.execute

    async def mock_execute(self, statement, *args, **kwargs):
        if hasattr(statement, "is_delete") and statement.is_delete:
            entity = getattr(statement, "table", None)
            if entity is not None and getattr(entity, "name", "") == "persons":
                raise RuntimeError("Simulated database failure during person deletion")
        return await original_execute(self, statement, *args, **kwargs)

    monkeypatch.setattr(AsyncSession, "execute", mock_execute)

    # Attempt deletion via PrivacyService
    async with AsyncSession(engine) as session:
        with pytest.raises(HTTPException) as exc_info:
            await PrivacyService.delete_account_permanently(
                session,
                user_id,
                "SecurePassword123!",
            )
        assert exc_info.value.status_code == 500
        assert "rolled back" in str(exc_info.value.detail).lower()

    # Remove monkeypatch
    monkeypatch.undo()

    # Verify that the transaction rolled back: UserAccount, Person, and HealthRecord still exist!
    async with AsyncSession(engine) as session:
        u_check = await session.execute(select(UserAccount).where(UserAccount.id == user_id))
        assert u_check.scalar_one_or_none() is not None

        p_check = await session.execute(select(Person).where(Person.user_account_id == user_id))
        assert len(p_check.scalars().all()) == 1

        hr_check = await session.execute(select(HealthRecord).where(HealthRecord.person_id == person_id))
        assert len(hr_check.scalars().all()) == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_pending_offline_uploads_cannot_resurrect_deleted_account() -> None:
    """Verify that pending offline sync batches are strictly rejected after account deletion."""
    engine = get_engine()
    test_email = f"resurrect_prevention_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(email=test_email, password="SecurePassword123!"),
        )
        person_id = reg.person_id
        user_id = reg.user_account_id
        await session.commit()

        # Delete account permanently
        await PrivacyService.delete_account_permanently(
            session,
            user_id,
            "SecurePassword123!",
        )
        await session.commit()

    # Now attempt an offline sync upload for the deleted person
    async with AsyncSession(engine) as session:
        offline_batch = BatchSyncRequest(
            device_id="device-offline-zombie",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=8000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(minutes=5),
                    device_record_id="zombie-step-1",
                )
            ],
        )
        with pytest.raises(HTTPException) as exc_info:
            await SyncService.synchronize(session, person_id, offline_batch)

        assert exc_info.value.status_code == 403
        assert "disabled" in str(exc_info.value.detail).lower() or "deletion" in str(exc_info.value.detail).lower()

        # Verify zero health records created
        hr_check = await session.execute(select(HealthRecord).where(HealthRecord.person_id == person_id))
        assert hr_check.fetchall() == []



@pytest.mark.integration
@pytest.mark.asyncio
async def test_deletion_pending_account_cannot_refresh_or_sync() -> None:
    """Verify that an account in deletion_pending status (grace period) cannot refresh sessions or sync data."""
    engine = get_engine()
    test_email = f"pending_del_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(email=test_email, password="SecurePassword123!"),
        )
        person_id = reg.person_id
        user_id = reg.user_account_id
        refresh_token = reg.refresh_token
        access_token = reg.access_token

        # Set user account to deletion_pending (OD-07, ADR-04)
        await session.execute(
            update(UserAccount).where(UserAccount.id == user_id).values(status="deletion_pending")
        )
        await session.commit()

    # 1. Verify token refresh is rejected with 403 Forbidden
    async with AsyncSession(engine) as session:
        with pytest.raises(HTTPException) as exc_info:
            await AuthService.refresh_session(session, RefreshTokenRequest(refresh_token=refresh_token))
        assert exc_info.value.status_code == 403
        assert "pending deletion" in str(exc_info.value.detail).lower()

    # 2. Verify login is rejected with 403 Forbidden
    async with AsyncSession(engine) as session:
        with pytest.raises(HTTPException) as exc_info:
            await AuthService.authenticate_user(
                session, LoginRequest(email=test_email, password="SecurePassword123!")
            )
        assert exc_info.value.status_code == 403

    # 3. Verify sync upload is rejected with 403 Forbidden
    async with AsyncSession(engine) as session:
        batch = BatchSyncRequest(
            device_id="device-pending-del",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=1000.0,
                    unit="count",
                    measured_at=utc_now(),
                    device_record_id="pending-step-1",
                )
            ],
        )
        with pytest.raises(HTTPException) as exc_info:
            await SyncService.synchronize(session, person_id, batch)
        assert exc_info.value.status_code == 403
        assert "deletion" in str(exc_info.value.detail).lower()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_account_deletion_outer_commit_and_no_premature_success() -> None:
    """Verify that delete_account_permanently commits durably to PostgreSQL across all tables before returning."""
    engine = get_engine()
    test_email = f"durable_del_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(email=test_email, password="SecurePassword123!"),
        )
        person_id = reg.person_id
        user_id = reg.user_account_id
        await session.commit()

        # Ingest health record
        batch = BatchSyncRequest(
            device_id="device-durable-test",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=5000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(minutes=15),
                    device_record_id="durable-step-1",
                )
            ],
        )
        await SyncService.synchronize(session, person_id, batch)

        # Ingest daily insight
        session.add(
            DailyInsight(
                person_id=person_id,
                insight_date=date.today(),
                headline="Durable Deletion Test",
                summary_text="Checking commit durability.",
            )
        )
        await session.commit()

    # Call delete_account_permanently
    async with AsyncSession(engine) as session:
        del_resp = await PrivacyService.delete_account_permanently(
            session,
            user_id,
            "SecurePassword123!",
        )
        assert del_resp.status == "deleted"
        assert "irreversibly deleted" in del_resp.message

    # Open completely fresh database session to prove physical commit to PostgreSQL
    async with AsyncSession(engine) as session:
        # UserAccount is gone
        u_check = await session.execute(select(UserAccount).where(UserAccount.id == user_id))
        assert u_check.scalar_one_or_none() is None

        # Person is gone
        p_check = await session.execute(select(Person).where(Person.user_account_id == user_id))
        assert p_check.fetchall() == []

        # HealthRecords are gone
        hr_check = await session.execute(select(HealthRecord).where(HealthRecord.person_id == person_id))
        assert hr_check.fetchall() == []

        # DailyInsights are gone
        di_check = await session.execute(select(DailyInsight).where(DailyInsight.person_id == person_id))
        assert di_check.fetchall() == []

        # User AuditEvents are gone
        ae_check = await session.execute(select(AuditEvent).where(AuditEvent.actor_id == user_id))
        assert ae_check.fetchall() == []

        # Anonymized audit tombstone exists without user PHI or identifiers
        tombstone_check = await session.execute(
            select(AuditEvent).where(
                AuditEvent.action == "account.purged_gdpr_art17",
                AuditEvent.target_type == "user_account_tombstone",
            )
        )
        tombstones = tombstone_check.scalars().all()
        assert len(tombstones) >= 1
        assert any(t.actor_id is None for t in tombstones)
