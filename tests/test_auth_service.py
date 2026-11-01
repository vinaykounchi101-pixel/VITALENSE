"""Authentication and Session Domain Service Unit and Integration Tests.

Implements SEC-001 through SEC-011 and OD-18:
- Password strength validation and Argon2id hashing
- JWT access token generation and claims decoding
- User registration and login
- Failed attempt threshold and brute-force lockout
- Refresh token rotation
- Token reuse detection and immediate family revocation
- Multi-session listing and targeted family revocation
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.config import settings
from vitalsense_common.database import get_engine
from vitalsense_common.models.base import utc_now
from vitalsense_common.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
)
from vitalsense_common.security.hasher import (
    PasswordValidationError,
    hash_password,
    validate_password_strength,
    verify_password,
)
from vitalsense_common.security.tokens import (
    TokenExpiredError,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_refresh_token,
)
from services.auth.service import AuthService


@pytest.mark.unit
def test_password_validation_and_argon2id_hashing() -> None:
    """Validate password complexity enforcement and Argon2id hash/verify."""
    with pytest.raises(PasswordValidationError):
        validate_password_strength("")

    with pytest.raises(PasswordValidationError):
        validate_password_strength("short")

    with pytest.raises(PasswordValidationError):
        validate_password_strength("        ")

    # Valid password
    valid_pwd = "SuperSecretPassword123!"
    validate_password_strength(valid_pwd)

    pwd_hash = hash_password(valid_pwd)
    assert pwd_hash.startswith("$argon2id$")
    assert verify_password(valid_pwd, pwd_hash) is True
    assert verify_password("WrongPassword123!", pwd_hash) is False


@pytest.mark.unit
def test_jwt_token_creation_and_claims_decoding() -> None:
    """Verify HMAC-SHA256 JWT generation, standard claims, and expiration."""
    user_id = uuid.uuid4()
    person_id = uuid.uuid4()

    token = create_access_token(
        user_account_id=user_id,
        person_id=person_id,
        role="user",
    )
    claims = decode_access_token(token)

    assert claims["sub"] == str(user_id)
    assert claims["person_id"] == str(person_id)
    assert claims["role"] == "user"
    assert "exp" in claims
    assert "iat" in claims
    assert "jti" in claims


@pytest.mark.unit
def test_jwt_token_expiration() -> None:
    """Expired access token must raise TokenExpiredError."""
    user_id = uuid.uuid4()
    person_id = uuid.uuid4()

    # Create token expired 1 minute ago
    expired_token = create_access_token(
        user_account_id=user_id,
        person_id=person_id,
        expires_delta=timedelta(minutes=-1),
    )
    with pytest.raises(TokenExpiredError):
        decode_access_token(expired_token)


@pytest.mark.unit
def test_refresh_token_generation_and_hashing() -> None:
    """Cryptographically secure refresh token must produce a 64-char SHA-256 hash."""
    rf = generate_refresh_token()
    assert len(rf) >= 32
    h1 = hash_refresh_token(rf)
    h2 = hash_refresh_token(rf)
    assert len(h1) == 64
    assert h1 == h2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_auth_service_registration_and_login_flow() -> None:
    """Register a new user, log in, and verify token responses and session establishment."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "ComplexPassword2026!"

        # Register
        reg_req = RegisterRequest(
            email=unique_email,
            password=pwd,
            display_name="Test User",
            device_id="device-test-01",
            device_name="Test Phone",
        )
        reg_tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        assert reg_tokens.access_token is not None
        assert reg_tokens.refresh_token is not None
        assert reg_tokens.token_type == "Bearer"

        # Duplicate registration must fail with 409
        with pytest.raises(HTTPException) as exc_info:
            await AuthService.register_user(session, reg_req)
        assert exc_info.value.status_code == 409

        # Login with correct password
        login_req = LoginRequest(
            email=unique_email,
            password=pwd,
            device_id="device-test-01",
        )
        login_tokens = await AuthService.authenticate_user(session, login_req)
        await session.commit()

        assert login_tokens.user_account_id == reg_tokens.user_account_id
        assert login_tokens.person_id == reg_tokens.person_id

        # Login with incorrect password must fail with 401
        bad_login = LoginRequest(
            email=unique_email,
            password="WrongPassword!",
        )
        with pytest.raises(HTTPException) as exc_info:
            await AuthService.authenticate_user(session, bad_login)
        assert exc_info.value.status_code == 401


@pytest.mark.integration
@pytest.mark.asyncio
async def test_auth_service_brute_force_lockout() -> None:
    """Verify account lockout occurs after 5 consecutive failed login attempts."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        unique_email = f"lockout_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "SafePassword123!"

        reg_req = RegisterRequest(email=unique_email, password=pwd)
        await AuthService.register_user(session, reg_req)
        await session.commit()

        bad_req = LoginRequest(email=unique_email, password="BadPassword!")

        # 4 failed attempts
        for _ in range(4):
            with pytest.raises(HTTPException) as exc_info:
                await AuthService.authenticate_user(session, bad_req)
            assert exc_info.value.status_code == 401

        # 5th failed attempt locks the account
        with pytest.raises(HTTPException) as exc_info:
            await AuthService.authenticate_user(session, bad_req)
        assert exc_info.value.status_code == 401

        # 6th attempt is rejected with 423 Locked
        with pytest.raises(HTTPException) as exc_info:
            await AuthService.authenticate_user(session, bad_req)
        assert exc_info.value.status_code == 423
        assert "temporarily locked" in exc_info.value.detail.lower()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_auth_service_refresh_token_rotation_and_reuse_revocation() -> None:
    """Verify refresh token rotation and immediate family revocation upon reuse."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        unique_email = f"reuse_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "SafePassword123!"

        reg_req = RegisterRequest(email=unique_email, password=pwd, device_id="dev-1")
        tokens = await AuthService.register_user(session, reg_req)
        await session.commit()

        initial_refresh = tokens.refresh_token

        # 1. Rotate token
        ref_req = RefreshTokenRequest(refresh_token=initial_refresh, device_id="dev-1")
        rotated_tokens = await AuthService.refresh_session(session, ref_req)
        await session.commit()

        assert rotated_tokens.refresh_token != initial_refresh

        # 2. Token theft detection: reusing the old initial_refresh MUST fail and revoke family
        with pytest.raises(HTTPException) as exc_info:
            await AuthService.refresh_session(session, ref_req)
        assert exc_info.value.status_code == 401
        assert "reuse detected" in exc_info.value.detail.lower()

        # 3. Subsequent use of rotated_tokens must ALSO now be rejected because family was revoked!
        ref_req_rotated = RefreshTokenRequest(refresh_token=rotated_tokens.refresh_token)
        with pytest.raises(HTTPException) as exc_info:
            await AuthService.refresh_session(session, ref_req_rotated)
        assert exc_info.value.status_code == 401


@pytest.mark.integration
@pytest.mark.asyncio
async def test_auth_service_session_listing_and_revocation() -> None:
    """Test listing user session families and targeted session revocation."""
    engine = get_engine()
    async with AsyncSession(engine) as session:
        unique_email = f"sessions_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "SafePassword123!"

        reg_req = RegisterRequest(
            email=unique_email,
            password=pwd,
            device_id="phone-1",
            device_name="Pixel 8",
        )
        tokens1 = await AuthService.register_user(session, reg_req)
        await session.commit()

        # Establish second session on laptop
        login_req = LoginRequest(
            email=unique_email,
            password=pwd,
            device_id="laptop-1",
            device_name="MacBook Pro",
        )
        tokens2 = await AuthService.authenticate_user(session, login_req)
        await session.commit()

        # List sessions
        sessions = await AuthService.list_user_sessions(session, tokens1.user_account_id)
        assert len(sessions) >= 2

        # Revoke one session
        target_family = sessions[0].family_id
        revoked = await AuthService.revoke_session_family(
            session, tokens1.user_account_id, target_family
        )
        await session.commit()
        assert revoked is True

        # Ensure active sessions count decreased
        active_sessions = await AuthService.list_user_sessions(
            session, tokens1.user_account_id
        )
        active_families = {s.family_id for s in active_sessions}
        assert target_family not in active_families

