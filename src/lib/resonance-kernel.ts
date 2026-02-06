/**
 * BigDunc Resonance Kernel — @bigdunc/resonance-kernel
 *
 * Quantum-inspired, field-theoretic engine for football team dynamics.
 * Treats the pitch as a continuous field where players are wave packets.
 * Detects resonance drops and phase drifts BEFORE breakdowns happen.
 */

// ======================== Types ========================

export type PlayerPhase = 'defending' | 'pressing' | 'building' | 'attacking' | 'transitioning';
export type AttractorType = 'tactical' | 'ball' | 'space' | 'defensive' | 'offensive';

export interface Vec2 {
  x: number;
  y: number;
}

export interface WaveFunction {
  amplitude: number;   // energy/load 0–1
  frequency: number;   // movement rhythm Hz
  phase: number;       // tactical alignment radians
  wavelength: number;  // spatial coverage meters
}

export interface KernelPlayer {
  id: string;
  position: Vec2;
  velocity: Vec2;
  wave: WaveFunction;
  state: PlayerPhase;
  load: number;         // 0–100
  tacticalCharge: number; // -1 to +1
}

export interface Attractor {
  id: string;
  type: AttractorType;
  position: Vec2;
  radius: number;
  strength: number;
  decay: number;
}

export interface EntanglementPair {
  playerA: string;
  playerB: string;
  correlation: number;
}

export interface PlayerCoherence {
  id: string;
  density: number;
  deviation: number;
  phaseAlignment: number;
  coherenceScore: number;
}

export interface DriftPrediction {
  region: string;
  severity: number;
  timeToCollapse: number;
  description: string;
}

export interface KernelOutput {
  tick: number;
  harmony: number;
  players: Record<string, PlayerCoherence>;
  entanglements: EntanglementPair[];
  fieldEnergy: number;
  drifts: DriftPrediction[];
}

// ======================== Constants ========================

export const PITCH_WIDTH = 105;
export const PITCH_HEIGHT = 68;
export const ENTANGLEMENT_THRESHOLD = 0.3;

const COULOMB_K = 0.5;
const DIFFUSION_RATE = 0.02;
const DRIFT_RATE = 0.1;

export const PHASE_MAP: Record<PlayerPhase, number> = {
  defending: 0,
  pressing: Math.PI * 0.4,
  building: Math.PI * 0.8,
  attacking: Math.PI * 1.2,
  transitioning: Math.PI * 1.6,
};

// ======================== Utilities ========================

export function vec2Dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function vec2Normalize(v: Vec2): Vec2 {
  const mag = Math.sqrt(v.x ** 2 + v.y ** 2);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

export function rbfKernel(a: Vec2, b: Vec2, sigma: number = 15): number {
  const d = vec2Dist(a, b);
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ======================== ResonanceKernel ========================

export class ResonanceKernel {
  private players: Map<string, KernelPlayer> = new Map();
  private attractors: Map<string, Attractor> = new Map();
  private tickCount: number = 0;
  private history: KernelOutput[] = [];

  /** Add a player wave packet to the field. */
  addPlayer(id: string, x: number, y: number, state: PlayerPhase, load: number): void {
    const normLoad = clamp(load, 0, 100);
    const wave: WaveFunction = {
      amplitude: clamp(normLoad / 100, 0.1, 1.0),
      frequency: 0.5 + normLoad / 200,
      phase: PHASE_MAP[state] + (Math.random() * 0.2 - 0.1),
      wavelength: 8 + (1 - normLoad / 100) * 12,
    };
    this.players.set(id, {
      id,
      position: { x: clamp(x, 0, PITCH_WIDTH), y: clamp(y, 0, PITCH_HEIGHT) },
      velocity: { x: 0, y: 0 },
      wave,
      state,
      load: normLoad,
      tacticalCharge: this.chargeFromState(state),
    });
  }

  /** Place a field attractor (tactical shape, ball, space, etc.). */
  addAttractor(type: AttractorType, x: number, y: number, radius: number, strength: number): string {
    const id = `attr_${type}_${this.attractors.size}`;
    this.attractors.set(id, {
      id,
      type,
      position: { x: clamp(x, 0, PITCH_WIDTH), y: clamp(y, 0, PITCH_HEIGHT) },
      radius: Math.max(1, radius),
      strength: clamp(strength, 0, 1),
      decay: 1 / Math.max(1, radius),
    });
    return id;
  }

  removeAttractor(id: string): void {
    this.attractors.delete(id);
  }

  /** Advance the field by deltaT seconds. Returns the kernel output snapshot. */
  tick(deltaT: number = 1): KernelOutput {
    this.tickCount++;

    this.applyAttractorForces(deltaT);
    this.applyCoulombForces(deltaT);
    this.evolveWaves(deltaT);
    this.updatePositions(deltaT);

    const harmony = this.getFieldHarmony();
    const entanglements = this.getEntanglementMap();
    const playerCoherence: Record<string, PlayerCoherence> = {};
    for (const [id] of this.players) {
      playerCoherence[id] = this.getPlayerCoherence(id);
    }
    const drifts = this.detectDrifts(harmony, playerCoherence);
    const fieldEnergy = this.computeFieldEnergy();

    const output: KernelOutput = {
      tick: this.tickCount,
      harmony,
      players: playerCoherence,
      entanglements,
      fieldEnergy,
      drifts,
    };
    this.history.push(output);
    return output;
  }

  /** Overall field harmony: phase alignment + amplitude uniformity. */
  getFieldHarmony(): number {
    const players = Array.from(this.players.values());
    if (players.length < 2) return 1;

    let totalAlignment = 0;
    let pairs = 0;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        totalAlignment += Math.cos(players[i].wave.phase - players[j].wave.phase);
        pairs++;
      }
    }
    const avgAlignment = pairs > 0 ? totalAlignment / pairs : 0;

    const totalAmplitude = players.reduce((s, p) => s + p.wave.amplitude, 0);
    let entropy = 0;
    for (const p of players) {
      const prob = p.wave.amplitude / totalAmplitude;
      if (prob > 0) entropy -= prob * Math.log2(prob);
    }
    const maxEntropy = Math.log2(players.length);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

    return clamp(0.7 * ((avgAlignment + 1) / 2) + 0.3 * (1 - normalizedEntropy), 0, 1);
  }

  /** Per-player coherence: density |ψ|², phase alignment, positional deviation. */
  getPlayerCoherence(id: string): PlayerCoherence {
    const player = this.players.get(id);
    if (!player) return { id, density: 0, deviation: 1, phaseAlignment: 0, coherenceScore: 0 };

    const density = player.wave.amplitude ** 2;

    const allPlayers = Array.from(this.players.values());
    const avgPhase = allPlayers.reduce((s, p) => s + p.wave.phase, 0) / allPlayers.length;
    const phaseAlignment = (Math.cos(player.wave.phase - avgPhase) + 1) / 2;

    let minDeviation = 1;
    for (const attr of this.attractors.values()) {
      const d = vec2Dist(player.position, attr.position);
      minDeviation = Math.min(minDeviation, clamp(d / (attr.radius * 3), 0, 1));
    }
    const deviation = this.attractors.size > 0 ? minDeviation : 0.5;

    const coherenceScore = clamp(
      0.4 * density + 0.35 * phaseAlignment + 0.25 * (1 - deviation),
      0, 1,
    );
    return { id, density, deviation, phaseAlignment, coherenceScore };
  }

  /** Entangled pairs: phase correlation × spatial RBF above threshold. */
  getEntanglementMap(): EntanglementPair[] {
    const pairs: EntanglementPair[] = [];
    const players = Array.from(this.players.values());
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const spatial = rbfKernel(players[i].position, players[j].position, 20);
        const phaseCorr = (Math.cos(players[i].wave.phase - players[j].wave.phase) + 1) / 2;
        const correlation = spatial * phaseCorr;
        if (correlation > ENTANGLEMENT_THRESHOLD) {
          pairs.push({ playerA: players[i].id, playerB: players[j].id, correlation });
        }
      }
    }
    return pairs.sort((a, b) => b.correlation - a.correlation);
  }

  getPlayer(id: string): KernelPlayer | undefined {
    return this.players.get(id);
  }

  getPlayers(): KernelPlayer[] {
    return Array.from(this.players.values());
  }

  getAttractors(): Attractor[] {
    return Array.from(this.attractors.values());
  }

  getHistory(): KernelOutput[] {
    return this.history;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  /** Monte Carlo: run N perturbation scenarios, return harmony distribution. */
  monteCarloWhatIf(scenarios: number, ticksAhead: number): { avgHarmony: number; worstCase: number; bestCase: number } {
    let totalHarmony = 0;
    let worst = 1;
    let best = 0;
    const snapshot = this.serializeState();

    for (let s = 0; s < scenarios; s++) {
      this.deserializeState(snapshot);
      for (const player of this.players.values()) {
        player.position.x += (Math.random() - 0.5) * 4;
        player.position.y += (Math.random() - 0.5) * 4;
        player.wave.phase += (Math.random() - 0.5) * 0.3;
      }
      let finalHarmony = 0;
      for (let t = 0; t < ticksAhead; t++) {
        finalHarmony = this.tick(1).harmony;
      }
      totalHarmony += finalHarmony;
      worst = Math.min(worst, finalHarmony);
      best = Math.max(best, finalHarmony);
    }

    this.deserializeState(snapshot);
    return { avgHarmony: totalHarmony / scenarios, worstCase: worst, bestCase: best };
  }

  // ———————— Private ————————

  private chargeFromState(state: PlayerPhase): number {
    switch (state) {
      case 'defending': return -0.8;
      case 'pressing': return -0.4;
      case 'building': return 0;
      case 'attacking': return 0.6;
      case 'transitioning': return 0.2;
    }
  }

  private applyAttractorForces(deltaT: number): void {
    for (const player of this.players.values()) {
      let fx = 0, fy = 0;
      for (const attr of this.attractors.values()) {
        const d = vec2Dist(player.position, attr.position);
        if (d < 0.5) continue;
        const force = attr.strength * Math.exp(-d * attr.decay);
        const dir = vec2Normalize({
          x: attr.position.x - player.position.x,
          y: attr.position.y - player.position.y,
        });
        let mult = 1;
        if (attr.type === 'ball' && (player.state === 'attacking' || player.state === 'pressing')) mult = 1.5;
        if (attr.type === 'defensive' && player.state === 'defending') mult = 1.3;
        fx += dir.x * force * mult;
        fy += dir.y * force * mult;
      }
      player.velocity.x += fx * DRIFT_RATE * deltaT;
      player.velocity.y += fy * DRIFT_RATE * deltaT;
    }
  }

  private applyCoulombForces(deltaT: number): void {
    const players = Array.from(this.players.values());
    for (let i = 0; i < players.length; i++) {
      let fx = 0, fy = 0;
      for (let j = 0; j < players.length; j++) {
        if (i === j) continue;
        const d = vec2Dist(players[i].position, players[j].position);
        if (d < 1) continue;
        const chargeProduct = players[i].tacticalCharge * players[j].tacticalCharge;
        const forceMag = COULOMB_K * chargeProduct / (d * d);
        const dir = vec2Normalize({
          x: players[i].position.x - players[j].position.x,
          y: players[i].position.y - players[j].position.y,
        });
        fx += dir.x * forceMag;
        fy += dir.y * forceMag;
      }
      players[i].velocity.x += fx * deltaT;
      players[i].velocity.y += fy * deltaT;
    }
  }

  private evolveWaves(deltaT: number): void {
    const players = Array.from(this.players.values());
    const avgPhase = players.reduce((s, p) => s + p.wave.phase, 0) / players.length;

    for (const player of players) {
      // Diffusion: amplitude decays (fatigue)
      player.wave.amplitude *= 1 - DIFFUSION_RATE * deltaT * 0.1;
      player.wave.amplitude = clamp(player.wave.amplitude, 0.05, 1);

      // Phase drift toward team average (tactical coherence pull)
      player.wave.phase += Math.sin(avgPhase - player.wave.phase) * DRIFT_RATE * deltaT;

      // Frequency from speed
      const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
      player.wave.frequency = 0.5 + clamp(speed / 10, 0, 0.5);

      // Wavelength inversely proportional to amplitude
      player.wave.wavelength = 8 + (1 - player.wave.amplitude) * 12;

      // Tanh stimulus response
      const stimulus = speed * player.wave.amplitude;
      player.wave.phase += Math.tanh(stimulus) * 0.01 * deltaT;
    }
  }

  private updatePositions(deltaT: number): void {
    for (const player of this.players.values()) {
      player.position.x = clamp(player.position.x + player.velocity.x * deltaT, 0, PITCH_WIDTH);
      player.position.y = clamp(player.position.y + player.velocity.y * deltaT, 0, PITCH_HEIGHT);
      player.velocity.x *= 0.85;
      player.velocity.y *= 0.85;
    }
  }

  private computeFieldEnergy(): number {
    let energy = 0;
    for (const player of this.players.values()) {
      energy += 0.5 * (player.velocity.x ** 2 + player.velocity.y ** 2);
      energy += player.wave.amplitude ** 2;
    }
    return energy;
  }

  private detectDrifts(harmony: number, coherence: Record<string, PlayerCoherence>): DriftPrediction[] {
    const drifts: DriftPrediction[] = [];

    if (this.history.length >= 3) {
      const recent = this.history.slice(-3);
      const harmonyTrend = recent[recent.length - 1].harmony - recent[0].harmony;
      if (harmonyTrend < -0.05) {
        const timeToCollapse = Math.max(1, Math.abs(harmony / harmonyTrend));
        drifts.push({
          region: 'global',
          severity: clamp(Math.abs(harmonyTrend) * 10, 0, 1),
          timeToCollapse: clamp(timeToCollapse, 1, 10),
          description: `Global harmony declining at ${(harmonyTrend * 100).toFixed(1)}%/tick`,
        });
      }
    }

    const zones: Record<string, string[]> = { defensive: [], midfield: [], attacking: [] };
    for (const p of this.players.values()) {
      if (p.position.x < 35) zones.defensive.push(p.id);
      else if (p.position.x < 70) zones.midfield.push(p.id);
      else zones.attacking.push(p.id);
    }

    for (const [zoneName, playerIds] of Object.entries(zones)) {
      if (playerIds.length < 2) continue;
      const avgCoh = playerIds.reduce((s, id) => s + (coherence[id]?.coherenceScore ?? 0), 0) / playerIds.length;
      if (avgCoh < 0.4) {
        drifts.push({
          region: zoneName,
          severity: clamp(1 - avgCoh, 0, 1),
          timeToCollapse: clamp((avgCoh / 0.4) * 6, 1, 6),
          description: `${zoneName} zone coherence low (${(avgCoh * 100).toFixed(0)}%) — shape at risk`,
        });
      }
    }

    return drifts;
  }

  private serializeState(): string {
    return JSON.stringify({
      players: Array.from(this.players.entries()),
      attractors: Array.from(this.attractors.entries()),
      tickCount: this.tickCount,
      history: this.history,
    });
  }

  private deserializeState(json: string): void {
    const state = JSON.parse(json);
    this.players = new Map(state.players);
    this.attractors = new Map(state.attractors);
    this.tickCount = state.tickCount;
    this.history = state.history ?? [];
  }
}
