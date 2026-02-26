'use client';

import { useState, useMemo } from 'react';
import {
  Activity,
  Database,
  Cpu,
  Wifi,
  AlertTriangle,
  CheckCircle2,
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

interface AlgorithmDef {
  id: string;
  name: string;
  module: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const ALGORITHMS: AlgorithmDef[] = [
  { id: 'game_engine', name: 'Game Engine', module: 'game-engine.ts', icon: <Cpu className="w-4 h-4" />, color: 'emerald', description: 'Match simulation, ball physics, event generation' },
  { id: 'pattern_recognition', name: 'Pattern Recognition', module: 'pattern-recognition.ts', icon: <Brain className="w-4 h-4" />, color: 'purple', description: 'Tactical pattern detection, Markov chains, compounding effects' },
  { id: 'catapult_integration', name: 'Catapult GPS', module: 'catapult-integration.ts', icon: <Wifi className="w-4 h-4" />, color: 'blue', description: 'GPS tracking, fatigue modeling, injury risk prediction' },
  { id: 'analytics_engine', name: 'Analytics Engine', module: 'analytics-engine.ts', icon: <BarChart3 className="w-4 h-4" />, color: 'orange', description: 'xG calculation, passing networks, pressing traps, heatmaps' },
  { id: 'coherence_analysis', name: 'Coherence Analysis', module: 'coherence-analysis.ts', icon: <Gauge className="w-4 h-4" />, color: 'red', description: 'Game model coherence scoring, deviation tracking, alerts' },
  { id: 'tactical_ai', name: 'Tactical AI', module: 'ai-manager-interface.ts', icon: <Target className="w-4 h-4" />, color: 'indigo', description: 'NLP instruction processing, verification, game model updates' },
];

const DATA_SOURCES = [
  { id: 'gps', name: 'GPS / Catapult', icon: <Wifi className="w-3.5 h-3.5" /> },
  { id: 'match_events', name: 'Match Events', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'player_tracking', name: 'Player Tracking', icon: <Database className="w-3.5 h-3.5" /> },
  { id: 'pattern_engine', name: 'Pattern Engine', icon: <Brain className="w-3.5 h-3.5" /> },
  { id: 'coherence', name: 'Coherence Analysis', icon: <Gauge className="w-3.5 h-3.5" /> },
  { id: 'ai_interface', name: 'AI Interface', icon: <Zap className="w-3.5 h-3.5" /> },
];

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
        metrics: { 'Tick Rate': `${tickRate}Hz`, 'Match Phase': matchPhase.replace('_', ' '), 'Events': eventsCount.toString(), 'Ball Updates': isLive ? '100%' : '0%' },
      },
      pattern_recognition: {
        status: (isLive && homePatterns.length > 0 ? 'active' : isLive ? 'warming_up' : 'idle') as 'active' | 'idle' | 'warming_up',
        metrics: { 'Patterns': homePatterns.length.toString(), 'Chain': patternRecognitionData.markov?.currentChains?.home ? 'Building' : 'No chain', 'Sequences': (patternRecognitionData.markov?.recurrentSequences?.length || 0).toString(), 'Logs': patternRecognitionData.recentLogs.length.toString() },
      },
      catapult_integration: {
        status: (homeFatigueCount > 0 ? 'active' : isLive ? 'warming_up' : 'idle') as 'active' | 'idle' | 'warming_up',
        metrics: { 'Tracked': `${homeFatigueCount + fatigueData.away.size}`, 'Fatigue': homeFatigueCount.toString(), 'Injury Risk': fatigueData.injuryRisks.size.toString(), 'Sub Targets': fatigueData.recommendations.substitutionTargets.length.toString() },
      },
      analytics_engine: {
        status: (matchStats ? 'active' : isLive ? 'warming_up' : 'idle') as 'active' | 'idle' | 'warming_up',
        metrics: { 'Home xG': matchStats?.xG.home.toFixed(2) ?? '0.00', 'Away xG': matchStats?.xG.away.toFixed(2) ?? '0.00', 'Shots': `${matchStats?.shots.home ?? 0}/${matchStats?.shots.away ?? 0}`, 'Pass Acc': `${matchStats?.passAccuracy?.home ?? 0}%` },
      },
      coherence_analysis: {
        status: (coherence ? 'active' : isLive ? 'warming_up' : 'idle') as 'active' | 'idle' | 'warming_up',
        metrics: { 'Score': coherence ? `${coherence.coherenceScore}%` : 'N/A', 'Deviations': (coherence?.deviations?.length ?? 0).toString(), 'Trend': coherence?.historicalComparison?.trend ?? 'N/A', 'Model': coherence?.gameModel?.replace(/_/g, ' ') ?? 'None' },
      },
      tactical_ai: {
        status: (instructionsProcessed > 0 ? 'active' : 'idle') as 'active' | 'idle',
        metrics: { 'Processed': instructionsProcessed.toString(), 'Applied': instructionLog.filter(l => l.status === 'applied').length.toString(), 'Rejected': instructionLog.filter(l => l.status === 'rejected').length.toString(), 'Avg Conf': avgConfidence > 0 ? `${Math.round(avgConfidence * 100)}%` : 'N/A' },
      },
    };
  }, [isLive, matchStats, patternRecognitionData, fatigueData, instructionLog, tickRate, matchPhase, eventsCount]);

  const statusBadge = (s: string) => {
    switch (s) {
      case 'active': return 'text-[#2D9F6F] bg-[#E6F7EF]';
      case 'warming_up': return 'text-[#E5863A] bg-[#FEF3E8]';
      case 'error': return 'text-[#E04E5E] bg-[#FDE8EB]';
      default: return 'text-[#8E8CA0] bg-[#f3eefc]';
    }
  };

  const algoColorClass = (color: string) => {
    const map: Record<string, string> = {
      emerald: 'text-[#2D9F6F]', purple: 'text-[#6B46C1]', blue: 'text-[#3B82F6]',
      orange: 'text-[#E5863A]', red: 'text-[#E04E5E]', indigo: 'text-[#4F46E5]',
    };
    return map[color] || 'text-[#8E8CA0]';
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
        {/* Top Row */}
        <div className="flex gap-2 flex-shrink-0">
          {/* Data Source Status */}
          <div className="flex-1 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm">
            <div className="px-3 py-2 border-b border-[#e8e4f0] flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-[#2D9F6F]" />
              <span className="text-[10px] uppercase tracking-wider text-[#2D9F6F] font-bold">Data Source Status</span>
            </div>
            <div className="p-2 space-y-1">
              {DATA_SOURCES.map(source => {
                const connected = isLive;
                return (
                  <div key={source.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#faf9fe]">
                    <span className="text-[#8E8CA0]">{source.icon}</span>
                    <span className="flex-1 text-[10px] text-[#1a1a2e] font-medium">{source.name}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#2D9F6F]' : 'bg-[#d4d0e0]'}`} />
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${connected ? 'bg-[#E6F7EF] text-[#2D9F6F]' : 'bg-[#f3eefc] text-[#8E8CA0]'}`}>
                      {connected ? 'LIVE' : 'IDLE'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Algorithm Reformation */}
          <div className="flex-1 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm">
            <div className="px-3 py-2 border-b border-[#e8e4f0] flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#6B46C1]" />
              <span className="text-[10px] uppercase tracking-wider text-[#6B46C1] font-bold">Algorithm Reformation</span>
            </div>
            <div className="p-2 space-y-1">
              {ALGORITHMS.map((algo, idx) => {
                const status = algorithmStatuses[algo.id as keyof typeof algorithmStatuses];
                const isSelected = selectedAlgorithm === algo.id;
                return (
                  <button
                    key={algo.id}
                    onClick={() => setSelectedAlgorithm(algo.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${
                      isSelected ? 'bg-[#f3eefc] border border-[#6B46C1]/20 shadow-sm' : 'bg-[#faf9fe] hover:bg-[#f3eefc]'
                    }`}
                  >
                    <span className="text-[10px] text-[#b8b4c8] w-4 font-mono font-bold">{idx + 1}.</span>
                    <span className={algoColorClass(algo.color)}>{algo.icon}</span>
                    <span className="flex-1 text-[10px] text-[#1a1a2e] font-semibold">{algo.name}</span>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold ${statusBadge(status.status)}`}>
                      {status.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail Algorithm Operation */}
        <div className="flex-1 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-[#e8e4f0] flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span className="text-[10px] uppercase tracking-wider text-[#3B82F6] font-bold">
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
                  <div className="flex items-center gap-2">
                    <span className={algoColorClass(algo.color)}>{algo.icon}</span>
                    <div>
                      <div className="text-[12px] text-[#1a1a2e] font-bold">{algo.name}</div>
                      <div className="text-[9px] text-[#8E8CA0] font-mono">{algo.module}</div>
                    </div>
                    <span className={`ml-auto text-[8px] px-2 py-0.5 rounded-full font-bold ${statusBadge(status.status)}`}>
                      {status.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8E8CA0]">{algo.description}</p>

                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(status.metrics).map(([key, value]) => (
                      <div key={key} className="bg-[#faf9fe] rounded-lg p-2 border border-[#e8e4f0]">
                        <div className="text-[8px] text-[#8E8CA0] uppercase tracking-wider font-semibold">{key}</div>
                        <div className="text-[13px] text-[#1a1a2e] font-bold mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedAlgorithm === 'pattern_recognition' && patternRecognitionData.markov && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] text-[#8E8CA0] uppercase tracking-wider font-semibold">Markov Transitions (Home)</div>
                      {patternRecognitionData.markov.topTransitions.home.slice(0, 4).map((t, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-[#f3eefc] rounded-lg text-[9px]">
                          <span className="text-[#6B46C1] font-medium">{t.from.replace(/_/g, ' ')}</span>
                          <span className="text-[#b8b4c8]">\u2192</span>
                          <span className="text-[#6B46C1] font-medium">{t.to.replace(/_/g, ' ')}</span>
                          <span className="ml-auto text-[#8E8CA0] font-mono">{Math.round(t.probability * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAlgorithm === 'catapult_integration' && fatigueData.recommendations.substitutionTargets.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] text-[#8E8CA0] uppercase tracking-wider font-semibold">Substitution Targets</div>
                      {fatigueData.recommendations.substitutionTargets.map((t, i) => (
                        <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[9px] font-medium ${
                          t.priority === 'urgent' ? 'bg-[#FDE8EB] text-[#E04E5E]' :
                          t.priority === 'soon' ? 'bg-[#FEF3E8] text-[#E5863A]' :
                          'bg-[#faf9fe] text-[#8E8CA0]'
                        }`}>
                          <span className="uppercase font-bold">{t.priority}</span>
                          <span className="flex-1">{t.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAlgorithm === 'coherence_analysis' && patternRecognitionData.coherence.home && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] text-[#8E8CA0] uppercase tracking-wider font-semibold">Deviations</div>
                      {patternRecognitionData.coherence.home.deviations.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-[#FDE8EB] rounded-lg text-[9px] text-[#E04E5E] font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="flex-1">{d.pattern} — {d.reason}</span>
                          <span className="text-[#8E8CA0]">{Math.round(d.deviation)}%</span>
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

      {/* Right Column */}
      <div className="w-[360px] flex flex-col overflow-hidden gap-2 p-2 pl-0">
        {/* Live Debugging + AI Embed */}
        <div className="flex-1 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-[#e8e4f0] flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[#2D9F6F]" />
            <span className="text-[10px] uppercase tracking-wider text-[#2D9F6F] font-bold">Live Debugging</span>
            {isLive && <span className="w-1.5 h-1.5 bg-[#2D9F6F] rounded-full animate-pulse" />}
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1.5 font-mono min-h-0 bg-[#faf9fe]">
            {pipelineLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#b8b4c8] text-[10px]">
                {isLive ? 'Waiting for pipeline events...' : 'Start match to see debug output'}
              </div>
            ) : (
              pipelineLogs.slice(0, 30).map((log) => (
                <div key={log.id} className={`text-[9px] py-0.5 flex gap-1.5 ${
                  log.level === 'error' ? 'text-[#E04E5E]' :
                  log.level === 'warn' ? 'text-[#E5863A]' :
                  'text-[#8E8CA0]'
                }`}>
                  <span className="text-[#b8b4c8] flex-shrink-0">{log.timestamp.toLocaleTimeString('en-GB', { hour12: false })}</span>
                  <span className={`flex-shrink-0 w-14 font-semibold ${
                    log.level === 'error' ? 'text-[#E04E5E]' :
                    log.level === 'warn' ? 'text-[#E5863A]' :
                    'text-[#6B46C1]'
                  }`}>[{log.module}]</span>
                  <span className="flex-1 truncate">{log.message}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex-shrink-0 border-t border-[#e8e4f0] h-[180px]">
            <GrokAIEmbed context="backend" matchMinute={matchMinute} compact />
          </div>
        </div>

        {/* Pipeline Logs */}
        <div className="h-32 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm flex flex-col">
          <div className="px-3 py-1.5 border-b border-[#e8e4f0] flex items-center gap-2">
            <Activity className="w-3 h-3 text-[#E5863A]" />
            <span className="text-[10px] uppercase tracking-wider text-[#E5863A] font-bold">Pipeline Logs</span>
            <span className="text-[9px] text-[#8E8CA0] ml-auto font-medium">{pipelineLogs.length} entries</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1.5">
            {pipelineLogs.filter(l => l.level !== 'debug').slice(0, 20).map((log) => (
              <div key={log.id} className="text-[9px] py-0.5 flex items-start gap-1.5">
                {log.level === 'error' ? <AlertTriangle className="w-2.5 h-2.5 text-[#E04E5E] flex-shrink-0 mt-0.5" /> :
                 log.level === 'warn' ? <AlertTriangle className="w-2.5 h-2.5 text-[#E5863A] flex-shrink-0 mt-0.5" /> :
                 <CheckCircle2 className="w-2.5 h-2.5 text-[#2D9F6F] flex-shrink-0 mt-0.5" />}
                <span className="text-[#1a1a2e]/70 truncate">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model Customization */}
        <div className="h-28 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm flex flex-col">
          <div className="px-3 py-1.5 border-b border-[#e8e4f0] flex items-center gap-2">
            <Sliders className="w-3 h-3 text-[#4F46E5]" />
            <span className="text-[10px] uppercase tracking-wider text-[#4F46E5] font-bold">Model Customization</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {[
              { label: 'Confidence Threshold', value: 0.65, min: 0.3, max: 1.0 },
              { label: 'Coherence Sensitivity', value: 15, min: 5, max: 30 },
              { label: 'Pattern Min Confidence', value: 0.5, min: 0.2, max: 0.9 },
            ].map((param) => (
              <div key={param.label} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[#8E8CA0] font-medium">{param.label}</span>
                  <span className="text-[9px] text-[#1a1a2e] font-bold font-mono">{param.value}</span>
                </div>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={0.05}
                  defaultValue={param.value}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
