"""Web API Authentication Endpoints.

Implements ARCH-002, ARCH-014, SEC-001 through SEC-011, and OD-18:
- Cookie-managed authentication for Next.js web application
- HttpOnly, Secure, SameSite=Strict cookie handling
- Session inspection and revocation
"""

from __future__ import annotations

import secrets
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.config import settings
from vitalsense_common.database import get_db_session
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.auth import (
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    RefreshTokenRequest,
    RegisterRequest,
    RevokeSessionRequest,
    SessionItem,
    TokenResponse,
    UserProfileResponse,
    WebAuthResponse,
)
from vitalsense_common.schemas.envelope import SuccessResponse
from services.auth.dependencies import (
    get_current_user_and_person,
    verify_csrf_double_submit,
)
from services.auth.rate_limiter import auth_rate_limiter
from services.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Web Auth"])


def _set_auth_cookies(response: Response, tokens: TokenResponse) -> None:
    """Helper to attach secure HttpOnly cookies and CSRF double-submit cookie for Web client (OD-18)."""
    is_prod = settings.ENVIRONMENT == "production"
    # Access token cookie (15 min) - HttpOnly, SameSite=Strict
    response.set_cookie(
        key="vitalsense_access_token",
        value=tokens.access_token,
        max_age=tokens.expires_in,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        path="/",
    )
    # Refresh token cookie (7 days) - HttpOnly, SameSite=Strict
    response.set_cookie(
        key="vitalsense_refresh_token",
        value=tokens.refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        path="/",
    )
    # CSRF double-submit token - Readable by JavaScript, SameSite=Strict
    csrf_token = secrets.token_hex(32)
    response.set_cookie(
        key="vitalsense_csrf_token",
        value=csrf_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=False,
        secure=is_prod,
        samesite="strict",
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Helper to remove auth and CSRF cookies upon logout."""
    response.delete_cookie(key="vitalsense_access_token", path="/")
    response.delete_cookie(key="vitalsense_refresh_token", path="/")
    response.delete_cookie(key="vitalsense_csrf_token", path="/")


@router.post(
    "/register",
    response_model=SuccessResponse[WebAuthResponse],
    summary="Register Web User Account",
    status_code=status.HTTP_201_CREATED,
)
async def register(
    request: RegisterRequest,
    raw_request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[WebAuthResponse]:
    """Register a new user account via Web client, issuing auth cookies without exposing tokens in JSON body (OD-18)."""
    auth_rate_limiter.check(raw_request, "web_auth_register", max_requests=10, window_seconds=60)
    tokens = await AuthService.register_user(session, request)
    _set_auth_cookies(response, tokens)
    return SuccessResponse(
        data=WebAuthResponse(
            user_account_id=tokens.user_account_id,
            person_id=tokens.person_id,
            token_type="Bearer",
            expires_in=tokens.expires_in,
        )
    )


@router.post(
    "/login",
    response_model=SuccessResponse[WebAuthResponse],
    summary="Login Web User",
)
async def login(
    request: LoginRequest,
    raw_request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[WebAuthResponse]:
    """Authenticate email and password, setting HttpOnly cookies without exposing tokens in JSON body (OD-18)."""
    auth_rate_limiter.check(raw_request, "web_auth_login", max_requests=10, window_seconds=60)
    tokens = await AuthService.authenticate_user(session, request)
    _set_auth_cookies(response, tokens)
    return SuccessResponse(
        data=WebAuthResponse(
            user_account_id=tokens.user_account_id,
            person_id=tokens.person_id,
            token_type="Bearer",
            expires_in=tokens.expires_in,
        )
    )


@router.post(
    "/refresh",
    response_model=SuccessResponse[WebAuthResponse],
    summary="Refresh Web Session",
)
async def refresh(
    raw_request: Request,
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    session: AsyncSession = Depends(get_db_session),
    _csrf: None = Depends(verify_csrf_double_submit),
) -> SuccessResponse[WebAuthResponse]:
    """Rotate refresh token from cookie or body, rotating cookies without exposing tokens in JSON body (OD-18)."""
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
    return SuccessResponse(
        data=WebAuthResponse(
            user_account_id=tokens.user_account_id,
            person_id=tokens.person_id,
            token_type="Bearer",
            expires_in=tokens.expires_in,
        )
    )


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
    _csrf: None = Depends(verify_csrf_double_submit),
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
    _csrf: None = Depends(verify_csrf_double_submit),
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


@router.post(
    "/password-reset/request",
    response_model=SuccessResponse[PasswordResetResponse],
    summary="Request Web Password Reset",
)
async def request_password_reset_endpoint(
    payload: PasswordResetRequest,
    raw_request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[PasswordResetResponse]:
    """Initiate password reset process, issuing a single-use expiring token."""
    auth_rate_limiter.check(raw_request, "web_password_reset", max_requests=5, window_seconds=60)
    token = await AuthService.request_password_reset(session, payload.email)
    return SuccessResponse(
        data=PasswordResetResponse(
            message="If an account exists with this email, a password reset token has been generated.",
            reset_token=token if settings.ENVIRONMENT != "production" else None,
        )
    )


@router.post(
    "/password-reset/confirm",
    response_model=SuccessResponse[str],
    summary="Confirm Web Password Reset",
)
async def confirm_password_reset_endpoint(
    payload: PasswordResetConfirmRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[str]:
    """Reset account password using the token, revoking all active sessions."""
    await AuthService.confirm_password_reset(session, payload.token, payload.new_password)
    return SuccessResponse(data="Password successfully reset. All existing sessions revoked.")


