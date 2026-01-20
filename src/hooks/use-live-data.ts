// Live Data Hook
// React hook for real-time match data polling

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MatchState, MatchStats, MatchEvent } from '@/lib/game-engine';
import type { LiveTrackingData, PlayerAdvancedStats } from '@/lib/live-data-service';

// ==================== Types ====================

export interface LiveMatchResponse {
  matchId: string;
  state: MatchState;
  stats: MatchStats;
  events: MatchEvent[];
  teamMetrics: {
    formation: string;
    possession: number;
    territorialAdvantage: number;
    pressingIntensity: number;
    compactness: { vertical: number; horizontal: number };
    teamSpeed: number;
    teamDistance: number;
    attackingThird: number;
    defendingThird: number;
  };
  lastUpdate: string;
  playerTracking: Record<string, LiveTrackingData>;
}

export interface PlayerTrackingResponse {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  timestamp: string;
  minutesPlayed: number;
  current: {
    speed: number;
    acceleration: number;
    heartRate: number;
    metabolicPower: number;
    bodyLoad: number;
    position: { x: number; y: number };
    direction: number;
  };
  totals: {
    distance: number;
    highSpeedDistance: number;
    sprintDistance: number;
    accelerations: number;
    decelerations: number;
    playerLoad: number;
    metabolicWork: number;
  };
  speedZones: Record<string, { time: number; percentage: number }>;
  physicalLoad: {
    acute: number;
    chronic: number;
    acuteChronicRatio: number;
    fatigueIndex: number;
    recoveryStatus: string;
    injuryRisk: string;
  };
  derived: {
    distancePerMinute: number;
    highIntensityPercentage: number;
    workRate: number;
    speedEfficiency: number;
    fatigueProjection: {
      minute75: number;
      minute90: number;
      recommendation: string;
    };
    optimalSubstitutionMinute: number;
  };
  benchmarks: {
    maxSpeed: number;
    maxSpeedCapability: number;
    maxSpeedUtilization: number;
    maxAcceleration: number;
    maxDeceleration: number;
  };
}

export interface MatchStatsResponse {
  matchId: string;
  phase: string;
  minute: number;
  score: { home: number; away: number };
  matchStats: MatchStats;
  tracking: {
    home: TeamTrackingStats;
    away: TeamTrackingStats;
  };
  gameState: {
    momentum: string;
    intensity: number;
    territorialAdvantage: number;
    compactness: { vertical: number; horizontal: number };
  };
  comparison: Record<string, { home: number; away: number; advantage: string; difference: number }>;
}

export interface TeamTrackingStats {
  team: string;
  tla: string;
  totalDistance: number;
  avgDistancePerPlayer: number;
  totalHighSpeedDistance: number;
  totalSprintDistance: number;
  totalSprints: number;
  maxSpeedReached: number;
  totalPlayerLoad: number;
  avgPlayerLoad: number;
  avgHeartRate: number;
  playersTracked: number;
  intensity: number;
}

// ==================== Hooks ====================

// Hook for live match data with polling
export function useLiveMatch(pollingInterval: number = 500) {
  const [data, setData] = useState<LiveMatchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/match/live');
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setIsConnected(true);
        setError(null);
      } else {
        setData(null);
        setIsConnected(false);
      }
    } catch (err) {
      setError('Failed to fetch live data');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startMatch = useCallback(async () => {
    try {
      const response = await fetch('/api/match/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const result = await response.json();
      if (result.success) {
        await fetchData();
      }
      return result.success;
    } catch (err) {
      setError('Failed to start match');
      return false;
    }
  }, [fetchData]);

  const stopMatch = useCallback(async () => {
    try {
      const response = await fetch('/api/match/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const result = await response.json();
      return result.success;
    } catch (err) {
      setError('Failed to stop match');
      return false;
    }
  }, []);

  const pauseMatch = useCallback(async () => {
    try {
      const response = await fetch('/api/match/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      });
      const result = await response.json();
      return result.success;
    } catch (err) {
      setError('Failed to pause match');
      return false;
    }
  }, []);

  const resumeMatch = useCallback(async () => {
    try {
      const response = await fetch('/api/match/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      const result = await response.json();
      return result.success;
    } catch (err) {
      setError('Failed to resume match');
      return false;
    }
  }, []);

  // Start polling
  useEffect(() => {
    fetchData();

    intervalRef.current = setInterval(fetchData, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, pollingInterval]);

  return {
    data,
    isLoading,
    error,
    isConnected,
    startMatch,
    stopMatch,
    pauseMatch,
    resumeMatch,
    refetch: fetchData,
  };
}

// Hook for individual player tracking
export function usePlayerTracking(playerId: string | null, pollingInterval: number = 1000) {
  const [data, setData] = useState<PlayerTrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!playerId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/players/${playerId}/tracking`);
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setData(null);
      }
    } catch (err) {
      setError('Failed to fetch player tracking');
    } finally {
      setIsLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, pollingInterval);

    return () => clearInterval(interval);
  }, [fetchData, pollingInterval]);

  return { data, isLoading, error, refetch: fetchData };
}

// Hook for player advanced stats
export function usePlayerStats(playerId: string | null) {
  const [data, setData] = useState<{ player: unknown; advancedStats: PlayerAdvancedStats; liveTracking: unknown } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!playerId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/players/${playerId}/stats`);
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch player stats');
    } finally {
      setIsLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

// Hook for match statistics with team tracking
export function useMatchStats(pollingInterval: number = 2000) {
  const [data, setData] = useState<MatchStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/match/stats');
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch match stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, pollingInterval);

    return () => clearInterval(interval);
  }, [fetchData, pollingInterval]);

  return { data, isLoading, error, refetch: fetchData };
}

// Hook for match events
export function useMatchEvents(
  options: { limit?: number; type?: string; team?: string; player?: string } = {}
) {
  const [data, setData] = useState<{ events: MatchEvent[]; summary: Record<string, number>; keyEvents: unknown[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', options.limit.toString());
      if (options.type) params.set('type', options.type);
      if (options.team) params.set('team', options.team);
      if (options.player) params.set('player', options.player);

      const response = await fetch(`/api/match/events?${params.toString()}`);
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch match events');
    } finally {
      setIsLoading(false);
    }
  }, [options.limit, options.type, options.team, options.player]);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 2000);

    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

// Hook for all players list with tracking
export function usePlayers(team: string = 'MCI', includeTracking: boolean = false) {
  const [data, setData] = useState<{ players: unknown[]; isLive: boolean; currentMinute: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ team });
      if (includeTracking) params.set('tracking', 'true');

      const response = await fetch(`/api/players?${params.toString()}`);
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch players');
    } finally {
      setIsLoading(false);
    }
  }, [team, includeTracking]);

  useEffect(() => {
    fetchData();

    if (includeTracking) {
      const interval = setInterval(fetchData, 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, includeTracking]);

  return { data, isLoading, error, refetch: fetchData };
}
