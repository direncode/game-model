'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useGameStore } from '@/store/game-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PitchView } from '@/components/dashboard/pitch-view';
import { PlayerStatsCard, PlayerList } from '@/components/dashboard/player-stats-card';
import { CoherenceGauge, CoherenceBar } from '@/components/dashboard/coherence-gauge';
import { LiveMatchPanel } from '@/components/dashboard/live-match-panel';
import { GameModelEditor } from '@/components/game-model/game-model-editor';
import { AIInput } from '@/components/tactical/ai-input';
import { InstructionLogPanel } from '@/components/tactical/instruction-log-panel';
import { createDigitalTwin } from '@/lib/digital-twin';
import { calculateCoherence } from '@/lib/coherence-analysis';
import { getPLSquadData } from '@/lib/premier-league-api';
import {
  GameEngine,
  createManchesterDerby,
  formatMatchTime,
  getMatchPhaseDisplay,
  type MatchEvent,
  type MatchState,
  type MatchStats,
} from '@/lib/game-engine';
import {
  getInstructionLogManager,
  generateInterpretation,
} from '@/lib/instruction-log';
import type { Player, GameModel, TrackingMetrics, LivePlayerData, ManagerInput } from '@/types';
import {
  LayoutDashboard,
  Users,
  Target,
  Zap,
  Brain,
  Settings,
  Plus,
  Play,
  Pause,
  Square,
  Activity,
  History,
  FileText,
  Clock,
  AlertTriangle,
} from 'lucide-react';

// Match configuration
const MATCH_CONFIG = {
  season: '2025/26',
  competition: 'Premier League',
  matchday: 16,
  homeTeam: 'Manchester City',
  awayTeam: 'Manchester United',
  venue: 'Etihad Stadium',
  referee: 'Michael Oliver',
};

export default function Home() {
  const {
    players,
    setPlayers,
    gameModels,
    activeGameModel,
    createGameModel,
    setActiveGameModel,
    twins,
    setTwin,
    liveData,
    updateLiveData,
    isLive,
    matchData,
    startMatch,
    updateMatch,
    endMatch,
    coherenceReport,
    updateCoherence,
    alerts,
    deviations,
    selectedPlayerId,
    setSelectedPlayer,
    selectedTeam,
    setSelectedTeam,
    instructionLogs,
    addInstructionLog,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logManager] = useState(() => getInstructionLogManager());

  // Game Engine State
  const gameEngineRef = useRef<GameEngine | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);

  // Initialize squads for Manchester Derby
  useEffect(() => {
    // Load Manchester City squad (home team)
    const citySquad = getPLSquadData('MCI');
    if (citySquad.length > 0) {
      setPlayers(citySquad);
      setSelectedTeam('MCI');
      citySquad.forEach((player) => {
        const twin = createDigitalTwin(player, []);
        setTwin(player.id, twin);
      });
    }

    // Load Manchester United squad (away team)
    const unitedSquad = getPLSquadData('MUN');
    if (unitedSquad.length > 0) {
      setAwayPlayers(unitedSquad);
    }

    // Initialize game engine
    if (!gameEngineRef.current) {
      gameEngineRef.current = createManchesterDerby();
    }
  }, [setPlayers, setTwin, setSelectedTeam]);

  // Game Engine Simulation Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isLive && isSimulating && !isPaused && gameEngineRef.current) {
      interval = setInterval(() => {
        const engine = gameEngineRef.current;
        if (!engine) return;

        // Advance the game by 1 second
        const events = engine.tick(1);
        const state = engine.getState();
        const stats = engine.getStats();

        setMatchState(state);
        setMatchStats(stats);

        // Add new events to the list
        if (events.length > 0) {
          setMatchEvents((prev) => [...events, ...prev].slice(0, 100));
        }

        // Update match data in store
        updateMatch({
          currentMinute: Math.floor(state.minute),
          score: { home: state.homeScore, away: state.awayScore },
        });

        // Generate player tracking metrics using game engine
        players.forEach((player) => {
          const metrics = engine.generatePlayerMetrics(player, true);
          updateLiveData(player.id, metrics);
        });

        // Calculate coherence periodically
        if (activeGameModel && Math.floor(state.minute) % 5 === 0) {
          const playerDataMap = new Map<string, LivePlayerData>();
          players.forEach((player) => {
            const metrics = liveData.get(player.id);
            if (metrics) {
              playerDataMap.set(player.id, {
                playerId: player.id,
                currentMetrics: metrics,
                cumulativeMetrics: metrics,
                coherenceScore: 75 + Math.random() * 25,
                deviations: [],
                alerts: [],
              });
            }
          });

          const report = calculateCoherence(
            activeGameModel,
            matchData?.gameApproach || null,
            playerDataMap,
            twins,
            Math.floor(state.minute),
            state.currentPhase
          );
          updateCoherence(report);
        }

        // End match at 90+ minutes
        if (state.phase === 'full_time') {
          setIsSimulating(false);
          endMatch();
        }
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isLive, isSimulating, isPaused, players, activeGameModel, updateLiveData, updateMatch, updateCoherence, matchData, twins, liveData, endMatch]);

  const handleStartMatch = useCallback(() => {
    if (!activeGameModel) {
      // Create a default game model if none exists
      const defaultModel: GameModel = {
        id: 'default-model',
        name: 'Default Game Model',
        createdBy: 'System',
        createdAt: new Date(),
        updatedAt: new Date(),
        formation: {
          name: '4-3-3',
          shape: { positions: [], lines: [] },
          compactness: { vertical: { min: 25, max: 40, target: 30 }, horizontal: { min: 30, max: 50, target: 40 } },
          width: { inPossession: 55, outOfPossession: 40, transitions: 45 },
          depth: { defensiveLineHeight: 35, pressureLineHeight: 60, compactZoneDepth: 30 },
        },
        principles: {
          inPossession: [],
          outOfPossession: [],
          transitions: [],
          generalPrinciples: [],
        },
        phases: {
          buildUp: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
          progression: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
          finalThird: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
          pressing: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
          defensiveBlock: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
          attackingTransition: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
          defensiveTransition: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
        },
        pressureTriggers: [],
        transitionRules: [],
        setPlays: [],
        playerInstructions: new Map(),
        validatedBy: [],
        status: 'active',
      };
      createGameModel(defaultModel);
      setActiveGameModel('default-model');
    }

    // Initialize game engine for Manchester Derby
    gameEngineRef.current = createManchesterDerby();
    gameEngineRef.current.kickoff();
    setMatchEvents([]);
    setMatchState(gameEngineRef.current.getState());
    setMatchStats(gameEngineRef.current.getStats());

    startMatch({
      matchId: `derby-${Date.now()}`,
      gameApproach: {
        id: `approach-${Date.now()}`,
        matchId: `derby-${Date.now()}`,
        baseGameModel: activeGameModel?.id || 'default-model',
        opponent: {
          teamName: 'Manchester United',
          formation: '4-2-3-1',
          strengths: ['Counter-attack pace', 'Set pieces'],
          weaknesses: ['High defensive line vulnerable'],
          keyPlayers: [
            { name: 'Bruno Fernandes', threats: ['Playmaking', 'Set pieces', 'Long range shooting'] },
            { name: 'Marcus Rashford', threats: ['Pace', 'Direct running', 'Finishing'] },
            { name: 'Kobbie Mainoo', threats: ['Ball progression', 'Press resistance'] },
          ],
          patterns: ['Quick transitions', 'Wide overloads'],
        },
        adjustments: [],
        playerSpecificInstructions: new Map(),
        priorityFocus: ['Control possession', 'Press high', 'Exploit wide areas'],
        keyBattles: [
          { description: 'Aerial duels in the box', ourPlayer: 'Erling Haaland', theirPlayer: 'Matthijs de Ligt', strategy: 'Target with crosses and set pieces', successMetrics: ['Headers won', 'Goals from headers'] },
          { description: 'Midfield control', ourPlayer: 'Kevin De Bruyne', theirPlayer: 'Kobbie Mainoo', strategy: 'Dominate possession in central areas', successMetrics: ['Pass completion', 'Chances created'] },
          { description: 'Wide pace battle', ourPlayer: 'Kyle Walker', theirPlayer: 'Marcus Rashford', strategy: 'Prevent isolation, double up when needed', successMetrics: ['Tackles won', 'Dribbles prevented'] },
        ],
        createdAt: new Date(),
        validatedBy: [],
      },
    });
    setIsSimulating(true);
    setIsPaused(false);
  }, [activeGameModel, createGameModel, setActiveGameModel, startMatch]);

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

  const handleSaveGameModel = useCallback(
    (model: GameModel) => {
      const existing = gameModels.find((m) => m.id === model.id);
      if (existing) {
        // Update existing
        useGameStore.getState().updateGameModel(model.id, model);
      } else {
        createGameModel(model);
      }
      setActiveGameModel(model.id);
    },
    [gameModels, createGameModel, setActiveGameModel]
  );

  // Handle AI instruction processing with logging
  const handleInstructionsProcessed = useCallback(
    (input: ManagerInput) => {
      // Generate interpretation
      const interpretation = generateInterpretation(input, {
        gameModel: activeGameModel || undefined,
        matchMinute: isLive && matchState ? Math.floor(matchState.minute) : undefined,
      });

      // Create log entry
      const logEntry = logManager.createEntry(input, interpretation);

      // Add match context if live
      if (isLive && matchData) {
        logManager.setMatchContext(logEntry.id, {
          matchId: matchData.matchId,
          minute: matchState ? Math.floor(matchState.minute) : 0,
          score: matchData.score,
          phase: matchData.phase,
          possession: matchData.teamMetrics.possession,
          momentum: 'neutral',
          recentEvents: [],
        });
      }

      // Add to store
      addInstructionLog(logEntry);

      console.log('Instruction logged:', logEntry.id, logEntry.interpretation.summary);
    },
    [activeGameModel, isLive, matchState, matchData, logManager, addInstructionLog]
  );

  // Handle instructions applied
  const handleInstructionsApplied = useCallback(
    (instructions: ManagerInput['processedInstructions']) => {
      console.log('Instructions applied:', instructions.length);

      // Update the most recent log entry with application status
      if (instructionLogs.length > 0) {
        const latestLog = instructionLogs[0];
        useGameStore.getState().updateInstructionLog(latestLog.id, {
          applicationStatus: 'applied',
          appliedTo: instructions.map((inst) => ({
            type: inst.category === 'player_specific' ? 'player_instruction' : 'game_model',
            target: inst.affectedPlayers[0] || 'team',
            field: inst.category,
            previousValue: null,
            newValue: inst.instruction,
            timestamp: new Date(),
          })),
        });
      }
    },
    [instructionLogs]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Premier League 2025/26</h1>
                <p className="text-xs text-slate-500">Performance Analytics Platform</p>
              </div>
            </div>

            {/* Match Info */}
            <div className="flex items-center gap-6">
              {/* Match Badge */}
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-lg">
                <div className="text-right">
                  <div className="text-sm font-semibold text-sky-600">MCI</div>
                  <div className="text-xs text-slate-500">Home</div>
                </div>
                <div className="text-center px-3">
                  {matchState ? (
                    <div className="text-lg font-bold text-slate-900">
                      {matchState.homeScore} - {matchState.awayScore}
                    </div>
                  ) : (
                    <div className="text-lg font-bold text-slate-400">vs</div>
                  )}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-red-600">MUN</div>
                  <div className="text-xs text-slate-500">Away</div>
                </div>
              </div>

              {/* Match Status */}
              {isLive && matchState && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg border border-red-200">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">
                    {getMatchPhaseDisplay(matchState.phase)} {Math.floor(matchState.minute)}&apos;
                  </span>
                </div>
              )}

              {!isLive && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Matchday {MATCH_CONFIG.matchday}</span>
                </div>
              )}

              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="live">
              <Zap className="w-4 h-4 mr-2" />
              Live Match
            </TabsTrigger>
            <TabsTrigger value="game-model">
              <Target className="w-4 h-4 mr-2" />
              Game Model
            </TabsTrigger>
            <TabsTrigger value="players">
              <Users className="w-4 h-4 mr-2" />
              Players
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Brain className="w-4 h-4 mr-2" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="history">
              <FileText className="w-4 h-4 mr-2" />
              Instructions
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content Area */}
              <div className="lg:col-span-2 space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <QuickStatCard
                    title="Players"
                    value={players.length.toString()}
                    icon={<Users className="w-5 h-5" />}
                  />
                  <QuickStatCard
                    title="Game Models"
                    value={gameModels.length.toString()}
                    icon={<Target className="w-5 h-5" />}
                  />
                  <QuickStatCard
                    title="Active Model"
                    value={activeGameModel?.name || 'None'}
                    icon={<Activity className="w-5 h-5" />}
                    truncate
                  />
                  <QuickStatCard
                    title="Status"
                    value={isLive ? 'Live' : 'Idle'}
                    icon={<Zap className="w-5 h-5" />}
                    highlight={isLive}
                  />
                </div>

                {/* Pitch View */}
                <Card>
                  <CardHeader>
                    <CardTitle>Team Formation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PitchView
                      players={players}
                      liveData={liveData}
                      formation={activeGameModel?.formation.shape}
                      selectedPlayerId={selectedPlayerId}
                      onPlayerClick={setSelectedPlayer}
                    />
                  </CardContent>
                </Card>

                {/* Coherence Overview */}
                {coherenceReport && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Tactical Coherence</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="flex justify-center">
                          <CoherenceGauge
                            score={coherenceReport.overallScore}
                            size="lg"
                          />
                        </div>
                        <div className="space-y-3">
                          {Array.from(coherenceReport.byPhase.entries())
                            .slice(0, 4)
                            .map(([phase, score]) => (
                              <CoherenceBar key={phase} label={phase} score={score} />
                            ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Match Controls */}
                <Card>
                  <CardHeader>
                    <CardTitle>Match Control</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center pb-2 border-b border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">{MATCH_CONFIG.competition}</div>
                      <div className="text-sm font-medium text-slate-700">
                        {MATCH_CONFIG.homeTeam} vs {MATCH_CONFIG.awayTeam}
                      </div>
                      <div className="text-xs text-slate-400">{MATCH_CONFIG.venue}</div>
                    </div>

                    {!isLive ? (
                      <Button
                        className="w-full"
                        onClick={handleStartMatch}
                        variant="primary"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Match Simulation
                      </Button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={handlePauseMatch}
                          variant="outline"
                        >
                          {isPaused ? (
                            <><Play className="w-4 h-4 mr-1" /> Resume</>
                          ) : (
                            <><Pause className="w-4 h-4 mr-1" /> Pause</>
                          )}
                        </Button>
                        <Button
                          onClick={handleEndMatch}
                          variant="danger"
                        >
                          <Square className="w-4 h-4 mr-1" /> End
                        </Button>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setActiveTab('ai')}
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      Tactical Instructions
                    </Button>
                  </CardContent>
                </Card>

                {/* Match Stats */}
                {matchStats && isLive && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Match Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <StatRow label="Possession" home={`${matchStats.possession.home}%`} away={`${matchStats.possession.away}%`} />
                      <StatRow label="Shots" home={matchStats.shots.home} away={matchStats.shots.away} />
                      <StatRow label="On Target" home={matchStats.shotsOnTarget.home} away={matchStats.shotsOnTarget.away} />
                      <StatRow label="Corners" home={matchStats.corners.home} away={matchStats.corners.away} />
                      <StatRow label="Fouls" home={matchStats.fouls.home} away={matchStats.fouls.away} />
                      <StatRow label="xG" home={matchStats.xG.home.toFixed(2)} away={matchStats.xG.away.toFixed(2)} />
                    </CardContent>
                  </Card>
                )}

                {/* Match Events */}
                {matchEvents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Match Events</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {matchEvents.slice(0, 15).map((event) => (
                          <div
                            key={event.id}
                            className={`text-xs p-2 rounded ${
                              event.type === 'goal'
                                ? 'bg-green-50 border border-green-200'
                                : event.type === 'yellow_card'
                                ? 'bg-yellow-50 border border-yellow-200'
                                : event.type === 'red_card'
                                ? 'bg-red-50 border border-red-200'
                                : 'bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-500">{event.minute}&apos;</span>
                              <span className={`font-medium ${event.team === 'home' ? 'text-sky-700' : 'text-red-700'}`}>
                                {event.team === 'home' ? 'MCI' : 'MUN'}
                              </span>
                            </div>
                            <div className="text-slate-600 mt-0.5">{event.description}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Selected Player */}
                {selectedPlayerId && (
                  <PlayerStatsCard
                    player={players.find((p) => p.id === selectedPlayerId)!}
                    metrics={liveData.get(selectedPlayerId)}
                    twin={twins.get(selectedPlayerId)}
                    coherenceScore={coherenceReport?.byPlayer.get(selectedPlayerId)}
                  />
                )}

                {/* Recent Alerts */}
                {alerts.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Alerts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {alerts.slice(-3).reverse().map((alert, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded text-sm ${
                              alert.severity === 'high'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-yellow-50 text-yellow-700'
                            }`}
                          >
                            {alert.message}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Live Match Tab */}
          <TabsContent value="live">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <LiveMatchPanel
                  players={players}
                  gameModel={activeGameModel}
                  liveData={liveData}
                  coherenceReport={coherenceReport}
                  alerts={alerts}
                  deviations={deviations}
                  isLive={isLive}
                  matchMinute={matchState ? matchState.minute : 0}
                  onStartMatch={handleStartMatch}
                  onEndMatch={handleEndMatch}
                  selectedPlayerId={selectedPlayerId}
                  onPlayerSelect={setSelectedPlayer}
                />
              </div>
              <div>
                <PlayerList
                  players={players}
                  liveData={liveData}
                  twins={twins}
                  coherenceScores={coherenceReport?.byPlayer}
                  selectedPlayerId={selectedPlayerId}
                  onPlayerSelect={setSelectedPlayer}
                />
              </div>
            </div>
          </TabsContent>

          {/* Game Model Tab */}
          <TabsContent value="game-model">
            <GameModelEditor
              gameModel={activeGameModel}
              onSave={handleSaveGameModel}
            />
          </TabsContent>

          {/* Players Tab */}
          <TabsContent value="players">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((player) => (
                <PlayerStatsCard
                  key={player.id}
                  player={player}
                  metrics={liveData.get(player.id)}
                  twin={twins.get(player.id)}
                  coherenceScore={coherenceReport?.byPlayer.get(player.id)}
                  onClick={() => setSelectedPlayer(player.id)}
                />
              ))}
            </div>
          </TabsContent>

          {/* AI Assistant Tab */}
          <TabsContent value="ai">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIInput
                players={players}
                currentGameModel={activeGameModel || undefined}
                onInstructionsProcessed={handleInstructionsProcessed}
                onInstructionsApplied={handleInstructionsApplied}
              />
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Current Game Model Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeGameModel ? (
                      <div className="space-y-4">
                        <div>
                          <span className="text-sm text-gray-500">Formation</span>
                          <p className="font-medium">{activeGameModel.formation.name}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Defensive Line</span>
                          <p className="font-medium">{activeGameModel.formation.depth.defensiveLineHeight}m</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">In Possession Principles</span>
                          <ul className="list-disc list-inside text-sm">
                            {activeGameModel.principles.inPossession.map((p) => (
                              <li key={p.id}>{p.name}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Defensive Principles</span>
                          <ul className="list-disc list-inside text-sm">
                            {activeGameModel.principles.outOfPossession.map((p) => (
                              <li key={p.id}>{p.name} ({p.pressureType})</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">No game model selected. Create one to get started.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Instructions Preview */}
                {instructionLogs.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Recent Instructions</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('history')}
                        >
                          View All
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {instructionLogs.slice(0, 3).map((log) => (
                          <div
                            key={log.id}
                            className="p-2 bg-gray-50 rounded-lg text-sm"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium truncate">
                                {log.interpretation.summary}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 text-xs rounded-full ${
                                  log.applicationStatus === 'applied'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {log.applicationStatus}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(log.timestamp).toLocaleTimeString()} -{' '}
                              {log.processedInstructions.length} instruction(s)
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Instruction History Tab */}
          <TabsContent value="history">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <InstructionLogPanel
                  logs={instructionLogs}
                  onSelectLog={(log) => {
                    console.log('Selected log:', log.id);
                  }}
                />
              </div>
              <div className="space-y-6">
                {/* Stats Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Instruction Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Instructions</span>
                        <span className="font-medium">{instructionLogs.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Applied</span>
                        <span className="font-medium text-green-600">
                          {instructionLogs.filter((l) => l.applicationStatus === 'applied').length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Pending</span>
                        <span className="font-medium text-yellow-600">
                          {instructionLogs.filter((l) => l.applicationStatus === 'pending').length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Confidence</span>
                        <span className="font-medium">
                          {instructionLogs.length > 0
                            ? (
                                (instructionLogs.reduce((sum, l) => sum + l.confidence, 0) /
                                  instructionLogs.length) *
                                100
                              ).toFixed(1)
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>By Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(() => {
                        const categories = new Map<string, number>();
                        instructionLogs.forEach((log) => {
                          log.processedInstructions.forEach((inst) => {
                            categories.set(
                              inst.category,
                              (categories.get(inst.category) || 0) + 1
                            );
                          });
                        });
                        return Array.from(categories.entries()).map(([cat, count]) => (
                          <div
                            key={cat}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded"
                          >
                            <span className="text-sm capitalize">
                              {cat.replace('_', ' ')}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                              {count}
                            </span>
                          </div>
                        ));
                      })()}
                      {instructionLogs.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No instructions yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setActiveTab('ai')}
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      New Instruction
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        if (instructionLogs.length > 0) {
                          const exportData = JSON.stringify(
                            instructionLogs,
                            null,
                            2
                          );
                          const blob = new Blob([exportData], {
                            type: 'application/json',
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `instruction-logs-${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }
                      }}
                      disabled={instructionLogs.length === 0}
                    >
                      <History className="w-4 h-4 mr-2" />
                      Export Logs
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Helper Components

interface QuickStatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  truncate?: boolean;
  highlight?: boolean;
}

function QuickStatCard({ title, value, icon, truncate, highlight }: QuickStatCardProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className={`text-gray-400 ${highlight ? 'text-green-500' : ''}`}>{icon}</div>
        </div>
        <div className={`mt-2 text-2xl font-bold ${truncate ? 'truncate' : ''} ${highlight ? 'text-green-600' : 'text-gray-900'}`}>
          {value}
        </div>
        <div className="text-xs text-gray-500">{title}</div>
      </CardContent>
    </Card>
  );
}

// Stat Row Component for Match Statistics
interface StatRowProps {
  label: string;
  home: string | number;
  away: string | number;
}

function StatRow({ label, home, away }: StatRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-sky-600 font-medium w-16 text-right">{home}</span>
      <span className="text-slate-500 flex-1 text-center">{label}</span>
      <span className="text-red-600 font-medium w-16 text-left">{away}</span>
    </div>
  );
}
