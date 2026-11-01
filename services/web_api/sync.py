"""Web API Synchronization and Observation Endpoints.

Implements ARCH-002, ARCH-014, OD-01, OD-04, OD-14, OD-16, and SYNC-001 through SYNC-019:
- Web-facing batch synchronization and manual observation entries
- Controlled manual entry for approved metrics (origin = user_entered)
- Immutable revisions preserving original measured_at
"""

from __future__ import annotations

from typing import Tuple

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.envelope import SuccessResponse
from vitalsense_common.schemas.sync import (
    BatchSyncRequest,
    BatchSyncResponse,
)
from services.auth.dependencies import get_current_user_and_person
from services.sync.service import SyncService

router = APIRouter(prefix="/sync", tags=["Web Sync"])


@router.post(
    "",
    response_model=SuccessResponse[BatchSyncResponse],
    summary="Batch Synchronize Web Client Observations",
    status_code=status.HTTP_200_OK,
)
async def synchronize_web(
    request: BatchSyncRequest,
    user_person: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[BatchSyncResponse]:
    """Execute batch synchronization for the web client (IndexedDB offline cache)."""
    _, person = user_person
    result = await SyncService.synchronize(
        session=session,
        person_id=person.id,
        request=request,
    )
    return SuccessResponse(data=result)


@router.post(
    "/full-resync",
    response_model=SuccessResponse[BatchSyncResponse],
    summary="Safe Full Resynchronization for Web Client",
    status_code=status.HTTP_200_OK,
)
async def full_resync_web(
    request: BatchSyncRequest,
    user_person: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[BatchSyncResponse]:
    """Reset cursor and retrieve baseline records while preserving un-synced web drafts."""
    _, person = user_person
    safe_request = request.model_copy(update={"last_sync_timestamp": None})
    result = await SyncService.synchronize(
        session=session,
        person_id=person.id,
        request=safe_request,
    )
    return SuccessResponse(data=result)

