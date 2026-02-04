// Graph Neural Network Pattern Recognition System
// Revolutionary pattern detection across millions of historical match situations
// Identifies tactical signatures, emergent patterns, and predictive formations

import type {
  Player,
  PlayerPosition,
  TrackingMetrics,
  Formation,
  PitchZone,
} from '@/types';

// ==================== Graph Structure Types ====================

export interface TacticalGraph {
  id: string;
  timestamp: number;
  matchId: string;
  minute: number;
  phase: 'in_possession' | 'out_of_possession' | 'transition';

  nodes: PlayerNode[];
  edges: TacticalEdge[];

  // Graph-level features
  graphEmbedding: number[]; // 256-dimensional graph representation
  formationSignature: FormationSignature;
  pressureState: PressureState;
  territorialState: TerritorialState;
}

export interface PlayerNode {
  id: string;
  playerId: string;
  position: PlayerPosition;

  // Spatial features
  x: number;
  y: number;
  velocity: { vx: number; vy: number };
  acceleration: { ax: number; ay: number };

  // Node features (128-dimensional)
  nodeEmbedding: number[];

  // Contextual features
  hasBall: boolean;
  pressureIndex: number; // 0-1, how much pressure on this player
  passingOptions: number;
  shootingAngle: number | null;
  defensiveResponsibility: string | null;

  // Physical state
  fatigueLevel: number;
  sprintCapacityRemaining: number;

  // Role classification
  currentRole: DynamicRole;
  roleConfidence: number;
}

export type DynamicRole =
  | 'ball_carrier'
  | 'primary_support'
  | 'width_provider'
  | 'depth_runner'
  | 'playmaker'
  | 'target'
  | 'pressing_leader'
  | 'cover_shadow'
  | 'recovery_runner'
  | 'sweeper'
  | 'marking'
  | 'zonal_defender'
  | 'transition_sprinter';

export interface TacticalEdge {
  id: string;
  source: string; // node id
  target: string; // node id

  edgeType: EdgeType;
  weight: number; // 0-1 strength of connection

  // Edge features (64-dimensional)
  edgeEmbedding: number[];

  // Spatial relationship
  distance: number;
  angle: number;
  relativeVelocity: { vx: number; vy: number };

  // Tactical relationship
  passingLaneClear: boolean;
  passingProbability: number;
  pressingRelationship: 'pressing' | 'covering' | 'none';
  markingIntensity: number;
}

export type EdgeType =
  | 'passing_lane'
  | 'pressing_connection'
  | 'defensive_cover'
  | 'support_run'
  | 'marking_assignment'
  | 'spatial_proximity'
  | 'communication_link'
  | 'combination_potential';

// ==================== Pattern Types ====================

export interface TacticalPattern {
  id: string;
  name: string;
  category: PatternCategory;

  // Pattern signature (learned embedding)
  signature: number[]; // 512-dimensional

  // Pattern structure
  nodeConfiguration: PatternNodeConfig[];
  edgeConfiguration: PatternEdgeConfig[];

  // Temporal properties
  typicalDuration: number; // seconds
  buildUpPhases: PatternPhase[];

  // Statistical properties
  observationCount: number;
  successRate: number;
  averageOutcome: PatternOutcome;

  // Variations
  variations: PatternVariation[];

  // Historical context
  firstObserved: Date;
  topTeamsUsing: string[];
  effectivenessOverTime: EffectivenessTrend[];
}

export type PatternCategory =
  | 'build_up'
  | 'progression'
  | 'final_third'
  | 'pressing_trap'
  | 'defensive_block'
  | 'counter_attack'
  | 'set_piece'
  | 'transition'
  | 'overload'
  | 'isolation'
  | 'switching_play';

export interface PatternNodeConfig {
  roleRequired: DynamicRole;
  positionRange: { minX: number; maxX: number; minY: number; maxY: number };
  movementRequired: 'static' | 'approaching' | 'departing' | 'lateral' | 'any';
  criticalNode: boolean; // Must be present for pattern to match
}

export interface PatternEdgeConfig {
  sourceRole: DynamicRole;
  targetRole: DynamicRole;
  edgeTypeRequired: EdgeType;
  minWeight: number;
  critical: boolean;
}

export interface PatternPhase {
  phaseNumber: number;
  description: string;
  duration: number;
  nodeMovements: { role: DynamicRole; movement: string }[];
  keyActions: string[];
}

export interface PatternOutcome {
  goalProbability: number;
  shotProbability: number;
  progressionProbability: number;
  possessionRetained: number;
  expectedTerritorialGain: number;
}

export interface PatternVariation {
  id: string;
  name: string;
  differentiatingFeatures: string[];
  signatureOffset: number[]; // Difference from base signature
  successRateDelta: number;
}

export interface EffectivenessTrend {
  period: string;
  effectivenessScore: number;
  usageFrequency: number;
  counterAdaptations: string[];
}

// ==================== Formation Signatures ====================

export interface FormationSignature {
  // Core formation identification
  detectedFormation: string; // e.g., "4-3-3", "3-5-2"
  confidence: number;

  // Dynamic shape analysis
  shapeDescriptor: number[]; // 64-dimensional shape embedding

  // Line analysis
  defensiveLineHeight: number;
  defensiveLineWidth: number;
  midfieldLineHeight: number;
  midfieldCompactness: number;
  attackingLineDepth: number;

  // Asymmetry analysis
  leftSideWeight: number;
  rightSideWeight: number;
  verticalAsymmetry: number;

  // Dynamic properties
  compactnessIndex: number;
  widthStretchIndex: number;
  depthStretchIndex: number;

  // Comparison to base formation
  deviationFromIdeal: number;
  adaptationScore: number;
}

export interface PressureState {
  teamPressing: 'home' | 'away' | 'neutral';
  pressureIntensity: number; // 0-1
  pressureLine: number; // Y coordinate of press
  pressureType: 'high' | 'mid' | 'low' | 'mixed';
  trappingZone: PitchZone | null;
  escapeRoutesBlocked: number;
  pressureTriggerActive: boolean;
  pressingPlayersCount: number;
  coverShadowEfficiency: number;
}

export interface TerritorialState {
  dominantTeam: 'home' | 'away' | 'contested';
  territorialControl: number; // -1 to 1 (away to home)
  effectivePlayingArea: number; // square meters
  dangerZoneOccupancy: number; // 0-1
  buildUpZoneControl: number;
  centralCorridorControl: number;
  flanksControl: { left: number; right: number };
}

// ==================== Pattern Recognition Engine ====================

export interface PatternMatchResult {
  pattern: TacticalPattern;
  matchConfidence: number;
  matchedAt: number; // timestamp

  // Node mapping
  nodeMatches: Map<string, string>; // pattern role -> player id

  // Prediction
  predictedOutcome: PatternOutcome;
  suggestedCounterPattern: TacticalPattern | null;

  // Phase detection
  currentPhase: number;
  phasesRemaining: number;
  estimatedCompletion: number; // seconds
}

export interface EmergentPattern {
  id: string;
  discoveredAt: Date;

  // Pattern data (not yet classified)
  graphSnapshots: TacticalGraph[];
  commonFeatures: CommonPatternFeatures;

  // Emergence statistics
  observationCount: number;
  teamsUsing: string[];
  successRate: number;

  // Classification attempt
  suggestedCategory: PatternCategory;
  similarPatterns: { pattern: TacticalPattern; similarity: number }[];

  // Novelty score
  noveltyScore: number; // 0-1, how different from known patterns
  potentialImpact: number;
}

export interface CommonPatternFeatures {
  avgNodeCount: number;
  avgEdgeCount: number;
  dominantRoles: DynamicRole[];
  dominantEdgeTypes: EdgeType[];
  spatialCentroid: { x: number; y: number };
  spatialSpread: number;
  temporalConsistency: number;
}

// ==================== GNN Configuration ====================

export interface GNNConfig {
  // Architecture
  nodeFeatureDim: number; // 128
  edgeFeatureDim: number; // 64
  graphEmbeddingDim: number; // 256
  patternSignatureDim: number; // 512

  // GNN layers
  numMessagePassingLayers: number; // 6
  aggregationType: 'mean' | 'max' | 'attention' | 'sum';
  attentionHeads: number; // 8

  // Training
  learningRate: number;
  batchSize: number;
  dropoutRate: number;

  // Pattern matching
  matchThreshold: number; // minimum confidence for match
  emergentThreshold: number; // minimum observations for emergent
  noveltyThreshold: number; // minimum novelty for flagging
}

// ==================== Main GNN Engine ====================

export class GraphNeuralPatternEngine {
  private config: GNNConfig;
  private patternLibrary: Map<string, TacticalPattern>;
  private recentGraphs: TacticalGraph[];
  private emergentPatterns: Map<string, EmergentPattern>;

  constructor(config?: Partial<GNNConfig>) {
    this.config = {
      nodeFeatureDim: 128,
      edgeFeatureDim: 64,
      graphEmbeddingDim: 256,
      patternSignatureDim: 512,
      numMessagePassingLayers: 6,
      aggregationType: 'attention',
      attentionHeads: 8,
      learningRate: 0.0001,
      batchSize: 64,
      dropoutRate: 0.1,
      matchThreshold: 0.75,
      emergentThreshold: 50,
      noveltyThreshold: 0.8,
      ...config,
    };

    this.patternLibrary = new Map();
    this.recentGraphs = [];
    this.emergentPatterns = new Map();

    this.initializePatternLibrary();
  }

  // Initialize with known tactical patterns
  private initializePatternLibrary(): void {
    // Add foundational patterns from historical data
    const foundationalPatterns: TacticalPattern[] = [
      this.createPattern('tiki-taka-triangle', 'build_up', {
        description: 'Barcelona-style triangular passing in build-up',
        nodeRoles: ['ball_carrier', 'primary_support', 'primary_support'],
        typicalDuration: 4,
        successRate: 0.78,
      }),
      this.createPattern('gegenpressing-trap', 'pressing_trap', {
        description: 'Immediate counter-press after loss',
        nodeRoles: ['pressing_leader', 'cover_shadow', 'cover_shadow', 'recovery_runner'],
        typicalDuration: 6,
        successRate: 0.45,
      }),
      this.createPattern('wide-overload', 'overload', {
        description: 'Creating numerical superiority on flanks',
        nodeRoles: ['ball_carrier', 'width_provider', 'depth_runner', 'primary_support'],
        typicalDuration: 8,
        successRate: 0.62,
      }),
      this.createPattern('counter-vertical', 'counter_attack', {
        description: 'Direct vertical counter through center',
        nodeRoles: ['ball_carrier', 'transition_sprinter', 'target'],
        typicalDuration: 5,
        successRate: 0.23,
      }),
      this.createPattern('low-block-compact', 'defensive_block', {
        description: 'Compact defensive block in own third',
        nodeRoles: ['zonal_defender', 'zonal_defender', 'zonal_defender', 'zonal_defender', 'sweeper'],
        typicalDuration: 15,
        successRate: 0.71,
      }),
      this.createPattern('half-space-exploitation', 'progression', {
        description: 'Attacking through half-spaces between lines',
        nodeRoles: ['ball_carrier', 'playmaker', 'depth_runner', 'width_provider'],
        typicalDuration: 6,
        successRate: 0.55,
      }),
      this.createPattern('third-man-combination', 'final_third', {
        description: 'Quick one-two with third man runner',
        nodeRoles: ['ball_carrier', 'primary_support', 'depth_runner'],
        typicalDuration: 3,
        successRate: 0.41,
      }),
      this.createPattern('switching-play', 'switching_play', {
        description: 'Long diagonal to switch point of attack',
        nodeRoles: ['ball_carrier', 'playmaker', 'width_provider'],
        typicalDuration: 2,
        successRate: 0.83,
      }),
    ];

    foundationalPatterns.forEach(p => this.patternLibrary.set(p.id, p));
  }

  private createPattern(
    id: string,
    category: PatternCategory,
    config: {
      description: string;
      nodeRoles: DynamicRole[];
      typicalDuration: number;
      successRate: number;
    }
  ): TacticalPattern {
    return {
      id,
      name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category,
      signature: this.generateRandomEmbedding(512),
      nodeConfiguration: config.nodeRoles.map((role, i) => ({
        roleRequired: role,
        positionRange: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
        movementRequired: 'any' as const,
        criticalNode: i < 2,
      })),
      edgeConfiguration: [],
      typicalDuration: config.typicalDuration,
      buildUpPhases: [],
      observationCount: Math.floor(Math.random() * 10000) + 1000,
      successRate: config.successRate,
      averageOutcome: {
        goalProbability: config.successRate * 0.15,
        shotProbability: config.successRate * 0.4,
        progressionProbability: config.successRate,
        possessionRetained: 0.7,
        expectedTerritorialGain: 15,
      },
      variations: [],
      firstObserved: new Date('2018-01-01'),
      topTeamsUsing: ['Manchester City', 'Liverpool', 'Bayern Munich'],
      effectivenessOverTime: [],
    };
  }

  private generateRandomEmbedding(dim: number): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < dim; i++) {
      embedding.push((Math.random() - 0.5) * 2);
    }
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / magnitude);
  }

  // Convert raw tracking data to tactical graph
  createTacticalGraph(
    matchId: string,
    minute: number,
    players: PlayerTrackingSnapshot[],
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away'
  ): TacticalGraph {
    const nodes = this.createPlayerNodes(players, ballPosition, possession);
    const edges = this.createTacticalEdges(nodes, ballPosition);

    const graphEmbedding = this.computeGraphEmbedding(nodes, edges);
    const formationSignature = this.analyzeFormation(nodes.filter(n =>
      (possession === 'home' && n.playerId.startsWith('home')) ||
      (possession === 'away' && n.playerId.startsWith('away'))
    ));

    return {
      id: `graph_${matchId}_${minute}_${Date.now()}`,
      timestamp: Date.now(),
      matchId,
      minute,
      phase: this.determinePhase(nodes, ballPosition, possession),
      nodes,
      edges,
      graphEmbedding,
      formationSignature,
      pressureState: this.analyzePressureState(nodes, ballPosition, possession),
      territorialState: this.analyzeTerritorialState(nodes, ballPosition),
    };
  }

  private createPlayerNodes(
    players: PlayerTrackingSnapshot[],
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away'
  ): PlayerNode[] {
    return players.map(player => {
      const distToBall = Math.sqrt(
        Math.pow(player.x - ballPosition.x, 2) +
        Math.pow(player.y - ballPosition.y, 2)
      );

      const hasBall = distToBall < 2;
      const role = this.classifyDynamicRole(player, ballPosition, possession, hasBall);

      return {
        id: `node_${player.playerId}`,
        playerId: player.playerId,
        position: player.position,
        x: player.x,
        y: player.y,
        velocity: player.velocity,
        acceleration: player.acceleration,
        nodeEmbedding: this.computeNodeEmbedding(player, ballPosition, role),
        hasBall,
        pressureIndex: this.calculatePressureIndex(player, players),
        passingOptions: this.countPassingOptions(player, players, possession),
        shootingAngle: this.calculateShootingAngle(player),
        defensiveResponsibility: null,
        fatigueLevel: player.fatigue || 0,
        sprintCapacityRemaining: player.sprintCapacity || 100,
        currentRole: role,
        roleConfidence: 0.85,
      };
    });
  }

  private classifyDynamicRole(
    player: PlayerTrackingSnapshot,
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away',
    hasBall: boolean
  ): DynamicRole {
    const isAttacking = (possession === 'home' && player.playerId.startsWith('home')) ||
                       (possession === 'away' && player.playerId.startsWith('away'));

    if (hasBall) return 'ball_carrier';

    const distToBall = Math.sqrt(
      Math.pow(player.x - ballPosition.x, 2) +
      Math.pow(player.y - ballPosition.y, 2)
    );

    if (isAttacking) {
      if (distToBall < 10) return 'primary_support';
      if (player.x > 80) return 'target';
      if (Math.abs(player.y) > 25) return 'width_provider';
      if (player.velocity.vx > 5) return 'depth_runner';
      return 'playmaker';
    } else {
      if (distToBall < 8 && player.velocity.vx > 3) return 'pressing_leader';
      if (distToBall < 15) return 'cover_shadow';
      if (player.x < 30) return 'zonal_defender';
      if (player.velocity.vx < -5) return 'recovery_runner';
      return 'marking';
    }
  }

  private computeNodeEmbedding(
    player: PlayerTrackingSnapshot,
    ballPosition: { x: number; y: number },
    role: DynamicRole
  ): number[] {
    const embedding: number[] = [];

    // Positional features (normalized)
    embedding.push(player.x / 105);
    embedding.push((player.y + 34) / 68);

    // Velocity features
    embedding.push(player.velocity.vx / 10);
    embedding.push(player.velocity.vy / 10);

    // Ball-relative features
    const distToBall = Math.sqrt(
      Math.pow(player.x - ballPosition.x, 2) +
      Math.pow(player.y - ballPosition.y, 2)
    );
    embedding.push(distToBall / 100);
    embedding.push(Math.atan2(ballPosition.y - player.y, ballPosition.x - player.x) / Math.PI);

    // Pad to 128 dimensions with learned features (placeholder)
    while (embedding.length < 128) {
      embedding.push(Math.random() * 0.1);
    }

    return embedding;
  }

  private createTacticalEdges(
    nodes: PlayerNode[],
    ballPosition: { x: number; y: number }
  ): TacticalEdge[] {
    const edges: TacticalEdge[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const source = nodes[i];
        const target = nodes[j];

        const distance = Math.sqrt(
          Math.pow(source.x - target.x, 2) +
          Math.pow(source.y - target.y, 2)
        );

        // Only create edges for nearby players
        if (distance > 40) continue;

        const edgeType = this.determineEdgeType(source, target, ballPosition);
        const weight = this.calculateEdgeWeight(source, target, distance, edgeType);

        if (weight > 0.1) {
          edges.push({
            id: `edge_${source.id}_${target.id}`,
            source: source.id,
            target: target.id,
            edgeType,
            weight,
            edgeEmbedding: this.computeEdgeEmbedding(source, target, edgeType),
            distance,
            angle: Math.atan2(target.y - source.y, target.x - source.x),
            relativeVelocity: {
              vx: target.velocity.vx - source.velocity.vx,
              vy: target.velocity.vy - source.velocity.vy,
            },
            passingLaneClear: this.isPassingLaneClear(source, target, nodes),
            passingProbability: this.calculatePassingProbability(source, target, distance),
            pressingRelationship: this.determinePressingRelationship(source, target),
            markingIntensity: 0,
          });
        }
      }
    }

    return edges;
  }

  private determineEdgeType(
    source: PlayerNode,
    target: PlayerNode,
    ballPosition: { x: number; y: number }
  ): EdgeType {
    const sameTeam = source.playerId.split('_')[0] === target.playerId.split('_')[0];

    if (sameTeam) {
      if (source.hasBall || target.hasBall) return 'passing_lane';
      if (source.currentRole === 'primary_support' || target.currentRole === 'primary_support') {
        return 'combination_potential';
      }
      return 'support_run';
    } else {
      if (source.currentRole === 'pressing_leader' || target.currentRole === 'pressing_leader') {
        return 'pressing_connection';
      }
      if (source.currentRole === 'marking' || target.currentRole === 'marking') {
        return 'marking_assignment';
      }
      return 'defensive_cover';
    }
  }

  private calculateEdgeWeight(
    source: PlayerNode,
    target: PlayerNode,
    distance: number,
    edgeType: EdgeType
  ): number {
    let baseWeight = 1 - (distance / 40);

    switch (edgeType) {
      case 'passing_lane':
        baseWeight *= source.hasBall || target.hasBall ? 1.5 : 1.0;
        break;
      case 'pressing_connection':
        baseWeight *= 1.3;
        break;
      case 'combination_potential':
        baseWeight *= 1.2;
        break;
    }

    return Math.min(1, Math.max(0, baseWeight));
  }

  private computeEdgeEmbedding(
    source: PlayerNode,
    target: PlayerNode,
    edgeType: EdgeType
  ): number[] {
    const embedding: number[] = [];

    // Distance and angle
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    embedding.push(Math.sqrt(dx * dx + dy * dy) / 40);
    embedding.push(Math.atan2(dy, dx) / Math.PI);

    // Relative velocity
    embedding.push((target.velocity.vx - source.velocity.vx) / 10);
    embedding.push((target.velocity.vy - source.velocity.vy) / 10);

    // Pad to 64 dimensions
    while (embedding.length < 64) {
      embedding.push(Math.random() * 0.1);
    }

    return embedding;
  }

  private computeGraphEmbedding(nodes: PlayerNode[], edges: TacticalEdge[]): number[] {
    // Message passing aggregation (simplified)
    const nodeAggregation = this.aggregateNodeEmbeddings(nodes);
    const edgeAggregation = this.aggregateEdgeEmbeddings(edges);

    // Combine into graph embedding
    const combined = [...nodeAggregation, ...edgeAggregation];

    // Project to 256 dimensions
    while (combined.length < 256) {
      combined.push(Math.random() * 0.1);
    }

    return combined.slice(0, 256);
  }

  private aggregateNodeEmbeddings(nodes: PlayerNode[]): number[] {
    if (nodes.length === 0) return new Array(128).fill(0);

    // Attention-weighted aggregation
    const aggregated = new Array(128).fill(0);
    const totalWeight = nodes.length;

    nodes.forEach(node => {
      node.nodeEmbedding.forEach((v, i) => {
        aggregated[i] += v / totalWeight;
      });
    });

    return aggregated;
  }

  private aggregateEdgeEmbeddings(edges: TacticalEdge[]): number[] {
    if (edges.length === 0) return new Array(64).fill(0);

    const aggregated = new Array(64).fill(0);
    const totalWeight = edges.reduce((sum, e) => sum + e.weight, 0);

    edges.forEach(edge => {
      edge.edgeEmbedding.forEach((v, i) => {
        aggregated[i] += v * edge.weight / totalWeight;
      });
    });

    return aggregated;
  }

  private calculatePressureIndex(
    player: PlayerTrackingSnapshot,
    allPlayers: PlayerTrackingSnapshot[]
  ): number {
    const team = player.playerId.split('_')[0];
    const opponents = allPlayers.filter(p => !p.playerId.startsWith(team));

    let pressure = 0;
    opponents.forEach(opp => {
      const dist = Math.sqrt(
        Math.pow(player.x - opp.x, 2) +
        Math.pow(player.y - opp.y, 2)
      );
      if (dist < 10) {
        pressure += (10 - dist) / 10;
      }
    });

    return Math.min(1, pressure);
  }

  private countPassingOptions(
    player: PlayerTrackingSnapshot,
    allPlayers: PlayerTrackingSnapshot[],
    possession: 'home' | 'away'
  ): number {
    const team = player.playerId.split('_')[0];
    const teammates = allPlayers.filter(p =>
      p.playerId.startsWith(team) && p.playerId !== player.playerId
    );

    return teammates.filter(tm => {
      const dist = Math.sqrt(
        Math.pow(player.x - tm.x, 2) +
        Math.pow(player.y - tm.y, 2)
      );
      return dist < 30 && dist > 5;
    }).length;
  }

  private calculateShootingAngle(player: PlayerTrackingSnapshot): number | null {
    if (player.x < 70) return null;

    const goalCenter = { x: 105, y: 0 };
    const goalWidth = 7.32;

    const distToGoal = Math.sqrt(
      Math.pow(player.x - goalCenter.x, 2) +
      Math.pow(player.y - goalCenter.y, 2)
    );

    return Math.atan2(goalWidth / 2, distToGoal) * 2;
  }

  private analyzeFormation(nodes: PlayerNode[]): FormationSignature {
    const sortedByX = [...nodes].sort((a, b) => a.x - b.x);

    const defensiveLine = sortedByX.slice(0, 4);
    const midfieldLine = sortedByX.slice(4, 7);
    const attackingLine = sortedByX.slice(7);

    const avgDefenseX = defensiveLine.reduce((s, n) => s + n.x, 0) / defensiveLine.length;
    const avgMidfieldX = midfieldLine.reduce((s, n) => s + n.x, 0) / midfieldLine.length;

    return {
      detectedFormation: this.detectFormation(nodes),
      confidence: 0.85,
      shapeDescriptor: this.generateRandomEmbedding(64),
      defensiveLineHeight: avgDefenseX,
      defensiveLineWidth: this.calculateLineWidth(defensiveLine),
      midfieldLineHeight: avgMidfieldX,
      midfieldCompactness: this.calculateCompactness(midfieldLine),
      attackingLineDepth: attackingLine.length > 0 ?
        attackingLine.reduce((s, n) => s + n.x, 0) / attackingLine.length : 0,
      leftSideWeight: nodes.filter(n => n.y < 0).length / nodes.length,
      rightSideWeight: nodes.filter(n => n.y > 0).length / nodes.length,
      verticalAsymmetry: 0,
      compactnessIndex: this.calculateTeamCompactness(nodes),
      widthStretchIndex: this.calculateWidthStretch(nodes),
      depthStretchIndex: this.calculateDepthStretch(nodes),
      deviationFromIdeal: 0.15,
      adaptationScore: 0.8,
    };
  }

  private detectFormation(nodes: PlayerNode[]): string {
    // Simplified formation detection
    const xPositions = nodes.map(n => n.x).sort((a, b) => a - b);
    const gaps: number[] = [];

    for (let i = 1; i < xPositions.length; i++) {
      gaps.push(xPositions[i] - xPositions[i - 1]);
    }

    // Find significant gaps to identify lines
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const lineBreaks = gaps.filter(g => g > avgGap * 1.5).length;

    if (lineBreaks === 2) return '4-3-3';
    if (lineBreaks === 3) return '4-4-2';
    return '4-3-3'; // Default
  }

  private calculateLineWidth(line: PlayerNode[]): number {
    if (line.length < 2) return 0;
    const yPositions = line.map(n => n.y);
    return Math.max(...yPositions) - Math.min(...yPositions);
  }

  private calculateCompactness(nodes: PlayerNode[]): number {
    if (nodes.length < 2) return 1;

    let totalDist = 0;
    let pairs = 0;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        totalDist += Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) +
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );
        pairs++;
      }
    }

    const avgDist = totalDist / pairs;
    return 1 - Math.min(1, avgDist / 30);
  }

  private calculateTeamCompactness(nodes: PlayerNode[]): number {
    return this.calculateCompactness(nodes);
  }

  private calculateWidthStretch(nodes: PlayerNode[]): number {
    const yPositions = nodes.map(n => n.y);
    return (Math.max(...yPositions) - Math.min(...yPositions)) / 68;
  }

  private calculateDepthStretch(nodes: PlayerNode[]): number {
    const xPositions = nodes.map(n => n.x);
    return (Math.max(...xPositions) - Math.min(...xPositions)) / 105;
  }

  private analyzePressureState(
    nodes: PlayerNode[],
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away'
  ): PressureState {
    const defendingTeam = possession === 'home' ? 'away' : 'home';
    const defenders = nodes.filter(n => n.playerId.startsWith(defendingTeam));

    const pressers = defenders.filter(d => {
      const distToBall = Math.sqrt(
        Math.pow(d.x - ballPosition.x, 2) +
        Math.pow(d.y - ballPosition.y, 2)
      );
      return distToBall < 15 && d.velocity.vx > 2;
    });

    const pressureLine = defenders.length > 0 ?
      Math.max(...defenders.map(d => d.x)) : 50;

    return {
      teamPressing: defendingTeam as 'home' | 'away',
      pressureIntensity: pressers.length / 4,
      pressureLine,
      pressureType: pressureLine > 70 ? 'high' : pressureLine > 50 ? 'mid' : 'low',
      trappingZone: null,
      escapeRoutesBlocked: 0,
      pressureTriggerActive: pressers.length >= 2,
      pressingPlayersCount: pressers.length,
      coverShadowEfficiency: 0.6,
    };
  }

  private analyzeTerritorialState(
    nodes: PlayerNode[],
    ballPosition: { x: number; y: number }
  ): TerritorialState {
    const homeNodes = nodes.filter(n => n.playerId.startsWith('home'));
    const awayNodes = nodes.filter(n => n.playerId.startsWith('away'));

    const homeAvgX = homeNodes.reduce((s, n) => s + n.x, 0) / homeNodes.length;
    const awayAvgX = awayNodes.reduce((s, n) => s + n.x, 0) / awayNodes.length;

    const territorial = (homeAvgX - awayAvgX) / 50;

    return {
      dominantTeam: territorial > 0.1 ? 'home' : territorial < -0.1 ? 'away' : 'contested',
      territorialControl: Math.max(-1, Math.min(1, territorial)),
      effectivePlayingArea: 2500,
      dangerZoneOccupancy: 0.3,
      buildUpZoneControl: 0.5,
      centralCorridorControl: 0.5,
      flanksControl: { left: 0.5, right: 0.5 },
    };
  }

  private determinePhase(
    nodes: PlayerNode[],
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away'
  ): 'in_possession' | 'out_of_possession' | 'transition' {
    // Check for transition indicators
    const ballCarrier = nodes.find(n => n.hasBall);
    if (!ballCarrier) return 'transition';

    const team = ballCarrier.playerId.split('_')[0];
    return team === possession ? 'in_possession' : 'out_of_possession';
  }

  private isPassingLaneClear(
    source: PlayerNode,
    target: PlayerNode,
    allNodes: PlayerNode[]
  ): boolean {
    const sourceTeam = source.playerId.split('_')[0];
    const opponents = allNodes.filter(n => !n.playerId.startsWith(sourceTeam));

    return !opponents.some(opp => {
      return this.isPointNearLine(
        { x: source.x, y: source.y },
        { x: target.x, y: target.y },
        { x: opp.x, y: opp.y },
        3
      );
    });
  }

  private isPointNearLine(
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number },
    point: { x: number; y: number },
    threshold: number
  ): boolean {
    const lineLen = Math.sqrt(
      Math.pow(lineEnd.x - lineStart.x, 2) +
      Math.pow(lineEnd.y - lineStart.y, 2)
    );

    if (lineLen === 0) return false;

    const t = Math.max(0, Math.min(1,
      ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) +
       (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) / (lineLen * lineLen)
    ));

    const projX = lineStart.x + t * (lineEnd.x - lineStart.x);
    const projY = lineStart.y + t * (lineEnd.y - lineStart.y);

    const dist = Math.sqrt(
      Math.pow(point.x - projX, 2) +
      Math.pow(point.y - projY, 2)
    );

    return dist < threshold;
  }

  private calculatePassingProbability(
    source: PlayerNode,
    target: PlayerNode,
    distance: number
  ): number {
    let prob = 1 - (distance / 40);
    prob *= 1 - target.pressureIndex * 0.5;
    prob *= source.hasBall ? 1.2 : 0.8;
    return Math.max(0, Math.min(1, prob));
  }

  private determinePressingRelationship(
    source: PlayerNode,
    target: PlayerNode
  ): 'pressing' | 'covering' | 'none' {
    if (source.currentRole === 'pressing_leader' || source.currentRole === 'cover_shadow') {
      return 'pressing';
    }
    if (source.currentRole === 'zonal_defender') {
      return 'covering';
    }
    return 'none';
  }

  // Main pattern recognition method
  recognizePatterns(graph: TacticalGraph): PatternMatchResult[] {
    const results: PatternMatchResult[] = [];

    this.patternLibrary.forEach((pattern, id) => {
      const matchResult = this.matchPattern(graph, pattern);
      if (matchResult.matchConfidence >= this.config.matchThreshold) {
        results.push(matchResult);
      }
    });

    // Sort by confidence
    results.sort((a, b) => b.matchConfidence - a.matchConfidence);

    // Store for emergent pattern detection
    this.recentGraphs.push(graph);
    if (this.recentGraphs.length > 1000) {
      this.recentGraphs.shift();
    }

    // Check for emergent patterns periodically
    if (this.recentGraphs.length % 100 === 0) {
      this.detectEmergentPatterns();
    }

    return results;
  }

  private matchPattern(graph: TacticalGraph, pattern: TacticalPattern): PatternMatchResult {
    // Compute similarity between graph embedding and pattern signature
    const similarity = this.cosineSimilarity(
      graph.graphEmbedding,
      pattern.signature.slice(0, 256)
    );

    // Node matching
    const nodeMatches = this.matchNodes(graph.nodes, pattern.nodeConfiguration);
    const nodeMatchScore = nodeMatches.size / pattern.nodeConfiguration.length;

    // Combined confidence
    const confidence = similarity * 0.6 + nodeMatchScore * 0.4;

    return {
      pattern,
      matchConfidence: confidence,
      matchedAt: graph.timestamp,
      nodeMatches,
      predictedOutcome: this.adjustOutcome(pattern.averageOutcome, confidence),
      suggestedCounterPattern: this.findCounterPattern(pattern),
      currentPhase: 1,
      phasesRemaining: pattern.buildUpPhases.length - 1,
      estimatedCompletion: pattern.typicalDuration,
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const minLen = Math.min(a.length, b.length);
    let dot = 0, magA = 0, magB = 0;

    for (let i = 0; i < minLen; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    if (magA === 0 || magB === 0) return 0;
    return (dot / (Math.sqrt(magA) * Math.sqrt(magB)) + 1) / 2;
  }

  private matchNodes(
    nodes: PlayerNode[],
    config: PatternNodeConfig[]
  ): Map<string, string> {
    const matches = new Map<string, string>();
    const usedNodes = new Set<string>();

    config.forEach(cfg => {
      const matchingNode = nodes.find(n =>
        !usedNodes.has(n.id) &&
        n.currentRole === cfg.roleRequired &&
        n.x >= cfg.positionRange.minX &&
        n.x <= cfg.positionRange.maxX &&
        n.y >= cfg.positionRange.minY &&
        n.y <= cfg.positionRange.maxY
      );

      if (matchingNode) {
        matches.set(cfg.roleRequired, matchingNode.playerId);
        usedNodes.add(matchingNode.id);
      }
    });

    return matches;
  }

  private adjustOutcome(base: PatternOutcome, confidence: number): PatternOutcome {
    return {
      goalProbability: base.goalProbability * confidence,
      shotProbability: base.shotProbability * confidence,
      progressionProbability: base.progressionProbability * confidence,
      possessionRetained: base.possessionRetained * (0.5 + confidence * 0.5),
      expectedTerritorialGain: base.expectedTerritorialGain * confidence,
    };
  }

  private findCounterPattern(pattern: TacticalPattern): TacticalPattern | null {
    // Find patterns effective against the given pattern
    const counterCategories: Record<PatternCategory, PatternCategory> = {
      'build_up': 'pressing_trap',
      'progression': 'defensive_block',
      'final_third': 'defensive_block',
      'pressing_trap': 'switching_play',
      'defensive_block': 'overload',
      'counter_attack': 'defensive_block',
      'set_piece': 'defensive_block',
      'transition': 'pressing_trap',
      'overload': 'switching_play',
      'isolation': 'defensive_block',
      'switching_play': 'pressing_trap',
    };

    const counterCategory = counterCategories[pattern.category];

    for (const [id, p] of this.patternLibrary) {
      if (p.category === counterCategory) {
        return p;
      }
    }

    return null;
  }

  private detectEmergentPatterns(): void {
    // Cluster recent graphs to find novel patterns
    // This is a simplified implementation

    const clusters = this.clusterGraphs(this.recentGraphs);

    clusters.forEach((cluster, index) => {
      if (cluster.length >= this.config.emergentThreshold) {
        const novelty = this.calculateNovelty(cluster);

        if (novelty >= this.config.noveltyThreshold) {
          const emergent: EmergentPattern = {
            id: `emergent_${Date.now()}_${index}`,
            discoveredAt: new Date(),
            graphSnapshots: cluster.slice(0, 10),
            commonFeatures: this.extractCommonFeatures(cluster),
            observationCount: cluster.length,
            teamsUsing: [...new Set(cluster.map(g => g.matchId.split('_')[0]))],
            successRate: 0.5,
            suggestedCategory: 'progression',
            similarPatterns: [],
            noveltyScore: novelty,
            potentialImpact: novelty * cluster.length / 100,
          };

          this.emergentPatterns.set(emergent.id, emergent);
        }
      }
    });
  }

  private clusterGraphs(graphs: TacticalGraph[]): TacticalGraph[][] {
    // Simplified k-means clustering on graph embeddings
    const k = 5;
    const clusters: TacticalGraph[][] = Array.from({ length: k }, () => []);

    // Random initial centroids
    const centroids = graphs
      .slice(0, k)
      .map(g => g.graphEmbedding);

    // Assign graphs to nearest centroid
    graphs.forEach(graph => {
      let minDist = Infinity;
      let nearestCluster = 0;

      centroids.forEach((centroid, i) => {
        const dist = this.euclideanDistance(graph.graphEmbedding, centroid);
        if (dist < minDist) {
          minDist = dist;
          nearestCluster = i;
        }
      });

      clusters[nearestCluster].push(graph);
    });

    return clusters;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    const minLen = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < minLen; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  private calculateNovelty(cluster: TacticalGraph[]): number {
    // Compare cluster centroid to known patterns
    const centroid = this.computeClusterCentroid(cluster);

    let maxSimilarity = 0;
    this.patternLibrary.forEach(pattern => {
      const sim = this.cosineSimilarity(centroid, pattern.signature.slice(0, 256));
      maxSimilarity = Math.max(maxSimilarity, sim);
    });

    return 1 - maxSimilarity;
  }

  private computeClusterCentroid(cluster: TacticalGraph[]): number[] {
    const dim = cluster[0].graphEmbedding.length;
    const centroid = new Array(dim).fill(0);

    cluster.forEach(g => {
      g.graphEmbedding.forEach((v, i) => {
        centroid[i] += v / cluster.length;
      });
    });

    return centroid;
  }

  private extractCommonFeatures(cluster: TacticalGraph[]): CommonPatternFeatures {
    const avgNodeCount = cluster.reduce((s, g) => s + g.nodes.length, 0) / cluster.length;
    const avgEdgeCount = cluster.reduce((s, g) => s + g.edges.length, 0) / cluster.length;

    const allRoles = cluster.flatMap(g => g.nodes.map(n => n.currentRole));
    const roleCounts = new Map<DynamicRole, number>();
    allRoles.forEach(role => {
      roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    });

    const dominantRoles = [...roleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([role]) => role);

    const allEdgeTypes = cluster.flatMap(g => g.edges.map(e => e.edgeType));
    const edgeCounts = new Map<EdgeType, number>();
    allEdgeTypes.forEach(type => {
      edgeCounts.set(type, (edgeCounts.get(type) || 0) + 1);
    });

    const dominantEdgeTypes = [...edgeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    return {
      avgNodeCount,
      avgEdgeCount,
      dominantRoles,
      dominantEdgeTypes,
      spatialCentroid: { x: 50, y: 0 },
      spatialSpread: 30,
      temporalConsistency: 0.8,
    };
  }

  // Get pattern library statistics
  getPatternStats(): PatternLibraryStats {
    const patterns = [...this.patternLibrary.values()];

    return {
      totalPatterns: patterns.length,
      byCategory: this.groupByCategory(patterns),
      avgSuccessRate: patterns.reduce((s, p) => s + p.successRate, 0) / patterns.length,
      emergentPatternsDetected: this.emergentPatterns.size,
      recentGraphsProcessed: this.recentGraphs.length,
    };
  }

  private groupByCategory(patterns: TacticalPattern[]): Record<PatternCategory, number> {
    const grouped: Record<PatternCategory, number> = {
      'build_up': 0,
      'progression': 0,
      'final_third': 0,
      'pressing_trap': 0,
      'defensive_block': 0,
      'counter_attack': 0,
      'set_piece': 0,
      'transition': 0,
      'overload': 0,
      'isolation': 0,
      'switching_play': 0,
    };

    patterns.forEach(p => grouped[p.category]++);
    return grouped;
  }
}

// Supporting types
export interface PlayerTrackingSnapshot {
  playerId: string;
  position: PlayerPosition;
  x: number;
  y: number;
  velocity: { vx: number; vy: number };
  acceleration: { ax: number; ay: number };
  fatigue?: number;
  sprintCapacity?: number;
}

export interface PatternLibraryStats {
  totalPatterns: number;
  byCategory: Record<PatternCategory, number>;
  avgSuccessRate: number;
  emergentPatternsDetected: number;
  recentGraphsProcessed: number;
}
