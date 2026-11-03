/**
 * iOS Apple HealthKit Genuine Platform Integration (OD-07, SRS-HK).
 *
 * Implements Apple HealthKit capability verification, privacy-honest permission management,
 * collision-resistant deterministic identification, and canonical metric extraction.
 * Strictly adheres to the zero-fabrication policy and Apple HealthKit privacy guidelines.
 */

import { Platform } from "react-native";
import AppleHealthKit, { HealthKitPermissions } from "react-native-health";
import type { HealthMetricRecord } from "../../types/index.ts";
import { HealthPlatformAdapter, PermissionStatus } from "./types.ts";
import { deriveStableSourceId } from "./sourceIdentifier.ts";

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

export class HealthKitAdapter implements HealthPlatformAdapter {
  private hasRequestedPermissions = false;

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
   *
   * IMPORTANT PRIVACY ARCHITECTURE NOTE (Apple HealthKit):
   * Apple's HealthKit privacy model deliberately conceals whether a user granted or denied
   * read access. HKAuthorizationStatus only reveals sharing (write) status.
   * For read permissions, status is either 0 (notDetermined) or unconfirmed.
   * If a user denies read access, HealthKit queries silently return empty result sets ([]).
   * This method reports only observable platform facts:
   * - Genuinely observable denied status (observable write denials)
   * - Undetermined / privacy-restricted read status
   * - Honest non-presumptive states without inventing denial or authorization.
   */
  async checkPermissions(): Promise<PermissionStatus> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: [],
        undeterminedPermissions: PERMISSIONS.permissions.read,
        readPrivacyRestricted: true,
        state: "unavailable",
      };
    }

    return new Promise((resolve) => {
      try {
        AppleHealthKit.getAuthStatus(PERMISSIONS, (err: any, results: any) => {
          if (err || !results) {
            resolve({
              granted: false,
              canRequest: true,
              deniedPermissions: [],
              undeterminedPermissions: PERMISSIONS.permissions.read,
              readPrivacyRestricted: true,
              state: "undetermined",
            });
          } else {
            const denied: string[] = [];
            const undetermined: string[] = [];

            // 1. Check observable write permissions
            for (const perm of PERMISSIONS.permissions.write || []) {
              const status = results.permissions?.write?.[perm];
              if (status === 1) {
                denied.push(perm);
              } else if (status === 0 || status === undefined) {
                undetermined.push(perm);
              }
            }

            // 2. Read permissions (privacy-restricted by Apple design)
            for (const perm of PERMISSIONS.permissions.read || []) {
              const status = results.permissions?.read?.[perm];
              if (status === 1) {
                // If the platform specifically surfaces denial
                denied.push(perm);
              } else if (status !== 2) {
                // Status 0 or undefined for read is privacy-restricted / undetermined
                undetermined.push(perm);
              }
            }

            const isExplicitlyDenied = denied.length > 0;
            const allAuthorized =
              denied.length === 0 &&
              undetermined.length === 0 &&
              PERMISSIONS.permissions.read.every(
                (p) => results.permissions?.read?.[p] === 2
              );

            resolve({
              granted: allAuthorized,
              canRequest: !this.hasRequestedPermissions,
              deniedPermissions: denied,
              undeterminedPermissions: undetermined,
              readPrivacyRestricted: true,
              state: isExplicitlyDenied
                ? "denied"
                : allAuthorized
                ? "authorized"
                : "read_status_private",
            });
          }
        });
      } catch {
        resolve({
          granted: false,
          canRequest: true,
          deniedPermissions: [],
          undeterminedPermissions: PERMISSIONS.permissions.read,
          readPrivacyRestricted: true,
          state: "undetermined",
        });
      }
    });
  }

  /**
   * Prompts the user with the Apple HealthKit authorization sheet.
   * Tracks invocation state to prevent intrusive repeated prompt loops.
   */
  async requestPermissions(): Promise<PermissionStatus> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        granted: false,
        canRequest: false,
        deniedPermissions: [],
        undeterminedPermissions: PERMISSIONS.permissions.read,
        readPrivacyRestricted: true,
        state: "unavailable",
      };
    }

    if (this.hasRequestedPermissions) {
      // Avoid disruptive re-prompts if user already completed the system sheet
      return this.checkPermissions();
    }

    this.hasRequestedPermissions = true;

    return new Promise((resolve) => {
      try {
        AppleHealthKit.initHealthKit(PERMISSIONS, (err: any) => {
          if (err) {
            resolve({
              granted: false,
              canRequest: false,
              deniedPermissions: [],
              undeterminedPermissions: PERMISSIONS.permissions.read,
              readPrivacyRestricted: true,
              state: "denied",
            });
          } else {
            resolve(this.checkPermissions());
          }
        });
      } catch {
        resolve({
          granted: false,
          canRequest: false,
          deniedPermissions: [],
          undeterminedPermissions: PERMISSIONS.permissions.read,
          readPrivacyRestricted: true,
          state: "undetermined",
        });
      }
    });
  }

  /**
   * Reads HealthKit observations and normalizes them into VitalSense records.
   * Zero-fabrication: Never fabricates measurements when no data exists.
   * Does not abort solely due to private read status; executes native query and
   * respects Apple's empty-array return if read access is not granted.
   */
  async readRecentRecords(startTime: Date, endTime: Date): Promise<HealthMetricRecord[]> {
    const available = await this.isAvailable();
    if (!available) return [];

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
              for (let idx = 0; idx < samples.length; idx++) {
                const sample = samples[idx];
                if (sample && typeof sample.value === "number" && sample.value > 0) {
                  const sampleDate = sample.startDate || sample.endDate || startTime.toISOString();
                  const stableId = deriveStableSourceId({
                    platformPrefix: "hk",
                    platformId: sample.id || sample.uuid,
                    metric: "steps",
                    startTime: sampleDate,
                    endTime: sample.endDate,
                    numericValue: sample.value,
                    unit: "count",
                    discriminator: sample.sourceName || sample.sourceId,
                    sampleIndex: idx,
                  });
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
              const stableId = deriveStableSourceId({
                platformPrefix: "hk",
                metric: "steps",
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                numericValue: results.value,
                unit: "count",
                discriminator: "daily_step_summary",
              });
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
            for (let idx = 0; idx < samples.length; idx++) {
              const sample = samples[idx];
              if (sample && typeof sample.value === "number" && sample.value > 0 && sample.startDate) {
                const stableId = deriveStableSourceId({
                  platformPrefix: "hk",
                  platformId: sample.id || sample.uuid,
                  metric: "heart_rate",
                  startTime: sample.startDate,
                  endTime: sample.endDate,
                  numericValue: sample.value,
                  unit: "bpm",
                  discriminator: sample.sourceName || sample.sourceId,
                  sampleIndex: idx,
                });
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
              for (let idx = 0; idx < samples.length; idx++) {
                const sample = samples[idx];
                if (sample && sample.startDate && sample.endDate) {
                  const startMs = new Date(sample.startDate).getTime();
                  const endMs = new Date(sample.endDate).getTime();
                  const durationSeconds = (endMs - startMs) / 1000;
                  if (durationSeconds > 0) {
                    const stableId = deriveStableSourceId({
                      platformPrefix: "hk",
                      platformId: sample.id || sample.uuid,
                      metric: "sleep_session",
                      startTime: sample.startDate,
                      endTime: sample.endDate,
                      numericValue: durationSeconds,
                      unit: "seconds",
                      discriminator: sample.value !== undefined ? String(sample.value) : undefined,
                      sampleIndex: idx,
                    });
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
              for (let idx = 0; idx < samples.length; idx++) {
                const sample = samples[idx];
                if (sample && typeof sample.value === "number" && sample.value > 0 && sample.startDate) {
                  const stableId = deriveStableSourceId({
                    platformPrefix: "hk",
                    platformId: sample.id || sample.uuid,
                    metric: "active_energy",
                    startTime: sample.startDate,
                    endTime: sample.endDate,
                    numericValue: sample.value,
                    unit: "kcal",
                    discriminator: sample.sourceName || sample.sourceId,
                    sampleIndex: idx,
                  });
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

    // 5. Blood Pressure (Paired Readings)
    await new Promise<void>((resolve) => {
      try {
        if (typeof (AppleHealthKit as any).getBloodPressureSamples === "function") {
          (AppleHealthKit as any).getBloodPressureSamples(options, (err: any, samples: any[]) => {
            if (!err && Array.isArray(samples)) {
              for (let idx = 0; idx < samples.length; idx++) {
                const sample = samples[idx];
                const sys = sample?.bloodPressureSystolicValue ?? sample?.systolic;
                const dia = sample?.bloodPressureDiastolicValue ?? sample?.diastolic;
                const date = sample?.startDate || sample?.endDate;

                // Strict zero-fabrication: both systolic and diastolic must be valid with sys > dia
                if (typeof sys === "number" && typeof dia === "number" && sys > dia && date) {
                  const pairId = deriveStableSourceId({
                    platformPrefix: "hk",
                    platformId: sample.id || sample.uuid,
                    metric: "blood_pressure",
                    startTime: date,
                    numericValue: sys,
                    unit: "mmHg",
                    discriminator: `dia_${dia}`,
                    sampleIndex: idx,
                  });

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

    // 6. Oxygen Saturation (SpO2)
    await new Promise<void>((resolve) => {
      try {
        if (typeof (AppleHealthKit as any).getOxygenSaturationSamples === "function") {
          (AppleHealthKit as any).getOxygenSaturationSamples(options, (err: any, samples: any[]) => {
            if (!err && Array.isArray(samples)) {
              for (let idx = 0; idx < samples.length; idx++) {
                const sample = samples[idx];
                if (sample && typeof sample.value === "number" && sample.value > 0 && sample.startDate) {
                  // HealthKit returns SpO2 as decimal fraction (0.0 - 1.0) or percentage (0 - 100)
                  const percentage = sample.value <= 1.0 ? sample.value * 100 : sample.value;
                  const stableId = deriveStableSourceId({
                    platformPrefix: "hk",
                    platformId: sample.id || sample.uuid,
                    metric: "blood_oxygen_saturation",
                    startTime: sample.startDate,
                    numericValue: percentage,
                    unit: "percentage",
                    discriminator: sample.sourceName || sample.sourceId,
                    sampleIndex: idx,
                  });
                  records.push({
                    record_id: `hk_rec_${stableId}`,
                    source_name: "apple_healthkit",
                    source_record_id: stableId,
                    metric_name: "blood_oxygen_saturation",
                    numeric_value: percentage,
                    unit: "percentage",
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

    // 7. Blood Glucose
    await new Promise<void>((resolve) => {
      try {
        if (typeof (AppleHealthKit as any).getBloodGlucoseSamples === "function") {
          (AppleHealthKit as any).getBloodGlucoseSamples(options, (err: any, samples: any[]) => {
            if (!err && Array.isArray(samples)) {
              for (let idx = 0; idx < samples.length; idx++) {
                const sample = samples[idx];
                if (sample && typeof sample.value === "number" && sample.value > 0 && sample.startDate) {
                  const stableId = deriveStableSourceId({
                    platformPrefix: "hk",
                    platformId: sample.id || sample.uuid,
                    metric: "blood_glucose",
                    startTime: sample.startDate,
                    numericValue: sample.value,
                    unit: "mg/dL",
                    discriminator: sample.sourceName || sample.sourceId,
                    sampleIndex: idx,
                  });
                  records.push({
                    record_id: `hk_rec_${stableId}`,
                    source_name: "apple_healthkit",
                    source_record_id: stableId,
                    metric_name: "blood_glucose",
                    numeric_value: sample.value,
                    unit: "mg/dL",
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

    return records;
  }
}

export const healthKitAdapter = new HealthKitAdapter();
