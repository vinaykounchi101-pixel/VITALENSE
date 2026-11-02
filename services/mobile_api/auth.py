"""Mobile and Native API Authentication Endpoints.

Implements ARCH-002, ARCH-014, SEC-001 through SEC-011, and OD-18:
- Bearer-token authentication for Android, iOS, Windows, and macOS native clients
- Rotating refresh tokens with device registration
- Token family revocation upon detected token reuse
"""

from __future__ import annotations

from typing import List, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
)
from vitalsense_common.schemas.envelope import SuccessResponse
from services.auth.dependencies import get_current_user_and_person
from services.auth.rate_limiter import auth_rate_limiter
from services.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Mobile Auth"])


@router.post(
    "/register",
    response_model=SuccessResponse[TokenResponse],
    summary="Register Mobile User Account",
    status_code=status.HTTP_201_CREATED,
)
async def register(
    request: RegisterRequest,
    raw_request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[TokenResponse]:
    """Register a new user account from a mobile/native client, returning JWT and rotating refresh token."""
    auth_rate_limiter.check(raw_request, "mobile_auth_register", max_requests=10, window_seconds=60)
    tokens = await AuthService.register_user(session, request)
    return SuccessResponse(data=tokens)


@router.post(
    "/login",
    response_model=SuccessResponse[TokenResponse],
    summary="Login Mobile User",
)
async def login(
    request: LoginRequest,
    raw_request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[TokenResponse]:
    """Authenticate mobile user and establish a persistent device session family."""
    auth_rate_limiter.check(raw_request, "mobile_auth_login", max_requests=10, window_seconds=60)
    tokens = await AuthService.authenticate_user(session, request)
    return SuccessResponse(data=tokens)


@router.post(
    "/refresh",
    response_model=SuccessResponse[TokenResponse],
    summary="Refresh Mobile Session",
)
async def refresh(
    request: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[TokenResponse]:
    """Rotate the refresh token for a mobile device. Detects token reuse and revokes compromised families."""
    tokens = await AuthService.refresh_session(session, request)
    return SuccessResponse(data=tokens)


@router.post(
    "/logout",
    response_model=SuccessResponse[str],
    summary="Logout Mobile User",
)
async def logout(
    request: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[str]:
    """Revoke the session family associated with the presented refresh token."""
    await AuthService.logout_session(session, request.refresh_token)
    return SuccessResponse(data="Successfully logged out.")


@router.get(
    "/me",
    response_model=SuccessResponse[UserProfileResponse],
    summary="Get Current User Profile",
)
async def get_me(
    user_person: Tuple[UserAccount, Person] = Depends(get_current_user_and_person),
) -> SuccessResponse[UserProfileResponse]:
    """Retrieve authenticated user and person details."""
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
    """List all registered device sessions for the authenticated user."""
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
    """Revoke a specific session family across all rotated tokens."""
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
    summary="Request Mobile Password Reset",
)
async def request_password_reset_endpoint(
    payload: PasswordResetRequest,
    raw_request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[PasswordResetResponse]:
    """Initiate password reset process, issuing a single-use expiring token."""
    auth_rate_limiter.check(raw_request, "mobile_password_reset", max_requests=5, window_seconds=60)
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
    summary="Confirm Mobile Password Reset",
)
async def confirm_password_reset_endpoint(
    payload: PasswordResetConfirmRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SuccessResponse[str]:
    """Reset account password using the token, revoking all active sessions."""
    await AuthService.confirm_password_reset(session, payload.token, payload.new_password)
    return SuccessResponse(data="Password successfully reset. All existing sessions revoked.")


