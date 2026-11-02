# VitalSense — Milestone 0.5.3: Product Owner Decision Review & Architecture Finalization Report

**Milestone:** 0.5.3 (Product Owner Decision Review & Architecture Finalization)  
**Date:** 2026-10-31  
**Project:** VitalSense Personal Health & Wellness Platform  
**Active Specifications:** [VitalSense_SRS_v1.1.1_Merged.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Merged.md) | [VitalSense_PRD_v1.1.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_PRD_v1.1.md)  
**Active Branch:** `dev`  
**Repository:** [github.com/vinaykounchi101-pixel/VITALENSE](https://github.com/vinaykounchi101-pixel/VITALENSE)  
**Reviewers:** Lead Software Architect, Security Reviewer, Backend Engineer, QA Engineer  

---

## 1. Executive Summary & Purpose

Milestone 0.5.3 provides the exhaustive, evidence-based review for the ten Priority 0 (`P0`) architectural, security, and product decisions (`OD-01`, `OD-03`, `OD-04`, `OD-07`, `OD-14`, `OD-16`, `OD-17`, `OD-18`, `OD-19`, and `OD-22`). 

These ten decisions govern:
1. **Core Data Scope:** Supported Phase 1 health metrics and manual entry behavior.
2. **Quality & Release Gates:** Concrete criteria for Phase 0 completion and platform support baseline.
3. **Data Lifecycle & Compliance:** Retention, deletion propagation, offline synchronization, and tombstone expiry.
4. **Security & Privacy Architecture:** Mobile database encryption, key management, and identity/session lifecycle.
5. **System Boundaries:** Service hosting topology and strict application worker vs. n8n automation boundaries.

### Strict Governance Constraints Followed
- **Zero Premature Approvals:** Every decision is presented with options, recommendations, and trade-offs. All statuses remain explicitly **OPEN** or **PENDING PRODUCT-OWNER APPROVAL**.
- **Zero Implementation Drift:** No feature code, schema changes, Alembic migrations, or API endpoints have been implemented.
- **Zero Git Modifications:** No commits, pushes, or deployments have been executed.

---

## 2. Individual Decision Evaluations (Ten P0 Decisions)

---

### OD-01 — Exact Phase 1 Metric Categories and Source Integrations

- **Decision Title:** Exact Phase 1 metric categories, canonical units, and native source integrations.
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-DATA-001` through `FR-DATA-013`, `FR-METRIC-001` through `FR-METRIC-005`, `IF-HEALTH-*`, `Appendix C`.
- **Current Repository State:**
  - Migration `001_initial_core_schema.py` seeds 5 provisional `metric_definitions` rows: `steps` (count), `heart_rate` (bpm), `sleep_session` (minutes), `active_energy` (kcal), and `workout_session` (minutes).
  - Validation rules enforce exact `Numeric(14, 4)` precision and strictly positive bounds.

#### Evidence-Based Options
1. **Option A (Recommended Default — 5 Core Wellness Metrics with Honest Empty States):**
   - Scope Phase 1 strictly to the 5 provisional metrics.
   - Categorize sensor feasibility:
     - *Phone-native sensor:* `steps` (accelerometer/pedometer available on standard hardware).
     - *Wearable / Companion required:* `heart_rate` (optical PPG), `sleep_session` (wearable or sleep tracker), `active_energy` (platform calculated), `workout_session` (logged activity).
   - *Data Integrity Rule:* If no companion device is paired or data is absent, the client **must display an honest empty state** ("No wearable connected" or "No data recorded"). It must **never fabricate or assume zero values**, which would distort health statistics.
2. **Option B (Expanded Clinical Biometrics):**
   - Add `resting_heart_rate`, `blood_pressure_systolic`, `blood_pressure_diastolic`, `blood_oxygen_saturation` (SpO2), and `blood_glucose`.
3. **Option C (Minimalist):**
   - Restrict Phase 1 strictly to `steps` and `sleep_session`.

#### Trade-offs & Consequences
- **Option A Advantages:** High reliability across both Apple HealthKit and Android Health Connect; requires zero additional database migrations for metric definitions; eliminates clinical validation risk in Phase 1.
- **Option B Disadvantages:** Introduces compound observation schemas (e.g. dual systolic/diastolic blood pressure readings); triggers clinical intended-use scrutiny (`OD-12`) prematurely.
- **Option C Disadvantages:** Limits user value and prevents validating wearable synchronization pipelines.

#### Dependencies
- Depends on `OD-16` (HealthKit & Health Connect OS SDK availability) and `OD-04` (manual entry fallback for non-wearable users).

#### Recommendation
**Option A**. Scope Phase 1 strictly to the 5 core wellness metrics with strict empty-state handling.

#### Exact Approval Question for Product Owner
> *"Do you approve scoping the Phase 1 release strictly to the 5 core metrics (`steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`) with mandatory honest empty states when wearable hardware is unavailable?"*

---

### OD-03 — Acceptance Criteria for First Deployable Milestone (Phase 0 Exit Gate)

- **Decision Title:** Acceptance criteria for declaring Phase 0 complete and approving the transition to user-facing development.
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `DEP-*`, `ARCH-*`, `NFR-*`, `SYNC-*`, `Section 16`.
- **Current Repository State:**
  - Milestones 0.1 through 0.5.2 complete in repository.
  - Automated test harness passing (16/16 tests).
  - Clean Alembic migration upgrade to `head` and downgrade to `base` verified on PostgreSQL.
  - OpenAPI 3.1.0 contract validated with zero schema drift.
  - Operational health probes (`/health`, `/ready`) responsive.

#### Evidence-Based Options
1. **Option A (Recommended Default — Verifiable Foundation Slice Gate):**
   - Phase 0 is formally accepted when the following 5 criteria are verified:
     1. Automated test suite runs clean with 100% pass rate in CI and local runner.
     2. Database migration cleanly applies to `head` and safely downgrades to `base` on PostgreSQL.
     3. OpenAPI 3.1.0 schema specification exhibits zero drift against router code.
     4. Synthetic ingestion fixtures parse and persist without floating-point distortion.
     5. Operational probes (`/health`, `/ready`) return HTTP 200 with accurate dependency status.
2. **Option B (Full Cloud & Device Gate):**
   - Require complete compiled mobile application binaries (APK/IPA) running against cloud-deployed staging infrastructure before accepting Phase 0.

#### Trade-offs & Consequences
- **Option A Advantages:** Objective, immediate, reproducible, and decoupled from external cloud hosting costs or app store provisioning delays. Establishes a solid baseline for Phase 1.
- **Option B Disadvantages:** Stalls backend and mobile development for weeks while awaiting cloud account provisioning and deployment pipelines.

#### Dependencies
- None; all five verification points under Option A are already locally verified in Milestone 0.5.2.

#### Recommendation
**Option A**. Formally close Phase 0 upon Product Owner sign-off using the verifiable 5-point gate.

#### Exact Approval Question for Product Owner
> *"Do you approve declaring Phase 0 foundation complete based on the 5 objective verification criteria (automated test suite pass, migration reversibility, zero OpenAPI drift, synthetic ingestion integrity, and health probe operation)?"*

---

### OD-04 — Exact Manual-Entry Categories and Correction Behavior

- **Decision Title:** Exact manual-entry categories, validation bounds, and correction/lineage behavior.
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-MAN-001` through `FR-MAN-005`, `FR-METRIC-*`, `FR-QUAL-006`, `SYNC-017/018`, `Appendix C`.
- **Current Repository State:**
  - `HealthRecord` model contains `origin: Mapped[str]` (defaults to `source_imported`) and `correction_state: Mapped[str]` (`active`, `corrected`, `superseded`).
  - Does not yet contain a `superseded_by_id` revision lineage foreign key.

#### Evidence-Based Options
1. **Option A (Recommended Default — Restricted to Approved Metrics with Immutable Revision Lineage):**
   - Allow manual entry exclusively for the approved Phase 1 metrics.
   - Manual entries receive `origin = 'user_entered'`.
   - Edits **never overwrite records in place**. Instead, an edit creates a new record with `correction_state = 'corrected'`, while updating the prior record to `correction_state = 'superseded'` with `superseded_by_id` pointing to the new revision.
   - Deletions write a tombstone record rather than physically dropping rows.
2. **Option B (Unrestricted Free-Form Manual Entry):**
   - Allow users to enter arbitrary metric names, units, and values without pre-defined bounds.
3. **Option C (In-Place Mutable Overwrites):**
   - Allow direct SQL `UPDATE` queries on `health_records`, overwriting previous values without revision tracking.

#### Trade-offs & Consequences
- **Option A Advantages:** Complies with healthcare auditability standards (`PRV-016`, `DATA-002`); prevents accidental data loss; provides deterministic offline conflict resolution during sync.
- **Option B Disadvantages:** Destroys analytical consistency; creates validation bypasses.
- **Option C Disadvantages:** Discards audit history; makes offline sync conflicts unresolvable.

#### Dependencies
- Depends on `OD-01` (approved metrics) and `OD-14` (tombstone synchronization).

#### Recommendation
**Option A**. Implement immutable revision lineage with `origin='user_entered'` and schema foreign key `superseded_by_id` in Migration 002.

#### Exact Approval Question for Product Owner
> *"Do you approve permitting manual entry strictly for approved Phase 1 metrics, using an immutable revision history (`superseded_by_id`) rather than in-place overwrites?"*

---

### OD-07 — Retention, Export, Deletion, Derived Outputs, Caches, and Backups

- **Decision Title:** Data retention windows, storage minimization, account deletion grace period, and backup reconciliation.
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-PRIV-004` through `FR-PRIV-007`, `PRV-003/005–007`, `DATA-009`, `SYNC-009/019`, `PRV-012–016`, `Appendix D`.
- **Current Repository State:**
  - `source_records.raw_payload` stores full raw JSON indefinitely.
  - Foreign keys use `ON DELETE CASCADE`.

#### Evidence-Based Options
1. **Option A (Recommended Default — 30-Day Rolling Raw Minimization & Backup Reconciliation):**
   - *Raw Source Payloads (`source_records.raw_payload`):* Retained for 30 days post-ingestion for debugging, re-parsing, and idempotency verification. After 30 days, a scheduled worker sets `raw_payload = NULL` while preserving receipt metadata (`idempotency_key`, `source_name`, `ingested_at`).
   - *Normalized Health Records (`health_records`):* Retained indefinitely while the user account is active.
   - *Server Logs:* 14-day retention limit; 100% PHI/PII redaction enforced in `vitalsense_common/logging.py`.
   - *Account Deletion Requests:* Enforces a 30-day grace period (status: `deletion_pending`). After 30 days, all personal records are hard-deleted.
   - *Database Backups:* Rolling automated backups expire after 30 days. Restores must run a deletion-reconciliation script against `audit_events` to purge accounts deleted after the snapshot date (`NFR-REL-010`).
2. **Option B (Perpetual Raw Payload Retention):**
   - Store all raw vendor JSON payloads forever; retain backups indefinitely.
3. **Option C (Immediate Raw Payload Discard):**
   - Discard raw vendor JSON immediately after ingestion parsing (`raw_payload = NULL` upon insert).

#### Trade-offs & Consequences
- **Option A Advantages:** Enforces GDPR/HIPAA storage minimization; eliminates long-term storage cost bloat; maintains a 30-day diagnostic window for mobile sync bugs; prevents deleted data from being resurrected by database backups.
- **Option B Disadvantages:** Massive liability in the event of a security breach; runaway database storage costs.
- **Option C Disadvantages:** Renders post-incident debugging or re-normalization of corrupt data impossible.

#### Dependencies
- Interacts directly with `OD-14` (tombstone retention window) and `OD-20` (backup RPO/RTO).

#### Recommendation
**Option A**. Adopt the 30-day rolling raw payload retention, 30-day backup snapshot lifecycle, and restore reconciliation policy.

#### Exact Approval Question for Product Owner
> *"Do you approve the 30-day rolling retention policy for raw ingestion payloads (`raw_payload = NULL` after 30 days) and the 30-day backup snapshot expiry with restore reconciliation?"*

---

### OD-14 — Deletion Propagation, Tombstones, and Offline Synchronization

- **Decision Title:** Record and account deletion propagation, synchronization tombstones, and stale-device recovery.
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-PRIV-004`, `PRV-005–007`, `PRV-012`, `SYNC-019`, `Appendix D`.
- **Current Repository State:**
  - Relational schema uses physical deletion via `ON DELETE CASCADE`.
  - No tombstone table exists currently.

#### The Critical Stale-Device Risk ("Zombie Record Resurrection")
If server tombstones are purged after 30 days, a mobile device that remains offline for >30 days will reconnect with cached records. Because the server tombstone has expired, the server cannot recognize that the records were deleted on the web, causing deleted records to be resurrected.

#### Evidence-Based Options
1. **Option A (Recommended Default — Synchronization Tombstones with Cursor Expiry):**
   - Add a lightweight `sync_tombstones` table: `(id, person_id, record_type, target_record_id, deleted_at)`.
   - Deletions write a tombstone entry. The sync endpoint returns active tombstones so clients delete local cached records before uploading pending changes.
   - *Stale-Device Guard:* The server tracks `last_sync_timestamp` per client device. If a device has been offline longer than the tombstone retention window (>30 days), the server rejects incremental sync with error code `SYNC_CURSOR_EXPIRED`.
   - *Client Recovery:* On `SYNC_CURSOR_EXPIRED`, the mobile client purges its local cache, re-downloads authoritative active state from the server, and prompts the user regarding any uncommitted offline drafts.
2. **Option B (Full Cache Wipe on Every Sync):**
   - Do not use tombstones. Mobile clients perform a complete local wipe and re-download of all records on every sync pass.

#### Trade-offs & Consequences
- **Option A Advantages:** Prevents zombie record resurrection; minimizes mobile bandwidth and battery usage; supports smooth offline operation for normal usage (<30 days offline).
- **Option B Disadvantages:** Enormous cellular data consumption; sluggish sync latency; severe mobile battery drain.

#### Dependencies
- Depends on `OD-07` (30-day retention alignment) and `SYNC-019`.

#### Recommendation
**Option A**. Introduce `sync_tombstones` in Migration 002 with `SYNC_CURSOR_EXPIRED` enforcement.

#### Exact Approval Question for Product Owner
> *"Do you approve the synchronization tombstone architecture with client cursor tracking and mandatory full-resynchronization (`SYNC_CURSOR_EXPIRED`) for devices offline over 30 days?"*

---

### OD-16 — Minimum Supported OS and Browser Versions

- **Decision Title:** Minimum supported operating systems, browser engines, and native health framework APIs.
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `NFR-COMP-001` through `NFR-COMP-003`, `FR-DATA-001/002`, `IF-CLIENT-*`, `Appendix C/F`.
- **Current Repository State:** Not formally codified in mobile project settings (mobile app workspace pending).

#### Evidence-Based Options
1. **Option A (Recommended Default — Modern Native Baseline):**
   - **iOS:** iOS 16.0+ (requires modern Swift HealthKit APIs; covers >95% of active iOS devices).
   - **Android:** Android 12.0+ (API level 31+) with Google Health Connect (native on Android 14+, downloadable via Play Store on Android 12–13). Excludes deprecated Google Fit APIs.
   - **Web Browsers:** Modern evergreen desktop/mobile browsers: Chrome 115+, Firefox 115+, Safari 16+, Edge 115+.
2. **Option B (Legacy Android Support):**
   - Support Android 9.0–11.0 using the legacy Google Fit REST and Android SDK.

#### Trade-offs & Consequences
- **Option A Advantages:** Targets active, modern, vendor-supported health APIs (HealthKit & Health Connect); eliminates technical debt from Google Fit (which Google is deprecating); provides consistent permission and background sync models.
- **Option B Disadvantages:** Forces the team to build and maintain two completely separate Android health ingestion engines, one of which has an impending sunset date.

#### Dependencies
- Direct dependency for `apps/mobile` configuration and native build manifests.

#### Recommendation
**Option A**. Approve iOS 16+ and Android 12+ (Health Connect) as the mobile foundation.

#### Exact Approval Question for Product Owner
> *"Do you approve iOS 16.0+ and Android 12.0+ (Health Connect API 31+) as the minimum mobile operating system support baseline, excluding deprecated Google Fit APIs?"*

---

### OD-17 — Mobile Database Encryption and Secure Key Management

- **Decision Title:** Mobile local database technology, encryption at rest, and hardware key storage lifecycle.
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `SEC-008`, `SYNC-001` through `SYNC-013`, `ARCH-005`, `FR-PRIV-004`, `PRV-014`.
- **Current Repository State:** Mobile client workspace not yet initialized; no local database implemented.

#### Technical Constraint Note on Expo
Standard off-the-shelf Expo Go applications only bundle standard, unencrypted SQLite. Supporting encrypted SQLite (SQLCipher) requires **Expo Continuous Native Generation (CNG)** using `npx expo prebuild` and custom Development Builds (`@op-engineering/op-sqlite`).

#### Evidence-Based Options
1. **Option A (Recommended Default — SQLCipher 256-bit AES + OS Keystore):**
   - Encrypt mobile SQLite database at rest using SQLCipher (256-bit AES).
   - Key generation: 256-bit cryptographic key generated on first launch via `crypto.getRandomValues`.
   - Key storage: Stored strictly in hardware-backed storage via `expo-secure-store` (iOS Keychain / Android KeyStore).
   - Session Lifecycle: Key exists in volatile memory only while the user is actively logged in.
   - Logout / Eviction: Key is permanently deleted from Keychain/KeyStore, in-memory key references are zeroed, and the local database file is physically unlinked.
2. **Option B (Unencrypted SQLite with OS Sandbox Only):**
   - Standard unencrypted SQLite relying solely on standard mobile OS application sandboxing. Compatible with standard Expo Go.

#### Trade-offs & Consequences
- **Option A Advantages:** Full compliance with health data protection requirements (`SEC-008`); protects user data against device forensics, unencrypted backup extractions, or rooted device access.
- **Option A Disadvantages:** Requires Expo Development Builds (`npx expo run:android` / `npx expo run:ios`) rather than the basic Expo Go mobile app.
- **Option B Disadvantages:** Exposes unencrypted health records to file extraction if a device is compromised or backed up to an unencrypted computer.

#### Dependencies
- Direct dependency for mobile client architecture and build pipeline.

#### Recommendation
**Option A**. Mandate SQLCipher 256-bit AES encryption with hardware keystore key management.

#### Exact Approval Question for Product Owner
> *"Do you approve SQLCipher (256-bit AES) with hardware keystore key management and Expo Development Builds as the mandatory mobile local storage architecture?"*

---

### OD-18 — Authentication Strategy and Session Lifecycle

- **Decision Title:** Identity provider architecture, credential storage, token lifecycle, and session management.
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-AUTH-001` through `FR-AUTH-008`, `SEC-001` through `SEC-011`, `IF-API-014`.
- **Current Repository State:**
  - `UserAccount` model exists with `id`, `email`, and `status`.
  - No credential or refresh token tables exist.

#### Evidence-Based Options
1. **Option A (Recommended Default — Self-Hosted Argon2id + Rotating JWT Refresh Tokens):**
   - *Primary Auth:* Email + Password using **Argon2id** password hashing (memory: 64 MB, iterations: 3, parallelism: 4).
   - *Secondary Auth (Phase 1.5):* Social login via OAuth2 PKCE (Apple Sign-In & Google Sign-In).
   - *Access Tokens:* Signed stateless JWTs (15-minute expiry) containing `sub` (account_id), `person_id`, and `role`.
   - *Refresh Tokens:* Cryptographically secure random 32-byte tokens hashed with SHA-256 before storage in PostgreSQL table `auth_refresh_tokens` (7-day expiry).
   - *Rotation & Reuse Detection:* Exchanging a refresh token invalidates it and issues a new token in the same token family. If an already-consumed token is presented, the system detects theft and **immediately revokes the entire token family**.
   - *Client Storage:* Web uses `HttpOnly; Secure; SameSite=Strict` cookies (immune to XSS). Mobile uses `expo-secure-store`.
2. **Option B (Managed Identity SaaS — Supabase Auth / Clerk):**
   - Outsource user authentication and token issuance to a third-party managed provider.
3. **Option C (Passwordless Magic Links Only):**
   - Rely exclusively on email magic links for login.

#### Trade-offs & Consequences
- **Option A Advantages:** Zero recurring third-party SaaS license costs; complete data sovereignty; preserves PostgreSQL as authoritative store; eliminates vendor lock-in.
- **Option B Disadvantages:** Incurs recurring costs past free tiers; splinters user identities outside the primary database; complicates multi-person context switching (`ARCH-010`).
- **Option C Disadvantages:** Extreme friction on mobile devices where switching to an email app can terminate pending sync or app initialization.

#### Dependencies
- Requires adding `auth_credentials` and `auth_refresh_tokens` tables in Alembic Migration 002.

#### Recommendation
**Option A**. Implement self-hosted Argon2id authentication with rotating refresh token families in PostgreSQL.

#### Exact Approval Question for Product Owner
> *"Do you approve the self-hosted authentication architecture using Argon2id password hashing and rotating JWT refresh tokens stored in PostgreSQL?"*

---

### OD-19 — Hosting Topology and Service Boundary

- **Decision Title:** Service deployment topology: Co-deployed Modular Monolith vs. Distributed Microservices.
- **Current Status:** **PENDING PRODUCT-OWNER APPROVAL (Reconciling ARCH-002 vs ARCH-006/013)**
- **Affected Requirements:** `ARCH-001` through `ARCH-015`, `DEP-*`, `NFR-REL-*`, `Section 11`, `Appendix E.5`.
- **Current Repository State:**
  - Modular monolith implemented in `services/api/main.py`.
  - Mounts isolated router namespaces: `services/web_api/router.py` (`/api/v1/web`) and `services/mobile_api/router.py` (`/api/v1/mobile`).

#### Evidence-Based Options
1. **Option A (Recommended Default — Co-deployed Modular Monolith):**
   - Single FastAPI backend service container hosting both Web and Mobile API routing namespaces.
   - Shared asynchronous PostgreSQL connection pool (`asyncpg`).
   - Background workers run as a separate entrypoint using the same codebase container.
   - Web frontend deployed to Vercel or static container.
2. **Option B (Distributed Microservices):**
   - Separate containers, repositories/deployments, and independent database connection pools for Web API, Mobile API, Ingestion Service, and Sync Service.

#### Trade-offs & Consequences
- **Option A Advantages:** Minimizes idle infrastructure cost (fits within free/low-tier hosting limits); prevents PostgreSQL connection pool exhaustion; eliminates distributed network latency and failure modes; preserves strict modular code boundaries.
- **Option B Disadvantages:** Severe operational complexity; multiple deployment pipelines; distributed tracing overhead; high cloud hosting costs without traffic justification.

#### Dependencies
- Sets the deployment baseline for Docker and hosting infrastructure configurations.

#### Recommendation
**Option A**. Formally ratify the co-deployed modular monolith topology and reconcile documentation references.

#### Exact Approval Question for Product Owner
> *"Do you approve co-deploying the Web and Mobile API router namespaces as a single modular monolith application container backed by managed PostgreSQL?"*

---

### OD-22 — Automation Boundary: Application Workers vs. n8n

- **Decision Title:** Responsibility boundary between backend application workers and the external n8n workflow engine.
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-AUTO-001` through `FR-AUTO-013`, `IF-AUTO-001` through `IF-AUTO-005`, `ARCH-008/015`, `Appendix E.4`.
- **Current Repository State:**
  - Placeholder `services/` structure; zero direct database bindings from external tools.

#### Evidence-Based Options
1. **Option A (Recommended Default — Strict Healthcare Privacy Boundary):**
   - **Backend Application Workers:** Own 100% of canonical database writes, health record validation, PHI processing, raw payload parsing, and authentication/authorization checks.
   - **n8n Automation Engine:** Operates strictly outside the PHI boundary. Used exclusively for workflow orchestration, triggering cron jobs via authenticated internal API webhooks (e.g. triggering batch retention cleanup), and dispatching user-approved notifications. n8n **never connects directly to PostgreSQL** and **never logs or stores unencrypted health metrics**.
2. **Option B (Direct n8n Ingestion & Database Access):**
   - Grant n8n direct SQL read/write credentials to PostgreSQL to parse vendor payloads and run database mutations.

#### Trade-offs & Consequences
- **Option A Advantages:** Complete protection of sensitive health data (`PRV-011`, `SEC-001`); centralized data validation; prevents rogue workflows from corrupting database state.
- **Option B Disadvantages:** Severe compliance and security risk; leaks PHI into n8n execution history; fragments business logic across application code and visual workflow scripts.

#### Dependencies
- Defines internal webhook endpoints under `/api/v1/internal/automation/*` protected by service tokens.

#### Recommendation
**Option A**. Mandate the strict isolation of n8n outside the canonical health data boundary.

#### Exact Approval Question for Product Owner
> *"Do you approve isolating n8n strictly outside the canonical health data boundary, reserving 100% of database writes and PHI handling to backend application workers?"*

---

## 3. Product Owner Decision Register Summary

| Decision ID & Topic | Current Status | Recommended Option | Trade-offs & Consequences | Exact Approval Question |
| :--- | :--- | :--- | :--- | :--- |
| **OD-01**<br>Phase 1 Metric Set | **OPEN** | **Option A:** 5 Core Metrics (`steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`). | **+** Proven cross-platform support on HealthKit & Health Connect; low schema complexity.<br>**-** Excludes clinical biometrics (BP, Glucose). | *Do you approve scoping Phase 1 strictly to the 5 core wellness metrics with honest empty states when wearables are absent?* |
| **OD-03**<br>Phase 0 Exit Gate | **OPEN** | **Option A:** 5 Verifiable Criteria (100% test pass, clean migration upgrade/downgrade, OpenAPI drift zero, probes 200). | **+** Objective, reproducible proof before UI work.<br>**-** Live device synchronization is tested in Phase 1 once client exists. | *Do you approve declaring Phase 0 complete based on reproducible local/CI test, migration, and contract verification?* |
| **OD-04**<br>Manual Entry & Corrections | **OPEN** | **Option A:** Restricted to Phase 1 metrics; immutable revision history (`correction_state='corrected'`, `superseded_by_id`). | **+** Complete auditability (`PRV-016`); deterministic offline conflict resolution.<br>**-** Requires revision lineage foreign key in schema. | *Do you approve permitting manual entry only for approved metrics, using immutable revisions rather than in-place overwrites?* |
| **OD-07**<br>Data Retention & Minimization | **OPEN** | **Option A:** 30-day rolling raw payload retention (`raw_payload = NULL` after 30 days while keeping receipts); active normalized records kept; 30-day backup snapshot expiry. | **+** Minimizes storage bloat and breach liability; retains diagnostic window.<br>**-** Raw payloads cannot be re-parsed after 30 days. | *Do you approve the 30-day rolling raw payload retention and 30-day backup expiry reconciliation policy?* |
| **OD-14**<br>Deletion Propagation & Tombstones | **OPEN** | **Option A:** Synchronization tombstones with client cursor tracking and `SYNC_CURSOR_EXPIRED` full-resync protection. | **+** Prevents stale offline devices from resurrecting deleted records ("zombie records").<br>**-** Devices offline >30 days must re-download active state. | *Do you approve synchronization tombstones with cursor expiry forcing a full resync for devices offline longer than 30 days?* |
| **OD-16**<br>Platform Support Matrix | **OPEN** | **Option A:** iOS 16.0+ (Swift HealthKit), Android 12.0+ (Health Connect API 31+), and modern evergreen browsers. Deprecate Google Fit. | **+** Targets modern vendor-supported health APIs; avoids deprecated technical debt.<br>**-** Excludes pre-Android 12 devices. | *Do you approve iOS 16+ and Android 12+ (Health Connect) as the minimum mobile platform support baseline?* |
| **OD-17**<br>Mobile Database Encryption | **OPEN** | **Option A:** SQLite with SQLCipher (256-bit AES) via Expo Development Builds. Keys stored in OS Keychain/KeyStore via `expo-secure-store`. Key/DB evicted on logout. | **+** Protects health data at rest against physical extraction (`SEC-008`).<br>**-** Cannot use standard Expo Go app; requires Expo prebuild native workflow. | *Do you approve SQLCipher with OS Keystore management and Expo Development Builds as the mobile storage architecture?* |
| **OD-18**<br>Authentication & Session Lifecycle | **OPEN** | **Option A:** Self-hosted Argon2id password hashing + rotating JWT refresh tokens stored in PostgreSQL. Token family revocation on reuse. | **+** Zero third-party SaaS costs; full data sovereignty; PostgreSQL authoritative store.<br>**-** Team owns auth security, rate limiting, and recovery flows. | *Do you approve self-hosted Argon2id password hashing with rotating JWT refresh tokens stored in PostgreSQL?* |
| **OD-19**<br>Hosting & Service Topology | **PENDING** | **Option A:** Single co-deployed FastAPI modular monolith container serving both `/api/v1/web` and `/api/v1/mobile` namespaces backed by managed PostgreSQL. | **+** Minimal idle infrastructure cost (fits free/low tiers); shared connection pools; zero inter-service latency.<br>**-** Both APIs scale together in the same container. | *Do you approve co-deploying Web and Mobile API router namespaces as a single modular monolith rather than separate microservices?* |
| **OD-22**<br>Automation & n8n Isolation | **OPEN** | **Option A:** Backend application workers own 100% of canonical writes and PHI. n8n is strictly an external orchestrator for cron webhooks and notifications. | **+** Zero PHI leakage into n8n execution history or logs; centralized validation.<br>**-** n8n cannot execute ad-hoc database mutations directly. | *Do you approve isolating n8n strictly outside the canonical health data boundary, reserving all database writes to application services?* |

---

## 4. Product Owner Action Items

To unblock **Milestone 0.6 (Core Authentication, Data Ingestion, and Offline Sync Foundation)**, the Product Owner may review and approve each of the ten decisions using the table below:

```text
[ ] OD-01: Phase 1 Metrics (Option A — 5 core wellness metrics with honest empty states)
[ ] OD-03: Phase 0 Exit Criteria (Option A — 5-point verifiable foundation gate)
[ ] OD-04: Manual Entry & Corrections (Option A — Phase 1 metrics only with immutable revision lineage)
[ ] OD-07: Data Retention & Minimization (Option A — 30-day raw payload expiry & backup reconciliation)
[ ] OD-14: Sync Deletions & Tombstones (Option A — Sync tombstones with SYNC_CURSOR_EXPIRED recovery)
[ ] OD-16: Platform Matrix (Option A — iOS 16+, Android 12+ Health Connect, evergreen web)
[ ] OD-17: Mobile DB Encryption (Option A — SQLCipher 256-bit AES + OS Keystore + Expo Prebuild)
[ ] OD-18: Authentication Architecture (Option A — Self-hosted Argon2id + rotating JWT refresh tokens)
[ ] OD-19: Service Topology (Option A — Co-deployed Modular Monolith in single container)
[ ] OD-22: Automation Boundary (Option A — Application workers own 100% writes/PHI; n8n external)
```

---

*End of Milestone 0.5.3 Decision Review Report. Stopping execution awaiting Product Owner approval.*

