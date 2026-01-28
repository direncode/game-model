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
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Target,
  GitBranch,
  Activity,
  Brain,
  Cpu,
  BarChart3,
  TrendingUp,
  ArrowRight,
  Circle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  algorithmLogger,
  logPatternDetection,
  logMarkovChainUpdate,
  logMarkovPrediction,
  logCoherenceCalculation,
  logPhysicsUpdate,
  logFatigueCalculation,
  logPositionAnalysis,
  logTransition,
  logEventGeneration,
  logAnalysisStep,
  type AlgorithmLogEntry,
  type LogCategory,
} from '@/components/dashboard/algorithm-logs';
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

// Log Category Config
const CATEGORY_CONFIG: Record<LogCategory, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  pattern_detection: { icon: Target, color: 'text-purple-400', bgColor: 'bg-purple-500/10', label: 'PATTERN' },
  markov_chain: { icon: GitBranch, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', label: 'MARKOV' },
  coherence: { icon: Brain, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', label: 'COHERENCE' },
  physics: { icon: Activity, color: 'text-blue-400', bgColor: 'bg-blue-500/10', label: 'PHYSICS' },
  fatigue: { icon: BarChart3, color: 'text-orange-400', bgColor: 'bg-orange-500/10', label: 'FATIGUE' },
  position: { icon: Layers, color: 'text-sky-400', bgColor: 'bg-sky-500/10', label: 'POSITION' },
  event: { icon: Zap, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', label: 'EVENT' },
  transition: { icon: ArrowRight, color: 'text-pink-400', bgColor: 'bg-pink-500/10', label: 'TRANSITION' },
  analysis: { icon: Cpu, color: 'text-white/60', bgColor: 'bg-white/5', label: 'ANALYSIS' },
};

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

  // Algorithm Logs State
  const [algorithmLogs, setAlgorithmLogs] = useState<AlgorithmLogEntry[]>([]);

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

  // Subscribe to algorithm logger
  useEffect(() => {
    const unsubscribe = algorithmLogger.subscribe((logs) => {
      setAlgorithmLogs(logs);
    });
    return unsubscribe;
  }, []);

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
          events.forEach(event => {
            logEventGeneration(Math.floor(state.minute), event.type, event.team, event.primaryPlayer, event.xG);
            if (event.type === 'counter_attack') {
              logTransition(Math.floor(state.minute), 'counter_trigger', event.team === 'home' ? 'away' : 'home', event.team, 'Counter-attack triggered!');
            }
          });
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

          logAnalysisStep(minute, 'TICK_START', `Processing tick ${minute.toFixed(2)}' - analyzing ${homePositions.length + awayPositions.length} player positions`);

          const detectedPatterns = patternEngine.analyzePositions(
            homePositions,
            awayPositions,
            state.ballPosition || { x: 50, y: 50 },
            state.ballPossession || 'home',
            minute
          );

          const homePatterns = detectedPatterns.filter(p => p.team === 'home');
          const awayPatterns = detectedPatterns.filter(p => p.team === 'away');

          homePatterns.forEach(pattern => {
            if (pattern.confidence > 0.6) {
              logPatternDetection(minute, pattern.type, 'home', pattern.confidence, pattern.players.length, pattern.zone);
            }
          });
          awayPatterns.forEach(pattern => {
            if (pattern.confidence > 0.6) {
              logPatternDetection(minute, pattern.type, 'away', pattern.confidence, pattern.players.length, pattern.zone);
            }
          });

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

          const homeChainSummary = patternEngine.getChainSummary('home');
          const awayChainSummary = patternEngine.getChainSummary('away');

          if (homeChainSummary.currentChain !== 'No active chain' && Math.random() < 0.3) {
            const chainParts = homeChainSummary.currentChain.split(' → ');
            if (chainParts.length >= 2) {
              logMarkovChainUpdate(minute, 'home', chainParts[chainParts.length - 2], chainParts[chainParts.length - 1], 0.4 + Math.random() * 0.4, chainParts.length);
            }
          }
          if (homeChainSummary.predictedNext && Math.random() < 0.2) {
            logMarkovPrediction(minute, 'home', homeChainSummary.predictedNext, 0.5 + Math.random() * 0.4);
          }

          const homeCoherence = calculateDynamicCoherence('home', 'total_football', homePatterns, homeChainSummary, minute);
          const awayCoherence = calculateDynamicCoherence('away', 'counter_attacking', awayPatterns, awayChainSummary, minute);

          if (Math.random() < 0.15) {
            logCoherenceCalculation(minute, 'home', 'total_football', homeCoherence.coherenceScore, homeCoherence.deviations.length > 0 ? 6 - homeCoherence.deviations.length : 6, 6, homeChainSummary.chainHealth);
          }
          if (Math.random() < 0.1) {
            logCoherenceCalculation(minute, 'away', 'counter_attacking', awayCoherence.coherenceScore, awayCoherence.deviations.length > 0 ? 5 - awayCoherence.deviations.length : 5, 5, awayChainSummary.chainHealth);
          }

          setPatternRecognitionData({
            activePatterns: { home: homePatterns, away: awayPatterns },
            recentLogs: patternEngine.getPatternLogs(undefined, 20),
            compoundingEffects: patternEngine.getCompoundingEffects(),
            coherence: { home: homeCoherence, away: awayCoherence },
            markov: {
              recurrentSequences: patternEngine.getRecurrentSequences(),
              currentChains: { home: homeChainSummary.currentChain, away: awayChainSummary.currentChain },
              topTransitions: { home: patternEngine.getTopTransitions('home', 5), away: patternEngine.getTopTransitions('away', 5) },
              predictedNext: { home: patternEngine.getPredictedNextPattern('home')?.pattern?.replace(/_/g, ' ') || null, away: patternEngine.getPredictedNextPattern('away')?.pattern?.replace(/_/g, ' ') || null },
            },
          });

          if (Math.random() < 0.08) {
            logPhysicsUpdate(minute, state.ballPossession || 'home', 11, Math.random() * 2 + 0.5, state.currentPhase || 'buildUp');
            logPositionAnalysis(minute, 'home', '4-3-3', 28 + Math.random() * 10, 45 + Math.random() * 15, 35 + Math.random() * 12);
          }
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

        if (Math.random() < 0.06) {
          const homeFatigueValues = Array.from(homeFatigueModels.values());
          const awayFatigueValues = Array.from(awayFatigueModels.values());
          if (homeFatigueValues.length > 0) {
            const avgHomeFatigue = homeFatigueValues.reduce((sum, f) => sum + f.currentFatigue, 0) / homeFatigueValues.length;
            const maxHomeFatigue = Math.max(...homeFatigueValues.map(f => f.currentFatigue));
            logFatigueCalculation(currentMinute, 'home', avgHomeFatigue * 100, maxHomeFatigue * 100, 3.5);
          }
          if (awayFatigueValues.length > 0 && Math.random() < 0.5) {
            const avgAwayFatigue = awayFatigueValues.reduce((sum, f) => sum + f.currentFatigue, 0) / awayFatigueValues.length;
            const maxAwayFatigue = Math.max(...awayFatigueValues.map(f => f.currentFatigue));
            logFatigueCalculation(currentMinute, 'away', avgAwayFatigue * 100, maxAwayFatigue * 100, 2.0);
          }
        }

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
    algorithmLogger.clear();
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

  // Handle pressing trigger button clicks
  const handleTriggerPress = useCallback((triggerId: string, label: string) => {
    if (!gameModelManagerRef.current) return;
    const minute = matchState?.minute ? Math.floor(matchState.minute) : 0;

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

    const entry: InstructionLogEntry = {
      id: `trigger-${Date.now()}`,
      timestamp: new Date(),
      minute,
      input: label,
      category: 'pressing',
      confidence: 0.95,
      status: 'applied',
      affectedPlayers: [],
      effect: 'Triggered',
    };
    setInstructionLog(prev => [entry, ...prev].slice(0, 20));

    gameModelManagerRef.current.processManagerInstruction(instruction, 'text').catch(() => {});
  }, [matchState?.minute]);

  // Get current game model name
  const activeGameModel = gameModelManagerRef.current?.getActiveGameModel();
  const modelName = activeGameModel?.name || GAME_MODEL_TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'Total Football';

  // Compute log statistics
  const logStats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    algorithmLogs.slice(0, 100).forEach((log) => {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    });
    return byCategory;
  }, [algorithmLogs]);

  return (
    <div className="h-screen bg-zinc-950 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-10 flex items-center justify-between px-4 bg-black/50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">Algorithm Visualization</span>
          </div>
          <span className="text-white/20">|</span>
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
            <button onClick={handleStartMatch} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-white rounded-full text-xs font-medium hover:bg-emerald-400">
              <Play className="w-3 h-3" /> Start Simulation
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

      {/* Main Content - Algorithm Focused Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Small Pitch + Controls */}
        <div className="w-72 flex flex-col bg-zinc-900 border-r border-white/5 overflow-hidden">
          {/* Mini Pitch View */}
          <div className="flex-shrink-0 h-48 border-b border-white/5">
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 px-2 py-1 bg-black/30 flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-white/50">Live Match</span>
                <span className="text-[9px] text-white/30">{matchStats?.possession.home ?? 50}%</span>
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

          {/* Match Stats */}
          <div className="flex-shrink-0 px-2 py-2 border-b border-white/5 grid grid-cols-4 gap-1 text-center">
            <div className="bg-black/20 rounded p-1">
              <div className="text-[7px] text-white/40">xG</div>
              <div className="text-[9px] font-medium text-sky-400">{matchStats?.xG.home.toFixed(1) ?? '0.0'}</div>
            </div>
            <div className="bg-black/20 rounded p-1">
              <div className="text-[7px] text-white/40">Shots</div>
              <div className="text-[9px] font-medium text-white/70">{matchStats?.shots.home ?? 0}</div>
            </div>
            <div className="bg-black/20 rounded p-1">
              <div className="text-[7px] text-white/40">Pass%</div>
              <div className="text-[9px] font-medium text-white/70">{matchStats?.passAccuracy?.home ?? 85}%</div>
            </div>
            <div className="bg-black/20 rounded p-1">
              <div className="text-[7px] text-white/40">Coh</div>
              <div className={`text-[9px] font-medium ${overallCoherence >= 70 ? 'text-emerald-400' : overallCoherence >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {overallCoherence}%
              </div>
            </div>
          </div>

          {/* Pressing Triggers */}
          <div className="flex-shrink-0 px-2 py-2 border-b border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[8px] uppercase tracking-wider text-orange-400">Triggers</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: 'high_press', label: 'High Press' },
                { id: 'counter_press', label: 'Counter' },
                { id: 'mid_block', label: 'Mid Block' },
                { id: 'low_block', label: 'Low Block' },
              ].map(trigger => {
                const isMarkovSuggested = patternRecognitionData.markov?.predictedNext?.home?.toLowerCase().includes(trigger.id.replace('_', ' '));
                return (
                  <button
                    key={trigger.id}
                    onClick={() => handleTriggerPress(trigger.id, trigger.label)}
                    className={`relative px-1.5 py-1 rounded text-[8px] font-medium transition-all ${
                      isMarkovSuggested
                        ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50'
                        : 'bg-white/5 text-white/60 hover:bg-orange-500/20 hover:text-orange-200'
                    }`}
                  >
                    {trigger.label}
                    {isMarkovSuggested && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Execution Log */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-2 py-1 bg-black/20">
              <span className="text-[8px] uppercase tracking-wider text-white/40">Execution Log</span>
            </div>
            <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
              {instructionLog.length === 0 ? (
                <div className="flex items-center justify-center h-full text-white/20 text-[9px]">
                  Click triggers
                </div>
              ) : (
                instructionLog.slice(0, 10).map(entry => (
                  <div key={entry.id} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[8px] ${
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
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main: Algorithm Visualization */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
          {/* Algorithm Flow Header */}
          <div className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-emerald-900/20 via-cyan-900/20 to-purple-900/20 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">ALGORITHM FLOWCHART</span>
                </div>
                {isSimulating && !isPaused && (
                  <div className="flex items-center gap-1.5">
                    <Circle className="w-2 h-2 text-emerald-500 fill-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-400">COMPUTING</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-[10px] text-white/40">
                <span>{algorithmLogs.length} operations logged</span>
              </div>
            </div>
            {/* Flowchart Steps */}
            <div className="flex items-center gap-2 mt-2 text-[9px]">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                <Target className="w-3 h-3" />
                <span>Pattern Detection</span>
              </div>
              <ChevronRight className="w-3 h-3 text-white/20" />
              <div className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">
                <GitBranch className="w-3 h-3" />
                <span>Markov Chain</span>
              </div>
              <ChevronRight className="w-3 h-3 text-white/20" />
              <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                <Brain className="w-3 h-3" />
                <span>Coherence</span>
              </div>
              <ChevronRight className="w-3 h-3 text-white/20" />
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                <Activity className="w-3 h-3" />
                <span>Physics</span>
              </div>
              <ChevronRight className="w-3 h-3 text-white/20" />
              <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded">
                <Zap className="w-3 h-3" />
                <span>Events</span>
              </div>
            </div>
          </div>

          {/* Main Algorithm Display Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Markov Chain & Coherence */}
            <div className="w-80 flex flex-col border-r border-white/5 overflow-hidden">
              {/* Markov Chain Panel */}
              <div className="flex-1 flex flex-col border-b border-white/5 overflow-hidden">
                <div className="flex-shrink-0 px-3 py-2 bg-cyan-900/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-cyan-400">MARKOV CHAIN STATE</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                    patternRecognitionData.markov?.predictedNext?.home ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/10 text-white/30'
                  }`}>
                    {patternRecognitionData.markov?.predictedNext?.home ? 'PREDICTING' : 'LEARNING'}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* Current Chain */}
                  <div className="p-2 bg-black/30 rounded border border-cyan-500/20">
                    <div className="text-[9px] text-white/40 mb-1">CURRENT CHAIN (HOME)</div>
                    <div className="text-[11px] text-cyan-300 font-mono break-words">
                      {patternRecognitionData.markov?.currentChains?.home || 'Building chain...'}
                    </div>
                  </div>

                  {/* Predicted Next */}
                  {patternRecognitionData.markov?.predictedNext?.home && (
                    <div className="p-2 bg-purple-500/10 rounded border border-purple-500/30">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="w-3 h-3 text-purple-400" />
                        <span className="text-[9px] text-purple-300">PREDICTED NEXT PATTERN</span>
                      </div>
                      <div className="text-sm font-semibold text-purple-200">
                        {patternRecognitionData.markov.predictedNext.home}
                      </div>
                    </div>
                  )}

                  {/* Top Transitions */}
                  <div>
                    <div className="text-[9px] text-white/40 mb-1.5">TOP TRANSITIONS</div>
                    <div className="space-y-1">
                      {(patternRecognitionData.markov?.topTransitions?.home || []).slice(0, 5).map((trans, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 bg-black/20 rounded text-[9px]">
                          <span className="text-cyan-300">{trans.from.replace(/_/g, ' ')}</span>
                          <ArrowRight className="w-3 h-3 text-white/30" />
                          <span className="text-cyan-300">{trans.to.replace(/_/g, ' ')}</span>
                          <span className="ml-auto text-white/40">{(trans.probability * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                      {(!patternRecognitionData.markov?.topTransitions?.home || patternRecognitionData.markov.topTransitions.home.length === 0) && (
                        <div className="text-[10px] text-white/30 text-center py-4">Collecting transition data...</div>
                      )}
                    </div>
                  </div>

                  {/* Recurrent Sequences */}
                  <div>
                    <div className="text-[9px] text-white/40 mb-1.5">RECURRENT SEQUENCES</div>
                    <div className="space-y-1">
                      {(patternRecognitionData.markov?.recurrentSequences || []).slice(0, 3).map((seq, i) => (
                        <div key={i} className="p-1.5 bg-black/20 rounded">
                          <div className="text-[9px] text-white/60 font-mono">{seq.description}</div>
                          <div className="flex items-center gap-2 mt-1 text-[8px]">
                            <span className="text-cyan-400">{seq.occurrences}x</span>
                            <span className="text-white/30">|</span>
                            <span className="text-emerald-400">{(seq.successRate * 100).toFixed(0)}% success</span>
                          </div>
                        </div>
                      ))}
                      {(!patternRecognitionData.markov?.recurrentSequences || patternRecognitionData.markov.recurrentSequences.length === 0) && (
                        <div className="text-[10px] text-white/30 text-center py-2">Detecting sequences...</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coherence Panel */}
              <div className="h-48 flex flex-col overflow-hidden">
                <div className="flex-shrink-0 px-3 py-2 bg-emerald-900/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">COHERENCE ANALYSIS</span>
                  </div>
                  <span className={`text-sm font-bold ${
                    (patternRecognitionData.coherence.home?.coherenceScore ?? 0) >= 70 ? 'text-emerald-400' :
                    (patternRecognitionData.coherence.home?.coherenceScore ?? 0) >= 50 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {patternRecognitionData.coherence.home?.coherenceScore ?? 0}%
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="p-2 bg-black/30 rounded">
                      <div className="text-[8px] text-white/40">Model</div>
                      <div className="text-[10px] text-emerald-300">{modelName}</div>
                    </div>
                    <div className="p-2 bg-black/30 rounded">
                      <div className="text-[8px] text-white/40">Trend</div>
                      <div className={`text-[10px] flex items-center gap-1 ${
                        patternRecognitionData.coherence.home?.historicalComparison.trend === 'improving' ? 'text-emerald-400' :
                        patternRecognitionData.coherence.home?.historicalComparison.trend === 'declining' ? 'text-red-400' : 'text-white/60'
                      }`}>
                        {patternRecognitionData.coherence.home?.historicalComparison.trend === 'improving' && <TrendingUp className="w-3 h-3" />}
                        {patternRecognitionData.coherence.home?.historicalComparison.trend || 'stable'}
                      </div>
                    </div>
                  </div>
                  {/* Deviations */}
                  <div className="text-[8px] text-white/40 mb-1">DEVIATIONS</div>
                  {patternRecognitionData.coherence.home?.deviations.slice(0, 3).map((dev, i) => (
                    <div key={i} className="text-[9px] text-amber-300/70 py-0.5">
                      • {dev.reason}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Algorithm Logs */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Category Filter Bar */}
              <div className="flex-shrink-0 px-3 py-1.5 bg-black/30 border-b border-white/5 flex items-center gap-1 overflow-x-auto">
                {(Object.keys(CATEGORY_CONFIG) as LogCategory[]).map((cat) => {
                  const config = CATEGORY_CONFIG[cat];
                  const count = logStats[cat] || 0;
                  const Icon = config.icon;
                  return (
                    <div
                      key={cat}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] ${config.bgColor}`}
                    >
                      <Icon className={`w-2.5 h-2.5 ${config.color}`} />
                      <span className={config.color}>{config.label}</span>
                      <span className="text-white/30">({count})</span>
                    </div>
                  );
                })}
              </div>

              {/* Logs Display */}
              <div className="flex-1 overflow-y-auto font-mono text-[10px]">
                {algorithmLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/20">
                    <Cpu className="w-12 h-12 mb-3 opacity-20" />
                    <div className="text-sm">Start simulation to see algorithm logs</div>
                    <div className="text-[10px] mt-1">Real-time computational process visualization</div>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {algorithmLogs.map((log, idx) => {
                      const catConfig = CATEGORY_CONFIG[log.category];
                      const Icon = catConfig.icon;

                      return (
                        <div
                          key={log.id}
                          className={`flex items-start gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors ${
                            idx === 0 ? 'bg-white/[0.02]' : ''
                          }`}
                        >
                          {/* Step Number */}
                          <div className="flex flex-col items-center w-6 shrink-0">
                            <span className="text-[8px] text-white/20 tabular-nums">
                              {String(log.flowStep).padStart(3, '0')}
                            </span>
                          </div>

                          {/* Category Icon */}
                          <div className={`p-1 rounded ${catConfig.bgColor} shrink-0`}>
                            <Icon className={`w-3 h-3 ${catConfig.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${catConfig.color}`}>{log.operation}</span>
                              <span className="text-white/30">@</span>
                              <span className="text-white/40 tabular-nums">{log.minute.toFixed(1)}&apos;</span>
                            </div>
                            <div className="text-white/50">{log.details}</div>

                            {/* Metrics */}
                            {log.metrics && (
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {Object.entries(log.metrics).map(([key, value]) => (
                                  <span key={key} className="text-white/30">
                                    <span className="text-white/40">{key}:</span>{' '}
                                    <span className={catConfig.color}>{value}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Duration */}
                          <span className="text-white/20 tabular-nums w-14 text-right shrink-0">
                            {log.duration ? `${log.duration.toFixed(1)}ms` : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Flowchart Status Bar */}
              <div className="flex-shrink-0 px-3 py-1.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-[9px]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500/50 border border-purple-500" />
                    <span className="text-white/40">Pattern</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-500/50 border border-cyan-500" />
                    <span className="text-white/40">Markov</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500/50 border border-emerald-500" />
                    <span className="text-white/40">Coherence</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500/50 border border-blue-500" />
                    <span className="text-white/40">Physics</span>
                  </div>
                </div>
                <div className="text-white/30">
                  Flow: Detection → Chain → Coherence → Position → Event
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Active Patterns Panel */}
        <div className="w-64 flex flex-col bg-zinc-900 border-l border-white/5 overflow-hidden">
          {/* Active Patterns */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-3 py-2 bg-purple-900/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-purple-400">ACTIVE PATTERNS</span>
              </div>
              <span className="text-[9px] text-purple-300">{patternRecognitionData.activePatterns.home.length} detected</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {patternRecognitionData.activePatterns.home.length === 0 ? (
                <div className="text-[10px] text-white/30 text-center py-8">Analyzing patterns...</div>
              ) : (
                patternRecognitionData.activePatterns.home.map((pattern, i) => (
                  <div key={i} className="p-2 bg-black/30 rounded border-l-2 border-purple-500/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-purple-300 font-medium">{pattern.type.replace(/_/g, ' ')}</span>
                      <span className={`text-[9px] ${pattern.confidence >= 0.7 ? 'text-emerald-400' : 'text-white/40'}`}>
                        {(pattern.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-[8px] text-white/40 mt-0.5">{pattern.zone} • {pattern.players.length} players</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Away Patterns */}
          <div className="h-40 flex flex-col border-t border-white/5 overflow-hidden">
            <div className="flex-shrink-0 px-3 py-1.5 bg-red-900/20">
              <span className="text-[9px] uppercase tracking-wider text-red-400">Away Patterns</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {patternRecognitionData.activePatterns.away.length === 0 ? (
                <div className="text-[9px] text-white/30 text-center py-4">Analyzing...</div>
              ) : (
                patternRecognitionData.activePatterns.away.slice(0, 4).map((pattern, i) => (
                  <div key={i} className="p-1.5 bg-black/30 rounded">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-red-300">{pattern.type.replace(/_/g, ' ')}</span>
                      <span className="text-white/40">{(pattern.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Digital Twin Mini */}
          <div className="h-36 border-t border-white/5">
            <div className="flex-shrink-0 px-2 py-1 bg-black/30 flex items-center justify-between">
              <span className="text-[8px] uppercase tracking-wider text-sky-400">Digital Twin</span>
              <span className={`text-[8px] ${overallCoherence >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {twinPositions.filter(p => p.isCoherent).length}/11
              </span>
            </div>
            <div className="h-28 bg-gradient-to-b from-emerald-950/30 to-zinc-900 relative">
              <svg viewBox="0 0 100 65" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <rect x="0" y="0" width="100" height="65" fill="#0d1f0d" />
                <line x1="50" y1="0" x2="50" y2="65" stroke="#1a3a1a" strokeWidth="0.3" />
                <circle cx="50" cy="32.5" r="8" fill="none" stroke="#1a3a1a" strokeWidth="0.3" />
                {idealPositions.map((pos, idx) => (
                  <circle key={idx} cx={pos.x} cy={pos.y * 0.65} r="2" fill="#38bdf8" opacity="0.9" />
                ))}
                <circle cx="45" cy="32.5" r="1" fill="white" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
