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
| **Testing** | Pytest + pytest-asyncio | `8.3.3` / `0.24.0` | Unit, endpoint, and contract test suite (75/75 tests passing) |
| **Frontend Framework** | Next.js + React | `14.2.35` / `18.3.1` | Production web application dashboard with IndexedDB offline store |
| **Mobile Framework** | React Native + Expo | `0.74.5` / `51.0.0` | Unified cross-platform Android & iOS client architecture |
| **Desktop Runtime** | Tauri / Rust | `1.6` | Lightweight native desktop clients for Windows and macOS |
| **Containerization** | Docker & Compose | Multi-stage | Full-stack deployment (PostgreSQL 18, FastAPI, Next.js, Nginx) |
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
│   ├── mobile/                   # React Native + Expo (Android Health Connect & iOS HealthKit)
│   ├── desktop-windows/          # Windows desktop client (Tauri / Rust / DPAPI / SQLCipher)
│   ├── desktop-macos/            # macOS desktop client (Tauri / Rust / Keychain / SQLCipher)
│   └── web/                      # Web application (Next.js 14 / IndexedDB + Web Crypto)
├── database/                     # Database migrations, configurations, and test fixtures
│   ├── fixtures/
│   │   └── synthetic_records.json
│   └── postgres/
│       ├── alembic.ini           # Alembic migration configuration
│       └── migrations/           # Versioned migration scripts (001 through 006)
├── infrastructure/               # Containerization & reverse proxy
│   └── docker/                   # Dockerfile.api, Dockerfile.web, nginx.conf
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
- **`003_auth_password_resets`**:
  - Added `auth_password_resets` table (`id`, `user_account_id`, `token_hash`, `expires_at`, `is_consumed`, `consumed_at`, `is_revoked`, `created_at`) (`SEC-007`).
  - Indexed `token_hash` and `user_account_id` for O(1) single-use lookup and atomic invalidation.
- **`004_tombstone_device_id`**:
  - Added `device_record_id` column to table `sync_tombstones` (`OD-14`, `FR-PRIV-004`).
  - Added composite index on `(person_id, device_record_id)` enabling O(1) resurrection checks without joining deleted `health_records`.

---

## 4. Authentication & Session Architecture (OD-18)

- **Argon2id Password Hashing:** 64 MiB memory (`memory_cost=65536`), 3 iterations (`time_cost=3`), 4 parallelism lanes (`parallelism=4`).
- **Brute Force Protection & Lockout:** Tracks `failed_login_attempts`. On 5 consecutive failed attempts, locks the account for 15 minutes (`locked_until`).
- **Rate Limiting (`services/auth/rate_limiter.py`):** Sliding-window rate limiting per endpoint and client IP (10 requests/minute on login/register, 5 requests/minute on password reset).
  - **Proxy Verification:** Strictly trusts `X-Forwarded-For` only if the direct socket peer IP is listed in `settings.TRUSTED_PROXIES` (default `127.0.0.1`, `::1`). Untrusted direct client IP spoofing is completely ignored.
  - **Bounded Memory Defense:** Capped at `max_tracked_keys = 10000` with automatic eviction of expired entries and oldest-entry purging to prevent memory exhaustion DoS.
  - **Horizontal Scaling:** Process-local in-memory tracking is designed for single-instance monolith deployments and testing; horizontal production deployments require an external token-bucket cache (e.g. Redis).
- **Dual Client Boundaries:**
  - **Web Client:** Sets `HttpOnly; Secure; SameSite=Strict` cookies for `vitalsense_access_token` and `vitalsense_refresh_token`. Strictly returns `WebAuthResponse` (omitting access and refresh tokens from JSON response bodies). Sets client-readable `vitalsense_csrf_token` cookie (`SameSite=Strict; HttpOnly=False`) for CSRF double-submit protection.
  - **Native / Mobile Clients:** Returns standard JSON `TokenResponse` containing Bearer access token and rotating refresh token for secure OS keychain storage (Android, iOS, Windows, macOS).
- **CSRF Double-Submit Verification (`services/auth/dependencies.py`):** State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) with cookie authentication must submit matching `X-CSRF-Token` header. Bearer token requests bypass CSRF checks.
- **Rotating Refresh Token Families:** Refresh tokens rotate on every refresh with PostgreSQL `.with_for_update()` row-level locking to eliminate rotation race conditions. Reusing an already-consumed token triggers theft detection, immediately revoking all tokens in the entire session family (`OD-18`).
- **Single-Use Password Reset Enforcement (`SEC-007`):** Generates single-use, expiring (15-minute) tokens stored as SHA-256 hashes in `auth_password_resets`. Token consumption is atomic via `.with_for_update()`; replayed, expired, or revoked tokens are rejected. Successful reset updates the Argon2id credential, invalidates all other pending reset tokens for the user, and revokes all active session families across devices.

---

## 5. Offline Synchronization & Data Ingestion (OD-01, OD-04, OD-07, OD-14)

- **Phase 1 Metric Set & Strict Unit Validation:** Authoritative validation restricts ingested metrics to the 10 approved Phase 1 metrics and validates measurement units against `canonical_unit` (supporting clinical synonyms such as `%`/`percent`).
- **Batch Size Limits:** `BatchSyncRequest` enforces `max_length=500` on observations and tombstones to mitigate denial-of-service risks.
- **Ingestion Timestamp Bounds:** Reject measurements >5 minutes in the future or with inverted durations (`end_timestamp < measured_at`).
- **Clinical Validation:** Paired blood pressure validation ensures systolic strictly exceeds diastolic when submitted for the same measurement timestamp.
- **Raw Retention & Deduplication:** Raw payloads are stored in `source_records` for 30-day retention (`OD-07`). Unique constraint `uq_source_records_idempotency` ensures idempotent duplicate submissions are safely skipped.
- **Immutable Manual Entry & Correction (`OD-04`):** Manual corrections create a new `HealthRecord` revision with `origin = "user_entered"`, `correction_state = "corrected"`, preserve the original `event_timestamp`, and update the target record's `superseded_by_id`.
- **Deletion Tombstones & Decoupled Resurrection Prevention (`OD-14`):** Client deletions create rows in `sync_tombstones` and remove target rows from `health_records`. Before deleting `HealthRecord`, the service resolves the original `SourceRecord.source_record_id` and records it directly on the tombstone (`device_record_id`). Incoming observations check `SyncTombstone` directly via indexed lookup without joining deleted `HealthRecord` rows. Observations attempting to supersede or resurrect deleted records are strictly rejected (HTTP 409) or suppressed. In-batch ordering ensures deletions execute before observations, so deletion always wins.
- **Account Deletion Precedence (`OD-07`, `SYNC-010`):** Synchronization verifies user account status; accounts in `deletion_pending` or `deleted` are blocked from syncing (HTTP 403).
- **30-Day Cursor Expiry & Full Resync (`SYNC_CURSOR_EXPIRED`):** Reconnecting after >30 days offline triggers HTTP 409 `SYNC_CURSOR_EXPIRED`. Client recovers via full resync (`last_sync_timestamp = None`), receiving the active server baseline (excluding deleted records) and empty tombstones. The client algorithm purges locally cached records absent from the active baseline while preserving and uploading pending un-synced offline drafts (`pending_upload`).
- **Operational Retention Pruning Worker (`services/workers/retention_worker.py`):** Dedicated CLI and background runner executes `prune_expired_raw_payloads` and `prune_expired_tombstones` on a documented schedule (`settings.RETENTION_RUN_INTERVAL_HOURS`), emitting structured JSON audit logs and ensuring atomic transaction boundaries. In multi-worker production deployments, running as a decoupled single-runner cron job is strongly recommended to eliminate duplicate execution across API processes.

---

## 6. Verification & Automated Quality Gates

- **Test Suite:** **60 tests passing** with 100% success rate:
  - `test_sync_integrity.py`: Decoupled tombstone resurrection prevention without joining deleted rows, device_record_id suppression, supersedes_record_id 409 rejection, tenant/person isolation, duplicate tombstone idempotency, in-batch deletion precedence, full-resync backend contract and draft preservation, account deletion override, concurrent password reset confirmation via `asyncio.gather`.
  - `test_corrections_auth_retention.py`: Database-backed single-use password reset lifecycle, replay rejection, multi-token revocation, WebAuthResponse token omission, rate limiter anti-spoofing and memory bounding, operational retention worker runner, stale device full-resync reconciliation.
  - `test_migration_002.py`: 10 metric seeding, schema additions, constraints.
  - `test_auth_service.py`: Password validation, Argon2id, JWT, login, brute-force lockout, rotation, reuse theft detection, session listing & revocation.
  - `test_hardening_security_sync.py`: SameSite=Strict cookies, CSRF double-submit validation, rate limiting, password reset flow, batch limits, unit validation, timestamp bounds, account deletion precedence, resurrection prevention, operational retention pruner.
  - `test_ingestion_sync.py`: Paired BP validation, idempotency deduplication, immutable correction lineage, tombstones, 30-day cursor expiration.
  - `test_api_auth_sync_endpoints.py`: Web cookie auth lifecycle, mobile Bearer token lifecycle, batch sync, and full-resync endpoints.
  - `test_api_endpoints.py`: `/health`, `/ready`, correlation ID tracing, 404 envelope format.
  - `test_config.py`: Environment validation and production guards.
  - `test_logging.py`: Structured JSON formatting and PHI redaction.
  - `test_openapi_drift.py`: Live FastAPI OpenAPI contract matches `packages/api-contracts/openapi/v1.json` with zero drift.
- **CI Pipeline:** `.github/workflows/ci.yml` runs dependencies installation, package imports, Alembic migrations against PostgreSQL 16 container, pytest test suite, and OpenAPI drift verification.
