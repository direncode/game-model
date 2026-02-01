/**
 * Recruitment AI - Player Similarity and Scouting Module
 *
 * Uses machine learning techniques to:
 * - Find similar players based on playing style
 * - Evaluate transfer targets against squad needs
 * - Project player development trajectories
 * - Assess tactical fit with game model
 *
 * Inspired by elite PL recruitment systems (Liverpool, Brighton, Brentford)
 */

import type { Player, TrackingMetrics, GameModel } from '@/types';
import type { PlayerMatchStats } from './data-integration';

// ==================== PLAYER PROFILE VECTORS ====================

export interface PlayerStyleVector {
  playerId: string;
  playerName: string;
  position: string;
  age: number;

  // 64-dimensional style vector
  dimensions: number[];

  // Labeled metrics for interpretability
  labels: {
    // Passing style (8 dims)
    passVolume: number;        // Passes per 90
    passProgression: number;   // Progressive pass %
    passRisk: number;          // Long ball %
    passCreativity: number;    // Key passes per 90
    passingRange: number;      // Avg pass length
    crossingVolume: number;    // Crosses per 90
    throughBallRate: number;   // Through balls per 90
    switchPlayRate: number;    // Switches per 90

    // Ball carrying (6 dims)
    carryVolume: number;       // Carries per 90
    carryProgression: number;  // Progressive carries per 90
    carryDistance: number;     // Avg carry distance
    dribbleAttempts: number;   // Dribbles per 90
    dribbleSuccess: number;    // Dribble success %
    takeonAggression: number;  // Dribbles in final third %

    // Shooting/finishing (6 dims)
    shotVolume: number;        // Shots per 90
    shotQuality: number;       // Avg xG per shot
    shotAccuracy: number;      // Shots on target %
    headingThreat: number;     // Headed shots per 90
    longRangeThreat: number;   // Shots outside box per 90
    bigChanceConversion: number; // Big chance conversion %

    // Pressing/defense (8 dims)
    pressureRate: number;      // Pressures per 90
    pressureSuccess: number;   // Pressure success %
    pressureIntensity: number; // High press actions per 90
    tackleRate: number;        // Tackles per 90
    tackleSuccess: number;     // Tackle success %
    interceptionRate: number;  // Interceptions per 90
    aerialDuelRate: number;    // Aerial duels per 90
    aerialSuccess: number;     // Aerial success %

    // Physical profile (8 dims)
    sprintDistance: number;    // Sprint distance per 90
    topSpeed: number;          // Top speed reached
    accelerations: number;     // Accelerations per 90
    decelerations: number;     // Decelerations per 90
    totalDistance: number;     // Total distance per 90
    highIntensityRuns: number; // High intensity runs per 90
    workRate: number;          // Work rate index
    recoverySpeed: number;     // Avg recovery time

    // Positional/tactical (8 dims)
    averagePosition: number;   // Avg x position (0-105)
    positionVariance: number;  // Position variance (mobility)
    widthUsage: number;        // Avg y position from center
    depthReaching: number;     // % touches in final third
    defensiveContribution: number; // % touches in def third
    boxPresence: number;       // Touches in opp box per 90
    dropDeep: number;          // % receives in own half
    runsInBehind: number;      // Runs in behind per 90
  };

  // Metadata
  dataSource: string;
  sampleSize: number; // Minutes used for calculation
  confidence: number; // 0-1 confidence in profile
  lastUpdated: Date;
}

export interface PlayerComparison {
  sourcePlayer: PlayerStyleVector;
  targetPlayer: PlayerStyleVector;
  overallSimilarity: number; // 0-100
  dimensionSimilarity: number[]; // Per-dimension similarity
  strengthMatch: string[]; // Dimensions where target is stronger
  weaknessMatch: string[]; // Dimensions where target is weaker
  styleDifferences: string[]; // Key style differences
  recommendation: string;
}

export interface ScoutingReport {
  player: PlayerStyleVector;
  targetClub: string;
  squadFit: number; // 0-100
  tacticalFit: number; // 0-100
  physicalFit: number; // 0-100
  styleFit: number; // 0-100
  developmentPotential: number; // 0-100
  riskAssessment: RecruitmentRisk[];
  similarPlayersInSquad: PlayerComparison[];
  recommendedRole: string;
  projectedImpact: string;
  overallRating: number;
  recommendation: 'strongly_recommend' | 'recommend' | 'consider' | 'pass' | 'avoid';
}

export interface RecruitmentRisk {
  type: 'injury' | 'adaptation' | 'age' | 'style' | 'physical' | 'tactical';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigationStrategy?: string;
}

export interface DevelopmentProjection {
  playerId: string;
  currentAge: number;
  projectedPeakAge: number;
  currentOverall: number;
  projectedPeak: number;
  developmentCurve: { age: number; rating: number }[];
  keyDevelopmentAreas: string[];
  ceilingComparison: string; // Similar player at peak
}

// ==================== SIMILARITY ALGORITHMS ====================

export class RecruitmentAI {
  private playerDatabase: Map<string, PlayerStyleVector> = new Map();
  private squadPlayers: Set<string> = new Set();
  private gameModel: GameModel | null = null;

  constructor() {}

  setGameModel(model: GameModel): void {
    this.gameModel = model;
  }

  setSquad(playerIds: string[]): void {
    this.squadPlayers = new Set(playerIds);
  }

  // ==================== PROFILE GENERATION ====================

  generateStyleVector(
    player: Player,
    stats: PlayerMatchStats[],
    tracking: TrackingMetrics[]
  ): PlayerStyleVector {
    // Aggregate stats across matches
    const avgStats = this.averageStats(stats);
    const avgTracking = this.averageTracking(tracking);
    const minutesPlayed = stats.reduce((sum, s) => sum + s.minutesPlayed, 0);

    // Per 90 normalization
    const per90 = (value: number) => minutesPlayed > 0 ? (value / minutesPlayed) * 90 : 0;

    const labels = {
      // Passing
      passVolume: per90(avgStats.passesAttempted),
      passProgression: avgStats.passesAttempted > 0
        ? (avgStats.progressivePasses / avgStats.passesAttempted) * 100
        : 0,
      passRisk: avgStats.passesAttempted > 0 ? 30 : 0, // Simplified
      passCreativity: per90(avgStats.keyPasses),
      passingRange: 15, // Would need pass length data
      crossingVolume: per90(avgStats.crossesAttempted),
      throughBallRate: per90(avgStats.throughBalls || 0),
      switchPlayRate: 0,

      // Ball carrying
      carryVolume: per90(avgStats.carries),
      carryProgression: per90(avgStats.progressiveCarries),
      carryDistance: avgStats.carryDistance / Math.max(1, avgStats.carries),
      dribbleAttempts: per90(avgStats.dribblesAttempted),
      dribbleSuccess: avgStats.dribbleSuccessRate,
      takeonAggression: 50,

      // Shooting
      shotVolume: per90(avgStats.shots),
      shotQuality: avgStats.xGPerShot,
      shotAccuracy: avgStats.shots > 0 ? (avgStats.shotsOnTarget / avgStats.shots) * 100 : 0,
      headingThreat: 0,
      longRangeThreat: 0,
      bigChanceConversion: 0,

      // Pressing/defense
      pressureRate: per90(avgStats.pressures),
      pressureSuccess: avgStats.pressureSuccessRate,
      pressureIntensity: per90(avgStats.pressuresAttThird),
      tackleRate: per90(avgStats.tackles),
      tackleSuccess: avgStats.tackles > 0 ? (avgStats.tacklesWon / avgStats.tackles) * 100 : 0,
      interceptionRate: per90(avgStats.interceptions),
      aerialDuelRate: per90(avgStats.aerialDuelsWon + avgStats.aerialDuelsLost),
      aerialSuccess: (avgStats.aerialDuelsWon + avgStats.aerialDuelsLost) > 0
        ? (avgStats.aerialDuelsWon / (avgStats.aerialDuelsWon + avgStats.aerialDuelsLost)) * 100
        : 0,

      // Physical
      sprintDistance: avgTracking?.sprintDistance || 0,
      topSpeed: avgTracking?.maxSpeed || 0,
      accelerations: avgTracking?.accelerations?.total || 0,
      decelerations: avgTracking?.decelerations?.total || 0,
      totalDistance: avgTracking?.totalDistance || 0,
      highIntensityRuns: avgTracking?.highSpeedRunningDistance || 0,
      workRate: 70,
      recoverySpeed: 80,

      // Positional
      averagePosition: 52.5,
      positionVariance: 50,
      widthUsage: 50,
      depthReaching: avgStats.touches > 0 ? (avgStats.touchesAttThird / avgStats.touches) * 100 : 0,
      defensiveContribution: avgStats.touches > 0 ? (avgStats.touchesDefThird / avgStats.touches) * 100 : 0,
      boxPresence: per90(avgStats.touchesAttPenArea),
      dropDeep: 50,
      runsInBehind: 0,
    };

    // Convert to 64-dim vector
    const dimensions = Object.values(labels);

    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      age: 25, // Would need birthdate
      dimensions,
      labels,
      dataSource: 'internal',
      sampleSize: minutesPlayed,
      confidence: Math.min(1, minutesPlayed / 1800), // Full confidence at 20 matches
      lastUpdated: new Date(),
    };
  }

  private averageStats(stats: PlayerMatchStats[]): PlayerMatchStats {
    if (stats.length === 0) {
      return this.emptyStats();
    }

    const sum = stats.reduce((acc, s) => {
      Object.keys(s).forEach(key => {
        if (typeof (s as Record<string, unknown>)[key] === 'number') {
          (acc as Record<string, number>)[key] = ((acc as Record<string, number>)[key] || 0) +
            ((s as Record<string, number>)[key] || 0);
        }
      });
      return acc;
    }, {} as Record<string, number>);

    Object.keys(sum).forEach(key => {
      sum[key] /= stats.length;
    });

    return sum as unknown as PlayerMatchStats;
  }

  private averageTracking(tracking: TrackingMetrics[]): TrackingMetrics | null {
    if (tracking.length === 0) return null;
    // Simplified - would average all metrics
    return tracking[0];
  }

  private emptyStats(): PlayerMatchStats {
    return {
      playerId: '',
      playerName: '',
      teamId: '',
      minutesPlayed: 0,
      passesAttempted: 0,
      passesCompleted: 0,
      passAccuracy: 0,
      keyPasses: 0,
      throughBalls: 0,
      crossesAttempted: 0,
      crossesCompleted: 0,
      progressivePasses: 0,
      passesIntoFinalThird: 0,
      passesIntoPenaltyArea: 0,
      shots: 0,
      shotsOnTarget: 0,
      goals: 0,
      xG: 0,
      xGPerShot: 0,
      npxG: 0,
      assists: 0,
      xA: 0,
      shotCreatingActions: 0,
      goalCreatingActions: 0,
      carries: 0,
      carryDistance: 0,
      progressiveCarries: 0,
      carriesIntoFinalThird: 0,
      carriesIntoPenaltyArea: 0,
      dribblesAttempted: 0,
      dribblesCompleted: 0,
      dribbleSuccessRate: 0,
      tackles: 0,
      tacklesWon: 0,
      interceptions: 0,
      blocks: 0,
      clearances: 0,
      aerialDuelsWon: 0,
      aerialDuelsLost: 0,
      touches: 0,
      touchesAttPenArea: 0,
      touchesAttThird: 0,
      touchesMidThird: 0,
      touchesDefThird: 0,
      pressures: 0,
      pressureSuccessRate: 0,
      pressuresAttThird: 0,
      pressuresMidThird: 0,
      pressuresDefThird: 0,
      dispossessed: 0,
      miscontrols: 0,
      errorsLeadingToShot: 0,
    };
  }

  // ==================== SIMILARITY CALCULATION ====================

  calculateSimilarity(player1: PlayerStyleVector, player2: PlayerStyleVector): PlayerComparison {
    const dim1 = this.normalizeVector(player1.dimensions);
    const dim2 = this.normalizeVector(player2.dimensions);

    // Cosine similarity
    const dotProduct = dim1.reduce((sum, v, i) => sum + v * dim2[i], 0);
    const mag1 = Math.sqrt(dim1.reduce((sum, v) => sum + v * v, 0));
    const mag2 = Math.sqrt(dim2.reduce((sum, v) => sum + v * v, 0));
    const cosineSim = mag1 * mag2 > 0 ? dotProduct / (mag1 * mag2) : 0;

    // Euclidean distance (normalized to 0-1)
    const euclidean = Math.sqrt(dim1.reduce((sum, v, i) => sum + Math.pow(v - dim2[i], 2), 0));
    const maxDist = Math.sqrt(dim1.length); // Max possible distance
    const euclideanSim = 1 - (euclidean / maxDist);

    // Combined similarity (weighted)
    const overallSimilarity = (cosineSim * 0.6 + euclideanSim * 0.4) * 100;

    // Per-dimension similarity
    const dimensionSimilarity = dim1.map((v, i) => {
      const diff = Math.abs(v - dim2[i]);
      return Math.max(0, 1 - diff) * 100;
    });

    // Find strengths and weaknesses
    const labelKeys = Object.keys(player1.labels) as (keyof PlayerStyleVector['labels'])[];
    const strengthMatch = labelKeys.filter((key, i) =>
      player2.dimensions[i] > player1.dimensions[i] * 1.1
    );
    const weaknessMatch = labelKeys.filter((key, i) =>
      player2.dimensions[i] < player1.dimensions[i] * 0.9
    );

    // Style differences
    const styleDifferences: string[] = [];
    if (Math.abs(player1.labels.passVolume - player2.labels.passVolume) > 20) {
      styleDifferences.push(player2.labels.passVolume > player1.labels.passVolume
        ? 'More pass-oriented' : 'Less pass-oriented');
    }
    if (Math.abs(player1.labels.dribbleAttempts - player2.labels.dribbleAttempts) > 2) {
      styleDifferences.push(player2.labels.dribbleAttempts > player1.labels.dribbleAttempts
        ? 'More direct ball carrier' : 'Less inclined to dribble');
    }
    if (Math.abs(player1.labels.pressureRate - player2.labels.pressureRate) > 10) {
      styleDifferences.push(player2.labels.pressureRate > player1.labels.pressureRate
        ? 'Higher pressing intensity' : 'Lower pressing intensity');
    }

    return {
      sourcePlayer: player1,
      targetPlayer: player2,
      overallSimilarity,
      dimensionSimilarity,
      strengthMatch,
      weaknessMatch,
      styleDifferences,
      recommendation: this.generateComparisonRecommendation(overallSimilarity, styleDifferences),
    };
  }

  private normalizeVector(vec: number[]): number[] {
    const max = Math.max(...vec);
    const min = Math.min(...vec);
    const range = max - min || 1;
    return vec.map(v => (v - min) / range);
  }

  private generateComparisonRecommendation(similarity: number, differences: string[]): string {
    if (similarity > 85) {
      return 'Highly similar profile - could serve as direct replacement';
    } else if (similarity > 70) {
      return `Similar profile with some differences: ${differences.slice(0, 2).join(', ')}`;
    } else if (similarity > 50) {
      return 'Moderately similar - different playing style but overlapping attributes';
    } else {
      return 'Significantly different profile - not a like-for-like comparison';
    }
  }

  // ==================== SCOUTING REPORT ====================

  generateScoutingReport(
    target: PlayerStyleVector,
    currentSquad: PlayerStyleVector[],
    targetRole?: string
  ): ScoutingReport {
    // Find similar players in squad
    const squadComparisons = currentSquad
      .filter(p => p.position === target.position)
      .map(p => this.calculateSimilarity(p, target))
      .sort((a, b) => b.overallSimilarity - a.overallSimilarity)
      .slice(0, 3);

    // Calculate tactical fit
    const tacticalFit = this.calculateTacticalFit(target, targetRole);

    // Calculate physical fit
    const physicalFit = this.calculatePhysicalFit(target);

    // Calculate style fit with squad
    const styleFit = squadComparisons.length > 0
      ? squadComparisons.reduce((sum, c) => sum + c.overallSimilarity, 0) / squadComparisons.length
      : 50;

    // Squad fit (do we need this profile?)
    const squadFit = this.calculateSquadFit(target, currentSquad);

    // Development potential
    const developmentPotential = this.estimateDevelopmentPotential(target);

    // Risk assessment
    const risks = this.assessRecruitmentRisks(target, squadComparisons);

    // Overall rating
    const overallRating = (
      tacticalFit * 0.3 +
      physicalFit * 0.15 +
      styleFit * 0.2 +
      squadFit * 0.25 +
      developmentPotential * 0.1
    );

    return {
      player: target,
      targetClub: 'Manchester City', // Would be configurable
      squadFit,
      tacticalFit,
      physicalFit,
      styleFit,
      developmentPotential,
      riskAssessment: risks,
      similarPlayersInSquad: squadComparisons,
      recommendedRole: this.determineOptimalRole(target),
      projectedImpact: this.projectImpact(target, overallRating),
      overallRating,
      recommendation: this.determineRecommendation(overallRating, risks),
    };
  }

  private calculateTacticalFit(player: PlayerStyleVector, targetRole?: string): number {
    if (!this.gameModel) return 50;

    let score = 50;

    // Check pressing requirements
    if (this.gameModel.principles.outOfPossession.pressingTriggers.length > 0) {
      if (player.labels.pressureRate > 15) score += 15;
      if (player.labels.pressureIntensity > 10) score += 10;
    }

    // Check possession requirements
    if (this.gameModel.principles.inPossession.buildUpStyle === 'short_passing') {
      if (player.labels.passVolume > 50) score += 15;
      if (player.labels.passProgression > 20) score += 10;
    }

    // Position-specific
    if (player.position.includes('W') || player.position.includes('M')) {
      if (player.labels.carryVolume > 30) score += 10;
    }

    return Math.min(100, score);
  }

  private calculatePhysicalFit(player: PlayerStyleVector): number {
    let score = 50;

    // PL intensity requirements
    if (player.labels.sprintDistance > 250) score += 15;
    if (player.labels.totalDistance > 10000) score += 10;
    if (player.labels.topSpeed > 32) score += 10;
    if (player.labels.accelerations > 50) score += 10;

    // Work rate
    if (player.labels.workRate > 75) score += 5;

    return Math.min(100, score);
  }

  private calculateSquadFit(
    target: PlayerStyleVector,
    squad: PlayerStyleVector[]
  ): number {
    const positionPlayers = squad.filter(p => p.position === target.position);

    // If low depth at position, high need
    if (positionPlayers.length < 2) return 90;
    if (positionPlayers.length >= 4) return 40;

    // Check if target is better than current options
    const avgSquadRating = positionPlayers.reduce((sum, p) => {
      const overallStrength = Object.values(p.labels).reduce((s, v) => s + v, 0) / 32;
      return sum + overallStrength;
    }, 0) / positionPlayers.length;

    const targetStrength = Object.values(target.labels).reduce((s, v) => s + v, 0) / 32;

    if (targetStrength > avgSquadRating * 1.2) return 85;
    if (targetStrength > avgSquadRating) return 70;
    return 55;
  }

  private estimateDevelopmentPotential(player: PlayerStyleVector): number {
    // Age-based potential
    if (player.age < 21) return 90;
    if (player.age < 24) return 80;
    if (player.age < 27) return 65;
    if (player.age < 30) return 50;
    return 30;
  }

  private assessRecruitmentRisks(
    player: PlayerStyleVector,
    comparisons: PlayerComparison[]
  ): RecruitmentRisk[] {
    const risks: RecruitmentRisk[] = [];

    // Age risk
    if (player.age > 29) {
      risks.push({
        type: 'age',
        severity: 'high',
        description: 'Player over 29 - limited resale value and peak years',
        mitigationStrategy: 'Short-term contract with performance bonuses',
      });
    }

    // Adaptation risk
    if (player.dataSource !== 'internal' && player.confidence < 0.7) {
      risks.push({
        type: 'adaptation',
        severity: 'medium',
        description: 'Limited data from target league - adaptation risk',
        mitigationStrategy: 'Extended scouting period with in-person assessment',
      });
    }

    // Style mismatch
    if (comparisons.length > 0 && comparisons[0].overallSimilarity < 50) {
      risks.push({
        type: 'style',
        severity: 'medium',
        description: 'Playing style differs significantly from current squad',
        mitigationStrategy: 'Phased integration with tactical coaching',
      });
    }

    // Physical risk
    if (player.labels.sprintDistance < 200 || player.labels.totalDistance < 9000) {
      risks.push({
        type: 'physical',
        severity: 'medium',
        description: 'Physical output below PL average',
        mitigationStrategy: 'Fitness program and gradual exposure',
      });
    }

    return risks;
  }

  private determineOptimalRole(player: PlayerStyleVector): string {
    const { labels } = player;

    // Position-agnostic role detection
    if (labels.shotVolume > 3 && labels.shotQuality > 0.15) {
      return 'Primary goal threat';
    }
    if (labels.passCreativity > 2 && labels.passProgression > 25) {
      return 'Creative playmaker';
    }
    if (labels.dribbleAttempts > 4 && labels.carryVolume > 40) {
      return 'Ball-carrying threat';
    }
    if (labels.pressureRate > 20 && labels.tackleRate > 3) {
      return 'Pressing leader';
    }
    if (labels.interceptionRate > 2 && labels.aerialSuccess > 60) {
      return 'Defensive anchor';
    }

    return 'Versatile contributor';
  }

  private projectImpact(player: PlayerStyleVector, rating: number): string {
    if (rating > 85) return 'Immediate first-team starter with high impact potential';
    if (rating > 75) return 'First-team regular with squad strengthening impact';
    if (rating > 65) return 'Rotation option with development pathway';
    if (rating > 55) return 'Squad depth with specific situational value';
    return 'Development project or specialist backup';
  }

  private determineRecommendation(
    rating: number,
    risks: RecruitmentRisk[]
  ): ScoutingReport['recommendation'] {
    const highRisks = risks.filter(r => r.severity === 'high').length;

    if (rating > 85 && highRisks === 0) return 'strongly_recommend';
    if (rating > 75 && highRisks <= 1) return 'recommend';
    if (rating > 60 && highRisks <= 1) return 'consider';
    if (rating > 50) return 'pass';
    return 'avoid';
  }

  // ==================== FIND SIMILAR PLAYERS ====================

  findSimilarPlayers(
    target: PlayerStyleVector,
    candidates: PlayerStyleVector[],
    limit: number = 10
  ): PlayerComparison[] {
    return candidates
      .filter(p => p.playerId !== target.playerId)
      .map(p => this.calculateSimilarity(target, p))
      .sort((a, b) => b.overallSimilarity - a.overallSimilarity)
      .slice(0, limit);
  }

  // ==================== DEVELOPMENT PROJECTION ====================

  projectDevelopment(player: PlayerStyleVector): DevelopmentProjection {
    const currentStrength = Object.values(player.labels).reduce((s, v) => s + v, 0) / 32;

    // Position-based peak age
    const peakAgeMap: Record<string, number> = {
      'GK': 30,
      'CB': 28,
      'LB': 27,
      'RB': 27,
      'CDM': 28,
      'CM': 27,
      'CAM': 26,
      'LW': 26,
      'RW': 26,
      'ST': 27,
    };

    const peakAge = peakAgeMap[player.position] || 27;
    const yearsToProgress = Math.max(0, peakAge - player.age);
    const yearsPastPeak = Math.max(0, player.age - peakAge);

    // Project peak (simplified model)
    let projectedPeak = currentStrength;
    if (yearsToProgress > 0) {
      projectedPeak = currentStrength * (1 + yearsToProgress * 0.03);
    } else if (yearsPastPeak > 0) {
      projectedPeak = currentStrength * (1 - yearsPastPeak * 0.02);
    }

    // Generate curve
    const curve: { age: number; rating: number }[] = [];
    for (let age = player.age; age <= 35; age++) {
      const yearDiff = age - peakAge;
      let rating: number;
      if (yearDiff < 0) {
        rating = projectedPeak * (1 - Math.abs(yearDiff) * 0.03);
      } else {
        rating = projectedPeak * (1 - yearDiff * 0.02);
      }
      curve.push({ age, rating: Math.max(0, rating) });
    }

    // Key development areas
    const developmentAreas: string[] = [];
    if (player.labels.passProgression < 20) developmentAreas.push('Progressive passing');
    if (player.labels.pressureRate < 15) developmentAreas.push('Pressing intensity');
    if (player.labels.dribbleSuccess < 50) developmentAreas.push('Dribbling efficiency');

    return {
      playerId: player.playerId,
      currentAge: player.age,
      projectedPeakAge: peakAge,
      currentOverall: currentStrength,
      projectedPeak,
      developmentCurve: curve,
      keyDevelopmentAreas: developmentAreas,
      ceilingComparison: this.findCeilingComparison(player, projectedPeak),
    };
  }

  private findCeilingComparison(player: PlayerStyleVector, projectedPeak: number): string {
    // Simplified - would compare against historical player database
    const comparisons: Record<string, { threshold: number; player: string }[]> = {
      'RW': [
        { threshold: 80, player: 'Mohamed Salah' },
        { threshold: 70, player: 'Bukayo Saka' },
        { threshold: 60, player: 'Jarrod Bowen' },
      ],
      'ST': [
        { threshold: 85, player: 'Erling Haaland' },
        { threshold: 75, player: 'Alexander Isak' },
        { threshold: 65, player: 'Dominic Solanke' },
      ],
      'CM': [
        { threshold: 80, player: 'Rodri' },
        { threshold: 70, player: 'Declan Rice' },
        { threshold: 60, player: 'Moises Caicedo' },
      ],
    };

    const positionComps = comparisons[player.position] || [];
    for (const comp of positionComps) {
      if (projectedPeak >= comp.threshold) {
        return `Ceiling similar to ${comp.player}`;
      }
    }

    return 'Solid PL-level player';
  }

  // ==================== DATABASE OPERATIONS ====================

  addPlayer(player: PlayerStyleVector): void {
    this.playerDatabase.set(player.playerId, player);
  }

  getPlayer(playerId: string): PlayerStyleVector | undefined {
    return this.playerDatabase.get(playerId);
  }

  searchPlayers(criteria: Partial<PlayerStyleVector['labels']>): PlayerStyleVector[] {
    return Array.from(this.playerDatabase.values()).filter(player => {
      for (const [key, value] of Object.entries(criteria)) {
        const playerValue = player.labels[key as keyof PlayerStyleVector['labels']];
        if (typeof value === 'number' && playerValue < value * 0.8) {
          return false;
        }
      }
      return true;
    });
  }
}

// Singleton
let recruitmentAI: RecruitmentAI | null = null;

export function getRecruitmentAI(): RecruitmentAI {
  if (!recruitmentAI) {
    recruitmentAI = new RecruitmentAI();
  }
  return recruitmentAI;
}
