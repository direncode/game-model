'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  TACTICAL_PRESETS,
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
} from 'lucide-react';
import {
  GameModelManager,
  createGameModelManager,
  type ManagerSession,
  type StaffMember,
  GAME_MODEL_TEMPLATES,
} from '@/lib/game-model-manager';
import { ProcessedInstruction } from '@/types';

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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

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

    // Initialize Game Model Manager
    if (!gameModelManagerRef.current && patternEngineRef.current && citySquad.length > 0) {
      gameModelManagerRef.current = createGameModelManager(
        patternEngineRef.current,
        catapultService,
        citySquad
      );
      // Auto-start session
      const manager: StaffMember = {
        id: 'manager-1',
        name: 'Pep Guardiola',
        role: 'manager',
        canVerify: true,
        canModify: true,
      };
      const staff: StaffMember[] = [
        { id: 'coach-1', name: 'Juanma Lillo', role: 'assistant_coach', canVerify: true, canModify: false },
        { id: 'analyst-1', name: 'Tactical Analyst', role: 'analyst', canVerify: true, canModify: false },
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

        // Run pattern recognition engine
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

          // Calculate DYNAMIC coherence based on detected patterns vs game model
          const homeCoherence = calculateDynamicCoherence(
            'home',
            'total_football',
            homePatterns,
            patternEngine.getChainSummary('home'),
            minute
          );
          const awayCoherence = calculateDynamicCoherence(
            'away',
            'counter_attacking',
            awayPatterns,
            patternEngine.getChainSummary('away'),
            minute
          );

          const homeMarkov = patternEngine.getChainSummary('home');
          const awayMarkov = patternEngine.getChainSummary('away');
          const homePredicted = patternEngine.getPredictedNextPattern('home');
          const awayPredicted = patternEngine.getPredictedNextPattern('away');

          setPatternRecognitionData({
            activePatterns: { home: homePatterns, away: awayPatterns },
            recentLogs: patternEngine.getPatternLogs(undefined, 20),
            compoundingEffects: patternEngine.getCompoundingEffects(),
            coherence: { home: homeCoherence, away: awayCoherence },
            markov: {
              recurrentSequences: patternEngine.getRecurrentSequences(),
              currentChains: {
                home: homeMarkov.currentChain,
                away: awayMarkov.currentChain,
              },
              topTransitions: {
                home: patternEngine.getTopTransitions('home', 5),
                away: patternEngine.getTopTransitions('away', 5),
              },
              predictedNext: {
                home: homePredicted?.pattern?.replace(/_/g, ' ') || null,
                away: awayPredicted?.pattern?.replace(/_/g, ' ') || null,
              },
            },
          });
        }

        // CATAPULT GPS/WEARABLE INTEGRATION
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
          const fatigueModel = catapultService.calculateFatigueModel(player.id, currentMinute);
          homeFatigueModels.set(player.id, fatigueModel);
          const injuryRisk = catapultService.calculateInjuryRisk(player.id);
          allInjuryRisks.set(player.id, injuryRisk);
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
          const fatigueModel = catapultService.calculateFatigueModel(player.id, currentMinute);
          awayFatigueModels.set(player.id, fatigueModel);
          const injuryRisk = catapultService.calculateInjuryRisk(player.id);
          allInjuryRisks.set(player.id, injuryRisk);
        });

        const recommendations = catapultService.getTacticalRecommendations(currentMinute);

        setFatigueData({
          home: homeFatigueModels,
          away: awayFatigueModels,
          injuryRisks: allInjuryRisks,
          recommendations,
        });

        if (state.phase === 'full_time') {
          setIsSimulating(false);
          endMatch();
        }
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isLive, isSimulating, isPaused, players, awayPlayers, liveData, updateLiveData, updateMatch, endMatch]);

  // Calculate dynamic coherence based on actual pattern data
  function calculateDynamicCoherence(
    team: 'home' | 'away',
    gameModel: string,
    patterns: TacticalPattern[],
    markovSummary: {
      currentChain: string;
      topSequences: { sequence: string; count: number; successRate: number }[];
      predictedNext: string | null;
      chainHealth: 'strong' | 'building' | 'broken';
    },
    minute: number
  ): TacticalCoherence {
    const expectedPatterns: Record<string, string[]> = {
      total_football: ['positional_rotation', 'half_space_occupation', 'inverted_fullback', 'false_nine_drop', 'high_press_trigger', 'build_from_back'],
      counter_attacking: ['deep_block', 'quick_transition', 'direct_ball', 'wing_isolation', 'defensive_compact', 'counter_press_recovery'],
    };

    const expected = expectedPatterns[gameModel] || [];
    const detectedTypes = patterns.map(p => p.type);

    const matchedPatterns = expected.filter(exp =>
      detectedTypes.some(det => det.includes(exp.split('_')[0]) || exp.includes(det.split('_')[0]))
    );

    const patternCoherence = expected.length > 0 ? (matchedPatterns.length / expected.length) * 100 : 50;
    const chainHealthBonus = markovSummary.chainHealth === 'strong' ? 20 :
                            markovSummary.chainHealth === 'building' ? 10 : 0;
    const sequenceBonus = Math.min(15, markovSummary.topSequences.filter(s => s.count > 2).length * 5);
    const highConfPatterns = patterns.filter(p => p.confidence > 0.7);
    const confidenceBonus = Math.min(15, highConfPatterns.length * 3);

    const rawScore = patternCoherence + chainHealthBonus + sequenceBonus + confidenceBonus;
    const coherenceScore = Math.min(100, Math.max(0, rawScore));

    const trend: 'improving' | 'declining' | 'stable' =
      highConfPatterns.length > 3 ? 'improving' :
      highConfPatterns.length < 1 ? 'declining' : 'stable';

    const deviations = expected
      .filter(exp => !matchedPatterns.includes(exp))
      .slice(0, 3)
      .map(pattern => ({
        pattern: pattern.replace(/_/g, ' '),
        deviation: 30 + Math.random() * 40,
        reason: `${pattern.replace(/_/g, ' ')} not detected in recent play`,
      }));

    const suggestions: string[] = [];
    if (deviations.length > 2) {
      suggestions.push(`Increase ${gameModel.replace(/_/g, ' ')} patterns in build-up`);
    }
    if (markovSummary.chainHealth === 'broken') {
      suggestions.push('Build longer passing sequences');
    }
    if (highConfPatterns.length < 2) {
      suggestions.push('Execute clearer tactical patterns');
    }
    if (suggestions.length === 0) {
      suggestions.push('Maintaining game model effectively');
    }

    return {
      gameModel,
      coherenceScore: Math.round(coherenceScore),
      deviations,
      suggestions,
      historicalComparison: {
        avgCoherence: 65,
        trend,
      },
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
    setPatternRecognitionData({
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
    setFatigueData({
      home: new Map(),
      away: new Map(),
      injuryRisks: new Map(),
      recommendations: {
        substitutionTargets: [],
        pressingAdjustments: [],
        formationSuggestions: [],
      }
    });

    startMatch({
      matchId: `match-${Date.now()}`,
      gameApproach: undefined,
    });
    setIsSimulating(true);
    setIsPaused(false);
  }, [startMatch]);

  const handlePauseMatch = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleEndMatch = useCallback(() => {
    setIsSimulating(false);
    setIsPaused(false);
    endMatch();
    setMatchState(null);
    setMatchStats(null);
  }, [endMatch]);

  // Handle instruction submission
  const handleSendInstruction = useCallback(async () => {
    if (!instructionInput.trim() || isProcessing || !gameModelManagerRef.current) return;

    setIsProcessing(true);
    const minute = matchState?.minute ? Math.floor(matchState.minute) : 0;

    try {
      const result = await gameModelManagerRef.current.processManagerInstruction(instructionInput, 'text');

      const logEntry: InstructionLogEntry = {
        id: `inst-${Date.now()}`,
        timestamp: new Date(),
        minute,
        input: instructionInput,
        category: result.processed.processedInstructions[0]?.category || 'general',
        confidence: result.processed.confidence,
        status: result.applied ? 'applied' : (result.verification ? 'pending' : 'rejected'),
        affectedPlayers: result.processed.processedInstructions.flatMap(i => i.affectedPlayers),
        effect: result.applied
          ? `Applied ${result.processed.processedInstructions.length} tactical adjustment(s)`
          : result.verification
            ? `Awaiting verification (${Math.round(result.processed.confidence * 100)}%)`
            : 'Instruction not understood',
      };

      setInstructionLog(prev => [logEntry, ...prev].slice(0, 20));
      setInstructionInput('');
    } catch (error) {
      const logEntry: InstructionLogEntry = {
        id: `inst-${Date.now()}`,
        timestamp: new Date(),
        minute,
        input: instructionInput,
        category: 'error',
        confidence: 0,
        status: 'rejected',
        affectedPlayers: [],
        effect: error instanceof Error ? error.message : 'Processing error',
      };
      setInstructionLog(prev => [logEntry, ...prev].slice(0, 20));
    }

    setIsProcessing(false);
  }, [instructionInput, isProcessing, matchState?.minute]);

  // Handle template selection
  const handleTemplateSelect = useCallback((templateId: string) => {
    if (!gameModelManagerRef.current) return;

    try {
      const gameModel = gameModelManagerRef.current.createGameModelFromTemplate(templateId);
      const minute = matchState?.minute ? Math.floor(matchState.minute) : 0;

      const logEntry: InstructionLogEntry = {
        id: `template-${Date.now()}`,
        timestamp: new Date(),
        minute,
        input: `Set game model: ${gameModel.name}`,
        category: 'formation',
        confidence: 1,
        status: 'applied',
        affectedPlayers: [],
        effect: `Activated ${gameModel.formation.name} formation with ${gameModel.principles.inPossession.length + gameModel.principles.outOfPossession.length} tactical principles`,
      };

      setInstructionLog(prev => [logEntry, ...prev].slice(0, 20));
      setSelectedTemplate(templateId);
    } catch (error) {
      console.error('Error creating game model:', error);
    }
  }, [matchState?.minute]);

  // Voice recording
  const toggleRecording = useCallback(() => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      const SpeechRecognitionAPI = (window as Window & {
        SpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void };
        webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void };
      }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;

      if (SpeechRecognitionAPI) {
        const recognizer = new SpeechRecognitionAPI();
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.onresult = (event) => {
          setInstructionInput(event.results[0][0].transcript);
          setIsRecording(false);
        };
        recognizer.onerror = () => setIsRecording(false);
        recognizer.start();
      } else {
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  // Calculate team average fatigue
  const getTeamFatigue = (fatigueMap: Map<string, FatigueModel>) => {
    const values = Array.from(fatigueMap.values());
    if (values.length === 0) return 0;
    return values.reduce((sum, f) => sum + f.currentFatigue, 0) / values.length;
  };

  const activeModel = gameModelManagerRef.current?.getActiveGameModel();

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col">
      {/* Header - Compact */}
      <header className="flex-shrink-0 h-11 flex items-center justify-between px-6 border-b border-white/10">
        <div className="flex items-center gap-6">
          <span className="text-sky-400 text-sm font-medium">Manchester City</span>
          <span className="text-lg font-semibold tabular-nums">
            {matchState ? `${matchState.homeScore} – ${matchState.awayScore}` : '0 – 0'}
          </span>
          <span className="text-red-400 text-sm font-medium">Manchester United</span>
          {isLive && matchState && (
            <div className="flex items-center gap-2 ml-4">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-white/50 tabular-nums">{Math.floor(matchState.minute)}&apos;</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isLive ? (
            <button
              onClick={handleStartMatch}
              className="flex items-center gap-2 px-4 py-1.5 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          ) : (
            <>
              <button
                onClick={handlePauseMatch}
                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={handleEndMatch}
                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-red-500/80 rounded-full"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Pitch - Top Section */}
      <div className="flex-shrink-0 h-[45vh] p-3 bg-black">
        <div className="h-full rounded-xl overflow-hidden">
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
            analytics={{
              xG: matchStats ? { home: matchStats.xG.home, away: matchStats.xG.away } : { home: 0, away: 0 }
            }}
            patternRecognition={patternRecognitionData}
            fatigueData={fatigueData}
          />
        </div>
      </div>

      {/* Bottom Panel - Manager AI + Instruction Integration */}
      <div className="flex-1 grid grid-cols-12 gap-px bg-white/5 overflow-hidden">
        {/* Manager AI Input */}
        <div className="col-span-4 bg-zinc-950 flex flex-col">
          <div className="px-4 py-2 border-b border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/40 font-medium">Manager AI</span>
              {activeModel && (
                <span className="text-xs text-white/30">{activeModel.name}</span>
              )}
            </div>
          </div>

          {/* Game Model Templates */}
          <div className="px-4 py-2 border-b border-white/5">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {GAME_MODEL_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateSelect(t.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs transition-all ${
                    selectedTemplate === t.id
                      ? 'bg-sky-500 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="flex-1 flex flex-col justify-end p-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={instructionInput}
                onChange={(e) => setInstructionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInstruction()}
                placeholder="Press high when they pass back..."
                className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                disabled={isProcessing}
              />
              <button
                onClick={toggleRecording}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                  isRecording ? 'bg-red-500 text-white' : 'bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10'
                }`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={handleSendInstruction}
                disabled={!instructionInput.trim() || isProcessing}
                className="w-10 h-10 flex items-center justify-center bg-sky-500 text-white rounded-full disabled:opacity-30 hover:bg-sky-400 transition-all"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Instruction Integration Log */}
        <div className="col-span-5 bg-zinc-950 flex flex-col">
          <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-white/40 font-medium">Instruction Integration</span>
            <span className="text-xs text-white/30">{instructionLog.filter(l => l.status === 'applied').length} applied</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {instructionLog.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/20 text-sm">
                Instructions will appear here
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {instructionLog.map(entry => (
                  <div key={entry.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Status Icon */}
                      <div className={`mt-0.5 ${
                        entry.status === 'applied' ? 'text-emerald-400' :
                        entry.status === 'pending' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {entry.status === 'applied' ? <CheckCircle2 className="w-4 h-4" /> :
                         entry.status === 'pending' ? <Clock className="w-4 h-4" /> :
                         <XCircle className="w-4 h-4" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm text-white/90 font-medium">{entry.input}</span>
                          <span className="text-xs text-white/30 tabular-nums">{entry.minute}&apos;</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            entry.category === 'pressing' ? 'bg-orange-500/20 text-orange-300' :
                            entry.category === 'possession' ? 'bg-blue-500/20 text-blue-300' :
                            entry.category === 'formation' ? 'bg-purple-500/20 text-purple-300' :
                            entry.category === 'transition' ? 'bg-green-500/20 text-green-300' :
                            'bg-white/10 text-white/50'
                          }`}>
                            {entry.category}
                          </span>
                          <span className={`text-xs ${
                            entry.confidence >= 0.8 ? 'text-emerald-400' :
                            entry.confidence >= 0.6 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {Math.round(entry.confidence * 100)}%
                          </span>
                          {entry.affectedPlayers.length > 0 && (
                            <span className="text-xs text-white/30">
                              {entry.affectedPlayers.length} player{entry.affectedPlayers.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {entry.effect && (
                          <p className="text-xs text-white/40 mt-1">{entry.effect}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coherence + Stats */}
        <div className="col-span-3 bg-zinc-950 flex flex-col overflow-hidden">
          {/* Coherence */}
          <div className="px-4 py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-white/40" />
              <span className="text-xs uppercase tracking-wider text-white/40 font-medium">Coherence</span>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-white/5">
            <div className="grid grid-cols-2 gap-3">
              {/* City */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sky-400 text-xs font-medium">City</span>
                  <span className="text-xl font-light tabular-nums">
                    {patternRecognitionData.coherence.home?.coherenceScore ?? '—'}
                    <span className="text-xs text-white/30 ml-0.5">%</span>
                  </span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all"
                    style={{ width: `${patternRecognitionData.coherence.home?.coherenceScore ?? 0}%` }}
                  />
                </div>
              </div>
              {/* United */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-red-400 text-xs font-medium">United</span>
                  <span className="text-xl font-light tabular-nums">
                    {patternRecognitionData.coherence.away?.coherenceScore ?? '—'}
                    <span className="text-xs text-white/30 ml-0.5">%</span>
                  </span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all"
                    style={{ width: `${patternRecognitionData.coherence.away?.coherenceScore ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 px-4 py-3 overflow-y-auto">
            <div className="space-y-3">
              {matchStats ? (
                <>
                  <StatRow label="Possession" home={matchStats.possession.home} away={matchStats.possession.away} unit="%" />
                  <StatRow label="Shots" home={matchStats.shots.home} away={matchStats.shots.away} />
                  <StatRow label="xG" home={parseFloat(matchStats.xG.home.toFixed(2))} away={parseFloat(matchStats.xG.away.toFixed(2))} />
                </>
              ) : (
                <div className="text-white/20 text-xs text-center py-4">Match stats</div>
              )}

              {/* Fatigue */}
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3 h-3 text-white/40" />
                  <span className="text-xs text-white/40">Fatigue</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sky-400 text-xs w-10">City</span>
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          getTeamFatigue(fatigueData.home) > 60 ? 'bg-red-500' :
                          getTeamFatigue(fatigueData.home) > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${getTeamFatigue(fatigueData.home)}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/30 w-8 text-right tabular-nums">{getTeamFatigue(fatigueData.home).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-xs w-10">United</span>
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          getTeamFatigue(fatigueData.away) > 60 ? 'bg-red-500' :
                          getTeamFatigue(fatigueData.away) > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${getTeamFatigue(fatigueData.away)}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/30 w-8 text-right tabular-nums">{getTeamFatigue(fatigueData.away).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat row component
function StatRow({ label, home, away, unit = '' }: { label: string; home: number; away: number; unit?: string }) {
  const total = home + away || 1;
  const homePercent = (home / total) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-sky-400 tabular-nums">{home}{unit}</span>
        <span className="text-white/40">{label}</span>
        <span className="text-red-400 tabular-nums">{away}{unit}</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden flex">
        <div className="h-full bg-sky-500" style={{ width: `${homePercent}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${100 - homePercent}%` }} />
      </div>
    </div>
  );
}
