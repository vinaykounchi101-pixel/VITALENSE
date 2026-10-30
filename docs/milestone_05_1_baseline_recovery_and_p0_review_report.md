# VitalSense — Milestone 0.5.1: Baseline Recovery & P0 Decision Review Report

**Milestone:** 0.5.1 (Baseline Recovery & P0 Architecture Review)  
**Date:** 2026-10-30  
**Repository:** [github.com/vinaykounchi101-pixel/VITALENSE](https://github.com/vinaykounchi101-pixel/VITALENSE)  
**Local Workspace:** `E:\Projects\VITALSENSE`  
**Active Branch:** `dev`  
**Base Commit:** `19be54f` (synchronized with `origin/dev`)  
**Auditor:** Senior Software Architect, Backend Engineer, Security Reviewer, & QA Engineer  

---

## 1. Executive Summary

Milestone 0.5.1 was executed to resolve development environment discrepancies, verify test and database health, analyze an underlying architecture conflict regarding service boundaries, perform an exhaustive review of all 10 Priority 0 (`P0`) product and architectural decisions, audit the 348-requirement traceability matrix, and draft a minimal Continuous Integration workflow.

In strict compliance with operating guidelines:
- **Zero application features, schema mutations, migrations, or client scaffolding were implemented.**
- **No database changes or unapproved Git commits were performed.**
- **All decisions remain explicitly OPEN or PENDING PRODUCT-OWNER APPROVAL.**
- **Zero credentials, tokens, private keys, or personal health records were read or exposed.**

---

## 2. Phase A: Environment Recovery & Verification

### 2.1 Investigation of `ModuleNotFoundError: No module named 'vitalsense_common'`
- **Initial Hypothesis:** The editable installation metadata in `.venv` was broken when the workspace folder on disk was renamed from `VITALENS` to `VITALSENSE`.
- **Investigation Steps & Evidence:**
  1. Inspected `.venv/Lib/site-packages/__editable__.vitalsense_common-0.1.0.pth`:
     ```text
     E:\Projects\VITALENS\packages\python-common\src
     ```
  2. Inspected `.venv/Lib/site-packages/vitalsense_common-0.1.0.dist-info/direct_url.json`:
     ```json
     {"dir_info": {"editable": true}, "url": "file:///E:/Projects/VITALENS/packages/python-common"}
     ```
  3. Verified that `E:\Projects\VITALENS` does not exist on disk (`Test-Path E:\Projects\VITALENS` returned `False`).
- **Conclusion:** Hypothesis confirmed. The import failure was caused exclusively by stale hardcoded absolute directory paths in the virtual environment's editable package metadata created prior to the folder rename.

### 2.2 Local Fix Applied
Executed the smallest safe, isolated recovery command without altering package APIs or introducing new dependencies:
```powershell
.\.venv\Scripts\python.exe -m pip install -e packages/python-common --no-deps
```
- **Exit Code:** `0`
- **Result:** Re-registered `__editable__.vitalsense_common-0.1.0.pth` pointing to `E:\Projects\VITALSENSE\packages\python-common\src`.
- **Import Check:**
  ```powershell
  .\.venv\Scripts\python.exe -c "import vitalsense_common; print('SUCCESS:', vitalsense_common.__file__)"
  ```
  *Output:* `SUCCESS: E:\Projects\VITALSENSE\packages\python-common\src\vitalsense_common\__init__.py` (Exit Code: `0`).

### 2.3 Automated Test Execution
- **Python Interpreter:** `E:\Projects\VITALSENSE\.venv\Scripts\python.exe` (Python 3.12.10 64-bit on Windows)
- **Command:** `.\.venv\Scripts\python.exe -m pytest`
- **Exit Code:** `0`
- **Results:** **16 passed, 1 warning, 0 failures in 0.89s**
  - `tests/test_api_endpoints.py::test_liveness_probe_returns_200` **PASSED**
  - `tests/test_api_endpoints.py::test_readiness_probe_when_database_healthy` **PASSED**
  - `tests/test_api_endpoints.py::test_readiness_probe_when_database_unreachable` **PASSED**
  - `tests/test_api_endpoints.py::test_web_api_router_status` **PASSED**
  - `tests/test_api_endpoints.py::test_mobile_api_router_status` **PASSED**
  - `tests/test_api_endpoints.py::test_correlation_id_passthrough` **PASSED**
  - `tests/test_api_endpoints.py::test_correlation_id_generated_when_omitted` **PASSED**
  - `tests/test_api_endpoints.py::test_404_standardized_error_envelope` **PASSED**
  - `tests/test_api_endpoints.py::test_error_envelope_structure_conformance` **PASSED**
  - `tests/test_config.py::test_default_settings` **PASSED**
  - `tests/test_config.py::test_invalid_environment_rejected` **PASSED**
  - `tests/test_config.py::test_production_guards` **PASSED**
  - `tests/test_config.py::test_cors_origins_parsing` **PASSED**
  - `tests/test_logging.py::test_json_formatter_structure` **PASSED**
  - `tests/test_logging.py::test_privacy_redaction_of_sensitive_keys` **PASSED**
  - `tests/test_synthetic_fixtures.py::test_synthetic_records_structure` **PASSED**

### 2.4 OpenAPI Contract & Database Status
- **OpenAPI Schema Check:** Ran `.\.venv\Scripts\python.exe services/export_openapi.py`. `git diff packages/api-contracts/openapi/v1.json` returned zero differences, confirming OpenAPI 3.1.0 contract conformance.
- **Database Connectivity & Migration Status:** Ran `.\.venv\Scripts\python.exe -m alembic -c database/postgres/alembic.ini current` against local PostgreSQL.
  *Output:* `001_initial_core_schema (head)` (Exit Code: `0`). Database connection is active and schema is fully up to date.

---

## 3. Phase B: Architecture Boundary Conflict Reconciliation

### 3.1 Documented Conflict Identification
An architectural inconsistency exists between earlier project definitions and recent implementation proposals:
1. **Separation Preference:**
   - [README.md](file:///e:/Projects/VITALSENSE/README.md) lines 23-24: *"APIs: Python FastAPI with distinct client boundaries (`web-api` and `mobile-api`)."*
   - [.env.example](file:///e:/Projects/VITALSENSE/.env.example) lines 31-43: Defines independent listening hosts and ports: `WEB_API_PORT=8000` and `MOBILE_API_PORT=8001`.
   - [VitalSense_SRS_v1.1.1_Merged.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Merged.md) `ARCH-002`: *"Web-facing and mobile-facing APIs are separate boundaries."*
2. **Co-Deployment Preference:**
   - [VitalSense_SRS_v1.1.1_Merged.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Merged.md) `ARCH-006`: *"Logical boundaries do not require every folder to be a separate process/container."*
   - Section 6.4: *"The repository tree in Section 6.4 is a logical organization, not a commitment to deploy each folder as a separate service."*
   - `ARCH-013`: Mandates an ADR prior to Phase 1 deployment design freeze to decide co-deployment vs separate processes.
   - Codebase reality: [services/api/main.py](file:///e:/Projects/VITALSENSE/services/api/main.py) co-deploys both namespaces under a single FastAPI app (`/api/v1/web` and `/api/v1/mobile`) listening on a single port.

### 3.2 Comparative Evaluation

| Evaluation Criteria | Option 1: Co-deployed Modular Monolith (Single Process) | Option 2: Separately Deployed Web & Mobile Services |
| :--- | :--- | :--- |
| **API Boundaries** | Enforced logically via FastAPI sub-routers (`/api/v1/web`, `/api/v1/mobile`) with dedicated schemas. | Enforced physically via independent containers, separate ports (8000/8001), and routing ingress. |
| **Data Authority** | Single PostgreSQL database instance; shared connection pool; zero cross-service network hops. | Single PostgreSQL database; dual connection pools competing for connection limits. |
| **Database Migrations** | Single Alembic migration sequence; zero version synchronization lag between services. | Shared database accessed by two separate services; requires strict zero-downtime backward-compatible migrations. |
| **Authorization & Sessions** | Identical JWT validation and person-context middleware shared directly from `vitalsense_common`. | Requires either shared library or centralized auth service; potential token revocation sync latency. |
| **Deployment & Cost** | Single container fits comfortably on free/low-tier hosting (e.g. Render, Railway, AWS ECS Fargate 0.25 vCPU / 0.5 GB RAM). | Multiplies container count (2 API containers + worker = 3 processes); exceeds free tier limits. |
| **Offline Mobile Sync** | Mobile sync endpoint routes internally to domain models and executes atomic batch commits. | Mobile sync requests hit dedicated mobile service; identical persistence logic duplicated or imported. |
| **Long-term Extensibility (ML, Family, Records)** | Background workers run from the same codebase image as separate scheduled tasks. | Microservice sprawl; requires service mesh, distributed tracing, and complex inter-service RPC. |

### 3.3 Recommendation & Decision Status
- **Recommended Resolution:** **Option 1 (Co-deployed Modular Monolith for Phase 1)**.
  - *Rationale:* Web and mobile clients have different payload shapes and sync semantics, but both operate on the exact same core entities (`UserAccount`, `Person`, `HealthRecord`). Co-deploying them as distinct router namespaces in a single FastAPI application maintains strict code separation (`ARCH-002`) without incurring distributed systems overhead, connection exhaustion, deployment complexity, or unnecessary hosting costs (`ARCH-006`, `ARCH-013`).
- **Status:** **PENDING PRODUCT-OWNER APPROVAL** under `OD-19`.

---

## 4. Phase C: Critical Priority 0 (P0) Decisions Review

Every decision below is **OPEN** and awaits explicit Product Owner review.

---

### OD-01 — Phase 1 Metric Set
- **Status:** **OPEN**
- **Existing Requirements:** `FR-DATA-001`–`013`, `FR-METRIC-001`–`005`, `IF-HEALTH-*`, `Appendix C`. Seeded metrics: `steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`.
- **Options:**
  - *Option A (Recommended):* The 5 core provisional metrics.
  - *Option B:* Expanded biometrics (`blood_pressure`, `blood_glucose`, `SpO2`, `weight`).
  - *Option C:* Minimalist (`steps` and `sleep_session` only).
- **Critical Technical Distinctions:**
  - **Phone-Only Native Collection:** Only `steps` can be collected continuously by phone hardware alone.
  - **Wearable / Companion Required:** `heart_rate` (optical PPG), `sleep_session` (wearable or sleep app), `active_energy` (platform calculated), `workout_session` (logged activity) require paired hardware.
  - **Data Integrity Rule:** When wearable data is absent, the system **must never fabricate zero values**. Missing data must be displayed as an explicit empty state ("No paired device" / "No data recorded").
- **Consequences:** Option A maintains realistic scope without premature medical/clinical liability (`OD-12`).
- **Question for Owner:** Confirm Phase 1 metric scope (Option A recommended).

---

### OD-03 — Phase 0 Exit Acceptance Criteria
- **Status:** **OPEN**
- **Existing Requirements:** `DEP-*`, `ARCH-*`, `NFR-*`, `SYNC-*`, `Section 16`.
- **Options:**
  - *Option A (Recommended):* Foundation gate based on reproducible engineering proofs:
    1. 100% automated test pass on clean checkout.
    2. Alembic migration upgrade to `head` and safe rollback to `base` verified on local PostgreSQL.
    3. OpenAPI 3.1.0 contract verified with zero schema drift.
    4. Synthetic sync fixture successfully ingested into `source_records` and normalized into `health_records` with exact decimal precision (`Numeric(14, 4)`).
    5. `/health` and `/ready` probes respond with valid status payloads.
  - *Option B:* Defer Phase 0 exit until native mobile APK/IPA artifacts are compiled and connected to cloud staging.
- **Critical Technical Distinction:** Separates foundation readiness (verifiable now in the backend repository) from live device sync tests (which can only be executed once mobile client scaffolding exists in Phase 1).
- **Question for Owner:** Approve Phase 0 exit acceptance criteria (Option A recommended).

---

### OD-04 — Manual Entry and Corrections
- **Status:** **OPEN**
- **Existing Requirements:** `FR-MAN-001`–`005`, `FR-QUAL-006`, `SYNC-017/018`.
- **Options:**
  - *Option A (Recommended):* Manual entry permitted only for approved Phase 1 metrics. Records receive `origin = 'user_entered'`. Edits never overwrite in place; they insert a new record with `correction_state = 'corrected'` pointing to the superseded record (`superseded_by_id`).
  - *Option B:* Unrestricted arbitrary key-value entry.
  - *Option C:* Mutable in-place updates.
- **Consequences:** Option A preserves complete auditability (`PRV-016`), prevents data corruption, and ensures deterministic offline reconciliation without merge conflicts.
- **Question for Owner:** Approve manual entry restricted to Phase 1 metrics with immutable revision history (Option A recommended).

---

### OD-07 — Raw Ingestion Retention & Lifecycle
- **Status:** **OPEN**
- **Existing Requirements:** `FR-PRIV-004`–`007`, `PRV-003/005–007`, `DATA-009`, `SYNC-009/019`, `PRV-012–016`.
- **Options:**
  - *Option A (Recommended):* 30-day rolling retention for raw provider payloads (`source_records.raw_payload`). After 30 days, a scheduled worker nullifies `raw_payload` while preserving the lightweight receipt metadata (`idempotency_key`, `source_name`, `ingestion_timestamp`). Active normalized records (`health_records`) are kept indefinitely while account is active. Database snapshots expire after 30 days. Restores must run a deletion reconciliation pass against `audit_events`.
  - *Option B:* Indefinite retention of raw payloads.
  - *Option C:* Zero raw payload retention (discard immediately upon parsing).
- **Legal & Privacy Considerations:** A fixed 30-day retention for raw JSON is an engineering proposal; formal GDPR (Art. 17 Right to Erasure, Art. 5 Data Minimisation) and HIPAA compliance requirements require professional legal sign-off.
- **Question for Owner:** Approve 30-day raw payload retention and backup reconciliation policy (Option A recommended).

---

### OD-14 — Deletion Propagation & Offline Synchronization
- **Status:** **OPEN**
- **Existing Requirements:** `FR-PRIV-004`, `PRV-005–007`, `PRV-012`, `SYNC-019`, `Appendix D`.
- **Options:**
  - *Option A (Recommended):* Synchronization tombstones with client sync epoch tokens.
  - *Option B:* Hard deletion with full client database re-download on every sync.
- **Critical Technical Vulnerability of a Fixed 30-Day Tombstone Window:**
  - If server tombstones are purged after 30 days, a mobile device that remains offline for 45 days will reconnect and push its queued local records. Because the server tombstones no longer exist, the server cannot detect that the records were deleted on another client, resulting in **"zombie record resurrection"**.
- **Recommended Recovery Strategy:**
  - The server tracks `last_sync_timestamp` per client device.
  - If a client's last sync is older than the tombstone retention window (>30 days), the server rejects incremental sync with `SYNC_CURSOR_EXPIRED`.
  - The mobile client must execute a **full resynchronization**: purge local cache, re-fetch active state from the server, and prompt the user regarding any uncommitted offline edits.
- **Question for Owner:** Approve synchronization tombstones with the `SYNC_CURSOR_EXPIRED` full-resync safety mechanism (Option A recommended).

---

### OD-16 — Minimum Supported Platform & OS Matrix
- **Status:** **OPEN**
- **Existing Requirements:** `NFR-COMP-001`–`003`, `FR-DATA-001/002`, `IF-CLIENT-*`.
- **Options:**
  - *Option A (Recommended):*
    - **iOS:** iOS 16.0+ (Swift HealthKit API baseline).
    - **Android:** Android 12.0+ (API level 31+) with Google Health Connect (native on Android 14+). Google Fit API is excluded.
    - **Web:** Modern evergreen browsers (Chrome 115+, Firefox 115+, Safari 16+, Edge 115+).
  - *Option B:* Legacy Android support (Android 9/10/11) via deprecated Google Fit SDK.
- **Prototype Verification Note:** Health Connect background sync permissions on Android 12/13 require prototype validation in Phase 1 to confirm battery optimization exemptions.
- **Question for Owner:** Approve iOS 16+ and Android 12+ (Health Connect) platform baseline (Option A recommended).

---

### OD-17 — Mobile Local Database Encryption
- **Status:** **OPEN**
- **Existing Requirements:** `SEC-008`, `SYNC-001`–`013`, `ARCH-005`, `PRV-014`.
- **Options:**
  - *Option A (Recommended):* SQLite encrypted with SQLCipher (256-bit AES) using Expo Continuous Native Generation (prebuild). Encryption key generated on first launch and stored exclusively in hardware keystores (iOS Keychain / Android KeyStore) via `expo-secure-store`. On logout, the key is evicted from memory and keystore, and local database files are deleted.
  - *Option B:* Standard unencrypted SQLite relying strictly on OS app sandboxing.
- **Expo Framework Constraint:** Pure Expo Go does **not** support custom C-extensions required by SQLCipher. Adopting Option A requires using Expo Development Builds (`npx expo prebuild` / `expo run:android` / `expo run:ios`).
- **Question for Owner:** Approve SQLCipher with hardware KeyStore and Expo Development Build workflow (Option A recommended).

---

### OD-18 — Authentication Architecture & Session Management
- **Status:** **OPEN**
- **Existing Requirements:** `FR-AUTH-001`–`008`, `SEC-001`–`011`, `IF-API-014`.
- **Options:**
  - *Option A (Recommended):* Self-hosted application-owned authentication using Argon2id password hashing + rotating JWT refresh tokens stored in PostgreSQL.
  - *Option B:* Third-party managed identity (e.g. Supabase Auth / Auth0).
  - *Option C:* Passwordless email magic links.
- **Comprehensive Security Evaluation (Beyond Hashes & Tokens):**
  - *Password Hashing:* Argon2id with memory cost 64MB, time cost 3 iterations, parallelism 4.
  - *Token Lifecycles:* Access tokens (15-min signed JWTs); Refresh tokens (7-day cryptographically random opaque tokens stored as SHA-256 hashes in PostgreSQL).
  - *Reuse Detection:* If a consumed refresh token is presented, the entire token family is immediately revoked, protecting against token theft.
  - *Storage Boundaries:* Web clients store tokens in `HttpOnly`, `Secure`, `SameSite=Strict` cookies. Mobile clients store tokens in `expo-secure-store`.
  - *Brute-Force Protection:* Rate limiting on `/auth/login` (5 attempts/min per IP/email) and account lockouts after 10 consecutive failures.
- **Question for Owner:** Approve self-hosted Argon2id + rotating JWT refresh token architecture (Option A recommended).

---

### OD-19 — Hosting Topology & Service Boundary
- **Status:** **OPEN**
- **Existing Requirements:** `ARCH-001`–`015`, `DEP-*`, `NFR-REL-*`, `Section 11`.
- **Options:**
  - *Option A (Recommended):* Co-deployed modular monolith container (FastAPI) backed by managed PostgreSQL.
  - *Option B:* Multi-service deployment (separate web API, mobile API, and worker containers).
- **Cost & Simplicity:** Option A runs on free/starter tiers with zero inter-service latency.
- **Question for Owner:** Reaffirm co-deployed modular monolith topology (Option A recommended).

---

### OD-22 — Automation Boundary & n8n Isolation
- **Status:** **OPEN**
- **Existing Requirements:** `FR-AUTO-001`–`013`, `IF-AUTO-001`–`005`, `ARCH-008/015`.
- **Options:**
  - *Option A (Recommended):* Strict security boundary: Backend application workers own 100% of canonical database writes, PHI processing, validation, and auth. n8n is strictly an external orchestrator triggering jobs via authenticated webhooks and dispatching non-sensitive notifications. n8n never touches raw health records or direct database credentials.
  - *Option B:* Direct n8n database mutations.
- **PHI Exposure Defense:** Option A prevents health data leakage into n8n execution history, logs, or unencrypted workflow payloads.
- **Question for Owner:** Approve strict isolation of n8n outside the canonical health data boundary (Option A recommended).

---

## 5. Phase D: Traceability Matrix Audit

Inspected [docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv) against [docs/VitalSense_PRD_v1.1.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_PRD_v1.1.md) and [docs/VitalSense_SRS_v1.1.1_Merged.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Merged.md).

### 5.1 Audit Findings
1. **Total Requirement Rows:** **348 unique requirements** (verified).
2. **Missing PRD Links:** **348 / 348 rows (100%)** currently have `TBD - authoritative PRD v1.1 not supplied for this merge` under `PRD link / trace source`.
3. **Placeholder Test Definitions:** **23 rows** lack concrete preconditions, expected outcomes, or pass/fail criteria (marked "detailed test definition required"):
   - `ARCH-016`: Event/outbox persistence and delivery semantics.
   - `DATA-011` through `DATA-016` (6 rows): Export/deletion lifecycle, format definitions, user access revocation, account switching, async status reporting, and retention parameters.
   - `IF-AUTO-006` through `IF-AUTO-010` (5 rows): Event contracts, duplicate safety, retry bounds, canonical service writes, and webhook credential rotation.
   - `NFR-AC-001` through `NFR-AC-005` (5 rows): TBD target resolution, release gates, performance test reporting, security exception management, and accessibility verification.
   - `REQ-GOV-001` through `REQ-GOV-006` (6 rows): Phase/priority identification, P0 gate definitions, future-phase gating, capability dependencies, open decision blockers, and observable criteria rules.
4. **Verification Status Integrity:** All 348 rows are honestly marked `Planned - not yet executed` (325) or `Planned - not yet executed; detailed test definition required` (23). No requirement is dishonestly claimed as verified.

### 5.2 Prioritized Traceability Remediation Plan
1. **Pass 1 (Milestone 0.6):** Map the 85 core Phase 0 and Phase 1 requirements (`ARCH-*`, `DATA-*`, `FR-AUTH-*`, `FR-DATA-*`, `FR-METRIC-*`, `SYNC-*`, `DEP-*`) directly to Sections 4–7 of `VitalSense_PRD_v1.1.md`.
2. **Pass 2 (Milestone 0.6):** Define test preconditions and objective pass/fail criteria for the 23 placeholder rows.
3. **Pass 3 (Milestone 0.7):** Complete remaining mappings for future-phase capabilities (AI, ML, Medical, Family).

---

## 6. Phase E: CI Preparation & Draft Workflow

### 6.1 Tooling & Constraints
- **Python Version:** 3.12 (standardized in `.venv` and `pyproject.toml`).
- **Dependencies:** Pinned in `requirements.txt`.
- **Ruff & Mypy:** Configured in `pyproject.toml`, but currently omitted from `requirements.txt`. They will be added as dev dependencies in Milestone 0.6.
- **Verified Local Quality Gates:**
  1. Package installation & editable link verification.
  2. Import verification (`vitalsense_common` and `services.api.main`).
  3. Pytest test suite execution (16/16 tests passing).
  4. OpenAPI 3.1.0 schema generation and drift detection (`services/export_openapi.py`).

### 6.2 Draft GitHub Actions CI Workflow
Created [.github/workflows/ci.yml](file:///e:/Projects/VITALSENSE/.github/workflows/ci.yml):
- Runs automatically on `push` and `pull_request` targeting `main` and `dev`.
- Uses Ubuntu runner with Python 3.12.
- Executes verified gates: dependency installation, import sanity check, test suite, and OpenAPI contract drift check.
- Contains zero external secrets, zero network egress dependencies, and zero deployment triggers.

---

## 7. Blockers, Risks, and Recommended Next Steps

### 7.1 Active Blockers
Implementation of Milestone 0.6 is blocked on Product Owner sign-off for the 10 P0 decisions:
- Schema migration 002 is blocked on `OD-18` (auth tables), `OD-14` (tombstones), and `OD-04` (correction lineage).
- Ingestion and sync endpoints are blocked on `OD-01` (metric definitions) and `OD-07` (retention rules).
- Mobile client initialization is blocked on `OD-16` (OS SDK targets) and `OD-17` (SQLCipher prebuild).

### 7.2 Recommended Next Milestone: Milestone 0.6
**Milestone 0.6: Core Authentication, Data Ingestion, and Offline Sync Foundation**
- Apply Migration 002 (`auth_credentials`, `auth_refresh_tokens`, `sync_tombstones`, `superseded_by_id`).
- Implement `/api/v1/*/auth` endpoints with Argon2id and JWT rotation.
- Implement `/api/v1/mobile/sync` batch sync endpoint with idempotent deduplication and tombstone distribution.
- Populate PRD trace links for Phase 0/1 requirements and resolve 23 test definition placeholders.

---

*Report compiled and ready for Product Owner review.*

