"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

// Each integration is something an enterprise engineer would paste into
// a stack they already run. No forms. Click an integration → see real
// code → click "Run emulation" → a real model gets formed against a
// synthesized payload so they can see the receiving end actually work.

type Kind = "snowflake" | "databricks" | "postgres" | "s3" | "kafka" | "splunk" | "kubernetes" | "terraform" | "oidc" | "cli";

const TABS: { kind: Kind; label: string; sub: string; tone: string; icon: string }[] = [
  { kind: "snowflake",  label: "Snowflake",  sub: "external function on any table",        tone: "#29B5E8", icon: "❄" },
  { kind: "databricks", label: "Databricks", sub: "PySpark sdk in any notebook",            tone: "#FF3621", icon: "▲" },
  { kind: "postgres",   label: "Postgres",   sub: "pg_range extension on any table",         tone: "#336791", icon: "◑" },
  { kind: "s3",         label: "S3 / Blob",  sub: "mount any bucket prefix",                 tone: "#FF9900", icon: "☁" },
  { kind: "kafka",      label: "Kafka",      sub: "kafka-connect sink, daily form",          tone: "#231F20", icon: "▶" },
  { kind: "splunk",     label: "Splunk",     sub: "forwarder app on existing indexers",      tone: "#65A637", icon: "↗" },
  { kind: "kubernetes", label: "Kubernetes", sub: "helm chart, auto-managed appliance",      tone: "#326CE5", icon: "⎈" },
  { kind: "terraform",  label: "Terraform",  sub: "first-class module, tracked in IaC",      tone: "#7B42BC", icon: "▣" },
  { kind: "oidc",       label: "OIDC SSO",   sub: "your IdP, your groups, your roles",       tone: "#00C7B7", icon: "⊕" },
  { kind: "cli",        label: "CLI",        sub: "single static binary, pipes anywhere",    tone: "#FFFFFF", icon: "❯" },
];

type Step = { label: string; cmd?: string; output?: string; ok: boolean };

type Result = {
  kind: Kind;
  name: string;
  steps: Step[];
  emulated_model_id: string | null;
  notes: string;
};

export function RangeIntegrations() {
  const [active, setActive] = useState<Kind>("snowflake");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [stepIdx, setStepIdx] = useState(-1);
  const [err, setErr] = useState<string | null>(null);

  const tab = useMemo(() => TABS.find((t) => t.kind === active)!, [active]);

  // Reset result when switching tab
  useEffect(() => { setResult(null); setStepIdx(-1); setErr(null); }, [active]);

  const run = useCallback(async () => {
    setRunning(true);
    setErr(null);
    setResult(null);
    setStepIdx(-1);
    try {
      const r = await fetch("/api/range-integrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: active, emulate: true, name: `${active}-q4-2026` }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status} ${t.slice(0, 120)}`);
      }
      const data = (await r.json()) as Result;
      setResult(data);
      // Auto-walk through the steps
      let i = 0;
      const tick = () => {
        setStepIdx(i);
        i += 1;
        if (i < data.steps.length) setTimeout(tick, 1100);
      };
      tick();
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  }, [active]);

  return (
    <section id="integrate" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Integrate · drop into the stack you already run
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Paste the code.<br />
            <span className="text-white/40">Skip the form.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl leading-relaxed">
            Range mounts onto whatever you already have — Snowflake, Databricks,
            Postgres, S3, Kafka, Splunk, your IdP, your Helm. Pick an
            integration. Read the exact commands your engineers would paste.
            Click <span className="text-li-cyan">Run emulation</span> and a
            real formed model lands on the appliance against a representative
            payload — proving the receiving end works before you wire the real
            connection.
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}
          className="mt-12 grid grid-cols-2 md:grid-cols-5 gap-2"
        >
          {TABS.map((t) => {
            const a = t.kind === active;
            return (
              <button
                key={t.kind}
                onClick={() => setActive(t.kind)}
                disabled={running}
                className={`text-left rounded-xl border p-3.5 transition-colors ${
                  a ? "border-li-cyan/60 bg-li-cyan/[0.05]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
                } ${running ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-base shrink-0" style={{ color: t.tone }}>{t.icon}</span>
                  <span className={`font-mono text-[11.5px] uppercase tracking-[0.18em] ${a ? "text-white" : "text-white/65"}`}>
                    {t.label}
                  </span>
                </div>
                <div className="text-[12px] text-white/45 leading-tight">{t.sub}</div>
              </button>
            );
          })}
        </motion.div>

        {/* Run controls */}
        <motion.div
          initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}
          className="mt-6 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tab.tone, boxShadow: `0 0 10px ${tab.tone}80` }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-cyan">
                {tab.label} · {tab.sub}
              </span>
            </div>
            <button
              onClick={run}
              disabled={running}
              className="inline-flex items-center justify-center h-9 px-5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? "running…" : result ? "▶ Re-run emulation" : "▶ Run emulation"}
            </button>
          </div>

          {!result && !err && (
            <div className="px-5 py-12 text-center">
              <div className="font-mono text-[12px] text-white/45 italic">
                Click <span className="text-li-cyan">Run emulation</span> to walk through the {tab.label} integration end-to-end.
              </div>
            </div>
          )}

          {err && (
            <div className="px-5 py-6 font-mono text-[12px] text-li-red">{err}</div>
          )}

          {result && (
            <div className="divide-y divide-white/[0.04]">
              {result.steps.map((s, i) => {
                const reached = i <= stepIdx;
                const active = i === stepIdx;
                return (
                  <div key={i} className={`px-5 py-4 transition-colors ${active ? "bg-white/[0.03]" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-mono ${
                          reached
                            ? "bg-li-green/15 border border-li-green/40 text-li-green"
                            : "bg-white/[0.04] border border-white/10 text-white/40"
                        }`}>
                          {reached ? "✓" : i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/85 mb-1.5">{s.label}</div>
                        {s.cmd && reached && (
                          <pre className="rounded-lg border border-white/10 bg-black/60 p-3 text-[11.5px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{s.cmd}
                          </pre>
                        )}
                        {s.output && reached && (
                          <pre className="mt-2 rounded-lg border border-li-green/15 bg-li-green/[0.03] p-3 text-[11px] font-mono text-li-green overflow-x-auto leading-relaxed whitespace-pre">
{s.output}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="px-5 py-4 bg-li-cyan/[0.03]">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-cyan mb-1">
                  emulation receipt
                </div>
                <div className="font-mono text-[11.5px] text-white/85 break-all leading-relaxed">
                  emulated_model_id: <span className="text-li-cyan">{result.emulated_model_id ?? "(none)"}</span>
                </div>
                <div className="mt-1 text-[12px] text-white/55 leading-relaxed">
                  {result.notes}
                </div>
                {result.emulated_model_id && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/api/range-form/${result.emulated_model_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-white/15 text-white/80 text-xs font-mono hover:text-white hover:border-white/30 transition-colors"
                    >
                      view artifact (JSON) ↗
                    </a>
                    <button
                      onClick={() => {
                        const el = document.querySelector("[data-range-query-modelpicker]") as HTMLSelectElement | null;
                        if (el) {
                          el.value = result.emulated_model_id!;
                          el.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                        document.getElementById("query")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="inline-flex items-center justify-center h-9 px-4 rounded-full bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors"
                    >
                      query this model →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer — replaces the old "request access" form */}
        <motion.div
          initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}
          className="mt-12 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              Cut to the engineering conversation
            </span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div>
              <div className="font-display text-2xl text-white tracking-tight mb-1">talk to engineering</div>
              <div className="text-sm text-white/55 leading-relaxed">
                One reply within a business day. We do not run a sales process before you've seen the appliance work on your data.
              </div>
            </div>
            <div className="md:col-span-2 space-y-3 font-mono text-[12.5px]">
              <div>
                email · <a href="mailto:engineering@latentocean.com" className="text-li-cyan hover:text-white">engineering@latentocean.com</a>
              </div>
              <div>
                signal · <span className="text-white/85">+1 (415) 555-0127</span>
              </div>
              <div>
                slack connect · <span className="text-white/55">request via email; channel issued same day</span>
              </div>
              <div>
                pgp · <span className="text-white/55">on request</span>
              </div>
              <div className="pt-3 border-t border-white/[0.06]">
                <span className="text-white/40">attach to your message: </span>
                <span className="text-white/85">corpus shape, deployment target, and any of the integrations above.</span>
                <span className="text-white/40"> we'll write back with the next three commands you'd run.</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
