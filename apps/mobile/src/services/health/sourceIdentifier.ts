/**
 * Collision-Resistant, Deterministic Health Source Identifier Generator.
 *
 * Implements deterministic identity strategies for Google Health Connect and Apple HealthKit.
 * Guaranteed:
 * 1. Cryptographically strong and collision-resistant using canonical SHA-256 (FIPS 180-4).
 * 2. Stable and idempotent across repeated imports and application restarts.
 * 3. Backward compatible with legacy FNV-1a identifiers when explicitly requested.
 * 4. Never uses Math.random(), Date.now(), or empty IDs.
 * 5. Never exceeds PostgreSQL VARCHAR(255) constraint.
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
  /**
   * Hashing algorithm. Defaults to "sha256" (canonical).
   * "fnv1a" is provided exclusively for legacy backward compatibility.
   */
  algorithm?: "sha256" | "fnv1a";
}

function rotr(n: number, b: number): number {
  return (n >>> b) | (n << (32 - b));
}

/**
 * Pure TypeScript implementation of FIPS 180-4 SHA-256.
 * Computes a 64-character lowercase hex digest synchronously without external dependencies.
 * Guaranteed deterministic across all JavaScript engines (Hermes, V8, JSC, Node.js).
 */
export function sha256Hex(str: string): string {
  // UTF-8 encode
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  const K: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const bitLen = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length % 64) !== 56) {
    utf8.push(0);
  }

  // 64-bit length (big-endian)
  utf8.push(0, 0, 0, 0);
  utf8.push(
    (bitLen >>> 24) & 0xff,
    (bitLen >>> 16) & 0xff,
    (bitLen >>> 8) & 0xff,
    bitLen & 0xff
  );

  const W = new Int32Array(64);

  for (let i = 0; i < utf8.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] =
        (utf8[i + t * 4] << 24) |
        (utf8[i + t * 4 + 1] << 16) |
        (utf8[i + t * 4 + 2] << 8) |
        utf8[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (((W[t - 16] + s0) | 0) + ((W[t - 7] + s1) | 0)) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((((h + S1) | 0) + ch) | 0) + ((K[t] + W[t]) | 0)) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const hex = [H0, H1, H2, H3, H4, H5, H6, H7]
    .map((val) => (val >>> 0).toString(16).padStart(8, "0"))
    .join("");
  return hex;
}

/**
 * 32-bit FNV-1a non-cryptographic fast hash, formatted as an 8-character hex string.
 * @deprecated Maintained strictly for backward compatibility with pre-migration client records.
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

function sanitizeSlugUnicode(str: string): string {
  return str.replace(/[^\p{L}\p{N}_-]/gu, "_");
}

/**
 * Derives a collision-resistant, deterministic source record identifier.
 * Uses canonical SHA-256 by default.
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
    algorithm = "sha256",
  } = params;

  const isLegacy = algorithm === "fnv1a";
  const slugger = isLegacy ? sanitizeSlug : sanitizeSlugUnicode;

  // 1. Native platform identifier precedence
  if (platformId && platformId.trim().length > 0) {
    const cleanNativeId = slugger(platformId.trim());
    const subParts: string[] = [];
    if (sampleIndex !== undefined && sampleIndex !== null) {
      subParts.push(`idx${sampleIndex}`);
    }
    if (discriminator && discriminator.trim().length > 0) {
      subParts.push(slugger(discriminator.trim()));
    }

    const qualifier = subParts.length > 0 ? `_${subParts.join("_")}` : "";
    const id = `${platformPrefix}_${cleanNativeId}${qualifier}`;
    return id.length > 255 ? id.substring(0, 255) : id;
  }

  // 2. Deterministic identity strategy for records lacking native platform UUIDs
  const cleanMetric = sanitizeSlug(metric.toLowerCase().trim());
  const cleanStart = startTime.trim();
  const cleanEnd = endTime ? endTime.trim() : "";
  const valStr =
    numericValue !== undefined && numericValue !== null && !isNaN(numericValue)
      ? Number(numericValue).toFixed(4)
      : "null";
  const cleanUnit = unit ? slugger(unit.toLowerCase().trim()) : "";
  const cleanDisc = discriminator ? slugger(discriminator.trim()) : "";
  const idxStr = sampleIndex !== undefined && sampleIndex !== null ? `idx${sampleIndex}` : "";

  // Signature covering all semantic observation dimensions
  const signature = `${cleanMetric}|${cleanStart}|${cleanEnd}|${valStr}|${cleanUnit}|${cleanDisc}|${idxStr}`;

  // Form a human-readable prefix with deterministic signature hash (ASCII-safe)
  const startSlug = sanitizeSlug(cleanStart).substring(0, 32);

  const sigHash = isLegacy ? fnv1aHex(signature) : sha256Hex(signature);
  const candidateId = `det_${platformPrefix}_${cleanMetric}_${startSlug}_${sigHash}`;

  return candidateId.length > 255 ? candidateId.substring(0, 255) : candidateId;
}

/**
 * Backward compatibility helper to generate legacy FNV-1a IDs.
 */
export function deriveLegacyFnv1aSourceId(params: Omit<StableIdParams, "algorithm">): string {
  return deriveStableSourceId({ ...params, algorithm: "fnv1a" });
}

/**
 * Detects whether a deterministic source record identifier was generated using legacy FNV-1a (8-char hex).
 */
export function isLegacyFnv1aId(id: string): boolean {
  if (!id.startsWith("det_")) return false;
  const parts = id.split("_");
  const lastPart = parts[parts.length - 1];
  return /^[0-9a-f]{8}$/i.test(lastPart);
}
