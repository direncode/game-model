/**
 * Streaming fingerprint — the universal primitive adapted for per-record
 * online scoring.
 *
 * This is intentionally simpler than the full BTUT engine in `lo_core/`:
 * the full engine runs iterated rotation ensembles on a bounded corpus.
 * The streaming variant here compresses that idea into one pass so it
 * can run inside a Next.js API route against a live feed:
 *
 *   fingerprint48(record)   → 48-bit stable fingerprint
 *   anomalyScore(fp, hist)  → {anomaly, composite, reconstruction, diversity}
 *
 * Same score dimensions as BTUT, same composite weighting:
 *     composite = 0.40·reconstruction + 0.35·diversity + 0.25·anomaly
 *
 * Determinism: seed is fixed; same attrs + same history → same scores.
 *
 * What it is NOT: a drop-in replacement for the full BTUT engine on a
 * bounded corpus. The full engine is what produces the cached JSON the
 * rest of the system validates against.
 */

import { createHash } from "crypto";

function h32(s: string): number {
  const b = createHash("sha256").update(s).digest();
  return b.readUInt32BE(0);
}

/** 48-bit fingerprint as '0'/'1' string, derived from attribute hash rotations. */
export function fingerprint48(
  attrs: Record<string, unknown>,
  seed = 42,
): string {
  const keys = Object.keys(attrs).sort();
  const json = JSON.stringify(attrs, keys);
  const bits: string[] = [];
  for (let i = 0; i < 48; i++) {
    const v = h32(`${seed}:${i}:${json}`);
    bits.push(((v ^ (v >>> 7) ^ (v >>> 13)) & 1).toString());
  }
  return bits.join("");
}

/** Hamming distance between two equal-length '0'/'1' strings. */
export function hamming(a: string, b: string): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

export type Scores = {
  composite: number;
  anomaly: number;
  reconstruction: number;
  diversity: number;
};

/**
 * Score a fingerprint against a recent-history window.
 *
 * - anomaly        → isolation: min-Hamming to any history fingerprint, normalized
 * - reconstruction → information content: |ones| distance from the coin-flip mean
 * - diversity      → per-bit entropy across history at this fingerprint's ones
 * - composite      → 0.40 reconstruction + 0.35 diversity + 0.25 anomaly
 *
 * All scores ∈ [0, 1]. If history is empty, returns 1.0s (neutral).
 */
export function anomalyScore(fp: string, history: string[]): Scores {
  const L = fp.length;
  if (history.length === 0) {
    return { anomaly: 1.0, composite: 1.0, reconstruction: 1.0, diversity: 1.0 };
  }

  // anomaly = isolation vs nearest neighbour, linear in Hamming/L
  let minHam = L;
  for (const h of history) {
    const d = hamming(fp, h);
    if (d < minHam) minHam = d;
  }
  const anomaly = minHam / L;

  // reconstruction = information content; maximal near |ones| = L/2
  const ones = (fp.match(/1/g) || []).length;
  const reconstruction = 1 - (Math.abs(ones - L / 2) * 2) / L;

  // diversity = per-bit-position entropy across window at fp's on-bits
  const ON = new Array(L).fill(0);
  const COUNT = Math.min(history.length, 200);
  const win = history.slice(-COUNT);
  for (const h of win) for (let i = 0; i < L; i++) if (h[i] === "1") ON[i]++;
  let entropyAcc = 0;
  let considered = 0;
  for (let i = 0; i < L; i++) {
    if (fp[i] !== "1") continue;
    const p = ON[i] / Math.max(1, COUNT);
    if (p <= 0 || p >= 1) continue;
    entropyAcc += -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
    considered++;
  }
  const diversity = considered ? entropyAcc / considered : 0;

  const composite =
    0.40 * reconstruction + 0.35 * diversity + 0.25 * anomaly;

  return { anomaly, composite, reconstruction, diversity };
}

/**
 * Per-process in-memory history, keyed by stream id ("quakes" / "crypto"
 * / "edgar"). Survives across API invocations within the same node worker;
 * reset on cold start. Good enough for a demo, not for production.
 */
const HISTORY = new Map<string, string[]>();
const MAX = 400;

export function pushHistory(streamId: string, fp: string): void {
  const h = HISTORY.get(streamId) ?? [];
  h.push(fp);
  if (h.length > MAX) h.splice(0, h.length - MAX);
  HISTORY.set(streamId, h);
}

export function getHistory(streamId: string): string[] {
  return HISTORY.get(streamId) ?? [];
}

export function historySize(streamId: string): number {
  return HISTORY.get(streamId)?.length ?? 0;
}
