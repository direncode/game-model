// Coherence Score Aggregator
// Unified interface integrating all advanced game model and scoring systems
// Provides real-time coherence analytics with multi-dimensional analysis

import {
  AdvancedGameModelEngine,
  AdvancedGameModel,
  RealtimeContext,
  ResolvedGameModel,
  ModelOverrideLayer,
  DynamicRule,
  PREDEFINED_LAYERS,
  PREDEFINED_RULES,
  createAdvancedGameModelEngine,
} from './advanced-game-model';

import {
  RealtimeAnalyticsBridge,
  RealTimeAnalyticsData,
  PlaceholderAnalyticsProvider,
  ProviderStatus,
  createAnalyticsBridge,
  createPlaceholderProvider,
} from './realtime-analytics-bridge';

import {
  CompositeScoringEngine,
  CompositeScore,
  DimensionalScores,
  createCompositeScoringEngine,
} from './composite-scoring-engine';

import {
  GameModel,
  DigitalTwin,
  CoherenceReport,
  CriticalDeviation,
  LivePlayerData,
  TrackingMetrics,
} from '@/types';

// ==================== Aggregator Types ====================

export interface CoherenceAggregatorConfig {
  enableRealTimeAnalytics: boolean;
  enablePredictiveScoring: boolean;
  enableDynamicRules: boolean;
  enableBayesianInference: boolean;
  updateIntervalMs: number;
  coherenceThresholds: CoherenceThresholds;
  alertConfig: AlertConfig;
}

export interface CoherenceThresholds {
  critical: number;
  warning: number;
  optimal: number;
}

export interface AlertConfig {
  enableAlerts: boolean;
  criticalAlertCooldown: number;
  warningAlertCooldown: number;
  maxActiveAlerts: number;
}

export interface AggregatedCoherenceResult {
  timestamp: Date;
  matchMinute: number;

  // Primary scores
  overallCoherence: number;
  confidence: number;

  // Multi-dimensional analysis
  dimensionalScores: DimensionalScores;

  // Breakdowns
  playerScores: Map<string, PlayerCoherenceResult>;
  phaseScores: Map<string, number>;
  principleScores: Map<string, number>;
  zoneScores: Map<string, number>;

  // Temporal analysis
  temporal: TemporalCoherenceData;

  // Predictive insights
  predictions: CoherencePredictions;

  // Bayesian metrics
  bayesianAnalysis: BayesianAnalysis;

  // Alerts and recommendations
  alerts: CoherenceAlert[];
  recommendations: CoherenceRecommendation[];

  // Diagnostics
  systemHealth: SystemHealthReport;

  // Raw composite score for detailed analysis
  rawCompositeScore?: CompositeScore;
}

export interface PlayerCoherenceResult {
  playerId: string;
  name?: string;
  position?: string;
  overallScore: number;
  scores: {
    positional: number;
    physical: number;
    tactical: number;
    collective: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  deviations: CoherenceDeviation[];
  recommendation?: string;
}

export interface CoherenceDeviation {
  type: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  impact: number;
  suggestedAction?: string;
}

export interface TemporalCoherenceData {
  currentScore: number;
  movingAverage5Min: number;
  movingAverage15Min: number;
  trend: {
    direction: 'up' | 'down' | 'flat';
    magnitude: number;
    confidence: number;
  };
  volatility: number;
  momentum: number;
  changePoints: ChangePoint[];
}

export interface ChangePoint {
  minute: number;
  previousScore: number;
  newScore: number;
  cause?: string;
}

export interface CoherencePredictions {
  next5Minutes: PredictionBand;
  next15Minutes: PredictionBand;
  endOfMatch: PredictionBand;
  scenarios: ScenarioPrediction[];
  riskAssessment: RiskAssessment;
}

export interface PredictionBand {
  mean: number;
  lower: number;
  upper: number;
  confidence: number;
}

export interface ScenarioPrediction {
  name: string;
  description: string;
  probability: number;
  projectedScore: number;
  keyFactors: string[];
  recommendedActions: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'moderate' | 'high' | 'critical';
  riskScore: number;
  primaryRiskFactors: string[];
  mitigationStrategies: string[];
}

export interface BayesianAnalysis {
  priorExpectation: number;
  observedEvidence: number;
  posteriorEstimate: number;
  beliefShift: number;
  confidenceInterval: [number, number];
  informationGain: number;
}

export interface CoherenceAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'tactical' | 'physical' | 'positional' | 'collective' | 'system';
  title: string;
  message: string;
  affectedPlayers?: string[];
  timestamp: Date;
  acknowledged: boolean;
  autoResolve: boolean;
  resolvedAt?: Date;
}

export interface CoherenceRecommendation {
  id: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  expectedImpact: number;
  implementationSteps: string[];
  affectedPlayers?: string[];
}

export interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'critical';
  analyticsStatus: Map<string, ProviderStatus>;
  dataQuality: number;
  latency: number;
  lastUpdate: Date;
  warnings: string[];
  errors: string[];
}

// ==================== Main Aggregator Class ====================

export class CoherenceAggregator {
  private gameModelEngine: AdvancedGameModelEngine;
  private analyticsBridge: RealtimeAnalyticsBridge;
  private scoringEngine: CompositeScoringEngine;

  private config: CoherenceAggregatorConfig;
  private activeModel: AdvancedGameModel | null = null;
  private digitalTwins: Map<string, DigitalTwin> = new Map();
  private alertHistory: CoherenceAlert[] = [];
  private coherenceHistory: CoherenceHistoryEntry[] = [];
  private lastUpdateTime: Date = new Date();

  private updateInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(config?: Partial<CoherenceAggregatorConfig>) {
    this.config = {
      enableRealTimeAnalytics: config?.enableRealTimeAnalytics ?? true,
      enablePredictiveScoring: config?.enablePredictiveScoring ?? true,
      enableDynamicRules: config?.enableDynamicRules ?? true,
      enableBayesianInference: config?.enableBayesianInference ?? true,
      updateIntervalMs: config?.updateIntervalMs ?? 1000,
      coherenceThresholds: config?.coherenceThresholds ?? {
        critical: 40,
        warning: 60,
        optimal: 80,
      },
      alertConfig: config?.alertConfig ?? {
        enableAlerts: true,
        criticalAlertCooldown: 60000,
        warningAlertCooldown: 30000,
        maxActiveAlerts: 10,
      },
    };

    this.gameModelEngine = createAdvancedGameModelEngine();
    this.analyticsBridge = createAnalyticsBridge({
      defaultProviders: ['gps_tracking', 'video_analytics', 'tactical_ai'],
      autoConnect: true,
    });
    this.scoringEngine = createCompositeScoringEngine();
  }

  // Initialize the aggregator with a game model
  async initialize(baseModel: GameModel, digitalTwins: Map<string, DigitalTwin>): Promise<void> {
    // Create advanced game model from base
    this.activeModel = this.gameModelEngine.createAdvancedModel(baseModel, {
      version: '2.0.0',
    });

    // Add predefined override layers
    this.addPredefinedLayers();

    // Add predefined dynamic rules
    this.addPredefinedRules();

    // Store digital twins
    this.digitalTwins = digitalTwins;

    // Connect analytics providers
    await this.analyticsBridge.connectAll();

    console.log('[CoherenceAggregator] Initialized successfully');
  }

  // Calculate coherence for current game state
  async calculateCoherence(
    matchMinute: number,
    score: { home: number; away: number },
    playerData: Map<string, LivePlayerData>,
    additionalContext?: Partial<RealtimeContext>
  ): Promise<AggregatedCoherenceResult> {
    if (!this.activeModel) {
      throw new Error('Aggregator not initialized. Call initialize() first.');
    }

    const startTime = performance.now();

    // Build context
    const context = this.buildContext(matchMinute, score, playerData, additionalContext);

    // Resolve effective model with all layers and rules
    const resolvedModel = this.gameModelEngine.resolveEffectiveModel(
      this.activeModel.id,
      context
    );

    // Fetch real-time analytics data
    const analyticsData = await this.fetchAnalyticsData(matchMinute, playerData);

    // Calculate composite score
    const compositeScore = this.scoringEngine.calculateCompositeScore(
      analyticsData,
      resolvedModel,
      context,
      this.digitalTwins
    );

    // Build aggregated result
    const result = this.buildAggregatedResult(
      matchMinute,
      compositeScore,
      resolvedModel,
      context,
      analyticsData,
      startTime
    );

    // Update history
    this.updateHistory(result);

    // Generate alerts
    if (this.config.alertConfig.enableAlerts) {
      this.generateAlerts(result);
    }

    // Emit update event
    this.emit('coherence_updated', result);

    this.lastUpdateTime = new Date();

    return result;
  }

  // Add a dynamic override layer
  addOverrideLayer(
    layer: Omit<ModelOverrideLayer, 'id' | 'createdAt' | 'appliedCount'>
  ): ModelOverrideLayer | null {
    if (!this.activeModel) return null;
    return this.gameModelEngine.addOverrideLayer(this.activeModel.id, layer);
  }

  // Add a dynamic rule
  addDynamicRule(
    rule: Omit<DynamicRule, 'id' | 'currentActivations'>
  ): DynamicRule | null {
    if (!this.activeModel) return null;
    return this.gameModelEngine.addDynamicRule(this.activeModel.id, rule);
  }

  // Update digital twin
  updateDigitalTwin(playerId: string, twin: DigitalTwin): void {
    this.digitalTwins.set(playerId, twin);
  }

  // Get coherence history
  getCoherenceHistory(minutes?: number): CoherenceHistoryEntry[] {
    if (!minutes) return [...this.coherenceHistory];
    return this.coherenceHistory.filter(
      entry => entry.minute >= this.coherenceHistory[this.coherenceHistory.length - 1]?.minute - minutes
    );
  }

  // Get active alerts
  getActiveAlerts(): CoherenceAlert[] {
    return this.alertHistory.filter(alert => !alert.resolvedAt);
  }

  // Acknowledge alert
  acknowledgeAlert(alertId: string): void {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  // Resolve alert
  resolveAlert(alertId: string): void {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date();
    }
  }

  // Subscribe to events
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  // Unsubscribe from events
  off(event: string, callback: (data: unknown) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  // Start auto-update loop
  startAutoUpdate(
    getPlayerData: () => Map<string, LivePlayerData>,
    getMatchState: () => { minute: number; score: { home: number; away: number } }
  ): void {
    this.stopAutoUpdate();

    this.updateInterval = setInterval(async () => {
      try {
        const playerData = getPlayerData();
        const matchState = getMatchState();
        await this.calculateCoherence(matchState.minute, matchState.score, playerData);
      } catch (error) {
        console.error('[CoherenceAggregator] Auto-update error:', error);
      }
    }, this.config.updateIntervalMs);
  }

  // Stop auto-update loop
  stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Get system status
  getSystemStatus(): SystemHealthReport {
    const analyticsStatus = this.analyticsBridge.getProviderStatus();
    const connectedCount = Array.from(analyticsStatus.values()).filter(s => s === 'connected').length;
    const totalCount = analyticsStatus.size;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (connectedCount === 0) {
      status = 'critical';
    } else if (connectedCount < totalCount) {
      status = 'degraded';
    }

    return {
      status,
      analyticsStatus,
      dataQuality: connectedCount / Math.max(1, totalCount),
      latency: performance.now() - this.lastUpdateTime.getTime(),
      lastUpdate: this.lastUpdateTime,
      warnings: status === 'degraded' ? ['Some analytics providers disconnected'] : [],
      errors: status === 'critical' ? ['No analytics providers connected'] : [],
    };
  }

  // Reset the aggregator
  reset(): void {
    this.stopAutoUpdate();
    this.coherenceHistory = [];
    this.alertHistory = [];
    this.scoringEngine.reset();
  }

  // Cleanup
  destroy(): void {
    this.reset();
    this.eventListeners.clear();
  }

  // Private methods

  private addPredefinedLayers(): void {
    if (!this.activeModel) return;

    for (const [name, layer] of Object.entries(PREDEFINED_LAYERS)) {
      this.gameModelEngine.addOverrideLayer(this.activeModel.id, layer);
    }
  }

  private addPredefinedRules(): void {
    if (!this.activeModel) return;

    for (const [name, rule] of Object.entries(PREDEFINED_RULES)) {
      this.gameModelEngine.addDynamicRule(this.activeModel.id, rule);
    }
  }

  private buildContext(
    matchMinute: number,
    score: { home: number; away: number },
    playerData: Map<string, LivePlayerData>,
    additionalContext?: Partial<RealtimeContext>
  ): RealtimeContext {
    // Calculate average fatigue
    const fatigueValues = Array.from(this.digitalTwins.values()).map(t => t.currentState.fatigue);
    const averageFatigue = fatigueValues.length > 0
      ? fatigueValues.reduce((a, b) => a + b, 0) / fatigueValues.length
      : 50;

    // Calculate possession from player data
    const possession = 50; // Would calculate from actual data

    // Calculate momentum from recent history
    let momentum = 0;
    if (this.coherenceHistory.length >= 2) {
      const recent = this.coherenceHistory.slice(-5);
      momentum = recent[recent.length - 1].overallScore - recent[0].overallScore;
    }

    // Calculate team metrics
    const positions = Array.from(playerData.values()).map(p => p.currentMetrics.position);
    const teamMetrics = this.calculateTeamMetrics(positions, playerData);

    // Determine current phase
    const currentPhase = this.determinePhase(possession, score, matchMinute);

    return {
      matchMinute,
      score,
      possession,
      momentum,
      averageFatigue,
      currentPhase,
      recentEvents: [],
      teamMetrics,
      ...additionalContext,
    };
  }

  private calculateTeamMetrics(
    positions: { x: number; y: number; zone: string; heatmap: unknown }[],
    playerData: Map<string, LivePlayerData>
  ): RealtimeContext['teamMetrics'] {
    if (positions.length === 0) {
      return {
        compactness: 50,
        pressureSuccess: 0.5,
        passAccuracy: 0.75,
      };
    }

    // Calculate compactness
    const xs = positions.map(p => p.x);
    const ys = positions.map(p => p.y);
    const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;

    const avgDistFromCentroid = positions.reduce((sum, p) => {
      return sum + Math.sqrt(Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2));
    }, 0) / positions.length;

    const compactness = Math.max(0, 100 - avgDistFromCentroid * 2);

    // Calculate pass accuracy from player data
    let totalPasses = 0;
    let completedPasses = 0;
    for (const [, data] of playerData) {
      // Would extract from actual metrics
    }
    const passAccuracy = totalPasses > 0 ? completedPasses / totalPasses : 0.75;

    return {
      compactness,
      pressureSuccess: 0.5, // Would calculate from actual data
      passAccuracy,
    };
  }

  private determinePhase(
    possession: number,
    score: { home: number; away: number },
    minute: number
  ): string {
    // Simplified phase determination
    if (possession > 60) {
      if (minute < 30) return 'buildUp';
      return 'progression';
    } else if (possession < 40) {
      return 'pressing';
    }
    return 'defensiveBlock';
  }

  private async fetchAnalyticsData(
    matchMinute: number,
    playerData: Map<string, LivePlayerData>
  ): Promise<RealTimeAnalyticsData> {
    if (this.config.enableRealTimeAnalytics) {
      try {
        return await this.analyticsBridge.fetchRealTimeData('match-001', matchMinute);
      } catch (error) {
        console.warn('[CoherenceAggregator] Failed to fetch analytics data, using fallback');
      }
    }

    // Build fallback data from player data
    return this.buildFallbackAnalyticsData(matchMinute, playerData);
  }

  private buildFallbackAnalyticsData(
    matchMinute: number,
    playerData: Map<string, LivePlayerData>
  ): RealTimeAnalyticsData {
    const playerMetrics = new Map();

    for (const [playerId, data] of playerData) {
      playerMetrics.set(playerId, {
        playerId,
        physical: {
          currentSpeed: data.currentMetrics.currentSpeed,
          maxSpeedReached: data.currentMetrics.maxSpeed,
          distanceCovered: data.cumulativeMetrics.totalDistance,
          sprintCount: data.cumulativeMetrics.accelerations.high,
          highIntensityRunCount: Math.floor(data.cumulativeMetrics.highSpeedRunningDistance / 20),
          accelerations: data.cumulativeMetrics.accelerations.total,
          decelerations: data.cumulativeMetrics.decelerations.total,
          metabolicPower: data.currentMetrics.metabolicPower,
          playerLoad: data.currentMetrics.playerLoad,
        },
        positional: {
          currentX: data.currentMetrics.position.x,
          currentY: data.currentMetrics.position.y,
          zoneOccupancy: data.currentMetrics.position.zone,
          heatmapIntensity: 50,
          distanceFromOptimal: 5,
          coverageShadow: 0,
        },
        technical: {
          passesAttempted: 0,
          passesCompleted: 0,
          passAccuracy: 0,
          touchesInFinalThird: 0,
          duelsWon: 0,
          duelsLost: 0,
          pressuresApplied: 0,
          pressureSuccessRate: 0,
          xT_received: 0,
          xT_generated: 0,
        },
        cognitive: {
          decisionSpeed: 500,
          optimalDecisionRate: 0.7,
          spatialAwareness: 70,
          anticipationScore: 65,
          communicationFrequency: 0,
        },
        derived: {
          workRateIndex: (data.cumulativeMetrics.distancePerMinute / 120) * 100,
          tacticalComplianceIndex: data.coherenceScore,
          fatigueIndex: 30,
          influenceScore: 50,
          riskExposure: 20,
        },
      });
    }

    return {
      timestamp: new Date(),
      matchId: 'match-001',
      minute: matchMinute,
      playerMetrics,
      teamMetrics: {
        shape: {
          compactness: 60,
          width: 40,
          depth: 35,
          centroidX: 0,
          centroidY: 0,
          defensiveLineHeight: 30,
          engagementLine: 45,
        },
        collective: {
          possession: 50,
          territorialControl: 50,
          fieldTilt: 50,
          ppda: 10,
          pressureIntensity: 50,
          passSequenceLength: 4,
          directnessIndex: 50,
        },
        network: {
          passingConnectivity: 0.7,
          clusteringCoefficient: 0.5,
          centralityDistribution: [],
          keyPlayerDependency: 0.3,
          triangleCount: 0,
        },
        momentum: {
          currentMomentum: 0,
          momentumTrend: 0,
          dangerzoneEntries: 0,
          chancesCreated: 0,
          xG: 0,
          xGA: 0,
        },
      },
      tacticalMetrics: {
        patterns: {
          activePatterns: [],
          patternSuccessRate: 0,
          patternDiversity: 0,
          opponentPatternExploitation: 0,
        },
        phases: {
          currentPhase: 'buildUp',
          phaseEffectiveness: 60,
          transitionSpeed: 5,
          phaseCoherence: 65,
        },
        pressing: {
          pressTriggerActivations: 0,
          pressSuccessRate: 0.5,
          counterPressIntensity: 5,
          pressDuration: 3,
          recoveryTime: 4,
        },
        space: {
          spaceCreated: 0,
          spaceConceded: 0,
          channelsExploited: 0,
          overloadZones: [],
          vulnerableZones: [],
        },
      },
      predictiveMetrics: {
        risk: {
          injuryRiskByPlayer: new Map(),
          fatigueProjection: new Map(),
          cardRisk: new Map(),
          concessionProbability: 0.3,
        },
        opportunity: {
          goalProbabilityNext5: 0.1,
          optimalSubstitutionTime: 65,
          tacticalChangeImpact: new Map(),
          weaknessExploitationScore: 50,
        },
        performance: {
          projectedCoherence: [70, 68, 66, 64, 62],
          projectedPossession: [50, 50, 50, 50, 50],
          projectedxG: 0,
          projectedxGA: 0,
        },
      },
      enrichments: [],
    };
  }

  private buildAggregatedResult(
    matchMinute: number,
    compositeScore: CompositeScore,
    resolvedModel: ResolvedGameModel,
    context: RealtimeContext,
    analyticsData: RealTimeAnalyticsData,
    startTime: number
  ): AggregatedCoherenceResult {
    // Build player scores
    const playerScores = new Map<string, PlayerCoherenceResult>();
    for (const [playerId, score] of compositeScore.breakdown.byPlayer) {
      playerScores.set(playerId, {
        playerId,
        overallScore: score.overall,
        scores: {
          positional: compositeScore.dimensions.positional.subComponents.find(s => s.name === playerId)?.value ?? 70,
          physical: compositeScore.dimensions.intensity.subComponents.find(s => s.name === playerId)?.value ?? 70,
          tactical: compositeScore.dimensions.roleExecution.subComponents.find(s => s.name === playerId)?.value ?? 70,
          collective: compositeScore.dimensions.teamShape.value,
        },
        trend: this.getPlayerTrend(playerId),
        riskLevel: score.riskLevel,
        deviations: this.buildDeviations(score.deviations),
        recommendation: score.recommendations[0],
      });
    }

    // Build temporal data
    const temporal = this.buildTemporalData(compositeScore.temporal);

    // Build predictions
    const predictions = this.buildPredictions(compositeScore.temporal.predictions, context);

    // Build Bayesian analysis
    const bayesianAnalysis = this.buildBayesianAnalysis(compositeScore.bayesian);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      compositeScore,
      context,
      resolvedModel
    );

    // Build system health
    const systemHealth = this.buildSystemHealth(compositeScore.diagnostics, startTime);

    return {
      timestamp: new Date(),
      matchMinute,
      overallCoherence: Math.round(compositeScore.overall),
      confidence: compositeScore.confidence,
      dimensionalScores: compositeScore.dimensions,
      playerScores,
      phaseScores: compositeScore.breakdown.byPhase,
      principleScores: compositeScore.breakdown.byPrinciple,
      zoneScores: compositeScore.breakdown.byZone,
      temporal,
      predictions,
      bayesianAnalysis,
      alerts: this.getActiveAlerts(),
      recommendations,
      systemHealth,
      rawCompositeScore: compositeScore,
    };
  }

  private buildDeviations(deviations: CoherenceDeviation[]): CoherenceDeviation[] {
    // Convert from player score deviations
    return deviations || [];
  }

  private getPlayerTrend(playerId: string): 'improving' | 'stable' | 'declining' {
    const recentHistory = this.coherenceHistory.slice(-5);
    if (recentHistory.length < 2) return 'stable';

    const playerScores = recentHistory
      .map(h => h.playerScores.get(playerId)?.overallScore)
      .filter((s): s is number => s !== undefined);

    if (playerScores.length < 2) return 'stable';

    const trend = playerScores[playerScores.length - 1] - playerScores[0];

    if (trend > 5) return 'improving';
    if (trend < -5) return 'declining';
    return 'stable';
  }

  private buildTemporalData(temporal: CompositeScore['temporal']): TemporalCoherenceData {
    const changePoints: ChangePoint[] = [];

    // Detect change points in history
    for (let i = 1; i < this.coherenceHistory.length; i++) {
      const prev = this.coherenceHistory[i - 1];
      const curr = this.coherenceHistory[i];
      const change = curr.overallScore - prev.overallScore;

      if (Math.abs(change) > 10) {
        changePoints.push({
          minute: curr.minute,
          previousScore: prev.overallScore,
          newScore: curr.overallScore,
          cause: change > 0 ? 'improvement' : 'degradation',
        });
      }
    }

    return {
      currentScore: temporal.currentScore,
      movingAverage5Min: temporal.movingAverage,
      movingAverage15Min: temporal.exponentialMovingAverage,
      trend: {
        direction: temporal.trend.direction,
        magnitude: temporal.trend.strength,
        confidence: 1 - temporal.volatility / 100,
      },
      volatility: temporal.volatility,
      momentum: temporal.momentum.value,
      changePoints,
    };
  }

  private buildPredictions(
    predictions: CompositeScore['temporal']['predictions'],
    context: RealtimeContext
  ): CoherencePredictions {
    // Build risk assessment
    const riskFactors: string[] = [];
    let riskScore = 0;

    if (context.averageFatigue > 70) {
      riskFactors.push('High team fatigue');
      riskScore += 25;
    }

    if (context.momentum < -20) {
      riskFactors.push('Negative momentum');
      riskScore += 20;
    }

    if (context.score.home < context.score.away) {
      riskFactors.push('Trailing in match');
      riskScore += 15;
    }

    if (context.matchMinute > 75) {
      riskFactors.push('Late match fatigue effects');
      riskScore += 10;
    }

    let overallRisk: RiskAssessment['overallRisk'] = 'low';
    if (riskScore > 60) overallRisk = 'critical';
    else if (riskScore > 40) overallRisk = 'high';
    else if (riskScore > 20) overallRisk = 'moderate';

    const mitigationStrategies: string[] = [];
    if (context.averageFatigue > 70) {
      mitigationStrategies.push('Consider tactical substitutions');
    }
    if (context.momentum < -20) {
      mitigationStrategies.push('Tactical timeout to reorganize');
    }

    return {
      next5Minutes: {
        mean: predictions.next5Minutes.mean,
        lower: predictions.next5Minutes.lower95,
        upper: predictions.next5Minutes.upper95,
        confidence: predictions.next5Minutes.confidence,
      },
      next15Minutes: {
        mean: predictions.next15Minutes.mean,
        lower: predictions.next15Minutes.lower95,
        upper: predictions.next15Minutes.upper95,
        confidence: predictions.next15Minutes.confidence,
      },
      endOfMatch: {
        mean: predictions.endOfHalf.mean,
        lower: predictions.endOfHalf.lower95,
        upper: predictions.endOfHalf.upper95,
        confidence: predictions.endOfHalf.confidence * 0.8,
      },
      scenarios: predictions.scenarios.map(s => ({
        name: s.scenario,
        description: `${s.scenario} scenario`,
        probability: s.probability,
        projectedScore: s.projectedScore,
        keyFactors: s.keyFactors,
        recommendedActions: [],
      })),
      riskAssessment: {
        overallRisk,
        riskScore,
        primaryRiskFactors: riskFactors,
        mitigationStrategies,
      },
    };
  }

  private buildBayesianAnalysis(bayesian: CompositeScore['bayesian']): BayesianAnalysis {
    return {
      priorExpectation: bayesian.priorScore,
      observedEvidence: bayesian.likelihood * 100,
      posteriorEstimate: bayesian.posteriorScore,
      beliefShift: bayesian.beliefUpdate,
      confidenceInterval: [
        bayesian.posteriorScore - 10,
        bayesian.posteriorScore + 10,
      ],
      informationGain: bayesian.informationGain,
    };
  }

  private generateRecommendations(
    compositeScore: CompositeScore,
    context: RealtimeContext,
    resolvedModel: ResolvedGameModel
  ): CoherenceRecommendation[] {
    const recommendations: CoherenceRecommendation[] = [];

    // Check dimensional scores for issues
    for (const [name, dim] of Object.entries(compositeScore.dimensions)) {
      if (dim.value < 50) {
        recommendations.push({
          id: `rec-${name}-${Date.now()}`,
          priority: dim.value < 30 ? 'immediate' : 'high',
          category: name,
          title: `Address ${name} coherence`,
          description: `${name} dimension scoring ${Math.round(dim.value)}%, which is below acceptable threshold`,
          expectedImpact: 15,
          implementationSteps: [
            `Review ${name} metrics`,
            'Identify players contributing to low score',
            'Consider tactical adjustment or substitution',
          ],
          affectedPlayers: dim.subComponents.filter(s => s.anomaly).map(s => s.name),
        });
      }
    }

    // Context-based recommendations
    if (context.matchMinute > 70 && context.averageFatigue > 60) {
      recommendations.push({
        id: `rec-fatigue-${Date.now()}`,
        priority: 'high',
        category: 'physical',
        title: 'Consider fresh legs',
        description: 'Team fatigue is high in the late stages of the match',
        expectedImpact: 10,
        implementationSteps: [
          'Identify highest fatigue players',
          'Prepare substitutions',
          'Consider formation change to reduce workload',
        ],
      });
    }

    // Sort by priority
    const priorityOrder = { immediate: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations.slice(0, 5);
  }

  private buildSystemHealth(
    diagnostics: CompositeScore['diagnostics'],
    startTime: number
  ): SystemHealthReport {
    const analyticsStatus = this.analyticsBridge.getProviderStatus();

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const warnings: string[] = [...diagnostics.warnings];
    const errors: string[] = [];

    if (diagnostics.dataQuality.overall < 0.5) {
      status = 'critical';
      errors.push('Data quality below acceptable threshold');
    } else if (diagnostics.dataQuality.overall < 0.8) {
      status = 'degraded';
      warnings.push('Data quality degraded');
    }

    if (diagnostics.computationTime > 100) {
      warnings.push('Scoring computation exceeding target latency');
    }

    return {
      status,
      analyticsStatus,
      dataQuality: diagnostics.dataQuality.overall,
      latency: performance.now() - startTime,
      lastUpdate: new Date(),
      warnings,
      errors,
    };
  }

  private generateAlerts(result: AggregatedCoherenceResult): void {
    const now = Date.now();

    // Critical coherence alert
    if (result.overallCoherence < this.config.coherenceThresholds.critical) {
      const lastCritical = this.alertHistory
        .filter(a => a.type === 'critical' && !a.resolvedAt)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (!lastCritical || now - lastCritical.timestamp.getTime() > this.config.alertConfig.criticalAlertCooldown) {
        this.addAlert({
          type: 'critical',
          category: 'tactical',
          title: 'Critical Coherence Drop',
          message: `Team coherence has dropped to ${result.overallCoherence}%, which is below the critical threshold`,
          autoResolve: true,
        });
      }
    }

    // Warning coherence alert
    else if (result.overallCoherence < this.config.coherenceThresholds.warning) {
      const lastWarning = this.alertHistory
        .filter(a => a.type === 'warning' && !a.resolvedAt)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (!lastWarning || now - lastWarning.timestamp.getTime() > this.config.alertConfig.warningAlertCooldown) {
        this.addAlert({
          type: 'warning',
          category: 'tactical',
          title: 'Coherence Warning',
          message: `Team coherence at ${result.overallCoherence}%, approaching critical threshold`,
          autoResolve: true,
        });
      }
    }

    // Player-specific alerts
    for (const [playerId, playerScore] of result.playerScores) {
      if (playerScore.riskLevel === 'critical') {
        this.addAlert({
          type: 'warning',
          category: 'physical',
          title: 'Player Risk Alert',
          message: `${playerId} at critical risk level - consider substitution`,
          affectedPlayers: [playerId],
          autoResolve: true,
        });
      }
    }

    // Auto-resolve old alerts
    this.autoResolveAlerts(result);
  }

  private addAlert(alert: Omit<CoherenceAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolvedAt'>): void {
    // Check max active alerts
    const activeAlerts = this.alertHistory.filter(a => !a.resolvedAt);
    if (activeAlerts.length >= this.config.alertConfig.maxActiveAlerts) {
      // Resolve oldest alert
      const oldest = activeAlerts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
      if (oldest) {
        oldest.resolvedAt = new Date();
      }
    }

    const newAlert: CoherenceAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alertHistory.push(newAlert);
    this.emit('alert', newAlert);
  }

  private autoResolveAlerts(result: AggregatedCoherenceResult): void {
    for (const alert of this.alertHistory.filter(a => !a.resolvedAt && a.autoResolve)) {
      let shouldResolve = false;

      if (alert.category === 'tactical' && alert.type === 'critical') {
        if (result.overallCoherence >= this.config.coherenceThresholds.critical) {
          shouldResolve = true;
        }
      } else if (alert.category === 'tactical' && alert.type === 'warning') {
        if (result.overallCoherence >= this.config.coherenceThresholds.warning) {
          shouldResolve = true;
        }
      }

      if (shouldResolve) {
        alert.resolvedAt = new Date();
        this.emit('alert_resolved', alert);
      }
    }
  }

  private updateHistory(result: AggregatedCoherenceResult): void {
    this.coherenceHistory.push({
      timestamp: result.timestamp,
      minute: result.matchMinute,
      overallScore: result.overallCoherence,
      playerScores: result.playerScores,
    });

    // Keep last 100 entries
    if (this.coherenceHistory.length > 100) {
      this.coherenceHistory = this.coherenceHistory.slice(-100);
    }
  }

  private emit(event: string, data: unknown): void {
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[CoherenceAggregator] Error in event listener for ${event}:`, error);
      }
    });
  }
}

// ==================== Supporting Types ====================

interface CoherenceHistoryEntry {
  timestamp: Date;
  minute: number;
  overallScore: number;
  playerScores: Map<string, PlayerCoherenceResult>;
}

// ==================== Factory Function ====================

export function createCoherenceAggregator(
  config?: Partial<CoherenceAggregatorConfig>
): CoherenceAggregator {
  return new CoherenceAggregator(config);
}

// ==================== Type Exports ====================

export type {
  AggregatedCoherenceResult,
  PlayerCoherenceResult,
  TemporalCoherenceData,
  CoherencePredictions,
  CoherenceAlert,
  CoherenceRecommendation,
  SystemHealthReport,
};
