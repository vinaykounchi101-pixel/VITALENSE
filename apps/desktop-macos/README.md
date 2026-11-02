# VitalSense — macOS Desktop Application Foundation

## Architecture Overview
- **Target OS:** macOS 13.0+ (Ventura), Apple Silicon (M1/M2/M3/M4) & Intel.
- **Runtime:** Tauri / Rust Native Core with WebKit WKWebView host.
- **Cryptography & Key Management (OD-17):** Apple Keychain Services (`Security.framework`) using `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.
- **Local Persistence (SYNC-001):** SQLite with SQLCipher (256-bit AES encryption) with `PRAGMA cipher_compatibility = 4`.
- **System Menu Bar:** Native macOS Menu Bar item with quick health summary and background sync control.

## Development & Build Instructions
1. Prerequisites:
   - macOS 13.0+ with Xcode Command Line Tools (`xcode-select --install`)
   - Rust toolchain (`rustup install stable`)
2. Run in development:
   ```bash
   cargo tauri dev
   ```
3. Build universal macOS `.app` / `.dmg`:
   ```bash
   cargo tauri build --target universal-apple-darwin
   ```

