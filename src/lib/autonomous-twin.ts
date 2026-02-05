/**
 * AUTONOMOUS DIGITAL TWIN
 *
 * Self-governing player replicas that operate on their own volition.
 * Each twin is driven by the Resonance Kernel's energy dynamics,
 * making autonomous tactical decisions based on wave states and electrostatic fields.
 *
 * The twin perceives the world through its wave function and acts
 * according to energy gradients in the electrostatic field.
 */

import {
  ResonanceKernelEngine,
  WaveFunction,
  ElectrostaticField,
  KernelCoordinate,
  AttractorPoint,
  ResonanceCoherence,
} from './resonance-kernel';

// ==================== AUTONOMOUS TWIN TYPES ====================

export interface TwinConsciousness {
  // Awareness states
  awarenessLevel: number;        // 0-1 global awareness
  ballAwareness: number;         // Ball position awareness
  spaceAwareness: number;        // Open space perception
  threatAwareness: number;       // Opponent threat level
  teammateAwareness: number;     // Teammate positions

  // Decision state
  currentIntent: TwinIntent;
  intentConfidence: number;
  decisionHistory: TwinDecision[];

  // Energy state (from resonance kernel)
  energyState: EnergyState;
}

export interface TwinIntent {
  type: 'hold_position' | 'move_to_space' | 'press_opponent' | 'support_ball' |
        'create_passing_lane' | 'track_runner' | 'recover_shape' | 'exploit_gap';
  target: { x: number; y: number } | null;
  priority: number;
  urgency: 'immediate' | 'soon' | 'eventual';
  reason: string;
}

export interface TwinDecision {
  timestamp: number;
  intent: TwinIntent;
  waveState: { amplitude: number; phase: number; probability: number };
  energyAtDecision: number;
  outcome: 'executed' | 'interrupted' | 'overridden';
}

export interface EnergyState {
  kinetic: number;
  potential: number;
  total: number;
  gradient: { gx: number; gy: number };
  inAttractor: boolean;
  attractorId: string | null;
  resonanceWith: string[];  // Players in resonance
}

export interface AutonomousTwin {
  playerId: string;
  name: string;
  role: string;

  // Position state
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  idealPosition: { x: number; y: number };

  // Physical state (from Catapult data)
  physicalState: PhysicalState;

  // Consciousness
  consciousness: TwinConsciousness;

  // Wave function reference
  waveFunction: WaveFunction | null;

  // Kernel coordinate reference
  kernelCoordinate: KernelCoordinate | null;

  // Autonomous behavior parameters
  autonomyParams: AutonomyParameters;

  // Last update timestamp
  lastUpdate: number;
}

export interface PhysicalState {
  fatigue: number;              // 0-100
  sprintCapacity: number;       // Remaining sprint distance
  heartRate: number;            // BPM
  muscleLoad: number;           // Accumulated load
  recoveryRate: number;         // Recovery speed
  injuryRisk: number;           // 0-1 injury probability

  // Catapult metrics
  catapultData: CatapultLiveData | null;
}

export interface CatapultLiveData {
  timestamp: number;
  playerLoad: number;
  totalDistance: number;
  hsr: number;                  // High speed running distance
  sprint: number;               // Sprint distance
  accelerations: number;
  decelerations: number;
  maxSpeed: number;
  metabolicPower: number;
  heartRate: number;
  heartRateZone: 1 | 2 | 3 | 4 | 5;
}

export interface AutonomyParameters {
  // Decision-making weights
  positionWeight: number;        // How much to follow ideal position
  spaceWeight: number;           // How much to seek space
  pressWeight: number;           // How aggressive in pressing
  supportWeight: number;         // How supportive of teammates

  // Energy thresholds
  minEnergyForPress: number;     // Energy needed to press
  minEnergyForRun: number;       // Energy needed for runs
  recoveryThreshold: number;     // When to prioritize recovery

  // Resonance sensitivity
  resonanceSensitivity: number;  // How much wave state affects decisions
  attractorSensitivity: number;  // How much attractors affect decisions

  // Role-specific modifiers
  roleModifiers: RoleModifiers;
}

export interface RoleModifiers {
  defensivePriority: number;
  offensivePriority: number;
  pressIntensity: number;
  positionDiscipline: number;
  creativeFreedom: number;
}

// ==================== AUTONOMOUS TWIN ENGINE ====================

export class AutonomousTwinEngine {
  private twins: Map<string, AutonomousTwin> = new Map();
  private resonanceKernel: ResonanceKernelEngine;
  private lastCoherence: ResonanceCoherence | null = null;

  // Global tactical state
  private ballPosition: { x: number; y: number } = { x: 50, y: 50 };
  private possession: 'home' | 'away' = 'home';
  private matchPhase: 'attacking' | 'defending' | 'transition' = 'transition';

  constructor(resonanceKernel: ResonanceKernelEngine) {
    this.resonanceKernel = resonanceKernel;
  }

  // ==================== INITIALIZATION ====================

  /**
   * Create an autonomous twin for a player
   */
  createTwin(
    playerId: string,
    name: string,
    role: string,
    initialPosition: { x: number; y: number },
    idealPosition: { x: number; y: number }
  ): AutonomousTwin {
    const roleModifiers = this.getRoleModifiers(role);
    const autonomyParams = this.getDefaultAutonomyParams(role, roleModifiers);

    const twin: AutonomousTwin = {
      playerId,
      name,
      role,
      position: { ...initialPosition },
      velocity: { vx: 0, vy: 0 },
      idealPosition: { ...idealPosition },
      physicalState: this.createDefaultPhysicalState(),
      consciousness: this.createDefaultConsciousness(),
      waveFunction: null,
      kernelCoordinate: null,
      autonomyParams,
      lastUpdate: Date.now(),
    };

    this.twins.set(playerId, twin);
    return twin;
  }

  private getRoleModifiers(role: string): RoleModifiers {
    const modifiers: Record<string, RoleModifiers> = {
      GK: { defensivePriority: 1.0, offensivePriority: 0.1, pressIntensity: 0.1, positionDiscipline: 0.95, creativeFreedom: 0.05 },
      CB: { defensivePriority: 0.9, offensivePriority: 0.2, pressIntensity: 0.4, positionDiscipline: 0.85, creativeFreedom: 0.15 },
      RB: { defensivePriority: 0.6, offensivePriority: 0.5, pressIntensity: 0.6, positionDiscipline: 0.7, creativeFreedom: 0.4 },
      LB: { defensivePriority: 0.6, offensivePriority: 0.5, pressIntensity: 0.6, positionDiscipline: 0.7, creativeFreedom: 0.4 },
      CDM: { defensivePriority: 0.8, offensivePriority: 0.4, pressIntensity: 0.7, positionDiscipline: 0.8, creativeFreedom: 0.3 },
      CM: { defensivePriority: 0.5, offensivePriority: 0.6, pressIntensity: 0.6, positionDiscipline: 0.6, creativeFreedom: 0.5 },
      CAM: { defensivePriority: 0.3, offensivePriority: 0.8, pressIntensity: 0.5, positionDiscipline: 0.4, creativeFreedom: 0.7 },
      RW: { defensivePriority: 0.3, offensivePriority: 0.85, pressIntensity: 0.6, positionDiscipline: 0.4, creativeFreedom: 0.8 },
      LW: { defensivePriority: 0.3, offensivePriority: 0.85, pressIntensity: 0.6, positionDiscipline: 0.4, creativeFreedom: 0.8 },
      ST: { defensivePriority: 0.2, offensivePriority: 0.95, pressIntensity: 0.7, positionDiscipline: 0.3, creativeFreedom: 0.85 },
    };

    return modifiers[role] || modifiers.CM;
  }

  private getDefaultAutonomyParams(role: string, roleModifiers: RoleModifiers): AutonomyParameters {
    return {
      positionWeight: roleModifiers.positionDiscipline,
      spaceWeight: 1 - roleModifiers.positionDiscipline,
      pressWeight: roleModifiers.pressIntensity,
      supportWeight: 0.6,
      minEnergyForPress: 40,
      minEnergyForRun: 30,
      recoveryThreshold: 70,
      resonanceSensitivity: 0.7,
      attractorSensitivity: 0.5,
      roleModifiers,
    };
  }

  private createDefaultPhysicalState(): PhysicalState {
    return {
      fatigue: 0,
      sprintCapacity: 100,
      heartRate: 80,
      muscleLoad: 0,
      recoveryRate: 1.0,
      injuryRisk: 0,
      catapultData: null,
    };
  }

  private createDefaultConsciousness(): TwinConsciousness {
    return {
      awarenessLevel: 1.0,
      ballAwareness: 1.0,
      spaceAwareness: 0.8,
      threatAwareness: 0.8,
      teammateAwareness: 0.9,
      currentIntent: {
        type: 'hold_position',
        target: null,
        priority: 0.5,
        urgency: 'eventual',
        reason: 'Initializing',
      },
      intentConfidence: 0.5,
      decisionHistory: [],
      energyState: {
        kinetic: 0,
        potential: 50,
        total: 50,
        gradient: { gx: 0, gy: 0 },
        inAttractor: false,
        attractorId: null,
        resonanceWith: [],
      },
    };
  }

  // ==================== UPDATE LOOP (AUTONOMOUS VOLITION) ====================

  /**
   * Main update - each twin thinks and acts autonomously
   */
  update(
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away',
    opponents: { id: string; x: number; y: number }[],
    coherence: ResonanceCoherence,
    dt: number = 0.1
  ): Map<string, TwinIntent> {
    this.ballPosition = ballPosition;
    this.possession = possession;
    this.lastCoherence = coherence;
    this.matchPhase = this.determineMatchPhase(possession, ballPosition);

    const intentions = new Map<string, TwinIntent>();

    for (const [playerId, twin] of this.twins) {
      // Get wave function and kernel coordinate from resonance kernel
      twin.waveFunction = this.resonanceKernel.getWaveFunction(playerId) || null;
      twin.kernelCoordinate = this.resonanceKernel.getKernelCoordinate(playerId) || null;

      // Update energy state from resonance kernel
      this.updateEnergyState(twin);

      // Update awareness based on wave state
      this.updateAwareness(twin, opponents);

      // Autonomous decision-making
      const intent = this.think(twin, opponents);

      // Execute intent (update velocity/target)
      this.act(twin, intent, dt);

      // Record decision
      this.recordDecision(twin, intent);

      intentions.set(playerId, intent);
      twin.lastUpdate = Date.now();
    }

    return intentions;
  }

  /**
   * Individual twin thinking process (autonomous decision)
   */
  private think(twin: AutonomousTwin, opponents: { id: string; x: number; y: number }[]): TwinIntent {
    // Get energy gradient (the "force" acting on the twin)
    const gradient = twin.consciousness.energyState.gradient;
    const energy = twin.consciousness.energyState;
    const params = twin.autonomyParams;

    // Calculate potential intents based on current state
    const candidateIntents: { intent: TwinIntent; score: number }[] = [];

    // 1. Hold Position (follow ideal position / kernel attraction)
    const positionIntent = this.evaluatePositionIntent(twin);
    candidateIntents.push({ intent: positionIntent, score: positionIntent.priority * params.positionWeight });

    // 2. Move to Space (exploit gaps)
    const spaceIntent = this.evaluateSpaceIntent(twin, opponents);
    candidateIntents.push({ intent: spaceIntent, score: spaceIntent.priority * params.spaceWeight });

    // 3. Press Opponent
    if (energy.total > params.minEnergyForPress) {
      const pressIntent = this.evaluatePressIntent(twin, opponents);
      candidateIntents.push({ intent: pressIntent, score: pressIntent.priority * params.pressWeight });
    }

    // 4. Support Ball
    const supportIntent = this.evaluateSupportIntent(twin);
    candidateIntents.push({ intent: supportIntent, score: supportIntent.priority * params.supportWeight });

    // 5. Recover Shape (when out of position)
    if (twin.waveFunction && twin.waveFunction.probability < 0.5) {
      const recoverIntent = this.evaluateRecoverIntent(twin);
      candidateIntents.push({ intent: recoverIntent, score: recoverIntent.priority * 1.2 }); // High priority
    }

    // 6. Create Passing Lane (when in possession)
    if (this.possession === 'home' && this.matchPhase === 'attacking') {
      const laneIntent = this.evaluatePassingLaneIntent(twin);
      candidateIntents.push({ intent: laneIntent, score: laneIntent.priority * 0.8 });
    }

    // Apply resonance modifiers
    for (const candidate of candidateIntents) {
      // Wave amplitude boosts confidence
      if (twin.waveFunction) {
        candidate.score *= (0.5 + twin.waveFunction.amplitude * 0.5);
      }

      // Attractor influence
      if (energy.inAttractor) {
        // Being in an attractor increases position-holding tendency
        if (candidate.intent.type === 'hold_position') {
          candidate.score *= 1.3;
        }
      }

      // Resonance with teammates boosts collective actions
      if (energy.resonanceWith.length > 2) {
        if (['support_ball', 'create_passing_lane'].includes(candidate.intent.type)) {
          candidate.score *= 1.2;
        }
      }
    }

    // Select best intent
    candidateIntents.sort((a, b) => b.score - a.score);
    const selectedIntent = candidateIntents[0]?.intent || twin.consciousness.currentIntent;

    twin.consciousness.intentConfidence = candidateIntents[0]?.score || 0.5;
    twin.consciousness.currentIntent = selectedIntent;

    return selectedIntent;
  }

  /**
   * Execute the intent (update twin state)
   */
  private act(twin: AutonomousTwin, intent: TwinIntent, dt: number): void {
    if (!intent.target) {
      // No target, maintain position
      twin.velocity = { vx: 0, vy: 0 };
      return;
    }

    // Calculate direction to target
    const dx = intent.target.x - twin.position.x;
    const dy = intent.target.y - twin.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      // Already at target
      twin.velocity = { vx: 0, vy: 0 };
      return;
    }

    // Speed based on urgency and fatigue
    let maxSpeed = 8; // m/s base speed
    if (intent.urgency === 'immediate') maxSpeed = 12;
    else if (intent.urgency === 'eventual') maxSpeed = 5;

    // Reduce speed based on fatigue
    const fatigueMultiplier = 1 - (twin.physicalState.fatigue / 200);
    maxSpeed *= fatigueMultiplier;

    // Calculate velocity
    const speed = Math.min(maxSpeed, distance / dt);
    twin.velocity = {
      vx: (dx / distance) * speed,
      vy: (dy / distance) * speed,
    };

    // Update position
    twin.position.x += twin.velocity.vx * dt;
    twin.position.y += twin.velocity.vy * dt;

    // Clamp to pitch
    twin.position.x = Math.max(0, Math.min(100, twin.position.x));
    twin.position.y = Math.max(0, Math.min(100, twin.position.y));

    // Update fatigue
    const sprintThreshold = 7;
    if (speed > sprintThreshold) {
      twin.physicalState.fatigue += 0.5 * dt;
      twin.physicalState.sprintCapacity -= speed * dt;
    }
  }

  // ==================== INTENT EVALUATION ====================

  private evaluatePositionIntent(twin: AutonomousTwin): TwinIntent {
    // Use kernel coordinate similarity to determine need to hold position
    const similarity = twin.kernelCoordinate?.kernelSimilarity || 0.5;
    const deviation = 1 - similarity;

    // Higher deviation = higher priority to return to position
    const priority = deviation * twin.autonomyParams.roleModifiers.positionDiscipline;

    return {
      type: 'hold_position',
      target: twin.idealPosition,
      priority,
      urgency: deviation > 0.5 ? 'soon' : 'eventual',
      reason: `Kernel similarity: ${(similarity * 100).toFixed(0)}%`,
    };
  }

  private evaluateSpaceIntent(
    twin: AutonomousTwin,
    opponents: { id: string; x: number; y: number }[]
  ): TwinIntent {
    // Find best open space considering wave function and attractors
    const spaces = this.findOpenSpaces(twin, opponents);

    if (spaces.length === 0) {
      return {
        type: 'move_to_space',
        target: null,
        priority: 0,
        urgency: 'eventual',
        reason: 'No open space found',
      };
    }

    // Best space has highest score
    const bestSpace = spaces[0];

    // Priority based on space quality and offensive priority
    const priority = bestSpace.score * twin.autonomyParams.roleModifiers.offensivePriority;

    return {
      type: 'move_to_space',
      target: bestSpace.position,
      priority,
      urgency: bestSpace.score > 0.7 ? 'soon' : 'eventual',
      reason: `Space score: ${(bestSpace.score * 100).toFixed(0)}%`,
    };
  }

  private evaluatePressIntent(
    twin: AutonomousTwin,
    opponents: { id: string; x: number; y: number }[]
  ): TwinIntent {
    // Find nearest opponent to press
    let nearestOpp: { id: string; x: number; y: number; distance: number } | null = null;
    let minDist = Infinity;

    for (const opp of opponents) {
      const dx = opp.x - twin.position.x;
      const dy = opp.y - twin.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
        nearestOpp = { ...opp, distance: dist };
      }
    }

    if (!nearestOpp || minDist > 20) {
      return {
        type: 'press_opponent',
        target: null,
        priority: 0,
        urgency: 'eventual',
        reason: 'No pressable opponent',
      };
    }

    // Priority based on distance and press intensity
    const distanceFactor = Math.max(0, 1 - minDist / 20);
    const priority = distanceFactor * twin.autonomyParams.roleModifiers.pressIntensity;

    // Near ball = more urgent
    const ballDist = Math.sqrt(
      (this.ballPosition.x - nearestOpp.x) ** 2 +
      (this.ballPosition.y - nearestOpp.y) ** 2
    );
    const urgency = ballDist < 10 ? 'immediate' : ballDist < 20 ? 'soon' : 'eventual';

    return {
      type: 'press_opponent',
      target: { x: nearestOpp.x, y: nearestOpp.y },
      priority,
      urgency,
      reason: `Opponent ${nearestOpp.id} at ${minDist.toFixed(0)}m`,
    };
  }

  private evaluateSupportIntent(twin: AutonomousTwin): TwinIntent {
    // Support ball carrier
    const dx = this.ballPosition.x - twin.position.x;
    const dy = this.ballPosition.y - twin.position.y;
    const ballDist = Math.sqrt(dx * dx + dy * dy);

    // Calculate ideal support position (angle from ball)
    const angle = Math.atan2(dy, dx);
    const supportDist = 15; // Ideal support distance
    const supportAngle = angle + (twin.role.includes('R') ? -Math.PI / 4 : Math.PI / 4);

    const target = {
      x: this.ballPosition.x + Math.cos(supportAngle) * supportDist,
      y: this.ballPosition.y + Math.sin(supportAngle) * supportDist,
    };

    // Priority based on possession and ball distance
    let priority = this.possession === 'home' ? 0.6 : 0.3;
    priority *= Math.max(0, 1 - ballDist / 50);

    return {
      type: 'support_ball',
      target,
      priority,
      urgency: ballDist < 20 ? 'soon' : 'eventual',
      reason: `Ball at ${ballDist.toFixed(0)}m`,
    };
  }

  private evaluateRecoverIntent(twin: AutonomousTwin): TwinIntent {
    // Strong pull back to ideal position when out of shape
    const probability = twin.waveFunction?.probability || 0.5;
    const priority = (1 - probability) * 1.5; // High priority when far from ideal

    return {
      type: 'recover_shape',
      target: twin.idealPosition,
      priority: Math.min(1, priority),
      urgency: probability < 0.3 ? 'immediate' : 'soon',
      reason: `Probability density: ${(probability * 100).toFixed(0)}%`,
    };
  }

  private evaluatePassingLaneIntent(twin: AutonomousTwin): TwinIntent {
    // Find position that creates a passing lane
    const angle = Math.atan2(
      twin.position.y - this.ballPosition.y,
      twin.position.x - this.ballPosition.x
    );

    // Move perpendicular to create lane
    const perpAngle = angle + Math.PI / 2;
    const target = {
      x: twin.position.x + Math.cos(perpAngle) * 5,
      y: twin.position.y + Math.sin(perpAngle) * 5,
    };

    // Clamp to pitch
    target.x = Math.max(5, Math.min(95, target.x));
    target.y = Math.max(5, Math.min(95, target.y));

    return {
      type: 'create_passing_lane',
      target,
      priority: 0.5 * twin.autonomyParams.roleModifiers.offensivePriority,
      urgency: 'eventual',
      reason: 'Creating passing option',
    };
  }

  private findOpenSpaces(
    twin: AutonomousTwin,
    opponents: { id: string; x: number; y: number }[]
  ): { position: { x: number; y: number }; score: number }[] {
    const spaces: { position: { x: number; y: number }; score: number }[] = [];

    // Grid search for open spaces
    for (let x = 10; x <= 90; x += 10) {
      for (let y = 10; y <= 90; y += 10) {
        // Distance from twin
        const twinDist = Math.sqrt((x - twin.position.x) ** 2 + (y - twin.position.y) ** 2);
        if (twinDist > 25 || twinDist < 5) continue; // Only nearby spaces

        // Distance from opponents
        let minOppDist = Infinity;
        for (const opp of opponents) {
          const oppDist = Math.sqrt((x - opp.x) ** 2 + (y - opp.y) ** 2);
          minOppDist = Math.min(minOppDist, oppDist);
        }

        // Score: farther from opponents is better
        const score = Math.min(1, minOppDist / 15);

        // Bonus for advancing position (if attacking)
        const advanceBonus = this.matchPhase === 'attacking' ? (y / 100) * 0.3 : 0;

        spaces.push({
          position: { x, y },
          score: score + advanceBonus,
        });
      }
    }

    return spaces.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  // ==================== STATE UPDATES ====================

  private updateEnergyState(twin: AutonomousTwin): void {
    const wave = twin.waveFunction;
    const attractors = this.resonanceKernel.getAttractors();

    // Kinetic from velocity
    const kinetic = 0.5 * (twin.velocity.vx ** 2 + twin.velocity.vy ** 2);

    // Potential from wave amplitude and position
    const potential = wave ? (1 - wave.probability) * 50 + wave.amplitude * 50 : 50;

    // Check if in attractor
    let inAttractor = false;
    let attractorId: string | null = null;

    for (const attractor of attractors) {
      const dist = Math.sqrt(
        (twin.position.x - attractor.position.x) ** 2 +
        (twin.position.y - attractor.position.y) ** 2
      );
      if (dist < attractor.radius) {
        inAttractor = true;
        attractorId = attractor.id;
        break;
      }
    }

    // Find resonant teammates (high entanglement)
    const resonanceWith: string[] = [];
    if (wave) {
      for (const [playerId, entanglement] of wave.entanglement) {
        if (entanglement > 0.5) {
          resonanceWith.push(playerId);
        }
      }
    }

    // Calculate gradient from ideal position
    const dx = twin.idealPosition.x - twin.position.x;
    const dy = twin.idealPosition.y - twin.position.y;

    twin.consciousness.energyState = {
      kinetic,
      potential,
      total: kinetic + potential,
      gradient: { gx: dx * 0.1, gy: dy * 0.1 },
      inAttractor,
      attractorId,
      resonanceWith,
    };
  }

  private updateAwareness(
    twin: AutonomousTwin,
    opponents: { id: string; x: number; y: number }[]
  ): void {
    // Ball awareness decreases with distance and fatigue
    const ballDist = Math.sqrt(
      (this.ballPosition.x - twin.position.x) ** 2 +
      (this.ballPosition.y - twin.position.y) ** 2
    );
    twin.consciousness.ballAwareness = Math.max(0.3, 1 - ballDist / 80);
    twin.consciousness.ballAwareness *= (1 - twin.physicalState.fatigue / 200);

    // Threat awareness from nearby opponents
    let nearestOppDist = Infinity;
    for (const opp of opponents) {
      const dist = Math.sqrt(
        (opp.x - twin.position.x) ** 2 + (opp.y - twin.position.y) ** 2
      );
      nearestOppDist = Math.min(nearestOppDist, dist);
    }
    twin.consciousness.threatAwareness = nearestOppDist < 5 ? 1 : Math.max(0.2, 1 - nearestOppDist / 30);

    // Overall awareness from wave amplitude
    twin.consciousness.awarenessLevel = twin.waveFunction?.amplitude || 0.5;
    twin.consciousness.awarenessLevel *= (1 - twin.physicalState.fatigue / 150);
  }

  private recordDecision(twin: AutonomousTwin, intent: TwinIntent): void {
    const decision: TwinDecision = {
      timestamp: Date.now(),
      intent,
      waveState: {
        amplitude: twin.waveFunction?.amplitude || 0,
        phase: twin.waveFunction?.phase || 0,
        probability: twin.waveFunction?.probability || 0,
      },
      energyAtDecision: twin.consciousness.energyState.total,
      outcome: 'executed',
    };

    twin.consciousness.decisionHistory.push(decision);

    // Keep only last 50 decisions
    if (twin.consciousness.decisionHistory.length > 50) {
      twin.consciousness.decisionHistory.shift();
    }
  }

  private determineMatchPhase(possession: 'home' | 'away', ballPosition: { x: number; y: number }): 'attacking' | 'defending' | 'transition' {
    if (possession === 'home') {
      if (ballPosition.y > 60) return 'attacking';
      if (ballPosition.y < 40) return 'transition';
      return 'attacking';
    } else {
      if (ballPosition.y < 40) return 'defending';
      if (ballPosition.y > 60) return 'transition';
      return 'defending';
    }
  }

  // ==================== CATAPULT DATA INTEGRATION ====================

  /**
   * Feed Catapult live data into a twin
   */
  feedCatapultData(playerId: string, data: CatapultLiveData): void {
    const twin = this.twins.get(playerId);
    if (!twin) return;

    twin.physicalState.catapultData = data;

    // Update physical state from Catapult
    twin.physicalState.fatigue = Math.min(100, data.playerLoad / 10);
    twin.physicalState.heartRate = data.heartRate;
    twin.physicalState.muscleLoad = data.playerLoad;

    // Sprint capacity from HSR remaining
    const maxHSR = 1000; // Typical max HSR per match
    twin.physicalState.sprintCapacity = Math.max(0, 100 - (data.hsr / maxHSR) * 100);

    // Injury risk from accumulated load
    twin.physicalState.injuryRisk = Math.min(1, data.playerLoad / 800);

    // Update wave amplitude based on fatigue
    if (twin.waveFunction) {
      twin.waveFunction.amplitude = Math.max(0.1, 1 - twin.physicalState.fatigue / 100);
    }
  }

  // ==================== GETTERS ====================

  getTwin(playerId: string): AutonomousTwin | undefined {
    return this.twins.get(playerId);
  }

  getAllTwins(): AutonomousTwin[] {
    return Array.from(this.twins.values());
  }

  getIntent(playerId: string): TwinIntent | undefined {
    return this.twins.get(playerId)?.consciousness.currentIntent;
  }

  getAllIntents(): Map<string, TwinIntent> {
    const intents = new Map<string, TwinIntent>();
    for (const [id, twin] of this.twins) {
      intents.set(id, twin.consciousness.currentIntent);
    }
    return intents;
  }

  getDecisionHistory(playerId: string): TwinDecision[] {
    return this.twins.get(playerId)?.consciousness.decisionHistory || [];
  }
}

// Export factory function
export function createAutonomousTwinEngine(kernel: ResonanceKernelEngine): AutonomousTwinEngine {
  return new AutonomousTwinEngine(kernel);
}
