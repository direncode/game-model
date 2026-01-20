// Live Data Service
// Handles real-time tracking data, match events, and player metrics

import type { Player, TrackingMetrics } from '@/types';
import { GameEngine, createManchesterDerby, type MatchState, type MatchStats, type MatchEvent } from './game-engine';

// ==================== Types ====================

export interface LiveTrackingData {
  playerId: string;
  timestamp: Date;
  metrics: TrackingMetrics;
  instantaneous: InstantaneousMetrics;
  cumulative: CumulativeMetrics;
  zones: ZoneMetrics;
  physicalLoad: PhysicalLoadMetrics;
}

export interface InstantaneousMetrics {
  speed: number;
  acceleration: number;
  heartRate: number;
  bodyLoad: number;
  metabolicPower: number;
  direction: number;
  position: { x: number; y: number };
}

export interface CumulativeMetrics {
  totalDistance: number;
  highSpeedDistance: number;
  sprintDistance: number;
  accelerationCount: number;
  decelerationCount: number;
  totalPlayerLoad: number;
  metabolicWork: number;
}

export interface ZoneMetrics {
  speedZones: {
    zone1Time: number;
    zone2Time: number;
    zone3Time: number;
    zone4Time: number;
    zone5Time: number;
    zone6Time: number;
  };
  heartRateZones: {
    zone1Time: number;
    zone2Time: number;
    zone3Time: number;
    zone4Time: number;
    zone5Time: number;
  };
  positionHeatmap: number[][];
}

export interface PhysicalLoadMetrics {
  acute: number;
  chronic: number;
  acwr: number;
  fatigueIndex: number;
  recoveryStatus: 'fresh' | 'moderate' | 'fatigued' | 'critical';
  injuryRisk: 'low' | 'moderate' | 'high' | 'very_high';
}

export interface PlayerAdvancedStats {
  playerId: string;
  playerName: string;
  position: string;
  matchStats: MatchPlayerStats;
  seasonStats: SeasonPlayerStats;
  physicalProfile: PhysicalProfileStats;
  tacticalProfile: TacticalProfileStats;
  comparisonToAverage: ComparisonStats;
}

export interface MatchPlayerStats {
  minutesPlayed: number;
  distanceCovered: number;
  sprints: number;
  maxSpeed: number;
  avgSpeed: number;
  passes: number;
  passAccuracy: number;
  touches: number;
  duelsWon: number;
  duelsLost: number;
  tackles: number;
  interceptions: number;
  aerialDuelsWon: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  assists: number;
  xG: number;
  xA: number;
}

export interface SeasonPlayerStats {
  appearances: number;
  starts: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  avgDistancePerMatch: number;
  avgSprintsPerMatch: number;
  avgMaxSpeed: number;
  totalDistance: number;
  avgRating: number;
  form: number[];
}

export interface PhysicalProfileStats {
  maxSpeedRecorded: number;
  avgMaxSpeedPerMatch: number;
  totalHighIntensityRuns: number;
  avgAccelerations: number;
  avgDecelerations: number;
  avgPlayerLoad: number;
  fitnessScore: number;
  enduranceIndex: number;
  explosiveIndex: number;
  recoveryRate: number;
}

export interface TacticalProfileStats {
  avgPositionX: number;
  avgPositionY: number;
  heatmapDensity: number[][];
  pressingIntensity: number;
  defensiveContribution: number;
  attackingContribution: number;
  spaceCreation: number;
  runningPatterns: string[];
}

export interface ComparisonStats {
  vsPositionAvg: {
    distance: number;
    sprints: number;
    speed: number;
    intensity: number;
  };
  vsTeamAvg: {
    distance: number;
    sprints: number;
    speed: number;
    intensity: number;
  };
  vsLeagueAvg: {
    distance: number;
    sprints: number;
    speed: number;
    intensity: number;
  };
  percentileRank: {
    distance: number;
    sprints: number;
    speed: number;
    intensity: number;
  };
}

export interface LiveMatchData {
  matchId: string;
  state: MatchState;
  stats: MatchStats;
  events: MatchEvent[];
  playerTracking: Map<string, LiveTrackingData>;
  teamMetrics: TeamLiveMetrics;
  lastUpdate: Date;
}

export interface TeamLiveMetrics {
  formation: string;
  possession: number;
  territorialAdvantage: number;
  pressingIntensity: number;
  compactness: { vertical: number; horizontal: number };
  teamSpeed: number;
  teamDistance: number;
  attackingThird: number;
  defendingThird: number;
}

// ==================== Live Data Service Class ====================

class LiveDataService {
  private gameEngine: GameEngine | null = null;
  private playerTracking: Map<string, LiveTrackingData> = new Map();
  private matchData: LiveMatchData | null = null;
  private subscribers: Set<(data: LiveMatchData) => void> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.gameEngine = createManchesterDerby();
  }

  // Start live data feed
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.gameEngine = createManchesterDerby();
    this.gameEngine.kickoff();

    this.updateInterval = setInterval(() => {
      this.tick();
    }, 100);
  }

  // Stop live data feed
  public stop(): void {
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Pause/Resume
  public pause(): void {
    this.isRunning = false;
  }

  public resume(): void {
    this.isRunning = true;
  }

  // Subscribe to live updates
  public subscribe(callback: (data: LiveMatchData) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Get current match data
  public getMatchData(): LiveMatchData | null {
    return this.matchData;
  }

  // Get player tracking data
  public getPlayerTracking(playerId: string): LiveTrackingData | null {
    return this.playerTracking.get(playerId) || null;
  }

  // Get all player tracking
  public getAllPlayerTracking(): Map<string, LiveTrackingData> {
    return new Map(this.playerTracking);
  }

  // Internal tick function
  private tick(): void {
    if (!this.isRunning || !this.gameEngine) return;

    const events = this.gameEngine.tick(1);
    const state = this.gameEngine.getState();
    const stats = this.gameEngine.getStats();

    // Update match data
    this.matchData = {
      matchId: `derby-${Date.now()}`,
      state,
      stats,
      events: [...(this.matchData?.events || []), ...events].slice(-100),
      playerTracking: this.playerTracking,
      teamMetrics: this.generateTeamMetrics(state, stats),
      lastUpdate: new Date(),
    };

    // Notify subscribers
    this.subscribers.forEach((callback) => {
      if (this.matchData) callback(this.matchData);
    });

    // Check for match end
    if (state.phase === 'full_time') {
      this.stop();
    }
  }

  // Generate live tracking data for a player
  public generatePlayerTracking(player: Player, minute: number): LiveTrackingData {
    const baseMetrics = this.gameEngine?.generatePlayerMetrics(player, true);

    if (!baseMetrics) {
      throw new Error('Game engine not initialized');
    }

    const tracking: LiveTrackingData = {
      playerId: player.id,
      timestamp: new Date(),
      metrics: baseMetrics,
      instantaneous: {
        speed: baseMetrics.currentSpeed,
        acceleration: baseMetrics.maxAcceleration * (0.3 + Math.random() * 0.7),
        heartRate: this.calculateHeartRate(player, baseMetrics),
        bodyLoad: baseMetrics.playerLoadPerMinute,
        metabolicPower: baseMetrics.metabolicPower,
        direction: Math.random() * 360,
        position: { x: baseMetrics.position.x, y: baseMetrics.position.y },
      },
      cumulative: {
        totalDistance: baseMetrics.totalDistance,
        highSpeedDistance: baseMetrics.highSpeedRunningDistance,
        sprintDistance: baseMetrics.sprintDistance,
        accelerationCount: baseMetrics.accelerations.total,
        decelerationCount: baseMetrics.decelerations.total,
        totalPlayerLoad: baseMetrics.playerLoad,
        metabolicWork: baseMetrics.highMetabolicLoadDistance,
      },
      zones: {
        speedZones: {
          zone1Time: baseMetrics.speedZones.zone1,
          zone2Time: baseMetrics.speedZones.zone2,
          zone3Time: baseMetrics.speedZones.zone3,
          zone4Time: baseMetrics.speedZones.zone4,
          zone5Time: baseMetrics.speedZones.zone5,
          zone6Time: baseMetrics.speedZones.zone6,
        },
        heartRateZones: this.calculateHeartRateZones(minute),
        positionHeatmap: this.generateHeatmap(player.position, minute),
      },
      physicalLoad: this.calculatePhysicalLoad(player, minute, baseMetrics),
    };

    this.playerTracking.set(player.id, tracking);
    return tracking;
  }

  // Calculate heart rate based on activity
  private calculateHeartRate(player: Player, metrics: TrackingMetrics): number {
    const baseHR = 60 + Math.random() * 10;
    const activityFactor = metrics.currentSpeed / player.physicalProfile.maxSpeed;
    const maxHR = 180 + Math.random() * 20;
    return Math.round(baseHR + (maxHR - baseHR) * activityFactor);
  }

  // Calculate heart rate zones
  private calculateHeartRateZones(minute: number): ZoneMetrics['heartRateZones'] {
    return {
      zone1Time: minute * 8,
      zone2Time: minute * 15,
      zone3Time: minute * 20,
      zone4Time: minute * 12,
      zone5Time: minute * 5,
    };
  }

  // Generate position heatmap
  private generateHeatmap(position: string, minute: number): number[][] {
    const heatmap: number[][] = [];
    for (let i = 0; i < 14; i++) {
      heatmap[i] = [];
      for (let j = 0; j < 21; j++) {
        // Position-based weight
        const posWeight = this.getPositionWeight(position, i, j);
        heatmap[i][j] = Math.round(posWeight * minute * (0.5 + Math.random() * 0.5));
      }
    }
    return heatmap;
  }

  // Get position weight for heatmap
  private getPositionWeight(position: string, row: number, col: number): number {
    const positionCenters: Record<string, { row: number; col: number }> = {
      GK: { row: 7, col: 1 },
      CB: { row: 7, col: 4 },
      LB: { row: 2, col: 5 },
      RB: { row: 12, col: 5 },
      CDM: { row: 7, col: 7 },
      CM: { row: 7, col: 10 },
      CAM: { row: 7, col: 13 },
      LM: { row: 2, col: 10 },
      RM: { row: 12, col: 10 },
      LW: { row: 2, col: 16 },
      RW: { row: 12, col: 16 },
      CF: { row: 7, col: 17 },
      ST: { row: 7, col: 19 },
    };

    const center = positionCenters[position] || { row: 7, col: 10 };
    const distance = Math.sqrt(Math.pow(row - center.row, 2) + Math.pow(col - center.col, 2));
    return Math.max(0, 1 - distance / 10);
  }

  // Calculate physical load metrics
  private calculatePhysicalLoad(
    player: Player,
    minute: number,
    metrics: TrackingMetrics
  ): PhysicalLoadMetrics {
    const acute = metrics.playerLoad;
    const chronic = acute * 0.8;
    const acwr = chronic > 0 ? acute / chronic : 1;
    const fatigueIndex = Math.min(100, (minute / 90) * 100 * (0.8 + Math.random() * 0.4));

    let recoveryStatus: PhysicalLoadMetrics['recoveryStatus'] = 'fresh';
    if (fatigueIndex > 80) recoveryStatus = 'critical';
    else if (fatigueIndex > 60) recoveryStatus = 'fatigued';
    else if (fatigueIndex > 40) recoveryStatus = 'moderate';

    let injuryRisk: PhysicalLoadMetrics['injuryRisk'] = 'low';
    if (acwr > 1.5) injuryRisk = 'very_high';
    else if (acwr > 1.3) injuryRisk = 'high';
    else if (acwr > 1.1) injuryRisk = 'moderate';

    return {
      acute,
      chronic,
      acwr,
      fatigueIndex,
      recoveryStatus,
      injuryRisk,
    };
  }

  // Generate team metrics
  private generateTeamMetrics(state: MatchState, stats: MatchStats): TeamLiveMetrics {
    return {
      formation: '4-3-3',
      possession: state.possession.home,
      territorialAdvantage: 50 + (state.possession.home - 50) * 0.8,
      pressingIntensity: 65 + Math.random() * 20,
      compactness: {
        vertical: 30 + Math.random() * 10,
        horizontal: 40 + Math.random() * 10,
      },
      teamSpeed: 5 + Math.random() * 3,
      teamDistance: state.minute * 1100,
      attackingThird: 25 + Math.random() * 15,
      defendingThird: 20 + Math.random() * 10,
    };
  }

  // Get player advanced stats
  public getPlayerAdvancedStats(player: Player, minute: number): PlayerAdvancedStats {
    const tracking = this.playerTracking.get(player.id);
    const metrics = tracking?.metrics;

    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      matchStats: {
        minutesPlayed: Math.floor(minute),
        distanceCovered: metrics?.totalDistance || minute * 110,
        sprints: Math.floor(minute * 0.3),
        maxSpeed: metrics?.maxSpeed || player.physicalProfile.maxSpeed * 0.95,
        avgSpeed: metrics?.averageSpeed || 7.2,
        passes: Math.floor(minute * 0.6),
        passAccuracy: 82 + Math.random() * 12,
        touches: Math.floor(minute * 0.8),
        duelsWon: Math.floor(minute * 0.12),
        duelsLost: Math.floor(minute * 0.08),
        tackles: Math.floor(minute * 0.05),
        interceptions: Math.floor(minute * 0.04),
        aerialDuelsWon: Math.floor(minute * 0.02),
        shots: Math.floor(minute * 0.02),
        shotsOnTarget: Math.floor(minute * 0.01),
        goals: 0,
        assists: 0,
        xG: minute * 0.005 + Math.random() * 0.1,
        xA: minute * 0.003 + Math.random() * 0.05,
      },
      seasonStats: {
        appearances: 18,
        starts: 15,
        minutesPlayed: 1350,
        goals: player.position === 'ST' ? 12 : player.position === 'LW' || player.position === 'RW' ? 6 : 2,
        assists: player.position === 'CM' || player.position === 'CAM' ? 8 : 3,
        avgDistancePerMatch: 10500 + Math.random() * 1500,
        avgSprintsPerMatch: 28 + Math.random() * 10,
        avgMaxSpeed: player.physicalProfile.maxSpeed * 0.92,
        totalDistance: 157500 + Math.random() * 20000,
        avgRating: 6.8 + Math.random() * 1.2,
        form: [7.2, 6.8, 7.5, 7.1, 6.9],
      },
      physicalProfile: {
        maxSpeedRecorded: player.physicalProfile.maxSpeed,
        avgMaxSpeedPerMatch: player.physicalProfile.maxSpeed * 0.9,
        totalHighIntensityRuns: 450 + Math.floor(Math.random() * 100),
        avgAccelerations: 45 + Math.random() * 15,
        avgDecelerations: 42 + Math.random() * 15,
        avgPlayerLoad: 450 + Math.random() * 100,
        fitnessScore: 78 + Math.random() * 18,
        enduranceIndex: 75 + Math.random() * 20,
        explosiveIndex: 70 + Math.random() * 25,
        recoveryRate: 80 + Math.random() * 15,
      },
      tacticalProfile: {
        avgPositionX: this.getAvgPositionX(player.position),
        avgPositionY: this.getAvgPositionY(player.position),
        heatmapDensity: tracking?.zones.positionHeatmap || [],
        pressingIntensity: 65 + Math.random() * 25,
        defensiveContribution: player.position.includes('B') || player.position.includes('DM') ? 75 : 45,
        attackingContribution: player.position.includes('W') || player.position === 'ST' ? 80 : 55,
        spaceCreation: 60 + Math.random() * 30,
        runningPatterns: this.getRunningPatterns(player.position),
      },
      comparisonToAverage: {
        vsPositionAvg: {
          distance: 5 + Math.random() * 10 - 5,
          sprints: 8 + Math.random() * 16 - 8,
          speed: 3 + Math.random() * 6 - 3,
          intensity: 4 + Math.random() * 8 - 4,
        },
        vsTeamAvg: {
          distance: 3 + Math.random() * 6 - 3,
          sprints: 5 + Math.random() * 10 - 5,
          speed: 2 + Math.random() * 4 - 2,
          intensity: 3 + Math.random() * 6 - 3,
        },
        vsLeagueAvg: {
          distance: 8 + Math.random() * 16 - 8,
          sprints: 10 + Math.random() * 20 - 10,
          speed: 5 + Math.random() * 10 - 5,
          intensity: 6 + Math.random() * 12 - 6,
        },
        percentileRank: {
          distance: 60 + Math.random() * 35,
          sprints: 55 + Math.random() * 40,
          speed: 50 + Math.random() * 45,
          intensity: 58 + Math.random() * 37,
        },
      },
    };
  }

  private getAvgPositionX(position: string): number {
    const positions: Record<string, number> = {
      GK: -40, CB: -25, LB: -15, RB: -15, CDM: -5, CM: 5, CAM: 15,
      LM: 10, RM: 10, LW: 25, RW: 25, CF: 30, ST: 35,
    };
    return positions[position] || 0;
  }

  private getAvgPositionY(position: string): number {
    const positions: Record<string, number> = {
      GK: 0, CB: 0, LB: -20, RB: 20, CDM: 0, CM: 0, CAM: 0,
      LM: -25, RM: 25, LW: -25, RW: 25, CF: 0, ST: 0,
    };
    return positions[position] || 0;
  }

  private getRunningPatterns(position: string): string[] {
    const patterns: Record<string, string[]> = {
      GK: ['Distribution sweeper', 'Box command'],
      CB: ['Step up', 'Cover', 'Distribute wide'],
      LB: ['Overlap', 'Underlap', 'Inverted run'],
      RB: ['Overlap', 'Underlap', 'Inverted run'],
      CDM: ['Shield', 'Press trigger', 'Recycle'],
      CM: ['Box-to-box', 'Half-space', 'Progressive carry'],
      CAM: ['Between lines', 'Third man', 'Late run'],
      LW: ['Inside cut', 'Wide stretch', 'Behind'],
      RW: ['Inside cut', 'Wide stretch', 'Behind'],
      ST: ['Channel run', 'Drop deep', 'Press trigger'],
      CF: ['Link play', 'Run in behind', 'Hold up'],
    };
    return patterns[position] || ['General movement'];
  }
}

// Singleton instance
let serviceInstance: LiveDataService | null = null;

export function getLiveDataService(): LiveDataService {
  if (!serviceInstance) {
    serviceInstance = new LiveDataService();
  }
  return serviceInstance;
}

export function resetLiveDataService(): void {
  if (serviceInstance) {
    serviceInstance.stop();
    serviceInstance = null;
  }
}
