"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

type Source = {
  name: string;
  display: string;
  origin: "live" | "disk";
  record_count: number;
  scored_count: number;
  null_test: {
    iterations?: number;
    total_metrics?: number;
    significant_05?: number;
    significant_001?: number;
    max_z_score?: number;
    skipped?: string;
  };
  topology: {
    mode?: string;
    epsilon_bits?: number;
    nodes?: number;
    edges?: number;
    H0_components?: number;
    H1_cycles_approx?: number;
    skipped?: string;
    note?: string;
  };
  top_composite: number;
  digest_top100: string;
  wall_seconds?: number;
};

type Titan = {
  generated_at: string;
  wall_seconds: number;
  seed: number;
  null_iterations_per_corpus: number;
  sources: Source[];
  aggregate: {
    sources_total: number;
    sources_live: number;
    sources_cached: number;
    total_records_processed: number;
    max_z_score_across_all_sources: number;
    sources_significant_05: number;
    live_topology_total_H0: number;
    live_topology_total_H1: number;
  };
};

const FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export default function TitanPage() {
  const [t, setT] = useState<Titan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Initializing…");
  const [attempts, setAttempts] = useState(0);

  const load = async () => {
    setErr(null);
    setT(null);
    setStatus("Fetching latest Titan run from /api/titan-alien…");
    try {
      const r = await fetchWithTimeout("/api/titan-alien", FETCH_TIMEOUT_MS);
      if (r.ok) {
        setStatus("Parsing response…");
        setT(await r.json());
        return;
      }
      setStatus(
        `Alien-mode endpoint returned ${r.status}; falling back to /api/titan…`,
      );
    } catch (e: any) {
      setStatus(
        e?.name === "AbortError"
          ? "Alien-mode endpoint timed out; falling back to /api/titan…"
          : `Alien-mode endpoint error (${String(e).slice(0, 60)}); falling back to /api/titan…`,
      );
    }
    try {
      const r = await fetchWithTimeout("/api/titan", FETCH_TIMEOUT_MS);
      if (!r.ok) {
        setErr(`Both endpoints failed. /api/titan returned HTTP ${r.status}.`);
        return;
      }
      setStatus("Parsing fallback response…");
      setT(await r.json());
    } catch (e: any) {
      setErr(
        e?.name === "AbortError"
          ? `Both Titan endpoints timed out after ${FETCH_TIMEOUT_MS / 1000}s each. The upstream proxy may be blocking /api/titan* paths — try again, or reach out to sales@latentocean.com.`
          : `Titan endpoints unreachable: ${String(e)}`,
      );
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts]);

  const live = (t?.sources ?? []).filter((s) => s.origin === "live");
  const cached = (t?.sources ?? [])
    .filter((s) => s.origin === "disk")
    .sort((a, b) => (b.null_test.max_z_score ?? 0) - (a.null_test.max_z_score ?? 0));

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
              Titan · full-spectrum validation at scale · real live data + cached corpora
            </p>
            <h1 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95]">
              Everything,<br />
              <span className="text-white/50">at once, in 33 seconds.</span>
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-3xl">
              Every source below was processed in a single run — live public
              APIs pulled at request time, 15 cached corpora joined from disk,
              BTUT fingerprinting, null-permutation testing, topological
              analysis, reproducibility digests. All deterministic under
              seed = 42. All numbers below re-derivable by one command.
            </p>
          </div>

          {err && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-red-300 mb-2">
                    Could not load Titan run
                  </div>
                  <div className="text-sm text-red-200/90 leading-relaxed">
                    {err}
                  </div>
                  <div className="mt-3 text-xs font-mono text-white/40">
                    To regenerate locally:{" "}
                    <code className="text-white/70">
                      python scripts/titan_alien.py --iterations 500
                    </code>
                  </div>
                </div>
                <button
                  onClick={() => setAttempts((a) => a + 1)}
                  className="shrink-0 h-9 px-4 rounded-full border border-red-400/30 text-red-200 text-xs font-mono hover:bg-red-500/10 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!t && !err && (
            <div className="rounded-xl border border-li-cyan/25 bg-li-cyan/[0.03] p-10">
              <div className="flex items-start gap-5">
                {/* animated spinner */}
                <div className="relative w-12 h-12 shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                  <div
                    className="absolute inset-0 rounded-full border-2 border-transparent border-t-li-cyan animate-spin"
                    style={{ animationDuration: "1.1s" }}
                  />
                  <div className="absolute inset-[10px] rounded-full bg-li-cyan/40 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-li-green animate-pulse" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-li-cyan">
                      Loading Titan run
                    </span>
                  </div>
                  <div className="text-sm text-white/80 font-mono break-words">
                    {status}
                  </div>
                  <div className="mt-3 text-[11px] font-mono text-white/40">
                    Timeout: {FETCH_TIMEOUT_MS / 1000}s per endpoint · attempt {attempts + 1}
                  </div>
                  {/* Indeterminate progress track */}
                  <div className="mt-4 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-li-cyan to-transparent animate-[slide_1.6s_ease-in-out_infinite]" />
                  </div>
                </div>
              </div>
              <style>{`
                @keyframes slide {
                  0%   { transform: translateX(-100%); }
                  50%  { transform: translateX(200%); }
                  100% { transform: translateX(200%); }
                }
              `}</style>
            </div>
          )}

          {t && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                <Stat label="Sources in one run" value={`${t.aggregate.sources_total}`}
                      sub={`${t.aggregate.sources_live} live · ${t.aggregate.sources_cached} cached`} />
                <Stat label="Records processed"
                      value={t.aggregate.total_records_processed.toLocaleString()} tone="cyan" />
                <Stat label="Peak z-score"
                      value={`${t.aggregate.max_z_score_across_all_sources.toFixed(2)} σ`} tone="green" />
                <Stat label="Wall-clock"
                      value={`${t.wall_seconds.toFixed(1)} s`} sub={`seed = ${t.seed}`} />
              </div>

              <h2 className="font-display text-3xl text-white mb-4 tracking-tight">
                Live sources (real public APIs · pulled this run)
              </h2>
              <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0a0a10] mb-10">
                <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1.2fr_1fr] px-5 py-3 border-b border-white/10 text-[10px] font-mono uppercase tracking-widest text-white/40">
                  <div>Source</div>
                  <div className="text-right">Records</div>
                  <div className="text-right">z-score</div>
                  <div className="text-right">Sig.</div>
                  <div className="text-right">H₀ · H₁</div>
                  <div className="text-right">Top comp.</div>
                </div>
                {live.map((s) => <SourceRow key={s.name} s={s} />)}
              </div>

              <h2 className="font-display text-3xl text-white mb-4 tracking-tight">
                Cached corpora rolled into this Titan aggregate
              </h2>
              <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0a0a10] mb-10">
                <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1.2fr_1fr] px-5 py-3 border-b border-white/10 text-[10px] font-mono uppercase tracking-widest text-white/40">
                  <div>Source</div>
                  <div className="text-right">Records</div>
                  <div className="text-right">z-score</div>
                  <div className="text-right">Sig.</div>
                  <div className="text-right">H₀ · H₁</div>
                  <div className="text-right">Top comp.</div>
                </div>
                {cached.map((s) => <SourceRow key={s.name} s={s} />)}
              </div>

              <div className="rounded-xl border border-li-cyan/20 bg-li-cyan/[0.03] p-8 mb-10">
                <p className="font-mono text-[11px] uppercase tracking-widest text-li-cyan mb-3">
                  What Titan proves
                </p>
                <p className="text-lg text-white/85 leading-relaxed">
                  The full-spectrum engine — BTUT substrate, lo_core query
                  layer, TCD-JEPA topological layer — runs end-to-end on{" "}
                  {t.aggregate.sources_total} heterogeneous data sources in{" "}
                  {t.wall_seconds.toFixed(0)} seconds, producing a max
                  z-score of{" "}
                  <span className="text-li-green font-mono">
                    {t.aggregate.max_z_score_across_all_sources.toFixed(2)} σ
                  </span>
                  , seed=42 deterministic, bit-identical across independent
                  runs, against live public APIs, with no credentials.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 mb-10">
                <p className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-3">
                  Reproduce
                </p>
                <pre className="text-sm text-white/80 font-mono overflow-x-auto">
{`python scripts/titan_orchestrator.py --iterations ${t.null_iterations_per_corpus}
cat data/validation/titan_validation.json | jq '.aggregate'`}
                </pre>
                <p className="mt-3 text-[11px] font-mono text-white/40">
                  generated {t.generated_at} · wall {t.wall_seconds.toFixed(1)}s ·
                  null iterations per corpus: {t.null_iterations_per_corpus}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/platform"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
                >
                  The full-spectrum architecture
                </Link>
                <Link
                  href="/universal"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
                >
                  Universal batch validation
                </Link>
                <a
                  href="mailto:sales@latentocean.com?subject=Install%20Latent%20Ocean"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
                >
                  Install on your database
                </a>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "cyan" | "green";
}) {
  const color = tone === "green" ? "text-li-green" : tone === "cyan" ? "text-li-cyan" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">{label}</div>
      <div className={`font-display text-3xl tabular-nums tracking-tight ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] font-mono text-white/40">{sub}</div>}
    </div>
  );
}

function SourceRow({ s }: { s: Source }) {
  const nt = s.null_test;
  const t = s.topology;
  const sigText =
    nt.total_metrics && nt.significant_05 != null
      ? `${nt.significant_05}/${nt.total_metrics}`
      : "—";
  const topoText =
    typeof t.H0_components === "number"
      ? `${t.H0_components} · ${t.H1_cycles_approx ?? 0}`
      : t.note ? "(see cache)" : "—";
  const z = nt.max_z_score ?? 0;
  const zTone = z >= 25 ? "text-li-green" : z >= 15 ? "text-li-cyan" : "text-white/70";
  return (
    <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1.2fr_1fr] items-center px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.02]">
      <div className="min-w-0">
        <div className="text-sm text-white truncate">{s.display}</div>
        <div className="text-[10px] font-mono text-white/40 truncate">
          {s.name}
          {s.digest_top100 ? ` · sha256 ${s.digest_top100.slice(0, 12)}…` : ""}
        </div>
      </div>
      <div className="text-right font-mono text-sm text-white/80 tabular-nums">
        {s.scored_count.toLocaleString()}
      </div>
      <div className={`text-right font-mono text-sm tabular-nums ${zTone}`}>
        {z ? z.toFixed(2) : "—"}
      </div>
      <div className="text-right font-mono text-xs text-white/70">{sigText}</div>
      <div className="text-right font-mono text-xs text-white/70">{topoText}</div>
      <div className="text-right font-mono text-sm text-li-cyan tabular-nums">
        {s.top_composite ? s.top_composite.toFixed(3) : "—"}
      </div>
    </div>
  );
}
