# VitalSense Architecture & Product-Owner Decision Workshop (Milestone 0.5)

**Document Purpose:** This workshop document synthesizes all 22 open product and architectural decisions (`OD-01` through `OD-22`) from [VitalSense_SRS_v1.1.1_Open_Decision_Register.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Open_Decision_Register.md) into concrete, actionable choice sets for explicit Product Owner sign-off.

**Status Convention:** Every item below is explicitly **OPEN**. Recommendations are provided as technical proposals based on architectural feasibility, security/privacy constraints, and repository foundations; they do not constitute product-owner approval.

---

## 1. Decision Prioritization Overview

| Priority | Definition | Decisions Included | Gate / Deadline |
| :--- | :--- | :--- | :--- |
| **P0 (Critical Blockers)** | Must be settled before security-sensitive implementation, authentication, sync, or schema changes. | `OD-01`, `OD-03`, `OD-04`, `OD-07`, `OD-14`, `OD-16`, `OD-17`, `OD-18`, `OD-19`, `OD-22` | Mandatory before Phase 1 schema freeze & Milestone 0.6 implementation |
| **P1 (Near-Term Gates)** | Needed before specific user-facing or operational features are implemented. | `OD-02`, `OD-05`, `OD-10`, `OD-15`, `OD-20`, `OD-21` | Before affected feature implementation or production deployment |
| **P2 (Future Deferrals)** | Can remain explicitly deferred without blocking the first vertical slice. | `OD-06`, `OD-08`, `OD-09`, `OD-11`, `OD-12`, `OD-13` | Phase 2, 3, 4, or 5 feature gates |

---

## 2. Priority 0 (P0) Decisions: Implementation & Security Blockers

---

### OD-01 — Exact Phase 1 Metric Categories and Source Integrations
- **Exact Question:** Which exact metric categories and source integrations are included in the Phase 1 initial release, distinguishing metric definitions from verified device/source support?
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-DATA-001`–`013`, `FR-METRIC-001`–`005`, `IF-HEALTH-*`, `Appendix C`
- **Current Repository State:** Migration `001_initial_core_schema.py` seeds 5 provisional metric definitions: `steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`.
- **Available Options:**
  - **Option A (Recommended Default):** Scope Phase 1 strictly to the 5 provisional metrics (`steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`). Distinguish platform feasibility:
    - *Phone native sensor:* `steps` (accelerometer/pedometer).
    - *Wearable / Companion required:* `heart_rate` (optical PPG), `sleep_session` (wearable or sleep tracker), `active_energy` (platform calculated), `workout_session` (logged activity).
    - *Data Integrity Rule:* If no wearable or companion data is available, the UI **must never fabricate zero values**. Missing or delayed data must be displayed honestly as an empty state ("No paired device" / "No data recorded").
  - **Option B (Expanded Biometrics):** Add `resting_heart_rate`, `blood_pressure_systolic`, `blood_pressure_diastolic`, `blood_oxygen_saturation` (SpO2), and `weight`.
  - **Option C (Minimalist):** Restrict Phase 1 strictly to `steps` and `sleep_session`.
- **Dependencies & Trade-offs:**
  - Depends on `OD-16` (OS permissions for HealthKit & Health Connect) and `OD-04` (manual entry fallback).
  - *Option A* balances user utility with verified cross-platform feasibility.
  - *Option B* introduces clinical vitals before medical validation (`OD-12`), increasing liability.
- **Consequences:**
  - *Schema:* Option A requires no migration changes. Option B requires adding metric definitions and compound observation models (e.g., dual systolic/diastolic blood pressure).
  - *Testing:* Requires cross-platform mock ingestion testing for both phone-native and wearable-synced streams.
- **Recommendation:** **Option A**. Keeps Phase 1 deliverable, honest, and achievable without clinical overreach.
- **Approval Required from Owner:** Confirm approval of the 5 core Phase 1 metrics (or specify exact additions/removals).

---

### OD-03 — Acceptance Criteria for First Deployable Milestone (Phase 0 Exit)
- **Exact Question:** What are the explicit, objective acceptance criteria for declaring Phase 0 complete and approving transition into Phase 1 user-facing development?
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `DEP-*`, `ARCH-*`, `NFR-*`, `SYNC-*`, `Section 16`
- **Current Repository State:** Milestones 0.1 through 0.4 complete in repository; local environment baseline initialized; test harness present; OpenAPI contract exported.
- **Available Options:**
  - **Option A (Recommended Default):** Approve a narrow vertical slice gate:
    1. Automated test suite runs clean with 100% pass rate in CI/local runner.
    2. Alembic migration upgrade to `head` and downgrade to `base` executed and verified on clean database.
    3. OpenAPI 3.1.0 contract validated with zero schema drift.
    4. Synthetic sync fixture successfully ingested into `source_records` and normalized into `health_records` with zero floating-point error.
    5. Operational probes (`/health`, `/ready`) respond with standard HTTP status codes.
  - **Option B:** Require full end-to-end mobile build artifact (APK/IPA) running against deployed cloud backend before accepting Phase 0.
- **Dependencies & Trade-offs:**
  - *Option A* provides an objective, verifiable engineering milestone before committing to UI and device-specific builds.
  - *Option B* delays foundation closure by months and entangles infrastructure provisioning with core data contracts.
- **Consequences:**
  - Sets measurable gate preventing premature feature build on an unstable foundation.
- **Recommendation:** **Option A**.
- **Approval Required from Owner:** Approve Phase 0 exit criteria (Option A).

---

### OD-04 — Exact Manual-Entry Categories and Correction Behavior
- **Exact Question:** Which metrics permit manual entry, and how do create, edit, delete, and correction operations behave across local and synchronized states?
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-MAN-001`–`005`, `FR-METRIC-*`, `FR-QUAL-006`, `SYNC-017/018`, `Appendix C`
- **Current Repository State:** `HealthRecord` has `origin: Mapped[str]` (defaults to `source_imported`) and `correction_state: Mapped[str]` (`active`, `corrected`, `superseded`).
- **Available Options:**
  - **Option A (Recommended Default):** Permit manual entry only for the approved Phase 1 metrics. Manual entries receive `origin = 'user_entered'`. Edits do not overwrite records in place; they insert a new revision with `correction_state = 'corrected'` pointing to the prior record, while marking the prior record as `superseded`. Manual deletions mark records as soft-deleted (`tombstone`).
  - **Option B:** Unrestricted free-form manual entry for any arbitrary metric name/unit.
  - **Option C:** In-place mutable overwrite without preserving revision history.
- **Dependencies & Trade-offs:**
  - Depends on `OD-01` (approved metrics) and `OD-14` (tombstone sync).
  - *Option A* preserves clinical and audit integrity (`DATA-002`, `PRV-016`) and allows offline synchronization without conflict ambiguity.
- **Consequences:**
  - *Schema:* Requires adding `superseded_by_id` or revision lineage foreign key to `health_records`.
  - *Clients:* Mobile UI requires a distinct "Manual Entry" form with client-side bounds checking matching `MetricDefinition.validation_rules`.
- **Recommendation:** **Option A**.
- **Approval Required from Owner:** Approve manual entry restricted to Phase 1 metrics with immutable revision history.

---

### OD-07 — Retention, Export, Deletion, Derived Outputs, Caches, and Backups
- **Exact Question:** What is the explicit lifecycle, retention window, and deletion propagation policy for raw provider payloads, normalized health records, derived summaries, logs, local caches, and database backups?
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-PRIV-004`–`007`, `PRV-003/005–007`, `DATA-009`, `SYNC-009/019`, `PRV-012–016`, `Appendix D`
- **Current Repository State:** `source_records.raw_payload` stores full JSON payload indefinitely. Database foreign keys use `ON DELETE CASCADE`.
- **Available Options:**
  - **Option A (Recommended Default - Storage Minimization):**
    1. *Raw Payloads (`source_records.raw_payload`):* Retained for 30 days post-ingestion for debugging and idempotency verification. After 30 days, a scheduled worker sets `raw_payload = NULL` while retaining the lightweight receipt metadata (`idempotency_key`, `source_name`, `timestamp`).
    2. *Normalized Records (`health_records`):* Retained indefinitely while account is active.
    3. *Server Logs:* 14-day retention with 100% PII/PHI redaction enforced at formatter level.
    4. *Account Deletion Request:* Triggers 30-day grace period (status: `deletion_pending`). After 30 days, all personal records (`persons`, `health_records`, `source_records`) are hard-deleted.
    5. *Backups:* Automated rolling database snapshots expire after 30 days. Restores must run a deletion-reconciliation script against `audit_events` to purge accounts deleted after snapshot creation (`NFR-REL-010`).
  - **Option B:** Indefinite retention of all raw payloads and zero backup expiry.
  - **Option C:** Immediate zero-retention of raw payloads (discard raw JSON instantly after parsing).
- **Dependencies & Trade-offs:**
  - Interacts directly with `OD-14` (offline sync) and `OD-20` (backup RPO/RTO).
  - *Option A* balances privacy storage minimization with realistic engineering debugging needs.
  - *Option B* creates ballooning storage costs and catastrophic breach liability.
  - *Option C* makes diagnosing mobile sync anomalies impossible.
  - *Legal & Privacy Note:* A fixed 30-day retention for raw JSON is an engineering proposal; formal GDPR (Art. 17 Right to Erasure, Art. 5 Data Minimisation) and HIPAA compliance requirements require professional legal sign-off.
- **Consequences:**
  - Requires scheduled maintenance worker (`services/workers/retention_worker.py`) in Milestone 0.6.
- **Recommendation:** **Option A**.
- **Approval Required from Owner:** Approve 30-day rolling raw payload retention and backup reconciliation policy.

---

### OD-14 — Deletion Propagation, Tombstones, and Offline Synchronization
- **Exact Question:** How does record and account deletion propagate across offline mobile queues, delayed sync requests, and concurrent updates without resurrecting deleted data?
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-PRIV-004`, `PRV-005–007`, `PRV-012`, `SYNC-019`, `Appendix D`
- **Current Repository State:** Schema uses physical hard delete via `ON DELETE CASCADE`. No tombstone table exists.
- **Critical Technical Vulnerability of a Fixed 30-Day Tombstone Window:**
  - If server tombstones are purged after 30 days, a mobile device that remains offline for 45 days will reconnect and push its queued local records. Because the server tombstones no longer exist, the server cannot detect that the records were deleted on another client, resulting in **"zombie record resurrection"**.
- **Available Options:**
  - **Option A (Recommended Default - Sync Tombstones with Cursor Expiry):**
    - Introduce a dedicated, lightweight `sync_tombstones` table: `(person_id, record_type, target_record_id, deleted_at)`.
    - When a user deletes a health record on Web or Mobile, a tombstone is written.
    - During offline sync reconciliation, the client receives recent tombstones and purges matching local SQLite records before pushing pending local changes.
    - If a client attempts to push an update or re-ingest a record matching an active tombstone, the backend silently rejects the resurrection.
    - *Recovery Strategy for Stale Devices:* The server tracks `last_sync_timestamp` per client device. If a client's last sync is older than the tombstone retention window (>30 days), the server rejects incremental sync with `SYNC_CURSOR_EXPIRED`. The mobile client must execute a **full resynchronization**: purge local cache, re-fetch active state from the server, and prompt the user regarding any uncommitted offline edits.
  - **Option B (Pure Hard-Delete without Tombstones):** Hard-delete records immediately. Offline mobile clients must perform a full wipe and re-download of all records on every sync pass.
- **Dependencies & Trade-offs:**
  - *Option A* eliminates the "zombie record" failure mode where a stale offline phone resurrects records deleted on the web.
  - *Option B* causes massive mobile data usage and high battery drain on every reconnection.
- **Consequences:**
  - *Schema:* Requires adding `sync_tombstones` table via migration in Milestone 0.6.
  - *API:* Sync endpoint must return deleted record IDs in sync response envelope and handle `SYNC_CURSOR_EXPIRED`.
- **Recommendation:** **Option A**.
- **Approval Required from Owner:** Approve the synchronization tombstone mechanism with cursor expiry.

---

### OD-16 — Minimum Supported OS and Browser Versions
- **Exact Question:** What is the explicit supported platform matrix for mobile operating systems, browser engines, and native health framework APIs?
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `NFR-COMP-001`–`003`, `FR-DATA-001/002`, `IF-CLIENT-*`, `Appendix C/F`
- **Current Repository State:** Unspecified in code; README references generic recommendations.
- **Available Options:**
  - **Option A (Recommended Modern Baseline):**
    - **iOS:** iOS 16.0+ (requires modern Swift HealthKit APIs, covers >95% of active iPhones).
    - **Android:** Android 12.0+ (API level 31+) with Google Health Connect installed (native on Android 14+). Google Fit API is deprecated and excluded.
    - **Web Browsers:** Modern evergreen desktop/mobile browsers: Chrome 115+, Firefox 115+, Safari 16+, Edge 115+.
  - **Option B (Legacy Android Support):** Support Android 9/10/11 using legacy Google Fit REST/Android SDK.
- **Dependencies & Trade-offs:**
  - *Option A* targets active, vendor-supported health frameworks and avoids technical debt on deprecated Google Fit APIs.
  - *Option B* adds significant maintenance burden for a deprecated API that Google is discontinuing.
- **Consequences:**
  - Native client code in `apps/mobile` will configure `minSdkVersion = 31` (or 26 with Health Connect runtime check) and `iOS deployment target = 16.0`.
- **Recommendation:** **Option A**.
- **Approval Required from Owner:** Approve iOS 16+ and Android 12+ (Health Connect) platform baseline.

---

### OD-17 — Mobile Database Encryption and Secure Key Management
- **Exact Question:** What local database technology and encryption standard must be used on mobile devices to secure cached health data and offline queues?
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `SEC-008`, `SYNC-001`–`013`, `ARCH-005`, `FR-PRIV-004`, `PRV-014`
- **Current Repository State:** Mobile client not yet initialized; no local database implemented.
- **Available Options:**
  - **Option A (Recommended Default - SQLCipher + OS Keystore):**
    - SQLite database encrypted at rest using 256-bit AES (SQLCipher via `@op-engineering/op-sqlite` or Expo CNG prebuild).
    - Encryption key generated securely on first launch (`crypto.getRandomValues`) and stored exclusively in hardware-backed storage (iOS Keychain / Android KeyStore) via `expo-secure-store`.
    - On user sign-out: encryption key is purged from memory and secure store, and local database file is deleted.
  - **Option B (Unencrypted SQLite with OS-Level Sandbox Only):** Standard unencrypted `expo-sqlite` relying solely on standard mobile OS application sandboxing.
- **Dependencies & Trade-offs:**
  - *Option A* complies with health data privacy requirements (`SEC-008`), protecting data against physical device extraction or unencrypted backup dumps.
  - Note: Option A requires Expo Continuous Native Generation (`npx expo prebuild` / development builds); it cannot run inside standard off-the-shelf Expo Go app.
- **Consequences:**
  - Mobile architecture must specify Expo prebuild workflow rather than pure Expo Go.
- **Recommendation:** **Option A**.
- **Approval Required from Owner:** Approve SQLCipher + OS Keystore as mandatory mobile storage architecture.

---

### OD-18 — Authentication Strategy and Session Lifecycle
- **Exact Question:** What identity architecture, credential store, token lifecycle, and session management strategy should be implemented for web and mobile clients?
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-AUTH-001`–`008`, `SEC-001`–`011`, `IF-API-014`
- **Current Repository State:** `user_accounts` contains only `id`, `email`, and `status`. No password hashes or auth tables exist.
- **Available Options:**
  - **Option A (Recommended Default - Self-Hosted Application Identity):**
    - Primary: Email + Password authentication using Argon2id password hashing.
    - Secondary (Phase 1.5): Social login via standard OAuth2 PKCE (Apple Sign-In & Google Sign-In).
    - Sessions: Short-lived signed JWT access tokens (15-minute expiry) + cryptographically random rotating refresh tokens (7-day expiry) stored hashed in PostgreSQL table `auth_refresh_tokens`.
    - Revocation: Explicit logout or password change immediately revokes the refresh token family.
    - Zero external SaaS dependency; fully adheres to PostgreSQL authoritative store and free-tier-first constraint.
  - **Option B (Managed Identity-as-a-Service - Supabase Auth):** Delegate authentication entirely to Supabase Auth (GoTrue).
  - **Option C (Passwordless Magic Link Only):** Send one-time login links via email.
- **Dependencies & Trade-offs:**
  - *Option A* maintains architectural sovereignty, zero recurring license fees, and complete control over user data and audit logs.
  - *Option B* accelerates auth development but creates third-party vendor lock-in and potential costs.
  - *Option C* creates friction on mobile where switching apps to click email links causes session dropouts.
- **Consequences:**
  - *Schema:* Requires creating `auth_credentials` (storing Argon2id hash) and `auth_refresh_tokens` tables in Milestone 0.6.
- **Recommendation:** **Option A**.
- **Approval Required from Owner:** Approve self-hosted Argon2id + rotating JWT refresh token architecture.

---

### OD-19 — Hosting Topology and Service Boundary
- **Exact Question:** Should web API, mobile API, and worker processes be co-deployed as a modular monolith or split into independent microservices?
- **Current Status:** **PENDING PRODUCT-OWNER APPROVAL (Reconciling ARCH-002 vs ARCH-006/013)**
- **Affected Requirements:** `ARCH-001`–`015`, `DEP-*`, `NFR-REL-*`, `Section 11`
- **Current Repository State:** Modular monolith implemented in `services/api/main.py` mounting `services/web_api/router.py` and `services/mobile_api/router.py`.
- **Available Options:**
  - **Option A (Recommended Default - Co-deployed Modular Monolith):**
    - Single FastAPI backend application container hosting both `/api/v1/web` and `/api/v1/mobile` namespaces with shared database connection pools.
    - Background workers run as a separate entrypoint using the same codebase container.
    - Backed by a single managed PostgreSQL instance.
    - Web frontend deployed to Vercel or static container.
  - **Option B (Distributed Microservices):** Split Web API, Mobile API, Ingestion Service, and Sync Service into separately deployed microservice containers.
- **Dependencies & Trade-offs:**
  - *Option A* minimizes idle infrastructure costs (fits free/low-tier hosting), avoids distributed transaction failures, simplifies deployment pipelines, and preserves strict code modularity.
  - *Option B* causes severe operational complexity, network latency, distributed tracing overhead, and multiplied hosting bills without traffic justification.
- **Consequences:**
  - Preserves current codebase structure under `services/`.
- **Recommendation:** **Option A**.
- **Approval Required from Owner:** Reaffirm co-deployed modular monolith topology.

---

### OD-22 — Automation Boundary: Application Workers vs. n8n
- **Exact Question:** What is the precise boundary of responsibility between backend application workers and the external n8n workflow engine?
- **Current Status:** **OPEN — Requires Product Owner Sign-off**
- **Affected Requirements:** `FR-AUTO-001`–`013`, `IF-AUTO-001`–`005`, `ARCH-008/015`, `Appendix E.4`
- **Current Repository State:** Placeholder `services/` structure; no direct n8n integration written.
- **Available Options:**
  - **Option A (Recommended Default - Strict Security Boundary):**
    - **Backend Application Workers:** Own 100% of canonical database writes, health record validation, PHI processing, raw payload parsing, and authentication/authorization checks.
    - **n8n Automation Engine:** Operates strictly outside the PHI boundary. Used exclusively for workflow orchestration, cron triggers via authenticated API webhooks (e.g. triggering batch retention cleanups), and sending user-approved notifications. n8n never connects directly to PostgreSQL and never stores unencrypted health metrics.
  - **Option B (Direct n8n Ingestion):** Allow n8n to connect directly to PostgreSQL and parse incoming provider payloads.
- **Dependencies & Trade-offs:**
  - *Option A* ensures health data security (`PRV-011`, `SEC-001`), centralized validation, and prevents data corruption by external workflow tools.
  - *Option B* violates healthcare privacy boundaries and creates unmaintainable split business logic.
- **Consequences:**
  - Defines webhook API contract (`/api/v1/internal/automation/*`) protected by worker service tokens.
- **Recommendation:** **Option A**.
- **Approval Required from Owner:** Approve strict isolation of n8n outside the canonical health data boundary.

---

## 3. Priority 1 (P1) Decisions: Near-Term Feature Gates

---

### OD-02 — Priority Trade-offs for Platform Capability Discrepancies
- **Question:** How should the product handle metrics supported on one platform (e.g. Apple HealthKit) but missing or unpermitted on another (e.g. Android)?
- **Recommendation:** **Strict honest degradation**. Never interpolate or fabricate missing metrics. If a metric is unavailable, display "Metric not available from this source".
- **Approval Needed:** Confirm honest degradation policy before Phase 1 UI freeze.

### OD-05 — Phase 2 Assistant UX, Question Taxonomy, and Usage Limits
- **Question:** What is the assistant UX scope, supported query types, rate limits, and cost controls for Phase 2 AI features?
- **Recommendation:** Restrict to structured question-and-answer explanations based strictly on user's authorized historical metrics. Disallow medical diagnosis queries. Cap free tier at 10 queries/day.
- **Approval Needed:** Deferred to Phase 2 gate.

### OD-10 — Measurable Non-Functional Requirement (NFR) Targets
- **Question:** What are the approved numeric targets for latency, availability, startup, and sync?
- **Proposed Candidate Targets:**
  - *API Latency:* P95 < 250ms (reads), P95 < 500ms (sync batch up to 500 records).
  - *Mobile Startup:* Cold start < 2.0s, warm resume < 500ms on reference mid-tier devices.
  - *Web Rendering:* LCP < 2.5s, FID < 100ms.
  - *API Availability:* 99.5% monthly uptime.
  - *Sync Performance:* Background sync completes within 30 seconds for queues < 1,000 items.
- **Approval Needed:** Approve proposed NFR targets before production release.

### OD-15 — User Workflow History & Status View
- **Question:** Should users have access to an operational history log showing export and deletion request statuses?
- **Recommendation:** Provide a simple "Privacy & Data Requests" screen showing status (`pending`, `completed`, `failed`) and download links for active exports (`PRV-012`).
- **Approval Needed:** Approve before Phase 1 privacy controls implementation.

### OD-20 — Backup RPO and RTO Targets
- **Question:** What are the formal Recovery Point Objective (RPO) and Recovery Time Objective (RTO)?
- **Proposed Targets:**
  - *RPO:* <= 24 hours (daily automated database snapshots + WAL retention).
  - *RTO:* <= 4 hours from disaster declaration to restored operational state.
- **Approval Needed:** Approve targets before staging/production deployment.

### OD-21 — AI Provider, Privacy Terms, and Cost Caps (Phase 2 Gate)
- **Question:** Which external AI provider is approved, under what privacy and zero-data-retention terms, and with what budget caps?
- **Recommendation:** Use Google Gemini API with zero-data-retention enterprise terms. Do not send health data to any AI provider until privacy review is complete.
- **Approval Needed:** Mandatory gate before Phase 2 AI implementation.

---

## 4. Priority 2 (P2) Decisions: Explicitly Deferred Future-Phase Decisions

| Decision ID | Title | Phase | Deferred Rationale | Gate |
| :--- | :--- | :--- | :--- | :--- |
| **OD-06** | Medical document formats & extraction | Phase 4 | Requires clinical intended-use review and document parser evaluation. | Before Phase 4 implementation |
| **OD-08** | Final branding and domain name | Phase 1+ | VitalSense is an acceptable provisional internal name; does not block technical foundation. | Before public store launch |
| **OD-09** | Monetization & commercial model | Phase 2+ | Initial foundation is built under free-tier-first architecture. | Before commercial launch |
| **OD-11** | ML forecast data sufficiency thresholds | Phase 3 | Predictive ML models require historical longitudinal training data. | Before Phase 3 ML release |
| **OD-12** | Medical intended use & clinical validation | Phase 4 | Platform remains strictly general wellness in Phases 0–3; no diagnostic claims. | Before Phase 4 release |
| **OD-13** | Family roles, minors, & caregiver consent | Phase 5 | Architecture supports multi-person via `persons` table, but family sharing workflows are gated. | Before Phase 5 release |

---

## 5. Owner Decision Sign-off Form

*To be completed by the Product Owner:*

| Decision Ref | Topic | Proposed Option | Owner Decision (Approve / Reject / Modify) | Notes / Adjustments |
| :--- | :--- | :--- | :--- | :--- |
| **OD-01** | Phase 1 Metrics | Option A (5 core metrics) | [ ] APPROVED  [ ] REJECTED | |
| **OD-03** | Phase 0 Exit Criteria | Option A (5 verifiable criteria) | [ ] APPROVED  [ ] REJECTED | |
| **OD-04** | Manual Entry & Corrections | Option A (Restricted + Revision history) | [ ] APPROVED  [ ] REJECTED | |
| **OD-07** | Data Retention & Minimization | Option A (30-day raw payload expiry) | [ ] APPROVED  [ ] REJECTED | |
| **OD-14** | Sync Deletion & Tombstones | Option A (Sync tombstones table) | [ ] APPROVED  [ ] REJECTED | |
| **OD-16** | Platform Matrix | Option A (iOS 16+, Android 12+) | [ ] APPROVED  [ ] REJECTED | |
| **OD-17** | Mobile DB Encryption | Option A (SQLCipher + OS Keystore) | [ ] APPROVED  [ ] REJECTED | |
| **OD-18** | Authentication Architecture | Option A (Argon2id + Rotating JWT) | [ ] APPROVED  [ ] REJECTED | |
| **OD-19** | Service Topology | Option A (Co-deployed Modular Monolith) | [ ] APPROVED  [ ] REJECTED | |
| **OD-22** | Automation Boundary | Option A (Strict app-worker boundary) | [ ] APPROVED  [ ] REJECTED | |
| **NFRs** | Performance & Recovery Targets | Proposed NFR Table | [ ] APPROVED  [ ] REJECTED | |

---

*End of Decision Workshop Document.*
