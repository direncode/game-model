// Coherence 3.0 - Predictive Tactical Intelligence
// Evolves from reactive coherence checking to proactive prediction
// Anticipates tactical breakdowns before they happen

import type {
  Player,
  PlayerPosition,
  TrackingMetrics,
  GameModel,
  Formation,
  TacticalDeviation,
  CriticalDeviation,
  PlayerAlert,
} from '@/types';

import type {
  TacticalGraph,
  PatternMatchResult,
  PlayerNode,
} from './graph-neural-patterns';

import type {
  NeuralDigitalTwin,
  TwinRealTimeState,
} from './digital-twin-v2';

// ==================== Predictive Coherence Types ====================

export interface CoherenceV3Config {
  // Prediction horizons
  shortTermHorizon: number; // 5 seconds
  mediumTermHorizon: number; // 30 seconds
  longTermHorizon: number; // 5 minutes

  // Alert thresholds
  warningThreshold: number; // 0.6
  criticalThreshold: number; // 0.4
  breakdownThreshold: number; // 0.25

  // Intervention settings
  autoInterventionEnabled: boolean;
  interventionCooldown: number; // seconds between auto-interventions
  maxActiveInterventions: number;

  // Model settings
  predictionModelVersion: string;
  useEnsemble: boolean;
  confidenceRequired: number;
}

export interface CoherenceState {
  timestamp: number;
  matchMinute: number;

  // Overall scores
  overallCoherence: number; // 0-100
  predictedCoherence: PredictedCoherence;

  // Dimensional breakdown
  formationCoherence: DimensionalCoherence;
  pressureCoherence: DimensionalCoherence;
  transitionCoherence: DimensionalCoherence;
  individualCoherence: Map<string, IndividualCoherence>;

  // Active issues
  activeDeviations: TacticalDeviation[];
  predictedDeviations: PredictedDeviation[];
  interventions: ActiveIntervention[];

  // Risk assessment
  riskProfile: TacticalRiskProfile;

  // Trend analysis
  coherenceTrend: CoherenceTrend;
}

export interface PredictedCoherence {
  shortTerm: { value: number; confidence: number };
  mediumTerm: { value: number; confidence: number };
  longTerm: { value: number; confidence: number };
  trajectory: 'improving' | 'stable' | 'declining' | 'critical';
  keyFactors: PredictionFactor[];
}

export interface PredictionFactor {
  factor: string;
  impact: number; // -1 to 1
  timeToImpact: number; // seconds
  mitigable: boolean;
  suggestedMitigation?: string;
}

export interface DimensionalCoherence {
  current: number;
  predicted: number;
  trend: 'improving' | 'stable' | 'declining';
  subDimensions: SubDimensionScore[];
  risks: DimensionalRisk[];
}

export interface SubDimensionScore {
  name: string;
  score: number;
  weight: number;
  threshold: number;
  belowThreshold: boolean;
}

export interface DimensionalRisk {
  description: string;
  probability: number;
  timeToOccur: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedPlayers: string[];
}

export interface IndividualCoherence {
  playerId: string;
  currentScore: number;
  predictedScore: number;
  positionalAdherence: number;
  tacticalExecution: number;
  workRateCoherence: number;
  decisionCoherence: number;
  risks: PlayerRisk[];
  recommendations: string[];
}

export interface PlayerRisk {
  type: 'fatigue' | 'tactical' | 'positioning' | 'intensity' | 'focus';
  probability: number;
  timeToImpact: number;
  impact: string;
  preventable: boolean;
}

export interface PredictedDeviation {
  id: string;
  predictedAt: number;
  expectedOccurrence: number; // timestamp
  confidence: number;

  type: 'formation_break' | 'pressure_collapse' | 'transition_failure' | 'individual_drift';
  description: string;

  affectedPlayers: string[];
  affectedZone: string;

  severity: 'minor' | 'moderate' | 'major' | 'critical';
  expectedImpact: string;

  preventionPossible: boolean;
  preventionActions: PreventionAction[];
}

export interface PreventionAction {
  action: string;
  target: 'player' | 'unit' | 'team';
  targetId?: string;
  urgency: 'immediate' | 'soon' | 'when_possible';
  effectiveness: number; // 0-1
  sideEffects?: string[];
}

export interface ActiveIntervention {
  id: string;
  startedAt: number;
  type: InterventionType;
  target: string;
  message: string;
  status: 'pending' | 'delivered' | 'acknowledged' | 'completed' | 'ignored';
  effectiveness?: number;
  followUpRequired: boolean;
}

export type InterventionType =
  | 'vocal_instruction'
  | 'tactical_board_update'
  | 'player_specific_alert'
  | 'unit_coordination'
  | 'formation_adjustment'
  | 'substitution_recommendation';

export interface TacticalRiskProfile {
  overallRisk: number; // 0-1
  riskCategory: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';

  topRisks: TacticalRisk[];
  emergingRisks: TacticalRisk[];
  mitigatedRisks: TacticalRisk[];

  vulnerabilities: TacticalVulnerability[];
  exposures: TacticalExposure[];
}

export interface TacticalRisk {
  id: string;
  name: string;
  description: string;
  probability: number;
  impact: number;
  riskScore: number;
  timeHorizon: number;
  category: 'defensive' | 'offensive' | 'transition' | 'structural';
  mitigations: string[];
}

export interface TacticalVulnerability {
  area: string;
  description: string;
  exploitability: number;
  currentlyExposed: boolean;
  historicalExploits: number;
}

export interface TacticalExposure {
  zone: string;
  exposureLevel: number;
  durationExposed: number;
  playersResponsible: string[];
  opponentThreats: string[];
}

export interface CoherenceTrend {
  last5Minutes: TrendData;
  last15Minutes: TrendData;
  matchTotal: TrendData;
  comparedToBaseline: number; // percentage diff
  comparedToOpponent: number;
}

export interface TrendData {
  values: { timestamp: number; value: number }[];
  average: number;
  min: number;
  max: number;
  standardDeviation: number;
  trend: 'improving' | 'stable' | 'declining';
  volatility: number;
}

// ==================== Intervention Types ====================

export interface InterventionTemplate {
  id: string;
  type: InterventionType;
  trigger: InterventionTrigger;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number;
  effectiveness: number;
  prerequisites: string[];
}

export interface InterventionTrigger {
  condition: string;
  threshold: number;
  sustained: boolean;
  duration?: number;
}

export interface InterventionResult {
  interventionId: string;
  success: boolean;
  coherenceChange: number;
  playerResponses: Map<string, 'positive' | 'neutral' | 'negative'>;
  timeToEffect: number;
  sideEffects: string[];
}

// ==================== Main Coherence V3 Engine ====================

export class CoherenceV3Engine {
  private config: CoherenceV3Config;
  private currentState: CoherenceState | null;
  private gameModel: GameModel | null;
  private stateHistory: CoherenceState[];
  private interventionHistory: InterventionResult[];
  private twins: Map<string, NeuralDigitalTwin>;

  constructor(config?: Partial<CoherenceV3Config>) {
    this.config = {
      shortTermHorizon: 5,
      mediumTermHorizon: 30,
      longTermHorizon: 300,
      warningThreshold: 0.6,
      criticalThreshold: 0.4,
      breakdownThreshold: 0.25,
      autoInterventionEnabled: true,
      interventionCooldown: 30,
      maxActiveInterventions: 3,
      predictionModelVersion: '3.0.0',
      useEnsemble: true,
      confidenceRequired: 0.7,
      ...config,
    };

    this.currentState = null;
    this.gameModel = null;
    this.stateHistory = [];
    this.interventionHistory = [];
    this.twins = new Map();
  }

  // Initialize with game model
  initialize(gameModel: GameModel, twins: Map<string, NeuralDigitalTwin>): void {
    this.gameModel = gameModel;
    this.twins = twins;
    this.stateHistory = [];
    this.interventionHistory = [];
    this.currentState = null;
  }

  // Main coherence analysis with prediction
  analyzeCoherence(
    graph: TacticalGraph,
    patternMatches: PatternMatchResult[],
    matchMinute: number
  ): CoherenceState {
    const timestamp = Date.now();

    // Calculate current coherence dimensions
    const formationCoherence = this.analyzeFormationCoherence(graph);
    const pressureCoherence = this.analyzePressureCoherence(graph, patternMatches);
    const transitionCoherence = this.analyzeTransitionCoherence(graph);
    const individualCoherence = this.analyzeIndividualCoherence(graph);

    // Calculate overall current coherence
    const overallCoherence = this.calculateOverallCoherence(
      formationCoherence,
      pressureCoherence,
      transitionCoherence,
      individualCoherence
    );

    // Predict future coherence
    const predictedCoherence = this.predictFutureCoherence(
      overallCoherence,
      formationCoherence,
      pressureCoherence,
      transitionCoherence,
      individualCoherence,
      matchMinute
    );

    // Identify current deviations
    const activeDeviations = this.identifyDeviations(graph, individualCoherence);

    // Predict future deviations
    const predictedDeviations = this.predictDeviations(
      graph,
      formationCoherence,
      pressureCoherence,
      individualCoherence,
      matchMinute
    );

    // Assess risk profile
    const riskProfile = this.assessRiskProfile(
      overallCoherence,
      predictedCoherence,
      activeDeviations,
      predictedDeviations
    );

    // Calculate trend
    const coherenceTrend = this.calculateTrend(overallCoherence, matchMinute);

    // Determine interventions needed
    const interventions = this.determineInterventions(
      predictedDeviations,
      riskProfile,
      individualCoherence
    );

    const state: CoherenceState = {
      timestamp,
      matchMinute,
      overallCoherence,
      predictedCoherence,
      formationCoherence,
      pressureCoherence,
      transitionCoherence,
      individualCoherence,
      activeDeviations,
      predictedDeviations,
      interventions,
      riskProfile,
      coherenceTrend,
    };

    this.currentState = state;
    this.stateHistory.push(state);

    // Keep history manageable
    if (this.stateHistory.length > 1000) {
      this.stateHistory = this.stateHistory.slice(-500);
    }

    return state;
  }

  private analyzeFormationCoherence(graph: TacticalGraph): DimensionalCoherence {
    const signature = graph.formationSignature;

    // Formation shape adherence
    const shapeAdherence = 1 - signature.deviationFromIdeal;

    // Line compactness
    const compactness = signature.compactnessIndex;

    // Width/depth balance
    const widthBalance = 1 - Math.abs(signature.widthStretchIndex - 0.5) * 2;
    const depthBalance = 1 - Math.abs(signature.depthStretchIndex - 0.5) * 2;

    // Asymmetry penalty
    const asymmetryPenalty = Math.abs(signature.leftSideWeight - signature.rightSideWeight);

    const subDimensions: SubDimensionScore[] = [
      { name: 'Shape Adherence', score: shapeAdherence * 100, weight: 0.3, threshold: 60, belowThreshold: shapeAdherence < 0.6 },
      { name: 'Compactness', score: compactness * 100, weight: 0.25, threshold: 50, belowThreshold: compactness < 0.5 },
      { name: 'Width Balance', score: widthBalance * 100, weight: 0.2, threshold: 50, belowThreshold: widthBalance < 0.5 },
      { name: 'Depth Balance', score: depthBalance * 100, weight: 0.15, threshold: 50, belowThreshold: depthBalance < 0.5 },
      { name: 'Symmetry', score: (1 - asymmetryPenalty) * 100, weight: 0.1, threshold: 40, belowThreshold: asymmetryPenalty > 0.6 },
    ];

    const current = subDimensions.reduce((sum, sd) => sum + sd.score * sd.weight, 0);

    // Predict based on trend
    const trend = this.determineSubTrend(current, 'formation');

    const risks: DimensionalRisk[] = [];
    if (shapeAdherence < 0.5) {
      risks.push({
        description: 'Formation breaking down under pressure',
        probability: 0.7,
        timeToOccur: 15,
        severity: 'high',
        affectedPlayers: [],
      });
    }
    if (compactness < 0.4) {
      risks.push({
        description: 'Team too stretched, vulnerable to counter',
        probability: 0.6,
        timeToOccur: 10,
        severity: 'medium',
        affectedPlayers: [],
      });
    }

    return {
      current,
      predicted: this.projectValue(current, trend, 30),
      trend,
      subDimensions,
      risks,
    };
  }

  private analyzePressureCoherence(
    graph: TacticalGraph,
    patternMatches: PatternMatchResult[]
  ): DimensionalCoherence {
    const pressureState = graph.pressureState;

    // Pressing intensity alignment
    const intensityScore = pressureState.pressureIntensity * 100;

    // Cover shadow efficiency
    const coverShadowScore = pressureState.coverShadowEfficiency * 100;

    // Pressing coordination (from pattern matches)
    const pressingPatterns = patternMatches.filter(p =>
      p.pattern.category === 'pressing_trap'
    );
    const coordinationScore = pressingPatterns.length > 0 ?
      pressingPatterns[0].matchConfidence * 100 : 50;

    // Pressure line consistency
    const lineConsistency = pressureState.pressureTriggerActive ? 80 : 50;

    const subDimensions: SubDimensionScore[] = [
      { name: 'Pressing Intensity', score: intensityScore, weight: 0.3, threshold: 40, belowThreshold: intensityScore < 40 },
      { name: 'Cover Shadows', score: coverShadowScore, weight: 0.25, threshold: 50, belowThreshold: coverShadowScore < 50 },
      { name: 'Coordination', score: coordinationScore, weight: 0.25, threshold: 60, belowThreshold: coordinationScore < 60 },
      { name: 'Line Consistency', score: lineConsistency, weight: 0.2, threshold: 50, belowThreshold: lineConsistency < 50 },
    ];

    const current = subDimensions.reduce((sum, sd) => sum + sd.score * sd.weight, 0);
    const trend = this.determineSubTrend(current, 'pressure');

    const risks: DimensionalRisk[] = [];
    if (pressureState.pressingPlayersCount < 2 && pressureState.pressureTriggerActive) {
      risks.push({
        description: 'Isolated pressing - teammate support lacking',
        probability: 0.8,
        timeToOccur: 5,
        severity: 'high',
        affectedPlayers: [],
      });
    }
    if (pressureState.escapeRoutesBlocked < 2) {
      risks.push({
        description: 'Escape routes available - press likely to fail',
        probability: 0.6,
        timeToOccur: 8,
        severity: 'medium',
        affectedPlayers: [],
      });
    }

    return {
      current,
      predicted: this.projectValue(current, trend, 30),
      trend,
      subDimensions,
      risks,
    };
  }

  private analyzeTransitionCoherence(graph: TacticalGraph): DimensionalCoherence {
    // Analyze readiness for transitions
    const phase = graph.phase;

    // Transition readiness based on player positioning
    const transitionReady = graph.nodes.filter(n =>
      n.currentRole === 'transition_sprinter' ||
      n.currentRole === 'recovery_runner'
    ).length;

    const readinessScore = Math.min(100, transitionReady * 25);

    // Compactness for defensive transition
    const defensiveReadiness = graph.formationSignature.compactnessIndex * 100;

    // Sprint capacity for attacking transition
    const attackingReadiness = graph.nodes.reduce((sum, n) =>
      sum + n.sprintCapacityRemaining, 0
    ) / graph.nodes.length;

    // Balance score
    const balanceScore = (defensiveReadiness + attackingReadiness) / 2;

    const subDimensions: SubDimensionScore[] = [
      { name: 'Transition Readiness', score: readinessScore, weight: 0.3, threshold: 50, belowThreshold: readinessScore < 50 },
      { name: 'Defensive Transition', score: defensiveReadiness, weight: 0.3, threshold: 50, belowThreshold: defensiveReadiness < 50 },
      { name: 'Attacking Transition', score: attackingReadiness, weight: 0.25, threshold: 60, belowThreshold: attackingReadiness < 60 },
      { name: 'Balance', score: balanceScore, weight: 0.15, threshold: 50, belowThreshold: balanceScore < 50 },
    ];

    const current = subDimensions.reduce((sum, sd) => sum + sd.score * sd.weight, 0);
    const trend = this.determineSubTrend(current, 'transition');

    const risks: DimensionalRisk[] = [];
    if (readinessScore < 40) {
      risks.push({
        description: 'Team unprepared for sudden transition moment',
        probability: 0.5,
        timeToOccur: 20,
        severity: 'medium',
        affectedPlayers: [],
      });
    }

    return {
      current,
      predicted: this.projectValue(current, trend, 30),
      trend,
      subDimensions,
      risks,
    };
  }

  private analyzeIndividualCoherence(graph: TacticalGraph): Map<string, IndividualCoherence> {
    const results = new Map<string, IndividualCoherence>();

    graph.nodes.forEach(node => {
      const twin = this.twins.get(node.playerId);

      // Calculate individual scores
      const positionalAdherence = this.calculatePositionalAdherence(node);
      const tacticalExecution = this.calculateTacticalExecution(node);
      const workRateCoherence = this.calculateWorkRateCoherence(node);
      const decisionCoherence = this.calculateDecisionCoherence(node);

      const currentScore = (
        positionalAdherence * 0.3 +
        tacticalExecution * 0.3 +
        workRateCoherence * 0.2 +
        decisionCoherence * 0.2
      );

      // Predict individual decline
      const risks = this.assessPlayerRisks(node, twin);

      const predictedScore = this.predictIndividualScore(currentScore, risks);

      const recommendations = this.generatePlayerRecommendations(
        node,
        currentScore,
        risks
      );

      results.set(node.playerId, {
        playerId: node.playerId,
        currentScore,
        predictedScore,
        positionalAdherence,
        tacticalExecution,
        workRateCoherence,
        decisionCoherence,
        risks,
        recommendations,
      });
    });

    return results;
  }

  private calculatePositionalAdherence(node: PlayerNode): number {
    // How well player maintains expected position
    return (1 - Math.min(1, Math.random() * 0.3)) * 100; // Placeholder
  }

  private calculateTacticalExecution(node: PlayerNode): number {
    // How well player executes tactical instructions
    return node.roleConfidence * 100;
  }

  private calculateWorkRateCoherence(node: PlayerNode): number {
    // Work rate relative to expectations
    const expectedIntensity = 0.7;
    const currentIntensity = 1 - node.fatigueLevel / 100;
    return Math.max(0, Math.min(100, currentIntensity / expectedIntensity * 100));
  }

  private calculateDecisionCoherence(node: PlayerNode): number {
    // Quality of decisions relative to game model
    return (1 - node.pressureIndex * 0.3) * 100;
  }

  private assessPlayerRisks(
    node: PlayerNode,
    twin?: NeuralDigitalTwin
  ): PlayerRisk[] {
    const risks: PlayerRisk[] = [];

    // Fatigue risk
    if (node.fatigueLevel > 60) {
      risks.push({
        type: 'fatigue',
        probability: node.fatigueLevel / 100,
        timeToImpact: 600 - node.fatigueLevel * 5,
        impact: 'Reduced work rate and decision quality',
        preventable: true,
      });
    }

    // Positioning drift
    if (node.roleConfidence < 0.7) {
      risks.push({
        type: 'positioning',
        probability: 1 - node.roleConfidence,
        timeToImpact: 30,
        impact: 'Player drifting from tactical responsibilities',
        preventable: true,
      });
    }

    // Intensity drop
    if (node.sprintCapacityRemaining < 30) {
      risks.push({
        type: 'intensity',
        probability: 0.7,
        timeToImpact: 120,
        impact: 'Unable to maintain required intensity',
        preventable: false,
      });
    }

    return risks;
  }

  private predictIndividualScore(currentScore: number, risks: PlayerRisk[]): number {
    let predicted = currentScore;

    risks.forEach(risk => {
      const impactFactor = risk.probability * 0.15;
      predicted -= predicted * impactFactor;
    });

    return Math.max(0, predicted);
  }

  private generatePlayerRecommendations(
    node: PlayerNode,
    score: number,
    risks: PlayerRisk[]
  ): string[] {
    const recommendations: string[] = [];

    if (score < 60) {
      recommendations.push('Requires immediate tactical reminder');
    }

    risks.forEach(risk => {
      if (risk.type === 'fatigue' && risk.preventable) {
        recommendations.push('Consider substitution within 10 minutes');
      }
      if (risk.type === 'positioning') {
        recommendations.push('Reinforce positional instructions');
      }
      if (risk.type === 'intensity') {
        recommendations.push('Reduce high-intensity demands');
      }
    });

    return recommendations;
  }

  private calculateOverallCoherence(
    formation: DimensionalCoherence,
    pressure: DimensionalCoherence,
    transition: DimensionalCoherence,
    individual: Map<string, IndividualCoherence>
  ): number {
    const formationWeight = 0.3;
    const pressureWeight = 0.25;
    const transitionWeight = 0.2;
    const individualWeight = 0.25;

    const individualAvg = [...individual.values()].reduce(
      (sum, ic) => sum + ic.currentScore, 0
    ) / individual.size;

    return (
      formation.current * formationWeight +
      pressure.current * pressureWeight +
      transition.current * transitionWeight +
      individualAvg * individualWeight
    );
  }

  private predictFutureCoherence(
    currentOverall: number,
    formation: DimensionalCoherence,
    pressure: DimensionalCoherence,
    transition: DimensionalCoherence,
    individual: Map<string, IndividualCoherence>,
    matchMinute: number
  ): PredictedCoherence {
    // Gather prediction factors
    const keyFactors: PredictionFactor[] = [];

    // Fatigue factor (increases over time)
    const fatigueImpact = -0.1 * (matchMinute / 90);
    keyFactors.push({
      factor: 'Accumulated Fatigue',
      impact: fatigueImpact,
      timeToImpact: 300,
      mitigable: true,
      suggestedMitigation: 'Strategic substitutions',
    });

    // Formation stability factor
    if (formation.trend === 'declining') {
      keyFactors.push({
        factor: 'Formation Instability',
        impact: -0.15,
        timeToImpact: 60,
        mitigable: true,
        suggestedMitigation: 'Reinforce defensive shape',
      });
    }

    // Individual risk factors
    const highRiskPlayers = [...individual.values()].filter(
      ic => ic.risks.some(r => r.probability > 0.6)
    );
    if (highRiskPlayers.length > 2) {
      keyFactors.push({
        factor: 'Multiple Player Risks',
        impact: -0.2,
        timeToImpact: 120,
        mitigable: true,
        suggestedMitigation: 'Address individual player issues',
      });
    }

    // Calculate predictions
    const totalImpact = keyFactors.reduce((sum, f) => sum + f.impact, 0);

    const shortTerm = {
      value: Math.max(0, currentOverall * (1 + totalImpact * 0.1)),
      confidence: 0.9,
    };

    const mediumTerm = {
      value: Math.max(0, currentOverall * (1 + totalImpact * 0.3)),
      confidence: 0.75,
    };

    const longTerm = {
      value: Math.max(0, currentOverall * (1 + totalImpact)),
      confidence: 0.6,
    };

    // Determine trajectory
    let trajectory: 'improving' | 'stable' | 'declining' | 'critical';
    if (longTerm.value < this.config.breakdownThreshold * 100) {
      trajectory = 'critical';
    } else if (longTerm.value < shortTerm.value - 10) {
      trajectory = 'declining';
    } else if (longTerm.value > shortTerm.value + 5) {
      trajectory = 'improving';
    } else {
      trajectory = 'stable';
    }

    return {
      shortTerm,
      mediumTerm,
      longTerm,
      trajectory,
      keyFactors,
    };
  }

  private identifyDeviations(
    graph: TacticalGraph,
    individual: Map<string, IndividualCoherence>
  ): TacticalDeviation[] {
    const deviations: TacticalDeviation[] = [];

    individual.forEach((ic, playerId) => {
      if (ic.positionalAdherence < 50) {
        deviations.push({
          id: `dev_${playerId}_pos_${Date.now()}`,
          timestamp: new Date(),
          minute: Math.floor(Date.now() / 60000),
          type: 'position',
          expected: 'Maintain tactical position',
          actual: 'Drifting from assigned zone',
          severity: ic.positionalAdherence < 30 ? 'major' : 'moderate',
          context: `Player coherence score: ${ic.currentScore.toFixed(1)}`,
        });
      }

      if (ic.workRateCoherence < 50) {
        deviations.push({
          id: `dev_${playerId}_work_${Date.now()}`,
          timestamp: new Date(),
          minute: Math.floor(Date.now() / 60000),
          type: 'intensity',
          expected: 'Maintain required work rate',
          actual: 'Work rate below expectations',
          severity: ic.workRateCoherence < 30 ? 'major' : 'moderate',
          context: `Fatigue may be a factor`,
        });
      }
    });

    return deviations;
  }

  private predictDeviations(
    graph: TacticalGraph,
    formation: DimensionalCoherence,
    pressure: DimensionalCoherence,
    individual: Map<string, IndividualCoherence>,
    matchMinute: number
  ): PredictedDeviation[] {
    const predictions: PredictedDeviation[] = [];

    // Predict formation breakdown
    if (formation.trend === 'declining' && formation.current < 60) {
      predictions.push({
        id: `pred_formation_${Date.now()}`,
        predictedAt: Date.now(),
        expectedOccurrence: Date.now() + 60000,
        confidence: 0.7,
        type: 'formation_break',
        description: 'Formation likely to break down under continued pressure',
        affectedPlayers: [],
        affectedZone: 'defensive_third',
        severity: 'major',
        expectedImpact: 'Increased vulnerability to counter-attacks',
        preventionPossible: true,
        preventionActions: [
          {
            action: 'Reinforce compact shape',
            target: 'team',
            urgency: 'immediate',
            effectiveness: 0.7,
          },
          {
            action: 'Drop defensive line',
            target: 'unit',
            targetId: 'defense',
            urgency: 'soon',
            effectiveness: 0.6,
          },
        ],
      });
    }

    // Predict pressure collapse
    if (pressure.trend === 'declining' && pressure.current < 50) {
      predictions.push({
        id: `pred_pressure_${Date.now()}`,
        predictedAt: Date.now(),
        expectedOccurrence: Date.now() + 30000,
        confidence: 0.75,
        type: 'pressure_collapse',
        description: 'Pressing system likely to collapse',
        affectedPlayers: [],
        affectedZone: 'middle_third',
        severity: 'moderate',
        expectedImpact: 'Opponent gains easy progression',
        preventionPossible: true,
        preventionActions: [
          {
            action: 'Switch to mid-block',
            target: 'team',
            urgency: 'immediate',
            effectiveness: 0.8,
          },
        ],
      });
    }

    // Predict individual drifts
    individual.forEach((ic, playerId) => {
      if (ic.predictedScore < ic.currentScore - 15) {
        predictions.push({
          id: `pred_individual_${playerId}_${Date.now()}`,
          predictedAt: Date.now(),
          expectedOccurrence: Date.now() + 120000,
          confidence: 0.65,
          type: 'individual_drift',
          description: `${playerId} showing signs of tactical drift`,
          affectedPlayers: [playerId],
          affectedZone: 'multiple',
          severity: 'moderate',
          expectedImpact: 'Reduced tactical cohesion in player zone',
          preventionPossible: true,
          preventionActions: [
            {
              action: 'Direct instruction to player',
              target: 'player',
              targetId: playerId,
              urgency: 'soon',
              effectiveness: 0.75,
            },
          ],
        });
      }
    });

    return predictions;
  }

  private assessRiskProfile(
    overallCoherence: number,
    predicted: PredictedCoherence,
    activeDeviations: TacticalDeviation[],
    predictedDeviations: PredictedDeviation[]
  ): TacticalRiskProfile {
    // Calculate overall risk
    const coherenceRisk = 1 - overallCoherence / 100;
    const predictionRisk = 1 - predicted.longTerm.value / 100;
    const deviationRisk = Math.min(1, activeDeviations.length * 0.1 + predictedDeviations.length * 0.05);

    const overallRisk = coherenceRisk * 0.4 + predictionRisk * 0.35 + deviationRisk * 0.25;

    let riskCategory: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
    if (overallRisk < 0.2) riskCategory = 'minimal';
    else if (overallRisk < 0.4) riskCategory = 'low';
    else if (overallRisk < 0.6) riskCategory = 'moderate';
    else if (overallRisk < 0.8) riskCategory = 'high';
    else riskCategory = 'critical';

    const topRisks: TacticalRisk[] = predictedDeviations
      .filter(d => d.severity === 'major' || d.severity === 'critical')
      .map(d => ({
        id: d.id,
        name: d.type,
        description: d.description,
        probability: d.confidence,
        impact: d.severity === 'critical' ? 1 : 0.7,
        riskScore: d.confidence * (d.severity === 'critical' ? 1 : 0.7),
        timeHorizon: (d.expectedOccurrence - d.predictedAt) / 1000,
        category: 'structural' as const,
        mitigations: d.preventionActions.map(a => a.action),
      }));

    return {
      overallRisk,
      riskCategory,
      topRisks,
      emergingRisks: [],
      mitigatedRisks: [],
      vulnerabilities: this.identifyVulnerabilities(overallCoherence),
      exposures: [],
    };
  }

  private identifyVulnerabilities(coherence: number): TacticalVulnerability[] {
    const vulnerabilities: TacticalVulnerability[] = [];

    if (coherence < 60) {
      vulnerabilities.push({
        area: 'Transition Defense',
        description: 'Vulnerable during attacking-to-defensive transitions',
        exploitability: (60 - coherence) / 60,
        currentlyExposed: true,
        historicalExploits: 0,
      });
    }

    return vulnerabilities;
  }

  private calculateTrend(currentValue: number, matchMinute: number): CoherenceTrend {
    const recentStates = this.stateHistory.slice(-30);

    const calculateTrendData = (states: CoherenceState[]): TrendData => {
      const values = states.map(s => ({
        timestamp: s.timestamp,
        value: s.overallCoherence,
      }));

      if (values.length === 0) {
        return {
          values: [{ timestamp: Date.now(), value: currentValue }],
          average: currentValue,
          min: currentValue,
          max: currentValue,
          standardDeviation: 0,
          trend: 'stable',
          volatility: 0,
        };
      }

      const nums = values.map(v => v.value);
      const average = nums.reduce((a, b) => a + b, 0) / nums.length;
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const variance = nums.reduce((sum, n) => sum + Math.pow(n - average, 2), 0) / nums.length;
      const standardDeviation = Math.sqrt(variance);

      // Determine trend
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (values.length >= 3) {
        const recentAvg = nums.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const oldAvg = nums.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        if (recentAvg > oldAvg + 5) trend = 'improving';
        else if (recentAvg < oldAvg - 5) trend = 'declining';
      }

      return {
        values,
        average,
        min,
        max,
        standardDeviation,
        trend,
        volatility: standardDeviation / average,
      };
    };

    return {
      last5Minutes: calculateTrendData(recentStates.slice(-10)),
      last15Minutes: calculateTrendData(recentStates.slice(-30)),
      matchTotal: calculateTrendData(this.stateHistory),
      comparedToBaseline: 0,
      comparedToOpponent: 0,
    };
  }

  private determineInterventions(
    predictedDeviations: PredictedDeviation[],
    riskProfile: TacticalRiskProfile,
    individual: Map<string, IndividualCoherence>
  ): ActiveIntervention[] {
    if (!this.config.autoInterventionEnabled) {
      return [];
    }

    const interventions: ActiveIntervention[] = [];

    // Check for high-priority predicted deviations
    predictedDeviations
      .filter(d => d.preventionPossible && d.confidence > this.config.confidenceRequired)
      .slice(0, this.config.maxActiveInterventions)
      .forEach(deviation => {
        const topAction = deviation.preventionActions[0];
        if (topAction) {
          interventions.push({
            id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            startedAt: Date.now(),
            type: topAction.target === 'player' ? 'player_specific_alert' :
                  topAction.target === 'unit' ? 'unit_coordination' : 'formation_adjustment',
            target: topAction.targetId || 'team',
            message: topAction.action,
            status: 'pending',
            followUpRequired: deviation.severity === 'major' || deviation.severity === 'critical',
          });
        }
      });

    // Check for individual player interventions
    individual.forEach((ic, playerId) => {
      if (ic.currentScore < 50 && ic.recommendations.length > 0) {
        if (interventions.length < this.config.maxActiveInterventions) {
          interventions.push({
            id: `int_player_${playerId}_${Date.now()}`,
            startedAt: Date.now(),
            type: 'player_specific_alert',
            target: playerId,
            message: ic.recommendations[0],
            status: 'pending',
            followUpRequired: ic.currentScore < 40,
          });
        }
      }
    });

    return interventions;
  }

  private determineSubTrend(current: number, dimension: string): 'improving' | 'stable' | 'declining' {
    const relevantHistory = this.stateHistory.slice(-10);
    if (relevantHistory.length < 3) return 'stable';

    const getValue = (state: CoherenceState): number => {
      switch (dimension) {
        case 'formation': return state.formationCoherence.current;
        case 'pressure': return state.pressureCoherence.current;
        case 'transition': return state.transitionCoherence.current;
        default: return state.overallCoherence;
      }
    };

    const values = relevantHistory.map(getValue);
    const recentAvg = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const oldAvg = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;

    if (recentAvg > oldAvg + 5) return 'improving';
    if (recentAvg < oldAvg - 5) return 'declining';
    return 'stable';
  }

  private projectValue(
    current: number,
    trend: 'improving' | 'stable' | 'declining',
    seconds: number
  ): number {
    const rate = trend === 'improving' ? 0.5 : trend === 'declining' ? -0.5 : 0;
    return Math.max(0, Math.min(100, current + rate * (seconds / 60)));
  }

  // Public API for intervention feedback
  recordInterventionResult(result: InterventionResult): void {
    this.interventionHistory.push(result);

    // Limit history
    if (this.interventionHistory.length > 100) {
      this.interventionHistory = this.interventionHistory.slice(-50);
    }
  }

  // Get current state
  getCurrentState(): CoherenceState | null {
    return this.currentState;
  }

  // Get coherence summary for display
  getCoherenceSummary(): CoherenceSummary {
    if (!this.currentState) {
      return {
        overall: 0,
        formation: 0,
        pressure: 0,
        transition: 0,
        trajectory: 'stable',
        topRisk: null,
        activeInterventions: 0,
      };
    }

    return {
      overall: this.currentState.overallCoherence,
      formation: this.currentState.formationCoherence.current,
      pressure: this.currentState.pressureCoherence.current,
      transition: this.currentState.transitionCoherence.current,
      trajectory: this.currentState.predictedCoherence.trajectory,
      topRisk: this.currentState.riskProfile.topRisks[0] || null,
      activeInterventions: this.currentState.interventions.length,
    };
  }
}

// Summary type for UI
export interface CoherenceSummary {
  overall: number;
  formation: number;
  pressure: number;
  transition: number;
  trajectory: 'improving' | 'stable' | 'declining' | 'critical';
  topRisk: TacticalRisk | null;
  activeInterventions: number;
}
