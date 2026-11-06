/**
 * Unit regression tests for Collision-Resistant, Deterministic Health Source Identifiers.
 * Tests canonical SHA-256 identity, backward compatibility with legacy FNV-1a,
 * idempotency, collision resistance, and length constraints.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveStableSourceId,
  deriveLegacyFnv1aSourceId,
  isLegacyFnv1aId,
  sha256Hex,
  fnv1aHex,
} from "../sourceIdentifier.ts";

describe("Health Source Identifiers — SHA-256 Canonical Identity & Backward Compatibility", () => {
  it("computes canonical SHA-256 hash matching standard NIST test vectors", () => {
    // NIST test vectors
    assert.strictEqual(
      sha256Hex(""),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert.strictEqual(
      sha256Hex("hello"),
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
    assert.strictEqual(
      sha256Hex("VitalSense-Health-Record-Identifier-Test-Vector"),
      "a84f3553720c83f074ad19ca19ce43b6b9d044c947a24072544bf136a2f2ce80"
    );
  });

  it("computes deterministic legacy FNV-1a hash consistently for backward compatibility", () => {
    const str = "heart_rate|2026-11-03T06:00:00Z||72.0000|bpm||";
    const hash1 = fnv1aHex(str);
    const hash2 = fnv1aHex(str);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 8);
  });

  it("derives canonical SHA-256 IDs by default", () => {
    const record = {
      platformPrefix: "hc" as const,
      metric: "heart_rate",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 72,
      unit: "bpm",
    };

    const id = deriveStableSourceId(record);
    assert.ok(id.startsWith("det_hc_heart_rate_2026-11-03T06_00_00Z_"));
    const hashPart = id.split("_").pop()!;
    assert.strictEqual(hashPart.length, 64);
    assert.match(hashPart, /^[0-9a-f]{64}$/);
    assert.strictEqual(isLegacyFnv1aId(id), false);
  });

  it("supports legacy FNV-1a IDs via explicit algorithm and helper for backward compatibility", () => {
    const record = {
      platformPrefix: "hc" as const,
      metric: "heart_rate",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 72,
      unit: "bpm",
    };

    const legacyId1 = deriveStableSourceId({ ...record, algorithm: "fnv1a" });
    const legacyId2 = deriveLegacyFnv1aSourceId(record);

    assert.strictEqual(legacyId1, legacyId2);
    assert.ok(legacyId1.startsWith("det_hc_heart_rate_2026-11-03T06_00_00Z_"));
    const hashPart = legacyId1.split("_").pop()!;
    assert.strictEqual(hashPart.length, 8);
    assert.match(hashPart, /^[0-9a-f]{8}$/);
    assert.strictEqual(isLegacyFnv1aId(legacyId1), true);
  });

  it("prefers native platform identifiers when available", () => {
    const id = deriveStableSourceId({
      platformPrefix: "hk",
      platformId: "550e8400-e29b-41d4-a716-446655440000",
      metric: "heart_rate",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 72,
      unit: "bpm",
    });

    assert.strictEqual(id, "hk_550e8400-e29b-41d4-a716-446655440000");
  });

  it("compounds parent record IDs with sample index for multi-sample series", () => {
    const id1 = deriveStableSourceId({
      platformPrefix: "hc",
      platformId: "series_abc123",
      metric: "heart_rate",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 72,
      unit: "bpm",
      sampleIndex: 0,
    });

    const id2 = deriveStableSourceId({
      platformPrefix: "hc",
      platformId: "series_abc123",
      metric: "heart_rate",
      startTime: "2026-11-03T06:01:00Z",
      numericValue: 72,
      unit: "bpm",
      sampleIndex: 1,
    });

    assert.notStrictEqual(id1, id2);
    assert.strictEqual(id1, "hc_series_abc123_idx0");
    assert.strictEqual(id2, "hc_series_abc123_idx1");
  });

  it("guarantees idempotency on identical re-imports without native IDs", () => {
    const record = {
      platformPrefix: "hk" as const,
      metric: "steps",
      startTime: "2026-11-03T06:00:00Z",
      endTime: "2026-11-03T06:15:00Z",
      numericValue: 1250,
      unit: "count",
      discriminator: "apple_watch",
    };

    const run1 = deriveStableSourceId(record);
    const run2 = deriveStableSourceId(record);
    const run3 = deriveStableSourceId(record);

    assert.strictEqual(run1, run2);
    assert.strictEqual(run2, run3);
  });

  it("canonicalizes values differing below the 0.0001 threshold to the same ID for float jitter protection", () => {
    // Two float readings differing by 0.00003 (e.g. IEEE 754 precision noise)
    const reading1 = {
      platformPrefix: "hk" as const,
      metric: "blood_oxygen_saturation",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 98.60001,
      unit: "percentage",
    };

    const reading2 = {
      platformPrefix: "hk" as const,
      metric: "blood_oxygen_saturation",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 98.60004,
      unit: "percentage",
    };

    const id1 = deriveStableSourceId(reading1);
    const id2 = deriveStableSourceId(reading2);

    // toFixed(4) evaluates both to "98.6000", preventing float jitter divergence
    assert.strictEqual(id1, id2);
  });

  it("produces distinct IDs for values differing at or above the 0.0001 threshold", () => {
    const reading1 = {
      platformPrefix: "hk" as const,
      metric: "blood_oxygen_saturation",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 98.6000,
      unit: "percentage",
    };

    const reading2 = {
      platformPrefix: "hk" as const,
      metric: "blood_oxygen_saturation",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 98.6001,
      unit: "percentage",
    };

    const id1 = deriveStableSourceId(reading1);
    const id2 = deriveStableSourceId(reading2);

    assert.notStrictEqual(id1, id2);
  });

  it("verifies idempotency across 50 repeated identical import cycles for all 10 Phase 1 metrics", () => {
    const sampleRecords = [
      { metric: "steps", unit: "count", value: 4500 },
      { metric: "heart_rate", unit: "bpm", value: 72 },
      { metric: "sleep_session", unit: "seconds", value: 28800 },
      { metric: "active_energy", unit: "kcal", value: 345.5 },
      { metric: "workout_session", unit: "seconds", value: 3600 },
      { metric: "resting_heart_rate", unit: "bpm", value: 62 },
      { metric: "blood_pressure_systolic", unit: "mmHg", value: 120 },
      { metric: "blood_pressure_diastolic", unit: "mmHg", value: 80 },
      { metric: "blood_oxygen_saturation", unit: "percentage", value: 98.5 },
      { metric: "blood_glucose", unit: "mg/dL", value: 95.0 },
    ];

    for (const item of sampleRecords) {
      const baseParams = {
        platformPrefix: "hc" as const,
        metric: item.metric,
        startTime: "2026-11-03T08:00:00Z",
        endTime: "2026-11-03T08:30:00Z",
        numericValue: item.value,
        unit: item.unit,
        discriminator: "test_sensor",
      };

      const baselineId = deriveStableSourceId(baseParams);

      for (let cycle = 0; cycle < 50; cycle++) {
        const reimportedId = deriveStableSourceId({ ...baseParams });
        assert.strictEqual(reimportedId, baselineId, `Drift detected on cycle ${cycle} for ${item.metric}`);
      }
    }
  });

  it("produces distinct IDs for same metric and timestamp when values differ", () => {
    const idA = deriveStableSourceId({
      platformPrefix: "hk",
      metric: "heart_rate",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 72,
      unit: "bpm",
    });

    const idB = deriveStableSourceId({
      platformPrefix: "hk",
      metric: "heart_rate",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 85,
      unit: "bpm",
    });

    assert.notStrictEqual(idA, idB);
  });

  it("produces distinct IDs for same metric and timestamp when durations differ", () => {
    const idShort = deriveStableSourceId({
      platformPrefix: "hc",
      metric: "sleep_session",
      startTime: "2026-11-03T00:00:00Z",
      endTime: "2026-11-03T04:00:00Z",
      numericValue: 14400,
      unit: "seconds",
    });

    const idLong = deriveStableSourceId({
      platformPrefix: "hc",
      metric: "sleep_session",
      startTime: "2026-11-03T00:00:00Z",
      endTime: "2026-11-03T07:30:00Z",
      numericValue: 27000,
      unit: "seconds",
    });

    assert.notStrictEqual(idShort, idLong);
  });

  it("produces distinct IDs for same metric, timestamp, and value when source device differs", () => {
    const idPhone = deriveStableSourceId({
      platformPrefix: "hk",
      metric: "steps",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 500,
      unit: "count",
      discriminator: "com.apple.health.phone",
    });

    const idWatch = deriveStableSourceId({
      platformPrefix: "hk",
      metric: "steps",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 500,
      unit: "count",
      discriminator: "com.apple.health.watch",
    });

    assert.notStrictEqual(idPhone, idWatch);
  });

  it("enforces PostgreSQL VARCHAR(255) length safety under extreme inputs", () => {
    const longString = "A".repeat(500);
    const id = deriveStableSourceId({
      platformPrefix: "hk",
      platformId: longString,
      metric: "steps",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 100,
      unit: "count",
      discriminator: longString,
    });

    assert.ok(id.length <= 255);
  });

  it("handles Unicode discriminators and devices without collapsing different scripts into collisions", () => {
    // Two distinct Japanese device models
    const idOmron = deriveStableSourceId({
      platformPrefix: "hc",
      metric: "blood_pressure",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 120,
      unit: "mmHg",
      discriminator: "オムロン_HEM-7600T",
    });

    const idTerumo = deriveStableSourceId({
      platformPrefix: "hc",
      metric: "blood_pressure",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 120,
      unit: "mmHg",
      discriminator: "テルモ_ES-W5200ZZ",
    });

    assert.notStrictEqual(idOmron, idTerumo);

    // Accented European manufacturer
    const idWithings = deriveStableSourceId({
      platformPrefix: "hk",
      metric: "heart_rate",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 68,
      unit: "bpm",
      discriminator: "Withings ScanWatch 2 — Étoile",
    });
    assert.ok(idWithings.startsWith("det_hk_heart_rate_2026-11-03T06_00_00Z_"));
  });

  it("sanitizes delimiter-containing fields without delimiter collision or signature ambiguity", () => {
    // Delimiter injection test: someone puts pipe | in discriminator or unit
    const id1 = deriveStableSourceId({
      platformPrefix: "hc",
      metric: "steps",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 100,
      unit: "count|fake_field",
      discriminator: "valid_disc",
    });

    const id2 = deriveStableSourceId({
      platformPrefix: "hc",
      metric: "steps",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 100,
      unit: "count_fake_field",
      discriminator: "valid_disc",
    });

    // Pipe '|' is replaced by '_' so delimiter injection cannot alter field segmentation
    assert.strictEqual(id1, id2);
  });

  it("handles near-equal numeric values with stable 4-decimal precision", () => {
    // Epsilon noise under 0.0001 (e.g. IEEE 754 precision artifacts)
    const idFloatNoise1 = deriveStableSourceId({
      platformPrefix: "hc",
      metric: "blood_glucose",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 95.50000000001,
      unit: "mg/dL",
    });

    const idFloatNoise2 = deriveStableSourceId({
      platformPrefix: "hc",
      metric: "blood_glucose",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 95.500049,
      unit: "mg/dL",
    });

    // Should produce identical ID preventing float flutter
    assert.strictEqual(idFloatNoise1, idFloatNoise2);

    // Genuine clinical difference (0.01 mg/dL)
    const idDiff = deriveStableSourceId({
      platformPrefix: "hc",
      metric: "blood_glucose",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 95.51,
      unit: "mg/dL",
    });

    assert.notStrictEqual(idFloatNoise1, idDiff);
  });

  it("produces collision-resistant IDs for simultaneous observations across different devices at exact same microsecond", () => {
    const ts = "2026-11-03T08:15:30.123456Z";
    const phoneSteps = deriveStableSourceId({
      platformPrefix: "hk",
      metric: "steps",
      startTime: ts,
      numericValue: 150,
      unit: "count",
      discriminator: "Apple_iPhone15_Pro",
    });

    const watchSteps = deriveStableSourceId({
      platformPrefix: "hk",
      metric: "steps",
      startTime: ts,
      numericValue: 150,
      unit: "count",
      discriminator: "Apple_Watch_Ultra2",
    });

    const ringSteps = deriveStableSourceId({
      platformPrefix: "hk",
      metric: "steps",
      startTime: ts,
      numericValue: 150,
      unit: "count",
      discriminator: "Oura_Ring_Gen3",
    });

    assert.notStrictEqual(phoneSteps, watchSteps);
    assert.notStrictEqual(watchSteps, ringSteps);
    assert.notStrictEqual(phoneSteps, ringSteps);
  });

  it("distinguishes reordered multi-sample observations via sampleIndex", () => {
    const sampleA = {
      platformPrefix: "hc" as const,
      platformId: "series_hr_batch_001",
      metric: "heart_rate",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 72,
      unit: "bpm",
      sampleIndex: 0,
    };

    const sampleB = {
      platformPrefix: "hc" as const,
      platformId: "series_hr_batch_001",
      metric: "heart_rate",
      startTime: "2026-11-03T06:00:00Z",
      numericValue: 72,
      unit: "bpm",
      sampleIndex: 1,
    };

    const idA = deriveStableSourceId(sampleA);
    const idB = deriveStableSourceId(sampleB);

    assert.strictEqual(idA, "hc_series_hr_batch_001_idx0");
    assert.strictEqual(idB, "hc_series_hr_batch_001_idx1");
    assert.notStrictEqual(idA, idB);
  });

  it("preserves deterministic backward compatibility across the old (FNV-1a) and new (SHA-256) identifier transition", () => {
    const observation = {
      platformPrefix: "hc" as const,
      metric: "steps",
      startTime: "2026-11-03T06:00:00Z",
      endTime: "2026-11-03T06:15:00Z",
      numericValue: 500,
      unit: "count",
      discriminator: "google_pixel_watch",
      sampleIndex: 0,
    };

    const oldId = deriveLegacyFnv1aSourceId(observation);
    const newId = deriveStableSourceId(observation);

    // Old ID is FNV-1a (8-char hex)
    assert.ok(isLegacyFnv1aId(oldId));
    assert.strictEqual(oldId.split("_").pop()!.length, 8);

    // New ID is SHA-256 (64-char hex)
    assert.ok(!isLegacyFnv1aId(newId));
    assert.strictEqual(newId.split("_").pop()!.length, 64);

    // Both IDs share the human-readable slug prefix
    const oldPrefix = oldId.substring(0, oldId.lastIndexOf("_"));
    const newPrefix = newId.substring(0, newId.lastIndexOf("_"));
    assert.strictEqual(oldPrefix, newPrefix);
    assert.strictEqual(oldPrefix, "det_hc_steps_2026-11-03T06_00_00Z");
  });

  it("demonstrates zero collisions across 1,000 distinct observation signatures", () => {
    const seen = new Set<string>();
    const count = 1000;
    for (let i = 0; i < count; i++) {
      const id = deriveStableSourceId({
        platformPrefix: "hc",
        metric: "heart_rate",
        startTime: `2026-11-03T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z`,
        numericValue: 60 + (i % 80),
        unit: "bpm",
        sampleIndex: i,
      });
      assert.strictEqual(seen.has(id), false, `Collision detected at index ${i}: ${id}`);
      seen.add(id);
    }
    assert.strictEqual(seen.size, count);
  });
});
