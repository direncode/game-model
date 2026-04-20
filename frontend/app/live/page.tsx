"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

type Row = {
  composite: number;
  anomaly: number;
  reconstruction: number;
  diversity: number;
  fingerprint_prefix: string;
};

type QuakeRow = Row & {
  id: string;
  time: string;
  place: string;
  magnitude: number | null;
  depth_km: number | null;
};

type CryptoRow = Row & {
  id: string;
  symbol: string;
  name: string;
  price_usd: number;
  change_1h_pct: number | null;
  change_24h_pct: number | null;
  change_7d_pct: number | null;
  market_cap_usd: number;
  ath_pct: number | null;
};

type StreamEnvelope<T> = {
  source: string;
  source_url: string;
  fetched_at: string;
  upstream_fetch_ms: number;
  stream_history_size: number;
  total_events_in_feed?: number;
  total_assets?: number;
  ranked_top: T[];
  primitive: string;
  determinism: { seed: number };
};

type NullTestResult = {
  stream: string;
  history_size: number;
  K?: number;
  n_iterations?: number;
  true_top_k_isolation?: number;
  null?: { mean: number; std: number; p95: number; p99: number; p999: number };
  z_score?: number;
  significant_0_05?: boolean;
  significant_0_01?: boolean;
  significant_0_001?: boolean;
  status?: string;
  min_required?: number;
};

const POLL_MS = 20_000;

export default function LivePage() {
  const [quakes, setQuakes] = useState<StreamEnvelope<QuakeRow> | null>(null);
  const [crypto, setCrypto] = useState<StreamEnvelope<CryptoRow> | null>(null);
  const [nullTests, setNullTests] = useState<Record<string, NullTestResult | null>>({});
  const [err, setErr] = useState<{ q?: string; c?: string }>({});
  const [tick, setTick] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const pull = async () => {
    try {
      const r = await fetch("/api/live/quakes", { cache: "no-store" });
      const j = await r.json();
      if (r.ok) setQuakes(j);
      else setErr((e) => ({ ...e, q: j?.error ?? `HTTP ${r.status}` }));
    } catch (e) {
      setErr((s) => ({ ...s, q: String(e) }));
    }
    try {
      const r = await fetch("/api/live/crypto", { cache: "no-store" });
      const j = await r.json();
      if (r.ok) setCrypto(j);
      else setErr((e) => ({ ...e, c: j?.error ?? `HTTP ${r.status}` }));
    } catch (e) {
      setErr((s) => ({ ...s, c: String(e) }));
    }
    // Kick the null-test on each stream after the stream itself is updated.
    // The test needs at least 20 history records; the endpoint returns a
    // status marker if we poll too early.
    for (const s of ["quakes", "crypto"]) {
      try {
        const r = await fetch(`/api/live/null-test/${s}?n=200&k=10`, { cache: "no-store" });
        const j = await r.json();
        setNullTests((prev) => ({ ...prev, [s]: j }));
      } catch (e) {
        setNullTests((prev) => ({ ...prev, [s]: null }));
      }
    }
    setTick((t) => t + 1);
  };

  useEffect(() => {
    pull();
    timerRef.current = setInterval(pull, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="mb-10 flex items-start justify-between gap-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
                Live pipelines · real-time external feeds · universal fingerprint primitive
              </p>
              <h1 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95]">
                Real-time.<br />
                <span className="text-white/50">Really real.</span>
              </h1>
              <p className="mt-6 text-lg text-white/60 max-w-3xl">
                Two streaming sources — USGS global seismicity and CoinGecko top-100 markets —
                fetched live, hashed through the same 48-bit rotation-ensemble fingerprint,
                scored against a per-stream rolling history, and ranked by composite score.
                One engine, two radically different domains, both updating every 20 seconds.
              </p>
            </div>
            <button
              onClick={pull}
              className="shrink-0 h-10 px-5 rounded-full border border-white/20 text-white/80 text-sm hover:text-white hover:border-white/30 transition-colors font-mono"
              title="Force refresh both streams now"
            >
              Refresh now
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            <StreamHeader
              title="USGS · global seismicity"
              sub="earthquake.usgs.gov — all_hour feed"
              env={quakes}
              err={err.q}
              tick={tick}
            />
            <StreamHeader
              title="CoinGecko · top-100 markets"
              sub="api.coingecko.com — USD, cap-ranked"
              env={crypto}
              err={err.c}
              tick={tick}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-white/10 bg-[#0a0a10] overflow-hidden">
              <div className="grid grid-cols-[40px_2fr_60px_60px_60px] px-4 py-2 border-b border-white/10 text-[10px] font-mono uppercase tracking-widest text-white/40">
                <div>#</div>
                <div>Event</div>
                <div className="text-right">Mag</div>
                <div className="text-right">Km</div>
                <div className="text-right">Score</div>
              </div>
              {(quakes?.ranked_top ?? []).map((q, i) => (
                <QuakeItem key={q.id} q={q} rank={i + 1} />
              ))}
              {!quakes && !err.q && (
                <div className="p-8 text-center text-sm text-white/40">Fetching…</div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0a0a10] overflow-hidden">
              <div className="grid grid-cols-[40px_2fr_80px_60px_60px] px-4 py-2 border-b border-white/10 text-[10px] font-mono uppercase tracking-widest text-white/40">
                <div>#</div>
                <div>Asset</div>
                <div className="text-right">Price</div>
                <div className="text-right">24h</div>
                <div className="text-right">Score</div>
              </div>
              {(crypto?.ranked_top ?? []).map((c, i) => (
                <CryptoItem key={c.id} c={c} rank={i + 1} />
              ))}
              {!crypto && !err.c && (
                <div className="p-8 text-center text-sm text-white/40">Fetching…</div>
              )}
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NullTestCard label="USGS seismicity" result={nullTests["quakes"]} />
            <NullTestCard label="CoinGecko markets" result={nullTests["crypto"]} />
          </div>

          <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-3">
              What you're watching
            </p>
            <p className="text-sm text-white/70 leading-relaxed">
              Every row above is a record fetched <em>just now</em> from a public real-time
              feed, hashed into a 48-bit fingerprint by rotation-ensemble SHA-256 under
              seed=42, and scored against its stream's rolling history (kept in-memory on
              this Node worker). The composite score is identical in shape to the one
              validated on the 15 cached corpora at z up to 30.37σ — the same primitive,
              adapted for one-pass streaming. Poll cadence: every {POLL_MS / 1000}s.
            </p>
            <p className="mt-4 text-[11px] font-mono text-white/40">
              This is genuinely live. Refresh the page and you will likely see different
              rankings because the underlying feeds have updated.
            </p>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/universal"
              className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
            >
              15-corpora batch universality
            </Link>
            <Link
              href="/watchlist"
              className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
            >
              EDGAR top-50
            </Link>
            <Link
              href="/validation"
              className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
            >
              Commercial validation
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StreamHeader({
  title,
  sub,
  env,
  err,
  tick,
}: {
  title: string;
  sub: string;
  env: StreamEnvelope<any> | null;
  err?: string;
  tick: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="font-display text-xl text-white tracking-tight">{title}</div>
          <div className="text-xs font-mono text-white/40 mt-0.5">{sub}</div>
        </div>
        <div className="inline-flex items-center gap-2 h-6 px-2.5 rounded-full bg-li-green/15 text-li-green text-[10px] font-mono uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-li-green animate-pulse" />
          Live · tick {tick}
        </div>
      </div>
      {err ? (
        <div className="text-xs font-mono text-red-300">upstream error: {err}</div>
      ) : env ? (
        <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
          <Mini label="Fetched" value={new Date(env.fetched_at).toLocaleTimeString()} />
          <Mini label="Upstream" value={`${env.upstream_fetch_ms}ms`} />
          <Mini label="Feed size" value={String(env.total_events_in_feed ?? env.total_assets ?? 0)} />
          <Mini label="History" value={String(env.stream_history_size)} />
        </div>
      ) : (
        <div className="text-xs font-mono text-white/40">Fetching…</div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white/40">{label}</div>
      <div className="text-white/90 tabular-nums truncate">{value}</div>
    </div>
  );
}

function QuakeItem({ q, rank }: { q: QuakeRow; rank: number }) {
  const hot = q.composite >= 0.7;
  return (
    <div
      className={`grid grid-cols-[40px_2fr_60px_60px_60px] items-center px-4 py-2.5 border-b border-white/[0.03] ${
        hot ? "bg-li-cyan/[0.04]" : ""
      }`}
    >
      <div className="text-xs font-mono text-white/40 tabular-nums">#{rank}</div>
      <div className="min-w-0">
        <div className="text-sm text-white truncate">{q.place || q.id}</div>
        <div className="text-[10px] font-mono text-white/40">
          {new Date(q.time).toLocaleTimeString()} · {q.fingerprint_prefix.slice(0, 12)}…
        </div>
      </div>
      <div className="text-right font-mono text-sm text-white/90 tabular-nums">
        {q.magnitude?.toFixed(1) ?? "—"}
      </div>
      <div className="text-right font-mono text-xs text-white/70 tabular-nums">
        {q.depth_km != null ? Math.round(q.depth_km) : "—"}
      </div>
      <div className="text-right font-mono text-sm text-li-cyan tabular-nums">
        {q.composite.toFixed(3)}
      </div>
    </div>
  );
}

function NullTestCard({
  label,
  result,
}: {
  label: string;
  result: NullTestResult | null | undefined;
}) {
  if (!result) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-2">
          Null-permutation test · {label}
        </div>
        <div className="text-sm text-white/50">Awaiting first poll…</div>
      </div>
    );
  }
  if (result.status === "insufficient_history") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="font-mono text-[11px] uppercase tracking-widest text-white/40">
            Null-permutation test · {label}
          </div>
          <div className="text-[10px] font-mono text-white/30">
            history {result.history_size}/{result.min_required ?? 20}
          </div>
        </div>
        <div className="text-sm text-white/60">
          Accumulating stream history. The falsifiability test activates once
          the rolling window has ≥ {result.min_required ?? 20} records.
        </div>
      </div>
    );
  }
  const z = result.z_score ?? 0;
  const tone =
    result.significant_0_001
      ? "text-li-green border-li-green/30 bg-li-green/[0.04]"
      : result.significant_0_05
      ? "text-li-cyan border-li-cyan/30 bg-li-cyan/[0.04]"
      : "text-white/70 border-white/10 bg-white/[0.02]";
  return (
    <div className={`rounded-xl border p-5 ${tone}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-1">
            Null-permutation test · {label}
          </div>
          <div className="text-sm text-white/80">
            Fisher-Yates bit-shuffle preserving bit count · N={result.n_iterations} · seed 42
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl tabular-nums">{z.toFixed(2)} σ</div>
          <div className="text-[10px] font-mono opacity-70">
            {result.significant_0_001
              ? "p < 0.001"
              : result.significant_0_01
              ? "p < 0.01"
              : result.significant_0_05
              ? "p < 0.05"
              : "not sig."}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <MiniNullStat label="True top-K" value={(result.true_top_k_isolation ?? 0).toFixed(3)} />
        <MiniNullStat label="Null mean" value={(result.null?.mean ?? 0).toFixed(3)} />
        <MiniNullStat label="Null p95" value={(result.null?.p95 ?? 0).toFixed(3)} />
        <MiniNullStat label="History" value={String(result.history_size)} />
      </div>
    </div>
  );
}

function MiniNullStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white/40">{label}</div>
      <div className="text-white/90">{value}</div>
    </div>
  );
}

function CryptoItem({ c, rank }: { c: CryptoRow; rank: number }) {
  const ch = c.change_24h_pct ?? 0;
  const chTone =
    ch >= 5 ? "text-li-green" : ch <= -5 ? "text-red-400" : "text-white/60";
  return (
    <div className="grid grid-cols-[40px_2fr_80px_60px_60px] items-center px-4 py-2.5 border-b border-white/[0.03]">
      <div className="text-xs font-mono text-white/40 tabular-nums">#{rank}</div>
      <div className="min-w-0">
        <div className="text-sm text-white truncate">
          {c.name} <span className="text-white/40 font-mono text-xs">{c.symbol?.toUpperCase()}</span>
        </div>
        <div className="text-[10px] font-mono text-white/40">
          mcap ${Intl.NumberFormat("en", { notation: "compact" }).format(c.market_cap_usd ?? 0)} ·{" "}
          {c.fingerprint_prefix.slice(0, 12)}…
        </div>
      </div>
      <div className="text-right font-mono text-xs text-white/90 tabular-nums">
        ${c.price_usd?.toLocaleString(undefined, { maximumFractionDigits: c.price_usd > 1 ? 2 : 6 })}
      </div>
      <div className={`text-right font-mono text-xs tabular-nums ${chTone}`}>
        {ch >= 0 ? "+" : ""}
        {ch.toFixed(1)}%
      </div>
      <div className="text-right font-mono text-sm text-li-cyan tabular-nums">
        {c.composite.toFixed(3)}
      </div>
    </div>
  );
}
