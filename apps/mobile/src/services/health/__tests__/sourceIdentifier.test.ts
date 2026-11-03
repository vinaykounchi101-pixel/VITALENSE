/**
 * Unit regression tests for Collision-Resistant, Deterministic Health Source Identifiers.
 * Tests idempotency, collision resistance, deterministic stability, and length constraints.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveStableSourceId, fnv1aHex } from "../sourceIdentifier.ts";

describe("Health Source Identifiers — Idempotency & Collision Resistance", () => {
  it("computes deterministic FNV-1a hash consistently", () => {
    const str = "heart_rate|2026-11-03T06:00:00Z||72.0000|bpm||";
    const hash1 = fnv1aHex(str);
    const hash2 = fnv1aHex(str);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 8);
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

    // Identical BPM in same parent record must produce DISTINCT IDs
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

    // Same timestamp, different BPM must NOT collide
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
});

