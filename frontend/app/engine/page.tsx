'use client';

import { useState, useCallback, useEffect } from 'react';
import { MinimalNav } from '@/components/layout/MinimalNav';
import { ConnectFlow, type ConnectResult } from '@/components/connect/ConnectFlow';
import { PageFileDrop } from '@/components/connect/FileDrop';
import { SurvivorTable } from '@/components/intelligence/SurvivorTable';
import { SummaryCards } from '@/components/intelligence/SummaryCards';
import { AnomalyFeed } from '@/components/intelligence/AnomalyFeed';
import { ConnectionGraph } from '@/components/intelligence/ConnectionGraph';

type NullTest = {
  metric: string;
  true_value: number | boolean;
  null_mean?: number | null;
  null_p05?: number | null;
  null_p95?: number | null;
  null_proportion_true?: number | null;
  significant_at_0_05: boolean;
};

type ValidationReport = {
  n_iterations: number;
  seed: number;
  null_tests: NullTest[];
  notes?: string[];
};

type AppPhase = 'connect' | 'reducing' | 'intelligence';

export default function HomePage() {
  const [phase, setPhase] = useState<AppPhase>('connect');
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [proofOpen, setProofOpen] = useState(false);

  useEffect(() => {
    if (isSample && !validation) {
      import('@/data/legends/validation.json')
        .then((mod) => {
          const data = (mod.default ?? mod) as unknown as ValidationReport;
          setValidation(data);
        })
        .catch(() => {/* validation optional */});
    }
  }, [isSample, validation]);

  const navStatus =
    phase === 'connect'
      ? 'idle'
      : phase === 'reducing'
        ? 'connecting'
        : 'connected';

  const handleComplete = (data: ConnectResult) => {
    setResult(data);
    setPhase('intelligence');
  };

  const handleSampleData = () => {
    setIsSample(true);
  };

  const handleReset = () => {
    setPhase('connect');
    setResult(null);
    setIsSample(false);
    setDroppedFile(null);
  };

  const handlePageFileDrop = useCallback((file: File) => {
    setDroppedFile(file);
  }, []);

  const handleFileConsumed = useCallback(() => {
    setDroppedFile(null);
  }, []);

  return (
    <div className="min-h-screen bg-li-depth-1 relative">
      <MinimalNav
        databaseName={result?.database_name}
        status={navStatus as 'idle' | 'connecting' | 'connected' | 'error'}
      />

      {/* Page-level file drop zone (connect phase only) */}
      {phase === 'connect' && (
        <PageFileDrop onFileDrop={handlePageFileDrop} />
      )}

      {/* Connect Phase */}
      {phase === 'connect' && (
        <div className="min-h-screen flex items-center justify-center px-6 relative z-10">
          <ConnectFlow
            onComplete={handleComplete}
            onSampleData={handleSampleData}
            droppedFile={droppedFile}
            onFileConsumed={handleFileConsumed}
          />
        </div>
      )}

      {/* Intelligence Phase */}
      {phase === 'intelligence' && result && (
        <div className="pt-16 pb-20 px-4 sm:px-6 lg:px-10 max-w-[1400px] mx-auto">
          {/* Header bar */}
          <div className="flex items-center justify-between mb-8 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-li-green" />
              <span className="text-sm font-mono text-white/50">
                {result.database_name}
              </span>
              {isSample && (
                <span className="text-[10px] font-mono text-li-yellow bg-li-yellow/10 px-2 py-0.5 rounded">
                  SAMPLE
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-mono text-white/20">
                {result.total_entities.toLocaleString()} entities &rarr; {result.survivors.length} survivors
              </span>
              <button
                onClick={handleReset}
                className="text-[11px] font-mono text-white/20 hover:text-white/50 transition-colors duration-200 underline underline-offset-2 decoration-white/10"
              >
                New analysis
              </button>
            </div>
          </div>

          {/* Prove-it block — null-test falsification badges */}
          {isSample && validation && (
            <div className="mb-6">
              <button
                onClick={() => setProofOpen(v => !v)}
                className="w-full flex items-center justify-between gap-3 bg-white/[0.02] border border-li-cyan/20 rounded-xl px-5 py-3 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-li-cyan/80">Prove it</span>
                  <span className="text-[11px] font-mono text-white/50">
                    {validation.null_tests.filter(t => t.significant_at_0_05).length} / {validation.null_tests.length} metrics survive null permutation (N={validation.n_iterations}, &alpha;=0.05)
                  </span>
                </div>
                <span className="text-[10px] font-mono text-white/40">{proofOpen ? '\u25bc' : '\u25b8'}</span>
              </button>

              {proofOpen && (
                <div className="mt-2 bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
                  <p className="text-[10px] font-mono text-white/30 mb-4">
                    Every metric is tested against a strong null: cross-corpus fingerprint shuffle + role-label shuffle + within-corpus entity shuffle.
                    A metric passes only if the true value lies outside the null distribution&apos;s 95th percentile.
                  </p>
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_6rem_6rem_6rem_6rem] gap-3 text-[9px] font-mono uppercase tracking-wider text-white/25 pb-2 border-b border-white/[0.04]">
                      <span>Metric</span>
                      <span className="text-right">True</span>
                      <span className="text-right">Null mean</span>
                      <span className="text-right">Null p95</span>
                      <span className="text-right">Verdict</span>
                    </div>
                    {validation.null_tests.map((t, i) => {
                      const fmt = (v: number | null | undefined) =>
                        v === undefined || v === null ? '\u2014' : Number.isInteger(v) ? String(v) : v.toFixed(3);
                      const trueStr = typeof t.true_value === 'boolean'
                        ? (t.true_value ? 'true' : 'false')
                        : fmt(t.true_value);
                      const hasNullMean = t.null_mean !== null && t.null_mean !== undefined;
                      const nullDisplay = hasNullMean
                        ? { mean: fmt(t.null_mean), p95: fmt(t.null_p95) }
                        : { mean: `p=${(t.null_proportion_true ?? 0).toFixed(2)}`, p95: '\u2014' };
                      return (
                        <div key={i} className="grid grid-cols-[1fr_6rem_6rem_6rem_6rem] gap-3 text-[11px] font-mono items-center py-1">
                          <span className="text-white/60 truncate">{t.metric}</span>
                          <span className="text-white/70 text-right">{trueStr}</span>
                          <span className="text-white/40 text-right">{nullDisplay.mean}</span>
                          <span className="text-white/40 text-right">{nullDisplay.p95}</span>
                          <span className={`text-right text-[10px] ${t.significant_at_0_05 ? 'text-li-green' : 'text-white/25'}`}>
                            {t.significant_at_0_05 ? 'SIGNIFICANT' : 'not signif'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[9px] font-mono text-white/20 mt-4">
                    Seed {validation.seed}. Regenerate with <span className="text-white/40">lo validate</span> from the <span className="text-white/40">lo-core</span> CLI.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Main grid: table + summary cards */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mb-10">
            {/* Survivors table */}
            <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/25">
                  Survivors
                </h3>
                <span className="text-[10px] font-mono text-white/15">
                  {result.survivors.length} entities
                </span>
              </div>
              <SurvivorTable survivors={result.survivors} />
            </div>

            {/* Summary cards */}
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-white/25 mb-4">
                Summary
              </h3>
              <SummaryCards
                cards={[
                  {
                    value: String(result.survivors.length),
                    label: `Survivors from ${result.total_entities.toLocaleString()}`,
                  },
                  {
                    value: `${Math.round(result.total_entities / result.survivors.length)}x`,
                    label: 'Reduction ratio',
                  },
                  {
                    value: String(result.clusters),
                    label: 'Clusters discovered',
                  },
                  {
                    value: result.coverage.toFixed(2),
                    label: 'Coverage score',
                  },
                  {
                    value: result.cost,
                    label: 'Compute cost',
                  },
                  {
                    value: result.wall_time,
                    label: 'Wall time',
                  },
                ]}
              />
            </div>
          </div>

          {/* Anomalies section */}
          <div className="mb-10">
            <h3 className="text-xs font-mono uppercase tracking-wider text-white/25 mb-4">
              Anomalies
            </h3>
            <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
              <AnomalyFeed
                anomalies={result.survivors.map((s) => {
                  const compPct = Math.round((s.score ?? 0) * 100);
                  const anomPct = Math.round(s.anomaly_score * 100);
                  const rankTxt =
                    s.cluster_rank && s.cluster_total
                      ? `rank ${s.cluster_rank}/${s.cluster_total} in cluster`
                      : '';
                  let narrative: string | undefined;
                  if (s.anomaly_score >= 0.7 || (s.cluster_rank && s.cluster_rank <= 3)) {
                    narrative = [
                      `anomaly ${anomPct}%`,
                      `composite ${compPct}%`,
                      rankTxt,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                  }
                  return {
                    name: s.name,
                    type: s.type,
                    anomaly_score: s.anomaly_score,
                    narrative,
                  };
                })}
                threshold={0.7}
              />
            </div>
          </div>

          {/* Connections section */}
          <div className="mb-10">
            <h3 className="text-xs font-mono uppercase tracking-wider text-white/25 mb-4">
              Discovered Connections
            </h3>
            <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
              <ConnectionGraph connections={result.connections} />
            </div>
          </div>

          {/* Convergence Index — entities passing multiple independent signal tests */}
          {result.convergence_index && result.convergence_index.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/25">
                  Convergence Index
                </h3>
                <span className="text-[10px] font-mono text-white/30">
                  entities scoring across {result.convergence_index.length > 0 ? '4' : '0'} independent dimensions: anomaly &middot; cluster-rank &middot; cross-era &middot; rare-fingerprint
                </span>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
                <p className="text-[10px] font-mono text-white/25 mb-3">
                  Higher convergence = entity is a top hit on multiple independent tests simultaneously.
                  Single-dimension hits are usually noise; convergent hits are signal.
                </p>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[2rem_1fr_5rem_3rem_3rem_3rem_3rem] gap-2 text-[9px] font-mono text-white/20 uppercase tracking-wider pb-1 border-b border-white/[0.04]">
                    <span>#</span>
                    <span>Entity</span>
                    <span className="text-right">Conv.</span>
                    <span className="text-right">Anom</span>
                    <span className="text-right">Clus%</span>
                    <span className="text-right">Era</span>
                    <span className="text-right">FP</span>
                  </div>
                  {result.convergence_index.slice(0, 15).map((m, i) => (
                    <div key={i} className="grid grid-cols-[2rem_1fr_5rem_3rem_3rem_3rem_3rem] gap-2 text-[11px] font-mono items-center">
                      <span className="text-white/20">#{i + 1}</span>
                      <span className="text-white/70 truncate">{m.name}</span>
                      <span className="text-li-cyan/80 text-right font-semibold">{m.convergence.toFixed(3)}</span>
                      <span className="text-white/40 text-right">{m.dimensions.anomaly.toFixed(2)}</span>
                      <span className="text-white/40 text-right">{(m.dimensions.cluster_percentile * 100).toFixed(0)}</span>
                      <span className={m.dimensions.cross_era > 0 ? 'text-li-yellow/70 text-right' : 'text-white/15 text-right'}>
                        {m.dimensions.cross_era > 0 ? '\u2713' : '\u00b7'}
                      </span>
                      <span className={m.dimensions.rare_fingerprint > 0.3 ? 'text-li-yellow/70 text-right' : 'text-white/15 text-right'}>
                        {m.dimensions.rare_fingerprint > 0 ? m.dimensions.rare_fingerprint.toFixed(2) : '\u00b7'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Paradigm Dominance — forgotten vs mainstream vs control hypothesis test */}
          {result.paradigm_distribution && Object.keys(result.paradigm_distribution.hypothesis_by_corpus).length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/25">
                  Paradigm Dominance
                </h3>
                <span className="text-[10px] font-mono text-white/30">
                  hypothesis: forgotten paradigm should exceed mainstream + control
                </span>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
                <div className="space-y-3">
                  {Object.entries(result.paradigm_distribution.hypothesis_by_corpus).map(([corpus, h]) => {
                    const total = h.forgotten + h.mainstream + h.control;
                    const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
                    return (
                      <div key={corpus} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-white/70 w-16 capitalize">{corpus}</span>
                          <span className={h.confirmed ? 'text-li-green/80' : 'text-li-red/60'}>
                            {h.confirmed ? '\u2713 confirmed' : '\u2717 not confirmed'}
                          </span>
                          <span className="text-white/40">
                            ratio {h.ratio_forgotten_to_competitors.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex h-4 rounded overflow-hidden border border-white/[0.04]">
                          {h.forgotten > 0 && (
                            <div
                              className="bg-li-cyan/40 flex items-center justify-center text-[9px] font-mono text-black"
                              style={{ width: `${pct(h.forgotten)}%` }}
                              title={`forgotten: ${h.forgotten}`}
                            >
                              {h.forgotten > 4 ? h.forgotten : ''}
                            </div>
                          )}
                          {h.mainstream > 0 && (
                            <div
                              className="bg-white/20 flex items-center justify-center text-[9px] font-mono text-white/70"
                              style={{ width: `${pct(h.mainstream)}%` }}
                              title={`mainstream: ${h.mainstream}`}
                            >
                              {h.mainstream > 4 ? h.mainstream : ''}
                            </div>
                          )}
                          {h.control > 0 && (
                            <div
                              className="bg-li-yellow/30 flex items-center justify-center text-[9px] font-mono text-black/70"
                              style={{ width: `${pct(h.control)}%` }}
                              title={`control: ${h.control}`}
                            >
                              {h.control > 4 ? h.control : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 text-[9px] font-mono text-white/30">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-li-cyan/40" /> forgotten</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-white/20" /> mainstream</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-li-yellow/30" /> control</span>
                </div>
              </div>
            </div>
          )}

          {/* Convergent Anomaly Clusters */}
          {result.convergent_clusters && result.convergent_clusters.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/25">
                  Convergent Anomaly Clusters
                </h3>
                <span className="text-[10px] font-mono text-white/30">
                  clusters where multiple entities independently score anomaly ≥ 0.85
                </span>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
                <div className="space-y-2">
                  {result.convergent_clusters.slice(0, 10).map((c, i) => (
                    <div key={i} className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-white/30 w-16">cluster {c.cluster}</span>
                      <span className="flex-1 text-white/60 truncate">{c.dominant_paradigm || 'mixed'}</span>
                      <span className="text-li-cyan/80 w-16 text-right">
                        {c.hot_count} / {c.total} hot
                      </span>
                      <span className="text-white/30 w-16 text-right">
                        {(c.hot_fraction * 100).toFixed(0)}% density
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Cross-Era Anchors */}
          {result.cross_era_anchors && result.cross_era_anchors.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/25">
                  Cross-Era Anchors
                </h3>
                <span className="text-[10px] font-mono text-white/30">
                  entities whose era disagrees with their cluster&apos;s majority era (anachronism signal)
                </span>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
                <div className="space-y-1.5">
                  {result.cross_era_anchors.slice(0, 10).map((a, i) => (
                    <div key={i} className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-white/70 flex-1 truncate">{a.name}</span>
                      <span className="text-li-yellow/70 w-16 text-right capitalize">{a.era_class}</span>
                      <span className="text-white/30 w-12 text-right">vs</span>
                      <span className="text-white/40 w-16 text-right capitalize">{a.cluster_majority_era}</span>
                      <span className="text-li-cyan/80 w-12 text-right">{a.anomaly.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Triple-Bridges — rarest structural signal */}
          {result.triple_bridges && result.triple_bridges.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/25">
                  Triple-Bridges (≥3 corpora)
                </h3>
                <span className="text-[10px] font-mono text-white/30">
                  fingerprints appearing in 3+ independent legends — strongest cross-corpus structural signal
                </span>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
                <div className="space-y-2">
                  {result.triple_bridges.slice(0, 10).map((t, i) => (
                    <details key={i} className="group">
                      <summary className="flex items-center gap-3 text-[11px] font-mono cursor-pointer hover:bg-white/[0.02] rounded px-2 py-1 -mx-2 transition-colors">
                        <span className="text-white/40 w-4">&#9656;</span>
                        <span className="text-li-yellow/50 font-mono">{t.fingerprint.slice(0, 16)}</span>
                        <span className="flex-1 text-white/60 truncate">
                          {t.legends.join(' \u2194 ')}
                        </span>
                        <span className="text-li-cyan/80">{t.legend_count} corpora</span>
                      </summary>
                      <div className="pl-6 pt-2 space-y-1 text-[10px] font-mono text-white/40">
                        {t.entities.slice(0, 6).map((e, j) => (
                          <div key={j} className="truncate">
                            <span className="text-white/30 w-20 inline-block">{e.legend}</span>
                            <span className="text-white/60">{e.name}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Cross-Legend Bridges section */}
          {result.bridges && result.bridges.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/25">
                  Cross-Legend Bridges
                </h3>
                <span className="text-[10px] font-mono text-white/30">
                  {result.bridges.length} legends with rare-fingerprint overlap (density-filtered)
                </span>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
                <p className="text-[10px] font-mono text-white/25 mb-3">
                  Ranked by weighted score (matches on rare lattice fingerprints count more).
                  Global count = how many legends hold this fingerprint.
                </p>
                <div className="space-y-3">
                  {result.bridges.slice(0, 10).map((br, i) => (
                    <details key={i} className="group">
                      <summary className="flex items-center gap-3 text-[11px] font-mono cursor-pointer hover:bg-white/[0.02] rounded px-2 py-1 -mx-2 transition-colors">
                        <span className="text-white/40 w-4">&#9656;</span>
                        <span className="text-white/70 flex-1">{br.other_legend}</span>
                        <span className="text-li-cyan/80 w-28 text-right">w {br.weighted_score.toFixed(2)}</span>
                        <span className="text-white/30 w-20 text-right">
                          {br.shared_count} match{br.shared_count === 1 ? '' : 'es'}
                        </span>
                      </summary>
                      <div className="pl-6 pt-2 space-y-1 text-[10px] font-mono text-white/40">
                        {br.samples.slice(0, 5).map((s, j) => (
                          <div key={j} className="truncate">
                            <span className="text-li-yellow/50">{s.fp.slice(0, 12)}</span>
                            {s.global_count !== undefined && (
                              <span className="text-white/25"> gc={s.global_count}</span>
                            )}
                            {' '}
                            <span className="text-white/60">{s.a_name}</span>
                            {' \u2194 '}
                            <span className="text-white/60">{s.b_name}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-8 border-t border-white/[0.03] flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/10">
              Powered by Latent Ocean Engine v0.1.0
            </span>
            <span className="text-[10px] font-mono text-white/10">
              Built by Diren Kumaratilleke
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
