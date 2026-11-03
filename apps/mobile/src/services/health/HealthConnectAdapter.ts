/**
 * Android Health Connect Genuine Platform Integration (OD-07, SRS-HC).
 *
 * Implements real Health Connect capability detection, SDK status checks,
 * fine-grained permission inspection, and canonical metric normalization.
 * Strictly adheres to the zero-fabrication policy.
 */

import { Platform } from "react-native";
import * as HealthConnect from "react-native-health-connect";
import { HealthMetricRecord } from "../../types";
import { HealthPlatformAdapter, PermissionStatus } from "./types";

const SUPPORTED_PERMISSIONS = [
  { accessType: "read" as const, recordType: "Steps" },
  { accessType: "read" as const, recordType: "HeartRate" },
  { accessType: "read" as const, recordType: "SleepSession" },
  { accessType: "read" as const, recordType: "TotalCaloriesBurned" },
  { accessType: "read" as const, recordType: "RestingHeartRate" },
  { accessType: "read" as const, recordType: "BloodPressure" },
  { accessType: "read" as const, recordType: "OxygenSaturation" },
  { accessType: "read" as const, recordType: "BloodGlucose" },
];

/**
 * Derives a stable, deterministic record identifier from platform metadata or observation attributes.
 * Prevents duplicate observations across repeated imports and eliminates random identifiers.
 */
function deriveStableSourceId(
  platformId: string | undefined | null,
  metric: string,
  timestamp: string,
  suffix = ""
): string {
  if (platformId && platformId.trim().length > 0) {
    return suffix ? `${platformId.trim()}_${suffix}` : platformId.trim();
  }
  // Deterministic identity strategy based on actual source observation
  return `det_hc_${metric}_${timestamp}${suffix ? "_" + suffix : ""}`;
}

export class HealthConnectAdapter implements HealthPlatformAdapter {
  private isInitialized = false;

  /**
   * Genuine availability check inspecting OS platform and Health Connect SDK availability.
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return false;
    }

    try {
      const sdkStatus = await HealthConnect.getSdkStatus();
      return sdkStatus === HealthConnect.SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.isInitialized) return true;
    const available = await this.isAvailable();
    if (!available) return false;

    try {
      this.isInitialized = await HealthConnect.initialize();
      return this.isInitialized;
    } catch {
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Introspects currently granted Health Connect permissions without hardcoding.
   */
  async checkPermissions(): Promise<PermissionStatus> {
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: SUPPORTED_PERMISSIONS.map((p) => p.recordType),
      };
    }

    try {
      const granted = await HealthConnect.getGrantedPermissions();
      const grantedTypes = new Set(granted.map((g) => g.recordType));

      const denied = SUPPORTED_PERMISSIONS.filter((p) => !grantedTypes.has(p.recordType)).map(
        (p) => p.recordType
      );

      return {
        granted: denied.length === 0,
        canRequest: true,
        deniedPermissions: denied,
      };
    } catch {
      return {
        granted: false,
        canRequest: true,
        deniedPermissions: SUPPORTED_PERMISSIONS.map((p) => p.recordType),
      };
    }
  }

  /**
   * Requests runtime permissions from the user via the Health Connect OS dialog.
   */
  async requestPermissions(): Promise<PermissionStatus> {
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: SUPPORTED_PERMISSIONS.map((p) => p.recordType),
      };
    }

    try {
      const granted = await HealthConnect.requestPermission(SUPPORTED_PERMISSIONS);
      const grantedTypes = new Set(granted.map((g) => g.recordType));

      const denied = SUPPORTED_PERMISSIONS.filter((p) => !grantedTypes.has(p.recordType)).map(
        (p) => p.recordType
      );

      return {
        granted: denied.length === 0,
        canRequest: false,
        deniedPermissions: denied,
      };
    } catch {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: SUPPORTED_PERMISSIONS.map((p) => p.recordType),
      };
    }
  }

  /**
   * Reads raw observations from Health Connect and normalizes them into VitalSense records.
   * Zero-fabrication: Never fabricates measurements; missing values are omitted rather than defaulted to zero.
   */
  async readRecentRecords(startTime: Date, endTime: Date): Promise<HealthMetricRecord[]> {
    const initialized = await this.ensureInitialized();
    if (!initialized) return [];

    const permStatus = await this.checkPermissions();
    const deniedSet = new Set(permStatus.deniedPermissions);

    const timeFilter = {
      operator: "between" as const,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };

    const results: HealthMetricRecord[] = [];
    const nowIso = new Date().toISOString();

    // 1. Steps
    if (!deniedSet.has("Steps")) {
      try {
        const response = await HealthConnect.readRecords("Steps", { timeRangeFilter: timeFilter });
        for (const record of response.records || []) {
          if (typeof record.count === "number" && record.count > 0) {
            const stableId = deriveStableSourceId(record.metadata?.id, "steps", record.startTime);
            results.push({
              record_id: `hc_rec_${stableId}`,
              source_name: "google_health_connect",
              source_record_id: stableId,
              metric_name: "steps",
              numeric_value: record.count,
              unit: "count",
              measured_at: record.startTime,
              recorded_at: nowIso,
            });
          }
        }
      } catch {}
    }

    // 2. Heart Rate
    if (!deniedSet.has("HeartRate")) {
      try {
        const response = await HealthConnect.readRecords("HeartRate", { timeRangeFilter: timeFilter });
        for (const record of response.records || []) {
          for (const sample of record.samples || []) {
            if (typeof sample.beatsPerMinute === "number" && sample.beatsPerMinute > 0 && sample.time) {
              const stableId = deriveStableSourceId(
                record.metadata?.id,
                "hr",
                sample.time,
                String(sample.beatsPerMinute)
              );
              results.push({
                record_id: `hc_rec_${stableId}`,
                source_name: "google_health_connect",
                source_record_id: stableId,
                metric_name: "heart_rate",
                numeric_value: sample.beatsPerMinute,
                unit: "bpm",
                measured_at: sample.time,
                recorded_at: nowIso,
              });
            }
          }
        }
      } catch {}
    }

    // 3. Resting Heart Rate
    if (!deniedSet.has("RestingHeartRate")) {
      try {
        const response = await (HealthConnect as any).readRecords("RestingHeartRate", { timeRangeFilter: timeFilter });
        for (const record of response.records || []) {
          const bpm = record.beatsPerMinute;
          const time = record.time || record.startTime;
          if (typeof bpm === "number" && bpm > 0 && time) {
            const stableId = deriveStableSourceId(record.metadata?.id, "rhr", time);
            results.push({
              record_id: `hc_rec_${stableId}`,
              source_name: "google_health_connect",
              source_record_id: stableId,
              metric_name: "resting_heart_rate",
              numeric_value: bpm,
              unit: "bpm",
              measured_at: time,
              recorded_at: nowIso,
            });
          }
        }
      } catch {}
    }

    // 4. Sleep Session
    if (!deniedSet.has("SleepSession")) {
      try {
        const response = await HealthConnect.readRecords("SleepSession", { timeRangeFilter: timeFilter });
        for (const record of response.records || []) {
          const startMs = new Date(record.startTime).getTime();
          const endMs = new Date(record.endTime).getTime();
          const durationSeconds = (endMs - startMs) / 1000;
          if (durationSeconds > 0) {
            const stableId = deriveStableSourceId(record.metadata?.id, "sleep", record.startTime);
            results.push({
              record_id: `hc_rec_${stableId}`,
              source_name: "google_health_connect",
              source_record_id: stableId,
              metric_name: "sleep_session",
              numeric_value: durationSeconds,
              unit: "seconds",
              measured_at: record.startTime,
              recorded_at: nowIso,
            });
          }
        }
      } catch {}
    }

    // 5. Total Calories (Active Energy)
    if (!deniedSet.has("TotalCaloriesBurned")) {
      try {
        const response = await HealthConnect.readRecords("TotalCaloriesBurned", {
          timeRangeFilter: timeFilter,
        });
        for (const record of response.records || []) {
          const energyKcal = record.energy?.inKilocalories;
          // Zero-fabrication: skip record if energy is missing or not a positive number
          if (typeof energyKcal === "number" && energyKcal > 0) {
            const stableId = deriveStableSourceId(record.metadata?.id, "active_energy", record.startTime);
            results.push({
              record_id: `hc_rec_${stableId}`,
              source_name: "google_health_connect",
              source_record_id: stableId,
              metric_name: "active_energy",
              numeric_value: energyKcal,
              unit: "kcal",
              measured_at: record.startTime,
              recorded_at: nowIso,
            });
          }
        }
      } catch {}
    }

    // 6. Blood Pressure (Paired)
    if (!deniedSet.has("BloodPressure")) {
      try {
        const response = await HealthConnect.readRecords("BloodPressure", { timeRangeFilter: timeFilter });
        for (const record of response.records || []) {
          const sys = record.systolic?.inMillimetersOfMercury;
          const dia = record.diastolic?.inMillimetersOfMercury;
          const time = record.time || record.startTime;

          // Strict validation: both systolic and diastolic must be present and sys > dia
          if (typeof sys === "number" && typeof dia === "number" && sys > dia && time) {
            const pairId = deriveStableSourceId(record.metadata?.id, "bp", time);
            results.push({
              record_id: `hc_rec_${pairId}_sys`,
              source_name: "google_health_connect",
              source_record_id: `${pairId}_sys`,
              metric_name: "blood_pressure_systolic",
              numeric_value: sys,
              unit: "mmHg",
              measured_at: time,
              recorded_at: nowIso,
              metadata_json: { paired_reading_id: pairId },
            });
            results.push({
              record_id: `hc_rec_${pairId}_dia`,
              source_name: "google_health_connect",
              source_record_id: `${pairId}_dia`,
              metric_name: "blood_pressure_diastolic",
              numeric_value: dia,
              unit: "mmHg",
              measured_at: time,
              recorded_at: nowIso,
              metadata_json: { paired_reading_id: pairId },
            });
          }
        }
      } catch {}
    }

    // 7. Oxygen Saturation (SpO2)
    if (!deniedSet.has("OxygenSaturation")) {
      try {
        const response = await (HealthConnect as any).readRecords("OxygenSaturation", { timeRangeFilter: timeFilter });
        for (const record of response.records || []) {
          const percentage = record.percentage?.value ?? record.percentage;
          const time = record.time || record.startTime;
          // Canonical unit for oxygen_saturation in VitalSense is 'percentage'
          if (typeof percentage === "number" && percentage > 0 && time) {
            const stableId = deriveStableSourceId(record.metadata?.id, "spo2", time);
            results.push({
              record_id: `hc_rec_${stableId}`,
              source_name: "google_health_connect",
              source_record_id: stableId,
              metric_name: "blood_oxygen_saturation",
              numeric_value: percentage,
              unit: "percentage",
              measured_at: time,
              recorded_at: nowIso,
            });
          }
        }
      } catch {}
    }

    // 8. Blood Glucose
    if (!deniedSet.has("BloodGlucose")) {
      try {
        const response = await (HealthConnect as any).readRecords("BloodGlucose", { timeRangeFilter: timeFilter });
        for (const record of response.records || []) {
          const glucoseVal = record.level?.inMilligramsPerDeciliter ?? record.level;
          const time = record.time || record.startTime;
          // Canonical unit is 'mg/dL'
          if (typeof glucoseVal === "number" && glucoseVal > 0 && time) {
            const stableId = deriveStableSourceId(record.metadata?.id, "glucose", time);
            results.push({
              record_id: `hc_rec_${stableId}`,
              source_name: "google_health_connect",
              source_record_id: stableId,
              metric_name: "blood_glucose",
              numeric_value: glucoseVal,
              unit: "mg/dL",
              measured_at: time,
              recorded_at: nowIso,
            });
          }
        }
      } catch {}
    }

    return results;
  }
}

export const healthConnectAdapter = new HealthConnectAdapter();
