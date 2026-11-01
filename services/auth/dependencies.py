"""Authentication Dependencies for FastAPI Endpoints.

Implements SEC-003, SEC-004, and ARCH-004:
- Bearer token extraction for mobile / native / API clients
- Secure HttpOnly cookie fallback for web application
- Unified dependency returning validated UserAccount and Person
"""

from __future__ import annotations

from typing import Tuple

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from services.auth.service import AuthService


async def get_current_user_and_person(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Tuple[UserAccount, Person]:
    """FastAPI dependency to extract and validate the authenticated user and person.

    Checks Authorization: Bearer <token> first, then falls back to 'vitalsense_access_token' cookie.
    """
    token: str | None = None
    auth_header = request.headers.get("Authorization")

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    elif "vitalsense_access_token" in request.cookies:
        token = request.cookies.get("vitalsense_access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a valid Bearer token or session cookie.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await AuthService.get_user_and_person_from_token(session, token)

