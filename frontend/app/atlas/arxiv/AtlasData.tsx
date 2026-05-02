"use client";

import { useEffect, useState } from "react";

// AtlasData
//
// Single client component that fetches the public Atlas artifact JSON from
// /api/range-public/showcase/atlas and renders the live data sections of
// the artifact page: purity, decade trajectory, bleed, named rare, baselines,
// emergence candidates, and verification block.
//
// All sections render either a loading state, a "not yet generated" 503 state,
// or the live data. The schema mirrors what scripts/arxiv_analyze.py emits
// (see docs/superpowers/specs/2026-05-02-atlas-arxiv-design.md for the full shape).

type Purity = {
  coarse_8_archive?: number;
  fine_subcategory?: number;
  rows?: { cluster: number; size: number; dominant: string; dominant_share: number; breakdown: Record<string, number> }[];
};

type DecadeRow = {
  decade: string;
  n_survivors: number;
  archive_share: Record<string, number>;
};

type BleedRow = {
  class_id: number;
  size: number;
  dominant: string;
  dominant_share: number;
  bleed_share: number;
  bleed_breakdown: Record<string, number>;
  bleed_year_range: [number, number] | null;
  bleed_examples: { paper_id: string; title: string; archive: string }[];
};

type RareRecord = {
  paper_id: string;
  title: string;
  year: number;
  primary_category: string;
  archive: string;
  min_hamming: number;
  arxiv_url: string;
};

type ClusterMeta = {
  cluster_id: number;
  size: number;
  median_year: number;
  year_spread: number;
  category_entropy: number;
};

type BaselinePanel = {
  K: number;
  chance: number;
  tfidf_kmeans: number;
  lda_argmax: number;
};

type AtlasArtifact = {
  showcase: string;
  kaggle_snapshot_date: string;
  corpus_input_sha256: string;
  corpus_sha256: string;
  corpus_records: number;
  corpus_bytes?: number;
  model_id: string;
  formed_at: string;
  formation_ms?: number;
  fingerprinter_mode?: string;
  effective_strategy?: string;
  coverage_pct?: number;
  response_digest: string;
  encrypted?: boolean;
  taxonomy_summary?: { classes: number; silhouette?: number; null_test_z?: number; novel_class_count?: number };
  purity?: Purity;
  decade_trajectory?: DecadeRow[];
  bleed_per_class?: BleedRow[];
  rare_records?: RareRecord[];
  cluster_meta?: ClusterMeta[];
  emergence_candidates?: ClusterMeta[];
  baseline_panel?: BaselinePanel;
  n_survivors?: number;
};

// Color palette for archives. Falls back to a neutral gray for unknown archives.
const ARCHIVE_PALETTE: Record<string, string> = {
  cs:        "#7DD3FC",
  math:      "#A78BFA",
  physics:   "#FCD34D",
  "q-bio":   "#34D399",
  "q-fin":   "#F472B6",
  stat:      "#FB923C",
  econ:      "#22D3EE",
  eess:      "#F87171",
  "hep-th":  "#C084FC",
  "astro-ph": "#FDE047",
  "cond-mat": "#A3E635",
  "gr-qc":    "#60A5FA",
};

function colorFor(archive: string): string {
  return ARCHIVE_PALETTE[archive] ?? "rgba(255,255,255,0.45)";
}

function pct(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function AtlasData() {
  const [data, setData] = useState<AtlasArtifact | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/range-public/showcase/atlas", { cache: "force-cache" })
      .then(async (r) => {
        if (r.status === 503) {
          throw new Error("Atlas artifact has not been generated yet. Run the harvester + analyze pipeline on EC2.");
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
      <div className="my-12 p-6 border border-amber-500/30 bg-amber-500/5 rounded-lg">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300/80 mb-2">
          atlas artifact pending
        </p>
        <p className="text-white/70 text-sm leading-relaxed">{err}</p>
        <p className="text-white/50 text-xs mt-3 leading-relaxed">
          The page renders prose and structure now. The live numbers will appear
          once <code className="text-white/70">scripts/arxiv_analyze.py</code> writes{" "}
          <code className="text-white/70">/data/formed_models/_public/arxiv.json</code>.
          See <code className="text-white/70">docs/superpowers/runbooks/2026-05-02-atlas-arxiv-runbook.md</code>.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="my-12 text-white/40 text-sm">Loading Atlas artifact…</div>
    );
  }

  return (
    <div className="space-y-16">
      <CorpusBlock data={data} />
      <PurityBlock data={data} />
      <DecadeBlock data={data} />
      <BleedBlock data={data} />
      <EmergenceBlock data={data} />
      <BaselinesBlock data={data} />
      <RareBlock data={data} />
      <VerificationBlock data={data} />
    </div>
  );
}

function CorpusBlock({ data }: { data: AtlasArtifact }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
      <Stat label="records" value={data.corpus_records?.toLocaleString() ?? "—"} />
      <Stat label="survivors" value={data.n_survivors?.toLocaleString() ?? "—"} />
      <Stat label="snapshot" value={data.kaggle_snapshot_date} />
      <Stat label="formed" value={data.formed_at?.slice(0, 10) ?? "—"} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-white/10 rounded p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-1 text-white text-lg">{value}</div>
    </div>
  );
}

function PurityBlock({ data }: { data: AtlasArtifact }) {
  const p = data.purity;
  if (!p?.rows?.length) return null;
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">
        Cluster purity vs. 8 archives: <span className="text-cyan-300">{pct(p.coarse_8_archive)}</span>
      </h3>
      <p className="text-white/55 text-sm mb-4">
        K-means at K={data.taxonomy_summary?.classes ?? "?"} on Hamming over the BTUT survivors.
        Fine-grained purity vs. ~152 primary subcategories: <span className="text-white/80">{pct(p.fine_subcategory)}</span>.
        Chance baseline (uniform-random label assignment): <span className="text-white/80">{pct(data.baseline_panel?.chance)}</span>.
      </p>
      <div className="space-y-2">
        {p.rows.slice(0, 12).map((row) => (
          <div key={row.cluster} className="flex items-center gap-3 text-xs">
            <span className="font-mono w-12 text-white/45">#{row.cluster}</span>
            <div className="flex-1 flex h-6 rounded overflow-hidden bg-white/5">
              {Object.entries(row.breakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([archive, n]) => {
                  const share = n / row.size;
                  return (
                    <div
                      key={archive}
                      title={`${archive}: ${n} (${(share * 100).toFixed(1)}%)`}
                      style={{ width: `${share * 100}%`, backgroundColor: colorFor(archive) }}
                    />
                  );
                })}
            </div>
            <span className="font-mono w-16 text-right text-white/55 tabular-nums">
              {row.size}
            </span>
            <span className="font-mono w-16 text-right text-white/70 tabular-nums">
              {(row.dominant_share * 100).toFixed(0)}%
            </span>
            <span className="font-mono w-20 text-white/45">{row.dominant}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecadeBlock({ data }: { data: AtlasArtifact }) {
  const decades = data.decade_trajectory;
  if (!decades?.length) return null;
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">Decade trajectory · 1990s → 2020s</h3>
      <p className="text-white/55 text-sm mb-4">
        Survivor count and per-decade archive share. Read across to see the
        structural reweighting of arXiv from the early-physics era to the
        cs/stat/eess-dominated 2020s.
      </p>
      <div className="space-y-3">
        {decades.map((d) => {
          const total = d.n_survivors;
          const sortedArchives = Object.entries(d.archive_share).sort(([, a], [, b]) => b - a);
          return (
            <div key={d.decade} className="flex items-center gap-3 text-xs">
              <span className="font-mono w-20 text-white/55">{d.decade}</span>
              <div className="flex-1 flex h-6 rounded overflow-hidden bg-white/5">
                {sortedArchives.map(([archive, share]) => (
                  <div
                    key={archive}
                    title={`${archive}: ${(share * 100).toFixed(1)}%`}
                    style={{ width: `${share * 100}%`, backgroundColor: colorFor(archive) }}
                  />
                ))}
              </div>
              <span className="font-mono w-20 text-right text-white/55 tabular-nums">
                {total.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-mono uppercase tracking-[0.14em]">
        {Object.entries(ARCHIVE_PALETTE).map(([archive, color]) => (
          <div key={archive} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-white/55">{archive}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BleedBlock({ data }: { data: AtlasArtifact }) {
  const bleed = data.bleed_per_class;
  if (!bleed?.length) return null;
  const sorted = [...bleed].sort((a, b) => b.bleed_share - a.bleed_share);
  const topBleed = sorted.slice(0, 8);
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">Cross-discipline bleed</h3>
      <p className="text-white/55 text-sm mb-4">
        Clusters where the dominant-archive grouping pulls in papers from other
        archives. The structural signature of cross-disciplinary discourse.
      </p>
      <div className="space-y-2">
        {topBleed.map((row) => (
          <div key={row.class_id} className="border border-white/10 rounded p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-white/55">
                cluster #{row.class_id} ({row.size} survivors)
              </span>
              <span className="font-mono text-white/70">
                dominant <span className="text-white">{row.dominant}</span> {Math.round(row.dominant_share * 100)}%
              </span>
              <span className="font-mono text-amber-300/80">
                bleed {Math.round(row.bleed_share * 100)}%
              </span>
            </div>
            {Object.keys(row.bleed_breakdown).length > 0 && (
              <div className="text-white/45 mt-1">
                bleed-out:{" "}
                {Object.entries(row.bleed_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([archive, n]) => `${archive} (${n})`)
                  .join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmergenceBlock({ data }: { data: AtlasArtifact }) {
  const candidates = data.emergence_candidates ?? [];
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">
        Emergence candidates: {candidates.length} cluster{candidates.length === 1 ? "" : "s"}
      </h3>
      <p className="text-white/55 text-sm mb-4">
        Clusters with median publication year ≥ 2015, year-spread ≤ 5, and
        Shannon entropy over primary categories ≥ 2.0. The structural signature
        of an emerging field. Atlas does not name what these clusters are —
        readers can inspect the centroid and rare-record exemplars and decide.
      </p>
      {candidates.length === 0 ? (
        <p className="text-white/40 text-sm italic">
          No clusters meet the young+tight+diverse threshold under this run.
          Honest disclosure: the signal is empty here.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {candidates.map((c) => (
            <div key={c.cluster_id} className="border border-white/10 rounded p-3 text-xs">
              <div className="font-mono text-white/55 mb-2">cluster #{c.cluster_id} · {c.size} survivors</div>
              <div className="grid grid-cols-3 gap-2 text-white/70">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">median year</div>
                  <div className="text-white">{c.median_year}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">year-spread</div>
                  <div className="text-white">{c.year_spread}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">cat entropy</div>
                  <div className="text-white">{c.category_entropy.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BaselinesBlock({ data }: { data: AtlasArtifact }) {
  const b = data.baseline_panel;
  const engine = data.purity?.coarse_8_archive;
  if (!b || engine === undefined) return null;
  const rows: { label: string; purity: number; note: string }[] = [
    { label: "chance", purity: b.chance, note: "uniform-random label assignment over 8 archives" },
    { label: "engine", purity: engine, note: "BTUT 48-bit fingerprint + KMeans on Hamming distance" },
    { label: "TF-IDF + KMeans", purity: b.tfidf_kmeans, note: `sklearn TfidfVectorizer (1-2 gram, 20k features) + KMeans, K=${b.K}` },
    { label: "LDA argmax", purity: b.lda_argmax, note: `sklearn LatentDirichletAllocation K=${b.K}, online, 20 iter, argmax → hard cluster` },
  ];
  const max = Math.max(...rows.map((r) => r.purity));
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">Baselines</h3>
      <p className="text-white/55 text-sm mb-4">
        Engine vs. TF-IDF + KMeans, vs. LDA, vs. chance. All measured against
        the same 8-archive gold via weighted purity. The engine is honest about
        its position relative to full-text NLP.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-xs">
            <span className="font-mono w-44 text-white/55">{r.label}</span>
            <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
              <div
                className="h-full bg-cyan-300/70"
                style={{ width: `${(r.purity / max) * 100}%` }}
              />
            </div>
            <span className="font-mono w-16 text-right text-white tabular-nums">
              {(r.purity * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RareBlock({ data }: { data: AtlasArtifact }) {
  const rare = data.rare_records;
  if (!rare?.length) return null;
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">Top-25 structurally rare papers</h3>
      <p className="text-white/55 text-sm mb-4">
        Survivors with the largest min-Hamming distance to any other survivor.
        Each row links to arxiv.org for direct verification.
      </p>
      <div className="space-y-1 font-mono text-xs">
        {rare.map((r, i) => (
          <a
            key={r.paper_id}
            href={r.arxiv_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-colors"
          >
            <span className="w-6 text-right text-white/40 tabular-nums">{i + 1}</span>
            <span className="w-12 text-cyan-300/80 tabular-nums">{r.min_hamming}/48</span>
            <span className="w-16 text-white/45 tabular-nums">{r.year || "—"}</span>
            <span className="w-20 text-white/55">{r.archive}</span>
            <span className="flex-1 text-white/85 truncate">{r.title || "[untitled]"}</span>
            <span className="text-white/40 hidden md:inline">{r.paper_id}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function VerificationBlock({ data }: { data: AtlasArtifact }) {
  const fields: { label: string; value: string }[] = [
    { label: "kaggle_snapshot_date", value: data.kaggle_snapshot_date },
    { label: "corpus_input_sha256",   value: data.corpus_input_sha256 },
    { label: "corpus_records",        value: (data.corpus_records ?? 0).toLocaleString() },
    { label: "corpus_sha256",         value: data.corpus_sha256 },
    { label: "model_id",              value: data.model_id },
    { label: "formed_at",             value: data.formed_at },
    { label: "response_digest",       value: data.response_digest },
  ];
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">Verification fields</h3>
      <p className="text-white/55 text-sm mb-4">
        Every claim above is a function of these fields. Re-derive them from the
        same Kaggle snapshot and you obtain a byte-identical Atlas. Two hashes:
        the upstream Kaggle file (corpus_input_sha256), the harvested NDJSON
        (corpus_sha256). The seven canonical query response digests are written
        to the model artifact and re-issued by{" "}
        <code className="text-white/70">scripts/atlas_verify.sh</code>.
      </p>
      <div className="space-y-1 font-mono text-xs">
        {fields.map((f) => (
          <div key={f.label} className="flex items-start gap-3 py-1">
            <span className="w-44 text-white/45">{f.label}</span>
            <span className="flex-1 text-white/85 break-all">{f.value || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
