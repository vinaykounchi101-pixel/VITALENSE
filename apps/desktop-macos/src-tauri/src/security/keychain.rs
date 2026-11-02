//! Apple Keychain Services Implementation for macOS (OD-17).
//!
//! Stores authentication tokens and database encryption keys securely
//! within the macOS system keychain.

use security_framework::passwords::{get_generic_password, set_generic_password};

const SERVICE_NAME: &str = "com.vitalsense.desktop";

pub struct MacOsKeychain;

impl MacOsKeychain {
    /// Stores or updates a password/key in the macOS Keychain.
    pub fn store_secret(account: &str, secret: &[u8]) -> Result<(), String> {
        set_generic_password(SERVICE_NAME, account, secret).map_err(|e| e.to_string())
    }

    /// Retrieves a secret from the macOS Keychain.
    pub fn retrieve_secret(account: &str) -> Result<Vec<u8>, String> {
        get_generic_password(SERVICE_NAME, account).map_err(|e| e.to_string())
    }
}

