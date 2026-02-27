'use client';

import { useState, useCallback } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Users,
  AlertTriangle,
  MessageSquare,
  Shield,
  Swords,
  Tag,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { PitchView } from '@/components/dashboard/pitch-view';
import { GrokAIEmbed } from './grok-ai-embed';
import { useGameStore } from '@/store/game-store';
import type { Player, TrackingMetrics, StaffComment } from '@/types';
import type { MatchState, MatchStats } from '@/lib/game-engine';
import type {
  TacticalPattern,
  PatternLog,
  CompoundingEffect,
  TacticalCoherence,
  RecurrentSequence,
  MarkovTransition,
} from '@/lib/pattern-recognition';
import type { FatigueModel, InjuryRiskModel } from '@/lib/catapult-integration';
import type { GameModelTemplate } from '@/lib/game-model-manager';

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

interface TwinPosition {
  playerId: string;
  name: string;
  role: string;
  idealX: number;
  idealY: number;
  actualX: number;
  actualY: number;
  deviation: number;
  isCoherent: boolean;
}

interface PLStanding {
  position: number;
  team: { id: number; name: string; shortName: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface PLMatchForm {
  id: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: { fullTime: { home: number | null; away: number | null } };
}

export interface ManagerScreenProps {
  isLive: boolean;
  matchState: MatchState | null;
  matchStats: MatchStats | null;
  players: Player[];
  awayPlayers: Player[];
  liveData: Map<string, TrackingMetrics>;
  awayLiveData: Map<string, TrackingMetrics>;
  patternRecognitionData: PatternRecognitionData;
  fatigueData: FatigueData;
  twinPositions: TwinPosition[];
  overallCoherence: number;
  idealPositions: { x: number; y: number; role: string }[];
  instructionLog: InstructionLogEntry[];
  instructionInput: string;
  isProcessing: boolean;
  isRecording: boolean;
  onInstructionInputChange: (value: string) => void;
  onSendInstruction: () => void;
  onToggleRecording: () => void;
  onTriggerPress: (triggerId: string, label: string) => void;
  selectedTemplate: string | null;
  onTemplateSelect: (templateId: string) => void;
  templates: GameModelTemplate[];
  modelName: string;
  standings?: PLStanding[];
  homeForm?: PLMatchForm[];
  awayForm?: PLMatchForm[];
}

const COMMENT_CATEGORIES = [
  { id: 'line_order' as const, label: 'Line Order', icon: <FileText className="w-3 h-3" /> },
  { id: 'tag_internal' as const, label: 'Tag Internal', icon: <Tag className="w-3 h-3" /> },
  { id: 'natural' as const, label: 'Natural', icon: <MessageSquare className="w-3 h-3" /> },
  { id: 'comment' as const, label: 'Comment', icon: <MessageSquare className="w-3 h-3" /> },
];

export function ManagerScreen({
  isLive,
  matchState,
  matchStats,
  players,
  awayPlayers,
  liveData,
  awayLiveData,
  patternRecognitionData,
  fatigueData,
  twinPositions,
  overallCoherence,
  idealPositions,
  instructionLog,
  instructionInput,
  isProcessing,
  isRecording,
  onInstructionInputChange,
  onSendInstruction,
  onToggleRecording,
  onTriggerPress,
  selectedTemplate,
  onTemplateSelect,
  templates,
  modelName,
  standings,
  homeForm,
  awayForm,
}: ManagerScreenProps) {
  const { staffComments, addStaffComment } = useGameStore();
  const [commentInput, setCommentInput] = useState('');
  const [commentCategory, setCommentCategory] = useState<StaffComment['category']>('comment');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const matchMinute = matchState?.minute ? Math.floor(matchState.minute) : 0;

  const handleAddComment = useCallback(() => {
    if (!commentInput.trim()) return;
    addStaffComment({
      id: `comment-${Date.now()}`,
      author: 'Pep Guardiola',
      category: commentCategory,
      content: commentInput.trim(),
      timestamp: new Date(),
      minute: matchMinute,
    });
    setCommentInput('');
  }, [commentInput, commentCategory, matchMinute, addStaffComment]);

  const keyAlerts = [
    ...fatigueData.recommendations.substitutionTargets.map(t => ({
      type: 'fatigue' as const,
      severity: t.priority === 'urgent' ? 'high' : t.priority === 'soon' ? 'medium' : 'low',
      message: t.reason,
    })),
    ...(patternRecognitionData.coherence.home?.deviations || []).map(d => ({
      type: 'tactical' as const,
      severity: 'medium' as const,
      message: `${d.pattern}: ${d.reason}`,
    })),
    ...fatigueData.recommendations.pressingAdjustments.map(a => ({
      type: 'pressing' as const,
      severity: 'low' as const,
      message: a.recommendation,
    })),
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Game Model + Live Pitch */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
        {/* Top: Game Model Preset + Base/Specific Model */}
        <div className="flex-shrink-0 flex gap-2">
          {/* Game Model Preset */}
          <div className="w-56 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm">
            <div className="px-3 py-2 border-b border-[#e8e4f0] flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-[#2D9F6F]" />
              <span className="text-[10px] uppercase tracking-wider text-[#2D9F6F] font-bold">Game Model Preset</span>
            </div>
            <div className="p-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#f3eefc] rounded-full flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-[#6B46C1]" />
                </div>
                <div>
                  <div className="text-[11px] text-[#1a1a2e] font-bold">Pep Guardiola</div>
                  <div className="text-[9px] text-[#8E8CA0] font-medium">Manager</div>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#faf9fe] rounded-xl border border-[#e8e4f0] text-[10px] text-[#1a1a2e] font-semibold hover:border-[#6B46C1]/30 transition-all"
                >
                  <span>{modelName}</span>
                  <ChevronDown className="w-3 h-3 text-[#8E8CA0]" />
                </button>
                {showTemplateSelector && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#e8e4f0] rounded-xl overflow-hidden shadow-xl">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { onTemplateSelect(t.id); setShowTemplateSelector(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-[#f3eefc] transition-all font-medium ${
                          selectedTemplate === t.id ? 'bg-[#E6F7EF] text-[#2D9F6F]' : 'text-[#1a1a2e]'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Base Model */}
          <div className="flex-1 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm">
            <div className="px-3 py-2 border-b border-[#e8e4f0] flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span className="text-[10px] uppercase tracking-wider text-[#3B82F6] font-bold">Base Model</span>
            </div>
            <div className="p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {(templates.find(t => t.id === selectedTemplate)?.principles || []).slice(0, 4).map((p, i) => (
                  <div key={i} className="text-[9px] text-[#1a1a2e] px-2 py-1 bg-[#faf9fe] rounded-lg border border-[#e8e4f0] truncate font-medium">
                    {p}
                  </div>
                ))}
              </div>
              <div className="mt-1.5 text-[9px] text-[#8E8CA0] font-medium">
                Formation: <span className="text-[#6B46C1] font-bold">{templates.find(t => t.id === selectedTemplate)?.baseFormation || '4-3-3'}</span>
              </div>
            </div>
          </div>

          {/* Game Specific Model */}
          <div className="flex-1 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm">
            <div className="px-3 py-2 border-b border-[#e8e4f0] flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-[#E5863A]" />
              <span className="text-[10px] uppercase tracking-wider text-[#E5863A] font-bold">Game Specific</span>
            </div>
            <div className="p-2 space-y-1">
              {(() => {
                const mciStanding = standings?.find(s => s.team.id === 65);
                const munStanding = standings?.find(s => s.team.id === 66);
                const getFormDots = (matches: PLMatchForm[] | undefined, teamId: number) => {
                  if (!matches?.length) return null;
                  return matches.slice(0, 5).map((m, i) => {
                    const isHome = m.homeTeam.id === teamId;
                    const h = m.score?.fullTime?.home ?? 0;
                    const a = m.score?.fullTime?.away ?? 0;
                    const result = isHome ? (h > a ? 'W' : h < a ? 'L' : 'D') : (a > h ? 'W' : a < h ? 'L' : 'D');
                    const color = result === 'W' ? 'bg-[#2D9F6F]' : result === 'D' ? 'bg-[#E5863A]' : 'bg-[#E04E5E]';
                    return <span key={i} className={`w-2 h-2 rounded-full ${color}`} title={result} />;
                  });
                };
                return (
                  <>
                    <div className="text-[9px] text-[#1a1a2e] px-2 py-1 bg-[#faf9fe] rounded-lg border border-[#e8e4f0] font-medium flex items-center justify-between">
                      <span>vs Manchester United — Counter-attacking style</span>
                      {munStanding && <span className="text-[#8E8CA0]">#{munStanding.position} · {munStanding.points}pts</span>}
                    </div>
                    {(homeForm?.length || awayForm?.length) ? (
                      <div className="flex gap-2 px-2 py-1 bg-[#faf9fe] rounded-lg border border-[#e8e4f0]">
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-[#6B46C1] font-bold">MCI</span>
                          <div className="flex gap-0.5">{getFormDots(homeForm, 65)}</div>
                          {mciStanding && <span className="text-[8px] text-[#8E8CA0] ml-1">#{mciStanding.position}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-[#E04E5E] font-bold">MUN</span>
                          <div className="flex gap-0.5">{getFormDots(awayForm, 66)}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[9px] text-[#1a1a2e] px-2 py-1 bg-[#faf9fe] rounded-lg border border-[#e8e4f0] font-medium">Key battle: Midfield pressing zones</div>
                    )}
                    <div className="text-[9px] text-[#1a1a2e] px-2 py-1 bg-[#faf9fe] rounded-lg border border-[#e8e4f0] font-medium">Focus: Width exploitation, half-spaces</div>
                    <div className="text-[9px] text-[#8E8CA0] mt-0.5 font-medium">Phase: <span className="text-[#6B46C1] font-bold">{matchState?.phase?.replace('_', ' ') || 'pre-match'}</span></div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Live Game with Players */}
        <div className="flex-1 bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm flex flex-col min-h-0">
          <div className="flex-shrink-0 px-3 py-1.5 border-b border-[#e8e4f0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#2D9F6F] font-bold">Live Match</span>
              <span className="text-[10px] text-[#8E8CA0] font-medium">{matchStats?.possession?.home ?? 50}% poss</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-[#6B46C1] font-bold">xG {matchStats?.xG?.home?.toFixed(1) ?? '0.0'}</span>
              <span className="text-[#b8b4c8]">|</span>
              <span className="text-[#E04E5E] font-bold">xG {matchStats?.xG?.away?.toFixed(1) ?? '0.0'}</span>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
            <PitchView
              className="!w-auto !h-full !max-w-full"
              players={players}
              awayPlayers={awayPlayers}
              liveData={liveData}
              awayLiveData={awayLiveData}
              selectedPlayerId={null}
              onPlayerClick={() => {}}
              ballPosition={matchState?.ballPosition}
              ballPossession={matchState?.ballPossession}
              defensiveBlock={matchState?.defensiveBlock}
              pressingIntensity={matchState?.pressingIntensity}
              analytics={{ xG: matchStats ? { home: matchStats.xG.home, away: matchStats.xG.away } : { home: 0, away: 0 } }}
              patternRecognition={patternRecognitionData}
              fatigueData={fatigueData}
            />
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-80 flex flex-col bg-white border-l border-[#e8e4f0] overflow-hidden">
        {/* Coherence Score + Digital Twin */}
        <div className="flex-shrink-0 h-32 border-b border-[#e8e4f0]">
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0 px-3 py-1.5 bg-[#faf9fe] border-b border-[#e8e4f0] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-[#3B82F6] font-bold">Digital Twin</span>
                <span className="text-[8px] px-1.5 py-0.5 bg-[#EBF2FF] text-[#3B82F6] rounded-full font-bold">{modelName}</span>
              </div>
              <span className={`text-[10px] font-bold ${overallCoherence >= 70 ? 'text-[#2D9F6F]' : overallCoherence >= 50 ? 'text-[#E5863A]' : 'text-[#E04E5E]'}`}>
                {twinPositions.filter(p => p.isCoherent).length}/11 · {overallCoherence}%
              </span>
            </div>
            <div className="flex-1 bg-gradient-to-b from-[#e6f7ef]/30 to-white relative overflow-hidden">
              <svg viewBox="0 0 100 65" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <rect x="0" y="0" width="100" height="65" fill="#1a5c2e" />
                <line x1="50" y1="0" x2="50" y2="65" stroke="#2a7a40" strokeWidth="0.3" />
                <circle cx="50" cy="32.5" r="8" fill="none" stroke="#2a7a40" strokeWidth="0.3" />
                <rect x="0" y="20" width="12" height="25" fill="none" stroke="#2a7a40" strokeWidth="0.3" />
                <rect x="88" y="20" width="12" height="25" fill="none" stroke="#2a7a40" strokeWidth="0.3" />
                {idealPositions.map((pos, idx) => (
                  <g key={`ideal-${idx}`}>
                    <circle cx={pos.x} cy={pos.y * 0.65} r="2.5" fill="#6B46C1" opacity="0.9" />
                    <text x={pos.x} y={pos.y * 0.65 + 5} textAnchor="middle" fontSize="2.2" fill="#fff" opacity="0.8">{pos.role}</text>
                  </g>
                ))}
                <circle cx="45" cy="32.5" r="1.2" fill="white" />
              </svg>
            </div>
          </div>
        </div>

        {/* AI Instruction Embed */}
        <div className="flex-shrink-0 h-[160px] border-b border-[#e8e4f0]">
          <GrokAIEmbed context="manager" matchMinute={matchMinute} compact />
        </div>

        {/* Input Section */}
        <div className="flex-shrink-0 border-b border-[#e8e4f0]">
          <div className="px-3 py-1 bg-[#faf9fe] flex items-center gap-2 border-b border-[#e8e4f0]">
            <span className="text-[9px] text-[#8E8CA0] uppercase tracking-wider font-semibold">Stage:</span>
            <span className="text-[9px] text-[#2D9F6F] font-bold">{matchState?.phase?.replace('_', ' ') || 'Pre-match'}</span>
            <span className="text-[9px] text-[#b8b4c8] ml-auto font-medium">{matchMinute}&apos;</span>
          </div>

          <div className="px-2 py-1.5 grid grid-cols-4 gap-1">
            {[
              { id: 'high_press', label: 'High Press', icon: '\u2B06\uFE0F' },
              { id: 'counter_press', label: 'Counter', icon: '\uD83D\uDD04' },
              { id: 'mid_block', label: 'Mid Block', icon: '\uD83D\uDEE1\uFE0F' },
              { id: 'low_block', label: 'Low Block', icon: '\u2B07\uFE0F' },
              { id: 'hold_line', label: 'Hold Line', icon: '\uD83D\uDCCF' },
              { id: 'step_up', label: 'Step Up', icon: '\u2B06\uFE0F' },
              { id: 'drop_deep', label: 'Drop Deep', icon: '\u2B07\uFE0F' },
              { id: 'man_mark', label: 'Man Mark', icon: '\uD83D\uDC64' },
            ].map(trigger => {
              const isMarkovSuggested = patternRecognitionData.markov?.predictedNext?.home?.toLowerCase().includes(trigger.id.replace('_', ' '));
              return (
                <button
                  key={trigger.id}
                  onClick={() => onTriggerPress(trigger.id, trigger.label)}
                  className={`relative px-1.5 py-1 rounded-lg text-[8px] font-semibold transition-all ${
                    isMarkovSuggested
                      ? 'bg-[#f3eefc] text-[#6B46C1] border border-[#6B46C1]/30 shadow-sm'
                      : 'bg-[#faf9fe] text-[#8E8CA0] border border-[#e8e4f0] hover:bg-[#f3eefc] hover:text-[#6B46C1]'
                  }`}
                >
                  <span className="mr-0.5">{trigger.icon}</span>{trigger.label}
                  {isMarkovSuggested && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#6B46C1] rounded-full animate-pulse" />}
                </button>
              );
            })}
          </div>

          <div className="px-2 py-1.5 flex items-center gap-1.5">
            <input
              type="text"
              value={instructionInput}
              onChange={(e) => onInstructionInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSendInstruction()}
              placeholder="Type instruction..."
              className="flex-1 bg-[#faf9fe] border border-[#e8e4f0] rounded-full px-3 py-1.5 text-[10px] text-[#1a1a2e] placeholder-[#b8b4c8] outline-none focus:border-[#6B46C1] focus:ring-2 focus:ring-[#6B46C1]/10 transition-all"
            />
            <button onClick={onToggleRecording} className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${isRecording ? 'bg-[#E04E5E] text-white' : 'bg-[#faf9fe] text-[#8E8CA0] border border-[#e8e4f0] hover:bg-[#f3eefc]'}`}>
              {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </button>
            <button onClick={onSendInstruction} disabled={isProcessing || !instructionInput.trim()} className="w-7 h-7 flex items-center justify-center bg-[#6B46C1] hover:bg-[#5a38a8] disabled:opacity-30 rounded-full shadow-sm shadow-purple-200 transition-all">
              {isProcessing ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Send className="w-3 h-3 text-white" />}
            </button>
          </div>

          <div className="max-h-16 overflow-y-auto px-2 py-0.5 space-y-0.5">
            {instructionLog.slice(0, 4).map(entry => (
              <div key={entry.id} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-medium ${
                entry.status === 'applied' ? 'bg-[#E6F7EF] text-[#2D9F6F]' :
                entry.status === 'pending' ? 'bg-[#FEF3E8] text-[#E5863A]' :
                'bg-[#FDE8EB] text-[#E04E5E]'
              }`}>
                {entry.status === 'applied' ? <CheckCircle2 className="w-2.5 h-2.5" /> :
                 entry.status === 'pending' ? <Clock className="w-2.5 h-2.5" /> :
                 <XCircle className="w-2.5 h-2.5" />}
                <span className="flex-1 truncate">{entry.input}</span>
                <span className="text-[#b8b4c8]">{entry.minute}&apos;</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Alerts */}
        <div className="flex-shrink-0 max-h-20 overflow-y-auto border-b border-[#e8e4f0]">
          <div className="px-3 py-1 bg-[#faf9fe] flex items-center gap-2 border-b border-[#e8e4f0]">
            <AlertTriangle className="w-3 h-3 text-[#E5863A]" />
            <span className="text-[9px] text-[#E5863A] uppercase tracking-wider font-bold">Key Alerts</span>
            <span className="text-[9px] text-[#8E8CA0] ml-auto font-medium">{keyAlerts.length}</span>
          </div>
          <div className="px-2 py-1 space-y-0.5">
            {keyAlerts.length === 0 ? (
              <div className="text-[9px] text-[#b8b4c8] text-center py-1 font-medium">No alerts</div>
            ) : (
              keyAlerts.slice(0, 4).map((alert, i) => (
                <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-medium ${
                  alert.severity === 'high' ? 'bg-[#FDE8EB] text-[#E04E5E]' :
                  alert.severity === 'medium' ? 'bg-[#FEF3E8] text-[#E5863A]' :
                  'bg-[#faf9fe] text-[#8E8CA0]'
                }`}>
                  <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="flex-1 truncate">{alert.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alert Controls */}
        <div className="flex-shrink-0 px-2 py-1.5 border-b border-[#e8e4f0] flex gap-1">
          {[
            { id: 'press_high', label: 'Press', icon: '\u2B06\uFE0F' },
            { id: 'sit_deep', label: 'Sit Deep', icon: '\u2B07\uFE0F' },
            { id: 'width', label: 'Width', icon: '\u2194\uFE0F' },
            { id: 'tempo_up', label: 'Tempo+', icon: '\u26A1' },
            { id: 'custom', label: 'Custom', icon: '\u2699\uFE0F' },
          ].map(ctrl => (
            <button
              key={ctrl.id}
              onClick={() => onTriggerPress(ctrl.id, ctrl.label)}
              className="flex-1 px-1 py-1.5 bg-[#faf9fe] hover:bg-[#f3eefc] hover:text-[#6B46C1] border border-[#e8e4f0] rounded-lg text-[8px] text-[#8E8CA0] font-semibold transition-all text-center"
            >
              <span className="block text-xs">{ctrl.icon}</span>
              {ctrl.label}
            </button>
          ))}
        </div>

        {/* Technical Staff Comments */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-shrink-0 px-3 py-1 bg-[#faf9fe] flex items-center gap-2 border-b border-[#e8e4f0]">
            <MessageSquare className="w-3 h-3 text-[#4F46E5]" />
            <span className="text-[9px] text-[#4F46E5] uppercase tracking-wider font-bold">Staff Comments</span>
          </div>

          <div className="flex-shrink-0 px-2 py-1 flex gap-1 border-b border-[#e8e4f0]">
            {COMMENT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCommentCategory(cat.id)}
                className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8px] font-semibold transition-all ${
                  commentCategory === cat.id
                    ? 'bg-[#6B46C1] text-white shadow-sm shadow-purple-200'
                    : 'bg-[#faf9fe] text-[#8E8CA0] border border-[#e8e4f0] hover:bg-[#f3eefc]'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex-shrink-0 px-2 py-1.5 flex items-center gap-1.5 border-b border-[#e8e4f0]">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              placeholder="Add comment..."
              className="flex-1 bg-[#faf9fe] border border-[#e8e4f0] rounded-full px-3 py-1 text-[10px] text-[#1a1a2e] placeholder-[#b8b4c8] outline-none focus:border-[#6B46C1] focus:ring-2 focus:ring-[#6B46C1]/10 transition-all"
            />
            <button onClick={handleAddComment} disabled={!commentInput.trim()} className="w-6 h-6 flex items-center justify-center bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-30 rounded-full shadow-sm transition-all">
              <Send className="w-2.5 h-2.5 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
            {staffComments.length === 0 ? (
              <div className="text-[9px] text-[#b8b4c8] text-center py-3 font-medium">No comments yet</div>
            ) : (
              staffComments.map(comment => {
                const catColor: Record<string, string> = {
                  line_order: 'bg-[#EBF2FF] text-[#3B82F6] border-[#3B82F6]/20',
                  tag_internal: 'bg-[#FEF3E8] text-[#E5863A] border-[#E5863A]/20',
                  natural: 'bg-[#E6F7EF] text-[#2D9F6F] border-[#2D9F6F]/20',
                  comment: 'bg-[#faf9fe] text-[#1a1a2e] border-[#e8e4f0]',
                };
                return (
                  <div key={comment.id} className={`px-2 py-1.5 rounded-lg border ${catColor[comment.category] || catColor.comment}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[7px] font-bold uppercase tracking-wider">{comment.category.replace('_', ' ')}</span>
                      <span className="text-[7px] text-[#b8b4c8] font-medium">{comment.minute}&apos; · {comment.author}</span>
                    </div>
                    <div className="text-[9px] font-medium">{comment.content}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
