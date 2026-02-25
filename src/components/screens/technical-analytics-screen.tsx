'use client';

import { useState, useMemo } from 'react';
import {
  Activity,
  Users,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  Gauge,
  Target,
  Cpu,
  Wifi,
  Zap,
  Download,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
  Footprints,
} from 'lucide-react';
import { GrokAIEmbed } from './grok-ai-embed';
import type { Player } from '@/types';
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
import type { TrackingMetrics } from '@/types';

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

export interface TechnicalAnalyticsScreenProps {
  isLive: boolean;
  matchMinute: number;
  matchStats: MatchStats | null;
  players: Player[];
  liveData: Map<string, TrackingMetrics>;
  patternRecognitionData: PatternRecognitionData;
  fatigueData: FatigueData;
  instructionLog: InstructionLogEntry[];
  overallCoherence: number;
  alerts: { type: string; severity: string; message: string; timestamp: Date }[];
}

// ==================== Helpers ====================

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const colorClass: Record<string, string> = {
    sky: 'bg-sky-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
    red: 'bg-red-500', purple: 'bg-purple-500', blue: 'bg-blue-500',
  };
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-white/50">{label}</span>
        <span className="text-[9px] text-white/70 font-mono">{typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass[color] || 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ==================== Component ====================

export function TechnicalAnalyticsScreen({
  isLive,
  matchMinute,
  matchStats,
  players,
  liveData,
  patternRecognitionData,
  fatigueData,
  instructionLog,
  overallCoherence,
  alerts,
}: TechnicalAnalyticsScreenProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [enabledAlgorithms, setEnabledAlgorithms] = useState<Set<string>>(
    new Set(['game_engine', 'pattern_recognition', 'catapult_integration', 'analytics_engine', 'coherence_analysis', 'tactical_ai'])
  );

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return players[0] || null;
    return players.find(p => p.id === selectedPlayerId) || players[0] || null;
  }, [selectedPlayerId, players]);

  const selectedPlayerMetrics = useMemo(() => {
    if (!selectedPlayer) return null;
    return liveData.get(selectedPlayer.id) || null;
  }, [selectedPlayer, liveData]);

  const selectedPlayerFatigue = useMemo(() => {
    if (!selectedPlayer) return null;
    return fatigueData.home.get(selectedPlayer.id) || null;
  }, [selectedPlayer, fatigueData]);

  const toggleAlgorithm = (id: string) => {
    setEnabledAlgorithms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ALGO_LIST = [
    { id: 'game_engine', name: 'Game Engine', icon: <Cpu className="w-3 h-3" />, color: 'emerald' },
    { id: 'pattern_recognition', name: 'Pattern Recognition', icon: <Brain className="w-3 h-3" />, color: 'purple' },
    { id: 'catapult_integration', name: 'Catapult GPS', icon: <Wifi className="w-3 h-3" />, color: 'sky' },
    { id: 'analytics_engine', name: 'Analytics Engine', icon: <BarChart3 className="w-3 h-3" />, color: 'amber' },
    { id: 'coherence_analysis', name: 'Coherence', icon: <Gauge className="w-3 h-3" />, color: 'rose' },
    { id: 'tactical_ai', name: 'Tactical AI', icon: <Target className="w-3 h-3" />, color: 'blue' },
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column: Catapult Stats + Match Overview */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
        {/* Catapult Player Stats */}
        <div className="flex-shrink-0 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
          <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] uppercase tracking-wider text-sky-400 font-medium">Catapult — Player Stats</span>
          </div>
          <div className="p-2">
            {/* Player selector */}
            <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
              {players.slice(0, 11).map((player) => {
                const fatigue = fatigueData.home.get(player.id);
                const isSelected = (selectedPlayer?.id || players[0]?.id) === player.id;
                return (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={`flex-shrink-0 px-2 py-1 rounded text-[9px] font-medium transition-all ${
                      isSelected
                        ? 'bg-sky-500/30 text-sky-200 border border-sky-500/50'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-white/30 mr-1">#{player.number}</span>
                    {player.name.split(' ').pop()}
                    {fatigue && fatigue.currentFatigue > 60 && (
                      <span className="ml-1 text-red-400">!</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected player stats */}
            {selectedPlayer && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-1">
                <div className="col-span-2 flex items-center gap-2 mb-1">
                  <span className="text-[11px] text-white/90 font-medium">{selectedPlayer.name}</span>
                  <span className="text-[9px] text-white/40">#{selectedPlayer.number} · {selectedPlayer.position}</span>
                </div>
                <StatBar label="Distance (m)" value={selectedPlayerMetrics?.totalDistance ?? 0} max={12000} color="sky" />
                <StatBar label="Max Speed (km/h)" value={selectedPlayerMetrics?.maxSpeed ?? 0} max={36} color="emerald" />
                <StatBar label="Sprint Distance (m)" value={selectedPlayerMetrics?.sprintDistance ?? 0} max={1500} color="amber" />
                <StatBar label="Player Load" value={selectedPlayerMetrics?.playerLoad ?? 0} max={800} color="purple" />
                <StatBar label="Fatigue %" value={selectedPlayerFatigue?.currentFatigue ?? 0} max={100} color="red" />
                <StatBar label="HSR Distance (m)" value={selectedPlayerMetrics?.highSpeedRunningDistance ?? 0} max={2000} color="blue" />
              </div>
            )}
          </div>
        </div>

        {/* Match Overview Full Stats */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-medium">Match Overview — Full Stats</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {matchStats ? (
              <div className="space-y-3">
                {/* Score and xG */}
                <div className="flex items-center justify-center gap-8 py-2">
                  <div className="text-center">
                    <div className="text-sky-400 text-[10px] font-medium mb-1">MCI (Home)</div>
                    <div className="text-[20px] font-bold text-white">{matchStats.xG?.home?.toFixed(1) ?? '0.0'}</div>
                    <div className="text-[9px] text-white/40">xG</div>
                  </div>
                  <div className="text-[9px] text-white/20">vs</div>
                  <div className="text-center">
                    <div className="text-red-400 text-[10px] font-medium mb-1">MUN (Away)</div>
                    <div className="text-[20px] font-bold text-white">{matchStats.xG?.away?.toFixed(1) ?? '0.0'}</div>
                    <div className="text-[9px] text-white/40">xG</div>
                  </div>
                </div>

                {/* Stats Comparison */}
                <div className="space-y-1.5">
                  {[
                    { label: 'Possession', home: `${matchStats.possession?.home ?? 50}%`, away: `${matchStats.possession?.away ?? 50}%`, homeVal: matchStats.possession?.home ?? 50, awayVal: matchStats.possession?.away ?? 50 },
                    { label: 'Shots', home: matchStats.shots?.home ?? 0, away: matchStats.shots?.away ?? 0, homeVal: matchStats.shots?.home ?? 0, awayVal: matchStats.shots?.away ?? 0 },
                    { label: 'Shots on Target', home: matchStats.shotsOnTarget?.home ?? 0, away: matchStats.shotsOnTarget?.away ?? 0, homeVal: matchStats.shotsOnTarget?.home ?? 0, awayVal: matchStats.shotsOnTarget?.away ?? 0 },
                    { label: 'Pass Accuracy', home: `${matchStats.passAccuracy?.home ?? 0}%`, away: `${matchStats.passAccuracy?.away ?? 0}%`, homeVal: matchStats.passAccuracy?.home ?? 0, awayVal: matchStats.passAccuracy?.away ?? 0 },
                    { label: 'Corners', home: matchStats.corners?.home ?? 0, away: matchStats.corners?.away ?? 0, homeVal: matchStats.corners?.home ?? 0, awayVal: matchStats.corners?.away ?? 0 },
                    { label: 'Fouls', home: matchStats.fouls?.home ?? 0, away: matchStats.fouls?.away ?? 0, homeVal: matchStats.fouls?.home ?? 0, awayVal: matchStats.fouls?.away ?? 0 },
                  ].map((stat) => {
                    const total = (Number(stat.homeVal) || 0) + (Number(stat.awayVal) || 0);
                    const homePct = total > 0 ? (Number(stat.homeVal) / total) * 100 : 50;
                    return (
                      <div key={stat.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-sky-300 w-8 text-right font-mono">{stat.home}</span>
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                          <div className="h-full bg-sky-500/70 rounded-l-full" style={{ width: `${homePct}%` }} />
                          <div className="h-full bg-red-500/70 rounded-r-full flex-1" />
                        </div>
                        <span className="text-[10px] text-red-300 w-8 font-mono">{stat.away}</span>
                        <span className="text-[9px] text-white/40 w-20 text-center">{stat.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Coherence bar */}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-white/40 uppercase tracking-wider">Team Coherence</span>
                    <span className={`text-[11px] font-medium ${overallCoherence >= 70 ? 'text-emerald-400' : overallCoherence >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {overallCoherence}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${overallCoherence >= 70 ? 'bg-emerald-500' : overallCoherence >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${overallCoherence}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-white/20 text-[10px]">
                Start match to see statistics
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Algorithm Status + Alert Logs + AI Prompting + Export View */}
      <div className="w-[420px] flex flex-col overflow-hidden gap-2 p-2 pl-0">
        {/* Algorithm Status (compact) */}
        <div className="flex-shrink-0 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
          <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] uppercase tracking-wider text-purple-400 font-medium">Algorithm Status</span>
          </div>
          <div className="p-2 grid grid-cols-2 gap-1">
            {ALGO_LIST.map((algo, idx) => {
              const colorMap: Record<string, string> = {
                emerald: 'text-emerald-400', purple: 'text-purple-400', sky: 'text-sky-400',
                amber: 'text-amber-400', rose: 'text-rose-400', blue: 'text-blue-400',
              };
              return (
                <div key={algo.id} className="flex items-center gap-1.5 px-2 py-1.5 bg-black/20 rounded">
                  <span className="text-[9px] text-white/30 font-mono">{idx + 1}</span>
                  <span className={colorMap[algo.color]}>{algo.icon}</span>
                  <span className="text-[9px] text-white/70 flex-1 truncate">{algo.name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-white/20'}`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Technical Alert Logs */}
        <div className="h-40 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            <span className="text-[10px] uppercase tracking-wider text-orange-400 font-medium">Technical Alert Logs</span>
            <span className="text-[9px] text-white/30 ml-auto">{alerts.length} alerts</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/20 text-[10px]">
                No alerts
              </div>
            ) : (
              alerts.slice(0, 20).map((alert, i) => (
                <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] ${
                  alert.severity === 'high' ? 'bg-red-500/10 text-red-300' :
                  alert.severity === 'medium' ? 'bg-amber-500/10 text-amber-300' :
                  'bg-white/5 text-white/50'
                }`}>
                  {alert.severity === 'high' ? <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" /> :
                   <Activity className="w-2.5 h-2.5 flex-shrink-0" />}
                  <span className="flex-1 truncate">{alert.message}</span>
                  <span className="text-white/20 flex-shrink-0">{alert.timestamp.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Alert Prompting (Grok Embed) */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-1.5 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <Zap className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] uppercase tracking-wider text-purple-400 font-medium">AI Alert Prompting</span>
          </div>
          <div className="flex-1 min-h-0">
            <GrokAIEmbed context="analytics" matchMinute={matchMinute} compact />
          </div>
        </div>

        {/* Exported Algorithm Selection View */}
        <div className="flex-shrink-0 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
          <div className="px-3 py-1.5 bg-black/40 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-medium">Algorithm Selection</span>
            </div>
            <span className="text-[9px] text-white/30">{enabledAlgorithms.size}/6 active</span>
          </div>
          <div className="p-2 grid grid-cols-3 gap-1">
            {ALGO_LIST.map((algo) => {
              const enabled = enabledAlgorithms.has(algo.id);
              const colorMap: Record<string, string> = {
                emerald: 'border-emerald-500/50 bg-emerald-500/10',
                purple: 'border-purple-500/50 bg-purple-500/10',
                sky: 'border-sky-500/50 bg-sky-500/10',
                amber: 'border-amber-500/50 bg-amber-500/10',
                rose: 'border-rose-500/50 bg-rose-500/10',
                blue: 'border-blue-500/50 bg-blue-500/10',
              };
              return (
                <button
                  key={algo.id}
                  onClick={() => toggleAlgorithm(algo.id)}
                  className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded border transition-all ${
                    enabled ? colorMap[algo.color] : 'border-white/5 bg-white/5 opacity-40'
                  }`}
                >
                  {algo.icon}
                  <span className="text-[8px] text-white/60 text-center leading-tight">{algo.name}</span>
                  {enabled ? <ToggleRight className="w-3 h-3 text-emerald-400" /> : <ToggleLeft className="w-3 h-3 text-white/30" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
