"""Family and Dependent Profiles Endpoints."""

from __future__ import annotations

from typing import Tuple

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from services.auth.dependencies import get_current_user_and_person, verify_csrf_double_submit
from services.family.service import FamilyService
from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.envelope import SuccessResponse
from vitalsense_common.schemas.family import (
    CreatePersonProfileRequest,
    FamilyProfilesResponse,
    PersonProfileDTO,
)

router = APIRouter(prefix="/family", tags=["Family & Dependent Profiles"])


@router.post(
    "/profiles",
    response_model=SuccessResponse[PersonProfileDTO],
    summary="Add Dependent or Family Member Profile",
    dependencies=[Depends(verify_csrf_double_submit)],
)
async def create_family_profile(
    request: CreatePersonProfileRequest,
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[PersonProfileDTO]:
    """Create a new person profile attached to the authenticated account."""
    user, _ = auth
    profile = await FamilyService.create_profile(session, user.id, request)
    return SuccessResponse(data=profile)


@router.get(
    "/profiles",
    response_model=SuccessResponse[FamilyProfilesResponse],
    summary="List All Family Profiles",
)
async def list_family_profiles(
    auth: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[FamilyProfilesResponse]:
    """List all profiles associated with the user account."""
    user, _ = auth
    profiles = await FamilyService.list_profiles(session, user.id)
    return SuccessResponse(data=profiles)

