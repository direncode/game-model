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
  Activity,
  TrendingUp,
  AlertTriangle,
  Brain,
  Layers,
} from 'lucide-react';
import {
  GameModelManager,
  createGameModelManager,
  type ManagerSession,
  type StaffMember,
  GAME_MODEL_TEMPLATES,
} from '@/lib/game-model-manager';
import {
  GameModelCoherenceSystem,
  createGameModelCoherenceSystem,
  type CoherenceResult,
  type GameModelCoherenceConfig,
} from '@/lib';
import { CoherenceSystemDashboard, type CoherenceDisplayData } from '@/components/coherence';

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

  // Coherence System State
  const coherenceSystemRef = useRef<GameModelCoherenceSystem | null>(null);
  const [coherenceData, setCoherenceData] = useState<CoherenceDisplayData | null>(null);
  const [coherenceTab, setCoherenceTab] = useState<'dimensions' | 'players' | 'predictions' | 'alerts'>('dimensions');

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

    // Initialize Coherence System
    if (!coherenceSystemRef.current) {
      const config: GameModelCoherenceConfig = {
        enablePredictiveScoring: true,
        enableBayesianInference: true,
        enableEnsembleScoring: true,
        enableTemporalAnalysis: true,
        updateIntervalMs: 1000,
        alertThresholds: {
          criticalCoherence: 40,
          warningCoherence: 60,
          playerRiskThreshold: 0.7,
        },
      };
      coherenceSystemRef.current = createGameModelCoherenceSystem(config);
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

        // Calculate Advanced Coherence Scores
        if (coherenceSystemRef.current) {
          const playerData = players.slice(0, 11).map((player, index) => {
            const metrics = liveData.get(player.id);
            const ideal = idealPositions[index];
            return {
              id: player.id,
              name: player.name,
              position: player.position,
              actualPosition: { x: metrics?.position?.x ?? ideal.x, y: metrics?.position?.y ?? ideal.y },
              idealPosition: { x: ideal.x, y: ideal.y },
              metrics: {
                speed: metrics?.currentSpeed ?? 0,
                distance: metrics?.totalDistance ?? 0,
                sprints: metrics?.sprintDistance ?? 0,
                heartRate: metrics?.heartRate?.current ?? 120,
              },
            };
          });

          const coherenceResult = coherenceSystemRef.current.calculateCoherenceSync(
            currentMinute,
            { home: state.homeScore, away: state.awayScore },
            playerData
          );

          // Convert to display data
          const displayData: CoherenceDisplayData = {
            overallScore: coherenceResult.overallScore,
            confidence: coherenceResult.confidence,
            trend: coherenceResult.trend,
            dimensions: coherenceResult.dimensions,
            playerAnalysis: coherenceResult.playerAnalysis,
            predictions: coherenceResult.predictions,
            momentum: coherenceResult.momentum,
            bayesian: coherenceResult.bayesian,
            phase: coherenceResult.phase,
            alerts: coherenceResult.alerts || [],
            recommendations: coherenceResult.recommendations || [],
            timestamp: coherenceResult.timestamp,
          };

          setCoherenceData(displayData);
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

      {/* Main Content - Split Layout with Equal Pitch Views */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Row: Live Match + Digital Twin (Equal Size) */}
        <div className="flex-1 flex gap-2 p-2 min-h-0">
          {/* Left: Live Match */}
          <div className="flex-1 flex flex-col bg-zinc-900 rounded-xl overflow-hidden">
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

          {/* Right: Digital Twin (Same Size as Live Match) */}
          <div className="flex-1 flex flex-col bg-zinc-900 rounded-xl overflow-hidden">
            <div className="flex-shrink-0 px-4 py-2 bg-black/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wider text-sky-400 font-medium">Digital Twin</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded">{modelName}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${overallCoherence >= 70 ? 'text-emerald-400' : overallCoherence >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {twinPositions.filter(p => p.isCoherent).length}/11 coherent
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  (coherenceData?.overallScore ?? 0) >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                  (coherenceData?.overallScore ?? 0) >= 50 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {coherenceData?.overallScore?.toFixed(0) ?? overallCoherence}% Score
                </span>
              </div>
            </div>
            <div className="flex-1 bg-gradient-to-b from-emerald-950/30 to-zinc-900 relative overflow-hidden">
              <svg viewBox="0 0 100 65" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                {/* Pitch Background */}
                <rect x="0" y="0" width="100" height="65" fill="#0d1f0d" />
                {/* Pitch Lines */}
                <line x1="50" y1="0" x2="50" y2="65" stroke="#1a3a1a" strokeWidth="0.5" />
                <circle cx="50" cy="32.5" r="10" fill="none" stroke="#1a3a1a" strokeWidth="0.5" />
                <rect x="0" y="15" width="16" height="35" fill="none" stroke="#1a3a1a" strokeWidth="0.5" />
                <rect x="84" y="15" width="16" height="35" fill="none" stroke="#1a3a1a" strokeWidth="0.5" />
                <rect x="0" y="22" width="6" height="21" fill="none" stroke="#1a3a1a" strokeWidth="0.5" />
                <rect x="94" y="22" width="6" height="21" fill="none" stroke="#1a3a1a" strokeWidth="0.5" />
                <rect x="0" y="0" width="100" height="65" fill="none" stroke="#1a3a1a" strokeWidth="1" />

                {/* Ideal Positions with connecting lines */}
                {twinPositions.map((twin, idx) => {
                  const idealY = idealPositions[idx].y * 0.65;
                  const actualY = twin.actualY * 0.65;
                  return (
                    <g key={`twin-${idx}`}>
                      {/* Deviation line */}
                      <line
                        x1={idealPositions[idx].x}
                        y1={idealY}
                        x2={twin.actualX}
                        y2={actualY}
                        stroke={twin.isCoherent ? '#22c55e' : '#ef4444'}
                        strokeWidth="0.5"
                        strokeDasharray={twin.isCoherent ? '0' : '1,1'}
                        opacity="0.6"
                      />
                      {/* Ideal position (hollow) */}
                      <circle
                        cx={idealPositions[idx].x}
                        cy={idealY}
                        r="3"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="0.5"
                        strokeDasharray="2,1"
                        opacity="0.5"
                      />
                      {/* Actual position (filled) */}
                      <circle
                        cx={twin.actualX}
                        cy={actualY}
                        r="3"
                        fill={twin.isCoherent ? '#22c55e' : '#ef4444'}
                        opacity="0.9"
                      />
                      {/* Player name */}
                      <text
                        x={twin.actualX}
                        y={actualY + 5}
                        textAnchor="middle"
                        fontSize="2.5"
                        fill="white"
                        opacity="0.8"
                      >
                        {twin.name}
                      </text>
                      {/* Role label */}
                      <text
                        x={idealPositions[idx].x}
                        y={idealY - 4}
                        textAnchor="middle"
                        fontSize="2"
                        fill="#38bdf8"
                        opacity="0.6"
                      >
                        {twin.role}
                      </text>
                    </g>
                  );
                })}

                {/* Away Team (static reference) */}
                {[
                  { x: 95, y: 32.5 },
                  { x: 80, y: 10 }, { x: 80, y: 25 }, { x: 80, y: 40 }, { x: 80, y: 55 },
                  { x: 65, y: 20 }, { x: 65, y: 32.5 }, { x: 65, y: 45 },
                  { x: 50, y: 15 }, { x: 45, y: 32.5 }, { x: 50, y: 50 },
                ].map((pos, idx) => (
                  <circle key={`away-${idx}`} cx={pos.x} cy={pos.y} r="2.5" fill="#ef4444" opacity="0.5" />
                ))}

                {/* Ball */}
                <circle cx={matchState?.ballPosition?.x ?? 50} cy={(matchState?.ballPosition?.y ?? 50) * 0.65} r="1.5" fill="white" />
              </svg>

              {/* Legend Overlay */}
              <div className="absolute bottom-2 left-2 flex items-center gap-3 text-[8px] text-white/50">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full border border-sky-400 border-dashed" />
                  <span>Ideal</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Coherent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Deviated</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Coherence System Dashboard */}
        <div className="flex-shrink-0 h-72 border-t border-white/10 bg-zinc-900/50">
          <div className="h-full flex overflow-hidden">
            {/* Coherence Dashboard - Main Content */}
            <div className="flex-1 flex flex-col">
              {/* Tab Navigation */}
              <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-black/30 border-b border-white/5">
                <span className="text-[10px] uppercase tracking-wider text-violet-400 font-medium mr-3">
                  <Brain className="w-3 h-3 inline mr-1" />
                  Coherence Engine
                </span>
                {[
                  { id: 'dimensions', label: 'Dimensions', icon: Layers },
                  { id: 'players', label: 'Players', icon: Users },
                  { id: 'predictions', label: 'Predictions', icon: TrendingUp },
                  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCoherenceTab(tab.id as typeof coherenceTab)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                      coherenceTab === tab.id
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                    {tab.id === 'alerts' && (coherenceData?.alerts?.length ?? 0) > 0 && (
                      <span className="ml-1 px-1 py-0.5 bg-red-500 text-white text-[8px] rounded-full">
                        {coherenceData?.alerts?.length}
                      </span>
                    )}
                  </button>
                ))}

                {/* Overall Score Display */}
                <div className="ml-auto flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40">Overall:</span>
                    <span className={`text-sm font-bold ${
                      (coherenceData?.overallScore ?? 0) >= 70 ? 'text-emerald-400' :
                      (coherenceData?.overallScore ?? 0) >= 50 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {coherenceData?.overallScore?.toFixed(1) ?? '0.0'}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40">Confidence:</span>
                    <span className="text-sm text-sky-400">{((coherenceData?.confidence ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40">Trend:</span>
                    <span className={`text-sm ${
                      coherenceData?.trend === 'improving' ? 'text-emerald-400' :
                      coherenceData?.trend === 'declining' ? 'text-red-400' :
                      'text-white/60'
                    }`}>
                      {coherenceData?.trend === 'improving' ? '↑' : coherenceData?.trend === 'declining' ? '↓' : '→'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-3">
                {coherenceTab === 'dimensions' && (
                  <div className="grid grid-cols-5 gap-2 h-full">
                    {coherenceData?.dimensions?.breakdown?.map(dim => (
                      <div key={dim.name} className="bg-black/30 rounded-lg p-2 flex flex-col">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-white/80">{dim.name}</span>
                          <span className={`text-xs font-bold ${
                            dim.score >= 70 ? 'text-emerald-400' :
                            dim.score >= 50 ? 'text-amber-400' :
                            'text-red-400'
                          }`}>
                            {dim.score.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex-1 space-y-1 overflow-auto">
                          {dim.subComponents?.slice(0, 4).map(sub => (
                            <div key={sub.name} className="flex items-center gap-1">
                              <div className="flex-1 h-1 bg-white/10 rounded overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    sub.score >= 70 ? 'bg-emerald-500' :
                                    sub.score >= 50 ? 'bg-amber-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${sub.score}%` }}
                                />
                              </div>
                              <span className="text-[8px] text-white/40 w-8 text-right">{sub.score.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-[8px] text-white/30 mt-1">w: {(dim.weight * 100).toFixed(0)}%</div>
                      </div>
                    )) ?? (
                      <div className="col-span-5 flex items-center justify-center text-white/30 text-sm">
                        Start match to see dimensional analysis
                      </div>
                    )}
                  </div>
                )}

                {coherenceTab === 'players' && (
                  <div className="grid grid-cols-6 gap-2 h-full overflow-auto">
                    {coherenceData?.playerAnalysis?.map(player => (
                      <div key={player.playerId} className={`bg-black/30 rounded-lg p-2 border-l-2 ${
                        player.riskLevel === 'high' ? 'border-red-500' :
                        player.riskLevel === 'medium' ? 'border-amber-500' :
                        'border-emerald-500'
                      }`}>
                        <div className="text-[10px] font-medium text-white/80 truncate">{player.playerName}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-lg font-bold ${
                            player.coherenceScore >= 70 ? 'text-emerald-400' :
                            player.coherenceScore >= 50 ? 'text-amber-400' :
                            'text-red-400'
                          }`}>
                            {player.coherenceScore.toFixed(0)}
                          </span>
                          <span className={`text-[8px] px-1 rounded ${
                            player.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                            player.riskLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {player.riskLevel}
                          </span>
                        </div>
                        <div className="text-[8px] text-white/40 mt-1">
                          Dev: {player.positionDeviation?.toFixed(1) ?? '0'}m
                        </div>
                      </div>
                    )) ?? (
                      <div className="col-span-6 flex items-center justify-center text-white/30 text-sm">
                        Start match to see player analysis
                      </div>
                    )}
                  </div>
                )}

                {coherenceTab === 'predictions' && (
                  <div className="grid grid-cols-3 gap-3 h-full">
                    {/* Temporal Predictions */}
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-[10px] font-medium text-purple-400 mb-2">Temporal Predictions</div>
                      <div className="space-y-2">
                        {coherenceData?.predictions?.shortTerm && (
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/50">5 min</span>
                            <span className="text-xs font-medium text-white/80">
                              {coherenceData.predictions.shortTerm.predicted.toFixed(1)}%
                            </span>
                            <span className="text-[8px] text-white/40">
                              ±{((1 - coherenceData.predictions.shortTerm.confidence) * 10).toFixed(1)}
                            </span>
                          </div>
                        )}
                        {coherenceData?.predictions?.mediumTerm && (
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/50">15 min</span>
                            <span className="text-xs font-medium text-white/80">
                              {coherenceData.predictions.mediumTerm.predicted.toFixed(1)}%
                            </span>
                            <span className="text-[8px] text-white/40">
                              ±{((1 - coherenceData.predictions.mediumTerm.confidence) * 10).toFixed(1)}
                            </span>
                          </div>
                        )}
                        {coherenceData?.predictions?.longTerm && (
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/50">End</span>
                            <span className="text-xs font-medium text-white/80">
                              {coherenceData.predictions.longTerm.predicted.toFixed(1)}%
                            </span>
                            <span className="text-[8px] text-white/40">
                              ±{((1 - coherenceData.predictions.longTerm.confidence) * 10).toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scenarios */}
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-[10px] font-medium text-cyan-400 mb-2">Scenario Analysis</div>
                      <div className="space-y-1.5">
                        {coherenceData?.predictions?.scenarios?.slice(0, 4).map((scenario, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-[9px] text-white/50 flex-1 truncate">{scenario.name}</span>
                            <span className={`text-[10px] font-medium ${
                              scenario.impact > 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {scenario.impact > 0 ? '+' : ''}{scenario.impact.toFixed(0)}%
                            </span>
                            <span className="text-[8px] text-white/30">{(scenario.probability * 100).toFixed(0)}%</span>
                          </div>
                        )) ?? (
                          <div className="text-[9px] text-white/30">No scenarios</div>
                        )}
                      </div>
                    </div>

                    {/* Bayesian & Momentum */}
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-[10px] font-medium text-orange-400 mb-2">Bayesian Analysis</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white/50">Prior</span>
                          <span className="text-xs text-white/70">{coherenceData?.bayesian?.prior?.toFixed(1) ?? '50.0'}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white/50">Posterior</span>
                          <span className="text-xs font-medium text-orange-400">{coherenceData?.bayesian?.posterior?.toFixed(1) ?? '50.0'}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white/50">Likelihood</span>
                          <span className="text-xs text-white/70">{coherenceData?.bayesian?.likelihood?.toFixed(2) ?? '1.00'}</span>
                        </div>
                        <div className="border-t border-white/10 pt-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/50">Momentum</span>
                            <span className={`text-xs font-medium ${
                              (coherenceData?.momentum?.value ?? 0) > 0 ? 'text-emerald-400' :
                              (coherenceData?.momentum?.value ?? 0) < 0 ? 'text-red-400' :
                              'text-white/60'
                            }`}>
                              {(coherenceData?.momentum?.value ?? 0) > 0 ? '+' : ''}{coherenceData?.momentum?.value?.toFixed(1) ?? '0.0'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {coherenceTab === 'alerts' && (
                  <div className="grid grid-cols-2 gap-3 h-full">
                    {/* Alerts */}
                    <div className="space-y-2 overflow-auto">
                      <div className="text-[10px] font-medium text-red-400 mb-2">Active Alerts</div>
                      {coherenceData?.alerts?.length ? coherenceData.alerts.map((alert, idx) => (
                        <div key={idx} className={`p-2 rounded-lg border-l-2 ${
                          alert.severity === 'critical' ? 'bg-red-500/10 border-red-500' :
                          alert.severity === 'warning' ? 'bg-amber-500/10 border-amber-500' :
                          'bg-blue-500/10 border-blue-500'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-medium ${
                              alert.severity === 'critical' ? 'text-red-400' :
                              alert.severity === 'warning' ? 'text-amber-400' :
                              'text-blue-400'
                            }`}>
                              {alert.type}
                            </span>
                            <span className="text-[8px] text-white/30">{alert.timestamp}</span>
                          </div>
                          <div className="text-[9px] text-white/60 mt-1">{alert.message}</div>
                        </div>
                      )) : (
                        <div className="flex items-center justify-center h-full text-white/30 text-sm">
                          No active alerts
                        </div>
                      )}
                    </div>

                    {/* Recommendations */}
                    <div className="space-y-2 overflow-auto">
                      <div className="text-[10px] font-medium text-emerald-400 mb-2">Recommendations</div>
                      {coherenceData?.recommendations?.length ? coherenceData.recommendations.map((rec, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-emerald-500/10 border-l-2 border-emerald-500">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-emerald-400">{rec.type}</span>
                            <span className={`text-[8px] px-1 rounded ${
                              rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                              rec.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {rec.priority}
                            </span>
                          </div>
                          <div className="text-[9px] text-white/60 mt-1">{rec.action}</div>
                          <div className="text-[8px] text-emerald-400/60 mt-1">Impact: +{rec.expectedImpact?.toFixed(0) ?? '?'}%</div>
                        </div>
                      )) : (
                        <div className="flex items-center justify-center h-full text-white/30 text-sm">
                          No recommendations
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Controls & Execution Log */}
            <div className="w-72 flex flex-col border-l border-white/5 bg-zinc-900">
              {/* Pressing Triggers */}
              <div className="flex-shrink-0 px-3 py-2 border-b border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-orange-400">Triggers</span>
                  <Target className="w-3 h-3 text-orange-400/50" />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'high_press', label: 'High', icon: '⬆' },
                    { id: 'counter_press', label: 'Counter', icon: '↻' },
                    { id: 'mid_block', label: 'Mid', icon: '▬' },
                    { id: 'low_block', label: 'Low', icon: '⬇' },
                  ].map(trigger => (
                    <button
                      key={trigger.id}
                      onClick={() => handleTriggerPress(trigger.id, trigger.label)}
                      className="px-1 py-1 rounded text-[8px] font-medium bg-white/5 text-white/60 hover:bg-orange-500/20 hover:text-orange-200 transition-all"
                    >
                      {trigger.icon} {trigger.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Markov Prediction */}
              {patternRecognitionData.markov?.predictedNext?.home && (
                <div className="flex-shrink-0 px-3 py-1.5 border-b border-white/5 bg-purple-500/10">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-purple-400" />
                    <span className="text-[9px] text-purple-300 truncate">
                      Next: {patternRecognitionData.markov.predictedNext.home}
                    </span>
                  </div>
                </div>
              )}

              {/* Execution Log */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-shrink-0 px-3 py-1 bg-black/20 flex items-center justify-between">
                  <span className="text-[9px] text-white/40">Log</span>
                  <span className="text-[9px] text-emerald-400">{instructionLog.filter(l => l.status === 'applied').length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
                  {instructionLog.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-white/20 text-[9px]">
                      Click triggers
                    </div>
                  ) : (
                    instructionLog.slice(0, 10).map(entry => (
                      <div key={entry.id} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] ${
                        entry.status === 'applied' ? 'bg-emerald-500/10 text-emerald-300' :
                        entry.status === 'pending' ? 'bg-amber-500/10 text-amber-300' :
                        'bg-red-500/10 text-red-300'
                      }`}>
                        {entry.status === 'applied' ? <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" /> :
                         entry.status === 'pending' ? <Clock className="w-2.5 h-2.5 flex-shrink-0" /> :
                         <XCircle className="w-2.5 h-2.5 flex-shrink-0" />}
                        <span className="flex-1 truncate">{entry.input}</span>
                        <span className="text-white/30 text-[8px]">{entry.minute}&apos;</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
