"""VitalSense Modular Monolith FastAPI Application Entrypoint.

Implements ARCH-002, ARCH-012, and ARCH-014:
- Co-deployed FastAPI modular monolith
- Distinct Web and Mobile client router namespaces
- Structured logging with correlation ID tracing (NFR-OBS-001)
- Standardized API error envelopes (IF-API-003, IF-API-012)
- Safe health & readiness probes (DEP-009, DEP-010)
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from vitalsense_common.config import settings
from vitalsense_common.database import (
    check_database_health,
    close_database_connections,
)
from vitalsense_common.logging import (
    get_correlation_id,
    logger,
    set_correlation_id,
    setup_logging,
)
from vitalsense_common.schemas.envelope import (
    ErrorBody,
    ErrorDetail,
    ErrorResponse,
)
from vitalsense_common.schemas.health import (
    LivenessResponse,
    ReadinessResponse,
)
from services.mobile_api.router import router as mobile_router
from services.web_api.router import router as web_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and graceful shutdown lifecycle manager."""
    setup_logging(
        level=settings.LOG_LEVEL,
        structured=settings.ENABLE_STRUCTURED_LOGGING,
    )
    logger.info(
        "VitalSense API starting up",
        extra={"environment": settings.ENVIRONMENT, "debug": settings.DEBUG},
    )
    yield
    logger.info("VitalSense API shutting down, draining connections...")
    await close_database_connections()
    logger.info("VitalSense API shutdown complete.")


def create_app() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title="VitalSense API",
        version="0.1.0",
        description=(
            "VitalSense Personal Health and Wellness Platform API. "
            "Modular monolith co-deploying Web and Mobile boundaries."
        ),
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # -------------------------------------------------------------------------
    # Middleware: Correlation ID & CORS
    # -------------------------------------------------------------------------
    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        correlation_id = request.headers.get(settings.CORRELATION_ID_HEADER)
        if not correlation_id:
            correlation_id = str(uuid.uuid4())
        set_correlation_id(correlation_id)

        response = await call_next(request)
        response.headers[settings.CORRELATION_ID_HEADER] = correlation_id
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.WEB_API_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # -------------------------------------------------------------------------
    # Standardized Error Handlers (IF-API-003, IF-API-012)
    # -------------------------------------------------------------------------
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Handle Pydantic validation errors with structured field details."""
        details = [
            ErrorDetail(
                field=" -> ".join(str(loc) for loc in err["loc"] if loc != "body"),
                issue=err["msg"],
            )
            for err in exc.errors()
        ]
        error_envelope = ErrorResponse(
            error=ErrorBody(
                code="VALIDATION_ERROR",
                message="Request payload validation failed.",
                details=details,
                correlation_id=get_correlation_id(),
            )
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_envelope.model_dump(),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        """Handle standard HTTP exceptions with consistent error envelopes."""
        code_map = {
            status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
            status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
            status.HTTP_403_FORBIDDEN: "FORBIDDEN",
            status.HTTP_404_NOT_FOUND: "NOT_FOUND",
            status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
            status.HTTP_409_CONFLICT: "CONFLICT",
            status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
            status.HTTP_500_INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
            status.HTTP_503_SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
        }
        error_code = code_map.get(exc.status_code, "ERROR")
        error_envelope = ErrorResponse(
            error=ErrorBody(
                code=error_code,
                message=str(exc.detail) if exc.detail else "An error occurred.",
                correlation_id=get_correlation_id(),
            )
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_envelope.model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Catch-all unhandled exceptions: log traceback internally, return safe envelope."""
        logger.error("Unhandled server exception caught", exc_info=exc)
        error_envelope = ErrorResponse(
            error=ErrorBody(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected internal server error occurred.",
                correlation_id=get_correlation_id(),
            )
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_envelope.model_dump(),
        )

    # -------------------------------------------------------------------------
    # Operational Liveness & Readiness Endpoints (DEP-009, DEP-010)
    # -------------------------------------------------------------------------
    @app.get(
        "/health",
        response_model=LivenessResponse,
        summary="Service Liveness Probe",
        tags=["Operations"],
    )
    async def get_health() -> LivenessResponse:
        """Lightweight liveness check confirming the HTTP process is serving requests."""
        return LivenessResponse(
            status="ok",
            service="vitalsense-api",
            version="0.1.0",
            timestamp=datetime.now(timezone.utc),
        )

    @app.get(
        "/ready",
        response_model=ReadinessResponse,
        summary="Service Readiness Probe",
        tags=["Operations"],
        responses={
            status.HTTP_503_SERVICE_UNAVAILABLE: {"model": ReadinessResponse}
        },
    )
    async def get_readiness() -> JSONResponse:
        """Readiness check verifying backend connectivity to authoritative PostgreSQL."""
        db_healthy = await check_database_health()
        payload = ReadinessResponse(
            status="ready" if db_healthy else "degraded",
            database="connected" if db_healthy else "disconnected",
            timestamp=datetime.now(timezone.utc),
        )
        http_status = (
            status.HTTP_200_OK if db_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return JSONResponse(
            status_code=http_status,
            content=payload.model_dump(mode="json"),
        )

    # -------------------------------------------------------------------------
    # Mount Client API Router Namespaces (ARCH-002, ARCH-014)
    # -------------------------------------------------------------------------
    app.include_router(web_router)
    app.include_router(mobile_router)

    return app


app = create_app()
