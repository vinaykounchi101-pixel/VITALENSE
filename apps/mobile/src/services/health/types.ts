/**
 * Mobile Sensor & Health Adapter Interfaces.
 */

import type { HealthMetricRecord } from "../../types/index.ts";

export type PlatformPermissionState =
  | "authorized"
  | "denied"
  | "undetermined"
  | "unavailable"
  | "read_status_private";

export interface PermissionStatus {
  granted: boolean;
  canRequest: boolean;
  deniedPermissions: string[];
  undeterminedPermissions?: string[];
  readPrivacyRestricted?: boolean;
  state?: PlatformPermissionState;
}

export interface HealthPlatformAdapter {
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<PermissionStatus>;
  checkPermissions(): Promise<PermissionStatus>;
  readRecentRecords(startTime: Date, endTime: Date): Promise<HealthMetricRecord[]>;
}
