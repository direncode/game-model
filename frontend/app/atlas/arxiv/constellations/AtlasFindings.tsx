"use client";

import { useEffect, useState } from "react";

type Finding = {
  id: number;
  category: string;
  title: string;
  summary: string;
  arxiv_url?: string;
  metrics?: Record<string, unknown>;
  examples?: { paper_id: string; title: string; archive: string }[];
  purity?: Record<string, unknown>;
};

type Catalog = {
  showcase: string;
  version: number;
  title: string;
  subtitle: string;
  method: string;
  categories: Record<string, string>;
  generated_at: string;
  n_findings: number;
  findings: Finding[];
};

const CATEGORY_LABEL: Record<string, string> = {
  structurally_singular_papers: "Structurally singular",
  candidate_emerged_clusters:   "Emergence candidates",
  interdisciplinary_bleed:      "Interdisciplinary bleed",
  decade_drift:                 "Decade drift",
  baseline_comparison:          "Baselines",
  structural_anachronisms:      "Anachronisms",
};

export function AtlasFindings() {
  const [data, setData] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/range-public/showcase/atlas-findings", { cache: "force-cache" })
      .then(async (r) => {
        if (r.status === 503) {
          throw new Error(
            "Atlas findings catalog has not been generated yet. Run scripts/arxiv_constellations.py after the formation completes.",
          );
        }
        if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
        return r.json();
      })
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setErr(String(e.message ?? e)); });
    return () => { cancelled = true; };
  }, []);

  if (err) {
    return (
      <div className="my-8 p-6 border border-amber-500/30 bg-amber-500/5 rounded-lg">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300/80 mb-2">
          atlas findings pending
        </p>
        <p className="text-white/70 text-sm leading-relaxed">{err}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="my-8 text-white/40 text-sm">Loading findings catalog…</div>;
  }

  const categories = Object.keys(data.categories);
  const filtered = activeCat
    ? data.findings.filter((f) => f.category === activeCat)
    : data.findings;
  const counts: Record<string, number> = {};
  data.findings.forEach((f) => { counts[f.category] = (counts[f.category] ?? 0) + 1; });

  return (
    <div>
      {/* Method block */}
      <div className="mb-10 text-sm text-white/65 max-w-3xl leading-relaxed">
        <p className="mb-3">{data.subtitle}</p>
        <p className="text-white/45 text-xs"><span className="text-white/65">Method.</span> {data.method}</p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8 font-mono text-[10.5px] uppercase tracking-[0.18em]">
        <button
          onClick={() => setActiveCat(null)}
          className={`inline-flex items-center h-7 px-3 rounded-full border transition-colors ${
            activeCat === null
              ? "bg-white text-black border-white"
              : "border-white/15 text-white/55 hover:text-white hover:border-white/30"
          }`}
        >
          all · {data.findings.length}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat === activeCat ? null : cat)}
            className={`inline-flex items-center h-7 px-3 rounded-full border transition-colors ${
              activeCat === cat
                ? "bg-white text-black border-white"
                : "border-white/15 text-white/55 hover:text-white hover:border-white/30"
            }`}
          >
            {CATEGORY_LABEL[cat] ?? cat} · {counts[cat] ?? 0}
          </button>
        ))}
      </div>

      {/* Findings list */}
      <div className="space-y-4">
        {filtered.map((f) => (
          <article key={f.id} className="border border-white/10 rounded-lg p-5">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="text-white text-base font-medium leading-snug">
                {f.id}. {f.title}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 shrink-0">
                {CATEGORY_LABEL[f.category] ?? f.category}
              </span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">{f.summary}</p>
            {f.arxiv_url && (
              <a
                href={f.arxiv_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] text-cyan-300/80 hover:text-cyan-200 transition-colors"
              >
                {f.arxiv_url} ↗
              </a>
            )}
            {f.examples && f.examples.length > 0 && (
              <div className="mt-3 text-[11px] font-mono text-white/45">
                examples:{" "}
                {f.examples.map((e, i) => (
                  <span key={i}>
                    <a
                      href={`https://arxiv.org/abs/${e.paper_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/65 hover:text-white"
                    >
                      {e.paper_id}
                    </a>
                    {i < f.examples!.length - 1 ? " · " : ""}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
