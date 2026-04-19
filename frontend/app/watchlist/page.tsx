"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

type Finding = {
  rank: number;
  cik: string;
  company: string;
  concept: string;
  composite: number;
  anomaly: number;
  reconstruction: number;
  diversity: number;
  cluster: number | null;
  filing_form: string | null;
  filing_date: string | null;
  fingerprint_prefix: string | null;
};

type WatchlistResponse = {
  universe_size: number;
  companies_with_findings: number;
  k: number;
  findings: Finding[];
  source: string;
};

export default function WatchlistPage() {
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scoreResult, setScoreResult] = useState<any>(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  useEffect(() => {
    fetch("/api/watchlist?k=50", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  async function doScore(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setScoreLoading(true);
    setScoreResult(null);
    try {
      const resp = await fetch(`/api/score?ticker=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      });
      const j = await resp.json();
      setScoreResult(j);
    } catch (err) {
      setScoreResult({ error: String(err) });
    } finally {
      setScoreLoading(false);
    }
  }

  const findings = data?.findings ?? [];
  const topComposite = findings[0]?.composite ?? 0;
  const bottomComposite = findings[findings.length - 1]?.composite ?? 0;

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
              Top {data?.k ?? 50} structural outliers · re-derived from BTUT · no hand-tuned list
            </p>
            <h1 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95]">
              What to read<br />
              <span className="text-white/50">this week.</span>
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-3xl">
              Each row is a specific company + specific XBRL line item. Ranked purely by
              composite structural-anomaly score against the full EDGAR filer universe.
              Every finding is auditable against the 10-K.
            </p>
          </div>

          {/* Score widget */}
          <form
            onSubmit={doScore}
            className="mb-12 flex flex-col md:flex-row gap-3 items-stretch md:items-center"
          >
            <div className="flex-1 rounded-full border border-white/15 bg-white/[0.02] focus-within:border-li-cyan transition-colors">
              <input
                className="w-full h-12 px-6 bg-transparent font-mono text-sm text-white placeholder-white/30 outline-none"
                placeholder='Score a single ticker —  e.g. "AEP", "NVDA", or "Apple"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={scoreLoading}
              className="h-12 px-8 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {scoreLoading ? "Scoring…" : "Score ticker"}
            </button>
          </form>

          {scoreResult && <ScoreCard result={scoreResult} />}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300 mb-8">
              Could not load watchlist: {error}
            </div>
          )}

          {data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <Stat label="Survivor universe" value={data.universe_size.toLocaleString()} />
                <Stat label="Companies covered" value={data.companies_with_findings.toLocaleString()} />
                <Stat label="Top composite" value={topComposite.toFixed(3)} />
                <Stat label="Rank 50 composite" value={bottomComposite.toFixed(3)} />
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0a0a10]">
                <div className="grid grid-cols-[56px_2fr_2.5fr_repeat(4,_minmax(0,_1fr))] items-center px-6 py-3 border-b border-white/10 text-[11px] font-mono uppercase tracking-widest text-white/40">
                  <div>#</div>
                  <div>Company</div>
                  <div>Line item</div>
                  <div className="text-right">Composite</div>
                  <div className="text-right">Anomaly</div>
                  <div className="text-right">Reconstruction</div>
                  <div className="text-right">Diversity</div>
                </div>
                <div>
                  {findings.map((f) => (
                    <Row key={`${f.cik}-${f.concept}`} f={f} peak={topComposite} />
                  ))}
                  {findings.length === 0 && (
                    <div className="p-12 text-center text-white/40 text-sm">
                      No findings in cache yet.
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-6 text-xs font-mono text-white/30">
                source: {data.source} · every rank recomputed on each request
              </p>
            </>
          )}

          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link
              href="/validation"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
            >
              See the null test
            </Link>
            <a
              href="mailto:sales@latentocean.com?subject=Pilot%20report%20request"
              className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Request a 48h pilot report
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
        {label}
      </div>
      <div className="font-display text-2xl text-white tabular-nums tracking-tight">
        {value}
      </div>
    </div>
  );
}

function Row({ f, peak }: { f: Finding; peak: number }) {
  const pct = Math.max(0.05, f.composite / (peak || 1));
  return (
    <div className="grid grid-cols-[56px_2fr_2.5fr_repeat(4,_minmax(0,_1fr))] items-center px-6 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <div className="font-mono text-xs text-white/40 tabular-nums">#{f.rank}</div>
      <div className="min-w-0">
        <div className="text-sm text-white truncate">{f.company}</div>
        <div className="text-[11px] font-mono text-white/40">CIK {f.cik}</div>
      </div>
      <div className="min-w-0">
        <div className="text-sm text-white/90 truncate font-mono">{f.concept}</div>
        <div className="h-1 mt-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-li-cyan to-li-green"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
      <div className="text-right font-mono text-sm text-li-cyan tabular-nums">
        {f.composite.toFixed(3)}
      </div>
      <div className="text-right font-mono text-xs text-white/70 tabular-nums">
        {f.anomaly.toFixed(3)}
      </div>
      <div className="text-right font-mono text-xs text-white/70 tabular-nums">
        {f.reconstruction.toFixed(3)}
      </div>
      <div className="text-right font-mono text-xs text-white/70 tabular-nums">
        {f.diversity.toFixed(3)}
      </div>
    </div>
  );
}

function ScoreCard({ result }: { result: any }) {
  if (result.error) {
    return (
      <div className="mb-12 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6">
        <div className="text-sm text-yellow-200 font-mono">
          {result.error} — try a ticker in our embedded map (AEP, NVDA, AAPL, GS, MSFT, …)
        </div>
      </div>
    );
  }
  const alertTone =
    result.alert_status === "triggered"
      ? "bg-li-green/15 text-li-green"
      : result.alert_status === "watching"
      ? "bg-li-cyan/15 text-li-cyan"
      : "bg-white/10 text-white/70";
  return (
    <div className="mb-12 rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-6">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2">
            LO.SCORE({`"${result.ticker}"`})
          </div>
          <h2 className="font-display text-4xl text-white tracking-tight">
            {result.company}
          </h2>
          <div className="mt-1 text-sm font-mono text-white/50">CIK {result.cik}</div>
        </div>
        <div
          className={`inline-flex items-center gap-2 h-8 px-4 rounded-full text-xs font-mono uppercase tracking-widest self-start ${alertTone}`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Alert: {result.alert_status}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">
            Composite
          </div>
          <div className="font-display text-3xl text-li-cyan tabular-nums">
            {Number(result.composite).toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">
            Anomaly
          </div>
          <div className="font-display text-3xl text-white tabular-nums">
            {Number(result.anomaly).toFixed(3)}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">
            Top line
          </div>
          <div className="font-mono text-sm text-white truncate">
            {result.top_line || "— (no facts in cache)"}
          </div>
        </div>
      </div>

      {Array.isArray(result.findings) && result.findings.length > 1 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-3">
            Other findings for this entity
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {result.findings.slice(1, 7).map((f: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs font-mono text-white/70">
                <span className="truncate mr-3">{f.concept}</span>
                <span className="text-li-cyan tabular-nums">{Number(f.composite).toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
