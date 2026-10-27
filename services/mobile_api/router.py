"""Mobile-Facing API Router Namespace.

Implements ARCH-002 and ARCH-014: Distinct client-facing API boundary for the
React Native / Expo mobile application, designed for batch sync reconciliation.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter
from vitalsense_common.schemas.envelope import SuccessResponse

router = APIRouter(prefix="/api/v1/mobile", tags=["Mobile API"])


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
