/**
 * SQLCipher Encrypted SQLite Local Database Service.
 *
 * Implements offline-first durable persistence with 256-bit AES encryption
 * using SQLCipher (PRAGMA key & cipher_compatibility 4) and hardware-backed
 * key protection (Android Keystore / iOS Keychain via expo-secure-store).
 */

import type * as SQLite from "expo-sqlite";
import type * as SecureStore from "expo-secure-store";
import type * as Crypto from "expo-crypto";
import type { HealthMetricRecord, SyncTombstoneRecord } from "../../types/index.ts";

export interface LocalRecordRow extends HealthMetricRecord {
  sync_status: "pending_upload" | "synced";
}

export interface LocalTombstoneRow extends SyncTombstoneRecord {
  sync_status: "pending_upload" | "synced";
}

export interface StorageDependencies {
  sqlite: {
    openDatabaseAsync: (name: string) => Promise<SQLite.SQLiteDatabase>;
    deleteDatabaseAsync?: (name: string) => Promise<void>;
  };
  secureStore: {
    getItemAsync: (key: string) => Promise<string | null>;
    setItemAsync: (key: string, value: string, options?: any) => Promise<void>;
    deleteItemAsync: (key: string) => Promise<void>;
  };
  crypto: {
    getRandomBytesAsync: (length: number) => Promise<Uint8Array>;
  };
}

// Lazy native module loader for React Native / Expo environment
function getNativeModule<T>(moduleName: string): T {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(moduleName);
  } catch {
    return {} as T;
  }
}

export class MobileEncryptedStorage {
  private db: SQLite.SQLiteDatabase | null = null;
  private currentUserId: string | null = null;
  private isInitialized = false;
  private deps: StorageDependencies;

  constructor(dependencies?: StorageDependencies) {
    this.deps = dependencies || {
      sqlite: getNativeModule<any>("expo-sqlite"),
      secureStore: getNativeModule<any>("expo-secure-store"),
      crypto: getNativeModule<any>("expo-crypto"),
    };
  }

  /**
   * Retrieves or creates a cryptographically secure 256-bit AES master key
   * from platform hardware key storage (Android Keystore / iOS Keychain).
   * Strictly isolated per user account.
   */
  private async getOrCreateEncryptionKey(userId: string): Promise<string> {
    const keyAlias = `vitalsense_sqlcipher_key_${userId}`;
    let hexKey = await this.deps.secureStore.getItemAsync(keyAlias);

    if (!hexKey) {
      // Generate 32 bytes (256 bits) of cryptographic randomness
      const randomBytes = await this.deps.crypto.getRandomBytesAsync(32);
      hexKey = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      await this.deps.secureStore.setItemAsync(keyAlias, hexKey, {
        keychainAccessible: (this.deps.secureStore as any)?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY || "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY",
      });
    }

    return hexKey;
  }

  /**
   * Initializes and mounts the encrypted SQLCipher database for the specified user account.
   * Enforces strict fail-closed validation:
   * 1. Requires valid PRAGMA cipher_version; fails closed if SQLCipher is missing or unencrypted SQLite is running.
   * 2. Forces page-1 decryption check against sqlite_master; fails closed if key application fails.
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.currentUserId === userId && this.db) {
      return;
    }

    // Close previous session database if switching users
    if (this.db) {
      await this.close();
    }

    this.currentUserId = userId;
    const encryptionKey = await this.getOrCreateEncryptionKey(userId);
    const dbFileName = `vitalsense_${userId}_encrypted.db`;

    // Open database on local filesystem
    const db = await this.deps.sqlite.openDatabaseAsync(dbFileName);
    this.db = db;

    try {
      // 1. Apply SQLCipher encryption key pragma
      await db.execAsync(`PRAGMA key = "x'${encryptionKey}'";`);
      await db.execAsync(`PRAGMA cipher_compatibility = 4;`);
      await db.execAsync(`PRAGMA foreign_keys = ON;`);

      // 2. FAIL-CLOSED CHECK: Query PRAGMA cipher_version.
      // If SQLCipher is unavailable (e.g. running unencrypted standard SQLite),
      // PRAGMA cipher_version returns null/empty or throws.
      // We MUST fail closed immediately to prevent writing unencrypted data.
      let cipherVersion: string | null = null;
      try {
        const row = await db.getFirstAsync(`PRAGMA cipher_version;`);
        cipherVersion = (row as any)?.cipher_version ?? (row as any)?.["cipher_version"] ?? null;
      } catch {
        cipherVersion = null;
      }

      if (!cipherVersion || typeof cipherVersion !== "string" || cipherVersion.trim().length === 0) {
        throw new Error(
          "SQLCipher initialization failed: SQLCipher native extension is not available or cipher_version is empty. Failing closed to prevent unencrypted plaintext storage."
        );
      }

      // 3. FAIL-CLOSED CHECK: Force page-1 decryption verification against sqlite_master.
      // If the encryption key is invalid or failed to apply, reading page 1 throws.
      try {
        await db.execAsync(`SELECT count(*) FROM sqlite_master;`);
      } catch (keyErr: any) {
        throw new Error(
          `SQLCipher key verification failed: unable to decrypt database with provided key. Failing closed. Details: ${keyErr?.message || "Decryption error"}`
        );
      }

      // 4. Initialize schema tables
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS local_health_records (
          record_id TEXT PRIMARY KEY,
          source_name TEXT NOT NULL,
          source_record_id TEXT,
          metric_name TEXT NOT NULL,
          numeric_value REAL NOT NULL,
          unit TEXT NOT NULL,
          measured_at TEXT NOT NULL,
          recorded_at TEXT NOT NULL,
          metadata_json TEXT,
          supersedes_record_id TEXT,
          sync_status TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_health_records_sync_status 
        ON local_health_records (sync_status);

        CREATE TABLE IF NOT EXISTS local_sync_tombstones (
          record_id TEXT PRIMARY KEY,
          source_name TEXT NOT NULL,
          source_record_id TEXT,
          deleted_at TEXT NOT NULL,
          sync_status TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_checkpoints (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      this.isInitialized = true;
    } catch (err) {
      // Clean up on any failure: close DB, reset references, and fail closed
      await this.close();
      throw err;
    }
  }

  private ensureMounted(): SQLite.SQLiteDatabase {
    if (!this.db || !this.isInitialized) {
      throw new Error("Mobile encrypted database is not initialized. Call initialize(userId) first.");
    }
    return this.db;
  }

  /**
   * Saves or updates a health record into encrypted SQLite storage.
   */
  async saveRecord(
    record: HealthMetricRecord,
    syncStatus: "pending_upload" | "synced" = "pending_upload"
  ): Promise<void> {
    const db = this.ensureMounted();
    const metadataStr = record.metadata_json ? JSON.stringify(record.metadata_json) : null;
    const now = new Date().toISOString();

    const legacyId = record.metadata_json?.legacy_source_record_id;
    if (legacyId) {
      const tombstone = await db.getFirstAsync<{ record_id: string }>(
        "SELECT record_id FROM local_sync_tombstones WHERE source_record_id = ? OR record_id = ? LIMIT 1;",
        legacyId,
        `hc_rec_${legacyId}`
      );
      if (tombstone) {
        return;
      }
      await db.runAsync(
        "DELETE FROM local_health_records WHERE source_record_id = ? OR record_id = ?;",
        legacyId,
        `hc_rec_${legacyId}`
      );
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO local_health_records (
        record_id, source_name, source_record_id, metric_name, numeric_value,
        unit, measured_at, recorded_at, metadata_json, supersedes_record_id,
        sync_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      record.record_id,
      record.source_name,
      record.source_record_id || null,
      record.metric_name,
      record.numeric_value,
      record.unit,
      record.measured_at,
      record.recorded_at,
      metadataStr,
      record.supersedes_record_id || null,
      syncStatus,
      now
    );
  }

  /**
   * Persists a batch of records inside a single SQLite transaction.
   */
  async saveBatch(
    records: HealthMetricRecord[],
    syncStatus: "pending_upload" | "synced" = "pending_upload"
  ): Promise<void> {
    const db = this.ensureMounted();
    const now = new Date().toISOString();

    await db.execAsync("BEGIN TRANSACTION;");
    try {
      for (const record of records) {
        const legacyId = record.metadata_json?.legacy_source_record_id;
        if (legacyId) {
          const tombstone = await db.getFirstAsync<{ record_id: string }>(
            "SELECT record_id FROM local_sync_tombstones WHERE source_record_id = ? OR record_id = ? LIMIT 1;",
            legacyId,
            `hc_rec_${legacyId}`
          );
          if (tombstone) {
            continue;
          }
          await db.runAsync(
            "DELETE FROM local_health_records WHERE source_record_id = ? OR record_id = ?;",
            legacyId,
            `hc_rec_${legacyId}`
          );
        }

        const metadataStr = record.metadata_json ? JSON.stringify(record.metadata_json) : null;
        await db.runAsync(
          `INSERT OR REPLACE INTO local_health_records (
            record_id, source_name, source_record_id, metric_name, numeric_value,
            unit, measured_at, recorded_at, metadata_json, supersedes_record_id,
            sync_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          record.record_id,
          record.source_name,
          record.source_record_id || null,
          record.metric_name,
          record.numeric_value,
          record.unit,
          record.measured_at,
          record.recorded_at,
          metadataStr,
          record.supersedes_record_id || null,
          syncStatus,
          now
        );
      }
      await db.execAsync("COMMIT;");
    } catch (err) {
      await db.execAsync("ROLLBACK;");
      throw err;
    }
  }

  /**
   * Marks local records as synced.
   */
  async markAsSynced(recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;
    const db = this.ensureMounted();
    const placeholders = recordIds.map(() => "?").join(",");

    await db.runAsync(
      `UPDATE local_health_records SET sync_status = 'synced' WHERE record_id IN (${placeholders});`,
      ...recordIds
    );
  }

  /**
   * Queries pending uploads.
   */
  async getPendingUploadRecords(): Promise<LocalRecordRow[]> {
    const db = this.ensureMounted();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM local_health_records WHERE sync_status = 'pending_upload' ORDER BY measured_at ASC;`
    );

    return rows.map((r) => ({
      record_id: r.record_id,
      source_name: r.source_name,
      source_record_id: r.source_record_id,
      metric_name: r.metric_name,
      numeric_value: r.numeric_value,
      unit: r.unit,
      measured_at: r.measured_at,
      recorded_at: r.recorded_at,
      metadata_json: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
      supersedes_record_id: r.supersedes_record_id,
      sync_status: r.sync_status,
    }));
  }

  /**
   * Adds a deletion tombstone locally.
   */
  async addTombstone(tombstone: SyncTombstoneRecord): Promise<void> {
    const db = this.ensureMounted();

    await db.execAsync("BEGIN TRANSACTION;");
    try {
      // 1. Delete matching local health record
      await db.runAsync(`DELETE FROM local_health_records WHERE record_id = ?;`, tombstone.record_id);

      // 2. Insert tombstone
      await db.runAsync(
        `INSERT OR REPLACE INTO local_sync_tombstones (
          record_id, source_name, source_record_id, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, 'pending_upload');`,
        tombstone.record_id,
        tombstone.source_name,
        tombstone.source_record_id,
        tombstone.deleted_at
      );
      await db.execAsync("COMMIT;");
    } catch (err) {
      await db.execAsync("ROLLBACK;");
      throw err;
    }
  }

  /**
   * Queries pending tombstones for synchronization upload.
   */
  async getPendingTombstones(): Promise<LocalTombstoneRow[]> {
    const db = this.ensureMounted();
    return db.getAllAsync<LocalTombstoneRow>(
      `SELECT * FROM local_sync_tombstones WHERE sync_status = 'pending_upload' ORDER BY deleted_at ASC;`
    );
  }

  /**
   * Marks tombstones as synced.
   */
  async markTombstonesSynced(recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;
    const db = this.ensureMounted();
    const placeholders = recordIds.map(() => "?").join(",");

    await db.runAsync(
      `UPDATE local_sync_tombstones SET sync_status = 'synced' WHERE record_id IN (${placeholders});`,
      ...recordIds
    );
  }

  /**
   * Fetches all cached local records.
   */
  async getAllLocalRecords(): Promise<LocalRecordRow[]> {
    const db = this.ensureMounted();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM local_health_records ORDER BY measured_at DESC;`
    );

    return rows.map((r) => ({
      record_id: r.record_id,
      source_name: r.source_name,
      source_record_id: r.source_record_id,
      metric_name: r.metric_name,
      numeric_value: r.numeric_value,
      unit: r.unit,
      measured_at: r.measured_at,
      recorded_at: r.recorded_at,
      metadata_json: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
      supersedes_record_id: r.supersedes_record_id,
      sync_status: r.sync_status,
    }));
  }

  /**
   * Saves synchronization cursor or checkpoint.
   */
  async setCheckpoint(key: string, value: string): Promise<void> {
    const db = this.ensureMounted();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_checkpoints (key, value, updated_at) VALUES (?, ?, ?);`,
      key,
      value,
      now
    );
  }

  /**
   * Retrieves synchronization checkpoint.
   */
  async getCheckpoint(key: string): Promise<string | null> {
    const db = this.ensureMounted();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_checkpoints WHERE key = ?;`,
      key
    );
    return row ? row.value : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    return this.setCheckpoint(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return this.getCheckpoint(key);
  }

  async removeItem(key: string): Promise<void> {
    const db = this.ensureMounted();
    await db.runAsync(`DELETE FROM sync_checkpoints WHERE key = ?;`, key);
  }

  /**
   * Retrieves the SQLCipher version string via PRAGMA cipher_version.
   * Returns null if standard SQLite is running without SQLCipher extensions.
   */
  async getCipherVersion(): Promise<string | null> {
    const db = this.ensureMounted();
    try {
      const row = await db.getFirstAsync<{ cipher_version?: string }>(`PRAGMA cipher_version;`);
      if (!row) return null;
      return row.cipher_version || (row as any)["cipher_version"] || null;
    } catch {
      return null;
    }
  }

  /**
   * Closes database connection cleanly upon app backgrounding, logout, or account switch.
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
      this.currentUserId = null;
    }
  }

  /**
   * Purges database file and keys upon account deletion or complete data wipe.
   * Ensures key deletion and database-file deletion are handled deliberately and safely.
   */
  async purgeAccountData(userId: string): Promise<void> {
    await this.close();
    const keyAlias = `vitalsense_sqlcipher_key_${userId}`;
    await this.deps.secureStore.deleteItemAsync(keyAlias);
    const dbFileName = `vitalsense_${userId}_encrypted.db`;
    try {
      if (typeof (this.deps.sqlite as any).deleteDatabaseAsync === "function") {
        await (this.deps.sqlite as any).deleteDatabaseAsync(dbFileName);
      }
    } catch {
      // Non-fatal if file does not exist or already removed
    }
  }
}

export const mobileStorage = new MobileEncryptedStorage();
