# VitalSense

VitalSense is an advanced, privacy-conscious personal health and wellness platform designed to aggregate, normalize, securely persist, and present authorized personal health records across mobile, desktop, and web environments.

---

## Current Status

- **Roadmap Phase:** Phase 0 — Deployable Foundation Milestone
- **Milestone:** Milestone 0.7 — Core Authentication, Data Ingestion & Offline Synchronization Foundation (Complete)
- **Active Technical Baseline:** [VitalSense SRS v1.1.1 (Merged)](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Merged.md)
- **Active Product Baseline:** [VitalSense PRD v1.1](file:///e:/Projects/VITALSENSE/docs/VitalSense_PRD_v1.1.md)
- **Architecture Blueprint:** [System Architecture Blueprint](file:///e:/Projects/VITALSENSE/docs/architecture/system_architecture.md)
- **Approved Decisions:** [Consolidated ADR (ADR-001)](file:///e:/Projects/VITALSENSE/docs/architecture/approved_decisions_record.md)
- **Decision Governance:** [Decision Register](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Open_Decision_Register.md)

---

## Architectural Principles & Scope Boundaries

1. **Five First-Class Target Platforms (OD-16):**
   - **Android:** Kotlin, Jetpack Compose, Google Health Connect, Room with SQLCipher AES-256.
   - **iOS:** Swift, SwiftUI, Apple HealthKit, SQLite with SQLCipher AES-256.
   - **Windows:** Windows 10/11 desktop application, SQLite with SQLCipher AES-256, DPAPI.
   - **macOS:** macOS 13+ desktop application, SQLite with SQLCipher AES-256, Keychain.
   - **Web:** Next.js, React, TypeScript, Tailwind CSS, mobile-first responsive layout, IndexedDB with Web Crypto AES-GCM-256.
2. **Backend & Domain Authority (OD-19):**
   - **Modular Monolith API:** Python FastAPI with distinct routing boundaries (`/api/v1/web` and `/api/v1/mobile`) co-deployed initially with shared database connection pools.
   - **Authoritative Database:** PostgreSQL 18 is the central authoritative source of truth.
   - **Local Storage (OD-17):** Local client databases function as secure, encrypted offline viewing caches and durable sync queues, never as competing authorities.
3. **Phase 1 Metric Scope (OD-01 Option B):**
   - 10 approved core metrics: `steps`, `heart_rate`, `sleep_session`, `active_energy`, `workout_session`, `resting_heart_rate`, `blood_pressure_systolic`, `blood_pressure_diastolic` (paired measurements), `blood_oxygen_saturation` (SpO2), `blood_glucose`.
   - **Data Integrity Rule:** Missing wearable or device data must display an honest empty state; **zero values are never fabricated**.
4. **Offline Synchronization & Tombstones (OD-04, OD-14):**
   - Immutable manual entries and revisions (`superseded_by_id`).
   - Deletions propagate via dedicated `sync_tombstones`.
   - Stale devices offline >30 days receive `SYNC_CURSOR_EXPIRED` and execute a safe, non-destructive resync that **never blindly wipes local databases**, preserving uncommitted offline drafts.
5. **Defense-in-Depth Security & Automation Boundary (OD-18, OD-22):**
   - Self-hosted Argon2id password hashing + rotating JWT refresh tokens with token-family reuse detection.
   - n8n is strictly an external workflow orchestrator via authenticated webhooks. Zero direct PostgreSQL access; zero PHI sent to n8n.
   - 30-day raw payload retention (`raw_payload = NULL` after 30 days) and 30-day backup snapshot expiry with restore reconciliation (`OD-07`).

---

## Prerequisites & Toolchain Compatibility

- **Node.js:** Recommended LTS (v20.x or v22.x). Note: Run via `npm.cmd` under default Windows PowerShell execution policies.
- **Python:** Python 3.12.x (installed in project `.venv`).
- **PostgreSQL:** Version 18 (local service).
- **Git:** 2.55.0+.

---

## Monorepo Layout

```text
vitalsense/
├── apps/                               # First-class client applications (OD-16)
│   ├── android/                        # Android client (Kotlin / Compose / Room + SQLCipher)
│   ├── ios/                            # iOS client (SwiftUI / HealthKit / SQLite + SQLCipher)
│   ├── desktop-windows/                # Windows desktop client (WinUI / Flutter / SQLCipher)
│   ├── desktop-macos/                  # macOS desktop client (SwiftUI / Flutter / SQLCipher)
│   └── web/                            # Web application (Next.js / IndexedDB + Web Crypto)
├── database/                           # Database migrations, configurations, and test fixtures
│   ├── fixtures/
│   │   └── synthetic_records.json
│   └── postgres/
│       ├── alembic.ini
│       └── migrations/                 # Versioned migration scripts (001, 002)
├── docs/                               # Specifications, PRD, SRS, validation reports, and decisions
│   ├── architecture/
│   │   ├── approved_decisions_record.md
│   │   ├── system_architecture.md
│   │   └── decision_workshop.md
│   ├── milestone_07_core_authentication_ingestion_sync_implementation_report.md
│   ├── VitalSense_PRD_v1.1.md
│   ├── VitalSense_SRS_v1.1.1_Merged.md
│   └── VitalSense_SRS_v1.1.1_Open_Decision_Register.md
├── infrastructure/                     # Infrastructure as Code (Docker, Nginx)
├── packages/                           # Shared cross-cutting libraries
│   ├── api-contracts/                  # Versioned OpenAPI specifications (openapi/v1.json)
│   └── python-common/                  # Shared Python library (vitalsense_common)
│       └── src/vitalsense_common/
│           ├── models/                 # Domain models (auth, sync, metric, health, account)
│           ├── schemas/                # Pydantic schemas (auth, sync, envelope, health)
│           ├── security/               # Argon2id password hashing, JWT tokens
│           ├── config.py               # Typed environment settings
│           ├── database.py             # Engine & session management
│           └── logging.py              # Structured JSON logging & PHI redaction
├── prompts/                            # Immutable archive of all milestone prompts
├── services/                           # Backend domain services & API routers
│   ├── api/                            # FastAPI modular monolith application (main.py)
│   ├── auth/                           # Authentication & session domain service
│   ├── sync/                           # Health data ingestion & cross-platform sync service
│   ├── mobile_api/                     # Mobile API router namespace (/api/v1/mobile)
│   └── web_api/                        # Web API router namespace (/api/v1/web)
└── tests/                              # Automated test suite (34 passing tests)
```

---

## Getting Started

### 1. Environment Setup
```bash
# Clone the repository
git clone https://github.com/vinaykounchi101-pixel/VITALENSE.git
cd VITALSENSE

# Activate Python 3.12 virtual environment
.\.venv\Scripts\activate

# Install backend dependencies
pip install -r requirements.txt
pip install -e packages/python-common --no-deps
```

### 2. Database Migrations
```bash
# Apply migrations to canonical PostgreSQL instance
alembic upgrade head
```

### 3. Run Automated Tests
```bash
# Run the 34-test unit, integration, and contract test suite
pytest -v
```

### 4. Start Local Development API Server
```bash
uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive OpenAPI documentation will be accessible at: `http://localhost:8000/docs`
