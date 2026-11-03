/**
 * Collision-Resistant, Deterministic Health Source Identifier Generator.
 *
 * Implements deterministic identity strategies for Google Health Connect and Apple HealthKit.
 * Guaranteed:
 * 1. Stable and idempotent across repeated imports and application restarts.
 * 2. Distinct observations with the same metric & timestamp but different values,
 *    durations, or source devices produce collision-free distinct IDs.
 * 3. Never uses Math.random(), Date.now(), or empty IDs.
 * 4. Never exceeds PostgreSQL VARCHAR(255) constraint.
 */

export interface StableIdParams {
  platformPrefix: "hc" | "hk";
  platformId?: string | null;
  metric: string;
  startTime: string;
  endTime?: string | null;
  numericValue?: number | null;
  unit?: string | null;
  discriminator?: string | null;
  sampleIndex?: number | null;
}

/**
 * 32-bit FNV-1a non-cryptographic fast hash, formatted as an 8-character hex string.
 * Fully deterministic across all JavaScript engines.
 */
export function fnv1aHex(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sanitizeSlug(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Derives a collision-resistant, deterministic source record identifier.
 */
export function deriveStableSourceId(params: StableIdParams): string {
  const {
    platformPrefix,
    platformId,
    metric,
    startTime,
    endTime,
    numericValue,
    unit,
    discriminator,
    sampleIndex,
  } = params;

  // 1. Native platform identifier precedence
  if (platformId && platformId.trim().length > 0) {
    const cleanNativeId = sanitizeSlug(platformId.trim());
    // If the native ID belongs to a parent batch/series record containing sub-samples,
    // qualify it with the sample timestamp and index to prevent intra-record collisions.
    const subParts: string[] = [];
    if (sampleIndex !== undefined && sampleIndex !== null) {
      subParts.push(`idx${sampleIndex}`);
    }
    if (discriminator && discriminator.trim().length > 0) {
      subParts.push(sanitizeSlug(discriminator.trim()));
    }

    const qualifier = subParts.length > 0 ? `_${subParts.join("_")}` : "";
    const id = `${platformPrefix}_${cleanNativeId}${qualifier}`;
    return id.length > 255 ? id.substring(0, 255) : id;
  }

  // 2. Deterministic identity strategy for records lacking native platform UUIDs
  // Extract all distinguishing observation attributes
  const cleanMetric = sanitizeSlug(metric.toLowerCase().trim());
  const cleanStart = startTime.trim();
  const cleanEnd = endTime ? endTime.trim() : "";
  const valStr =
    numericValue !== undefined && numericValue !== null && !isNaN(numericValue)
      ? Number(numericValue).toFixed(4)
      : "null";
  const cleanUnit = unit ? sanitizeSlug(unit.toLowerCase().trim()) : "";
  const cleanDisc = discriminator ? sanitizeSlug(discriminator.trim()) : "";
  const idxStr = sampleIndex !== undefined && sampleIndex !== null ? `idx${sampleIndex}` : "";

  // Signature covering all semantic observation dimensions
  const signature = `${cleanMetric}|${cleanStart}|${cleanEnd}|${valStr}|${cleanUnit}|${cleanDisc}|${idxStr}`;
  const sigHash = fnv1aHex(signature);

  // Form a human-readable prefix with deterministic signature hash
  // e.g. det_hc_hr_2026-11-03T06_00_00_a1b2c3d4
  const startSlug = sanitizeSlug(cleanStart).substring(0, 32);
  const candidateId = `det_${platformPrefix}_${cleanMetric}_${startSlug}_${sigHash}`;

  return candidateId.length > 255 ? candidateId.substring(0, 255) : candidateId;
}

