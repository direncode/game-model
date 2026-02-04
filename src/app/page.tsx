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
  ChevronRight,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Circle,
  Layers,
  Target,
  Crosshair,
  Shield,
  Zap,
  Radio,
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  GameModelManager,
  createGameModelManager,
  type ManagerSession,
  type StaffMember,
  GAME_MODEL_TEMPLATES,
} from '@/lib/game-model-manager';
import {
  CARLOS_CORBERAN_PERSONA,
  CORBERAN_INSTRUCTION_TEMPLATES,
  createCorberanGameModel,
  type CoachPersona,
  type InstructionTemplate,
} from '@/lib/coach-persona';
import {
  TransitionTriggerEngine,
  createTransitionEngine,
  type TransitionTrigger,
  type DoublePivotStatus,
  getCorberanTransitionGuidance,
} from '@/lib/transition-triggers';
import {
  CorberanCoherenceCalculator,
  createCorberanCoherenceCalculator,
  type CorberanCoherenceReport,
} from '@/lib/corberan-coherence';
import {
  GPSTacticalBridge,
  createGPSTacticalBridge,
  type TacticalInterpretation,
  type TeamTacticalSummary,
} from '@/lib/gps-tactical-bridge';
import {
  FootballBrain,
  type BrainPrediction,
  type ScenarioResult,
} from '@/lib/football-brain';
import {
  GraphNeuralPatternEngine,
  type PatternMatchResult as GNNPatternMatch,
  type TacticalGraph,
} from '@/lib/graph-neural-patterns';
import {
  CoherenceV3Engine,
  type CoherenceState,
  type CoherenceSummary,
} from '@/lib/coherence-v3';
import {
  DataSubstrateEngine,
  type DataSubstrateStatus,
} from '@/lib/data-substrate';
import {
  AdvancedMetricsEngine,
  type SpaceControlResult,
  type InjuryRiskResult,
} from '@/lib/advanced-metrics';

// ==================== PALANTIR BLUEPRINT COLORS ====================
const BP = {
  BLACK: '#111418',
  DARK_GRAY1: '#1C2127',
  DARK_GRAY2: '#252A31',
  DARK_GRAY3: '#2F343C',
  DARK_GRAY4: '#383E47',
  DARK_GRAY5: '#404854',
  GRAY1: '#5F6B7C',
  GRAY2: '#738091',
  GRAY3: '#8F99A8',
  GRAY4: '#ABB3BF',
  GRAY5: '#C5CBD3',
  WHITE: '#F6F7F9',
  BLUE3: '#2D72D2',
  BLUE4: '#4C90F0',
  BLUE5: '#8ABBFF',
  GREEN3: '#238551',
  GREEN4: '#32A467',
  GREEN5: '#72CA9B',
  ORANGE3: '#C87619',
  ORANGE4: '#EC9A3C',
  RED3: '#CD4246',
  RED4: '#E76A6E',
};

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

  // ==================== RESIZABLE PANEL STATE ====================
  const [leftPanelWidth, setLeftPanelWidth] = useState(256); // Default 256px (w-64)
  const [rightPanelWidth, setRightPanelWidth] = useState(288); // Default 288px (w-72)
  const [pitchHeight, setPitchHeight] = useState(40); // Default 40% height
  const [isResizing, setIsResizing] = useState<'left' | 'right' | 'vertical' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Corberán Persona Systems
  const transitionEngineRef = useRef<TransitionTriggerEngine | null>(null);
  const coherenceCalcRef = useRef<CorberanCoherenceCalculator | null>(null);
  const gpsBridgeRef = useRef<GPSTacticalBridge | null>(null);

  // Tactical Nexus Engine Refs
  const footballBrainRef = useRef<FootballBrain | null>(null);
  const gnnEngineRef = useRef<GraphNeuralPatternEngine | null>(null);
  const coherenceV3Ref = useRef<CoherenceV3Engine | null>(null);
  const dataSubstrateRef = useRef<DataSubstrateEngine | null>(null);
  const advancedMetricsRef = useRef<AdvancedMetricsEngine | null>(null);
  const [activePersona] = useState<CoachPersona>(CARLOS_CORBERAN_PERSONA);
  const [transitionTriggers, setTransitionTriggers] = useState<TransitionTrigger[]>([]);
  const [doublePivotStatus, setDoublePivotStatus] = useState<DoublePivotStatus | null>(null);
  const [corberanCoherence, setCorberanCoherence] = useState<CorberanCoherenceReport | null>(null);
  const [teamTacticalSummary, setTeamTacticalSummary] = useState<TeamTacticalSummary | null>(null);
  const [previousPossession, setPreviousPossession] = useState<'home' | 'away'>('home');
  const [previousBallPosition, setPreviousBallPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Instruction Integration State
  const [instructionInput, setInstructionInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [instructionLog, setInstructionLog] = useState<InstructionLogEntry[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>('corberan_system');

  // Tactical Nexus State
  const [brainPredictions, setBrainPredictions] = useState<BrainPrediction[]>([]);
  const [gnnPatterns, setGnnPatterns] = useState<GNNPatternMatch[]>([]);
  const [coherenceV3State, setCoherenceV3State] = useState<CoherenceSummary | null>(null);
  const [spaceControl, setSpaceControl] = useState<SpaceControlResult | null>(null);
  const [dataSubstrateStatus, setDataSubstrateStatus] = useState<DataSubstrateStatus | null>(null);
  const [scenarioResults, setScenarioResults] = useState<{ scenarios: number; bestOutcome: string; winProb: number } | null>(null);

  // ==================== RESIZE HANDLERS ====================
  const handleMouseDown = useCallback((panel: 'left' | 'right' | 'vertical') => {
    setIsResizing(panel);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();

    if (isResizing === 'left') {
      const newWidth = Math.max(180, Math.min(400, e.clientX - containerRect.left));
      setLeftPanelWidth(newWidth);
    } else if (isResizing === 'right') {
      const newWidth = Math.max(200, Math.min(450, containerRect.right - e.clientX));
      setRightPanelWidth(newWidth);
    } else if (isResizing === 'vertical') {
      const mainContent = containerRef.current.querySelector('main');
      if (mainContent) {
        const mainRect = mainContent.getBoundingClientRect();
        const relativeY = e.clientY - mainRect.top;
        const percentage = Math.max(20, Math.min(70, (relativeY / mainRect.height) * 100));
        setPitchHeight(percentage);
      }
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  // Attach global mouse listeners for resize
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizing === 'vertical' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

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

  // Initialize squads and Corberán systems
  useEffect(() => {
    const wbaSquad = getPLSquadData('MCI');
    if (wbaSquad.length > 0) {
      setPlayers(wbaSquad);
      wbaSquad.forEach((player) => {
        const twin = createDigitalTwin(player, []);
        setTwin(player.id, twin);
      });
    }

    const opponentSquad = getPLSquadData('MUN');
    if (opponentSquad.length > 0) {
      setAwayPlayers(opponentSquad);
    }

    if (!gameEngineRef.current) {
      gameEngineRef.current = createManchesterDerby();
    }
    if (!patternEngineRef.current) {
      patternEngineRef.current = new PatternRecognitionEngine();
    }

    if (!transitionEngineRef.current) {
      transitionEngineRef.current = createTransitionEngine(CARLOS_CORBERAN_PERSONA);
      if (wbaSquad.length >= 7) {
        transitionEngineRef.current.setDoublePivotPlayers(wbaSquad[5].id, wbaSquad[6].id);
      }
    }

    if (!coherenceCalcRef.current) {
      coherenceCalcRef.current = createCorberanCoherenceCalculator();
    }

    if (!gpsBridgeRef.current) {
      gpsBridgeRef.current = createGPSTacticalBridge(CARLOS_CORBERAN_PERSONA);
    }

    // Initialize Tactical Nexus Engines
    if (!footballBrainRef.current) {
      footballBrainRef.current = new FootballBrain();
    }
    if (!gnnEngineRef.current) {
      gnnEngineRef.current = new GraphNeuralPatternEngine();
    }
    if (!coherenceV3Ref.current) {
      coherenceV3Ref.current = new CoherenceV3Engine();
    }
    if (!dataSubstrateRef.current) {
      dataSubstrateRef.current = new DataSubstrateEngine();
    }
    if (!advancedMetricsRef.current) {
      advancedMetricsRef.current = new AdvancedMetricsEngine();
    }

    if (!gameModelManagerRef.current && patternEngineRef.current && wbaSquad.length > 0) {
      gameModelManagerRef.current = createGameModelManager(
        patternEngineRef.current,
        catapultService,
        wbaSquad
      );

      const manager: StaffMember = {
        id: 'corberan-1',
        name: 'Carlos Corberán',
        role: 'manager',
        canVerify: true,
        canModify: true,
      };
      const staff: StaffMember[] = [
        { id: 'analyst-1', name: 'Technical Analyst', role: 'analyst', canVerify: true, canModify: false },
        { id: 'fitness-1', name: 'Fitness Coach', role: 'fitness_coach', canVerify: false, canModify: false },
      ];
      const session = gameModelManagerRef.current.startSession(manager, staff);
      setManagerSession(session);

      try {
        const corberanModel = createCorberanGameModel();
      } catch (error) {
        console.error('Failed to create Corberán game model:', error);
      }
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

        // Tactical Nexus Engine Updates (every 5 ticks for performance)
        if (currentMinute % 5 === 0 || gnnPatterns.length === 0) {
          // GNN Pattern Recognition
          if (gnnEngineRef.current && state.ballPosition) {
            const playerSnapshots = players.slice(0, 11).map((p, i) => {
              const metrics = liveData.get(p.id);
              return {
                playerId: p.id,
                position: p.position,
                x: metrics?.position?.x ?? 50,
                y: metrics?.position?.y ?? 50,
                velocity: { vx: (metrics?.currentSpeed ?? 0) / 3.6, vy: 0 },
                acceleration: { ax: metrics?.maxAcceleration ?? 0, ay: 0 },
                fatigue: homeFatigueModels.get(p.id)?.currentFatigue ?? 0,
                sprintCapacity: 100 - (homeFatigueModels.get(p.id)?.currentFatigue ?? 0),
              };
            });

            const awaySnapshots = awayPlayers.slice(0, 11).map((p, i) => {
              const metrics = newAwayData.get(p.id);
              return {
                playerId: p.id,
                position: p.position,
                x: metrics?.position?.x ?? 50,
                y: metrics?.position?.y ?? 50,
                velocity: { vx: (metrics?.currentSpeed ?? 0) / 3.6, vy: 0 },
                acceleration: { ax: metrics?.maxAcceleration ?? 0, ay: 0 },
              };
            });

            const allSnapshots = [...playerSnapshots, ...awaySnapshots];
            const tacticalGraph = gnnEngineRef.current.createTacticalGraph(
              'match_001',
              currentMinute,
              allSnapshots,
              state.ballPosition,
              state.ballPossession || 'home'
            );

            const detectedGNNPatterns = gnnEngineRef.current.recognizePatterns(tacticalGraph);
            setGnnPatterns(detectedGNNPatterns);

            // Coherence V3 Analysis
            if (coherenceV3Ref.current) {
              coherenceV3Ref.current.analyzeCoherence(tacticalGraph, detectedGNNPatterns, currentMinute);
              const summary = coherenceV3Ref.current.getCoherenceSummary();
              setCoherenceV3State(summary);
            }

            // Space Control
            if (advancedMetricsRef.current && dataSubstrateRef.current) {
              const latestFrame = dataSubstrateRef.current.getLatestFrame();
              if (latestFrame) {
                const spaceResult = advancedMetricsRef.current.calculateSpaceControl(latestFrame);
                setSpaceControl(spaceResult);
              }
            }
          }

          // Football Brain Predictions (less frequent)
          if (footballBrainRef.current && currentMinute % 10 === 0) {
            const matchContext = {
              matchId: 'match_001',
              competition: 'Premier League',
              homeTeam: {
                id: 'MCI',
                name: 'Manchester City',
                currentForm: [3, 3, 1, 3, 3, 1, 3, 0, 3, 1],
                fatigueLevel: getTeamFatigue(homeFatigueModels),
                injuryImpact: 0.1,
                tacticalFlexibility: 0.85,
                squadDepth: 0.9,
                momentumScore: matchStats ? matchStats.possession.home / 100 : 0.5,
                pressureHandling: 0.8,
              },
              awayTeam: {
                id: 'MUN',
                name: 'Manchester United',
                currentForm: [1, 3, 0, 1, 3, 3, 1, 1, 0, 3],
                fatigueLevel: getTeamFatigue(awayFatigueModels),
                injuryImpact: 0.15,
                tacticalFlexibility: 0.7,
                squadDepth: 0.75,
                momentumScore: matchStats ? matchStats.possession.away / 100 : 0.5,
                pressureHandling: 0.65,
              },
              venue: {
                stadiumId: 'etihad',
                name: 'Etihad Stadium',
                capacity: 55017,
                altitude: 75,
                pitchDimensions: { length: 105, width: 68 },
                surfaceType: 'hybrid' as const,
                weatherConditions: {
                  temperature: 15,
                  humidity: 65,
                  windSpeed: 10,
                  windDirection: 180,
                  precipitation: 'none' as const,
                  visibility: 10000,
                },
                homeAdvantage: 0.65,
                atmosphereIntensity: 0.85,
              },
              referee: {
                id: 'ref_001',
                name: 'Michael Oliver',
                cardRate: 3.5,
                penaltyRate: 0.3,
                advantagePlayTendency: 0.7,
                homeTeamBias: 0.02,
                physicalityTolerance: 0.6,
              },
              stakes: {
                homeImportance: 85,
                awayImportance: 80,
                titleRace: true,
                relegationBattle: false,
                europeanQualification: true,
                rivalry: 'fierce' as const,
                mediaAttention: 95,
              },
              historicalH2H: {
                totalMatches: 188,
                homeWins: 78,
                awayWins: 59,
                draws: 51,
                recentTrend: 'home_dominant' as const,
                tacticalPatterns: ['high_press', 'possession_dominance'],
                keyBattles: [
                  { position: 'midfield', advantage: 'home' as const },
                  { position: 'flanks', advantage: 'even' as const },
                ],
              },
            };

            footballBrainRef.current.predict(
              matchContext,
              ['match_outcome', 'goal_probability', 'momentum_change'],
              300
            ).then(predictions => {
              setBrainPredictions(predictions);
            }).catch(() => {});

            // Run scenario simulations
            footballBrainRef.current.runScenarios({
              baseState: matchContext,
              modifications: [
                { type: 'tactical_change', target: 'pressing', value: 'high_press' },
                { type: 'tactical_change', target: 'transition', value: 'quick_counter' },
              ],
              simulationCount: 100,
              timeHorizon: 15, // 15 minutes ahead
              focusMetrics: ['win_probability', 'goal_probability', 'possession'],
            }).then(result => {
              setScenarioResults({
                scenarios: result.outcomes.length,
                bestOutcome: result.modifications.length > 0 ? result.modifications[0].target : 'current',
                winProb: result.aggregateMetrics.winProbability.home,
              });
            }).catch(() => {});
          }

          // Data Substrate Status
          if (dataSubstrateRef.current) {
            setDataSubstrateStatus(dataSubstrateRef.current.getSystemStatus());
          }
        }

        // Corberán Systems Update
        if (transitionEngineRef.current && state.ballPosition) {
          const triggers = transitionEngineRef.current.detectTriggers(
            players.slice(0, 11).map((p, i) => {
              const metrics = liveData.get(p.id);
              return {
                playerId: p.id,
                x: metrics?.position?.x ?? 50,
                y: metrics?.position?.y ?? 50,
                metrics,
              };
            }),
            awayPlayers.slice(0, 11).map((p, i) => {
              const metrics = newAwayData.get(p.id);
              return {
                playerId: p.id,
                x: metrics?.position?.x ?? 50,
                y: metrics?.position?.y ?? 50,
              };
            }),
            state.ballPosition,
            previousBallPosition,
            state.ballPossession || 'home',
            previousPossession,
            currentMinute
          );

          if (triggers.length > 0) {
            setTransitionTriggers(prev => [...triggers, ...prev].slice(0, 10));
          }

          const pivotStatus = transitionEngineRef.current.analyzeDoublePivot(
            players.slice(0, 11).map((p, i) => {
              const metrics = liveData.get(p.id);
              return {
                playerId: p.id,
                x: metrics?.position?.x ?? 50,
                y: metrics?.position?.y ?? 50,
              };
            }),
            state.ballPosition,
            players
          );
          setDoublePivotStatus(pivotStatus);

          setPreviousBallPosition(state.ballPosition);
          setPreviousPossession(state.ballPossession || 'home');
        }

        if (coherenceCalcRef.current && state.ballPosition) {
          const homePositions = players.slice(0, 11).map((p, i) => {
            const metrics = liveData.get(p.id);
            return {
              playerId: p.id,
              x: metrics?.position?.x ?? 50,
              y: metrics?.position?.y ?? 50,
              speed: metrics?.currentSpeed ?? 0,
            };
          });

          const awayPositions = awayPlayers.slice(0, 11).map((p, i) => {
            const metrics = newAwayData.get(p.id);
            return {
              playerId: p.id,
              x: metrics?.position?.x ?? 50,
              y: metrics?.position?.y ?? 50,
            };
          });

          const gameModel = gameModelManagerRef.current?.getActiveGameModel();
          if (gameModel) {
            const coherenceReport = coherenceCalcRef.current.calculateCoherence(
              homePositions,
              awayPositions,
              liveData,
              gameModel,
              players,
              state.ballPosition,
              state.ballPossession || 'home',
              currentMinute
            );
            setCorberanCoherence(coherenceReport);
          }
        }

        if (gpsBridgeRef.current && state.ballPosition) {
          const interpretations: TacticalInterpretation[] = players.slice(0, 11).map((player, index) => {
            const metrics = liveData.get(player.id);
            const idealPos = idealPositions[index];
            if (metrics) {
              return gpsBridgeRef.current!.interpretPlayerData(
                player,
                metrics,
                { x: idealPos.x, y: idealPos.y, role: idealPos.role },
                state.ballPosition!,
                state.ballPossession || 'home',
                currentMinute,
                false
              );
            }
            return null;
          }).filter(Boolean) as TacticalInterpretation[];

          if (interpretations.length > 0) {
            const teamSummary = gpsBridgeRef.current.interpretTeamData(
              interpretations,
              {
                verticalCompactness: CARLOS_CORBERAN_PERSONA.tacticalProfile.compactnessTarget.vertical,
                pressingIntensity: CARLOS_CORBERAN_PERSONA.tacticalProfile.pressingIntensityPreference,
              }
            );
            setTeamTacticalSummary(teamSummary);
          }
        }

        if (state.phase === 'full_time') {
          setIsSimulating(false);
          endMatch();
        }
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isLive, isSimulating, isPaused, players, awayPlayers, liveData, updateLiveData, updateMatch, endMatch, previousPossession, previousBallPosition, idealPositions]);

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

  const handleTriggerPress = useCallback((triggerId: string, label: string) => {
    if (!gameModelManagerRef.current || isProcessing) return;
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
  }, [isProcessing, matchState?.minute]);

  const getTeamFatigue = (fatigueMap: Map<string, FatigueModel>) => {
    const values = Array.from(fatigueMap.values());
    return values.length === 0 ? 0 : values.reduce((sum, f) => sum + f.currentFatigue, 0) / values.length;
  };

  // Get coherence color based on score
  const getCoherenceColor = (score: number) => {
    if (score >= 70) return BP.GREEN4;
    if (score >= 50) return BP.ORANGE4;
    return BP.RED4;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: BP.BLACK, color: BP.GRAY4 }}>
      {/* ==================== TOP NAV BAR ==================== */}
      <header
        className="h-11 flex items-center justify-between px-4 border-b"
        style={{ background: BP.DARK_GRAY1, borderColor: BP.DARK_GRAY3 }}
      >
        <div className="flex items-center gap-6">
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center" style={{ color: BP.BLUE4 }}>
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold tracking-wide" style={{ color: BP.WHITE }}>TACTICAL NEXUS</span>
          </div>

          {/* Match Info */}
          <div className="flex items-center gap-3 pl-6 border-l" style={{ borderColor: BP.DARK_GRAY3 }}>
            <span className="text-xs font-medium" style={{ color: BP.BLUE4 }}>MCI</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono font-bold" style={{ color: BP.WHITE }}>
                {matchState ? matchState.homeScore : 0}
              </span>
              <span className="text-xs" style={{ color: BP.GRAY1 }}>-</span>
              <span className="text-sm font-mono font-bold" style={{ color: BP.WHITE }}>
                {matchState ? matchState.awayScore : 0}
              </span>
            </div>
            <span className="text-xs font-medium" style={{ color: BP.RED4 }}>MUN</span>
          </div>

          {/* Live Indicator */}
          {isLive && matchState && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-current animate-pulse" style={{ color: BP.GREEN4 }} />
                <span className="text-xs font-mono" style={{ color: BP.GREEN4 }}>LIVE</span>
              </div>
              <span className="text-xs font-mono" style={{ color: BP.GRAY2 }}>{Math.floor(matchState.minute)}&apos;</span>
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {!isLive ? (
            <button
              onClick={handleStartMatch}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: BP.BLUE3,
                color: BP.WHITE,
              }}
            >
              <Play className="w-3 h-3" />
              Initialize
            </button>
          ) : (
            <>
              <button
                onClick={handlePauseMatch}
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{ background: BP.DARK_GRAY3, color: BP.GRAY4 }}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleEndMatch}
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{ background: BP.DARK_GRAY3, color: BP.RED4 }}
              >
                <Square className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* ==================== MAIN CONTENT ==================== */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">

        {/* ==================== LEFT PANEL - METRICS ==================== */}
        <aside
          className="flex flex-col border-r overflow-hidden flex-shrink-0"
          style={{ width: leftPanelWidth, background: BP.DARK_GRAY1, borderColor: BP.DARK_GRAY3 }}
        >
          {/* Coherence Section */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>COHERENCE</span>
              <span
                className="text-xs font-mono font-bold"
                style={{ color: getCoherenceColor(corberanCoherence?.overallScore ?? 0) }}
              >
                {corberanCoherence?.overallScore ?? 0}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1 w-full mb-3" style={{ background: BP.DARK_GRAY3 }}>
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${corberanCoherence?.overallScore ?? 0}%`,
                  background: getCoherenceColor(corberanCoherence?.overallScore ?? 0)
                }}
              />
            </div>

            {/* Sub-metrics */}
            <div className="space-y-2">
              {[
                { label: 'Pressing', value: corberanCoherence?.pressingCoherence.score ?? 0 },
                { label: 'Compactness', value: 100 - Math.min(100, (corberanCoherence?.compactnessCoherence.verticalCompactness ?? 25) * 2) },
                { label: 'Transition', value: corberanCoherence?.transitionCoherence.score ?? 0 },
              ].map(metric => (
                <div key={metric.label} className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: BP.GRAY1 }}>{metric.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-0.5" style={{ background: BP.DARK_GRAY4 }}>
                      <div
                        className="h-full"
                        style={{
                          width: `${metric.value}%`,
                          background: getCoherenceColor(metric.value)
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono w-7 text-right" style={{ color: BP.GRAY3 }}>
                      {Math.round(metric.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Double Pivot Status */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>DOUBLE PIVOT</span>
              <span
                className="text-[10px] font-mono"
                style={{ color: doublePivotStatus?.transitionReadiness && doublePivotStatus.transitionReadiness > 60 ? BP.GREEN4 : BP.ORANGE4 }}
              >
                {doublePivotStatus?.transitionReadiness ?? 0}% RDY
              </span>
            </div>

            {doublePivotStatus && (
              <div className="grid grid-cols-2 gap-2">
                {[doublePivotStatus.player1, doublePivotStatus.player2].map((player, idx) => (
                  <div
                    key={idx}
                    className="p-2"
                    style={{
                      background: player.isAvailable ? `${BP.GREEN3}15` : BP.DARK_GRAY2,
                      borderLeft: `2px solid ${player.isAvailable ? BP.GREEN4 : BP.DARK_GRAY4}`
                    }}
                  >
                    <div className="text-[10px] font-medium truncate" style={{ color: BP.GRAY4 }}>
                      {player.name.split(' ').pop()}
                    </div>
                    <div className="text-[9px] font-mono" style={{ color: BP.GRAY1 }}>
                      {player.distanceFromBall.toFixed(0)}m
                    </div>
                  </div>
                ))}
              </div>
            )}

            {doublePivotStatus && doublePivotStatus.spacing !== 'optimal' && (
              <div className="mt-2 text-[9px] px-2 py-1" style={{ background: `${BP.ORANGE3}20`, color: BP.ORANGE4 }}>
                {doublePivotStatus.spacing === 'too_close' ? 'SPACING: Split wider' : 'SPACING: Too spread'}
              </div>
            )}
          </div>

          {/* Match Stats */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>MATCH DATA</span>
            <div className="mt-2 space-y-1.5">
              {[
                { label: 'Possession', home: matchStats?.possession.home ?? 50, away: matchStats?.possession.away ?? 50, unit: '%' },
                { label: 'xG', home: matchStats?.xG.home ?? 0, away: matchStats?.xG.away ?? 0, unit: '', decimal: true },
                { label: 'Shots', home: matchStats?.shots.home ?? 0, away: matchStats?.shots.away ?? 0, unit: '' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center justify-between">
                  <span className="text-[10px] font-mono" style={{ color: BP.BLUE4 }}>
                    {stat.decimal ? stat.home.toFixed(1) : stat.home}{stat.unit}
                  </span>
                  <span className="text-[9px]" style={{ color: BP.GRAY1 }}>{stat.label}</span>
                  <span className="text-[10px] font-mono" style={{ color: BP.RED4 }}>
                    {stat.decimal ? stat.away.toFixed(1) : stat.away}{stat.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Efficiency Metrics */}
          {teamTacticalSummary && (
            <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>EFFICIENCY</span>
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: BP.GRAY1 }}>Running</span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: getCoherenceColor(teamTacticalSummary.efficiency.efficiencyRating) }}
                  >
                    {teamTacticalSummary.efficiency.efficiencyRating}%
                  </span>
                </div>
                <div className="text-[9px]" style={{ color: BP.GRAY1 }}>
                  {teamTacticalSummary.efficiency.message}
                </div>
              </div>
            </div>
          )}

          {/* Markov Prediction */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>PATTERN ANALYSIS</span>
            <div className="mt-2">
              <div className="text-[9px] truncate" style={{ color: BP.GRAY1 }}>
                {patternRecognitionData.markov?.currentChains?.home || 'Building chain...'}
              </div>
              {patternRecognitionData.markov?.predictedNext?.home && (
                <div
                  className="mt-2 p-2 flex items-center gap-2"
                  style={{ background: `${BP.BLUE3}15`, borderLeft: `2px solid ${BP.BLUE4}` }}
                >
                  <Zap className="w-3 h-3" style={{ color: BP.BLUE4 }} />
                  <span className="text-[9px]" style={{ color: BP.BLUE4 }}>
                    {patternRecognitionData.markov.predictedNext.home}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* GNN Pattern Recognition */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>GNN PATTERNS</span>
              <span className="text-[9px] font-mono" style={{ color: BP.BLUE4 }}>{gnnPatterns.length} ACTIVE</span>
            </div>
            {gnnPatterns.slice(0, 2).map((pattern, idx) => (
              <div
                key={idx}
                className="mb-1 p-1.5"
                style={{ background: BP.DARK_GRAY2, borderLeft: `2px solid ${BP.BLUE4}` }}
              >
                <div className="flex justify-between">
                  <span className="text-[9px]" style={{ color: BP.GRAY4 }}>{pattern.pattern.name}</span>
                  <span className="text-[9px] font-mono" style={{ color: BP.BLUE4 }}>{(pattern.matchConfidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
            {gnnPatterns.length === 0 && (
              <div className="text-[9px]" style={{ color: BP.GRAY1 }}>Analyzing tactical structure...</div>
            )}
          </div>

          {/* Football Brain Predictions */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>BRAIN PREDICTIONS</span>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: BP.GREEN4 }} />
            </div>
            {brainPredictions.slice(0, 2).map((pred, idx) => (
              <div key={idx} className="flex justify-between mb-1">
                <span className="text-[9px]" style={{ color: BP.GRAY3 }}>{pred.type.replace(/_/g, ' ')}</span>
                <span className="text-[9px] font-mono" style={{ color: pred.confidence > 0.6 ? BP.GREEN4 : BP.ORANGE4 }}>
                  {(pred.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
            {brainPredictions.length === 0 && (
              <div className="text-[9px]" style={{ color: BP.GRAY1 }}>Processing neural predictions...</div>
            )}
          </div>

          {/* Space Control */}
          <div className="p-3 flex-1">
            <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>SPACE CONTROL</span>
            {spaceControl ? (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[9px]" style={{ color: BP.GRAY1 }}>Controlled</span>
                  <span className="text-[9px] font-mono" style={{ color: BP.BLUE4 }}>
                    {spaceControl.totalControlledSpace.toFixed(0)}m²
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px]" style={{ color: BP.GRAY1 }}>Final Third</span>
                  <span className="text-[9px] font-mono" style={{ color: getCoherenceColor(spaceControl.attackingThirdControl * 100) }}>
                    {(spaceControl.attackingThirdControl * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px]" style={{ color: BP.GRAY1 }}>Half-Space L/R</span>
                  <span className="text-[9px] font-mono" style={{ color: BP.GRAY3 }}>
                    {(spaceControl.halfSpaceControl.left * 100).toFixed(0)}% / {(spaceControl.halfSpaceControl.right * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-[9px]" style={{ color: BP.GRAY1 }}>Calculating Voronoi...</div>
            )}
          </div>
        </aside>

        {/* LEFT RESIZE HANDLE */}
        <div
          className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0"
          style={{ background: isResizing === 'left' ? BP.BLUE4 : BP.DARK_GRAY3 }}
          onMouseDown={() => handleMouseDown('left')}
        />

        {/* ==================== CENTER - PITCH + TACTICAL LOG ==================== */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: BP.BLACK }}>
          {/* Alert Banner */}
          {transitionTriggers.length > 0 && transitionTriggers[0].active && (
            <div
              className="flex items-center gap-3 px-4 py-2 border-b"
              style={{
                background: transitionTriggers[0].intensity === 'critical' ? `${BP.RED3}20` : `${BP.ORANGE3}20`,
                borderColor: transitionTriggers[0].intensity === 'critical' ? BP.RED3 : BP.ORANGE3,
              }}
            >
              <AlertTriangle
                className="w-4 h-4"
                style={{ color: transitionTriggers[0].intensity === 'critical' ? BP.RED4 : BP.ORANGE4 }}
              />
              <div className="flex-1">
                <span className="text-xs font-medium" style={{ color: BP.WHITE }}>
                  {transitionTriggers[0].suggestedAction}
                </span>
                <span className="text-[10px] ml-2" style={{ color: BP.GRAY2 }}>
                  {doublePivotStatus ? getCorberanTransitionGuidance(transitionTriggers[0], doublePivotStatus) : ''}
                </span>
              </div>
              <span className="text-xs font-mono" style={{ color: BP.GRAY1 }}>
                {transitionTriggers[0].deadline}s
              </span>
            </div>
          )}

          {/* Compact Pitch Container - Resizable height */}
          <div className="p-2 overflow-hidden" style={{ height: `${pitchHeight}%` }}>
            <div
              className="h-full overflow-hidden"
              style={{ background: BP.DARK_GRAY1, border: `1px solid ${BP.DARK_GRAY3}` }}
            >
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

          {/* VERTICAL RESIZE HANDLE */}
          <div
            className="h-1 cursor-row-resize hover:bg-blue-500 transition-colors"
            style={{ background: isResizing === 'vertical' ? BP.BLUE4 : BP.DARK_GRAY3 }}
            onMouseDown={() => handleMouseDown('vertical')}
          />

          {/* Tactical Event Log - Resizable height */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ borderColor: BP.DARK_GRAY3 }}>
            <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: BP.DARK_GRAY2 }}>
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>TACTICAL LOG</span>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono" style={{ color: BP.BLUE4 }}>
                  {patternRecognitionData.activePatterns.home.length} PATTERNS
                </span>
                <span className="text-[9px] font-mono" style={{ color: BP.GREEN4 }}>
                  {transitionTriggers.filter(t => t.active).length} TRIGGERS
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1" style={{ background: BP.DARK_GRAY1 }}>
              {/* Match Events */}
              {matchEvents.slice(0, 8).map((event, idx) => {
                const isShot = event.type === 'shot_on_target' || event.type === 'shot_off_target' || event.type === 'shot_blocked';
                const isGoal = event.type === 'goal';
                const isFoul = event.type === 'foul' || event.type === 'yellow_card' || event.type === 'red_card';
                return (
                  <div
                    key={event.id || idx}
                    className="flex items-center gap-2 px-2 py-1 text-[10px]"
                    style={{
                      background: isGoal ? `${BP.GREEN3}15` :
                                isShot ? `${BP.BLUE3}10` :
                                isFoul ? `${BP.RED3}10` : BP.DARK_GRAY2,
                      borderLeft: `2px solid ${
                        isGoal ? BP.GREEN4 :
                        isShot ? BP.BLUE4 :
                        isFoul ? BP.RED4 : BP.DARK_GRAY4
                      }`,
                    }}
                  >
                    <span className="font-mono w-8" style={{ color: BP.GRAY1 }}>{event.minute}&apos;</span>
                    <span style={{ color: isGoal ? BP.GREEN4 : isShot ? BP.BLUE4 : BP.GRAY4 }}>{event.description}</span>
                  </div>
                );
              })}

              {/* Pattern Recognition Logs */}
              {patternRecognitionData.recentLogs.slice(0, 5).map((log, idx) => (
                <div
                  key={log.id || idx}
                  className="flex items-center gap-2 px-2 py-1 text-[10px]"
                  style={{
                    background: `${BP.BLUE3}08`,
                    borderLeft: `2px solid ${log.outcome?.success ? BP.GREEN4 : BP.ORANGE4}`,
                  }}
                >
                  <span className="font-mono w-8" style={{ color: BP.GRAY1 }}>{log.timestamp}&apos;</span>
                  <span style={{ color: BP.BLUE4 }}>[PATTERN]</span>
                  <span style={{ color: BP.GRAY4 }}>{log.pattern.type.replace(/_/g, ' ')}</span>
                  <span className="ml-auto font-mono" style={{ color: log.pattern.confidence > 0.7 ? BP.GREEN4 : BP.GRAY2 }}>
                    {(log.pattern.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}

              {/* Transition Triggers */}
              {transitionTriggers.slice(0, 5).map((trigger, idx) => (
                <div
                  key={trigger.id || idx}
                  className="flex items-center gap-2 px-2 py-1 text-[10px]"
                  style={{
                    background: trigger.active ? `${BP.ORANGE3}15` : BP.DARK_GRAY2,
                    borderLeft: `2px solid ${trigger.active ? BP.ORANGE4 : BP.DARK_GRAY4}`,
                  }}
                >
                  <span className="font-mono w-8" style={{ color: BP.GRAY1 }}>{trigger.minute}&apos;</span>
                  <span style={{ color: BP.ORANGE4 }}>[{trigger.type.toUpperCase()}]</span>
                  <span style={{ color: BP.GRAY4 }}>{trigger.suggestedAction}</span>
                  {trigger.active && (
                    <span className="ml-auto font-mono animate-pulse" style={{ color: BP.RED4 }}>
                      {trigger.deadline}s
                    </span>
                  )}
                </div>
              ))}

              {/* Coherence Alerts */}
              {corberanCoherence?.alerts.slice(0, 3).map((alert, idx) => (
                <div
                  key={alert.id || idx}
                  className="flex items-center gap-2 px-2 py-1 text-[10px]"
                  style={{
                    background: alert.severity === 'critical' ? `${BP.RED3}15` : `${BP.ORANGE3}10`,
                    borderLeft: `2px solid ${alert.severity === 'critical' ? BP.RED4 : BP.ORANGE4}`,
                  }}
                >
                  <AlertTriangle className="w-3 h-3" style={{ color: alert.severity === 'critical' ? BP.RED4 : BP.ORANGE4 }} />
                  <span style={{ color: BP.GRAY4 }}>{alert.message}</span>
                </div>
              ))}

              {/* GNN Pattern Matches */}
              {gnnPatterns.slice(0, 3).map((pattern, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-2 py-1 text-[10px]"
                  style={{
                    background: `${BP.BLUE3}05`,
                    borderLeft: `2px solid ${BP.BLUE4}`,
                  }}
                >
                  <Layers className="w-3 h-3" style={{ color: BP.BLUE4 }} />
                  <span style={{ color: BP.BLUE4 }}>[GNN]</span>
                  <span style={{ color: BP.GRAY4 }}>{pattern.pattern.name}</span>
                  <span className="ml-auto font-mono" style={{ color: BP.BLUE4 }}>
                    {(pattern.matchConfidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}

              {/* Brain Predictions */}
              {brainPredictions.slice(0, 2).map((pred, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-2 py-1 text-[10px]"
                  style={{
                    background: `${BP.GREEN3}05`,
                    borderLeft: `2px solid ${BP.GREEN4}`,
                  }}
                >
                  <Activity className="w-3 h-3" style={{ color: BP.GREEN4 }} />
                  <span style={{ color: BP.GREEN4 }}>[BRAIN]</span>
                  <span style={{ color: BP.GRAY4 }}>{pred.type.replace(/_/g, ' ')}</span>
                  <span className="ml-auto font-mono" style={{ color: pred.confidence > 0.7 ? BP.GREEN4 : BP.ORANGE4 }}>
                    {(pred.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}

              {/* Placeholder when no events */}
              {matchEvents.length === 0 && patternRecognitionData.recentLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32" style={{ color: BP.GRAY1 }}>
                  <Radio className="w-6 h-6 mb-2" style={{ color: BP.DARK_GRAY4 }} />
                  <div className="text-[10px]">Waiting for tactical events...</div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Stats Bar */}
          <div
            className="h-8 flex items-center justify-between px-4 border-t"
            style={{ background: BP.DARK_GRAY1, borderColor: BP.DARK_GRAY3 }}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3" style={{ color: BP.GRAY1 }} />
                <span className="text-[10px] font-mono" style={{ color: BP.GRAY3 }}>
                  {matchStats?.possession.home ?? 50}% POSS
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3" style={{ color: BP.GRAY1 }} />
                <span className="text-[10px] font-mono" style={{ color: BP.GRAY3 }}>
                  xG {(matchStats?.xG.home ?? 0).toFixed(2)}
                </span>
              </div>
              {scenarioResults && (
                <div className="flex items-center gap-1.5 pl-2 border-l" style={{ borderColor: BP.DARK_GRAY4 }}>
                  <Layers className="w-3 h-3" style={{ color: BP.BLUE4 }} />
                  <span className="text-[10px] font-mono" style={{ color: BP.BLUE4 }}>
                    {scenarioResults.scenarios} SIMS
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: BP.GREEN4 }}>
                    {(scenarioResults.winProb * 100).toFixed(0)}% WIN
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              {coherenceV3State && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px]" style={{ color: BP.GRAY1 }}>COHERENCE V3</span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: coherenceV3State.trajectory === 'improving' ? BP.GREEN4 : coherenceV3State.trajectory === 'declining' ? BP.RED4 : BP.GRAY3 }}
                  >
                    {coherenceV3State.trajectory.toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-[10px]" style={{ color: BP.GRAY1 }}>
                {corberanCoherence?.compactnessCoherence.linesBroken === false ? 'LINES CONNECTED' : 'LINES BROKEN'}
              </span>
              <span className="text-[10px] font-mono" style={{ color: BP.GRAY2 }}>
                {corberanCoherence?.compactnessCoherence.verticalCompactness?.toFixed(0) ?? 0}m COMPACT
              </span>
            </div>
          </div>
        </main>

        {/* RIGHT RESIZE HANDLE */}
        <div
          className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0"
          style={{ background: isResizing === 'right' ? BP.BLUE4 : BP.DARK_GRAY3 }}
          onMouseDown={() => handleMouseDown('right')}
        />

        {/* ==================== RIGHT PANEL - CONTROLS ==================== */}
        <aside
          className="flex flex-col border-l overflow-hidden flex-shrink-0"
          style={{ width: rightPanelWidth, background: BP.DARK_GRAY1, borderColor: BP.DARK_GRAY3 }}
        >
          {/* Operator Header */}
          <div
            className="p-3 border-b"
            style={{ borderColor: BP.DARK_GRAY3 }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 flex items-center justify-center text-[10px] font-bold"
                style={{ background: BP.BLUE3, color: BP.WHITE }}
              >
                CC
              </div>
              <div>
                <div className="text-xs font-medium" style={{ color: BP.WHITE }}>{activePersona.name}</div>
                <div className="text-[10px]" style={{ color: BP.GRAY1 }}>{activePersona.club}</div>
              </div>
            </div>
          </div>

          {/* Tactical Shape Mini */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>FORMATION</span>
              <span className="text-[10px] font-mono" style={{ color: BP.BLUE4 }}>4-2-3-1</span>
            </div>
            <div
              className="h-24 relative"
              style={{ background: '#0a1a0a' }}
            >
              <svg viewBox="0 0 100 60" className="w-full h-full">
                <line x1="50" y1="0" x2="50" y2="60" stroke="#1a3a1a" strokeWidth="0.5" />
                <circle cx="50" cy="30" r="8" fill="none" stroke="#1a3a1a" strokeWidth="0.5" />
                {idealPositions.map((pos, idx) => (
                  <circle
                    key={idx}
                    cx={pos.x}
                    cy={pos.y * 0.6}
                    r="2.5"
                    fill={BP.BLUE4}
                    opacity="0.9"
                  />
                ))}
                {[
                  { x: 95, y: 30 },
                  { x: 80, y: 8 }, { x: 80, y: 22 }, { x: 80, y: 38 }, { x: 80, y: 52 },
                  { x: 65, y: 15 }, { x: 65, y: 30 }, { x: 65, y: 45 },
                  { x: 50, y: 10 }, { x: 45, y: 30 }, { x: 50, y: 50 },
                ].map((pos, idx) => (
                  <circle key={`away-${idx}`} cx={pos.x} cy={pos.y} r="2" fill={BP.RED4} opacity="0.7" />
                ))}
              </svg>
            </div>
          </div>

          {/* Pressing Controls */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>PRESSING</span>
              <span className="text-[9px]" style={{ color: BP.GRAY1 }}>5-SEC RULE</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {CORBERAN_INSTRUCTION_TEMPLATES.filter(t => t.category === 'pressing').slice(0, 6).map(template => {
                const isUrgent = transitionTriggers.some(t => t.active && t.type === 'pressing_opportunity');
                const isActive = isUrgent && template.id === 'counter_press';
                return (
                  <button
                    key={template.id}
                    onClick={() => handleTriggerPress(template.id, template.name)}
                    className="relative px-2 py-1.5 text-[10px] text-left transition-all"
                    style={{
                      background: isActive ? `${BP.RED3}30` : BP.DARK_GRAY2,
                      borderLeft: `2px solid ${isActive ? BP.RED4 : 'transparent'}`,
                      color: isActive ? BP.RED4 : BP.GRAY3,
                    }}
                  >
                    {template.name}
                    {template.shortcut && (
                      <span
                        className="absolute top-0.5 right-1 text-[8px]"
                        style={{ color: BP.GRAY1 }}
                      >
                        {template.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transition Controls */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>TRANSITIONS</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {CORBERAN_INSTRUCTION_TEMPLATES.filter(t => t.category === 'transition').slice(0, 4).map(template => (
                <button
                  key={template.id}
                  onClick={() => handleTriggerPress(template.id, template.name)}
                  className="px-2 py-1.5 text-[10px] text-left transition-all"
                  style={{ background: BP.DARK_GRAY2, color: BP.GRAY3 }}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* Defensive Shape */}
          <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>DEFENSIVE</span>
            </div>
            <div className="flex gap-1">
              {[
                { id: 'drop_deep', label: 'DROP' },
                { id: 'hold_line', label: 'HOLD' },
                { id: 'step_up', label: 'STEP UP' },
              ].map(shape => (
                <button
                  key={shape.id}
                  onClick={() => handleTriggerPress(shape.id, shape.label)}
                  className="flex-1 px-2 py-1.5 text-[10px] transition-all"
                  style={{ background: BP.DARK_GRAY2, color: BP.GRAY3 }}
                >
                  {shape.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts */}
          {corberanCoherence && corberanCoherence.alerts.length > 0 && (
            <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.RED4 }}>ALERTS</span>
              <div className="mt-2 space-y-1">
                {corberanCoherence.alerts.slice(0, 3).map((alert, idx) => (
                  <div
                    key={alert.id || idx}
                    className="p-2 text-[10px]"
                    style={{
                      background: alert.severity === 'critical' ? `${BP.RED3}15` : `${BP.ORANGE3}15`,
                      borderLeft: `2px solid ${alert.severity === 'critical' ? BP.RED4 : BP.ORANGE4}`,
                      color: BP.GRAY4,
                    }}
                  >
                    <div>{alert.message}</div>
                    <div style={{ color: BP.GRAY1 }}>{alert.suggestedAction}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {teamTacticalSummary && teamTacticalSummary.insights.length > 0 && (
            <div className="p-3 border-b" style={{ borderColor: BP.DARK_GRAY3 }}>
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.BLUE4 }}>INSIGHTS</span>
              <div className="mt-2 space-y-1">
                {teamTacticalSummary.insights.slice(0, 3).map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-[10px]"
                    style={{ color: BP.GRAY3 }}
                  >
                    <Activity className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: BP.BLUE4 }} />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execution Log */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="px-3 py-2 flex items-center justify-between"
              style={{ background: BP.DARK_GRAY2 }}
            >
              <span className="text-[10px] font-medium tracking-wider" style={{ color: BP.GRAY2 }}>LOG</span>
              <div className="flex items-center gap-2">
                {corberanCoherence?.trend === 'improving' && <TrendingUp className="w-3 h-3" style={{ color: BP.GREEN4 }} />}
                {corberanCoherence?.trend === 'declining' && <TrendingDown className="w-3 h-3" style={{ color: BP.RED4 }} />}
                <span className="text-[10px] font-mono" style={{ color: BP.GREEN4 }}>
                  {instructionLog.filter(l => l.status === 'applied').length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {instructionLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full" style={{ color: BP.GRAY1 }}>
                  <Radio className="w-6 h-6 mb-2" style={{ color: BP.DARK_GRAY4 }} />
                  <div className="text-[10px]">Awaiting commands</div>
                </div>
              ) : (
                instructionLog.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 px-2 py-1 text-[10px]"
                    style={{
                      background: entry.status === 'applied' ? `${BP.GREEN3}10` : entry.status === 'pending' ? `${BP.ORANGE3}10` : `${BP.RED3}10`,
                      borderLeft: `2px solid ${entry.status === 'applied' ? BP.GREEN4 : entry.status === 'pending' ? BP.ORANGE4 : BP.RED4}`,
                    }}
                  >
                    {entry.status === 'applied' ? <CheckCircle2 className="w-3 h-3" style={{ color: BP.GREEN4 }} /> :
                     entry.status === 'pending' ? <Clock className="w-3 h-3" style={{ color: BP.ORANGE4 }} /> :
                     <XCircle className="w-3 h-3" style={{ color: BP.RED4 }} />}
                    <span className="flex-1 truncate" style={{ color: BP.GRAY4 }}>{entry.input}</span>
                    <span className="font-mono" style={{ color: BP.GRAY1 }}>{entry.minute}&apos;</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
