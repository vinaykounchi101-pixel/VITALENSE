#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod security;
mod storage;
mod sync;

use security::keychain::MacOsKeychain;
use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu};

#[tauri::command]
fn store_keychain_secret(account: String, secret: String) -> Result<(), String> {
    MacOsKeychain::store_secret(&account, secret.as_bytes())
}

#[tauri::command]
fn get_keychain_secret(account: String) -> Result<String, String> {
    let bytes = MacOsKeychain::retrieve_secret(&account)?;
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit VitalSense");
    let sync_now = CustomMenuItem::new("sync".to_string(), "Sync Telemetry");
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
        .invoke_handler(tauri::generate_handler![store_keychain_secret, get_keychain_secret])
        .run(tauri::generate_context!())
        .expect("error while running VitalSense macOS desktop application");
}
