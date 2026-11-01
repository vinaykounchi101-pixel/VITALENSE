# VitalSense — Milestone 0.6: Architecture Consolidation & Decision Finalization Report

**Milestone:** 0.6 (Architecture Consolidation & Decision Finalization)  
**Date:** 2026-11-01  
**Project:** VitalSense Personal Health & Wellness Platform  
**Auditor / Roles:** Senior Software Architect, Technical Documentation Engineer, Architecture Reviewer  
**Active Branch:** `dev`  
**Repository:** [github.com/vinaykounchi101-pixel/VITALENSE](https://github.com/vinaykounchi101-pixel/VITALENSE)  
**Active Specifications:** [VitalSense_SRS_v1.1.1_Merged.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Merged.md) | [VitalSense_PRD_v1.1.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_PRD_v1.1.md)  
**Architecture Blueprints:** [system_architecture.md](file:///e:/Projects/VITALSENSE/docs/architecture/system_architecture.md) | [approved_decisions_record.md](file:///e:/Projects/VITALSENSE/docs/architecture/approved_decisions_record.md)  

---

## 1. Documents Inspected

Before making any documentation or architectural updates, the following existing project documents, specifications, and configurations were inspected:

1. **`README.md`:** Inspected current roadmap phase, monorepo layout, toolchain recommendations, and implemented functionality.
2. **`PROGRESS.md`:** Inspected milestone completion records (Milestones 0.1 through 0.5.2), active git state (`dev`), and pending action items.
3. **`TECHNICAL.md`:** Inspected technical stack versions, directory layout, database schema baseline (`001_initial_core_schema.py`), security safeguards, developer runbook, and git standards.
4. **`docs/VitalSense_PRD_v1.1.md`:** Inspected product goals, release scope matrix, data categories, and Section 14 Open Decision Register.
5. **`docs/VitalSense_SRS_v1.1.1_Merged.md`:** Inspected functional requirements (metrics, manual entry, export/deletion), API contracts, data integrity, component responsibilities, and Section 14 Open Decision Table.
6. **`docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv`:** Inspected 348 requirement rows and 23 placeholder test definitions.
7. **`docs/VitalSense_SRS_v1.1.1_Open_Decision_Register.md`:** Inspected 22 decisions (`OD-01` to `OD-22`), option proposals, and gating rules.
8. **`docs/architecture/`:** Inspected `decision_workshop.md` and confirmed lack of formal consolidated ADR and system architecture blueprint.
9. **`docs/milestone_05_3_decision_review_and_architecture_finalization_report.md`:** Inspected the individual reviews of the ten P0 decisions.
10. **`prompts/`:** Inspected sequential prompt archive (001 through 011).
11. **API Contracts & Migrations:**
    - `packages/api-contracts/openapi/v1.json`: Inspected OpenAPI 3.1.0 specification paths (`/health`, `/ready`, `/api/v1/web/status`, `/api/v1/mobile/status`).
    - `database/postgres/migrations/versions/001_initial_core_schema.py`: Inspected 6 core tables and 5 initial seeded metrics.

---

## 2. Documents Updated and Created

The following documents were authoritatively updated or created during Milestone 0.6:

| Document Path | Action | Summary of Changes |
| :--- | :--- | :--- |
| **`prompts/012_milestone_06_architecture_consolidation_and_decision_finalization.md`** | Created | Verbatim archive of Milestone 0.6 execution prompt. |
| **`docs/VitalSense_SRS_v1.1.1_Open_Decision_Register.md`** | Updated | Formally recorded 10 decisions as **APPROVED by Product Owner**; preserved 12 remaining decisions as **OPEN**. |
| **`docs/architecture/approved_decisions_record.md`** | Created | Created authoritative formal Architecture Decision Record (`ADR-001-CONSOLIDATED`) detailing all 10 approved decisions. |
| **`docs/architecture/system_architecture.md`** | Created | Created comprehensive system architecture blueprint with detailed text specifications and 5 Mermaid architecture diagrams. |
| **`docs/architecture/decision_workshop.md`** | Updated | Updated Section 5 Owner Sign-off Form to record approvals and updated status preamble. |
| **`docs/VitalSense_PRD_v1.1.md`** | Updated | Expanded product goals to five first-class platforms (`OD-16`) and marked approved decisions as resolved in Section 14.2. |
| **`docs/VitalSense_SRS_v1.1.1_Merged.md`** | Updated | Updated metric policy (`OD-01`), manual entry (`OD-04`), API session design (`OD-18`), data lifecycle (`OD-07`/`OD-14`), service topology (`OD-19`), n8n boundary (`OD-22`), and Section 14 Decision Table. |
| **`docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv`** | Updated | Updated traceability entries for requirements affected by approved decisions (`ARCH-013`, `ARCH-014`, `ARCH-015`, `DATA-016`, `IF-API-017`). |
| **`TECHNICAL.md`** | Updated | Consolidated technical stack, 5-platform architecture, database migration roadmap (Migration 002 scope), sync recovery, and security safeguards. |
| **`README.md`** | Updated | Updated status to Milestone 0.6 Complete, recorded 5 target platforms, updated links to new blueprints, and fixed path references. |
| **`PROGRESS.md`** | Updated | Recorded completion of Milestones 0.5.3 and 0.6; defined Milestone 0.7 scope and action items. |
| **`docs/milestone_06_architecture_consolidation_and_decision_finalization_report.md`** | Created | Compiled this formal verification report. |

---

## 3. Decisions Recorded

All ten decisions approved by the Product Owner were recorded with technical precision:

1. **`OD-01` — Phase 1 Metric Scope (Approved: Option B):**
   - 10 approved metrics: `steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`, `resting_heart_rate`, `blood_pressure_systolic`, `blood_pressure_diastolic`, `blood_oxygen_saturation` (SpO2), `blood_glucose`.
   - Blood pressure requires paired systolic/diastolic observations.
   - Weight/body measurements remain separately tracked for future phases.
   - Mandatory honest empty-state rule: **zero values are never fabricated**.
2. **`OD-03` — Phase 0 Exit Acceptance Criteria (Approved: Delegated Technical Choice):**
   - Objective, independently verifiable 4-pillar acceptance criteria: Foundation readiness, Data pipeline readiness, Cross-platform readiness, and Release readiness.
   - Checklists alone do not claim readiness; verifiable automated execution evidence is required.
3. **`OD-04` — Manual Entry and Correction Behavior (Approved: Option A):**
   - Controlled manual entry permitted strictly for the 10 approved Phase 1 metrics (`origin='user_entered'`).
   - Immutable revisions: edits insert a new record with `correction_state='corrected'` and update prior record to `superseded` referencing `superseded_by_id`.
   - Corrections preserve original measurement timestamps (`measured_at`).
   - Deletions generate tombstone records; physical deletion during active sync is prohibited.
4. **`OD-07` — Data Retention, Minimization, and Deletion (Approved: Option A with Safeguards):**
   - 30-day raw ingestion payload retention (`raw_payload = NULL` after 30 days while retaining receipt metadata).
   - Normalized records retained while account is active.
   - 14-day server log retention with 100% PHI redaction.
   - 30-day account deletion grace period.
   - 30-day rolling backup snapshot expiry.
   - Backup restoration must reconcile against deletion records in `audit_events`.
   - User data export provided prior to deletion. Configurable retention windows; no automatic HIPAA/GDPR claims.
5. **`OD-14` — Deletion Propagation, Tombstones, and Offline Sync (Approved: Option A with Safeguards):**
   - Dedicated `sync_tombstones` table. Per-device synchronization cursors (`last_sync_timestamp`).
   - Stale devices (>30 days offline) receive `SYNC_CURSOR_EXPIRED`.
   - Safe full resynchronization: **never blindly wipe local databases**; preserve uncommitted offline edits and drafts, reconcile with server before replacing cache.
   - Account deletion overrides pending offline uploads. PostgreSQL remains canonical server source.
6. **`OD-16` — Platform Support (Approved: Option A Expanded by Product Owner):**
   - Five first-class platforms planned and developed in parallel: Android, iOS, Windows, macOS, Web.
   - Independent client applications and release pipelines.
   - Shared identity, canonical health records, shared API contracts, and sync rules.
   - Android evaluates Health Connect; iOS/macOS evaluate HealthKit. Desktop primarily consumes synchronized data (no invented phone sensors).
   - Minimum versions validated: iOS 16+, Android 12+, Windows 10/11, macOS 13+, evergreen browsers.
7. **`OD-17` — Local Database Encryption and Key Management (Approved: Option A):**
   - Equivalent local-data protection across all five platforms: encrypted local health-data storage.
   - SQLCipher AES-256 where SQLite is used. Room evaluated as Android-specific abstraction.
   - Platform-appropriate hardware key storage: Android KeyStore, iOS/macOS Keychain, Windows DPAPI.
   - Web uses IndexedDB with Web Crypto API (AES-GCM-256). Documented as browser-level protection, distinct from hardware-backed storage.
   - Key-loss recovery via server resync. Secure logout evicts keys and unlinks local database.
8. **`OD-18` — Authentication and Sessions (Approved: Option A):**
   - Self-hosted identity system in PostgreSQL. Argon2id password hashing.
   - OAuth2 PKCE for planned Apple and Google sign-in.
   - 15-minute stateless JWT access tokens. 7-day rotating refresh tokens stored hashed in `auth_refresh_tokens`.
   - Refresh token reuse detection triggers immediate token-family revocation.
   - Web uses `HttpOnly; Secure; SameSite=Strict` cookies with CSRF double-submit protection. Native clients use secure platform storage.
9. **`OD-19` — Hosting and Backend Topology (Approved: Option A):**
   - Single centrally deployed backend initially as a Modular Monolith.
   - Separate logical Web (`/api/v1/web`) and Mobile (`/api/v1/mobile`) routing namespaces.
   - Shared asyncpg connection pool connecting to PostgreSQL.
   - Independently runnable background workers from same container image.
   - Stateless design supporting multi-instance horizontal scaling for concurrent users/devices.
10. **`OD-22` — Automation Boundary: Backend Workers vs. n8n (Approved: Option A):**
    - n8n is strictly an external workflow orchestrator (cron schedules, non-sensitive notifications, triggering backend operations via authenticated webhooks).
    - VitalSense backend retains 100% ownership of auth, authorization, sensitive health data, validation, canonical DB writes, sync, and ML.
    - Zero direct n8n PostgreSQL connections; zero identifiable health measurements sent to n8n.
    - Webhooks use least-privilege service tokens, idempotency, and audit logging.

---

## 4. Conflicts Found and Resolutions

During document inspection, several historical conflicts and discrepancies were identified and resolved:

| Discrepancy / Conflict | Found In | Resolution Applied in Milestone 0.6 |
| :--- | :--- | :--- |
| **Platform Coverage Conflict:** Documentation originally assumed only iOS and Android were mobile targets, omitting desktop and treating web as a secondary portal. | `README.md`, `VitalSense_PRD_v1.1.md`, `VitalSense_SRS_v1.1.1_Merged.md` | Reconciled under `OD-16 Approved`: Codified all **five platforms** (Android, iOS, Windows, macOS, Web) as first-class targets planned and developed in parallel with independent pipelines. |
| **Service Deployment Inconsistency:** Early `.env.example` and `README.md` defined two distinct listening ports (`8000` for Web, `8001` for Mobile), implying microservices, whereas `services/api/main.py` co-deployed both in a modular monolith. | `README.md`, `.env.example`, `TECHNICAL.md` | Reconciled under `OD-19 Approved`: Formally ratified the **Co-deployed Modular Monolith** in a single container with a unified listening port, shared connection pool, and isolated routing namespaces. |
| **Destructive Resync Hazard:** Prior sync recovery proposals stated that stale devices (>30 days offline) would wipe local databases on cursor expiration, risking the destruction of uncommitted user drafts. | `docs/architecture/decision_workshop.md`, `milestone_05_2_report.md` | Reconciled under `OD-14 Approved`: Enforced the rule that clients **must never blindly wipe local databases**. Clients isolate pending drafts, fetch server baselines, and execute safe non-destructive reconciliation. |
| **Phase 1 Metric Ambiguity:** `001_initial_core_schema.py` seeded 5 metrics, but PRD discussed candidate biometrics (BP, Glucose, SpO2) without clear approval. | `001_initial_core_schema.py`, `VitalSense_PRD_v1.1.md` | Reconciled under `OD-01 Approved (Option B)`: Explicitly defined all 10 approved metrics, mandated paired blood pressure observations, and preserved weight/body measurements as separately tracked scope. |
| **Stale Repository References:** Several documents referenced `VITALENS` and pre-rename filepaths. | `README.md`, `TECHNICAL.md` | Reconciled: Updated all filepaths and links to `VITALSENSE`. |

---

## 5. Remaining Open Decisions

The remaining 12 decisions remain explicitly **OPEN** and will be decided at their designated phase gates:

1. **`OD-02`:** Priority trade-offs if all candidate metrics cannot fit (Phase 1 scope freeze).
2. **`OD-05`:** Phase 2 assistant UX, supported question types, proactive insight triggers, and usage limits (Before Phase 2 scope freeze).
3. **`OD-06`:** Phase 4 medical document formats and extraction approach (Before Phase 4 implementation).
4. **`OD-08`:** Final product name and brand availability (Before public branding/launch).
5. **`OD-09`:** Monetization and long-term cost model (Before commercial pricing commitments).
6. **`OD-10`:** Success measures and numeric targets (Before production release).
7. **`OD-11`:** Forecast readiness thresholds per use case (Before Phase 3 ML release).
8. **`OD-12`:** Medical intended use, validation approach, and approval roles (Before Phase 4 release).
9. **`OD-13`:** Family roles, minors, caregiver consent, and revocation (Before Phase 5 release).
10. **`OD-15`:** User workflow-history view for privacy operations (Before Phase 1 privacy UI release).
11. **`OD-20`:** Formal backup RPO and RTO targets (Before production deployment).
12. **`OD-21`:** External AI provider, zero-retention terms, and cost limits (Before Phase 2 provider integration).

---

## 6. Architecture Recommendations Requiring Future Technical Validation

The following architectural recommendations were identified during Milestone 0.6 that require concrete technical validation during subsequent implementation phases:

1. **Android Room + SQLCipher Integration:** Technical spike required in Milestone 0.7/0.8 to validate `net.zetetic:sqlcipher-android` compatibility with the latest AndroidX Room release and Android 14/15 16KB memory page alignments.
2. **Desktop Framework Selection:** Prototype trade-off comparison between **Flutter Desktop** vs. **Tauri (Rust)** to confirm the optimal balance of SQLCipher binding stability, native DPAPI/Keychain integration, and binary distribution size.
3. **Health Connect Background Sync Reliability:** Empirical testing required on physical Android devices across multiple OEMs (Samsung OneUI, Google Pixel, Xiaomi MIUI) to validate background sync frequency under aggressive OS battery optimization profiles.
4. **Web Crypto Session Key Handling:** Validation of memory-clearing semantics in modern JavaScript engines to verify how effectively cryptographic key material is evicted from heap memory on tab closure or logout.
5. **PostgreSQL Multi-Device Concurrency:** Load testing with Locust/k6 in Milestone 0.7 to verify that the shared `asyncpg` connection pool handles 5 concurrent client devices per user without connection starvation.

---

## 7. Diagram Deliverables

Five comprehensive architecture diagrams were produced and integrated into [system_architecture.md](file:///e:/Projects/VITALSENSE/docs/architecture/system_architecture.md):

1. **Architecture Overview Diagram (Mermaid `graph TD`):** Details five client form factors, Nginx reverse proxy, FastAPI modular monolith namespaces, independent background workers, PostgreSQL authoritative persistence, and the isolated n8n automation engine.
2. **Five-Platform System Context Diagram (Mermaid `graph LR`):** Illustrates the relationship between native platform sensors (Health Connect, HealthKit), the five first-class client applications, and backend services.
3. **Offline Synchronization & Tombstone Reconciliation Flow (Mermaid `sequenceDiagram`):** Illustrates bidirectional batch sync, `SYNC_CURSOR_EXPIRED` detection for devices offline >30 days, and safe non-destructive reconciliation preserving offline drafts.
4. **Authentication & Rotating Session Lifecycle Flow (Mermaid `sequenceDiagram`):** Illustrates Argon2id login, 15-minute JWT issuance, 7-day rotating refresh token exchange, and immediate token-family revocation upon reuse detection.
5. **n8n Security & Privacy Boundary Diagram (Mermaid `graph TD`):** Details the isolation boundary between n8n and the trusted application core, highlighting authenticated webhook verification, least-privilege service tokens, and zero direct database connectivity.

---

## 8. Milestone 0.7 Implementation Proposal

With Milestone 0.6 complete and all ten P0 decisions consolidated, the proposed plan for **Milestone 0.7: Core Authentication, Data Ingestion, and Offline Sync Foundation** is ready for Product Owner approval.

### 8.1 Workstreams & Implementation Sequence

```text
Sequence of Milestone 0.7 Workstreams:
[Workstream 1: Database Migration 002]
         │
         ▼
[Workstream 2: Shared Models & Schemas Update]
         │
         ▼
[Workstream 3: Authentication & Session Service]
         │
         ▼
[Workstream 4: Batch Ingestion & Sync Endpoint]
         │
         ▼
[Workstream 5: Automated Verification & CI Activation]
```

1. **Workstream 1 — Alembic Migration 002 (`database/postgres/migrations/versions/002_auth_sync_expanded_metrics.py`):**
   - Seed expanded 5 metrics (`resting_heart_rate`, `blood_pressure_systolic`, `blood_pressure_diastolic`, `blood_oxygen_saturation`, `blood_glucose`).
   - Add `superseded_by_id` revision lineage foreign key on `health_records`.
   - Create `sync_tombstones` table.
   - Create `auth_credentials` and `auth_refresh_tokens` tables.
2. **Workstream 2 — Domain Models & Common Schemas (`packages/python-common`):**
   - Update SQLAlchemy models: `AuthCredential`, `AuthRefreshToken`, `SyncTombstone`.
   - Add Pydantic schemas for authentication request/response, token refresh, and batch sync payloads.
   - Implement Argon2id password hashing and verification utilities.
3. **Workstream 3 — Authentication & Session Service (`services/api`):**
   - Implement `/api/v1/web/auth` (cookie-based) and `/api/v1/mobile/auth` (token-based) endpoints.
   - Implement token rotation and token-family reuse detection logic.
   - Enforce rate-limiting and audit event logging.
4. **Workstream 4 — Batch Ingestion & Synchronization Service (`services/mobile_api`):**
   - Implement `/api/v1/mobile/sync` endpoint.
   - Enforce idempotent ingestion via `uq_source_records_idempotency`.
   - Implement tombstone delta query and `SYNC_CURSOR_EXPIRED` logic.
5. **Workstream 5 — Automated Testing, OpenAPI Drift Check, and CI Activation:**
   - Write pytest test suites: `test_migration_002.py`, `test_auth_service.py`, `test_sync_endpoint.py`.
   - Re-export OpenAPI 3.1.0 contract and verify zero drift.
   - Commit `.github/workflows/ci.yml` so automated checks run on GitHub.

### 8.2 Acceptance Criteria for Milestone 0.7
- 100% test pass rate across new and existing test suites (minimum 30+ tests).
- Migration 002 upgrades cleanly to `head` and safely downgrades to `001_initial_core_schema` on PostgreSQL.
- Token family revocation verified: presenting a consumed refresh token immediately invalidates all tokens in the family.
- Batch sync deduplication verified: submitting identical measurements with the same idempotency key produces zero duplicate rows.
- Stale device recovery verified: submitting sync with `last_sync > 30 days` returns HTTP 409 `SYNC_CURSOR_EXPIRED`.
- Zero floating-point arithmetic errors across all 10 metric observations.

### 8.3 Infrastructure & Free-Tier Considerations
- Fits entirely within local PostgreSQL and Python 3.12 virtual environment.
- Cloud staging deployment will fit comfortably within free-tier managed services (e.g. Supabase Free PostgreSQL or Neon Serverless PostgreSQL + Render/Railway Free Web Service).

---

## 9. Verification Results

All quality gates were verified prior to concluding Milestone 0.6:

```text
Interpreter: E:\Projects\VITALSENSE\.venv\Scripts\python.exe (Python 3.12.10, 64-bit)
```

1. **Python Common Import Verification:**
   - Command: `.\.venv\Scripts\python.exe -c "import vitalsense_common; print('vitalsense_common OK')"`
   - Result: `vitalsense_common OK` (Exit Code: `0`)
2. **FastAPI Application Import Verification:**
   - Command: `.\.venv\Scripts\python.exe -c "from services.api.main import app; print('FastAPI app OK')"`
   - Result: `FastAPI app OK` (Exit Code: `0`)
3. **Pytest Test Suite Verification:**
   - Command: `pytest -v`
   - Result: **16 passed, 1 warning in 1.94s** (Exit Code: `0`)
4. **OpenAPI Drift Verification:**
   - Command: `python services/export_openapi.py; git diff --exit-code packages/api-contracts/openapi/v1.json`
   - Result: Zero schema drift detected (Exit Code: `0`)

---

## 10. Files Changed

The following files were created or modified during Milestone 0.6:

### Created:
1. `prompts/012_milestone_06_architecture_consolidation_and_decision_finalization.md`
2. `docs/architecture/approved_decisions_record.md`
3. `docs/architecture/system_architecture.md`
4. `docs/milestone_06_architecture_consolidation_and_decision_finalization_report.md`

### Modified:
1. `docs/VitalSense_SRS_v1.1.1_Open_Decision_Register.md`
2. `docs/architecture/decision_workshop.md`
3. `docs/VitalSense_PRD_v1.1.md`
4. `docs/VitalSense_SRS_v1.1.1_Merged.md`
5. `docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv`
6. `TECHNICAL.md`
7. `README.md`
8. `PROGRESS.md`

---

## 11. Strict Execution Boundary Confirmation

I formally confirm that during Milestone 0.6:
- **NO** application feature code was written or modified.
- **NO** database schema changes were made.
- **NO** database migrations were created or executed.
- **NO** API router endpoints or implementations were altered.
- **NO** dependencies were installed, upgraded, or removed.
- **NO** cloud deployments were performed.
- **NO** git commits or pushes were executed.

All work performed was strictly confined to technical documentation, architecture blueprints, decision consolidation, and milestone planning.

---

*End of Milestone 0.6 Verification Report.*  
*Awaiting Product Owner review and approval to proceed with Milestone 0.7.*

