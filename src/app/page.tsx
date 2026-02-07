'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useGameStore } from '@/store/game-store';
import {
  KernelWaveViz,
  BlankPitch,
  type KernelData,
  type KernelLogEntry,
} from '@/components/dashboard/kernel-wave-viz';
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

  // Kernel wave function state
  const [kernelLogs, setKernelLogs] = useState<Record<string, KernelLogEntry[]>>({
    defense: [],
    midfield: [],
    forward: [],
  });
  const prevKernelMeans = useRef<Record<string, number>>({});
  const prevKernelStdDevs = useRef<Record<string, number>>({});
  const lastKernelLogMinute = useRef<Record<string, number>>({});

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

  // Compute kernel data from player positions
  const kernels: KernelData[] = useMemo(() => {
    const getPlayerY = (player: Player, fallbackIdx: number) => {
      const metrics = liveData.get(player.id);
      return metrics?.position?.y ?? idealPositions[fallbackIdx]?.y ?? 50;
    };

    const homePlayers = players.slice(0, 11);

    // Defense: indices 1–4 (RB, CB, CB, LB)
    const defensePositions =
      homePlayers.length >= 5
        ? [1, 2, 3, 4].map((i) => getPlayerY(homePlayers[i], i))
        : [20, 20, 25, 25];

    // Midfield: indices 5–7 (CDM, CM, CM)
    const midfieldPositions =
      homePlayers.length >= 8
        ? [5, 6, 7].map((i) => getPlayerY(homePlayers[i], i))
        : [35, 45, 45];

    // Forward: indices 8–10 (RW, ST, LW)
    const forwardPositions =
      homePlayers.length >= 11
        ? [8, 9, 10].map((i) => getPlayerY(homePlayers[i], i))
        : [70, 80, 70];

    return [
      {
        id: 'defense',
        name: 'Defensive Line',
        color: '#3b82f6',
        positions: defensePositions,
        logs: kernelLogs.defense || [],
      },
      {
        id: 'midfield',
        name: 'Midfield Line',
        color: '#22c55e',
        positions: midfieldPositions,
        logs: kernelLogs.midfield || [],
      },
      {
        id: 'forward',
        name: 'Forward Line',
        color: '#f97316',
        positions: forwardPositions,
        logs: kernelLogs.forward || [],
      },
    ];
  }, [players, liveData, idealPositions, kernelLogs]);

  // Generate kernel logs when positions change significantly
  const updateKernelLogs = useCallback(
    (minute: number) => {
      const newLogs: Record<string, KernelLogEntry[]> = {};

      kernels.forEach((kernel) => {
        const { id, positions } = kernel;
        if (positions.length === 0) return;

        const mean = positions.reduce((a, b) => a + b, 0) / positions.length;
        const stdDev = Math.sqrt(
          positions.reduce((s, p) => s + (p - mean) ** 2, 0) / positions.length,
        );

        const prevMean = prevKernelMeans.current[id] ?? mean;
        const prevStdDev = prevKernelStdDevs.current[id] ?? stdDev;
        const lastLogMin = lastKernelLogMinute.current[id] ?? -2;

        // Only generate logs every 2+ game minutes
        if (minute - lastLogMin < 2) {
          prevKernelMeans.current[id] = mean;
          prevKernelStdDevs.current[id] = stdDev;
          return;
        }

        const entries: KernelLogEntry[] = [];

        if (Math.abs(mean - prevMean) > 4) {
          entries.push({
            id: `${id}-${Date.now()}`,
            minute,
            message:
              mean > prevMean
                ? `Pushed up to ${mean.toFixed(0)}m`
                : `Dropped back to ${mean.toFixed(0)}m`,
            type: 'shift',
          });
        }

        if (stdDev - prevStdDev > 2.5) {
          entries.push({
            id: `${id}-exp-${Date.now()}`,
            minute,
            message: `Line stretching (\u03c3=${stdDev.toFixed(1)})`,
            type: 'expand',
          });
        } else if (prevStdDev - stdDev > 2.5) {
          entries.push({
            id: `${id}-comp-${Date.now()}`,
            minute,
            message: `Line compacting (\u03c3=${stdDev.toFixed(1)})`,
            type: 'compress',
          });
        }

        // Check for line breaks
        positions.forEach((pos, i) => {
          if (Math.abs(pos - mean) > 18) {
            entries.push({
              id: `${id}-brk-${i}-${Date.now()}`,
              minute,
              message: `Player breaking line at ${pos.toFixed(0)}m`,
              type: 'break',
            });
          }
        });

        if (entries.length > 0) {
          newLogs[id] = entries;
          lastKernelLogMinute.current[id] = minute;
        }

        prevKernelMeans.current[id] = mean;
        prevKernelStdDevs.current[id] = stdDev;
      });

      if (Object.keys(newLogs).length > 0) {
        setKernelLogs((prev) => {
          const updated = { ...prev };
          Object.entries(newLogs).forEach(([kid, entries]) => {
            updated[kid] = [...entries, ...(prev[kid] || [])].slice(0, 20);
          });
          return updated;
        });
      }
    },
    [kernels],
  );

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

        // Update kernel wave function logs
        updateKernelLogs(currentMinute);

        if (state.phase === 'full_time') {
          setIsSimulating(false);
          endMatch();
        }
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isLive, isSimulating, isPaused, players, awayPlayers, liveData, updateLiveData, updateMatch, endMatch, updateKernelLogs]);

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

      {/* Main Content - Pitch + Kernel Wave Functions */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Blank Pitch with kernel zone overlays */}
        <div className="w-[38%] flex flex-col p-2">
          <div className="flex-1 bg-zinc-900 rounded-xl overflow-hidden flex flex-col">
            <div className="flex-shrink-0 px-4 py-2 bg-black/40 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/40 font-medium">Pitch</span>
              <div className="flex items-center gap-3">
                {kernels.map((k) => (
                  <div key={k.id} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: k.color }} />
                    <span className="text-[9px] text-white/40">{k.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex items-center justify-center bg-zinc-950/50 p-2">
              <BlankPitch kernels={kernels} />
            </div>
          </div>
        </div>

        {/* Right: Kernel Wave Functions + Composite + Logs */}
        <div className="flex-1 flex flex-col overflow-hidden border-l border-white/5">
          <KernelWaveViz kernels={kernels} />
        </div>
      </div>
    </div>
  );
}
