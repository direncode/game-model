"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

// Operator-side panels: tenant info / encryption posture / audit viewer.
// Sits in /range below the formation console. Shows what would normally
// require a CISO + an SRE to inspect: who you are, how you're isolated,
// what's been logged.

type Identity = {
  user_id: string;
  tenant_id: string;
  is_anonymous: boolean;
  auth_reason?: string;
  auth_required: boolean;
  encryption: { at_rest: boolean; algo: string; key_fingerprint: string | null };
  btut_bridge_url: string | null;
  runpod_available: boolean;
};

type AuditEvent = {
  ts: string;
  actor: { user_id: string; tenant_id: string; ip?: string };
  action: string;
  resource?: { kind: string; id: string; name?: string };
  details?: Record<string, unknown>;
  result: string;
  digest?: string;
  wall_ms?: number;
};

export function RangeOperator() {
  const [ident, setIdent] = useState<Identity | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const i = await fetch("/api/range-identity", { cache: "no-store" }).then((r) => r.json());
      setIdent(i);
    } catch { /* ignore */ }
    setLoadingEvents(true);
    try {
      const e = await fetch("/api/range-audit?limit=80", { cache: "no-store" }).then((r) => r.json());
      setEvents(e.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, refreshTick]);
  // Auto-refresh audit every 20s
  useEffect(() => {
    const t = setInterval(() => setRefreshTick((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.action === filter);
  }, [events, filter]);

  const downloadCEF = () => { window.open("/api/range-audit?format=cef&limit=5000", "_blank"); };
  const downloadOCSF = () => { window.open("/api/range-audit?format=ocsf&limit=5000", "_blank"); };

  return (
    <section id="operator" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Operator console · tenant · encryption · audit
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            What a CISO<br />
            <span className="text-white/40">would ask first.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl leading-relaxed">
            Who is calling. Which tenant they belong to. Whether their
            formed models are encrypted at rest. What every form / query /
            delete touched. Exportable to your SIEM in CEF or OCSF.
          </p>
        </motion.div>

        {/* Identity / encryption / capability strip */}
        <motion.div
          initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}
          className="mt-12 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-cyan">
              Identity / posture · this caller
            </span>
            <button
              onClick={refresh}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 hover:text-white transition-colors"
            >
              ↻ refresh
            </button>
          </div>
          {!ident ? (
            <div className="p-5 font-mono text-[12px] text-white/45 italic">resolving identity…</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4">
              <Cell label="user_id" v={ident.user_id} tone={ident.is_anonymous ? "yellow" : "green"} />
              <Cell label="tenant_id" v={ident.tenant_id} tone="cyan" />
              <Cell label="auth_required" v={ident.auth_required ? "true (will deny anon)" : "false (anon allowed)"} tone={ident.auth_required ? "green" : "yellow"} />
              <Cell label="auth_reason" v={ident.auth_reason ?? "—"} sub="resolution path" tone="white" />
              <Cell label="encryption" v={ident.encryption.at_rest ? "at-rest enabled" : "off"} sub={ident.encryption.algo} tone="green" />
              <Cell label="key_fingerprint" v={ident.encryption.key_fingerprint ? `sha256:${ident.encryption.key_fingerprint}` : "—"} sub="appliance master" tone="white" />
              <Cell label="btut bridge" v={ident.btut_bridge_url ?? "node-only"} tone={ident.btut_bridge_url ? "green" : "white"} />
              <Cell label="runpod" v={ident.runpod_available ? "available" : "not configured"} tone={ident.runpod_available ? "green" : "white"} />
            </div>
          )}
        </motion.div>

        {/* Audit viewer */}
        <motion.div
          initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}
          className="mt-6 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-cyan">
              Audit log · last {events.length} events
            </span>
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-black/60 border border-white/15 text-white/80 text-[11px] font-mono rounded-md px-2 py-1 focus:outline-none focus:border-li-cyan/60"
              >
                <option value="all">all</option>
                <option value="form">form</option>
                <option value="query">query</option>
                <option value="delete">delete</option>
                <option value="list">list</option>
                <option value="auth_failed">auth_failed</option>
              </select>
              <button
                onClick={downloadCEF}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 border border-white/15 px-2.5 py-1 rounded-md hover:text-white hover:border-white/30 transition-colors"
              >
                ↓ CEF
              </button>
              <button
                onClick={downloadOCSF}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 border border-white/15 px-2.5 py-1 rounded-md hover:text-white hover:border-white/30 transition-colors"
              >
                ↓ OCSF
              </button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loadingEvents && events.length === 0 && (
              <div className="p-5 font-mono text-[12px] text-white/40 italic">loading…</div>
            )}
            {!loadingEvents && filtered.length === 0 && (
              <div className="p-5 font-mono text-[12px] text-white/40 italic">no events yet for this tenant</div>
            )}
            {filtered.map((e, i) => {
              const tone = e.result === "success" ? "text-li-green" : e.result === "denied" ? "text-li-red" : "text-li-yellow";
              return (
                <div key={i} className="grid grid-cols-[170px_72px_72px_1fr] items-start px-5 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <div className="font-mono text-[10.5px] text-white/55 truncate">{new Date(e.ts).toISOString().replace("T"," ").slice(0,19)}</div>
                  <div className={`font-mono text-[10.5px] uppercase tracking-[0.18em] ${tone}`}>{e.action}</div>
                  <div className={`font-mono text-[10.5px] uppercase tracking-[0.18em] ${tone}`}>{e.result}</div>
                  <div className="font-mono text-[10.5px] text-white/70 truncate">
                    actor=<span className="text-white/85">{e.actor.user_id.slice(0,12)}</span>
                    {e.resource ? <> · model=<span className="text-li-cyan">{e.resource.id.slice(0,18)}…</span></> : null}
                    {e.digest ? <> · digest=<span className="text-li-green">{e.digest.slice(0,12)}…</span></> : null}
                    {typeof e.wall_ms === "number" ? <> · {e.wall_ms}ms</> : null}
                    {e.details && Object.keys(e.details).length > 0 ? (
                      <span className="text-white/40"> · {Object.entries(e.details).slice(0,3).map(([k,v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v).slice(0,30)}`).join(" · ")}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}
          className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-[12px] font-mono text-white/55 leading-relaxed"
        >
          Audit events written append-only to <code className="text-white/85">/data/formed_models/_audit/&lt;date&gt;.ndjson</code>{" "}
          on the appliance. Tenant-scoped at read; export available in CEF
          for ArcSight/QRadar/Splunk and OCSF for the broader cyber stack.
          Encryption at rest uses AES-256-GCM with a per-appliance master
          key (env <code className="text-white/85">RANGE_ENCRYPTION_KEY</code>{" "}
          if provided, otherwise auto-generated and chmod 600 on first
          use). New formed models are written as{" "}
          <code className="text-white/85">.range.enc</code> files; legacy{" "}
          <code className="text-white/85">.range.json</code> files remain
          readable.
        </motion.div>
      </div>
    </section>
  );
}

function Cell({ label, v, sub, tone }: { label: string; v: string; sub?: string; tone: "cyan" | "green" | "yellow" | "white" }) {
  const c = tone === "cyan" ? "text-li-cyan" : tone === "green" ? "text-li-green" : tone === "yellow" ? "text-li-yellow" : "text-white";
  return (
    <div className="px-5 py-4 border-r border-b border-white/[0.06] last:border-r-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{label}</div>
      <div className={`font-display text-lg tracking-tight truncate ${c}`}>{v}</div>
      {sub && <div className="font-mono text-[10px] text-white/35 mt-1 truncate">{sub}</div>}
    </div>
  );
}
