/**
 * Formed-model store with tenant scoping + at-rest encryption.
 *
 * On-disk layout:
 *   /data/formed_models/<tenant_id>/<id>.range.enc      (encrypted, preferred)
 *   /data/formed_models/<tenant_id>/<id>.range.json     (legacy / unencrypted)
 *
 * Legacy unencrypted files at /data/formed_models/<id>.range.json (no
 * tenant prefix) are still readable for back-compat from the pre-tenancy
 * era; they're owned by the "anon" tenant.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { encrypt, decrypt } from "./encryption";
import { modelsRoot as resolveRoot } from "./paths";

export type FormedModelStatus = "queued" | "ingesting" | "fingerprinting" | "crystallizing" | "anchoring" | "ready" | "failed";

export type FormedModelMeta = {
  id: string;
  tenant_id: string;                 // namespace owner
  name: string;
  corpus_path: string;
  corpus_format: string;
  corpus_records: number;
  corpus_bytes: number;
  corpus_sha256: string;
  fields: { name: string; nonEmptyShare: number; sampleType: string; entropy: number }[];
  formed_at: string;
  formation_ms: number;
  seed: number;
  fingerprinter_mode: "node" | "btut";
  bridge_url?: string;
  // New: which strategies fired and how much they covered
  adapter_chain?: { strategy: string; tried: boolean; succeeded: boolean; records_covered: number; ms: number; reason?: string }[];
  coverage_pct?: number;
  effective_strategy?: string;
  // chunked formation
  chunked?: { total_chunks: number; chunk_size: number; merged: boolean };
  encrypted?: boolean;
  status: FormedModelStatus;
  progress?: { phase: string; pct: number };
  error?: string;
};

export type FormedModel = FormedModelMeta & {
  fingerprints: { recordIdx: number; fp48Hex: string; rawHash: string; contributing: string[]; strategy?: string }[];
  taxonomy: {
    classes: { id: number; size: number; centroid_fp48Hex: string; sample_record_idxs: number[] }[];
    silhouette: number;
    null_test_z: number;
    novel_class_count: number;
  };
  sample_records: { idx: number; preview: string }[];
  response_digest: string;
  records_in_memory: number;
  air_gap_compliant: boolean;
};

function modelsRoot(): string {
  return resolveRoot();
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

const cache = new Map<string, FormedModel>();

export function newId(): string {
  return "rng_" + crypto.randomBytes(10).toString("hex");
}

export function modelsRootPath(): string {
  return modelsRoot();
}

function tenantDir(tenant_id: string): string {
  return path.join(modelsRoot(), tenant_id);
}

// Find the on-disk path for a model id, checking the tenant dir first
// then the legacy flat layout (anon).
async function locate(id: string, tenant_id?: string): Promise<{ path: string; encrypted: boolean; tenant: string } | null> {
  const tries: { p: string; encrypted: boolean; tenant: string }[] = [];
  if (tenant_id) {
    tries.push({ p: path.join(tenantDir(tenant_id), `${id}.range.enc`), encrypted: true, tenant: tenant_id });
    tries.push({ p: path.join(tenantDir(tenant_id), `${id}.range.json`), encrypted: false, tenant: tenant_id });
  }
  // Legacy / anon
  tries.push({ p: path.join(modelsRoot(), `${id}.range.enc`), encrypted: true, tenant: "anon" });
  tries.push({ p: path.join(modelsRoot(), `${id}.range.json`), encrypted: false, tenant: "anon" });
  // Last-resort scan of all tenant dirs
  for (const t of tries) {
    try {
      const s = await fs.stat(t.p);
      if (s.isFile()) return { path: t.p, encrypted: t.encrypted, tenant: t.tenant };
    } catch { /* next */ }
  }
  return null;
}

async function readModelFile(p: string, encrypted: boolean): Promise<FormedModel> {
  const raw = await fs.readFile(p);
  const txt = encrypted ? await decrypt(raw) : raw.toString("utf-8");
  return JSON.parse(txt) as FormedModel;
}

export async function listModels(opts: { tenant_id?: string } = {}): Promise<FormedModelMeta[]> {
  const root = modelsRoot();
  await ensureDir(root);
  const out: FormedModelMeta[] = [];

  // Determine which dirs to scan
  const dirsToScan: { dir: string; tenant: string }[] = [];
  if (opts.tenant_id) {
    dirsToScan.push({ dir: tenantDir(opts.tenant_id), tenant: opts.tenant_id });
    dirsToScan.push({ dir: root, tenant: "anon" }); // legacy flat
  } else {
    // List root + every tenant dir
    dirsToScan.push({ dir: root, tenant: "anon" });
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith("_")) {
          dirsToScan.push({ dir: path.join(root, e.name), tenant: e.name });
        }
      }
    } catch { /* fall through */ }
  }

  for (const { dir, tenant } of dirsToScan) {
    let files: string[] = [];
    try { files = await fs.readdir(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith(".range.json") && !f.endsWith(".range.enc")) continue;
      const id = f.replace(/\.range\.(json|enc)$/, "");
      const cached = cache.get(id);
      if (cached) {
        if (!opts.tenant_id || cached.tenant_id === opts.tenant_id || (opts.tenant_id && cached.tenant_id === "anon" && tenant === "anon")) {
          out.push(metaOnly(cached));
        }
        continue;
      }
      try {
        const m = await readModelFile(path.join(dir, f), f.endsWith(".enc"));
        if (!m.tenant_id) m.tenant_id = tenant;
        cache.set(m.id, m);
        if (!opts.tenant_id || m.tenant_id === opts.tenant_id) out.push(metaOnly(m));
      } catch { /* skip corrupt */ }
    }
  }
  out.sort((a, b) => b.formed_at.localeCompare(a.formed_at));
  return out;
}

export async function getModel(id: string, tenant_id?: string): Promise<FormedModel | null> {
  const cached = cache.get(id);
  if (cached) {
    if (tenant_id && cached.tenant_id !== tenant_id && cached.tenant_id !== "anon") return null;
    return cached;
  }
  const loc = await locate(id, tenant_id);
  if (!loc) return null;
  try {
    const m = await readModelFile(loc.path, loc.encrypted);
    if (!m.tenant_id) m.tenant_id = loc.tenant;
    if (tenant_id && m.tenant_id !== tenant_id && m.tenant_id !== "anon") return null;
    cache.set(m.id, m);
    return m;
  } catch {
    return null;
  }
}

export async function saveModel(m: FormedModel, opts: { encrypt?: boolean } = {}): Promise<void> {
  const dir = tenantDir(m.tenant_id || "anon");
  await ensureDir(dir);
  cache.set(m.id, m);
  const wantEnc = opts.encrypt !== false; // default: encrypt
  const target = path.join(dir, wantEnc ? `${m.id}.range.enc` : `${m.id}.range.json`);
  const tmp = target + ".tmp";
  m.encrypted = wantEnc;
  const txt = JSON.stringify(m, jsonReplacer, 2);
  if (wantEnc) {
    const blob = await encrypt(txt);
    await fs.writeFile(tmp, blob);
  } else {
    await fs.writeFile(tmp, txt, "utf-8");
  }
  await fs.rename(tmp, target);
  // Best-effort: clean up the other format if both ended up on disk.
  const otherTarget = path.join(dir, wantEnc ? `${m.id}.range.json` : `${m.id}.range.enc`);
  fs.unlink(otherTarget).catch(() => { /* ignore */ });
}

export async function updateMeta(id: string, patch: Partial<FormedModelMeta>, tenant_id?: string): Promise<FormedModel | null> {
  const m = await getModel(id, tenant_id);
  if (!m) return null;
  Object.assign(m, patch);
  await saveModel(m);
  return m;
}

export async function deleteModel(id: string, tenant_id?: string): Promise<boolean> {
  const loc = await locate(id, tenant_id);
  if (!loc) return false;
  try {
    await fs.unlink(loc.path);
    cache.delete(id);
    return true;
  } catch {
    return false;
  }
}

function metaOnly(m: FormedModel): FormedModelMeta {
  const {
    fingerprints: _f, taxonomy: _t, sample_records: _s,
    response_digest: _d, records_in_memory: _r, air_gap_compliant: _a, ...meta
  } = m;
  void _f; void _t; void _s; void _d; void _r; void _a;
  return meta;
}

function jsonReplacer(_k: string, v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  return v;
}
