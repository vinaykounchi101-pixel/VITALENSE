# VitalSense — Full-Scope Sprint Execution Plan
## Rapid Execution Strategy (<10 Hour Timeframe)

**Document Reference:** `docs/full_scope_sprint/SPRINT_EXECUTION_PLAN.md`  
**Generated:** 2026-11-02  
**Target Completion:** 2026-11-02  

---

## 1. Execution Timeline & Sprint Phases

```text
Phase 1: Database & Shared Backend Extensions   [Hours 0.5 - 2.0]
├── Migration 005 (insights, external imports, medical records, workouts)
├── Analytics domain service (rollups, resting HR trends, sleep efficiency)
├── AI Daily Briefing & ML Forecasting (Gemini API + deterministic fallbacks)
├── External health importers (Apple Health XML, Google Takeout JSON)
└── Privacy exports & cascading account deletion

Phase 2: API Gateway & OpenAPI Contracts        [Hours 2.0 - 3.0]
├── Web API routers (/analytics, /insights, /integrations, /privacy)
├── Mobile API routers (/analytics, /insights, /integrations, /privacy)
├── OpenAPI contract synchronization & verification
└── Automated backend test suite execution (targeting >75 tests)

Phase 3: Production Web Application (`apps/web`) [Hours 3.0 - 6.0]
├── Next.js 14+ / React 18 TypeScript application setup
├── Design system styling (Tailwind CSS, dark/light theme, typography)
├── Cookie authentication & session handling
├── Health dashboard (live metric cards, trends, charts)
├── Manual health entry modal with paired BP validation
├── Daily AI Briefing component with medical disclaimers
└── Offline IndexedDB local sync queue manager

Phase 4: Android Application (`apps/android`)    [Hours 6.0 - 7.5]
├── Android Kotlin & Jetpack Compose project structure
├── Room + SQLCipher local encrypted database models
├── Health Connect sync bridge adapter
├── Material 3 responsive health dashboard UI
└── Android sync worker execution harness

Phase 5: iOS, Windows & macOS Scaffoldings       [Hours 7.5 - 8.5]
├── iOS SwiftUI client scaffold with HealthKit data abstraction
├── Windows desktop application scaffold with encrypted SQLite store
└── macOS desktop application scaffold with Keychain integration

Phase 6: Deployment, CI & Final Quality Gate     [Hours 8.5 - 9.5]
├── Dockerfile.api, Dockerfile.web, docker-compose.yml
├── Nginx reverse proxy configuration
├── Full test suite verification across backend and web
└── Documentation updates (PROGRESS.md, TECHNICAL.md) & Git publication
```

---

## 2. Work Breakdown Structure

### Phase 1: Database & Backend Services (Est: 1.5 hrs)
- **Task 1.1:** Create Alembic Migration `005_extended_features.py` adding `daily_insights`, `external_imports`, `medical_records`, `workout_details`.
- **Task 1.2:** Update models and schemas in `packages/python-common/src/vitalsense_common/`.
- **Task 1.3:** Implement `services/analytics/service.py` with multi-metric aggregation and percentile calculations.
- **Task 1.4:** Implement `services/intelligence/` for daily AI briefing (Gemini API with typed structured output + deterministic offline fallbacks) and `ml_forecasting.py` for linear rolling trends and anomaly detection.
- **Task 1.5:** Implement `services/integrations/importer.py` supporting Apple Health XML/ZIP and Google Takeout JSON files.
- **Task 1.6:** Implement `services/privacy/service.py` for GDPR data export packaging and atomic cascading deletion.

### Phase 2: API Gateway & OpenAPI Contracts (Est: 1.0 hr)
- **Task 2.1:** Mount routers in `services/api/main.py` under `/api/v1/web` and `/api/v1/mobile`.
- **Task 2.2:** Add test suites: `tests/test_analytics.py`, `tests/test_intelligence.py`, `tests/test_integrations.py`, `tests/test_privacy.py`.
- **Task 2.3:** Run `services/export_openapi.py` to regenerate `packages/api-contracts/openapi/v1.json`.
- **Task 2.4:** Run `pytest -v tests/test_openapi_drift.py`.

### Phase 3: Web Application Implementation (Est: 3.0 hrs)
- **Task 3.1:** Initialize `apps/web` with Next.js 14, React 18, TypeScript, Tailwind CSS.
- **Task 3.2:** Configure API client with cookie handling and CSRF support.
- **Task 3.3:** Build authentication screens (Login, Register, Forgot Password, Reset Password).
- **Task 3.4:** Build Health Overview Dashboard (Summary cards for steps, heart rate, sleep, BP, SpO2, glucose).
- **Task 3.5:** Build Metric Details & Trend Charts (Daily, Weekly, Monthly views).
- **Task 3.6:** Build Manual Health Entry form with instantaneous validation.
- **Task 3.7:** Build AI Daily Briefing Card with explicit non-diagnostic medical disclaimer.
- **Task 3.8:** Build Data Management & Privacy screen (Export Data, Delete Account).

### Phase 4: Android Application Architecture (Est: 1.5 hrs)
- **Task 4.1:** Establish `apps/android` Gradle project with Kotlin 2.x and Jetpack Compose.
- **Task 4.2:** Create Android Room entities matching `vitalsense_common` health records.
- **Task 4.3:** Create Android Health Connect permission manager and ingestion mapper.
- **Task 4.4:** Create Android API client with JWT bearer tokens and offline sync worker.
- **Task 4.5:** Create Compose UI screens (Overview, Metric Detail, Sync Status).

### Phase 5: iOS, Windows & macOS Multiplatform Foundations (Est: 1.0 hr)
- **Task 5.1:** Scaffold `apps/ios` with Swift 5.9+ / SwiftUI, HealthKit manager, SQLite local store.
- **Task 5.2:** Scaffold `apps/desktop-windows` with WinUI / Flutter desktop configuration and DPAPI encryption.
- **Task 5.3:** Scaffold `apps/desktop-macos` with SwiftUI / Flutter macOS configuration and Keychain encryption.

### Phase 6: Orchestration, Testing & Publication (Est: 1.0 hr)
- **Task 6.1:** Build and verify Docker container configurations (`infrastructure/docker/`).
- **Task 6.2:** Execute full backend test suite (`pytest -v`) and verify 100% pass rate.
- **Task 6.3:** Verify Web application build (`npm run build`).
- **Task 6.4:** Update `PROGRESS.md`, `TECHNICAL.md`, and commit/push the sprint branch.

