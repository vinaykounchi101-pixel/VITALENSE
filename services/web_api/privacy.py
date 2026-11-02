"""Privacy, Data Portability, and Account Deletion Endpoints."""

from __future__ import annotations

from typing import Tuple

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from services.auth.dependencies import get_current_user_and_person, verify_csrf_double_submit
from services.privacy.service import PrivacyService
from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.envelope import SuccessResponse
from vitalsense_common.schemas.privacy import (
    DeleteAccountRequest,
    DeleteAccountResponse,
    ExportHealthDataResponse,
)

router = APIRouter(prefix="/privacy", tags=["Privacy & GDPR Controls"])


@router.get(
    "/export",
    response_model=SuccessResponse[ExportHealthDataResponse],
    summary="Export All Personal Health Records (GDPR Portability)",
)
async def export_personal_data(
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[ExportHealthDataResponse]:
    """Generate complete machine-readable JSON export of all personal health observations and metadata."""
    user, _ = auth
    export_payload = await PrivacyService.export_all_data(session, user.id)
    return SuccessResponse(data=export_payload)


@router.post(
    "/delete-account",
    response_model=SuccessResponse[DeleteAccountResponse],
    summary="Permanently and Irreversibly Delete Account and All Health Data",
    dependencies=[Depends(verify_csrf_double_submit)],
)
async def delete_account_permanently(
    request: DeleteAccountRequest,
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[DeleteAccountResponse]:
    """Execute GDPR Art 17 Right to Erasure, cascading across all database tables."""
    user, _ = auth
    res = await PrivacyService.delete_account_permanently(session, user.id, request.password)
    return SuccessResponse(data=res)

