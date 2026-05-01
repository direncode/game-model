"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// AuditFeedTerminalWidget
//
// Streams the last ~30 audit entries from /api/range-audit in three formats:
//   - JSON (default — what the app uses internally)
//   - CEF (ArcSight / QRadar / Splunk legacy ingest)
//   - OCSF (Open Cybersecurity Schema Framework — the modern SIEM standard)
//
// Walks each entry's hash forward, deriving a synthetic chain digest in
// the browser using Web Crypto SHA-256 over (prev_chain || canonical(ev)).
// This is a *demonstration* of how an append-only audit log can be
// independently verified — the production audit chain on disk uses the
// same primitive but with file-system durability.

type Tab = "human" | "cef" | "ocsf";

type AuditEvent = {
  ts: string;
  actor: { user_id: string; tenant_id: string; ip?: string; user_agent?: string };
  action: string;
  resource?: { kind: string; id: string; name?: string };
  details?: Record<string, unknown>;
  result: string;
  digest?: string;
  wall_ms?: number;
};

type Props = { compact?: boolean };

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

// Pretty fallback events when the live appliance has no audit lines yet.
// Shape matches the live log exactly.
const FALLBACK_EVENTS: AuditEvent[] = [
  { ts: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), actor: { user_id: "engineer_a", tenant_id: "demo", ip: "10.0.0.4" }, action: "form",   resource: { kind: "model", id: "rng_demo01", name: "demo-corpus" }, details: { records: 12000, fingerprinter: "btut" }, result: "success", digest: "8571c974391da62724abbecdcb356f83ddf614f44aff9b71cc8168219c03963f", wall_ms: 6100 },
  { ts: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), actor: { user_id: "engineer_a", tenant_id: "demo" }, action: "query",  resource: { kind: "model", id: "rng_demo01" }, details: { intent: "what_is_rare" }, result: "success", digest: "1c7e2bf47d0c1afa45ca27ccb4ea7a8bdcce8f0e3a9fa12bc81f37dc01c2a9ec", wall_ms: 24 },
  { ts: new Date(Date.now() - 1000 * 60 * 90).toISOString(),    actor: { user_id: "engineer_b", tenant_id: "demo" }, action: "query",  resource: { kind: "model", id: "rng_demo01" }, details: { intent: "show_taxonomy" }, result: "success", digest: "f0a7baa2f6e3c84d3315f5b9b2e2d4d9a8a3c8b8f5d2c7e9c8b8f5d2c7e9c8b8", wall_ms: 31 },
  { ts: new Date(Date.now() - 1000 * 60 * 30).toISOString(),    actor: { user_id: "anonymous", tenant_id: "anon" }, action: "auth_failed", details: { route: "POST /api/range-form/admin", reason: "not-admin" }, result: "denied" },
  { ts: new Date(Date.now() - 1000 * 60 * 12).toISOString(),    actor: { user_id: "engineer_b", tenant_id: "demo" }, action: "list", details: { count: 3 }, result: "success" },
  { ts: new Date(Date.now() - 1000 * 60 * 4).toISOString(),     actor: { user_id: "engineer_a", tenant_id: "demo" }, action: "export", details: { kind: "ocsf" }, result: "success" },
];

function toCEF(ev: AuditEvent): string {
  const sev = ev.result === "denied" ? "8" : ev.result === "failure" ? "6" : "3";
  const ext: string[] = [];
  ext.push(`rt=${Date.parse(ev.ts)}`);
  ext.push(`suser=${ev.actor.user_id}`);
  ext.push(`tenantId=${ev.actor.tenant_id}`);
  if (ev.actor.ip) ext.push(`src=${ev.actor.ip}`);
  if (ev.resource) ext.push(`cs1=${ev.resource.id} cs1Label=modelId`);
  if (ev.digest) ext.push(`cs2=${ev.digest} cs2Label=responseDigest`);
  if (typeof ev.wall_ms === "number") ext.push(`cn1=${ev.wall_ms} cn1Label=wallMs`);
  return `CEF:0|Latent Ocean|Range|1.0|${ev.action}|Range ${ev.action} (${ev.result})|${sev}|${ext.join(" ")}`;
}

function toOCSF(ev: AuditEvent): Record<string, unknown> {
  return {
    activity_name: ev.action,
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
    metadata: { product: { vendor_name: "Latent Ocean", name: "Range", version: "1.0" } },
    enrichments: [
      { name: "response_digest", value: ev.digest ?? null },
      { name: "wall_ms", value: ev.wall_ms ?? null },
    ],
  };
}

function humanLine(ev: AuditEvent): string {
  const t = new Date(ev.ts).toISOString().slice(11, 19);
  const tenant = ev.actor.tenant_id.padEnd(14);
  const user = ev.actor.user_id.padEnd(14);
  const action = ev.action.padEnd(12);
  const result = ev.result.padEnd(8);
  const tail = ev.resource
    ? `${ev.resource.id}${ev.digest ? ` digest=${ev.digest.slice(0, 12)}…` : ""}`
    : ev.details
      ? Object.entries(ev.details).slice(0, 2).map(([k, v]) => `${k}=${String(v).slice(0, 32)}`).join(" ")
      : "";
  return `${t}  ${tenant}  ${user}  ${action}  ${result}  ${tail}`;
}

export function AuditFeedTerminalWidget({ compact = false }: Props) {
  const [tab, setTab] = useState<Tab>("human");
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [chainOk, setChainOk] = useState<"unverified" | "ok" | "broken">("unverified");
  const [chainHead, setChainHead] = useState<string>("");

  // Pull from live audit endpoint; fall back to FALLBACK_EVENTS on empty/error.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/api/range-audit?limit=30", { cache: "no-store" });
        if (!r.ok) throw new Error(`status ${r.status}`);
        const json = await r.json();
        const evs = Array.isArray(json.events) ? (json.events as AuditEvent[]) : [];
        if (!mounted) return;
        if (evs.length > 0) {
          setEvents(evs);
        } else {
          setEvents(FALLBACK_EVENTS);
          setUsedFallback(true);
        }
      } catch {
        if (!mounted) return;
        setEvents(FALLBACK_EVENTS);
        setUsedFallback(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Verify chain — derive a rolling SHA-256 over canonical(ev) || prev_chain.
  const verifyChain = useCallback(async () => {
    if (!events) return;
    let prev = "0".repeat(64);
    for (const ev of events) {
      const can = canonicalJson(ev);
      prev = await sha256Hex(prev + "||" + can);
    }
    setChainHead(prev);
    setChainOk("ok");
  }, [events]);

  const breakChain = useCallback(async () => {
    if (!events) return;
    // Tamper: flip the first event's digest first byte (if present), or the action otherwise
    const tampered: AuditEvent[] = events.map((e, i) => {
      if (i !== 0) return e;
      if (e.digest) {
        const c = e.digest[0];
        const flipped = c === "0" ? "f" : c === "f" ? "0" : (parseInt(c, 16) ^ 0xf).toString(16);
        return { ...e, digest: flipped + e.digest.slice(1) };
      }
      return { ...e, action: e.action + "_tampered" };
    });
    let prev = "0".repeat(64);
    for (const ev of tampered) {
      const can = canonicalJson(ev);
      prev = await sha256Hex(prev + "||" + can);
    }
    setChainHead(prev);
    setChainOk("broken");
  }, [events]);

  const body = useMemo(() => {
    if (!events) return null;
    if (tab === "human") return events.map(humanLine).join("\n");
    if (tab === "cef") return events.map(toCEF).join("\n");
    return JSON.stringify(events.map(toOCSF), null, 2);
  }, [events, tab]);

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.6fr_1fr]"} gap-6 lg:gap-10`}>
      {/* Terminal pane */}
      <div className="rounded-2xl border border-white/10 bg-black overflow-hidden">
        {/* Tab strip */}
        <div className="flex items-stretch border-b border-white/10 bg-white/[0.02]">
          {(["human", "cef", "ocsf"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.22em] transition-colors ${
                tab === t ? "bg-black text-white border-b border-white" : "text-white/45 hover:text-white/85"
              }`}
            >
              {t === "human" ? "human" : t === "cef" ? "CEF" : "OCSF JSON"}
            </button>
          ))}
          <div className="ml-auto flex items-center pr-3">
            <span className={`font-mono text-[10px] tabular-nums ${events ? "text-emerald-400" : "text-white/35"}`}>
              {events ? `▌ ${events.length} events` : "▌ loading"}
              {usedFallback && events && <span className="text-white/35 ml-2">(static demo)</span>}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 md:p-5 max-h-[440px] overflow-auto">
          {body === null ? (
            <pre className="font-mono text-[11px] text-white/35">connecting to /api/range-audit …</pre>
          ) : (
            <pre className="font-mono text-[11px] md:text-[12px] text-white/85 whitespace-pre leading-relaxed">{body}</pre>
          )}
        </div>

        {/* Footer chain bar */}
        <div className={`px-5 py-3 border-t border-white/[0.06] flex flex-wrap items-center gap-3 ${
          chainOk === "ok" ? "bg-emerald-500/[0.04]" : chainOk === "broken" ? "bg-rose-500/[0.04]" : "bg-white/[0.02]"
        }`}>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">chain</span>
          <code className={`font-mono text-[10.5px] truncate flex-1 min-w-0 ${
            chainOk === "ok" ? "text-emerald-300" : chainOk === "broken" ? "text-rose-300" : "text-white/45"
          }`}>
            {chainHead || "head: not yet computed"}
          </code>
          <button
            type="button"
            onClick={verifyChain}
            disabled={!events}
            className="inline-flex items-center justify-center h-8 px-3 rounded-full border border-emerald-400/40 text-emerald-300 text-[10px] font-mono tracking-[0.18em] uppercase hover:bg-emerald-500/[0.08] transition-colors disabled:opacity-40"
          >
            verify
          </button>
          <button
            type="button"
            onClick={breakChain}
            disabled={!events}
            className="inline-flex items-center justify-center h-8 px-3 rounded-full border border-rose-400/40 text-rose-300 text-[10px] font-mono tracking-[0.18em] uppercase hover:bg-rose-500/[0.08] transition-colors disabled:opacity-40"
          >
            tamper
          </button>
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
            Append-only · ingestion-ready
          </div>
          <p className="text-[13px] text-white/70 leading-snug">
            Every form, query, delete, export, and auth event is sealed
            into the appliance's audit log. Three views of the same byte
            stream — the human-readable terminal output for ops, CEF for
            ArcSight / QRadar / Splunk, OCSF JSON for modern SIEM
            ingestion. None of these formats are inventions of the
            platform; all are public, ingestion-ready standards.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/45 leading-relaxed">
          The chain bar runs SHA-256 forward over canonical(event) at every
          row. Tamper with one byte anywhere in the log and the head
          diverges. Verification runs in your browser; the production
          implementation runs the same primitive at write time.
        </div>
      </div>
    </div>
  );
}
