"use client";

import { Nav } from "@/components/landing/Nav";
import { useEffect, useState } from "react";

/**
 * /status — public Layer 9 health page.
 *
 * Polls /api/v1/lsc/health every 15s and displays:
 *   - overall status (healthy / degraded)
 *   - configured backends list
 *   - RunPod worker state (idle / ready / running)
 *   - completed jobs total
 */

type HealthResp = {
  status: "healthy" | "degraded";
  backend_configured: boolean;
  configured_backends?: string[];
  backend?: string;
  workers_idle?: number;
  workers_ready?: number;
  workers_running?: number;
  jobs_completed?: number;
  backend_status?: number | string;
};

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/v1/lsc/health", { cache: "no-store" });
        const data = (await r.json()) as HealthResp;
        if (!cancelled) {
          setHealth(data);
          setError(null);
          setLastUpdate(Date.now());
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const statusColor =
    health?.status === "healthy"
      ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/30"
      : "bg-amber-400/15 text-amber-200 border-amber-400/30";

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />

      <header className="px-6 md:px-10 pt-32 md:pt-40 pb-12 max-w-[1280px] mx-auto">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-white/50">
          Layer 9 · Substrate status
        </div>
        <h1 className="mt-3 font-display text-[56px] md:text-[88px] leading-[0.95] tracking-[-0.035em] text-white">
          System status
        </h1>
        <p className="mt-6 max-w-[820px] text-[17px] md:text-[19px] leading-relaxed text-white/70">
          Live state of the LSC pooled-compute backend. Polled every 15 seconds against the
          public health endpoint. No auth required.
        </p>
      </header>

      <section className="px-6 md:px-10 pb-12 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/12 bg-white/[0.015] p-6 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-1">
                Overall
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center font-mono text-[11px] uppercase tracking-[0.18em] border rounded-full px-2.5 py-1 ${statusColor}`}>
                  {health?.status ?? "loading"}
                </span>
                <span className="font-mono text-[12px] text-white/55">
                  {lastUpdate ? `updated ${new Date(lastUpdate).toLocaleTimeString()}` : "..."}
                </span>
              </div>
            </div>
            <div className="font-mono text-[11px] text-white/45">
              endpoint <span className="text-white/75">api.latentocean.com/api/v1/lsc/health</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/[0.05] p-4 font-mono text-[12px] text-red-200/80">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Backend" value={health?.backend ?? "—"} />
            <Tile label="Configured" value={(health?.configured_backends ?? []).join(", ") || "—"} mono small />
            <Tile label="Jobs completed" value={health?.jobs_completed ?? "—"} />
            <Tile label="Workers ready" value={health?.workers_ready ?? "—"} />
            <Tile label="Workers idle" value={health?.workers_idle ?? "—"} />
            <Tile label="Workers running" value={health?.workers_running ?? "—"} />
            <Tile label="Backend status" value={health?.backend_status ?? (health?.backend ? "200" : "—")} />
            <Tile label="Auth required" value="lo_sk_... key" mono small />
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 py-12 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.02] to-transparent p-7">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
            What this measures
          </div>
          <p className="text-[14.5px] text-white/70 leading-relaxed max-w-[920px]">
            Health checks come from the live LSC control plane and report on the configured
            backends discovered by the cost-aware router. When additional providers register
            (Lambda Labs, Vast.ai, Crusoe, on-prem LSU), their availability surfaces here too.
            The page does not require authentication. Per-org dashboards (job-level usage,
            cost, regime-card compliance) live under /dashboard once an API key is provided.
          </p>
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, mono, small }: { label: string; value: React.ReactNode; mono?: boolean; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/[0.02] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className={`${small ? "text-[14px]" : "text-[22px]"} ${mono ? "font-mono" : "font-display"} text-white mt-1 tabular-nums break-words`}>
        {String(value)}
      </div>
    </div>
  );
}
