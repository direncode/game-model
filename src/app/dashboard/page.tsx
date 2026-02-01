'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useGameStore } from '@/store/game-store';
import { PitchView } from '@/components/dashboard/pitch-view';
import { createDigitalTwin } from '@/lib/digital-twin';
import { getPLSquadData } from '@/lib/premier-league-api';
import {
  GameEngine,
  createManchesterDerby,
  type MatchEvent,
  type MatchState,
  type MatchStats,
} from '@/lib/game-engine';
import {
  TacticalPreset,
  getPresetById,
} from '@/lib/tactics-library';
import {
  PatternRecognitionEngine,
  type TacticalPattern,
  type PatternLog,
  type CompoundingEffect,
  type TacticalCoherence,
  type RecurrentSequence,
  type MarkovTransition,
} from '@/lib/pattern-recognition';
import {
  catapultService,
  type FatigueModel,
  type InjuryRiskModel,
} from '@/lib/catapult-integration';
import type { Player, TrackingMetrics } from '@/types';
import {
  Play,
  Pause,
  Square,
  Send,
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Target,
  GitCompare,
  Users,
} from 'lucide-react';
import {
  GameModelManager,
  createGameModelManager,
  type ManagerSession,
  type StaffMember,
  GAME_MODEL_TEMPLATES,
} from '@/lib/game-model-manager';

// Pattern Recognition Data Types
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

// Fatigue/Wearable Data Types
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

// Instruction Log Entry
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

// Digital Twin Position
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

export default function Home() {
  const {
    players,
    setPlayers,
    setTwin,
    liveData,
    updateLiveData,
    isLive,
    startMatch,
    updateMatch,
    endMatch,
  } = useGameStore();

  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Game Engine State
  const gameEngineRef = useRef<GameEngine | null>(null);
  const patternEngineRef = useRef<PatternRecognitionEngine | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [awayLiveData, setAwayLiveData] = useState<Map<string, TrackingMetrics>>(new Map());

  // Pattern Recognition State
  const [patternRecognitionData, setPatternRecognitionData] = useState<PatternRecognitionData>({
    activePatterns: { home: [], away: [] },
    recentLogs: [],
    compoundingEffects: [],
    coherence: { home: null, away: null },
    markov: {
      recurrentSequences: [],
      currentChains: { home: 'No chain', away: 'No chain' },
      topTransitions: { home: [], away: [] },
      predictedNext: { home: null, away: null }
    }
  });

  // Fatigue/Wearable Data State
  const [fatigueData, setFatigueData] = useState<FatigueData>({
    home: new Map(),
    away: new Map(),
    injuryRisks: new Map(),
    recommendations: {
      substitutionTargets: [],
      pressingAdjustments: [],
      formationSuggestions: [],
    }
  });

  // Tactics State
  const [selectedPreset, setSelectedPreset] = useState<TacticalPreset | null>(
    () => getPresetById('guardiola_total_football') || null
  );

  // Manager Console State
  const gameModelManagerRef = useRef<GameModelManager | null>(null);
  const [managerSession, setManagerSession] = useState<ManagerSession | null>(null);

  // Instruction Integration State
  const [instructionInput, setInstructionInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [instructionLog, setInstructionLog] = useState<InstructionLogEntry[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>('total_football');

  // Digital Twin ideal positions (4-3-3)
  const idealPositions = useMemo(() => {
    const roles = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'RW', 'ST', 'LW'];
    const positions = [
      { x: 50, y: 5 },   // GK
      { x: 85, y: 25 },  // RB
      { x: 65, y: 20 },  // CB
      { x: 35, y: 20 },  // CB
      { x: 15, y: 25 },  // LB
      { x: 50, y: 35 },  // CDM
      { x: 70, y: 45 },  // CM
      { x: 30, y: 45 },  // CM
      { x: 85, y: 70 },  // RW
      { x: 50, y: 80 },  // ST
      { x: 15, y: 70 },  // LW
    ];
    return positions.map((p, i) => ({ ...p, role: roles[i] }));
  }, []);

  // Calculate twin positions with deviations
  const twinPositions = useMemo((): TwinPosition[] => {
    return players.slice(0, 11).map((player, index) => {
      const metrics = liveData.get(player.id);
      const ideal = idealPositions[index];
      const actualX = metrics?.position?.x ?? ideal.x;
      const actualY = metrics?.position?.y ?? ideal.y;
      const dx = actualX - ideal.x;
      const dy = actualY - ideal.y;
      const deviation = Math.sqrt(dx * dx + dy * dy);

      return {
        playerId: player.id,
        name: player.name.split(' ').pop() || player.name,
        role: ideal.role,
        idealX: ideal.x,
        idealY: ideal.y,
        actualX,
        actualY,
        deviation,
        isCoherent: deviation < 15,
      };
    });
  }, [players, liveData, idealPositions]);

  // Calculate overall coherence
  const overallCoherence = useMemo(() => {
    if (twinPositions.length === 0) return 0;
    const coherentCount = twinPositions.filter(p => p.isCoherent).length;
    return Math.round((coherentCount / twinPositions.length) * 100);
  }, [twinPositions]);

  // Initialize squads
  useEffect(() => {
    const citySquad = getPLSquadData('MCI');
    if (citySquad.length > 0) {
      setPlayers(citySquad);
      citySquad.forEach((player) => {
        const twin = createDigitalTwin(player, []);
        setTwin(player.id, twin);
      });
    }

    const unitedSquad = getPLSquadData('MUN');
    if (unitedSquad.length > 0) {
      setAwayPlayers(unitedSquad);
    }

    if (!gameEngineRef.current) {
      gameEngineRef.current = createManchesterDerby();
    }
    if (!patternEngineRef.current) {
      patternEngineRef.current = new PatternRecognitionEngine();
    }

    if (!gameModelManagerRef.current && patternEngineRef.current && citySquad.length > 0) {
      gameModelManagerRef.current = createGameModelManager(
        patternEngineRef.current,
        catapultService,
        citySquad
      );
      const manager: StaffMember = {
        id: 'manager-1',
        name: 'Pep Guardiola',
        role: 'manager',
        canVerify: true,
        canModify: true,
      };
      const staff: StaffMember[] = [
        { id: 'coach-1', name: 'Juanma Lillo', role: 'assistant_coach', canVerify: true, canModify: false },
      ];
      const session = gameModelManagerRef.current.startSession(manager, staff);
      setManagerSession(session);
    }
  }, [setPlayers, setTwin]);

  // Game Engine Simulation Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isLive && isSimulating && !isPaused && gameEngineRef.current) {
      interval = setInterval(() => {
        const engine = gameEngineRef.current;
        const patternEngine = patternEngineRef.current;
        if (!engine) return;

        const events = engine.tick(1);
        const state = engine.getState();
        const stats = engine.getStats();

        setMatchState(state);
        setMatchStats(stats);

        if (events.length > 0) {
          setMatchEvents((prev) => [...events, ...prev].slice(0, 50));
        }

        updateMatch({
          currentMinute: Math.floor(state.minute),
          score: { home: state.homeScore, away: state.awayScore },
        });

        players.forEach((player, index) => {
          const metrics = engine.generatePlayerMetrics(player, true, index);
          updateLiveData(player.id, metrics);
        });

        const newAwayData = new Map<string, TrackingMetrics>();
        awayPlayers.forEach((player, index) => {
          const metrics = engine.generatePlayerMetrics(player, false, index);
          newAwayData.set(player.id, metrics);
        });
        setAwayLiveData(newAwayData);

        if (patternEngine) {
          const minute = Math.floor(state.minute);
          const roles = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'RW', 'ST', 'LW'];

          const homePositions = players.slice(0, 11).map((p, i) => {
            const metrics = liveData.get(p.id);
            return {
              x: metrics?.position?.x ?? 50,
              y: metrics?.position?.y ?? 50,
              name: p.name,
              role: roles[i] || 'MF',
            };
          });
          const awayPositions = awayPlayers.slice(0, 11).map((p, i) => {
            const metrics = newAwayData.get(p.id);
            return {
              x: metrics?.position?.x ?? 50,
              y: metrics?.position?.y ?? 50,
              name: p.name,
              role: roles[i] || 'MF',
            };
          });

          const detectedPatterns = patternEngine.analyzePositions(
            homePositions,
            awayPositions,
            state.ballPosition || { x: 50, y: 50 },
            state.ballPossession || 'home',
            minute
          );

          const homePatterns = detectedPatterns.filter(p => p.team === 'home');
          const awayPatterns = detectedPatterns.filter(p => p.team === 'away');

          detectedPatterns.forEach(pattern => {
            if (pattern.confidence > 0.5) {
              patternEngine.logPattern(pattern, events[0]?.type || 'pass_completed', {
                success: Math.random() > 0.4,
                result: Math.random() > 0.5 ? 'possession_retained' : 'turnover',
                duration: Math.random() * 5 + 2,
                endZone: 'middle_third',
              });
            }
          });

          const homeCoherence = calculateDynamicCoherence('home', 'total_football', homePatterns, patternEngine.getChainSummary('home'), minute);
          const awayCoherence = calculateDynamicCoherence('away', 'counter_attacking', awayPatterns, patternEngine.getChainSummary('away'), minute);

          setPatternRecognitionData({
            activePatterns: { home: homePatterns, away: awayPatterns },
            recentLogs: patternEngine.getPatternLogs(undefined, 20),
            compoundingEffects: patternEngine.getCompoundingEffects(),
            coherence: { home: homeCoherence, away: awayCoherence },
            markov: {
              recurrentSequences: patternEngine.getRecurrentSequences(),
              currentChains: { home: patternEngine.getChainSummary('home').currentChain, away: patternEngine.getChainSummary('away').currentChain },
              topTransitions: { home: patternEngine.getTopTransitions('home', 5), away: patternEngine.getTopTransitions('away', 5) },
              predictedNext: { home: patternEngine.getPredictedNextPattern('home')?.pattern?.replace(/_/g, ' ') || null, away: patternEngine.getPredictedNextPattern('away')?.pattern?.replace(/_/g, ' ') || null },
            },
          });
        }

        // GPS/Wearable integration
        const currentMinute = Math.floor(state.minute);
        const homeFatigueModels = new Map<string, FatigueModel>();
        const awayFatigueModels = new Map<string, FatigueModel>();
        const allInjuryRisks = new Map<string, InjuryRiskModel>();

        players.slice(0, 11).forEach((player) => {
          const metrics = liveData.get(player.id);
          if (metrics?.position) {
            catapultService.feedLivePosition(player.id, {
              timestamp: Date.now(),
              x: metrics.position.x,
              y: metrics.position.y,
              speed: (metrics.currentSpeed || 0) / 3.6,
              acceleration: metrics.maxAcceleration || 0,
              heading: 0,
            });
          }
          homeFatigueModels.set(player.id, catapultService.calculateFatigueModel(player.id, currentMinute));
          allInjuryRisks.set(player.id, catapultService.calculateInjuryRisk(player.id));
        });

        awayPlayers.slice(0, 11).forEach((player) => {
          const metrics = newAwayData.get(player.id);
          if (metrics?.position) {
            catapultService.feedLivePosition(player.id, {
              timestamp: Date.now(),
              x: metrics.position.x,
              y: metrics.position.y,
              speed: (metrics.currentSpeed || 0) / 3.6,
              acceleration: metrics.maxAcceleration || 0,
              heading: 0,
            });
          }
          awayFatigueModels.set(player.id, catapultService.calculateFatigueModel(player.id, currentMinute));
          allInjuryRisks.set(player.id, catapultService.calculateInjuryRisk(player.id));
        });

        setFatigueData({
          home: homeFatigueModels,
          away: awayFatigueModels,
          injuryRisks: allInjuryRisks,
          recommendations: catapultService.getTacticalRecommendations(currentMinute),
        });

        if (state.phase === 'full_time') {
          setIsSimulating(false);
          endMatch();
        }
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isLive, isSimulating, isPaused, players, awayPlayers, liveData, updateLiveData, updateMatch, endMatch]);

  function calculateDynamicCoherence(
    team: 'home' | 'away',
    gameModel: string,
    patterns: TacticalPattern[],
    markovSummary: { currentChain: string; topSequences: { sequence: string; count: number; successRate: number }[]; predictedNext: string | null; chainHealth: 'strong' | 'building' | 'broken' },
    minute: number
  ): TacticalCoherence {
    const expectedPatterns: Record<string, string[]> = {
      total_football: ['positional_rotation', 'half_space_occupation', 'inverted_fullback', 'false_nine_drop', 'high_press_trigger', 'build_from_back'],
      counter_attacking: ['deep_block', 'quick_transition', 'direct_ball', 'wing_isolation', 'defensive_compact', 'counter_press_recovery'],
    };

    const expected = expectedPatterns[gameModel] || [];
    const detectedTypes = patterns.map(p => p.type);
    const matchedPatterns = expected.filter(exp => detectedTypes.some(det => det.includes(exp.split('_')[0]) || exp.includes(det.split('_')[0])));
    const patternCoherence = expected.length > 0 ? (matchedPatterns.length / expected.length) * 100 : 50;
    const chainHealthBonus = markovSummary.chainHealth === 'strong' ? 20 : markovSummary.chainHealth === 'building' ? 10 : 0;
    const sequenceBonus = Math.min(15, markovSummary.topSequences.filter(s => s.count > 2).length * 5);
    const highConfPatterns = patterns.filter(p => p.confidence > 0.7);
    const confidenceBonus = Math.min(15, highConfPatterns.length * 3);
    const coherenceScore = Math.min(100, Math.max(0, patternCoherence + chainHealthBonus + sequenceBonus + confidenceBonus));
    const trend: 'improving' | 'declining' | 'stable' = highConfPatterns.length > 3 ? 'improving' : highConfPatterns.length < 1 ? 'declining' : 'stable';

    return {
      gameModel,
      coherenceScore: Math.round(coherenceScore),
      deviations: expected.filter(exp => !matchedPatterns.includes(exp)).slice(0, 3).map(pattern => ({ pattern: pattern.replace(/_/g, ' '), deviation: 30 + Math.random() * 40, reason: `${pattern.replace(/_/g, ' ')} not detected` })),
      suggestions: [],
      historicalComparison: { avgCoherence: 65, trend },
    };
  }

  const handleStartMatch = useCallback(() => {
    gameEngineRef.current = createManchesterDerby();
    gameEngineRef.current.kickoff();
    patternEngineRef.current = new PatternRecognitionEngine();
    setMatchEvents([]);
    setInstructionLog([]);
    setMatchState(gameEngineRef.current.getState());
    setMatchStats(gameEngineRef.current.getStats());
    startMatch({ matchId: `match-${Date.now()}`, gameApproach: undefined });
    setIsSimulating(true);
    setIsPaused(false);
  }, [startMatch]);

  const handlePauseMatch = useCallback(() => setIsPaused(prev => !prev), []);
  const handleEndMatch = useCallback(() => {
    setIsSimulating(false);
    setIsPaused(false);
    endMatch();
    setMatchState(null);
    setMatchStats(null);
  }, [endMatch]);

  const handleSendInstruction = useCallback(async () => {
    if (!instructionInput.trim() || isProcessing || !gameModelManagerRef.current) return;
    setIsProcessing(true);
    const minute = matchState?.minute ? Math.floor(matchState.minute) : 0;

    try {
      const result = await gameModelManagerRef.current.processManagerInstruction(instructionInput, 'text');
      const status: 'applied' | 'pending' | 'rejected' = result.applied ? 'applied' : (result.verification ? 'pending' : 'rejected');
      setInstructionLog(prev => [{
        id: `inst-${Date.now()}`,
        timestamp: new Date(),
        minute,
        input: instructionInput,
        category: result.processed.processedInstructions[0]?.category || 'general',
        confidence: result.processed.confidence,
        status,
        affectedPlayers: result.processed.processedInstructions.flatMap(i => i.affectedPlayers),
        effect: result.applied ? `Applied` : result.verification ? `Pending (${Math.round(result.processed.confidence * 100)}%)` : 'Not understood',
      }, ...prev].slice(0, 15));
      setInstructionInput('');
    } catch (error) {
      const errorEntry: InstructionLogEntry = {
        id: `inst-${Date.now()}`,
        timestamp: new Date(),
        minute,
        input: instructionInput,
        category: 'general',
        confidence: 0,
        status: 'rejected',
        affectedPlayers: [],
        effect: 'Error',
      };
      setInstructionLog(prev => [errorEntry, ...prev].slice(0, 15));
    }
    setIsProcessing(false);
  }, [instructionInput, isProcessing, matchState?.minute]);

  // Handle pressing trigger button clicks
  const handleTriggerPress = useCallback((triggerId: string, label: string) => {
    if (!gameModelManagerRef.current || isProcessing) return;
    const minute = matchState?.minute ? Math.floor(matchState.minute) : 0;

    // Map trigger IDs to instructions
    const triggerInstructions: Record<string, string> = {
      'high_press': 'Press high immediately',
      'counter_press': 'Counter press on loss',
      'press_trap_sideline': 'Trap on the sideline',
      'press_trap_corner': 'Force to the corner',
      'mid_block': 'Hold mid block',
      'low_block': 'Drop into low block',
      'man_mark': 'Man mark their playmaker',
      'zonal': 'Switch to zonal marking',
      'drop_deep': 'Drop deep and compact',
      'hold_line': 'Hold the defensive line',
      'step_up': 'Step up and squeeze',
    };

    const instruction = triggerInstructions[triggerId] || label;

    // Add to log immediately with 'applied' status for quick UX
    const entry: InstructionLogEntry = {
      id: `trigger-${Date.now()}`,
      timestamp: new Date(),
      minute,
      input: label,
      category: 'pressing',
      confidence: 0.95, // High confidence for direct triggers
      status: 'applied',
      affectedPlayers: [],
      effect: 'Triggered',
    };
    setInstructionLog(prev => [entry, ...prev].slice(0, 20));

    // Process through game model manager in background
    gameModelManagerRef.current.processManagerInstruction(instruction, 'text').catch(() => {
      // Silently handle errors for triggers
    });
  }, [isProcessing, matchState?.minute]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    if (!gameModelManagerRef.current) return;
    try {
      const gameModel = gameModelManagerRef.current.createGameModelFromTemplate(templateId);
      const minute = matchState?.minute ? Math.floor(matchState.minute) : 0;
      const entry: InstructionLogEntry = {
        id: `template-${Date.now()}`,
        timestamp: new Date(),
        minute,
        input: gameModel.name,
        category: 'formation',
        confidence: 1,
        status: 'applied',
        affectedPlayers: [],
        effect: gameModel.formation.name,
      };
      setInstructionLog(prev => [entry, ...prev].slice(0, 15));
      setSelectedTemplate(templateId);
    } catch (error) {
      console.error('Error:', error);
    }
  }, [matchState?.minute]);

  const toggleRecording = useCallback(() => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      const SpeechRecognitionAPI = (window as Window & { SpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void }; webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void } }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognizer = new SpeechRecognitionAPI();
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.onresult = (event) => { setInstructionInput(event.results[0][0].transcript); setIsRecording(false); };
        recognizer.onerror = () => setIsRecording(false);
        recognizer.start();
      } else { setIsRecording(false); }
    }
  }, [isRecording]);

  const getTeamFatigue = (fatigueMap: Map<string, FatigueModel>) => {
    const values = Array.from(fatigueMap.values());
    return values.length === 0 ? 0 : values.reduce((sum, f) => sum + f.currentFatigue, 0) / values.length;
  };

  // Get current game model name
  const activeGameModel = gameModelManagerRef.current?.getActiveGameModel();
  const modelName = activeGameModel?.name || GAME_MODEL_TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'Total Football';

  return (
    <div className="h-screen bg-zinc-950 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-10 flex items-center justify-between px-4 bg-black/50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <span className="text-sky-400 text-xs font-medium">MCI</span>
          <span className="text-sm font-semibold tabular-nums">
            {matchState ? `${matchState.homeScore} – ${matchState.awayScore}` : '0–0'}
          </span>
          <span className="text-red-400 text-xs font-medium">MUN</span>
          {isLive && matchState && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-white/40 tabular-nums">{Math.floor(matchState.minute)}&apos;</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isLive ? (
            <button onClick={handleStartMatch} className="flex items-center gap-1.5 px-3 py-1 bg-white text-black rounded-full text-xs font-medium hover:bg-white/90">
              <Play className="w-3 h-3" /> Start
            </button>
          ) : (
            <>
              <button onClick={handlePauseMatch} className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full">
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              </button>
              <button onClick={handleEndMatch} className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-red-500/80 rounded-full">
                <Square className="w-2.5 h-2.5" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content - Horizontal Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Main Live Match - Takes majority of space */}
        <div className="flex-1 flex flex-col bg-zinc-950 p-2">
          <div className="flex-1 bg-zinc-900 rounded-xl overflow-hidden flex flex-col">
            <div className="flex-shrink-0 px-4 py-2 bg-black/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">Live Match</span>
                <span className="text-xs text-white/40">{matchStats?.possession.home ?? 50}% possession</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-sky-400">xG {matchStats?.xG.home.toFixed(1) ?? '0.0'}</span>
                <span className="text-white/20">|</span>
                <span className="text-red-400">xG {matchStats?.xG.away.toFixed(1) ?? '0.0'}</span>
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

        {/* Right Sidebar: Twin + Controls + Log */}
        <div className="w-96 flex flex-col bg-zinc-900 border-l border-white/5 overflow-hidden">
          {/* Digital Twin Mini View */}
          <div className="flex-shrink-0 h-44 border-b border-white/5">
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 px-3 py-1.5 bg-black/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-sky-400">Digital Twin</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded">{modelName}</span>
                </div>
                <span className={`text-[10px] font-medium ${overallCoherence >= 70 ? 'text-emerald-400' : overallCoherence >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {twinPositions.filter(p => p.isCoherent).length}/11 coherent
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
                  {[
                    { x: 95, y: 32.5 },
                    { x: 80, y: 10 }, { x: 80, y: 25 }, { x: 80, y: 40 }, { x: 80, y: 55 },
                    { x: 65, y: 20 }, { x: 65, y: 32.5 }, { x: 65, y: 45 },
                    { x: 50, y: 15 }, { x: 45, y: 32.5 }, { x: 50, y: 50 },
                  ].map((pos, idx) => (
                    <circle key={`away-${idx}`} cx={pos.x} cy={pos.y} r="2" fill="#ef4444" opacity="0.7" />
                  ))}
                  <circle cx="45" cy="32.5" r="1.2" fill="white" />
                </svg>
              </div>
            </div>
          </div>

          {/* Markov Chain Analysis */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-purple-400">Markov Chain</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                patternRecognitionData.markov?.predictedNext?.home ? 'bg-purple-500/20 text-purple-300' : 'bg-white/10 text-white/30'
              }`}>
                {patternRecognitionData.markov?.predictedNext?.home ? 'Predicting' : 'Learning'}
              </span>
            </div>
            <div className="text-[10px] text-white/50 mb-1.5 truncate">
              {patternRecognitionData.markov?.currentChains?.home || 'Building chain...'}
            </div>
            {patternRecognitionData.markov?.predictedNext?.home && (
              <div className="flex items-center gap-1.5 p-1.5 bg-purple-500/10 border border-purple-500/30 rounded">
                <Zap className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] text-purple-300">Predicted: {patternRecognitionData.markov.predictedNext.home}</span>
              </div>
            )}
          </div>

          {/* Pressing Triggers Grid */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-orange-400">Pressing Triggers</span>
              <Target className="w-3 h-3 text-orange-400/50" />
            </div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: 'high_press', label: 'High Press', icon: '⬆️' },
                { id: 'counter_press', label: 'Counter Press', icon: '🔄' },
                { id: 'press_trap_sideline', label: 'Sideline Trap', icon: '◀️' },
                { id: 'press_trap_corner', label: 'Corner Trap', icon: '📐' },
                { id: 'mid_block', label: 'Mid Block', icon: '🛡️' },
                { id: 'low_block', label: 'Low Block', icon: '⬇️' },
                { id: 'man_mark', label: 'Man Mark', icon: '👤' },
                { id: 'zonal', label: 'Zonal', icon: '🔲' },
              ].map(trigger => {
                const isMarkovSuggested = patternRecognitionData.markov?.predictedNext?.home?.toLowerCase().includes(trigger.id.replace('_', ' '));
                return (
                  <button
                    key={trigger.id}
                    onClick={() => handleTriggerPress(trigger.id, trigger.label)}
                    className={`relative px-2 py-1.5 rounded text-[9px] font-medium transition-all text-left ${
                      isMarkovSuggested
                        ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50 ring-1 ring-purple-400/30'
                        : 'bg-white/5 text-white/60 hover:bg-orange-500/20 hover:text-orange-200'
                    }`}
                  >
                    <span className="mr-1">{trigger.icon}</span>
                    {trigger.label}
                    {isMarkovSuggested && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Defensive Shape */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-blue-400">Defensive Shape</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'drop_deep', label: 'Drop' },
                { id: 'hold_line', label: 'Hold' },
                { id: 'step_up', label: 'Step Up' },
              ].map(shape => (
                <button
                  key={shape.id}
                  onClick={() => handleTriggerPress(shape.id, shape.label)}
                  className="px-2 py-1 rounded text-[9px] font-medium bg-white/5 text-white/60 hover:bg-blue-500/20 hover:text-blue-200 transition-all"
                >
                  {shape.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Stats */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-white/5 grid grid-cols-4 gap-1.5 text-center">
            <div className="bg-black/20 rounded p-1">
              <div className="text-[8px] text-white/40">xG</div>
              <div className="text-[10px] font-medium text-sky-400">{matchStats?.xG.home.toFixed(1) ?? '0.0'}</div>
            </div>
            <div className="bg-black/20 rounded p-1">
              <div className="text-[8px] text-white/40">Shots</div>
              <div className="text-[10px] font-medium text-white/70">{matchStats?.shots.home ?? 0}</div>
            </div>
            <div className="bg-black/20 rounded p-1">
              <div className="text-[8px] text-white/40">Pass%</div>
              <div className="text-[10px] font-medium text-white/70">{matchStats?.passAccuracy?.home ?? 85}%</div>
            </div>
            <div className="bg-black/20 rounded p-1">
              <div className="text-[8px] text-white/40">Coh</div>
              <div className={`text-[10px] font-medium ${overallCoherence >= 70 ? 'text-emerald-400' : overallCoherence >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {overallCoherence}%
              </div>
            </div>
          </div>

          {/* Trigger Execution Log */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-3 py-1.5 flex items-center justify-between bg-black/20">
              <span className="text-[9px] uppercase tracking-wider text-white/40">Execution Log</span>
              <span className="text-[9px] text-emerald-400">{instructionLog.filter(l => l.status === 'applied').length} executed</span>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
              {instructionLog.length === 0 ? (
                <div className="flex items-center justify-center h-full text-white/20 text-[10px]">
                  Click triggers above
                </div>
              ) : (
                instructionLog.map(entry => (
                  <div key={entry.id} className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] ${
                    entry.status === 'applied' ? 'bg-emerald-500/10 text-emerald-300' :
                    entry.status === 'pending' ? 'bg-amber-500/10 text-amber-300' :
                    'bg-red-500/10 text-red-300'
                  }`}>
                    {entry.status === 'applied' ? <CheckCircle2 className="w-3 h-3" /> :
                     entry.status === 'pending' ? <Clock className="w-3 h-3" /> :
                     <XCircle className="w-3 h-3" />}
                    <span className="flex-1 truncate">{entry.input}</span>
                    <span className="text-white/30">{entry.minute}&apos;</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
