"use client";

import { useEffect, useState } from "react";

// ClusterPurityWidget
//
// Pulls the precomputed showcase analysis and renders a stacked bar per
// k-means class showing how the BTUT survivors in that class break down
// by source-archive collection. The single number that matters is at the
// top: weighted purity. Chance baseline for 4 collections is 0.25 — anything
// above that means the engine recovers some of the curatorial structure
// without ever being told what the collections are.

type ShowcaseData = {
  showcase: string;
  cluster_purity?: {
    weighted_purity: number;
    classes: {
      class_id: number;
      size: number;
      dominant_collection: string;
      dominant_share: number;
      collections: Record<string, number>;
    }[];
  };
  collections?: Record<string, number>;
  survivors_total?: number;
};

const COLLECTION_PALETTE: Record<string, string> = {
  "North American Slave Narratives":               "#7DD3FC",
  "First-Person Narratives of the American South": "#A78BFA",
  "Library of Southern Literature":                 "#FCD34D",
  "The Church in the Southern Black Community":    "#34D399",
};

function colorFor(collection: string): string {
  return COLLECTION_PALETTE[collection] ?? "rgba(255,255,255,0.45)";
}

function shortName(c: string): string {
  if (c.startsWith("North American")) return "Slave Narratives";
  if (c.startsWith("First-Person"))   return "First-Person";
  if (c.startsWith("Library"))        return "Library";
  if (c.startsWith("The Church"))     return "Church";
  return c.length > 18 ? c.slice(0, 18) + "…" : c;
}

type Props = {
  showcase?: string;
  compact?: boolean;
};

export function ClusterPurityWidget({ showcase = "docsouth", compact = false }: Props) {
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

  if (err) return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.04] p-5 font-mono text-[11px] text-rose-300">{err}</div>;
  if (!data || !data.cluster_purity) {
    return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">Loading cluster analysis …</div>;
  }

  const purity = data.cluster_purity;
  const totalSurvivors = data.survivors_total ?? purity.classes.reduce((s, c) => s + c.size, 0);
  const collections = Object.keys(data.collections ?? {});
  const weighted = purity.weighted_purity;
  const chance = collections.length > 0 ? Number((1 / collections.length).toFixed(3)) : 0.25;
  const lift = weighted - chance;

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.6fr_1fr]"} gap-6 lg:gap-10`}>
      {/* Left: confusion matrix */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Cluster purity by collection
          </span>
          <span className="font-mono text-[10px] text-white/35 tabular-nums">
            {purity.classes.length} classes · {totalSurvivors.toLocaleString()} survivors
          </span>
        </div>

        {/* Headline number */}
        <div className="mb-6 grid grid-cols-3 gap-px bg-white/[0.05] border border-white/10 rounded-xl overflow-hidden">
          <Stat label="weighted purity" value={weighted.toFixed(3)} hint={`chance = ${chance.toFixed(2)} · 4 collections`} highlight />
          <Stat label="lift over chance" value={`${lift >= 0 ? "+" : ""}${lift.toFixed(3)}`} hint="absolute purity − 1/k" />
          <Stat label="dominant col." value={shortName(purity.classes[0]?.dominant_collection ?? "—")} hint={`largest class: ${purity.classes[0]?.size ?? 0}`} />
        </div>

        {/* Stacked bars per class */}
        <div className="space-y-2">
          {purity.classes.map((c) => {
            const cols = Object.entries(c.collections).sort((a, b) => b[1] - a[1]);
            return (
              <div key={c.class_id} className="grid grid-cols-[44px_1fr_60px] items-center gap-3">
                <span className="font-mono text-[10px] text-white/45 tabular-nums">#{c.class_id.toString().padStart(2, "0")}</span>
                <div className="flex h-6 rounded-md overflow-hidden ring-1 ring-white/[0.06]">
                  {cols.map(([col, n], i) => {
                    const pct = (n / c.size) * 100;
                    return (
                      <div
                        key={col}
                        title={`${shortName(col)}: ${n} (${pct.toFixed(0)}%)`}
                        className="h-full flex items-center justify-center"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: colorFor(col),
                          opacity: i === 0 ? 0.95 : 0.6,
                        }}
                      >
                        {pct > 18 && (
                          <span className="font-mono text-[9px] text-black/85 tabular-nums">{pct.toFixed(0)}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className="font-mono text-[10px] text-white/55 tabular-nums text-right">{c.size}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-5 border-t border-white/[0.06] flex flex-wrap gap-4">
          {Object.keys(COLLECTION_PALETTE).map((c) => (
            <div key={c} className="flex items-center gap-2 font-mono text-[10.5px] text-white/65">
              <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: colorFor(c) }} />
              <span>{shortName(c)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: caption */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
            What you are seeing
          </div>
          <p className="text-[13px] text-white/75 leading-snug">
            Each row is one of the 12 k-means classes the engine produced
            without ever being told which DocSouth collection a record
            belongs to. The horizontal bar shows the collection mix in
            that class. Solid blocks of one color mean the cluster
            recovered the curatorial boundary.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
            How to read the number
          </div>
          <p className="text-[13px] text-white/75 leading-snug">
            Weighted purity is the size-weighted average of each class's
            dominant-collection share. With 4 collections, random
            assignment would land at ~0.25. {weighted.toFixed(3)} is{" "}
            {lift > 0 ? <span className="text-emerald-300">{Math.round((lift / chance) * 100)}% above chance</span> : <span className="text-rose-300">below chance</span>}{" "}
            — the engine recovers archive structure unsupervised, but partially. The 9 novel classes the taxonomy reports are exactly the regions where the four collections overlap.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, highlight }: { label: string; value: string; hint: string; highlight?: boolean }) {
  return (
    <div className="bg-black p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">{label}</div>
      <div className={`font-display text-[20px] md:text-[22px] tracking-[-0.02em] tabular-nums ${highlight ? "text-white" : "text-white/85"}`}>{value}</div>
      <div className="font-mono text-[9.5px] text-white/35 mt-1">{hint}</div>
    </div>
  );
}
