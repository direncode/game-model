"use client";

import { useEffect, useState } from "react";

// CrossCollectionBleedWidget
//
// "The engine recovers 75% of the lift over chance" is one finding.
// "The remaining 25% is structured" is the deeper one. For each k-means
// class, this widget shows what the non-dominant collection breakdown
// looks like — answering, for class #7 specifically: which 49% of its
// 957 survivors aren't Slave Narratives, and what genres they come from.
// The pattern reveals where the engine identifies cross-collection
// rhetorical similarity.

type Bleed = {
  class_id: number;
  dominant: string;
  dominant_share: number;
  size: number;
  bleed_share: number;
  bleed_breakdown: Record<string, number>;
  bleed_year_range: [number, number] | null;
  bleed_authors: string[];
};

type ShowcaseData = {
  showcase: string;
  cross_collection_bleed?: Bleed[];
};

const COLLECTION_PALETTE: Record<string, string> = {
  "North American Slave Narratives":               "#7DD3FC",
  "First-Person Narratives of the American South": "#A78BFA",
  "Library of Southern Literature":                 "#FCD34D",
  "The Church in the Southern Black Community":    "#34D399",
};

function shortName(c: string): string {
  if (!c) return c;
  if (c.startsWith("North American")) return "Slave Narratives";
  if (c.startsWith("First-Person"))   return "First-Person";
  if (c.startsWith("Library"))        return "Library";
  if (c.startsWith("The Church") || c.startsWith("Church"))     return "Church";
  return c;
}

function colorFor(c: string): string {
  return COLLECTION_PALETTE[c] ??
    Object.entries(COLLECTION_PALETTE).find(([k]) => k.includes(c) || c.includes(k))?.[1] ??
    "rgba(255,255,255,0.45)";
}

type Props = {
  showcase?: string;
  compact?: boolean;
};

export function CrossCollectionBleedWidget({ showcase = "docsouth", compact = false }: Props) {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/range-public/showcase/${showcase}`, { cache: "force-cache" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setData(j);
        const top = (j.cross_collection_bleed ?? [])[0];
        if (top) setSelected(top.class_id);
      })
      .catch((e) => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [showcase]);

  if (err) return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.04] p-5 font-mono text-[11px] text-rose-300">{err}</div>;
  if (!data) return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">Loading bleed analysis …</div>;

  const bleeds = data.cross_collection_bleed ?? [];
  if (bleeds.length === 0) return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/45">No bleed data.</div>;

  const sel = bleeds.find((b) => b.class_id === selected) ?? bleeds[0];
  const totalSize = bleeds.reduce((s, b) => s + b.size, 0);

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1fr_1.4fr]"} gap-6 lg:gap-10`}>
      {/* Class list */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Classes · ranked by size
          </span>
          <span className="font-mono text-[10px] text-white/35 tabular-nums">
            {totalSize.toLocaleString()} survivors total
          </span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {bleeds.map((b) => {
            const active = b.class_id === sel.class_id;
            return (
              <button
                key={b.class_id}
                type="button"
                onClick={() => setSelected(b.class_id)}
                className={`w-full text-left px-5 py-3 transition-colors ${active ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
              >
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="font-mono text-[10px] text-white/35 tabular-nums w-8">
                    #{b.class_id.toString().padStart(2, "0")}
                  </span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorFor(b.dominant) }} />
                  <span className="font-mono text-[11px] text-white/85">
                    {shortName(b.dominant)}
                  </span>
                  <span className="ml-auto font-mono text-[10.5px] text-white/55 tabular-nums">{b.size}</span>
                </div>
                <div className="flex items-center gap-2 ml-11">
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="h-full" style={{ width: `${b.dominant_share * 100}%`, backgroundColor: colorFor(b.dominant), opacity: 0.85 }} />
                  </div>
                  <span className="font-mono text-[9.5px] text-white/45 tabular-nums w-12 text-right">{(b.dominant_share * 100).toFixed(0)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected class detail */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-4">
            Class #{sel.class_id.toString().padStart(2, "0")} · {sel.size} survivors · dominant: {sel.dominant}
          </div>

          {/* Stacked bar */}
          <div className="mb-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">
              composition
            </div>
            <div className="flex h-7 rounded-md overflow-hidden ring-1 ring-white/[0.06]">
              {(() => {
                const dom_n = Math.round(sel.size * sel.dominant_share);
                const segments: { col: string; n: number }[] = [
                  { col: sel.dominant, n: dom_n },
                  ...Object.entries(sel.bleed_breakdown).map(([k, v]) => ({ col: k, n: v })),
                ];
                segments.sort((a, b) => b.n - a.n);
                return segments.map((s, i) => {
                  const pct = (s.n / sel.size) * 100;
                  return (
                    <div
                      key={s.col + i}
                      className="h-full flex items-center justify-center"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: colorFor(s.col),
                        opacity: s.col === sel.dominant ? 0.95 : 0.55,
                      }}
                      title={`${shortName(s.col)}: ${s.n} (${pct.toFixed(0)}%)`}
                    >
                      {pct > 12 && (
                        <span className="font-mono text-[9.5px] text-black/85">{shortName(s.col)} · {pct.toFixed(0)}%</span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Headline numbers */}
          <div className="grid grid-cols-3 gap-px bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden mb-4">
            <Stat label="dominant" value={`${(sel.dominant_share * 100).toFixed(0)}%`} hint={shortName(sel.dominant)} />
            <Stat label="bleed" value={`${(sel.bleed_share * 100).toFixed(0)}%`} hint={`${Math.round(sel.size * sel.bleed_share)} non-dominant`} />
            <Stat
              label="year range"
              value={sel.bleed_year_range ? `${sel.bleed_year_range[0]}–${sel.bleed_year_range[1]}` : "—"}
              hint="of the bleed records"
            />
          </div>

          {/* Authors of the bleed */}
          {sel.bleed_authors && sel.bleed_authors.length > 0 && (
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">
                most-frequent bleed authors (top 5)
              </div>
              <div className="space-y-1">
                {sel.bleed_authors.map((a) => (
                  <div key={a} className="font-mono text-[11px] text-white/75">{a}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/55 leading-relaxed">
          <span className="text-white/85">Reading this honestly.</span>{" "}
          The engine groups records by structural fingerprint Hamming
          neighborhood, never by collection label. When a class draws
          50–65% of its members from one collection and the remaining
          third spreads roughly evenly across the other three, that's
          structural similarity that crosses the curatorial boundary —
          a testimonial register or rhetorical posture that recurs
          across genres. Class #7 is the largest such cluster: a
          first-person voice that the engine reads as one signal whether
          it's catalogued under Slave Narratives, First-Person
          Narratives, Library of Southern Literature, or Church
          writings.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-black p-3.5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-1.5">{label}</div>
      <div className="font-display text-[20px] tracking-[-0.02em] tabular-nums text-white">{value}</div>
      <div className="font-mono text-[9.5px] text-white/35 mt-1">{hint}</div>
    </div>
  );
}
