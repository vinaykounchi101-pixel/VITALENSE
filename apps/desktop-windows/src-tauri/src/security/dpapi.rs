//! Windows Data Protection API (DPAPI) Implementation (OD-17).
//!
//! Encrypts and decrypts sensitive authentication tokens and database
//! encryption keys tied to the current logged-in Windows user account.

use windows_sys::Win32::Foundation::LocalFree;
use windows_sys::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPTOAPI_BLOB,
};

#[derive(Debug)]
pub enum DpapiError {
    EncryptionFailed(u32),
    DecryptionFailed(u32),
    InvalidData,
}

pub struct WindowsDpapi;

impl WindowsDpapi {
    /// Encrypts plaintext bytes using current user Windows DPAPI credentials.
    pub fn protect(plaintext: &[u8]) -> Result<Vec<u8>, DpapiError> {
        let mut data_in = CRYPTOAPI_BLOB {
            cbData: plaintext.len() as u32,
            pbData: plaintext.as_ptr() as *mut u8,
        };

        let mut data_out = CRYPTOAPI_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };

        unsafe {
            let success = CryptProtectData(
                &mut data_in,
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut data_out,
            );

            if success == 0 {
                return Err(DpapiError::EncryptionFailed(
                    windows_sys::Win32::Foundation::GetLastError(),
                ));
            }

            let encrypted_slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
            let result = encrypted_slice.to_vec();
            LocalFree(data_out.pbData as _);
            Ok(result)
        }
    }

    /// Decrypts ciphertext bytes using current user Windows DPAPI credentials.
    pub fn unprotect(ciphertext: &[u8]) -> Result<Vec<u8>, DpapiError> {
        let mut data_in = CRYPTOAPI_BLOB {
            cbData: ciphertext.len() as u32,
            pbData: ciphertext.as_ptr() as *mut u8,
        };

        let mut data_out = CRYPTOAPI_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };

        unsafe {
            let success = CryptUnprotectData(
                &mut data_in,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut data_out,
            );

            if success == 0 {
                return Err(DpapiError::DecryptionFailed(
                    windows_sys::Win32::Foundation::GetLastError(),
                ));
            }

            let decrypted_slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
            let result = decrypted_slice.to_vec();
            LocalFree(data_out.pbData as _);
            Ok(result)
        }
    }
}
