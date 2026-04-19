"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

type PerMetric = {
  dim: string;
  K: number;
  true_mean: number;
  null_mean: number;
  null_p95: number;
  z_score: number;
  sig_05: boolean;
  sig_001: boolean;
};

type NullTest = {
  n_survivors: number;
  n_iterations: number;
  K_values: number[];
  total_metrics: number;
  significant_05: number;
  significant_001: number;
  fraction_significant_05: number;
  max_z_score: number;
  median_z_score: number;
  per_metric: PerMetric[];
  skipped?: string;
  n?: number;
};

type CorpusReport = {
  corpus_id: string;
  path: string;
  survivor_count: number;
  load_seconds: number;
  entity_types: string[];
  score_dims_present: string[];
  top_composite: number;
  top_entity_name: string | null;
  null_test: NullTest;
  analyze: Record<string, any>;
  reproducibility_digest: string | null;
  readiness_score: number;
};

type UniversalReport = {
  generated_at: string;
  wall_seconds: number;
  n_iterations: number;
  seed: number;
  corpora: CorpusReport[];
  aggregate: {
    corpora_tested: number;
    mean_readiness: number;
    corpora_with_universal_significance: number;
    total_survivors_processed: number;
    max_z_score_across_corpora: number;
  };
};

const DOMAIN_LABEL: Record<string, string> = {
  edgar_5000: "SEC EDGAR · 61k filer universe",
  edgar: "SEC EDGAR · smaller cut",
  polymath: "Polymath biography corpus",
  heterogeneous: "Mixed historical corpus",
  latk_mini: "Language-across-time · subset",
  latk_physics: "Physics patent corpus",
  linguistics: "Linguistic evolution corpus",
  tesla_crossera: "Tesla cross-era (inventor patents)",
  einstein: "Einstein biographical events",
  turing: "Turing biographical events",
  standalone: "Standalone smoke dataset",
};

export default function UniversalPage() {
  const [report, setReport] = useState<UniversalReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/universal", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(setReport)
      .catch((e) => setError(String(e)));
  }, []);

  const corpora = (report?.corpora ?? []).slice().sort((a, b) =>
    b.null_test?.max_z_score - a.null_test?.max_z_score,
  );

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
              Universal primitives · zero hand-tuning · any corpus
            </p>
            <h1 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95]">
              One engine.<br />
              <span className="text-white/50">Every corpus.</span>
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-3xl">
              The same `lo_core.analyze` + resample-null primitives applied to every cached
              BTUT run the repository knows about. No corpus-specific thresholds, no
              domain knobs. If a primitive only worked because of a tuned constant, it would
              fail here.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300">
              {error}. Generate with{" "}
              <code className="font-mono">python scripts/universal_validation.py</code>.
            </div>
          )}

          {!report && !error && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-12 text-center text-white/50">
              Loading latest universal validation run…
            </div>
          )}

          {report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <Stat label="Corpora tested" value={`${report.aggregate.corpora_tested}`} />
                <Stat
                  label="Total survivors processed"
                  value={report.aggregate.total_survivors_processed.toLocaleString()}
                />
                <Stat
                  label="Max z-score across corpora"
                  value={`${report.aggregate.max_z_score_across_corpora.toFixed(2)} σ`}
                  tone="good"
                />
                <Stat
                  label="Mean readiness"
                  value={`${report.aggregate.mean_readiness.toFixed(0)}/100`}
                />
              </div>

              <div className="space-y-4">
                {corpora.map((c) => (
                  <CorpusCard key={c.corpus_id} c={c} />
                ))}
              </div>

              <div className="mt-16 rounded-xl border border-white/10 bg-white/[0.02] p-8">
                <p className="font-mono text-xs uppercase tracking-widest text-white/50 mb-3">
                  Reproduce across every corpus in your repo
                </p>
                <pre className="text-sm text-white/80 font-mono overflow-x-auto">
{`python scripts/universal_validation.py --iterations ${report.n_iterations}
cat data/validation/universal_validation.json | jq .aggregate`}
                </pre>
                <p className="mt-4 text-xs text-white/40 font-mono">
                  generated {report.generated_at} · wall {report.wall_seconds.toFixed(1)}s · seed {report.seed}
                </p>
              </div>

              <div className="mt-12 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/validation"
                  className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
                >
                  Commercial validation (EDGAR)
                </Link>
                <Link
                  href="/watchlist"
                  className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
                >
                  Today's top-50 flags
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good";
}) {
  const accent = tone === "good" ? "text-li-green" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
        {label}
      </div>
      <div
        className={`font-display text-2xl tabular-nums tracking-tight ${accent}`}
      >
        {value}
      </div>
    </div>
  );
}

function CorpusCard({ c }: { c: CorpusReport }) {
  const label = DOMAIN_LABEL[c.corpus_id] ?? c.corpus_id;
  const nt = c.null_test;
  const fracPct = nt?.fraction_significant_05
    ? Math.round(nt.fraction_significant_05 * 100)
    : 0;
  const skipped = !!nt?.skipped;
  const tone = c.readiness_score >= 80 ? "good" : c.readiness_score >= 50 ? "warn" : "weak";
  const toneCls =
    tone === "good"
      ? "border-li-green/25 bg-li-green/[0.03]"
      : tone === "warn"
      ? "border-li-cyan/20 bg-li-cyan/[0.03]"
      : "border-white/10 bg-white/[0.02]";

  return (
    <div className={`rounded-xl border p-6 ${toneCls}`}>
      <div className="flex items-start justify-between gap-6 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-xs text-white/40">{c.corpus_id}</span>
            <span className="text-[11px] font-mono text-white/30">
              {c.entity_types.join(" · ") || "—"}
            </span>
          </div>
          <h3 className="font-display text-2xl text-white tracking-tight mb-1">{label}</h3>
          <div className="text-xs font-mono text-white/50 truncate">{c.path}</div>
        </div>
        <div
          className={`inline-flex items-center h-7 px-3 rounded-full text-[11px] font-mono uppercase tracking-widest ${
            tone === "good"
              ? "bg-li-green/15 text-li-green"
              : tone === "warn"
              ? "bg-li-cyan/15 text-li-cyan"
              : "bg-white/5 text-white/50"
          }`}
        >
          Readiness {c.readiness_score}/100
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <MiniStat label="Survivors" value={c.survivor_count.toLocaleString()} />
        <MiniStat label="Score dims" value={c.score_dims_present.length.toString()} />
        <MiniStat
          label="Null sig (p<0.05)"
          value={skipped ? "—" : `${nt?.significant_05}/${nt?.total_metrics}  (${fracPct}%)`}
          accent
        />
        <MiniStat
          label="Max z-score"
          value={skipped ? "—" : `${(nt?.max_z_score ?? 0).toFixed(2)} σ`}
          accent={(nt?.max_z_score ?? 0) >= 10}
        />
        <MiniStat
          label="Top entity composite"
          value={c.top_composite.toFixed(3)}
        />
      </div>

      {c.top_entity_name && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">
            Top-ranked entity
          </div>
          <div className="font-mono text-sm text-white/90 truncate">{c.top_entity_name}</div>
        </div>
      )}

      {skipped && (
        <div className="mt-3 text-[11px] font-mono text-white/40">
          Null test skipped: {nt?.skipped}. Universal pipeline ran; corpus too small for
          reliable permutation bounds (n = {nt?.n}).
        </div>
      )}

      {c.reproducibility_digest && (
        <div className="mt-3 text-[11px] font-mono text-white/30 truncate">
          sha256(top-K) = {c.reproducibility_digest.slice(0, 24)}…
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">
        {label}
      </div>
      <div className={`font-mono text-sm tabular-nums ${accent ? "text-li-cyan" : "text-white/90"}`}>
        {value}
      </div>
    </div>
  );
}
