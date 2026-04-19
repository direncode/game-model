'use client';

import { useState, useCallback } from 'react';
import { MinimalNav } from '@/components/layout/MinimalNav';
import { ConnectFlow, type ConnectResult } from '@/components/connect/ConnectFlow';
import { PageFileDrop } from '@/components/connect/FileDrop';
import { SurvivorTable } from '@/components/intelligence/SurvivorTable';
import { SummaryCards } from '@/components/intelligence/SummaryCards';
import { AnomalyFeed } from '@/components/intelligence/AnomalyFeed';
import { ConnectionGraph } from '@/components/intelligence/ConnectionGraph';

type AppPhase = 'connect' | 'reducing' | 'intelligence';

export default function HomePage() {
  const [phase, setPhase] = useState<AppPhase>('connect');
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

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
                anomalies={result.survivors.map((s) => ({
                  name: s.name,
                  type: s.type,
                  anomaly_score: s.anomaly_score,
                  narrative:
                    s.anomaly_score >= 0.8
                      ? `${s.name} exhibits anomalous structural patterns diverging significantly from its ${s.type} cluster centroid.`
                      : s.anomaly_score >= 0.7
                        ? `${s.name} shows moderate deviation from expected ${s.type} behavior patterns.`
                        : undefined,
                }))}
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

          {/* Novelty Probe section */}
          {result.novelty && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/25">
                  Novelty Probe
                </h3>
                <span className="text-[10px] font-mono text-white/30">
                  score {result.novelty.novelty_score.toFixed(3)} &middot; {result.novelty.probed} probed
                </span>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
                <p className="text-[11px] font-mono text-white/40 mb-3">
                  query: &quot;{result.novelty.query}&quot;
                </p>
                <div className="space-y-1.5">
                  {result.novelty.top.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="w-6 text-white/20">#{i + 1}</span>
                      <span className="flex-1 text-white/70 truncate">{m.name}</span>
                      <span className="text-white/30 w-24">{m.type}</span>
                      <span className="text-li-cyan/80 w-14 text-right">{m.similarity.toFixed(3)}</span>
                      <span className="text-white/20 w-12 text-right">anom {m.anomaly.toFixed(2)}</span>
                    </div>
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
                  {result.bridges.length} legends share fingerprints with this one
                </span>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5">
                <div className="space-y-3">
                  {result.bridges.slice(0, 8).map((br, i) => (
                    <details key={i} className="group">
                      <summary className="flex items-center gap-3 text-[11px] font-mono cursor-pointer hover:bg-white/[0.02] rounded px-2 py-1 -mx-2 transition-colors">
                        <span className="text-white/40 w-4">&#9656;</span>
                        <span className="text-white/70 flex-1">{br.other_legend}</span>
                        <span className="text-li-cyan/80">{br.shared_count} shared fingerprint{br.shared_count === 1 ? '' : 's'}</span>
                      </summary>
                      <div className="pl-6 pt-2 space-y-1 text-[10px] font-mono text-white/40">
                        {br.samples.slice(0, 4).map((s, j) => (
                          <div key={j} className="truncate">
                            <span className="text-li-yellow/50">{s.fp.slice(0, 12)}</span>
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
