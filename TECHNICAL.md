# VitalSense — Technical Documentation & Architecture Reference

**System:** VitalSense Personal Health & Wellness Platform  
**Active Technical Specification:** [VitalSense_SRS_v1.1.1_Merged.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Merged.md)  
**Active Architecture Blueprint:** [system_architecture.md](file:///e:/Projects/VITALSENSE/docs/architecture/system_architecture.md)  
**Approved Decisions Record:** [approved_decisions_record.md](file:///e:/Projects/VITALSENSE/docs/architecture/approved_decisions_record.md)  
**Architecture Style:** Modular Monolith with distinct Web and Mobile/Client API router namespaces; five independent first-class client applications  

---

## 1. Technical Stack

| Layer | Technology | Version / Configuration | Purpose |
| :--- | :--- | :--- | :--- |
| **Language / Runtime** | Python | `3.12.10` (64-bit) | Backend services, migrations, test runner |
| **Framework** | FastAPI | `0.115.0` | High-performance async REST API framework |
| **ASGI Server** | Uvicorn (standard) | `0.31.1` | Asynchronous web server |
| **Data Validation** | Pydantic | `2.9.2` | Data schemas, serialization, and input validation |
| **Email Validation** | email-validator | `2.3.0` | Robust RFC-compliant email address validation |
| **Database ORM** | SQLAlchemy | `2.0.36` (asyncio) | Authoritative relational data modeling & session management |
| **Migrations** | Alembic | `1.13.3` (asyncpg) | Database schema migrations & version tracking |
| **Database Driver** | asyncpg | `0.30.0` | High-throughput asynchronous PostgreSQL driver |
| **Authoritative Store**| PostgreSQL | `18` (local service) | Central authoritative server-side persistence (`DATA-004`) |
| **Local Client DBs** | Room / SQLite (SQLCipher AES-256) / IndexedDB | Platform-appropriate | Secure encrypted local cache & sync queue across 5 clients (`OD-17`) |
| **Password Hashing** | Argon2id (`argon2-cffi`) | `25.1.0` (m=65536, t=3, p=4) | High-cost GPU/ASIC-resistant password security (`OD-18`) |
| **Token Lifecycle** | PyJWT | `2.15.1` (HS256) | 15-minute access tokens + 32-byte rotating refresh tokens |
| **API Contract** | OpenAPI | `3.1.0` | Machine-readable API contracts in [packages/api-contracts/openapi/v1.json](file:///e:/Projects/VITALSENSE/packages/api-contracts/openapi/v1.json) |
| **Testing** | Pytest + pytest-asyncio | `8.3.3` / `0.24.0` | Unit, endpoint, and contract test suite (34/34 tests passing) |
| **Continuous Integration** | GitHub Actions | `ci.yml` (Python 3.12, PostgreSQL 16 service, least-privilege `contents: read`) | Automated testing, migration verification, and OpenAPI contract drift checking |

---

## 2. Five-Platform Client Architecture & Monorepo Layout

VitalSense targets **five first-class platforms developed in parallel** (`OD-16`):
1. **Android:** Kotlin, Jetpack Compose, Google Health Connect native integration, Room with SQLCipher AES-256, Android KeyStore.
2. **iOS:** Swift, SwiftUI, Apple HealthKit native integration, SQLite with SQLCipher AES-256, iOS Keychain.
3. **Windows:** Windows 10/11 x64/ARM64, desktop application consuming synchronized health data, SQLite with SQLCipher AES-256, Windows DPAPI.
4. **macOS:** macOS 13+ (Ventura), desktop application consuming synchronized data, SQLite with SQLCipher AES-256, macOS Keychain.
5. **Web:** Next.js, React, TypeScript, Tailwind CSS, mobile-first responsive UI, IndexedDB encrypted via Web Crypto API (AES-GCM-256).

```text
VITALSENSE/
├── .github/                      # GitHub Actions workflows (ci.yml)
├── apps/                         # First-class client applications (OD-16)
│   ├── android/                  # Android client (Kotlin / Compose / Room + SQLCipher)
│   ├── ios/                      # iOS client (SwiftUI / HealthKit / SQLite + SQLCipher)
│   ├── desktop-windows/          # Windows desktop client (WinUI / Flutter / SQLCipher)
│   ├── desktop-macos/            # macOS desktop client (SwiftUI / Flutter / SQLCipher)
│   └── web/                      # Web application (Next.js / IndexedDB + Web Crypto)
├── database/                     # Database migrations, configurations, and test fixtures
│   ├── fixtures/
│   │   └── synthetic_records.json
│   └── postgres/
│       ├── alembic.ini           # Alembic migration configuration
│       └── migrations/           # Versioned migration scripts (001, 002)
├── docs/                         # Specifications, PRD, SRS, validation reports, and decisions
│   ├── architecture/
│   │   ├── approved_decisions_record.md # Formal ADR for approved decisions (OD-01 to OD-22)
│   │   ├── system_architecture.md       # Complete system blueprint & Mermaid diagrams
│   │   └── decision_workshop.md         # Product owner decision choices
│   ├── milestone_05_audit_and_signoff_report.md
│   ├── milestone_05_1_baseline_recovery_and_p0_review_report.md
│   ├── milestone_05_2_ci_verification_and_decision_gate_report.md
│   ├── milestone_05_3_decision_review_and_architecture_finalization_report.md
│   ├── milestone_06_architecture_consolidation_and_decision_finalization_report.md
│   ├── milestone_07_core_authentication_ingestion_sync_implementation_report.md
│   ├── VitalSense_PRD_v1.1.md
│   ├── VitalSense_SRS_v1.1.1_Merged.md
│   └── VitalSense_SRS_v1.1.1_Open_Decision_Register.md
├── infrastructure/               # Infrastructure as Code (Docker, Nginx - future)
├── packages/                     # Shared cross-cutting libraries
│   ├── api-contracts/            # Versioned OpenAPI specifications (openapi/v1.json)
│   └── python-common/            # Shared Python library (vitalsense_common)
│       └── src/vitalsense_common/
│           ├── models/           # Domain models (auth, sync, metric, health, account)
│           ├── schemas/          # Pydantic schemas (auth, sync, envelope, health)
│           ├── security/         # Cryptographic utilities (Argon2id hasher, JWT tokens)
│           ├── config.py         # Environment configuration
│           ├── database.py       # Engine & session management (NullPool for tests)
│           └── logging.py        # Structured JSON logging & PHI redaction
├── prompts/                      # Immutable archive of all milestone prompts
├── services/                     # Backend domain services & API routers
│   ├── api/                      # Main FastAPI application factory (main.py)
│   ├── auth/                     # Authentication & session domain service
│   ├── sync/                     # Data ingestion & cross-platform synchronization service
│   ├── mobile_api/               # Mobile client router namespace (/api/v1/mobile)
│   │   ├── auth.py               # Mobile Bearer token endpoints
│   │   └── sync.py               # Mobile batch sync & full-resync endpoints
│   └── web_api/                  # Web client router namespace (/api/v1/web)
│       ├── auth.py               # Web HttpOnly cookie auth endpoints
│       └── sync.py               # Web batch sync & full-resync endpoints
└── tests/                        # 34 automated unit, integration, and drift tests
```

---

## 3. Database Schema & Migration Lineage

PostgreSQL is the single canonical source of truth (`DATA-004`). All schema changes are applied exclusively via Alembic migrations.

### Migration Lineage
- **`001_initial_core_schema`**: Core relational entities:
  - `user_accounts`, `persons`, `metric_definitions`, `source_records`, `health_records`, `audit_events`.
  - Initial 5 metrics: `steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`.
- **`002_auth_sync_expanded_metrics`**:
  - Seeded 5 additional Phase 1 metrics: `resting_heart_rate`, `blood_pressure_systolic`, `blood_pressure_diastolic`, `blood_oxygen_saturation`, `blood_glucose`.
  - Added `superseded_by_id` revision lineage column and foreign key on `health_records` (`OD-04`).
  - Added `auth_credentials` table (Argon2id password hashes, failed attempts, temporary lockout metadata).
  - Added `auth_refresh_tokens` table (SHA-256 token hashes, family tracking, consumption and revocation flags).
  - Added `sync_tombstones` table (immutable deletion tracking for offline synchronization).
  - Added `client_sync_cursors` table (per-device latest sync timestamp tracking).

---

## 4. Authentication & Session Architecture (OD-18)

- **Argon2id Password Hashing:** 64 MiB memory (`memory_cost=65536`), 3 iterations (`time_cost=3`), 4 parallelism lanes (`parallelism=4`).
- **Brute Force Protection:** Tracks `failed_login_attempts`. On 5 consecutive failed attempts, locks the account for 15 minutes (`locked_until`).
- **Dual Client Boundaries:**
  - **Web Client:** Sets `HttpOnly; Secure; SameSite=Lax` cookies for `vitalsense_access_token` and `vitalsense_refresh_token`.
  - **Native / Mobile Clients:** Returns standard JSON payload containing `Bearer` access token and rotating refresh token.
- **Rotating Refresh Token Families:** Refresh tokens rotate on every refresh. Reusing an already-consumed token triggers theft detection, immediately revoking all tokens in the entire session family (`OD-18`).

---

## 5. Offline Synchronization & Data Ingestion (OD-01, OD-04, OD-07, OD-14)

- **Phase 1 Metric Set:** Authoritative validation restricts ingested metrics to exactly the 10 approved metrics.
- **Clinical Validation:** Paired blood pressure validation ensures systolic strictly exceeds diastolic when submitted for the same measurement timestamp.
- **Raw Retention & Deduplication:** Raw payloads are stored in `source_records` for 30-day retention (`OD-07`). Unique constraint `uq_source_records_idempotency` ensures idempotent duplicate submissions are safely skipped.
- **Immutable Manual Entry & Correction (`OD-04`):** Manual corrections create a new `HealthRecord` revision with `origin = "user_entered"`, `correction_state = "corrected"`, preserve the original `event_timestamp`, and update the target record's `superseded_by_id`.
- **Deletion Tombstones (`OD-14`):** Client deletions create rows in `sync_tombstones` and remove target rows from `health_records`.
- **30-Day Cursor Expiry (`SYNC_CURSOR_EXPIRED`):** Reconnecting after >30 days offline triggers HTTP 409 `SYNC_CURSOR_EXPIRED`, requiring a safe full resynchronization workflow that preserves uncommitted local drafts.

---

## 6. Verification & Automated Quality Gates

- **Test Suite:** 34 tests passing with 100% success rate:
  - `test_migration_002.py`: 10 metric seeding, schema additions, constraints.
  - `test_auth_service.py`: Password validation, Argon2id, JWT, login, brute-force lockout, rotation, reuse theft detection, session listing & revocation.
  - `test_ingestion_sync.py`: Paired BP validation, idempotency deduplication, immutable correction lineage, tombstones, 30-day cursor expiration.
  - `test_api_auth_sync_endpoints.py`: Web cookie auth lifecycle, mobile Bearer token lifecycle, batch sync, and full-resync endpoints.
  - `test_api_endpoints.py`: `/health`, `/ready`, correlation ID tracing, 404 envelope format.
  - `test_config.py`: Environment validation and production guards.
  - `test_logging.py`: Structured JSON formatting and PHI redaction.
  - `test_openapi_drift.py`: Live FastAPI OpenAPI contract matches `packages/api-contracts/openapi/v1.json` with zero drift.
- **CI Pipeline:** `.github/workflows/ci.yml` runs dependencies installation, package imports, Alembic migrations against PostgreSQL 16 container, pytest test suite, and OpenAPI drift verification.
