/**
 * Unit regression tests for SQLCipher fail-closed enforcement and account isolation.
 * Uses Node's built-in test runner (node:test, node:assert).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MobileEncryptedStorage } from "../sqlcipher.ts";
import type { StorageDependencies } from "../sqlcipher.ts";

// Helper to create mock database instance
function createMockDb(options: {
  cipherVersion?: string | null;
  failPragmaKey?: boolean;
  failMasterSelect?: boolean;
}) {
  const executedStatements: string[] = [];
  let isClosed = false;

  return {
    executedStatements,
    isClosed: () => isClosed,
    execAsync: async (sql: string) => {
      executedStatements.push(sql);
      if (options.failPragmaKey && sql.includes("PRAGMA key")) {
        throw new Error("Simulated PRAGMA key syntax or cipher error");
      }
      if (options.failMasterSelect && sql.includes("SELECT count(*) FROM sqlite_master")) {
        throw new Error("file is not a database: Decryption failed (invalid key)");
      }
    },
    getFirstAsync: async (sql: string) => {
      executedStatements.push(sql);
      if (sql.includes("PRAGMA cipher_version")) {
        if (!options.cipherVersion) {
          return null;
        }
        return { cipher_version: options.cipherVersion };
      }
      return null;
    },
    closeAsync: async () => {
      isClosed = true;
    },
    runAsync: async (sql: string) => {
      executedStatements.push(sql);
      return { changes: 1 };
    },
    getAllAsync: async () => [],
  };
}

function createMockDependencies(dbOptions: {
  cipherVersion?: string | null;
  failPragmaKey?: boolean;
  failMasterSelect?: boolean;
}) {
  const secureStoreMap = new Map<string, string>();
  const deletedDbFiles: string[] = [];
  const deletedKeys: string[] = [];
  let lastDb: any = null;

  const deps: StorageDependencies = {
    sqlite: {
      openDatabaseAsync: async (name: string) => {
        lastDb = createMockDb(dbOptions);
        return lastDb;
      },
      deleteDatabaseAsync: async (name: string) => {
        deletedDbFiles.push(name);
      },
    },
    secureStore: {
      getItemAsync: async (key: string) => secureStoreMap.get(key) || null,
      setItemAsync: async (key: string, val: string) => {
        secureStoreMap.set(key, val);
      },
      deleteItemAsync: async (key: string) => {
        deletedKeys.push(key);
        secureStoreMap.delete(key);
      },
    },
    crypto: {
      getRandomBytesAsync: async (len: number) => {
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = (i + 1) % 256;
        return bytes;
      },
    },
  };

  return {
    deps,
    secureStoreMap,
    deletedDbFiles,
    deletedKeys,
    getLastDb: () => lastDb,
  };
}

describe("MobileEncryptedStorage — SQLCipher Fail-Closed Enforcement", () => {
  it("fails closed when PRAGMA cipher_version is missing or empty (unencrypted SQLite)", async () => {
    const { deps, getLastDb } = createMockDependencies({ cipherVersion: null });
    const storage = new MobileEncryptedStorage(deps);

    await assert.rejects(
      async () => {
        await storage.initialize("user_unencrypted_test");
      },
      {
        name: "Error",
        message: /SQLCipher initialization failed: SQLCipher native extension is not available/,
      }
    );

    // Database handle must be closed to prevent unencrypted operations
    const db = getLastDb();
    assert.strictEqual(db.isClosed(), true);

    // Any subsequent record operation must throw because storage is not initialized
    await assert.rejects(
      async () => {
        await storage.getPendingUploadRecords();
      },
      {
        name: "Error",
        message: /Mobile encrypted database is not initialized/,
      }
    );
  });

  it("fails closed when PRAGMA key execution fails", async () => {
    const { deps, getLastDb } = createMockDependencies({
      cipherVersion: "4.5.4",
      failPragmaKey: true,
    });
    const storage = new MobileEncryptedStorage(deps);

    await assert.rejects(
      async () => {
        await storage.initialize("user_failed_key_test");
      },
      {
        name: "Error",
        message: /Simulated PRAGMA key syntax or cipher error/,
      }
    );

    assert.strictEqual(getLastDb().isClosed(), true);
  });

  it("fails closed when page-1 decryption verification fails (invalid key)", async () => {
    const { deps, getLastDb } = createMockDependencies({
      cipherVersion: "4.5.4",
      failMasterSelect: true,
    });
    const storage = new MobileEncryptedStorage(deps);

    await assert.rejects(
      async () => {
        await storage.initialize("user_invalid_key_test");
      },
      {
        name: "Error",
        message: /SQLCipher key verification failed: unable to decrypt database with provided key/,
      }
    );

    assert.strictEqual(getLastDb().isClosed(), true);
  });

  it("successfully initializes when SQLCipher is active and key decrypts page 1", async () => {
    const { deps, getLastDb, secureStoreMap } = createMockDependencies({
      cipherVersion: "4.5.4 community",
    });
    const storage = new MobileEncryptedStorage(deps);

    await storage.initialize("user_valid_123");

    // Key was created and stored in SecureStore under user alias
    assert.strictEqual(secureStoreMap.has("vitalsense_sqlcipher_key_user_valid_123"), true);

    // PRAGMA key and cipher compatibility were applied
    const db = getLastDb();
    const statements = db.executedStatements;
    assert.ok(statements.some((s: string) => s.includes("PRAGMA key")));
    assert.ok(statements.some((s: string) => s.includes("PRAGMA cipher_compatibility = 4;")));
    assert.ok(statements.some((s: string) => s.includes("SELECT count(*) FROM sqlite_master;")));
    assert.ok(statements.some((s: string) => s.includes("CREATE TABLE IF NOT EXISTS local_health_records")));

    const version = await storage.getCipherVersion();
    assert.strictEqual(version, "4.5.4 community");
  });

  it("enforces strict account isolation between distinct users", async () => {
    const { deps, secureStoreMap, deletedDbFiles, deletedKeys } = createMockDependencies({
      cipherVersion: "4.5.4",
    });
    const storage = new MobileEncryptedStorage(deps);

    // 1. Initialize for user-A
    await storage.initialize("user-A");
    assert.ok(secureStoreMap.has("vitalsense_sqlcipher_key_user-A"));

    // 2. Initialize for user-B
    await storage.initialize("user-B");
    assert.ok(secureStoreMap.has("vitalsense_sqlcipher_key_user-B"));

    // 3. Purge user-A data: only user-A's key and db are deleted
    await storage.purgeAccountData("user-A");
    assert.ok(deletedKeys.includes("vitalsense_sqlcipher_key_user-A"));
    assert.ok(deletedDbFiles.includes("vitalsense_user-A_encrypted.db"));

    // User-B data remains intact
    assert.strictEqual(secureStoreMap.has("vitalsense_sqlcipher_key_user-B"), true);
    assert.ok(!deletedKeys.includes("vitalsense_sqlcipher_key_user-B"));
    assert.ok(!deletedDbFiles.includes("vitalsense_user-B_encrypted.db"));
  });
});
