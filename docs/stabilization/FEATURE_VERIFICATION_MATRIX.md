# VitalSense — Feature Verification Matrix

This matrix provides an honest, evidence-based accounting of every major feature across all five target platforms (Backend/API, Web, Mobile, Windows Desktop, and macOS Desktop) in the `stabilization/security-integrity-verification` branch.

All features are rigorously classified into:
- **Verified Passed / Runtime-Verified:** Code executed and verified with direct automated test or build output.
- **Implemented but Unverified at Runtime:** Fully implemented and typechecked, but native device/runtime execution could not run due to local host toolchain limitations (e.g. no Android SDK / Xcode / Rust).
- **Partially Implemented:** Core path implemented with specific sub-features planned for later milestones.
- **Blocked:** Blocked by environment or upstream dependencies.

---

## 1. Core Authentication & Identity

| Feature | Platform | Implementation Status | Verification Status | Test Evidence | Remaining Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Argon2id Password Hashing** | Backend | Verified Implemented | Verified Passed | `tests/test_auth_service.py::test_password_validation_and_argon2id_hashing` | None. Parameters: 64 MiB memory, 3 iterations, 4 parallelism. |
| **JWT Access & Rotating Refresh Tokens** | Backend | Verified Implemented | Verified Passed | `tests/test_auth_service.py::test_auth_service_refresh_token_rotation_and_reuse_revocation` | None. Token family theft detection revokes all descendants. |
| **Single-Use Database-Backed Password Reset** | Backend | Verified Implemented | Verified Passed | `tests/test_corrections_auth_retention.py::test_password_reset_single_use_lifecycle_and_replay_prevention`, `test_sync_integrity.py::test_concurrent_password_reset_confirmation` | None. Row-level `with_for_update()` prevents race conditions. |
| **HttpOnly Strict Cookie Auth & CSRF** | Web / API | Verified Implemented | Verified Passed | `tests/test_hardening_security_sync.py::test_cookie_security_samesite_strict_and_httponly`, `test_csrf_double_submit_protection` | None. Tokens omitted from response body; double-submit cookie CSRF enforced. |
| **Bearer Token Mobile Auth & Hardware Storage** | Mobile (Expo) | Verified Implemented | Code-Verified | `apps/mobile/src/services/storage/secureTokens.ts` using `expo-secure-store` | Physical device testing on Android Keystore / iOS Keychain pending app store build. |
| **Desktop DPAPI / Keychain Token Protection** | Desktop (Win/Mac) | Implemented | Source-Verified | `apps/desktop-windows/src-tauri/src/security/dpapi.rs`, `apps/desktop-macos/src-tauri/src/security/keychain.rs` | Requires Rust/Cargo toolchain on host to compile binary. |

---

## 2. Ingestion, Synchronization & Data Integrity

| Feature | Platform | Implementation Status | Verification Status | Test Evidence | Remaining Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Permanent Source Replay Protection** | Backend / DB | Verified Implemented | Verified Passed | `tests/test_permanent_replay_protection.py` (12/12 passed) | None. Partial unique index on `(person_id, source_name, source_record_id) WHERE source_record_id IS NOT NULL` + savepoint recovery. |
| **Tombstone Resurrection Prevention** | Backend / DB | Verified Implemented | Verified Passed | `tests/test_sync_integrity.py::test_tombstone_prevents_device_record_id_replay_after_health_record_deletion`, `test_tombstone_blocks_superseding_correction_with_409` | None. `device_record_id` tracked on tombstone table; in-batch deletion ordering. |
| **Stale Cursor (>30d) Expiration & Safe Resync** | Backend / API | Verified Implemented | Verified Passed | `tests/test_corrections_auth_retention.py::test_stale_device_cursor_expiry_and_full_resync_reconciliation`, `test_ingestion_sync.py::test_cursor_expiration_returns_409` | None. Returns HTTP 409 `SYNC_CURSOR_EXPIRED`; client preserves offline drafts. |
| **Offline SQLite Encrypted Storage (SQLCipher)** | Mobile (Expo) | Implemented | **Implemented but Unverified at Runtime** | `apps/mobile/src/services/storage/sqlcipher.ts`, `app.json` config plugin (`useSQLCipher: true`) | Native runtime verification pending on Android/iOS physical device/emulator. Host lacks Android SDK / Xcode. |
| **IndexedDB Offline Web Queue** | Web (Next.js) | Verified Implemented | Build-Verified | `apps/web/src/services/storage/offlineStore.ts` (`npm run build` 0 errors) | Browser IndexedDB queue drains automatically on reconnection. |
| **Paired Blood Pressure Validation** | Backend | Verified Implemented | Verified Passed | `tests/test_ingestion_sync.py::test_paired_blood_pressure_validation` | None. Enforces systolic strictly greater than diastolic. |

---

## 3. Platform Health Integrations

| Feature | Platform | Implementation Status | Verification Status | Test Evidence | Remaining Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Health Connect Adapter** | Mobile (Android) | Verified Implemented | Typecheck-Verified | `apps/mobile/src/services/health/HealthConnectAdapter.ts` (`npx tsc` 0 errors) | Implemented metrics: Steps, HeartRate, RestingHeartRate, SleepSession, ActiveEnergy, BloodPressure (paired), OxygenSaturation, BloodGlucose. Stable deterministic IDs (`deriveStableSourceId`). Zero data fabrication. Direct workout sessions deferred to manual entry. |
| **Apple HealthKit Adapter** | Mobile (iOS) | Verified Implemented | Typecheck-Verified | `apps/mobile/src/services/health/HealthKitAdapter.ts` (`npx tsc` 0 errors) | Implemented metrics: Steps, HeartRate, SleepAnalysis, ActiveEnergyBurned, BloodPressure (paired). Uses HealthKit sample UUIDs or deterministic fallback IDs. Zero data fabrication. |
| **Health File Archive Import (CSV / Apple XML)** | Web / API | Verified Implemented | Verified Passed | `tests/test_integrations_and_privacy.py::test_csv_and_apple_health_xml_import` | None. Uploads and validates CSV / Apple Health export ZIP/XML. |

---

## 4. Privacy, GDPR Portability & Erasure

| Feature | Platform | Implementation Status | Verification Status | Test Evidence | Remaining Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GDPR Art. 20 Structured JSON Data Export** | Backend / API | Verified Implemented | Verified Passed | `tests/test_integrations_and_privacy.py::test_privacy_export_and_cascading_deletion` | None. Exports top-level manifest + 8 domain entity categories with zero credential leakage. |
| **GDPR Art. 17 Irreversible Cascading Erasure** | Backend / API | Verified Implemented | Verified Passed | `tests/test_integrations_and_privacy.py::test_privacy_export_and_cascading_deletion` | None. Cascades across all 8 tables, revokes tokens, clears cursors, leaves anonymized audit tombstone. |
| **Account Deletion Transaction Safety & Rollback** | Backend / API | Verified Implemented | Verified Passed | `tests/test_integrations_and_privacy.py::test_account_deletion_transaction_rollback_on_failure` | None. Wrapped in atomic database savepoint; simulated mid-deletion error safely rolls back 100% of data. |
| **Offline Upload Post-Deletion Rejection** | Backend / API | Verified Implemented | Verified Passed | `tests/test_integrations_and_privacy.py::test_pending_offline_uploads_cannot_resurrect_deleted_account` | None. Deletion precedence rejects subsequent offline uploads with HTTP 403 Forbidden. |
| **30-Day Operational Retention Pruner** | Backend / Worker | Verified Implemented | Verified Passed | `tests/test_corrections_auth_retention.py::test_operational_retention_prune_job_runner`, `test_hardening_security_sync.py::test_operational_retention_pruning` | None. Standalone CLI & worker loop prunes expired `raw_payload` and `sync_tombstones`. |

---

## 5. Analytics, AI Briefings & Forecasting

| Feature | Platform | Implementation Status | Verification Status | Test Evidence | Remaining Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **10-Metric Analytics & Recovery Score** | Backend | Verified Implemented | Verified Passed | `tests/test_analytics.py::test_analytics_dashboard_summary_and_trends` | None. Deterministic 0-100 score + 7-day rolling baseline calculation. |
| **Daily AI Intelligence Briefing** | Backend / API | Verified Implemented | Verified Passed | `tests/test_intelligence.py::test_intelligence_daily_briefing_and_ml_forecasting` | Uses Gemini API when configured; deterministic clinical fallback heuristics when offline. |
| **Linear Trend ML Forecasting** | Backend / API | Verified Implemented | Verified Passed | `tests/test_intelligence.py::test_intelligence_daily_briefing_and_ml_forecasting` | Scikit-learn linear regression with 95% uncertainty intervals and mandatory medical disclaimer. |
| **Medical & Wellness Disclaimer Enforcement** | Full-Stack | Verified Implemented | Verified Passed | Pydantic schema default & UI modal rendering: *"Insights are for educational and wellness tracking only, never medical diagnosis."* | None. Hardcoded in responses and UI views. |

---

## 6. Client User Interfaces

| Client | Framework | Implementation Status | Verification Status | Build / Test Evidence | Remaining Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Web Frontend** | Next.js 14 / Tailwind | Verified Implemented | Verified Passed | `npm run build` completed with code 0 (5 static pages) | None. Auth, Dashboard, SVG charts, modals fully connected. |
| **Mobile App** | React Native / Expo | Verified Implemented | Typecheck-Verified | `npx tsc --project apps/mobile/tsconfig.json` exited with code 0 | Native binary packaging (`npx expo run:android` / `run:ios`) requires Android SDK / Xcode. |
| **Windows Desktop** | Tauri / Rust | Implemented | Source-Verified | `apps/desktop-windows/src-tauri/Cargo.toml`, `main.rs`, DPAPI | Cargo / Rust toolchain required on host for local compilation. |
| **macOS Desktop** | Tauri / Rust | Implemented | Source-Verified | `apps/desktop-macos/src-tauri/Cargo.toml`, `main.rs`, Keychain | macOS host with Xcode and Rust toolchain required for compilation. |

---

## 7. Containerization & Deployment

| Component | Technology | Implementation Status | Verification Status | Evidence | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend Container** | Docker (FastAPI) | Verified Configured | Source-Verified | `infrastructure/docker/Dockerfile.api` entrypoint `services.api.main:app`, healthcheck `/health` | Production non-root user `10001`. |
| **Frontend Container** | Docker (Next.js) | Verified Configured | Source-Verified | `infrastructure/docker/Dockerfile.web` multi-stage node:20-alpine | Dedicated `nextjs:nodejs` runtime user. |
| **Reverse Proxy** | Nginx | Verified Configured | Source-Verified | `infrastructure/docker/nginx.conf` routing `/api/`, `/health`, `/ready`, `/` | Security headers (CSP, X-Frame-Options, X-Content-Type) active. |
| **Compose Orchestrator**| Docker Compose 3.8 | Verified Configured | Source-Verified | `docker-compose.yml` with mandatory environment variables and health dependencies | Eliminated insecure fallback secrets. |
