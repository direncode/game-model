/**
 * Append-only audit log for Range operations. Every form / query /
 * delete is recorded with actor, tenant, model, digest, and timing.
 *
 * On-disk layout: /data/formed_models/_audit/YYYY-MM-DD.ndjson
 * (writable via the same mount as formed-model artifacts)
 *
 * Export: CEF (Common Event Format) and OCSF JSON for SIEM ingest.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { modelsRoot } from "./paths";

export type AuditEvent = {
  ts: string;                          // ISO timestamp
  actor: { user_id: string; tenant_id: string; ip?: string; user_agent?: string };
  action: "form" | "query" | "delete" | "export" | "list" | "auth_failed";
  resource?: { kind: "model"; id: string; name?: string };
  details?: Record<string, unknown>;
  result: "success" | "failure" | "denied";
  digest?: string;                     // response_digest if applicable
  wall_ms?: number;
};

function auditDir(): string {
  return path.join(modelsRoot(), "_audit");
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function record(ev: AuditEvent): Promise<void> {
  const dir = auditDir();
  await ensureDir(dir);
  const file = path.join(dir, `${dateKey(new Date(ev.ts))}.ndjson`);
  const line = JSON.stringify(ev) + "\n";
  await fs.appendFile(file, line, "utf-8");
}

export async function listEvents(opts: { tenant_id?: string; since?: string; until?: string; limit?: number } = {}): Promise<AuditEvent[]> {
  const dir = auditDir();
  let files: string[] = [];
  try { files = (await fs.readdir(dir)).filter((f) => f.endsWith(".ndjson")).sort(); }
  catch { return []; }

  // Filter files by date range when supplied
  if (opts.since) {
    const sinceKey = opts.since.slice(0, 10);
    files = files.filter((f) => f.replace(".ndjson", "") >= sinceKey);
  }
  if (opts.until) {
    const untilKey = opts.until.slice(0, 10);
    files = files.filter((f) => f.replace(".ndjson", "") <= untilKey);
  }

  const out: AuditEvent[] = [];
  // Read newest first
  for (const f of files.slice().reverse()) {
    const txt = await fs.readFile(path.join(dir, f), "utf-8").catch(() => "");
    const lines = txt.split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const ev = JSON.parse(lines[i]) as AuditEvent;
        if (opts.tenant_id && ev.actor?.tenant_id !== opts.tenant_id) continue;
        out.push(ev);
        if (opts.limit && out.length >= opts.limit) return out;
      } catch { /* skip malformed line */ }
    }
  }
  return out;
}

// CEF export for SIEM ingest (ArcSight / QRadar / Splunk)
// Spec: CEF:Version|DeviceVendor|DeviceProduct|DeviceVersion|EventClassID|Name|Severity|Extension
export function toCEF(ev: AuditEvent): string {
  const ven = "Latent Ocean";
  const prod = "Range";
  const ver = "1.0";
  const eclass = ev.action;
  const name = `Range ${ev.action} (${ev.result})`;
  const severity = ev.result === "denied" ? "8" : ev.result === "failure" ? "6" : "3";
  const ext: string[] = [];
  ext.push(`rt=${Date.parse(ev.ts)}`);
  ext.push(`suser=${ev.actor.user_id}`);
  ext.push(`tenantId=${ev.actor.tenant_id}`);
  if (ev.actor.ip) ext.push(`src=${ev.actor.ip}`);
  if (ev.resource) ext.push(`cs1=${ev.resource.id} cs1Label=modelId`);
  if (ev.digest) ext.push(`cs2=${ev.digest} cs2Label=responseDigest`);
  if (typeof ev.wall_ms === "number") ext.push(`cn1=${ev.wall_ms} cn1Label=wallMs`);
  if (ev.details) {
    for (const [k, v] of Object.entries(ev.details)) {
      ext.push(`flexString1=${k}=${cleanCEF(String(v))}`);
    }
  }
  return `CEF:0|${ven}|${prod}|${ver}|${eclass}|${name}|${severity}|${ext.join(" ")}`;
}

// OCSF (Open Cybersecurity Schema Framework) — generic event class 3001 (API Activity)
export function toOCSF(ev: AuditEvent): Record<string, unknown> {
  return {
    activity_name: ev.action,
    activity_id: hashAction(ev.action),
    category_uid: 3,
    category_name: "Audit Activity",
    class_uid: 3001,
    class_name: "Account Change",
    severity_id: ev.result === "denied" ? 4 : ev.result === "failure" ? 3 : 1,
    status_id: ev.result === "success" ? 1 : 2,
    time: Date.parse(ev.ts),
    actor: {
      user: { uid: ev.actor.user_id, type_id: 1 },
      org: { uid: ev.actor.tenant_id },
    },
    resources: ev.resource ? [{ uid: ev.resource.id, name: ev.resource.name, type: "FormedModel" }] : [],
    metadata: {
      product: { vendor_name: "Latent Ocean", name: "Range", version: "1.0" },
      version: "1.1.0",
    },
    enrichments: [
      { name: "response_digest", value: ev.digest ?? null },
      { name: "wall_ms", value: ev.wall_ms ?? null },
    ],
    raw_data: JSON.stringify(ev.details ?? {}),
  };
}

function hashAction(a: string): number {
  // Stable small int per action for OCSF activity_id slot
  return ({ form: 1, query: 2, delete: 3, export: 4, list: 5, auth_failed: 99 } as Record<string, number>)[a] ?? 0;
}

function cleanCEF(s: string): string {
  // CEF extension values: escape \, =, and newlines
  return s.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\r?\n/g, "\\n").slice(0, 200);
}
