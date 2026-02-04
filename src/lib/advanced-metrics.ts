// Advanced Metrics Suite - Next-Generation Football Analytics
// Contextual xG+, Expected Threat, Injury Prediction from Tactical Overload
// Press Resistance Index, Passing Network Analysis, Space Control

import type {
  Player,
  PlayerPosition,
  TrackingMetrics,
  WearableData,
} from '@/types';

import type {
  NormalizedTrackingFrame,
  NormalizedPlayerPosition,
  NormalizedEvent,
  TeamShape,
} from './data-substrate';

import type {
  TacticalGraph,
  PlayerNode,
} from './graph-neural-patterns';

// ==================== Contextual xG+ System ====================

export interface ContextualXGConfig {
  // Model parameters
  baseModelVersion: string;
  contextLayers: number;
  temporalWindow: number; // frames

  // Context weights
  defenderPositionWeight: number;
  goalkeeperPositionWeight: number;
  bodyOrientationWeight: number;
  precedingActionWeight: number;
  gameStateWeight: number;
  fatigueWeight: number;
}

export interface ContextualXGResult {
  baseXG: number;
  contextualXG: number;
  xGDelta: number;

  // Context breakdown
  defenderImpact: number;
  goalkeeperImpact: number;
  bodyOrientationImpact: number;
  precedingActionImpact: number;
  gameStateImpact: number;
  fatigueImpact: number;

  // Shot context
  shotContext: ShotContext;

  // Confidence
  confidence: number;
  modelVersion: string;
}

export interface ShotContext {
  // Spatial context
  shotLocation: { x: number; y: number };
  distanceToGoal: number;
  angleToGoal: number;

  // Defender positions
  defendersInCone: number;
  nearestDefenderDistance: number;
  defenderPressure: number;
  blockedAngle: number;

  // Goalkeeper
  goalkeeperPosition: { x: number; y: number };
  goalkeeperCoverage: number;
  goalkeeperReady: boolean;

  // Shooter state
  shooterSpeed: number;
  shooterFacingGoal: boolean;
  preferredFoot: boolean;
  fatigueLevel: number;

  // Build-up
  precedingAction: string;
  passesInSequence: number;
  secondsInPossession: number;
  counterAttack: boolean;

  // Game state
  scoreDifferential: number;
  minute: number;
  homeAway: 'home' | 'away';
}

// ==================== Expected Threat (xT) System ====================

export interface XTModel {
  // Grid-based threat values (12x8 grid)
  threatGrid: number[][];
  gridResolution: { x: number; y: number };

  // Transition probabilities
  moveProb: number[][][][]; // From zone to zone
  shotProb: number[][]; // Shot probability by zone
  goalProb: number[][]; // Goal probability given shot

  // Dynamic adjustments
  pressureAdjustment: number[][];
  fatigueAdjustment: number[][];
}

export interface XTResult {
  startThreat: number;
  endThreat: number;
  xTAdded: number;

  zone: { from: string; to: string };
  actionType: 'pass' | 'carry' | 'dribble';

  // Context
  underPressure: boolean;
  progressiveAction: boolean;
  intoFinalThird: boolean;

  confidence: number;
}

// ==================== Press Resistance Index ====================

export interface PressResistanceResult {
  overallScore: number; // 0-100

  // Component scores
  receiveUnderPressure: number;
  escapeFromPressure: number;
  retainPossession: number;
  progressivePassing: number;
  bodyOrientation: number;

  // Context
  pressureLevel: number;
  opponentsWithin5m: number;
  successfulActions: number;
  totalActions: number;

  // Comparison
  positionPercentile: number;
  leaguePercentile: number;
}

// ==================== Space Control Metrics ====================

export interface SpaceControlResult {
  // Team-level
  totalControlledSpace: number; // square meters
  attackingThirdControl: number;
  centralCorridorControl: number;
  halfSpaceControl: { left: number; right: number };

  // Pitch zones
  zoneControl: Map<string, number>;

  // Dynamic metrics
  spaceCreation: number;
  spaceExploitation: number;
  compactionEfficiency: number;

  // Individual contributions
  playerContributions: Map<string, PlayerSpaceContribution>;
}

export interface PlayerSpaceContribution {
  playerId: string;
  controlledSpace: number;
  influenceRadius: number;
  movementImpact: number;
  passingLanesCreated: number;
}

// ==================== Injury Risk Prediction ====================

export interface InjuryRiskConfig {
  // Thresholds
  acuteChronicRatio: number;
  sprintThreshold: number;
  accelerationThreshold: number;
  decelerationThreshold: number;

  // Weights
  workloadWeight: number;
  biomechanicsWeight: number;
  fatigueWeight: number;
  historyWeight: number;
}

export interface InjuryRiskResult {
  overallRisk: number; // 0-1
  riskCategory: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';

  // Risk factors
  workloadRisk: WorkloadRisk;
  biomechanicsRisk: BiomechanicsRisk;
  fatigueRisk: FatigueRisk;
  tacticalOverloadRisk: TacticalOverloadRisk;

  // Specific injury risks
  hamstringRisk: number;
  ankleRisk: number;
  kneeRisk: number;
  muscleRisk: number;

  // Recommendations
  recommendations: InjuryPrevention[];

  // Time to potential injury
  estimatedTimeToRisk: number; // minutes
}

export interface WorkloadRisk {
  acuteLoad: number;
  chronicLoad: number;
  acuteChronicRatio: number;
  weeklyChange: number;
  riskScore: number;
}

export interface BiomechanicsRisk {
  asymmetryScore: number;
  movementQuality: number;
  accelerationProfile: number;
  decelerationProfile: number;
  riskScore: number;
}

export interface FatigueRisk {
  centralFatigue: number;
  peripheralFatigue: number;
  metabolicFatigue: number;
  cognitiveLoad: number;
  riskScore: number;
}

export interface TacticalOverloadRisk {
  positionDemand: number;
  coverageArea: number;
  sprintDemand: number;
  pressingDemand: number;
  recoveryRunDemand: number;
  riskScore: number;
}

export interface InjuryPrevention {
  action: string;
  urgency: 'immediate' | 'soon' | 'planned';
  expectedRiskReduction: number;
  sideEffects?: string[];
}

// ==================== Passing Network Analysis ====================

export interface PassingNetworkResult {
  // Network metrics
  density: number;
  centralization: number;
  clustering: number;
  avgPathLength: number;

  // Key players
  hubPlayers: string[];
  bridgePlayers: string[];
  peripheralPlayers: string[];

  // Passing patterns
  dominantPatterns: PassingPattern[];
  progressivePassPercentage: number;
  backPassPercentage: number;

  // Node metrics
  playerMetrics: Map<string, PlayerNetworkMetrics>;

  // Edge metrics
  connectionStrength: Map<string, number>;
  preferredConnections: PassConnection[];
}

export interface PlayerNetworkMetrics {
  playerId: string;
  degree: number; // connections
  betweenness: number; // bridge importance
  closeness: number; // path efficiency
  pageRank: number; // overall importance
  passingVolume: number;
  receivingVolume: number;
}

export interface PassingPattern {
  name: string;
  players: string[];
  frequency: number;
  successRate: number;
  xTGenerated: number;
}

export interface PassConnection {
  from: string;
  to: string;
  volume: number;
  successRate: number;
  avgDistance: number;
  avgXT: number;
}

// ==================== Main Advanced Metrics Engine ====================

export class AdvancedMetricsEngine {
  private xgConfig: ContextualXGConfig;
  private xtModel: XTModel;
  private injuryConfig: InjuryRiskConfig;

  constructor() {
    this.xgConfig = {
      baseModelVersion: '3.0.0',
      contextLayers: 5,
      temporalWindow: 25,
      defenderPositionWeight: 0.25,
      goalkeeperPositionWeight: 0.15,
      bodyOrientationWeight: 0.15,
      precedingActionWeight: 0.2,
      gameStateWeight: 0.1,
      fatigueWeight: 0.15,
    };

    this.xtModel = this.initializeXTModel();

    this.injuryConfig = {
      acuteChronicRatio: 1.3,
      sprintThreshold: 25.2,
      accelerationThreshold: 3.0,
      decelerationThreshold: -3.0,
      workloadWeight: 0.3,
      biomechanicsWeight: 0.25,
      fatigueWeight: 0.25,
      historyWeight: 0.2,
    };
  }

  private initializeXTModel(): XTModel {
    // Initialize expected threat grid (12 columns x 8 rows)
    const threatGrid: number[][] = [];
    const gridX = 12;
    const gridY = 8;

    for (let y = 0; y < gridY; y++) {
      threatGrid[y] = [];
      for (let x = 0; x < gridX; x++) {
        // Higher threat closer to goal and centrally
        const distanceFromGoal = gridX - x;
        const centralityBonus = 1 - Math.abs(y - gridY / 2) / (gridY / 2);

        let threat = 0.01 * Math.exp(-distanceFromGoal * 0.3) * (1 + centralityBonus * 0.5);

        // Penalty area boost
        if (x >= 10 && y >= 2 && y <= 5) {
          threat *= 3;
        }

        threatGrid[y][x] = Math.min(0.25, threat);
      }
    }

    return {
      threatGrid,
      gridResolution: { x: gridX, y: gridY },
      moveProb: [], // Would be learned from data
      shotProb: threatGrid.map(row => row.map(v => v * 0.5)),
      goalProb: threatGrid.map(row => row.map(v => v * 0.3)),
      pressureAdjustment: threatGrid.map(row => row.map(() => 1.0)),
      fatigueAdjustment: threatGrid.map(row => row.map(() => 1.0)),
    };
  }

  // ==================== Contextual xG+ ====================

  calculateContextualXG(
    shotEvent: NormalizedEvent,
    frame: NormalizedTrackingFrame,
    recentFrames: NormalizedTrackingFrame[],
    gameState: { scoreDiff: number; minute: number }
  ): ContextualXGResult {
    const shotContext = this.buildShotContext(shotEvent, frame, recentFrames, gameState);

    // Base xG from position
    const baseXG = this.calculateBaseXG(shotContext.shotLocation);

    // Context adjustments
    const defenderImpact = this.calculateDefenderImpact(shotContext);
    const goalkeeperImpact = this.calculateGoalkeeperImpact(shotContext);
    const bodyOrientationImpact = this.calculateBodyOrientationImpact(shotContext);
    const precedingActionImpact = this.calculatePrecedingActionImpact(shotContext);
    const gameStateImpact = this.calculateGameStateImpact(shotContext);
    const fatigueImpact = this.calculateFatigueImpact(shotContext);

    // Combine impacts
    const totalImpact =
      defenderImpact * this.xgConfig.defenderPositionWeight +
      goalkeeperImpact * this.xgConfig.goalkeeperPositionWeight +
      bodyOrientationImpact * this.xgConfig.bodyOrientationWeight +
      precedingActionImpact * this.xgConfig.precedingActionWeight +
      gameStateImpact * this.xgConfig.gameStateWeight +
      fatigueImpact * this.xgConfig.fatigueWeight;

    const contextualXG = Math.min(0.98, Math.max(0.01, baseXG * (1 + totalImpact)));

    return {
      baseXG,
      contextualXG,
      xGDelta: contextualXG - baseXG,
      defenderImpact,
      goalkeeperImpact,
      bodyOrientationImpact,
      precedingActionImpact,
      gameStateImpact,
      fatigueImpact,
      shotContext,
      confidence: 0.85,
      modelVersion: this.xgConfig.baseModelVersion,
    };
  }

  private buildShotContext(
    shot: NormalizedEvent,
    frame: NormalizedTrackingFrame,
    recentFrames: NormalizedTrackingFrame[],
    gameState: { scoreDiff: number; minute: number }
  ): ShotContext {
    const shooter = frame.players.get(shot.actor.playerId);
    const ball = frame.ball;

    // Find defenders in cone to goal
    const defenders = [...frame.players.values()].filter(p =>
      p.team !== shot.actor.team && p.x > shot.location.x
    );

    const distanceToGoal = Math.sqrt(
      Math.pow(105 - shot.location.x, 2) +
      Math.pow(shot.location.y, 2)
    );

    const angleToGoal = this.calculateGoalAngle(shot.location.x, shot.location.y);

    // Defenders in shooting cone
    const defendersInCone = defenders.filter(d =>
      this.isInShootingCone(shot.location, { x: d.x, y: d.y })
    ).length;

    // Nearest defender
    const nearestDefender = defenders.reduce((nearest, d) => {
      const dist = Math.sqrt(
        Math.pow(d.x - shot.location.x, 2) +
        Math.pow(d.y - shot.location.y, 2)
      );
      return dist < nearest.dist ? { dist, player: d } : nearest;
    }, { dist: Infinity, player: null as NormalizedPlayerPosition | null });

    // Find goalkeeper
    const goalkeeper = defenders.find(d => d.position === 'GK') || null;
    const gkPosition = goalkeeper ?
      { x: goalkeeper.x, y: goalkeeper.y } :
      { x: 105, y: 0 };

    // Calculate preceding action
    const precedingAction = this.determinePrecedingAction(recentFrames);

    // Counter attack detection
    const isCounterAttack = this.detectCounterAttack(recentFrames);

    return {
      shotLocation: { x: shot.location.x, y: shot.location.y },
      distanceToGoal,
      angleToGoal,
      defendersInCone,
      nearestDefenderDistance: nearestDefender.dist,
      defenderPressure: nearestDefender.dist < 2 ? 1 : nearestDefender.dist < 5 ? 0.5 : 0,
      blockedAngle: defendersInCone * 0.1 * angleToGoal,
      goalkeeperPosition: gkPosition,
      goalkeeperCoverage: goalkeeper ? this.calculateGKCoverage(gkPosition, shot.location) : 0.5,
      goalkeeperReady: goalkeeper ? goalkeeper.speed < 1 : true,
      shooterSpeed: shooter?.speed || 0,
      shooterFacingGoal: true, // Would calculate from direction
      preferredFoot: true, // Would lookup player data
      fatigueLevel: shooter ? 100 - (shooter.cumulativeDistance / 120) : 0,
      precedingAction,
      passesInSequence: 3, // Would track from events
      secondsInPossession: 5, // Would track from events
      counterAttack: isCounterAttack,
      scoreDifferential: gameState.scoreDiff,
      minute: gameState.minute,
      homeAway: shot.actor.team,
    };
  }

  private calculateBaseXG(location: { x: number; y: number }): number {
    const distance = Math.sqrt(
      Math.pow(105 - location.x, 2) +
      Math.pow(location.y, 2)
    );
    const angle = this.calculateGoalAngle(location.x, location.y);

    // Logistic regression approximation
    const distanceFactor = Math.exp(-distance / 15);
    const angleFactor = angle / (Math.PI / 3);

    return Math.min(0.9, distanceFactor * angleFactor * 0.8);
  }

  private calculateGoalAngle(x: number, y: number): number {
    const goalWidth = 7.32;
    const leftPost = { x: 105, y: -goalWidth / 2 };
    const rightPost = { x: 105, y: goalWidth / 2 };

    const angleLeft = Math.atan2(leftPost.y - y, leftPost.x - x);
    const angleRight = Math.atan2(rightPost.y - y, rightPost.x - x);

    return Math.abs(angleRight - angleLeft);
  }

  private isInShootingCone(
    shooter: { x: number; y: number },
    defender: { x: number; y: number }
  ): boolean {
    // Check if defender is between shooter and goal
    if (defender.x <= shooter.x) return false;

    const goalCenter = { x: 105, y: 0 };
    const toGoal = { x: goalCenter.x - shooter.x, y: goalCenter.y - shooter.y };
    const toDefender = { x: defender.x - shooter.x, y: defender.y - shooter.y };

    const angle = Math.abs(
      Math.atan2(toGoal.y, toGoal.x) - Math.atan2(toDefender.y, toDefender.x)
    );

    return angle < Math.PI / 6; // 30 degree cone
  }

  private calculateGKCoverage(
    gkPos: { x: number; y: number },
    shooterPos: { x: number; y: number }
  ): number {
    const goalWidth = 7.32;
    const goalCenter = { x: 105, y: 0 };

    // How much of goal angle is covered by GK
    const gkDistFromCenter = Math.abs(gkPos.y - goalCenter.y);
    const optimalPosition = shooterPos.y * 0.3; // Should be offset towards shooter

    const positioningError = Math.abs(gkPos.y - optimalPosition);
    const coverage = 1 - Math.min(1, positioningError / (goalWidth / 2));

    return coverage;
  }

  private calculateDefenderImpact(context: ShotContext): number {
    let impact = 0;

    // Defenders in cone reduce xG
    impact -= context.defendersInCone * 0.1;

    // Close defender reduces xG
    if (context.nearestDefenderDistance < 2) {
      impact -= 0.3;
    } else if (context.nearestDefenderDistance < 5) {
      impact -= 0.15;
    }

    // Blocked angle
    impact -= context.blockedAngle * 0.5;

    return Math.max(-0.5, impact);
  }

  private calculateGoalkeeperImpact(context: ShotContext): number {
    let impact = 0;

    // Good coverage reduces xG
    impact -= context.goalkeeperCoverage * 0.2;

    // GK movement (not set) increases xG
    if (!context.goalkeeperReady) {
      impact += 0.1;
    }

    return impact;
  }

  private calculateBodyOrientationImpact(context: ShotContext): number {
    let impact = 0;

    // Facing goal increases xG
    if (context.shooterFacingGoal) {
      impact += 0.05;
    } else {
      impact -= 0.15;
    }

    // Preferred foot
    if (context.preferredFoot) {
      impact += 0.05;
    } else {
      impact -= 0.1;
    }

    return impact;
  }

  private calculatePrecedingActionImpact(context: ShotContext): number {
    let impact = 0;

    // Counter attacks have higher xG
    if (context.counterAttack) {
      impact += 0.15;
    }

    // Quick sequences
    if (context.secondsInPossession < 5) {
      impact += 0.1;
    }

    // Many passes might mean opponent is set
    if (context.passesInSequence > 8) {
      impact -= 0.05;
    }

    return impact;
  }

  private calculateGameStateImpact(context: ShotContext): number {
    let impact = 0;

    // Late game pressure
    if (context.minute > 80) {
      if (context.scoreDifferential < 0) {
        impact -= 0.1; // Chasing team takes worse shots
      }
    }

    return impact;
  }

  private calculateFatigueImpact(context: ShotContext): number {
    // Higher fatigue reduces quality
    const fatigueReduction = context.fatigueLevel / 100 * 0.15;
    return -fatigueReduction;
  }

  private determinePrecedingAction(frames: NormalizedTrackingFrame[]): string {
    if (frames.length < 2) return 'unknown';

    // Would analyze frames to determine action
    return 'pass';
  }

  private detectCounterAttack(frames: NormalizedTrackingFrame[]): boolean {
    if (frames.length < 10) return false;

    // Check for rapid territorial progression
    const startX = frames[0].ball.x;
    const endX = frames[frames.length - 1].ball.x;

    return endX - startX > 40;
  }

  // ==================== Expected Threat ====================

  calculateXT(
    startPos: { x: number; y: number },
    endPos: { x: number; y: number },
    actionType: 'pass' | 'carry' | 'dribble',
    context: { underPressure: boolean; fatigue: number }
  ): XTResult {
    const startZone = this.positionToZone(startPos.x, startPos.y);
    const endZone = this.positionToZone(endPos.x, endPos.y);

    const startThreat = this.getZoneThreat(startZone.x, startZone.y);
    const endThreat = this.getZoneThreat(endZone.x, endZone.y);

    // Adjust for context
    let adjustedEndThreat = endThreat;
    if (context.underPressure) {
      adjustedEndThreat *= 0.9;
    }
    if (context.fatigue > 70) {
      adjustedEndThreat *= 0.95;
    }

    const xTAdded = adjustedEndThreat - startThreat;

    return {
      startThreat,
      endThreat: adjustedEndThreat,
      xTAdded,
      zone: {
        from: `${startZone.x},${startZone.y}`,
        to: `${endZone.x},${endZone.y}`,
      },
      actionType,
      underPressure: context.underPressure,
      progressiveAction: xTAdded > 0,
      intoFinalThird: endPos.x > 70,
      confidence: 0.8,
    };
  }

  private positionToZone(x: number, y: number): { x: number; y: number } {
    const zoneX = Math.min(11, Math.floor(x / 105 * 12));
    const zoneY = Math.min(7, Math.floor((y + 34) / 68 * 8));
    return { x: zoneX, y: zoneY };
  }

  private getZoneThreat(zoneX: number, zoneY: number): number {
    if (zoneY < 0 || zoneY >= this.xtModel.threatGrid.length) return 0;
    if (zoneX < 0 || zoneX >= this.xtModel.threatGrid[0].length) return 0;
    return this.xtModel.threatGrid[zoneY][zoneX];
  }

  // ==================== Press Resistance ====================

  calculatePressResistance(
    playerId: string,
    actions: NormalizedEvent[],
    frames: NormalizedTrackingFrame[]
  ): PressResistanceResult {
    const playerActions = actions.filter(a => a.actor.playerId === playerId);

    // Calculate actions under pressure
    const actionsUnderPressure = playerActions.filter(a => a.context.pressure > 0.5);
    const successfulUnderPressure = actionsUnderPressure.filter(a => a.outcome === 'successful');

    const receiveUnderPressure = actionsUnderPressure.length > 0 ?
      successfulUnderPressure.length / actionsUnderPressure.length * 100 : 50;

    // Escape from pressure (successful carries/dribbles under pressure)
    const escapeActions = actionsUnderPressure.filter(a =>
      a.type === 'carry' || a.type === 'dribble'
    );
    const successfulEscapes = escapeActions.filter(a => a.outcome === 'successful');
    const escapeFromPressure = escapeActions.length > 0 ?
      successfulEscapes.length / escapeActions.length * 100 : 50;

    // Retain possession
    const possessionActions = playerActions.filter(a =>
      a.type === 'pass' || a.type === 'carry' || a.type === 'dribble'
    );
    const retainedPossession = possessionActions.filter(a => a.outcome === 'successful');
    const retainPossession = possessionActions.length > 0 ?
      retainedPossession.length / possessionActions.length * 100 : 50;

    // Progressive passing under pressure
    const progressivePassesUnderPressure = actionsUnderPressure.filter(a =>
      a.type === 'pass' && a.metrics.xT && a.metrics.xT > 0
    );
    const progressivePassing = actionsUnderPressure.length > 0 ?
      progressivePassesUnderPressure.length / actionsUnderPressure.length * 100 : 50;

    // Body orientation (placeholder)
    const bodyOrientation = 70;

    const overallScore = (
      receiveUnderPressure * 0.25 +
      escapeFromPressure * 0.25 +
      retainPossession * 0.2 +
      progressivePassing * 0.2 +
      bodyOrientation * 0.1
    );

    return {
      overallScore,
      receiveUnderPressure,
      escapeFromPressure,
      retainPossession,
      progressivePassing,
      bodyOrientation,
      pressureLevel: actionsUnderPressure.length / Math.max(1, playerActions.length),
      opponentsWithin5m: 2, // Would calculate from frames
      successfulActions: successfulUnderPressure.length,
      totalActions: actionsUnderPressure.length,
      positionPercentile: 75,
      leaguePercentile: 80,
    };
  }

  // ==================== Space Control ====================

  calculateSpaceControl(frame: NormalizedTrackingFrame): SpaceControlResult {
    const homeTeam = [...frame.players.values()].filter(p => p.team === 'home');
    const awayTeam = [...frame.players.values()].filter(p => p.team === 'away');

    // Calculate Voronoi-like control
    const gridResolution = 5; // 5 meter grid
    const gridX = Math.ceil(105 / gridResolution);
    const gridY = Math.ceil(68 / gridResolution);

    let homeControl = 0;
    let awayControl = 0;

    const zoneControl = new Map<string, number>();
    const playerContributions = new Map<string, PlayerSpaceContribution>();

    // Initialize player contributions
    [...homeTeam, ...awayTeam].forEach(p => {
      playerContributions.set(p.playerId, {
        playerId: p.playerId,
        controlledSpace: 0,
        influenceRadius: 0,
        movementImpact: 0,
        passingLanesCreated: 0,
      });
    });

    for (let i = 0; i < gridX; i++) {
      for (let j = 0; j < gridY; j++) {
        const pointX = i * gridResolution + gridResolution / 2;
        const pointY = j * gridResolution - 34 + gridResolution / 2;

        // Find nearest player from each team
        let nearestHome = Infinity;
        let nearestHomePlayerId: string | null = null;
        let nearestAway = Infinity;

        homeTeam.forEach(p => {
          const dist = Math.sqrt(Math.pow(p.x - pointX, 2) + Math.pow(p.y - pointY, 2));
          if (dist < nearestHome) {
            nearestHome = dist;
            nearestHomePlayerId = p.playerId;
          }
        });

        awayTeam.forEach(p => {
          const dist = Math.sqrt(Math.pow(p.x - pointX, 2) + Math.pow(p.y - pointY, 2));
          if (dist < nearestAway) nearestAway = dist;
        });

        // Control based on proximity
        const controlValue = gridResolution * gridResolution;
        if (nearestHome < nearestAway) {
          homeControl += controlValue;
          if (nearestHomePlayerId) {
            const contrib = playerContributions.get(nearestHomePlayerId);
            if (contrib) {
              contrib.controlledSpace += controlValue;
            }
          }
        } else {
          awayControl += controlValue;
        }
      }
    }

    const totalArea = 105 * 68;

    // Zone-specific control
    const zones = ['defensive_third', 'middle_third', 'attacking_third'];
    zones.forEach(zone => {
      zoneControl.set(zone, this.calculateZoneControl(frame, zone));
    });

    return {
      totalControlledSpace: homeControl,
      attackingThirdControl: zoneControl.get('attacking_third') || 0.5,
      centralCorridorControl: this.calculateCorridorControl(frame),
      halfSpaceControl: {
        left: this.calculateHalfSpaceControl(frame, 'left'),
        right: this.calculateHalfSpaceControl(frame, 'right'),
      },
      zoneControl,
      spaceCreation: homeControl / totalArea,
      spaceExploitation: 0.5, // Would calculate from movement
      compactionEfficiency: frame.teamShapes.home.compactness,
      playerContributions,
    };
  }

  private calculateZoneControl(frame: NormalizedTrackingFrame, zone: string): number {
    const [minX, maxX] = zone === 'defensive_third' ? [0, 35] :
                         zone === 'middle_third' ? [35, 70] : [70, 105];

    const homePlayers = [...frame.players.values()].filter(p =>
      p.team === 'home' && p.x >= minX && p.x < maxX
    );
    const awayPlayers = [...frame.players.values()].filter(p =>
      p.team === 'away' && p.x >= minX && p.x < maxX
    );

    const total = homePlayers.length + awayPlayers.length;
    return total > 0 ? homePlayers.length / total : 0.5;
  }

  private calculateCorridorControl(frame: NormalizedTrackingFrame): number {
    const corridorPlayers = [...frame.players.values()].filter(p =>
      Math.abs(p.y) < 15 // Central corridor
    );

    const homeCorridor = corridorPlayers.filter(p => p.team === 'home').length;
    const total = corridorPlayers.length;

    return total > 0 ? homeCorridor / total : 0.5;
  }

  private calculateHalfSpaceControl(frame: NormalizedTrackingFrame, side: 'left' | 'right'): number {
    const [minY, maxY] = side === 'left' ? [-25, -10] : [10, 25];

    const halfSpacePlayers = [...frame.players.values()].filter(p =>
      p.y >= minY && p.y <= maxY
    );

    const home = halfSpacePlayers.filter(p => p.team === 'home').length;
    const total = halfSpacePlayers.length;

    return total > 0 ? home / total : 0.5;
  }

  // ==================== Injury Risk Prediction ====================

  calculateInjuryRisk(
    playerId: string,
    currentMetrics: TrackingMetrics,
    historicalData: {
      weeklyLoads: number[];
      recentSprints: number[];
      previousInjuries: { type: string; daysAgo: number }[];
    },
    tacticalDemands: {
      positionDemand: number;
      coverageArea: number;
      pressingIntensity: number;
    }
  ): InjuryRiskResult {
    // Workload risk
    const acuteLoad = currentMetrics.playerLoad;
    const chronicLoad = historicalData.weeklyLoads.reduce((a, b) => a + b, 0) /
                        Math.max(1, historicalData.weeklyLoads.length);
    const acuteChronicRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1;

    const workloadRisk: WorkloadRisk = {
      acuteLoad,
      chronicLoad,
      acuteChronicRatio,
      weeklyChange: historicalData.weeklyLoads.length > 1 ?
        (historicalData.weeklyLoads[0] - historicalData.weeklyLoads[1]) / historicalData.weeklyLoads[1] : 0,
      riskScore: acuteChronicRatio > this.injuryConfig.acuteChronicRatio ? 0.7 : 0.3,
    };

    // Biomechanics risk (simplified)
    const biomechanicsRisk: BiomechanicsRisk = {
      asymmetryScore: 0.1,
      movementQuality: 0.8,
      accelerationProfile: currentMetrics.maxAcceleration > this.injuryConfig.accelerationThreshold ? 0.6 : 0.3,
      decelerationProfile: Math.abs(currentMetrics.maxDeceleration) > Math.abs(this.injuryConfig.decelerationThreshold) ? 0.6 : 0.3,
      riskScore: 0.4,
    };

    // Fatigue risk
    const fatigueRisk: FatigueRisk = {
      centralFatigue: currentMetrics.playerLoad / 1000,
      peripheralFatigue: currentMetrics.sprintDistance / currentMetrics.totalDistance,
      metabolicFatigue: currentMetrics.highMetabolicLoadDistance / currentMetrics.totalDistance,
      cognitiveLoad: 0.5,
      riskScore: Math.min(1, currentMetrics.playerLoad / 800),
    };

    // Tactical overload risk
    const tacticalOverloadRisk: TacticalOverloadRisk = {
      positionDemand: tacticalDemands.positionDemand,
      coverageArea: tacticalDemands.coverageArea,
      sprintDemand: currentMetrics.sprintDistance / 500,
      pressingDemand: tacticalDemands.pressingIntensity,
      recoveryRunDemand: 0.5,
      riskScore: (tacticalDemands.positionDemand + tacticalDemands.pressingIntensity) / 2,
    };

    // Overall risk calculation
    const overallRisk = (
      workloadRisk.riskScore * this.injuryConfig.workloadWeight +
      biomechanicsRisk.riskScore * this.injuryConfig.biomechanicsWeight +
      fatigueRisk.riskScore * this.injuryConfig.fatigueWeight +
      tacticalOverloadRisk.riskScore * this.injuryConfig.historyWeight
    );

    const riskCategory = overallRisk < 0.2 ? 'minimal' :
                         overallRisk < 0.4 ? 'low' :
                         overallRisk < 0.6 ? 'moderate' :
                         overallRisk < 0.8 ? 'high' : 'critical';

    // Specific injury risks
    const hamstringRisk = this.calculateHamstringRisk(currentMetrics, historicalData);
    const ankleRisk = this.calculateAnkleRisk(currentMetrics);
    const kneeRisk = this.calculateKneeRisk(currentMetrics, historicalData);
    const muscleRisk = fatigueRisk.peripheralFatigue;

    // Recommendations
    const recommendations = this.generateInjuryRecommendations(
      overallRisk,
      workloadRisk,
      fatigueRisk,
      tacticalOverloadRisk
    );

    return {
      overallRisk,
      riskCategory,
      workloadRisk,
      biomechanicsRisk,
      fatigueRisk,
      tacticalOverloadRisk,
      hamstringRisk,
      ankleRisk,
      kneeRisk,
      muscleRisk,
      recommendations,
      estimatedTimeToRisk: overallRisk > 0.6 ? 15 : overallRisk > 0.4 ? 30 : 60,
    };
  }

  private calculateHamstringRisk(
    metrics: TrackingMetrics,
    history: { previousInjuries: { type: string; daysAgo: number }[] }
  ): number {
    let risk = 0;

    // Sprint load
    risk += metrics.sprintDistance / 500 * 0.3;

    // Previous hamstring injuries
    const hamstringHistory = history.previousInjuries.filter(i =>
      i.type.toLowerCase().includes('hamstring')
    );
    if (hamstringHistory.length > 0) {
      const mostRecent = Math.min(...hamstringHistory.map(h => h.daysAgo));
      if (mostRecent < 90) risk += 0.3;
      else if (mostRecent < 180) risk += 0.15;
    }

    // High-speed running
    risk += metrics.highSpeedRunningDistance / 1000 * 0.2;

    return Math.min(1, risk);
  }

  private calculateAnkleRisk(metrics: TrackingMetrics): number {
    // Based on acceleration/deceleration load
    return Math.min(1, (
      metrics.accelerations.high / 50 * 0.5 +
      metrics.decelerations.high / 50 * 0.5
    ));
  }

  private calculateKneeRisk(
    metrics: TrackingMetrics,
    history: { previousInjuries: { type: string; daysAgo: number }[] }
  ): number {
    let risk = 0;

    // Deceleration load
    risk += metrics.decelerations.high / 50 * 0.4;

    // Previous knee injuries
    const kneeHistory = history.previousInjuries.filter(i =>
      i.type.toLowerCase().includes('knee') || i.type.toLowerCase().includes('acl')
    );
    if (kneeHistory.length > 0) {
      risk += 0.3;
    }

    return Math.min(1, risk);
  }

  private generateInjuryRecommendations(
    overall: number,
    workload: WorkloadRisk,
    fatigue: FatigueRisk,
    tactical: TacticalOverloadRisk
  ): InjuryPrevention[] {
    const recommendations: InjuryPrevention[] = [];

    if (workload.acuteChronicRatio > 1.3) {
      recommendations.push({
        action: 'Reduce training load by 20%',
        urgency: 'soon',
        expectedRiskReduction: 0.15,
      });
    }

    if (fatigue.riskScore > 0.6) {
      recommendations.push({
        action: 'Consider substitution',
        urgency: 'immediate',
        expectedRiskReduction: 0.25,
      });
    }

    if (tactical.pressingDemand > 0.7) {
      recommendations.push({
        action: 'Reduce pressing intensity requirements',
        urgency: 'soon',
        expectedRiskReduction: 0.1,
        sideEffects: ['May reduce pressing effectiveness'],
      });
    }

    if (overall > 0.7) {
      recommendations.push({
        action: 'Immediate physiotherapy assessment',
        urgency: 'immediate',
        expectedRiskReduction: 0.2,
      });
    }

    return recommendations;
  }

  // ==================== Passing Network ====================

  calculatePassingNetwork(
    events: NormalizedEvent[],
    teamFilter: 'home' | 'away'
  ): PassingNetworkResult {
    const passes = events.filter(e =>
      e.type === 'pass' && e.actor.team === teamFilter
    );

    // Build adjacency matrix
    const players = [...new Set(passes.map(p => p.actor.playerId))];
    const matrix: Map<string, Map<string, number>> = new Map();

    players.forEach(p => matrix.set(p, new Map()));

    passes.forEach(pass => {
      if (pass.outcome === 'successful') {
        const from = pass.actor.playerId;
        // Would need to track recipient
        const to = 'recipient'; // Placeholder

        const current = matrix.get(from)?.get(to) || 0;
        matrix.get(from)?.set(to, current + 1);
      }
    });

    // Calculate network metrics
    const totalConnections = players.length * (players.length - 1);
    const actualConnections = [...matrix.values()].reduce((sum, m) =>
      sum + [...m.values()].filter(v => v > 0).length, 0
    );
    const density = actualConnections / totalConnections;

    // Player metrics
    const playerMetrics = new Map<string, PlayerNetworkMetrics>();
    players.forEach(p => {
      const outgoing = matrix.get(p)?.size || 0;
      const incoming = [...matrix.values()].filter(m => m.has(p)).length;

      playerMetrics.set(p, {
        playerId: p,
        degree: outgoing + incoming,
        betweenness: 0.5, // Would calculate properly
        closeness: 0.5,
        pageRank: 1 / players.length,
        passingVolume: passes.filter(pa => pa.actor.playerId === p).length,
        receivingVolume: 0, // Would need recipient tracking
      });
    });

    // Identify hub players (high degree)
    const sortedByDegree = [...playerMetrics.entries()]
      .sort((a, b) => b[1].degree - a[1].degree);
    const hubPlayers = sortedByDegree.slice(0, 3).map(([id]) => id);

    return {
      density,
      centralization: 0.5, // Would calculate
      clustering: 0.5,
      avgPathLength: 2,
      hubPlayers,
      bridgePlayers: [],
      peripheralPlayers: [],
      dominantPatterns: [],
      progressivePassPercentage: passes.filter(p =>
        p.metrics.xT && p.metrics.xT > 0
      ).length / passes.length * 100,
      backPassPercentage: 20, // Would calculate
      playerMetrics,
      connectionStrength: new Map(),
      preferredConnections: [],
    };
  }
}

// Export singleton instance
export const advancedMetrics = new AdvancedMetricsEngine();
