"""Medical Records Endpoints."""

from __future__ import annotations

from typing import Tuple

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from services.auth.dependencies import get_current_user_and_person, verify_csrf_double_submit
from services.medical.service import MedicalService
from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.envelope import SuccessResponse
from vitalsense_common.schemas.medical import (
    CreateMedicalRecordRequest,
    MedicalRecordDTO,
    MedicalRecordListResponse,
)

router = APIRouter(prefix="/medical", tags=["Medical Records"])


@router.post(
    "/records",
    response_model=SuccessResponse[MedicalRecordDTO],
    summary="Add Clinical Document / Lab Test Metadata",
    dependencies=[Depends(verify_csrf_double_submit)],
)
async def create_medical_record(
    request: CreateMedicalRecordRequest,
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[MedicalRecordDTO]:
    """Register a new clinical document metadata entry."""
    _, person = auth
    record = await MedicalService.create_record(session, person.id, request)
    return SuccessResponse(data=record)


@router.get(
    "/records",
    response_model=SuccessResponse[MedicalRecordListResponse],
    summary="List Clinical Documents and Lab Tests",
)
async def list_medical_records(
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[MedicalRecordListResponse]:
    """Retrieve all clinical records for the authenticated person."""
    _, person = auth
    records = await MedicalService.list_records(session, person.id)
    return SuccessResponse(data=records)

