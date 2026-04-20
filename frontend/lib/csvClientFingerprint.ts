/**
 * Client-side CSV ingestion + fingerprinting.
 *
 * The whole point of /start is: a non-technical user drops a CSV into
 * the browser, sees their data re-ranked within seconds, and never has
 * the file leave their device. No upload, no server round-trip, no
 * login. The 48-bit fingerprint primitive runs here in the browser
 * using Web Crypto + the same math as the server-side primitive.
 *
 * This file is the whole ingest pipeline:
 *   parseCSV       → lightweight CSV-to-rows, handles quoted fields
 *   fingerprint48  → deterministic 48-bit, seed=42, Web-Crypto SHA-256
 *   scoreRows      → same 4-dim score vector as the server primitive
 */

const SEED = 42;

export type Row = Record<string, string | number | boolean | null>;
export type Scored = Row & {
  _fp: string;
  _composite: number;
  _anomaly: number;
  _reconstruction: number;
  _diversity: number;
};

// ─── CSV parser (no dependency) ──────────────────────────────────────
export function parseCSV(text: string): Row[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = splitLine(lines[0]);
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.length === 0) continue;
    const row: Row = {};
    for (let j = 0; j < header.length; j++) {
      const raw = (cells[j] ?? "").trim();
      // Auto-coerce numbers + booleans; otherwise keep as string
      if (raw === "") row[header[j]] = null;
      else if (raw === "true" || raw === "True") row[header[j]] = true;
      else if (raw === "false" || raw === "False") row[header[j]] = false;
      else if (/^-?\d+(\.\d+)?$/.test(raw)) row[header[j]] = Number(raw);
      else row[header[j]] = raw;
    }
    rows.push(row);
  }
  return rows;
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === "," && !inQuote) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// ─── Canonical-JSON serializer ─────────────────────────────────────
function canonicalJSON(obj: Row): string {
  const keys = Object.keys(obj).sort();
  const o: Row = {};
  for (const k of keys) o[k] = obj[k];
  return JSON.stringify(o);
}

async function sha256(msg: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(msg));
  return new Uint8Array(buf);
}

export async function fingerprint48(row: Row): Promise<string> {
  const payload = canonicalJSON(row);
  const bits: string[] = [];
  for (let i = 0; i < 48; i++) {
    const digest = await sha256(`${SEED}:${i}:${payload}`);
    // Take first 4 bytes as uint32, XOR a couple of rotations, parity bit
    const v = (digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3];
    bits.push(((v ^ (v >>> 7) ^ (v >>> 13)) & 1).toString());
  }
  return bits.join("");
}

function hamming(a: string, b: string): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

// ─── Full scorer ────────────────────────────────────────────────────
export async function scoreRows(
  rows: Row[],
  onProgress?: (pct: number) => void,
): Promise<Scored[]> {
  // Stage 1: fingerprint all rows
  const fps: string[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    fps[i] = await fingerprint48(rows[i]);
    if (onProgress && i % 50 === 0) onProgress(Math.round((i / rows.length) * 50));
  }

  // Stage 2: per-bit on-counts for diversity
  const ON = new Array(48).fill(0);
  for (const fp of fps) {
    for (let b = 0; b < 48; b++) if (fp[b] === "1") ON[b]++;
  }
  const n = rows.length;

  // Stage 3: score each row
  const out: Scored[] = [];
  for (let i = 0; i < rows.length; i++) {
    const fp = fps[i];
    // Anomaly: min Hamming to any other row
    let minH = 48;
    for (let j = 0; j < rows.length; j++) {
      if (i === j) continue;
      const h = hamming(fp, fps[j]);
      if (h < minH) minH = h;
    }
    const anomaly = minH / 48;
    const ones = (fp.match(/1/g) || []).length;
    const reconstruction = 1 - (Math.abs(ones - 24) * 2) / 48;
    let entropy = 0;
    let considered = 0;
    for (let b = 0; b < 48; b++) {
      if (fp[b] !== "1") continue;
      const p = ON[b] / n;
      if (p > 0 && p < 1) {
        entropy += -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
        considered++;
      }
    }
    const diversity = considered ? entropy / considered : 0;
    const composite = 0.4 * reconstruction + 0.35 * diversity + 0.25 * anomaly;
    out.push({
      ...rows[i],
      _fp: fp,
      _composite: composite,
      _anomaly: anomaly,
      _reconstruction: reconstruction,
      _diversity: diversity,
    });
    if (onProgress && i % 50 === 0) {
      onProgress(50 + Math.round((i / rows.length) * 50));
    }
  }
  if (onProgress) onProgress(100);
  return out;
}
