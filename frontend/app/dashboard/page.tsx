"use client";

import { Nav } from "@/components/landing/Nav";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * /dashboard — Layer 9 customer-facing dashboard.
 *
 * Requires an LSC API key (pasted by the user, kept only in local
 * component state). Displays:
 *   - aggregate usage (jobs, entities, GPU seconds, cost, regime-card rate)
 *   - recent jobs table with status, backend, exec time, cost
 *
 * Backend endpoint: GET /api/v1/lsc/metrics  (require_api_scope("query"))
 */

type Aggregate = {
  jobs_total: number;
  entities_total: number;
  gpu_seconds_total: number;
  cost_dollars_total: number;
  regime_card_compliant_rate: number | null;
  since: number | null;
};

type JobRow = {
  job_id: string;
  org_id: string | null;
  user_id: string | null;
  backend: string;
  n_entities: number;
  gpu_exec_ms: number;
  cost_dollars: number;
  regime_card_compliant: boolean;
  recorded_at: number;
};

type MetricsResp = {
  aggregate: Aggregate;
  recent_jobs: JobRow[];
};

const STORAGE_KEY = "lo_lsc_api_key";

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState<string>("");
  const [data, setData] = useState<MetricsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const k = window.localStorage.getItem(STORAGE_KEY) || "";
      if (k) setApiKey(k);
    }
  }, []);

  const load = async (k: string) => {
    if (!k) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/v1/lsc/metrics", {
        headers: { "X-API-Key": k },
        cache: "no-store",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.detail || `HTTP ${r.status}`);
      }
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const onConnect = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, apiKey);
    load(apiKey);
  };

  useEffect(() => {
    if (apiKey) load(apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agg = data?.aggregate;

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />

      <header className="px-6 md:px-10 pt-32 md:pt-40 pb-12 max-w-[1280px] mx-auto">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-white/50">
          Layer 9 · Dashboard
        </div>
        <h1 className="mt-3 font-display text-[56px] md:text-[88px] leading-[0.95] tracking-[-0.035em] text-white">
          Your substrate, measured.
        </h1>
        <p className="mt-6 max-w-[820px] text-[17px] md:text-[19px] leading-relaxed text-white/70">
          Recent jobs, aggregate usage, and regime-card compliance for your API key. Connect
          a key below; it is kept only in local browser storage and never sent anywhere except
          this site&apos;s LSC API.
        </p>
      </header>

      <section className="px-6 md:px-10 pb-8 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/15 bg-black/40 p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex-1">
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-2">
                LSC API key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="lo_sk_..."
                spellCheck={false}
                className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-[14px] text-white font-mono placeholder:text-white/35 focus:border-white/40 focus:outline-none"
              />
            </div>
            <button
              onClick={onConnect}
              disabled={loading || !apiKey}
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white text-black text-[12.5px] font-mono font-bold tracking-[0.22em] uppercase hover:bg-white/90 disabled:bg-white/20 disabled:text-white/45 disabled:cursor-not-allowed transition-colors px-6 py-3"
            >
              {loading ? "Loading..." : "Connect"}
              <span aria-hidden>→</span>
            </button>
          </div>
          {error && (
            <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/[0.05] p-4 font-mono text-[12.5px] text-red-200/80">
              {error}
            </div>
          )}
        </div>
      </section>

      {agg && (
        <section className="px-6 md:px-10 py-8 max-w-[1280px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Jobs"           value={agg.jobs_total.toLocaleString()} />
            <Stat label="Entities"       value={agg.entities_total.toLocaleString()} />
            <Stat label="GPU seconds"    value={agg.gpu_seconds_total.toFixed(2)} />
            <Stat label="Cost (USD)"     value={`$${agg.cost_dollars_total.toFixed(4)}`} />
            <Stat label="Regime-card"    value={agg.regime_card_compliant_rate !== null ? `${(agg.regime_card_compliant_rate * 100).toFixed(1)}%` : "—"} />
          </div>
        </section>
      )}

      {data?.recent_jobs && data.recent_jobs.length > 0 && (
        <section className="px-6 md:px-10 py-8 max-w-[1280px] mx-auto">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-white/45 mb-3">
            Recent jobs
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/12 bg-white/[0.015]">
            <table className="min-w-full text-[13px]">
              <thead className="text-left font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/55">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2.5">Job</th>
                  <th className="px-4 py-2.5">Backend</th>
                  <th className="px-4 py-2.5 tabular-nums">Entities</th>
                  <th className="px-4 py-2.5 tabular-nums">GPU ms</th>
                  <th className="px-4 py-2.5 tabular-nums">Cost</th>
                  <th className="px-4 py-2.5">Regime</th>
                  <th className="px-4 py-2.5 tabular-nums">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] font-mono">
                {data.recent_jobs.map((j) => (
                  <tr key={j.job_id} className="text-white/85">
                    <td className="px-4 py-2.5">{j.job_id.slice(0, 24)}…</td>
                    <td className="px-4 py-2.5">{j.backend}</td>
                    <td className="px-4 py-2.5 tabular-nums">{j.n_entities.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums">{j.gpu_exec_ms.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums">${j.cost_dollars.toFixed(4)}</td>
                    <td className="px-4 py-2.5">{j.regime_card_compliant ? "✓" : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-white/55">
                      {new Date(j.recorded_at * 1000).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!apiKey && (
        <section className="px-6 md:px-10 py-16 max-w-[1280px] mx-auto">
          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.02] to-transparent p-7">
            <h3 className="font-display text-[24px] tracking-[-0.02em] text-white">
              No key yet?
            </h3>
            <p className="mt-3 text-[14.5px] text-white/65 leading-relaxed max-w-[820px]">
              Run a workflow in the <Link href="/builder" className="text-white underline decoration-white/30 hover:decoration-white">System Builder</Link> with any
              valid LSC API key; usage records flow into this dashboard. Enterprise
              engagements get keys provisioned through the FDE workspace.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.02] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="font-mono text-[28px] text-white mt-1 tabular-nums">{value}</div>
    </div>
  );
}
