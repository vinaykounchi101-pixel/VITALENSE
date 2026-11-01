# VITALSENSE — MILESTONE 0.6
## Architecture Consolidation & Decision Finalization

### ROLE

Act as a senior software architect, technical documentation engineer and architecture reviewer for VitalSense.

Your task is to consolidate the product-owner decisions approved during Milestone 0.5.3 into the existing project documentation.

This is a documentation and architecture-finalization milestone.

DO NOT begin application feature development.

---

## 1. FIRST: INSPECT THE REPOSITORY

Before making changes, inspect:

- README.md
- PROGRESS.md
- TECHNICAL.md
- docs/VitalSense_PRD_v1.1.md
- docs/VitalSense_SRS_v1.1.1_Merged.md
- docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv
- docs/VitalSense_SRS_v1.1.1_Open_Decision_Register.md
- docs/architecture/
- docs/milestone_05_3_product_owner_decision_review_and_architecture_finalization_report.md
- prompts/

Also inspect relevant existing architecture diagrams, API contracts and migration definitions.

Do not assume filenames or document contents. Locate and verify them.

Preserve existing project decisions unless superseded by the explicitly approved decisions below.

## 2. APPROVED PRODUCT-OWNER DECISIONS

Record the following decisions accurately.

### OD-01 — Phase 1 Metric Categories

Approved: Option B.

Include:
- steps
- heart_rate
- sleep_session
- active_energy
- workout_session
- resting_heart_rate
- blood_pressure_systolic
- blood_pressure_diastolic
- blood_oxygen_saturation (SpO2)
- blood_glucose

Define metric-specific units, validation, metadata and source tracking.

Blood pressure must support paired systolic/diastolic measurements.

Do not silently add weight/body measurements to this approval. Preserve them as a separately tracked scope item.

### OD-03 — Phase 0 Exit Acceptance Criteria

Technical choice delegated to the architecture assistant.

Use objective, independently verifiable acceptance gates covering:
- Foundation readiness
- Data pipeline readiness
- Cross-platform application readiness
- End-to-end release readiness

Include automated tests, migration verification, OpenAPI drift checks, ingestion integrity, health/readiness probes and platform-specific release checks.

Do not claim readiness merely because a checklist exists.

### OD-04 — Manual Entry and Correction

Approved: Option A.

- Controlled manual entry for approved metrics.
- Immutable revisions.
- Superseded-record tracking using superseded_by_id.
- Tombstones for deletions.
- Metric-specific validation and units.
- Corrections must preserve the original measurement timestamp and must not appear as new measurements.

### OD-07 — Data Retention and Deletion

Approved: Option A with recommended safeguards.

- Raw ingestion payload retention: 30 days.
- Raw payload removed after retention expires.
- Normalized records retained while the account is active.
- PHI-redacted server logs: 14 days.
- Account deletion grace period: 30 days.
- Rolling backup snapshots expire after 30 days.
- Backup restoration must reconcile against deletion records.
- Account deletion must cover personal records, derived analytics, predictions, caches and reports.
- Provide user export before deletion.
- Retention must be configurable.

Do not claim automatic GDPR/HIPAA compliance.

### OD-14 — Deletion Propagation and Offline Synchronization

Approved: Option A with safeguards.

- Dedicated synchronization tombstones.
- Per-device synchronization cursors.
- Expired cursor response: SYNC_CURSOR_EXPIRED.
- Safe full resynchronization.
- Preserve pending offline changes and drafts.
- Reconcile conflicts.
- Idempotent synchronization.
- Prevent duplicates and deleted-record resurrection.
- Account deletion overrides pending offline uploads.

IMPORTANT:
Never blindly wipe a local database when a cursor expires. Preserve pending changes and reconcile them with the authoritative server before replacing synchronized cache data.

PostgreSQL remains the canonical server-side data source.

### OD-16 — Platform Support

Approved: Option A, explicitly expanded by the product owner.

All five platforms are first-class targets:

1. Android
2. iOS
3. Windows
4. macOS
5. Web

All five must be planned and developed in parallel.

Requirements:
- Independent client applications and release pipelines.
- Shared identity and canonical health records.
- Shared API contracts and synchronization rules.
- Platform-specific data collection and integration.
- Independent platform testing.
- Mobile-first responsive user experience.

Android: evaluate Health Connect.
Apple platforms: evaluate HealthKit.
Desktop: primarily consume synchronized health data unless a suitable local integration exists.

Do not invent support for desktop phone sensors.

Validate minimum supported Windows and macOS versions before finalizing them.

### OD-17 — Local Database Encryption

Approved: Option A.

Apply equivalent local-data protection principles to all five platforms.

Requirements:
- Encrypted local health-data storage.
- SQLCipher AES-256 where SQLite is used.
- Cryptographically secure random encryption keys.
- Platform-appropriate secure key storage.
- Backup protection against unencrypted health database exposure.
- Secure logout and local data protection.
- Key-loss recovery and server resynchronization strategy.

The product owner has prior experience with Android Room.

Evaluate Room as an Android-specific abstraction, but do not assume it is the cross-platform database solution.

Propose platform-specific storage implementations behind common repository and synchronization contracts.

Web storage must use a browser-appropriate security architecture, including Web Crypto and protected key handling. Do not claim browser encryption is equivalent to native hardware-backed key storage.

Exact libraries remain subject to technical validation.

### OD-18 — Authentication and Sessions

Approved: Option A.

Self-hosted identity system.

- Argon2id password hashing.
- OAuth2 PKCE for planned Apple and Google sign-in.
- 15-minute access tokens.
- Rotating 7-day refresh tokens.
- Hashed refresh-token storage in PostgreSQL.
- Refresh-token reuse detection and token-family revocation.
- HttpOnly/Secure cookies for Web.
- CSRF protection.
- Secure platform-appropriate token storage.
- Rate limiting and brute-force protection.
- Password recovery.
- Session and device management.
- Revocation across devices.
- Authentication audit events.
- XSS prevention.

Do not claim HttpOnly cookies make an application immune to XSS or CSRF.

### OD-19 — Hosting and Backend Topology

Approved: Option A.

One centrally deployed backend initially, with strict internal module/service boundaries.

Requirements:
- Separate logical Web and Mobile API boundaries.
- Shared identity and canonical health data.
- Modular domain boundaries.
- Independently runnable background workers.
- Stateless application design where practical.
- Ability to run multiple backend instances for concurrent users and devices.
- Independent extraction and deployment of modules in the future.
- PostgreSQL remains canonical.

All five clients remain independent applications.

The backend must support concurrent users, multiple sessions and multiple devices.

The frontend must be mobile-first and responsive across phones, tablets, laptops and desktops.

### OD-22 — n8n Automation Boundary

Approved: Option A.

n8n is exclusively an automation and orchestration layer.

n8n may:
- Run scheduled workflows.
- Orchestrate notifications and reminders.
- Trigger approved backend operations.
- Connect external services.
- Coordinate non-sensitive workflows.

VitalSense backend retains responsibility for:
- Authentication and authorization.
- Sensitive health-data processing.
- Validation.
- Canonical database writes.
- Synchronization.
- Analytics and ML processing.

No direct n8n PostgreSQL writes.

Avoid sending sensitive or identifiable health measurements to n8n.

Use authenticated webhooks, least-privilege credentials, auditability and idempotency.

---

## 3. ARCHITECTURE RECONCILIATION

Review all existing documents for:

- Contradictory requirements.
- Outdated assumptions.
- Duplicate or conflicting decisions.
- Missing dependencies.
- Inconsistent terminology.
- Missing acceptance criteria.
- Inconsistent platform coverage.
- Database and synchronization conflicts.
- Security and privacy gaps.

Resolve only conflicts clearly superseded by approved decisions.

For decisions not explicitly finalized, preserve them as open decisions.

Do not invent product-owner approval.

## 4. DATABASE AND SYNCHRONIZATION ARCHITECTURE

Produce a clear architecture proposal covering:

- PostgreSQL as canonical server database.
- Platform-specific local databases.
- Offline-first data entry.
- Multi-device synchronization.
- Conflict resolution.
- Tombstones and deletion propagation.
- Device identity and sync cursors.
- Encryption and key management.
- Recovery after key loss.
- Idempotency and duplicate prevention.

Evaluate Room, SQLite/SQLCipher and browser IndexedDB/Web Crypto as appropriate.

Do not force one database implementation across every platform.

## 5. CROSS-PLATFORM APPLICATION ARCHITECTURE

Define a coherent architecture for five independent clients.

Clarify:
- Shared API contracts.
- Shared identity.
- Shared health-data model.
- Shared design principles.
- Platform-specific integrations.
- Responsive layouts.
- Mobile-first design.
- Independent builds and release processes.
- Platform-specific test strategies.

Do not select a desktop framework or unverified dependency without documenting the trade-offs.

## 6. DOCUMENTATION DELIVERABLES

Update the existing documents rather than creating unnecessary duplicates.

At minimum:

1. Open Decision Register.
2. SRS.
3. PRD, only where approved decisions require updates.
4. Technical architecture documentation.
5. Architecture diagrams.
6. Traceability matrix.
7. README and PROGRESS where relevant.

Create a consolidated decision record if the existing documentation does not provide a suitable location.

Create or update:
- Architecture overview diagram.
- Five-platform system context diagram.
- Offline synchronization flow.
- Authentication/session flow.
- n8n security boundary diagram.

Keep diagrams consistent with the written architecture.

## 7. NEXT MILESTONE PROPOSAL

Prepare a proposed Milestone 0.7 implementation plan.

Include:
- Workstreams.
- Dependencies.
- Recommended implementation order.
- Acceptance criteria.
- Automated tests.
- Risks and mitigations.
- Infrastructure requirements.
- Free-tier considerations.
- Platform-specific deliverables.

Do not begin Milestone 0.7 implementation.

## 8. STRICT EXECUTION RULES

- Documentation and architecture work only.
- No application feature implementation.
- No database schema changes.
- No migrations.
- No API implementation changes.
- No dependency installation or upgrades.
- No deployment.
- No commits or pushes.
- Preserve existing working code.
- Do not overwrite user work.
- Do not invent approvals.
- Maintain the existing documentation style where practical.

## 9. FINAL VERIFICATION REPORT

Create a report containing:

1. Documents inspected.
2. Documents updated.
3. Decisions recorded.
4. Conflicts found and resolutions.
5. Remaining open decisions.
6. Architecture recommendations requiring future validation.
7. Diagram deliverables.
8. Milestone 0.7 proposal.
9. Verification results.
10. Files changed.
11. Confirmation that no application implementation, schema, migration, API or deployment work was performed.

Before finishing, verify that all ten approved decisions are represented consistently across the relevant documentation.

Stop after completing the report.

Wait for product-owner review and approval before starting Milestone 0.7.

