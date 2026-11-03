/**
 * iOS Apple HealthKit Genuine Platform Integration (OD-07, SRS-HK).
 *
 * Implements Apple HealthKit capability verification, permission management,
 * deterministic stable identification, and canonical metric extraction.
 * Strictly adheres to the zero-fabrication policy.
 */

import { Platform } from "react-native";
import AppleHealthKit, { HealthKitPermissions } from "react-native-health";
import { HealthMetricRecord } from "../../types";
import { HealthPlatformAdapter, PermissionStatus } from "./types";

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants?.Permissions?.StepCount || "StepCount",
      AppleHealthKit.Constants?.Permissions?.HeartRate || "HeartRate",
      AppleHealthKit.Constants?.Permissions?.SleepAnalysis || "SleepAnalysis",
      AppleHealthKit.Constants?.Permissions?.ActiveEnergyBurned || "ActiveEnergyBurned",
      AppleHealthKit.Constants?.Permissions?.BloodPressure || "BloodPressure",
      AppleHealthKit.Constants?.Permissions?.OxygenSaturation || "OxygenSaturation",
      AppleHealthKit.Constants?.Permissions?.BloodGlucose || "BloodGlucose",
    ],
    write: [],
  },
};

/**
 * Derives a stable, deterministic record identifier from Apple HealthKit UUID or observation attributes.
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
  return `det_hk_${metric}_${timestamp}${suffix ? "_" + suffix : ""}`;
}

export class HealthKitAdapter implements HealthPlatformAdapter {
  /**
   * Genuine availability check inspecting Apple HealthKit availability on device.
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== "ios") {
      return false;
    }

    return new Promise((resolve) => {
      try {
        AppleHealthKit.isAvailable((err: any, available: boolean) => {
          if (err || !available) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Inspects HealthKit authorization status.
   */
  async checkPermissions(): Promise<PermissionStatus> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: PERMISSIONS.permissions.read,
      };
    }

    return new Promise((resolve) => {
      try {
        AppleHealthKit.getAuthStatus(PERMISSIONS, (err: any, results: any) => {
          if (err || !results) {
            resolve({
              granted: false,
              canRequest: true,
              deniedPermissions: PERMISSIONS.permissions.read,
            });
          } else {
            // HealthKit returns status: 0 = not determined, 1 = denied, 2 = authorized
            const denied: string[] = [];
            for (const perm of PERMISSIONS.permissions.read) {
              if (results.permissions?.read?.[perm] !== 2) {
                denied.push(perm);
              }
            }
            resolve({
              granted: denied.length === 0,
              canRequest: true,
              deniedPermissions: denied,
            });
          }
        });
      } catch {
        resolve({
          granted: false,
          canRequest: true,
          deniedPermissions: PERMISSIONS.permissions.read,
        });
      }
    });
  }

  /**
   * Prompts the user with the Apple HealthKit authorization sheet.
   */
  async requestPermissions(): Promise<PermissionStatus> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: PERMISSIONS.permissions.read,
      };
    }

    return new Promise((resolve) => {
      try {
        AppleHealthKit.initHealthKit(PERMISSIONS, (err: any) => {
          if (err) {
            resolve({
              granted: false,
              canRequest: false,
              deniedPermissions: PERMISSIONS.permissions.read,
            });
          } else {
            resolve(this.checkPermissions());
          }
        });
      } catch {
        resolve({
          granted: false,
          canRequest: false,
          deniedPermissions: PERMISSIONS.permissions.read,
        });
      }
    });
  }

  /**
   * Reads HealthKit observations and normalizes them into VitalSense records.
   * Zero-fabrication: Never fabricates measurements when no data exists or permissions are denied.
   */
  async readRecentRecords(startTime: Date, endTime: Date): Promise<HealthMetricRecord[]> {
    const available = await this.isAvailable();
    if (!available) return [];

    const permStatus = await this.checkPermissions();
    if (!permStatus.granted && permStatus.deniedPermissions.length === PERMISSIONS.permissions.read.length) {
      return [];
    }

    const options = {
      startDate: startTime.toISOString(),
      endDate: endTime.toISOString(),
    };

    const records: HealthMetricRecord[] = [];
    const nowIso = new Date().toISOString();

    // 1. Steps (using sample-level API for accurate timestamps and platform UUIDs)
    await new Promise<void>((resolve) => {
      try {
        if (typeof (AppleHealthKit as any).getDailyStepCountSamples === "function") {
          (AppleHealthKit as any).getDailyStepCountSamples(options, (err: any, samples: any[]) => {
            if (!err && Array.isArray(samples)) {
              for (const sample of samples) {
                if (sample && typeof sample.value === "number" && sample.value > 0) {
                  const sampleDate = sample.startDate || sample.endDate || startTime.toISOString();
                  const stableId = deriveStableSourceId(sample.id || sample.uuid, "steps", sampleDate);
                  records.push({
                    record_id: `hk_rec_${stableId}`,
                    source_name: "apple_healthkit",
                    source_record_id: stableId,
                    metric_name: "steps",
                    numeric_value: sample.value,
                    unit: "count",
                    measured_at: sampleDate,
                    recorded_at: nowIso,
                  });
                }
              }
            }
            resolve();
          });
        } else {
          AppleHealthKit.getStepCount(options, (err: any, results: any) => {
            if (!err && results && typeof results.value === "number" && results.value > 0) {
              const stableId = deriveStableSourceId(null, "steps", startTime.toISOString());
              records.push({
                record_id: `hk_rec_${stableId}`,
                source_name: "apple_healthkit",
                source_record_id: stableId,
                metric_name: "steps",
                numeric_value: results.value,
                unit: "count",
                measured_at: startTime.toISOString(),
                recorded_at: nowIso,
              });
            }
            resolve();
          });
        }
      } catch {
        resolve();
      }
    });

    // 2. Heart Rate
    await new Promise<void>((resolve) => {
      try {
        AppleHealthKit.getHeartRateSamples(options, (err: any, samples: any[]) => {
          if (!err && Array.isArray(samples)) {
            for (const sample of samples) {
              if (sample && typeof sample.value === "number" && sample.value > 0 && sample.startDate) {
                const stableId = deriveStableSourceId(
                  sample.id || sample.uuid,
                  "hr",
                  sample.startDate,
                  String(sample.value)
                );
                records.push({
                  record_id: `hk_rec_${stableId}`,
                  source_name: "apple_healthkit",
                  source_record_id: stableId,
                  metric_name: "heart_rate",
                  numeric_value: sample.value,
                  unit: "bpm",
                  measured_at: sample.startDate,
                  recorded_at: nowIso,
                });
              }
            }
          }
          resolve();
        });
      } catch {
        resolve();
      }
    });

    // 3. Sleep Analysis
    await new Promise<void>((resolve) => {
      try {
        if (typeof (AppleHealthKit as any).getSleepSamples === "function") {
          (AppleHealthKit as any).getSleepSamples(options, (err: any, samples: any[]) => {
            if (!err && Array.isArray(samples)) {
              for (const sample of samples) {
                if (sample && sample.startDate && sample.endDate) {
                  const startMs = new Date(sample.startDate).getTime();
                  const endMs = new Date(sample.endDate).getTime();
                  const durationSeconds = (endMs - startMs) / 1000;
                  if (durationSeconds > 0) {
                    const stableId = deriveStableSourceId(sample.id || sample.uuid, "sleep", sample.startDate);
                    records.push({
                      record_id: `hk_rec_${stableId}`,
                      source_name: "apple_healthkit",
                      source_record_id: stableId,
                      metric_name: "sleep_session",
                      numeric_value: durationSeconds,
                      unit: "seconds",
                      measured_at: sample.startDate,
                      recorded_at: nowIso,
                    });
                  }
                }
              }
            }
            resolve();
          });
        } else {
          resolve();
        }
      } catch {
        resolve();
      }
    });

    // 4. Active Energy Burned
    await new Promise<void>((resolve) => {
      try {
        if (typeof (AppleHealthKit as any).getActiveEnergyBurned === "function") {
          (AppleHealthKit as any).getActiveEnergyBurned(options, (err: any, samples: any[]) => {
            if (!err && Array.isArray(samples)) {
              for (const sample of samples) {
                if (sample && typeof sample.value === "number" && sample.value > 0 && sample.startDate) {
                  const stableId = deriveStableSourceId(sample.id || sample.uuid, "active_energy", sample.startDate);
                  records.push({
                    record_id: `hk_rec_${stableId}`,
                    source_name: "apple_healthkit",
                    source_record_id: stableId,
                    metric_name: "active_energy",
                    numeric_value: sample.value,
                    unit: "kcal",
                    measured_at: sample.startDate,
                    recorded_at: nowIso,
                  });
                }
              }
            }
            resolve();
          });
        } else {
          resolve();
        }
      } catch {
        resolve();
      }
    });

    // 5. Blood Pressure (Paired)
    await new Promise<void>((resolve) => {
      try {
        if (typeof (AppleHealthKit as any).getBloodPressureSamples === "function") {
          (AppleHealthKit as any).getBloodPressureSamples(options, (err: any, samples: any[]) => {
            if (!err && Array.isArray(samples)) {
              for (const sample of samples) {
                const sys = sample.bloodPressureSystolicValue ?? sample.systolic;
                const dia = sample.bloodPressureDiastolicValue ?? sample.diastolic;
                const date = sample.startDate || sample.endDate;
                if (typeof sys === "number" && typeof dia === "number" && sys > dia && date) {
                  const pairId = deriveStableSourceId(sample.id || sample.uuid, "bp", date);
                  records.push({
                    record_id: `hk_rec_${pairId}_sys`,
                    source_name: "apple_healthkit",
                    source_record_id: `${pairId}_sys`,
                    metric_name: "blood_pressure_systolic",
                    numeric_value: sys,
                    unit: "mmHg",
                    measured_at: date,
                    recorded_at: nowIso,
                    metadata_json: { paired_reading_id: pairId },
                  });
                  records.push({
                    record_id: `hk_rec_${pairId}_dia`,
                    source_name: "apple_healthkit",
                    source_record_id: `${pairId}_dia`,
                    metric_name: "blood_pressure_diastolic",
                    numeric_value: dia,
                    unit: "mmHg",
                    measured_at: date,
                    recorded_at: nowIso,
                    metadata_json: { paired_reading_id: pairId },
                  });
                }
              }
            }
            resolve();
          });
        } else {
          resolve();
        }
      } catch {
        resolve();
      }
    });

    return records;
  }
}

export const healthKitAdapter = new HealthKitAdapter();
