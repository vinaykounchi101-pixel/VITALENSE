declare module "react-native" {
  export const Platform: {
    OS: "ios" | "android" | "windows" | "macos" | "web";
    Version: number | string;
    select: <T>(obj: { [key: string]: T }) => T;
  };
  export const View: any;
  export const Text: any;
  export const ScrollView: any;
  export const TouchableOpacity: any;
  export const TextInput: any;
  export const StyleSheet: {
    create: <T extends Record<string, any>>(styles: T) => T;
  };
  export const RefreshControl: any;
  export const SafeAreaView: any;
  export const ActivityIndicator: any;
  export const Alert: {
    alert: (title: string, message?: string, buttons?: any[]) => void;
  };
}

declare module "expo-status-bar" {
  export const StatusBar: (props: { style?: "auto" | "inverted" | "light" | "dark" }) => any;
}

declare module "expo-secure-store" {
  export function setItemAsync(key: string, value: string, options?: any): Promise<void>;
  export function getItemAsync(key: string, options?: any): Promise<string | null>;
  export function deleteItemAsync(key: string, options?: any): Promise<void>;
}

declare module "expo-crypto" {
  export function getRandomBytesAsync(byteCount: number): Promise<Uint8Array>;
  export function digestStringAsync(algorithm: any, str: string): Promise<string>;
}

declare module "expo-sqlite" {
  export interface SQLiteDatabase {
    execAsync(sql: string): Promise<void>;
    runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
    getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null>;
    getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]>;
    closeAsync(): Promise<void>;
  }
  export function openDatabaseSync(dbName: string, options?: any): SQLiteDatabase;
  export function openDatabaseAsync(dbName: string, options?: any): Promise<SQLiteDatabase>;
}

declare module "react-native-health-connect" {
  export enum SdkAvailabilityStatus {
    SDK_AVAILABLE = 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED = 2,
    SDK_UNAVAILABLE = 3,
  }
  export function getSdkStatus(): Promise<number>;
  export function initialize(): Promise<boolean>;
  export function requestPermission(permissions: Array<{ accessType: "read" | "write"; recordType: string }>): Promise<Array<{ accessType: string; recordType: string }>>;
  export function getGrantedPermissions(): Promise<Array<{ accessType: string; recordType: string }>>;
  export function readRecords(recordType: string, options: { timeRangeFilter: { operator: "between"; startTime: string; endTime: string } }): Promise<{ records: any[] }>;
}

declare module "react-native-health" {
  export interface HealthKitPermissions {
    permissions: {
      read: string[];
      write: string[];
    };
  }
  const AppleHealthKit: {
    isAvailable(callback: (err: any, available: boolean) => void): void;
    initHealthKit(permissions: HealthKitPermissions, callback: (err: any, results: any) => void): void;
    getAuthStatus(permissions: HealthKitPermissions, callback: (err: any, results: any) => void): void;
    getStepCount(options: any, callback: (err: any, results: any) => void): void;
    getHeartRateSamples(options: any, callback: (err: any, results: any) => void): void;
    getSleepSamples(options: any, callback: (err: any, results: any) => void): void;
    getActiveEnergyBurned(options: any, callback: (err: any, results: any) => void): void;
    Constants: {
      Permissions: Record<string, string>;
    };
  };
  export default AppleHealthKit;
}
