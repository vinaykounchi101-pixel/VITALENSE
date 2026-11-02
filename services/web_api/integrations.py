"""External Health Data Import Endpoints."""

from __future__ import annotations

from typing import Tuple

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from services.auth.dependencies import get_current_user_and_person, verify_csrf_double_submit
from services.integrations.importer import HealthDataImporter
from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.envelope import SuccessResponse

router = APIRouter(prefix="/integrations", tags=["External Integrations & Imports"])


@router.post(
    "/upload",
    summary="Import Health Archive (Apple Health XML/ZIP, Google Takeout JSON, or CSV)",
    dependencies=[Depends(verify_csrf_double_submit)],
)
async def upload_health_file(
    file: UploadFile = File(...),
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[dict]:
    """Parse and ingest external health data file via canonical SyncService."""
    _, person = auth
    content = await file.read()
    import_job = await HealthDataImporter.import_file(
        session,
        person.id,
        file.filename or "uploaded_data.csv",
        content,
    )
    return SuccessResponse(
        data={
            "import_id": str(import_job.id),
            "status": import_job.status,
            "filename": import_job.filename,
            "platform": import_job.source_platform,
            "total_records": import_job.total_records,
            "imported_records": import_job.imported_records,
            "rejected_records": import_job.rejected_records,
        }
    )

