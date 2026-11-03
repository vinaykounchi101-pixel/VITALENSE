/**
 * Android Health Connect Genuine Platform Integration (OD-07, SRS-HC).
 *
 * Implements real Health Connect capability detection, SDK status checks,
 * fine-grained permission inspection, and canonical metric normalization.
 * Strictly adheres to the zero-fabrication policy.
 */

import { Platform } from "react-native";
import * as HealthConnect from "react-native-health-connect";
import type { HealthMetricRecord } from "../../types/index.ts";
import { HealthPlatformAdapter, PermissionStatus } from "./types.ts";
import { deriveStableSourceId } from "./sourceIdentifier.ts";

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
   * Inspects granular permissions directly from the Health Connect provider.
   */
  async checkPermissions(): Promise<PermissionStatus> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: SUPPORTED_PERMISSIONS.map((p) => p.recordType),
        state: "unavailable",
      };
    }

    const initialized = await this.ensureInitialized();
    if (!initialized) {
      return {
        granted: false,
        canRequest: true,
        deniedPermissions: SUPPORTED_PERMISSIONS.map((p) => p.recordType),
        state: "undetermined",
      };
    }

    try {
      const grantedList = await HealthConnect.getGrantedPermissions();
      const grantedTypes = new Set(
        grantedList
          .filter((p: any) => p.accessType === "read")
          .map((p: any) => p.recordType)
      );

      const denied: string[] = [];
      for (const req of SUPPORTED_PERMISSIONS) {
        if (!grantedTypes.has(req.recordType)) {
          denied.push(req.recordType);
        }
      }

      return {
        granted: denied.length === 0,
        canRequest: true,
        deniedPermissions: denied,
        state: denied.length === 0 ? "authorized" : "denied",
      };
    } catch {
      return {
        granted: false,
        canRequest: true,
        deniedPermissions: SUPPORTED_PERMISSIONS.map((p) => p.recordType),
        state: "undetermined",
      };
    }
  }

  /**
   * Triggers the genuine Health Connect permission prompt sheet.
   */
  async requestPermissions(): Promise<PermissionStatus> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: SUPPORTED_PERMISSIONS.map((p) => p.recordType),
        state: "unavailable",
      };
    }

    const initialized = await this.ensureInitialized();
    if (!initialized) {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: SUPPORTED_PERMISSIONS.map((p) => p.recordType),
        state: "undetermined",
      };
    }

    try {
      await HealthConnect.requestPermission(SUPPORTED_PERMISSIONS);
      return this.checkPermissions();
    } catch {
      return this.checkPermissions();
    }
  }

  /**
   * Reads Health Connect records and normalizes them into VitalSense records.
   * Zero-fabrication: Never fabricates measurements when no data exists or permissions are denied.
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
        const records = response.records || [];
        for (let idx = 0; idx < records.length; idx++) {
          const record = records[idx];
          if (typeof record.count === "number" && record.count > 0) {
            const stableId = deriveStableSourceId({
              platformPrefix: "hc",
              platformId: record.metadata?.id,
              metric: "steps",
              startTime: record.startTime,
              endTime: record.endTime,
              numericValue: record.count,
              unit: "count",
              discriminator: record.metadata?.dataOrigin,
              sampleIndex: idx,
            });
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
          const samples = record.samples || [];
          for (let sIdx = 0; sIdx < samples.length; sIdx++) {
            const sample = samples[sIdx];
            if (typeof sample.beatsPerMinute === "number" && sample.beatsPerMinute > 0 && sample.time) {
              const stableId = deriveStableSourceId({
                platformPrefix: "hc",
                platformId: record.metadata?.id,
                metric: "heart_rate",
                startTime: sample.time,
                numericValue: sample.beatsPerMinute,
                unit: "bpm",
                discriminator: sample.time,
                sampleIndex: sIdx,
              });
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
        const records = response.records || [];
        for (let idx = 0; idx < records.length; idx++) {
          const record = records[idx];
          const bpm = record.beatsPerMinute;
          const time = record.time || record.startTime;
          if (typeof bpm === "number" && bpm > 0 && time) {
            const stableId = deriveStableSourceId({
              platformPrefix: "hc",
              platformId: record.metadata?.id,
              metric: "resting_heart_rate",
              startTime: time,
              numericValue: bpm,
              unit: "bpm",
              discriminator: record.metadata?.dataOrigin,
              sampleIndex: idx,
            });
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
        const records = response.records || [];
        for (let idx = 0; idx < records.length; idx++) {
          const record = records[idx];
          const startMs = new Date(record.startTime).getTime();
          const endMs = new Date(record.endTime).getTime();
          const durationSeconds = (endMs - startMs) / 1000;
          if (durationSeconds > 0) {
            const stableId = deriveStableSourceId({
              platformPrefix: "hc",
              platformId: record.metadata?.id,
              metric: "sleep_session",
              startTime: record.startTime,
              endTime: record.endTime,
              numericValue: durationSeconds,
              unit: "seconds",
              discriminator: record.metadata?.dataOrigin,
              sampleIndex: idx,
            });
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
        const records = response.records || [];
        for (let idx = 0; idx < records.length; idx++) {
          const record = records[idx];
          const energyKcal = record.energy?.inKilocalories;
          // Zero-fabrication: skip record if energy is missing or not a positive number
          if (typeof energyKcal === "number" && energyKcal > 0) {
            const stableId = deriveStableSourceId({
              platformPrefix: "hc",
              platformId: record.metadata?.id,
              metric: "active_energy",
              startTime: record.startTime,
              endTime: record.endTime,
              numericValue: energyKcal,
              unit: "kcal",
              discriminator: record.metadata?.dataOrigin,
              sampleIndex: idx,
            });
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
        const records = response.records || [];
        for (let idx = 0; idx < records.length; idx++) {
          const record = records[idx];
          const sys = record.systolic?.inMillimetersOfMercury;
          const dia = record.diastolic?.inMillimetersOfMercury;
          const time = record.time || record.startTime;

          // Strict validation: both systolic and diastolic must be present and sys > dia
          if (typeof sys === "number" && typeof dia === "number" && sys > dia && time) {
            const pairId = deriveStableSourceId({
              platformPrefix: "hc",
              platformId: record.metadata?.id,
              metric: "blood_pressure",
              startTime: time,
              numericValue: sys,
              unit: "mmHg",
              discriminator: `dia_${dia}`,
              sampleIndex: idx,
            });
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
        const records = response.records || [];
        for (let idx = 0; idx < records.length; idx++) {
          const record = records[idx];
          const percentage = record.percentage?.value ?? record.percentage;
          const time = record.time || record.startTime;
          // Canonical unit for oxygen_saturation in VitalSense is 'percentage'
          if (typeof percentage === "number" && percentage > 0 && time) {
            const stableId = deriveStableSourceId({
              platformPrefix: "hc",
              platformId: record.metadata?.id,
              metric: "blood_oxygen_saturation",
              startTime: time,
              numericValue: percentage,
              unit: "percentage",
              discriminator: record.metadata?.dataOrigin,
              sampleIndex: idx,
            });
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
        const records = response.records || [];
        for (let idx = 0; idx < records.length; idx++) {
          const record = records[idx];
          const glucoseVal = record.level?.inMilligramsPerDeciliter ?? record.level;
          const time = record.time || record.startTime;
          // Canonical unit is 'mg/dL'
          if (typeof glucoseVal === "number" && glucoseVal > 0 && time) {
            const stableId = deriveStableSourceId({
              platformPrefix: "hc",
              platformId: record.metadata?.id,
              metric: "blood_glucose",
              startTime: time,
              numericValue: glucoseVal,
              unit: "mg/dL",
              discriminator: record.metadata?.dataOrigin,
              sampleIndex: idx,
            });
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
