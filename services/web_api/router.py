"""Web-Facing API Router Namespace.

Implements ARCH-002 and ARCH-014: Distinct client-facing API boundary for the
Next.js web application.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter
from vitalsense_common.schemas.envelope import SuccessResponse

router = APIRouter(prefix="/api/v1/web", tags=["Web API"])


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
