//! SQLCipher Encrypted Database for macOS Desktop (OD-17).

use rusqlite::{Connection, Result};
use std::path::Path;

pub struct DesktopDatabase {
    conn: Connection,
}

impl DesktopDatabase {
    pub fn open<P: AsRef<Path>>(path: P, key_hex: &str) -> Result<Self> {
        let conn = Connection::open(path)?;

        conn.execute(&format!("PRAGMA key = \"x'{}'\";", key_hex), [])?;
        conn.execute("PRAGMA cipher_compatibility = 4;", [])?;
        conn.execute("PRAGMA foreign_keys = ON;", [])?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS local_health_records (
                record_id TEXT PRIMARY KEY,
                metric_name TEXT NOT NULL,
                numeric_value REAL NOT NULL,
                unit TEXT NOT NULL,
                measured_at TEXT NOT NULL,
                sync_status TEXT NOT NULL
            );",
            [],
        )?;

        Ok(Self { conn })
    }
}

