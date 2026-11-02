"""Tests for External File Imports, GDPR Data Portability, and Account Deletion."""

from __future__ import annotations

import io
import uuid
import zipfile
from datetime import timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.api.main import app
from services.auth.service import AuthService
from services.sync.service import SyncService
from vitalsense_common.database import get_engine
from vitalsense_common.models.account import UserAccount
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.health_record import HealthRecord
from vitalsense_common.schemas.auth import RegisterRequest
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
    """Verify GDPR data export and complete cascading account erasure."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        reg = await AuthService.register_user(
            session,
            RegisterRequest(
                email=f"privacy_{uuid.uuid4().hex[:8]}@example.com",
                password="SecurePassword123!",
            ),
        )
        person_id = reg.person_id
        user_id = reg.user_account_id
        await session.commit()

        # Ingest one record
        batch = BatchSyncRequest(
            device_id="device-priv",
            observations=[
                ObservationItem(
                    metric_name="steps",
                    value=5000.0,
                    unit="count",
                    measured_at=utc_now() - timedelta(hours=1),
                )
            ],
        )
        await SyncService.synchronize(session, person_id, batch)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {reg.access_token}"}

        # 1. Export Data
        export_resp = await client.get("/api/v1/web/privacy/export", headers=headers)
        assert export_resp.status_code == 200
        export_data = export_resp.json()["data"]
        assert export_data["total_records"] == 1
        assert len(export_data["records"]) == 1
        assert len(export_data["person_profiles"]) == 1

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

    # Verify user account and all health records are deleted from DB
    async with AsyncSession(engine) as session:
        u_check = await session.execute(select(UserAccount).where(UserAccount.id == user_id))
        assert u_check.scalar_one_or_none() is None

        hr_check = await session.execute(select(HealthRecord).where(HealthRecord.person_id == person_id))
        assert hr_check.fetchall() == []
