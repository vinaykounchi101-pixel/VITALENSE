"""FastAPI Endpoint, Liveness/Readiness, and Error Envelope Tests.

Implements ARCH-002, ARCH-012, IF-API-003, IF-API-012, DEP-009, and DEP-010.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from services.api.main import app

client = TestClient(app)


def test_liveness_probe_returns_200() -> None:
    """Liveness probe /health must return 200 without checking external dependencies (DEP-009)."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "vitalsense-api"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data
    assert "X-Correlation-ID" in response.headers


def test_readiness_probe_when_database_healthy() -> None:
    """Readiness probe /ready returns 200 when database connectivity check succeeds (DEP-010)."""
    with patch(
        "services.api.main.check_database_health", new_callable=AsyncMock
    ) as mock_db:
        mock_db.return_value = True
        response = client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["database"] == "connected"
        assert "timestamp" in data


def test_readiness_probe_when_database_unreachable() -> None:
    """Readiness probe /ready returns 503 without leaking credentials if database is down."""
    with patch(
        "services.api.main.check_database_health", new_callable=AsyncMock
    ) as mock_db:
        mock_db.return_value = False
        response = client.get("/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] == "disconnected"
        assert "timestamp" in data
        # Verify no database host, user, or credentials leaked
        assert "password" not in str(data).lower()
        assert "postgresql" not in str(data).lower()


def test_web_api_router_status() -> None:
    """Verify web client API namespace router at /api/v1/web (ARCH-012)."""
    response = client.get("/api/v1/web/status")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert data["data"]["client"] == "web"
    assert data["data"]["version"] == "v1"
    assert data["data"]["status"] == "operational"


def test_mobile_api_router_status() -> None:
    """Verify mobile client API namespace router at /api/v1/mobile (ARCH-012)."""
    response = client.get("/api/v1/mobile/status")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert data["data"]["client"] == "mobile"
    assert data["data"]["version"] == "v1"
    assert data["data"]["status"] == "operational"


def test_correlation_id_passthrough() -> None:
    """X-Correlation-ID provided by caller must be preserved in response (NFR-OBS-001)."""
    custom_cid = "test-custom-cid-12345"
    response = client.get("/health", headers={"X-Correlation-ID": custom_cid})
    assert response.status_code == 200
    assert response.headers.get("X-Correlation-ID") == custom_cid


def test_correlation_id_generated_when_omitted() -> None:
    """X-Correlation-ID must be generated as valid UUID4 if omitted."""
    response = client.get("/health")
    assert response.status_code == 200
    cid = response.headers.get("X-Correlation-ID")
    assert cid is not None
    parsed_uuid = uuid.UUID(cid)
    assert parsed_uuid.version == 4


def test_404_standardized_error_envelope() -> None:
    """Non-existent endpoints must return standardized ErrorResponse envelope (IF-API-003)."""
    response = client.get("/api/v1/non_existent_route")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    error = data["error"]
    assert error["code"] == "NOT_FOUND"
    assert "correlation_id" in error
    assert error["message"] == "Not Found"


def test_error_envelope_structure_conformance() -> None:
    """Standardized error envelope must contain required IF-API-003 fields."""
    response = client.get("/does_not_exist")
    assert response.status_code == 404
    error = response.json()["error"]
    assert isinstance(error["code"], str)
    assert isinstance(error["message"], str)
    assert isinstance(error["correlation_id"], str)
    assert error["code"] == "NOT_FOUND"
