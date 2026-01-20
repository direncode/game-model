'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { createDigitalTwin } from '@/lib/digital-twin';
import { calculateCoherence } from '@/lib/coherence-analysis';
import type { Player, GameModel, TrackingMetrics, LivePlayerData } from '@/types';
import {
  LayoutDashboard,
  Users,
  Target,
  Zap,
  Brain,
  Settings,
  Plus,
  Play,
  Activity,
} from 'lucide-react';

// Sample data for demonstration
const samplePlayers: Player[] = [
  { id: 'p1', name: 'Martinez', number: 1, position: 'GK', preferredFoot: 'right', physicalProfile: { maxSpeed: 28, accelerationPeak: 3.5, sprintCapacity: 200, highIntensityThreshold: 19, aerobicThreshold: 150, anaerobicThreshold: 175 }, currentStatus: 'available' },
  { id: 'p2', name: 'Walker', number: 2, position: 'RB', preferredFoot: 'right', physicalProfile: { maxSpeed: 34, accelerationPeak: 4.2, sprintCapacity: 400, highIntensityThreshold: 20, aerobicThreshold: 155, anaerobicThreshold: 180 }, currentStatus: 'available' },
  { id: 'p3', name: 'Dias', number: 3, position: 'CB', preferredFoot: 'right', physicalProfile: { maxSpeed: 30, accelerationPeak: 3.8, sprintCapacity: 300, highIntensityThreshold: 19, aerobicThreshold: 150, anaerobicThreshold: 175 }, currentStatus: 'available' },
  { id: 'p4', name: 'Stones', number: 5, position: 'CB', preferredFoot: 'right', physicalProfile: { maxSpeed: 31, accelerationPeak: 3.9, sprintCapacity: 320, highIntensityThreshold: 19, aerobicThreshold: 152, anaerobicThreshold: 177 }, currentStatus: 'available' },
  { id: 'p5', name: 'Gvardiol', number: 24, position: 'LB', preferredFoot: 'left', physicalProfile: { maxSpeed: 32, accelerationPeak: 4.0, sprintCapacity: 380, highIntensityThreshold: 20, aerobicThreshold: 155, anaerobicThreshold: 180 }, currentStatus: 'available' },
  { id: 'p6', name: 'Rodri', number: 16, position: 'CDM', preferredFoot: 'right', physicalProfile: { maxSpeed: 29, accelerationPeak: 3.6, sprintCapacity: 280, highIntensityThreshold: 18, aerobicThreshold: 148, anaerobicThreshold: 173 }, currentStatus: 'available' },
  { id: 'p7', name: 'De Bruyne', number: 17, position: 'CM', preferredFoot: 'right', physicalProfile: { maxSpeed: 31, accelerationPeak: 4.0, sprintCapacity: 350, highIntensityThreshold: 19, aerobicThreshold: 152, anaerobicThreshold: 177 }, currentStatus: 'available' },
  { id: 'p8', name: 'Silva', number: 20, position: 'CM', preferredFoot: 'right', physicalProfile: { maxSpeed: 29, accelerationPeak: 3.7, sprintCapacity: 300, highIntensityThreshold: 18, aerobicThreshold: 150, anaerobicThreshold: 175 }, currentStatus: 'available' },
  { id: 'p9', name: 'Foden', number: 47, position: 'LW', preferredFoot: 'left', physicalProfile: { maxSpeed: 33, accelerationPeak: 4.3, sprintCapacity: 420, highIntensityThreshold: 21, aerobicThreshold: 158, anaerobicThreshold: 183 }, currentStatus: 'available' },
  { id: 'p10', name: 'Haaland', number: 9, position: 'ST', preferredFoot: 'left', physicalProfile: { maxSpeed: 35, accelerationPeak: 4.5, sprintCapacity: 450, highIntensityThreshold: 22, aerobicThreshold: 160, anaerobicThreshold: 185 }, currentStatus: 'available' },
  { id: 'p11', name: 'Doku', number: 11, position: 'RW', preferredFoot: 'right', physicalProfile: { maxSpeed: 34, accelerationPeak: 4.4, sprintCapacity: 440, highIntensityThreshold: 21, aerobicThreshold: 158, anaerobicThreshold: 183 }, currentStatus: 'available' },
];

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
  } = useGameStore();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [matchMinute, setMatchMinute] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  // Initialize with sample data
  useEffect(() => {
    if (players.length === 0) {
      setPlayers(samplePlayers);

      // Create digital twins for each player
      samplePlayers.forEach((player) => {
        const twin = createDigitalTwin(player, []);
        setTwin(player.id, twin);
      });
    }
  }, [players.length, setPlayers, setTwin]);

  // Simulation loop for live match
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isLive && isSimulating) {
      interval = setInterval(() => {
        setMatchMinute((prev) => {
          const newMinute = prev + 0.1;
          updateMatch({ currentMinute: Math.floor(newMinute) });

          // Simulate live data for each player
          players.forEach((player) => {
            const simulatedMetrics = generateSimulatedMetrics(player, newMinute);
            updateLiveData(player.id, simulatedMetrics);
          });

          // Calculate coherence
          if (activeGameModel && newMinute % 1 < 0.1) {
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
              Math.floor(newMinute),
              'buildUp'
            );
            updateCoherence(report);
          }

          if (newMinute >= 90) {
            setIsSimulating(false);
            endMatch();
          }

          return newMinute;
        });
      }, 100); // Speed up simulation (100ms = 0.1 match minute)
    }

    return () => clearInterval(interval);
  }, [isLive, isSimulating, players, activeGameModel, updateLiveData, updateMatch, updateCoherence, matchData, twins, liveData, endMatch]);

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

    startMatch({
      matchId: `match-${Date.now()}`,
      gameApproach: {
        id: `approach-${Date.now()}`,
        matchId: `match-${Date.now()}`,
        baseGameModel: activeGameModel?.id || 'default-model',
        opponent: {
          teamName: 'Opposition',
          formation: '4-4-2',
          strengths: [],
          weaknesses: [],
          keyPlayers: [],
          patterns: [],
        },
        adjustments: [],
        playerSpecificInstructions: new Map(),
        priorityFocus: [],
        keyBattles: [],
        createdAt: new Date(),
        validatedBy: [],
      },
    });
    setMatchMinute(0);
    setIsSimulating(true);
  }, [activeGameModel, createGameModel, setActiveGameModel, startMatch]);

  const handleEndMatch = useCallback(() => {
    setIsSimulating(false);
    endMatch();
    setMatchMinute(0);
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Football Analytics</h1>
                <p className="text-xs text-gray-500">GPS/Wearable + Tactical Intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isLive && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">LIVE - {Math.floor(matchMinute)}&apos;</span>
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
                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={isLive ? handleEndMatch : handleStartMatch}
                      variant={isLive ? 'danger' : 'primary'}
                    >
                      {isLive ? (
                        <>Stop Match</>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Live Session
                        </>
                      )}
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setActiveTab('game-model')}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Game Model
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setActiveTab('ai')}
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      AI Instructions
                    </Button>
                  </CardContent>
                </Card>

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
                  matchMinute={matchMinute}
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
                onInstructionsProcessed={(input) => {
                  console.log('Processed:', input);
                }}
                onInstructionsApplied={(instructions) => {
                  console.log('Applied:', instructions);
                }}
              />
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

// Simulation helper
function generateSimulatedMetrics(player: Player, minute: number): TrackingMetrics {
  const baseDistance = minute * 110; // ~100m per minute average
  const variation = Math.random() * 20 - 10;

  return {
    totalDistance: baseDistance + variation * minute,
    distancePerMinute: 100 + variation,
    highSpeedRunningDistance: baseDistance * 0.08 + Math.random() * 50,
    sprintDistance: baseDistance * 0.03 + Math.random() * 20,
    walkingDistance: baseDistance * 0.2,
    joggingDistance: baseDistance * 0.4,
    runningDistance: baseDistance * 0.3,
    currentSpeed: Math.random() * 15 + (Math.random() > 0.9 ? 15 : 0),
    averageSpeed: 7 + Math.random() * 2,
    maxSpeed: player.physicalProfile.maxSpeed * (0.9 + Math.random() * 0.1),
    speedZones: {
      zone1: minute * 15,
      zone2: minute * 20,
      zone3: minute * 15,
      zone4: minute * 8,
      zone5: minute * 3,
      zone6: minute * 1,
    },
    accelerations: {
      low: Math.floor(minute * 0.5),
      medium: Math.floor(minute * 0.3),
      high: Math.floor(minute * 0.15),
      total: Math.floor(minute * 0.95),
    },
    decelerations: {
      low: Math.floor(minute * 0.5),
      medium: Math.floor(minute * 0.3),
      high: Math.floor(minute * 0.15),
      total: Math.floor(minute * 0.95),
    },
    maxAcceleration: 3 + Math.random(),
    maxDeceleration: -(3 + Math.random()),
    playerLoad: minute * 5 + Math.random() * 20,
    playerLoadPerMinute: 5 + Math.random() * 2,
    metabolicPower: 10 + Math.random() * 5,
    highMetabolicLoadDistance: baseDistance * 0.11,
    position: {
      x: (Math.random() - 0.5) * 80,
      y: (Math.random() - 0.5) * 50,
      zone: ['defensive_third', 'middle_third', 'attacking_third'][Math.floor(Math.random() * 3)] as 'defensive_third' | 'middle_third' | 'attacking_third',
      heatmap: { cells: [], resolution: { x: 21, y: 14 } },
    },
  };
}
