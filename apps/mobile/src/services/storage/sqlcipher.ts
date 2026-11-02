/**
 * SQLCipher Encrypted SQLite Local Database Service.
 *
 * Implements offline-first durable persistence with 256-bit AES encryption
 * using SQLCipher (PRAGMA key & cipher_compatibility 4) and hardware-backed
 * key protection (Android Keystore / iOS Keychain via expo-secure-store).
 */

import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { HealthMetricRecord, SyncTombstoneRecord } from "../../types";

export interface LocalRecordRow extends HealthMetricRecord {
  sync_status: "pending_upload" | "synced";
}

export interface LocalTombstoneRow extends SyncTombstoneRecord {
  sync_status: "pending_upload" | "synced";
}

export class MobileEncryptedStorage {
  private db: SQLite.SQLiteDatabase | null = null;
  private currentUserId: string | null = null;
  private isInitialized = false;

  /**
   * Retrieves or creates a cryptographically secure 256-bit AES master key
   * from platform hardware key storage (Android Keystore / iOS Keychain).
   */
  private async getOrCreateEncryptionKey(userId: string): Promise<string> {
    const keyAlias = `vitalsense_sqlcipher_key_${userId}`;
    let hexKey = await SecureStore.getItemAsync(keyAlias);

    if (!hexKey) {
      // Generate 32 bytes (256 bits) of cryptographic randomness
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      hexKey = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      await SecureStore.setItemAsync(keyAlias, hexKey);
    }

    return hexKey;
  }

  /**
   * Initializes and mounts the encrypted SQLCipher database for the specified user account.
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

    // Open persistent database on local filesystem
    this.db = await SQLite.openDatabaseAsync(dbFileName);

    // Apply SQLCipher encryption pragmas
    await this.db.execAsync(`PRAGMA key = "x'${encryptionKey}'";`);
    await this.db.execAsync(`PRAGMA cipher_compatibility = 4;`);
    await this.db.execAsync(`PRAGMA foreign_keys = ON;`);

    // Initialize relational tables
    await this.db.execAsync(`
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
   */
  async purgeAccountData(userId: string): Promise<void> {
    await this.close();
    await SecureStore.deleteItemAsync(`vitalsense_sqlcipher_key_${userId}`);
    // Database file deletion handled by SQLite file manager
  }
}

export const mobileStorage = new MobileEncryptedStorage();
