"""Authentication Dependencies for FastAPI Endpoints.

Implements SEC-003, SEC-004, and ARCH-004:
- Bearer token extraction for mobile / native / API clients
- Secure HttpOnly cookie fallback for web application
- Unified dependency returning validated UserAccount and Person
"""

from __future__ import annotations

import secrets
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


async def verify_csrf_double_submit(request: Request) -> None:
    """CSRF double-submit cookie verification for state-changing Web requests (OD-18).

    Enforces that whenever state-changing requests (POST, PUT, PATCH, DELETE)
    rely on browser cookie authentication (vitalsense_access_token or vitalsense_refresh_token),
    a matching 'X-CSRF-Token' header must equal the 'vitalsense_csrf_token' cookie.
    Bearer-authenticated requests bypass this check as standard API clients.
    """
    if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
        return

    # If Authorization header with Bearer token is provided, bypass CSRF
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return

    # Check if request is authenticated using browser cookies
    has_auth_cookie = (
        "vitalsense_access_token" in request.cookies
        or "vitalsense_refresh_token" in request.cookies
    )
    if not has_auth_cookie:
        return

    csrf_cookie = request.cookies.get("vitalsense_csrf_token")
    csrf_header = request.headers.get("X-CSRF-Token") or request.headers.get("x-csrf-token")

    if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF verification failed: Missing or invalid CSRF token.",
        )


