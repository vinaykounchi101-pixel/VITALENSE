"""Health and Readiness Endpoint Schemas.

Implements DEP-009 and DEP-010: Safe readiness and liveness signals that
reveal no secrets, private health data, or sensitive infrastructure topology.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LivenessResponse(BaseModel):
    """Payload for the lightweight /health liveness probe."""

    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="ok", examples=["ok"])
    service: str = Field(default="vitalsense-api", examples=["vitalsense-api"])
    version: str = Field(default="0.1.0", examples=["0.1.0"])
    timestamp: datetime = Field(..., description="UTC timestamp of the probe response.")


class ReadinessResponse(BaseModel):
    """Payload for the /ready readiness probe evaluating dependency availability."""

    model_config = ConfigDict(extra="forbid")

    status: str = Field(..., description="Overall readiness: 'ready' or 'degraded'.")
    database: str = Field(..., description="PostgreSQL status: 'connected' or 'disconnected'.")
    timestamp: datetime = Field(..., description="UTC timestamp of the probe response.")
