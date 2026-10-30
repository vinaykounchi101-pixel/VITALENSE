# VitalSense — Milestone 0.5.2: CI Verification & Product Owner Decision Gate Report

**Milestone:** 0.5.2 (CI Verification & Product Owner Decision Gate)  
**Date:** 2026-10-31  
**Repository:** [github.com/vinaykounchi101-pixel/VITALENSE](https://github.com/vinaykounchi101-pixel/VITALENSE)  
**Local Workspace:** `E:\Projects\VITALSENSE`  
**Active Branch:** `dev`  
**Base Commit:** `19be54f` (synchronized with `origin/dev`)  
**Auditor:** Senior Software Architect, Backend Engineer, Security Reviewer, & QA Engineer  

---

## 1. Executive Summary & Git Inspection

Milestone 0.5.2 was executed to independently verify the Continuous Integration (CI) configuration, test and validate quality gate reproduction against local backend components, conduct a deep-dive consistency review of the architecture baseline against the PRD v1.1 and merged SRS v1.1.1, and prepare the definitive, concise **Product Owner Decision Register** for the ten Priority 0 (`P0`) release blockers.

### Git State Inspection
- **Current Branch:** `dev`
- **Latest Commit on Branch:** `19be54f` (`docs: add PROGRESS.md and TECHNICAL.md tracking baseline`)
- **Remote Tracking:** Synchronized with `origin/dev`
- **Working Tree Inspection:**
  - Modified: `PROGRESS.md`, `docs/architecture/decision_workshop.md`
  - Untracked: `.github/workflows/ci.yml`, documentation reports from milestones 0.5/0.5.1, and prompt archives `008`, `009`, and `010`.
  - Zero application code, database schema, or migrations were modified or committed.

---

## 2. CI Verification (`.github/workflows/ci.yml`)

The draft GitHub Actions workflow located at [`.github/workflows/ci.yml`](file:///e:/Projects/VITALSENSE/.github/workflows/ci.yml) was audited for syntax, security posture, runner defaults, and reproducibility.

### 2.1 Workflow Component Audit

| Check / Requirement | Implementation in `.github/workflows/ci.yml` | Audit Assessment |
| :--- | :--- | :--- |
| **Workflow Syntax & Structure** | Valid YAML syntax; parsed cleanly with PyYAML `safe_load()`. | **PASS** |
| **Triggers** | `push` and `pull_request` targeting `main` and `dev` branches. | **PASS** — Prevents untested regressions from merging into stable branches. |
| **Permissions & Safe Defaults** | Top-level `permissions: contents: read` explicitly defined. | **PASS** — Adheres to the principle of least privilege, blocking unauthorized token write access. |
| **Runner & Python Setup** | `runs-on: ubuntu-latest` with `actions/setup-python@v5` pinned to Python `3.12` and `cache: "pip"`. | **PASS** — Matches project Python 3.12 runtime constraint. |
| **Dependency Installation** | `pip install --upgrade pip`, `pip install -r requirements.txt`, and `pip install -e packages/python-common --no-deps`. | **PASS** — Reproduces the exact local editable install without downloading unpinned transitive dependencies. |
| **Package Import Verification** | Two verification commands: `import vitalsense_common` and `from services.api.main import app`. | **PASS** — Catches broken package discovery and missing dependencies prior to test invocation. |
| **Test Suite Execution** | `pytest -v`. | **PASS** — Executes the complete 16-test suite using project root configuration. |
| **OpenAPI Drift Verification** | `python services/export_openapi.py` followed by `git diff --exit-code packages/api-contracts/openapi/v1.json`. | **PASS** — Guarantees that any change to router schemas fails CI if the committed OpenAPI contract is not regenerated. |
| **Secret & Infrastructure Safety** | Zero environment secrets (`${{ secrets.* }}`), zero external database dependencies, zero network deployment triggers. | **PASS** — Completely hermetic; safe to run on public or private runners. |

---

## 3. Reproduction of Quality Gates

To verify that the proposed CI pipeline mirrors local development reality, all workflow steps were executed sequentially using the project's local Python 3.12 interpreter.

### 3.1 Execution Results

```text
Interpreter: E:\Projects\VITALSENSE\.venv\Scripts\python.exe (Python 3.12.10, 64-bit)
```

1. **Step 1: vitalsense_common Import Verification**
   - Command: `.\.venv\Scripts\python.exe -c "import vitalsense_common; print('vitalsense_common import OK')"`
   - Result: `vitalsense_common import OK` (Exit Code: `0`)
2. **Step 2: FastAPI Application Import Verification**
   - Command: `.\.venv\Scripts\python.exe -c "from services.api.main import app; print('FastAPI app import OK')"`
   - Result: `FastAPI app import OK` (Exit Code: `0`)
3. **Step 3: Full Pytest Test Suite**
   - Command: `.\.venv\Scripts\python.exe -m pytest -v`
   - Result: **16 passed, 1 warning, 0 failures in 1.86s** (Exit Code: `0`)
     - `test_liveness_probe_returns_200` **PASSED**
     - `test_readiness_probe_when_database_healthy` **PASSED**
     - `test_readiness_probe_when_database_unreachable` **PASSED**
     - `test_web_api_router_status` **PASSED**
     - `test_mobile_api_router_status` **PASSED**
     - `test_correlation_id_passthrough` **PASSED**
     - `test_correlation_id_generated_when_omitted` **PASSED**
     - `test_404_standardized_error_envelope` **PASSED**
     - `test_error_envelope_structure_conformance` **PASSED**
     - `test_default_settings` **PASSED**
     - `test_invalid_environment_rejected` **PASSED**
     - `test_production_guards` **PASSED**
     - `test_cors_origins_parsing` **PASSED**
     - `test_json_formatter_structure` **PASSED**
     - `test_privacy_redaction_of_sensitive_keys` **PASSED**
     - `test_synthetic_records_structure` **PASSED**
4. **Step 4: OpenAPI Contract Drift Detection**
   - Command: `.\.venv\Scripts\python.exe services/export_openapi.py; git diff --exit-code packages/api-contracts/openapi/v1.json`
   - Output: `OpenAPI schema successfully exported to: E:\Projects\VITALSENSE\packages\api-contracts\openapi\v1.json`
   - Result: Zero diff detected (Exit Code: `0`)

### 3.2 Remote CI Status Note
*Remote GitHub Actions execution has not been triggered on GitHub because no commits or pushes have been made to the remote repository (in strict compliance with project restriction: "No commits, pushes or deployments"). Local reproduction confirms the workflow will execute cleanly once pushed.*

---

## 4. Concise Product Owner Decision Register (Ten P0 Decisions)

*All decisions below are explicitly **OPEN** or **PENDING**. None have been approved on behalf of the Product Owner.*

| Decision ID & Topic | Status | Recommended Option | Trade-offs & Consequences | Dependencies | Exact Approval Question for Product Owner |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OD-01**<br>Phase 1 Metric Set | **OPEN** | **Option A:** 5 Core Metrics (`steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`). | **+** Proven cross-platform support on HealthKit & Health Connect; low schema complexity.<br>**-** Excludes clinical biometrics (BP, Glucose). | `OD-16` (OS SDKs), `OD-04` (Manual Entry) | *Do you approve scoping Phase 1 strictly to the 5 core wellness metrics with honest empty states when wearables are absent?* |
| **OD-03**<br>Phase 0 Exit Gate | **OPEN** | **Option A:** Narrow objective verification gate (100% test pass, clean migration upgrade/downgrade, OpenAPI drift zero, probes 200). | **+** Concrete, reproducible proof before UI work.<br>**-** Live device synchronization is tested in Phase 1 once client exists. | Foundation tooling & PostgreSQL | *Do you approve declaring Phase 0 complete based on reproducible local/CI test, migration, and contract verification?* |
| **OD-04**<br>Manual Entry & Corrections | **OPEN** | **Option A:** Restricted to Phase 1 metrics; immutable revision history (`correction_state='corrected'`, `superseded_by_id`). | **+** Complete auditability (`PRV-016`); deterministic offline conflict resolution.<br>**-** Requires revision lineage foreign key in schema. | `OD-01` (Metrics), `OD-14` (Sync) | *Do you approve permitting manual entry only for approved metrics, using immutable revisions rather than in-place overwrites?* |
| **OD-07**<br>Data Retention & Minimization | **OPEN** | **Option A:** 30-day rolling raw payload retention (`raw_payload = NULL` after 30 days while keeping receipts); active normalized records kept; 30-day backup snapshot expiry. | **+** Minimizes storage bloat and breach liability; retains diagnostic window.<br>**-** Raw payloads cannot be re-parsed after 30 days. | `OD-14` (Sync), `OD-20` (Backups) | *Do you approve the 30-day rolling raw payload retention and 30-day backup expiry reconciliation policy?* |
| **OD-14**<br>Deletion Propagation & Tombstones | **OPEN** | **Option A:** Synchronization tombstones with client cursor tracking and `SYNC_CURSOR_EXPIRED` full-resync protection. | **+** Prevents stale offline devices from resurrecting deleted records ("zombie records").<br>**-** Devices offline >30 days must re-download active state. | `OD-07` (Retention), `SYNC-019` | *Do you approve synchronization tombstones with cursor expiry forcing a full resync for devices offline longer than 30 days?* |
| **OD-16**<br>Platform Support Matrix | **OPEN** | **Option A:** iOS 16.0+ (Swift HealthKit), Android 12.0+ (Health Connect API 31+), and modern evergreen browsers. Deprecate Google Fit. | **+** Targets modern vendor-supported health APIs; avoids deprecated technical debt.<br>**-** Excludes pre-Android 12 devices. | Native platform SDKs | *Do you approve iOS 16+ and Android 12+ (Health Connect) as the minimum mobile platform support baseline?* |
| **OD-17**<br>Mobile Database Encryption | **OPEN** | **Option A:** SQLite with SQLCipher (256-bit AES) via Expo Development Builds (prebuild). Keys stored in OS Keychain/KeyStore via `expo-secure-store`. Key/DB evicted on logout. | **+** Protects health data at rest against physical extraction (`SEC-008`).<br>**-** Cannot use standard Expo Go app; requires Expo prebuild native workflow. | Mobile build toolchain | *Do you approve SQLCipher with OS Keystore management and Expo Development Builds as the mobile storage architecture?* |
| **OD-18**<br>Authentication & Session Lifecycle | **OPEN** | **Option A:** Self-hosted Argon2id password hashing + rotating JWT refresh tokens stored in PostgreSQL. Token family revocation on reuse. | **+** Zero third-party SaaS costs; full data sovereignty; PostgreSQL authoritative store.<br>**-** Team owns auth security, rate limiting, and recovery flows. | `user_accounts`, `auth_credentials` | *Do you approve self-hosted Argon2id password hashing with rotating JWT refresh tokens stored in PostgreSQL?* |
| **OD-19**<br>Hosting & Service Topology | **PENDING** | **Option A:** Single co-deployed FastAPI modular monolith container serving both `/api/v1/web` and `/api/v1/mobile` namespaces backed by managed PostgreSQL. | **+** Minimal idle infrastructure cost (fits free/low tiers); shared connection pools; zero inter-service latency.<br>**-** Both APIs scale together in the same container. | Deployment runtime | *Do you approve co-deploying Web and Mobile API router namespaces as a single modular monolith rather than separate microservices?* |
| **OD-22**<br>Automation & n8n Isolation | **OPEN** | **Option A:** Backend application workers own 100% of canonical writes and PHI. n8n is strictly an external orchestrator for cron webhooks and notifications. | **+** Zero PHI leakage into n8n execution history or logs; centralized validation.<br>**-** n8n cannot execute ad-hoc database mutations directly. | Application worker layer | *Do you approve isolating n8n strictly outside the canonical health data boundary, reserving all database writes to application services?* |

---

## 5. In-Depth Scrutiny on Critical Architectural Decisions

### 5.1 OD-14: Deletion Propagation & Stale-Device Recovery
- **Problem Statement:** If a user deletes records on the Web dashboard, the server deletes the records. If an offline mobile client reconnects with local un-deleted records, standard bidirectional sync would push those records back to the server, resurrecting them ("zombie records").
- **Tombstone Mechanism:** When a record is deleted, the server writes a tombstone to `sync_tombstones`: `(person_id, record_type, target_record_id, deleted_at)`.
- **The Stale-Device Risk:** If server tombstones expire after 30 days to prevent infinite table growth, a mobile device that remains offline for 45 days will reconnect after the tombstone is gone. The server would not recognize that the incoming records were previously deleted, resulting in resurrection.
- **Recommended Recovery Architecture:**
  1. The server tracks `last_sync_timestamp` per client device identifier.
  2. When a client requests sync, if `now - last_sync_timestamp > 30 days`, the server rejects the incremental sync request with error code `SYNC_CURSOR_EXPIRED`.
  3. The mobile client receives `SYNC_CURSOR_EXPIRED` and executes a safe **Full Resynchronization**:
     - Local cached records are purged.
     - Fresh active state is downloaded from the authoritative PostgreSQL database.
     - Any locally drafted/uncommitted manual entries are presented to the user with a prompt: *"Your device has been offline for over 30 days. Sync had to reset to match server state. Would you like to re-submit your uncommitted entries?"*

### 5.2 OD-17: Expo / SQLCipher Compatibility & Key Eviction Lifecycle
- **Native Constraint:** Standard off-the-shelf Expo Go applications only bundle standard, unencrypted SQLite. They do not allow custom native C libraries like SQLCipher.
- **Feasible Workflow:** The mobile application must adopt Expo Continuous Native Generation (CNG) using `npx expo prebuild` and Expo Development Builds (`@op-engineering/op-sqlite` or `react-native-quick-sqlite` with SQLCipher).
- **Key Generation & Storage:**
  1. On first application launch, a cryptographically secure 256-bit passphrase is generated via `crypto.getRandomValues`.
  2. The key is stored in hardware-backed storage via `expo-secure-store` (iOS Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` / Android KeyStore with EncryptedSharedPreferences).
  3. The key is held only in volatile memory during an active app session.
- **Logout & Eviction Lifecycle:**
  - Upon user logout or account switching:
    1. The encryption key is permanently deleted from `expo-secure-store`.
    2. Volatile key references in memory are overwritten with zeros.
    3. The local encrypted SQLite database file is physically unlinked from device storage.
    4. A new database and key are generated if a new account logs in.

### 5.3 OD-18: Authentication & Session Lifecycle
- **Password Security:** Passwords hashed with **Argon2id** (memory: 64 MB, iterations: 3, parallelism: 4).
- **Access Tokens:** Signed stateless JWTs with 15-minute expiration containing `sub` (user_account_id), `current_person_id`, and `role`.
- **Refresh Tokens:** Opaque, cryptographically random 32-byte strings hashed using SHA-256 before storage in PostgreSQL (`auth_refresh_tokens`). Expiration: 7 days.
- **Rotation & Reuse Detection:**
  - Every time a refresh token is exchanged, it is marked as consumed, and a new refresh token is issued within the same "token family".
  - If a refresh token that was already consumed is presented to `/auth/refresh`, the system detects a potential token theft and **immediately revokes the entire token family**, invalidating all active sessions for that device.
- **Client Storage:**
  - *Web Client:* Tokens stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookies, completely immune to XSS token theft.
  - *Mobile Client:* Stored in OS Keychain / KeyStore via `expo-secure-store`.

### 5.4 OD-19: Service & Deployment Architecture Boundary Reconciliation
- **The Historical Divergence:** Early documentation references (`README.md`, `.env.example`) defined separate listening ports (`8000` for Web, `8001` for Mobile), implying two independent backend processes.
- **Specification Authority:** `ARCH-002` mandates separate API boundaries. `ARCH-006` clarifies: *"Logical boundaries do not require every folder to be a separate process/container."* `ARCH-013` specifies that co-deployment vs. separation must be decided via an ADR.
- **Evaluation & Recommendation:**
  - Co-deploying `/api/v1/web` and `/api/v1/mobile` in a single FastAPI application (`services/api/main.py`) satisfies `ARCH-002` through distinct router namespaces, schemas, and endpoints.
  - Co-deployment shares the database connection pool, prevents connection exhaustion on PostgreSQL, eliminates inter-service HTTP hops, simplifies CI/CD, and fits within free/low-tier hosting constraints.
  - Recommendation is to formally adopt **Option A (Co-deployed Modular Monolith)** and update `.env.example` and `README.md` in Milestone 0.6 to reflect the unified listening port.

---

## 6. Cross-Document Consistency Matrix

| Topic | PRD v1.1 Baseline | Merged SRS v1.1.1 | Current Codebase State | Alignment Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1 Metrics** | PRD Section 14 (OD-01): Evaluate phone vs wearable support. | FR-METRIC-004, Appendix C. | 5 provisional metrics seeded in `001_initial_core_schema.py`. | **Consistent.** Awaiting formal sign-off. |
| **Data Authority** | PRD Section 2: PostgreSQL is central authority; mobile is cache. | ARCH-004, ARCH-005. | PostgreSQL engine configured in `vitalsense_common/database.py`. | **Consistent.** |
| **Numeric Precision** | PRD Section 1: Exact tracking without distortion. | DATA-001, DATA-003. | `Numeric(14, 4)` in `HealthRecord.value`. | **Consistent.** Eliminates floating-point rounding. |
| **Data Retention** | PRD OD-07: Define lifecycle before advertising controls. | DATA-009, PRV-003, PRV-012. | Raw JSON stored; foreign keys use `CASCADE`. | **Consistent with OPEN status.** Migration 002 needed for tombstones. |
| **API Boundaries** | PRD Section 1: Separate web and mobile access. | ARCH-002, ARCH-012. | `services/web_api` & `services/mobile_api` routers mounted in `main.py`. | **Consistent.** |
| **Open Decisions** | PRD Section 14: 15 product open decisions. | SRS Section 14: 22 decisions (OD-01 to OD-22). | Open Decision Register records all 22 as OPEN. | **Consistent.** SRS adds engineering architecture decisions OD-16–22. |

---

## 7. Next Milestone Scope: Milestone 0.6 Acceptance Criteria

Upon Product Owner sign-off on the P0 Decision Register, **Milestone 0.6 (Core Authentication, Data Ingestion, and Offline Sync Foundation)** will be executed under the following acceptance criteria:

1. **Alembic Migration 002:**
   - Create `auth_credentials` (Argon2id password hashes) table.
   - Create `auth_refresh_tokens` (hashed token family) table.
   - Create `sync_tombstones` table (`person_id`, `record_type`, `target_record_id`, `deleted_at`).
   - Add `superseded_by_id` lineage foreign key to `health_records`.
2. **Authentication Service Implementation:**
   - Registration, login, token refresh, and logout endpoints under `/api/v1/web/auth` and `/api/v1/mobile/auth`.
   - Argon2id password hashing utility and JWT token generation/validation dependencies.
3. **Batch Sync & Ingestion API:**
   - Implement `/api/v1/mobile/sync` endpoint accepting batch source records and returning server changes and active tombstones.
   - Enforce idempotent ingestion using `uq_source_records_idempotency`.
   - Handle `SYNC_CURSOR_EXPIRED` full-resynchronization signal.
4. **Automated CI Activation:**
   - Commit `.github/workflows/ci.yml` to repository so automated PR checks run on GitHub.
5. **Traceability Remediation (Pass 1):**
   - Populate PRD v1.1 section links for all Phase 0 and Phase 1 requirements in `docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv`.

---

*Report compiled and ready for Product Owner review.*

