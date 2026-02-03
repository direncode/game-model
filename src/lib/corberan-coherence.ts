// Corberán-Specific Coherence Analysis
// Tailored weights and metrics for his tactical philosophy

import type {
  TrackingMetrics,
  GameModel,
  Player,
  CoherenceReport,
  TacticalDeviation,
  CriticalDeviation,
} from '@/types';
import { CORBERAN_COHERENCE_WEIGHTS, CARLOS_CORBERAN_PERSONA, type CoachPersona } from './coach-persona';

// ==================== Corberán Coherence Types ====================

export interface CorberanCoherenceReport {
  // Overall Scores
  overallScore: number;
  gpsCoherence: number;      // Physical data vs tactical expectations
  tacticalCoherence: number; // Patterns vs game model

  // Corberán-Specific Metrics
  pressingCoherence: PressingCoherence;
  transitionCoherence: TransitionCoherence;
  compactnessCoherence: CompactnessCoherence;
  doublePivotCoherence: DoublePivotCoherence;

  // Player Breakdown
  byPlayer: Map<string, PlayerCoherenceDetail>;

  // Phase Breakdown
  byPhase: Map<string, number>;

  // Alerts for the Coach
  alerts: CoherenceAlert[];

  // Recommendations (in Corberán's language)
  recommendations: string[];

  // Critical Deviations
  criticalDeviations: CriticalDeviation[];

  // Trend
  trend: 'improving' | 'stable' | 'declining';
}

export interface PressingCoherence {
  score: number;
  pressingIntensity: number;      // 0-100 (current)
  targetIntensity: number;        // Expected intensity
  coverShadowsActive: number;     // Count of active cover shadows
  pressTriggersResponded: number; // How many triggers we acted on
  triggerResponseTime: number;    // Average seconds to respond
  fiveSecondRuleAdherence: number; // % of times we won ball back in 5s
}

export interface TransitionCoherence {
  score: number;
  attackingTransitionSpeed: number;   // Seconds to progress after winning ball
  defensiveTransitionSpeed: number;   // Seconds to recover after losing ball
  counterPressSuccess: number;        // % of counter-presses winning ball
  verticalPassFrequency: number;      // % of first passes that are forward
  doublePivotUsage: number;           // % of transitions through double pivot
}

export interface CompactnessCoherence {
  score: number;
  verticalCompactness: number;   // Meters between lines (actual)
  targetVertical: number;        // Target meters
  horizontalCompactness: number; // Meters width (actual)
  targetHorizontal: number;      // Target meters
  linesBroken: boolean;          // Are there gaps?
  worstViolation: string | null; // Description of biggest issue
}

export interface DoublePivotCoherence {
  score: number;
  positioningQuality: number;    // How well positioned
  availabilityRate: number;      // % of time at least one is available
  transitionContribution: number; // % of transitions involving pivot
  spacing: 'optimal' | 'too_close' | 'too_far';
  coverageArea: number;          // Square meters covered
}

export interface PlayerCoherenceDetail {
  playerId: string;
  name: string;
  role: string;
  overallScore: number;

  // Breakdown
  positionScore: number;
  physicalScore: number;
  pressingScore: number;
  transitionScore: number;

  // Physical Data
  distance: number;
  sprints: number;
  highIntensityRuns: number;
  workRate: number;

  // Tactical Data
  positionDeviation: number;       // Meters from expected
  pressingContribution: number;    // Press actions
  recoveryRuns: number;

  // Flags
  isFatigued: boolean;
  needsSubstitution: boolean;
  isUnderperforming: boolean;

  // Recommendation
  recommendation: string;
}

export interface CoherenceAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'pressing' | 'transition' | 'shape' | 'fatigue' | 'position';
  message: string;
  affectedPlayers: string[];
  suggestedAction: string;
  timestamp: Date;
}

// ==================== Corberán Coherence Calculator ====================

export class CorberanCoherenceCalculator {
  private persona: CoachPersona;
  private previousScore: number = 70;
  private alertHistory: CoherenceAlert[] = [];

  constructor(persona: CoachPersona = CARLOS_CORBERAN_PERSONA) {
    this.persona = persona;
  }

  calculateCoherence(
    homePositions: { playerId: string; x: number; y: number; speed: number }[],
    awayPositions: { playerId: string; x: number; y: number }[],
    playerMetrics: Map<string, TrackingMetrics>,
    gameModel: GameModel,
    players: Player[],
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away',
    minute: number,
    transitionData?: {
      counterPressSuccess: number;
      averageTransitionTime: number;
      verticalPassRate: number;
    }
  ): CorberanCoherenceReport {
    const weights = CORBERAN_COHERENCE_WEIGHTS;

    // Calculate individual coherence components
    const pressingCoherence = this.calculatePressingCoherence(
      homePositions,
      awayPositions,
      playerMetrics,
      ballPosition,
      possession
    );

    const transitionCoherence = this.calculateTransitionCoherence(
      homePositions,
      playerMetrics,
      transitionData
    );

    const compactnessCoherence = this.calculateCompactnessCoherence(
      homePositions,
      gameModel
    );

    const doublePivotCoherence = this.calculateDoublePivotCoherence(
      homePositions,
      playerMetrics,
      ballPosition,
      players
    );

    // Calculate player-specific coherence
    const byPlayer = this.calculatePlayerCoherence(
      homePositions,
      playerMetrics,
      gameModel,
      players,
      minute
    );

    // Calculate overall scores using Corberán's weights
    const gpsCoherence = this.calculateGPSCoherence(playerMetrics, gameModel, byPlayer);
    const tacticalCoherence = this.calculateTacticalCoherence(
      pressingCoherence,
      transitionCoherence,
      compactnessCoherence,
      doublePivotCoherence
    );

    // Weighted overall score
    const overallScore = Math.round(
      pressingCoherence.score * weights.pressingIntensity +
      transitionCoherence.score * weights.transitionSpeed +
      compactnessCoherence.score * weights.compactness +
      gpsCoherence * weights.physicalOutput +
      tacticalCoherence * weights.roleExecution +
      this.getAveragePlayerPosition(byPlayer) * weights.positionAdherence
    );

    // Generate alerts
    const alerts = this.generateAlerts(
      pressingCoherence,
      transitionCoherence,
      compactnessCoherence,
      byPlayer,
      minute
    );

    // Generate recommendations in Corberán's language
    const recommendations = this.generateRecommendations(
      pressingCoherence,
      transitionCoherence,
      compactnessCoherence,
      doublePivotCoherence,
      byPlayer
    );

    // Determine trend
    const trend = overallScore > this.previousScore + 5 ? 'improving' :
                  overallScore < this.previousScore - 5 ? 'declining' : 'stable';
    this.previousScore = overallScore;

    // Identify critical deviations
    const criticalDeviations = this.identifyCriticalDeviations(
      byPlayer,
      pressingCoherence,
      compactnessCoherence
    );

    // Calculate phase breakdown
    const byPhase = this.calculatePhaseCoherence(
      possession,
      ballPosition,
      pressingCoherence,
      transitionCoherence,
      compactnessCoherence
    );

    return {
      overallScore: Math.max(0, Math.min(100, overallScore)),
      gpsCoherence,
      tacticalCoherence,
      pressingCoherence,
      transitionCoherence,
      compactnessCoherence,
      doublePivotCoherence,
      byPlayer,
      byPhase,
      alerts,
      recommendations,
      criticalDeviations,
      trend,
    };
  }

  // ==================== Pressing Coherence ====================

  private calculatePressingCoherence(
    homePositions: { playerId: string; x: number; y: number; speed: number }[],
    awayPositions: { playerId: string; x: number; y: number }[],
    playerMetrics: Map<string, TrackingMetrics>,
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away'
  ): PressingCoherence {
    const targetIntensity = this.persona.tacticalProfile.pressingIntensityPreference;

    // Calculate current pressing intensity based on player speeds and positions
    const playersNearBall = homePositions.filter(p => {
      const dist = Math.sqrt(Math.pow(p.x - ballPosition.x, 2) + Math.pow(p.y - ballPosition.y, 2));
      return dist < 25 && possession === 'away';
    });

    const avgSpeedNearBall = playersNearBall.length > 0
      ? playersNearBall.reduce((sum, p) => sum + p.speed, 0) / playersNearBall.length
      : 0;

    // Intensity based on speed (22+ km/h is high intensity pressing)
    const pressingIntensity = Math.min(100, (avgSpeedNearBall / 25) * 100);

    // Cover shadows: count players blocking passing lanes
    let coverShadowsActive = 0;
    if (possession === 'away') {
      homePositions.forEach(player => {
        // Check if player is between ball and an opponent
        awayPositions.forEach(opponent => {
          if (this.isBlockingPassingLane(player, ballPosition, opponent)) {
            coverShadowsActive++;
          }
        });
      });
    }

    // Score calculation
    let score = 70; // Base

    // Intensity contribution (target: 85%)
    const intensityDiff = Math.abs(pressingIntensity - targetIntensity);
    if (intensityDiff < 10) score += 15;
    else if (intensityDiff < 20) score += 5;
    else score -= 10;

    // Cover shadows bonus
    if (coverShadowsActive >= 5) score += 10;
    else if (coverShadowsActive >= 3) score += 5;

    // Pressing line height bonus (Corberán wants high press)
    const avgDefensiveX = homePositions
      .filter((_, i) => i >= 1 && i <= 4) // Defenders
      .reduce((sum, p) => sum + p.x, 0) / 4;

    if (avgDefensiveX > 40) score += 5; // High line

    return {
      score: Math.max(0, Math.min(100, score)),
      pressingIntensity,
      targetIntensity,
      coverShadowsActive,
      pressTriggersResponded: 0, // Would come from transition engine
      triggerResponseTime: 0,
      fiveSecondRuleAdherence: 0,
    };
  }

  private isBlockingPassingLane(
    player: { x: number; y: number },
    ball: { x: number; y: number },
    target: { x: number; y: number }
  ): boolean {
    // Check if player is on the line between ball and target
    const distBallTarget = Math.sqrt(
      Math.pow(target.x - ball.x, 2) + Math.pow(target.y - ball.y, 2)
    );
    const distBallPlayer = Math.sqrt(
      Math.pow(player.x - ball.x, 2) + Math.pow(player.y - ball.y, 2)
    );
    const distPlayerTarget = Math.sqrt(
      Math.pow(target.x - player.x, 2) + Math.pow(target.y - player.y, 2)
    );

    // If player is between ball and target (within tolerance)
    return Math.abs(distBallPlayer + distPlayerTarget - distBallTarget) < 5;
  }

  // ==================== Transition Coherence ====================

  private calculateTransitionCoherence(
    homePositions: { playerId: string; x: number; y: number; speed: number }[],
    playerMetrics: Map<string, TrackingMetrics>,
    transitionData?: {
      counterPressSuccess: number;
      averageTransitionTime: number;
      verticalPassRate: number;
    }
  ): TransitionCoherence {
    // Calculate based on available data
    const counterPressSuccess = transitionData?.counterPressSuccess || 50;
    const averageTransitionTime = transitionData?.averageTransitionTime || 5;
    const verticalPassRate = transitionData?.verticalPassRate || 40;

    // Score calculation
    let score = 70;

    // Counter-press success (target: 70%+)
    if (counterPressSuccess > 70) score += 15;
    else if (counterPressSuccess > 50) score += 5;
    else score -= 10;

    // Transition speed (target: < 5 seconds)
    if (averageTransitionTime < 4) score += 10;
    else if (averageTransitionTime < 5) score += 5;
    else if (averageTransitionTime > 7) score -= 15;

    // Vertical pass rate (Corberán wants forward-thinking)
    if (verticalPassRate > 50) score += 5;
    else if (verticalPassRate < 30) score -= 5;

    return {
      score: Math.max(0, Math.min(100, score)),
      attackingTransitionSpeed: averageTransitionTime,
      defensiveTransitionSpeed: averageTransitionTime + 1,
      counterPressSuccess,
      verticalPassFrequency: verticalPassRate,
      doublePivotUsage: 60, // Would come from pattern data
    };
  }

  // ==================== Compactness Coherence ====================

  private calculateCompactnessCoherence(
    homePositions: { playerId: string; x: number; y: number }[],
    gameModel: GameModel
  ): CompactnessCoherence {
    const targetVertical = this.persona.tacticalProfile.compactnessTarget.vertical;
    const targetHorizontal = this.persona.tacticalProfile.compactnessTarget.horizontal;

    // Calculate actual compactness
    const xs = homePositions.map(p => p.x);
    const ys = homePositions.map(p => p.y);

    const verticalCompactness = Math.max(...xs) - Math.min(...xs);
    const horizontalCompactness = Math.max(...ys) - Math.min(...ys);

    // Check line integrity
    const defenders = homePositions.filter((_, i) => i >= 1 && i <= 4);
    const midfielders = homePositions.filter((_, i) => i >= 5 && i <= 7);
    const attackers = homePositions.filter((_, i) => i >= 8 && i <= 10);

    const defLine = defenders.reduce((sum, p) => sum + p.x, 0) / 4;
    const midLine = midfielders.reduce((sum, p) => sum + p.x, 0) / 3;
    const attLine = attackers.reduce((sum, p) => sum + p.x, 0) / 3;

    const defMidGap = midLine - defLine;
    const midAttGap = attLine - midLine;

    // Detect broken lines (gaps > 15m)
    const linesBroken = defMidGap > 20 || midAttGap > 20;

    // Worst violation
    let worstViolation: string | null = null;
    if (defMidGap > 20) {
      worstViolation = `Gap between defense and midfield: ${defMidGap.toFixed(0)}m`;
    } else if (midAttGap > 20) {
      worstViolation = `Gap between midfield and attack: ${midAttGap.toFixed(0)}m`;
    } else if (verticalCompactness > targetVertical + 10) {
      worstViolation = `Team too stretched: ${verticalCompactness.toFixed(0)}m`;
    }

    // Score calculation
    let score = 70;

    // Vertical compactness (target: 25m)
    const verticalDiff = Math.abs(verticalCompactness - targetVertical);
    if (verticalDiff < 5) score += 15;
    else if (verticalDiff < 10) score += 5;
    else score -= (verticalDiff - 10) * 2;

    // Line integrity
    if (!linesBroken) score += 10;
    else score -= 20;

    return {
      score: Math.max(0, Math.min(100, score)),
      verticalCompactness,
      targetVertical,
      horizontalCompactness,
      targetHorizontal,
      linesBroken,
      worstViolation,
    };
  }

  // ==================== Double Pivot Coherence ====================

  private calculateDoublePivotCoherence(
    homePositions: { playerId: string; x: number; y: number }[],
    playerMetrics: Map<string, TrackingMetrics>,
    ballPosition: { x: number; y: number },
    players: Player[]
  ): DoublePivotCoherence {
    // Identify double pivot (positions 5 and 6 in 4-2-3-1)
    const pivot1 = homePositions[5];
    const pivot2 = homePositions[6];

    if (!pivot1 || !pivot2) {
      return {
        score: 50,
        positioningQuality: 50,
        availabilityRate: 50,
        transitionContribution: 50,
        spacing: 'optimal',
        coverageArea: 0,
      };
    }

    // Calculate spacing
    const spacing = Math.sqrt(
      Math.pow(pivot1.x - pivot2.x, 2) + Math.pow(pivot1.y - pivot2.y, 2)
    );

    let spacingStatus: 'optimal' | 'too_close' | 'too_far';
    if (spacing < 10) spacingStatus = 'too_close';
    else if (spacing > 25) spacingStatus = 'too_far';
    else spacingStatus = 'optimal';

    // Positioning quality (should be central, between 35-45 on x-axis)
    const avgX = (pivot1.x + pivot2.x) / 2;
    const avgY = (pivot1.y + pivot2.y) / 2;
    const positioningQuality = 100 - Math.abs(avgX - 40) * 2 - Math.abs(avgY - 50);

    // Availability (distance from ball)
    const dist1 = Math.sqrt(Math.pow(pivot1.x - ballPosition.x, 2) + Math.pow(pivot1.y - ballPosition.y, 2));
    const dist2 = Math.sqrt(Math.pow(pivot2.x - ballPosition.x, 2) + Math.pow(pivot2.y - ballPosition.y, 2));
    const availabilityRate = (dist1 < 25 || dist2 < 25) ? 80 : 40;

    // Coverage area (simplified)
    const coverageArea = spacing * 15; // Rough estimate

    // Score
    let score = 70;
    if (spacingStatus === 'optimal') score += 15;
    else if (spacingStatus === 'too_close') score -= 10;
    else score -= 15;

    if (positioningQuality > 70) score += 10;
    if (availabilityRate > 70) score += 5;

    return {
      score: Math.max(0, Math.min(100, score)),
      positioningQuality: Math.max(0, Math.min(100, positioningQuality)),
      availabilityRate,
      transitionContribution: 60,
      spacing: spacingStatus,
      coverageArea,
    };
  }

  // ==================== Player Coherence ====================

  private calculatePlayerCoherence(
    homePositions: { playerId: string; x: number; y: number; speed: number }[],
    playerMetrics: Map<string, TrackingMetrics>,
    gameModel: GameModel,
    players: Player[],
    minute: number
  ): Map<string, PlayerCoherenceDetail> {
    const byPlayer = new Map<string, PlayerCoherenceDetail>();

    homePositions.forEach((pos, index) => {
      const player = players.find(p => p.id === pos.playerId);
      if (!player) return;

      const metrics = playerMetrics.get(pos.playerId);
      const expectedPos = gameModel.formation.shape.positions[index];

      // Calculate position deviation
      const positionDeviation = expectedPos
        ? Math.sqrt(Math.pow(pos.x - expectedPos.baseX, 2) + Math.pow(pos.y - expectedPos.baseY, 2))
        : 0;

      // Position score
      const positionScore = Math.max(0, 100 - positionDeviation * 2);

      // Physical score
      const expectedDistancePerMin = 110; // ~10km per 90min
      const actualDistance = metrics?.totalDistance || 0;
      const expectedDistance = expectedDistancePerMin * minute;
      const physicalScore = expectedDistance > 0
        ? Math.min(100, (actualDistance / expectedDistance) * 100)
        : 70;

      // Pressing score (based on high intensity actions)
      const highIntensityRuns = metrics?.highSpeedRunningDistance || 0;
      const pressingScore = Math.min(100, 50 + (highIntensityRuns / 10));

      // Transition score (based on acceleration data)
      const accelerations = metrics?.accelerations.high || 0;
      const transitionScore = Math.min(100, 50 + accelerations * 5);

      // Overall score
      const overallScore = Math.round(
        positionScore * 0.25 +
        physicalScore * 0.25 +
        pressingScore * 0.30 +
        transitionScore * 0.20
      );

      // Flags
      const workRate = metrics?.distancePerMinute || 0;
      const isFatigued = workRate < 80 && minute > 60;
      const needsSubstitution = isFatigued && minute > 70;
      const isUnderperforming = overallScore < 50;

      // Generate recommendation
      let recommendation = 'Performing within parameters';
      if (isUnderperforming) {
        recommendation = `${player.name} needs to increase work rate`;
      } else if (isFatigued) {
        recommendation = `Monitor ${player.name} for fatigue`;
      } else if (needsSubstitution) {
        recommendation = `Consider substituting ${player.name}`;
      }

      byPlayer.set(pos.playerId, {
        playerId: pos.playerId,
        name: player.name,
        role: expectedPos?.role || 'Unknown',
        overallScore,
        positionScore,
        physicalScore,
        pressingScore,
        transitionScore,
        distance: actualDistance,
        sprints: metrics?.accelerations.high || 0,
        highIntensityRuns: highIntensityRuns / 20, // Approximate count
        workRate,
        positionDeviation,
        pressingContribution: pressingScore / 10,
        recoveryRuns: accelerations,
        isFatigued,
        needsSubstitution,
        isUnderperforming,
        recommendation,
      });
    });

    return byPlayer;
  }

  // ==================== GPS Coherence ====================

  private calculateGPSCoherence(
    playerMetrics: Map<string, TrackingMetrics>,
    gameModel: GameModel,
    byPlayer: Map<string, PlayerCoherenceDetail>
  ): number {
    const scores = Array.from(byPlayer.values()).map(p => p.physicalScore);
    return scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : 70;
  }

  private calculateTacticalCoherence(
    pressing: PressingCoherence,
    transition: TransitionCoherence,
    compactness: CompactnessCoherence,
    doublePivot: DoublePivotCoherence
  ): number {
    return Math.round(
      pressing.score * 0.35 +
      transition.score * 0.25 +
      compactness.score * 0.25 +
      doublePivot.score * 0.15
    );
  }

  private getAveragePlayerPosition(byPlayer: Map<string, PlayerCoherenceDetail>): number {
    const scores = Array.from(byPlayer.values()).map(p => p.positionScore);
    return scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : 70;
  }

  // ==================== Alerts ====================

  private generateAlerts(
    pressing: PressingCoherence,
    transition: TransitionCoherence,
    compactness: CompactnessCoherence,
    byPlayer: Map<string, PlayerCoherenceDetail>,
    minute: number
  ): CoherenceAlert[] {
    const alerts: CoherenceAlert[] = [];
    const thresholds = this.persona.communicationStyle.alertThresholds;

    // Pressing alerts
    if (pressing.pressingIntensity < pressing.targetIntensity - 20) {
      alerts.push({
        id: `alert-press-${Date.now()}`,
        severity: 'warning',
        type: 'pressing',
        message: `Pressing intensity low: ${pressing.pressingIntensity.toFixed(0)}%`,
        affectedPlayers: [],
        suggestedAction: 'Increase pressing intensity - trigger more aggressively',
        timestamp: new Date(),
      });
    }

    // Compactness alerts
    if (compactness.linesBroken) {
      alerts.push({
        id: `alert-shape-${Date.now()}`,
        severity: 'critical',
        type: 'shape',
        message: compactness.worstViolation || 'Lines broken - gaps in shape',
        affectedPlayers: [],
        suggestedAction: 'Tighten up - get compact immediately',
        timestamp: new Date(),
      });
    }

    // Transition alerts
    if (transition.attackingTransitionSpeed > 7) {
      alerts.push({
        id: `alert-trans-${Date.now()}`,
        severity: 'warning',
        type: 'transition',
        message: `Transitions too slow: ${transition.attackingTransitionSpeed.toFixed(1)}s average`,
        affectedPlayers: [],
        suggestedAction: 'Play forward quicker - vertical passes on transition',
        timestamp: new Date(),
      });
    }

    // Player-specific alerts
    for (const [playerId, detail] of byPlayer) {
      if (detail.needsSubstitution) {
        alerts.push({
          id: `alert-sub-${playerId}-${Date.now()}`,
          severity: 'warning',
          type: 'fatigue',
          message: `${detail.name} showing fatigue signs`,
          affectedPlayers: [playerId],
          suggestedAction: `Consider substituting ${detail.name}`,
          timestamp: new Date(),
        });
      }

      if (detail.isUnderperforming) {
        alerts.push({
          id: `alert-perf-${playerId}-${Date.now()}`,
          severity: 'warning',
          type: 'position',
          message: `${detail.name} underperforming (${detail.overallScore}%)`,
          affectedPlayers: [playerId],
          suggestedAction: detail.recommendation,
          timestamp: new Date(),
        });
      }
    }

    return alerts;
  }

  // ==================== Recommendations ====================

  private generateRecommendations(
    pressing: PressingCoherence,
    transition: TransitionCoherence,
    compactness: CompactnessCoherence,
    doublePivot: DoublePivotCoherence,
    byPlayer: Map<string, PlayerCoherenceDetail>
  ): string[] {
    const recommendations: string[] = [];

    // Pressing recommendations
    if (pressing.score < 70) {
      recommendations.push('Increase pressing triggers - react to backward passes');
    }
    if (pressing.coverShadowsActive < 3) {
      recommendations.push('More cover shadows needed - block passing lanes while pressing');
    }

    // Compactness recommendations
    if (compactness.linesBroken) {
      recommendations.push('Tighten the lines - maximum 25m between defense and attack');
    }
    if (compactness.verticalCompactness > 35) {
      recommendations.push('Team too stretched - squeeze the pitch');
    }

    // Transition recommendations
    if (transition.attackingTransitionSpeed > 5) {
      recommendations.push('Play forward quicker - look for vertical pass first');
    }
    if (transition.counterPressSuccess < 50) {
      recommendations.push('Counter-press harder - nearest 3 players must engage');
    }

    // Double pivot recommendations
    if (doublePivot.spacing === 'too_close') {
      recommendations.push('Double pivot too narrow - split to offer more angles');
    } else if (doublePivot.spacing === 'too_far') {
      recommendations.push('Double pivot too spread - stay connected');
    }

    // Limit to top 5 recommendations
    return recommendations.slice(0, 5);
  }

  // ==================== Critical Deviations ====================

  private identifyCriticalDeviations(
    byPlayer: Map<string, PlayerCoherenceDetail>,
    pressing: PressingCoherence,
    compactness: CompactnessCoherence
  ): CriticalDeviation[] {
    const deviations: CriticalDeviation[] = [];

    // Team-level deviations
    if (compactness.linesBroken) {
      deviations.push({
        description: 'Formation lines broken - gaps exposed',
        affectedPlayers: [],
        impact: 'Vulnerable to through balls and quick combinations',
        suggestedAction: 'Call for compact shape - defensive and midfield lines must close gap',
      });
    }

    if (pressing.pressingIntensity < 50) {
      deviations.push({
        description: 'Pressing intensity critical - opponent playing through us',
        affectedPlayers: [],
        impact: 'Conceding territorial control',
        suggestedAction: 'Trigger high press immediately',
      });
    }

    // Player-level deviations
    for (const [playerId, detail] of byPlayer) {
      if (detail.overallScore < 40) {
        deviations.push({
          description: `${detail.name} significantly below tactical requirements`,
          affectedPlayers: [playerId],
          impact: 'Creating structural weakness in ${detail.role} area',
          suggestedAction: detail.recommendation,
        });
      }
    }

    return deviations;
  }

  // ==================== Phase Coherence ====================

  private calculatePhaseCoherence(
    possession: 'home' | 'away',
    ballPosition: { x: number; y: number },
    pressing: PressingCoherence,
    transition: TransitionCoherence,
    compactness: CompactnessCoherence
  ): Map<string, number> {
    const byPhase = new Map<string, number>();

    // Determine current phase
    let currentPhase: string;
    if (possession === 'home') {
      if (ballPosition.x < 33) currentPhase = 'buildUp';
      else if (ballPosition.x < 67) currentPhase = 'progression';
      else currentPhase = 'finalThird';
    } else {
      if (ballPosition.x > 67) currentPhase = 'pressing';
      else currentPhase = 'defensiveBlock';
    }

    // Phase-specific scores
    byPhase.set('pressing', pressing.score);
    byPhase.set('defensiveBlock', compactness.score);
    byPhase.set('attackingTransition', transition.score);
    byPhase.set('defensiveTransition', transition.score);
    byPhase.set('buildUp', 70); // Would need more data
    byPhase.set('progression', 70);
    byPhase.set('finalThird', 70);
    byPhase.set(currentPhase, byPhase.get(currentPhase) || 70);

    return byPhase;
  }
}

// ==================== Factory ====================

export function createCorberanCoherenceCalculator(): CorberanCoherenceCalculator {
  return new CorberanCoherenceCalculator(CARLOS_CORBERAN_PERSONA);
}
