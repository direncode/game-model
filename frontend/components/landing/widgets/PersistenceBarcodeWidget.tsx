"use client";

import { useEffect, useMemo, useState } from "react";

// Three colors that already exist in the app's TopologyViz palette.
const DIM = [
  { color: "#00d4ff", label: "H0", title: "Connected components", body: "Clusters in the corpus. Each bar is one cluster; the bar's length is how persistent that cluster is across structural scales. Long H0 bars are the genuine groups in the data; short ones are noise that fragments away." },
  { color: "#a855f7", label: "H1", title: "Structural cycles", body: "Closed loops in the structural graph — recurring patterns that close back on themselves. Long H1 bars are stable cycles that survive across scales; they are where the corpus has internal consistency." },
  { color: "#f59e0b", label: "H2", title: "Multi-dimensional voids", body: "Higher-order structural absences. Long H2 bars are persistent gaps — places where the corpus, despite being dense in some dimensions, leaves a hole in another. Often the most informative dimension on hindsight." },
];

// Demonstrative bars used when no `showcase` prop is supplied. When a
// showcase slug is provided, the widget fetches the real persistence bars
// from /api/range-public/showcase/<slug> and renders those instead.
const DEMO_BARS = [
  { dim: 0 as 0|1|2, birth: 0.00, death: 0.94 },
  { dim: 0 as 0|1|2, birth: 0.00, death: 0.78 },
  { dim: 0 as 0|1|2, birth: 0.05, death: 0.71 },
  { dim: 0 as 0|1|2, birth: 0.08, death: 0.62 },
  { dim: 0 as 0|1|2, birth: 0.12, death: 0.49 },
  { dim: 0 as 0|1|2, birth: 0.18, death: 0.31 },
  { dim: 0 as 0|1|2, birth: 0.22, death: 0.27 },
  { dim: 1 as 0|1|2, birth: 0.21, death: 0.84 },
  { dim: 1 as 0|1|2, birth: 0.34, death: 0.69 },
  { dim: 1 as 0|1|2, birth: 0.41, death: 0.58 },
  { dim: 1 as 0|1|2, birth: 0.45, death: 0.52 },
  { dim: 2 as 0|1|2, birth: 0.39, death: 0.81 },
  { dim: 2 as 0|1|2, birth: 0.52, death: 0.66 },
];

type Bar = { dim: 0 | 1 | 2; birth: number; death: number };

type ShowcaseData = {
  showcase: string;
  name?: string;
  persistence?: {
    bars: Bar[];
    counts: { H0: number; H1: number; H2: number };
    n_points: number;
    wall_seconds: number;
    library: string;
    metric: string;
    thresh?: number;
  };
};

type Props = {
  compact?: boolean;
  showcase?: string;             // e.g. "docsouth" — fetches /api/range-public/showcase/docsouth
  showcaseLabel?: string;        // override the displayed corpus name
  maxBars?: number;              // limit how many bars to display per dim (longest-persistence first)
};

export function PersistenceBarcodeWidget({ compact = false, showcase, showcaseLabel, maxBars = 12 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [showcaseData, setShowcaseData] = useState<ShowcaseData | null>(null);
  const [showcaseErr, setShowcaseErr] = useState<string | null>(null);

  useEffect(() => {
    if (!showcase) return;
    let cancelled = false;
    fetch(`/api/range-public/showcase/${showcase}`, { cache: "force-cache" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setShowcaseData(j); })
      .catch((e) => { if (!cancelled) setShowcaseErr(String(e)); });
    return () => { cancelled = true; };
  }, [showcase]);

  // Decide which bars to show.
  const isReal = !!showcase && !!showcaseData?.persistence?.bars?.length;
  const displayBars = useMemo<Bar[]>(() => {
    if (!isReal) return DEMO_BARS;
    const all = showcaseData!.persistence!.bars as Bar[];
    // Longest-persistence-first per dimension, capped at maxBars.
    const grouped: Bar[] = [0, 1, 2].flatMap((dim) =>
      all
        .filter((b) => b.dim === dim)
        .slice()
        .sort((a, b) => (b.death - b.birth) - (a.death - a.birth))
        .slice(0, maxBars)
    );
    return grouped;
  }, [isReal, showcaseData, maxBars]);

  const maxDeath = useMemo(() => Math.max(...displayBars.map((b) => b.death), 1), [displayBars]);
  const totalCounts = useMemo(() => {
    if (isReal) return showcaseData!.persistence!.counts;
    return {
      H0: DEMO_BARS.filter((b) => b.dim === 0).length,
      H1: DEMO_BARS.filter((b) => b.dim === 1).length,
      H2: DEMO_BARS.filter((b) => b.dim === 2).length,
    };
  }, [isReal, showcaseData]);
  const counts = { h0: totalCounts.H0, h1: totalCounts.H1, h2: totalCounts.H2 };

  const corpusName = isReal ? (showcaseLabel ?? showcaseData!.name ?? showcase!) : "generic corpus";
  const subline = isReal
    ? `${showcaseData!.persistence!.library} · ${showcaseData!.persistence!.metric} · n_points=${showcaseData!.persistence!.n_points}` +
      (typeof showcaseData!.persistence!.thresh === "number" ? ` · thresh=${showcaseData!.persistence!.thresh}` : "") +
      ` · ${showcaseData!.persistence!.wall_seconds.toFixed(1)}s wall`
    : "seed = 42";

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.4fr_1fr]"} gap-6 lg:gap-10`}>
      {/* Barcode */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Persistence barcode · {corpusName}
          </span>
          <span className="font-mono text-[10px] text-white/35">{subline}</span>
        </div>

        {/* Headline counts */}
        {isReal && (
          <div className="grid grid-cols-3 gap-px bg-white/[0.05] border border-white/10 rounded-xl overflow-hidden mb-6">
            <Stat label="H0 components" value={counts.h0.toString()} color={DIM[0].color} />
            <Stat label="H1 cycles"      value={counts.h1.toString()} color={DIM[1].color} />
            <Stat label="H2 voids"       value={counts.h2.toString()} color={DIM[2].color} />
          </div>
        )}

        {/* Bars */}
        <div className="space-y-1.5 mb-6">
          {displayBars.map((bar, i) => {
            const left = (bar.birth / maxDeath) * 100;
            const width = ((bar.death - bar.birth) / maxDeath) * 100;
            const dim = DIM[bar.dim];
            const active = hover === i;
            return (
              <div
                key={i}
                className="flex items-center gap-2 h-5 group cursor-default"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="font-mono text-[9px] w-7 text-right tabular-nums" style={{ color: dim.color }}>
                  {dim.label}
                </span>
                <div className="flex-1 relative h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="absolute h-full rounded-full transition-opacity"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 1)}%`,
                      backgroundColor: dim.color,
                      opacity: active ? 1 : 0.78,
                    }}
                  />
                </div>
                <span className="font-mono text-[9.5px] text-white/45 w-20 tabular-nums">
                  [{bar.birth.toFixed(2)}, {bar.death.toFixed(2)}]
                </span>
              </div>
            );
          })}
        </div>

        {/* Scale ticks */}
        <div className="flex items-center gap-2">
          <span className="w-7" />
          <div className="flex-1 flex justify-between font-mono text-[9px] text-white/25 tabular-nums">
            {isReal ? (
              <>
                <span>0</span><span>{(maxDeath / 4).toFixed(0)}</span><span>{(maxDeath / 2).toFixed(0)}</span><span>{(3 * maxDeath / 4).toFixed(0)}</span><span>{maxDeath.toFixed(0)}</span>
              </>
            ) : (
              <>
                <span>0.00</span><span>0.25</span><span>0.50</span><span>0.75</span><span>1.00</span>
              </>
            )}
          </div>
          <span className="w-20" />
        </div>
        <div className="mt-2 font-mono text-[9.5px] text-white/35 text-center">
          filtration scale ε {isReal ? "(Hamming bits)" : ""} →
        </div>

        {/* Determinism line */}
        <div className="mt-6 pt-5 border-t border-white/[0.06] font-mono text-[10.5px] text-white/45 leading-relaxed">
          {isReal
            ? <>The bars above were computed by ripser over {showcaseData!.persistence!.n_points} BTUT-survivor fingerprints from {corpusName}. Same seed, same corpus → byte-identical bars. The topology is a fact about the data, not an opinion of the model.</>
            : <>Same seed, same corpus → byte-identical bars. The topology is a fact about the data, not an opinion of the model.</>
          }
        </div>
        {showcaseErr && (
          <div className="mt-3 font-mono text-[10.5px] text-rose-400">showcase load failed: {showcaseErr}</div>
        )}
      </div>

      {/* Legend / explanations */}
      <div className="space-y-3">
        {DIM.map((d, i) => {
          const count = i === 0 ? counts.h0 : i === 1 ? counts.h1 : counts.h2;
          return (
            <div key={i} className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: d.color }}>
                  {d.label}
                </span>
                <span className="font-display text-[15px] text-white/85">{d.title}</span>
                <span className="ml-auto font-mono text-[10px] text-white/35 tabular-nums">{count} bars</span>
              </div>
              <p className="text-[12.5px] text-white/55 leading-snug">{d.body}</p>
            </div>
          );
        })}
        {!compact && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/40 leading-relaxed">
            Persistent homology has been a published academic field since
            Edelsbrunner / Letscher / Zomorodian (2002). The platform's
            contribution is the deterministic flow that produces these
            bars from arbitrary corpora — not the bars themselves.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-black p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">{label}</div>
      <div className="font-display text-[24px] tracking-[-0.02em] tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
