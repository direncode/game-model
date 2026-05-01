"use client";

import { useEffect, useMemo, useState } from "react";

// DecadeTrajectoryWidget
//
// 180 years of Southern discourse. Each decade gets:
//   - a column whose height = number of BTUT survivors from that decade
//   - a stacked composition by collection
//   - a drift score = Hamming distance from the previous decade's centroid
//
// The visualization is two stacked SVG layers on a shared decade x-axis.
// Top layer: stacked bar of collection composition. Bottom layer: drift
// curve.

type Decade = {
  decade: number;
  count: number;
  centroid_fp48Hex: string;
  drift_from_prev: number;
  collections: Record<string, number>;
};

type ShowcaseData = {
  showcase: string;
  decade_centroids?: Decade[];
};

const COLLECTION_PALETTE: Record<string, string> = {
  "North American Slave Narratives":               "#7DD3FC",
  "First-Person Narratives of the American South": "#A78BFA",
  "Library of Southern Literature":                 "#FCD34D",
  "The Church in the Southern Black Community":    "#34D399",
};

const COLLECTION_ORDER = [
  "North American Slave Narratives",
  "First-Person Narratives of the American South",
  "Library of Southern Literature",
  "The Church in the Southern Black Community",
];

function colorFor(collection: string): string {
  return COLLECTION_PALETTE[collection] ?? "rgba(255,255,255,0.45)";
}

function shortName(c: string): string {
  if (c.startsWith("North American")) return "Slave Narratives";
  if (c.startsWith("First-Person"))   return "First-Person";
  if (c.startsWith("Library"))        return "Library";
  if (c.startsWith("The Church"))     return "Church";
  return c;
}

type Props = {
  showcase?: string;
  compact?: boolean;
};

export function DecadeTrajectoryWidget({ showcase = "docsouth", compact = false }: Props) {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/range-public/showcase/${showcase}`, { cache: "force-cache" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [showcase]);

  const decades = data?.decade_centroids ?? [];
  const maxCount = useMemo(() => decades.reduce((m, d) => Math.max(m, d.count), 0), [decades]);
  const maxDrift = useMemo(() => decades.reduce((m, d) => Math.max(m, d.drift_from_prev), 0), [decades]);

  if (err) return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.04] p-5 font-mono text-[11px] text-rose-300">{err}</div>;
  if (!data || decades.length === 0) {
    return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">Loading time-axis analysis …</div>;
  }

  const W = 920;
  const H = 260;
  const PAD_L = 36;
  const PAD_R = 16;
  const PAD_T = 14;
  const PAD_B = 36;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const colWidth = innerW / decades.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            180 years of structural composition · 1730s &rarr; 1940s
          </span>
          <span className="font-mono text-[10px] text-white/35 tabular-nums">
            {decades.length} decades · n_max = {maxCount}
          </span>
        </div>

        {/* SVG */}
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto" role="img">
            {/* Y-axis grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((p) => (
              <g key={p}>
                <line x1={PAD_L} y1={PAD_T + innerH * (1 - p)} x2={W - PAD_R} y2={PAD_T + innerH * (1 - p)} stroke="rgba(255,255,255,0.04)" />
                <text x={PAD_L - 6} y={PAD_T + innerH * (1 - p) + 3} textAnchor="end" fontSize="9" fontFamily="ui-monospace, monospace" fill="rgba(255,255,255,0.28)">
                  {Math.round(maxCount * p)}
                </text>
              </g>
            ))}

            {/* Stacked bars */}
            {decades.map((d, i) => {
              let y = PAD_T + innerH;
              const x = PAD_L + i * colWidth + colWidth * 0.18;
              const w = colWidth * 0.64;
              const h = (d.count / (maxCount || 1)) * innerH;
              const stack: { col: string; pct: number }[] = COLLECTION_ORDER
                .map((col) => ({ col, n: d.collections[col] || 0 }))
                .filter((x) => x.n > 0)
                .map((x) => ({ col: x.col, pct: x.n / d.count }));
              return (
                <g key={d.decade}>
                  {stack.map((s, k) => {
                    const segH = s.pct * h;
                    y -= segH;
                    return (
                      <rect
                        key={k}
                        x={x}
                        y={y}
                        width={w}
                        height={segH}
                        fill={colorFor(s.col)}
                        opacity={0.85}
                      >
                        <title>{`${d.decade}s · ${shortName(s.col)} · ${(s.pct * 100).toFixed(0)}% of ${d.count} survivors`}</title>
                      </rect>
                    );
                  })}
                  {/* Decade label */}
                  <text
                    x={x + w / 2}
                    y={H - PAD_B + 14}
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="ui-monospace, monospace"
                    fill={d.count >= maxCount * 0.4 ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.32)"}
                  >
                    {d.decade}
                  </text>
                  {/* Drift dot above the bar */}
                  {d.drift_from_prev > 0 && (
                    <circle cx={x + w / 2} cy={PAD_T + innerH - h - 8} r={Math.min(6, 2 + d.drift_from_prev)} fill="rgb(125, 211, 252)" opacity={0.8}>
                      <title>{`drift from ${d.decade - 10}s: ${d.drift_from_prev}/48 Hamming bits`}</title>
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Caption + legend */}
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap gap-3 font-mono text-[10.5px] text-white/65">
            {COLLECTION_ORDER.map((c) => (
              <div key={c} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: colorFor(c) }} />
                <span>{shortName(c)}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "rgb(125, 211, 252)" }} />
              <span>centroid drift (Hamming bits)</span>
            </div>
          </div>
          <div className="font-mono text-[10px] text-white/35">
            max drift: {maxDrift} / 48
          </div>
        </div>
      </div>

      {!compact && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/55 leading-relaxed">
          <span className="text-white/85">What this shows.</span> Bar height
          is how many BTUT survivors were drawn from that decade. Color
          composition is which DocSouth collection contributed.{" "}
          {maxDrift <= 4 ? (
            <>The dots above each column report Hamming-bit drift from the
            previous decade's centroid; the maximum drift across all 19
            decade-to-decade transitions is just <span className="text-white/85">{maxDrift}/48 bits</span>.
            That is a real and unflattering finding: the engine's 48-bit
            structural fingerprint is dominated by stable archive-level
            features (genre, register, lexical baseline) and does not
            track the shifting topical concerns of 180 years of Southern
            writing. To capture decade-level drift, the formation pipeline
            would need a finer-grained or content-weighted fingerprint.</>
          ) : (
            <>Drift dots track Hamming-bit movement from one decade's
            centroid to the next, rising as Southern discourse moves
            structurally through {maxDrift} bits across the timeline.</>
          )}
        </div>
      )}
    </div>
  );
}
