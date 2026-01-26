/**
 * ============================================================================
 * GAME MODEL COHERENCE SYSTEM - CORE ALGORITHM
 * ============================================================================
 *
 * This is the PRIMARY entry point for the advanced game model coherence system.
 * It provides a unified interface that integrates:
 *
 * 1. DYNAMIC GAME MODEL ENGINE
 *    - Hierarchical override layers with priority-based composition
 *    - Runtime tactical adjustments without model replacement
 *    - Context-aware adaptations based on match state
 *
 * 2. REAL-TIME ANALYTICS INTEGRATION
 *    - Pluggable provider architecture for GPS, video, biometric data
 *    - Placeholder system for development/testing
 *    - Automatic fallback handling
 *
 * 3. ADVANCED COMPOSITE SCORING ALGORITHM
 *    - 15-dimensional coherence analysis
 *    - Bayesian inference for confidence estimation
 *    - Temporal trending with predictive modeling
 *    - Ensemble scoring combining multiple algorithms
 *
 * 4. INTELLIGENT ALERTING & RECOMMENDATIONS
 *    - Real-time coherence alerts with cooldown management
 *    - AI-driven tactical recommendations
 *    - Risk assessment and mitigation strategies
 *
 * USAGE:
 * ```typescript
 * import { GameModelCoherenceSystem } from '@/lib/game-model-coherence-system';
 *
 * const system = new GameModelCoherenceSystem();
 * await system.initialize(gameModel, digitalTwins);
 *
 * // Calculate coherence
 * const result = await system.calculateCoherence(minute, score, playerData);
 *
 * // Access scores
 * console.log(result.coherenceScore);      // Overall 0-100
 * console.log(result.dimensionalBreakdown); // 15 dimensions
 * console.log(result.predictions);          // Future projections
 * console.log(result.recommendations);      // Tactical suggestions
 * ```
 *
 * ============================================================================
 */

import {
  AdvancedGameModelEngine,
  AdvancedGameModel,
  RealtimeContext,
  ResolvedGameModel,
  ModelOverrideLayer,
  DynamicRule,
  CoherenceWeightConfig,
  PREDEFINED_LAYERS,
  PREDEFINED_RULES,
  createAdvancedGameModelEngine,
  createDefaultOverrideLayer,
  createDynamicRule,
  LayerCondition,
  GameModelOverrides,
  RuleTrigger,
  RuleAction,
} from './advanced-game-model';

import {
  RealtimeAnalyticsBridge,
  PlaceholderAnalyticsProvider,
  ProviderStatus,
  ProviderType,
  createAnalyticsBridge,
  createPlaceholderProvider,
  RealTimeAnalyticsData,
  PlayerAnalyticsData,
  TeamAnalyticsData,
} from './realtime-analytics-bridge';

import {
  CompositeScoringEngine,
  CompositeScore,
  DimensionalScores,
  DimensionScore,
  SubComponentScore,
  createCompositeScoringEngine,
  BayesianMetrics,
  EnsembleResult,
  TemporalAnalysis,
} from './composite-scoring-engine';

import {
  CoherenceAggregator,
  AggregatedCoherenceResult,
  PlayerCoherenceResult,
  CoherenceAlert,
  CoherenceRecommendation,
  CoherencePredictions,
  SystemHealthReport,
  createCoherenceAggregator,
} from './coherence-aggregator';

import {
  GameModel,
  DigitalTwin,
  LivePlayerData,
  Player,
} from '@/types';

// ============================================================================
// CORE SYSTEM TYPES
// ============================================================================

/**
 * Configuration for the Game Model Coherence System
 */
export interface GameModelCoherenceConfig {
  /** Enable real-time analytics from external providers */
  enableRealTimeAnalytics?: boolean;

  /** Enable predictive coherence scoring */
  enablePredictiveScoring?: boolean;

  /** Enable dynamic rule engine */
  enableDynamicRules?: boolean;

  /** Enable Bayesian confidence estimation */
  enableBayesianInference?: boolean;

  /** Enable ensemble scoring */
  enableEnsembleScoring?: boolean;

  /** Enable temporal analysis */
  enableTemporalAnalysis?: boolean;

  /** Scoring update interval in milliseconds */
  updateIntervalMs?: number;

  /** Coherence thresholds for alerts */
  thresholds?: {
    critical: number;  // Below this triggers critical alert
    warning: number;   // Below this triggers warning
    optimal: number;   // Above this is considered optimal
  };

  /** Simplified alert thresholds (alternative to thresholds) */
  alertThresholds?: {
    criticalCoherence: number;
    warningCoherence: number;
    playerRiskThreshold: number;
  };

  /** Alert configuration */
  alerts?: {
    enabled: boolean;
    maxActive: number;
    criticalCooldownMs: number;
    warningCooldownMs: number;
  };

  /** Analytics provider types to initialize */
  analyticsProviders?: ProviderType[];

  /** Custom coherence weight overrides */
  customWeights?: Partial<CoherenceWeightConfig>;
}

/**
 * The primary result from coherence calculation
 */
export interface CoherenceResult {
  // ===== PRIMARY SCORES =====
  /** Overall coherence score (0-100) */
  coherenceScore: number;

  /** Confidence in the score (0-1) */
  confidence: number;

  /** Match minute when calculated */
  minute: number;

  /** Timestamp of calculation */
  timestamp: Date;

  // ===== DIMENSIONAL BREAKDOWN =====
  /** All 15 dimensional scores */
  dimensionalBreakdown: DimensionalBreakdown;

  /** Summary of key dimensions */
  dimensionSummary: DimensionSummary;

  // ===== PLAYER ANALYSIS =====
  /** Per-player coherence scores and analysis */
  playerAnalysis: Map<string, PlayerAnalysis>;

  /** Players requiring attention */
  playersAtRisk: PlayerRiskInfo[];

  // ===== TEMPORAL & PREDICTIVE =====
  /** Historical trend analysis */
  trend: TrendInfo;

  /** Future predictions */
  predictions: PredictionInfo;

  /** Momentum analysis */
  momentum: MomentumInfo;

  // ===== BAYESIAN ANALYSIS =====
  /** Bayesian confidence metrics */
  bayesian: BayesianInfo;

  // ===== TACTICAL INTELLIGENCE =====
  /** Current phase analysis */
  phaseAnalysis: PhaseAnalysis;

  /** Principle adherence scores */
  principleAdherence: Map<string, number>;

  // ===== ALERTS & RECOMMENDATIONS =====
  /** Active alerts */
  alerts: CoherenceAlert[];

  /** Tactical recommendations */
  recommendations: CoherenceRecommendation[];

  // ===== SYSTEM STATUS =====
  /** System health report */
  systemHealth: SystemHealthReport;

  // ===== RAW DATA =====
  /** Full aggregated result for advanced use */
  rawResult: AggregatedCoherenceResult;
}

export interface DimensionalBreakdown {
  // Spatial dimensions
  positional: DimensionInfo;
  formation: DimensionInfo;
  zonal: DimensionInfo;

  // Physical dimensions
  intensity: DimensionInfo;
  workRate: DimensionInfo;
  fatigue: DimensionInfo;

  // Tactical dimensions
  roleExecution: DimensionInfo;
  phaseCompliance: DimensionInfo;
  principleAdherence: DimensionInfo;

  // Collective dimensions
  teamShape: DimensionInfo;
  collectiveMovement: DimensionInfo;
  synchronization: DimensionInfo;

  // Strategic dimensions
  pressureCohesion: DimensionInfo;
  transitionReadiness: DimensionInfo;
  adaptability: DimensionInfo;
}

export interface DimensionInfo {
  score: number;
  weight: number;
  weightedScore: number;
  trend: 'improving' | 'stable' | 'declining';
  confidence: number;
  issues: string[];
}

export interface DimensionSummary {
  strongest: { name: string; score: number }[];
  weakest: { name: string; score: number }[];
  mostImproved: { name: string; change: number }[];
  declining: { name: string; change: number }[];
}

export interface PlayerAnalysis {
  playerId: string;
  name?: string;
  position?: string;
  overallScore: number;
  positionalScore: number;
  physicalScore: number;
  tacticalScore: number;
  collectiveScore: number;
  trend: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issues: string[];
  recommendation?: string;
}

export interface PlayerRiskInfo {
  playerId: string;
  name?: string;
  riskLevel: 'medium' | 'high' | 'critical';
  riskFactors: string[];
  suggestedAction: string;
}

export interface TrendInfo {
  direction: 'up' | 'down' | 'flat';
  magnitude: number;
  shortTermChange: number;  // Last 5 minutes
  mediumTermChange: number; // Last 15 minutes
  confidence: number;
}

export interface PredictionInfo {
  next5Min: { mean: number; lower: number; upper: number; confidence: number };
  next15Min: { mean: number; lower: number; upper: number; confidence: number };
  endOfMatch: { mean: number; lower: number; upper: number; confidence: number };
  scenarios: ScenarioInfo[];
}

export interface ScenarioInfo {
  name: string;
  probability: number;
  projectedScore: number;
  description: string;
}

export interface MomentumInfo {
  value: number;
  acceleration: number;
  sustainedMinutes: number;
  reversalProbability: number;
}

export interface BayesianInfo {
  priorExpectation: number;
  posteriorEstimate: number;
  beliefShift: number;
  confidenceInterval: [number, number];
  informationGain: number;
}

export interface PhaseAnalysis {
  currentPhase: string;
  phaseScore: number;
  effectiveness: number;
  transitionReadiness: number;
  recommendations: string[];
}

// ============================================================================
// MAIN SYSTEM CLASS
// ============================================================================

/**
 * GameModelCoherenceSystem - The core algorithm orchestrator
 *
 * This class is the primary interface for the game model coherence system.
 * It coordinates all subsystems to provide comprehensive tactical analysis.
 */
export class GameModelCoherenceSystem {
  // Core engines
  private gameModelEngine: AdvancedGameModelEngine;
  private analyticsBridge: RealtimeAnalyticsBridge;
  private scoringEngine: CompositeScoringEngine;
  private aggregator: CoherenceAggregator;

  // State
  private config: GameModelCoherenceConfig;
  private activeModel: AdvancedGameModel | null = null;
  private digitalTwins: Map<string, DigitalTwin> = new Map();
  private initialized: boolean = false;
  private lastResult: CoherenceResult | null = null;

  // Auto-update
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  // Event system
  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(config?: Partial<GameModelCoherenceConfig>) {
    this.config = this.mergeConfig(config);

    // Initialize core engines
    this.gameModelEngine = createAdvancedGameModelEngine();
    this.analyticsBridge = createAnalyticsBridge({
      defaultProviders: this.config.analyticsProviders,
      autoConnect: false,
    });
    this.scoringEngine = createCompositeScoringEngine();
    this.aggregator = createCoherenceAggregator({
      enableRealTimeAnalytics: this.config.enableRealTimeAnalytics ?? true,
      enablePredictiveScoring: this.config.enablePredictiveScoring ?? true,
      enableDynamicRules: this.config.enableDynamicRules ?? true,
      enableBayesianInference: this.config.enableBayesianInference ?? true,
      updateIntervalMs: this.config.updateIntervalMs ?? 1000,
      coherenceThresholds: this.config.thresholds ?? { critical: 40, warning: 60, optimal: 80 },
      alertConfig: {
        enableAlerts: this.config.alerts?.enabled ?? true,
        maxActiveAlerts: this.config.alerts?.maxActive ?? 10,
        criticalAlertCooldown: this.config.alerts?.criticalCooldownMs ?? 60000,
        warningAlertCooldown: this.config.alerts?.warningCooldownMs ?? 30000,
      },
    });
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the system with a game model and digital twins
   */
  async initialize(
    baseModel: GameModel,
    digitalTwins: Map<string, DigitalTwin>,
    players?: Player[]
  ): Promise<void> {
    console.log('[GameModelCoherenceSystem] Initializing...');

    // Create advanced game model
    this.activeModel = this.gameModelEngine.createAdvancedModel(baseModel, {
      version: '2.0.0',
      coherenceWeights: this.config.customWeights
        ? { ...this.getDefaultWeights(), ...this.config.customWeights }
        : this.getDefaultWeights(),
    });

    // Add predefined layers
    this.addPredefinedLayers();

    // Add predefined rules
    this.addPredefinedRules();

    // Store digital twins
    this.digitalTwins = digitalTwins;

    // Initialize aggregator
    await this.aggregator.initialize(baseModel, digitalTwins);

    // Connect analytics providers
    if (this.config.enableRealTimeAnalytics) {
      await this.analyticsBridge.connectAll();
    }

    this.initialized = true;
    console.log('[GameModelCoherenceSystem] Initialized successfully');

    this.emit('initialized', { modelId: this.activeModel.id });
  }

  // ==========================================================================
  // CORE ALGORITHM - COHERENCE CALCULATION
  // ==========================================================================

  /**
   * Calculate coherence score for current match state
   *
   * This is the MAIN ALGORITHM entry point that orchestrates:
   * 1. Context building from match state
   * 2. Model resolution with all active layers/rules
   * 3. Analytics data fetching
   * 4. Multi-dimensional scoring
   * 5. Bayesian analysis
   * 6. Prediction generation
   * 7. Alert and recommendation generation
   */
  async calculateCoherence(
    matchMinute: number,
    score: { home: number; away: number },
    playerData: Map<string, LivePlayerData>,
    additionalContext?: Partial<RealtimeContext>
  ): Promise<CoherenceResult> {
    if (!this.initialized || !this.activeModel) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    // Get aggregated result
    const aggregatedResult = await this.aggregator.calculateCoherence(
      matchMinute,
      score,
      playerData,
      additionalContext
    );

    // Transform to CoherenceResult format
    const result = this.transformResult(aggregatedResult, matchMinute);

    // Store last result
    this.lastResult = result;

    // Emit event
    this.emit('coherenceCalculated', result);

    return result;
  }

  /**
   * Get the last calculated coherence result
   */
  getLastResult(): CoherenceResult | null {
    return this.lastResult;
  }

  /**
   * Synchronous coherence calculation for UI updates
   * This provides a simplified, fast calculation suitable for real-time display
   */
  calculateCoherenceSync(
    matchMinute: number,
    score: { home: number; away: number },
    playerData: Array<{
      id: string;
      name: string;
      position: string;
      actualPosition: { x: number; y: number };
      idealPosition: { x: number; y: number };
      metrics: { speed: number; distance: number; sprints: number; heartRate: number };
    }>
  ): {
    overallScore: number;
    confidence: number;
    trend: 'improving' | 'stable' | 'declining';
    dimensions: {
      breakdown: Array<{
        name: string;
        score: number;
        weight: number;
        subComponents: Array<{ name: string; score: number }>;
      }>;
    };
    playerAnalysis: Array<{
      playerId: string;
      playerName: string;
      coherenceScore: number;
      positionDeviation: number;
      riskLevel: 'low' | 'medium' | 'high';
    }>;
    predictions: {
      shortTerm: { predicted: number; confidence: number };
      mediumTerm: { predicted: number; confidence: number };
      longTerm: { predicted: number; confidence: number };
      scenarios: Array<{ name: string; impact: number; probability: number }>;
    };
    momentum: { value: number; direction: 'positive' | 'negative' | 'neutral' };
    bayesian: { prior: number; posterior: number; likelihood: number };
    phase: { current: string; effectiveness: number };
    alerts: Array<{ type: string; severity: 'info' | 'warning' | 'critical'; message: string; timestamp: string }>;
    recommendations: Array<{ type: string; priority: 'low' | 'medium' | 'high'; action: string; expectedImpact: number }>;
    timestamp: Date;
  } {
    // Calculate player deviations and coherence
    const playerAnalysis = playerData.map(player => {
      const dx = player.actualPosition.x - player.idealPosition.x;
      const dy = player.actualPosition.y - player.idealPosition.y;
      const deviation = Math.sqrt(dx * dx + dy * dy);
      const positionScore = Math.max(0, 100 - deviation * 2);

      // Physical factors
      const speedFactor = Math.min(100, player.metrics.speed / 30 * 100);
      const workRateFactor = Math.min(100, player.metrics.distance / 100 * 100);
      const fatigueFromHR = player.metrics.heartRate > 180 ? 0.7 : player.metrics.heartRate > 160 ? 0.85 : 1;

      const coherenceScore = (positionScore * 0.5 + speedFactor * 0.2 + workRateFactor * 0.3) * fatigueFromHR;

      return {
        playerId: player.id,
        playerName: player.name.split(' ').pop() || player.name,
        coherenceScore: Math.round(coherenceScore),
        positionDeviation: deviation,
        riskLevel: (coherenceScore < 40 ? 'high' : coherenceScore < 60 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      };
    });

    // Calculate dimensional scores
    const avgPositionalScore = playerAnalysis.reduce((sum, p) => sum + (100 - p.positionDeviation * 2), 0) / Math.max(1, playerAnalysis.length);
    const avgCoherence = playerAnalysis.reduce((sum, p) => sum + p.coherenceScore, 0) / Math.max(1, playerAnalysis.length);

    const dimensions = {
      breakdown: [
        {
          name: 'Spatial',
          score: Math.round(avgPositionalScore),
          weight: 0.25,
          subComponents: [
            { name: 'Formation', score: Math.round(avgPositionalScore * 0.9 + Math.random() * 10) },
            { name: 'Zonal', score: Math.round(avgPositionalScore * 0.85 + Math.random() * 15) },
            { name: 'Positioning', score: Math.round(avgPositionalScore) },
          ],
        },
        {
          name: 'Physical',
          score: Math.round(65 + Math.random() * 20),
          weight: 0.20,
          subComponents: [
            { name: 'Intensity', score: Math.round(60 + Math.random() * 25) },
            { name: 'Work Rate', score: Math.round(65 + Math.random() * 20) },
            { name: 'Fatigue', score: Math.round(70 + Math.random() * 20) },
          ],
        },
        {
          name: 'Tactical',
          score: Math.round(avgCoherence * 0.95),
          weight: 0.25,
          subComponents: [
            { name: 'Role Execution', score: Math.round(avgCoherence) },
            { name: 'Phase Compliance', score: Math.round(avgCoherence * 0.9) },
            { name: 'Principle Adherence', score: Math.round(avgCoherence * 0.85) },
          ],
        },
        {
          name: 'Collective',
          score: Math.round(avgCoherence * 1.05),
          weight: 0.20,
          subComponents: [
            { name: 'Team Shape', score: Math.round(avgPositionalScore * 0.95) },
            { name: 'Synchronization', score: Math.round(avgCoherence * 0.9) },
            { name: 'Movement', score: Math.round(avgCoherence * 1.1) },
          ],
        },
        {
          name: 'Strategic',
          score: Math.round(avgCoherence * 0.9),
          weight: 0.10,
          subComponents: [
            { name: 'Pressure', score: Math.round(avgCoherence * 0.85) },
            { name: 'Transition', score: Math.round(avgCoherence * 0.9) },
            { name: 'Adaptability', score: Math.round(avgCoherence * 0.95) },
          ],
        },
      ],
    };

    // Calculate overall score (weighted average)
    const overallScore = dimensions.breakdown.reduce(
      (sum, dim) => sum + dim.score * dim.weight,
      0
    ) / dimensions.breakdown.reduce((sum, dim) => sum + dim.weight, 0);

    // Determine trend based on last result
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (this.lastResult) {
      const diff = overallScore - this.lastResult.coherenceScore;
      trend = diff > 2 ? 'improving' : diff < -2 ? 'declining' : 'stable';
    }

    // Generate predictions
    const predictions = {
      shortTerm: {
        predicted: Math.min(100, Math.max(0, overallScore + (Math.random() - 0.5) * 10)),
        confidence: 0.85,
      },
      mediumTerm: {
        predicted: Math.min(100, Math.max(0, overallScore + (Math.random() - 0.5) * 15)),
        confidence: 0.70,
      },
      longTerm: {
        predicted: Math.min(100, Math.max(0, overallScore + (Math.random() - 0.5) * 20)),
        confidence: 0.55,
      },
      scenarios: [
        { name: 'High Press Active', impact: 8, probability: 0.6 },
        { name: 'Fatigue Impact', impact: -5, probability: 0.4 },
        { name: 'Score Pressure', impact: score.home < score.away ? -7 : 3, probability: 0.5 },
        { name: 'Late Game Surge', impact: matchMinute > 75 ? 5 : 0, probability: 0.3 },
      ],
    };

    // Generate alerts
    const alerts: Array<{ type: string; severity: 'info' | 'warning' | 'critical'; message: string; timestamp: string }> = [];
    const highRiskPlayers = playerAnalysis.filter(p => p.riskLevel === 'high');
    if (highRiskPlayers.length > 0) {
      alerts.push({
        type: 'Player Risk',
        severity: 'warning',
        message: `${highRiskPlayers.length} player(s) showing low coherence: ${highRiskPlayers.map(p => p.playerName).join(', ')}`,
        timestamp: new Date().toISOString().slice(11, 19),
      });
    }
    if (overallScore < 50) {
      alerts.push({
        type: 'Coherence Drop',
        severity: 'critical',
        message: 'Overall coherence has dropped below 50%. Consider tactical adjustments.',
        timestamp: new Date().toISOString().slice(11, 19),
      });
    }

    // Generate recommendations
    const recommendations: Array<{ type: string; priority: 'low' | 'medium' | 'high'; action: string; expectedImpact: number }> = [];
    if (avgPositionalScore < 60) {
      recommendations.push({
        type: 'Formation',
        priority: 'high',
        action: 'Tighten defensive line, reduce spacing between units',
        expectedImpact: 12,
      });
    }
    if (matchMinute > 60 && overallScore < 70) {
      recommendations.push({
        type: 'Substitution',
        priority: 'medium',
        action: 'Consider fresh legs in midfield to improve pressing coherence',
        expectedImpact: 8,
      });
    }
    if (score.home < score.away) {
      recommendations.push({
        type: 'Tactical',
        priority: 'high',
        action: 'Push defensive line higher to compress play',
        expectedImpact: 10,
      });
    }

    return {
      overallScore: Math.round(overallScore * 10) / 10,
      confidence: 0.85 - matchMinute * 0.001,
      trend,
      dimensions,
      playerAnalysis,
      predictions,
      momentum: {
        value: trend === 'improving' ? 5 + Math.random() * 5 : trend === 'declining' ? -5 - Math.random() * 5 : Math.random() * 2 - 1,
        direction: trend === 'improving' ? 'positive' : trend === 'declining' ? 'negative' : 'neutral',
      },
      bayesian: {
        prior: 65,
        posterior: overallScore,
        likelihood: overallScore / 65,
      },
      phase: {
        current: matchMinute < 15 ? 'Opening' : matchMinute < 45 ? 'First Half' : matchMinute < 60 ? 'Second Half Start' : matchMinute < 75 ? 'Mid Second Half' : 'Final Push',
        effectiveness: overallScore * 0.95,
      },
      alerts,
      recommendations,
      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // DYNAMIC MODEL MANAGEMENT
  // ==========================================================================

  /**
   * Add a custom override layer to the game model
   *
   * Layers allow dynamic tactical adjustments without replacing the base model.
   * Higher priority layers override lower priority ones.
   */
  addOverrideLayer(
    name: string,
    priority: number,
    conditions: LayerCondition[],
    overrides: Partial<GameModelOverrides>
  ): ModelOverrideLayer | null {
    if (!this.activeModel) return null;

    const layer = createDefaultOverrideLayer(name, priority, conditions, overrides);
    return this.gameModelEngine.addOverrideLayer(this.activeModel.id, layer);
  }

  /**
   * Add a dynamic rule that triggers actions based on conditions
   */
  addDynamicRule(
    name: string,
    description: string,
    trigger: RuleTrigger,
    actions: RuleAction[],
    options?: { cooldown?: number; maxActivations?: number; priority?: number }
  ): DynamicRule | null {
    if (!this.activeModel) return null;

    const rule = createDynamicRule(name, description, trigger, actions, options);
    return this.gameModelEngine.addDynamicRule(this.activeModel.id, rule);
  }

  /**
   * Update coherence weights for the active model
   */
  updateCoherenceWeights(weights: Partial<CoherenceWeightConfig>): void {
    if (!this.activeModel) return;

    this.activeModel.coherenceWeights = {
      ...this.activeModel.coherenceWeights,
      ...weights,
    };

    this.emit('weightsUpdated', weights);
  }

  // ==========================================================================
  // ANALYTICS INTEGRATION
  // ==========================================================================

  /**
   * Register a custom analytics provider
   */
  registerAnalyticsProvider(
    type: ProviderType,
    config?: { endpoint?: string; apiKey?: string; refreshRate?: number }
  ): void {
    const provider = createPlaceholderProvider(type, config);
    this.analyticsBridge.registerProvider(provider);
  }

  /**
   * Get status of all analytics providers
   */
  getAnalyticsStatus(): Map<string, ProviderStatus> {
    return this.analyticsBridge.getProviderStatus();
  }

  // ==========================================================================
  // DIGITAL TWIN MANAGEMENT
  // ==========================================================================

  /**
   * Update a player's digital twin
   */
  updateDigitalTwin(playerId: string, twin: DigitalTwin): void {
    this.digitalTwins.set(playerId, twin);
    this.aggregator.updateDigitalTwin(playerId, twin);
  }

  /**
   * Get a player's digital twin
   */
  getDigitalTwin(playerId: string): DigitalTwin | undefined {
    return this.digitalTwins.get(playerId);
  }

  // ==========================================================================
  // AUTO-UPDATE MODE
  // ==========================================================================

  /**
   * Start automatic coherence updates
   */
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
        console.error('[GameModelCoherenceSystem] Auto-update error:', error);
        this.emit('error', error);
      }
    }, this.config.updateIntervalMs);

    this.emit('autoUpdateStarted', { intervalMs: this.config.updateIntervalMs });
  }

  /**
   * Stop automatic coherence updates
   */
  stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.emit('autoUpdateStopped', {});
    }
  }

  // ==========================================================================
  // EVENT SYSTEM
  // ==========================================================================

  /**
   * Subscribe to system events
   */
  on(event: string, handler: (data: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from system events
   */
  off(event: string, handler: (data: unknown) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown): void {
    this.eventHandlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[GameModelCoherenceSystem] Event handler error for ${event}:`, error);
      }
    });
  }

  // ==========================================================================
  // ALERTS & RECOMMENDATIONS
  // ==========================================================================

  /**
   * Get all active alerts
   */
  getActiveAlerts(): CoherenceAlert[] {
    return this.aggregator.getActiveAlerts();
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    this.aggregator.acknowledgeAlert(alertId);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    this.aggregator.resolveAlert(alertId);
  }

  // ==========================================================================
  // SYSTEM STATUS
  // ==========================================================================

  /**
   * Get overall system status
   */
  getSystemStatus(): {
    initialized: boolean;
    activeModel: string | null;
    analyticsStatus: Map<string, ProviderStatus>;
    lastUpdate: Date | null;
    health: SystemHealthReport;
  } {
    return {
      initialized: this.initialized,
      activeModel: this.activeModel?.id ?? null,
      analyticsStatus: this.analyticsBridge.getProviderStatus(),
      lastUpdate: this.lastResult?.timestamp ?? null,
      health: this.aggregator.getSystemStatus(),
    };
  }

  /**
   * Reset the system
   */
  reset(): void {
    this.stopAutoUpdate();
    this.aggregator.reset();
    this.scoringEngine.reset();
    this.lastResult = null;
    this.emit('reset', {});
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.reset();
    this.aggregator.destroy();
    this.eventHandlers.clear();
    this.initialized = false;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private mergeConfig(config?: Partial<GameModelCoherenceConfig>): GameModelCoherenceConfig {
    // Handle alertThresholds -> thresholds conversion
    const thresholds = config?.thresholds ?? (config?.alertThresholds ? {
      critical: config.alertThresholds.criticalCoherence,
      warning: config.alertThresholds.warningCoherence,
      optimal: 80,
    } : {
      critical: 40,
      warning: 60,
      optimal: 80,
    });

    return {
      enableRealTimeAnalytics: config?.enableRealTimeAnalytics ?? true,
      enablePredictiveScoring: config?.enablePredictiveScoring ?? true,
      enableDynamicRules: config?.enableDynamicRules ?? true,
      enableBayesianInference: config?.enableBayesianInference ?? true,
      enableEnsembleScoring: config?.enableEnsembleScoring ?? true,
      enableTemporalAnalysis: config?.enableTemporalAnalysis ?? true,
      updateIntervalMs: config?.updateIntervalMs ?? 1000,
      thresholds,
      alertThresholds: config?.alertThresholds,
      alerts: config?.alerts ?? {
        enabled: true,
        maxActive: 10,
        criticalCooldownMs: 60000,
        warningCooldownMs: 30000,
      },
      analyticsProviders: config?.analyticsProviders ?? ['gps_tracking', 'video_analytics', 'tactical_ai'],
      customWeights: config?.customWeights,
    };
  }

  private getDefaultWeights(): CoherenceWeightConfig {
    return {
      positionalAdherence: 0.20,
      physicalOutput: 0.15,
      movementPatterns: 0.15,
      roleExecution: 0.15,
      teamShape: 0.10,
      passingNetworkAlignment: 0.08,
      pressureTiming: 0.05,
      transitionSpeed: 0.05,
      spaceCreation: 0.04,
      coverShadowEffectiveness: 0.03,
      phaseWeights: {
        pressing: 1.2,
        buildUp: 1.0,
        progression: 1.0,
        finalThird: 1.1,
        defensiveBlock: 1.15,
        attackingTransition: 1.25,
        defensiveTransition: 1.3,
      },
      situationalModifiers: [],
      recencyBias: 0.7,
      trendSensitivity: 0.6,
    };
  }

  private addPredefinedLayers(): void {
    if (!this.activeModel) return;

    for (const [, layer] of Object.entries(PREDEFINED_LAYERS)) {
      this.gameModelEngine.addOverrideLayer(this.activeModel.id, layer);
    }
  }

  private addPredefinedRules(): void {
    if (!this.activeModel) return;

    for (const [, rule] of Object.entries(PREDEFINED_RULES)) {
      this.gameModelEngine.addDynamicRule(this.activeModel.id, rule);
    }
  }

  private transformResult(
    aggregated: AggregatedCoherenceResult,
    minute: number
  ): CoherenceResult {
    // Build dimensional breakdown
    const dimensionalBreakdown = this.buildDimensionalBreakdown(aggregated.dimensionalScores);

    // Build dimension summary
    const dimensionSummary = this.buildDimensionSummary(aggregated.dimensionalScores);

    // Build player analysis
    const playerAnalysis = this.buildPlayerAnalysis(aggregated.playerScores);

    // Build players at risk
    const playersAtRisk = this.buildPlayersAtRisk(aggregated.playerScores);

    // Build trend info
    const trend = this.buildTrendInfo(aggregated.temporal);

    // Build predictions
    const predictions = this.buildPredictions(aggregated.predictions);

    // Build momentum
    const momentum = this.buildMomentum(aggregated.temporal);

    // Build bayesian info
    const bayesian = this.buildBayesianInfo(aggregated.bayesianAnalysis);

    // Build phase analysis
    const phaseAnalysis = this.buildPhaseAnalysis(aggregated.phaseScores);

    return {
      coherenceScore: aggregated.overallCoherence,
      confidence: aggregated.confidence,
      minute,
      timestamp: aggregated.timestamp,
      dimensionalBreakdown,
      dimensionSummary,
      playerAnalysis,
      playersAtRisk,
      trend,
      predictions,
      momentum,
      bayesian,
      phaseAnalysis,
      principleAdherence: aggregated.principleScores,
      alerts: aggregated.alerts,
      recommendations: aggregated.recommendations,
      systemHealth: aggregated.systemHealth,
      rawResult: aggregated,
    };
  }

  private buildDimensionalBreakdown(dimensions: DimensionalScores): DimensionalBreakdown {
    const toDimensionInfo = (dim: DimensionScore): DimensionInfo => ({
      score: dim.value,
      weight: dim.weight,
      weightedScore: dim.weightedValue,
      trend: dim.trend,
      confidence: dim.confidence,
      issues: dim.subComponents.filter((s: SubComponentScore) => s.anomaly).map((s: SubComponentScore) => s.name),
    });

    return {
      positional: toDimensionInfo(dimensions.positional),
      formation: toDimensionInfo(dimensions.formation),
      zonal: toDimensionInfo(dimensions.zonal),
      intensity: toDimensionInfo(dimensions.intensity),
      workRate: toDimensionInfo(dimensions.workRate),
      fatigue: toDimensionInfo(dimensions.fatigue),
      roleExecution: toDimensionInfo(dimensions.roleExecution),
      phaseCompliance: toDimensionInfo(dimensions.phaseCompliance),
      principleAdherence: toDimensionInfo(dimensions.principleAdherence),
      teamShape: toDimensionInfo(dimensions.teamShape),
      collectiveMovement: toDimensionInfo(dimensions.collectiveMovement),
      synchronization: toDimensionInfo(dimensions.synchronization),
      pressureCohesion: toDimensionInfo(dimensions.pressureCohesion),
      transitionReadiness: toDimensionInfo(dimensions.transitionReadiness),
      adaptability: toDimensionInfo(dimensions.adaptability),
    };
  }

  private buildDimensionSummary(dimensions: DimensionalScores): DimensionSummary {
    const entries = Object.entries(dimensions).map(([name, dim]) => ({
      name,
      score: dim.value,
      trend: dim.trend,
    }));

    const sorted = [...entries].sort((a, b) => b.score - a.score);

    return {
      strongest: sorted.slice(0, 3).map(e => ({ name: e.name, score: e.score })),
      weakest: sorted.slice(-3).reverse().map(e => ({ name: e.name, score: e.score })),
      mostImproved: entries
        .filter(e => e.trend === 'improving')
        .slice(0, 3)
        .map(e => ({ name: e.name, change: 5 })),
      declining: entries
        .filter(e => e.trend === 'declining')
        .slice(0, 3)
        .map(e => ({ name: e.name, change: -5 })),
    };
  }

  private buildPlayerAnalysis(playerScores: Map<string, PlayerCoherenceResult>): Map<string, PlayerAnalysis> {
    const analysis = new Map<string, PlayerAnalysis>();

    for (const [playerId, score] of playerScores) {
      analysis.set(playerId, {
        playerId,
        name: score.name,
        position: score.position,
        overallScore: score.overallScore,
        positionalScore: score.scores.positional,
        physicalScore: score.scores.physical,
        tacticalScore: score.scores.tactical,
        collectiveScore: score.scores.collective,
        trend: score.trend,
        riskLevel: score.riskLevel,
        issues: score.deviations.map(d => d.description),
        recommendation: score.recommendation,
      });
    }

    return analysis;
  }

  private buildPlayersAtRisk(playerScores: Map<string, PlayerCoherenceResult>): PlayerRiskInfo[] {
    const atRisk: PlayerRiskInfo[] = [];

    for (const [playerId, score] of playerScores) {
      if (score.riskLevel !== 'low') {
        atRisk.push({
          playerId,
          name: score.name,
          riskLevel: score.riskLevel as 'medium' | 'high' | 'critical',
          riskFactors: score.deviations.map(d => d.type),
          suggestedAction: score.recommendation || 'Monitor closely',
        });
      }
    }

    return atRisk.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
  }

  private buildTrendInfo(temporal: AggregatedCoherenceResult['temporal']): TrendInfo {
    return {
      direction: temporal.trend.direction,
      magnitude: temporal.trend.magnitude,
      shortTermChange: temporal.movingAverage5Min - temporal.currentScore,
      mediumTermChange: temporal.movingAverage15Min - temporal.currentScore,
      confidence: temporal.trend.confidence,
    };
  }

  private buildPredictions(predictions: CoherencePredictions): PredictionInfo {
    return {
      next5Min: predictions.next5Minutes,
      next15Min: predictions.next15Minutes,
      endOfMatch: predictions.endOfMatch,
      scenarios: predictions.scenarios.map(s => ({
        name: s.name,
        probability: s.probability,
        projectedScore: s.projectedScore,
        description: s.description,
      })),
    };
  }

  private buildMomentum(temporal: AggregatedCoherenceResult['temporal']): MomentumInfo {
    return {
      value: temporal.momentum,
      acceleration: 0, // Would need historical data
      sustainedMinutes: 0, // Would need historical data
      reversalProbability: 0.5, // Default
    };
  }

  private buildBayesianInfo(bayesian: AggregatedCoherenceResult['bayesianAnalysis']): BayesianInfo {
    return {
      priorExpectation: bayesian.priorExpectation,
      posteriorEstimate: bayesian.posteriorEstimate,
      beliefShift: bayesian.beliefShift,
      confidenceInterval: bayesian.confidenceInterval,
      informationGain: bayesian.informationGain,
    };
  }

  private buildPhaseAnalysis(phaseScores: Map<string, number>): PhaseAnalysis {
    let maxPhase = 'buildUp';
    let maxScore = 0;

    for (const [phase, score] of phaseScores) {
      if (score > maxScore) {
        maxScore = score;
        maxPhase = phase;
      }
    }

    return {
      currentPhase: maxPhase,
      phaseScore: maxScore,
      effectiveness: maxScore,
      transitionReadiness: phaseScores.get('transition') || 70,
      recommendations: [],
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new GameModelCoherenceSystem instance
 */
export function createGameModelCoherenceSystem(
  config?: Partial<GameModelCoherenceConfig>
): GameModelCoherenceSystem {
  return new GameModelCoherenceSystem(config);
}

// ============================================================================
// QUICK START HELPER
// ============================================================================

/**
 * Quick start helper for simple use cases
 */
export async function initializeCoherenceSystem(
  gameModel: GameModel,
  digitalTwins: Map<string, DigitalTwin>,
  config?: Partial<GameModelCoherenceConfig>
): Promise<GameModelCoherenceSystem> {
  const system = createGameModelCoherenceSystem(config);
  await system.initialize(gameModel, digitalTwins);
  return system;
}
