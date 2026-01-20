// Digital Twin System for Player Modeling

import {
  Player,
  DigitalTwin,
  TwinState,
  BehaviorModel,
  PerformanceBaseline,
  TrackingMetrics,
  GameModel,
  PlayerInstruction,
  FormationPosition,
  MovementPattern,
  DecisionTendency,
  PhysicalLimits,
  ReactionTimes,
  HistoricalTrend,
  Adaptation,
} from '@/types';
import { calculateTwinState } from './wearable-analytics';

// ==================== Digital Twin Creation ====================

export function createDigitalTwin(
  player: Player,
  historicalData: TrackingMetrics[]
): DigitalTwin {
  const baseline = calculatePerformanceBaseline(historicalData);
  const behaviorModel = analyzeBehaviorPatterns(historicalData, player.position);

  return {
    id: `twin-${player.id}`,
    playerId: player.id,
    lastUpdated: new Date(),
    currentState: {
      fatigue: 0,
      readiness: 100,
      confidenceLevel: 85,
      currentWorkRate: 100,
      positionAdherence: 100,
      tacticalCompliance: 100,
    },
    behaviorModel,
    performanceBaseline: baseline,
    adaptations: [],
  };
}

// ==================== Performance Baseline ====================

export function calculatePerformanceBaseline(
  historicalData: TrackingMetrics[]
): PerformanceBaseline {
  if (historicalData.length === 0) {
    return {
      averageMetrics: getDefaultMetrics(),
      peakMetrics: getDefaultMetrics(),
      historicalTrends: [],
    };
  }

  // Calculate average metrics
  const averageMetrics: TrackingMetrics = {
    totalDistance: avg(historicalData.map(d => d.totalDistance)),
    distancePerMinute: avg(historicalData.map(d => d.distancePerMinute)),
    highSpeedRunningDistance: avg(historicalData.map(d => d.highSpeedRunningDistance)),
    sprintDistance: avg(historicalData.map(d => d.sprintDistance)),
    walkingDistance: avg(historicalData.map(d => d.walkingDistance)),
    joggingDistance: avg(historicalData.map(d => d.joggingDistance)),
    runningDistance: avg(historicalData.map(d => d.runningDistance)),
    currentSpeed: 0,
    averageSpeed: avg(historicalData.map(d => d.averageSpeed)),
    maxSpeed: avg(historicalData.map(d => d.maxSpeed)),
    speedZones: {
      zone1: avg(historicalData.map(d => d.speedZones.zone1)),
      zone2: avg(historicalData.map(d => d.speedZones.zone2)),
      zone3: avg(historicalData.map(d => d.speedZones.zone3)),
      zone4: avg(historicalData.map(d => d.speedZones.zone4)),
      zone5: avg(historicalData.map(d => d.speedZones.zone5)),
      zone6: avg(historicalData.map(d => d.speedZones.zone6)),
    },
    accelerations: {
      low: avg(historicalData.map(d => d.accelerations.low)),
      medium: avg(historicalData.map(d => d.accelerations.medium)),
      high: avg(historicalData.map(d => d.accelerations.high)),
      total: avg(historicalData.map(d => d.accelerations.total)),
    },
    decelerations: {
      low: avg(historicalData.map(d => d.decelerations.low)),
      medium: avg(historicalData.map(d => d.decelerations.medium)),
      high: avg(historicalData.map(d => d.decelerations.high)),
      total: avg(historicalData.map(d => d.decelerations.total)),
    },
    maxAcceleration: avg(historicalData.map(d => d.maxAcceleration)),
    maxDeceleration: avg(historicalData.map(d => d.maxDeceleration)),
    playerLoad: avg(historicalData.map(d => d.playerLoad)),
    playerLoadPerMinute: avg(historicalData.map(d => d.playerLoadPerMinute)),
    metabolicPower: avg(historicalData.map(d => d.metabolicPower)),
    highMetabolicLoadDistance: avg(historicalData.map(d => d.highMetabolicLoadDistance)),
    position: historicalData[historicalData.length - 1].position,
  };

  // Calculate peak metrics
  const peakMetrics: TrackingMetrics = {
    ...averageMetrics,
    totalDistance: Math.max(...historicalData.map(d => d.totalDistance)),
    highSpeedRunningDistance: Math.max(...historicalData.map(d => d.highSpeedRunningDistance)),
    sprintDistance: Math.max(...historicalData.map(d => d.sprintDistance)),
    maxSpeed: Math.max(...historicalData.map(d => d.maxSpeed)),
    maxAcceleration: Math.max(...historicalData.map(d => d.maxAcceleration)),
    playerLoad: Math.max(...historicalData.map(d => d.playerLoad)),
  };

  return {
    averageMetrics,
    peakMetrics,
    historicalTrends: calculateTrends(historicalData),
  };
}

function calculateTrends(historicalData: TrackingMetrics[]): HistoricalTrend[] {
  // Simplified trend calculation
  const metrics = ['totalDistance', 'highSpeedRunningDistance', 'sprintDistance', 'playerLoad'];

  return metrics.map(metric => {
    const values = historicalData.map((d, i) => ({
      date: new Date(Date.now() - (historicalData.length - i) * 7 * 24 * 60 * 60 * 1000),
      value: (d as unknown as Record<string, number>)[metric] || 0,
    }));

    // Simple linear regression for trend
    const n = values.length;
    const sumX = values.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, v) => sum + v.value, 0);
    const sumXY = values.reduce((sum, v, i) => sum + i * v.value, 0);
    const sumX2 = values.reduce((sum, _, i) => sum + i * i, 0);

    const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (slope > 0.05) trend = 'improving';
    else if (slope < -0.05) trend = 'declining';

    return {
      metric,
      period: 'weekly' as const,
      values,
      trend,
    };
  });
}

// ==================== Behavior Analysis ====================

export function analyzeBehaviorPatterns(
  historicalData: TrackingMetrics[],
  position: string
): BehaviorModel {
  // Analyze movement patterns from historical data
  const movementPatterns: MovementPattern[] = [
    {
      type: 'sprint',
      frequency: avg(historicalData.map(d => d.accelerations.high)) / 90,
      avgDuration: 3.5,
      avgDistance: avg(historicalData.map(d => d.sprintDistance)) / Math.max(1, avg(historicalData.map(d => d.accelerations.high))),
      conditions: ['space_available', 'counter_attack', 'pressing_trigger'],
    },
    {
      type: 'recovery_run',
      frequency: avg(historicalData.map(d => d.decelerations.total)) / 90,
      avgDuration: 5,
      avgDistance: 15,
      conditions: ['loss_of_possession', 'defensive_transition'],
    },
    {
      type: 'positional_movement',
      frequency: 45,
      avgDuration: 10,
      avgDistance: avg(historicalData.map(d => d.joggingDistance)) / 45,
      conditions: ['in_possession', 'shape_maintenance'],
    },
  ];

  // Position-based decision tendencies
  const decisionTendencies = getPositionDecisionTendencies(position);

  // Physical limits from data
  const physicalLimits: PhysicalLimits = {
    maxSustainableSpeed: avg(historicalData.map(d => d.averageSpeed)) * 1.5,
    sprintRecoveryTime: 45, // seconds
    highIntensityCapacity: avg(historicalData.map(d => d.highSpeedRunningDistance)),
    fatigueThreshold: avg(historicalData.map(d => d.playerLoad)) * 1.2,
  };

  const reactionTimes: ReactionTimes = {
    pressureTrigger: 800,
    transitionResponse: 1200,
    positionalAdjustment: 500,
  };

  return {
    movementPatterns,
    decisionTendencies,
    physicalLimits,
    reactionTimes,
  };
}

function getPositionDecisionTendencies(position: string): DecisionTendency[] {
  const baseDecisions: DecisionTendency[] = [
    {
      situation: 'receiving_ball_under_pressure',
      likelyAction: 'quick_pass',
      probability: 0.6,
      alternatives: [
        { action: 'turn', probability: 0.2 },
        { action: 'shield', probability: 0.15 },
        { action: 'first_time_pass', probability: 0.05 },
      ],
    },
    {
      situation: 'space_ahead',
      likelyAction: 'progressive_carry',
      probability: 0.5,
      alternatives: [
        { action: 'pass_forward', probability: 0.3 },
        { action: 'hold', probability: 0.2 },
      ],
    },
  ];

  // Add position-specific tendencies
  if (['ST', 'CF'].includes(position)) {
    baseDecisions.push({
      situation: 'in_box',
      likelyAction: 'shoot',
      probability: 0.7,
      alternatives: [
        { action: 'pass', probability: 0.2 },
        { action: 'dribble', probability: 0.1 },
      ],
    });
  }

  if (['CB', 'GK'].includes(position)) {
    baseDecisions.push({
      situation: 'ball_in_defensive_third',
      likelyAction: 'clear',
      probability: 0.4,
      alternatives: [
        { action: 'play_short', probability: 0.35 },
        { action: 'long_ball', probability: 0.25 },
      ],
    });
  }

  return baseDecisions;
}

// ==================== Twin State Updates ====================

export function updateTwinState(
  twin: DigitalTwin,
  currentMetrics: TrackingMetrics,
  matchMinute: number,
  gameModel?: GameModel,
  expectedPosition?: { x: number; y: number }
): DigitalTwin {
  const baseState = calculateTwinState(
    currentMetrics,
    twin.performanceBaseline.averageMetrics,
    matchMinute
  );

  // Calculate position adherence
  let positionAdherence = 100;
  if (expectedPosition && currentMetrics.position) {
    const distance = Math.sqrt(
      Math.pow(currentMetrics.position.x - expectedPosition.x, 2) +
      Math.pow(currentMetrics.position.y - expectedPosition.y, 2)
    );
    // 10m tolerance = 100%, 30m+ = 0%
    positionAdherence = Math.max(0, 100 - (distance - 10) * 5);
  }

  // Calculate tactical compliance
  let tacticalCompliance = 85; // Default
  if (gameModel) {
    tacticalCompliance = calculateTacticalCompliance(
      twin,
      currentMetrics,
      gameModel,
      matchMinute
    );
  }

  return {
    ...twin,
    lastUpdated: new Date(),
    currentState: {
      ...baseState,
      positionAdherence,
      tacticalCompliance,
    },
  };
}

function calculateTacticalCompliance(
  twin: DigitalTwin,
  metrics: TrackingMetrics,
  gameModel: GameModel,
  matchMinute: number
): number {
  let score = 100;
  const playerInstruction = gameModel.playerInstructions.get(twin.playerId);

  if (!playerInstruction) return 85;

  // Check physical requirements
  const physReq = playerInstruction.physicalRequirements;
  const expectedMinuteDistance = (physReq.expectedDistance.min + physReq.expectedDistance.max) / 2 / 90;
  const actualDistance = metrics.totalDistance / Math.max(1, matchMinute);

  const distanceRatio = actualDistance / expectedMinuteDistance;
  if (distanceRatio < 0.8) score -= 15;
  else if (distanceRatio < 0.9) score -= 5;

  // Check sprint count
  const expectedMinuteSprints = (physReq.expectedSprints.min + physReq.expectedSprints.max) / 2 / 90;
  const actualSprints = metrics.accelerations.high / Math.max(1, matchMinute);

  const sprintRatio = actualSprints / Math.max(0.1, expectedMinuteSprints);
  if (sprintRatio < 0.7) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ==================== Prediction Functions ====================

export function predictFatigueCurve(
  twin: DigitalTwin,
  remainingMinutes: number
): { minute: number; fatigue: number }[] {
  const curve: { minute: number; fatigue: number }[] = [];
  const currentFatigue = twin.currentState.fatigue;
  const fatigueRate = 0.8; // fatigue increase per minute under normal load

  for (let m = 0; m <= remainingMinutes; m += 5) {
    const predictedFatigue = Math.min(100, currentFatigue + m * fatigueRate);
    curve.push({ minute: m, fatigue: predictedFatigue });
  }

  return curve;
}

export function predictPerformanceDecline(
  twin: DigitalTwin,
  currentMinute: number
): {
  expectedSpeedReduction: number;
  expectedDistanceReduction: number;
  recommendedSubstitutionWindow: { start: number; end: number };
} {
  const fatigue = twin.currentState.fatigue;
  const baseline = twin.performanceBaseline.averageMetrics;

  // Speed reduction based on fatigue
  const speedReduction = fatigue > 70 ? (fatigue - 70) * 0.5 : 0;

  // Distance capacity reduction
  const distanceReduction = fatigue > 60 ? (fatigue - 60) * 0.3 : 0;

  // Calculate recommended substitution window
  const fatigueThreshold = twin.behaviorModel.physicalLimits.fatigueThreshold;
  const currentLoad = twin.currentState.fatigue / 100 * fatigueThreshold;
  const minutesToThreshold = (fatigueThreshold - currentLoad) / (fatigueThreshold / 90);

  return {
    expectedSpeedReduction: speedReduction,
    expectedDistanceReduction: distanceReduction,
    recommendedSubstitutionWindow: {
      start: Math.max(currentMinute, currentMinute + minutesToThreshold - 10),
      end: Math.min(90, currentMinute + minutesToThreshold + 5),
    },
  };
}

// ==================== Adaptation Recording ====================

export function recordAdaptation(
  twin: DigitalTwin,
  adaptation: Omit<Adaptation, 'id' | 'date'>
): DigitalTwin {
  const newAdaptation: Adaptation = {
    ...adaptation,
    id: `adapt-${Date.now()}`,
    date: new Date(),
  };

  return {
    ...twin,
    adaptations: [...twin.adaptations, newAdaptation],
    lastUpdated: new Date(),
  };
}

// ==================== Utilities ====================

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function getDefaultMetrics(): TrackingMetrics {
  return {
    totalDistance: 10000,
    distancePerMinute: 111,
    highSpeedRunningDistance: 800,
    sprintDistance: 300,
    walkingDistance: 2000,
    joggingDistance: 4000,
    runningDistance: 3700,
    currentSpeed: 0,
    averageSpeed: 7,
    maxSpeed: 32,
    speedZones: { zone1: 20, zone2: 25, zone3: 25, zone4: 15, zone5: 10, zone6: 5 },
    accelerations: { low: 50, medium: 30, high: 15, total: 95 },
    decelerations: { low: 50, medium: 30, high: 15, total: 95 },
    maxAcceleration: 4.5,
    maxDeceleration: -4.2,
    playerLoad: 450,
    playerLoadPerMinute: 5,
    metabolicPower: 12,
    highMetabolicLoadDistance: 1100,
    position: {
      x: 0,
      y: 0,
      zone: 'middle_third',
      heatmap: { cells: [], resolution: { x: 21, y: 14 } },
    },
  };
}

// ==================== Export Digital Twin for External Use ====================

export function serializeDigitalTwin(twin: DigitalTwin): string {
  return JSON.stringify(twin, (key, value) => {
    if (value instanceof Map) {
      return {
        dataType: 'Map',
        value: Array.from(value.entries()),
      };
    }
    if (value instanceof Date) {
      return { dataType: 'Date', value: value.toISOString() };
    }
    return value;
  });
}

export function deserializeDigitalTwin(json: string): DigitalTwin {
  return JSON.parse(json, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (value.dataType === 'Map') {
        return new Map(value.value);
      }
      if (value.dataType === 'Date') {
        return new Date(value.value);
      }
    }
    return value;
  });
}
