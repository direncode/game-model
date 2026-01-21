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
    <div className="min-h-screen bg-zinc-950 text-white overflow-y-auto">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-sky-400">MCI</span>
              <span className="text-xl font-bold">
                {matchState ? `${matchState.homeScore} - ${matchState.awayScore}` : '0 - 0'}
              </span>
              <span className="text-sm font-medium text-red-400">MUN</span>
            </div>

            {isLive && matchState && (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span>{Math.floor(matchState.minute)}&apos;</span>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowPresetMenu(!showPresetMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm hover:border-zinc-600 transition-colors"
            >
              <span className="text-zinc-400">System:</span>
              <span className="font-medium">{selectedPreset?.name || 'Select'}</span>
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            </button>

            {showPresetMenu && (
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1">
                {TACTICAL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 transition-colors ${
                      selectedPreset?.id === preset.id ? 'bg-zinc-800 text-white' : 'text-zinc-300'
                    }`}
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-zinc-500">{preset.manager} • {preset.formation}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Manager Console Toggle */}
            <button
              onClick={() => setShowManagerConsole(!showManagerConsole)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                showManagerConsole
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Manager AI
            </button>

            {!isLive ? (
              <button
                onClick={handleStartMatch}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                Start
              </button>
            ) : (
              <>
                <button
                  onClick={handlePauseMatch}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleEndMatch}
                  className="p-2 bg-zinc-800 hover:bg-red-600 rounded transition-colors"
                >
                  <Square className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* Top Section: Pitch + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Pitch - Takes 3 columns on large screens */}
          <div className="lg:col-span-3">
            <div className="bg-zinc-900 rounded-lg overflow-hidden">
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

            {/* Pressing Intensity Bar */}
            {matchState && (
              <div className="mt-4 flex items-center gap-4 bg-zinc-900 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-zinc-400">Pressing</span>
                </div>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all"
                    style={{ width: `${matchState.pressingIntensity || 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {matchState.pressingIntensity?.toFixed(0) || 0}%
                </span>
              </div>
            )}
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-4">
            {/* Match Stats */}
            {matchStats && (
              <div className="bg-zinc-900 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Match Stats</h3>
                <div className="space-y-3">
                  <StatBar label="Possession" home={matchStats.possession.home} away={matchStats.possession.away} />
                  <StatBar label="Shots" home={matchStats.shots.home} away={matchStats.shots.away} showRaw />
                  <StatBar label="On Target" home={matchStats.shotsOnTarget.home} away={matchStats.shotsOnTarget.away} showRaw />
                  <StatBar label="xG" home={parseFloat(matchStats.xG.home.toFixed(2))} away={parseFloat(matchStats.xG.away.toFixed(2))} showRaw />
                  <StatBar label="Passes" home={matchStats.passes.home} away={matchStats.passes.away} showRaw />
                </div>
              </div>
            )}

            {/* Team Fatigue */}
            <div className="bg-zinc-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Team Fatigue
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-sky-400">MCI</span>
                    <span className="text-zinc-400">{getTeamFatigue(fatigueData.home).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        getTeamFatigue(fatigueData.home) > 60 ? 'bg-red-500' :
                        getTeamFatigue(fatigueData.home) > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${getTeamFatigue(fatigueData.home)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-red-400">MUN</span>
                    <span className="text-zinc-400">{getTeamFatigue(fatigueData.away).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        getTeamFatigue(fatigueData.away) > 60 ? 'bg-red-500' :
                        getTeamFatigue(fatigueData.away) > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${getTeamFatigue(fatigueData.away)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Match Events */}
            <div className="bg-zinc-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Events</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {matchEvents.slice(0, 8).map((event) => (
                  <div
                    key={event.id}
                    className={`text-sm p-2 rounded ${
                      event.type === 'goal' ? 'bg-emerald-950 text-emerald-400' :
                      event.type === 'yellow_card' ? 'bg-amber-950 text-amber-400' :
                      event.type === 'red_card' ? 'bg-red-950 text-red-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span className="text-zinc-500">{event.minute}&apos;</span>{' '}
                    <span className={event.team === 'home' ? 'text-sky-400' : 'text-red-400'}>
                      {event.team === 'home' ? 'MCI' : 'MUN'}
                    </span>{' '}
                    {event.type === 'goal' ? '⚽ ' : ''}{event.description?.slice(0, 35)}
                  </div>
                ))}
                {matchEvents.length === 0 && (
                  <div className="text-zinc-600 text-sm text-center py-4">No events yet</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Panels - Below Pitch */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Tactical Pattern Logs */}
          <div className="bg-zinc-900 rounded-lg p-5">
            <h3 className="text-base font-semibold text-indigo-400 mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Tactical Pattern Logs
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {patternRecognitionData.recentLogs.slice(0, 15).map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    log.pattern.team === 'home'
                      ? 'border-sky-500 bg-sky-950/30'
                      : 'border-red-500 bg-red-950/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        log.pattern.team === 'home' ? 'bg-sky-600 text-white' : 'bg-red-600 text-white'
                      }`}>
                        {log.pattern.team === 'home' ? 'MCI' : 'MUN'}
                      </span>
                      <span className="text-white font-medium">
                        {log.pattern.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-zinc-500 text-sm">{log.timestamp.toFixed(0)}&apos;</span>
                  </div>
                  <p className="text-zinc-400 text-sm mb-2">{log.pattern.description}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded ${
                      log.outcome.success ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'
                    }`}>
                      {log.outcome.result.replace(/_/g, ' ')}
                    </span>
                    <span className="text-amber-400">
                      {(log.pattern.confidence * 100).toFixed(0)}% confidence
                    </span>
                    {log.xGCreated > 0 && (
                      <span className="text-emerald-400">+{log.xGCreated.toFixed(2)} xG</span>
                    )}
                  </div>
                </div>
              ))}
              {patternRecognitionData.recentLogs.length === 0 && (
                <div className="text-zinc-600 text-center py-8">
                  Pattern logs will appear once the match starts
                </div>
              )}
            </div>
          </div>

          {/* Coherence Analysis */}
          <div className="bg-zinc-900 rounded-lg p-5">
            <h3 className="text-base font-semibold text-violet-400 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Game Model Coherence
            </h3>

            {/* Current Coherence */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* City Coherence */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sky-400 font-medium">MCI</span>
                  <span className="text-xs text-zinc-500">Total Football</span>
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  {patternRecognitionData.coherence.home?.coherenceScore ?? '--'}%
                </div>
                <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (patternRecognitionData.coherence.home?.coherenceScore ?? 0) > 70 ? 'bg-emerald-500' :
                      (patternRecognitionData.coherence.home?.coherenceScore ?? 0) > 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${patternRecognitionData.coherence.home?.coherenceScore ?? 0}%` }}
                  />
                </div>
                <div className={`text-xs flex items-center gap-1 ${
                  patternRecognitionData.coherence.home?.historicalComparison.trend === 'improving' ? 'text-emerald-400' :
                  patternRecognitionData.coherence.home?.historicalComparison.trend === 'declining' ? 'text-red-400' : 'text-zinc-400'
                }`}>
                  {patternRecognitionData.coherence.home?.historicalComparison.trend === 'improving' ? '↑' :
                   patternRecognitionData.coherence.home?.historicalComparison.trend === 'declining' ? '↓' : '→'}
                  {patternRecognitionData.coherence.home?.historicalComparison.trend || 'stable'}
                </div>
              </div>

              {/* United Coherence */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-400 font-medium">MUN</span>
                  <span className="text-xs text-zinc-500">Counter Attack</span>
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  {patternRecognitionData.coherence.away?.coherenceScore ?? '--'}%
                </div>
                <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (patternRecognitionData.coherence.away?.coherenceScore ?? 0) > 70 ? 'bg-emerald-500' :
                      (patternRecognitionData.coherence.away?.coherenceScore ?? 0) > 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${patternRecognitionData.coherence.away?.coherenceScore ?? 0}%` }}
                  />
                </div>
                <div className={`text-xs flex items-center gap-1 ${
                  patternRecognitionData.coherence.away?.historicalComparison.trend === 'improving' ? 'text-emerald-400' :
                  patternRecognitionData.coherence.away?.historicalComparison.trend === 'declining' ? 'text-red-400' : 'text-zinc-400'
                }`}>
                  {patternRecognitionData.coherence.away?.historicalComparison.trend === 'improving' ? '↑' :
                   patternRecognitionData.coherence.away?.historicalComparison.trend === 'declining' ? '↓' : '→'}
                  {patternRecognitionData.coherence.away?.historicalComparison.trend || 'stable'}
                </div>
              </div>
            </div>

            {/* Coherence Logs */}
            <h4 className="text-sm font-medium text-zinc-400 mb-2">Coherence History</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {coherenceLogs.slice().reverse().slice(0, 10).map((log, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-sm border-l-2 ${
                    log.team === 'home' ? 'border-sky-500 bg-zinc-800/50' : 'border-red-500 bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={log.team === 'home' ? 'text-sky-400' : 'text-red-400'}>
                        {log.team === 'home' ? 'MCI' : 'MUN'}
                      </span>
                      <span className="text-zinc-500">{log.minute}&apos;</span>
                    </div>
                    <span className={`font-medium ${
                      log.score > 70 ? 'text-emerald-400' : log.score > 40 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {log.score}%
                    </span>
                  </div>
                  <div className="text-zinc-500 text-xs mt-1">{log.reason}</div>
                </div>
              ))}
              {coherenceLogs.length === 0 && (
                <div className="text-zinc-600 text-sm text-center py-4">
                  Coherence logs update every 5 minutes
                </div>
              )}
            </div>
          </div>

          {/* Markov Chains & Predictions */}
          <div className="bg-zinc-900 rounded-lg p-5">
            <h3 className="text-base font-semibold text-emerald-400 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Markov Chains & Predictions
            </h3>

            {/* Current Chains */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-zinc-400 mb-2">Active Pattern Chains</h4>
              <div className="space-y-2">
                <div className="bg-zinc-800 rounded p-3">
                  <span className="text-sky-400 text-sm font-medium">MCI: </span>
                  <span className="text-white text-sm">
                    {patternRecognitionData.markov?.currentChains.home || 'No active chain'}
                  </span>
                </div>
                <div className="bg-zinc-800 rounded p-3">
                  <span className="text-red-400 text-sm font-medium">MUN: </span>
                  <span className="text-white text-sm">
                    {patternRecognitionData.markov?.currentChains.away || 'No active chain'}
                  </span>
                </div>
              </div>
            </div>

            {/* Predicted Next */}
            {(patternRecognitionData.markov?.predictedNext.home || patternRecognitionData.markov?.predictedNext.away) && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Predicted Next Pattern</h4>
                <div className="space-y-2">
                  {patternRecognitionData.markov?.predictedNext.home && (
                    <div className="bg-amber-950/50 border border-amber-800 rounded p-3">
                      <span className="text-sky-400 text-sm font-medium">MCI → </span>
                      <span className="text-amber-400 text-sm font-medium">
                        {patternRecognitionData.markov.predictedNext.home}
                      </span>
                    </div>
                  )}
                  {patternRecognitionData.markov?.predictedNext.away && (
                    <div className="bg-amber-950/50 border border-amber-800 rounded p-3">
                      <span className="text-red-400 text-sm font-medium">MUN → </span>
                      <span className="text-amber-400 text-sm font-medium">
                        {patternRecognitionData.markov.predictedNext.away}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Top Transitions */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-zinc-400 mb-2">Most Likely Transitions</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-sky-400 text-xs font-medium mb-1">MCI</div>
                  <div className="space-y-1">
                    {patternRecognitionData.markov?.topTransitions.home.slice(0, 3).map((t, i) => (
                      <div key={i} className="text-xs text-zinc-400 bg-zinc-800 rounded px-2 py-1">
                        {t.from.replace(/_/g, ' ').slice(0, 10)} → {t.to.replace(/_/g, ' ').slice(0, 10)}
                        <span className="text-emerald-400 ml-1">({(t.probability * 100).toFixed(0)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-red-400 text-xs font-medium mb-1">MUN</div>
                  <div className="space-y-1">
                    {patternRecognitionData.markov?.topTransitions.away.slice(0, 3).map((t, i) => (
                      <div key={i} className="text-xs text-zinc-400 bg-zinc-800 rounded px-2 py-1">
                        {t.from.replace(/_/g, ' ').slice(0, 10)} → {t.to.replace(/_/g, ' ').slice(0, 10)}
                        <span className="text-emerald-400 ml-1">({(t.probability * 100).toFixed(0)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recurrent Sequences */}
            <div>
              <h4 className="text-sm font-medium text-zinc-400 mb-2">Recurrent Sequences</h4>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {patternRecognitionData.markov?.recurrentSequences.slice(0, 5).map((seq) => (
                  <div
                    key={seq.id}
                    className={`p-2 rounded border-l-2 text-sm ${
                      seq.team === 'home' ? 'border-sky-500 bg-zinc-800/50' : 'border-red-500 bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={seq.team === 'home' ? 'text-sky-400' : 'text-red-400'}>
                        {seq.team === 'home' ? 'MCI' : 'MUN'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">×{seq.occurrences}</span>
                        <span className={`text-xs ${
                          seq.successRate > 0.6 ? 'text-emerald-400' : seq.successRate > 0.4 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {(seq.successRate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-zinc-400 text-xs mt-1">{seq.description}</div>
                  </div>
                ))}
                {(!patternRecognitionData.markov?.recurrentSequences || patternRecognitionData.markov.recurrentSequences.length === 0) && (
                  <div className="text-zinc-600 text-sm text-center py-4">
                    Sequences emerge as patterns repeat
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fatigue & Substitution Recommendations */}
          <div className="bg-zinc-900 rounded-lg p-5 xl:col-span-2">
            <h3 className="text-base font-semibold text-orange-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Fatigue Analysis & Tactical Recommendations
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Substitution Targets */}
              <div>
                <h4 className="text-sm font-medium text-zinc-400 mb-3">Substitution Targets</h4>
                <div className="space-y-2">
                  {fatigueData.recommendations.substitutionTargets.slice(0, 5).map((target, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border-l-4 ${
                        target.priority === 'urgent' ? 'border-red-500 bg-red-950/30' :
                        target.priority === 'soon' ? 'border-orange-500 bg-orange-950/30' :
                        'border-yellow-500 bg-yellow-950/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-medium">
                          {target.playerId.replace(/_/g, ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          target.priority === 'urgent' ? 'bg-red-600 text-white' :
                          target.priority === 'soon' ? 'bg-orange-600 text-white' :
                          'bg-yellow-600 text-white'
                        }`}>
                          {target.priority}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-sm">{target.reason}</p>
                    </div>
                  ))}
                  {fatigueData.recommendations.substitutionTargets.length === 0 && (
                    <div className="text-zinc-600 text-sm text-center py-4 bg-zinc-800 rounded-lg">
                      No substitutions needed yet
                    </div>
                  )}
                </div>
              </div>

              {/* Tactical Suggestions */}
              <div>
                <h4 className="text-sm font-medium text-zinc-400 mb-3">Tactical Adjustments</h4>
                <div className="space-y-3">
                  {/* Pressing Adjustments */}
                  {fatigueData.recommendations.pressingAdjustments.length > 0 && (
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <div className="text-amber-400 text-sm font-medium mb-2">Pressing</div>
                      {fatigueData.recommendations.pressingAdjustments.map((adj, idx) => (
                        <p key={idx} className="text-zinc-400 text-sm">• {adj.recommendation}</p>
                      ))}
                    </div>
                  )}

                  {/* Formation Suggestions */}
                  {fatigueData.recommendations.formationSuggestions.length > 0 && (
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <div className="text-cyan-400 text-sm font-medium mb-2">Formation</div>
                      {fatigueData.recommendations.formationSuggestions.map((sug, idx) => (
                        <p key={idx} className="text-zinc-400 text-sm">• {sug}</p>
                      ))}
                    </div>
                  )}

                  {/* Coherence Suggestions */}
                  {(patternRecognitionData.coherence.home?.suggestions?.length || 0) > 0 && (
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <div className="text-violet-400 text-sm font-medium mb-2">MCI Game Model</div>
                      {patternRecognitionData.coherence.home?.suggestions.slice(0, 2).map((sug, idx) => (
                        <p key={idx} className="text-zinc-400 text-sm">• {sug}</p>
                      ))}
                    </div>
                  )}

                  {(patternRecognitionData.coherence.away?.suggestions?.length || 0) > 0 && (
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <div className="text-violet-400 text-sm font-medium mb-2">MUN Game Model</div>
                      {patternRecognitionData.coherence.away?.suggestions.slice(0, 2).map((sug, idx) => (
                        <p key={idx} className="text-zinc-400 text-sm">• {sug}</p>
                      ))}
                    </div>
                  )}

                  {fatigueData.recommendations.pressingAdjustments.length === 0 &&
                   fatigueData.recommendations.formationSuggestions.length === 0 &&
                   !patternRecognitionData.coherence.home?.suggestions?.length && (
                    <div className="text-zinc-600 text-sm text-center py-4 bg-zinc-800 rounded-lg">
                      No tactical adjustments needed
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Active Patterns Summary */}
          <div className="bg-zinc-900 rounded-lg p-5">
            <h3 className="text-base font-semibold text-cyan-400 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Active Patterns
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sky-400 text-sm font-medium mb-2">MCI ({patternRecognitionData.activePatterns.home.length})</div>
                <div className="space-y-1">
                  {patternRecognitionData.activePatterns.home.slice(0, 6).map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-zinc-800 rounded px-2 py-1">
                      <span className="text-zinc-300 text-xs">{p.type.replace(/_/g, ' ')}</span>
                      <span className={`text-xs ${
                        p.confidence > 0.7 ? 'text-emerald-400' : p.confidence > 0.5 ? 'text-amber-400' : 'text-zinc-500'
                      }`}>
                        {(p.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-red-400 text-sm font-medium mb-2">MUN ({patternRecognitionData.activePatterns.away.length})</div>
                <div className="space-y-1">
                  {patternRecognitionData.activePatterns.away.slice(0, 6).map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-zinc-800 rounded px-2 py-1">
                      <span className="text-zinc-300 text-xs">{p.type.replace(/_/g, ' ')}</span>
                      <span className={`text-xs ${
                        p.confidence > 0.7 ? 'text-emerald-400' : p.confidence > 0.5 ? 'text-amber-400' : 'text-zinc-500'
                      }`}>
                        {(p.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Compounding Effects */}
            {patternRecognitionData.compoundingEffects.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Active Effects</h4>
                <div className="flex flex-wrap gap-2">
                  {patternRecognitionData.compoundingEffects.slice(0, 6).map((effect, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-1 rounded text-xs ${
                        effect.type === 'synergy' ? 'bg-purple-900 text-purple-300' :
                        effect.type === 'fatigue' ? 'bg-orange-900 text-orange-300' :
                        effect.type === 'psychological' ? 'bg-pink-900 text-pink-300' :
                        'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {effect.type}: {effect.magnitude > 0 ? '+' : ''}{(effect.magnitude * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manager Console - AI Interface for Tactical Instructions */}
        {showManagerConsole && gameModelManagerRef.current && (
          <div className="mt-6">
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
      </main>
    </div>
  );
}

// Stat bar component
function StatBar({ label, home, away, showRaw = false }: { label: string; home: number; away: number; showRaw?: boolean }) {
  const total = home + away || 1;
  const homePercent = (home / total) * 100;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-sky-400">{showRaw ? home : `${home}%`}</span>
        <span className="text-zinc-500">{label}</span>
        <span className="text-red-400">{showRaw ? away : `${away}%`}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
        <div className="h-full bg-sky-500" style={{ width: `${homePercent}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${100 - homePercent}%` }} />
      </div>
    </div>
  );
}
