#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod security;
mod storage;
mod sync;

use security::dpapi::WindowsDpapi;
use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu};

#[tauri::command]
fn encrypt_secret(plain: String) -> Result<Vec<u8>, String> {
    WindowsDpapi::protect(plain.as_bytes()).map_err(|e| format!("{:?}", e))
}

#[tauri::command]
fn decrypt_secret(cipher: Vec<u8>) -> Result<String, String> {
    let bytes = WindowsDpapi::unprotect(&cipher).map_err(|e| format!("{:?}", e))?;
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit VitalSense");
    let sync_now = CustomMenuItem::new("sync".to_string(), "Sync Now");
    let tray_menu = SystemTrayMenu::new().add_item(sync_now).add_item(quit);
    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "sync" => {
                    // Trigger sync background event
                }
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![encrypt_secret, decrypt_secret])
        .run(tauri::generate_context!())
        .expect("error while running VitalSense desktop application");
}
