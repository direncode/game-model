/**
 * ADVANCED ANALYTICS ENGINE
 * xG model, passing networks, heatmaps, and graph theory for tactical analysis
 * Includes pressing trap detection and phase transition prediction
 */

import { Vector2D, Vector } from './physics-engine';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ShotData {
  position: Vector2D;
  bodyPart: 'right_foot' | 'left_foot' | 'head' | 'other';
  assistType: 'through_ball' | 'cross' | 'cutback' | 'set_piece' | 'rebound' | 'solo' | 'none';
  defendersPressure: number;      // 0-100
  goalkeeperPosition: Vector2D;
  isOneOnOne: boolean;
  isPenalty: boolean;
  isFreeKick: boolean;
  gameState: 'open_play' | 'counter' | 'set_piece';
  minute: number;
  shotPower: number;              // 0-100
  shotPlacement: Vector2D;        // Target in goal
}

export interface xGResult {
  value: number;
  breakdown: {
    baseXG: number;
    distanceModifier: number;
    angleModifier: number;
    bodyPartModifier: number;
    pressureModifier: number;
    assistTypeModifier: number;
    gameStateModifier: number;
  };
  percentile: number;             // Compared to all shots
}

export interface PassData {
  from: Vector2D;
  to: Vector2D;
  fromPlayerId: string;
  toPlayerId: string;
  successful: boolean;
  type: 'short' | 'medium' | 'long' | 'through' | 'cross' | 'switch';
  progressive: boolean;           // Moved ball significantly toward goal
  underPressure: boolean;
  minute: number;
}

export interface PassingNetwork {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  metrics: NetworkMetrics;
}

export interface NetworkNode {
  playerId: string;
  position: Vector2D;             // Average position
  passes: number;
  receptions: number;
  centrality: number;             // Betweenness centrality
  influence: number;              // Eigenvector centrality
}

export interface NetworkEdge {
  from: string;
  to: string;
  weight: number;                 // Number of passes
  avgDistance: number;
  progressive: number;            // Number of progressive passes
  successRate: number;
}

export interface NetworkMetrics {
  density: number;                // 0-1 (how connected)
  clustering: number;             // 0-1 (triangles)
  avgPathLength: number;
  centralPlayer: string;
  isolatedPlayers: string[];
  strongConnections: { from: string; to: string; strength: number }[];
}

export interface HeatmapData {
  grid: number[][];               // Normalized 0-1 values
  resolution: { x: number; y: number };
  maxValue: number;
  hotspots: { x: number; y: number; intensity: number }[];
}

export interface PressingTrap {
  triggerZone: { x: number; y: number; width: number; height: number };
  trapType: 'sideline' | 'corner' | 'halfspace' | 'central' | 'goalkeeper';
  participatingPlayers: string[];
  successRate: number;
  avgRecoveryTime: number;
  dangerCreated: number;          // xG from turnovers
}

export interface PhaseTransition {
  fromPhase: 'defense' | 'buildup' | 'progression' | 'attack';
  toPhase: 'defense' | 'buildup' | 'progression' | 'attack';
  avgTime: number;                // Seconds
  successRate: number;
  commonPatterns: string[];
}

// ============================================================================
// xG MODEL
// ============================================================================

export class xGModel {
  private readonly GOAL_WIDTH = 7.32;
  private readonly GOAL_CENTER: Vector2D = { x: 105, y: 34 };

  calculate(shot: ShotData): xGResult {
    // Penalty
    if (shot.isPenalty) {
      return this.createResult(0.76, {
        baseXG: 0.76,
        distanceModifier: 1,
        angleModifier: 1,
        bodyPartModifier: 1,
        pressureModifier: 1,
        assistTypeModifier: 1,
        gameStateModifier: 1
      });
    }

    // Calculate base xG from position
    const distance = Vector.distance(shot.position, this.GOAL_CENTER);
    const angle = this.calculateAngle(shot.position);

    // Distance model (exponential decay)
    const distanceXG = Math.exp(-0.1 * distance);
    const distanceModifier = Math.max(0.1, Math.min(1.5, 1.5 - distance / 30));

    // Angle model
    const angleDegrees = (angle * 180) / Math.PI;
    const angleXG = Math.pow(Math.sin(angle), 0.8);
    const angleModifier = Math.max(0.3, angleXG * 1.2);

    // Base xG from position
    const baseXG = distanceXG * angleXG * 0.5;

    // Body part modifier
    const bodyPartModifiers = {
      right_foot: 1.0,
      left_foot: 0.95,
      head: 0.85,
      other: 0.6
    };
    const bodyPartModifier = bodyPartModifiers[shot.bodyPart];

    // Pressure modifier
    const pressureModifier = 1 - (shot.defendersPressure / 100) * 0.4;

    // Assist type modifier
    const assistModifiers = {
      through_ball: 1.3,
      cutback: 1.25,
      cross: 0.85,
      set_piece: 1.1,
      rebound: 1.4,
      solo: 0.9,
      none: 1.0
    };
    const assistTypeModifier = assistModifiers[shot.assistType];

    // Game state modifier
    const gameStateModifiers = {
      counter: 1.2,
      open_play: 1.0,
      set_piece: 1.05
    };
    const gameStateModifier = gameStateModifiers[shot.gameState];

    // One-on-one bonus
    const oneOnOneBonus = shot.isOneOnOne ? 1.5 : 1.0;

    // Calculate final xG
    const xG = baseXG *
               distanceModifier *
               angleModifier *
               bodyPartModifier *
               pressureModifier *
               assistTypeModifier *
               gameStateModifier *
               oneOnOneBonus;

    // Clamp between 0 and 1
    const finalXG = Math.max(0.01, Math.min(0.95, xG));

    return this.createResult(finalXG, {
      baseXG,
      distanceModifier,
      angleModifier,
      bodyPartModifier,
      pressureModifier,
      assistTypeModifier,
      gameStateModifier
    });
  }

  private calculateAngle(position: Vector2D): number {
    const leftPost: Vector2D = { x: 105, y: 34 - this.GOAL_WIDTH / 2 };
    const rightPost: Vector2D = { x: 105, y: 34 + this.GOAL_WIDTH / 2 };

    const toLeft = Vector.subtract(leftPost, position);
    const toRight = Vector.subtract(rightPost, position);

    const dot = Vector.dot(toLeft, toRight);
    const magProduct = Vector.magnitude(toLeft) * Vector.magnitude(toRight);

    return Math.acos(Math.max(-1, Math.min(1, dot / magProduct)));
  }

  private createResult(value: number, breakdown: xGResult['breakdown']): xGResult {
    // Percentile based on typical shot distribution
    let percentile: number;
    if (value < 0.03) percentile = 20;
    else if (value < 0.06) percentile = 40;
    else if (value < 0.1) percentile = 55;
    else if (value < 0.15) percentile = 70;
    else if (value < 0.25) percentile = 80;
    else if (value < 0.4) percentile = 90;
    else percentile = 95;

    return { value, breakdown, percentile };
  }

  // Calculate xG over a sequence of shots
  calculateCumulativeXG(shots: ShotData[]): {
    total: number;
    progression: { minute: number; cumulative: number }[];
    bigChances: number;
  } {
    let cumulative = 0;
    const progression: { minute: number; cumulative: number }[] = [];
    let bigChances = 0;

    for (const shot of shots) {
      const result = this.calculate(shot);
      cumulative += result.value;
      progression.push({ minute: shot.minute, cumulative });

      if (result.value >= 0.3) bigChances++;
    }

    return { total: cumulative, progression, bigChances };
  }
}

// ============================================================================
// PASSING NETWORK ANALYZER
// ============================================================================

export class PassingNetworkAnalyzer {
  private passes: PassData[] = [];
  private readonly PROGRESSIVE_THRESHOLD = 10; // meters toward goal

  addPass(pass: PassData): void {
    this.passes.push(pass);
  }

  clear(): void {
    this.passes = [];
  }

  buildNetwork(): PassingNetwork {
    const nodes = new Map<string, NetworkNode>();
    const edges = new Map<string, NetworkEdge>();

    // Build nodes and edges from passes
    for (const pass of this.passes) {
      // Update from node
      if (!nodes.has(pass.fromPlayerId)) {
        nodes.set(pass.fromPlayerId, {
          playerId: pass.fromPlayerId,
          position: { x: 0, y: 0 },
          passes: 0,
          receptions: 0,
          centrality: 0,
          influence: 0
        });
      }
      const fromNode = nodes.get(pass.fromPlayerId)!;
      fromNode.passes++;
      fromNode.position = this.updateAvgPosition(fromNode.position, pass.from, fromNode.passes);

      // Update to node
      if (!nodes.has(pass.toPlayerId)) {
        nodes.set(pass.toPlayerId, {
          playerId: pass.toPlayerId,
          position: { x: 0, y: 0 },
          passes: 0,
          receptions: 0,
          centrality: 0,
          influence: 0
        });
      }
      const toNode = nodes.get(pass.toPlayerId)!;
      toNode.receptions++;
      toNode.position = this.updateAvgPosition(toNode.position, pass.to, toNode.receptions);

      // Update edge
      const edgeKey = `${pass.fromPlayerId}-${pass.toPlayerId}`;
      if (!edges.has(edgeKey)) {
        edges.set(edgeKey, {
          from: pass.fromPlayerId,
          to: pass.toPlayerId,
          weight: 0,
          avgDistance: 0,
          progressive: 0,
          successRate: 0
        });
      }
      const edge = edges.get(edgeKey)!;
      const distance = Vector.distance(pass.from, pass.to);
      edge.avgDistance = (edge.avgDistance * edge.weight + distance) / (edge.weight + 1);
      edge.weight++;
      if (pass.progressive) edge.progressive++;
      if (pass.successful) edge.successRate = (edge.successRate * (edge.weight - 1) + 1) / edge.weight;
    }

    // Calculate centrality metrics
    const nodeArray = Array.from(nodes.values());
    const edgeArray = Array.from(edges.values());

    this.calculateBetweennessCentrality(nodeArray, edgeArray);
    this.calculateEigenvectorCentrality(nodeArray, edgeArray);

    // Calculate network metrics
    const metrics = this.calculateNetworkMetrics(nodeArray, edgeArray);

    return { nodes: nodeArray, edges: edgeArray, metrics };
  }

  private updateAvgPosition(current: Vector2D, newPos: Vector2D, count: number): Vector2D {
    return {
      x: (current.x * (count - 1) + newPos.x) / count,
      y: (current.y * (count - 1) + newPos.y) / count
    };
  }

  private calculateBetweennessCentrality(nodes: NetworkNode[], edges: NetworkEdge[]): void {
    // Simplified betweenness centrality using shortest paths
    const n = nodes.length;
    const betweenness = new Map<string, number>();

    for (const node of nodes) {
      betweenness.set(node.playerId, 0);
    }

    // For each pair of nodes, find paths through each other node
    for (let s = 0; s < n; s++) {
      for (let t = s + 1; t < n; t++) {
        const source = nodes[s].playerId;
        const target = nodes[t].playerId;

        // Check which nodes lie on paths between source and target
        for (const node of nodes) {
          if (node.playerId === source || node.playerId === target) continue;

          // Check if there's an edge from source to node and from node to target
          const hasSourceToNode = edges.some(e =>
            (e.from === source && e.to === node.playerId) ||
            (e.from === node.playerId && e.to === source)
          );
          const hasNodeToTarget = edges.some(e =>
            (e.from === node.playerId && e.to === target) ||
            (e.from === target && e.to === node.playerId)
          );

          if (hasSourceToNode && hasNodeToTarget) {
            betweenness.set(node.playerId, (betweenness.get(node.playerId) || 0) + 1);
          }
        }
      }
    }

    // Normalize
    const maxBetweenness = Math.max(...Array.from(betweenness.values()), 1);
    for (const node of nodes) {
      node.centrality = (betweenness.get(node.playerId) || 0) / maxBetweenness;
    }
  }

  private calculateEigenvectorCentrality(nodes: NetworkNode[], edges: NetworkEdge[]): void {
    // Power iteration method
    const n = nodes.length;
    const nodeIndex = new Map<string, number>();
    nodes.forEach((node, i) => nodeIndex.set(node.playerId, i));

    // Build adjacency matrix
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    for (const edge of edges) {
      const i = nodeIndex.get(edge.from);
      const j = nodeIndex.get(edge.to);
      if (i !== undefined && j !== undefined) {
        matrix[i][j] = edge.weight;
        matrix[j][i] = edge.weight;  // Undirected
      }
    }

    // Power iteration
    let scores = Array(n).fill(1 / n);
    for (let iter = 0; iter < 50; iter++) {
      const newScores = Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newScores[i] += matrix[i][j] * scores[j];
        }
      }

      // Normalize
      const norm = Math.sqrt(newScores.reduce((sum, s) => sum + s * s, 0)) || 1;
      for (let i = 0; i < n; i++) {
        newScores[i] /= norm;
      }

      scores = newScores;
    }

    // Assign to nodes
    for (let i = 0; i < n; i++) {
      nodes[i].influence = scores[i];
    }
  }

  private calculateNetworkMetrics(nodes: NetworkNode[], edges: NetworkEdge[]): NetworkMetrics {
    const n = nodes.length;
    const possibleEdges = n * (n - 1);

    // Density
    const density = possibleEdges > 0 ? edges.length / possibleEdges : 0;

    // Clustering coefficient (simplified)
    let triangles = 0;
    let possibleTriangles = 0;

    for (const node of nodes) {
      const neighbors = edges
        .filter(e => e.from === node.playerId || e.to === node.playerId)
        .map(e => e.from === node.playerId ? e.to : e.from);

      const neighborCount = neighbors.length;
      possibleTriangles += (neighborCount * (neighborCount - 1)) / 2;

      // Count actual triangles
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          const hasEdge = edges.some(e =>
            (e.from === neighbors[i] && e.to === neighbors[j]) ||
            (e.from === neighbors[j] && e.to === neighbors[i])
          );
          if (hasEdge) triangles++;
        }
      }
    }

    const clustering = possibleTriangles > 0 ? triangles / possibleTriangles : 0;

    // Central player (highest influence)
    const centralPlayer = nodes.reduce((max, node) =>
      node.influence > max.influence ? node : max
    , nodes[0])?.playerId || '';

    // Isolated players (low connectivity)
    const avgConnections = edges.length / n;
    const isolatedPlayers = nodes
      .filter(node => {
        const connections = edges.filter(e =>
          e.from === node.playerId || e.to === node.playerId
        ).length;
        return connections < avgConnections * 0.5;
      })
      .map(n => n.playerId);

    // Strong connections
    const strongConnections = edges
      .filter(e => e.weight >= 5)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(e => ({ from: e.from, to: e.to, strength: e.weight }));

    return {
      density,
      clustering,
      avgPathLength: 2,  // Simplified
      centralPlayer,
      isolatedPlayers,
      strongConnections
    };
  }

  // Detect progressive passing patterns
  detectProgressivePatterns(): { pattern: string; frequency: number; success: number }[] {
    const patterns = new Map<string, { count: number; successful: number }>();

    // Look at sequences of 3 passes
    for (let i = 0; i < this.passes.length - 2; i++) {
      const p1 = this.passes[i];
      const p2 = this.passes[i + 1];
      const p3 = this.passes[i + 2];

      // Check if they form a sequence
      if (p1.toPlayerId === p2.fromPlayerId && p2.toPlayerId === p3.fromPlayerId) {
        // Classify pattern
        let pattern = '';

        if (p1.type === 'short' && p2.type === 'short' && p3.type === 'through') {
          pattern = 'buildup_to_through';
        } else if (p1.type === 'switch' && (p2.type === 'short' || p2.type === 'medium')) {
          pattern = 'switch_and_progress';
        } else if (p1.progressive && p2.progressive) {
          pattern = 'direct_progression';
        } else if (p3.type === 'cross') {
          pattern = 'buildup_to_cross';
        } else {
          pattern = 'circulation';
        }

        if (!patterns.has(pattern)) {
          patterns.set(pattern, { count: 0, successful: 0 });
        }
        const data = patterns.get(pattern)!;
        data.count++;
        if (p3.successful) data.successful++;
      }
    }

    return Array.from(patterns.entries()).map(([pattern, data]) => ({
      pattern,
      frequency: data.count,
      success: data.count > 0 ? data.successful / data.count : 0
    }));
  }
}

// ============================================================================
// HEATMAP GENERATOR
// ============================================================================

export class HeatmapGenerator {
  private readonly PITCH_LENGTH = 105;
  private readonly PITCH_WIDTH = 68;
  private resolutionX: number;
  private resolutionY: number;

  constructor(resolutionX: number = 21, resolutionY: number = 14) {
    this.resolutionX = resolutionX;
    this.resolutionY = resolutionY;
  }

  generateFromPositions(positions: Vector2D[]): HeatmapData {
    const grid: number[][] = Array(this.resolutionY)
      .fill(null)
      .map(() => Array(this.resolutionX).fill(0));

    const cellWidth = this.PITCH_LENGTH / this.resolutionX;
    const cellHeight = this.PITCH_WIDTH / this.resolutionY;

    // Count positions in each cell
    for (const pos of positions) {
      const cellX = Math.floor(pos.x / cellWidth);
      const cellY = Math.floor(pos.y / cellHeight);

      if (cellX >= 0 && cellX < this.resolutionX && cellY >= 0 && cellY < this.resolutionY) {
        grid[cellY][cellX]++;
      }
    }

    // Normalize
    let maxValue = 0;
    for (const row of grid) {
      for (const val of row) {
        if (val > maxValue) maxValue = val;
      }
    }

    if (maxValue > 0) {
      for (let y = 0; y < this.resolutionY; y++) {
        for (let x = 0; x < this.resolutionX; x++) {
          grid[y][x] /= maxValue;
        }
      }
    }

    // Find hotspots
    const hotspots: { x: number; y: number; intensity: number }[] = [];
    for (let y = 0; y < this.resolutionY; y++) {
      for (let x = 0; x < this.resolutionX; x++) {
        if (grid[y][x] > 0.7) {
          hotspots.push({
            x: (x + 0.5) * cellWidth,
            y: (y + 0.5) * cellHeight,
            intensity: grid[y][x]
          });
        }
      }
    }

    return {
      grid,
      resolution: { x: this.resolutionX, y: this.resolutionY },
      maxValue,
      hotspots
    };
  }

  // Generate action-specific heatmap
  generateActionHeatmap(
    actions: { position: Vector2D; type: string; success: boolean }[],
    actionType?: string
  ): HeatmapData {
    const filtered = actionType
      ? actions.filter(a => a.type === actionType)
      : actions;

    return this.generateFromPositions(filtered.map(a => a.position));
  }

  // Defensive territory heatmap
  generateDefensiveTerritoryMap(
    defensiveActions: { position: Vector2D; type: string }[]
  ): HeatmapData {
    return this.generateFromPositions(defensiveActions.map(a => a.position));
  }
}

// ============================================================================
// PRESSING TRAP DETECTOR
// ============================================================================

export class PressingTrapDetector {
  private traps: PressingTrap[] = [];
  private observations: {
    zone: string;
    players: string[];
    success: boolean;
    recoveryTime: number;
    resultingXG: number;
  }[] = [];

  addObservation(
    zone: { x: number; y: number; width: number; height: number },
    players: string[],
    success: boolean,
    recoveryTime: number,
    resultingXG: number
  ): void {
    const zoneType = this.classifyZone(zone);
    this.observations.push({
      zone: zoneType,
      players,
      success,
      recoveryTime,
      resultingXG
    });
  }

  private classifyZone(zone: { x: number; y: number; width: number; height: number }): string {
    const centerX = zone.x + zone.width / 2;
    const centerY = zone.y + zone.height / 2;

    if (centerX < 20) {
      if (centerY < 20 || centerY > 48) return 'corner';
      return 'sideline';
    } else if (centerX < 40) {
      if (centerY < 15 || centerY > 53) return 'sideline';
      if (centerY < 25 || centerY > 43) return 'halfspace';
      return 'central';
    } else {
      if (centerX < 16 && centerY > 20 && centerY < 48) return 'goalkeeper';
      return 'midfield';
    }
  }

  detectTraps(): PressingTrap[] {
    const trapsByZone = new Map<string, {
      players: Set<string>;
      successes: number;
      total: number;
      totalRecoveryTime: number;
      totalXG: number;
    }>();

    for (const obs of this.observations) {
      if (!trapsByZone.has(obs.zone)) {
        trapsByZone.set(obs.zone, {
          players: new Set(),
          successes: 0,
          total: 0,
          totalRecoveryTime: 0,
          totalXG: 0
        });
      }

      const data = trapsByZone.get(obs.zone)!;
      obs.players.forEach(p => data.players.add(p));
      data.total++;
      if (obs.success) data.successes++;
      data.totalRecoveryTime += obs.recoveryTime;
      data.totalXG += obs.resultingXG;
    }

    this.traps = [];

    trapsByZone.forEach((data, zone) => {
      if (data.total >= 3) {  // Minimum observations
        this.traps.push({
          triggerZone: this.getZoneBounds(zone),
          trapType: zone as PressingTrap['trapType'],
          participatingPlayers: Array.from(data.players),
          successRate: data.successes / data.total,
          avgRecoveryTime: data.totalRecoveryTime / data.total,
          dangerCreated: data.totalXG
        });
      }
    });

    return this.traps;
  }

  private getZoneBounds(zone: string): { x: number; y: number; width: number; height: number } {
    const bounds: Record<string, { x: number; y: number; width: number; height: number }> = {
      corner: { x: 0, y: 0, width: 20, height: 20 },
      sideline: { x: 0, y: 0, width: 35, height: 15 },
      halfspace: { x: 20, y: 12, width: 20, height: 15 },
      central: { x: 20, y: 25, width: 25, height: 18 },
      goalkeeper: { x: 0, y: 20, width: 16, height: 28 },
      midfield: { x: 35, y: 15, width: 35, height: 38 }
    };

    return bounds[zone] || { x: 0, y: 0, width: 20, height: 20 };
  }

  getEffectiveTraps(): PressingTrap[] {
    return this.traps.filter(t => t.successRate > 0.5 && t.dangerCreated > 0.1);
  }
}

// ============================================================================
// PHASE TRANSITION ANALYZER
// ============================================================================

export class PhaseTransitionAnalyzer {
  private transitions: {
    from: string;
    to: string;
    duration: number;
    success: boolean;
    pattern: string[];
  }[] = [];

  private currentPhase: string = 'defense';
  private phaseStartTime: number = 0;
  private currentPattern: string[] = [];

  detectPhase(
    ballPosition: Vector2D,
    teamPossession: boolean,
    playerPositions: Vector2D[]
  ): string {
    if (!teamPossession) return 'defense';

    // Calculate team's average x position
    const avgX = playerPositions.reduce((sum, p) => sum + p.x, 0) / playerPositions.length;

    if (ballPosition.x < 35) {
      return 'buildup';
    } else if (ballPosition.x < 70) {
      return avgX > 50 ? 'progression' : 'buildup';
    } else {
      return 'attack';
    }
  }

  recordTransition(
    fromPhase: string,
    toPhase: string,
    duration: number,
    success: boolean,
    pattern: string[]
  ): void {
    this.transitions.push({
      from: fromPhase,
      to: toPhase,
      duration,
      success,
      pattern
    });
  }

  analyzeTransitions(): PhaseTransition[] {
    const transitionMap = new Map<string, {
      durations: number[];
      successes: number;
      total: number;
      patterns: string[][];
    }>();

    for (const t of this.transitions) {
      const key = `${t.from}->${t.to}`;
      if (!transitionMap.has(key)) {
        transitionMap.set(key, {
          durations: [],
          successes: 0,
          total: 0,
          patterns: []
        });
      }

      const data = transitionMap.get(key)!;
      data.durations.push(t.duration);
      data.total++;
      if (t.success) data.successes++;
      data.patterns.push(t.pattern);
    }

    const results: PhaseTransition[] = [];

    transitionMap.forEach((data, key) => {
      const [from, to] = key.split('->');
      const avgTime = data.durations.reduce((a, b) => a + b, 0) / data.durations.length;

      // Find common patterns
      const patternCounts = new Map<string, number>();
      for (const pattern of data.patterns) {
        const patternStr = pattern.join(',');
        patternCounts.set(patternStr, (patternCounts.get(patternStr) || 0) + 1);
      }

      const commonPatterns = Array.from(patternCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([p]) => p);

      results.push({
        fromPhase: from as PhaseTransition['fromPhase'],
        toPhase: to as PhaseTransition['toPhase'],
        avgTime,
        successRate: data.successes / data.total,
        commonPatterns
      });
    });

    return results;
  }

  predictNextTransition(
    currentPhase: string,
    timInPhase: number
  ): { likely: string; probability: number; expectedTime: number } {
    const relevantTransitions = this.transitions.filter(t => t.from === currentPhase);

    if (relevantTransitions.length === 0) {
      return { likely: currentPhase, probability: 0.5, expectedTime: 5 };
    }

    // Count outcomes
    const outcomes = new Map<string, number>();
    let totalDuration = 0;

    for (const t of relevantTransitions) {
      outcomes.set(t.to, (outcomes.get(t.to) || 0) + 1);
      totalDuration += t.duration;
    }

    const mostLikely = Array.from(outcomes.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      likely: mostLikely[0],
      probability: mostLikely[1] / relevantTransitions.length,
      expectedTime: totalDuration / relevantTransitions.length - timInPhase
    };
  }
}

// ============================================================================
// INTEGRATED ANALYTICS ENGINE
// ============================================================================

export class AnalyticsEngine {
  public xGModel: xGModel;
  public passingNetwork: PassingNetworkAnalyzer;
  public heatmapGenerator: HeatmapGenerator;
  public pressingDetector: PressingTrapDetector;
  public phaseAnalyzer: PhaseTransitionAnalyzer;

  private matchStats: {
    homeXG: number;
    awayXG: number;
    homeShots: ShotData[];
    awayShots: ShotData[];
    possession: { home: number; away: number };
  };

  constructor() {
    this.xGModel = new xGModel();
    this.passingNetwork = new PassingNetworkAnalyzer();
    this.heatmapGenerator = new HeatmapGenerator();
    this.pressingDetector = new PressingTrapDetector();
    this.phaseAnalyzer = new PhaseTransitionAnalyzer();

    this.matchStats = {
      homeXG: 0,
      awayXG: 0,
      homeShots: [],
      awayShots: [],
      possession: { home: 50, away: 50 }
    };
  }

  recordShot(shot: ShotData, isHome: boolean): xGResult {
    const result = this.xGModel.calculate(shot);

    if (isHome) {
      this.matchStats.homeXG += result.value;
      this.matchStats.homeShots.push(shot);
    } else {
      this.matchStats.awayXG += result.value;
      this.matchStats.awayShots.push(shot);
    }

    return result;
  }

  recordPass(pass: PassData): void {
    this.passingNetwork.addPass(pass);
  }

  getMatchAnalytics(): {
    xG: { home: number; away: number };
    bigChances: { home: number; away: number };
    passingNetwork: PassingNetwork;
    pressingTraps: PressingTrap[];
    phaseTransitions: PhaseTransition[];
  } {
    const homeXGData = this.xGModel.calculateCumulativeXG(this.matchStats.homeShots);
    const awayXGData = this.xGModel.calculateCumulativeXG(this.matchStats.awayShots);

    return {
      xG: { home: this.matchStats.homeXG, away: this.matchStats.awayXG },
      bigChances: { home: homeXGData.bigChances, away: awayXGData.bigChances },
      passingNetwork: this.passingNetwork.buildNetwork(),
      pressingTraps: this.pressingDetector.detectTraps(),
      phaseTransitions: this.phaseAnalyzer.analyzeTransitions()
    };
  }

  reset(): void {
    this.matchStats = {
      homeXG: 0,
      awayXG: 0,
      homeShots: [],
      awayShots: [],
      possession: { home: 50, away: 50 }
    };
    this.passingNetwork.clear();
  }
}
