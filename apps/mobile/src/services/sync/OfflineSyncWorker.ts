/**
 * VitalSense Mobile Offline-First Synchronization Worker.
 *
 * Coordinates local encrypted storage with server synchronization,
 * supporting full-resync, tombstone deletion propagation, and sensor polling.
 */

import { mobileStorage } from "../storage/sqlcipher";
import { mobileApi } from "../api";
import { SyncBatchPayload, SyncBatchResponse, HealthMetricRecord } from "../../types";
import { healthConnectAdapter } from "../health/HealthConnectAdapter";
import { healthKitAdapter } from "../health/HealthKitAdapter";
import { Platform } from "react-native";

export interface SyncResult {
  success: boolean;
  recordsUploaded: number;
  recordsDownloaded: number;
  deletionsApplied: number;
  error?: string;
}

export class OfflineSyncWorker {
  private isSyncing = false;

  async executeSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, recordsUploaded: 0, recordsDownloaded: 0, deletionsApplied: 0, error: "Sync already in progress" };
    }

    this.isSyncing = true;
    try {
      // 1. Poll native sensors if permissions are active
      await this.pollNativeSensors();

      // 2. Fetch pending local mutations
      const pendingRecords = await mobileStorage.getPendingUploadRecords();
      const pendingTombstones = await mobileStorage.getPendingTombstones();

      const lastSyncToken = (await mobileStorage.getItem("last_server_sync_token")) || "init_sync_0";
      const clientSyncToken = `mobile_sync_${Date.now()}`;

      const payload: SyncBatchPayload = {
        client_sync_token: clientSyncToken,
        records: pendingRecords.map((r) => ({
          record_id: r.record_id,
          source_name: r.source_name,
          source_record_id: r.source_record_id,
          metric_name: r.metric_name,
          numeric_value: r.numeric_value,
          unit: r.unit,
          measured_at: r.measured_at,
          recorded_at: r.recorded_at,
          metadata_json: r.metadata_json,
          supersedes_record_id: r.supersedes_record_id,
        })),
        deletions: pendingTombstones.map((t) => ({
          record_id: t.record_id,
          source_name: t.source_name,
          source_record_id: t.source_record_id,
          deleted_at: t.deleted_at,
        })),
      };

      // 3. Transmit batch to backend
      const response: SyncBatchResponse = await mobileApi.syncBatch(payload);

      // 4. Mark local records as synced
      if (pendingRecords.length > 0) {
        await mobileStorage.markAsSynced(pendingRecords.map((r) => r.record_id));
      }
      if (pendingTombstones.length > 0) {
        await mobileStorage.markTombstonesSynced(pendingTombstones.map((t) => t.record_id));
      }

      // 5. Ingest incoming server records
      if (response.new_server_records && response.new_server_records.length > 0) {
        await mobileStorage.saveBatch(response.new_server_records, "synced");
      }

      // 6. Update sync checkpoint
      await mobileStorage.setItem("last_server_sync_token", response.server_sync_token);

      return {
        success: true,
        recordsUploaded: response.records_accepted,
        recordsDownloaded: response.new_server_records?.length || 0,
        deletionsApplied: response.deletions_applied,
      };
    } catch (err: any) {
      return {
        success: false,
        recordsUploaded: 0,
        recordsDownloaded: 0,
        deletionsApplied: 0,
        error: err.message || "Network synchronization failure",
      };
    } finally {
      this.isSyncing = false;
    }
  }

  private async pollNativeSensors(): Promise<void> {
    try {
      const now = new Date();
      const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      let newRecords: HealthMetricRecord[] = [];
      if (Platform.OS === "android") {
        newRecords = await healthConnectAdapter.readRecentRecords(past24h, now);
      } else if (Platform.OS === "ios") {
        newRecords = await healthKitAdapter.readRecentRecords(past24h, now);
      }

      if (newRecords.length > 0) {
        await mobileStorage.saveBatch(newRecords, "pending_upload");
      }
    } catch {
      // Sensor polling non-critical failure
    }
  }
}

export const offlineSyncWorker = new OfflineSyncWorker();

