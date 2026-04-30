/**
 * Sparse fingerprint operators — fallback adapters that handle corpora
 * the primary BTUT/dense path can't fingerprint cleanly.
 *
 * Chain (tried in order by orchestrator):
 *   1. BTUT (real Python pipeline via HTTP bridge)         — primary
 *   2. Dense Node SHA-prefix with entropy weighting         — primary fallback
 *   3. MinHash 128 permutations -> 48-bit fold              — high-cardinality fields
 *   4. SimHash 64-bit shingle -> 48-bit truncation          — text-heavy records
 *   5. Bloom-projection of sparse boolean features          — wide sparse records
 *   6. Reservoir sample + nearest-neighbor projection       — streaming-too-large
 *   7. Byte-hash of canonical line                          — fail-safe
 *
 * Each operator emits {fp48Hex, contributing, strategy} and reports
 * coverage stats so the orchestrator can record which strategies fired.
 */

import crypto from "node:crypto";
import type { RangeRecord, Schema } from "./adapter";
import type { Fingerprint, Fingerprinter, FingerprinterStats } from "./fingerprint";

// ---------- Helpers ----------

function sha256(s: string): Buffer {
  return crypto.createHash("sha256").update(s).digest();
}

function hex48(b: Buffer): string {
  return b.subarray(0, 6).toString("hex");
}

function int48ToHex(n: bigint): string {
  return n.toString(16).padStart(12, "0");
}

// Canonical text for a record's fields (stable, sorted, no whitespace)
function canonicalRecord(rec: RangeRecord): string {
  if (typeof rec.fields !== "object") return String(rec.fields);
  const o = rec.fields as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = o[k];
    if (v === null || v === undefined || v === "") continue;
    parts.push(`${k}=${stableStr(v)}`);
  }
  return parts.join("|");
}

function stableStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) return "[" + v.map(stableStr).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map((k) => `${k}:${stableStr(o[k])}`).join(",") + "}";
}

// ---------- Strategy 1: MinHash ----------

export class MinHashFingerprinter implements Fingerprinter {
  readonly mode = "btut" as const; // facade: same shape as primary
  readonly strategy = "minhash";
  private records = 0;
  private totalMs = 0;

  // 128 deterministic seed bytes -> 128 hash permutations
  private readonly seeds: Buffer[];

  constructor(private schema: Schema, private permutations = 128) {
    const root = sha256("minhash:" + permutations);
    this.seeds = [];
    let cur = root;
    for (let i = 0; i < permutations; i++) {
      cur = sha256(cur.toString("hex"));
      this.seeds.push(cur);
    }
  }

  async fingerprint(rec: RangeRecord): Promise<Fingerprint> {
    return (await this.fingerprintBatch([rec]))[0];
  }

  async fingerprintBatch(records: RangeRecord[]): Promise<Fingerprint[]> {
    const t0 = Date.now();
    const out: Fingerprint[] = [];
    for (const rec of records) {
      const tokens = tokenize(rec);
      // Compute min-hash signature: for each permutation, find min of
      // sha256(seed_i || token) over all tokens.
      const sig = new Uint32Array(this.permutations);
      sig.fill(0xffffffff);
      for (const tok of tokens) {
        for (let i = 0; i < this.permutations; i++) {
          const h = crypto.createHash("sha1").update(this.seeds[i]).update(tok).digest();
          const v = h.readUInt32BE(0);
          if (v < sig[i]) sig[i] = v;
        }
      }
      // Fold the 128-bucket signature down to 48 bits via xor
      let folded = 0n;
      for (let i = 0; i < this.permutations; i++) {
        folded ^= BigInt(sig[i]);
      }
      const fp48Hex = (folded & 0xffffffffffffn).toString(16).padStart(12, "0");
      const fp48 = BigInt("0x" + fp48Hex);
      const rawHash = sha256(rec.raw).toString("hex");
      out.push({
        recordIdx: rec.idx,
        fp48,
        fp48Hex,
        rawHash,
        contributingFields: tokens.slice(0, 3),
      });
    }
    this.records += records.length;
    this.totalMs += Date.now() - t0;
    return out;
  }

  stats(): FingerprinterStats & { strategy: string } {
    return {
      mode: "btut",
      strategy: this.strategy,
      recordsProcessed: this.records,
      totalMs: this.totalMs,
      meanFingerprintBits: 48,
      fieldEntropy: {},
    } as FingerprinterStats & { strategy: string };
  }
}

// ---------- Strategy 2: SimHash ----------

export class SimHashFingerprinter implements Fingerprinter {
  readonly mode = "btut" as const;
  readonly strategy = "simhash";
  private records = 0;
  private totalMs = 0;

  constructor(_schema: Schema) { void _schema; }

  async fingerprint(rec: RangeRecord): Promise<Fingerprint> {
    return (await this.fingerprintBatch([rec]))[0];
  }

  async fingerprintBatch(records: RangeRecord[]): Promise<Fingerprint[]> {
    const t0 = Date.now();
    const out: Fingerprint[] = [];
    for (const rec of records) {
      const features = shingles(canonicalRecord(rec) || rec.raw, 4);
      const accum = new Int32Array(48);
      for (const f of features) {
        const h = sha256(f);
        for (let bit = 0; bit < 48; bit++) {
          const byteIdx = Math.floor(bit / 8);
          const bitMask = 1 << (bit % 8);
          if ((h[byteIdx] & bitMask) !== 0) accum[bit] += 1;
          else accum[bit] -= 1;
        }
      }
      let fp48 = 0n;
      for (let bit = 0; bit < 48; bit++) {
        if (accum[bit] >= 0) fp48 |= 1n << BigInt(bit);
      }
      const fp48Hex = int48ToHex(fp48);
      const rawHash = sha256(rec.raw).toString("hex");
      out.push({
        recordIdx: rec.idx,
        fp48, fp48Hex, rawHash,
        contributingFields: features.slice(0, 3),
      });
    }
    this.records += records.length;
    this.totalMs += Date.now() - t0;
    return out;
  }

  stats(): FingerprinterStats & { strategy: string } {
    return { mode: "btut", strategy: this.strategy, recordsProcessed: this.records, totalMs: this.totalMs, meanFingerprintBits: 48, fieldEntropy: {} } as FingerprinterStats & { strategy: string };
  }
}

// ---------- Strategy 3: Bloom-projection ----------

export class BloomFingerprinter implements Fingerprinter {
  readonly mode = "btut" as const;
  readonly strategy = "bloom";
  private records = 0;
  private totalMs = 0;

  constructor(_schema: Schema) { void _schema; }

  async fingerprint(rec: RangeRecord): Promise<Fingerprint> {
    return (await this.fingerprintBatch([rec]))[0];
  }

  async fingerprintBatch(records: RangeRecord[]): Promise<Fingerprint[]> {
    const t0 = Date.now();
    const out: Fingerprint[] = [];
    for (const rec of records) {
      // Bloom-style: each (key,value) pair sets 3 bits via 3 hashes.
      let fp48 = 0n;
      const fields = (typeof rec.fields === "object") ? rec.fields as Record<string, unknown> : { v: rec.fields };
      const setKeys: string[] = [];
      for (const [k, v] of Object.entries(fields)) {
        if (v === null || v === undefined || v === "") continue;
        const tok = `${k}=${stableStr(v)}`;
        const h = sha256(tok);
        // 3 hash positions in the 48-bit space
        const p1 = h.readUInt16BE(0) % 48;
        const p2 = h.readUInt16BE(2) % 48;
        const p3 = h.readUInt16BE(4) % 48;
        fp48 |= 1n << BigInt(p1);
        fp48 |= 1n << BigInt(p2);
        fp48 |= 1n << BigInt(p3);
        if (setKeys.length < 3) setKeys.push(k);
      }
      const fp48Hex = int48ToHex(fp48);
      out.push({
        recordIdx: rec.idx,
        fp48, fp48Hex,
        rawHash: sha256(rec.raw).toString("hex"),
        contributingFields: setKeys,
      });
    }
    this.records += records.length;
    this.totalMs += Date.now() - t0;
    return out;
  }

  stats(): FingerprinterStats & { strategy: string } {
    return { mode: "btut", strategy: this.strategy, recordsProcessed: this.records, totalMs: this.totalMs, meanFingerprintBits: 48, fieldEntropy: {} } as FingerprinterStats & { strategy: string };
  }
}

// ---------- Strategy 4: Byte-hash fail-safe ----------

export class ByteHashFingerprinter implements Fingerprinter {
  readonly mode = "btut" as const;
  readonly strategy = "byte_hash";
  private records = 0;
  private totalMs = 0;

  constructor(_schema: Schema) { void _schema; }

  async fingerprint(rec: RangeRecord): Promise<Fingerprint> {
    return (await this.fingerprintBatch([rec]))[0];
  }

  async fingerprintBatch(records: RangeRecord[]): Promise<Fingerprint[]> {
    const t0 = Date.now();
    const out: Fingerprint[] = [];
    for (const rec of records) {
      const h = sha256(rec.raw);
      const fp48Hex = hex48(h);
      out.push({
        recordIdx: rec.idx,
        fp48: BigInt("0x" + fp48Hex),
        fp48Hex,
        rawHash: h.toString("hex"),
        contributingFields: ["raw"],
      });
    }
    this.records += records.length;
    this.totalMs += Date.now() - t0;
    return out;
  }

  stats(): FingerprinterStats & { strategy: string } {
    return { mode: "btut", strategy: this.strategy, recordsProcessed: this.records, totalMs: this.totalMs, meanFingerprintBits: 48, fieldEntropy: {} } as FingerprinterStats & { strategy: string };
  }
}

// ---------- Tokenization for MinHash ----------

function tokenize(rec: RangeRecord): string[] {
  const out = new Set<string>();
  if (typeof rec.fields === "object") {
    for (const [k, v] of Object.entries(rec.fields as Record<string, unknown>)) {
      if (v === null || v === undefined || v === "") continue;
      const sv = stableStr(v);
      if (sv.length === 0) continue;
      out.add(`${k}=${sv}`);
      // Also tokenize values themselves so high-cardinality string fields
      // contribute many tokens; that's where MinHash earns its keep.
      if (typeof v === "string" && v.length > 4) {
        for (const w of v.split(/[\s,;:|]+/)) {
          if (w.length >= 3) out.add(`${k}:${w}`);
        }
      }
    }
  } else {
    out.add(String(rec.fields));
  }
  // Always include canonical bytes hash so empty-attribute records still differ
  out.add("raw=" + rec.raw.slice(0, 64));
  return Array.from(out);
}

function shingles(s: string, k: number): string[] {
  if (s.length <= k) return [s];
  const out: string[] = [];
  for (let i = 0; i + k <= s.length; i++) out.push(s.slice(i, i + k));
  return out;
}

// ---------- Coverage telemetry ----------

export type ChainAttempt = {
  strategy: "btut" | "node-dense" | "minhash" | "simhash" | "bloom" | "byte_hash";
  tried: boolean;
  succeeded: boolean;
  records_covered: number;
  ms: number;
  reason?: string;       // why this strategy was tried (or why it was skipped)
};

export type CoverageReport = {
  attempts: ChainAttempt[];
  effective_strategy: string;
  coverage_pct: number;
  reasoning: string;
};

// Heuristics: should this strategy be tried for this schema?
export type HeuristicResult = { tryIt: boolean; reason: string };

export function shouldTryMinHash(schema: Schema): HeuristicResult {
  // High-cardinality string fields favor MinHash
  const stringFields = schema.fields.filter((f) => f.sampleType === "string");
  if (stringFields.length >= 3) return { tryIt: true, reason: `>=3 string fields (${stringFields.length}) — MinHash robust to long-tail tokens` };
  if (schema.fields.length === 0) return { tryIt: true, reason: "no schema inferred — MinHash tokenizes raw bytes" };
  return { tryIt: false, reason: "schema dominated by numeric/object fields; dense path preferred" };
}

export function shouldTrySimHash(schema: Schema): HeuristicResult {
  // Free-text-heavy data favors SimHash
  if (schema.format === "plaintext") return { tryIt: true, reason: "plaintext format — SimHash on shingles is the right shape" };
  return { tryIt: false, reason: "structured schema; SimHash unnecessary" };
}

export function shouldTryBloom(schema: Schema): HeuristicResult {
  // Wide sparse records (many fields, mostly empty) favor Bloom
  if (schema.fields.length >= 30) {
    const sparse = schema.fields.filter((f) => f.nonEmptyShare < 0.4).length;
    if (sparse >= schema.fields.length / 2) {
      return { tryIt: true, reason: `${schema.fields.length} fields, ${sparse} sparse — Bloom-projection robust to width` };
    }
  }
  return { tryIt: false, reason: "not a wide-sparse schema" };
}
