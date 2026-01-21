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
  ChevronDown,
  Zap,
  Activity,
  Brain,
  TrendingUp,
  AlertTriangle,
  Target,
  MessageSquare,
} from 'lucide-react';
import {
  GameModelManager,
  createGameModelManager,
  type ManagerSession,
  type StaffMember,
} from '@/lib/game-model-manager';
import { ManagerConsole } from '@/components/dashboard/manager-console';

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

// Coherence Log Entry
interface CoherenceLogEntry {
  minute: number;
  team: 'home' | 'away';
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  reason: string;
  patternsMatched: number;
  patternsExpected: number;
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

  // Coherence History Log
  const [coherenceLogs, setCoherenceLogs] = useState<CoherenceLogEntry[]>([]);

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
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  // Manager Console State
  const gameModelManagerRef = useRef<GameModelManager | null>(null);
  const [managerSession, setManagerSession] = useState<ManagerSession | null>(null);
  const [showManagerConsole, setShowManagerConsole] = useState(false);

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

          // Log coherence changes every 5 minutes
          if (minute > 0 && minute % 5 === 0) {
            const lastHomeLog = coherenceLogs.filter(l => l.team === 'home').slice(-1)[0];
            const lastAwayLog = coherenceLogs.filter(l => l.team === 'away').slice(-1)[0];

            if (!lastHomeLog || lastHomeLog.minute !== minute) {
              const newHomeLog: CoherenceLogEntry = {
                minute,
                team: 'home',
                score: homeCoherence.coherenceScore,
                trend: homeCoherence.historicalComparison.trend,
                reason: homeCoherence.suggestions[0] || 'Playing to model',
                patternsMatched: homePatterns.filter(p => p.confidence > 0.6).length,
                patternsExpected: 5,
              };
              const newAwayLog: CoherenceLogEntry = {
                minute,
                team: 'away',
                score: awayCoherence.coherenceScore,
                trend: awayCoherence.historicalComparison.trend,
                reason: awayCoherence.suggestions[0] || 'Playing to model',
                patternsMatched: awayPatterns.filter(p => p.confidence > 0.6).length,
                patternsExpected: 4,
              };
              setCoherenceLogs(prev => [...prev, newHomeLog, newAwayLog].slice(-30));
            }
          }

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
  }, [isLive, isSimulating, isPaused, players, awayPlayers, liveData, updateLiveData, updateMatch, endMatch, coherenceLogs]);

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
    // Define expected patterns for each game model
    const expectedPatterns: Record<string, string[]> = {
      total_football: ['positional_rotation', 'half_space_occupation', 'inverted_fullback', 'false_nine_drop', 'high_press_trigger', 'build_from_back'],
      counter_attacking: ['deep_block', 'quick_transition', 'direct_ball', 'wing_isolation', 'defensive_compact', 'counter_press_recovery'],
    };

    const expected = expectedPatterns[gameModel] || [];
    const detectedTypes = patterns.map(p => p.type);

    // Count how many expected patterns are being executed
    const matchedPatterns = expected.filter(exp =>
      detectedTypes.some(det => det.includes(exp.split('_')[0]) || exp.includes(det.split('_')[0]))
    );

    // Base coherence from pattern matching
    const patternCoherence = expected.length > 0 ? (matchedPatterns.length / expected.length) * 100 : 50;

    // Markov chain contribution - stronger chains = more coherent play
    const chainHealthBonus = markovSummary.chainHealth === 'strong' ? 20 :
                            markovSummary.chainHealth === 'building' ? 10 : 0;

    // Recurrent sequences bonus - more recurring patterns = more coherent
    const sequenceBonus = Math.min(15, markovSummary.topSequences.filter(s => s.count > 2).length * 5);

    // High confidence patterns bonus
    const highConfPatterns = patterns.filter(p => p.confidence > 0.7);
    const confidenceBonus = Math.min(15, highConfPatterns.length * 3);

    // Calculate final score
    const rawScore = patternCoherence + chainHealthBonus + sequenceBonus + confidenceBonus;
    const coherenceScore = Math.min(100, Math.max(0, rawScore));

    // Determine trend based on recent pattern activity
    const trend: 'improving' | 'declining' | 'stable' =
      highConfPatterns.length > 3 ? 'improving' :
      highConfPatterns.length < 1 ? 'declining' : 'stable';

    // Generate deviations
    const deviations = expected
      .filter(exp => !matchedPatterns.includes(exp))
      .slice(0, 3)
      .map(pattern => ({
        pattern: pattern.replace(/_/g, ' '),
        deviation: 30 + Math.random() * 40,
        reason: `${pattern.replace(/_/g, ' ')} not detected in recent play`,
      }));

    // Generate suggestions
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
    setCoherenceLogs([]);
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

  const handlePresetSelect = useCallback((preset: TacticalPreset) => {
    setSelectedPreset(preset);
    setShowPresetMenu(false);
  }, []);

  // Calculate team average fatigue
  const getTeamFatigue = (fatigueMap: Map<string, FatigueModel>) => {
    const values = Array.from(fatigueMap.values());
    if (values.length === 0) return 0;
    return values.reduce((sum, f) => sum + f.currentFatigue, 0) / values.length;
  };

  return (
    <div className="h-screen bg-black text-white/90 overflow-hidden flex flex-col">
      {/* Minimal Header */}
      <header className="flex-shrink-0 h-12 flex items-center justify-between px-6 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-8">
          {/* Score */}
          <div className="flex items-center gap-4">
            <span className="text-[13px] font-medium text-sky-400">Manchester City</span>
            <span className="text-lg font-semibold tracking-tight">
              {matchState ? `${matchState.homeScore} – ${matchState.awayScore}` : '0 – 0'}
            </span>
            <span className="text-[13px] font-medium text-red-400">Manchester United</span>
          </div>
          {isLive && matchState && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[13px] text-white/50">{Math.floor(matchState.minute)}&apos;</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isLive ? (
            <button
              onClick={handleStartMatch}
              className="flex items-center gap-2 px-4 py-1.5 bg-white text-black rounded-full text-[13px] font-medium hover:bg-white/90 transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              Start Match
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePauseMatch}
                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleEndMatch}
                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-red-500/80 rounded-full transition-all"
              >
                <Square className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Fixed Height Grid */}
      <main className="flex-1 grid grid-cols-12 gap-px bg-white/5 overflow-hidden">
        {/* Left Panel - Pitch */}
        <div className="col-span-7 bg-black p-4 flex flex-col">
          <div className="flex-1 rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-900/50 to-black">
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

        {/* Right Panel - Manager + Analytics */}
        <div className="col-span-5 bg-black flex flex-col overflow-hidden">
          {/* Manager Console - Always Visible */}
          <div className="flex-shrink-0 p-4 border-b border-white/5">
            {gameModelManagerRef.current && (
              <div className="h-[200px]">
                <ManagerConsole
                  manager={gameModelManagerRef.current}
                  session={managerSession}
                  onSessionStart={(mgr, staff) => {
                    if (gameModelManagerRef.current) {
                      const session = gameModelManagerRef.current.startSession(mgr, staff);
                      setManagerSession(session);
                    }
                  }}
                  currentMinute={matchState?.minute ? Math.floor(matchState.minute) : 0}
                  isLive={isLive}
                />
              </div>
            )}
          </div>

          {/* Coherence Section */}
          <div className="flex-shrink-0 p-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-white/40" />
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Coherence</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* City */}
              <div className="bg-white/[0.03] rounded-xl p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sky-400 text-[13px] font-medium">City</span>
                  <span className="text-[11px] text-white/30">Total Football</span>
                </div>
                <div className="text-2xl font-light tracking-tight mb-2">
                  {patternRecognitionData.coherence.home?.coherenceScore ?? '—'}
                  <span className="text-sm text-white/30 ml-0.5">%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all"
                    style={{ width: `${patternRecognitionData.coherence.home?.coherenceScore ?? 0}%` }}
                  />
                </div>
              </div>
              {/* United */}
              <div className="bg-white/[0.03] rounded-xl p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-red-400 text-[13px] font-medium">United</span>
                  <span className="text-[11px] text-white/30">Counter</span>
                </div>
                <div className="text-2xl font-light tracking-tight mb-2">
                  {patternRecognitionData.coherence.away?.coherenceScore ?? '—'}
                  <span className="text-sm text-white/30 ml-0.5">%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all"
                    style={{ width: `${patternRecognitionData.coherence.away?.coherenceScore ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats & Patterns */}
          <div className="flex-1 grid grid-cols-2 gap-px bg-white/5 overflow-hidden">
            {/* Stats */}
            <div className="bg-black p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-white/40" />
                <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Stats</span>
              </div>
              <div className="space-y-3">
                {matchStats ? (
                  <>
                    <StatBar label="Possession" home={matchStats.possession.home} away={matchStats.possession.away} />
                    <StatBar label="Shots" home={matchStats.shots.home} away={matchStats.shots.away} showRaw />
                    <StatBar label="xG" home={parseFloat(matchStats.xG.home.toFixed(2))} away={parseFloat(matchStats.xG.away.toFixed(2))} showRaw />
                  </>
                ) : (
                  <div className="text-white/20 text-[13px] text-center py-8">Stats appear when match starts</div>
                )}
              </div>

              {/* Fatigue */}
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-white/40" />
                  <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Fatigue</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sky-400 text-[13px] w-12">City</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          getTeamFatigue(fatigueData.home) > 60 ? 'bg-red-500' :
                          getTeamFatigue(fatigueData.home) > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${getTeamFatigue(fatigueData.home)}%` }}
                      />
                    </div>
                    <span className="text-white/30 text-[13px] w-10 text-right">{getTeamFatigue(fatigueData.home).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-red-400 text-[13px] w-12">United</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          getTeamFatigue(fatigueData.away) > 60 ? 'bg-red-500' :
                          getTeamFatigue(fatigueData.away) > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${getTeamFatigue(fatigueData.away)}%` }}
                      />
                    </div>
                    <span className="text-white/30 text-[13px] w-10 text-right">{getTeamFatigue(fatigueData.away).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Patterns */}
            <div className="bg-black p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-white/40" />
                <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Patterns</span>
              </div>
              <div className="space-y-2">
                {patternRecognitionData.activePatterns.home.slice(0, 4).map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/70 text-[13px]">{p.type.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sky-400 text-[11px]">City</span>
                      <span className={`text-[13px] ${p.confidence > 0.7 ? 'text-emerald-400' : 'text-white/40'}`}>
                        {(p.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
                {patternRecognitionData.activePatterns.away.slice(0, 4).map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/70 text-[13px]">{p.type.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-[11px]">United</span>
                      <span className={`text-[13px] ${p.confidence > 0.7 ? 'text-emerald-400' : 'text-white/40'}`}>
                        {(p.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
                {patternRecognitionData.activePatterns.home.length === 0 && patternRecognitionData.activePatterns.away.length === 0 && (
                  <div className="text-white/20 text-[13px] text-center py-8">Patterns appear during play</div>
                )}
              </div>

              {/* Markov Predictions */}
              {(patternRecognitionData.markov?.predictedNext.home || patternRecognitionData.markov?.predictedNext.away) && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-white/40" />
                    <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Predicted</span>
                  </div>
                  <div className="space-y-2">
                    {patternRecognitionData.markov?.predictedNext.home && (
                      <div className="bg-white/[0.03] rounded-lg p-2 text-[13px]">
                        <span className="text-sky-400">City → </span>
                        <span className="text-amber-400">{patternRecognitionData.markov.predictedNext.home}</span>
                      </div>
                    )}
                    {patternRecognitionData.markov?.predictedNext.away && (
                      <div className="bg-white/[0.03] rounded-lg p-2 text-[13px]">
                        <span className="text-red-400">United → </span>
                        <span className="text-amber-400">{patternRecognitionData.markov.predictedNext.away}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Stat bar component - Apple-like minimal design
function StatBar({ label, home, away, showRaw = false }: { label: string; home: number; away: number; showRaw?: boolean }) {
  const total = home + away || 1;
  const homePercent = (home / total) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sky-400 text-[13px] w-10 text-right">{showRaw ? home : `${home}%`}</span>
      <div className="flex-1">
        <div className="text-[11px] text-white/30 text-center mb-1">{label}</div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex">
          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${homePercent}%` }} />
          <div className="h-full bg-red-500 rounded-full" style={{ width: `${100 - homePercent}%` }} />
        </div>
      </div>
      <span className="text-red-400 text-[13px] w-10">{showRaw ? away : `${away}%`}</span>
    </div>
  );
}
