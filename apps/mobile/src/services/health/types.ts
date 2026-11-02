/**
 * Mobile Sensor & Health Adapter Interfaces.
 */

import { HealthMetricRecord } from "../../types";

export interface PermissionStatus {
  granted: boolean;
  canRequest: boolean;
  deniedPermissions: string[];
}

export interface HealthPlatformAdapter {
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<PermissionStatus>;
  checkPermissions(): Promise<PermissionStatus>;
  readRecentRecords(startTime: Date, endTime: Date): Promise<HealthMetricRecord[]>;
}

