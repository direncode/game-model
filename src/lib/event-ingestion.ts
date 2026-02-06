/**
 * BigDunc Event Ingestion & Vector Enrichment
 *
 * Takes abstract match events ("CB1 passed to CM2") and enriches them with
 * full spatial vectors — coordinates, trajectories, velocities, angles.
 * The enriched events then drive organic field construction.
 */

import {
  type Vec2,
  type PlayerPhase,
  type KernelPlayer,
  PITCH_WIDTH,
  PITCH_HEIGHT,
  vec2Dist,
  vec2Normalize,
  clamp,
  PHASE_MAP,
} from './resonance-kernel';

// ======================== Abstract Event Types ========================

export type EventType =
  | 'pass'
  | 'shot'
  | 'tackle'
  | 'interception'
  | 'dribble'
  | 'cross'
  | 'through_ball'
  | 'press_trigger'
  | 'recovery_run'
  | 'goal_kick'
  | 'throw_in'
  | 'corner'
  | 'free_kick'
  | 'goal'
  | 'save'
  | 'clearance'
  | 'aerial_duel'
  | 'foul'
  | 'offside'
  | 'substitution'
  | 'positional_shift';

/** Abstract event — what a commentator/analyst would log. */
export interface AbstractEvent {
  type: EventType;
  minute: number;
  second?: number;
  from: string;          // player id
  to?: string;           // target player id (for passes, etc.)
  success?: boolean;
  zone?: string;         // "left_flank" | "center" | "right_half_space" etc.
  description?: string;  // free text: "CB1 played a long diagonal to LW"
  metadata?: Record<string, unknown>;
}

// ======================== Enriched Event (Vector-Enriched) ========================

/** Full vector-enriched event — every spatial dimension resolved. */
export interface EnrichedEvent {
  // Original
  abstract: AbstractEvent;
  tick: number;

  // ── Vector Enrichment ──
  origin: Vec2;                      // where the event started
  destination: Vec2;                 // where the event ended (ball arrival)
  trajectory: Vec2[];                // intermediate points along the path
  ballVelocity: Vec2;               // ball velocity vector at release
  ballSpeed: number;                 // scalar speed m/s

  // ── Actor Enrichment ──
  actorPosition: Vec2;              // actor position at event time
  actorVelocity: Vec2;              // actor movement at event time
  actorPhase: PlayerPhase;          // tactical phase of actor
  actorLoad: number;                // physical load 0-100

  // ── Target Enrichment (if applicable) ──
  targetPosition?: Vec2;
  targetVelocity?: Vec2;
  targetPhase?: PlayerPhase;

  // ── Spatial Context ──
  distanceCovered: number;          // meters the ball traveled
  angle: number;                    // angle in radians
  passingLaneWidth: number;         // corridor width in meters (0 = blocked)
  pressureOnActor: number;          // 0-1 opponent pressure
  spaceAtDestination: number;       // 0-1 open space
  progressiveDistance: number;      // forward progress in meters (negative = backward)

  // ── Field Impact ──
  phaseShift: PlayerPhase | null;   // if this event triggers a phase change
  attractorMutation: AttractorMutation | null;
  fieldEnergyDelta: number;         // how much field energy this adds/removes
}

export interface AttractorMutation {
  action: 'create' | 'move' | 'remove';
  type: 'ball' | 'tactical' | 'space' | 'defensive' | 'offensive';
  position: Vec2;
  radius: number;
  strength: number;
}

// ======================== Zone → Coordinate Mapping ========================

const ZONE_CENTERS: Record<string, Vec2> = {
  // Thirds
  defensive_third:   { x: 17.5, y: 34 },
  middle_third:      { x: 52.5, y: 34 },
  attacking_third:   { x: 87.5, y: 34 },
  // Corridors
  left_flank:        { x: 52.5, y: 8 },
  left_half_space:   { x: 52.5, y: 22 },
  center:            { x: 52.5, y: 34 },
  right_half_space:  { x: 52.5, y: 46 },
  right_flank:       { x: 52.5, y: 60 },
  // Combined zones
  def_left:          { x: 17.5, y: 12 },
  def_center:        { x: 17.5, y: 34 },
  def_right:         { x: 17.5, y: 56 },
  mid_left:          { x: 52.5, y: 12 },
  mid_center:        { x: 52.5, y: 34 },
  mid_right:         { x: 52.5, y: 56 },
  att_left:          { x: 87.5, y: 12 },
  att_center:        { x: 87.5, y: 34 },
  att_right:         { x: 87.5, y: 56 },
  // Set piece zones
  own_box:           { x: 8.5, y: 34 },
  opp_box:           { x: 96.5, y: 34 },
  left_corner:       { x: 105, y: 0 },
  right_corner:      { x: 105, y: 68 },
};

// ======================== Position Inference from Player ID ========================

/** Default tactical positions by role — used when no GPS/kernel data available. */
const ROLE_POSITIONS: Record<string, Vec2> = {
  GK:  { x: 5,  y: 34 },
  LB:  { x: 20, y: 10 },
  CB1: { x: 18, y: 28 },
  CB2: { x: 18, y: 40 },
  RB:  { x: 20, y: 58 },
  CM1: { x: 40, y: 22 },
  CM2: { x: 42, y: 34 },
  CM3: { x: 40, y: 46 },
  LW:  { x: 70, y: 12 },
  ST:  { x: 78, y: 34 },
  RW:  { x: 70, y: 56 },
};

// ======================== Event Ingestion Pipeline ========================

export class EventIngestionPipeline {
  private playerPositions: Map<string, Vec2> = new Map();
  private playerVelocities: Map<string, Vec2> = new Map();
  private playerPhases: Map<string, PlayerPhase> = new Map();
  private playerLoads: Map<string, number> = new Map();
  private ballPosition: Vec2 = { x: 52.5, y: 34 };
  private eventHistory: EnrichedEvent[] = [];
  private tickCounter = 0;

  /** Sync with kernel state — call each tick to keep positions current. */
  syncFromKernel(players: KernelPlayer[], ballPos?: Vec2): void {
    for (const p of players) {
      this.playerPositions.set(p.id, { ...p.position });
      this.playerVelocities.set(p.id, { ...p.velocity });
      this.playerPhases.set(p.id, p.state);
      this.playerLoads.set(p.id, p.load);
    }
    if (ballPos) this.ballPosition = { ...ballPos };
  }

  /** Main entry point: take an abstract event, return a fully enriched event. */
  ingest(event: AbstractEvent): EnrichedEvent {
    this.tickCounter++;

    // ── Resolve actor position ──
    const actorPos = this.resolvePosition(event.from);
    const actorVel = this.playerVelocities.get(event.from) ?? { x: 0, y: 0 };
    const actorPhase = this.playerPhases.get(event.from) ?? this.inferPhaseFromEvent(event);
    const actorLoad = this.playerLoads.get(event.from) ?? 50;

    // ── Resolve destination ──
    const destination = this.resolveDestination(event, actorPos);

    // ── Resolve target ──
    let targetPos: Vec2 | undefined;
    let targetVel: Vec2 | undefined;
    let targetPhase: PlayerPhase | undefined;
    if (event.to) {
      targetPos = this.resolvePosition(event.to);
      targetVel = this.playerVelocities.get(event.to);
      targetPhase = this.playerPhases.get(event.to) ?? 'building';
    }

    // ── Compute trajectory ──
    const trajectory = this.computeTrajectory(actorPos, destination, event.type);

    // ── Ball velocity vector ──
    const dx = destination.x - actorPos.x;
    const dy = destination.y - actorPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ballSpeed = this.inferBallSpeed(event.type, dist);
    const ballVelocity = dist > 0
      ? { x: (dx / dist) * ballSpeed, y: (dy / dist) * ballSpeed }
      : { x: 0, y: 0 };

    // ── Spatial context ──
    const angle = Math.atan2(dy, dx);
    const progressiveDistance = dx; // positive = toward opponent goal
    const passingLaneWidth = this.computePassingLaneWidth(actorPos, destination);
    const pressureOnActor = this.computePressure(actorPos);
    const spaceAtDestination = this.computeOpenSpace(destination);

    // ── Field impact ──
    const phaseShift = this.determinePhaseShift(event, actorPhase);
    const attractorMutation = this.determineAttractorMutation(event, destination);
    const fieldEnergyDelta = this.computeEnergyDelta(event, dist, ballSpeed);

    // ── Update internal state ──
    this.updateStateFromEvent(event, actorPos, destination);

    const enriched: EnrichedEvent = {
      abstract: event,
      tick: this.tickCounter,
      origin: { ...actorPos },
      destination: { ...destination },
      trajectory,
      ballVelocity,
      ballSpeed,
      actorPosition: { ...actorPos },
      actorVelocity: { ...actorVel },
      actorPhase,
      actorLoad,
      targetPosition: targetPos ? { ...targetPos } : undefined,
      targetVelocity: targetVel ? { ...targetVel } : undefined,
      targetPhase,
      distanceCovered: dist,
      angle,
      passingLaneWidth,
      pressureOnActor,
      spaceAtDestination,
      progressiveDistance,
      phaseShift,
      attractorMutation,
      fieldEnergyDelta,
    };

    this.eventHistory.push(enriched);
    if (this.eventHistory.length > 200) this.eventHistory = this.eventHistory.slice(-200);

    return enriched;
  }

  /** Generate a sample event stream for demo purposes. */
  generateSampleEvents(count: number, startMinute: number = 1): AbstractEvent[] {
    const events: AbstractEvent[] = [];
    const players = ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CM1', 'CM2', 'CM3', 'LW', 'ST', 'RW'];
    const outfieldPlayers = players.slice(1);

    const templates: (() => AbstractEvent)[] = [
      () => {
        const from = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        let to = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        while (to === from) to = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        return { type: 'pass', minute: 0, from, to, success: Math.random() > 0.15, description: `${from} passed to ${to}` };
      },
      () => {
        const from = ['LW', 'ST', 'RW', 'CM1', 'CM2', 'CM3'][Math.floor(Math.random() * 6)];
        return { type: 'shot', minute: 0, from, zone: 'opp_box', success: Math.random() > 0.7, description: `${from} shot on goal` };
      },
      () => {
        const from = ['CB1', 'CB2', 'CM1', 'CM2', 'CM3'][Math.floor(Math.random() * 5)];
        return { type: 'tackle', minute: 0, from, success: Math.random() > 0.3, description: `${from} made a tackle` };
      },
      () => {
        const from = ['LW', 'RW', 'ST'][Math.floor(Math.random() * 3)];
        return { type: 'dribble', minute: 0, from, success: Math.random() > 0.4, description: `${from} dribbled past defender` };
      },
      () => {
        const from = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        return { type: 'press_trigger', minute: 0, from, description: `${from} triggered a press` };
      },
      () => {
        const from = ['LB', 'RB'][Math.floor(Math.random() * 2)];
        const to = from === 'LB' ? 'LW' : 'RW';
        return { type: 'cross', minute: 0, from, to, zone: from === 'LB' ? 'left_flank' : 'right_flank', success: Math.random() > 0.5 };
      },
      () => {
        const from = ['CM1', 'CM2', 'CM3'][Math.floor(Math.random() * 3)];
        const to = ['LW', 'ST', 'RW'][Math.floor(Math.random() * 3)];
        return { type: 'through_ball', minute: 0, from, to, success: Math.random() > 0.6, description: `${from} played through ball to ${to}` };
      },
      () => {
        const from = ['CB1', 'CB2', 'CM1', 'CM2'][Math.floor(Math.random() * 4)];
        return { type: 'interception', minute: 0, from, success: true, description: `${from} intercepted` };
      },
      () => {
        const from = ['CB1', 'CB2', 'LB', 'RB'][Math.floor(Math.random() * 4)];
        return { type: 'clearance', minute: 0, from, description: `${from} cleared the ball` };
      },
      () => {
        const from = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        return { type: 'recovery_run', minute: 0, from, description: `${from} made a recovery run` };
      },
    ];

    for (let i = 0; i < count; i++) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      const event = template();
      event.minute = startMinute + Math.floor(i / 3);
      event.second = Math.floor(Math.random() * 60);
      events.push(event);
    }

    return events;
  }

  getHistory(): EnrichedEvent[] { return this.eventHistory; }
  getBallPosition(): Vec2 { return { ...this.ballPosition }; }
  getPlayerPosition(id: string): Vec2 | undefined {
    const pos = this.playerPositions.get(id);
    return pos ? { ...pos } : undefined;
  }

  // ======================== Private Methods ========================

  private resolvePosition(playerId: string): Vec2 {
    // 1. Try kernel-synced position
    const synced = this.playerPositions.get(playerId);
    if (synced) return { ...synced };

    // 2. Fall back to role-based default
    const rolePos = ROLE_POSITIONS[playerId];
    if (rolePos) return { ...rolePos };

    // 3. Random sensible position
    return { x: 30 + Math.random() * 40, y: 10 + Math.random() * 48 };
  }

  private resolveDestination(event: AbstractEvent, origin: Vec2): Vec2 {
    // If target player exists, use their position
    if (event.to) {
      const targetPos = this.resolvePosition(event.to);
      // Add slight offset for receiving position (lead pass)
      const leadX = event.type === 'through_ball' ? 5 + Math.random() * 8 : Math.random() * 3;
      const leadY = (Math.random() - 0.5) * 4;
      return {
        x: clamp(targetPos.x + leadX, 0, PITCH_WIDTH),
        y: clamp(targetPos.y + leadY, 0, PITCH_HEIGHT),
      };
    }

    // Zone-based destination
    if (event.zone) {
      const zoneCenter = ZONE_CENTERS[event.zone];
      if (zoneCenter) {
        return {
          x: clamp(zoneCenter.x + (Math.random() - 0.5) * 12, 0, PITCH_WIDTH),
          y: clamp(zoneCenter.y + (Math.random() - 0.5) * 10, 0, PITCH_HEIGHT),
        };
      }
    }

    // Type-based destination inference
    switch (event.type) {
      case 'shot':
        return { x: PITCH_WIDTH - 2, y: 30 + Math.random() * 8 };
      case 'clearance':
        return { x: origin.x + 20 + Math.random() * 25, y: 10 + Math.random() * 48 };
      case 'goal_kick':
        return { x: 30 + Math.random() * 20, y: 15 + Math.random() * 38 };
      case 'corner':
        return { x: PITCH_WIDTH - 8, y: 24 + Math.random() * 20 };
      case 'recovery_run':
        return { x: clamp(origin.x - 10 - Math.random() * 15, 0, PITCH_WIDTH), y: origin.y };
      default:
        // Forward progression with random lateral
        return {
          x: clamp(origin.x + (Math.random() - 0.3) * 20, 0, PITCH_WIDTH),
          y: clamp(origin.y + (Math.random() - 0.5) * 15, 0, PITCH_HEIGHT),
        };
    }
  }

  private computeTrajectory(from: Vec2, to: Vec2, type: EventType): Vec2[] {
    const points: Vec2[] = [{ ...from }];
    const steps = type === 'through_ball' || type === 'cross' ? 8 : type === 'shot' ? 6 : 4;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      // Quadratic bezier with slight curve
      const curveFactor = type === 'cross' ? 0.15 : type === 'through_ball' ? 0.08 : 0.03;
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const perpX = -(to.y - from.y) * curveFactor;
      const perpY = (to.x - from.x) * curveFactor;

      const cx = midX + perpX;
      const cy = midY + perpY;

      // Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
      const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x;
      const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y;

      points.push({ x: clamp(x, 0, PITCH_WIDTH), y: clamp(y, 0, PITCH_HEIGHT) });
    }
    points.push({ ...to });
    return points;
  }

  private inferBallSpeed(type: EventType, distance: number): number {
    // m/s based on event type and distance
    const baseSpeeds: Partial<Record<EventType, number>> = {
      pass: 12,
      shot: 28,
      through_ball: 16,
      cross: 18,
      clearance: 22,
      goal_kick: 24,
      corner: 14,
      free_kick: 20,
    };
    const base = baseSpeeds[type] ?? 10;
    // Speed scales slightly with distance
    return base + clamp(distance / 15, 0, 8);
  }

  private inferPhaseFromEvent(event: AbstractEvent): PlayerPhase {
    switch (event.type) {
      case 'shot':
      case 'dribble':
      case 'cross':
      case 'through_ball':
        return 'attacking';
      case 'tackle':
      case 'interception':
      case 'clearance':
      case 'save':
        return 'defending';
      case 'press_trigger':
        return 'pressing';
      case 'recovery_run':
        return 'transitioning';
      default:
        return 'building';
    }
  }

  private computePassingLaneWidth(from: Vec2, to: Vec2): number {
    // Simulate: wider lane = safer pass
    const dist = vec2Dist(from, to);
    if (dist < 5) return 8; // short pass = wide lane
    // Reduce lane width with distance and forward progression
    const forwardPenalty = Math.max(0, (to.x - from.x) / 50); // forward passes are riskier
    return clamp(10 - dist / 8 - forwardPenalty * 3, 0.5, 10);
  }

  private computePressure(pos: Vec2): number {
    // Pressure is higher in congested areas (midfield) and lower on flanks
    const centerDist = Math.abs(pos.y - PITCH_HEIGHT / 2);
    const midFieldDist = Math.abs(pos.x - PITCH_WIDTH / 2);
    const basePressure = 0.3;
    const centerBonus = clamp(1 - centerDist / 34, 0, 0.3);
    const midBonus = clamp(1 - midFieldDist / 52, 0, 0.2);
    return clamp(basePressure + centerBonus + midBonus + Math.random() * 0.15, 0, 1);
  }

  private computeOpenSpace(pos: Vec2): number {
    // Space is higher on flanks and behind defensive line
    const centerDist = Math.abs(pos.y - PITCH_HEIGHT / 2);
    const flankBonus = clamp(centerDist / 34, 0, 0.3);
    const baseSpace = 0.4 + Math.random() * 0.2;
    return clamp(baseSpace + flankBonus, 0, 1);
  }

  private determinePhaseShift(event: AbstractEvent, currentPhase: PlayerPhase): PlayerPhase | null {
    // Events that trigger team-wide phase transitions
    switch (event.type) {
      case 'interception':
      case 'tackle':
        return currentPhase === 'defending' ? 'transitioning' : null;
      case 'goal':
        return 'defending'; // restart from defending
      case 'press_trigger':
        return 'pressing';
      case 'shot':
        return event.success ? null : 'transitioning'; // missed shot → transition
      default:
        return null;
    }
  }

  private determineAttractorMutation(event: AbstractEvent, destination: Vec2): AttractorMutation | null {
    switch (event.type) {
      case 'pass':
      case 'through_ball':
      case 'cross':
        // Ball attractor moves to destination
        return {
          action: 'move',
          type: 'ball',
          position: { ...destination },
          radius: 15,
          strength: 0.8,
        };
      case 'shot':
        return {
          action: 'move',
          type: 'ball',
          position: { x: PITCH_WIDTH - 2, y: 34 },
          radius: 12,
          strength: 1.0,
        };
      case 'press_trigger':
        // Create temporary pressing attractor at ball zone
        return {
          action: 'create',
          type: 'tactical',
          position: { ...this.ballPosition },
          radius: 18,
          strength: 0.9,
        };
      case 'goal_kick':
      case 'clearance':
        return {
          action: 'move',
          type: 'ball',
          position: { ...destination },
          radius: 20,
          strength: 0.6,
        };
      default:
        return null;
    }
  }

  private computeEnergyDelta(event: AbstractEvent, distance: number, ballSpeed: number): number {
    const typeEnergy: Partial<Record<EventType, number>> = {
      pass: 0.1,
      shot: 0.8,
      through_ball: 0.4,
      cross: 0.3,
      dribble: 0.2,
      tackle: 0.5,
      press_trigger: 0.6,
      interception: 0.3,
      clearance: 0.4,
      recovery_run: 0.15,
      goal: 1.0,
    };
    const base = typeEnergy[event.type] ?? 0.1;
    return base + (distance / 100) * 0.2 + (ballSpeed / 30) * 0.1;
  }

  private updateStateFromEvent(event: AbstractEvent, origin: Vec2, destination: Vec2): void {
    // Update ball position
    if (['pass', 'shot', 'through_ball', 'cross', 'clearance', 'goal_kick', 'corner', 'free_kick'].includes(event.type)) {
      this.ballPosition = { ...destination };
    }

    // Update actor position (they moved toward the ball before acting)
    this.playerPositions.set(event.from, { ...origin });

    // Update actor phase
    const newPhase = this.inferPhaseFromEvent(event);
    this.playerPhases.set(event.from, newPhase);

    // If target, update their phase to match receiving
    if (event.to && event.success !== false) {
      this.playerPositions.set(event.to, { ...destination });
      this.playerPhases.set(event.to, 'building');
    }

    // Increase load on actor
    const currentLoad = this.playerLoads.get(event.from) ?? 50;
    const loadIncrease = event.type === 'press_trigger' || event.type === 'recovery_run' ? 5 : 2;
    this.playerLoads.set(event.from, clamp(currentLoad + loadIncrease, 0, 100));
  }
}
