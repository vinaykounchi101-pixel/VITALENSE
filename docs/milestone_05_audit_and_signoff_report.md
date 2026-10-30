# VitalSense — Milestone 0.5 Baseline Audit and Decision Sign-off Report

**Milestone:** 0.5 (Product Owner Decision Sign-off)  
**Date:** 2026-10-30  
**Repository:** [github.com/vinaykounchi101-pixel/VITALENSE](https://github.com/vinaykounchi101-pixel/VITALENSE)  
**Local Workspace:** `E:\Projects\VITALSENSE`  
**Active Branch:** `dev`  
**Commit Baseline:** `19be54f` (synchronized with `origin/dev`)  
**Auditor:** Senior Technical Architect, Requirements Analyst, & Backend Engineer  

---

## 1. Executive Summary

Milestone 0.5 is an authoritative **decision and documentation milestone**. Its mandate is to conduct an independent verification of the actual repository state, audit the 348-requirement specification and traceability baseline, analyze all 22 open architectural decisions (`OD-01` through `OD-22`), and prepare an actionable Decision Sign-off Workshop for the Product Owner.

In strict compliance with project governance and safety constraints:
- Zero application features, schema mutations, migrations, or deployments were executed.
- No decisions were converted from OPEN to APPROVED autonomously.
- No personal health information (PHI) or environment credentials were read or exposed.

---

## 2. Verified Repository Baseline

| Category | Finding / Repository Evidence | Status |
| :--- | :--- | :--- |
| **Monorepo Structure** | `apps/`, `database/`, `docs/`, `infrastructure/`, `packages/`, `prompts/`, `services/`, `tests/` exist. | **Verified in Repository** |
| **Core Shared Library** | `vitalsense_common` package implemented with typed settings (`config.py`), async DB lifecycle (`database.py`), structured logging with PHI redaction (`logging.py`), domain models, and error envelopes. | **Verified in Repository** |
| **Database Schema** | Migration `001_initial_core_schema.py` defines 6 relational tables (`user_accounts`, `persons`, `metric_definitions`, `source_records`, `health_records`, `audit_events`) with foreign keys, composite indexes, exact decimal precision (`Numeric(14, 4)`), and seeds 5 provisional metrics. | **Verified in Repository** |
| **Modular Monolith API** | FastAPI entrypoint (`services/api/main.py`) defines `/health` (liveness) and `/ready` (readiness) probes and distinct `/api/v1/web` and `/api/v1/mobile` router namespaces. | **Verified in Repository** |
| **OpenAPI Contract** | Valid OpenAPI 3.1.0 contract exported at `packages/api-contracts/openapi/v1.json`. | **Verified in Repository** |
| **Automated Test Suite** | 4 test suites exist under `tests/` (`test_api_endpoints.py`, `test_config.py`, `test_logging.py`, `test_synthetic_fixtures.py`). | **Verified in Repository** |
| **Test Execution State** | Direct test execution in `.venv` currently halts with `ModuleNotFoundError: No module named 'vitalsense_common'`. Editable pip installation in `.venv` references the legacy workspace folder path (`E:\Projects\VITALENS`) rather than the active path `E:\Projects\VITALSENSE`. | **Verified Operational Issue** |
| **Continuous Integration (CI)** | No `.github/workflows` directory or YAML CI pipeline configuration exists in the repository. | **Verified Gap** |
| **Authentication State** | `user_accounts` contains only identity markers (`id`, `email`, `status`). No credential tables, password hashing, OAuth handlers, or auth middleware are implemented. | **Verified (Blocked on OD-18)** |
| **Sync Tombstones** | Schema currently uses immediate physical deletion (`ON DELETE CASCADE`). No `sync_tombstones` table or `deleted_at` soft-delete markers exist in schema. | **Verified (Blocked on OD-14)** |
| **PRD Traceability** | `docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv` contains 348 unique requirements, but 100% of rows (348/348) contain `TBD - authoritative PRD v1.1 not supplied for this merge` under `PRD link / trace source`. | **Verified Documentation Gap** |
| **Placeholder Tests in Matrix** | 23 rows in the traceability matrix lack detailed test preconditions, expected outcomes, or objective pass/fail criteria (marked "detailed test definition required"). | **Verified Documentation Gap** |
| **Open Decision Register** | All 22 decisions (`OD-01` through `OD-22`) are explicitly **OPEN**. None have received formal Product Owner approval. | **Verified Governance Status** |

---

## 3. Discrepancies and Inconsistencies Identified

1. **Status Discrepancy Between README and PROGRESS:**
   - [README.md](file:///e:/Projects/VITALSENSE/README.md) reports the project is at Milestone 0.1 ("Repository Scaffolding & Architecture Baseline (Task 1 Complete)").
   - [PROGRESS.md](file:///e:/Projects/VITALSENSE/PROGRESS.md) tracks Milestones 0.1, 0.2, 0.3, and 0.4 as completed.
   - *Fix:* Update `README.md` to reflect the completed Milestones 0.1–0.4 baseline and active Milestone 0.5 state.

2. **Commit Hash Discrepancy in PROGRESS.md:**
   - `PROGRESS.md` records the active HEAD commit as `2d66aa1`.
   - The actual current HEAD commit on `dev` is `19be54f` ("docs: add PROGRESS.md and TECHNICAL.md tracking baseline").
   - *Fix:* Align recorded commit hash in `PROGRESS.md` with Git reality (`19be54f`).

3. **Workspace Path Rename & Broken Local File Links:**
   - The workspace on disk is located at `E:\Projects\VITALSENSE`.
   - Historical documentation files (`README.md`, `PROGRESS.md`, `TECHNICAL.md`) contain markdown links formatted as `file:///e:/Projects/VITALENS/...`.
   - Editable pip installation of `vitalsense_common` inside `.venv` was registered against the old path, breaking Python imports in the virtual environment.
   - *Fix:* Update broken `file://` URIs across documentation to `VITALSENSE` and re-link the editable package via `pip install -e packages/python-common`.

4. **Traceability Matrix PRD Linkage Gap:**
   - While `docs/VitalSense_PRD_v1.1.md` is present in the repository, all 348 rows in `docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv` have `TBD` in the PRD source column.
   - *Fix:* Execute a systematic mapping pass linking each SRS requirement to its corresponding PRD v1.1 section.

---

## 4. In-Depth Analysis of Critical Architecture Decisions

### OD-01 — Phase 1 Metrics & Device Feasibility
- **Finding:** The 5 provisional metrics seeded in `001_initial_core_schema.py` (`steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`) represent standard wellness indicators.
- **Feasibility Separation:** Only `steps` can be reliably measured by phone hardware alone. `heart_rate` and `sleep_session` require a companion wearable or specialized application.
- **Recommendation:** Approve the 5 core provisional metrics for Phase 1. Require honest empty states in the UI ("No wearable connected") instead of synthetic zeros or phantom estimates.

### OD-07 — Data Retention & Lifecycle
- **Finding:** Storing raw JSON payloads indefinitely in `source_records.raw_payload` creates severe database bloat and breach liability.
- **Recommendation:** Implement a 30-day rolling retention policy. Retain `raw_payload` for 30 days for debugging and deduplication verification. After 30 days, nullify `raw_payload` while keeping the lightweight receipt metadata (`idempotency_key`, `source_name`, `ingestion_timestamp`) permanently. Retain normalized `health_records` while the user account remains active.

### OD-14 — Deletion Propagation & Offline Sync Tombstones
- **Finding:** The current schema uses physical hard deletion (`ON DELETE CASCADE`). If a record is deleted on the web, an offline mobile client reconnecting later with cached records would attempt to re-ingest the record, causing "zombie record" resurrection.
- **Recommendation:** Introduce a lightweight `sync_tombstones` table (`person_id`, `record_type`, `target_record_id`, `deleted_at`). Deleted records write a tombstone retained for 30 days. When an offline client syncs, it downloads active tombstones, purges matching local SQLite records, and skips re-uploading them.

### OD-17 — Mobile Database Encryption
- **Finding:** Standard SQLite in Expo Go is unencrypted.
- **Recommendation:** Mandate SQLite with SQLCipher (256-bit AES encryption) using an Expo Continuous Native Generation (prebuild) workflow. The encryption key is generated at first launch and stored in the platform hardware keystore (iOS Keychain / Android KeyStore) via `expo-secure-store`. On logout, the key is evicted and local databases purged.

### OD-18 — Authentication Architecture
- **Finding:** `user_accounts` currently has no credential fields.
- **Recommendation:** Self-hosted application-owned identity using Argon2id password hashing, coupled with short-lived JWT access tokens (15-min) and rotating refresh tokens (7-day) stored in PostgreSQL. Zero external identity vendor dependency, ensuring complete adherence to PostgreSQL authoritative persistence and zero recurring SaaS costs.

### Deployment & Automation (OD-19 & OD-22)
- **OD-19:** Maintain a single co-deployed FastAPI modular monolith container serving both `/api/v1/web` and `/api/v1/mobile`. Reject microservices to prevent cost and operational sprawl.
- **OD-22:** Backend workers own 100% of canonical database writes, validation, and PHI processing. n8n is strictly an external workflow orchestrator for event scheduling and non-sensitive notifications; n8n must never hold raw health data or direct database credentials.

---

## 5. Prioritized Open Decisions Awaiting Owner Sign-off

The following 10 decisions constitute the **P0 release blockers** that must be formally signed off by the Product Owner before Milestone 0.6 implementation begins:

1. **OD-01:** Confirm the 5 core Phase 1 metrics (Option A).
2. **OD-03:** Approve Phase 0 exit acceptance criteria (Option A).
3. **OD-04:** Approve manual entry restricted to approved metrics with revision history (Option A).
4. **OD-07:** Approve 30-day raw payload retention and 30-day backup restore reconciliation (Option A).
5. **OD-14:** Approve synchronization tombstones to prevent zombie record resurrection (Option A).
6. **OD-16:** Approve mobile platform baseline: iOS 16+ and Android 12+ (Health Connect) (Option A).
7. **OD-17:** Approve SQLCipher with hardware KeyStore for mobile offline storage (Option A).
8. **OD-18:** Approve self-hosted Argon2id password hashing and rotating JWT refresh tokens (Option A).
9. **OD-19:** Reaffirm single container modular monolith deployment (Option A).
10. **OD-22:** Approve strict isolation of n8n outside the canonical health data boundary (Option A).

*(The interactive sign-off checklist is available in [docs/architecture/decision_workshop.md](file:///e:/Projects/VITALSENSE/docs/architecture/decision_workshop.md)).*

---

## 6. Proposed Milestone 0.6 Scope & Acceptance Criteria

Once the Product Owner signs off on the P0 decisions, Milestone 0.6 will deliver the **Core Authentication, Data Ingestion, and Offline Sync Foundation**:

### Milestone 0.6 Scope:
1. **Schema Evolution (Migration 002):**
   - Implement `auth_credentials` (Argon2id password hashes) and `auth_refresh_tokens` tables (`OD-18`).
   - Implement `sync_tombstones` table for offline deletion reconciliation (`OD-14`).
   - Add revision lineage (`superseded_by_id`) to `health_records` for manual corrections (`OD-04`).
2. **Authentication Service Implementation:**
   - User registration, login, token refresh, and logout endpoints under `/api/v1/web/auth` and `/api/v1/mobile/auth`.
   - JWT authentication and person-context authorization dependency injection in FastAPI.
3. **Batch Sync & Ingestion API:**
   - Implement `/api/v1/mobile/sync` endpoint accepting batch source records and returning server updates and active tombstones.
   - Enforce idempotent ingestion using `uq_source_records_idempotency`.
4. **Automated CI Workflow:**
   - Establish `.github/workflows/ci.yml` running linting (Ruff), type checking (Mypy), and full test suites (Pytest).
5. **Traceability Matrix Remediation:**
   - Populate PRD v1.1 section links for all 348 requirements and define concrete test cases for the 23 inventory placeholder rows.

### Milestone 0.6 Acceptance Criteria:
- [ ] 100% passing automated test suite (including new auth and sync test cases).
- [ ] Migration upgrade and rollback cleanly verified against PostgreSQL.
- [ ] OpenAPI 3.1.0 contract re-exported and validated.
- [ ] Zero unredacted credentials or health metrics in application logs.
- [ ] No regression of existing modular monolith architectural boundaries.

---

*Report compiled and ready for Product Owner review.*

