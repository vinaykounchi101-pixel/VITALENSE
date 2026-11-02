"""Mobile-Facing API Router Namespace.

Implements ARCH-002 and ARCH-014: Distinct client-facing API boundary for the
React Native / Expo mobile application and native desktop clients, designed for batch sync reconciliation.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter

from vitalsense_common.schemas.envelope import SuccessResponse
from services.mobile_api.auth import router as auth_router
from services.mobile_api.sync import router as sync_router
from services.web_api.analytics import router as analytics_router
from services.web_api.family import router as family_router
from services.web_api.fitness import router as fitness_router
from services.web_api.integrations import router as integrations_router
from services.web_api.intelligence import router as intelligence_router
from services.web_api.medical import router as medical_router
from services.web_api.privacy import router as privacy_router

router = APIRouter(prefix="/api/v1/mobile", tags=["Mobile API"])

# Mount sub-routers
router.include_router(auth_router)
router.include_router(sync_router)
router.include_router(analytics_router)
router.include_router(intelligence_router)
router.include_router(integrations_router)
router.include_router(medical_router)
router.include_router(fitness_router)
router.include_router(family_router)
router.include_router(privacy_router)


@router.get(
    "/status",
    response_model=SuccessResponse[Dict[str, Any]],
    summary="Mobile API Namespace Status",
)
async def get_mobile_api_status() -> SuccessResponse[Dict[str, Any]]:
    """Verify mobile-facing client boundary is operational."""
    return SuccessResponse(
        data={
            "client": "mobile",
            "version": "v1",
            "status": "operational",
        }
    )
