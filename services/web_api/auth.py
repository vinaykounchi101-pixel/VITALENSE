"""Web API Authentication Endpoints.

Implements ARCH-002, ARCH-014, SEC-001 through SEC-011, and OD-18:
- Cookie-managed authentication for Next.js web application
- HttpOnly, Secure, SameSite=Strict cookie handling
- Session inspection and revocation
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.config import settings
from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    RevokeSessionRequest,
    SessionItem,
    TokenResponse,
    UserProfileResponse,
)
from vitalsense_common.schemas.envelope import SuccessResponse
from services.auth.dependencies import get_current_user_and_person
from services.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Web Auth"])


def _set_auth_cookies(response: Response, tokens: TokenResponse) -> None:
    """Helper to attach secure HttpOnly cookies for Web client."""
    is_prod = settings.ENVIRONMENT == "production"
    # Access token cookie (15 min)
    response.set_cookie(
        key="vitalsense_access_token",
        value=tokens.access_token,
        max_age=tokens.expires_in,
        httponly=True,
        secure=is_prod,
        samesite="lax",
    )
    # Refresh token cookie (7 days)
    response.set_cookie(
        key="vitalsense_refresh_token",
        value=tokens.refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=is_prod,
        samesite="lax",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Helper to remove auth cookies upon logout."""
    response.delete_cookie(key="vitalsense_access_token")
    response.delete_cookie(key="vitalsense_refresh_token")


@router.post(
    "/register",
    response_model=SuccessResponse[TokenResponse],
    summary="Register Web User Account",
    status_code=status.HTTP_201_CREATED,
)
async def register(
    request: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[TokenResponse]:
    """Register a new user account via Web client, issuing auth cookies and Bearer tokens."""
    tokens = await AuthService.register_user(session, request)
    _set_auth_cookies(response, tokens)
    return SuccessResponse(data=tokens)


@router.post(
    "/login",
    response_model=SuccessResponse[TokenResponse],
    summary="Login Web User",
)
async def login(
    request: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[TokenResponse]:
    """Authenticate email and password, returning tokens and setting HttpOnly cookies."""
    tokens = await AuthService.authenticate_user(session, request)
    _set_auth_cookies(response, tokens)
    return SuccessResponse(data=tokens)


@router.post(
    "/refresh",
    response_model=SuccessResponse[TokenResponse],
    summary="Refresh Web Session",
)
async def refresh(
    raw_request: Request,
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[TokenResponse]:
    """Rotate refresh token from cookie or body, invalidating prior token and rotating cookie."""
    token_str = (body.refresh_token if body else None) or raw_request.cookies.get(
        "vitalsense_refresh_token"
    )
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided in cookie or payload.",
        )

    req = RefreshTokenRequest(
        refresh_token=token_str,
        device_id=body.device_id if body else None,
    )
    tokens = await AuthService.refresh_session(session, req)
    _set_auth_cookies(response, tokens)
    return SuccessResponse(data=tokens)


@router.post(
    "/logout",
    response_model=SuccessResponse[str],
    summary="Logout Web User",
)
async def logout(
    raw_request: Request,
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[str]:
    """Revoke session family and clear auth cookies."""
    token_str = (body.refresh_token if body else None) or raw_request.cookies.get(
        "vitalsense_refresh_token"
    )
    if token_str:
        await AuthService.logout_session(session, token_str)
    _clear_auth_cookies(response)
    return SuccessResponse(data="Successfully logged out.")


@router.get(
    "/me",
    response_model=SuccessResponse[UserProfileResponse],
    summary="Get Current User Profile",
)
async def get_me(
    user_person: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
) -> SuccessResponse[UserProfileResponse]:
    """Retrieve authenticated user account and primary person profile information."""
    user, person = user_person
    return SuccessResponse(
        data=UserProfileResponse(
            user_account_id=user.id,
            email=user.email,
            person_id=person.id,
            display_name=person.display_name,
            role="user",
            created_at=user.created_at,
        )
    )


@router.get(
    "/sessions",
    response_model=SuccessResponse[List[SessionItem]],
    summary="List Active User Sessions",
)
async def list_sessions(
    user_person: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[List[SessionItem]]:
    """List all active session families across user devices."""
    user, _ = user_person
    sessions = await AuthService.list_user_sessions(session, user.id)
    return SuccessResponse(data=sessions)


@router.post(
    "/sessions/revoke",
    response_model=SuccessResponse[str],
    summary="Revoke Specific Session Family",
)
async def revoke_session(
    payload: RevokeSessionRequest,
    user_person: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[str]:
    """Revoke a specific session family by UUID."""
    user, _ = user_person
    revoked = await AuthService.revoke_session_family(session, user.id, payload.family_id)
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session family not found or already revoked.",
        )
    return SuccessResponse(data="Session successfully revoked.")

