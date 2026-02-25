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
  Zap,
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

export interface ManagerScreenProps {
  // Match state
  isLive: boolean;
  matchState: MatchState | null;
  matchStats: MatchStats | null;
  // Players
  players: Player[];
  awayPlayers: Player[];
  liveData: Map<string, TrackingMetrics>;
  awayLiveData: Map<string, TrackingMetrics>;
  // Pattern & Fatigue
  patternRecognitionData: PatternRecognitionData;
  fatigueData: FatigueData;
  // Digital Twin
  twinPositions: TwinPosition[];
  overallCoherence: number;
  idealPositions: { x: number; y: number; role: string }[];
  // Instructions
  instructionLog: InstructionLogEntry[];
  instructionInput: string;
  isProcessing: boolean;
  isRecording: boolean;
  onInstructionInputChange: (value: string) => void;
  onSendInstruction: () => void;
  onToggleRecording: () => void;
  // Triggers
  onTriggerPress: (triggerId: string, label: string) => void;
  // Template
  selectedTemplate: string | null;
  onTemplateSelect: (templateId: string) => void;
  templates: GameModelTemplate[];
  modelName: string;
}

// ==================== Sub-components ====================

const COMMENT_CATEGORIES = [
  { id: 'line_order' as const, label: 'Line Order', icon: <FileText className="w-3 h-3" /> },
  { id: 'tag_internal' as const, label: 'Tag Internal', icon: <Tag className="w-3 h-3" /> },
  { id: 'natural' as const, label: 'Natural', icon: <MessageSquare className="w-3 h-3" /> },
  { id: 'comment' as const, label: 'Comment', icon: <MessageSquare className="w-3 h-3" /> },
];

// ==================== Component ====================

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

  // Alert sources: fatigue + pattern deviations
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
          <div className="w-64 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">Game Model Preset</span>
            </div>
            <div className="p-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-sky-500/20 rounded-full flex items-center justify-center">
                  <Users className="w-3 h-3 text-sky-400" />
                </div>
                <div>
                  <div className="text-[10px] text-white/90 font-medium">Pep Guardiola</div>
                  <div className="text-[9px] text-white/40">Manager</div>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                  className="w-full flex items-center justify-between px-2 py-1.5 bg-black/30 rounded border border-white/10 text-[10px] text-white/80"
                >
                  <span>{modelName}</span>
                  <ChevronDown className="w-3 h-3 text-white/40" />
                </button>
                {showTemplateSelector && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-zinc-800 border border-white/10 rounded overflow-hidden shadow-xl">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { onTemplateSelect(t.id); setShowTemplateSelector(false); }}
                        className={`w-full text-left px-2 py-1.5 text-[10px] hover:bg-white/10 transition-all ${
                          selectedTemplate === t.id ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/70'
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
          <div className="flex-1 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] uppercase tracking-wider text-sky-400 font-medium">Base Model</span>
            </div>
            <div className="p-2">
              <div className="grid grid-cols-2 gap-1">
                {(templates.find(t => t.id === selectedTemplate)?.principles || []).slice(0, 4).map((p, i) => (
                  <div key={i} className="text-[9px] text-white/50 px-1.5 py-1 bg-black/20 rounded truncate">
                    {p}
                  </div>
                ))}
              </div>
              <div className="mt-1.5 text-[9px] text-white/30">
                Formation: {templates.find(t => t.id === selectedTemplate)?.baseFormation || '4-3-3'}
              </div>
            </div>
          </div>

          {/* Game Specific Model */}
          <div className="flex-1 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-medium">Game Specific</span>
            </div>
            <div className="p-2 space-y-1">
              <div className="text-[9px] text-white/50 px-1.5 py-1 bg-black/20 rounded">vs Manchester United — Counter-attacking style</div>
              <div className="text-[9px] text-white/50 px-1.5 py-1 bg-black/20 rounded">Key battle: Midfield pressing zones</div>
              <div className="text-[9px] text-white/50 px-1.5 py-1 bg-black/20 rounded">Focus: Width exploitation, half-spaces</div>
              <div className="text-[9px] text-white/30 mt-1">Phase: {matchState?.phase?.replace('_', ' ') || 'pre-match'}</div>
            </div>
          </div>
        </div>

        {/* Live Game with Players (Pitch View) */}
        <div className="flex-1 bg-zinc-900 rounded-xl overflow-hidden flex flex-col min-h-0">
          <div className="flex-shrink-0 px-4 py-2 bg-black/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">Live Match</span>
              <span className="text-xs text-white/40">{matchStats?.possession?.home ?? 50}% possession</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-sky-400">xG {matchStats?.xG?.home?.toFixed(1) ?? '0.0'}</span>
              <span className="text-white/20">|</span>
              <span className="text-red-400">xG {matchStats?.xG?.away?.toFixed(1) ?? '0.0'}</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <PitchView
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

      {/* Right: Twin + AI Embed + Controls + Alerts + Comments */}
      <div className="w-96 flex flex-col bg-zinc-900 border-l border-white/5 overflow-hidden">
        {/* Coherence Score + Digital Twin */}
        <div className="flex-shrink-0 h-40 border-b border-white/5">
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0 px-3 py-1.5 bg-black/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-sky-400">Digital Twin</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded">{modelName}</span>
              </div>
              <span className={`text-[10px] font-medium ${overallCoherence >= 70 ? 'text-emerald-400' : overallCoherence >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {twinPositions.filter(p => p.isCoherent).length}/11 coherent · {overallCoherence}%
              </span>
            </div>
            <div className="flex-1 bg-gradient-to-b from-emerald-950/30 to-zinc-900 relative overflow-hidden">
              <svg viewBox="0 0 100 65" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <rect x="0" y="0" width="100" height="65" fill="#0d1f0d" />
                <line x1="50" y1="0" x2="50" y2="65" stroke="#1a3a1a" strokeWidth="0.3" />
                <circle cx="50" cy="32.5" r="8" fill="none" stroke="#1a3a1a" strokeWidth="0.3" />
                <rect x="0" y="20" width="12" height="25" fill="none" stroke="#1a3a1a" strokeWidth="0.3" />
                <rect x="88" y="20" width="12" height="25" fill="none" stroke="#1a3a1a" strokeWidth="0.3" />
                {idealPositions.map((pos, idx) => (
                  <g key={`ideal-${idx}`}>
                    <circle cx={pos.x} cy={pos.y * 0.65} r="2.5" fill="#38bdf8" opacity="0.9" />
                    <text x={pos.x} y={pos.y * 0.65 + 5} textAnchor="middle" fontSize="2.2" fill="#38bdf8" opacity="0.7">{pos.role}</text>
                  </g>
                ))}
                <circle cx="45" cy="32.5" r="1.2" fill="white" />
              </svg>
            </div>
          </div>
        </div>

        {/* AI Instruction Embed (Grok) */}
        <div className="flex-shrink-0 h-[200px] border-b border-white/5">
          <GrokAIEmbed context="manager" matchMinute={matchMinute} compact />
        </div>

        {/* Input Section: Quick Triggers + Instruction Input */}
        <div className="flex-shrink-0 border-b border-white/5">
          {/* Stages / Phase indicator */}
          <div className="px-3 py-1.5 bg-black/20 flex items-center gap-2">
            <span className="text-[9px] text-white/40 uppercase tracking-wider">Stage:</span>
            <span className="text-[9px] text-emerald-400 font-medium">{matchState?.phase?.replace('_', ' ') || 'Pre-match'}</span>
            <span className="text-[9px] text-white/20 ml-auto">{matchMinute}&apos;</span>
          </div>

          {/* Arrow: Quick triggers */}
          <div className="px-3 py-1.5 grid grid-cols-4 gap-1">
            {[
              { id: 'high_press', label: 'High Press', icon: '⬆️' },
              { id: 'counter_press', label: 'Counter', icon: '🔄' },
              { id: 'mid_block', label: 'Mid Block', icon: '🛡️' },
              { id: 'low_block', label: 'Low Block', icon: '⬇️' },
              { id: 'hold_line', label: 'Hold Line', icon: '📏' },
              { id: 'step_up', label: 'Step Up', icon: '⬆️' },
              { id: 'drop_deep', label: 'Drop Deep', icon: '⬇️' },
              { id: 'man_mark', label: 'Man Mark', icon: '👤' },
            ].map(trigger => {
              const isMarkovSuggested = patternRecognitionData.markov?.predictedNext?.home?.toLowerCase().includes(trigger.id.replace('_', ' '));
              return (
                <button
                  key={trigger.id}
                  onClick={() => onTriggerPress(trigger.id, trigger.label)}
                  className={`relative px-1.5 py-1 rounded text-[8px] font-medium transition-all ${
                    isMarkovSuggested
                      ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50'
                      : 'bg-white/5 text-white/50 hover:bg-orange-500/20 hover:text-orange-200'
                  }`}
                >
                  <span className="mr-0.5">{trigger.icon}</span>{trigger.label}
                  {isMarkovSuggested && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />}
                </button>
              );
            })}
          </div>

          {/* Text instruction input */}
          <div className="px-3 py-1.5 flex items-center gap-1.5">
            <input
              type="text"
              value={instructionInput}
              onChange={(e) => onInstructionInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSendInstruction()}
              placeholder="Type instruction..."
              className="flex-1 bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-[10px] text-white placeholder-white/30 outline-none focus:border-emerald-500/50"
            />
            <button onClick={onToggleRecording} className={`w-7 h-7 flex items-center justify-center rounded-full ${isRecording ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'}`}>
              {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </button>
            <button onClick={onSendInstruction} disabled={isProcessing || !instructionInput.trim()} className="w-7 h-7 flex items-center justify-center bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-30 rounded-full">
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </button>
          </div>

          {/* Output: Execution Log */}
          <div className="max-h-24 overflow-y-auto px-2 py-1 space-y-0.5">
            {instructionLog.slice(0, 6).map(entry => (
              <div key={entry.id} className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] ${
                entry.status === 'applied' ? 'bg-emerald-500/10 text-emerald-300' :
                entry.status === 'pending' ? 'bg-amber-500/10 text-amber-300' :
                'bg-red-500/10 text-red-300'
              }`}>
                {entry.status === 'applied' ? <CheckCircle2 className="w-2.5 h-2.5" /> :
                 entry.status === 'pending' ? <Clock className="w-2.5 h-2.5" /> :
                 <XCircle className="w-2.5 h-2.5" />}
                <span className="flex-1 truncate">{entry.input}</span>
                <span className="text-white/30">{entry.minute}&apos;</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Alerts */}
        <div className="flex-shrink-0 max-h-28 overflow-y-auto border-b border-white/5">
          <div className="px-3 py-1.5 bg-black/20 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            <span className="text-[9px] text-orange-400 uppercase tracking-wider font-medium">Key Alerts</span>
            <span className="text-[9px] text-white/30 ml-auto">{keyAlerts.length}</span>
          </div>
          <div className="px-2 py-1 space-y-0.5">
            {keyAlerts.length === 0 ? (
              <div className="text-[9px] text-white/20 text-center py-2">No alerts</div>
            ) : (
              keyAlerts.slice(0, 5).map((alert, i) => (
                <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] ${
                  alert.severity === 'high' ? 'bg-red-500/10 text-red-300' :
                  alert.severity === 'medium' ? 'bg-amber-500/10 text-amber-300' :
                  'bg-white/5 text-white/40'
                }`}>
                  <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="flex-1 truncate">{alert.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alert Controls (5 custom) */}
        <div className="flex-shrink-0 px-3 py-1.5 border-b border-white/5 flex gap-1">
          {[
            { id: 'press_high', label: 'Press', icon: '⬆️' },
            { id: 'sit_deep', label: 'Sit Deep', icon: '⬇️' },
            { id: 'width', label: 'Width', icon: '↔️' },
            { id: 'tempo_up', label: 'Tempo+', icon: '⚡' },
            { id: 'custom', label: 'Custom', icon: '⚙️' },
          ].map(ctrl => (
            <button
              key={ctrl.id}
              onClick={() => onTriggerPress(ctrl.id, ctrl.label)}
              className="flex-1 px-1 py-1.5 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-200 rounded text-[8px] text-white/50 font-medium transition-all text-center"
            >
              <span className="block">{ctrl.icon}</span>
              {ctrl.label}
            </button>
          ))}
        </div>

        {/* Technical Staff Comments */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-shrink-0 px-3 py-1.5 bg-black/20 flex items-center gap-2">
            <MessageSquare className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] text-cyan-400 uppercase tracking-wider font-medium">Staff Comments</span>
          </div>

          {/* Category selector */}
          <div className="flex-shrink-0 px-2 py-1 flex gap-1">
            {COMMENT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCommentCategory(cat.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[8px] font-medium transition-all ${
                  commentCategory === cat.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>

          {/* Comment input */}
          <div className="flex-shrink-0 px-2 py-1 flex items-center gap-1.5">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              placeholder="Add comment..."
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white placeholder-white/30 outline-none focus:border-cyan-500/50"
            />
            <button onClick={handleAddComment} disabled={!commentInput.trim()} className="w-6 h-6 flex items-center justify-center bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-30 rounded">
              <Send className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {staffComments.length === 0 ? (
              <div className="text-[9px] text-white/20 text-center py-4">No comments yet</div>
            ) : (
              staffComments.map(comment => {
                const catColor: Record<string, string> = {
                  line_order: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
                  tag_internal: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
                  natural: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
                  comment: 'bg-white/5 text-white/50 border-white/10',
                };
                return (
                  <div key={comment.id} className={`px-2 py-1.5 rounded border ${catColor[comment.category] || catColor.comment}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] font-medium uppercase">{comment.category.replace('_', ' ')}</span>
                      <span className="text-[8px] text-white/20">{comment.minute}&apos; · {comment.author}</span>
                    </div>
                    <div className="text-[9px]">{comment.content}</div>
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
