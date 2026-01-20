// Player History System
// Tracks career data, match history, tracking metrics over time, and integrates with digital twin

import type {
  Player,
  TrackingMetrics,
  DigitalTwin,
  PhysicalProfile,
} from '@/types';
import { generateMatchTrackingHistory } from './premier-league-api';

// ==================== Types ====================

export interface PlayerHistory {
  playerId: string;
  playerName: string;
  currentTeam: string;

  // Career summary
  careerStats: CareerStats;

  // Season-by-season data
  seasons: SeasonHistory[];

  // Match-by-match tracking data
  matchHistory: MatchTrackingRecord[];

  // Physical evolution
  physicalEvolution: PhysicalEvolutionRecord[];

  // Tactical profile
  tacticalProfile: TacticalProfile;

  // Performance trends
  trends: PerformanceTrends;

  // Metadata
  lastUpdated: Date;
}

export interface CareerStats {
  totalAppearances: number;
  totalMinutes: number;
  totalGoals: number;
  totalAssists: number;
  totalCleanSheets?: number;
  averageRating?: number;
  trophies: Trophy[];
  individualAwards: Award[];
}

export interface Trophy {
  name: string;
  season: string;
  team: string;
}

export interface Award {
  name: string;
  season: string;
  category: string;
}

export interface SeasonHistory {
  season: string;
  team: string;
  league: string;
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  avgRating?: number;

  // Aggregated tracking data
  trackingSummary: SeasonTrackingSummary;
}

export interface SeasonTrackingSummary {
  totalDistance: number;
  avgDistancePerMatch: number;
  totalSprints: number;
  avgSprintsPerMatch: number;
  maxSpeedReached: number;
  avgMaxSpeed: number;
  totalHighIntensityRuns: number;
  avgPlayerLoad: number;
  avgMetabolicPower: number;
}

export interface MatchTrackingRecord {
  matchId: string;
  date: Date;
  opponent: string;
  competition: string;
  result: string;
  minutesPlayed: number;
  position: string;
  rating?: number;

  // Full tracking metrics
  metrics: TrackingMetrics;

  // Key events
  events: MatchEvent[];

  // Tactical compliance (if game model was active)
  coherenceScore?: number;
  tacticalNotes?: string[];
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'assist' | 'yellow' | 'red' | 'sub_in' | 'sub_out' | 'injury';
  description?: string;
}

export interface PhysicalEvolutionRecord {
  date: Date;
  maxSpeed: number;
  accelerationPeak: number;
  sprintCapacity: number;
  aerobicCapacity: number;
  recoveryRate: number;
  injuryRisk: number;
  fitnessLevel: number;
  notes?: string;
}

export interface TacticalProfile {
  preferredPositions: string[];
  bestRoles: string[];
  strengths: TacticalStrength[];
  weaknesses: TacticalWeakness[];
  playStyle: PlayStyleProfile;
  heatmapProfile: HeatmapProfile;
}

export interface TacticalStrength {
  area: string;
  rating: number; // 1-100
  description: string;
}

export interface TacticalWeakness {
  area: string;
  rating: number; // 1-100
  description: string;
  improvementPlan?: string;
}

export interface PlayStyleProfile {
  workRate: { attacking: number; defensive: number };
  passingStyle: 'short' | 'mixed' | 'long' | 'direct';
  dribbling: number;
  physicalPresence: number;
  creativity: number;
  defensiveContribution: number;
  leadership: number;
}

export interface HeatmapProfile {
  averagePosition: { x: number; y: number };
  zonePreferences: Map<string, number>;
  movementPatterns: string[];
}

export interface PerformanceTrends {
  distanceTrend: TrendData;
  sprintTrend: TrendData;
  intensityTrend: TrendData;
  formTrend: TrendData;
  injuryRisk: TrendData;
}

export interface TrendData {
  direction: 'improving' | 'stable' | 'declining';
  changePercent: number;
  dataPoints: { date: Date; value: number }[];
  projection?: { date: Date; value: number }[];
}

// ==================== Player History Manager ====================

export class PlayerHistoryManager {
  private histories: Map<string, PlayerHistory> = new Map();

  // Initialize or get player history
  getOrCreateHistory(player: Player, teamName: string): PlayerHistory {
    let history = this.histories.get(player.id);

    if (!history) {
      history = this.createInitialHistory(player, teamName);
      this.histories.set(player.id, history);
    }

    return history;
  }

  // Create initial history
  private createInitialHistory(player: Player, teamName: string): PlayerHistory {
    const matchHistory = generateMatchTrackingHistory(player.id, 20);

    return {
      playerId: player.id,
      playerName: player.name,
      currentTeam: teamName,
      careerStats: this.generateCareerStats(player),
      seasons: this.generateSeasonHistory(player, teamName, matchHistory),
      matchHistory: this.convertToMatchRecords(matchHistory, teamName),
      physicalEvolution: this.generatePhysicalEvolution(player),
      tacticalProfile: this.generateTacticalProfile(player),
      trends: this.calculateTrends(matchHistory),
      lastUpdated: new Date(),
    };
  }

  // Generate career stats
  private generateCareerStats(player: Player): CareerStats {
    // Generate realistic career stats based on position
    const isForward = ['ST', 'CF', 'LW', 'RW'].includes(player.position);
    const isMidfielder = ['CM', 'CAM', 'CDM', 'LM', 'RM'].includes(player.position);
    const isDefender = ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(player.position);

    const baseAppearances = 150 + Math.floor(Math.random() * 200);

    return {
      totalAppearances: baseAppearances,
      totalMinutes: baseAppearances * (75 + Math.floor(Math.random() * 15)),
      totalGoals: isForward ? 50 + Math.floor(Math.random() * 100) :
                  isMidfielder ? 15 + Math.floor(Math.random() * 40) :
                  2 + Math.floor(Math.random() * 15),
      totalAssists: isForward ? 20 + Math.floor(Math.random() * 50) :
                    isMidfielder ? 30 + Math.floor(Math.random() * 60) :
                    5 + Math.floor(Math.random() * 20),
      totalCleanSheets: isDefender || player.position === 'GK' ?
                        Math.floor(baseAppearances * 0.3) : undefined,
      averageRating: 6.5 + Math.random() * 1.5,
      trophies: this.generateTrophies(),
      individualAwards: this.generateAwards(player),
    };
  }

  private generateTrophies(): Trophy[] {
    const possibleTrophies = [
      { name: 'Premier League', prob: 0.2 },
      { name: 'FA Cup', prob: 0.3 },
      { name: 'League Cup', prob: 0.35 },
      { name: 'Community Shield', prob: 0.4 },
      { name: 'Champions League', prob: 0.1 },
      { name: 'Europa League', prob: 0.15 },
    ];

    const trophies: Trophy[] = [];
    possibleTrophies.forEach(t => {
      if (Math.random() < t.prob) {
        trophies.push({
          name: t.name,
          season: `202${Math.floor(Math.random() * 4)}/2${Math.floor(Math.random() * 4) + 1}`,
          team: 'Current Team',
        });
      }
    });

    return trophies;
  }

  private generateAwards(player: Player): Award[] {
    const awards: Award[] = [];
    if (Math.random() < 0.3) {
      awards.push({
        name: 'Player of the Month',
        season: '2023/24',
        category: 'Premier League',
      });
    }
    return awards;
  }

  // Generate season history
  private generateSeasonHistory(
    player: Player,
    teamName: string,
    matchHistory: TrackingMetrics[]
  ): SeasonHistory[] {
    const seasons: SeasonHistory[] = [];
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < 3; i++) {
      const year = currentYear - i;
      const appearances = 25 + Math.floor(Math.random() * 15);
      const matchSubset = matchHistory.slice(i * 10, (i + 1) * 10);

      seasons.push({
        season: `${year - 1}/${year.toString().slice(2)}`,
        team: teamName,
        league: 'Premier League',
        appearances,
        starts: appearances - Math.floor(Math.random() * 5),
        minutes: appearances * (75 + Math.floor(Math.random() * 15)),
        goals: this.generateGoalsForPosition(player.position, appearances),
        assists: this.generateAssistsForPosition(player.position, appearances),
        yellowCards: Math.floor(Math.random() * 6),
        redCards: Math.random() < 0.1 ? 1 : 0,
        avgRating: 6.5 + Math.random() * 1.5,
        trackingSummary: this.calculateSeasonTracking(matchSubset),
      });
    }

    return seasons;
  }

  private generateGoalsForPosition(position: string, appearances: number): number {
    const rates: Record<string, number> = {
      ST: 0.5, CF: 0.45, LW: 0.25, RW: 0.25,
      CAM: 0.2, CM: 0.1, LM: 0.15, RM: 0.15,
      CDM: 0.05, CB: 0.05, LB: 0.03, RB: 0.03,
      LWB: 0.05, RWB: 0.05, GK: 0,
    };
    return Math.floor(appearances * (rates[position] || 0.1) * (0.5 + Math.random()));
  }

  private generateAssistsForPosition(position: string, appearances: number): number {
    const rates: Record<string, number> = {
      CAM: 0.3, CM: 0.2, RW: 0.25, LW: 0.25,
      ST: 0.15, CF: 0.2, LM: 0.2, RM: 0.2,
      LB: 0.1, RB: 0.1, LWB: 0.15, RWB: 0.15,
      CDM: 0.08, CB: 0.03, GK: 0.01,
    };
    return Math.floor(appearances * (rates[position] || 0.1) * (0.5 + Math.random()));
  }

  private calculateSeasonTracking(matches: TrackingMetrics[]): SeasonTrackingSummary {
    if (matches.length === 0) {
      return {
        totalDistance: 0, avgDistancePerMatch: 0, totalSprints: 0,
        avgSprintsPerMatch: 0, maxSpeedReached: 0, avgMaxSpeed: 0,
        totalHighIntensityRuns: 0, avgPlayerLoad: 0, avgMetabolicPower: 0,
      };
    }

    const totalDistance = matches.reduce((sum, m) => sum + m.totalDistance, 0);
    const totalSprints = matches.reduce((sum, m) => sum + m.accelerations.high, 0);
    const maxSpeeds = matches.map(m => m.maxSpeed);

    return {
      totalDistance,
      avgDistancePerMatch: totalDistance / matches.length,
      totalSprints,
      avgSprintsPerMatch: totalSprints / matches.length,
      maxSpeedReached: Math.max(...maxSpeeds),
      avgMaxSpeed: maxSpeeds.reduce((a, b) => a + b, 0) / maxSpeeds.length,
      totalHighIntensityRuns: matches.reduce((sum, m) => sum + m.accelerations.high + m.accelerations.medium, 0),
      avgPlayerLoad: matches.reduce((sum, m) => sum + m.playerLoad, 0) / matches.length,
      avgMetabolicPower: matches.reduce((sum, m) => sum + m.metabolicPower, 0) / matches.length,
    };
  }

  // Convert tracking to match records
  private convertToMatchRecords(
    metrics: TrackingMetrics[],
    teamName: string
  ): MatchTrackingRecord[] {
    const opponents = [
      'Arsenal', 'Liverpool', 'Chelsea', 'Manchester United', 'Tottenham',
      'Newcastle', 'Aston Villa', 'Brighton', 'West Ham', 'Crystal Palace',
    ];

    return metrics.map((m, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7));

      return {
        matchId: `match-${date.getTime()}`,
        date,
        opponent: opponents[i % opponents.length],
        competition: 'Premier League',
        result: ['W', 'D', 'L'][Math.floor(Math.random() * 3)],
        minutesPlayed: 75 + Math.floor(Math.random() * 15),
        position: 'Starting',
        rating: 6 + Math.random() * 2,
        metrics: m,
        events: [],
        coherenceScore: 70 + Math.random() * 25,
      };
    });
  }

  // Generate physical evolution
  private generatePhysicalEvolution(player: Player): PhysicalEvolutionRecord[] {
    const records: PhysicalEvolutionRecord[] = [];
    const baseProfile = player.physicalProfile;

    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      // Slight variations over time
      const variation = (12 - i) / 100; // Older records might be slightly different

      records.push({
        date,
        maxSpeed: baseProfile.maxSpeed * (1 - variation * Math.random()),
        accelerationPeak: baseProfile.accelerationPeak * (1 - variation * Math.random()),
        sprintCapacity: baseProfile.sprintCapacity * (1 - variation * Math.random()),
        aerobicCapacity: baseProfile.aerobicThreshold * (1 - variation * Math.random()),
        recoveryRate: 75 + Math.random() * 20,
        injuryRisk: 10 + Math.random() * 30,
        fitnessLevel: 70 + Math.random() * 25,
      });
    }

    return records.reverse();
  }

  // Generate tactical profile
  private generateTacticalProfile(player: Player): TacticalProfile {
    const positionStrengths: Record<string, TacticalStrength[]> = {
      ST: [
        { area: 'Finishing', rating: 80 + Math.random() * 15, description: 'Clinical in the box' },
        { area: 'Movement', rating: 75 + Math.random() * 20, description: 'Intelligent runs' },
      ],
      CM: [
        { area: 'Passing', rating: 78 + Math.random() * 17, description: 'Distribution' },
        { area: 'Vision', rating: 75 + Math.random() * 20, description: 'Sees passes' },
      ],
      CB: [
        { area: 'Tackling', rating: 80 + Math.random() * 15, description: 'Strong in the tackle' },
        { area: 'Positioning', rating: 75 + Math.random() * 20, description: 'Reads the game' },
      ],
    };

    return {
      preferredPositions: [player.position],
      bestRoles: [player.position],
      strengths: positionStrengths[player.position] || [
        { area: 'General', rating: 75, description: 'Well-rounded player' },
      ],
      weaknesses: [
        { area: 'Aerial', rating: 60, description: 'Can be exposed in the air' },
      ],
      playStyle: {
        workRate: { attacking: 70 + Math.random() * 25, defensive: 60 + Math.random() * 30 },
        passingStyle: 'mixed',
        dribbling: 60 + Math.random() * 35,
        physicalPresence: 60 + Math.random() * 35,
        creativity: 55 + Math.random() * 40,
        defensiveContribution: 50 + Math.random() * 45,
        leadership: 50 + Math.random() * 45,
      },
      heatmapProfile: {
        averagePosition: { x: 0, y: 0 },
        zonePreferences: new Map(),
        movementPatterns: ['Central runs', 'Wide support', 'Box presence'],
      },
    };
  }

  // Calculate trends
  private calculateTrends(matchHistory: TrackingMetrics[]): PerformanceTrends {
    const recentMatches = matchHistory.slice(0, 5);
    const olderMatches = matchHistory.slice(5, 10);

    const calculateTrend = (
      recent: number[],
      older: number[]
    ): TrendData => {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

      return {
        direction: changePercent > 5 ? 'improving' : changePercent < -5 ? 'declining' : 'stable',
        changePercent,
        dataPoints: recent.map((v, i) => ({
          date: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
          value: v,
        })),
      };
    };

    return {
      distanceTrend: calculateTrend(
        recentMatches.map(m => m.totalDistance),
        olderMatches.map(m => m.totalDistance)
      ),
      sprintTrend: calculateTrend(
        recentMatches.map(m => m.sprintDistance),
        olderMatches.map(m => m.sprintDistance)
      ),
      intensityTrend: calculateTrend(
        recentMatches.map(m => m.playerLoad),
        olderMatches.map(m => m.playerLoad)
      ),
      formTrend: calculateTrend(
        recentMatches.map(m => m.averageSpeed * 10),
        olderMatches.map(m => m.averageSpeed * 10)
      ),
      injuryRisk: {
        direction: 'stable',
        changePercent: 0,
        dataPoints: [],
      },
    };
  }

  // Add match record
  addMatchRecord(playerId: string, record: MatchTrackingRecord): void {
    const history = this.histories.get(playerId);
    if (history) {
      history.matchHistory.unshift(record);
      history.lastUpdated = new Date();

      // Update trends
      history.trends = this.calculateTrends(
        history.matchHistory.map(m => m.metrics)
      );
    }
  }

  // Get history
  getHistory(playerId: string): PlayerHistory | undefined {
    return this.histories.get(playerId);
  }

  // Get all histories
  getAllHistories(): PlayerHistory[] {
    return Array.from(this.histories.values());
  }

  // Merge with digital twin
  mergeWithDigitalTwin(playerId: string, twin: DigitalTwin): void {
    const history = this.histories.get(playerId);
    if (history && twin.performanceBaseline) {
      // Update trends based on twin's baseline
      const baselineMetrics = twin.performanceBaseline.averageMetrics;

      // Add physical evolution record
      history.physicalEvolution.push({
        date: new Date(),
        maxSpeed: baselineMetrics.maxSpeed,
        accelerationPeak: baselineMetrics.maxAcceleration,
        sprintCapacity: baselineMetrics.sprintDistance,
        aerobicCapacity: 0,
        recoveryRate: 100 - twin.currentState.fatigue,
        injuryRisk: twin.currentState.fatigue > 80 ? 40 : 15,
        fitnessLevel: twin.currentState.readiness,
      });
    }
  }
}

// ==================== Singleton Instance ====================

let historyManagerInstance: PlayerHistoryManager | null = null;

export function getPlayerHistoryManager(): PlayerHistoryManager {
  if (!historyManagerInstance) {
    historyManagerInstance = new PlayerHistoryManager();
  }
  return historyManagerInstance;
}
