/**
 * MULTI-AGENT SYSTEM
 * Agent-based modeling for off-ball movement with boid algorithms
 * Includes genetic algorithm evolution and Gegenpressing simulation
 */

import { Vector2D, Vector } from './physics-engine';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AgentState {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  role: PlayerRole;
  team: 'home' | 'away';
  hasBall: boolean;
  stamina: number;
  awareness: number;           // How well they read the game (0-100)
}

export type PlayerRole =
  | 'goalkeeper'
  | 'center_back'
  | 'fullback'
  | 'defensive_mid'
  | 'central_mid'
  | 'attacking_mid'
  | 'winger'
  | 'striker';

export interface AgentBehavior {
  separation: number;          // Avoid crowding teammates (0-1)
  alignment: number;           // Match velocity of nearby teammates (0-1)
  cohesion: number;            // Move toward center of teammates (0-1)
  seekBall: number;            // Attraction to ball (0-1)
  seekSpace: number;           // Find open space (0-1)
  markOpponent: number;        // Track opponent movement (0-1)
  maintainShape: number;       // Stay in formation position (0-1)
  pressCarrier: number;        // Press ball carrier (0-1)
  coverShadow: number;         // Block passing lanes (0-1)
  makeRun: number;             // Make attacking runs (0-1)
}

export interface TacticalInstruction {
  type: 'press' | 'drop' | 'hold' | 'run' | 'cover' | 'mark' | 'create_space';
  target?: Vector2D | string;  // Position or player ID
  intensity: number;           // 0-1
  duration: number;            // seconds
}

export interface FormationPosition {
  role: PlayerRole;
  basePosition: Vector2D;      // In defensive shape
  attackingPosition: Vector2D; // In attacking shape
  pressingPosition: Vector2D;  // In pressing trigger
}

export interface GeneticTraits {
  pressingSensitivity: number;
  spaceRecognition: number;
  runTiming: number;
  defensiveAwareness: number;
  offensiveCreativity: number;
  teamworkOrientation: number;
  riskTolerance: number;
  adaptability: number;
}

// ============================================================================
// BOID SYSTEM FOR PLAYER MOVEMENT
// ============================================================================

export class BoidSystem {
  private readonly SEPARATION_RADIUS = 8;      // meters
  private readonly ALIGNMENT_RADIUS = 15;
  private readonly COHESION_RADIUS = 25;
  private readonly MAX_SPEED = 8;              // m/s
  private readonly MAX_FORCE = 5;              // m/s²

  calculateForces(
    agent: AgentState,
    teammates: AgentState[],
    opponents: AgentState[],
    ball: Vector2D,
    behavior: AgentBehavior,
    formation: FormationPosition
  ): Vector2D {
    const forces: Vector2D[] = [];

    // Separation - avoid crowding teammates
    if (behavior.separation > 0) {
      const separationForce = this.calculateSeparation(agent, teammates);
      forces.push(Vector.multiply(separationForce, behavior.separation * 2));
    }

    // Alignment - match velocity of nearby teammates
    if (behavior.alignment > 0) {
      const alignmentForce = this.calculateAlignment(agent, teammates);
      forces.push(Vector.multiply(alignmentForce, behavior.alignment));
    }

    // Cohesion - move toward center of nearby teammates
    if (behavior.cohesion > 0) {
      const cohesionForce = this.calculateCohesion(agent, teammates);
      forces.push(Vector.multiply(cohesionForce, behavior.cohesion * 0.5));
    }

    // Seek ball
    if (behavior.seekBall > 0 && !agent.hasBall) {
      const seekForce = this.seek(agent, ball);
      forces.push(Vector.multiply(seekForce, behavior.seekBall * 1.5));
    }

    // Seek space
    if (behavior.seekSpace > 0) {
      const spaceForce = this.findSpace(agent, teammates, opponents);
      forces.push(Vector.multiply(spaceForce, behavior.seekSpace * 1.2));
    }

    // Mark opponent
    if (behavior.markOpponent > 0) {
      const markForce = this.calculateMarking(agent, opponents, ball);
      forces.push(Vector.multiply(markForce, behavior.markOpponent * 1.5));
    }

    // Maintain formation shape
    if (behavior.maintainShape > 0) {
      const shapeForce = this.maintainFormation(agent, formation, ball);
      forces.push(Vector.multiply(shapeForce, behavior.maintainShape));
    }

    // Press ball carrier
    if (behavior.pressCarrier > 0) {
      const pressForce = this.calculatePressing(agent, opponents, ball);
      forces.push(Vector.multiply(pressForce, behavior.pressCarrier * 2));
    }

    // Cover shadow - block passing lanes
    if (behavior.coverShadow > 0) {
      const shadowForce = this.calculateCoverShadow(agent, opponents, ball);
      forces.push(Vector.multiply(shadowForce, behavior.coverShadow * 1.3));
    }

    // Make attacking run
    if (behavior.makeRun > 0 && agent.team === this.getTeamWithBall(teammates, opponents)) {
      const runForce = this.calculateAttackingRun(agent, teammates, opponents, ball);
      forces.push(Vector.multiply(runForce, behavior.makeRun * 1.5));
    }

    // Sum all forces
    let totalForce: Vector2D = { x: 0, y: 0 };
    for (const force of forces) {
      totalForce = Vector.add(totalForce, force);
    }

    // Limit force
    const forceMag = Vector.magnitude(totalForce);
    if (forceMag > this.MAX_FORCE) {
      totalForce = Vector.multiply(Vector.normalize(totalForce), this.MAX_FORCE);
    }

    return totalForce;
  }

  private calculateSeparation(agent: AgentState, teammates: AgentState[]): Vector2D {
    let steering: Vector2D = { x: 0, y: 0 };
    let count = 0;

    for (const other of teammates) {
      if (other.id === agent.id) continue;

      const distance = Vector.distance(agent.position, other.position);
      if (distance < this.SEPARATION_RADIUS && distance > 0) {
        let diff = Vector.subtract(agent.position, other.position);
        diff = Vector.normalize(diff);
        diff = Vector.multiply(diff, 1 / distance);  // Weight by distance
        steering = Vector.add(steering, diff);
        count++;
      }
    }

    if (count > 0) {
      steering = Vector.multiply(steering, 1 / count);
    }

    return steering;
  }

  private calculateAlignment(agent: AgentState, teammates: AgentState[]): Vector2D {
    let avgVelocity: Vector2D = { x: 0, y: 0 };
    let count = 0;

    for (const other of teammates) {
      if (other.id === agent.id) continue;

      const distance = Vector.distance(agent.position, other.position);
      if (distance < this.ALIGNMENT_RADIUS) {
        avgVelocity = Vector.add(avgVelocity, other.velocity);
        count++;
      }
    }

    if (count > 0) {
      avgVelocity = Vector.multiply(avgVelocity, 1 / count);
      return Vector.subtract(avgVelocity, agent.velocity);
    }

    return { x: 0, y: 0 };
  }

  private calculateCohesion(agent: AgentState, teammates: AgentState[]): Vector2D {
    let centerOfMass: Vector2D = { x: 0, y: 0 };
    let count = 0;

    for (const other of teammates) {
      if (other.id === agent.id) continue;

      const distance = Vector.distance(agent.position, other.position);
      if (distance < this.COHESION_RADIUS) {
        centerOfMass = Vector.add(centerOfMass, other.position);
        count++;
      }
    }

    if (count > 0) {
      centerOfMass = Vector.multiply(centerOfMass, 1 / count);
      return this.seek(agent, centerOfMass);
    }

    return { x: 0, y: 0 };
  }

  private seek(agent: AgentState, target: Vector2D): Vector2D {
    const desired = Vector.subtract(target, agent.position);
    const desiredNorm = Vector.normalize(desired);
    const desiredVelocity = Vector.multiply(desiredNorm, this.MAX_SPEED);
    return Vector.subtract(desiredVelocity, agent.velocity);
  }

  private findSpace(
    agent: AgentState,
    teammates: AgentState[],
    opponents: AgentState[]
  ): Vector2D {
    // Sample nearby positions and find the one with most space
    const samplePoints: Vector2D[] = [];
    const radius = 15;
    const numSamples = 8;

    for (let i = 0; i < numSamples; i++) {
      const angle = (i / numSamples) * Math.PI * 2;
      samplePoints.push({
        x: agent.position.x + Math.cos(angle) * radius,
        y: agent.position.y + Math.sin(angle) * radius
      });
    }

    let bestPoint = agent.position;
    let bestScore = 0;

    for (const point of samplePoints) {
      // Skip if out of bounds
      if (point.x < 0 || point.x > 105 || point.y < 0 || point.y > 68) continue;

      let score = 0;

      // Distance from opponents
      for (const opp of opponents) {
        const dist = Vector.distance(point, opp.position);
        score += Math.min(dist, 20);
      }

      // Not too far from teammates (passing options)
      let hasPassingOption = false;
      for (const tm of teammates) {
        if (tm.id === agent.id) continue;
        const dist = Vector.distance(point, tm.position);
        if (dist > 10 && dist < 30) hasPassingOption = true;
      }
      if (hasPassingOption) score += 10;

      if (score > bestScore) {
        bestScore = score;
        bestPoint = point;
      }
    }

    return this.seek(agent, bestPoint);
  }

  private calculateMarking(
    agent: AgentState,
    opponents: AgentState[],
    ball: Vector2D
  ): Vector2D {
    // Find nearest opponent in zone
    let nearestOpponent: AgentState | null = null;
    let nearestDist = Infinity;

    const markingRange = this.getMarkingRange(agent.role);

    for (const opp of opponents) {
      // Don't mark goalkeeper
      if (opp.role === 'goalkeeper') continue;

      const dist = Vector.distance(agent.position, opp.position);
      if (dist < markingRange && dist < nearestDist) {
        nearestDist = dist;
        nearestOpponent = opp;
      }
    }

    if (nearestOpponent) {
      // Position between opponent and ball
      const toBall = Vector.subtract(ball, nearestOpponent.position);
      const toBallNorm = Vector.normalize(toBall);
      const markingPos = Vector.add(
        nearestOpponent.position,
        Vector.multiply(toBallNorm, 2)
      );
      return this.seek(agent, markingPos);
    }

    return { x: 0, y: 0 };
  }

  private getMarkingRange(role: PlayerRole): number {
    const ranges: Record<PlayerRole, number> = {
      goalkeeper: 10,
      center_back: 20,
      fullback: 25,
      defensive_mid: 25,
      central_mid: 30,
      attacking_mid: 30,
      winger: 25,
      striker: 20
    };
    return ranges[role];
  }

  private maintainFormation(
    agent: AgentState,
    formation: FormationPosition,
    ball: Vector2D
  ): Vector2D {
    // Interpolate between defensive and attacking position based on ball
    const ballProgress = ball.x / 105;  // 0-1 (defensive to attacking)
    const targetPos = Vector.lerp(
      formation.basePosition,
      formation.attackingPosition,
      ballProgress
    );

    return this.seek(agent, targetPos);
  }

  private calculatePressing(
    agent: AgentState,
    opponents: AgentState[],
    ball: Vector2D
  ): Vector2D {
    // Find ball carrier
    const carrier = opponents.find(o => o.hasBall);
    if (!carrier) return { x: 0, y: 0 };

    // Only nearby players should press
    const distToCarrier = Vector.distance(agent.position, carrier.position);
    if (distToCarrier > 15) return { x: 0, y: 0 };

    // Press toward ball but cut off escape routes
    const carrierVelocity = carrier.velocity;
    const predictedPos = Vector.add(
      carrier.position,
      Vector.multiply(carrierVelocity, 0.5)
    );

    return this.seek(agent, predictedPos);
  }

  private calculateCoverShadow(
    agent: AgentState,
    opponents: AgentState[],
    ball: Vector2D
  ): Vector2D {
    // Position to block passing lanes
    const carrier = opponents.find(o => o.hasBall);
    if (!carrier) return { x: 0, y: 0 };

    // Find potential passing targets
    const passingTargets = opponents.filter(o => {
      if (o.hasBall) return false;
      const dist = Vector.distance(carrier.position, o.position);
      return dist > 5 && dist < 30;
    });

    if (passingTargets.length === 0) return { x: 0, y: 0 };

    // Find the passing lane we can best cover
    let bestTarget: Vector2D | null = null;
    let bestScore = Infinity;

    for (const target of passingTargets) {
      // Point on passing lane closest to us
      const laneVector = Vector.subtract(target.position, carrier.position);
      const toAgent = Vector.subtract(agent.position, carrier.position);
      const t = Math.max(0, Math.min(1, Vector.dot(toAgent, laneVector) / Vector.dot(laneVector, laneVector)));
      const closestPoint = Vector.add(carrier.position, Vector.multiply(laneVector, t));

      const distToLane = Vector.distance(agent.position, closestPoint);
      if (distToLane < bestScore) {
        bestScore = distToLane;
        bestTarget = closestPoint;
      }
    }

    if (bestTarget && bestScore < 15) {
      return this.seek(agent, bestTarget);
    }

    return { x: 0, y: 0 };
  }

  private calculateAttackingRun(
    agent: AgentState,
    teammates: AgentState[],
    opponents: AgentState[],
    ball: Vector2D
  ): Vector2D {
    // Only attackers and midfielders make runs
    const runningRoles: PlayerRole[] = ['striker', 'winger', 'attacking_mid', 'central_mid'];
    if (!runningRoles.includes(agent.role)) return { x: 0, y: 0 };

    // Don't run if we have the ball
    if (agent.hasBall) return { x: 0, y: 0 };

    // Find ball carrier
    const carrier = teammates.find(t => t.hasBall);
    if (!carrier) return { x: 0, y: 0 };

    // Calculate run target
    let runTarget: Vector2D;

    if (agent.role === 'striker') {
      // Run behind defense
      const defenderLine = Math.max(...opponents
        .filter(o => o.role === 'center_back' || o.role === 'fullback')
        .map(o => o.position.x));

      runTarget = {
        x: Math.min(100, defenderLine + 5),
        y: agent.position.y + (Math.random() - 0.5) * 10
      };
    } else if (agent.role === 'winger') {
      // Run into channel
      const isLeft = agent.position.y < 34;
      runTarget = {
        x: Math.min(95, ball.x + 15),
        y: isLeft ? 15 : 53
      };
    } else {
      // Run into space
      runTarget = {
        x: Math.min(90, ball.x + 10),
        y: agent.position.y
      };
    }

    // Only run if there's space
    const nearestOpp = opponents.reduce((nearest, opp) => {
      const dist = Vector.distance(runTarget, opp.position);
      return dist < nearest.dist ? { opp, dist } : nearest;
    }, { opp: opponents[0], dist: Infinity });

    if (nearestOpp.dist > 5) {
      return this.seek(agent, runTarget);
    }

    return { x: 0, y: 0 };
  }

  private getTeamWithBall(teammates: AgentState[], opponents: AgentState[]): 'home' | 'away' {
    const carrierTeammate = teammates.find(t => t.hasBall);
    if (carrierTeammate) return carrierTeammate.team;

    const carrierOpponent = opponents.find(o => o.hasBall);
    if (carrierOpponent) return carrierOpponent.team;

    return 'home';
  }

  updateAgent(agent: AgentState, force: Vector2D, deltaTime: number): AgentState {
    // Update velocity
    const newVelocity = Vector.add(agent.velocity, Vector.multiply(force, deltaTime));

    // Limit speed
    const speed = Vector.magnitude(newVelocity);
    const maxSpeed = this.MAX_SPEED * (agent.stamina / 100);

    let finalVelocity = newVelocity;
    if (speed > maxSpeed) {
      finalVelocity = Vector.multiply(Vector.normalize(newVelocity), maxSpeed);
    }

    // Update position
    const newPosition = Vector.add(
      agent.position,
      Vector.multiply(finalVelocity, deltaTime)
    );

    // Clamp to pitch bounds
    const clampedPosition = {
      x: Math.max(0, Math.min(105, newPosition.x)),
      y: Math.max(0, Math.min(68, newPosition.y))
    };

    return {
      ...agent,
      position: clampedPosition,
      velocity: finalVelocity
    };
  }
}

// ============================================================================
// GEGENPRESSING SYSTEM
// ============================================================================

export interface GegenpressConfig {
  triggerZone: number;         // Distance from ball loss to trigger (meters)
  pressingDuration: number;    // Max seconds to press
  minPlayersInvolved: number;  // Minimum players who must press
  recoveryTarget: number;      // Target seconds to recover ball
  intensityThreshold: number;  // Stamina threshold to maintain press
}

export class GegenpressingSystem {
  private config: GegenpressConfig;
  private isActive: boolean = false;
  private pressStartTime: number = 0;
  private pressStartPosition: Vector2D | null = null;

  constructor(config: Partial<GegenpressConfig> = {}) {
    this.config = {
      triggerZone: 20,
      pressingDuration: 6,
      minPlayersInvolved: 4,
      recoveryTarget: 4,
      intensityThreshold: 40,
      ...config
    };
  }

  shouldTriggerPress(
    ballLossPosition: Vector2D,
    currentBallPosition: Vector2D,
    teamPositions: AgentState[],
    timeSinceLoss: number
  ): boolean {
    // Check if ball is still in trigger zone
    const distance = Vector.distance(ballLossPosition, currentBallPosition);
    if (distance > this.config.triggerZone) return false;

    // Check time
    if (timeSinceLoss > this.config.pressingDuration) return false;

    // Check how many players can press
    const playersInRange = teamPositions.filter(p => {
      const distToBall = Vector.distance(p.position, currentBallPosition);
      return distToBall < this.config.triggerZone && p.stamina > this.config.intensityThreshold;
    });

    return playersInRange.length >= this.config.minPlayersInvolved;
  }

  getPressingBehaviors(
    agents: AgentState[],
    ball: Vector2D,
    opponents: AgentState[]
  ): Map<string, AgentBehavior> {
    const behaviors = new Map<string, AgentBehavior>();
    const carrier = opponents.find(o => o.hasBall);

    if (!carrier) {
      // No carrier - spread out
      for (const agent of agents) {
        behaviors.set(agent.id, this.getDefaultBehavior(agent.role));
      }
      return behaviors;
    }

    // Find nearest players to carrier
    const sortedByDistance = [...agents].sort((a, b) => {
      const distA = Vector.distance(a.position, carrier.position);
      const distB = Vector.distance(b.position, carrier.position);
      return distA - distB;
    });

    // Assign pressing roles
    for (let i = 0; i < agents.length; i++) {
      const agent = sortedByDistance[i];
      const distToCarrier = Vector.distance(agent.position, carrier.position);

      if (i === 0) {
        // First presser - direct pressure
        behaviors.set(agent.id, {
          separation: 0.3,
          alignment: 0.1,
          cohesion: 0.1,
          seekBall: 0.1,
          seekSpace: 0,
          markOpponent: 0,
          maintainShape: 0.1,
          pressCarrier: 1.0,
          coverShadow: 0.2,
          makeRun: 0
        });
      } else if (i < 3 && distToCarrier < 15) {
        // Support pressers - cover passing lanes
        behaviors.set(agent.id, {
          separation: 0.4,
          alignment: 0.2,
          cohesion: 0.2,
          seekBall: 0.2,
          seekSpace: 0,
          markOpponent: 0.3,
          maintainShape: 0.2,
          pressCarrier: 0.5,
          coverShadow: 0.8,
          makeRun: 0
        });
      } else if (i < 5) {
        // Secondary cover
        behaviors.set(agent.id, {
          separation: 0.5,
          alignment: 0.3,
          cohesion: 0.3,
          seekBall: 0.1,
          seekSpace: 0.1,
          markOpponent: 0.5,
          maintainShape: 0.4,
          pressCarrier: 0.2,
          coverShadow: 0.6,
          makeRun: 0
        });
      } else {
        // Holding position - maintain shape
        behaviors.set(agent.id, {
          separation: 0.5,
          alignment: 0.4,
          cohesion: 0.4,
          seekBall: 0,
          seekSpace: 0.2,
          markOpponent: 0.6,
          maintainShape: 0.7,
          pressCarrier: 0,
          coverShadow: 0.4,
          makeRun: 0
        });
      }
    }

    return behaviors;
  }

  private getDefaultBehavior(role: PlayerRole): AgentBehavior {
    const defaults: Record<PlayerRole, AgentBehavior> = {
      goalkeeper: {
        separation: 0.2, alignment: 0, cohesion: 0, seekBall: 0.1,
        seekSpace: 0, markOpponent: 0, maintainShape: 1.0,
        pressCarrier: 0, coverShadow: 0, makeRun: 0
      },
      center_back: {
        separation: 0.6, alignment: 0.4, cohesion: 0.3, seekBall: 0.1,
        seekSpace: 0.1, markOpponent: 0.7, maintainShape: 0.8,
        pressCarrier: 0.1, coverShadow: 0.5, makeRun: 0
      },
      fullback: {
        separation: 0.5, alignment: 0.4, cohesion: 0.3, seekBall: 0.2,
        seekSpace: 0.3, markOpponent: 0.6, maintainShape: 0.6,
        pressCarrier: 0.2, coverShadow: 0.4, makeRun: 0.3
      },
      defensive_mid: {
        separation: 0.5, alignment: 0.5, cohesion: 0.4, seekBall: 0.3,
        seekSpace: 0.3, markOpponent: 0.6, maintainShape: 0.6,
        pressCarrier: 0.4, coverShadow: 0.6, makeRun: 0.1
      },
      central_mid: {
        separation: 0.5, alignment: 0.5, cohesion: 0.5, seekBall: 0.4,
        seekSpace: 0.5, markOpponent: 0.4, maintainShape: 0.5,
        pressCarrier: 0.4, coverShadow: 0.4, makeRun: 0.4
      },
      attacking_mid: {
        separation: 0.4, alignment: 0.4, cohesion: 0.4, seekBall: 0.5,
        seekSpace: 0.6, markOpponent: 0.2, maintainShape: 0.4,
        pressCarrier: 0.5, coverShadow: 0.3, makeRun: 0.6
      },
      winger: {
        separation: 0.4, alignment: 0.3, cohesion: 0.3, seekBall: 0.4,
        seekSpace: 0.7, markOpponent: 0.2, maintainShape: 0.4,
        pressCarrier: 0.4, coverShadow: 0.2, makeRun: 0.7
      },
      striker: {
        separation: 0.3, alignment: 0.2, cohesion: 0.2, seekBall: 0.5,
        seekSpace: 0.6, markOpponent: 0.1, maintainShape: 0.3,
        pressCarrier: 0.6, coverShadow: 0.2, makeRun: 0.8
      }
    };

    return defaults[role];
  }

  evaluatePressingSuccess(
    ballRecovered: boolean,
    timeTaken: number,
    dangerCreated: boolean
  ): { success: boolean; rating: number; feedback: string } {
    if (ballRecovered && timeTaken <= this.config.recoveryTarget) {
      return {
        success: true,
        rating: 1.0 - (timeTaken / this.config.recoveryTarget) * 0.3,
        feedback: 'Excellent counter-press! Ball recovered quickly.'
      };
    } else if (ballRecovered) {
      return {
        success: true,
        rating: 0.6,
        feedback: 'Ball recovered but took longer than target.'
      };
    } else if (dangerCreated) {
      return {
        success: false,
        rating: 0.3,
        feedback: 'Press bypassed but forced poor ball forward.'
      };
    } else {
      return {
        success: false,
        rating: 0.1,
        feedback: 'Press failed. Opposition played through.'
      };
    }
  }
}

// ============================================================================
// GENETIC ALGORITHM FOR TACTICAL EVOLUTION
// ============================================================================

export class TacticalGeneticAlgorithm {
  private populationSize: number;
  private mutationRate: number;
  private crossoverRate: number;
  private eliteCount: number;
  private generation: number = 0;

  constructor(
    populationSize: number = 20,
    mutationRate: number = 0.1,
    crossoverRate: number = 0.7,
    eliteCount: number = 2
  ) {
    this.populationSize = populationSize;
    this.mutationRate = mutationRate;
    this.crossoverRate = crossoverRate;
    this.eliteCount = eliteCount;
  }

  createRandomTraits(): GeneticTraits {
    return {
      pressingSensitivity: Math.random(),
      spaceRecognition: Math.random(),
      runTiming: Math.random(),
      defensiveAwareness: Math.random(),
      offensiveCreativity: Math.random(),
      teamworkOrientation: Math.random(),
      riskTolerance: Math.random(),
      adaptability: Math.random()
    };
  }

  createInitialPopulation(): GeneticTraits[] {
    const population: GeneticTraits[] = [];
    for (let i = 0; i < this.populationSize; i++) {
      population.push(this.createRandomTraits());
    }
    return population;
  }

  evaluateFitness(
    traits: GeneticTraits,
    matchResults: {
      goalsScored: number;
      goalsConceded: number;
      possession: number;
      xGFor: number;
      xGAgainst: number;
      pressSuccessRate: number;
    }
  ): number {
    // Multi-objective fitness function
    let fitness = 0;

    // Offensive success
    fitness += matchResults.goalsScored * 10;
    fitness += matchResults.xGFor * 5;
    fitness += (matchResults.possession - 50) * 0.1;

    // Defensive success
    fitness -= matchResults.goalsConceded * 8;
    fitness -= matchResults.xGAgainst * 4;

    // Pressing effectiveness
    fitness += matchResults.pressSuccessRate * 15;

    // Trait-specific bonuses
    if (traits.pressingSensitivity > 0.7 && matchResults.pressSuccessRate > 0.5) {
      fitness += 5;  // Reward high pressing when successful
    }

    if (traits.offensiveCreativity > 0.6 && matchResults.xGFor > 1.5) {
      fitness += 5;  // Reward creativity when generating chances
    }

    if (traits.defensiveAwareness > 0.6 && matchResults.xGAgainst < 1) {
      fitness += 5;  // Reward defensive awareness when limiting chances
    }

    return Math.max(0, fitness);
  }

  selectParents(population: GeneticTraits[], fitnesses: number[]): [GeneticTraits, GeneticTraits] {
    // Tournament selection
    const tournamentSize = 3;

    const selectOne = (): GeneticTraits => {
      let best: { traits: GeneticTraits; fitness: number } | null = null;

      for (let i = 0; i < tournamentSize; i++) {
        const idx = Math.floor(Math.random() * population.length);
        if (!best || fitnesses[idx] > best.fitness) {
          best = { traits: population[idx], fitness: fitnesses[idx] };
        }
      }

      return best!.traits;
    };

    return [selectOne(), selectOne()];
  }

  crossover(parent1: GeneticTraits, parent2: GeneticTraits): [GeneticTraits, GeneticTraits] {
    if (Math.random() > this.crossoverRate) {
      return [{ ...parent1 }, { ...parent2 }];
    }

    // Uniform crossover
    const child1: GeneticTraits = { ...parent1 };
    const child2: GeneticTraits = { ...parent2 };

    const keys = Object.keys(parent1) as (keyof GeneticTraits)[];
    for (const key of keys) {
      if (Math.random() < 0.5) {
        child1[key] = parent2[key];
        child2[key] = parent1[key];
      }
    }

    return [child1, child2];
  }

  mutate(traits: GeneticTraits): GeneticTraits {
    const mutated = { ...traits };
    const keys = Object.keys(traits) as (keyof GeneticTraits)[];

    for (const key of keys) {
      if (Math.random() < this.mutationRate) {
        // Gaussian mutation
        mutated[key] = Math.max(0, Math.min(1, mutated[key] + (Math.random() - 0.5) * 0.2));
      }
    }

    return mutated;
  }

  evolve(population: GeneticTraits[], fitnesses: number[]): GeneticTraits[] {
    this.generation++;

    // Sort by fitness
    const sorted = population
      .map((traits, i) => ({ traits, fitness: fitnesses[i] }))
      .sort((a, b) => b.fitness - a.fitness);

    const newPopulation: GeneticTraits[] = [];

    // Elitism - keep best individuals
    for (let i = 0; i < this.eliteCount; i++) {
      newPopulation.push({ ...sorted[i].traits });
    }

    // Fill rest with children
    while (newPopulation.length < this.populationSize) {
      const [parent1, parent2] = this.selectParents(population, fitnesses);
      const [child1, child2] = this.crossover(parent1, parent2);

      newPopulation.push(this.mutate(child1));
      if (newPopulation.length < this.populationSize) {
        newPopulation.push(this.mutate(child2));
      }
    }

    return newPopulation;
  }

  traitsToAgentBehavior(traits: GeneticTraits, role: PlayerRole): AgentBehavior {
    // Map genetic traits to behavior parameters
    const isDefensive = ['goalkeeper', 'center_back', 'fullback', 'defensive_mid'].includes(role);
    const isAttacking = ['striker', 'winger', 'attacking_mid'].includes(role);

    return {
      separation: 0.4 + traits.spaceRecognition * 0.2,
      alignment: 0.3 + traits.teamworkOrientation * 0.3,
      cohesion: 0.3 + traits.teamworkOrientation * 0.2,
      seekBall: isAttacking ? 0.3 + traits.offensiveCreativity * 0.4 : 0.2,
      seekSpace: traits.spaceRecognition * 0.8,
      markOpponent: isDefensive ? 0.5 + traits.defensiveAwareness * 0.4 : traits.defensiveAwareness * 0.4,
      maintainShape: 1 - traits.riskTolerance * 0.5,
      pressCarrier: traits.pressingSensitivity * 0.8,
      coverShadow: isDefensive ? 0.4 + traits.defensiveAwareness * 0.4 : traits.defensiveAwareness * 0.3,
      makeRun: isAttacking ? traits.runTiming * 0.8 : traits.runTiming * 0.3
    };
  }

  getGenerationStats(fitnesses: number[]): {
    generation: number;
    best: number;
    average: number;
    worst: number;
  } {
    return {
      generation: this.generation,
      best: Math.max(...fitnesses),
      average: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      worst: Math.min(...fitnesses)
    };
  }
}

// ============================================================================
// INTEGRATED MULTI-AGENT CONTROLLER
// ============================================================================

export class MultiAgentController {
  private boidSystem: BoidSystem;
  private gegenpressing: GegenpressingSystem;
  private geneticAlgorithm: TacticalGeneticAlgorithm;
  private agents: Map<string, AgentState> = new Map();
  private behaviors: Map<string, AgentBehavior> = new Map();
  private formations: Map<string, FormationPosition> = new Map();
  private isPressing: boolean = false;

  constructor() {
    this.boidSystem = new BoidSystem();
    this.gegenpressing = new GegenpressingSystem();
    this.geneticAlgorithm = new TacticalGeneticAlgorithm();
  }

  initializeTeam(
    team: 'home' | 'away',
    formation: FormationPosition[],
    geneticTraits?: GeneticTraits
  ): void {
    const traits = geneticTraits || this.geneticAlgorithm.createRandomTraits();

    for (const pos of formation) {
      const id = `${team}_${pos.role}`;
      this.agents.set(id, {
        id,
        position: { ...pos.basePosition },
        velocity: { x: 0, y: 0 },
        role: pos.role,
        team,
        hasBall: false,
        stamina: 100,
        awareness: 70 + Math.random() * 30
      });

      this.formations.set(id, pos);
      this.behaviors.set(id, this.geneticAlgorithm.traitsToAgentBehavior(traits, pos.role));
    }
  }

  update(
    ball: Vector2D,
    deltaTime: number,
    justLostPossession?: { team: 'home' | 'away'; position: Vector2D }
  ): Map<string, AgentState> {
    const homeAgents = Array.from(this.agents.values()).filter(a => a.team === 'home');
    const awayAgents = Array.from(this.agents.values()).filter(a => a.team === 'away');

    // Check for gegenpress trigger
    if (justLostPossession) {
      const pressingTeam = justLostPossession.team === 'home' ? homeAgents : awayAgents;
      if (this.gegenpressing.shouldTriggerPress(
        justLostPossession.position,
        ball,
        pressingTeam,
        0
      )) {
        this.isPressing = true;
        const pressBehaviors = this.gegenpressing.getPressingBehaviors(
          pressingTeam,
          ball,
          justLostPossession.team === 'home' ? awayAgents : homeAgents
        );
        pressBehaviors.forEach((behavior, id) => {
          this.behaviors.set(id, behavior);
        });
      }
    }

    // Update each agent
    for (const [id, agent] of this.agents) {
      const teammates = agent.team === 'home' ? homeAgents : awayAgents;
      const opponents = agent.team === 'home' ? awayAgents : homeAgents;
      const behavior = this.behaviors.get(id)!;
      const formation = this.formations.get(id)!;

      const force = this.boidSystem.calculateForces(
        agent,
        teammates,
        opponents,
        ball,
        behavior,
        formation
      );

      const updatedAgent = this.boidSystem.updateAgent(agent, force, deltaTime);

      // Update stamina
      const speed = Vector.magnitude(updatedAgent.velocity);
      const staminaDrain = speed > 6 ? 0.5 : speed > 4 ? 0.2 : 0.05;
      updatedAgent.stamina = Math.max(0, updatedAgent.stamina - staminaDrain * deltaTime);

      this.agents.set(id, updatedAgent);
    }

    return new Map(this.agents);
  }

  getAgentPositions(): { id: string; position: Vector2D; team: 'home' | 'away' }[] {
    return Array.from(this.agents.values()).map(a => ({
      id: a.id,
      position: a.position,
      team: a.team
    }));
  }

  setBallCarrier(agentId: string): void {
    for (const [id, agent] of this.agents) {
      agent.hasBall = id === agentId;
    }
  }

  setTeamBehavior(team: 'home' | 'away', behaviorOverride: Partial<AgentBehavior>): void {
    for (const [id, behavior] of this.behaviors) {
      if (id.startsWith(team)) {
        this.behaviors.set(id, { ...behavior, ...behaviorOverride });
      }
    }
  }
}
