// Football Analytics Platform - Library Exports
// Central export point for all game model, coherence, and analytics systems

// ==================== Advanced Game Model System ====================
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

// ==================== Real-time Analytics Bridge ====================
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

// ==================== Composite Scoring Engine ====================
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

// ==================== Coherence Aggregator ====================
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

// ==================== Existing Systems Re-exports ====================
export * from './coherence-analysis';
export * from './game-model-manager';
export * from './digital-twin';
export * from './pattern-recognition';
export * from './game-engine';
export * from './simulation-controller';
export * from './analytics-engine';
export * from './tactical-ai';
export * from './physics-engine';
export * from './multi-agent-system';
export * from './psychology-system';
export * from './wearable-analytics';
export * from './instruction-log';
export * from './player-history';
export * from './tactics-library';
export * from './utils';
