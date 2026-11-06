# VitalSense — Repository Memory & Agent State

**System:** VitalSense Personal Health & Wellness Platform (Project Paradox)  
**Last Updated:** 2026-11-06  
**Active Specification:** [VitalSense_SRS_v1.1.1_Merged.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_SRS_v1.1.1_Merged.md)  
**Product Baseline:** [VitalSense_PRD_v1.1.md](file:///e:/Projects/VITALSENSE/docs/VitalSense_PRD_v1.1.md)  
**Branch:** `dev` (HEAD: `7067ea1`)  
**Remote:** `https://github.com/vinaykounchi101-pixel/VITALENSE.git`

---

## 1. Operating Rules & Core Constraints
- **Rule 1 — Folder Structure:** Do not change folder structure under any circumstances.
- **Rule 2 — Environment Variables:** Work is strictly environment-variable driven.
- **Rule 3 & 4 — `.env` Protection:** NEVER push `.env` files; NEVER read or access `.env` directly.
- **Rule 5 — Zero Hardcoding:** Never hardcode secrets, ports, credentials, or magic numbers that belong in configuration.
- **Rule 6 — Permissions:** Ask for permission wherever high-risk or irreversible operations occur.
- **Rule 7 — Operational Calls:** Before starting work, emit `"Roger That"`; upon completion, emit `"Over n Out"`.
- **Rule 8 — Session Closure:** On `"bye"`, commit and push everything, update `PROGRESS.md` and `TECHNICAL.md`, store session state in `MEMORY.md`, and conclude with `"Signing off"`.
- **Rule 9 — Session Inception:** On `"hi"`, inspect and analyze `PROGRESS.md`, `TECHNICAL.md`, and `MEMORY.md`.

---

## 2. Active Services & Infrastructure

| Service | Port / Socket | Process / Command | Status |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 18** | `127.0.0.1:5432` | `E:\PSQL\bin\postgres.exe -D E:\PSQL\data` | Active Local Daemon |
| **FastAPI Backend** | `http://127.0.0.1:8000` | `uvicorn services.api.main:app --host 127.0.0.1 --port 8000` | Active Daemon (`/health`, `/ready`) |
| **Next.js Web App** | `http://localhost:3000` | `next start -p 3000` (`apps/web`) | Active Production Server |

### Verified Test User Credentials
- **Email:** `testuser@example.com`
- **Password:** `VitalSense2026!`
- **User Account ID:** `3c273b82-16af-4d5c-b1e7-7446875bd9f3`
- **Person ID:** `c5893f6e-3c4a-419d-abab-e72c931436d1`
- **Seeded Telemetry:** 9 baseline metrics active (Heart Rate 68 bpm, BP 120/80 mmHg, SpO2 98%, Blood Glucose 95 mg/dL, Sleep, Steps, Active Energy).

---

## 3. Session Accomplishments & Milestones

### Milestone 1.0 — Frontend Phase 1 Foundation & Web Application
1. **Design System Integration:**
   - Fully integrated tokens from `VitalSense_UIUX_Design_Package_v2`: clinical palette (`mint`, `coral`, `blue`, `peach`, `lavender`, `amber`), glassmorphism, responsive navigation shell.
   - Built 10 complete application routes (`/`, `/body`, `/activity`, `/sleep`, `/trends`, `/medical`, `/family`, `/metrics`, `/profile`, `/settings`).
   - Built interactive modals for manual telemetry entry, workout logging, file imports, and GDPR privacy actions.
   - Strict zero-fabrication data binding: all UI binds to real FastAPI data or explicit empty states.

2. **3D Anatomical Telemetry Model Replacement:**
   - Procedural mannequin completely replaced with professionally authored, realistic human anatomy matching `VitalSense-Health-App-Showcase.png`.
   - **Models Acquired:**
     - `apps/web/public/models/muscles.glb` (5.62 MB, 177 distinct muscle meshes, 304k vertices).
     - `apps/web/public/models/heart.glb` (2.52 MB, 11 anatomical cardiac meshes).
     - `apps/web/public/models/lungs.glb` (3.90 MB, 20 anatomical pulmonary meshes).
   - **Attribution & Licensing:** *BodyParts3D* by Database Center for Life Science (DBCLS), licensed under Creative Commons Attribution-ShareAlike 2.1 Japan (`CC BY-SA 2.1 JP`), fully permitting commercial and non-commercial redistribution with attribution.
   - **Shader & Aesthetics:** Translucent cool-blue PBR material (`#4B7BB5` / `#6B99C4`, opacity 0.70) showing distinct muscle striations across chest, shoulders, arms, abdomen, and legs.
   - **Internal Thoracic Cavity:**
     - Pulsing anatomical heart with dual-beat systolic/diastolic rhythm and inner glowing red point light radiating through the chest wall.
     - Expanding/contracting anatomical lungs with translucent cyan material.
   - **Interactivity:** Raycasting on 3D meshes and 3D HTML marker pins for 5 physiological systems (`cardiac`, `respiratory`, `metabolic`, `musculoskeletal`, `sleep`).
   - **Accessibility & Fallback:** Automatic detection of non-WebGL environments or `prefers-reduced-motion` with graceful toggle to an interactive 2D SVG schematic.

3. **Compilation & Quality Gate Status:**
   - Web application Next.js build: **14/14 static routes compiled cleanly with 0 errors**.
   - Web TypeScript: **0 errors** (`npx tsc -p apps/web/tsconfig.json --noEmit`).
   - Mobile TypeScript: **0 errors** (`npm --prefix apps/mobile run typecheck`).
   - Backend tests: **81/81 tests passing**.

---

## 4. Hardware Diagnostics & USB Debugging Notes
- **ADB Location:** `C:\Users\Vinay\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- **USB Controller Status:** Two physical USB 3.0 Root Hub controllers on the host machine currently report hardware error `CM_PROB_FAILED_POST_START`.
- **Device Detection:** When physical USB cable is plugged into failing ports or charge-only cables, Windows reports `CM_PROB_PHANTOM`.
- **Recommended Action:** Connect phone to an alternate functional USB port, switch phone USB configuration to "File Transfer / Android Auto", accept the RSA debugging prompt, or use Android Wireless Debugging on the local network (`10.148.101.130`).

---

## 5. Next Steps for Subsequent Sessions
1. **Mobile Application (React Native / Expo):**
   - Connect mobile Health Connect and HealthKit ingestion pipelines to the local backend.
   - Run mobile integration tests and test UI on connected physical device or emulator.
2. **Offline Sync Queue Verification:**
   - Execute end-to-end synchronization tests between SQLite (SQLCipher) on client and PostgreSQL backend.
3. **Desktop Clients (Tauri / Rust):**
   - Begin Phase 2 desktop app evaluation for Windows and macOS.

