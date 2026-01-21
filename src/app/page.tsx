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
import type { Player, TrackingMetrics } from '@/types';
import {
  Play,
  Pause,
  Square,
  ChevronDown,
  Zap,
} from 'lucide-react';

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
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [awayLiveData, setAwayLiveData] = useState<Map<string, TrackingMetrics>>(new Map());

  // Tactics State
  const [selectedPreset, setSelectedPreset] = useState<TacticalPreset | null>(
    () => getPresetById('guardiola_total_football') || null
  );
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

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
  }, [setPlayers, setTwin]);

  // Game Engine Simulation Loop
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

        if (state.phase === 'full_time') {
          setIsSimulating(false);
          endMatch();
        }
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isLive, isSimulating, isPaused, players, awayPlayers, updateLiveData, updateMatch, endMatch]);

  const handleStartMatch = useCallback(() => {
    gameEngineRef.current = createManchesterDerby();
    gameEngineRef.current.kickoff();
    setMatchEvents([]);
    setMatchState(gameEngineRef.current.getState());
    setMatchStats(gameEngineRef.current.getStats());

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

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Minimal Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Left: Match Info */}
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

          {/* Center: Tactical Preset Selector */}
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

          {/* Right: Match Controls */}
          <div className="flex items-center gap-2">
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

      {/* Main Content */}
      <main className="max-w-screen-2xl mx-auto">
        <div className="flex">
          {/* Left Sidebar - Compact Stats */}
          <aside className="w-48 border-r border-zinc-800 p-4 space-y-4">
            {/* Intensity */}
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Intensity</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Press</span>
                    <span>{selectedPreset?.intensityProfile.pressing || 0}</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all"
                      style={{ width: `${selectedPreset?.intensityProfile.pressing || 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Poss</span>
                    <span>{selectedPreset?.intensityProfile.possession || 0}</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${selectedPreset?.intensityProfile.possession || 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Tempo</span>
                    <span>{selectedPreset?.intensityProfile.tempo || 0}</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${selectedPreset?.intensityProfile.tempo || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Active Tactics */}
            {selectedPreset && (
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Tactics</div>
                <div className="space-y-1">
                  {selectedPreset.attackingTactics.slice(0, 4).map((t) => (
                    <div key={t} className="text-xs px-2 py-1 bg-emerald-950 text-emerald-400 rounded">
                      {t.replace(/_/g, ' ')}
                    </div>
                  ))}
                  {selectedPreset.defensiveTactics.slice(0, 2).map((t) => (
                    <div key={t} className="text-xs px-2 py-1 bg-red-950 text-red-400 rounded">
                      {t.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Block Type */}
            {matchState?.defensiveBlock && (
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Block</div>
                <div className={`text-sm font-medium px-2 py-1 rounded ${
                  matchState.defensiveBlock.type === 'high'
                    ? 'bg-emerald-950 text-emerald-400'
                    : matchState.defensiveBlock.type === 'mid'
                    ? 'bg-amber-950 text-amber-400'
                    : 'bg-red-950 text-red-400'
                }`}>
                  {matchState.defensiveBlock.type.toUpperCase()}
                </div>
              </div>
            )}
          </aside>

          {/* Center - Pitch */}
          <div className="flex-1 p-4">
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
              />
            </div>
          </div>

          {/* Right Sidebar - Stats & Events */}
          <aside className="w-56 border-l border-zinc-800 p-4 space-y-4">
            {/* Match Stats */}
            {matchStats && (
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Stats</div>
                <div className="space-y-2">
                  <StatBar label="Possession" home={matchStats.possession.home} away={matchStats.possession.away} />
                  <StatBar label="Shots" home={matchStats.shots.home} away={matchStats.shots.away} showRaw />
                  <StatBar label="On Target" home={matchStats.shotsOnTarget.home} away={matchStats.shotsOnTarget.away} showRaw />
                  <StatBar label="xG" home={parseFloat(matchStats.xG.home.toFixed(1))} away={parseFloat(matchStats.xG.away.toFixed(1))} showRaw />
                </div>
              </div>
            )}

            {/* Live Metrics */}
            {matchState && (
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Live</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-zinc-900 rounded p-2 text-center">
                    <div className="text-zinc-500">Phase</div>
                    <div className="font-medium text-xs mt-1">
                      {matchState.currentPhase.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                  </div>
                  <div className="bg-zinc-900 rounded p-2 text-center">
                    <div className="text-zinc-500">Intensity</div>
                    <div className="font-medium mt-1">
                      {(matchState.intensity * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Events Toggle */}
            <div>
              <button
                onClick={() => setShowEvents(!showEvents)}
                className="flex items-center justify-between w-full text-xs text-zinc-500 uppercase tracking-wide mb-2 hover:text-zinc-300 transition-colors"
              >
                <span>Events</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showEvents ? 'rotate-180' : ''}`} />
              </button>

              {showEvents && matchEvents.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {matchEvents.slice(0, 10).map((event) => (
                    <div
                      key={event.id}
                      className={`text-xs p-2 rounded ${
                        event.type === 'goal'
                          ? 'bg-emerald-950 text-emerald-400'
                          : event.type === 'yellow_card'
                          ? 'bg-amber-950 text-amber-400'
                          : event.type === 'red_card'
                          ? 'bg-red-950 text-red-400'
                          : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      <span className="text-zinc-500">{event.minute}&apos;</span>{' '}
                      <span className={event.team === 'home' ? 'text-sky-400' : 'text-red-400'}>
                        {event.team === 'home' ? 'MCI' : 'MUN'}
                      </span>{' '}
                      {event.type === 'goal' ? '⚽' : ''} {event.description?.slice(0, 30)}
                    </div>
                  ))}
                </div>
              )}

              {showEvents && matchEvents.length === 0 && (
                <div className="text-xs text-zinc-600 text-center py-4">No events yet</div>
              )}
            </div>
          </aside>
        </div>

        {/* Bottom Bar - Pressing Intensity */}
        {matchState && (
          <div className="border-t border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-zinc-400">Pressing</span>
              </div>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all"
                  style={{ width: `${matchState.pressingIntensity || 0}%` }}
                />
              </div>
              <span className="text-xs font-medium w-8 text-right">
                {matchState.pressingIntensity?.toFixed(0) || 0}%
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Minimal stat bar component
function StatBar({ label, home, away, showRaw = false }: { label: string; home: number; away: number; showRaw?: boolean }) {
  const total = home + away || 1;
  const homePercent = (home / total) * 100;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-sky-400">{showRaw ? home : `${home}%`}</span>
        <span className="text-zinc-500">{label}</span>
        <span className="text-red-400">{showRaw ? away : `${away}%`}</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden flex">
        <div className="h-full bg-sky-500" style={{ width: `${homePercent}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${100 - homePercent}%` }} />
      </div>
    </div>
  );
}
