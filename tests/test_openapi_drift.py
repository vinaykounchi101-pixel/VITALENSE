"""OpenAPI Schema Drift Test.

Implements IF-API-001 and REPO-006:
Verifies that packages/api-contracts/openapi/v1.json matches the live app.openapi()
contract with zero drift.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from services.api.main import app


@pytest.mark.asyncio
async def test_openapi_contract_matches_live_app_schema() -> None:
    """Ensure repository OpenAPI contract file exactly matches the live FastAPI schema."""
    contract_file = (
        Path(__file__).resolve().parent.parent
        / "packages"
        / "api-contracts"
        / "openapi"
        / "v1.json"
    )
    assert contract_file.exists(), f"OpenAPI contract file missing: {contract_file}"

    with open(contract_file, "r", encoding="utf-8") as f:
        stored_schema = json.load(f)

    live_schema = app.openapi()

    # Compare key by key
    assert stored_schema["openapi"] == live_schema["openapi"]
    assert stored_schema["info"] == live_schema["info"]
    assert set(stored_schema["paths"].keys()) == set(live_schema["paths"].keys())

    # Deep JSON equality
    assert stored_schema == live_schema, (
        "OpenAPI drift detected! Run 'python services/export_openapi.py' to update packages/api-contracts/openapi/v1.json."
    )
