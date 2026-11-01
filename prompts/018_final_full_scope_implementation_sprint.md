# VitalSense — Final Full-Scope Implementation Sprint

## Prompt Text

```text
VITALSENSE — FINAL FULL-SCOPE IMPLEMENTATION SPRINT

You are taking the role of the complete engineering organization responsible for delivering VitalSense: Principal Software Architect, Senior Backend Engineer, Senior Frontend Engineer, Mobile Engineer, Desktop Engineer, Data Engineer, AI/ML Engineer, Security Engineer, DevOps Engineer and QA Lead.

OBJECTIVE
Deliver the most complete genuinely functional implementation of the original VitalSense vision possible within less than 10 hours, deadline 2 November 2026. This is an implementation task, not merely planning. Do not call the whole product complete if substantial work remains.

PROJECT
Repository: https://github.com/vinaykounchi101-pixel/VITALENSE
Workspace: E:\Projects\VITALSENSE
Sprint branch: sprint-full-scope-foundation
Reported base: milestone-0.7.1.2-sync-integrity-verification, commit 2e274318b4e0b1963e3dc40470c41ecdebf1b061.

1. REPOSITORY PREFLIGHT
Verify actual branch, HEAD, remote tracking and working tree. Read PRD, SRS, ADR-001, architecture blueprint, decision register, technical docs, progress docs, sprint audit, feature matrix, dependency map, execution plan and risk register. Inspect code behind claimed complete features. Reuse existing work; do not recreate completed milestones or repeat a valid audit unnecessarily. Treat reports as claims requiring verification.

2. CRITICAL BACKEND CORRECTION — PERMANENT REPLAY PROTECTION
An independent review found that tombstones last 30 days, while ingestion deduplication primarily checks idempotency keys. Clients without keys receive random generated keys. Device source IDs may not be independently protected after tombstone pruning.

Reproduce against PostgreSQL: ingest an observation with a stable device source ID; delete it; create tombstone; prune tombstone; replay original source ID; prove deleted record cannot be recreated; prove a different valid record can still be ingested.

Inspect schema, migrations, ingestion and deletion flows. Evaluate and implement permanent replay protection, potentially a partial unique index on (person_id, source_name, source_record_id) for non-null IDs, plus service-level duplicate handling. Do not assume the index alone suffices. Check existing data for conflicts before migration. Preserve provenance, NULL behavior, existing clients without idempotency keys, raw payload pruning, deletion precedence, user/source isolation and concurrent safety. Do not silently delete or rewrite records.

Test same-person duplicates, replay after deletion, replay after tombstone pruning, concurrent duplicate ingestion, different people, different sources, null source IDs, explicit idempotency keys, raw payload pruning, immutable corrections and deletion precedence. Verify migration upgrade, downgrade and re-upgrade. Resolve this before dependent work or document a specific blocker and safe alternative.

3. PRESERVE APPROVED ARCHITECTURE
Approved stack:
- Web: Next.js, React, TypeScript, Tailwind.
- Mobile: React Native + Expo + TypeScript.
- Backend: Python, FastAPI, PostgreSQL, SQLAlchemy, Pydantic.
- Analytics/ML: Python, Pandas, NumPy, scikit-learn.
- n8n: external workflow orchestration only.

Do not silently replace React Native + Expo with Kotlin/Jetpack Compose or SwiftUI. Use Expo development builds, native adapters where needed for Health Connect, HealthKit, encrypted storage and background execution. Windows and macOS are first-class targets; choose a maintainable desktop approach consistent with existing architecture. Do not introduce unrelated frameworks merely to claim five-platform support. Label scaffolds honestly.

Preserve ADR-001: ten approved Phase 1 metrics; canonical units and validation; paired BP validation; immutable corrections and revision lineage; sync tombstones and per-device cursors; safe full resync preserving offline drafts; SQLCipher AES-256 native storage; IndexedDB + Web Crypto AES-GCM-256 web storage; platform-secure key storage; self-hosted PostgreSQL identity; Argon2id; rotating refresh tokens; secure cookies/native storage; privacy, retention and deletion; modular monolith with logical Web/Mobile API boundaries; shared identity and canonical records; independent client release pipelines; n8n must not access the DB or receive identifiable health data. Keep unresolved decision-register items open; do not silently finalize them.

4. FULL PRODUCT VISION
Implement coherently as time permits:
A. Web: registration/login, sessions, dashboard, metric cards, charts, history, manual entry, paired BP validation, correction/deletion, daily insights, analytics, forecasting, import, privacy/account settings, device sessions, offline access and sync. Connect screens to real APIs. No fake data or hardcoded success.
B. Mobile: React Native + Expo, authentication, overview, history, manual entry, encrypted offline storage, sync, Android Health Connect, iOS HealthKit where feasible, permissions and background sync. Handle denied permissions/offline/missing measurements. Never fabricate sensor readings.
C. Analytics: daily/weekly aggregation, trends, personal baselines, rolling averages, variability, data quality, missing data, activity/sleep summaries and data-supported recovery estimates. Enforce person boundaries.
D. AI: daily briefing and structured insights, provider abstraction, server-side Gemini key if used, deterministic offline fallback, grounded in real data, no invented measurements, no unnecessary PHI disclosure.
E. ML: genuine statistical forecasting foundations, baselines, rolling trends, anomaly detection, justified uncertainty bounds, data sufficiency and model/version metadata. Do not call moving averages trained ML. No forecasts without sufficient history. Never diagnose. Required disclaimer: “Insights are for educational and wellness tracking only, never medical diagnosis.”
F. Imports: Apple Health exports, supported Google Takeout data, CSV/JSON. Validate, preserve provenance, detect duplicates, report rejected records, support safe retries. Do not call file parsers live integrations.
G. Family: person profiles, switching, per-person records, ownership and access boundaries.
H. Medical: document and clinical-record foundations with metadata, ownership, privacy and validation. No diagnosis claims.
I. Fitness: exercise library, workout sessions, sets/reps, muscle mapping, history and progress. Future anatomy/body map and recovery estimates. Do not copy proprietary MuscleWiki content/assets; use original/licensed assets.
J. Privacy: export, deletion, retention, sessions, permissions, audit, secure file handling and sensitive-data redaction. Do not claim regulatory compliance without evidence.
K. Deployment: API and web Dockerfiles, PostgreSQL, Docker Compose, env examples, health checks, migrations, retention scheduling and deployment docs. Never commit secrets.

5. PRIORITIES
P0: permanent replay protection; backend security/data integrity; analytics/API; functional Web auth/dashboard; record entry/history/validation; offline/sync foundations; privacy/export/delete; reproducible backend/web deployment.
P1: React Native app; daily AI with deterministic fallback; statistical forecasting; imports; person switching; Health Connect/HealthKit adapters.
P2: Windows/macOS; medical records; advanced family permissions; advanced workout/anatomy foundations.
This is an execution order, not permission to abandon the long-term vision.

6. PARALLEL WORK
Parallelize only independent workstreams: backend, web, React Native, integrations/imports, desktop/future foundations, deployment/testing/docs. Define contracts/data ownership first. Avoid concurrent edits to the same migrations, contracts or core services. Integrate frequently and run regression tests. No empty placeholder files to inflate progress.

7. ENGINEERING QUALITY
Type-safe code, domain boundaries, reusable services/components, consistent errors, validation, service-level authorization, DB constraints for invariants, idempotency, secret safety, no fabricated health data, fake integrations, swallowed exceptions, unexplained TODOs in claimed-complete features, unnecessary dependencies, destructive migrations without rollback, direct DB access from clients or n8n.

8. VERIFICATION
Backend: PostgreSQL suite, auth, authorization/person isolation, ingestion, permanent replay, sync/full-resync, retention, analytics, AI fallback, forecasting, imports, privacy/deletion.
Web: production build, auth, dashboard integration, manual entry, history/charts, validation, offline, sync, session expiry/logout.
Mobile: dependency installation, TS checks, build validation where possible, encryption architecture, auth, sync, denied permissions.
Desktop: actual build validation; distinguish scaffold from working app.
Regenerate OpenAPI and verify client compatibility. If tests cannot run due to environment restrictions, say so; never invent results.

9. DOCUMENTATION
Update PROGRESS.md, TECHNICAL.md, PRD/SRS as needed, decision register, feature matrix, dependency map, risk register, sprint plan, API docs and setup/deployment docs. Archive new prompts under prompts/ and final report under docs/full_scope_sprint/. Classify every feature as implemented and tested, implemented but not fully tested, partially implemented, scaffold only, not implemented or blocked. A model, endpoint or screen alone does not make a feature complete.

10. GIT SAFETY
Continue on sprint-full-scope-foundation after verifying it. Do not modify main or dev, merge, force-push, rewrite history or deploy without explicit approval. Never commit .env, credentials, keys or personal health data. Do not discard user work. Commit logical work in small commits and push only to sprint branch if allowed.

11. TIME
Less than 10 hours. Suggested allocation: 60–90 min repository verification and replay fix; 2 hours backend analytics/intelligence/import/privacy; 3 hours working web app; 1.5 hours React Native foundation; 1 hour desktop/deployment foundations; final hour integration, regression, fixes and report. Adjust to real blockers. Do not spend most of the time planning. Reserve final hour for stabilization.

12. FINAL REPORT
Provide actual branch and final SHA; changed files/modules; migration history/status; backend tests; web build and functional checks; mobile build/verification; desktop status; analytics/AI/ML status; imports/privacy/integrations; deployment status; security/data integrity risks; incomplete functionality; exact next steps. Include actual commands and outputs for critical verification. Implementation, testing, build validation and deployment are different claims.

FINAL DIRECTIVE
Verify current sprint branch and repository. Reuse completed work. Fix permanent sync replay protection first. Preserve React Native + Expo. Then proceed through priorities, integrate and test continuously. Do not stop after planning. Do not ask approval for already approved ADR-001 decisions. Do not silently make materially new architectural decisions. Where time is insufficient, implement the safest useful foundation, document limitations and move on. Deliver the strongest genuinely working VitalSense product possible without sacrificing security, data integrity or architecture.

BEGIN EXECUTION.
```
