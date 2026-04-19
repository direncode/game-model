'use client';

import { useState, useCallback, useMemo } from 'react';
import { SourceDetector, type SourceType } from './SourceDetector';
import { FileDrop } from './FileDrop';
import legendsManifest from '@/data/legends/manifest.json';

type LegendManifestEntry = {
  id: string;
  display_name: string;
  description: string;
  path: string;
  survivors: number;
  total_entities: number;
  clusters: number;
  size_kb: number;
};

const LEGENDS: LegendManifestEntry[] = legendsManifest.legends as LegendManifestEntry[];

export interface EngineStep {
  label: string;
  detail?: string;
  status: 'pending' | 'active' | 'done' | 'error';
  duration?: string;
}

export interface NoveltyProbe {
  query: string;
  query_vector: number[];
  probed: number;
  novelty_score: number;
  top: Array<{
    name: string;
    type: string;
    similarity: number;
    anomaly: number;
  }>;
}

export interface ParadigmBreakdown {
  regime_counts: Record<string, number>;
  total_matched: number;
  examples: Array<{
    name: string;
    regime: string;
    scores: Record<string, number | string>;
  }>;
}

export interface LegendBridge {
  other_legend: string;
  shared_count: number;
  weighted_score: number;
  samples: Array<{
    fp: string;
    a_name: string;
    b_name: string;
    global_count?: number;
    weight?: number;
  }>;
}

export interface ConvergenceEntry {
  name: string;
  type: string;
  convergence: number;
  dimensions: {
    anomaly: number;
    cluster_percentile: number;
    cross_era: number;
    rare_fingerprint: number;
  };
}

export interface ParadigmHypothesis {
  forgotten: number;
  mainstream: number;
  control: number;
  ratio_forgotten_to_competitors: number;
  confirmed: boolean;
}

export interface ParadigmDistribution {
  by_corpus_subcorpus_role: Array<{
    corpus: string;
    subcorpus: string;
    role: string;
    count: number;
  }>;
  role_counts: Record<string, number>;
  hypothesis_by_corpus: Record<string, ParadigmHypothesis>;
}

export interface ConvergentCluster {
  cluster: number;
  hot_count: number;
  total: number;
  hot_fraction: number;
  dominant_paradigm: string;
  dominant_paradigm_share: number;
}

export interface CrossEraAnchor {
  name: string;
  era_class: string;
  cluster_majority_era: string;
  cluster: number;
  corpus: string;
  subcorpus: string;
  anomaly: number;
}

export interface TripleBridge {
  fingerprint: string;
  legend_count: number;
  legends: string[];
  entities: Array<{ legend: string; name: string }>;
}

export interface ConnectResult {
  database_name: string;
  legend_id?: string;
  description?: string;
  survivors: Array<{
    name: string;
    type: string;
    score: number;
    anomaly_score: number;
    cluster_rank?: number;
    cluster_total?: number;
    cluster_percentile?: number;
  }>;
  clusters: number;
  coverage: number;
  cost: string;
  wall_time: string;
  total_entities: number;
  connections: Array<{
    source: string;
    target: string;
    signal_type: string;
    strength: number;
  }>;
  paradigm?: ParadigmBreakdown;
  paradigm_distribution?: ParadigmDistribution;
  convergent_clusters?: ConvergentCluster[];
  cross_era_anchors?: CrossEraAnchor[];
  convergence_index?: ConvergenceEntry[];
  bridges?: LegendBridge[];
  triple_bridges?: TripleBridge[];
}

export type SourceConfig = {
  source_type: SourceType;
  source_connection_string?: string;
  source_url?: string;
  source_uri?: string;
  file_content?: string;
  file_name?: string;
};

// --- Source detection logic ---

const SOURCE_PATTERNS: Array<{ test: RegExp | ((v: string) => boolean); type: SourceType; hint: string }> = [
  { test: /^postgresql:\/\//i, type: 'database', hint: 'postgresql://user:pass@host/database' },
  { test: /^postgres:\/\//i, type: 'database', hint: 'postgresql://user:pass@host/database' },
  { test: /^mysql:\/\//i, type: 'database', hint: 'mysql://user:pass@host/database' },
  { test: /^mongodb(\+srv)?:\/\//i, type: 'database', hint: 'mongodb://user:pass@host/database' },
  { test: /^snowflake:\/\//i, type: 'database', hint: 'snowflake://account/database/schema' },
  { test: /^s3:\/\//i, type: 's3', hint: 's3://bucket/path/to/data' },
  { test: /^gs:\/\//i, type: 's3', hint: 'gs://bucket/path/to/data' },
  { test: /^https?:\/\//i, type: 'api', hint: 'https://api.example.com/v1/data' },
  { test: /^kafka:\/\//i, type: 'stream', hint: 'kafka://localhost:9092/topic' },
  { test: (v) => /\.(csv|tsv|json|jsonl|parquet|xlsx?|xls)$/i.test(v), type: 'file', hint: '/path/to/file.csv' },
  { test: (v) => v.startsWith('/') || v.startsWith('.') || v.startsWith('~'), type: 'file', hint: '/path/to/file.csv' },
];

const PREFIX_HINTS: Array<{ prefix: string; hint: string }> = [
  { prefix: 'p', hint: 'postgresql://user:pass@host/database' },
  { prefix: 'my', hint: 'mysql://user:pass@host/database' },
  { prefix: 'mo', hint: 'mongodb://user:pass@host/database' },
  { prefix: 'sn', hint: 'snowflake://account/database/schema' },
  { prefix: 's3', hint: 's3://bucket/path/to/data' },
  { prefix: 'gs', hint: 'gs://bucket/path/to/data' },
  { prefix: 'http', hint: 'https://api.example.com/v1/data' },
  { prefix: 'ka', hint: 'kafka://localhost:9092/topic' },
  { prefix: '/', hint: '/path/to/file.csv' },
  { prefix: '.', hint: './data/file.json' },
];

function detectSource(value: string): { type: SourceType | null; hint: string } {
  const trimmed = value.trim();
  if (!trimmed) return { type: null, hint: '' };

  for (const pattern of SOURCE_PATTERNS) {
    const matched = typeof pattern.test === 'function' ? pattern.test(trimmed) : pattern.test.test(trimmed);
    if (matched) return { type: pattern.type, hint: pattern.hint };
  }

  return { type: null, hint: '' };
}

function getPlaceholderHint(value: string): string {
  const lower = value.toLowerCase();
  for (const { prefix, hint } of PREFIX_HINTS) {
    if (lower.startsWith(prefix)) return hint;
  }
  return '';
}

function extractSourceName(value: string, type: SourceType | null): string {
  if (!value.trim()) return 'data_source';
  try {
    if (type === 'database') {
      const parts = value.split('/');
      return parts[parts.length - 1]?.split('?')[0] || 'database';
    }
    if (type === 'file' || type === 's3') {
      const parts = value.split('/');
      return parts[parts.length - 1] || 'file';
    }
    if (type === 'api') {
      const url = new URL(value);
      return url.hostname;
    }
    if (type === 'stream') {
      const parts = value.split('/');
      return parts[parts.length - 1] || 'stream';
    }
  } catch { /* fallthrough */ }
  return 'data_source';
}

interface ConnectFlowProps {
  onComplete: (result: ConnectResult) => void;
  onSampleData: () => void;
  droppedFile?: File | null;
  onFileConsumed?: () => void;
}

export function ConnectFlow({ onComplete, onSampleData, droppedFile, onFileConsumed }: ConnectFlowProps) {
  const [inputValue, setInputValue] = useState('');
  const [phase, setPhase] = useState<'input' | 'progress' | 'error'>('input');
  const [steps, setSteps] = useState<EngineStep[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeFile, setActiveFile] = useState<File | null>(null);

  const detected = useMemo(() => detectSource(inputValue), [inputValue]);
  const placeholderHint = useMemo(() => getPlaceholderHint(inputValue), [inputValue]);

  // Handle file dropped from parent page
  const handleExternalFile = useCallback((file: File) => {
    setActiveFile(file);
    setInputValue(file.name);
    onFileConsumed?.();
  }, [onFileConsumed]);

  // If parent passes a dropped file, consume it
  if (droppedFile && !activeFile) {
    handleExternalFile(droppedFile);
  }

  const updateStep = useCallback(
    (index: number, update: Partial<EngineStep>) => {
      setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));
    },
    []
  );

  const handleFileDrop = useCallback((file: File) => {
    setActiveFile(file);
    setInputValue(file.name);
  }, []);

  const simulateReduction = useCallback(
    async (mode: 'live' | { legendId: string }, sourceName?: string) => {
      setPhase('progress');
      const isSample = mode !== 'live';

      const sourceType = detected.type || 'database';
      const stepLabels: Record<string, string[]> = {
        database: ['Connecting', 'Scanning schema', 'Fetching entities', 'Reducing', 'Materializing'],
        file: ['Reading file', 'Parsing structure', 'Extracting entities', 'Reducing', 'Materializing'],
        api: ['Reaching endpoint', 'Fetching response', 'Extracting entities', 'Reducing', 'Materializing'],
        s3: ['Accessing bucket', 'Downloading object', 'Extracting entities', 'Reducing', 'Materializing'],
        stream: ['Connecting to broker', 'Consuming messages', 'Extracting entities', 'Reducing', 'Materializing'],
      };

      const labels = isSample ? stepLabels.database : (stepLabels[sourceType] || stepLabels.database);

      const initialSteps: EngineStep[] = labels.map((label, i) => ({
        label,
        status: i === 0 ? 'active' as const : 'pending' as const,
      }));
      setSteps(initialSteps);

      let payload: ConnectResult | null = null;
      if (isSample) {
        try {
          const mod = await import(`@/data/legends/${mode.legendId}.json`);
          payload = mod.default as ConnectResult;

          // Attach per-legend cross-legend bridges
          try {
            const bridgesMod = await import('@/data/legends/bridges.json');
            type RawBridge = {
              a: string;
              b: string;
              shared_count: number;
              weighted_score: number;
              samples: Array<{
                fp: string;
                a_name: string;
                b_name: string;
                global_count?: number;
                weight?: number;
              }>;
            };
            type RawTriple = {
              fingerprint: string;
              legend_count: number;
              legends: string[];
              entities: Array<{ legend: string; name: string }>;
            };
            const raw = bridgesMod.default as {
              bridges: RawBridge[];
              triple_bridges?: RawTriple[];
            };
            payload.bridges = raw.bridges
              .filter((br) => br.a === mode.legendId || br.b === mode.legendId)
              .map((br) => ({
                other_legend: br.a === mode.legendId ? br.b : br.a,
                shared_count: br.shared_count,
                weighted_score: br.weighted_score,
                samples: br.samples,
              }))
              .sort((x, y) => y.weighted_score - x.weighted_score);

            payload.triple_bridges = (raw.triple_bridges || [])
              .filter((t) => t.legends.includes(mode.legendId))
              .sort((x, y) => x.legend_count - y.legend_count);
          } catch {
            /* bridges optional */
          }
        } catch (e) {
          setPhase('error');
          setErrorMessage(`Failed to load legend "${mode.legendId}".`);
          return;
        }
      }

      const delays = [400, 500, 700, 1100, 400];
      const liveDetails = [
        'Established connection',
        sourceType === 'file' ? 'Parsed structure' : '26 tables, 43 relationships',
        '10,482 entities fetched',
        '10,482 \u2192 347 survivors',
        'Intelligence materialized',
      ];
      const sampleDetails = payload
        ? [
            `Loaded ${payload.database_name}`,
            `${payload.clusters} clusters`,
            `${payload.total_entities.toLocaleString()} entities`,
            `\u2192 ${payload.survivors.length} survivors`,
            `cov=${payload.coverage}`,
          ]
        : liveDetails;
      const details = isSample ? sampleDetails : liveDetails;
      const durations = ['0.1s', '0.2s', '0.4s', '0.6s', '0.2s'];

      try {
        for (let i = 0; i < initialSteps.length; i++) {
          updateStep(i, { status: 'active' });
          await new Promise((r) => setTimeout(r, delays[i]));
          updateStep(i, {
            status: 'done',
            detail: details[i],
            duration: durations[i],
          });
        }

        if (payload) {
          onComplete(payload);
        } else {
          // Live mode placeholder (no real backend wired here yet)
          onComplete({
            database_name: sourceName || extractSourceName(inputValue, detected.type),
            survivors: [],
            clusters: 0,
            coverage: 0,
            cost: '$0.00',
            wall_time: '0.0s',
            total_entities: 0,
            connections: [],
          });
        }
      } catch {
        setPhase('error');
        setErrorMessage('Connection failed. Check your input and try again.');
      }
    },
    [inputValue, detected, onComplete, updateStep]
  );

  const handleAnalyze = () => {
    if (!inputValue.trim() && !activeFile) return;
    simulateReduction('live');
  };

  const handleLegendClick = (legendId: string) => {
    onSampleData();
    simulateReduction({ legendId });
  };

  const handleRetry = () => {
    setPhase('input');
    setErrorMessage('');
    setSteps([]);
    setActiveFile(null);
  };

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
        <div className="w-2 h-2 rounded-full bg-li-red" />
        <p className="text-sm text-li-red font-mono text-center">{errorMessage}</p>
        <button
          onClick={handleRetry}
          className="text-sm font-mono text-white/50 hover:text-white transition-colors duration-200 underline underline-offset-4 decoration-white/10"
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase === 'progress') {
    return (
      <div className="flex flex-col items-center gap-0 w-full max-w-md mx-auto">
        <div className="space-y-3 w-full">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-3 opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 150}ms`, animationFillMode: 'forwards' }}
            >
              <span className="w-4 flex-shrink-0 text-center">
                {step.status === 'done' && (
                  <span className="text-li-green text-xs">&#10003;</span>
                )}
                {step.status === 'active' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-li-cyan animate-pulse inline-block" />
                )}
                {step.status === 'pending' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/10 inline-block" />
                )}
                {step.status === 'error' && (
                  <span className="text-li-red text-xs">&#10007;</span>
                )}
              </span>
              <span
                className={`text-sm font-mono ${
                  step.status === 'done'
                    ? 'text-white/50'
                    : step.status === 'active'
                      ? 'text-white'
                      : 'text-white/15'
                }`}
              >
                {step.label}
              </span>
              {step.detail && (
                <span className="text-[11px] font-mono text-white/20 ml-auto">
                  {step.detail}
                </span>
              )}
              {step.duration && (
                <span className="text-[10px] font-mono text-white/10">
                  {step.duration}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Input phase
  const defaultPlaceholder = 'postgresql://...  s3://...  /file.csv  https://api...  kafka://...';

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto relative">
      <h2 className="text-xl font-mono text-white/80 tracking-tight">
        Connect any data source
      </h2>
      <p className="text-xs font-mono text-white/20 -mt-3">
        databases, files, APIs, object stores, streams
      </p>

      <div className="w-full relative">
        {/* Main smart input */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (activeFile) setActiveFile(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder={defaultPlaceholder}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-5 py-3.5 text-sm font-mono text-white placeholder:text-white/15 focus:outline-none focus:border-li-cyan/30 focus:ring-1 focus:ring-li-cyan/10 transition-all duration-200"
          autoFocus
        />

        {/* Ghost hint overlay */}
        {placeholderHint && inputValue && !detected.type && (
          <div className="absolute inset-0 px-5 py-3.5 pointer-events-none">
            <span className="text-sm font-mono text-transparent">{inputValue}</span>
            <span className="text-sm font-mono text-white/10">
              {placeholderHint.slice(inputValue.length)}
            </span>
          </div>
        )}

        {/* Active file badge */}
        {activeFile && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="text-[10px] font-mono text-li-cyan/70 bg-li-cyan/10 px-2 py-0.5 rounded">
              {activeFile.name}
            </span>
            <button
              onClick={() => { setActiveFile(null); setInputValue(''); }}
              className="text-white/20 hover:text-white/50 text-xs"
            >
              &#10005;
            </button>
          </div>
        )}
      </div>

      {/* Source detector icons */}
      <SourceDetector detectedType={detected.type} />

      <button
        onClick={handleAnalyze}
        disabled={!inputValue.trim() && !activeFile}
        className="px-8 py-2.5 bg-li-cyan text-black text-sm font-medium rounded-lg hover:bg-li-cyan/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
      >
        Analyze
      </button>

      {/* Legend run selector — pre-cached pipeline results */}
      <div className="w-full mt-2">
        <p className="text-[10px] font-mono text-white/20 text-center mb-2 tracking-wider uppercase">
          or try with a legend run
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {LEGENDS.map((l) => (
            <button
              key={l.id}
              onClick={() => handleLegendClick(l.id)}
              title={`${l.description} — ${l.total_entities.toLocaleString()} entities → ${l.survivors} survivors, ${l.clusters} clusters`}
              className="text-[10px] font-mono text-white/40 hover:text-white hover:border-li-cyan/40 bg-white/[0.02] border border-white/[0.06] rounded-md px-3 py-1.5 transition-all duration-150"
            >
              {l.display_name}
            </button>
          ))}
        </div>
      </div>

      {/* Inline file drop zone */}
      <FileDrop onFileDrop={handleFileDrop} />
    </div>
  );
}

// --- Helpers ---

function extractDbName(connStr: string): string {
  try {
    const parts = connStr.split('/');
    return parts[parts.length - 1]?.split('?')[0] || 'database';
  } catch {
    return 'database';
  }
}

