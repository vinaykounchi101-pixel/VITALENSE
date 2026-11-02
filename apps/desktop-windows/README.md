# VitalSense — Windows Desktop Application Foundation

## Architecture Overview
- **Target OS:** Windows 10/11 (Build 19041+), x64 / ARM64.
- **Runtime:** Tauri / Rust Native Core with WebView2 host.
- **Cryptography & Key Management (OD-17):** Windows Data Protection API (`DPAPI`) via `CryptProtectData` and `CryptUnprotectData`. Master keys and authentication tokens are encrypted at rest under the local Windows user credentials.
- **Local Persistence (SYNC-001):** SQLite with SQLCipher (256-bit AES encryption) executing `PRAGMA cipher_compatibility = 4`.
- **System Tray:** Native Windows notification tray support with quick sync actions.

## Development & Build Instructions
1. Prerequisites:
   - Rust toolchain (`rustup install stable`)
   - WebView2 Runtime (pre-installed on Windows 10/11)
   - Visual Studio C++ Build Tools
2. Run in development:
   ```powershell
   cargo tauri dev
   ```
3. Build production installer:
   ```powershell
   cargo tauri build
   ```

