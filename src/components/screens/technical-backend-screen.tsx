'use client';

import { useState, useMemo } from 'react';
import {
  Activity,
  Database,
  Cpu,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Settings,
  Terminal,
  Sliders,
  Zap,
  BarChart3,
  Brain,
  Gauge,
  Target,
} from 'lucide-react';
import { GrokAIEmbed } from './grok-ai-embed';
import type { MatchStats } from '@/lib/game-engine';
import type {
  TacticalPattern,
  PatternLog,
  CompoundingEffect,
  TacticalCoherence,
  RecurrentSequence,
  MarkovTransition,
} from '@/lib/pattern-recognition';
import type { FatigueModel, InjuryRiskModel } from '@/lib/catapult-integration';
import type { PipelineLogEntry } from '@/types';

// ==================== Props ====================

interface PatternRecognitionData {
  activePatterns: { home: TacticalPattern[]; away: TacticalPattern[] };
  recentLogs: PatternLog[];
  compoundingEffects: CompoundingEffect[];
  coherence: { home: TacticalCoherence | null; away: TacticalCoherence | null };
  markov?: {
    recurrentSequences: RecurrentSequence[];
    currentChains: { home: string; away: string };
    topTransitions: { home: MarkovTransition[]; away: MarkovTransition[] };
    predictedNext: { home: string | null; away: string | null };
  };
}

interface FatigueData {
  home: Map<string, FatigueModel>;
  away: Map<string, FatigueModel>;
  injuryRisks: Map<string, InjuryRiskModel>;
  recommendations: {
    substitutionTargets: { playerId: string; priority: 'urgent' | 'soon' | 'optional'; reason: string }[];
    pressingAdjustments: { recommendation: string; affectedPlayers: string[] }[];
    formationSuggestions: string[];
  };
}

interface InstructionLogEntry {
  id: string;
  timestamp: Date;
  minute: number;
  input: string;
  category: string;
  confidence: number;
  status: 'applied' | 'pending' | 'rejected';
  affectedPlayers: string[];
  effect?: string;
}

export interface TechnicalBackendScreenProps {
  isLive: boolean;
  matchMinute: number;
  matchStats: MatchStats | null;
  patternRecognitionData: PatternRecognitionData;
  fatigueData: FatigueData;
  instructionLog: InstructionLogEntry[];
  pipelineLogs: PipelineLogEntry[];
  tickRate: number;
  matchPhase: string;
  eventsCount: number;
  onTickRateChange?: (rate: number) => void;
}

// ==================== Algorithm Definitions ====================

interface AlgorithmDef {
  id: string;
  name: string;
  module: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const ALGORITHMS: AlgorithmDef[] = [
  { id: 'game_engine', name: 'Game Engine', module: 'game-engine.ts', icon: <Cpu className="w-3.5 h-3.5" />, color: 'emerald', description: 'Match simulation, ball physics, event generation' },
  { id: 'pattern_recognition', name: 'Pattern Recognition', module: 'pattern-recognition.ts', icon: <Brain className="w-3.5 h-3.5" />, color: 'purple', description: 'Tactical pattern detection, Markov chains, compounding effects' },
  { id: 'catapult_integration', name: 'Catapult GPS', module: 'catapult-integration.ts', icon: <Wifi className="w-3.5 h-3.5" />, color: 'sky', description: 'GPS tracking, fatigue modeling, injury risk prediction' },
  { id: 'analytics_engine', name: 'Analytics Engine', module: 'analytics-engine.ts', icon: <BarChart3 className="w-3.5 h-3.5" />, color: 'amber', description: 'xG calculation, passing networks, pressing traps, heatmaps' },
  { id: 'coherence_analysis', name: 'Coherence Analysis', module: 'coherence-analysis.ts', icon: <Gauge className="w-3.5 h-3.5" />, color: 'rose', description: 'Game model coherence scoring, deviation tracking, alerts' },
  { id: 'tactical_ai', name: 'Tactical AI', module: 'ai-manager-interface.ts', icon: <Target className="w-3.5 h-3.5" />, color: 'blue', description: 'NLP instruction processing, verification, game model updates' },
];

const DATA_SOURCES = [
  { id: 'gps', name: 'GPS / Catapult', icon: <Wifi className="w-3 h-3" /> },
  { id: 'match_events', name: 'Match Events', icon: <Activity className="w-3 h-3" /> },
  { id: 'player_tracking', name: 'Player Tracking', icon: <Database className="w-3 h-3" /> },
  { id: 'pattern_engine', name: 'Pattern Engine', icon: <Brain className="w-3 h-3" /> },
  { id: 'coherence', name: 'Coherence Analysis', icon: <Gauge className="w-3 h-3" /> },
  { id: 'ai_interface', name: 'AI Interface', icon: <Zap className="w-3 h-3" /> },
];

// ==================== Component ====================

export function TechnicalBackendScreen({
  isLive,
  matchMinute,
  matchStats,
  patternRecognitionData,
  fatigueData,
  instructionLog,
  pipelineLogs,
  tickRate,
  matchPhase,
  eventsCount,
}: TechnicalBackendScreenProps) {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('game_engine');
  const [expandedAlgorithm, setExpandedAlgorithm] = useState<string | null>('game_engine');

  // Derive algorithm statuses from real data
  const algorithmStatuses = useMemo(() => {
    const homePatterns = patternRecognitionData.activePatterns.home;
    const coherence = patternRecognitionData.coherence.home;
    const homeFatigueCount = fatigueData.home.size;
    const instructionsProcessed = instructionLog.length;
    const avgConfidence = instructionLog.length > 0
      ? instructionLog.reduce((s, l) => s + l.confidence, 0) / instructionLog.length
      : 0;

    return {
      game_engine: {
        status: isLive ? 'active' as const : 'idle' as const,
        metrics: {
          'Tick Rate': `${tickRate}Hz`,
          'Match Phase': matchPhase.replace('_', ' '),
          'Events': eventsCount.toString(),
          'Ball Updates': isLive ? '100%' : '0%',
        },
      },
      pattern_recognition: {
        status: (isLive && homePatterns.length > 0 ? 'active' : isLive ? 'warming_up' : 'idle') as 'active' | 'idle' | 'warming_up',
        metrics: {
          'Patterns Detected': homePatterns.length.toString(),
          'Chain Health': patternRecognitionData.markov?.currentChains?.home ? 'Building' : 'No chain',
          'Sequences': (patternRecognitionData.markov?.recurrentSequences?.length || 0).toString(),
          'Logs': patternRecognitionData.recentLogs.length.toString(),
        },
      },
      catapult_integration: {
        status: (homeFatigueCount > 0 ? 'active' : isLive ? 'warming_up' : 'idle') as 'active' | 'idle' | 'warming_up',
        metrics: {
          'Players Tracked': `${homeFatigueCount + fatigueData.away.size}`,
          'Fatigue Models': homeFatigueCount.toString(),
          'Injury Risks': fatigueData.injuryRisks.size.toString(),
          'Sub Targets': fatigueData.recommendations.substitutionTargets.length.toString(),
        },
      },
      analytics_engine: {
        status: (matchStats ? 'active' : isLive ? 'warming_up' : 'idle') as 'active' | 'idle' | 'warming_up',
        metrics: {
          'Home xG': matchStats?.xG.home.toFixed(2) ?? '0.00',
          'Away xG': matchStats?.xG.away.toFixed(2) ?? '0.00',
          'Shots': `${matchStats?.shots.home ?? 0}/${matchStats?.shots.away ?? 0}`,
          'Pass Acc': `${matchStats?.passAccuracy?.home ?? 0}%`,
        },
      },
      coherence_analysis: {
        status: (coherence ? 'active' : isLive ? 'warming_up' : 'idle') as 'active' | 'idle' | 'warming_up',
        metrics: {
          'Score': coherence ? `${coherence.coherenceScore}%` : 'N/A',
          'Deviations': (coherence?.deviations?.length ?? 0).toString(),
          'Trend': coherence?.historicalComparison?.trend ?? 'N/A',
          'Game Model': coherence?.gameModel?.replace(/_/g, ' ') ?? 'None',
        },
      },
      tactical_ai: {
        status: (instructionsProcessed > 0 ? 'active' : 'idle') as 'active' | 'idle',
        metrics: {
          'Processed': instructionsProcessed.toString(),
          'Applied': instructionLog.filter(l => l.status === 'applied').length.toString(),
          'Rejected': instructionLog.filter(l => l.status === 'rejected').length.toString(),
          'Avg Conf': avgConfidence > 0 ? `${Math.round(avgConfidence * 100)}%` : 'N/A',
        },
      },
    };
  }, [isLive, matchStats, patternRecognitionData, fatigueData, instructionLog, tickRate, matchPhase, eventsCount]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'text-emerald-400 bg-emerald-500/20';
      case 'warming_up': return 'text-amber-400 bg-amber-500/20';
      case 'error': return 'text-red-400 bg-red-500/20';
      default: return 'text-white/40 bg-white/10';
    }
  };

  const algoColorClass = (color: string) => {
    const map: Record<string, string> = {
      emerald: 'text-emerald-400', purple: 'text-purple-400', sky: 'text-sky-400',
      amber: 'text-amber-400', rose: 'text-rose-400', blue: 'text-blue-400',
    };
    return map[color] || 'text-white/60';
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column: Data Sources + Algorithms + Detail View */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
        {/* Top Row: Data Source Status + Algorithm Reformation */}
        <div className="flex gap-2 flex-shrink-0">
          {/* Data Source Status */}
          <div className="flex-1 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">Data Source Status</span>
            </div>
            <div className="p-2 space-y-1">
              {DATA_SOURCES.map(source => {
                const connected = isLive;
                return (
                  <div key={source.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/20">
                    <span className="text-white/50">{source.icon}</span>
                    <span className="flex-1 text-[10px] text-white/70">{source.name}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-white/20'}`} />
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                      {connected ? 'LIVE' : 'IDLE'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Algorithm Reformation (1-6) */}
          <div className="flex-1 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] uppercase tracking-wider text-purple-400 font-medium">Algorithm Reformation</span>
            </div>
            <div className="p-2 space-y-1">
              {ALGORITHMS.map((algo, idx) => {
                const status = algorithmStatuses[algo.id as keyof typeof algorithmStatuses];
                const isSelected = selectedAlgorithm === algo.id;
                return (
                  <button
                    key={algo.id}
                    onClick={() => {
                      setSelectedAlgorithm(algo.id);
                      setExpandedAlgorithm(algo.id);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all ${
                      isSelected ? 'bg-white/10 border border-white/10' : 'bg-black/20 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-[10px] text-white/30 w-4 font-mono">{idx + 1}.</span>
                    <span className={algoColorClass(algo.color)}>{algo.icon}</span>
                    <span className="flex-1 text-[10px] text-white/80 font-medium">{algo.name}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${statusColor(status.status)}`}>
                      {status.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail Algorithm Operation Modification (Expanded View) */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] uppercase tracking-wider text-sky-400 font-medium">
              Detail Algorithm Operation — {ALGORITHMS.find(a => a.id === selectedAlgorithm)?.name}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {(() => {
              const algo = ALGORITHMS.find(a => a.id === selectedAlgorithm);
              const status = algorithmStatuses[selectedAlgorithm as keyof typeof algorithmStatuses];
              if (!algo || !status) return null;

              return (
                <div className="space-y-3">
                  {/* Module Info */}
                  <div className="flex items-center gap-3">
                    <span className={`${algoColorClass(algo.color)}`}>{algo.icon}</span>
                    <div>
                      <div className="text-[11px] text-white/90 font-medium">{algo.name}</div>
                      <div className="text-[9px] text-white/40 font-mono">{algo.module}</div>
                    </div>
                    <span className={`ml-auto text-[9px] px-2 py-0.5 rounded font-medium ${statusColor(status.status)}`}>
                      {status.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50">{algo.description}</p>

                  {/* Live Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(status.metrics).map(([key, value]) => (
                      <div key={key} className="bg-black/30 rounded p-2 border border-white/5">
                        <div className="text-[8px] text-white/40 uppercase tracking-wider">{key}</div>
                        <div className="text-[12px] text-white/90 font-medium mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Algorithm-specific expanded data */}
                  {selectedAlgorithm === 'pattern_recognition' && patternRecognitionData.markov && (
                    <div className="space-y-2">
                      <div className="text-[9px] text-white/40 uppercase tracking-wider">Markov Transitions (Home)</div>
                      {patternRecognitionData.markov.topTransitions.home.slice(0, 4).map((t, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1 bg-purple-500/10 rounded text-[9px]">
                          <span className="text-purple-300">{t.from.replace(/_/g, ' ')}</span>
                          <span className="text-white/30">→</span>
                          <span className="text-purple-300">{t.to.replace(/_/g, ' ')}</span>
                          <span className="ml-auto text-white/40">{Math.round(t.probability * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAlgorithm === 'catapult_integration' && fatigueData.recommendations.substitutionTargets.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[9px] text-white/40 uppercase tracking-wider">Substitution Targets</div>
                      {fatigueData.recommendations.substitutionTargets.map((t, i) => (
                        <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-[9px] ${
                          t.priority === 'urgent' ? 'bg-red-500/10 text-red-300' :
                          t.priority === 'soon' ? 'bg-amber-500/10 text-amber-300' :
                          'bg-white/5 text-white/50'
                        }`}>
                          <span className="font-medium uppercase">{t.priority}</span>
                          <span className="flex-1">{t.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAlgorithm === 'coherence_analysis' && patternRecognitionData.coherence.home && (
                    <div className="space-y-2">
                      <div className="text-[9px] text-white/40 uppercase tracking-wider">Deviations</div>
                      {patternRecognitionData.coherence.home.deviations.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1 bg-rose-500/10 rounded text-[9px] text-rose-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="flex-1">{d.pattern} — {d.reason}</span>
                          <span className="text-white/30">{Math.round(d.deviation)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Right Column: Live Debugging + Pipeline Logs + Model Customization */}
      <div className="w-[420px] flex flex-col overflow-hidden gap-2 p-2 pl-0">
        {/* Live Debugging + AI Embed */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] uppercase tracking-wider text-green-400 font-medium">Live Debugging</span>
            {isLive && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
          </div>
          {/* Debug Log Stream */}
          <div className="flex-1 overflow-y-auto px-2 py-1 font-mono min-h-0">
            {pipelineLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/20 text-[10px]">
                {isLive ? 'Waiting for pipeline events...' : 'Start match to see debug output'}
              </div>
            ) : (
              pipelineLogs.slice(0, 30).map((log) => (
                <div key={log.id} className={`text-[9px] py-0.5 flex gap-2 ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warn' ? 'text-amber-400' :
                  log.level === 'debug' ? 'text-white/30' :
                  'text-white/50'
                }`}>
                  <span className="text-white/20 flex-shrink-0">{log.timestamp.toLocaleTimeString('en-GB', { hour12: false })}</span>
                  <span className={`flex-shrink-0 w-16 ${
                    log.level === 'error' ? 'text-red-500' :
                    log.level === 'warn' ? 'text-amber-500' :
                    'text-white/30'
                  }`}>[{log.module}]</span>
                  <span className="flex-1 truncate">{log.message}</span>
                </div>
              ))
            )}
          </div>
          {/* AI Embed */}
          <div className="flex-shrink-0 border-t border-white/5 h-[220px]">
            <GrokAIEmbed context="backend" matchMinute={matchMinute} compact />
          </div>
        </div>

        {/* Pipeline Logs (Formatted) */}
        <div className="h-40 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <Activity className="w-3 h-3 text-orange-400" />
            <span className="text-[10px] uppercase tracking-wider text-orange-400 font-medium">Pipeline Logs</span>
            <span className="text-[9px] text-white/30 ml-auto">{pipelineLogs.length} entries</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 font-mono">
            {pipelineLogs.filter(l => l.level !== 'debug').slice(0, 20).map((log) => (
              <div key={log.id} className="text-[9px] py-0.5 flex items-start gap-1.5">
                {log.level === 'error' ? <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0 mt-0.5" /> :
                 log.level === 'warn' ? <AlertTriangle className="w-2.5 h-2.5 text-amber-400 flex-shrink-0 mt-0.5" /> :
                 <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400/50 flex-shrink-0 mt-0.5" />}
                <span className="text-white/50 truncate">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model Customization */}
        <div className="h-36 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <Sliders className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-medium">Model Customization</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {[
              { label: 'Confidence Threshold', value: 0.65, min: 0.3, max: 1.0 },
              { label: 'Coherence Sensitivity', value: 15, min: 5, max: 30 },
              { label: 'Pattern Min Confidence', value: 0.5, min: 0.2, max: 0.9 },
            ].map((param) => (
              <div key={param.label} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/50">{param.label}</span>
                  <span className="text-[9px] text-white/80 font-mono">{param.value}</span>
                </div>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={0.05}
                  defaultValue={param.value}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
