// Advanced Composite Scoring Engine
// Market-leading multi-dimensional coherence scoring system
// Implements Bayesian inference, temporal analysis, and ensemble methods

import {
  AdvancedGameModel,
  AdvancedGameModelEngine,
  CoherenceWeightConfig,
  RealtimeContext,
  ResolvedGameModel,
} from './advanced-game-model';
import {
  PlayerAnalyticsData,
  TeamAnalyticsData,
  TacticalAnalyticsData,
  RealTimeAnalyticsData,
} from './realtime-analytics-bridge';
import {
  GameModel,
  LivePlayerData,
  CoherenceReport,
  TacticalDeviation,
  CriticalDeviation,
  DigitalTwin,
  TrackingMetrics,
} from '@/types';

// ==================== Core Scoring Types ====================

export interface CompositeScore {
  overall: number;
  confidence: number;
  dimensions: DimensionalScores;
  breakdown: ScoreBreakdown;
  temporal: TemporalAnalysis;
  bayesian: BayesianMetrics;
  ensemble: EnsembleResult;
  diagnostics: ScoringDiagnostics;
}

export interface DimensionalScores {
  // Spatial dimensions
  positional: DimensionScore;
  formation: DimensionScore;
  zonal: DimensionScore;

  // Physical dimensions
  intensity: DimensionScore;
  workRate: DimensionScore;
  fatigue: DimensionScore;

  // Tactical dimensions
  roleExecution: DimensionScore;
  phaseCompliance: DimensionScore;
  principleAdherence: DimensionScore;

  // Collective dimensions
  teamShape: DimensionScore;
  collectiveMovement: DimensionScore;
  synchronization: DimensionScore;

  // Strategic dimensions
  pressureCohesion: DimensionScore;
  transitionReadiness: DimensionScore;
  adaptability: DimensionScore;
}

export interface DimensionScore {
  value: number;
  weight: number;
  weightedValue: number;
  confidence: number;
  trend: 'improving' | 'stable' | 'declining';
  subComponents: SubComponentScore[];
}

export interface SubComponentScore {
  name: string;
  value: number;
  contribution: number;
  anomaly: boolean;
}

export interface ScoreBreakdown {
  byPlayer: Map<string, PlayerCompositeScore>;
  byPhase: Map<string, number>;
  byPrinciple: Map<string, number>;
  byZone: Map<string, number>;
  byTimeWindow: TimeWindowScore[];
}

export interface PlayerCompositeScore {
  playerId: string;
  overall: number;
  dimensions: Partial<DimensionalScores>;
  deviations: TacticalDeviation[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface TimeWindowScore {
  startMinute: number;
  endMinute: number;
  score: number;
  trend: number;
  events: string[];
}

export interface TemporalAnalysis {
  currentScore: number;
  movingAverage: number;
  exponentialMovingAverage: number;
  volatility: number;
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  predictions: PredictionSet;
}

export interface TrendAnalysis {
  shortTerm: number; // Last 5 minutes
  mediumTerm: number; // Last 15 minutes
  longTerm: number; // Since start
  direction: 'up' | 'down' | 'flat';
  strength: number;
  changePoints: number[];
}

export interface MomentumAnalysis {
  value: number;
  acceleration: number;
  sustainedPeriod: number;
  reversingProbability: number;
}

export interface PredictionSet {
  next5Minutes: PredictedScore;
  next15Minutes: PredictedScore;
  endOfHalf: PredictedScore;
  scenarios: ScenarioPrediction[];
}

export interface PredictedScore {
  mean: number;
  lower95: number;
  upper95: number;
  confidence: number;
}

export interface ScenarioPrediction {
  scenario: string;
  probability: number;
  projectedScore: number;
  keyFactors: string[];
}

export interface BayesianMetrics {
  priorScore: number;
  likelihood: number;
  posteriorScore: number;
  evidenceStrength: number;
  beliefUpdate: number;
  uncertaintyReduction: number;
  informationGain: number;
}

export interface EnsembleResult {
  finalScore: number;
  modelScores: ModelScore[];
  agreementLevel: number;
  outlierModels: string[];
  weightedConsensus: number;
}

export interface ModelScore {
  modelName: string;
  score: number;
  weight: number;
  confidence: number;
}

export interface ScoringDiagnostics {
  computationTime: number;
  dataQuality: DataQualityMetrics;
  missingData: string[];
  anomalies: Anomaly[];
  warnings: string[];
}

export interface DataQualityMetrics {
  completeness: number;
  freshness: number;
  consistency: number;
  accuracy: number;
  overall: number;
}

export interface Anomaly {
  type: string;
  metric: string;
  expectedRange: [number, number];
  actualValue: number;
  severity: 'low' | 'medium' | 'high';
}

// ==================== Composite Scoring Engine ====================

export class CompositeScoringEngine {
  private historicalScores: ScoreHistory[] = [];
  private bayesianPriors: Map<string, number> = new Map();
  private ensembleWeights: Map<string, number> = new Map();
  private anomalyDetector: AnomalyDetector;
  private trendAnalyzer: TrendAnalyzer;
  private predictionEngine: PredictionEngine;
  private config: ScoringConfig;

  constructor(config?: Partial<ScoringConfig>) {
    this.config = {
      historyWindowSize: config?.historyWindowSize ?? 100,
      bayesianPriorStrength: config?.bayesianPriorStrength ?? 0.3,
      ensembleModels: config?.ensembleModels ?? ['weighted', 'bayesian', 'temporal', 'adaptive'],
      anomalyThreshold: config?.anomalyThreshold ?? 2.5,
      predictionHorizon: config?.predictionHorizon ?? 15,
      smoothingFactor: config?.smoothingFactor ?? 0.3,
      minDataPoints: config?.minDataPoints ?? 5,
    };

    this.anomalyDetector = new AnomalyDetector(this.config.anomalyThreshold);
    this.trendAnalyzer = new TrendAnalyzer();
    this.predictionEngine = new PredictionEngine(this.config.predictionHorizon);

    this.initializeEnsembleWeights();
    this.initializeBayesianPriors();
  }

  // Main scoring method
  calculateCompositeScore(
    analyticsData: RealTimeAnalyticsData,
    resolvedModel: ResolvedGameModel,
    context: RealtimeContext,
    digitalTwins: Map<string, DigitalTwin>
  ): CompositeScore {
    const startTime = performance.now();

    // Calculate dimensional scores
    const dimensions = this.calculateDimensionalScores(
      analyticsData,
      resolvedModel,
      context,
      digitalTwins
    );

    // Calculate breakdown scores
    const breakdown = this.calculateBreakdown(
      analyticsData,
      resolvedModel,
      dimensions
    );

    // Perform temporal analysis
    const temporal = this.performTemporalAnalysis(dimensions);

    // Bayesian inference
    const bayesian = this.performBayesianInference(dimensions, context);

    // Ensemble scoring
    const ensemble = this.calculateEnsembleScore(dimensions, temporal, bayesian);

    // Calculate overall score
    const overall = this.calculateOverallScore(dimensions, resolvedModel.coherenceWeights);

    // Calculate confidence
    const confidence = this.calculateConfidence(dimensions, analyticsData);

    // Run diagnostics
    const diagnostics = this.runDiagnostics(
      analyticsData,
      dimensions,
      startTime
    );

    // Store in history
    this.updateHistory({
      timestamp: new Date(),
      minute: context.matchMinute,
      overall,
      dimensions,
    });

    return {
      overall,
      confidence,
      dimensions,
      breakdown,
      temporal,
      bayesian,
      ensemble,
      diagnostics,
    };
  }

  // Calculate all dimensional scores
  private calculateDimensionalScores(
    analyticsData: RealTimeAnalyticsData,
    resolvedModel: ResolvedGameModel,
    context: RealtimeContext,
    digitalTwins: Map<string, DigitalTwin>
  ): DimensionalScores {
    const weights = resolvedModel.coherenceWeights;

    return {
      // Spatial dimensions
      positional: this.calculatePositionalDimension(analyticsData, resolvedModel, weights),
      formation: this.calculateFormationDimension(analyticsData, resolvedModel, weights),
      zonal: this.calculateZonalDimension(analyticsData, resolvedModel),

      // Physical dimensions
      intensity: this.calculateIntensityDimension(analyticsData, digitalTwins, weights),
      workRate: this.calculateWorkRateDimension(analyticsData, digitalTwins, weights),
      fatigue: this.calculateFatigueDimension(analyticsData, digitalTwins),

      // Tactical dimensions
      roleExecution: this.calculateRoleExecutionDimension(analyticsData, resolvedModel, weights),
      phaseCompliance: this.calculatePhaseComplianceDimension(analyticsData, resolvedModel, context, weights),
      principleAdherence: this.calculatePrincipleAdherenceDimension(analyticsData, resolvedModel, weights),

      // Collective dimensions
      teamShape: this.calculateTeamShapeDimension(analyticsData, resolvedModel, weights),
      collectiveMovement: this.calculateCollectiveMovementDimension(analyticsData),
      synchronization: this.calculateSynchronizationDimension(analyticsData, resolvedModel),

      // Strategic dimensions
      pressureCohesion: this.calculatePressureCohesionDimension(analyticsData, resolvedModel, weights),
      transitionReadiness: this.calculateTransitionReadinessDimension(analyticsData, context, weights),
      adaptability: this.calculateAdaptabilityDimension(context),
    };
  }

  // Positional dimension scoring
  private calculatePositionalDimension(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const subComponents: SubComponentScore[] = [];
    let totalScore = 0;
    let count = 0;

    for (const [playerId, playerData] of data.playerMetrics) {
      const instruction = model.effectivePlayerInstructions.get(playerId);
      if (!instruction) continue;

      const expectedPosition = model.effectiveFormation.shape.positions.find(
        p => p.role === instruction.role
      );

      if (!expectedPosition) continue;

      // Calculate distance from expected position
      const dx = playerData.positional.currentX - ((expectedPosition.baseX / 100) * 105 - 52.5);
      const dy = playerData.positional.currentY - ((expectedPosition.baseY / 100) * 68 - 34);
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Score based on distance (max 30m tolerance)
      const posScore = Math.max(0, 100 - (distance / 30) * 100);

      subComponents.push({
        name: playerId,
        value: posScore,
        contribution: posScore / 100,
        anomaly: posScore < 40,
      });

      totalScore += posScore;
      count++;
    }

    const value = count > 0 ? totalScore / count : 50;
    const weight = weights.positionalAdherence;

    return {
      value,
      weight,
      weightedValue: value * weight,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('positional'),
      subComponents,
    };
  }

  // Formation dimension scoring
  private calculateFormationDimension(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const teamMetrics = data.teamMetrics;
    const expectedCompactness = model.effectiveFormation.compactness;
    const expectedWidth = model.effectiveFormation.width;

    const subComponents: SubComponentScore[] = [];

    // Vertical compactness score
    const verticalCompactness = teamMetrics.shape.depth;
    const verticalTarget = expectedCompactness.vertical.target;
    const verticalScore = this.calculateDeviationScore(
      verticalCompactness,
      verticalTarget,
      expectedCompactness.vertical.min,
      expectedCompactness.vertical.max
    );
    subComponents.push({
      name: 'vertical_compactness',
      value: verticalScore,
      contribution: 0.35,
      anomaly: verticalScore < 50,
    });

    // Horizontal compactness score
    const horizontalCompactness = teamMetrics.shape.width;
    const horizontalTarget = expectedCompactness.horizontal.target;
    const horizontalScore = this.calculateDeviationScore(
      horizontalCompactness,
      horizontalTarget,
      expectedCompactness.horizontal.min,
      expectedCompactness.horizontal.max
    );
    subComponents.push({
      name: 'horizontal_compactness',
      value: horizontalScore,
      contribution: 0.35,
      anomaly: horizontalScore < 50,
    });

    // Line spacing score
    const lineSpacing = teamMetrics.shape.defensiveLineHeight;
    const lineSpacingScore = Math.min(100, Math.max(0, lineSpacing / 40 * 100));
    subComponents.push({
      name: 'line_spacing',
      value: lineSpacingScore,
      contribution: 0.3,
      anomaly: lineSpacingScore < 40,
    });

    const value = subComponents.reduce((sum, sc) => sum + sc.value * sc.contribution, 0);
    const weight = weights.teamShape;

    return {
      value,
      weight,
      weightedValue: value * weight,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('formation'),
      subComponents,
    };
  }

  // Zonal dimension scoring
  private calculateZonalDimension(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel
  ): DimensionScore {
    const subComponents: SubComponentScore[] = [];

    // Define expected zone distributions
    const zones = ['defensive_third', 'middle_third', 'attacking_third'];
    const expectedDistribution: Record<string, number> = {
      defensive_third: 0.3,
      middle_third: 0.5,
      attacking_third: 0.2,
    };

    const actualDistribution: Record<string, number> = {
      defensive_third: 0,
      middle_third: 0,
      attacking_third: 0,
    };

    let totalPlayers = 0;
    for (const [, playerData] of data.playerMetrics) {
      const zone = playerData.positional.zoneOccupancy;
      if (zone in actualDistribution) {
        actualDistribution[zone]++;
        totalPlayers++;
      }
    }

    // Normalize
    for (const zone of zones) {
      actualDistribution[zone] = totalPlayers > 0 ? actualDistribution[zone] / totalPlayers : 0;
    }

    // Score each zone
    for (const zone of zones) {
      const expected = expectedDistribution[zone];
      const actual = actualDistribution[zone];
      const deviation = Math.abs(expected - actual);
      const zoneScore = Math.max(0, 100 - deviation * 200);

      subComponents.push({
        name: zone,
        value: zoneScore,
        contribution: expected,
        anomaly: zoneScore < 50,
      });
    }

    const value = subComponents.reduce((sum, sc) => sum + sc.value * sc.contribution, 0);

    return {
      value,
      weight: 0.05,
      weightedValue: value * 0.05,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('zonal'),
      subComponents,
    };
  }

  // Intensity dimension scoring
  private calculateIntensityDimension(
    data: RealTimeAnalyticsData,
    digitalTwins: Map<string, DigitalTwin>,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const subComponents: SubComponentScore[] = [];
    let totalScore = 0;
    let count = 0;

    for (const [playerId, playerData] of data.playerMetrics) {
      const twin = digitalTwins.get(playerId);
      if (!twin) continue;

      // Calculate intensity based on speed and metabolic power
      const currentIntensity = (playerData.physical.currentSpeed / 35) * 0.5 +
        (playerData.physical.metabolicPower / 30) * 0.5;

      // Expected intensity based on role
      const expectedIntensity = 0.6; // Base expectation

      const intensityScore = 100 - Math.abs(currentIntensity - expectedIntensity) * 100;

      subComponents.push({
        name: playerId,
        value: Math.max(0, Math.min(100, intensityScore)),
        contribution: 1 / data.playerMetrics.size,
        anomaly: intensityScore < 40,
      });

      totalScore += Math.max(0, Math.min(100, intensityScore));
      count++;
    }

    const value = count > 0 ? totalScore / count : 50;
    const weight = weights.physicalOutput;

    return {
      value,
      weight,
      weightedValue: value * weight,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('intensity'),
      subComponents,
    };
  }

  // Work rate dimension scoring
  private calculateWorkRateDimension(
    data: RealTimeAnalyticsData,
    digitalTwins: Map<string, DigitalTwin>,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const subComponents: SubComponentScore[] = [];
    let totalScore = 0;
    let count = 0;

    for (const [playerId, playerData] of data.playerMetrics) {
      const workRateIndex = playerData.derived.workRateIndex;

      subComponents.push({
        name: playerId,
        value: workRateIndex,
        contribution: 1 / data.playerMetrics.size,
        anomaly: workRateIndex < 40,
      });

      totalScore += workRateIndex;
      count++;
    }

    const value = count > 0 ? totalScore / count : 50;
    const weight = weights.physicalOutput * 0.5;

    return {
      value,
      weight,
      weightedValue: value * weight,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('workRate'),
      subComponents,
    };
  }

  // Fatigue dimension scoring
  private calculateFatigueDimension(
    data: RealTimeAnalyticsData,
    digitalTwins: Map<string, DigitalTwin>
  ): DimensionScore {
    const subComponents: SubComponentScore[] = [];
    let totalFatigueScore = 0;
    let count = 0;

    for (const [playerId, playerData] of data.playerMetrics) {
      const twin = digitalTwins.get(playerId);
      const fatigueIndex = playerData.derived.fatigueIndex;

      // Inverse - lower fatigue is better
      const fatigueScore = 100 - fatigueIndex;

      subComponents.push({
        name: playerId,
        value: fatigueScore,
        contribution: 1 / data.playerMetrics.size,
        anomaly: fatigueIndex > 70,
      });

      totalFatigueScore += fatigueScore;
      count++;
    }

    const value = count > 0 ? totalFatigueScore / count : 50;

    return {
      value,
      weight: 0.08,
      weightedValue: value * 0.08,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('fatigue'),
      subComponents,
    };
  }

  // Role execution dimension scoring
  private calculateRoleExecutionDimension(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const subComponents: SubComponentScore[] = [];
    let totalScore = 0;
    let count = 0;

    for (const [playerId, playerData] of data.playerMetrics) {
      const instruction = model.effectivePlayerInstructions.get(playerId);
      if (!instruction) continue;

      // Calculate role-specific metrics
      let roleScore = 70; // Base score

      // Check tactical compliance
      roleScore += playerData.derived.tacticalComplianceIndex * 0.3;

      // Check position-specific behaviors
      if (instruction.role.includes('CB') || instruction.role.includes('defender')) {
        // Defenders: value positional discipline
        if (playerData.positional.zoneOccupancy === 'defensive_third') {
          roleScore += 10;
        }
      } else if (instruction.role.includes('ST') || instruction.role.includes('forward')) {
        // Forwards: value penetration
        if (playerData.technical.touchesInFinalThird > 5) {
          roleScore += 10;
        }
      } else if (instruction.role.includes('CM') || instruction.role.includes('midfielder')) {
        // Midfielders: value involvement
        if (playerData.technical.passesAttempted > 10) {
          roleScore += 10;
        }
      }

      subComponents.push({
        name: playerId,
        value: Math.min(100, roleScore),
        contribution: 1 / data.playerMetrics.size,
        anomaly: roleScore < 50,
      });

      totalScore += Math.min(100, roleScore);
      count++;
    }

    const value = count > 0 ? totalScore / count : 50;
    const weight = weights.roleExecution;

    return {
      value,
      weight,
      weightedValue: value * weight,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('roleExecution'),
      subComponents,
    };
  }

  // Phase compliance dimension scoring
  private calculatePhaseComplianceDimension(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel,
    context: RealtimeContext,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const currentPhase = context.currentPhase;
    const tacticalMetrics = data.tacticalMetrics;

    const subComponents: SubComponentScore[] = [];

    // Phase effectiveness
    const phaseEffectiveness = tacticalMetrics.phases.phaseEffectiveness;
    subComponents.push({
      name: 'phase_effectiveness',
      value: phaseEffectiveness,
      contribution: 0.4,
      anomaly: phaseEffectiveness < 40,
    });

    // Phase coherence from analytics
    const phaseCoherence = tacticalMetrics.phases.phaseCoherence;
    subComponents.push({
      name: 'phase_coherence',
      value: phaseCoherence,
      contribution: 0.4,
      anomaly: phaseCoherence < 40,
    });

    // Transition speed
    const transitionSpeed = Math.min(100, tacticalMetrics.phases.transitionSpeed * 10);
    subComponents.push({
      name: 'transition_speed',
      value: transitionSpeed,
      contribution: 0.2,
      anomaly: transitionSpeed < 30,
    });

    const value = subComponents.reduce((sum, sc) => sum + sc.value * sc.contribution, 0);
    const phaseWeight = weights.phaseWeights[currentPhase] || 1.0;

    return {
      value,
      weight: 0.1 * phaseWeight,
      weightedValue: value * 0.1 * phaseWeight,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('phaseCompliance'),
      subComponents,
    };
  }

  // Principle adherence dimension scoring
  private calculatePrincipleAdherenceDimension(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const subComponents: SubComponentScore[] = [];

    // In-possession principles
    for (const principle of model.effectivePrinciples.inPossession) {
      const adherenceScore = this.evaluatePrincipleAdherence(principle.name, data);
      subComponents.push({
        name: `in_poss_${principle.name}`,
        value: adherenceScore,
        contribution: 0.4 / model.effectivePrinciples.inPossession.length,
        anomaly: adherenceScore < 50,
      });
    }

    // Out-of-possession principles
    for (const principle of model.effectivePrinciples.outOfPossession) {
      const adherenceScore = this.evaluatePrincipleAdherence(principle.name, data);
      subComponents.push({
        name: `out_poss_${principle.name}`,
        value: adherenceScore,
        contribution: 0.4 / model.effectivePrinciples.outOfPossession.length,
        anomaly: adherenceScore < 50,
      });
    }

    // Transition principles
    for (const principle of model.effectivePrinciples.transitions) {
      const adherenceScore = this.evaluatePrincipleAdherence(principle.name, data);
      subComponents.push({
        name: `trans_${principle.name}`,
        value: adherenceScore,
        contribution: 0.2 / model.effectivePrinciples.transitions.length,
        anomaly: adherenceScore < 50,
      });
    }

    const value = subComponents.reduce((sum, sc) => sum + sc.value * sc.contribution, 0);

    return {
      value,
      weight: 0.12,
      weightedValue: value * 0.12,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('principleAdherence'),
      subComponents,
    };
  }

  // Team shape dimension scoring
  private calculateTeamShapeDimension(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const teamMetrics = data.teamMetrics;

    const subComponents: SubComponentScore[] = [
      {
        name: 'compactness',
        value: teamMetrics.shape.compactness,
        contribution: 0.3,
        anomaly: teamMetrics.shape.compactness < 40,
      },
      {
        name: 'width_balance',
        value: Math.max(0, 100 - Math.abs(teamMetrics.shape.width - 40) * 2),
        contribution: 0.25,
        anomaly: false,
      },
      {
        name: 'depth_balance',
        value: Math.max(0, 100 - Math.abs(teamMetrics.shape.depth - 35) * 2),
        contribution: 0.25,
        anomaly: false,
      },
      {
        name: 'centroid_position',
        value: Math.min(100, Math.max(0, (teamMetrics.shape.centroidX + 52.5) / 105 * 100)),
        contribution: 0.2,
        anomaly: false,
      },
    ];

    const value = subComponents.reduce((sum, sc) => sum + sc.value * sc.contribution, 0);
    const weight = weights.teamShape;

    return {
      value,
      weight,
      weightedValue: value * weight,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('teamShape'),
      subComponents,
    };
  }

  // Collective movement dimension scoring
  private calculateCollectiveMovementDimension(data: RealTimeAnalyticsData): DimensionScore {
    const teamMetrics = data.teamMetrics;

    // Measure collective coordination
    const passingConnectivity = teamMetrics.network.passingConnectivity * 100;
    const clusteringCoefficient = teamMetrics.network.clusteringCoefficient * 100;

    const subComponents: SubComponentScore[] = [
      {
        name: 'passing_connectivity',
        value: passingConnectivity,
        contribution: 0.5,
        anomaly: passingConnectivity < 50,
      },
      {
        name: 'clustering',
        value: clusteringCoefficient,
        contribution: 0.5,
        anomaly: clusteringCoefficient < 30,
      },
    ];

    const value = subComponents.reduce((sum, sc) => sum + sc.value * sc.contribution, 0);

    return {
      value,
      weight: 0.06,
      weightedValue: value * 0.06,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('collectiveMovement'),
      subComponents,
    };
  }

  // Synchronization dimension scoring
  private calculateSynchronizationDimension(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel
  ): DimensionScore {
    // Measure how synchronized player movements are
    const positions = Array.from(data.playerMetrics.values())
      .map(p => ({ x: p.positional.currentX, y: p.positional.currentY }));

    // Calculate variance in positions
    const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

    const variance = positions.reduce((sum, p) => {
      return sum + Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2);
    }, 0) / positions.length;

    // Lower variance = better synchronization (for compact teams)
    const syncScore = Math.max(0, 100 - variance / 10);

    const subComponents: SubComponentScore[] = [
      {
        name: 'position_variance',
        value: syncScore,
        contribution: 1.0,
        anomaly: syncScore < 40,
      },
    ];

    return {
      value: syncScore,
      weight: 0.05,
      weightedValue: syncScore * 0.05,
      confidence: 0.7,
      trend: this.getTrendForDimension('synchronization'),
      subComponents,
    };
  }

  // Pressure cohesion dimension scoring
  private calculatePressureCohesionDimension(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const pressing = data.tacticalMetrics.pressing;

    const subComponents: SubComponentScore[] = [
      {
        name: 'press_success_rate',
        value: pressing.pressSuccessRate * 100,
        contribution: 0.4,
        anomaly: pressing.pressSuccessRate < 0.3,
      },
      {
        name: 'counter_press_intensity',
        value: Math.min(100, pressing.counterPressIntensity * 10),
        contribution: 0.3,
        anomaly: pressing.counterPressIntensity < 3,
      },
      {
        name: 'recovery_efficiency',
        value: pressing.recoveryTime > 0 ? Math.max(0, 100 - pressing.recoveryTime * 10) : 50,
        contribution: 0.3,
        anomaly: pressing.recoveryTime > 8,
      },
    ];

    const value = subComponents.reduce((sum, sc) => sum + sc.value * sc.contribution, 0);
    const weight = weights.pressureTiming;

    return {
      value,
      weight,
      weightedValue: value * weight,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('pressureCohesion'),
      subComponents,
    };
  }

  // Transition readiness dimension scoring
  private calculateTransitionReadinessDimension(
    data: RealTimeAnalyticsData,
    context: RealtimeContext,
    weights: CoherenceWeightConfig
  ): DimensionScore {
    const tacticalMetrics = data.tacticalMetrics;
    const teamMetrics = data.teamMetrics;

    // Measure readiness for both positive and negative transitions
    const attackingReadiness = Math.min(100, teamMetrics.collective.passSequenceLength * 10 + 50);
    const defensiveReadiness = teamMetrics.shape.compactness;
    const transitionSpeed = Math.min(100, tacticalMetrics.phases.transitionSpeed * 15);

    const subComponents: SubComponentScore[] = [
      {
        name: 'attacking_transition_readiness',
        value: attackingReadiness,
        contribution: 0.35,
        anomaly: attackingReadiness < 40,
      },
      {
        name: 'defensive_transition_readiness',
        value: defensiveReadiness,
        contribution: 0.35,
        anomaly: defensiveReadiness < 40,
      },
      {
        name: 'transition_speed',
        value: transitionSpeed,
        contribution: 0.3,
        anomaly: transitionSpeed < 30,
      },
    ];

    const value = subComponents.reduce((sum, sc) => sum + sc.value * sc.contribution, 0);
    const weight = weights.transitionSpeed;

    return {
      value,
      weight,
      weightedValue: value * weight,
      confidence: this.calculateDimensionConfidence(subComponents),
      trend: this.getTrendForDimension('transitionReadiness'),
      subComponents,
    };
  }

  // Adaptability dimension scoring
  private calculateAdaptabilityDimension(context: RealtimeContext): DimensionScore {
    // Measure team's ability to adapt to game state
    const momentum = context.momentum;
    const scoreDiff = context.score.home - context.score.away;

    // Positive momentum when winning or negative when losing = good adaptability
    let adaptabilityScore = 50;

    if (scoreDiff > 0 && momentum > 0) {
      adaptabilityScore = 70 + momentum * 0.3;
    } else if (scoreDiff < 0 && momentum < 0) {
      adaptabilityScore = 30 + Math.abs(momentum) * 0.2;
    } else if (scoreDiff > 0 && momentum < 0) {
      adaptabilityScore = 60 - Math.abs(momentum) * 0.2;
    } else if (scoreDiff < 0 && momentum > 0) {
      adaptabilityScore = 60 + momentum * 0.4;
    }

    const subComponents: SubComponentScore[] = [
      {
        name: 'game_state_response',
        value: Math.max(0, Math.min(100, adaptabilityScore)),
        contribution: 1.0,
        anomaly: adaptabilityScore < 40,
      },
    ];

    return {
      value: Math.max(0, Math.min(100, adaptabilityScore)),
      weight: 0.04,
      weightedValue: Math.max(0, Math.min(100, adaptabilityScore)) * 0.04,
      confidence: 0.6,
      trend: this.getTrendForDimension('adaptability'),
      subComponents,
    };
  }

  // Helper methods
  private evaluatePrincipleAdherence(principleName: string, data: RealTimeAnalyticsData): number {
    // Placeholder - would evaluate based on specific principle requirements
    return 70 + Math.random() * 20;
  }

  private calculateDeviationScore(
    actual: number,
    target: number,
    min: number,
    max: number
  ): number {
    if (actual >= min && actual <= max) {
      // Within range - score based on distance from target
      const deviation = Math.abs(actual - target);
      const maxDeviation = Math.max(target - min, max - target);
      return 100 - (deviation / maxDeviation) * 30;
    } else {
      // Outside range
      const outsideAmount = actual < min ? min - actual : actual - max;
      return Math.max(0, 70 - outsideAmount * 3);
    }
  }

  private calculateDimensionConfidence(subComponents: SubComponentScore[]): number {
    if (subComponents.length === 0) return 0.5;

    // Confidence based on variance and anomaly count
    const values = subComponents.map(sc => sc.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const anomalyCount = subComponents.filter(sc => sc.anomaly).length;

    // Lower variance and fewer anomalies = higher confidence
    const varianceConfidence = Math.max(0, 1 - variance / 1000);
    const anomalyConfidence = Math.max(0, 1 - anomalyCount / subComponents.length);

    return (varianceConfidence * 0.6 + anomalyConfidence * 0.4);
  }

  private getTrendForDimension(dimension: string): 'improving' | 'stable' | 'declining' {
    if (this.historicalScores.length < 3) return 'stable';

    const recentScores = this.historicalScores.slice(-5);
    const values = recentScores.map(h => {
      const dim = h.dimensions[dimension as keyof DimensionalScores];
      return dim ? dim.value : 50;
    });

    if (values.length < 2) return 'stable';

    const trend = values[values.length - 1] - values[0];

    if (trend > 5) return 'improving';
    if (trend < -5) return 'declining';
    return 'stable';
  }

  // Calculate breakdown scores
  private calculateBreakdown(
    data: RealTimeAnalyticsData,
    model: ResolvedGameModel,
    dimensions: DimensionalScores
  ): ScoreBreakdown {
    const byPlayer = new Map<string, PlayerCompositeScore>();

    for (const [playerId, playerData] of data.playerMetrics) {
      byPlayer.set(playerId, {
        playerId,
        overall: this.calculatePlayerScore(playerId, data, dimensions),
        dimensions: {},
        deviations: [],
        recommendations: [],
        riskLevel: this.calculatePlayerRiskLevel(playerData),
      });
    }

    const byPhase = new Map<string, number>();
    byPhase.set('pressing', dimensions.pressureCohesion.value);
    byPhase.set('buildUp', (dimensions.formation.value + dimensions.positional.value) / 2);
    byPhase.set('progression', dimensions.roleExecution.value);
    byPhase.set('finalThird', dimensions.principleAdherence.value);

    const byPrinciple = new Map<string, number>();
    // Would extract from principle adherence dimension

    const byZone = new Map<string, number>();
    for (const sc of dimensions.zonal.subComponents) {
      byZone.set(sc.name, sc.value);
    }

    return {
      byPlayer,
      byPhase,
      byPrinciple,
      byZone,
      byTimeWindow: this.calculateTimeWindowScores(),
    };
  }

  private calculatePlayerScore(
    playerId: string,
    data: RealTimeAnalyticsData,
    dimensions: DimensionalScores
  ): number {
    const playerData = data.playerMetrics.get(playerId);
    if (!playerData) return 50;

    // Aggregate player-specific scores from dimensions
    let score = 0;
    let weight = 0;

    // Find player's contribution in each dimension
    for (const dim of Object.values(dimensions)) {
      const playerComponent = dim.subComponents.find((sc: SubComponentScore) => sc.name === playerId);
      if (playerComponent) {
        score += playerComponent.value * dim.weight;
        weight += dim.weight;
      }
    }

    return weight > 0 ? score / weight : 50;
  }

  private calculatePlayerRiskLevel(playerData: PlayerAnalyticsData): 'low' | 'medium' | 'high' | 'critical' {
    const risk = playerData.derived.riskExposure;
    const fatigue = playerData.derived.fatigueIndex;

    const combinedRisk = risk * 0.6 + fatigue * 0.4;

    if (combinedRisk > 80) return 'critical';
    if (combinedRisk > 60) return 'high';
    if (combinedRisk > 40) return 'medium';
    return 'low';
  }

  private calculateTimeWindowScores(): TimeWindowScore[] {
    const windows: TimeWindowScore[] = [];

    for (let i = 0; i < this.historicalScores.length; i += 5) {
      const windowScores = this.historicalScores.slice(i, i + 5);
      if (windowScores.length === 0) continue;

      const avgScore = windowScores.reduce((sum, h) => sum + h.overall, 0) / windowScores.length;
      const trend = windowScores.length > 1
        ? windowScores[windowScores.length - 1].overall - windowScores[0].overall
        : 0;

      windows.push({
        startMinute: windowScores[0].minute,
        endMinute: windowScores[windowScores.length - 1].minute,
        score: avgScore,
        trend,
        events: [],
      });
    }

    return windows;
  }

  // Temporal analysis
  private performTemporalAnalysis(dimensions: DimensionalScores): TemporalAnalysis {
    const currentScore = this.calculateOverallFromDimensions(dimensions);

    return {
      currentScore,
      movingAverage: this.trendAnalyzer.calculateMovingAverage(this.historicalScores, 5),
      exponentialMovingAverage: this.trendAnalyzer.calculateEMA(this.historicalScores, this.config.smoothingFactor),
      volatility: this.trendAnalyzer.calculateVolatility(this.historicalScores),
      trend: this.trendAnalyzer.analyzeTrend(this.historicalScores),
      momentum: this.trendAnalyzer.analyzeMomentum(this.historicalScores),
      predictions: this.predictionEngine.generatePredictions(this.historicalScores, currentScore),
    };
  }

  // Bayesian inference
  private performBayesianInference(
    dimensions: DimensionalScores,
    context: RealtimeContext
  ): BayesianMetrics {
    const currentScore = this.calculateOverallFromDimensions(dimensions);

    // Get prior (baseline expectation based on context)
    const prior = this.getBayesianPrior(context);

    // Calculate likelihood (how likely is this score given the observations)
    const likelihood = this.calculateLikelihood(dimensions);

    // Update posterior using Bayes' rule
    const posterior = this.updatePosterior(prior, likelihood, currentScore);

    // Calculate belief update
    const beliefUpdate = posterior - prior;

    // Information gain (reduction in uncertainty)
    const priorUncertainty = this.bayesianPriors.get('uncertainty') || 20;
    const posteriorUncertainty = priorUncertainty * (1 - likelihood * 0.5);
    const uncertaintyReduction = priorUncertainty - posteriorUncertainty;

    // Information gain in bits
    const informationGain = Math.log2(priorUncertainty / Math.max(1, posteriorUncertainty));

    return {
      priorScore: prior,
      likelihood,
      posteriorScore: posterior,
      evidenceStrength: likelihood,
      beliefUpdate,
      uncertaintyReduction,
      informationGain,
    };
  }

  private getBayesianPrior(context: RealtimeContext): number {
    // Base prior on match context
    let prior = 70; // Default expectation

    // Adjust based on score
    if (context.score.home > context.score.away) {
      prior += 5;
    } else if (context.score.home < context.score.away) {
      prior -= 5;
    }

    // Adjust based on match minute
    if (context.matchMinute > 75) {
      prior -= 5; // Fatigue effects
    }

    // Adjust based on historical trend
    if (this.historicalScores.length > 5) {
      const recentAvg = this.historicalScores.slice(-5).reduce((sum, h) => sum + h.overall, 0) / 5;
      prior = prior * (1 - this.config.bayesianPriorStrength) + recentAvg * this.config.bayesianPriorStrength;
    }

    return prior;
  }

  private calculateLikelihood(dimensions: DimensionalScores): number {
    // Likelihood based on confidence of observations
    const confidences = Object.values(dimensions).map(d => d.confidence);
    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }

  private updatePosterior(prior: number, likelihood: number, observed: number): number {
    // Simplified Bayesian update
    const priorWeight = 1 - likelihood;
    const observedWeight = likelihood;

    return prior * priorWeight + observed * observedWeight;
  }

  // Ensemble scoring
  private calculateEnsembleScore(
    dimensions: DimensionalScores,
    temporal: TemporalAnalysis,
    bayesian: BayesianMetrics
  ): EnsembleResult {
    const modelScores: ModelScore[] = [];

    // Weighted average model
    const weightedScore = this.calculateOverallFromDimensions(dimensions);
    modelScores.push({
      modelName: 'weighted',
      score: weightedScore,
      weight: this.ensembleWeights.get('weighted') || 0.4,
      confidence: 0.8,
    });

    // Bayesian model
    modelScores.push({
      modelName: 'bayesian',
      score: bayesian.posteriorScore,
      weight: this.ensembleWeights.get('bayesian') || 0.25,
      confidence: bayesian.likelihood,
    });

    // Temporal model (EMA)
    modelScores.push({
      modelName: 'temporal',
      score: temporal.exponentialMovingAverage,
      weight: this.ensembleWeights.get('temporal') || 0.2,
      confidence: 1 - temporal.volatility / 100,
    });

    // Adaptive model (accounts for trend)
    const adaptiveScore = temporal.currentScore + temporal.trend.strength * 5 *
      (temporal.trend.direction === 'up' ? 1 : temporal.trend.direction === 'down' ? -1 : 0);
    modelScores.push({
      modelName: 'adaptive',
      score: Math.max(0, Math.min(100, adaptiveScore)),
      weight: this.ensembleWeights.get('adaptive') || 0.15,
      confidence: 0.7,
    });

    // Calculate weighted consensus
    const totalWeight = modelScores.reduce((sum, m) => sum + m.weight * m.confidence, 0);
    const weightedConsensus = modelScores.reduce(
      (sum, m) => sum + m.score * m.weight * m.confidence,
      0
    ) / totalWeight;

    // Calculate agreement level
    const scores = modelScores.map(m => m.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const agreementLevel = Math.max(0, 1 - variance / 500);

    // Identify outliers
    const stdDev = Math.sqrt(variance);
    const outlierModels = modelScores
      .filter(m => Math.abs(m.score - avgScore) > 2 * stdDev)
      .map(m => m.modelName);

    // Final score is weighted consensus with agreement-based confidence
    const finalScore = weightedConsensus * agreementLevel + avgScore * (1 - agreementLevel);

    return {
      finalScore: Math.max(0, Math.min(100, finalScore)),
      modelScores,
      agreementLevel,
      outlierModels,
      weightedConsensus,
    };
  }

  // Calculate overall score
  private calculateOverallScore(
    dimensions: DimensionalScores,
    weights: CoherenceWeightConfig
  ): number {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const dim of Object.values(dimensions)) {
      totalWeightedScore += dim.weightedValue;
      totalWeight += dim.weight;
    }

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 50;
  }

  private calculateOverallFromDimensions(dimensions: DimensionalScores): number {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const dim of Object.values(dimensions)) {
      totalWeightedScore += dim.weightedValue;
      totalWeight += dim.weight;
    }

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 50;
  }

  // Calculate confidence
  private calculateConfidence(
    dimensions: DimensionalScores,
    data: RealTimeAnalyticsData
  ): number {
    // Based on data quality and dimension confidences
    const dimensionConfidences = Object.values(dimensions).map(d => d.confidence);
    const avgDimensionConfidence = dimensionConfidences.reduce((a, b) => a + b, 0) / dimensionConfidences.length;

    // Data completeness
    const expectedPlayers = 11;
    const actualPlayers = data.playerMetrics.size;
    const dataCompleteness = Math.min(1, actualPlayers / expectedPlayers);

    return avgDimensionConfidence * 0.7 + dataCompleteness * 0.3;
  }

  // Run diagnostics
  private runDiagnostics(
    data: RealTimeAnalyticsData,
    dimensions: DimensionalScores,
    startTime: number
  ): ScoringDiagnostics {
    const computationTime = performance.now() - startTime;

    const anomalies = this.anomalyDetector.detectAnomalies(dimensions);

    const missingData: string[] = [];
    if (data.playerMetrics.size < 11) {
      missingData.push(`Only ${data.playerMetrics.size}/11 players tracked`);
    }

    const warnings: string[] = [];
    if (computationTime > 50) {
      warnings.push('Scoring computation took longer than expected');
    }

    const dataQuality: DataQualityMetrics = {
      completeness: Math.min(1, data.playerMetrics.size / 11),
      freshness: 1.0, // Would calculate based on data timestamps
      consistency: 0.9, // Would calculate based on data coherence
      accuracy: 0.85, // Would calculate based on known baselines
      overall: 0,
    };
    dataQuality.overall = (dataQuality.completeness + dataQuality.freshness +
      dataQuality.consistency + dataQuality.accuracy) / 4;

    return {
      computationTime,
      dataQuality,
      missingData,
      anomalies,
      warnings,
    };
  }

  // Update history
  private updateHistory(entry: ScoreHistory): void {
    this.historicalScores.push(entry);

    if (this.historicalScores.length > this.config.historyWindowSize) {
      this.historicalScores = this.historicalScores.slice(-this.config.historyWindowSize);
    }
  }

  // Initialize ensemble weights
  private initializeEnsembleWeights(): void {
    this.ensembleWeights.set('weighted', 0.4);
    this.ensembleWeights.set('bayesian', 0.25);
    this.ensembleWeights.set('temporal', 0.2);
    this.ensembleWeights.set('adaptive', 0.15);
  }

  // Initialize Bayesian priors
  private initializeBayesianPriors(): void {
    this.bayesianPriors.set('baseline', 70);
    this.bayesianPriors.set('uncertainty', 20);
  }

  // Reset engine state
  reset(): void {
    this.historicalScores = [];
    this.initializeEnsembleWeights();
    this.initializeBayesianPriors();
  }
}

// ==================== Supporting Classes ====================

interface ScoreHistory {
  timestamp: Date;
  minute: number;
  overall: number;
  dimensions: Partial<DimensionalScores>;
}

interface ScoringConfig {
  historyWindowSize: number;
  bayesianPriorStrength: number;
  ensembleModels: string[];
  anomalyThreshold: number;
  predictionHorizon: number;
  smoothingFactor: number;
  minDataPoints: number;
}

class AnomalyDetector {
  private threshold: number;

  constructor(threshold: number) {
    this.threshold = threshold;
  }

  detectAnomalies(dimensions: DimensionalScores): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const [name, dim] of Object.entries(dimensions)) {
      for (const sc of dim.subComponents) {
        if (sc.anomaly) {
          anomalies.push({
            type: 'dimension_anomaly',
            metric: `${name}.${sc.name}`,
            expectedRange: [40, 100],
            actualValue: sc.value,
            severity: sc.value < 20 ? 'high' : sc.value < 30 ? 'medium' : 'low',
          });
        }
      }
    }

    return anomalies;
  }
}

class TrendAnalyzer {
  calculateMovingAverage(history: ScoreHistory[], window: number): number {
    if (history.length === 0) return 50;

    const recent = history.slice(-window);
    return recent.reduce((sum, h) => sum + h.overall, 0) / recent.length;
  }

  calculateEMA(history: ScoreHistory[], alpha: number): number {
    if (history.length === 0) return 50;

    let ema = history[0].overall;
    for (let i = 1; i < history.length; i++) {
      ema = alpha * history[i].overall + (1 - alpha) * ema;
    }
    return ema;
  }

  calculateVolatility(history: ScoreHistory[]): number {
    if (history.length < 2) return 0;

    const values = history.map(h => h.overall);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    return Math.sqrt(variance);
  }

  analyzeTrend(history: ScoreHistory[]): TrendAnalysis {
    const result: TrendAnalysis = {
      shortTerm: 0,
      mediumTerm: 0,
      longTerm: 0,
      direction: 'flat',
      strength: 0,
      changePoints: [],
    };

    if (history.length < 2) return result;

    // Short term (last 5)
    const short = history.slice(-5);
    if (short.length >= 2) {
      result.shortTerm = (short[short.length - 1].overall - short[0].overall) / short.length;
    }

    // Medium term (last 15)
    const medium = history.slice(-15);
    if (medium.length >= 2) {
      result.mediumTerm = (medium[medium.length - 1].overall - medium[0].overall) / medium.length;
    }

    // Long term (all)
    if (history.length >= 2) {
      result.longTerm = (history[history.length - 1].overall - history[0].overall) / history.length;
    }

    // Determine direction
    if (result.shortTerm > 0.5) {
      result.direction = 'up';
    } else if (result.shortTerm < -0.5) {
      result.direction = 'down';
    }

    // Strength
    result.strength = Math.abs(result.shortTerm);

    return result;
  }

  analyzeMomentum(history: ScoreHistory[]): MomentumAnalysis {
    const result: MomentumAnalysis = {
      value: 0,
      acceleration: 0,
      sustainedPeriod: 0,
      reversingProbability: 0.5,
    };

    if (history.length < 3) return result;

    // Calculate momentum as rate of change
    const recent = history.slice(-10);
    if (recent.length >= 2) {
      result.value = recent[recent.length - 1].overall - recent[0].overall;
    }

    // Calculate acceleration (change in momentum)
    if (recent.length >= 3) {
      const prevMomentum = recent[recent.length - 2].overall - recent[0].overall;
      result.acceleration = result.value - prevMomentum;
    }

    // Calculate sustained period
    const direction = result.value >= 0;
    let sustained = 0;
    for (let i = history.length - 2; i >= 0; i--) {
      const change = history[i + 1].overall - history[i].overall;
      if ((change >= 0) === direction) {
        sustained++;
      } else {
        break;
      }
    }
    result.sustainedPeriod = sustained;

    // Reversing probability increases with sustained period
    result.reversingProbability = Math.min(0.9, 0.1 + sustained * 0.1);

    return result;
  }
}

class PredictionEngine {
  private horizon: number;

  constructor(horizon: number) {
    this.horizon = horizon;
  }

  generatePredictions(history: ScoreHistory[], currentScore: number): PredictionSet {
    const trend = this.calculateTrend(history);
    const volatility = this.calculateVolatility(history);

    return {
      next5Minutes: this.predictScore(currentScore, trend, volatility, 5),
      next15Minutes: this.predictScore(currentScore, trend, volatility, 15),
      endOfHalf: this.predictScore(currentScore, trend, volatility, 45),
      scenarios: this.generateScenarios(currentScore, trend, volatility),
    };
  }

  private calculateTrend(history: ScoreHistory[]): number {
    if (history.length < 2) return 0;
    const recent = history.slice(-5);
    return (recent[recent.length - 1].overall - recent[0].overall) / recent.length;
  }

  private calculateVolatility(history: ScoreHistory[]): number {
    if (history.length < 2) return 10;
    const values = history.map(h => h.overall);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
  }

  private predictScore(
    current: number,
    trend: number,
    volatility: number,
    minutes: number
  ): PredictedScore {
    const mean = Math.max(0, Math.min(100, current + trend * minutes));
    const uncertainty = volatility * Math.sqrt(minutes / 5);

    return {
      mean,
      lower95: Math.max(0, mean - 1.96 * uncertainty),
      upper95: Math.min(100, mean + 1.96 * uncertainty),
      confidence: Math.max(0.3, 1 - minutes / 100),
    };
  }

  private generateScenarios(
    current: number,
    trend: number,
    volatility: number
  ): ScenarioPrediction[] {
    return [
      {
        scenario: 'optimistic',
        probability: 0.2,
        projectedScore: Math.min(100, current + volatility * 2),
        keyFactors: ['Maintained tactical discipline', 'Opponent errors'],
      },
      {
        scenario: 'expected',
        probability: 0.6,
        projectedScore: Math.max(0, Math.min(100, current + trend * 10)),
        keyFactors: ['Current trend continues', 'Normal variation'],
      },
      {
        scenario: 'pessimistic',
        probability: 0.2,
        projectedScore: Math.max(0, current - volatility * 2),
        keyFactors: ['Fatigue effects', 'Tactical breakdown'],
      },
    ];
  }
}

// ==================== Factory Function ====================

export function createCompositeScoringEngine(config?: Partial<ScoringConfig>): CompositeScoringEngine {
  return new CompositeScoringEngine(config);
}
