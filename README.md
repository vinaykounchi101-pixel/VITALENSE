# VitalSense

VitalSense is an advanced, privacy-conscious personal health and wellness platform designed to aggregate, normalize, and present authorized personal health records across mobile and web environments.

---

## Current Status

- **Roadmap Phase:** Phase 0 — Deployable Foundation Milestone
- **Milestone:** Milestone 0.1 — Repository Scaffolding & Architecture Baseline (Task 1 Complete)
- **Active Technical Baseline:** [VitalSense SRS v1.1.1 (Merged)](file:///e:/Projects/VITALENS/docs/VitalSense_SRS_v1.1.1_Merged.md)
- **Active Product Baseline:** [VitalSense PRD v1.1](file:///e:/Projects/VITALENS/docs/VitalSense_PRD_v1.1.md)
- **Decision Governance:** [Open Decision Register (OD-01 to OD-22)](file:///e:/Projects/VITALENS/docs/VitalSense_SRS_v1.1.1_Open_Decision_Register.md)

---

## Architectural Principles & Scope Boundaries

1. **Client Separation:**
   - **Web:** Next.js, React, TypeScript, Tailwind CSS (no direct database connections).
   - **Mobile:** React Native with Expo, targeting Android and iOS with native health platform integrations (Apple HealthKit & Android Health Connect).
2. **Backend & Domain Authority:**
   - **APIs:** Python FastAPI with distinct client boundaries (`web-api` and `mobile-api`). Django is explicitly prohibited.
   - **Database:** PostgreSQL is the authoritative, synchronized source of truth.
   - **Local Storage:** Mobile-local storage (encrypted SQLite) functions as an offline viewing cache and durable operation sync queue, never as a competing source of truth.
3. **Phased Capability Containment:**
   - **Phase 0:** Deployable foundation, tooling, CI, database migrations, and synthetic sync proofs.
   - **Phase 1:** Personal tracking, native health ingestion, dashboard/timeline, manual entry fallback, and privacy export/deletion controls.
   - **Phase 2 (Gated):** AI daily intelligence and n8n/worker automation (requires explicit safety/cost gate approval).
   - **Phase 3 (Gated):** Validated predictive ML (requires baseline comparison, leakage checks, and rollback controls).
   - **Phase 4 (Gated):** Medical records and longitudinal intelligence (requires clinical safety and intended-use review).
   - **Phase 5 (Gated):** Family health management (requires multi-person RBAC and guardian/caregiver consent models).
4. **Health Data Ethics & Clinical Boundary:**
   - Under general wellness scope, VitalSense does not diagnose disease, prescribe treatment, or make triage claims.
   - Missing or delayed data must never be represented as measured zero or real-time measurements.

---

## Prerequisites & Toolchain Compatibility

The development environment was inspected on Windows with the following tools detected:
- **Node.js:** `v24.19.0`
- **npm:** `11.17.0` (Note: Run via `npm.cmd` under default Windows PowerShell execution policies)
- **Python:** `3.14.5`
- **Git:** `2.55.0`

### Toolchain Recommendations & Compatibility Notes
> [!IMPORTANT]
> **Node.js Compatibility:** Node 24 is a bleeding-edge release. React Native, Expo SDKs, and Metro bundlers officially recommend and target **Node.js LTS (v20.x or v22.x)**. If native module build issues arise during mobile scaffolding, switching to Node 20/22 LTS via `nvm-windows` is recommended.
>
> **Python Compatibility:** Python 3.14 is a pre-release / alpha branch. Core scientific Python libraries (NumPy, Pandas, scikit-learn) and binary C-extensions for FastAPI (e.g. `pydantic-core`, `greenlet`, `asyncpg`) do not yet ship pre-compiled Windows wheels for Python 3.14. For reliable dependency installation and local testing, **Python 3.11.x or 3.12.x** is recommended.

---

## Monorepo Layout

```text
vitalsense/
├── apps/                               # Frontend applications
│   ├── web/                            # Next.js web client (planned)
│   └── mobile/                         # React Native / Expo mobile client (planned)
├── services/                           # FastAPI backend services (planned)
├── packages/                           # Shared cross-cutting libraries (contracts, types, python-common)
├── database/                           # PostgreSQL migrations, schemas, seed fixtures
├── ml/                                 # Isolated ML training, evaluation, and registry (Phase 3)
├── automation/                         # n8n workflows and event contracts (Phase 2)
├── infrastructure/                     # Docker, CI/CD, monitoring configurations
├── tests/                              # Integration, contract, offline-sync, and security test suites
├── docs/                               # Authoritative specifications (PRD v1.1, SRS v1.1.1, ADRs)
├── prompts/                            # Antigravity sequential prompt archive
├── .env.example                        # Template environment variables (placeholders only)
├── .gitignore                          # Strict secret, database, and health data exclusions
├── Makefile                            # Common developer commands
├── package.json                        # Root workspace configuration
└── pyproject.toml                      # Python tooling configuration (Ruff, Mypy, Pytest)
```

---

## Local Setup Guidance

### 1. Environment Configuration
Copy the provided template to configure local variables:
```bash
# In PowerShell:
Copy-Item .env.example .env
```
*Note: Never edit `.env` to include production secrets or commit `.env` to source control.*

### 2. Implemented vs. Planned Functionality
- **Currently Implemented (Milestone 0.1):**
  - Root monorepo workspace configurations ([package.json](file:///e:/Projects/VITALENS/package.json), [pyproject.toml](file:///e:/Projects/VITALENS/pyproject.toml)).
  - Comprehensive ignore rules ([.gitignore](file:///e:/Projects/VITALENS/.gitignore)).
  - Environment variable documentation ([.env.example](file:///e:/Projects/VITALENS/.env.example)).
  - Developer automation scripts ([Makefile](file:///e:/Projects/VITALENS/Makefile)).
  - Full technical specifications and PRD baseline ([docs/](file:///e:/Projects/VITALENS/docs)).
- **Planned for Next Milestones:**
  - Milestone 0.2: FastAPI backend skeleton with OpenAPI contract generation and PostgreSQL Alembic migrations.
  - Milestone 0.3: Next.js and Expo client skeletons with synthetic local SQLite sync proof.

---

## Quality & Security Guidelines

- **No Secrets in Source Control:** `.env` files, certificates, credentials, and API keys are strictly excluded via `.gitignore`.
- **No Real Health Data in Repositories:** All testing and development must use de-identified, synthetic fixtures.
- **Authoritative Backend Validation:** Server-side validation is authoritative across all API boundaries (`web-api` and `mobile-api`).
