"use client";

import { useEffect, useState } from "react";

type Entity = {
  name: string;
  category: string;
  file_count: number;
  files: string[];
};

type Hub = {
  filename: string;
  title: string;
  author: string;
  year: string;
  collection: string;
  url: string;
  entity_count: number;
  top_entities: string[];
};

type Bridge = {
  entity: string;
  category: string;
  n_files: number;
  collections: string[];
};

type Pair = {
  entity_a: string;
  entity_b: string;
  count: number;
};

type Data = {
  total_records: number;
  total_files: number;
  total_entities: number;
  top_entities: Entity[];
  top_pairs: Pair[];
  hub_texts: Hub[];
  cross_collection_bridges: Bridge[];
  method?: string;
};

const COLLECTION_COLORS: Record<string, string> = {
  "North American Slave Narratives":               "#7DD3FC",
  "First-Person Narratives of the American South": "#A78BFA",
  "Library of Southern Literature":                 "#FCD34D",
  "The Church in the Southern Black Community":    "#34D399",
};

function shortColl(c: string): string {
  if (!c) return "";
  if (c.startsWith("North American")) return "Slave Narratives";
  if (c.startsWith("First-Person"))   return "First-Person";
  if (c.startsWith("Library"))        return "Library";
  if (c.startsWith("The Church"))     return "Church";
  return c;
}

function categoryColor(cat: string): string {
  return cat === "person" ? "#A78BFA" :
         cat === "place" ? "#7DD3FC" :
         cat === "ship" ? "#FCD34D" :
         cat === "institution" ? "#34D399" :
         "rgba(255,255,255,0.4)";
}

export function ConstellationsWidget() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"entities" | "hubs" | "bridges" | "pairs">("hubs");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/range-public/showcase/docsouth-constellations", { cache: "force-cache" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, []);

  if (err) return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.04] p-5 font-mono text-[11px] text-rose-300">{err}</div>;
  if (!data) return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">Loading constellations …</div>;

  return (
    <div className="space-y-5">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
        <Stat label="records scanned"     value={data.total_records.toLocaleString()} />
        <Stat label="source texts"        value={data.total_files.toLocaleString()} />
        <Stat label="unique entities"     value={data.total_entities.toLocaleString()} />
        <Stat label="top hubs (5+ ents)"  value={data.hub_texts.length.toString()} highlight />
      </div>

      {/* Tab strip */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
        <div className="flex items-stretch border-b border-white/10 bg-white/[0.02]">
          {([
            { id: "hubs",     label: "Hub texts" },
            { id: "bridges",  label: "Cross-collection bridges" },
            { id: "entities", label: "Top entities" },
            { id: "pairs",    label: "Co-occurrence pairs" },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.18em] transition-colors ${
                tab === t.id ? "bg-black text-white border-b border-white" : "text-white/45 hover:text-white/85"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {tab === "hubs" && (
            <div className="divide-y divide-white/[0.04]">
              {data.hub_texts.map((h) => (
                <a
                  key={h.filename}
                  href={h.url || `https://docsouth.unc.edu/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-baseline gap-3 mb-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLLECTION_COLORS[h.collection] ?? "rgba(255,255,255,0.35)" }} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                      {shortColl(h.collection)}
                    </span>
                    {h.year && <span className="font-mono text-[10px] text-white/45 tabular-nums">{h.year}</span>}
                    <span className="ml-auto font-mono text-[10.5px] text-white tabular-nums">
                      {h.entity_count} entities
                    </span>
                  </div>
                  <div className="text-[14px] text-white/90 leading-snug font-medium">{h.title || "[untitled]"}</div>
                  <div className="text-[12px] text-white/55 leading-snug mt-0.5">{h.author || "Unknown"}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {h.top_entities.slice(0, 12).map((e) => (
                      <span key={e} className="inline-flex items-center h-6 px-2 rounded-full font-mono text-[10px] bg-white/[0.04] text-white/65">
                        {e}
                      </span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          )}

          {tab === "bridges" && (
            <div className="divide-y divide-white/[0.04]">
              {data.cross_collection_bridges.map((b) => (
                <div key={b.entity} className="px-5 py-3">
                  <div className="flex items-baseline gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(b.category) }} />
                    <span className="font-mono text-[12px] text-white/85 flex-1 min-w-0 truncate">{b.entity}</span>
                    <span className="font-mono text-[10px] text-white/45 tabular-nums">{b.n_files} texts</span>
                    <span className="font-mono text-[10px] text-white/45">{b.collections.length} collections</span>
                  </div>
                  <div className="ml-5 mt-1 flex flex-wrap gap-1.5">
                    {b.collections.map((c) => (
                      <span key={c} className="inline-flex items-center h-5 px-2 rounded-full font-mono text-[9.5px]" style={{ backgroundColor: `${COLLECTION_COLORS[c] ?? "#777"}1f`, color: COLLECTION_COLORS[c] ?? "rgba(255,255,255,0.65)" }}>
                        {shortColl(c)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "entities" && (
            <div className="divide-y divide-white/[0.04]">
              {data.top_entities.map((e) => (
                <div key={e.name} className="px-5 py-2.5 flex items-baseline gap-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(e.category) }} />
                  <span className="font-mono text-[12px] text-white/85 flex-1 min-w-0 truncate">{e.name}</span>
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/35 w-20 text-right">{e.category}</span>
                  <span className="font-mono text-[10px] text-white/85 tabular-nums w-16 text-right">{e.file_count}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "pairs" && (
            <div className="divide-y divide-white/[0.04]">
              {data.top_pairs.map((p, i) => (
                <div key={i} className="px-5 py-2.5 flex items-baseline gap-3">
                  <span className="font-mono text-[10.5px] text-white/85 flex-1 truncate">{p.entity_a}</span>
                  <span className="font-mono text-[10.5px] text-white/35">↔</span>
                  <span className="font-mono text-[10.5px] text-white/85 flex-1 truncate">{p.entity_b}</span>
                  <span className="font-mono text-[10px] text-white tabular-nums w-12 text-right">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.method && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/55 leading-relaxed">
          <span className="text-white/85">Method.</span> {data.method}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-black p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">{label}</div>
      <div className={`font-display text-[20px] tracking-[-0.02em] tabular-nums ${highlight ? "text-white" : "text-white/85"}`}>{value}</div>
    </div>
  );
}
