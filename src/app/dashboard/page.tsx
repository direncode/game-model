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
  Search,
  AlertTriangle,
  TrendingUp,
  UserPlus,
  Activity,
  Heart,
  BarChart3,
  MessageSquare,
} from 'lucide-react';
import { NLPQueryInterface, nlpQueryInterface, type QueryResponse } from '@/lib/nlp-query-interface';
import { InjuryPredictionEngine, type InjuryRiskScore } from '@/lib/injury-prediction';
import { RecruitmentAI, type ScoutingReport, type PlayerComparison } from '@/lib/recruitment-ai';
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

  // Analytics Panel State
  const [activePanel, setActivePanel] = useState<'match' | 'analytics' | 'medical' | 'scouting'>('match');
  const [nlpQuery, setNlpQuery] = useState('');
  const [nlpResponse, setNlpResponse] = useState<QueryResponse | null>(null);
  const [isQueryProcessing, setIsQueryProcessing] = useState(false);
  const injuryEngineRef = useRef<InjuryPredictionEngine>(new InjuryPredictionEngine());
  const recruitmentAIRef = useRef<RecruitmentAI | null>(null);
  const [injuryRisks, setInjuryRisks] = useState<Map<string, InjuryRiskScore>>(new Map());
  const [scoutingReport, setScoutingReport] = useState<ScoutingReport | null>(null);
  const [similarPlayers, setSimilarPlayers] = useState<PlayerComparison[]>([]);
  const [selectedScoutingPlayer, setSelectedScoutingPlayer] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Local type for display-friendly player comparisons
  interface SimilarPlayerDisplay {
    name: string;
    position: string;
    club: string;
    age: number;
    value: string;
    similarityScore: number;
    styleMatch: number;
    physicalMatch: number;
    technicalMatch: number;
    mentalMatch: number;
    keyDifferences: string[];
  }
  const [displaySimilarPlayers, setDisplaySimilarPlayers] = useState<SimilarPlayerDisplay[]>([]);

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

  // Active trigger state for visual feedback
  const [activeTrigger, setActiveTrigger] = useState<string | null>(null);

  // Handle pressing trigger button clicks
  const handleTriggerPress = useCallback((triggerId: string, label: string) => {
    if (isProcessing) return;
    const minute = matchState?.minute ? Math.floor(matchState.minute) : 0;

    // Visual feedback - set active trigger
    setActiveTrigger(triggerId);
    setTimeout(() => setActiveTrigger(null), 800);

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

    // Process through game model manager in background if available
    if (gameModelManagerRef.current) {
      gameModelManagerRef.current.processManagerInstruction(instruction, 'text').catch(() => {
        // Silently handle errors for triggers
      });
    }
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

  // Handle NLP Query
  const handleNLPQuery = useCallback(async () => {
    if (!nlpQuery.trim() || isQueryProcessing) return;
    setIsQueryProcessing(true);

    try {
      // Register current players for entity recognition
      nlpQueryInterface.registerPlayers(players);

      const response = nlpQueryInterface.processQuery(nlpQuery, {
        players: players,
        events: matchEvents as unknown as import('@/types').MatchEvent[],
      });

      setNlpResponse(response);
    } catch {
      setNlpResponse({
        success: false,
        query: nlpQueryInterface.analyzeQuery(nlpQuery),
        data: { type: 'summary', summary: 'Failed to process query' },
        naturalLanguageResponse: 'Sorry, I could not process that query. Please try rephrasing.',
        followUpQuestions: [],
      });
    }

    setIsQueryProcessing(false);
    setNlpQuery('');
  }, [nlpQuery, isQueryProcessing, players, matchEvents]);

  // Calculate injury risks for all players
  useEffect(() => {
    if (players.length > 0) {
      const risks = new Map<string, InjuryRiskScore>();
      players.forEach(player => {
        const metrics = liveData.get(player.id);
        const risk = injuryEngineRef.current.calculateRiskScore(player, metrics);
        risks.set(player.id, risk);
      });
      setInjuryRisks(risks);
    }
  }, [players, liveData]);

  // Get high risk players
  const highRiskPlayers = useMemo(() => {
    return Array.from(injuryRisks.entries())
      .filter(([, risk]) => risk.riskCategory === 'high' || risk.riskCategory === 'critical')
      .map(([playerId, risk]) => ({
        player: players.find(p => p.id === playerId),
        risk,
      }))
      .filter(item => item.player);
  }, [injuryRisks, players]);

  // Handle scouting analysis
  const handleScoutingAnalysis = useCallback(async () => {
    if (!selectedScoutingPlayer || isAnalyzing) return;
    setIsAnalyzing(true);

    const referencePlayer = players.find(p => p.id === selectedScoutingPlayer);
    if (referencePlayer) {
      // Generate mock similar players based on the reference player's position
      const mockPlayers: SimilarPlayerDisplay[] = [
        {
          name: 'Florian Wirtz',
          position: referencePlayer.position,
          club: 'B. Leverkusen',
          age: 21,
          value: '130M',
          similarityScore: 89,
          styleMatch: 92,
          physicalMatch: 85,
          technicalMatch: 91,
          mentalMatch: 88,
          keyDifferences: ['Higher dribbling frequency', 'Prefers left foot'],
        },
        {
          name: 'Jamal Musiala',
          position: referencePlayer.position,
          club: 'Bayern Munich',
          age: 21,
          value: '120M',
          similarityScore: 85,
          styleMatch: 88,
          physicalMatch: 82,
          technicalMatch: 89,
          mentalMatch: 84,
          keyDifferences: ['More central role', 'Better in tight spaces'],
        },
        {
          name: 'Pedri',
          position: referencePlayer.position,
          club: 'Barcelona',
          age: 21,
          value: '100M',
          similarityScore: 82,
          styleMatch: 85,
          physicalMatch: 78,
          technicalMatch: 88,
          mentalMatch: 86,
          keyDifferences: ['Better vision', 'Lower top speed'],
        },
        {
          name: 'Jude Bellingham',
          position: referencePlayer.position,
          club: 'Real Madrid',
          age: 20,
          value: '150M',
          similarityScore: 78,
          styleMatch: 80,
          physicalMatch: 90,
          technicalMatch: 82,
          mentalMatch: 85,
          keyDifferences: ['More box-to-box', 'Aerial presence'],
        },
      ];
      setDisplaySimilarPlayers(mockPlayers);
    }

    setTimeout(() => setIsAnalyzing(false), 500);
  }, [selectedScoutingPlayer, isAnalyzing, players]);

  // Get current game model name
  const activeGameModel = gameModelManagerRef.current?.getActiveGameModel();
  const modelName = activeGameModel?.name || GAME_MODEL_TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'Total Football';

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-mono">
      {/* Subtle grid background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />

      {/* Header - Minimal Palantir style */}
      <header className="flex-shrink-0 h-14 flex items-center justify-between px-6 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-cyan-500/50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-sm tracking-[0.2em] uppercase text-white/80">Tactical.AI</span>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10" />

          {/* Match Status */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-xs tracking-wider text-white/40">MATCH</span>
              <div className="flex items-center gap-2">
                <span className="text-white/90 text-sm">MCI</span>
                <span className="text-2xl font-light tabular-nums tracking-tight">
                  {matchState ? `${matchState.homeScore}` : '0'}
                </span>
                <span className="text-white/30 text-lg">–</span>
                <span className="text-2xl font-light tabular-nums tracking-tight">
                  {matchState ? `${matchState.awayScore}` : '0'}
                </span>
                <span className="text-white/90 text-sm">MUN</span>
              </div>
            </div>

            {isLive && matchState && (
              <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-xs text-cyan-400 tabular-nums tracking-wider">{Math.floor(matchState.minute)}&apos;</span>
              </div>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          {highRiskPlayers.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 border border-red-500/30 bg-red-500/5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-400 tracking-wider uppercase">{highRiskPlayers.length} Risk</span>
            </div>
          )}

          {!isLive ? (
            <button onClick={handleStartMatch} className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs tracking-wider uppercase hover:bg-cyan-400 transition-colors">
              <Play className="w-3 h-3" /> Initialize
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={handlePauseMatch} className="w-10 h-10 flex items-center justify-center border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all">
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button onClick={handleEndMatch} className="w-10 h-10 flex items-center justify-center border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 transition-all">
                <Square className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-6">
        <div className="flex items-center gap-0">
          {[
            { id: 'match' as const, label: 'LIVE FEED', icon: Activity },
            { id: 'analytics' as const, label: 'ANALYTICS', icon: BarChart3 },
            { id: 'medical' as const, label: 'MEDICAL', icon: Heart },
            { id: 'scouting' as const, label: 'SCOUTING', icon: UserPlus },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs tracking-wider transition-all border-b-2 ${
                activePanel === tab.id
                  ? 'text-cyan-400 border-cyan-400 bg-cyan-400/5'
                  : 'text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.02]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Primary Display */}
        <div className="flex-1 flex flex-col p-4 gap-4">
          {activePanel === 'match' && (
            <>
              {/* Stats Bar */}
              <div className="flex-shrink-0 grid grid-cols-6 gap-px bg-white/[0.06]">
                {[
                  { label: 'POSSESSION', home: matchStats?.possession.home ?? 50, away: matchStats?.possession.away ?? 50, unit: '%' },
                  { label: 'xG', home: matchStats?.xG.home ?? 0, away: matchStats?.xG.away ?? 0, unit: '', decimals: 2 },
                  { label: 'SHOTS', home: matchStats?.shots.home ?? 0, away: matchStats?.shots.away ?? 0, unit: '' },
                  { label: 'PASS ACC', home: matchStats?.passAccuracy?.home ?? 85, away: matchStats?.passAccuracy?.away ?? 82, unit: '%' },
                  { label: 'COHERENCE', home: overallCoherence, away: 67, unit: '%' },
                  { label: 'FATIGUE', home: Math.round(getTeamFatigue(fatigueData.home)), away: Math.round(getTeamFatigue(fatigueData.away)), unit: '%' },
                ].map((stat, i) => (
                  <div key={i} className="bg-black p-4">
                    <div className="text-[10px] text-white/30 tracking-wider mb-2">{stat.label}</div>
                    <div className="flex items-end justify-between">
                      <span className="text-xl font-light text-cyan-400 tabular-nums">
                        {stat.decimals ? stat.home.toFixed(stat.decimals) : stat.home}{stat.unit}
                      </span>
                      <span className="text-sm text-white/30 tabular-nums">
                        {stat.decimals ? stat.away.toFixed(stat.decimals) : stat.away}{stat.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pitch View */}
              <div className="flex-1 bg-black border border-white/[0.06] overflow-hidden relative">
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-[10px] tracking-widest text-white/50 uppercase">Live Tracking</span>
                </div>
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
            </>
          )}

          {activePanel === 'analytics' && (
            <div className="flex-1 flex flex-col gap-4">
              {/* Query Interface */}
              <div className="bg-black border border-white/[0.06] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs tracking-widest text-white/50 uppercase">Natural Language Query</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={nlpQuery}
                      onChange={(e) => setNlpQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNLPQuery()}
                      placeholder="Query match data..."
                      className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 font-mono"
                    />
                  </div>
                  <button
                    onClick={handleNLPQuery}
                    disabled={isQueryProcessing || !nlpQuery.trim()}
                    className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/5 disabled:text-white/20 text-black text-xs tracking-wider uppercase transition-all"
                  >
                    {isQueryProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Execute'}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  {['pressing analysis', 'xG breakdown', 'player comparison', 'formation efficiency'].map((q, i) => (
                    <button key={i} onClick={() => setNlpQuery(q)} className="px-3 py-1 border border-white/10 text-[10px] text-white/40 hover:text-white/70 hover:border-white/20 tracking-wider uppercase">
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Response Area - Terminal Style */}
              <div className="flex-1 bg-black border border-white/[0.06] overflow-hidden flex flex-col">
                {/* Terminal Header */}
                <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/60" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                      <div className="w-2 h-2 rounded-full bg-green-500/60" />
                    </div>
                    <span className="text-[10px] text-white/30 tracking-wider ml-2">QUERY_OUTPUT</span>
                  </div>
                  {nlpResponse && (
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${nlpResponse.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="text-[10px] text-white/40 tracking-wider uppercase">
                        {nlpResponse.success ? 'SUCCESS' : 'ERROR'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Terminal Content */}
                <div className="flex-1 overflow-y-auto p-4 font-mono">
                  {nlpResponse ? (
                    <div className="space-y-4">
                      {/* Command Echo */}
                      <div className="flex items-start gap-2">
                        <span className="text-cyan-400 text-xs">{'>'}</span>
                        <span className="text-white/60 text-xs">{nlpResponse.query.originalQuery || 'query'}</span>
                      </div>

                      {/* Status Line */}
                      <div className="text-[10px] text-white/30 tracking-wider pl-4 border-l border-white/10">
                        INTENT: <span className="text-purple-400">{nlpResponse.query.intent}</span>
                        {' · '}CONFIDENCE: <span className="text-cyan-400">{Math.round(nlpResponse.query.confidence * 100)}%</span>
                        {' · '}ENTITIES: <span className="text-amber-400">{
                          Object.values(nlpResponse.query.entities || {}).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
                        }</span>
                      </div>

                      {/* Response Output */}
                      <div className="p-4 bg-white/[0.02] border-l-2 border-cyan-500/50">
                        <p className="text-sm text-white/80 leading-relaxed">{nlpResponse.naturalLanguageResponse}</p>
                      </div>

                      {/* Metrics Grid */}
                      {nlpResponse.data.metrics && Object.keys(nlpResponse.data.metrics).length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[10px] text-white/30 tracking-widest uppercase">// DATA MATRIX</div>
                          <div className="grid grid-cols-4 gap-[1px] bg-white/[0.04]">
                            {Object.entries(nlpResponse.data.metrics).slice(0, 8).map(([key, value]) => (
                              <div key={key} className="bg-black p-3 group hover:bg-cyan-500/5 transition-colors">
                                <div className="text-[9px] text-white/25 tracking-wider uppercase mb-1 truncate">{key.replace(/_/g, ' ')}</div>
                                <div className="text-lg font-light text-cyan-400 tabular-nums group-hover:text-cyan-300">
                                  {typeof value === 'number' ? value.toFixed(1) : String(value)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-up Suggestions */}
                      {nlpResponse.followUpQuestions && nlpResponse.followUpQuestions.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="text-[10px] text-white/30 tracking-widest uppercase">// SUGGESTED QUERIES</div>
                          <div className="flex flex-wrap gap-2">
                            {nlpResponse.followUpQuestions.map((q, i) => (
                              <button
                                key={i}
                                onClick={() => setNlpQuery(q)}
                                className="px-3 py-1.5 bg-white/[0.02] border border-white/10 text-[10px] text-white/40 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/5 tracking-wider transition-all"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cursor */}
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-cyan-400 text-xs">{'>'}</span>
                        <span className="w-2 h-4 bg-cyan-400/70 animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto border border-white/10 flex items-center justify-center">
                          <Search className="w-6 h-6 text-white/20" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-white/40 tracking-wider uppercase">Awaiting Query Input</p>
                          <p className="text-[10px] text-white/20">Enter natural language query to analyze match data</p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <span className="text-cyan-400/50 text-xs">{'>'}</span>
                          <span className="w-2 h-4 bg-cyan-400/30 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activePanel === 'medical' && (
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
              {/* Risk Overview */}
              <div className="grid grid-cols-4 gap-px bg-white/[0.06]">
                {[
                  { label: 'SQUAD FIT', value: players.length - highRiskPlayers.length, color: 'text-emerald-400' },
                  { label: 'AT RISK', value: highRiskPlayers.length, color: 'text-red-400' },
                  { label: 'AVG ACWR', value: '0.95', color: 'text-cyan-400' },
                  { label: 'LOAD INDEX', value: '72', color: 'text-white' },
                ].map((stat, i) => (
                  <div key={i} className="bg-black p-6">
                    <div className="text-[10px] text-white/30 tracking-wider mb-2">{stat.label}</div>
                    <div className={`text-3xl font-light tabular-nums ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Player Risk Matrix */}
              <div className="flex-1 bg-black border border-white/[0.06]">
                <div className="p-4 border-b border-white/[0.06]">
                  <span className="text-[10px] tracking-widest text-white/50 uppercase">Player Risk Assessment</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {players.slice(0, 11).map(player => {
                    const risk = injuryRisks.get(player.id);
                    return (
                      <div key={player.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02]">
                        <div className="flex items-center gap-4">
                          <div className={`w-1 h-8 ${
                            risk?.riskCategory === 'low' ? 'bg-emerald-500' :
                            risk?.riskCategory === 'moderate' ? 'bg-amber-500' :
                            risk?.riskCategory === 'high' ? 'bg-orange-500' : 'bg-red-500'
                          }`} />
                          <div>
                            <div className="text-sm text-white/90">{player.name}</div>
                            <div className="text-[10px] text-white/30 tracking-wider uppercase">{player.position}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <div className="text-lg font-light tabular-nums text-white/80">{risk ? Math.round(risk.overallRisk) : 0}%</div>
                          </div>
                          <div className="w-32 h-1 bg-white/10">
                            <div className={`h-full transition-all ${
                              risk?.riskCategory === 'low' ? 'bg-emerald-500' :
                              risk?.riskCategory === 'moderate' ? 'bg-amber-500' :
                              risk?.riskCategory === 'high' ? 'bg-orange-500' : 'bg-red-500'
                            }`} style={{ width: `${risk?.overallRisk || 0}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activePanel === 'scouting' && (
            <div className="flex-1 flex flex-col gap-4">
              {/* Search */}
              <div className="bg-black border border-white/[0.06] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="w-4 h-4 text-purple-400" />
                  <span className="text-xs tracking-widest text-white/50 uppercase">Player Similarity Engine</span>
                </div>
                <div className="flex gap-3">
                  <select
                    value={selectedScoutingPlayer}
                    onChange={(e) => setSelectedScoutingPlayer(e.target.value)}
                    className="flex-1 px-4 py-3 bg-white/[0.02] border border-white/10 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="">Select reference player...</option>
                    {players.slice(0, 11).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleScoutingAnalysis}
                    disabled={!selectedScoutingPlayer || isAnalyzing}
                    className={`px-6 py-3 text-xs tracking-wider uppercase transition-all ${
                      !selectedScoutingPlayer || isAnalyzing
                        ? 'bg-white/10 text-white/30 cursor-not-allowed'
                        : 'bg-purple-500 hover:bg-purple-400 text-black'
                    }`}
                  >
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
                  </button>
                </div>
              </div>

              {/* Results - Terminal Style */}
              <div className="flex-1 bg-black border border-white/[0.06] overflow-hidden flex flex-col">
                {/* Terminal Header */}
                <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/60" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                      <div className="w-2 h-2 rounded-full bg-green-500/60" />
                    </div>
                    <span className="text-[10px] text-white/30 tracking-wider ml-2">SIMILARITY_ENGINE</span>
                  </div>
                  {displaySimilarPlayers.length > 0 && (
                    <span className="text-[10px] text-purple-400 tracking-wider">{displaySimilarPlayers.length} MATCHES</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                  {displaySimilarPlayers.length > 0 ? (
                    <div className="divide-y divide-white/[0.04]">
                      {displaySimilarPlayers.map((player, i) => (
                        <div key={i} className="p-4 hover:bg-white/[0.02] cursor-pointer group">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 border border-purple-500/30 bg-purple-500/10 flex items-center justify-center text-xs text-purple-400 font-mono">
                                {player.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <div className="text-sm text-white/90 group-hover:text-purple-400 transition-colors">{player.name}</div>
                                <div className="text-[10px] text-white/30 tracking-wider uppercase">{player.club} · {player.age}y · €{player.value}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-light text-purple-400 tabular-nums">{player.similarityScore}%</div>
                              <div className="text-[9px] text-white/30 tracking-wider">MATCH</div>
                            </div>
                          </div>
                          {/* Attribute Bars */}
                          <div className="grid grid-cols-4 gap-3 mt-3">
                            {[
                              { label: 'STYLE', value: player.styleMatch },
                              { label: 'PHYSICAL', value: player.physicalMatch },
                              { label: 'TECHNICAL', value: player.technicalMatch },
                              { label: 'MENTAL', value: player.mentalMatch },
                            ].map((attr, j) => (
                              <div key={j}>
                                <div className="text-[8px] text-white/30 tracking-wider mb-1">{attr.label}</div>
                                <div className="h-1 bg-white/10">
                                  <div
                                    className="h-full bg-purple-500/70 transition-all"
                                    style={{ width: `${attr.value}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Key Differences */}
                          {player.keyDifferences.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/[0.04]">
                              <div className="flex flex-wrap gap-2">
                                {player.keyDifferences.map((diff, k) => (
                                  <span key={k} className="px-2 py-0.5 bg-white/[0.03] text-[9px] text-white/40 tracking-wider">
                                    {diff}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8">
                      <div className="w-16 h-16 border border-white/10 flex items-center justify-center mb-4">
                        <GitCompare className="w-6 h-6 text-white/20" />
                      </div>
                      <p className="text-xs text-white/40 tracking-wider uppercase mb-1">No Analysis Active</p>
                      <p className="text-[10px] text-white/20 text-center">Select a reference player and click Analyze to find similar profiles</p>
                      <div className="flex items-center gap-2 mt-4">
                        <span className="text-purple-400/50 text-xs">{'>'}</span>
                        <span className="w-2 h-4 bg-purple-400/30 animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-white/[0.06] flex flex-col bg-black/50">
          {/* Digital Twin */}
          <div className="flex-shrink-0 border-b border-white/[0.06]">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                <span className="text-[10px] tracking-widest text-white/50 uppercase">Digital Twin</span>
              </div>
              <span className="text-xs text-cyan-400 tabular-nums">{twinPositions.filter(p => p.isCoherent).length}/11</span>
            </div>
            <div className="h-40 bg-gradient-to-b from-emerald-950/20 to-black relative">
              <svg viewBox="0 0 100 65" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <rect x="0" y="0" width="100" height="65" fill="transparent" />
                <line x1="50" y1="0" x2="50" y2="65" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
                <circle cx="50" cy="32.5" r="8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
                {idealPositions.map((pos, idx) => (
                  <circle key={`ideal-${idx}`} cx={pos.x} cy={pos.y * 0.65} r="2.5" fill="rgba(34,211,238,0.8)" />
                ))}
                <circle cx="45" cy="32.5" r="1.2" fill="white" />
              </svg>
            </div>
          </div>

          {/* Markov Chain */}
          <div className="flex-shrink-0 p-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] tracking-widest text-white/50 uppercase">Pattern Chain</span>
              <Zap className="w-3 h-3 text-purple-400" />
            </div>
            <div className="text-xs text-white/40 mb-2 truncate font-mono">
              {patternRecognitionData.markov?.currentChains?.home || 'Initializing...'}
            </div>
            {patternRecognitionData.markov?.predictedNext?.home && (
              <div className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/20">
                <span className="text-[10px] text-purple-400 tracking-wider uppercase">Predicted: {patternRecognitionData.markov.predictedNext.home}</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex-shrink-0 p-4 border-b border-white/[0.06]">
            <span className="text-[10px] tracking-widest text-white/50 uppercase block mb-3">Tactical Triggers</span>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: 'high_press', label: 'HIGH PRESS' },
                { id: 'counter_press', label: 'COUNTER' },
                { id: 'low_block', label: 'LOW BLOCK' },
                { id: 'hold_line', label: 'HOLD LINE' },
              ].map(trigger => (
                <button
                  key={trigger.id}
                  onClick={() => handleTriggerPress(trigger.id, trigger.label)}
                  className={`px-3 py-2 border text-[10px] tracking-wider transition-all ${
                    activeTrigger === trigger.id
                      ? 'bg-cyan-500 text-black border-cyan-400 scale-95'
                      : 'border-white/10 text-white/50 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/5'
                  }`}
                >
                  {trigger.label}
                </button>
              ))}
            </div>
          </div>

          {/* Event Log */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <span className="text-[10px] tracking-widest text-white/50 uppercase">Execution Log</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {instructionLog.length === 0 ? (
                <div className="p-4 text-center text-white/20 text-xs">No events</div>
              ) : (
                instructionLog.map(entry => (
                  <div key={entry.id} className={`px-4 py-2 border-b border-white/[0.04] text-xs ${
                    entry.status === 'applied' ? 'text-cyan-400' : entry.status === 'pending' ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="truncate">{entry.input}</span>
                      <span className="text-white/30 tabular-nums">{entry.minute}&apos;</span>
                    </div>
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
