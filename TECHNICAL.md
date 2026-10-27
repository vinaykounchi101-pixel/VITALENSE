# VitalSense — Technical Documentation & Architecture Reference

**System:** VitalSense Personal Health & Wellness Platform  
**Active Technical Specification:** [VitalSense_SRS_v1.1.1_Merged.md](file:///e:/Projects/VITALENS/docs/VitalSense_SRS_v1.1.1_Merged.md)  
**Architecture Style:** Modular Monolith with distinct Web and Mobile API router namespaces

---

## 1. Technical Stack

| Layer | Technology | Version / Configuration | Purpose |
| :--- | :--- | :--- | :--- |
| **Language / Runtime** | Python | `3.12.10` (64-bit) | Backend services, migrations, test runner |
| **Framework** | FastAPI | `0.115.0` | High-performance async REST API framework |
| **ASGI Server** | Uvicorn (standard) | `0.31.1` | Asynchronous web server |
| **Data Validation** | Pydantic | `2.9.2` | Data schemas, serialization, and input validation |
| **Database ORM** | SQLAlchemy | `2.0.36` (asyncio) | Authoritative relational data modeling & session management |
| **Migrations** | Alembic | `1.13.3` (asyncpg) | Database schema migrations & version tracking |
| **Database Driver** | asyncpg | `0.30.0` | High-throughput asynchronous PostgreSQL driver |
| **Authoritative Store**| PostgreSQL | `18` (local service) | Central authoritative server-side persistence (`DATA-004`) |
| **API Contract** | OpenAPI | `3.1.0` | Machine-readable API contracts in [packages/api-contracts/openapi/v1.json](file:///e:/Projects/VITALENS/packages/api-contracts/openapi/v1.json) |
| **Testing** | Pytest + pytest-asyncio | `8.3.3` / `0.24.0` | Unit, endpoint, and contract test suite |

---

## 2. Monorepo Architecture & Directory Layout

```text
VITALENS/
├── apps/                         # Frontend & mobile client applications (future workspaces)
├── database/                     # Database migrations, configurations, and test fixtures
│   ├── fixtures/
│   │   └── synthetic_records.json
│   └── postgres/
│       ├── alembic.ini           # Alembic migration configuration
│       └── migrations/           # Versioned migration scripts (001_initial_core_schema.py)
├── docs/                         # Specifications, PRD, SRS, validation reports, and decisions
│   ├── architecture/
│   │   └── decision_workshop.md  # Product owner decision choices
│   ├── VitalSense_PRD_v1.1.md
│   ├── VitalSense_SRS_v1.1.1_Merged.md
│   └── VitalSense_SRS_v1.1.1_Open_Decision_Register.md
├── infrastructure/               # Infrastructure as Code (Docker, Terraform - future)
├── packages/                     # Shared cross-cutting libraries
│   ├── api-contracts/            # Versioned OpenAPI specifications (openapi/v1.json)
│   └── python-common/            # vitalsense_common shared package (editable install)
│       └── src/vitalsense_common/
│           ├── config.py         # Settings & environment validation
│           ├── database.py       # Async engine & session lifecycle
│           ├── logging.py        # Structured JSON logging & PHI redaction
│           ├── models/           # SQLAlchemy domain models
│           └── schemas/          # Standardized error envelopes & health schemas
├── prompts/                      # Verbatim user prompt archive
├── services/                     # Backend domain services & API entrypoints
│   ├── api/                      # Modular monolith FastAPI application (main.py)
│   ├── mobile_api/               # Mobile API router namespace (/api/v1/mobile)
│   ├── web_api/                  # Web API router namespace (/api/v1/web)
│   └── export_openapi.py         # CLI tool to export OpenAPI 3.1 JSON
├── tests/                        # Automated test suite (test_config, test_logging, test_api_endpoints)
├── .env.example                  # Documented environment template with placeholders
├── Makefile                      # Cross-platform developer convenience commands
├── pyproject.toml                # Python project configuration (ruff, mypy, pytest)
├── requirements.txt              # Pinned Python dependencies
└── README.md                     # Project overview and developer onboarding
```

---

## 3. Database Schema Baseline (Migration `001_initial_core_schema`)

The schema adheres strictly to [VitalSense_SRS_v1.1.1_Merged.md](file:///e:/Projects/VITALENS/docs/VitalSense_SRS_v1.1.1_Merged.md):

1. **`user_accounts`:** Identity and account credentials boundary (`id`, `email`, `status`, `created_at`, `updated_at`).
2. **`persons`:** Profile and health data boundary (`id`, `user_account_id`, `relationship_type`, `display_name`). Separating account identity from person context allows individual data ownership and future family sharing (`ARCH-010`, `FR-AUTH-009`, `FR-FAM-001`).
3. **`metric_definitions`:** Canonical registry defining permitted metrics, data types, canonical units, validation rules, and display rules (`FR-METRIC-004`). Seeded with provisional Phase 1 metrics: `steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`.
4. **`source_records`:** Raw ingestion receipts, source identifier, raw JSON payload, and composite unique idempotency constraint: `uq_source_records_idempotency` on (`person_id`, `source_name`, `idempotency_key`) (`FR-DATA-009`, `SYNC-016`).
5. **`health_records`:** Normalized health observations referencing `persons` and `metric_definitions`. Uses `Numeric(14, 4)` for exact precision without floating-point distortion (`DATA-001`–`003`, `FR-DATA-010`).
6. **`audit_events`:** Append-only security and lifecycle event log (`SEC-014`, `PRV-016`).

---

## 4. Security & Privacy Safeguards

- **Privacy Redaction (`PRV-011`, `NFR-OBS-001`):** Custom JSON log formatter automatically redacts passwords, auth tokens, database URLs, and health metric values from logs.
- **Environment-Driven Configuration:** All credentials are read from environment variables; `.env` is git-ignored and never committed.
- **Correlation ID Tracing (`NFR-OBS-001`):** Every HTTP request receives or inherits an `X-Correlation-ID` header propagated through logging context and response headers.
- **Standardized Error Envelopes (`IF-API-003`, `IF-API-012`):** Machine-readable error payloads with stable error codes, user-facing safe messages, and correlation IDs. Stack traces and raw internal database errors are never exposed to clients.
- **Operational Probes (`DEP-009`, `DEP-010`):**
  - `/health`: Liveness probe confirms process responsiveness without testing external dependencies.
  - `/ready`: Readiness probe checks database connection pool health with safe `SELECT 1` query.

---

## 5. Developer Commands & Operational Runbook

```powershell
# Activate Virtual Environment
.\.venv\Scripts\Activate.ps1

# Run Full Test Suite
pytest -v

# Run Database Migrations
alembic -c database/postgres/alembic.ini upgrade head

# Export OpenAPI 3.1.0 Specification
python services/export_openapi.py

# Run FastAPI Development Server
uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 6. Git Workflow Standards

1. Always work in `dev` branch or isolated feature branches (`feature/<name>`).
2. Run automated tests before committing (`pytest -v`).
3. Commit with Conventional Commits (`feat(...)`, `fix(...)`, `chore(...)`, `test(...)`).
4. Merge feature branches into `dev`, delete local feature branch, and push `dev` to `origin`.
5. `main` is protected and updated only on approved releases.
