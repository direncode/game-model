/**
 * Formed-model store. In-memory map + disk persistence to a writable
 * volume mounted at /data/formed_models (or repo-relative fallback for
 * dev). Survives across requests on the same Node worker; survives
 * across container restarts via disk.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type FormedModelStatus = "queued" | "ingesting" | "fingerprinting" | "crystallizing" | "anchoring" | "ready" | "failed";

export type FormedModelMeta = {
  id: string;                        // rng_<20 hex>
  name: string;                      // human label
  corpus_path: string;               // path the form was kicked off from
  corpus_format: string;             // detected format (json-array, ndjson, csv, etc)
  corpus_records: number;            // total records ingested
  corpus_bytes: number;
  corpus_sha256: string;             // sha256 over input bytes
  fields: { name: string; nonEmptyShare: number; sampleType: string; entropy: number }[];
  formed_at: string;                 // ISO timestamp
  formation_ms: number;
  seed: number;
  fingerprinter_mode: "node" | "btut";
  bridge_url?: string;
  status: FormedModelStatus;
  progress?: { phase: string; pct: number };
  error?: string;
};

export type FormedModel = FormedModelMeta & {
  fingerprints: { recordIdx: number; fp48Hex: string; rawHash: string; contributing: string[] }[];
  taxonomy: {
    classes: { id: number; size: number; centroid_fp48Hex: string; sample_record_idxs: number[] }[];
    silhouette: number;
    null_test_z: number;
    novel_class_count: number;
  };
  // Optional sample of canonical record bytes for the query layer
  // (just enough for citation previews, not the full corpus).
  sample_records: { idx: number; preview: string }[];
  response_digest: string;            // sha256 over canonical artifact
  records_in_memory: number;          // how many fingerprints stored
  air_gap_compliant: boolean;         // true if formed without external network
};

// ---------- Path resolution ----------

function modelsRoot(): string {
  // Prefer the prod-mounted writable volume; fall back to repo-local for dev.
  const candidates = [
    process.env.FORMED_MODELS_DIR,
    "/data/formed_models",
    path.resolve(process.cwd(), "..", "data", "formed_models"),
  ].filter(Boolean) as string[];
  return candidates[0]!;
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

// ---------- In-memory cache ----------

const cache = new Map<string, FormedModel>();

// ---------- Public API ----------

export function newId(): string {
  return "rng_" + crypto.randomBytes(10).toString("hex");
}

export async function listModels(): Promise<FormedModelMeta[]> {
  const root = modelsRoot();
  try {
    await ensureDir(root);
    const files = await fs.readdir(root);
    const out: FormedModelMeta[] = [];
    for (const f of files) {
      if (!f.endsWith(".range.json")) continue;
      try {
        // Fast-path through the in-memory cache first
        const id = f.replace(/\.range\.json$/, "");
        const cached = cache.get(id);
        if (cached) {
          out.push(metaOnly(cached));
          continue;
        }
        const txt = await fs.readFile(path.join(root, f), "utf-8");
        const m = JSON.parse(txt) as FormedModel;
        cache.set(m.id, m);
        out.push(metaOnly(m));
      } catch { /* skip corrupt */ }
    }
    out.sort((a, b) => b.formed_at.localeCompare(a.formed_at));
    return out;
  } catch {
    return [];
  }
}

export async function getModel(id: string): Promise<FormedModel | null> {
  const cached = cache.get(id);
  if (cached) return cached;
  const root = modelsRoot();
  try {
    const txt = await fs.readFile(path.join(root, `${id}.range.json`), "utf-8");
    const m = JSON.parse(txt) as FormedModel;
    cache.set(id, m);
    return m;
  } catch {
    return null;
  }
}

export async function saveModel(m: FormedModel): Promise<void> {
  const root = modelsRoot();
  await ensureDir(root);
  cache.set(m.id, m);
  // Atomic-ish write: write to .tmp then rename
  const target = path.join(root, `${m.id}.range.json`);
  const tmp = target + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(m, jsonReplacer, 2), "utf-8");
  await fs.rename(tmp, target);
}

export async function updateMeta(id: string, patch: Partial<FormedModelMeta>): Promise<FormedModel | null> {
  const m = await getModel(id);
  if (!m) return null;
  Object.assign(m, patch);
  await saveModel(m);
  return m;
}

export async function deleteModel(id: string): Promise<boolean> {
  const root = modelsRoot();
  try {
    await fs.unlink(path.join(root, `${id}.range.json`));
    cache.delete(id);
    return true;
  } catch {
    return false;
  }
}

function metaOnly(m: FormedModel): FormedModelMeta {
  // strip heavy fields
  const {
    fingerprints: _f,
    taxonomy: _t,
    sample_records: _s,
    response_digest: _d,
    records_in_memory: _r,
    air_gap_compliant: _a,
    ...meta
  } = m;
  void _f; void _t; void _s; void _d; void _r; void _a;
  return meta;
}

// BigInt-safe JSON encoder (we don't currently store BigInt in the
// model, but the type is around so this guards future regressions)
function jsonReplacer(_k: string, v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  return v;
}

export function modelsRootPath(): string {
  return modelsRoot();
}
