"""VitalSense Authentication and Session Domain Service.

Implements SEC-001 through SEC-011, OD-18, and FR-AUTH-001 through FR-AUTH-008:
- Self-hosted Argon2id credential verification
- Brute force protection with failed-attempt threshold and temporary lockouts
- Rotating refresh tokens with token family lineage
- Automatic theft reuse detection that revokes entire token families
- Cross-device session inspection and targeted revocation
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.config import settings
from vitalsense_common.logging import logger
from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.models.audit import AuditEvent
from vitalsense_common.models.auth import (
    AuthCredential,
    AuthPasswordResetToken,
    AuthRefreshToken,
)
from vitalsense_common.models.base import utc_now
from vitalsense_common.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    SessionItem,
    TokenResponse,
    UserProfileResponse,
)
from vitalsense_common.security.hasher import (
    PasswordValidationError,
    hash_password,
    validate_password_strength,
    verify_password,
)
from vitalsense_common.security.tokens import (
    TokenExpiredError,
    TokenInvalidError,
    create_access_token,
    create_password_reset_token,
    decode_access_token,
    decode_password_reset_token,
    generate_refresh_token,
    hash_refresh_token,
)


class AuthService:
    """Domain service managing user registration, authentication, and session lifecycles."""

    @staticmethod
    async def register_user(
        session: AsyncSession, request: RegisterRequest
    ) -> TokenResponse:
        """Register a new user account, associated primary person, and initial session."""
        # 1. Check if email already registered
        query = select(UserAccount).where(UserAccount.email == request.email.lower().strip())
        res = await session.execute(query)
        existing = res.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists.",
            )

        # 2. Validate password strength and compute Argon2id hash
        try:
            pwd_hash = hash_password(request.password)
        except PasswordValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e),
            ) from e

        # 3. Create UserAccount
        user_account = UserAccount(
            email=request.email.lower().strip(),
            status="active",
        )
        session.add(user_account)
        await session.flush()

        # 4. Create primary Person profile
        person = Person(
            user_account_id=user_account.id,
            display_name=request.display_name or request.email.split("@")[0],
            relationship_type="self",
        )
        session.add(person)
        await session.flush()

        # 5. Create AuthCredential
        credential = AuthCredential(
            user_account_id=user_account.id,
            password_hash=pwd_hash,
            failed_login_attempts=0,
            locked_until=None,
        )
        session.add(credential)

        # 6. Establish initial session family and rotating refresh token
        family_id = uuid.uuid4()
        raw_refresh = generate_refresh_token()
        refresh_hash = hash_refresh_token(raw_refresh)
        expires_at = utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        refresh_record = AuthRefreshToken(
            user_account_id=user_account.id,
            token_hash=refresh_hash,
            family_id=family_id,
            device_id=request.device_id,
            device_name=request.device_name,
            is_revoked=False,
            is_consumed=False,
            expires_at=expires_at,
            created_at=utc_now(),
        )
        session.add(refresh_record)

        # 7. Record registration audit event
        audit = AuditEvent(
            actor_id=user_account.id,
            actor_type="user",
            action="auth.registered",
            target_type="user_account",
            target_id=str(user_account.id),
            result="success",
            metadata_={"email": user_account.email},
        )
        session.add(audit)
        await session.flush()

        # 8. Issue JWT access token
        access_token = create_access_token(
            user_account_id=user_account.id,
            person_id=person.id,
            role="user",
        )

        logger.info(
            "User registered successfully",
            extra={"user_account_id": str(user_account.id), "person_id": str(person.id)},
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=raw_refresh,
            token_type="Bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_account_id=user_account.id,
            person_id=person.id,
        )

    @staticmethod
    async def authenticate_user(
        session: AsyncSession, request: LoginRequest
    ) -> TokenResponse:
        """Authenticate user credentials, enforce lockout protection, and issue session tokens."""
        # 1. Lookup user account
        query = select(UserAccount).where(UserAccount.email == request.email.lower().strip())
        res = await session.execute(query)
        user_account = res.scalar_one_or_none()
        if not user_account:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if user_account.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is suspended or deactivated.",
            )

        # 2. Lookup credential
        cred_query = select(AuthCredential).where(
            AuthCredential.user_account_id == user_account.id
        )
        cred_res = await session.execute(cred_query)
        credential = cred_res.scalar_one_or_none()
        if not credential:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        now = utc_now()

        # 3. Check temporary lockout (Brute-force protection)
        if credential.locked_until and credential.locked_until > now:
            minutes_left = int((credential.locked_until - now).total_seconds() / 60) + 1
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account is temporarily locked. Please try again in {minutes_left} minutes.",
            )

        # 4. Verify password
        if not verify_password(request.password, credential.password_hash):
            credential.failed_login_attempts += 1
            if credential.failed_login_attempts >= 5:
                # Lockout for 15 minutes
                credential.locked_until = now + timedelta(minutes=15)
                logger.warning(
                    "Account locked due to 5 failed login attempts",
                    extra={"user_account_id": str(user_account.id)},
                )
            audit = AuditEvent(
                actor_id=user_account.id,
                actor_type="unauthenticated",
                action="auth.login_failed",
                target_type="user_account",
                target_id=str(user_account.id),
                result="failure",
                metadata_={"failed_attempts": credential.failed_login_attempts},
            )
            session.add(audit)
            await session.flush()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        # 5. Reset lockout counters on success
        credential.failed_login_attempts = 0
        credential.locked_until = None

        # 6. Lookup primary person profile
        person_query = select(Person).where(
            Person.user_account_id == user_account.id,
            Person.relationship_type == "self",
        )
        person_res = await session.execute(person_query)
        person = person_res.scalar_one_or_none()
        if not person:
            # Fallback to any person under the account
            fallback_query = select(Person).where(Person.user_account_id == user_account.id)
            fb_res = await session.execute(fallback_query)
            person = fb_res.scalar_one_or_none()
            if not person:
                # Create profile if missing
                person = Person(
                    user_account_id=user_account.id,
                    display_name=user_account.email.split("@")[0],
                    relationship_type="self",
                )
                session.add(person)
                await session.flush()

        # 7. Issue new rotating refresh token session family
        family_id = uuid.uuid4()
        raw_refresh = generate_refresh_token()
        refresh_hash = hash_refresh_token(raw_refresh)
        expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        refresh_record = AuthRefreshToken(
            user_account_id=user_account.id,
            token_hash=refresh_hash,
            family_id=family_id,
            device_id=request.device_id,
            device_name=request.device_name,
            is_revoked=False,
            is_consumed=False,
            expires_at=expires_at,
            created_at=now,
        )
        session.add(refresh_record)

        # 8. Record audit log
        audit = AuditEvent(
            actor_id=user_account.id,
            actor_type="user",
            action="auth.login_success",
            target_type="user_account",
            target_id=str(user_account.id),
            result="success",
            metadata_={"device_name": request.device_name},
        )
        session.add(audit)
        await session.flush()

        # 9. Issue JWT access token
        access_token = create_access_token(
            user_account_id=user_account.id,
            person_id=person.id,
            role="user",
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=raw_refresh,
            token_type="Bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_account_id=user_account.id,
            person_id=person.id,
        )

    @staticmethod
    async def refresh_session(
        session: AsyncSession, request: RefreshTokenRequest
    ) -> TokenResponse:
        """Rotate an active refresh token. Detects token reuse and immediately revokes the family."""
        token_hash = hash_refresh_token(request.refresh_token)
        query = (
            select(AuthRefreshToken)
            .where(AuthRefreshToken.token_hash == token_hash)
            .with_for_update()
        )
        res = await session.execute(query)
        token_record = res.scalar_one_or_none()

        if not token_record or token_record.is_revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked refresh token.",
            )

        now = utc_now()

        # THEFT REUSE DETECTION (OD-18)
        # If the token was already consumed, a replay attack or compromised token is detected!
        if token_record.is_consumed:
            logger.error(
                "CRITICAL: Refresh token reuse detected! Revoking token family.",
                extra={
                    "family_id": str(token_record.family_id),
                    "user_account_id": str(token_record.user_account_id),
                },
            )
            # Invalidate all tokens in this family immediately
            revoke_stmt = (
                update(AuthRefreshToken)
                .where(AuthRefreshToken.family_id == token_record.family_id)
                .values(is_revoked=True)
            )
            await session.execute(revoke_stmt)

            audit = AuditEvent(
                actor_id=token_record.user_account_id,
                actor_type="system",
                action="auth.token_theft_detected",
                target_type="auth_refresh_tokens",
                target_id=str(token_record.family_id),
                result="blocked",
                metadata_={"family_id": str(token_record.family_id)},
            )
            session.add(audit)
            await session.flush()

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Security violation: Refresh token reuse detected. Session has been revoked.",
            )

        # Check expiration
        if token_record.expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired. Please log in again.",
            )

        # Mark presented token as consumed
        token_record.is_consumed = True

        # Issue newly rotated refresh token in the same session family
        new_raw_refresh = generate_refresh_token()
        new_token_hash = hash_refresh_token(new_raw_refresh)
        new_expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        new_refresh_record = AuthRefreshToken(
            user_account_id=token_record.user_account_id,
            token_hash=new_token_hash,
            family_id=token_record.family_id,
            device_id=request.device_id or token_record.device_id,
            device_name=token_record.device_name,
            is_revoked=False,
            is_consumed=False,
            expires_at=new_expires_at,
            created_at=now,
        )
        session.add(new_refresh_record)

        # Lookup person profile
        person_query = select(Person).where(
            Person.user_account_id == token_record.user_account_id,
            Person.relationship_type == "self",
        )
        p_res = await session.execute(person_query)
        person = p_res.scalar_one_or_none()
        if not person:
            person_query = select(Person).where(
                Person.user_account_id == token_record.user_account_id
            )
            p_res2 = await session.execute(person_query)
            person = p_res2.scalar_one_or_none()
            if not person:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User person profile not found.",
                )

        await session.flush()

        access_token = create_access_token(
            user_account_id=token_record.user_account_id,
            person_id=person.id,
            role="user",
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_raw_refresh,
            token_type="Bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_account_id=token_record.user_account_id,
            person_id=person.id,
        )

    @staticmethod
    async def logout_session(
        session: AsyncSession, refresh_token: str
    ) -> None:
        """Revoke the session family matching the provided refresh token."""
        token_hash = hash_refresh_token(refresh_token)
        query = select(AuthRefreshToken).where(AuthRefreshToken.token_hash == token_hash)
        res = await session.execute(query)
        token_record = res.scalar_one_or_none()
        if token_record:
            revoke_stmt = (
                update(AuthRefreshToken)
                .where(AuthRefreshToken.family_id == token_record.family_id)
                .values(is_revoked=True)
            )
            await session.execute(revoke_stmt)
            await session.flush()

    @staticmethod
    async def list_user_sessions(
        session: AsyncSession, user_account_id: uuid.UUID
    ) -> List[SessionItem]:
        """List distinct active session families for the specified user."""
        query = (
            select(AuthRefreshToken)
            .where(
                AuthRefreshToken.user_account_id == user_account_id,
                AuthRefreshToken.is_revoked.is_(False),
                AuthRefreshToken.is_consumed.is_(False),
            )
            .order_by(AuthRefreshToken.created_at.desc())
        )
        res = await session.execute(query)
        results = res.scalars().all()

        sessions: List[SessionItem] = []
        seen_families = set()

        for rec in results:
            if rec.family_id in seen_families:
                continue
            seen_families.add(rec.family_id)
            sessions.append(
                SessionItem(
                    family_id=rec.family_id,
                    device_id=rec.device_id,
                    device_name=rec.device_name,
                    created_at=rec.created_at,
                    expires_at=rec.expires_at,
                    is_active=rec.expires_at > utc_now(),
                )
            )
        return sessions

    @staticmethod
    async def revoke_session_family(
        session: AsyncSession, user_account_id: uuid.UUID, family_id: uuid.UUID
    ) -> bool:
        """Revoke all tokens in a session family owned by the specified user."""
        stmt = (
            update(AuthRefreshToken)
            .where(
                AuthRefreshToken.user_account_id == user_account_id,
                AuthRefreshToken.family_id == family_id,
            )
            .values(is_revoked=True)
        )
        res = await session.execute(stmt)
        await session.flush()
        return res.rowcount > 0

    @staticmethod
    async def get_user_and_person_from_token(
        session: AsyncSession, token: str
    ) -> Tuple[UserAccount, Person]:
        """Verify JWT access token and return validated UserAccount and Person entities."""
        try:
            payload = decode_access_token(token)
        except (TokenExpiredError, TokenInvalidError) as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            ) from e

        user_id = uuid.UUID(payload["sub"])
        person_id = uuid.UUID(payload["person_id"])

        user_query = select(UserAccount).where(UserAccount.id == user_id)
        u_res = await session.execute(user_query)
        user_account = u_res.scalar_one_or_none()
        if not user_account or user_account.status != "active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive or not found.",
            )

        person_query = select(Person).where(Person.id == person_id)
        p_res = await session.execute(person_query)
        person = p_res.scalar_one_or_none()
        if not person:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Associated person profile not found.",
            )

        return user_account, person

    @staticmethod
    async def request_password_reset(
        session: AsyncSession, email: str
    ) -> Optional[str]:
        """Initiate password reset foundation (SEC-007, SEC-008).

        Returns an expiring single-use reset token if user exists.
        Always logs security audit event.
        """
        query = select(UserAccount).where(UserAccount.email == email.lower().strip())
        res = await session.execute(query)
        user_account = res.scalar_one_or_none()

        if not user_account or user_account.status != "active":
            logger.info(
                "Password reset requested for non-existent or inactive email",
                extra={"email": email},
            )
            return None

        reset_token = create_password_reset_token(user_account.id, expires_minutes=15)
        token_hash = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()
        expires_at = utc_now() + timedelta(minutes=15)

        reset_record = AuthPasswordResetToken(
            user_account_id=user_account.id,
            token_hash=token_hash,
            expires_at=expires_at,
            is_consumed=False,
            is_revoked=False,
            created_at=utc_now(),
        )
        session.add(reset_record)

        audit = AuditEvent(
            actor_id=user_account.id,
            actor_type="user",
            action="auth.password_reset_requested",
            target_type="user_account",
            target_id=str(user_account.id),
            result="success",
            metadata_={"email": user_account.email},
        )
        session.add(audit)
        await session.flush()

        logger.info(
            "Password reset token generated and recorded",
            extra={"user_account_id": str(user_account.id)},
        )
        return reset_token

    @staticmethod
    async def confirm_password_reset(
        session: AsyncSession, token: str, new_password: str
    ) -> None:
        """Confirm password reset with atomic single-use consumption and session invalidation (SEC-007)."""
        try:
            payload = decode_password_reset_token(token)
        except (TokenExpiredError, TokenInvalidError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e

        user_id = uuid.UUID(payload["sub"])
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

        # Atomically query the reset token record with row-level locking (prevents concurrent replay)
        token_query = (
            select(AuthPasswordResetToken)
            .where(AuthPasswordResetToken.token_hash == token_hash)
            .with_for_update()
        )
        t_res = await session.execute(token_query)
        token_record = t_res.scalar_one_or_none()

        now = utc_now()

        if not token_record or token_record.user_account_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid password reset token.",
            )

        if token_record.is_consumed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token has already been consumed.",
            )

        if token_record.is_revoked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token has been revoked.",
            )

        if token_record.expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token has expired.",
            )

        try:
            validate_password_strength(new_password)
            new_hash = hash_password(new_password)
        except PasswordValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e),
            ) from e

        cred_query = select(AuthCredential).where(AuthCredential.user_account_id == user_id)
        res = await session.execute(cred_query)
        credential = res.scalar_one_or_none()
        if not credential:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User credentials not found.",
            )

        credential.password_hash = new_hash
        credential.failed_login_attempts = 0
        credential.locked_until = None

        # Mark token consumed
        token_record.is_consumed = True
        token_record.consumed_at = now

        # Invalidate all other active reset tokens for this user
        revoke_resets_stmt = (
            update(AuthPasswordResetToken)
            .where(
                AuthPasswordResetToken.user_account_id == user_id,
                AuthPasswordResetToken.id != token_record.id,
            )
            .values(is_revoked=True)
        )
        await session.execute(revoke_resets_stmt)

        # Revoke all active sessions and refresh tokens for this user
        revoke_stmt = (
            update(AuthRefreshToken)
            .where(AuthRefreshToken.user_account_id == user_id)
            .values(is_revoked=True)
        )
        await session.execute(revoke_stmt)

        audit = AuditEvent(
            actor_id=user_id,
            actor_type="user",
            action="auth.password_reset_completed",
            target_type="user_account",
            target_id=str(user_id),
            result="success",
            metadata_={"action": "password_reset_single_use_consumed"},
        )
        session.add(audit)
        await session.flush()

        logger.info(
            "Password reset completed, token consumed, and all sessions revoked",
            extra={"user_account_id": str(user_id)},
        )

