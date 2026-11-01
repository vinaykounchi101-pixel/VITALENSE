"""Mobile API Synchronization Endpoints.

Implements ARCH-002, ARCH-014, OD-01, OD-04, OD-14, OD-16, and SYNC-001 through SYNC-019:
- Cross-platform batch health observation ingestion
- Incremental and full offline synchronization
- Deletion tombstone propagation
- Safe resynchronization preserving offline drafts on SYNC_CURSOR_EXPIRED
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

router = APIRouter(prefix="/sync", tags=["Mobile Sync"])


@router.post(
    "",
    response_model=SuccessResponse[BatchSyncResponse],
    summary="Batch Synchronize Mobile Client Observations and Deletions",
    status_code=status.HTTP_200_OK,
)
async def synchronize_mobile(
    request: BatchSyncRequest,
    user_person: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[BatchSyncResponse]:
    """Execute batch synchronization for mobile and native clients (Android, iOS, Windows, macOS).

    Ingests new health observations, applies corrections, propagates tombstones, and returns server deltas.
    Returns HTTP 409 SYNC_CURSOR_EXPIRED if the client has been offline for >30 days.
    """
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
    summary="Safe Full Resynchronization Preserving Offline Drafts",
    status_code=status.HTTP_200_OK,
)
async def full_resync_mobile(
    request: BatchSyncRequest,
    user_person: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[BatchSyncResponse]:
    """Execute safe full resynchronization following cursor expiration.

    Forces last_sync_timestamp to None to retrieve canonical server baseline,
    while ingesting pending local offline changes and drafts.
    """
    _, person = user_person
    safe_request = request.model_copy(update={"last_sync_timestamp": None})
    result = await SyncService.synchronize(
        session=session,
        person_id=person.id,
        request=safe_request,
    )
    return SuccessResponse(data=result)

