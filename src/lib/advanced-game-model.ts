// Advanced Game Model Engine
// Hierarchical override system with dynamic composition and runtime adaptation
// Market-leading implementation for tactical game model management

import {
  GameModel,
  GameApproach,
  Formation,
  TacticalPrinciples,
  GamePhases,
  PressureTrigger,
  TransitionRule,
  SetPlay,
  PlayerInstruction,
  PhysicalRequirements,
  ExpectedBehavior,
  TacticalAdjustment,
} from '@/types';

// ==================== Core Types ====================

export interface AdvancedGameModel extends GameModel {
  version: string;
  parentModelId?: string;
  overrideLayers: ModelOverrideLayer[];
  dynamicRules: DynamicRule[];
  contextAdaptations: ContextAdaptation[];
  coherenceWeights: CoherenceWeightConfig;
  analyticsBindings: AnalyticsBinding[];
  evolutionHistory: ModelEvolution[];
  machineLearnedParameters: MLParameters;
}

export interface ModelOverrideLayer {
  id: string;
  name: string;
  priority: number; // Higher priority overrides lower
  enabled: boolean;
  conditions: LayerCondition[];
  overrides: Partial<GameModelOverrides>;
  createdAt: Date;
  expiresAt?: Date;
  appliedCount: number;
}

export interface LayerCondition {
  type: 'time' | 'score' | 'possession' | 'momentum' | 'fatigue' | 'custom';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between' | 'in';
  value: number | string | number[] | string[];
  metadata?: Record<string, unknown>;
}

export interface GameModelOverrides {
  formation: Partial<Formation>;
  principles: Partial<TacticalPrinciples>;
  phases: Partial<GamePhases>;
  pressureTriggers: PressureTrigger[];
  transitionRules: TransitionRule[];
  playerInstructions: Map<string, Partial<PlayerInstruction>>;
  coherenceWeights: Partial<CoherenceWeightConfig>;
}

export interface DynamicRule {
  id: string;
  name: string;
  description: string;
  trigger: RuleTrigger;
  actions: RuleAction[];
  cooldown: number; // seconds between activations
  maxActivations: number;
  currentActivations: number;
  lastActivated?: Date;
  priority: number;
  enabled: boolean;
}

export interface RuleTrigger {
  type: 'coherence_drop' | 'pattern_detected' | 'phase_change' | 'event' | 'threshold' | 'composite';
  conditions: TriggerCondition[];
  logic: 'and' | 'or';
}

export interface TriggerCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'change_rate';
  value: number;
  window?: number; // seconds for rolling window calculations
}

export interface RuleAction {
  type: 'enable_layer' | 'disable_layer' | 'modify_weight' | 'adjust_parameter' | 'notify' | 'log';
  target: string;
  value: unknown;
  duration?: number; // temporary actions in seconds
}

export interface ContextAdaptation {
  id: string;
  context: GameContext;
  adaptations: AdaptationSet;
  confidence: number;
  learnedFrom: string; // source of learning (historical, ML, manual)
}

export interface GameContext {
  scoreDifferential: { min: number; max: number };
  minuteRange: { min: number; max: number };
  possessionRange?: { min: number; max: number };
  opponentStyle?: string;
  homeAway?: 'home' | 'away';
  weatherCondition?: string;
  pitchCondition?: string;
}

export interface AdaptationSet {
  formationAdjustments: Partial<Formation>;
  pressingIntensityModifier: number; // -1 to 1
  tempoModifier: number; // -1 to 1
  widthModifier: number; // -1 to 1
  lineHeightModifier: number; // -1 to 1
  riskToleranceModifier: number; // -1 to 1
  playerRoleOverrides: Map<string, string>;
}

export interface CoherenceWeightConfig {
  // Core dimensions
  positionalAdherence: number;
  physicalOutput: number;
  movementPatterns: number;
  roleExecution: number;

  // Advanced dimensions
  teamShape: number;
  passingNetworkAlignment: number;
  pressureTiming: number;
  transitionSpeed: number;
  spaceCreation: number;
  coverShadowEffectiveness: number;

  // Contextual modifiers
  phaseWeights: Record<string, number>;
  situationalModifiers: SituationalModifier[];

  // Temporal weights
  recencyBias: number; // 0-1, how much to weight recent observations
  trendSensitivity: number; // 0-1, sensitivity to coherence trends
}

export interface SituationalModifier {
  condition: string;
  weightMultipliers: Partial<Record<keyof CoherenceWeightConfig, number>>;
}

export interface AnalyticsBinding {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  metrics: string[];
  refreshRate: number; // ms
  enabled: boolean;
  fallbackBehavior: 'cache' | 'default' | 'skip';
  lastSync?: Date;
  status: 'connected' | 'disconnected' | 'error';
}

export interface ModelEvolution {
  timestamp: Date;
  changeType: 'layer_added' | 'layer_modified' | 'rule_triggered' | 'ml_update' | 'manual_override';
  description: string;
  previousState: Partial<AdvancedGameModel>;
  newState: Partial<AdvancedGameModel>;
  triggeredBy: string;
  coherenceImpact?: number;
}

export interface MLParameters {
  enabled: boolean;
  modelVersion: string;
  lastTrainedAt?: Date;
  featureWeights: Map<string, number>;
  patternRecognitionThresholds: Map<string, number>;
  adaptationSuggestionConfidence: number;
  autoApplyThreshold: number;
}

// ==================== Advanced Game Model Manager ====================

export class AdvancedGameModelEngine {
  private models: Map<string, AdvancedGameModel> = new Map();
  private activeModel: AdvancedGameModel | null = null;
  private ruleEngine: DynamicRuleEngine;
  private layerResolver: LayerResolver;
  private contextAnalyzer: ContextAnalyzer;
  private evolutionTracker: EvolutionTracker;

  constructor() {
    this.ruleEngine = new DynamicRuleEngine();
    this.layerResolver = new LayerResolver();
    this.contextAnalyzer = new ContextAnalyzer();
    this.evolutionTracker = new EvolutionTracker();
  }

  // Create a new advanced game model from base model
  createAdvancedModel(
    baseModel: GameModel,
    config?: Partial<AdvancedGameModel>
  ): AdvancedGameModel {
    const advancedModel: AdvancedGameModel = {
      ...baseModel,
      version: '2.0.0',
      overrideLayers: [],
      dynamicRules: [],
      contextAdaptations: [],
      coherenceWeights: this.getDefaultCoherenceWeights(),
      analyticsBindings: [],
      evolutionHistory: [],
      machineLearnedParameters: {
        enabled: false,
        modelVersion: '1.0.0',
        featureWeights: new Map(),
        patternRecognitionThresholds: new Map(),
        adaptationSuggestionConfidence: 0.7,
        autoApplyThreshold: 0.9,
      },
      ...config,
    };

    this.models.set(advancedModel.id, advancedModel);
    return advancedModel;
  }

  // Add an override layer dynamically
  addOverrideLayer(
    modelId: string,
    layer: Omit<ModelOverrideLayer, 'id' | 'createdAt' | 'appliedCount'>
  ): ModelOverrideLayer {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);

    const newLayer: ModelOverrideLayer = {
      ...layer,
      id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      appliedCount: 0,
    };

    model.overrideLayers.push(newLayer);
    model.overrideLayers.sort((a, b) => b.priority - a.priority);

    this.evolutionTracker.recordChange(model, 'layer_added', `Added layer: ${layer.name}`, {});

    return newLayer;
  }

  // Add a dynamic rule
  addDynamicRule(modelId: string, rule: Omit<DynamicRule, 'id' | 'currentActivations'>): DynamicRule {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);

    const newRule: DynamicRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      currentActivations: 0,
    };

    model.dynamicRules.push(newRule);
    model.dynamicRules.sort((a, b) => b.priority - a.priority);

    return newRule;
  }

  // Resolve the effective game model considering all layers and context
  resolveEffectiveModel(
    modelId: string,
    context: RealtimeContext
  ): ResolvedGameModel {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);

    // Start with base model
    let resolvedModel = this.layerResolver.createBaseResolution(model);

    // Apply applicable override layers
    const applicableLayers = this.layerResolver.getApplicableLayers(model, context);
    for (const layer of applicableLayers) {
      resolvedModel = this.layerResolver.applyLayer(resolvedModel, layer);
      layer.appliedCount++;
    }

    // Apply context adaptations
    const matchingAdaptations = this.contextAnalyzer.findMatchingAdaptations(
      model.contextAdaptations,
      context
    );
    for (const adaptation of matchingAdaptations) {
      resolvedModel = this.contextAnalyzer.applyAdaptation(resolvedModel, adaptation);
    }

    // Process dynamic rules
    const triggeredRules = this.ruleEngine.evaluateRules(model.dynamicRules, context);
    for (const rule of triggeredRules) {
      resolvedModel = this.ruleEngine.applyRuleActions(resolvedModel, rule, model);
    }

    return resolvedModel;
  }

  // Get effective coherence weights for current context
  getEffectiveCoherenceWeights(
    modelId: string,
    context: RealtimeContext
  ): CoherenceWeightConfig {
    const resolved = this.resolveEffectiveModel(modelId, context);
    return resolved.coherenceWeights;
  }

  // Register an analytics binding
  registerAnalyticsBinding(modelId: string, binding: Omit<AnalyticsBinding, 'id' | 'status'>): AnalyticsBinding {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);

    const newBinding: AnalyticsBinding = {
      ...binding,
      id: `binding-${Date.now()}`,
      status: 'disconnected',
    };

    model.analyticsBindings.push(newBinding);
    return newBinding;
  }

  // Get default coherence weights
  private getDefaultCoherenceWeights(): CoherenceWeightConfig {
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
      situationalModifiers: [
        {
          condition: 'losing_late',
          weightMultipliers: {
            transitionSpeed: 1.5,
            physicalOutput: 1.3,
          },
        },
        {
          condition: 'winning_late',
          weightMultipliers: {
            teamShape: 1.4,
            positionalAdherence: 1.3,
          },
        },
      ],
      recencyBias: 0.7,
      trendSensitivity: 0.6,
    };
  }

  // Get model by ID
  getModel(modelId: string): AdvancedGameModel | undefined {
    return this.models.get(modelId);
  }

  // Set active model
  setActiveModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);
    this.activeModel = model;
  }

  // Get active model
  getActiveModel(): AdvancedGameModel | null {
    return this.activeModel;
  }

  // Export model for serialization
  exportModel(modelId: string): string {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);

    return JSON.stringify(model, (key, value) => {
      if (value instanceof Map) {
        return { __type: 'Map', entries: Array.from(value.entries()) };
      }
      return value;
    }, 2);
  }

  // Import model from serialization
  importModel(serialized: string): AdvancedGameModel {
    const model = JSON.parse(serialized, (key, value) => {
      if (value && value.__type === 'Map') {
        return new Map(value.entries);
      }
      return value;
    });

    this.models.set(model.id, model);
    return model;
  }
}

// ==================== Supporting Types ====================

export interface RealtimeContext {
  matchMinute: number;
  score: { home: number; away: number };
  possession: number;
  momentum: number; // -100 to 100
  averageFatigue: number; // 0-100
  currentPhase: string;
  recentEvents: GameEvent[];
  teamMetrics: {
    compactness: number;
    pressureSuccess: number;
    passAccuracy: number;
  };
  opponentMetrics?: {
    formation: string;
    pressingIntensity: number;
    tempo: number;
  };
  environmentFactors?: {
    weather: string;
    temperature: number;
    altitude: number;
  };
}

export interface GameEvent {
  type: string;
  minute: number;
  team: 'home' | 'away';
  impact: number;
}

export interface ResolvedGameModel {
  baseModelId: string;
  effectiveFormation: Formation;
  effectivePrinciples: TacticalPrinciples;
  effectivePhases: GamePhases;
  effectivePressureTriggers: PressureTrigger[];
  effectiveTransitionRules: TransitionRule[];
  effectivePlayerInstructions: Map<string, PlayerInstruction>;
  coherenceWeights: CoherenceWeightConfig;
  appliedLayers: string[];
  appliedAdaptations: string[];
  appliedRules: string[];
  resolutionTimestamp: Date;
}

// ==================== Layer Resolver ====================

class LayerResolver {
  createBaseResolution(model: AdvancedGameModel): ResolvedGameModel {
    return {
      baseModelId: model.id,
      effectiveFormation: { ...model.formation },
      effectivePrinciples: { ...model.principles },
      effectivePhases: { ...model.phases },
      effectivePressureTriggers: [...model.pressureTriggers],
      effectiveTransitionRules: [...model.transitionRules],
      effectivePlayerInstructions: new Map(model.playerInstructions),
      coherenceWeights: { ...model.coherenceWeights },
      appliedLayers: [],
      appliedAdaptations: [],
      appliedRules: [],
      resolutionTimestamp: new Date(),
    };
  }

  getApplicableLayers(model: AdvancedGameModel, context: RealtimeContext): ModelOverrideLayer[] {
    return model.overrideLayers.filter(layer => {
      if (!layer.enabled) return false;
      if (layer.expiresAt && layer.expiresAt < new Date()) return false;

      return layer.conditions.every(condition => this.evaluateCondition(condition, context));
    });
  }

  applyLayer(resolved: ResolvedGameModel, layer: ModelOverrideLayer): ResolvedGameModel {
    const result = { ...resolved };

    if (layer.overrides.formation) {
      result.effectiveFormation = this.mergeDeep(result.effectiveFormation, layer.overrides.formation);
    }

    if (layer.overrides.principles) {
      result.effectivePrinciples = this.mergeDeep(result.effectivePrinciples, layer.overrides.principles);
    }

    if (layer.overrides.phases) {
      result.effectivePhases = this.mergeDeep(result.effectivePhases, layer.overrides.phases);
    }

    if (layer.overrides.pressureTriggers) {
      result.effectivePressureTriggers = [
        ...result.effectivePressureTriggers.filter(
          t => !layer.overrides.pressureTriggers!.find(lt => lt.id === t.id)
        ),
        ...layer.overrides.pressureTriggers,
      ];
    }

    if (layer.overrides.playerInstructions) {
      for (const [playerId, instruction] of layer.overrides.playerInstructions) {
        const existing = result.effectivePlayerInstructions.get(playerId);
        if (existing) {
          result.effectivePlayerInstructions.set(playerId, this.mergeDeep(existing, instruction));
        }
      }
    }

    if (layer.overrides.coherenceWeights) {
      result.coherenceWeights = { ...result.coherenceWeights, ...layer.overrides.coherenceWeights };
    }

    result.appliedLayers.push(layer.id);
    return result;
  }

  private evaluateCondition(condition: LayerCondition, context: RealtimeContext): boolean {
    let actualValue: number | string;

    switch (condition.type) {
      case 'time':
        actualValue = context.matchMinute;
        break;
      case 'score':
        actualValue = context.score.home - context.score.away;
        break;
      case 'possession':
        actualValue = context.possession;
        break;
      case 'momentum':
        actualValue = context.momentum;
        break;
      case 'fatigue':
        actualValue = context.averageFatigue;
        break;
      default:
        return true;
    }

    const targetValue = condition.value;

    switch (condition.operator) {
      case 'gt':
        return actualValue > (targetValue as number);
      case 'lt':
        return actualValue < (targetValue as number);
      case 'eq':
        return actualValue === targetValue;
      case 'gte':
        return actualValue >= (targetValue as number);
      case 'lte':
        return actualValue <= (targetValue as number);
      case 'between':
        const [min, max] = targetValue as number[];
        return actualValue >= min && actualValue <= max;
      case 'in':
        return (targetValue as (number | string)[]).includes(actualValue);
      default:
        return true;
    }
  }

  private mergeDeep<T extends object>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        if (targetValue && typeof targetValue === 'object') {
          (result as Record<string, unknown>)[key] = this.mergeDeep(targetValue as object, sourceValue as object);
        } else {
          (result as Record<string, unknown>)[key] = sourceValue;
        }
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }

    return result;
  }
}

// ==================== Dynamic Rule Engine ====================

class DynamicRuleEngine {
  evaluateRules(rules: DynamicRule[], context: RealtimeContext): DynamicRule[] {
    return rules.filter(rule => {
      if (!rule.enabled) return false;
      if (rule.currentActivations >= rule.maxActivations) return false;

      if (rule.lastActivated) {
        const timeSinceLastActivation = (Date.now() - rule.lastActivated.getTime()) / 1000;
        if (timeSinceLastActivation < rule.cooldown) return false;
      }

      return this.evaluateTrigger(rule.trigger, context);
    });
  }

  applyRuleActions(
    resolved: ResolvedGameModel,
    rule: DynamicRule,
    model: AdvancedGameModel
  ): ResolvedGameModel {
    const result = { ...resolved };

    for (const action of rule.actions) {
      switch (action.type) {
        case 'enable_layer':
          const layerToEnable = model.overrideLayers.find(l => l.id === action.target);
          if (layerToEnable) {
            layerToEnable.enabled = true;
          }
          break;

        case 'disable_layer':
          const layerToDisable = model.overrideLayers.find(l => l.id === action.target);
          if (layerToDisable) {
            layerToDisable.enabled = false;
          }
          break;

        case 'modify_weight':
          const weightKey = action.target as keyof CoherenceWeightConfig;
          if (weightKey in result.coherenceWeights && typeof action.value === 'number') {
            (result.coherenceWeights as Record<string, unknown>)[weightKey] = action.value;
          }
          break;

        case 'adjust_parameter':
          // Handle parameter adjustments
          break;

        case 'log':
          console.log(`[DynamicRule] ${rule.name}: ${action.value}`);
          break;
      }
    }

    rule.currentActivations++;
    rule.lastActivated = new Date();
    result.appliedRules.push(rule.id);

    return result;
  }

  private evaluateTrigger(trigger: RuleTrigger, context: RealtimeContext): boolean {
    const results = trigger.conditions.map(condition =>
      this.evaluateTriggerCondition(condition, context)
    );

    return trigger.logic === 'and'
      ? results.every(r => r)
      : results.some(r => r);
  }

  private evaluateTriggerCondition(condition: TriggerCondition, context: RealtimeContext): boolean {
    const metricValue = this.getMetricValue(condition.metric, context);

    switch (condition.operator) {
      case 'gt':
        return metricValue > condition.value;
      case 'lt':
        return metricValue < condition.value;
      case 'eq':
        return metricValue === condition.value;
      case 'gte':
        return metricValue >= condition.value;
      case 'lte':
        return metricValue <= condition.value;
      case 'change_rate':
        // Would require historical data to calculate
        return false;
      default:
        return false;
    }
  }

  private getMetricValue(metric: string, context: RealtimeContext): number {
    const metricMap: Record<string, number> = {
      'coherence': context.teamMetrics.pressureSuccess, // placeholder
      'possession': context.possession,
      'momentum': context.momentum,
      'fatigue': context.averageFatigue,
      'minute': context.matchMinute,
      'score_diff': context.score.home - context.score.away,
      'compactness': context.teamMetrics.compactness,
      'pass_accuracy': context.teamMetrics.passAccuracy,
    };

    return metricMap[metric] ?? 0;
  }
}

// ==================== Context Analyzer ====================

class ContextAnalyzer {
  findMatchingAdaptations(
    adaptations: ContextAdaptation[],
    context: RealtimeContext
  ): ContextAdaptation[] {
    return adaptations.filter(adaptation => {
      const gameContext = adaptation.context;

      // Check score differential
      const scoreDiff = context.score.home - context.score.away;
      if (scoreDiff < gameContext.scoreDifferential.min || scoreDiff > gameContext.scoreDifferential.max) {
        return false;
      }

      // Check minute range
      if (context.matchMinute < gameContext.minuteRange.min || context.matchMinute > gameContext.minuteRange.max) {
        return false;
      }

      // Check possession range if specified
      if (gameContext.possessionRange) {
        if (context.possession < gameContext.possessionRange.min || context.possession > gameContext.possessionRange.max) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => b.confidence - a.confidence);
  }

  applyAdaptation(resolved: ResolvedGameModel, adaptation: ContextAdaptation): ResolvedGameModel {
    const result = { ...resolved };
    const adaptSet = adaptation.adaptations;

    // Apply formation adjustments
    if (adaptSet.formationAdjustments) {
      result.effectiveFormation = {
        ...result.effectiveFormation,
        ...adaptSet.formationAdjustments,
      };
    }

    // Modify coherence weights based on modifiers
    const modifiedWeights = { ...result.coherenceWeights };

    if (adaptSet.pressingIntensityModifier !== 0) {
      modifiedWeights.pressureTiming *= (1 + adaptSet.pressingIntensityModifier);
    }

    if (adaptSet.tempoModifier !== 0) {
      modifiedWeights.transitionSpeed *= (1 + adaptSet.tempoModifier);
    }

    result.coherenceWeights = modifiedWeights;
    result.appliedAdaptations.push(adaptation.id);

    return result;
  }
}

// ==================== Evolution Tracker ====================

class EvolutionTracker {
  recordChange(
    model: AdvancedGameModel,
    changeType: ModelEvolution['changeType'],
    description: string,
    previousState: Partial<AdvancedGameModel>
  ): void {
    const evolution: ModelEvolution = {
      timestamp: new Date(),
      changeType,
      description,
      previousState,
      newState: {
        overrideLayers: model.overrideLayers,
        dynamicRules: model.dynamicRules,
        contextAdaptations: model.contextAdaptations,
      },
      triggeredBy: 'system',
    };

    model.evolutionHistory.push(evolution);

    // Keep only last 100 evolutions
    if (model.evolutionHistory.length > 100) {
      model.evolutionHistory = model.evolutionHistory.slice(-100);
    }
  }
}

// ==================== Factory Functions ====================

export function createAdvancedGameModelEngine(): AdvancedGameModelEngine {
  return new AdvancedGameModelEngine();
}

export function createDefaultOverrideLayer(
  name: string,
  priority: number,
  conditions: LayerCondition[],
  overrides: Partial<GameModelOverrides>
): Omit<ModelOverrideLayer, 'id' | 'createdAt' | 'appliedCount'> {
  return {
    name,
    priority,
    enabled: true,
    conditions,
    overrides,
  };
}

export function createDynamicRule(
  name: string,
  description: string,
  trigger: RuleTrigger,
  actions: RuleAction[],
  options?: Partial<DynamicRule>
): Omit<DynamicRule, 'id' | 'currentActivations'> {
  return {
    name,
    description,
    trigger,
    actions,
    cooldown: options?.cooldown ?? 60,
    maxActivations: options?.maxActivations ?? 10,
    priority: options?.priority ?? 5,
    enabled: options?.enabled ?? true,
  };
}

// ==================== Predefined Layers ====================

export const PREDEFINED_LAYERS = {
  lateGameProtection: createDefaultOverrideLayer(
    'Late Game Protection',
    100,
    [
      { type: 'time', operator: 'gte', value: 80 },
      { type: 'score', operator: 'gt', value: 0 },
    ],
    {
      coherenceWeights: {
        teamShape: 0.25,
        positionalAdherence: 0.25,
        physicalOutput: 0.10,
      } as Partial<CoherenceWeightConfig>,
    }
  ),

  chasingGame: createDefaultOverrideLayer(
    'Chasing Game',
    90,
    [
      { type: 'time', operator: 'gte', value: 60 },
      { type: 'score', operator: 'lt', value: 0 },
    ],
    {
      coherenceWeights: {
        transitionSpeed: 0.15,
        physicalOutput: 0.20,
        pressureTiming: 0.10,
      } as Partial<CoherenceWeightConfig>,
    }
  ),

  highFatigue: createDefaultOverrideLayer(
    'High Fatigue Adjustment',
    80,
    [
      { type: 'fatigue', operator: 'gte', value: 70 },
    ],
    {
      coherenceWeights: {
        physicalOutput: 0.10,
        roleExecution: 0.20,
        positionalAdherence: 0.25,
      } as Partial<CoherenceWeightConfig>,
    }
  ),

  dominantPossession: createDefaultOverrideLayer(
    'Dominant Possession',
    70,
    [
      { type: 'possession', operator: 'gte', value: 65 },
    ],
    {
      coherenceWeights: {
        passingNetworkAlignment: 0.15,
        spaceCreation: 0.10,
        movementPatterns: 0.20,
      } as Partial<CoherenceWeightConfig>,
    }
  ),

  underPressure: createDefaultOverrideLayer(
    'Under Pressure',
    75,
    [
      { type: 'possession', operator: 'lte', value: 35 },
    ],
    {
      coherenceWeights: {
        coverShadowEffectiveness: 0.10,
        teamShape: 0.20,
        pressureTiming: 0.15,
      } as Partial<CoherenceWeightConfig>,
    }
  ),
};

// ==================== Predefined Rules ====================

export const PREDEFINED_RULES = {
  coherenceDropAlert: createDynamicRule(
    'Coherence Drop Alert',
    'Triggers when team coherence drops significantly',
    {
      type: 'threshold',
      conditions: [
        { metric: 'coherence', operator: 'lt', value: 60 },
      ],
      logic: 'and',
    },
    [
      { type: 'log', target: '', value: 'Team coherence dropped below 60%' },
      { type: 'notify', target: 'manager', value: 'coherence_warning' },
    ],
    { cooldown: 300, maxActivations: 5 }
  ),

  momentumShift: createDynamicRule(
    'Momentum Shift Response',
    'Adjusts weights when momentum shifts significantly',
    {
      type: 'threshold',
      conditions: [
        { metric: 'momentum', operator: 'lt', value: -30 },
      ],
      logic: 'and',
    },
    [
      { type: 'modify_weight', target: 'teamShape', value: 0.18 },
      { type: 'modify_weight', target: 'pressureTiming', value: 0.12 },
    ],
    { cooldown: 180, maxActivations: 3 }
  ),
};
