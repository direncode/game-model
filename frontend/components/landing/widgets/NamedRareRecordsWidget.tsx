"use client";

import { useEffect, useState } from "react";

// NamedRareRecordsWidget
//
// The 10 most structurally singular records in DocSouth, named.
// Each row joins the BTUT survivor's recordIdx back to the corpus
// metadata (collection, author, title, year) and links to its
// canonical docsouth.unc.edu URL.

type Rare = {
  idx: number;
  fp48Hex: string;
  hamming_min: number;
  collection: string;
  author: string;
  title: string;
  year: string;
  filename: string;
  url: string;
};

type ShowcaseData = {
  showcase: string;
  named_rare?: Rare[];
};

const COLLECTION_PALETTE: Record<string, string> = {
  "North American Slave Narratives":               "#7DD3FC",
  "First-Person Narratives of the American South": "#A78BFA",
  "Library of Southern Literature":                 "#FCD34D",
  "The Church in the Southern Black Community":    "#34D399",
};

function shortCollection(c: string): string {
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

export function NamedRareRecordsWidget({ showcase = "docsouth", compact = false }: Props) {
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
  const rare = data?.named_rare ?? [];
  if (!data) return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">Loading rarest survivors …</div>;

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.7fr_1fr]"} gap-6 lg:gap-10`}>
      {/* List */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
        <div className="flex items-baseline justify-between px-5 py-3 border-b border-white/10">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            10 most structurally singular survivors · DocSouth
          </span>
          <span className="font-mono text-[10px] text-white/35 tabular-nums">
            ranked by Hamming-min over 32-record lookback
          </span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {rare.map((r, i) => {
            const color = COLLECTION_PALETTE[r.collection] ?? "rgba(255,255,255,0.45)";
            return (
              <a
                key={r.idx}
                href={r.url || `https://docsouth.unc.edu/`}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-5 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="font-mono text-[10px] text-white/30 tabular-nums w-6 text-right">{i + 1}.</span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                    {shortCollection(r.collection)}
                  </span>
                  {r.year && <span className="font-mono text-[10px] text-white/45 tabular-nums">{r.year}</span>}
                  <span className="ml-auto font-mono text-[10.5px] text-white/85 tabular-nums">
                    Hamming {r.hamming_min}/48
                  </span>
                </div>
                <div className="grid grid-cols-[24px_1fr] gap-3">
                  <span />
                  <div>
                    <div className="text-[14px] text-white/90 leading-snug font-medium">
                      {r.title || "[untitled]"}
                    </div>
                    <div className="text-[12px] text-white/55 leading-snug mt-0.5">
                      {r.author || "Unknown author"}
                    </div>
                    <div className="font-mono text-[10px] text-white/30 mt-1.5">
                      idx={r.idx} · fp48={r.fp48Hex}
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
            What "rare" means here
          </div>
          <p className="text-[13px] text-white/75 leading-snug">
            For each BTUT survivor, the engine measures the Hamming
            distance between its 48-bit fingerprint and the closest of
            the previous 32 survivors in record-index order. Larger
            Hamming distance means the record is structurally further
            from anything just before it in the corpus. The records at
            the top of this list sit deepest in their local rarity
            neighborhoods.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/45 leading-relaxed">
          Click any row to read the full text on docsouth.unc.edu. The
          fingerprint, the Hamming distance, and the source URL are all
          deterministic functions of the corpus + seed=42 — re-running
          formation produces the same ranking.
        </div>
      </div>
    </div>
  );
}
