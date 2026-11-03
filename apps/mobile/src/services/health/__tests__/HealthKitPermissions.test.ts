/**
 * Unit regression tests for Apple HealthKit Permission Semantics.
 * Validates privacy-honest status reporting, distinguishing genuinely observable denials
 * from Apple's privacy-restricted read model.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PermissionStatus } from "../types.ts";

// Helper function implementing the HealthKit authorization parsing logic
function parseHealthKitAuthStatus(options: {
  isAvailable: boolean;
  hasRequestedPermissions: boolean;
  permissionsPayload: {
    permissions?: {
      read?: Record<string, number>;
      write?: Record<string, number>;
    };
  } | null;
  error?: Error | null;
  allReadTypes: string[];
  allWriteTypes: string[];
}): PermissionStatus {
  if (!options.isAvailable) {
    return {
      granted: false,
      canRequest: false,
      deniedPermissions: [],
      undeterminedPermissions: options.allReadTypes,
      readPrivacyRestricted: true,
      state: "unavailable",
    };
  }

  if (options.error || !options.permissionsPayload) {
    return {
      granted: false,
      canRequest: !options.hasRequestedPermissions,
      deniedPermissions: [],
      undeterminedPermissions: options.allReadTypes,
      readPrivacyRestricted: true,
      state: "undetermined",
    };
  }

  const results = options.permissionsPayload;
  const denied: string[] = [];
  const undetermined: string[] = [];

  // 1. Check observable write permissions
  for (const perm of options.allWriteTypes) {
    const status = results.permissions?.write?.[perm];
    if (status === 1) {
      denied.push(perm);
    } else if (status === 0 || status === undefined) {
      undetermined.push(perm);
    }
  }

  // 2. Read permissions (privacy-restricted by Apple design)
  for (const perm of options.allReadTypes) {
    const status = results.permissions?.read?.[perm];
    if (status === 1) {
      denied.push(perm);
    } else if (status !== 2) {
      undetermined.push(perm);
    }
  }

  const isExplicitlyDenied = denied.length > 0;
  const allAuthorized =
    denied.length === 0 &&
    undetermined.length === 0 &&
    options.allReadTypes.every((p) => results.permissions?.read?.[p] === 2);

  return {
    granted: allAuthorized,
    canRequest: !options.hasRequestedPermissions,
    deniedPermissions: denied,
    undeterminedPermissions: undetermined,
    readPrivacyRestricted: true,
    state: isExplicitlyDenied
      ? "denied"
      : allAuthorized
      ? "authorized"
      : "read_status_private",
  };
}

describe("HealthKit Permission Semantics — Privacy-Honest Status Reporting", () => {
  const readTypes = ["StepCount", "HeartRate", "SleepAnalysis", "ActiveEnergyBurned"];
  const writeTypes: string[] = [];

  it("reports unavailable state when device lacks HealthKit support", () => {
    const status = parseHealthKitAuthStatus({
      isAvailable: false,
      hasRequestedPermissions: false,
      permissionsPayload: null,
      allReadTypes: readTypes,
      allWriteTypes: writeTypes,
    });

    assert.strictEqual(status.state, "unavailable");
    assert.strictEqual(status.granted, false);
    assert.strictEqual(status.canRequest, false);
  });

  it("reports read_status_private instead of false denial when Apple conceals read status", () => {
    // In HealthKit, status 0 (notDetermined) or unconfirmed is returned for pure read requests
    const status = parseHealthKitAuthStatus({
      isAvailable: true,
      hasRequestedPermissions: true,
      permissionsPayload: {
        permissions: {
          read: { StepCount: 0, HeartRate: 0, SleepAnalysis: 0, ActiveEnergyBurned: 0 },
        },
      },
      allReadTypes: readTypes,
      allWriteTypes: writeTypes,
    });

    // CRITICAL: Must not falsely claim the user denied read access!
    assert.strictEqual(status.deniedPermissions.length, 0);
    assert.strictEqual(status.readPrivacyRestricted, true);
    assert.strictEqual(status.state, "read_status_private");
    assert.strictEqual(status.canRequest, false); // Do not badger user repeatedly
  });

  it("reports genuinely observable denial when write or explicit denial status = 1 occurs", () => {
    const status = parseHealthKitAuthStatus({
      isAvailable: true,
      hasRequestedPermissions: true,
      permissionsPayload: {
        permissions: {
          write: { Workout: 1 },
          read: { StepCount: 0 },
        },
      },
      allReadTypes: ["StepCount"],
      allWriteTypes: ["Workout"],
    });

    assert.strictEqual(status.state, "denied");
    assert.ok(status.deniedPermissions.includes("Workout"));
  });

  it("reports authorized when all permissions explicitly return status 2", () => {
    const status = parseHealthKitAuthStatus({
      isAvailable: true,
      hasRequestedPermissions: true,
      permissionsPayload: {
        permissions: {
          read: { StepCount: 2, HeartRate: 2, SleepAnalysis: 2, ActiveEnergyBurned: 2 },
        },
      },
      allReadTypes: readTypes,
      allWriteTypes: writeTypes,
    });

    assert.strictEqual(status.granted, true);
    assert.strictEqual(status.deniedPermissions.length, 0);
    assert.strictEqual(status.state, "authorized");
  });

  it("reports undetermined when authorization sheet has never been invoked", () => {
    const status = parseHealthKitAuthStatus({
      isAvailable: true,
      hasRequestedPermissions: false,
      permissionsPayload: null,
      allReadTypes: readTypes,
      allWriteTypes: writeTypes,
    });

    assert.strictEqual(status.state, "undetermined");
    assert.strictEqual(status.canRequest, true);
    assert.strictEqual(status.granted, false);
  });
});

