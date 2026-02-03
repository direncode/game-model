// GPS-to-Tactical Bridge - Translating Physical Data into Tactical Meaning
// Designed for Carlos Corberán's key frustration: bridging raw GPS data with tactical understanding

import type { TrackingMetrics, Player, SpeedZoneData, AccelerationData } from '@/types';
import { CARLOS_CORBERAN_PERSONA, type CoachPersona } from './coach-persona';

// ==================== Core Types ====================

export interface TacticalInterpretation {
  playerId: string;
  playerName: string;
  position: string;
  minute: number;

  // Raw Data Summary
  rawMetrics: {
    totalDistance: number;
    highSpeedDistance: number;
    sprintDistance: number;
    accelerations: number;
    decelerations: number;
    currentSpeed: number;
  };

  // Tactical Meaning (what the coach cares about)
  tacticalMeaning: TacticalMeaning;

  // Action Items
  actionItems: ActionItem[];

  // Score
  tacticalEfficiency: number; // 0-100 (are they running smart, not just hard?)
}

export interface TacticalMeaning {
  // Pressing Contribution
  pressing: {
    isActivelyPressing: boolean;
    pressCount: number;
    pressTriggerResponses: number;
    coverShadowMaintained: boolean;
    pressingIntensityRating: 'excellent' | 'good' | 'adequate' | 'poor';
  };

  // Positional Discipline
  position: {
    timeInZone: number; // % of time in expected zone
    positionDeviation: number; // average meters from expected
    structuralContribution: 'maintaining' | 'breaking' | 'compensating';
    isHoldingLine: boolean;
  };

  // Work Rate Context
  workRate: {
    effectiveDistance: number; // Distance that mattered tactically
    wastedRuns: number; // Runs that didn't contribute
    recoveryRunCount: number;
    pressingRunCount: number;
    supportRunCount: number;
  };

  // Transition Contribution
  transition: {
    transitionInvolvements: number;
    averageReactionTime: number; // seconds
    forwardRunsOnWin: number;
    recoveryRunsOnLoss: number;
    contribution: 'key' | 'supporting' | 'minimal' | 'absent';
  };

  // Fatigue Context
  fatigue: {
    currentLevel: number; // 0-100
    performanceImpact: 'none' | 'minor' | 'moderate' | 'significant';
    recommendAction: string;
    sustainableMinutes: number;
  };

  // Overall Assessment
  summary: string;
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  type: 'instruction' | 'substitution' | 'formation' | 'encouragement';
  message: string;
  targetPlayer?: string;
}

// ==================== Team-Level Tactical Summary ====================

export interface TeamTacticalSummary {
  // Pressing Performance
  pressing: {
    teamPressingIntensity: number; // 0-100
    pressTriggersActivated: number;
    successfulPressCount: number;
    failedPressCount: number;
    coverShadowCoverage: number; // % of passing lanes blocked
    pressingLine: number; // average x position of pressing line
  };

  // Shape & Structure
  shape: {
    compactnessScore: number; // 0-100
    verticalDistance: number; // meters between lines
    horizontalWidth: number; // meters
    linesConnected: boolean;
    gapsIdentified: { location: string; severity: 'minor' | 'moderate' | 'critical' }[];
  };

  // Transition Performance
  transitions: {
    positiveTransitions: number;
    negativeTransitions: number;
    averageCounterPressTime: number;
    averageAttackingTransitionTime: number;
    counterPressSuccessRate: number;
    directPlayPercentage: number;
  };

  // Physical vs Tactical Efficiency
  efficiency: {
    totalTeamDistance: number;
    effectiveDistance: number; // Distance that contributed tactically
    wastedDistance: number; // Running without purpose
    efficiencyRating: number; // 0-100
    message: string; // "Running smart" vs "Running hard but not smart"
  };

  // Key Insights for Coach
  insights: string[];

  // Recommended Adjustments
  adjustments: ActionItem[];
}

// ==================== GPS Tactical Bridge Class ====================

export class GPSTacticalBridge {
  private persona: CoachPersona;
  private playerHistory: Map<string, TrackingMetrics[]> = new Map();
  private transitionEvents: Map<string, { timestamp: number; type: 'won' | 'lost'; playerId: string }[]> = new Map();

  constructor(persona: CoachPersona = CARLOS_CORBERAN_PERSONA) {
    this.persona = persona;
  }

  // ==================== Main Interpretation Function ====================

  interpretPlayerData(
    player: Player,
    currentMetrics: TrackingMetrics,
    expectedPosition: { x: number; y: number; role: string },
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away',
    minute: number,
    isCounterPressing: boolean = false
  ): TacticalInterpretation {
    // Store history
    const history = this.playerHistory.get(player.id) || [];
    history.push(currentMetrics);
    if (history.length > 100) history.shift();
    this.playerHistory.set(player.id, history);

    // Calculate tactical meaning
    const tacticalMeaning = this.calculateTacticalMeaning(
      player,
      currentMetrics,
      expectedPosition,
      ballPosition,
      possession,
      minute,
      isCounterPressing,
      history
    );

    // Generate action items
    const actionItems = this.generateActionItems(player, tacticalMeaning, minute);

    // Calculate tactical efficiency
    const tacticalEfficiency = this.calculateTacticalEfficiency(tacticalMeaning);

    return {
      playerId: player.id,
      playerName: player.name,
      position: expectedPosition.role,
      minute,
      rawMetrics: {
        totalDistance: currentMetrics.totalDistance,
        highSpeedDistance: currentMetrics.highSpeedRunningDistance,
        sprintDistance: currentMetrics.sprintDistance,
        accelerations: currentMetrics.accelerations.total,
        decelerations: currentMetrics.decelerations.total,
        currentSpeed: currentMetrics.currentSpeed,
      },
      tacticalMeaning,
      actionItems,
      tacticalEfficiency,
    };
  }

  // ==================== Tactical Meaning Calculation ====================

  private calculateTacticalMeaning(
    player: Player,
    metrics: TrackingMetrics,
    expectedPos: { x: number; y: number; role: string },
    ballPos: { x: number; y: number },
    possession: 'home' | 'away',
    minute: number,
    isCounterPressing: boolean,
    history: TrackingMetrics[]
  ): TacticalMeaning {
    const pressing = this.analyzePressing(metrics, ballPos, possession, isCounterPressing);
    const position = this.analyzePosition(metrics, expectedPos);
    const workRate = this.analyzeWorkRate(metrics, history, expectedPos.role);
    const transition = this.analyzeTransitionContribution(metrics, history, possession);
    const fatigue = this.analyzeFatigue(metrics, history, minute, expectedPos.role);

    // Generate summary in Corberán's language
    const summary = this.generateSummary(player, pressing, position, workRate, transition, fatigue);

    return {
      pressing,
      position,
      workRate,
      transition,
      fatigue,
      summary,
    };
  }

  private analyzePressing(
    metrics: TrackingMetrics,
    ballPos: { x: number; y: number },
    possession: 'home' | 'away',
    isCounterPressing: boolean
  ): TacticalMeaning['pressing'] {
    const distToBall = Math.sqrt(
      Math.pow(metrics.position.x - ballPos.x, 2) +
      Math.pow(metrics.position.y - ballPos.y, 2)
    );

    // Is actively pressing if: opponent has ball, player is close, moving fast
    const isActivelyPressing = possession === 'away' &&
      distToBall < 20 &&
      metrics.currentSpeed > 15;

    // Count high-intensity actions as press attempts
    const pressCount = metrics.accelerations.high;

    // Intensity rating based on speed zones during defensive phases
    const highIntensityPercent =
      (metrics.speedZones.zone4 + metrics.speedZones.zone5 + metrics.speedZones.zone6) /
      (Object.values(metrics.speedZones).reduce((a, b) => a + b, 0) || 1) * 100;

    let pressingIntensityRating: TacticalMeaning['pressing']['pressingIntensityRating'];
    if (highIntensityPercent > 30) pressingIntensityRating = 'excellent';
    else if (highIntensityPercent > 20) pressingIntensityRating = 'good';
    else if (highIntensityPercent > 10) pressingIntensityRating = 'adequate';
    else pressingIntensityRating = 'poor';

    return {
      isActivelyPressing,
      pressCount,
      pressTriggerResponses: isCounterPressing ? 1 : 0,
      coverShadowMaintained: distToBall < 25 && metrics.currentSpeed < 12,
      pressingIntensityRating,
    };
  }

  private analyzePosition(
    metrics: TrackingMetrics,
    expectedPos: { x: number; y: number; role: string }
  ): TacticalMeaning['position'] {
    const actualX = metrics.position.x;
    const actualY = metrics.position.y;

    const deviation = Math.sqrt(
      Math.pow(actualX - expectedPos.x, 2) +
      Math.pow(actualY - expectedPos.y, 2)
    );

    // Determine structural contribution
    let structuralContribution: TacticalMeaning['position']['structuralContribution'];
    if (deviation < 10) {
      structuralContribution = 'maintaining';
    } else if (deviation > 20) {
      structuralContribution = 'breaking';
    } else {
      structuralContribution = 'compensating';
    }

    // Is holding line (for defenders)
    const isDefender = expectedPos.role.includes('CB') || expectedPos.role.includes('B');
    const isHoldingLine = isDefender ? deviation < 8 : true;

    // Time in zone estimation (simplified)
    const timeInZone = Math.max(0, 100 - deviation * 3);

    return {
      timeInZone,
      positionDeviation: deviation,
      structuralContribution,
      isHoldingLine,
    };
  }

  private analyzeWorkRate(
    metrics: TrackingMetrics,
    history: TrackingMetrics[],
    role: string
  ): TacticalMeaning['workRate'] {
    // Effective distance = high-speed + purposeful runs
    const effectiveDistance = metrics.highSpeedRunningDistance + metrics.sprintDistance * 0.5;

    // Wasted runs estimation (low-speed movement without purpose)
    const totalDistance = metrics.totalDistance;
    const wastedRuns = Math.max(0, totalDistance - effectiveDistance * 2);

    // Categorize runs
    const recoveryRunCount = metrics.decelerations.high; // Sprinting back
    const pressingRunCount = metrics.accelerations.high; // Closing down
    const supportRunCount = Math.floor(metrics.runningDistance / 50);

    return {
      effectiveDistance,
      wastedRuns,
      recoveryRunCount,
      pressingRunCount,
      supportRunCount,
    };
  }

  private analyzeTransitionContribution(
    metrics: TrackingMetrics,
    history: TrackingMetrics[],
    possession: 'home' | 'away'
  ): TacticalMeaning['transition'] {
    // Analyze speed changes for transition involvement
    const recentSpeeds = history.slice(-10).map(h => h.currentSpeed);
    const speedVariance = this.calculateVariance(recentSpeeds);

    // High variance = involved in transitions
    const transitionInvolvements = speedVariance > 50 ? 3 : speedVariance > 25 ? 2 : 1;

    // Forward runs (for attacking transitions)
    const forwardRunsOnWin = metrics.accelerations.high;

    // Recovery runs (for defensive transitions)
    const recoveryRunsOnLoss = metrics.decelerations.high;

    // Contribution rating
    let contribution: TacticalMeaning['transition']['contribution'];
    if (transitionInvolvements >= 3) contribution = 'key';
    else if (transitionInvolvements >= 2) contribution = 'supporting';
    else if (transitionInvolvements >= 1) contribution = 'minimal';
    else contribution = 'absent';

    return {
      transitionInvolvements,
      averageReactionTime: 3.5, // Would come from transition engine
      forwardRunsOnWin,
      recoveryRunsOnLoss,
      contribution,
    };
  }

  private analyzeFatigue(
    metrics: TrackingMetrics,
    history: TrackingMetrics[],
    minute: number,
    role: string
  ): TacticalMeaning['fatigue'] {
    // Calculate fatigue based on declining work rate
    const recentWorkRates = history.slice(-20).map(h => h.distancePerMinute);
    const avgRecentWorkRate = recentWorkRates.length > 0
      ? recentWorkRates.reduce((a, b) => a + b, 0) / recentWorkRates.length
      : metrics.distancePerMinute;

    const earlyWorkRates = history.slice(0, 20).map(h => h.distancePerMinute);
    const avgEarlyWorkRate = earlyWorkRates.length > 0
      ? earlyWorkRates.reduce((a, b) => a + b, 0) / earlyWorkRates.length
      : metrics.distancePerMinute;

    // Work rate decline indicates fatigue
    const workRateDecline = avgEarlyWorkRate > 0
      ? ((avgEarlyWorkRate - avgRecentWorkRate) / avgEarlyWorkRate) * 100
      : 0;

    // Fatigue level based on decline and minute
    let currentLevel = Math.max(0, Math.min(100,
      workRateDecline * 2 + (minute > 70 ? 20 : minute > 50 ? 10 : 0)
    ));

    // Performance impact
    let performanceImpact: TacticalMeaning['fatigue']['performanceImpact'];
    if (currentLevel < 30) performanceImpact = 'none';
    else if (currentLevel < 50) performanceImpact = 'minor';
    else if (currentLevel < 70) performanceImpact = 'moderate';
    else performanceImpact = 'significant';

    // Recommendation
    let recommendAction: string;
    if (performanceImpact === 'significant') {
      recommendAction = 'Consider immediate substitution';
    } else if (performanceImpact === 'moderate') {
      recommendAction = 'Monitor closely - prepare substitute';
    } else if (performanceImpact === 'minor') {
      recommendAction = 'Reduce pressing demands';
    } else {
      recommendAction = 'Continue as normal';
    }

    // Sustainable minutes estimation
    const sustainableMinutes = Math.max(0, 90 - minute - Math.floor(currentLevel / 10));

    return {
      currentLevel,
      performanceImpact,
      recommendAction,
      sustainableMinutes,
    };
  }

  // ==================== Summary Generation ====================

  private generateSummary(
    player: Player,
    pressing: TacticalMeaning['pressing'],
    position: TacticalMeaning['position'],
    workRate: TacticalMeaning['workRate'],
    transition: TacticalMeaning['transition'],
    fatigue: TacticalMeaning['fatigue']
  ): string {
    const parts: string[] = [];

    // Pressing assessment
    if (pressing.pressingIntensityRating === 'excellent') {
      parts.push('Pressing excellently');
    } else if (pressing.pressingIntensityRating === 'poor') {
      parts.push('Pressing intensity too low');
    }

    // Position assessment
    if (position.structuralContribution === 'breaking') {
      parts.push('Breaking shape - needs to hold position');
    } else if (position.structuralContribution === 'maintaining') {
      parts.push('Holding position well');
    }

    // Work rate context
    const efficiencyRatio = workRate.effectiveDistance / (workRate.effectiveDistance + workRate.wastedRuns);
    if (efficiencyRatio < 0.5) {
      parts.push('Running a lot but not smart');
    } else if (efficiencyRatio > 0.7) {
      parts.push('Running smart');
    }

    // Transition
    if (transition.contribution === 'key') {
      parts.push('Key in transitions');
    } else if (transition.contribution === 'absent') {
      parts.push('Not contributing to transitions');
    }

    // Fatigue
    if (fatigue.performanceImpact === 'significant') {
      parts.push('Significant fatigue - needs rest');
    }

    if (parts.length === 0) {
      return 'Performing within tactical parameters';
    }

    return parts.join('. ') + '.';
  }

  // ==================== Action Items ====================

  private generateActionItems(
    player: Player,
    meaning: TacticalMeaning,
    minute: number
  ): ActionItem[] {
    const items: ActionItem[] = [];

    // Pressing issues
    if (meaning.pressing.pressingIntensityRating === 'poor') {
      items.push({
        priority: 'high',
        type: 'instruction',
        message: `${player.name}: increase pressing intensity`,
        targetPlayer: player.id,
      });
    }

    // Position issues
    if (meaning.position.structuralContribution === 'breaking') {
      items.push({
        priority: 'high',
        type: 'instruction',
        message: `${player.name}: hold your position - don't break the line`,
        targetPlayer: player.id,
      });
    }

    // Fatigue issues
    if (meaning.fatigue.performanceImpact === 'significant') {
      items.push({
        priority: 'high',
        type: 'substitution',
        message: `Substitute ${player.name} - significant fatigue`,
        targetPlayer: player.id,
      });
    } else if (meaning.fatigue.performanceImpact === 'moderate' && minute > 65) {
      items.push({
        priority: 'medium',
        type: 'substitution',
        message: `Prepare substitute for ${player.name}`,
        targetPlayer: player.id,
      });
    }

    // Work rate issues
    if (meaning.workRate.effectiveDistance < meaning.workRate.wastedRuns) {
      items.push({
        priority: 'medium',
        type: 'instruction',
        message: `${player.name}: run smarter, not harder - stay compact`,
        targetPlayer: player.id,
      });
    }

    // Transition contribution
    if (meaning.transition.contribution === 'absent') {
      items.push({
        priority: 'medium',
        type: 'instruction',
        message: `${player.name}: must be involved in transitions`,
        targetPlayer: player.id,
      });
    }

    return items.slice(0, 3); // Max 3 items per player
  }

  // ==================== Team Summary ====================

  interpretTeamData(
    interpretations: TacticalInterpretation[],
    gameModelTargets: { verticalCompactness: number; pressingIntensity: number }
  ): TeamTacticalSummary {
    // Pressing analysis
    const pressingScores = interpretations.map(i =>
      i.tacticalMeaning.pressing.pressingIntensityRating === 'excellent' ? 100 :
      i.tacticalMeaning.pressing.pressingIntensityRating === 'good' ? 75 :
      i.tacticalMeaning.pressing.pressingIntensityRating === 'adequate' ? 50 : 25
    );
    const teamPressingIntensity = pressingScores.reduce((a, b) => a + b, 0) / pressingScores.length;

    // Shape analysis
    const positions = interpretations.map(i => ({
      deviation: i.tacticalMeaning.position.positionDeviation,
      structural: i.tacticalMeaning.position.structuralContribution,
    }));

    const avgDeviation = positions.reduce((a, b) => a + b.deviation, 0) / positions.length;
    const breakingCount = positions.filter(p => p.structural === 'breaking').length;

    // Efficiency analysis
    const totalDistance = interpretations.reduce((sum, i) => sum + i.rawMetrics.totalDistance, 0);
    const effectiveDistance = interpretations.reduce(
      (sum, i) => sum + i.tacticalMeaning.workRate.effectiveDistance, 0
    );
    const wastedDistance = interpretations.reduce(
      (sum, i) => sum + i.tacticalMeaning.workRate.wastedRuns, 0
    );
    const efficiencyRating = Math.round(
      (effectiveDistance / (effectiveDistance + wastedDistance)) * 100
    );

    // Generate insights
    const insights = this.generateTeamInsights(
      interpretations,
      teamPressingIntensity,
      avgDeviation,
      efficiencyRating
    );

    // Generate adjustments
    const adjustments = this.generateTeamAdjustments(
      interpretations,
      teamPressingIntensity,
      gameModelTargets
    );

    // Determine gaps
    const gaps: TeamTacticalSummary['shape']['gapsIdentified'] = [];
    if (breakingCount > 2) {
      gaps.push({
        location: 'Multiple players out of position',
        severity: 'critical',
      });
    }

    return {
      pressing: {
        teamPressingIntensity,
        pressTriggersActivated: interpretations.reduce(
          (sum, i) => sum + i.tacticalMeaning.pressing.pressTriggerResponses, 0
        ),
        successfulPressCount: 0,
        failedPressCount: 0,
        coverShadowCoverage: interpretations.filter(
          i => i.tacticalMeaning.pressing.coverShadowMaintained
        ).length / interpretations.length * 100,
        pressingLine: 50,
      },
      shape: {
        compactnessScore: Math.max(0, 100 - avgDeviation * 2),
        verticalDistance: avgDeviation * 2,
        horizontalWidth: 35,
        linesConnected: breakingCount < 2,
        gapsIdentified: gaps,
      },
      transitions: {
        positiveTransitions: 0,
        negativeTransitions: 0,
        averageCounterPressTime: 4.5,
        averageAttackingTransitionTime: 5.0,
        counterPressSuccessRate: 50,
        directPlayPercentage: 40,
      },
      efficiency: {
        totalTeamDistance: totalDistance,
        effectiveDistance,
        wastedDistance,
        efficiencyRating,
        message: efficiencyRating > 70
          ? 'Team running smart - effective use of energy'
          : efficiencyRating > 50
          ? 'Adequate efficiency - some unnecessary runs'
          : 'Too much running without purpose - need to be smarter',
      },
      insights,
      adjustments,
    };
  }

  private generateTeamInsights(
    interpretations: TacticalInterpretation[],
    pressingIntensity: number,
    avgDeviation: number,
    efficiency: number
  ): string[] {
    const insights: string[] = [];

    // Pressing insight
    if (pressingIntensity < 60) {
      insights.push('Pressing intensity below target - need more aggression on triggers');
    } else if (pressingIntensity > 80) {
      insights.push('Pressing intensity excellent - maintaining high energy');
    }

    // Shape insight
    if (avgDeviation > 15) {
      insights.push('Shape is too stretched - players drifting from positions');
    } else if (avgDeviation < 8) {
      insights.push('Excellent compactness - shape being maintained well');
    }

    // Efficiency insight (the key one for Corberán)
    if (efficiency < 50) {
      insights.push('Running hard but not smart - distance not translating to tactical advantage');
    } else if (efficiency > 75) {
      insights.push('Excellent efficiency - every run has purpose');
    }

    // Fatigue insight
    const fatiguedPlayers = interpretations.filter(
      i => i.tacticalMeaning.fatigue.performanceImpact === 'significant'
    );
    if (fatiguedPlayers.length > 0) {
      const names = fatiguedPlayers.map(p => p.playerName.split(' ').pop()).join(', ');
      insights.push(`Fatigue concerns: ${names}`);
    }

    // Transition insight
    const avgTransitionContrib = interpretations.filter(
      i => i.tacticalMeaning.transition.contribution === 'key' ||
           i.tacticalMeaning.transition.contribution === 'supporting'
    ).length / interpretations.length * 100;

    if (avgTransitionContrib < 50) {
      insights.push('Need more players involved in transitions');
    }

    return insights.slice(0, 5);
  }

  private generateTeamAdjustments(
    interpretations: TacticalInterpretation[],
    pressingIntensity: number,
    targets: { verticalCompactness: number; pressingIntensity: number }
  ): ActionItem[] {
    const adjustments: ActionItem[] = [];

    if (pressingIntensity < targets.pressingIntensity - 20) {
      adjustments.push({
        priority: 'high',
        type: 'instruction',
        message: 'Team: increase pressing intensity - react to triggers faster',
      });
    }

    const breakingPlayers = interpretations.filter(
      i => i.tacticalMeaning.position.structuralContribution === 'breaking'
    );
    if (breakingPlayers.length > 2) {
      adjustments.push({
        priority: 'high',
        type: 'formation',
        message: 'Multiple players out of position - call for compact shape',
      });
    }

    const fatiguedCount = interpretations.filter(
      i => i.tacticalMeaning.fatigue.performanceImpact === 'moderate' ||
           i.tacticalMeaning.fatigue.performanceImpact === 'significant'
    ).length;

    if (fatiguedCount >= 3) {
      adjustments.push({
        priority: 'high',
        type: 'substitution',
        message: 'Multiple players fatigued - consider fresh legs',
      });
    }

    return adjustments;
  }

  // ==================== Tactical Efficiency Calculation ====================

  private calculateTacticalEfficiency(meaning: TacticalMeaning): number {
    // Calculate overall tactical efficiency (0-100)
    // This answers Corberán's key question: "Are they running smart, not just hard?"
    let score = 0;

    // Pressing contribution (25 points)
    const pressingScore =
      meaning.pressing.pressingIntensityRating === 'excellent' ? 25 :
      meaning.pressing.pressingIntensityRating === 'good' ? 20 :
      meaning.pressing.pressingIntensityRating === 'adequate' ? 12 : 5;
    score += pressingScore;

    // Position discipline (25 points)
    const positionScore = Math.min(25, Math.max(0, meaning.position.timeInZone / 4));
    score += positionScore;

    // Work rate efficiency (25 points)
    const workEfficiency = meaning.workRate.effectiveDistance /
      (meaning.workRate.effectiveDistance + meaning.workRate.wastedRuns + 0.1);
    score += workEfficiency * 25;

    // Transition contribution (25 points)
    const transitionScore =
      meaning.transition.contribution === 'key' ? 25 :
      meaning.transition.contribution === 'supporting' ? 18 :
      meaning.transition.contribution === 'minimal' ? 10 : 3;
    score += transitionScore;

    // Fatigue penalty (reduce score if fatigued)
    if (meaning.fatigue.performanceImpact === 'significant') {
      score *= 0.7;
    } else if (meaning.fatigue.performanceImpact === 'moderate') {
      score *= 0.85;
    }

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  // ==================== Utility ====================

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  // ==================== Corberán-Specific Helpers ====================

  translateForPlayer(interpretation: TacticalInterpretation): string {
    // Translate tactical feedback into simple player language
    // (Corberán's frustration: explaining Digital Twin concepts to players)
    const meaning = interpretation.tacticalMeaning;
    const parts: string[] = [];

    if (meaning.pressing.pressingIntensityRating === 'poor') {
      parts.push('You need to close down faster when they have the ball');
    }

    if (meaning.position.structuralContribution === 'breaking') {
      parts.push('Stay in your zone - we need you to hold the shape');
    }

    if (meaning.workRate.wastedRuns > meaning.workRate.effectiveDistance) {
      parts.push("Don't just run everywhere - stay compact and pick your moments");
    }

    if (meaning.transition.contribution === 'absent') {
      parts.push('When we win the ball, make a run forward. When we lose it, get back quick');
    }

    if (meaning.fatigue.performanceImpact === 'significant') {
      parts.push("You're tired - we'll get you off soon");
    }

    if (parts.length === 0) {
      return 'Keep doing what you are doing - good work';
    }

    return parts.join('. ') + '.';
  }
}

// ==================== Factory ====================

export function createGPSTacticalBridge(persona?: CoachPersona): GPSTacticalBridge {
  return new GPSTacticalBridge(persona || CARLOS_CORBERAN_PERSONA);
}
