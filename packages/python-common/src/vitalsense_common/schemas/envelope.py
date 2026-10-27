"""Standardized API Response Envelopes and Error Schemas.

Implements IF-API-003 and IF-API-012: Stable machine-readable error codes,
safe error messages, field-level validation details, and correlation IDs.
Adheres to IF-API-007: Never leaks stack traces or secrets to clients.
"""

from __future__ import annotations

from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Specific field or validation issue detail."""

    model_config = ConfigDict(extra="forbid")

    field: Optional[str] = Field(
        default=None,
        description="Path or name of the field causing the validation failure.",
    )
    issue: str = Field(
        ...,
        description="Safe, human-readable description of the constraint failure.",
    )


class ErrorBody(BaseModel):
    """Machine-readable and human-readable error payload."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(
        ...,
        description="Stable machine-readable error code (e.g. VALIDATION_ERROR, NOT_FOUND).",
        examples=["VALIDATION_ERROR", "UNAUTHORIZED", "NOT_FOUND", "INTERNAL_SERVER_ERROR"],
    )
    message: str = Field(
        ...,
        description="Safe user-facing explanation of the failure.",
    )
    details: Optional[List[ErrorDetail]] = Field(
        default=None,
        description="Field-specific validation error details when applicable.",
    )
    correlation_id: Optional[str] = Field(
        default=None,
        description="Correlation ID for tracing the request across logs and diagnostics.",
    )


class ErrorResponse(BaseModel):
    """Top-level error response envelope required for all non-2xx responses."""

    model_config = ConfigDict(extra="forbid")

    error: ErrorBody


class SuccessResponse(BaseModel, Generic[T]):
    """Standard success wrapper envelope for single entities or data payloads."""

    data: T
    metadata: Optional[dict[str, Any]] = None
