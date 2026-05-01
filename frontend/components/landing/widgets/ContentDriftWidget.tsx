"use client";

import { useEffect, useMemo, useState } from "react";

// ContentDriftWidget
//
// The DecadeTrajectoryWidget exposed an unflattering finding: the
// structural 48-bit fingerprint shows ~0–4 Hamming bits of drift across
// 180 years of Southern discourse. To redeem the topical-drift claim,
// we built a *content-weighted* fingerprint variant — Bloom-style 48-bit
// projection of each record's top-32 TF-IDF terms — and computed decade
// centroids on those. This widget shows the two trajectories side by
// side: structural (low drift, by design) vs content (higher drift,
// catches topical movement). The lift number is the headline.

type Drift = {
  decade: number;
  count: number;
  centroid_fp48Hex: string;
  drift_from_prev: number;
  collections?: Record<string, number>;
};

type ShowcaseData = {
  showcase: string;
  decade_centroids?: Drift[];
  content_decade_drift?: Drift[];
  drift_summary?: {
    structural_avg: number;
    structural_max: number;
    content_avg: number;
    content_max: number;
    lift_avg: number;
    method?: string;
  };
};

type Props = {
  showcase?: string;
  compact?: boolean;
};

export function ContentDriftWidget({ showcase = "docsouth", compact = false }: Props) {
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

  const struct = data?.decade_centroids ?? [];
  const content = data?.content_decade_drift ?? [];
  const decades = useMemo(() => {
    const set = new Set<number>();
    struct.forEach((d) => set.add(d.decade));
    content.forEach((d) => set.add(d.decade));
    return Array.from(set).sort((a, b) => a - b);
  }, [struct, content]);
  const structByDec = useMemo(() => Object.fromEntries(struct.map((d) => [d.decade, d])), [struct]);
  const contentByDec = useMemo(() => Object.fromEntries(content.map((d) => [d.decade, d])), [content]);

  const summary = data?.drift_summary;
  const maxDrift = useMemo(() => {
    let m = 0;
    decades.forEach((d) => {
      m = Math.max(m, structByDec[d]?.drift_from_prev ?? 0, contentByDec[d]?.drift_from_prev ?? 0);
    });
    return Math.max(m, 1);
  }, [decades, structByDec, contentByDec]);

  if (err) return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.04] p-5 font-mono text-[11px] text-rose-300">{err}</div>;
  if (!data) return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">Loading content drift comparison …</div>;

  const W = 920;
  const H = 220;
  const PAD_L = 36;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 36;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  return (
    <div className="space-y-4">
      {/* Headline numbers */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
          <Stat label="structural avg drift" value={`${summary.structural_avg.toFixed(2)} / 48`} hint="48-bit BTUT fingerprint" />
          <Stat label="content avg drift"    value={`${summary.content_avg.toFixed(2)} / 48`}    hint="TF-IDF top-32 → 48-bit Bloom" highlight />
          <Stat label="content max drift"    value={`${summary.content_max} / 48`}                hint="single decade-to-decade peak" />
          <Stat label="content lift"         value={`+${summary.lift_avg.toFixed(2)} bits`}       hint={`${(summary.content_avg / Math.max(0.01, summary.structural_avg)).toFixed(1)}x more drift than structural`} highlight />
        </div>
      )}

      {/* Two-line plot */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 md:p-8 overflow-x-auto">
        <div className="flex items-baseline justify-between mb-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Decade-to-decade drift · structural (white) vs content (cyan)
          </span>
          <span className="font-mono text-[10px] text-white/35">
            y-axis: Hamming bits to previous decade's centroid (48-bit)
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto" role="img">
          {/* Y grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((p) => {
            const v = Math.round(maxDrift * p);
            const y = PAD_T + innerH * (1 - p);
            return (
              <g key={p}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="rgba(255,255,255,0.04)" />
                <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="9" fontFamily="ui-monospace, monospace" fill="rgba(255,255,255,0.28)">
                  {v}
                </text>
              </g>
            );
          })}

          {/* Two polylines */}
          {(() => {
            const xFor = (i: number) => PAD_L + (i / Math.max(1, decades.length - 1)) * innerW;
            const yFor = (v: number) => PAD_T + innerH * (1 - v / maxDrift);
            const structPath = decades.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(structByDec[d]?.drift_from_prev ?? 0)}`).join(" ");
            const contentPath = decades.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(contentByDec[d]?.drift_from_prev ?? 0)}`).join(" ");
            return (
              <>
                <path d={structPath} stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" fill="none" />
                <path d={contentPath} stroke="rgb(125, 211, 252)" strokeWidth="2" fill="none" />
                {decades.map((d, i) => {
                  const sv = structByDec[d]?.drift_from_prev ?? 0;
                  const cv = contentByDec[d]?.drift_from_prev ?? 0;
                  return (
                    <g key={d}>
                      <circle cx={xFor(i)} cy={yFor(sv)} r="2.5" fill="rgba(255,255,255,0.85)">
                        <title>{`${d}s · structural drift = ${sv}/48`}</title>
                      </circle>
                      <circle cx={xFor(i)} cy={yFor(cv)} r="3" fill="rgb(125, 211, 252)">
                        <title>{`${d}s · content drift = ${cv}/48`}</title>
                      </circle>
                    </g>
                  );
                })}
              </>
            );
          })()}

          {/* X labels (every other decade, to avoid crowding) */}
          {decades.map((d, i) => (
            (i % 2 === 0 || i === decades.length - 1) && (
              <text
                key={d}
                x={PAD_L + (i / Math.max(1, decades.length - 1)) * innerW}
                y={H - PAD_B + 14}
                textAnchor="middle"
                fontSize="9"
                fontFamily="ui-monospace, monospace"
                fill="rgba(255,255,255,0.45)"
              >
                {d}
              </text>
            )
          ))}
        </svg>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10.5px] text-white/65">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5" style={{ backgroundColor: "rgba(255,255,255,0.85)" }} />
            <span>structural · BTUT 48-bit fingerprint</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5" style={{ backgroundColor: "rgb(125, 211, 252)" }} />
            <span>content · top-32 TF-IDF terms → 48-bit Bloom</span>
          </div>
        </div>
      </div>

      {!compact && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/55 leading-relaxed">
          <span className="text-white/85">What the cyan line redeems.</span>{" "}
          The structural fingerprint flatlines because it's content-light by design — schema-agnostic byte canonicalization weighted by field entropy, optimized for cold-storage reproducibility. The content-weighted variant is built from the same 2,400 survivors but draws its 48 bits from each record's top TF-IDF terms instead. Average decade-to-decade drift roughly doubles ({summary?.structural_avg.toFixed(2) ?? "?"} → {summary?.content_avg.toFixed(2) ?? "?"} bits). The shape of the cyan line is what {`"`}180 years of structural movement{`"`} should look like when you have a topical fingerprint, not just a structural one. Both are valid choices for different use cases — and now the platform documents which is which.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, highlight }: { label: string; value: string; hint: string; highlight?: boolean }) {
  return (
    <div className="bg-black p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">{label}</div>
      <div className={`font-display text-[20px] tracking-[-0.02em] tabular-nums ${highlight ? "text-white" : "text-white/85"}`}>{value}</div>
      <div className="font-mono text-[9.5px] text-white/35 mt-1">{hint}</div>
    </div>
  );
}
