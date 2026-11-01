# VitalSense — Consolidated Architecture Decision Record (ADR)
## Approved Product-Owner Decisions (Milestones 0.5.3 / 0.6)

**Document Reference:** `ADR-001-CONSOLIDATED`  
**Date:** 2026-11-01  
**Status:** **APPROVED BY PRODUCT OWNER**  
**Auditor / Reviewers:** Lead Software Architect, Technical Documentation Engineer, Security Reviewer  

---

## 1. Context and Scope

During Milestone 0.5.3 and finalized in Milestone 0.6, the Product Owner formally reviewed and approved ten Priority 0 (`P0`) architectural, security, and product decisions (`OD-01`, `OD-03`, `OD-04`, `OD-07`, `OD-14`, `OD-16`, `OD-17`, `OD-18`, `OD-19`, and `OD-22`). 

This document serves as the authoritative, permanent record of these decisions, detailing the approved options, technical parameters, architectural consequences, and implementation requirements for future milestones.

---

## 2. Consolidated Decision Records

### ADR-01 (OD-01) — Phase 1 Metric Scope and Paired Biometrics
- **Decision:** **Option B (Expanded Biometrics)** is approved for Phase 1.
- **Approved Metric Set:**
  1. `steps`: count (numeric), phone accelerometer or wearable.
  2. `heart_rate`: bpm (numeric), optical PPG sensor / wearable.
  3. `sleep_session`: duration in seconds, wearable or sleep tracker.
  4. `active_energy`: kcal (numeric), algorithmic calculation from heart rate & motion.
  5. `workout_session`: duration in seconds, logged activity session.
  6. `resting_heart_rate`: bpm (numeric), resting cardiovascular measurement.
  7. `blood_pressure_systolic`: mmHg (numeric), paired measurement component.
  8. `blood_pressure_diastolic`: mmHg (numeric), paired measurement component.
  9. `blood_oxygen_saturation` (SpO2): percentage % (numeric, 0–100).
  10. `blood_glucose`: mg/dL or mmol/L (numeric), capillary or continuous blood glucose.
- **Blood Pressure Constraint:** Blood pressure measurements must support paired systolic/diastolic observations linked by a shared event timestamp, correlation ID, or observation grouping.
- **Scope Exclusion:** Weight and body measurements (BMI, body fat percentage) are **not** included in this approval and remain a separately tracked scope item for future phases.
- **Data Integrity Rule:** Missing wearable or device data must display an honest empty state ("No device connected" or "No data recorded"). The system must **never fabricate or assume zero values**.
- **Implementation Impact:** Migration 002 must seed the additional 5 metric definitions into `metric_definitions`.

---

### ADR-02 (OD-03) — Phase 0 Exit Acceptance Criteria
- **Decision:** Technical specification delegated to the architecture assistant. The Phase 0 exit gate is defined across four objective, independently verifiable pillars:
  1. **Foundation Readiness:**
     - 100% automated test pass rate in CI and local runner.
     - Database migration upgrade to `head` and downgrade to `base` verified on PostgreSQL.
     - Zero schema drift between router code and OpenAPI 3.1.0 specification.
     - Operational probes (`/health`, `/ready`) returning HTTP 200 with non-leaking status.
  2. **Data Pipeline Readiness:**
     - Synthetic batch sync fixture successfully ingested into `source_records` and normalized into `health_records`.
     - Exact precision verification (`Numeric(14, 4)`) with zero floating-point arithmetic errors.
  3. **Cross-Platform Application Readiness:**
     - Repository and package scaffolding established for all 5 first-class platforms.
     - Shared contracts and types package buildable without platform-specific leaks.
  4. **End-to-End Release Readiness:**
     - CI pipeline (`.github/workflows/ci.yml`) passing on `dev` and `main`.
     - Zero uncommitted code or drift in repository.
- **Governance Rule:** A checklist does not constitute readiness; verifiable automated execution evidence is mandatory.

---

### ADR-03 (OD-04) — Controlled Manual Entry and Immutable Revision Lineage
- **Decision:** **Option A** is approved.
- **Specifications:**
  - Manual entry is permitted exclusively for approved Phase 1 metrics (`origin = 'user_entered'`).
  - **Immutable Revisions:** Edits do not overwrite records in place. When a record is edited, a new record is inserted with `correction_state = 'corrected'`, and the previous record is updated to `correction_state = 'superseded'` with `superseded_by_id` pointing to the new revision.
  - **Timestamp Preservation:** Corrections preserve the original measurement timestamp (`measured_at`) so historical charts reflect the actual observation time rather than the edit time.
  - **Deletions:** Deleting a record writes a tombstone record; physical deletion is prohibited during active synchronization.
  - **Validation:** Strict metric-specific bounds checking enforced both client-side and authoritatively server-side based on `MetricDefinition.validation_rules`.

---

### ADR-04 (OD-07) — Data Retention, Minimization, and Deletion Lifecycle
- **Decision:** **Option A with recommended safeguards** is approved.
- **Specifications:**
  - **Raw Ingestion Payloads (`source_records.raw_payload`):** Retained for 30 days post-ingestion. After 30 days, a scheduled background worker removes the raw JSON payload (`raw_payload = NULL`) while retaining the receipt metadata (`idempotency_key`, `source_name`, `person_id`, `created_at`).
  - **Normalized Records (`health_records`):** Retained indefinitely while the user account is active.
  - **Server Logs:** Retained for 14 days maximum. 100% PHI/PII redaction enforced in `vitalsense_common/logging.py`.
  - **Account Deletion Grace Period:** 30 days. Accounts enter `deletion_pending` status. After 30 days, all personal health records, derived analytics, predictions, caches, and reports are permanently hard-deleted.
  - **Data Export:** Complete machine-readable user export provided before account deletion is finalized.
  - **Backups & Restore Reconciliation:** Rolling automated backup snapshots expire after 30 days. Restores must execute a deletion reconciliation script against `audit_events` to purge accounts deleted after the snapshot date (`NFR-REL-010`).
  - **Configuration:** Retention windows must be configurable via environment variables. Automatic HIPAA/GDPR compliance claims are prohibited without legal audit.

---

### ADR-05 (OD-14) — Synchronization Tombstones and Stale-Device Recovery
- **Decision:** **Option A with safeguards** is approved.
- **Specifications:**
  - **Tombstones:** A dedicated `sync_tombstones` table tracks deletions: `(id, person_id, record_type, target_record_id, deleted_at)`.
  - **Per-Device Sync Cursors:** The server tracks `last_sync_timestamp` per client device identifier.
  - **Expired Cursor Handling (`SYNC_CURSOR_EXPIRED`):** If a client device has been offline longer than the tombstone retention window (>30 days), incremental sync is rejected with `SYNC_CURSOR_EXPIRED`.
  - **Safe Full Resynchronization (CRITICAL):** The local client **must never blindly wipe the local database** when a cursor expires. The client must:
    1. Identify and preserve all pending uncommitted offline edits and drafts.
    2. Reconcile pending drafts against the authoritative server.
    3. Replace synchronized cache data with authoritative server state.
    4. Prompt the user if any uncommitted edits conflict with server state.
  - **Account Deletion Override:** An account deletion request overrides and rejects all pending offline uploads from any device.
  - **Idempotency:** Batch synchronization enforces idempotency via unique constraints, preventing duplicate records or deleted-record resurrection.

---

### ADR-06 (OD-16) — Five First-Class Target Platforms
- **Decision:** **Option A explicitly expanded by the Product Owner** is approved.
- **Five First-Class Platforms:**
  1. **Android** (Android 12.0+, API 31+, Google Health Connect native integration)
  2. **iOS** (iOS 16.0+, Apple HealthKit native integration)
  3. **Windows** (Windows 10/11 x64/ARM64, local client consuming synchronized health data)
  4. **macOS** (macOS 13+ Ventura, consuming synchronized data, potential HealthKit sync)
  5. **Web** (Evergreen browsers: Chrome, Firefox, Safari, Edge; mobile-first responsive layout)
- **Parallel Development:** All five platforms are first-class targets planned and developed in parallel with independent client applications and release pipelines.
- **Shared Foundations:** Shared identity, canonical health records, shared API contracts, and synchronization rules.
- **Sensor Reality:** Desktop applications primarily consume synchronized health data; no phone sensors are assumed or fabricated on desktop hardware.

---

### ADR-07 (OD-17) — Local Database Encryption and Key Management
- **Decision:** **Option A** is approved across all five platforms.
- **Specifications:**
  - **Protection Principle:** All local health data stored at rest on client devices must be encrypted.
  - **SQLite / SQLCipher:** Use 256-bit AES SQLCipher where SQLite is used.
  - **Android Architecture:** Room evaluated as the Android-specific abstraction using SQLCipher (`net.zetetic:sqlcipher-android` or AndroidX Support SQLite).
  - **Platform Key Storage:**
    - Android: Hardware-backed Android KeyStore via EncryptedSharedPreferences.
    - iOS & macOS: Hardware-backed Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).
    - Windows: Windows Data Protection API (DPAPI) or Credential Locker.
    - Web: Encrypted IndexedDB utilizing the Web Crypto API (`AES-GCM-256`) with key derived from session context. Web storage is explicitly documented as browser-level protection, distinct from native hardware-backed keystores.
  - **Key-Loss Recovery:** If local keys are lost or corrupted, the client purges corrupted local cache and performs a full authenticated resynchronization from PostgreSQL.
  - **Logout Lifecycle:** Logout permanently purges encryption keys from secure storage, zeroes memory references, and unlinks local database files.

---

### ADR-08 (OD-18) — Self-Hosted Identity and Session Architecture
- **Decision:** **Option A (Self-Hosted Identity)** is approved.
- **Specifications:**
  - **Password Security:** **Argon2id** password hashing (memory: 64 MB, iterations: 3, parallelism: 4).
  - **Social Authentication (Phase 1.5):** OAuth2 with PKCE for Apple Sign-In and Google Sign-In.
  - **Access Tokens:** Signed stateless JWTs with 15-minute expiration containing `sub`, `person_id`, and `role`.
  - **Refresh Tokens:** Cryptographically random 32-byte strings hashed with SHA-256 before storage in PostgreSQL table `auth_refresh_tokens`. 7-day expiration.
  - **Reuse Detection & Token-Family Revocation:** Refresh tokens rotate on every exchange. If an already-consumed refresh token is presented, the system detects token theft and immediately revokes the entire token family.
  - **Client Storage & Web Security:** Web uses `HttpOnly; Secure; SameSite=Strict` cookies with CSRF double-submit token protection. Native clients use secure platform storage. (Documented: HttpOnly cookies protect against script token theft but do not eliminate XSS/CSRF application vulnerabilities).
  - **Security Controls:** Rate limiting, brute-force lockout, multi-device session revocation, password reset with expiring tokens, and append-only security audit events (`audit_events`).

---

### ADR-09 (OD-19) — Modular Monolith Hosting Topology
- **Decision:** **Option A (Co-deployed Modular Monolith)** is approved.
- **Specifications:**
  - **Initial Hosting:** A single centrally deployed FastAPI backend application container hosting `/api/v1/web` and `/api/v1/mobile` router namespaces.
  - **Shared Data Layer:** Shared asynchronous connection pool (`asyncpg`) connecting to PostgreSQL as the canonical database.
  - **Background Workers:** Independently runnable worker processes using the same container image with separate entrypoints (e.g. `python -m services.workers.retention_worker`).
  - **Scalability:** Stateless application design allowing multiple backend instances behind a load balancer for concurrent users and multi-device access.
  - **Future Extraction:** Strict internal module boundaries under `services/` ensure individual sub-domains can be extracted into standalone microservices if traffic warrants.
  - **Client Applications:** All five clients (Android, iOS, Windows, macOS, Web) are independent applications consuming the shared backend APIs.

---

### ADR-10 (OD-22) — Strict n8n Automation Boundary
- **Decision:** **Option A (Strict Security Boundary)** is approved.
- **Specifications:**
  - **n8n Responsibility:** External workflow orchestration, scheduled cron triggers (e.g. initiating daily retention cleanup), dispatching non-sensitive notifications, and integrating external web services.
  - **VitalSense Backend Authority:** 100% ownership of authentication, authorization, PHI processing, health validation, canonical database writes, synchronization, and ML.
  - **Prohibitions:**
    - n8n **never connects directly to PostgreSQL**.
    - Unencrypted, identifiable health data must **never be transmitted to or stored in n8n**.
  - **Integration Interface:** Communication occurs strictly via authenticated internal webhooks (`/api/v1/internal/automation/*`) using mutual TLS or signed service tokens with least-privilege permissions, idempotency keys, and audit logging.

---

*End of Consolidated ADR.*

