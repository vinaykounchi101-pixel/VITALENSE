"""Pytest Configuration and Fixtures for VitalSense."""

from __future__ import annotations

from typing import AsyncGenerator

import pytest_asyncio

from vitalsense_common.database import close_database_connections


@pytest_asyncio.fixture(autouse=True)
async def cleanup_database_connections() -> AsyncGenerator[None, None]:
    """Cleanly dispose of database connections after each test function.

    Prevents connection pool leakage across asyncio event loops on Windows.
    """
    yield
    await close_database_connections()
