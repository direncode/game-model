"use client";

import { useEffect, useMemo, useState } from "react";

type Finding = {
  id: number;
  category: string;
  title: string;
  summary: string;
  docsouth_nodes?: string[];
  outward_links?: string[];
  citations?: string[];
};

type Catalog = {
  title: string;
  subtitle?: string;
  findings: Finding[];
  categories?: Record<string, string>;
};

const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  within_docsouth:    { label: "Within DocSouth",       color: "#7DD3FC" },
  broader_history:    { label: "Broader Black & Southern History", color: "#A78BFA" },
  unc_institutional:  { label: "UNC Institutional",     color: "#FCD34D" },
  present_future:     { label: "Present & Future",      color: "#34D399" },
};

export function FindingsCatalogWidget() {
  const [data, setData] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1]));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/range-public/showcase/docsouth-findings", { cache: "force-cache" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let out = data.findings;
    if (filter !== "all") out = out.filter((f) => f.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((f) =>
        f.title.toLowerCase().includes(q) ||
        f.summary.toLowerCase().includes(q) ||
        (f.docsouth_nodes ?? []).some((n) => n.toLowerCase().includes(q)) ||
        (f.outward_links ?? []).some((n) => n.toLowerCase().includes(q))
      );
    }
    return out;
  }, [data, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.findings.length ?? 0 };
    for (const f of data?.findings ?? []) c[f.category] = (c[f.category] ?? 0) + 1;
    return c;
  }, [data]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    if (!data) return;
    setExpanded(new Set(data.findings.map((f) => f.id)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  if (err) return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.04] p-5 font-mono text-[11px] text-rose-300">{err}</div>;
  if (!data) return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">Loading findings catalog …</div>;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            {data.findings.length} findings · {filtered.length} shown
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={expandAll} className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55 hover:text-white border border-white/10 hover:border-white/30 rounded-full px-3 py-1 transition-colors">
              expand all
            </button>
            <button type="button" onClick={collapseAll} className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55 hover:text-white border border-white/10 hover:border-white/30 rounded-full px-3 py-1 transition-colors">
              collapse all
            </button>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`inline-flex items-center h-7 px-3 rounded-full font-mono text-[10px] tracking-wide transition-colors ${filter === "all" ? "bg-white text-black" : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] border border-white/10"}`}
          >
            all · {counts.all ?? 0}
          </button>
          {Object.entries(CATEGORY_LABEL).map(([id, cfg]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full font-mono text-[10px] tracking-wide transition-colors ${filter === id ? "bg-white text-black" : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] border border-white/10"}`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
              {cfg.label} · {counts[id] ?? 0}
            </button>
          ))}
          <input
            type="search"
            placeholder="search title / summary / node …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] h-8 px-3 rounded-full bg-white/[0.04] border border-white/10 focus:border-white/30 text-[11.5px] text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Findings list */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
        <div className="divide-y divide-white/[0.04]">
          {filtered.map((f) => {
            const cfg = CATEGORY_LABEL[f.category] ?? { label: f.category, color: "rgba(255,255,255,0.35)" };
            const isOpen = expanded.has(f.id);
            return (
              <div key={f.id} className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => toggle(f.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-mono text-[10px] text-white/35 tabular-nums w-8">№{f.id.toString().padStart(3, "0")}</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/45">
                      {cfg.label}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-white/35">
                      {isOpen ? "−" : "+"}
                    </span>
                  </div>
                  <h3 className="ml-11 font-display text-[16px] md:text-[18px] tracking-[-0.01em] text-white leading-snug">
                    {f.title}
                  </h3>
                </button>

                {isOpen && (
                  <div className="ml-11 mt-3 space-y-3">
                    <p className="text-[13.5px] text-white/75 leading-relaxed">{f.summary}</p>

                    {f.docsouth_nodes && f.docsouth_nodes.length > 0 && (
                      <div>
                        <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-1.5">
                          DocSouth nodes
                        </div>
                        <div className="space-y-0.5">
                          {f.docsouth_nodes.map((n, i) => (
                            <div key={i} className="font-mono text-[10.5px] text-white/65">{n}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {f.outward_links && f.outward_links.length > 0 && (
                      <div>
                        <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-1.5">
                          Outward links · external nodes traced
                        </div>
                        <div className="space-y-0.5">
                          {f.outward_links.map((n, i) => (
                            <div key={i} className="font-mono text-[10.5px] text-white/55">{n}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {f.citations && f.citations.length > 0 && (
                      <div>
                        <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-1.5">
                          Sources
                        </div>
                        <div className="space-y-0.5">
                          {f.citations.map((c, i) => (
                            <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="block font-mono text-[10.5px] text-cyan-300/85 hover:text-cyan-200 truncate">
                              {c}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35 text-center">
          no findings match the current filter
        </div>
      )}
    </div>
  );
}
