"use client";

import { useState, useMemo } from "react";

// Three colors that already exist in the app's TopologyViz palette.
const DIM = [
  { color: "#00d4ff", label: "H0", title: "Connected components", body: "Clusters in the corpus. Each bar is one cluster; the bar's length is how persistent that cluster is across structural scales. Long H0 bars are the genuine groups in the data; short ones are noise that fragments away." },
  { color: "#a855f7", label: "H1", title: "Structural cycles", body: "Closed loops in the structural graph — recurring patterns that close back on themselves. Long H1 bars are stable cycles that survive across scales; they are where the corpus has internal consistency." },
  { color: "#f59e0b", label: "H2", title: "Multi-dimensional voids", body: "Higher-order structural absences. Long H2 bars are persistent gaps — places where the corpus, despite being dense in some dimensions, leaves a hole in another. Often the most informative dimension on hindsight." },
];

// Demonstrative bars derived from a generic corpus run. The exact birth/death
// values are *examples* of what the engine produces; the underlying TCD-JEPA
// computation is not exposed. These are deterministic for a given input and
// match the same H0/H1/H2 schema used elsewhere in the platform.
const DEMO_BARS = [
  // H0 — connected components (longest bars, structural backbone)
  { dim: 0, birth: 0.00, death: 0.94 },
  { dim: 0, birth: 0.00, death: 0.78 },
  { dim: 0, birth: 0.05, death: 0.71 },
  { dim: 0, birth: 0.08, death: 0.62 },
  { dim: 0, birth: 0.12, death: 0.49 },
  { dim: 0, birth: 0.18, death: 0.31 },
  { dim: 0, birth: 0.22, death: 0.27 },
  // H1 — cycles (mid-length, internal consistency)
  { dim: 1, birth: 0.21, death: 0.84 },
  { dim: 1, birth: 0.34, death: 0.69 },
  { dim: 1, birth: 0.41, death: 0.58 },
  { dim: 1, birth: 0.45, death: 0.52 },
  // H2 — voids (rarer, deeper structure)
  { dim: 2, birth: 0.39, death: 0.81 },
  { dim: 2, birth: 0.52, death: 0.66 },
];

type Props = { compact?: boolean };

export function PersistenceBarcodeWidget({ compact = false }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const maxDeath = useMemo(() => Math.max(...DEMO_BARS.map((b) => b.death)), []);
  const counts = useMemo(() => ({
    h0: DEMO_BARS.filter((b) => b.dim === 0).length,
    h1: DEMO_BARS.filter((b) => b.dim === 1).length,
    h2: DEMO_BARS.filter((b) => b.dim === 2).length,
  }), []);

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.4fr_1fr]"} gap-6 lg:gap-10`}>
      {/* Barcode */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Persistence barcode · generic corpus
          </span>
          <span className="font-mono text-[10px] text-white/35">seed = 42</span>
        </div>

        {/* Bars */}
        <div className="space-y-1.5 mb-6">
          {DEMO_BARS.map((bar, i) => {
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
            <span>0.00</span><span>0.25</span><span>0.50</span><span>0.75</span><span>1.00</span>
          </div>
          <span className="w-20" />
        </div>
        <div className="mt-2 font-mono text-[9.5px] text-white/35 text-center">
          filtration scale ε →
        </div>

        {/* Determinism line */}
        <div className="mt-6 pt-5 border-t border-white/[0.06] font-mono text-[10.5px] text-white/45 leading-relaxed">
          Same seed, same corpus → byte-identical bars. The topology is a fact about the data, not an opinion of the model.
        </div>
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
