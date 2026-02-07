'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useGameStore } from '@/store/game-store';
import { createDigitalTwin } from '@/lib/digital-twin';
import {
  GameEngine,
  createManchesterDerby,
  type MatchState,
  type MatchStats,
  type MatchEvent as EngineMatchEvent,
} from '@/lib/game-engine';
import {
  TacticalPreset,
  getPresetById,
} from '@/lib/tactics-library';
import {
  PatternRecognitionEngine,
  type TacticalPattern,
  type TacticalCoherence,
} from '@/lib/pattern-recognition';
import {
  catapultService,
  type FatigueModel,
  type InjuryRiskModel,
} from '@/lib/catapult-integration';
import type { Player, TrackingMetrics, MatchEvent, PlayerAlert, TeamMetrics } from '@/types';
import {
  Play,
  Pause,
  Square,
  Tv,
  Activity,
  Cpu,
  Brain,
} from 'lucide-react';
import {
  GameModelManager,
  createGameModelManager,
  type ManagerSession,
  type StaffMember,
} from '@/lib/game-model-manager';
import { initializeMatchScenario, getStartingXI, type MatchScenario } from '@/data/match-scenario';
import { generateLiveTracking, generateDigitalTwins, generatePlayerAlerts, type SimpleTwin } from '@/data/generate-tracking';
import { MatchDashboard } from '@/components/tabs/match-dashboard';
import { PhysicalPerformance } from '@/components/tabs/physical-performance';
import { AlgorithmFlow } from '@/components/engine/algorithm-flow';
import { TacticalAI } from '@/components/tabs/tactical-ai';

type TabId = 'match' | 'physical' | 'engine' | 'tactical';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'match', label: 'Match', icon: <Tv className="w-3.5 h-3.5" /> },
  { id: 'physical', label: 'Physical', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'engine', label: 'Engine', icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: 'tactical', label: 'Tactical AI', icon: <Brain className="w-3.5 h-3.5" /> },
];

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
    addAlert,
    alerts,
  } = useGameStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('match');

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Match scenario
  const scenarioRef = useRef<MatchScenario | null>(null);

  // Game Engine refs
  const gameEngineRef = useRef<GameEngine | null>(null);
  const patternEngineRef = useRef<PatternRecognitionEngine | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [awayLiveData, setAwayLiveData] = useState<Map<string, TrackingMetrics>>(new Map());

  // Tracking data
  const [twins, setTwins] = useState<Map<string, SimpleTwin>>(new Map());
  const [homeMetrics, setHomeMetrics] = useState<TeamMetrics>({
    possession: 44, passAccuracy: 82, pressureSuccess: 38,
    territorialControl: 42, compactness: 78, formationMaintenance: 85,
  });
  const [awayTeamMetrics, setAwayTeamMetrics] = useState<TeamMetrics>({
    possession: 56, passAccuracy: 87, pressureSuccess: 45,
    territorialControl: 58, compactness: 72, formationMaintenance: 80,
  });

  // Coherence
  const [coherenceScore, setCoherenceScore] = useState(72);

  // Tactics State
  const [selectedPreset, setSelectedPreset] = useState<TacticalPreset | null>(
    () => getPresetById('guardiola_total_football') || null
  );

  // Manager Console State
  const gameModelManagerRef = useRef<GameModelManager | null>(null);
  const [managerSession, setManagerSession] = useState<ManagerSession | null>(null);

  // Current displayed minute
  const currentMinute = matchState ? Math.floor(matchState.minute) : scenarioRef.current?.match.minute ?? 67;

  // Initialize match scenario
  useEffect(() => {
    const scenario = initializeMatchScenario();
    scenarioRef.current = scenario;

    // Set home players (MUN)
    const munXI = getStartingXI(scenario.home.players, scenario.home.startingXI);
    setPlayers(scenario.home.players);
    munXI.forEach((player) => {
      const twin = createDigitalTwin(player, []);
      setTwin(player.id, twin);
    });

    // Set away players (LIV)
    setAwayPlayers(scenario.away.players);

    // Pre-seed events
    setMatchEvents(scenario.match.events);

    // Pre-seed metrics
    setHomeMetrics(scenario.match.teamMetrics.home);
    setAwayTeamMetrics(scenario.match.teamMetrics.away);

    // Generate initial tracking data for minute 67
    const initialTracking = generateLiveTracking(scenario.home.players.slice(0, 11), 67);
    initialTracking.forEach((metrics, playerId) => {
      // Assign positions from scenario
      const idx = scenario.home.startingXI.indexOf(playerId);
      if (idx >= 0 && scenario.home.positions[idx]) {
        metrics.position.x = scenario.home.positions[idx].x;
        metrics.position.y = scenario.home.positions[idx].y;
      }
      updateLiveData(playerId, metrics);
    });

    // Away tracking
    const awayTracking = generateLiveTracking(scenario.away.players.slice(0, 11), 67);
    const awayMap = new Map<string, TrackingMetrics>();
    awayTracking.forEach((metrics, playerId) => {
      const idx = scenario.away.startingXI.indexOf(playerId);
      if (idx >= 0 && scenario.away.positions[idx]) {
        metrics.position.x = scenario.away.positions[idx].x;
        metrics.position.y = scenario.away.positions[idx].y;
      }
      awayMap.set(playerId, metrics);
    });
    setAwayLiveData(awayMap);

    // Generate initial twins
    const initialTwins = generateDigitalTwins(scenario.home.players.slice(0, 11), 67);
    setTwins(initialTwins);

    // Generate initial alerts
    const initialAlerts = generatePlayerAlerts(scenario.home.players.slice(0, 11), initialTwins, 67);
    initialAlerts.forEach((alert) => addAlert(alert));

    // Initialize engines
    if (!gameEngineRef.current) {
      gameEngineRef.current = createManchesterDerby();
    }
    if (!patternEngineRef.current) {
      patternEngineRef.current = new PatternRecognitionEngine();
    }

    // Initialize game model manager
    if (!gameModelManagerRef.current && patternEngineRef.current && scenario.home.players.length > 0) {
      gameModelManagerRef.current = createGameModelManager(
        patternEngineRef.current,
        catapultService,
        scenario.home.players
      );
      const manager: StaffMember = {
        id: 'manager-1',
        name: 'Ruben Amorim',
        role: 'manager',
        canVerify: true,
        canModify: true,
      };
      const staff: StaffMember[] = [
        { id: 'coach-1', name: 'Carlos Fernandes', role: 'assistant_coach', canVerify: true, canModify: false },
      ];
      const session = gameModelManagerRef.current.startSession(manager, staff);
      setManagerSession(session);
    }
  }, [setPlayers, setTwin, updateLiveData, addAlert]);

  // Simulation loop — advances time, regenerates data, updates store
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isLive && isSimulating && !isPaused && gameEngineRef.current) {
      interval = setInterval(() => {
        const engine = gameEngineRef.current;
        if (!engine) return;

        const events = engine.tick(1);
        const state = engine.getState();
        const stats = engine.getStats();

        setMatchState(state);
        setMatchStats(stats);

        if (events.length > 0) {
          const converted: MatchEvent[] = events.map((e: EngineMatchEvent) => ({
            id: e.id,
            minute: e.minute,
            type: (['goal', 'card', 'substitution', 'injury', 'tactical_change'].includes(e.type) ? e.type : 'tactical_change') as MatchEvent['type'],
            description: e.description,
            playersInvolved: [e.primaryPlayer, e.secondaryPlayer].filter(Boolean) as string[],
          }));
          setMatchEvents((prev) => [...converted, ...prev].slice(0, 50));
        }

        updateMatch({
          currentMinute: Math.floor(state.minute),
          score: { home: state.homeScore, away: state.awayScore },
        });

        // Update home player metrics
        players.forEach((player, index) => {
          const metrics = engine.generatePlayerMetrics(player, true, index);
          updateLiveData(player.id, metrics);
        });

        // Update away player metrics
        const newAwayData = new Map<string, TrackingMetrics>();
        awayPlayers.forEach((player, index) => {
          const metrics = engine.generatePlayerMetrics(player, false, index);
          newAwayData.set(player.id, metrics);
        });
        setAwayLiveData(newAwayData);

        // Regenerate twins
        const minute = Math.floor(state.minute);
        const newTwins = generateDigitalTwins(players.slice(0, 11), minute);
        setTwins(newTwins);

        // Generate alerts periodically
        if (minute % 3 === 0) {
          const newAlerts = generatePlayerAlerts(players.slice(0, 11), newTwins, minute);
          newAlerts.forEach((alert) => addAlert(alert));
        }

        // Update team metrics from stats
        if (stats) {
          setHomeMetrics({
            possession: stats.possession.home,
            passAccuracy: stats.passAccuracy?.home ?? 82,
            pressureSuccess: 38 + Math.random() * 10,
            territorialControl: stats.possession.home * 0.9,
            compactness: 75 + Math.random() * 10,
            formationMaintenance: 80 + Math.random() * 10,
          });
          setAwayTeamMetrics({
            possession: stats.possession.away,
            passAccuracy: stats.passAccuracy?.away ?? 85,
            pressureSuccess: 42 + Math.random() * 10,
            territorialControl: stats.possession.away * 0.9,
            compactness: 70 + Math.random() * 10,
            formationMaintenance: 78 + Math.random() * 10,
          });
        }

        // Update coherence
        const coherentCount = Array.from(newTwins.values()).filter((t) => t.positionAdherence > 60).length;
        setCoherenceScore(Math.round((coherentCount / Math.max(1, newTwins.size)) * 100));

        // GPS feed to catapult
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
        });

        if (state.phase === 'full_time') {
          setIsSimulating(false);
          endMatch();
        }
      }, 2000); // Tick every 2 seconds as specified
    }

    return () => clearInterval(interval);
  }, [isLive, isSimulating, isPaused, players, awayPlayers, liveData, updateLiveData, updateMatch, endMatch, addAlert]);

  // Match controls
  const handleStartMatch = useCallback(() => {
    gameEngineRef.current = createManchesterDerby();
    gameEngineRef.current.kickoff();
    patternEngineRef.current = new PatternRecognitionEngine();
    setMatchEvents(scenarioRef.current?.match.events ?? []);
    setMatchState(gameEngineRef.current.getState());
    setMatchStats(gameEngineRef.current.getStats());
    startMatch({ matchId: `match-${Date.now()}`, gameApproach: undefined });
    setIsSimulating(true);
    setIsPaused(false);
  }, [startMatch]);

  const handlePauseMatch = useCallback(() => setIsPaused((prev) => !prev), []);

  const handleEndMatch = useCallback(() => {
    setIsSimulating(false);
    setIsPaused(false);
    endMatch();
    setMatchState(null);
    setMatchStats(null);
  }, [endMatch]);

  const handleSessionStart = useCallback(
    (manager: StaffMember, staff: StaffMember[]) => {
      if (gameModelManagerRef.current) {
        const session = gameModelManagerRef.current.startSession(manager, staff);
        setManagerSession(session);
      }
    },
    []
  );

  const handlePresetSelect = useCallback((preset: TacticalPreset) => {
    setSelectedPreset(preset);
  }, []);

  // Score display
  const homeScore = matchState?.homeScore ?? scenarioRef.current?.match.score.home ?? 1;
  const awayScore = matchState?.awayScore ?? scenarioRef.current?.match.score.away ?? 0;

  return (
    <div className="h-screen bg-[#1C2127] text-[#F6F7F9] overflow-hidden flex flex-col">
      {/* Match Header */}
      <header className="flex-shrink-0 h-12 flex items-center justify-between px-5 bg-[#252A31] border-b border-[#2F343C]">
        <div className="flex items-center gap-5">
          {/* Home badge + name */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-[9px] font-bold text-white">
              MUN
            </div>
            <span className="text-sm font-semibold text-[#F6F7F9]">Manchester United</span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tabular-nums text-white">{homeScore}</span>
            <span className="text-[#5F6B7C] text-sm">-</span>
            <span className="text-xl font-bold tabular-nums text-white">{awayScore}</span>
          </div>

          {/* Away badge + name */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#F6F7F9]">Liverpool</span>
            <div className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center text-[9px] font-bold text-white">
              LIV
            </div>
          </div>

          {/* Match info */}
          <div className="flex items-center gap-2 ml-4">
            {isLive && (
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            )}
            <span className="text-xs text-[#8F99A8] tabular-nums">
              {currentMinute}&apos;
            </span>
            <span className="text-[10px] text-[#5F6B7C]">2nd Half</span>
            <span className="text-[10px] text-[#5F6B7C]">Old Trafford</span>
            <span className="text-[10px] text-[#5F6B7C]">4-2-3-1 vs 4-3-3</span>
          </div>
        </div>

        {/* Play controls */}
        <div className="flex items-center gap-2">
          {!isLive ? (
            <button
              onClick={handleStartMatch}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2D72D2] text-white rounded-md text-xs font-medium hover:bg-[#215DB0] transition-colors"
            >
              <Play className="w-3 h-3" /> Start Match
            </button>
          ) : (
            <>
              <button
                onClick={handlePauseMatch}
                className="w-8 h-8 flex items-center justify-center bg-[#2F343C] hover:bg-[#383E47] rounded-md transition-colors"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleEndMatch}
                className="w-8 h-8 flex items-center justify-center bg-[#2F343C] hover:bg-[#CD4246] rounded-md transition-colors"
              >
                <Square className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 h-10 flex items-center gap-1 px-5 bg-[#1C2127] border-b border-[#2F343C]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#2F343C] text-[#F6F7F9]'
                : 'text-[#8F99A8] hover:text-[#F6F7F9] hover:bg-[#252A31]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'match' && (
          <MatchDashboard
            homePlayers={players}
            awayPlayers={awayPlayers}
            homeLiveData={liveData}
            awayLiveData={awayLiveData}
            ballPosition={matchState?.ballPosition}
            ballPossession={matchState?.ballPossession}
            matchEvents={matchEvents}
            alerts={alerts}
            homeMetrics={homeMetrics}
            awayMetrics={awayTeamMetrics}
            coherenceScore={coherenceScore}
            twins={twins}
            minute={currentMinute}
            isLive={isLive}
          />
        )}

        {activeTab === 'physical' && (
          <PhysicalPerformance
            players={players}
            liveData={liveData}
            twins={twins}
            alerts={alerts}
            minute={currentMinute}
            positions={scenarioRef.current?.home.positions ?? []}
          />
        )}

        {activeTab === 'engine' && <AlgorithmFlow />}

        {activeTab === 'tactical' && (
          <TacticalAI
            manager={gameModelManagerRef.current}
            session={managerSession}
            onSessionStart={handleSessionStart}
            currentMinute={currentMinute}
            isLive={isLive}
            selectedPreset={selectedPreset}
            onPresetSelect={handlePresetSelect}
          />
        )}
      </div>
    </div>
  );
}
