/**
 * Offline-first IndexedDB Store with Web Crypto encryption readiness (OD-17).
 *
 * Manages local health record caching and durable offline pending sync queues.
 * Fully safe for Next.js SSR / server components (no-ops gracefully if indexedDB is unavailable).
 */

const DB_NAME = "vitalsense_offline_cache";
const DB_VERSION = 1;
const STORE_OBSERVATIONS = "observations";
const STORE_PENDING_QUEUE = "pending_sync_queue";

export interface CachedObservation {
  id: string;
  metric_name: string;
  value: number;
  unit: string;
  measured_at: string;
  sync_status: "synced" | "pending_upload";
  metadata?: Record<string, any>;
}

class OfflineStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private isAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
  }

  private getDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    if (!this.isAvailable()) {
      return Promise.resolve(null);
    }

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_OBSERVATIONS)) {
            const obsStore = db.createObjectStore(STORE_OBSERVATIONS, { keyPath: "id" });
            obsStore.createIndex("metric_name", "metric_name", { unique: false });
            obsStore.createIndex("sync_status", "sync_status", { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_PENDING_QUEUE)) {
            db.createObjectStore(STORE_PENDING_QUEUE, { keyPath: "id" });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn("IndexedDB open error:", request.error);
          resolve(null);
        };
      } catch (err) {
        console.warn("IndexedDB initialization caught exception:", err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  async saveObservation(obs: CachedObservation): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_OBSERVATIONS, STORE_PENDING_QUEUE], "readwrite");
      tx.objectStore(STORE_OBSERVATIONS).put(obs);
      if (obs.sync_status === "pending_upload") {
        tx.objectStore(STORE_PENDING_QUEUE).put(obs);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingUploads(): Promise<CachedObservation[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_QUEUE, "readonly");
      const request = tx.objectStore(STORE_PENDING_QUEUE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async queueObservation(obs: Omit<CachedObservation, "sync_status"> & { sync_status?: "synced" | "pending_upload" }): Promise<void> {
    return this.saveObservation({
      ...obs,
      sync_status: "pending_upload",
    });
  }

  async markAsSynced(idOrIds: string | string[]): Promise<void> {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const db = await this.getDB();
    if (!db || ids.length === 0) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_OBSERVATIONS, STORE_PENDING_QUEUE], "readwrite");
      const obsStore = tx.objectStore(STORE_OBSERVATIONS);
      const queueStore = tx.objectStore(STORE_PENDING_QUEUE);

      for (const id of ids) {
        queueStore.delete(id);
        const getReq = obsStore.get(id);
        getReq.onsuccess = () => {
          if (getReq.result) {
            getReq.result.sync_status = "synced";
            obsStore.put(getReq.result);
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingCount(): Promise<number> {
    const pending = await this.getPendingUploads();
    return pending.length;
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_OBSERVATIONS, STORE_PENDING_QUEUE], "readwrite");
      tx.objectStore(STORE_OBSERVATIONS).clear();
      tx.objectStore(STORE_PENDING_QUEUE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineStore = new OfflineStore();
