//! SQLCipher Encrypted SQLite Database for Windows Desktop (OD-17).

use rusqlite::{Connection, Result};
use std::path::Path;

pub struct DesktopDatabase {
    conn: Connection,
}

impl DesktopDatabase {
    /// Opens or creates an encrypted SQLite database using a 256-bit key.
    pub fn open<P: AsRef<Path>>(path: P, key_hex: &str) -> Result<Self> {
        let conn = Connection::open(path)?;

        // Configure SQLCipher 256-bit AES encryption
        conn.execute(&format!("PRAGMA key = \"x'{}'\";", key_hex), [])?;
        conn.execute("PRAGMA cipher_compatibility = 4;", [])?;
        conn.execute("PRAGMA foreign_keys = ON;", [])?;

        // Initialize local cache schema
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

    pub fn insert_record(
        &self,
        record_id: &str,
        metric_name: &str,
        value: f64,
        unit: &str,
        measured_at: &str,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO local_health_records
             (record_id, metric_name, numeric_value, unit, measured_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, 'synced');",
            rusqlite::params![record_id, metric_name, value, unit, measured_at],
        )?;
        Ok(())
    }
}

