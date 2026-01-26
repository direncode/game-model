/**
 * ============================================================================
 * FOOTBALL ANALYTICS PLATFORM - GAME MODEL COHERENCE SYSTEM
 * ============================================================================
 *
 * This module provides a market-leading coherence scoring system that integrates
 * game models with real-time analytics to provide comprehensive tactical analysis.
 *
 * QUICK START:
 * ```typescript
 * import {
 *   createGameModelCoherenceSystem,
 *   initializeCoherenceSystem
 * } from '@/lib';
 *
 * // Option 1: Full control
 * const system = createGameModelCoherenceSystem({ enablePredictiveScoring: true });
 * await system.initialize(gameModel, digitalTwins);
 * const result = await system.calculateCoherence(minute, score, playerData);
 *
 * // Option 2: Quick start
 * const system = await initializeCoherenceSystem(gameModel, digitalTwins);
 * const result = await system.calculateCoherence(minute, score, playerData);
 * ```
 *
 * ============================================================================
 */

// ============================================================================
// PRIMARY EXPORT - GAME MODEL COHERENCE SYSTEM
// ============================================================================

export {
  // Main system class
  GameModelCoherenceSystem,

  // Factory functions
  createGameModelCoherenceSystem,
  initializeCoherenceSystem,
} from './game-model-coherence-system';

export type {
  // Configuration
  GameModelCoherenceConfig,

  // Core result types
  CoherenceResult,
  DimensionalBreakdown,
  DimensionInfo,
  DimensionSummary,

  // Player analysis
  PlayerAnalysis,
  PlayerRiskInfo,

  // Temporal & predictive
  TrendInfo,
  PredictionInfo,
  ScenarioInfo,
  MomentumInfo,

  // Bayesian
  BayesianInfo,

  // Phase analysis
  PhaseAnalysis,
} from './game-model-coherence-system';

// ============================================================================
// ADVANCED GAME MODEL ENGINE
// ============================================================================

export {
  AdvancedGameModelEngine,
  createAdvancedGameModelEngine,
  createDefaultOverrideLayer,
  createDynamicRule,
  PREDEFINED_LAYERS,
  PREDEFINED_RULES,
} from './advanced-game-model';

export type {
  AdvancedGameModel,
  ModelOverrideLayer,
  LayerCondition,
  GameModelOverrides,
  DynamicRule,
  RuleTrigger,
  TriggerCondition,
  RuleAction,
  ContextAdaptation,
  GameContext,
  AdaptationSet,
  CoherenceWeightConfig,
  SituationalModifier,
  AnalyticsBinding,
  ModelEvolution,
  MLParameters,
  RealtimeContext,
  GameEvent,
  ResolvedGameModel,
} from './advanced-game-model';

// ============================================================================
// REAL-TIME ANALYTICS BRIDGE
// ============================================================================

export {
  RealtimeAnalyticsBridge,
  PlaceholderAnalyticsProvider,
  createAnalyticsBridge,
  createPlaceholderProvider,
} from './realtime-analytics-bridge';

export type {
  AnalyticsProvider,
  ProviderType,
  ProviderStatus,
  ProviderConfig,
  ProviderCapabilities,
  AnalyticsResponse,
  AnalyticsError,
  ResponseMetadata,
  RealTimeAnalyticsData,
  PlayerAnalyticsData,
  TeamAnalyticsData,
  TacticalAnalyticsData,
  PredictiveAnalyticsData,
  DetectedPattern,
  AnalyticsEnrichment,
  BridgeConfig,
} from './realtime-analytics-bridge';

// ============================================================================
// COMPOSITE SCORING ENGINE
// ============================================================================

export {
  CompositeScoringEngine,
  createCompositeScoringEngine,
} from './composite-scoring-engine';

export type {
  CompositeScore,
  DimensionalScores,
  DimensionScore,
  SubComponentScore,
  ScoreBreakdown,
  PlayerCompositeScore,
  TimeWindowScore,
  TemporalAnalysis,
  TrendAnalysis,
  MomentumAnalysis,
  PredictionSet,
  PredictedScore,
  ScenarioPrediction,
  BayesianMetrics,
  EnsembleResult,
  ModelScore,
  ScoringDiagnostics,
  DataQualityMetrics,
  Anomaly,
} from './composite-scoring-engine';

// ============================================================================
// COHERENCE AGGREGATOR
// ============================================================================

export {
  CoherenceAggregator,
  createCoherenceAggregator,
} from './coherence-aggregator';

export type {
  CoherenceAggregatorConfig,
  CoherenceThresholds,
  AlertConfig,
  AggregatedCoherenceResult,
  PlayerCoherenceResult,
  CoherenceDeviation,
  TemporalCoherenceData,
  ChangePoint,
  CoherencePredictions,
  PredictionBand,
  RiskAssessment,
  BayesianAnalysis,
  CoherenceAlert,
  CoherenceRecommendation,
  SystemHealthReport,
} from './coherence-aggregator';
