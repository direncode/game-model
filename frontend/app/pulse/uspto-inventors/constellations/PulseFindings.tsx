"use client";

import { useEffect, useState } from "react";

type Finding = {
  id: number;
  category: string;
  title: string;
  summary: string;
  uspto_url?: string;
  metrics?: Record<string, unknown>;
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
  singular_inventor_candidates:  "Singular candidates",
  cross_ipc_polymaths:           "Cross-IPC polymaths",
  structurally_singular_records: "Structurally singular",
  decade_productivity_shifts:    "Decade shifts",
  baseline_comparison:           "Baselines",
};

export function PulseFindings() {
  const [data, setData] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/range-public/showcase/pulse-findings", { cache: "force-cache" })
      .then(async (r) => {
        if (r.status === 503) {
          throw new Error("Pulse findings catalog has not been generated yet. Run scripts/pulse_constellations.py after the formation completes.");
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
          pulse findings pending
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
      <div className="mb-10 text-sm text-white/65 max-w-3xl leading-relaxed">
        <p className="mb-3">{data.subtitle}</p>
        <p className="text-white/45 text-xs"><span className="text-white/65">Method.</span> {data.method}</p>
      </div>

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
            {f.uspto_url && (
              <a
                href={f.uspto_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] text-cyan-300/80 hover:text-cyan-200 transition-colors"
              >
                {f.uspto_url} ↗
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
