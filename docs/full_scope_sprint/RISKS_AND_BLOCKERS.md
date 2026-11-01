# VitalSense — Risks, Critical Blockers & Mitigations
## Full-Scope Sprint Operational Safeguards

**Document Reference:** `docs/full_scope_sprint/RISKS_AND_BLOCKERS.md`  
**Generated:** 2026-11-02  

---

## 1. Critical Risks & Immediate Mitigations

| Risk | Impact | Likelihood | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **1. Time Pressure Leading to Fake/Mocked Code** | HIGH | HIGH | **Zero Fake Code Rule:** Never mock core business logic or claim unverified features work. If an external model (e.g. Gemini) is offline, utilize real statistical heuristics (e.g. rolling averages, standard deviation anomaly bounds) and explicitly label them as statistical baselines. |
| **2. AI/ML Diagnostic Hallucination** | CRITICAL | MEDIUM | **Mandatory Non-Diagnostic Disclaimer:** Every insight, prediction, and trend forecast must display the verified disclaimer: *"Insights are for informational and wellness tracking only, never medical diagnosis."* |
| **3. Mobile & Desktop Toolchain Overhead** | HIGH | HIGH | Focus genuine runtime execution on the **Web Application** and **Android Client Architecture**, while establishing clean, compilable, verified scaffoldings with shared models for iOS, Windows, and macOS. |
| **4. Accidental Secret or Credential Leak** | CRITICAL | LOW | Never commit `.env` or access files containing production credentials. All configuration is strictly environment variable driven with safe placeholders in `.env.example`. |
| **5. Database Deadlocks on Concurrent Sync/Reset** | HIGH | LOW | Re-use row-level locking patterns (`with_for_update()`) and explicit transaction isolation proven in Milestone 0.7.1.2. |
| **6. Windows Sandbox Loopback Socket Restrictions** | MEDIUM | HIGH | Commands requiring communication with local PostgreSQL (`localhost:5432`) must be executed with appropriate sandbox bypass permissions when testing. |

---

## 2. Platform Buildability Matrix & Boundaries

| Platform | Runtime Target | Build Tooling | Delivery Strategy in 10-Hour Sprint |
| :--- | :--- | :--- | :--- |
| **Web** | Node 20+, Modern Browsers | Next.js 14, React 18, Tailwind | **Full Working Journey:** Login, Dashboard, Metrics, Manual Entry, Charts, Offline IndexedDB. |
| **Android** | Android 14 (API 34)+ | Gradle 8+, Kotlin 2.x, Jetpack Compose | **Working Architecture:** Complete project, Room entities, Compose UI screens, Sync client. |
| **iOS** | iOS 17+ | Swift 5.9, SwiftUI, Xcode | **Verified Scaffold:** Buildable project structure, HealthKit manager, SQLite protocol. |
| **Windows** | Windows 10/11 | Flutter / WinUI, C# / Dart | **Verified Scaffold:** Desktop shell, secure key storage interface, sync protocol. |
| **macOS** | macOS 13+ | Flutter / SwiftUI | **Verified Scaffold:** Desktop shell, Keychain storage interface, sync protocol. |

---

## 3. Immediate Action Plan

1. Create and switch to new branch `sprint-full-scope-foundation` from `milestone-0.7.1.2-sync-integrity-verification` (`2e274318b4e0b1963e3dc40470c41ecdebf1b061`).
2. Implement Phase 1: Database Migration 005, Python domain services for Analytics, AI Intelligence / ML Forecasting, External Importers, and Privacy.
3. Validate all backend services with automated tests in `tests/`.
4. Implement Phase 2: Web Application in `apps/web/` with full interactive dashboard.
5. Implement Phase 3: Android Application in `apps/android/`.
6. Implement Phase 4: Multiplatform scaffoldings in `apps/ios/`, `apps/desktop-windows/`, `apps/desktop-macos/`.
7. Verify all quality gates, update documentation, and publish to GitHub.

