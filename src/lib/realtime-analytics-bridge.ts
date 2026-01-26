// Real-time Analytics Bridge
// Placeholder system for external analytics provider integration
// Supports multiple providers with fallback and caching mechanisms

import { TrackingMetrics, LivePlayerData, TeamMetrics } from '@/types';

// ==================== Provider Interface Types ====================

export interface AnalyticsProvider {
  id: string;
  name: string;
  type: ProviderType;
  status: ProviderStatus;
  config: ProviderConfig;
  capabilities: ProviderCapabilities;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  subscribe(channels: string[]): void;
  unsubscribe(channels: string[]): void;
  fetch<T>(endpoint: string, params?: Record<string, unknown>): Promise<AnalyticsResponse<T>>;
}

export type ProviderType =
  | 'gps_tracking'
  | 'video_analytics'
  | 'event_data'
  | 'biometric'
  | 'tactical_ai'
  | 'composite';

export type ProviderStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'rate_limited'
  | 'maintenance';

export interface ProviderConfig {
  endpoint: string;
  apiKey?: string;
  refreshRate: number; // ms
  timeout: number; // ms
  retryAttempts: number;
  retryDelay: number; // ms
  batchSize: number;
  compression: boolean;
  encryption: boolean;
}

export interface ProviderCapabilities {
  realtime: boolean;
  historical: boolean;
  predictive: boolean;
  batchProcessing: boolean;
  streaming: boolean;
  webhooks: boolean;
  metrics: string[];
}

export interface AnalyticsResponse<T> {
  success: boolean;
  data?: T;
  error?: AnalyticsError;
  metadata: ResponseMetadata;
}

export interface AnalyticsError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface ResponseMetadata {
  timestamp: Date;
  latency: number; // ms
  source: string;
  cached: boolean;
  version: string;
}

// ==================== Analytics Data Types ====================

export interface RealTimeAnalyticsData {
  timestamp: Date;
  matchId: string;
  minute: number;

  // Player-level metrics
  playerMetrics: Map<string, PlayerAnalyticsData>;

  // Team-level metrics
  teamMetrics: TeamAnalyticsData;

  // Tactical metrics
  tacticalMetrics: TacticalAnalyticsData;

  // Predictive metrics
  predictiveMetrics: PredictiveAnalyticsData;

  // External enrichments
  enrichments: AnalyticsEnrichment[];
}

export interface PlayerAnalyticsData {
  playerId: string;

  // Physical metrics (from GPS/wearables)
  physical: {
    currentSpeed: number;
    maxSpeedReached: number;
    distanceCovered: number;
    sprintCount: number;
    highIntensityRunCount: number;
    accelerations: number;
    decelerations: number;
    metabolicPower: number;
    playerLoad: number;
    heartRate?: number;
    bodyTemperature?: number;
  };

  // Positional metrics
  positional: {
    currentX: number;
    currentY: number;
    zoneOccupancy: string;
    heatmapIntensity: number;
    distanceFromOptimal: number;
    coverageShadow: number;
  };

  // Technical metrics (from video/event data)
  technical: {
    passesAttempted: number;
    passesCompleted: number;
    passAccuracy: number;
    touchesInFinalThird: number;
    duelsWon: number;
    duelsLost: number;
    pressuresApplied: number;
    pressureSuccessRate: number;
    xT_received: number; // expected threat
    xT_generated: number;
  };

  // Cognitive metrics (from tactical AI)
  cognitive: {
    decisionSpeed: number; // ms
    optimalDecisionRate: number;
    spatialAwareness: number;
    anticipationScore: number;
    communicationFrequency: number;
  };

  // Derived scores
  derived: {
    workRateIndex: number;
    tacticalComplianceIndex: number;
    fatigueIndex: number;
    influenceScore: number;
    riskExposure: number;
  };
}

export interface TeamAnalyticsData {
  // Shape metrics
  shape: {
    compactness: number;
    width: number;
    depth: number;
    centroidX: number;
    centroidY: number;
    defensiveLineHeight: number;
    engagementLine: number;
  };

  // Collective metrics
  collective: {
    possession: number;
    territorialControl: number;
    fieldTilt: number;
    ppda: number; // passes per defensive action
    pressureIntensity: number;
    passSequenceLength: number;
    directnessIndex: number;
  };

  // Network metrics
  network: {
    passingConnectivity: number;
    clusteringCoefficient: number;
    centralityDistribution: number[];
    keyPlayerDependency: number;
    triangleCount: number;
  };

  // Momentum metrics
  momentum: {
    currentMomentum: number;
    momentumTrend: number; // rate of change
    dangerzoneEntries: number;
    chancesCreated: number;
    xG: number;
    xGA: number;
  };
}

export interface TacticalAnalyticsData {
  // Pattern detection
  patterns: {
    activePatterns: DetectedPattern[];
    patternSuccessRate: number;
    patternDiversity: number;
    opponentPatternExploitation: number;
  };

  // Phase analysis
  phases: {
    currentPhase: string;
    phaseEffectiveness: number;
    transitionSpeed: number;
    phaseCoherence: number;
  };

  // Press analytics
  pressing: {
    pressTriggerActivations: number;
    pressSuccessRate: number;
    counterPressIntensity: number;
    pressDuration: number;
    recoveryTime: number;
  };

  // Space analytics
  space: {
    spaceCreated: number;
    spaceConceded: number;
    channelsExploited: number;
    overloadZones: string[];
    vulnerableZones: string[];
  };
}

export interface PredictiveAnalyticsData {
  // Risk predictions
  risk: {
    injuryRiskByPlayer: Map<string, number>;
    fatigueProjection: Map<string, number[]>;
    cardRisk: Map<string, number>;
    concessionProbability: number;
  };

  // Opportunity predictions
  opportunity: {
    goalProbabilityNext5: number;
    optimalSubstitutionTime: number;
    tacticalChangeImpact: Map<string, number>;
    weaknessExploitationScore: number;
  };

  // Performance projections
  performance: {
    projectedCoherence: number[];
    projectedPossession: number[];
    projectedxG: number;
    projectedxGA: number;
  };
}

export interface DetectedPattern {
  id: string;
  type: string;
  confidence: number;
  playersInvolved: string[];
  zone: string;
  timestamp: Date;
  outcome?: 'success' | 'failure' | 'ongoing';
}

export interface AnalyticsEnrichment {
  source: string;
  type: string;
  data: Record<string, unknown>;
  confidence: number;
  timestamp: Date;
}

// ==================== Analytics Bridge Core ====================

export class RealtimeAnalyticsBridge {
  private providers: Map<string, AnalyticsProvider> = new Map();
  private cache: AnalyticsCache;
  private aggregator: DataAggregator;
  private fallbackHandler: FallbackHandler;
  private eventEmitter: AnalyticsEventEmitter;
  private subscriptions: Map<string, Set<string>> = new Map();

  constructor(config?: BridgeConfig) {
    this.cache = new AnalyticsCache(config?.cacheConfig);
    this.aggregator = new DataAggregator();
    this.fallbackHandler = new FallbackHandler();
    this.eventEmitter = new AnalyticsEventEmitter();
  }

  // Register an analytics provider
  registerProvider(provider: AnalyticsProvider): void {
    this.providers.set(provider.id, provider);
    console.log(`[AnalyticsBridge] Registered provider: ${provider.name} (${provider.type})`);
  }

  // Unregister a provider
  unregisterProvider(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.disconnect();
      this.providers.delete(providerId);
    }
  }

  // Connect to all registered providers
  async connectAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [id, provider] of this.providers) {
      try {
        const connected = await provider.connect();
        results.set(id, connected);
      } catch (error) {
        console.error(`[AnalyticsBridge] Failed to connect to ${id}:`, error);
        results.set(id, false);
      }
    }

    return results;
  }

  // Fetch real-time analytics data from all providers
  async fetchRealTimeData(matchId: string, minute: number): Promise<RealTimeAnalyticsData> {
    const cacheKey = `realtime-${matchId}-${minute}`;

    // Check cache first
    const cached = this.cache.get<RealTimeAnalyticsData>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from all connected providers
    const playerMetrics = new Map<string, PlayerAnalyticsData>();
    let teamMetrics: TeamAnalyticsData | null = null;
    let tacticalMetrics: TacticalAnalyticsData | null = null;
    let predictiveMetrics: PredictiveAnalyticsData | null = null;
    const enrichments: AnalyticsEnrichment[] = [];

    for (const [id, provider] of this.providers) {
      if (provider.status !== 'connected') continue;

      try {
        switch (provider.type) {
          case 'gps_tracking':
            const gpsData = await this.fetchGPSData(provider, matchId, minute);
            if (gpsData) {
              for (const [playerId, data] of gpsData) {
                const existing = playerMetrics.get(playerId) || this.createEmptyPlayerAnalytics(playerId);
                if (data.physical) existing.physical = data.physical;
                if (data.positional) existing.positional = data.positional;
                playerMetrics.set(playerId, existing);
              }
            }
            break;

          case 'video_analytics':
            const videoData = await this.fetchVideoAnalytics(provider, matchId, minute);
            if (videoData) {
              for (const [playerId, data] of videoData.playerData) {
                const existing = playerMetrics.get(playerId) || this.createEmptyPlayerAnalytics(playerId);
                if (data.technical) existing.technical = data.technical;
                playerMetrics.set(playerId, existing);
              }
              tacticalMetrics = videoData.tactical;
            }
            break;

          case 'tactical_ai':
            const aiData = await this.fetchTacticalAI(provider, matchId, minute);
            if (aiData) {
              for (const [playerId, data] of aiData.cognitiveMetrics) {
                const existing = playerMetrics.get(playerId) || this.createEmptyPlayerAnalytics(playerId);
                existing.cognitive = data;
                playerMetrics.set(playerId, existing);
              }
              predictiveMetrics = aiData.predictive;
            }
            break;

          case 'composite':
            const compositeData = await this.fetchCompositeData(provider, matchId, minute);
            if (compositeData) {
              teamMetrics = compositeData.team;
              enrichments.push(...compositeData.enrichments);
            }
            break;
        }
      } catch (error) {
        console.error(`[AnalyticsBridge] Error fetching from ${id}:`, error);
        // Use fallback
        const fallbackData = this.fallbackHandler.getFallback(provider.type);
        if (fallbackData) {
          enrichments.push({
            source: 'fallback',
            type: provider.type,
            data: fallbackData,
            confidence: 0.5,
            timestamp: new Date(),
          });
        }
      }
    }

    // Compute derived metrics
    this.computeDerivedMetrics(playerMetrics);

    // Aggregate final result
    const result: RealTimeAnalyticsData = {
      timestamp: new Date(),
      matchId,
      minute,
      playerMetrics,
      teamMetrics: teamMetrics || this.aggregator.computeTeamMetrics(playerMetrics),
      tacticalMetrics: tacticalMetrics || this.getDefaultTacticalMetrics(),
      predictiveMetrics: predictiveMetrics || this.getDefaultPredictiveMetrics(),
      enrichments,
    };

    // Cache result
    this.cache.set(cacheKey, result, 1000); // 1 second TTL

    // Emit event
    this.eventEmitter.emit('data_updated', result);

    return result;
  }

  // Subscribe to real-time updates
  subscribe(channel: string, callback: (data: unknown) => void): string {
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(subscriptionId);

    this.eventEmitter.on(channel, callback);

    // Subscribe on all capable providers
    for (const [, provider] of this.providers) {
      if (provider.capabilities.streaming) {
        provider.subscribe([channel]);
      }
    }

    return subscriptionId;
  }

  // Unsubscribe from updates
  unsubscribe(subscriptionId: string): void {
    for (const [channel, subs] of this.subscriptions) {
      if (subs.has(subscriptionId)) {
        subs.delete(subscriptionId);
        if (subs.size === 0) {
          this.subscriptions.delete(channel);
          for (const [, provider] of this.providers) {
            if (provider.capabilities.streaming) {
              provider.unsubscribe([channel]);
            }
          }
        }
        break;
      }
    }
  }

  // Get provider status
  getProviderStatus(): Map<string, ProviderStatus> {
    const status = new Map<string, ProviderStatus>();
    for (const [id, provider] of this.providers) {
      status.set(id, provider.status);
    }
    return status;
  }

  // Private helper methods
  private async fetchGPSData(
    provider: AnalyticsProvider,
    matchId: string,
    minute: number
  ): Promise<Map<string, Partial<PlayerAnalyticsData>> | null> {
    const response = await provider.fetch<{ players: Record<string, unknown>[] }>('gps/realtime', {
      matchId,
      minute,
    });

    if (!response.success || !response.data) return null;

    const result = new Map<string, Partial<PlayerAnalyticsData>>();
    // Transform GPS data to our format
    // Placeholder - actual implementation would parse provider-specific format
    return result;
  }

  private async fetchVideoAnalytics(
    provider: AnalyticsProvider,
    matchId: string,
    minute: number
  ): Promise<{
    playerData: Map<string, Partial<PlayerAnalyticsData>>;
    tactical: TacticalAnalyticsData;
  } | null> {
    const response = await provider.fetch<unknown>('video/analysis', {
      matchId,
      minute,
    });

    if (!response.success || !response.data) return null;

    // Placeholder transformation
    return null;
  }

  private async fetchTacticalAI(
    provider: AnalyticsProvider,
    matchId: string,
    minute: number
  ): Promise<{
    cognitiveMetrics: Map<string, PlayerAnalyticsData['cognitive']>;
    predictive: PredictiveAnalyticsData;
  } | null> {
    const response = await provider.fetch<unknown>('ai/tactical', {
      matchId,
      minute,
    });

    if (!response.success || !response.data) return null;

    // Placeholder transformation
    return null;
  }

  private async fetchCompositeData(
    provider: AnalyticsProvider,
    matchId: string,
    minute: number
  ): Promise<{
    team: TeamAnalyticsData;
    enrichments: AnalyticsEnrichment[];
  } | null> {
    const response = await provider.fetch<unknown>('composite/full', {
      matchId,
      minute,
    });

    if (!response.success || !response.data) return null;

    // Placeholder transformation
    return null;
  }

  private createEmptyPlayerAnalytics(playerId: string): PlayerAnalyticsData {
    return {
      playerId,
      physical: {
        currentSpeed: 0,
        maxSpeedReached: 0,
        distanceCovered: 0,
        sprintCount: 0,
        highIntensityRunCount: 0,
        accelerations: 0,
        decelerations: 0,
        metabolicPower: 0,
        playerLoad: 0,
      },
      positional: {
        currentX: 0,
        currentY: 0,
        zoneOccupancy: 'middle_third',
        heatmapIntensity: 0,
        distanceFromOptimal: 0,
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
        decisionSpeed: 0,
        optimalDecisionRate: 0,
        spatialAwareness: 0,
        anticipationScore: 0,
        communicationFrequency: 0,
      },
      derived: {
        workRateIndex: 0,
        tacticalComplianceIndex: 0,
        fatigueIndex: 0,
        influenceScore: 0,
        riskExposure: 0,
      },
    };
  }

  private computeDerivedMetrics(playerMetrics: Map<string, PlayerAnalyticsData>): void {
    for (const [, data] of playerMetrics) {
      // Work rate index based on physical output
      data.derived.workRateIndex = this.computeWorkRateIndex(data);

      // Fatigue index based on current vs initial output
      data.derived.fatigueIndex = this.computeFatigueIndex(data);

      // Influence score based on involvement
      data.derived.influenceScore = this.computeInfluenceScore(data);

      // Risk exposure based on position and actions
      data.derived.riskExposure = this.computeRiskExposure(data);
    }
  }

  private computeWorkRateIndex(data: PlayerAnalyticsData): number {
    const physicalComponent =
      (data.physical.distanceCovered / 10000) * 0.4 +
      (data.physical.sprintCount / 20) * 0.3 +
      (data.physical.highIntensityRunCount / 40) * 0.3;

    return Math.min(100, physicalComponent * 100);
  }

  private computeFatigueIndex(data: PlayerAnalyticsData): number {
    // Placeholder - would use historical baseline comparison
    const loadFactor = data.physical.playerLoad / 1000;
    const heartRateFactor = data.physical.heartRate ? data.physical.heartRate / 200 : 0.5;

    return Math.min(100, (loadFactor * 0.6 + heartRateFactor * 0.4) * 100);
  }

  private computeInfluenceScore(data: PlayerAnalyticsData): number {
    const technicalInfluence =
      (data.technical.passesCompleted * 2) +
      (data.technical.touchesInFinalThird * 5) +
      (data.technical.duelsWon * 3) +
      (data.technical.xT_generated * 50);

    return Math.min(100, technicalInfluence / 50);
  }

  private computeRiskExposure(data: PlayerAnalyticsData): number {
    // Based on duels, position, and physical load
    const duelRisk = data.technical.duelsLost / Math.max(1, data.technical.duelsWon + data.technical.duelsLost);
    const fatigueRisk = data.derived.fatigueIndex / 100;
    const positionalRisk = data.positional.distanceFromOptimal / 30; // Normalize by 30m

    return Math.min(100, (duelRisk * 0.4 + fatigueRisk * 0.4 + positionalRisk * 0.2) * 100);
  }

  private getDefaultTacticalMetrics(): TacticalAnalyticsData {
    return {
      patterns: {
        activePatterns: [],
        patternSuccessRate: 0,
        patternDiversity: 0,
        opponentPatternExploitation: 0,
      },
      phases: {
        currentPhase: 'buildUp',
        phaseEffectiveness: 50,
        transitionSpeed: 0,
        phaseCoherence: 50,
      },
      pressing: {
        pressTriggerActivations: 0,
        pressSuccessRate: 0,
        counterPressIntensity: 0,
        pressDuration: 0,
        recoveryTime: 0,
      },
      space: {
        spaceCreated: 0,
        spaceConceded: 0,
        channelsExploited: 0,
        overloadZones: [],
        vulnerableZones: [],
      },
    };
  }

  private getDefaultPredictiveMetrics(): PredictiveAnalyticsData {
    return {
      risk: {
        injuryRiskByPlayer: new Map(),
        fatigueProjection: new Map(),
        cardRisk: new Map(),
        concessionProbability: 0.5,
      },
      opportunity: {
        goalProbabilityNext5: 0.1,
        optimalSubstitutionTime: 65,
        tacticalChangeImpact: new Map(),
        weaknessExploitationScore: 0,
      },
      performance: {
        projectedCoherence: [70, 68, 65, 63, 60],
        projectedPossession: [50, 50, 50, 50, 50],
        projectedxG: 0,
        projectedxGA: 0,
      },
    };
  }
}

// ==================== Supporting Classes ====================

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class AnalyticsCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: config?.maxSize ?? 1000,
      defaultTTL: config?.defaultTTL ?? 5000,
    };
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (this.cache.size >= this.config.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttl ?? this.config.defaultTTL),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

class DataAggregator {
  computeTeamMetrics(playerMetrics: Map<string, PlayerAnalyticsData>): TeamAnalyticsData {
    const players = Array.from(playerMetrics.values());

    if (players.length === 0) {
      return this.getEmptyTeamMetrics();
    }

    // Compute centroid
    const positions = players.map(p => ({ x: p.positional.currentX, y: p.positional.currentY }));
    const centroidX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const centroidY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

    // Compute spread metrics
    const xs = positions.map(p => p.x);
    const ys = positions.map(p => p.y);
    const width = Math.max(...ys) - Math.min(...ys);
    const depth = Math.max(...xs) - Math.min(...xs);

    // Compute compactness (inverse of average distance from centroid)
    const avgDistanceFromCentroid = positions.reduce((sum, p) => {
      return sum + Math.sqrt(Math.pow(p.x - centroidX, 2) + Math.pow(p.y - centroidY, 2));
    }, 0) / positions.length;
    const compactness = Math.max(0, 100 - avgDistanceFromCentroid * 2);

    // Aggregate technical metrics
    const totalPasses = players.reduce((sum, p) => sum + p.technical.passesAttempted, 0);
    const completedPasses = players.reduce((sum, p) => sum + p.technical.passesCompleted, 0);
    const passAccuracy = totalPasses > 0 ? (completedPasses / totalPasses) * 100 : 0;

    // Aggregate pressing metrics
    const totalPressures = players.reduce((sum, p) => sum + p.technical.pressuresApplied, 0);
    const avgPressureSuccess = players.reduce((sum, p) => sum + p.technical.pressureSuccessRate, 0) / players.length;

    return {
      shape: {
        compactness,
        width,
        depth,
        centroidX,
        centroidY,
        defensiveLineHeight: Math.min(...xs) + 52.5, // Convert to distance from goal
        engagementLine: centroidX + 52.5,
      },
      collective: {
        possession: 50, // Would need match data
        territorialControl: (centroidX + 52.5) / 105 * 100,
        fieldTilt: 50, // Would need opponent data
        ppda: totalPressures > 0 ? totalPasses / totalPressures : 0,
        pressureIntensity: avgPressureSuccess,
        passSequenceLength: 0, // Would need event data
        directnessIndex: 50, // Would need event data
      },
      network: {
        passingConnectivity: passAccuracy / 100,
        clusteringCoefficient: 0, // Would need passing network data
        centralityDistribution: [],
        keyPlayerDependency: 0,
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
    };
  }

  private getEmptyTeamMetrics(): TeamAnalyticsData {
    return {
      shape: {
        compactness: 0,
        width: 0,
        depth: 0,
        centroidX: 0,
        centroidY: 0,
        defensiveLineHeight: 0,
        engagementLine: 0,
      },
      collective: {
        possession: 0,
        territorialControl: 0,
        fieldTilt: 0,
        ppda: 0,
        pressureIntensity: 0,
        passSequenceLength: 0,
        directnessIndex: 0,
      },
      network: {
        passingConnectivity: 0,
        clusteringCoefficient: 0,
        centralityDistribution: [],
        keyPlayerDependency: 0,
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
    };
  }
}

class FallbackHandler {
  private fallbacks: Map<ProviderType, Record<string, unknown>> = new Map();

  constructor() {
    this.initializeDefaults();
  }

  getFallback(type: ProviderType): Record<string, unknown> | undefined {
    return this.fallbacks.get(type);
  }

  setFallback(type: ProviderType, data: Record<string, unknown>): void {
    this.fallbacks.set(type, data);
  }

  private initializeDefaults(): void {
    this.fallbacks.set('gps_tracking', {
      status: 'fallback',
      defaultSpeed: 5,
      defaultPosition: { x: 0, y: 0 },
    });

    this.fallbacks.set('video_analytics', {
      status: 'fallback',
      defaultPassAccuracy: 75,
    });

    this.fallbacks.set('tactical_ai', {
      status: 'fallback',
      defaultCoherence: 70,
    });
  }
}

type EventCallback = (data: unknown) => void;

class AnalyticsEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventEmitter] Error in listener for ${event}:`, error);
      }
    });
  }
}

// ==================== Placeholder Provider Implementation ====================

export class PlaceholderAnalyticsProvider implements AnalyticsProvider {
  id: string;
  name: string;
  type: ProviderType;
  status: ProviderStatus = 'disconnected';
  config: ProviderConfig;
  capabilities: ProviderCapabilities;

  private simulationData: Map<string, unknown> = new Map();

  constructor(
    id: string,
    name: string,
    type: ProviderType,
    config?: Partial<ProviderConfig>
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.config = {
      endpoint: config?.endpoint ?? 'placeholder://local',
      apiKey: config?.apiKey,
      refreshRate: config?.refreshRate ?? 1000,
      timeout: config?.timeout ?? 5000,
      retryAttempts: config?.retryAttempts ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
      batchSize: config?.batchSize ?? 100,
      compression: config?.compression ?? false,
      encryption: config?.encryption ?? false,
    };
    this.capabilities = {
      realtime: true,
      historical: false,
      predictive: type === 'tactical_ai',
      batchProcessing: true,
      streaming: false,
      webhooks: false,
      metrics: this.getMetricsForType(type),
    };
  }

  async connect(): Promise<boolean> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));
    this.status = 'connected';
    console.log(`[${this.name}] Connected (placeholder mode)`);
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
    console.log(`[${this.name}] Disconnected`);
  }

  subscribe(channels: string[]): void {
    console.log(`[${this.name}] Subscribed to channels:`, channels);
  }

  unsubscribe(channels: string[]): void {
    console.log(`[${this.name}] Unsubscribed from channels:`, channels);
  }

  async fetch<T>(endpoint: string, params?: Record<string, unknown>): Promise<AnalyticsResponse<T>> {
    // Simulate network latency
    const latency = Math.random() * 50 + 10;
    await new Promise(resolve => setTimeout(resolve, latency));

    // Generate placeholder data based on endpoint
    const data = this.generatePlaceholderData(endpoint, params);

    return {
      success: true,
      data: data as T,
      metadata: {
        timestamp: new Date(),
        latency,
        source: this.name,
        cached: false,
        version: '1.0.0-placeholder',
      },
    };
  }

  // Set simulation data for testing
  setSimulationData(key: string, data: unknown): void {
    this.simulationData.set(key, data);
  }

  private getMetricsForType(type: ProviderType): string[] {
    const metricsMap: Record<ProviderType, string[]> = {
      gps_tracking: ['position', 'speed', 'distance', 'acceleration', 'playerLoad'],
      video_analytics: ['passes', 'touches', 'duels', 'pressures', 'xT'],
      event_data: ['goals', 'shots', 'fouls', 'cards', 'substitutions'],
      biometric: ['heartRate', 'temperature', 'hydration', 'muscleOxygen'],
      tactical_ai: ['patterns', 'coherence', 'predictions', 'decisions'],
      composite: ['all'],
    };
    return metricsMap[type] || [];
  }

  private generatePlaceholderData(endpoint: string, params?: Record<string, unknown>): unknown {
    // Return simulation data if available
    if (this.simulationData.has(endpoint)) {
      return this.simulationData.get(endpoint);
    }

    // Generate random placeholder data
    return {
      endpoint,
      params,
      placeholder: true,
      timestamp: new Date().toISOString(),
      randomValue: Math.random(),
    };
  }
}

// ==================== Bridge Configuration ====================

export interface BridgeConfig {
  cacheConfig?: Partial<CacheConfig>;
  defaultProviders?: ProviderType[];
  autoConnect?: boolean;
}

// ==================== Factory Functions ====================

export function createAnalyticsBridge(config?: BridgeConfig): RealtimeAnalyticsBridge {
  const bridge = new RealtimeAnalyticsBridge(config);

  // Register default placeholder providers if specified
  if (config?.defaultProviders) {
    for (const type of config.defaultProviders) {
      const provider = new PlaceholderAnalyticsProvider(
        `placeholder-${type}`,
        `Placeholder ${type.replace('_', ' ')} Provider`,
        type
      );
      bridge.registerProvider(provider);
    }
  }

  // Auto-connect if specified
  if (config?.autoConnect) {
    bridge.connectAll().catch(console.error);
  }

  return bridge;
}

export function createPlaceholderProvider(
  type: ProviderType,
  customConfig?: Partial<ProviderConfig>
): PlaceholderAnalyticsProvider {
  return new PlaceholderAnalyticsProvider(
    `placeholder-${type}-${Date.now()}`,
    `Placeholder ${type.replace('_', ' ')} Provider`,
    type,
    customConfig
  );
}
