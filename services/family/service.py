"""Family and Multi-Person Profile Domain Service."""

from __future__ import annotations

import uuid
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.schemas.family import (
    CreatePersonProfileRequest,
    FamilyProfilesResponse,
    PersonProfileDTO,
)


class FamilyService:
    """Service for managing family members and dependent profiles under an account."""

    @classmethod
    async def create_profile(
        cls,
        session: AsyncSession,
        user_account_id: uuid.UUID,
        request: CreatePersonProfileRequest,
    ) -> PersonProfileDTO:
        """Add a family member or dependent person profile."""
        person = Person(
            user_account_id=user_account_id,
            display_name=request.display_name,
            relationship_type=request.relationship_type,
        )
        session.add(person)
        await session.flush()

        return PersonProfileDTO(
            id=person.id,
            user_account_id=person.user_account_id,
            display_name=person.display_name,
            relationship_type=person.relationship_type,
            is_primary=person.relationship_type == "self",
            created_at=person.created_at,
        )

    @classmethod
    async def list_profiles(
        cls,
        session: AsyncSession,
        user_account_id: uuid.UUID,
    ) -> FamilyProfilesResponse:
        """List all person profiles associated with an account."""
        query = select(Person).where(Person.user_account_id == user_account_id)
        res = await session.execute(query)
        persons = res.scalars().all()

        profiles = [
            PersonProfileDTO(
                id=p.id,
                user_account_id=p.user_account_id,
                display_name=p.display_name,
                relationship_type=p.relationship_type,
                is_primary=p.relationship_type == "self",
                created_at=p.created_at,
            )
            for p in persons
        ]
        return FamilyProfilesResponse(profiles=profiles)

    @classmethod
    async def verify_person_access(
        cls,
        session: AsyncSession,
        user_account_id: uuid.UUID,
        person_id: uuid.UUID,
    ) -> Person:
        """Verify that a person_id belongs to the authenticated user account."""
        query = select(Person).where(
            Person.id == person_id,
            Person.user_account_id == user_account_id,
        )
        res = await session.execute(query)
        person = res.scalar_one_or_none()
        if not person:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Person profile does not belong to your account.",
            )
        return person

