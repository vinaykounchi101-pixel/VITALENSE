# VitalSense Architecture & Product-Owner Decision Workshop

**Document Purpose:** This workshop document synthesizes open architectural and product decisions (OD-01 through OD-22) from [VitalSense_SRS_v1.1.1_Open_Decision_Register.md](file:///e:/Projects/VITALENS/docs/VitalSense_SRS_v1.1.1_Open_Decision_Register.md) into concrete, actionable choice sets for the Product Owner.

**Status Convention:** Every item below is explicitly **OPEN**. Recommendations are provided as engineering proposals based on technical feasibility, privacy constraints, and repository foundations; they do not constitute product-owner approval.

---

## Decision Cluster 1: Phase 1 Health Metric & Ingestion Baseline

### Question 1.1: Canonical Phase 1 Metric Set
- **OD Reference:** `OD-01` (Exact Phase 1 metric categories and source integrations)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Affected Requirements:** `FR-DATA-001`–`013`, `FR-METRIC-001`–`005`, `IF-HEALTH-*`, `Appendix C`
- **Current Codebase State:** Migration `001_initial_core_schema.py` seeds 5 provisional metric definitions (`steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`).
- **Options:**
  1. **Option A (Recommended Default):** Approve the 5 core wellness metrics (`steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`) for Phase 1. These have proven cross-platform support across both Apple HealthKit and Android Health Connect with stable unit definitions.
  2. **Option B (Expanded):** Add biometric vitals (`resting_heart_rate`, `blood_pressure_systolic`, `blood_pressure_diastolic`, `blood_glucose`).
  3. **Option C (Minimalist):** Scope strictly to `steps` and `sleep_session` to minimize initial integration testing surface.
- **Consequences & Trade-offs:**
  - *Option A* balances user utility with reliable mobile platform permissions and low schema complexity.
  - *Option B* introduces clinical/medical sensitivity earlier into the architecture, raising compliance concerns (`OD-12`).
- **Dependency:** Mobile platform health permissions (`OD-16`).

---

### Question 1.2: Scope Trade-offs for Platform Discrepancies
- **OD Reference:** `OD-02` (Priority trade-offs if all candidate metrics cannot fit)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Affected Requirements:** `FR-DATA-*`, `FR-METRIC-*`, `FR-UI-001/002`
- **Options:**
  1. **Option A (Recommended Default):** Strict parity rule: If a metric is not reliably supported or permissions fail on one platform, display honest capability degradation ("Source not available on this device") rather than fabricating estimates.
  2. **Option B:** Platform-divergent catalog: Expose features exclusively on iOS or Android based on device sensors.
- **Consequences & Trade-offs:**
  - *Option A* protects data integrity and user trust; avoids phantom data or broken UI widgets.

---

### Question 1.3: Manual Entry Categories & Correction Behavior
- **OD Reference:** `OD-04` (Exact manual-entry categories and correction behavior)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Affected Requirements:** `FR-MAN-001`–`005`, `FR-QUAL-006`, `SYNC-017/018`
- **Options:**
  1. **Option A (Recommended Default):** Allow manual entry only for approved Phase 1 metrics (`steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`). Mark origin as `manual_entry`. Edits create a new revision with `correction_state='corrected'` while preserving audit history.
  2. **Option B:** Allow unrestricted manual entry for any arbitrary key-value health observation.
- **Consequences & Trade-offs:**
  - *Option A* keeps validation strictly bound to `MetricDefinition.validation_rules` (JSONB) and preserves data provenance (`DATA-002`).

---

## Decision Cluster 2: Authentication & Identity Baseline

### Question 2.1: Phase 1 Identity & Authentication Mechanism
- **OD Reference:** `OD-18` (Authentication/session implementation)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Affected Requirements:** `FR-AUTH-001`–`008`, `SEC-001`–`011`, `IF-API-014`
- **Current Codebase State:** `user_accounts` table contains `id`, `email`, and `status`. No password hashes, OAuth tokens, or credential tables exist yet.
- **Options:**
  1. **Option A (Recommended Default):** Local Email + Password authentication using Argon2id/bcrypt password hashing, coupled with industry-standard PKCE-compliant OAuth2 for future social login (Apple Sign-In / Google Sign-In).
  2. **Option B:** Passwordless Magic Link authentication via transactional email.
  3. **Option C:** Pure third-party identity-as-a-service (e.g. Supabase Auth / Auth0 / Firebase Auth).
- **Consequences & Trade-offs:**
  - *Option A* is self-hosted, vendor-agnostic, zero-cost, and complies with PostgreSQL authoritative storage constraint. Requires dedicated credential tables (`auth_credentials`).
  - *Option B* eliminates password storage risks but introduces latency and email delivery failure risks during mobile onboarding.
  - *Option C* accelerates implementation but introduces recurring third-party vendor lock-in and potential data residency questions.

---

### Question 2.2: Session Token & Revocation Lifecycle
- **OD Reference:** `OD-18` (Session design and token lifecycle)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Options:**
  1. **Option A (Recommended Default):** Short-lived signed JWT access tokens (15-minute lifespan) paired with cryptographically secure, rotating opaque refresh tokens (7-day lifespan) stored hashed in PostgreSQL. Revocation immediately blacklists the refresh token family.
  2. **Option B:** Stateful server-side sessions stored in database or Redis.
- **Consequences & Trade-offs:**
  - *Option A* minimizes database reads on high-frequency API calls while allowing rapid session revocation upon sign-out or suspicious activity.

---

## Decision Cluster 3: Data Retention, Deletion & Offline Sync

### Question 3.1: Raw Provider Ingestion Retention Policy
- **OD Reference:** `OD-07` (Retention, export, deletion, derived outputs, caches, and backups)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Affected Requirements:** `FR-PRIV-004`–`007`, `PRV-003/005–007`, `DATA-009`, `SYNC-016`
- **Current Codebase State:** `source_records.raw_payload` stores raw provider JSON indefinitely.
- **Options:**
  1. **Option A (Recommended Default):** 30-Day Rolling Ingestion Retention: Retain `source_records.raw_payload` for 30 days for debugging, reprocessing, and idempotency verification, after which a background worker nullifies `raw_payload` while preserving the lightweight receipt (`person_id`, `source_name`, `idempotency_key`, `ingestion_timestamp`).
  2. **Option B:** Indefinite retention of all raw payloads.
  3. **Option C:** Immediate zero-retention (parse directly to `health_records` and discard raw payload immediately).
- **Consequences & Trade-offs:**
  - *Option A* satisfies GDPR/HIPAA storage minimization principles while keeping sufficient diagnostic window for mobile sync bugs.
  - *Option B* causes massive database bloat and increased liability in case of data breach.
  - *Option C* makes debugging sync anomalies and schema changes impossible.

---

### Question 3.2: Deletion Propagation & Offline Sync Tombstones
- **OD Reference:** `OD-07`, `OD-14`, `SYNC-019`
- **Status:** **OPEN — Requires Product Owner Decision**
- **Current Codebase State:** Database foreign keys use `ON DELETE CASCADE` (immediate hard delete).
- **Options:**
  1. **Option A (Recommended Default):** Soft deletion with synchronization tombstones: Add `deleted_at: DateTime` or a dedicated `sync_tombstones` table. Deleted records are retained as tombstones for 30 days so offline mobile clients learn of the deletion on their next sync pass, after which they are permanently purged.
  2. **Option B:** Pure immediate hard-delete.
- **Consequences & Trade-offs:**
  - *Option A* prevents "zombie records" where an offline mobile device resurrects a record deleted on the web.
  - *Option B* requires complete client cache wipe and re-download on every sync reconciliation.

---

### Question 3.3: Mobile Local Storage Encryption
- **OD Reference:** `OD-17` (Local database/encryption/key management)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Affected Requirements:** `SEC-008`, `SYNC-001`–`013`, `ARCH-005`, `PRV-014`
- **Options:**
  1. **Option A (Recommended Default):** SQLite with SQLCipher encryption, with the encryption key securely generated and stored in the platform keychain (iOS Keychain / Android Keystore) via Expo SecureStore.
  2. **Option B:** Operating-system level file encryption (standard app sandbox data protection without app-level database encryption).
- **Consequences & Trade-offs:**
  - *Option A* ensures health data is protected at rest even if device physical security is compromised or backup archives are extracted.

---

## Decision Cluster 4: Platform & Deployment Boundaries

### Question 4.1: Supported Mobile and Browser Matrix
- **OD Reference:** `OD-16` (Minimum supported OS/browser versions)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Affected Requirements:** `NFR-COMP-001`–`003`, `FR-DATA-001/002`
- **Options:**
  1. **Option A (Recommended Default):**
     - **iOS:** iOS 16.0+ (supports modern Apple HealthKit Swift APIs).
     - **Android:** Android 12.0+ (API level 31+) with Google Health Connect installed.
     - **Web Browsers:** Modern evergreen browsers (Chrome 115+, Firefox 115+, Safari 16+, Edge 115+).
  2. **Option B:** Support older Android versions (Android 10/11) via legacy standalone Google Fit APIs (Google Fit API is deprecated by Google in 2025/2026).
- **Consequences & Trade-offs:**
  - *Option A* aligns with active vendor support windows and avoids investing engineering hours into deprecated APIs.

---

### Question 4.2: Hosting & Deployment Topology
- **OD Reference:** `OD-19` (Hosting and separate/co-deployed service choices)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Affected Requirements:** `ARCH-001`–`015`, `DEP-*`, `NFR-REL-*`
- **Options:**
  1. **Option A (Recommended Default):** Single deployable container / process for FastAPI modular monolith (serving both `/api/v1/web` and `/api/v1/mobile`) backed by managed PostgreSQL (e.g. AWS RDS / Supabase / GCP Cloud SQL). Web frontend deployed to Vercel/Node.js container.
  2. **Option B:** Split web API and mobile API into separately deployed microservices.
- **Consequences & Trade-offs:**
  - *Option A* dramatically simplifies deployment, reduces idle hosting costs, shares database connection pools, and preserves clear modular boundaries without distributed microservice overhead.

---

### Question 4.3: Automation Architecture (Application Workers vs. n8n)
- **OD Reference:** `OD-22` (n8n versus application-worker split)
- **Status:** **OPEN — Requires Product Owner Decision**
- **Affected Requirements:** `FR-AUTO-001`–`013`, `IF-AUTO-001`–`005`, `ARCH-008/015`
- **Options:**
  1. **Option A (Recommended Default):** Strict separation of concerns:
     - **Application Backend:** Owns all transactional business logic, ingestion processing, validation, canonical writes, and sensitive PHI handling.
     - **n8n:** Used strictly as an external workflow orchestrator for non-sensitive automation triggers (e.g., scheduling daily batch triggers via authenticated webhook, dispatching user-approved notifications). Never stores raw health payloads or credentials.
  2. **Option B:** Use n8n directly for health record parsing and database mutations.
- **Consequences & Trade-offs:**
  - *Option A* protects the security and integrity of health data and keeps authoritative validation inside the backend codebase.

---

## Decision Cluster 5: Candidate Non-Functional Requirement (NFR) Targets

*All numeric values below are labeled **PROPOSED** and subject to Product Owner sign-off.*

| Metric Category | Target Identifier | PROPOSED Target | Baseline Rationale & Trade-offs |
| :--- | :--- | :--- | :--- |
| **API Latency** | `NFR-PERF-P01` | P95 < 250ms for read endpoints; P95 < 500ms for batch sync ingestion (up to 500 records). | Balances responsive UI with realistic async DB pool write constraints on single-node Postgres. |
| **Mobile App Startup** | `NFR-PERF-P02` | Cold start < 2.0s; warm resume < 500ms on reference mid-tier devices. | Ensures seamless user experience during routine check-ins without heavy initial blocking scans. |
| **Web Initial Render** | `NFR-PERF-P03` | Largest Contentful Paint (LCP) < 2.5s; First Input Delay (FID) < 100ms. | Aligns with standard Web Vitals thresholds for web dashboards. |
| **Availability / Uptime** | `NFR-REL-P01` | 99.5% monthly availability for web/mobile APIs (excluding scheduled maintenance). | Realistic for single-region managed infrastructure without multi-region failover costs. |
| **Backup RPO** | `NFR-REL-P02` | Recovery Point Objective (RPO) <= 24 hours (daily automated snapshot + WAL archiving). | Ensures minimal data loss without high-frequency continuous replication costs. |
| **Backup RTO** | `NFR-REL-P03` | Recovery Time Objective (RTO) <= 4 hours from disaster declaration to restored service. | Provides sufficient window for database restore and schema verification drills. |
| **Sync Reconciliation** | `NFR-SYNC-P01` | Background sync completes within 30 seconds for queues < 1,000 items on Wi-Fi/4G. | Prevents mobile OS background task termination (iOS limits background fetch to ~30s). |
| **Log Redaction & Privacy** | `NFR-OBS-P01` | 100% of auth credentials, session tokens, and health metric values redacted from server logs. | Enforced at code level by custom JSON formatter (`PRV-011`). |

---

## Summary Action Checklist for Product Owner

To proceed to Milestone 0.5 and Phase 1 implementation, please indicate your approvals or adjustments for:
1. [ ] **OD-01:** Confirm the 5 core Phase 1 metrics (Steps, Heart Rate, Sleep Session, Active Energy, Workout Session).
2. [ ] **OD-18:** Approve Email/Password + Argon2id as the initial Phase 1 authentication baseline.
3. [ ] **OD-07 & OD-14:** Approve 30-day raw payload retention and soft-delete/tombstone synchronization mechanism.
4. [ ] **OD-17:** Approve SQLCipher with OS Keychain for mobile offline encryption.
5. [ ] **OD-16:** Approve iOS 16+ and Android 12+ (Health Connect) as the mobile platform baseline.
6. [ ] **OD-19 & OD-22:** Approve FastAPI modular monolith deployment and application-worker boundary.
7. [ ] **NFR Targets:** Approve the proposed candidate latency, availability, and RPO/RTO targets.
