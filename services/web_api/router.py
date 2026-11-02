"""Web-Facing API Router Namespace.

Implements ARCH-002 and ARCH-014: Distinct client-facing API boundary for the
Next.js web application.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter

from vitalsense_common.schemas.envelope import SuccessResponse
from services.web_api.analytics import router as analytics_router
from services.web_api.auth import router as auth_router
from services.web_api.family import router as family_router
from services.web_api.fitness import router as fitness_router
from services.web_api.integrations import router as integrations_router
from services.web_api.intelligence import router as intelligence_router
from services.web_api.medical import router as medical_router
from services.web_api.privacy import router as privacy_router
from services.web_api.sync import router as sync_router

router = APIRouter(prefix="/api/v1/web", tags=["Web API"])

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
    summary="Web API Namespace Status",
)
async def get_web_api_status() -> SuccessResponse[Dict[str, Any]]:
    """Verify web-facing client boundary is operational."""
    return SuccessResponse(
        data={
            "client": "web",
            "version": "v1",
            "status": "operational",
        }
    )
