/**
 * Schema-agnostic structural fingerprint.
 *
 * Two backends:
 *  - "node" (default): SHA-256 prefix over canonical-JSON of the record
 *    fields, weighted by per-field entropy. Pure Node, no external calls.
 *    Honest, deterministic, fast.
 *  - "btut" (when BTUT_BRIDGE_URL is set): HTTP-bridges to the FastAPI
 *    backend container which runs the real Python BTUT pipeline
 *    (run_btut_pipeline) and returns true 48-bit lattice fingerprints
 *    plus survivor scoring.
 *
 * Both backends emit Fingerprint objects with the same shape so callers
 * never branch on which one is active.
 */

import crypto from "node:crypto";
import type { RangeRecord, Schema } from "./adapter";

export type Fingerprint = {
  recordIdx: number;
  fp48: bigint;        // 48-bit structural fingerprint
  fp48Hex: string;     // hex string for display
  rawHash: string;     // sha256 over canonical bytes
  contributingFields: string[]; // top fields contributing to this fingerprint
};

export type FingerprinterMode = "node" | "btut";

export type FingerprinterStats = {
  mode: FingerprinterMode;
  recordsProcessed: number;
  totalMs: number;
  meanFingerprintBits?: number;
  fieldEntropy: Record<string, number>;
  bridgeUrl?: string;
};

export interface Fingerprinter {
  mode: FingerprinterMode;
  fingerprint(rec: RangeRecord): Promise<Fingerprint>;
  fingerprintBatch(records: RangeRecord[]): Promise<Fingerprint[]>;
  stats(): FingerprinterStats;
}

// ---------- Node-only fingerprinter (default) ----------

export class NodeFingerprinter implements Fingerprinter {
  readonly mode: FingerprinterMode = "node";
  private records = 0;
  private totalMs = 0;
  private fieldEntropy: Record<string, number> = {};

  constructor(private schema: Schema) {
    this.computeFieldEntropy();
  }

  // Approximate field entropy from the schema's nonEmptyShare. A rough
  // proxy: fields with high non-empty share + many distinct values
  // contribute more. Without scanning the full corpus we use schema
  // metadata as the prior; recompute on a sample if needed.
  private computeFieldEntropy() {
    for (const f of this.schema.fields) {
      // Crude entropy proxy in [0,1]: scale by non-empty share and
      // give object/array fields more weight (they carry more info).
      const typeWeight = ({
        string: 1.0, number: 0.7, object: 1.2, array: 1.2, boolean: 0.3, null: 0.1,
      } as Record<string, number>)[f.sampleType] ?? 1.0;
      this.fieldEntropy[f.name] = Math.min(1.5, f.nonEmptyShare * typeWeight);
    }
  }

  async fingerprint(rec: RangeRecord): Promise<Fingerprint> {
    const t0 = Date.now();
    const fp = this.computeOne(rec);
    this.records++;
    this.totalMs += Date.now() - t0;
    return fp;
  }

  async fingerprintBatch(records: RangeRecord[]): Promise<Fingerprint[]> {
    const t0 = Date.now();
    const out = records.map((r) => this.computeOne(r));
    this.records += records.length;
    this.totalMs += Date.now() - t0;
    return out;
  }

  private computeOne(rec: RangeRecord): Fingerprint {
    // Build canonical-JSON of the record's fields, weighted by per-field
    // entropy. Higher-entropy fields are repeated proportionally so they
    // dominate the SHA-256 prefix.
    const fields = (typeof rec.fields === "object") ? rec.fields as Record<string, unknown> : { value: rec.fields };
    const keys = Object.keys(fields).sort();
    const contributing: string[] = [];

    let canonical = "";
    for (const k of keys) {
      const v = fields[k];
      if (v === null || v === undefined || v === "") continue;
      const w = this.fieldEntropy[k] ?? 0.5;
      const weight = Math.max(1, Math.round(w * 4)); // 1..6 repeats
      const piece = `${k}=${stableStringify(v)}`;
      for (let i = 0; i < weight; i++) canonical += piece + "|";
      if (contributing.length < 3 && w > 0.5) contributing.push(k);
    }
    if (canonical.length === 0) canonical = rec.raw;

    const rawHash = sha256Hex(rec.raw);
    const weightedHash = sha256Hex(canonical);
    const fp48Hex = weightedHash.slice(0, 12);
    const fp48 = BigInt("0x" + fp48Hex);

    return { recordIdx: rec.idx, fp48, fp48Hex, rawHash, contributingFields: contributing };
  }

  stats(): FingerprinterStats {
    return {
      mode: this.mode,
      recordsProcessed: this.records,
      totalMs: this.totalMs,
      meanFingerprintBits: 48,
      fieldEntropy: this.fieldEntropy,
    };
  }
}

// ---------- BTUT bridge (HTTP to backend Python) ----------

export class BtutBridgeFingerprinter implements Fingerprinter {
  readonly mode: FingerprinterMode = "btut";
  private records = 0;
  private totalMs = 0;
  private fieldEntropy: Record<string, number> = {};

  constructor(private schema: Schema, private bridgeUrl: string) {}

  async fingerprint(rec: RangeRecord): Promise<Fingerprint> {
    const out = await this.fingerprintBatch([rec]);
    return out[0];
  }

  async fingerprintBatch(records: RangeRecord[]): Promise<Fingerprint[]> {
    const t0 = Date.now();
    // Convert records to BTUT-pipeline input shape: entities + edges.
    const entities = records.map((r) => ({
      name: `r${r.idx}`,
      type: "record",
      attributes: typeof r.fields === "object" ? (r.fields as Record<string, unknown>) : { value: r.fields },
    }));
    const body = JSON.stringify({
      entities,
      edges: [],
      target_survivors: Math.min(300, Math.max(10, Math.floor(records.length * 0.2))),
      n_rotations: 16,
    });

    let res: Response;
    try {
      res = await fetch(`${this.bridgeUrl}/api/v1/range/form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (e) {
      throw new BtutBridgeUnavailable(`Could not reach BTUT bridge at ${this.bridgeUrl}: ${e}`);
    }
    if (!res.ok) {
      throw new BtutBridgeUnavailable(`BTUT bridge HTTP ${res.status}`);
    }
    const data = (await res.json()) as { fingerprints: { idx: number; fp48Hex: string; rawHash: string; contributing: string[] }[] };
    const out = data.fingerprints.map((d) => ({
      recordIdx: d.idx,
      fp48Hex: d.fp48Hex,
      fp48: BigInt("0x" + d.fp48Hex),
      rawHash: d.rawHash,
      contributingFields: d.contributing ?? [],
    }));
    this.records += out.length;
    this.totalMs += Date.now() - t0;
    return out;
  }

  stats(): FingerprinterStats {
    return {
      mode: this.mode,
      recordsProcessed: this.records,
      totalMs: this.totalMs,
      meanFingerprintBits: 48,
      fieldEntropy: this.fieldEntropy,
      bridgeUrl: this.bridgeUrl,
    };
  }
}

export class BtutBridgeUnavailable extends Error {}

// ---------- Factory ----------

/**
 * Build the best-available fingerprinter for the current process.
 * Reads BTUT_BRIDGE_URL from env. If set, attempts an HTTP probe; on
 * success returns BtutBridgeFingerprinter, otherwise NodeFingerprinter
 * with a clear stats indicator.
 */
export async function buildFingerprinter(schema: Schema): Promise<Fingerprinter> {
  const bridgeUrl = process.env.BTUT_BRIDGE_URL;
  if (!bridgeUrl) return new NodeFingerprinter(schema);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${bridgeUrl}/api/v1/range/form/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) return new BtutBridgeFingerprinter(schema, bridgeUrl);
  } catch { /* fall through */ }
  return new NodeFingerprinter(schema);
}

// ---------- Helpers ----------

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function stableStringify(v: unknown): string {
  if (v === null) return "null";
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

export function hammingDist48(a: bigint, b: bigint): number {
  let x = a ^ b;
  let c = 0;
  while (x) { x &= x - 1n; c++; }
  return c;
}
