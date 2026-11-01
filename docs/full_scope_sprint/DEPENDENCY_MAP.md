# VitalSense — Subsystem Dependency Map
## Sprint Architecture & Dependency Graph

**Document Reference:** `docs/full_scope_sprint/DEPENDENCY_MAP.md`  
**Generated:** 2026-11-02  

---

## 1. Architectural Layers & Cross-Cutting Boundaries

```mermaid
flowchart TD
    subgraph Client Applications
        WEB["apps/web (Next.js / React 18 / Tailwind)"]
        AND["apps/android (Kotlin / Compose / Room + SQLCipher)"]
        IOS["apps/ios (SwiftUI / HealthKit / SQLite)"]
        DSK["apps/desktop-* (Flutter / WinUI / SQLite)"]
    end

    subgraph API Gateway / Monolith ("services/api/main.py")
        SEC["Security & Auth Middleware (Argon2id, JWT, Cookies, Rate Limiter)"]
        ROUTER_WEB["Web Router (/api/v1/web)"]
        ROUTER_MOB["Mobile Router (/api/v1/mobile)"]
    end

    subgraph Domain Services ("services/*")
        AUTH["services/auth (AuthService)"]
        SYNC["services/sync (SyncService)"]
        ANALYTICS["services/analytics (AnalyticsService)"]
        INTEL["services/intelligence (DailyBriefing & MLForecasting)"]
        INTEG["services/integrations (HealthDataImporter)"]
        PRIVACY["services/privacy (DataExport & AccountPurge)"]
        WORKER["services/workers (Retention & Pruning Cron)"]
    end

    subgraph Data Platform & Persistence
        PG[("PostgreSQL 18 Authoritative DB")]
        EXT_AI["Google Gemini API (Structured Insights)"]
        EXT_HEALTH["Wearable Exports (Apple XML, Google Takeout JSON)"]
    end

    WEB -->|Cookie Auth + REST API| ROUTER_WEB
    AND -->|Bearer JWT + Sync REST API| ROUTER_MOB
    IOS -->|Bearer JWT + Sync REST API| ROUTER_MOB
    DSK -->|Bearer JWT + Sync REST API| ROUTER_MOB

    ROUTER_WEB --> SEC
    ROUTER_MOB --> SEC

    SEC --> AUTH
    ROUTER_WEB & ROUTER_MOB --> SYNC
    ROUTER_WEB & ROUTER_MOB --> ANALYTICS
    ROUTER_WEB & ROUTER_MOB --> INTEL
    ROUTER_WEB & ROUTER_MOB --> INTEG
    ROUTER_WEB & ROUTER_MOB --> PRIVACY

    INTEL -.->|Optional API Call / Offline Fallback| EXT_AI
    INTEG -.->|Parse & Ingest| EXT_HEALTH

    AUTH --> PG
    SYNC --> PG
    ANALYTICS --> PG
    INTEL --> PG
    PRIVACY --> PG
    WORKER --> PG
```

---

## 2. Dependency Hierarchy & Execution Ordering

To ensure zero race conditions and continuous test pass rates:

1. **Layer 0: Database & Models (Zero Dependencies)**
   - Migration `005_extended_features`: Adds tables for `daily_insights`, `external_imports`, `medical_records`, and `workout_details`.
   - Python-common models & schemas: Update `vitalsense_common/models/` and `vitalsense_common/schemas/`.

2. **Layer 1: Core Domain Services (Depends on Layer 0)**
   - `services/analytics/service.py`: Computes rollups, baseline statistical distributions, and 7-day metric summaries from `health_records`.
   - `services/intelligence/`: Daily health briefing generator (Gemini API with deterministic fallback heuristics) + statistical trend forecasting (`ml_forecasting.py`).
   - `services/integrations/`: Parsers for Apple Health XML and Google Takeout JSON files, feeding directly into `SyncService.ingest_batch`.
   - `services/privacy/`: Export packager (JSON/ZIP) and cascading account deletion handler.

3. **Layer 2: API Routing & OpenAPI Contract (Depends on Layer 1)**
   - Mount new routers in `services/api/main.py`.
   - Export updated OpenAPI specification to `packages/api-contracts/openapi/v1.json`.
   - Verify zero OpenAPI drift via `tests/test_openapi_drift.py`.

4. **Layer 3: Client Applications (Depends on Layer 2)**
   - `apps/web/`: Full Next.js 14+ application with Tailwind CSS, lucide-react, charts, and cookie authentication.
   - `apps/android/`: Complete Kotlin / Jetpack Compose application architecture with Room local DB and sync bridge.
   - `apps/ios/`, `apps/desktop-windows/`, `apps/desktop-macos/`: Multiplatform client scaffoldings with build configurations and API integration layers.

5. **Layer 4: Deployment & Orchestration (Depends on Layers 0-3)**
   - `infrastructure/docker/Dockerfile.api`
   - `infrastructure/docker/Dockerfile.web`
   - `docker-compose.yml`
   - Unified orchestration verification.

