'use client';

import { useState, useMemo } from 'react';
import {
  Activity,
  BarChart3,
  AlertTriangle,
  Brain,
  Gauge,
  Target,
  Cpu,
  Wifi,
  Zap,
  Download,
  ToggleLeft,
  ToggleRight,
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

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const colorClass: Record<string, string> = {
    purple: 'bg-[#6B46C1]', green: 'bg-[#2D9F6F]', orange: 'bg-[#E5863A]',
    red: 'bg-[#E04E5E]', blue: 'bg-[#3B82F6]', indigo: 'bg-[#4F46E5]',
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8E8CA0] font-medium">{label}</span>
        <span className="text-[10px] text-[#1a1a2e] font-bold font-mono">{typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}</span>
      </div>
      <div className="h-1.5 bg-[#e8e4f0] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass[color] || 'bg-[#6B46C1]'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const ALGO_LIST = [
    { id: 'game_engine', name: 'Game Engine', icon: <Cpu className="w-3.5 h-3.5" />, color: 'emerald' },
    { id: 'pattern_recognition', name: 'Pattern Recognition', icon: <Brain className="w-3.5 h-3.5" />, color: 'purple' },
    { id: 'catapult_integration', name: 'Catapult GPS', icon: <Wifi className="w-3.5 h-3.5" />, color: 'blue' },
    { id: 'analytics_engine', name: 'Analytics Engine', icon: <BarChart3 className="w-3.5 h-3.5" />, color: 'orange' },
    { id: 'coherence_analysis', name: 'Coherence', icon: <Gauge className="w-3.5 h-3.5" />, color: 'red' },
    { id: 'tactical_ai', name: 'Tactical AI', icon: <Target className="w-3.5 h-3.5" />, color: 'indigo' },
  ];

  const algoColorMap: Record<string, string> = {
    emerald: 'text-[#2D9F6F]', purple: 'text-[#6B46C1]', blue: 'text-[#3B82F6]',
    orange: 'text-[#E5863A]', red: 'text-[#E04E5E]', indigo: 'text-[#4F46E5]',
  };

  const algoBorderMap: Record<string, string> = {
    emerald: 'border-[#2D9F6F]/30 bg-[#E6F7EF]',
    purple: 'border-[#6B46C1]/30 bg-[#f3eefc]',
    blue: 'border-[#3B82F6]/30 bg-[#EBF2FF]',
    orange: 'border-[#E5863A]/30 bg-[#FEF3E8]',
    red: 'border-[#E04E5E]/30 bg-[#FDE8EB]',
    indigo: 'border-[#4F46E5]/30 bg-[#EEF2FF]',
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        {/* Catapult Player Stats */}
        <div className="flex-shrink-0 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-[#e8e4f0] flex items-center gap-2">
            <Wifi className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-[11px] uppercase tracking-wider text-[#3B82F6] font-bold">Catapult — Player Stats</span>
          </div>
          <div className="p-3">
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
              {players.slice(0, 11).map((player) => {
                const fatigue = fatigueData.home.get(player.id);
                const isSelected = (selectedPlayer?.id || players[0]?.id) === player.id;
                return (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#6B46C1] text-white shadow-md shadow-purple-200'
                        : 'bg-[#faf9fe] text-[#8E8CA0] hover:bg-[#f3eefc] border border-[#e8e4f0]'
                    }`}
                  >
                    <span className={isSelected ? 'text-white/60' : 'text-[#b8b4c8]'}>#{player.number} </span>
                    {player.name.split(' ').pop()}
                    {fatigue && fatigue.currentFatigue > 60 && (
                      <span className="ml-1 text-[#E04E5E]">!</span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedPlayer && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-2">
                <div className="col-span-2 flex items-center gap-2 mb-1">
                  <span className="text-[13px] text-[#1a1a2e] font-bold">{selectedPlayer.name}</span>
                  <span className="text-[10px] text-[#8E8CA0] bg-[#f3eefc] px-2 py-0.5 rounded-full font-medium">#{selectedPlayer.number} · {selectedPlayer.position}</span>
                </div>
                <StatBar label="Distance (m)" value={selectedPlayerMetrics?.totalDistance ?? 0} max={12000} color="blue" />
                <StatBar label="Max Speed (km/h)" value={selectedPlayerMetrics?.maxSpeed ?? 0} max={36} color="green" />
                <StatBar label="Sprint Distance (m)" value={selectedPlayerMetrics?.sprintDistance ?? 0} max={1500} color="orange" />
                <StatBar label="Player Load" value={selectedPlayerMetrics?.playerLoad ?? 0} max={800} color="purple" />
                <StatBar label="Fatigue %" value={selectedPlayerFatigue?.currentFatigue ?? 0} max={100} color="red" />
                <StatBar label="HSR Distance (m)" value={selectedPlayerMetrics?.highSpeedRunningDistance ?? 0} max={2000} color="indigo" />
              </div>
            )}
          </div>
        </div>

        {/* Match Overview Full Stats */}
        <div className="flex-1 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-[#e8e4f0] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#E5863A]" />
            <span className="text-[11px] uppercase tracking-wider text-[#E5863A] font-bold">Match Overview — Full Stats</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {matchStats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-10 py-3">
                  <div className="text-center">
                    <div className="text-[#6B46C1] text-[11px] font-bold mb-1">MCI (Home)</div>
                    <div className="text-[28px] font-black text-[#1a1a2e]">{matchStats.xG?.home?.toFixed(1) ?? '0.0'}</div>
                    <div className="text-[10px] text-[#8E8CA0] font-medium">xG</div>
                  </div>
                  <div className="text-[10px] text-[#b8b4c8] font-bold">vs</div>
                  <div className="text-center">
                    <div className="text-[#E04E5E] text-[11px] font-bold mb-1">MUN (Away)</div>
                    <div className="text-[28px] font-black text-[#1a1a2e]">{matchStats.xG?.away?.toFixed(1) ?? '0.0'}</div>
                    <div className="text-[10px] text-[#8E8CA0] font-medium">xG</div>
                  </div>
                </div>

                <div className="space-y-2.5">
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
                      <div key={stat.label} className="flex items-center gap-3">
                        <span className="text-[11px] text-[#6B46C1] w-8 text-right font-bold font-mono">{stat.home}</span>
                        <div className="flex-1 h-2 bg-[#e8e4f0] rounded-full overflow-hidden flex">
                          <div className="h-full bg-[#6B46C1] rounded-l-full transition-all" style={{ width: `${homePct}%` }} />
                          <div className="h-full bg-[#E04E5E]/70 rounded-r-full flex-1" />
                        </div>
                        <span className="text-[11px] text-[#E04E5E] w-8 font-bold font-mono">{stat.away}</span>
                        <span className="text-[10px] text-[#8E8CA0] w-24 text-center font-medium">{stat.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-[#e8e4f0]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#8E8CA0] uppercase tracking-wider font-semibold">Team Coherence</span>
                    <span className={`text-[13px] font-bold ${overallCoherence >= 70 ? 'text-[#2D9F6F]' : overallCoherence >= 50 ? 'text-[#E5863A]' : 'text-[#E04E5E]'}`}>
                      {overallCoherence}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#e8e4f0] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${overallCoherence >= 70 ? 'bg-[#2D9F6F]' : overallCoherence >= 50 ? 'bg-[#E5863A]' : 'bg-[#E04E5E]'}`}
                      style={{ width: `${overallCoherence}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-[#b8b4c8] text-[11px] font-medium">
                Start match to see statistics
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="w-[420px] flex flex-col overflow-hidden gap-4 p-4 pl-0">
        {/* Algorithm Status */}
        <div className="flex-shrink-0 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-[#e8e4f0] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#6B46C1]" />
            <span className="text-[11px] uppercase tracking-wider text-[#6B46C1] font-bold">Algorithm Status</span>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {ALGO_LIST.map((algo, idx) => (
              <div key={algo.id} className="flex items-center gap-2 px-3 py-2 bg-[#faf9fe] rounded-xl border border-[#e8e4f0]">
                <span className="text-[10px] text-[#b8b4c8] font-mono font-bold">{idx + 1}</span>
                <span className={algoColorMap[algo.color]}>{algo.icon}</span>
                <span className="text-[10px] text-[#1a1a2e] flex-1 truncate font-medium">{algo.name}</span>
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#2D9F6F]' : 'bg-[#d4d0e0]'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Technical Alert Logs */}
        <div className="h-40 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm flex flex-col">
          <div className="px-4 py-2.5 border-b border-[#e8e4f0] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[#E5863A]" />
            <span className="text-[11px] uppercase tracking-wider text-[#E5863A] font-bold">Technical Alert Logs</span>
            <span className="text-[10px] text-[#8E8CA0] ml-auto font-medium">{alerts.length} alerts</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#b8b4c8] text-[11px]">No alerts</div>
            ) : (
              alerts.slice(0, 20).map((alert, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-medium ${
                  alert.severity === 'high' ? 'bg-[#FDE8EB] text-[#E04E5E]' :
                  alert.severity === 'medium' ? 'bg-[#FEF3E8] text-[#E5863A]' :
                  'bg-[#faf9fe] text-[#8E8CA0]'
                }`}>
                  {alert.severity === 'high' ? <AlertTriangle className="w-3 h-3 flex-shrink-0" /> :
                   <Activity className="w-3 h-3 flex-shrink-0" />}
                  <span className="flex-1 truncate">{alert.message}</span>
                  <span className="text-[#b8b4c8] flex-shrink-0">{alert.timestamp.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Alert Prompting */}
        <div className="flex-1 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-[#e8e4f0] flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#6B46C1]" />
            <span className="text-[11px] uppercase tracking-wider text-[#6B46C1] font-bold">AI Alert Prompting</span>
          </div>
          <div className="flex-1 min-h-0">
            <GrokAIEmbed context="analytics" matchMinute={matchMinute} compact />
          </div>
        </div>

        {/* Exported Algorithm Selection */}
        <div className="flex-shrink-0 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-[#e8e4f0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span className="text-[11px] uppercase tracking-wider text-[#4F46E5] font-bold">Algorithm Selection</span>
            </div>
            <span className="text-[10px] text-[#8E8CA0] font-medium">{enabledAlgorithms.size}/6 active</span>
          </div>
          <div className="p-3 grid grid-cols-3 gap-2">
            {ALGO_LIST.map((algo) => {
              const enabled = enabledAlgorithms.has(algo.id);
              return (
                <button
                  key={algo.id}
                  onClick={() => toggleAlgorithm(algo.id)}
                  className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-xl border transition-all ${
                    enabled ? algoBorderMap[algo.color] : 'border-[#e8e4f0] bg-[#faf9fe] opacity-40'
                  }`}
                >
                  <span className={algoColorMap[algo.color]}>{algo.icon}</span>
                  <span className="text-[8px] text-[#1a1a2e] text-center leading-tight font-semibold">{algo.name}</span>
                  {enabled ? <ToggleRight className="w-4 h-4 text-[#2D9F6F]" /> : <ToggleLeft className="w-4 h-4 text-[#b8b4c8]" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
