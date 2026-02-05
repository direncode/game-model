/**
 * RESONANCE KERNEL - The Core Foundation
 *
 * Multi-spectrum resonant wave functions with electrostatic attractor dynamics.
 * This is the fundamental layer upon which all tactical intelligence is built.
 *
 * The kernel computes spatial-temporal relationships through:
 * 1. Wave Function Representation - Each player as a quantum-like waveform
 * 2. Kernel Coordinates - RBF kernel for spatial similarity
 * 3. Electrostatic Fields - Attraction/repulsion energy dynamics
 * 4. Resonance Coherence - Phase alignment across the collective
 */

// ==================== FUNDAMENTAL TYPES ====================

export interface WaveFunction {
  playerId: string;
  // Wave parameters
  amplitude: number;           // Energy magnitude [0-1]
  frequency: number;           // Oscillation rate (Hz)
  phase: number;               // Phase angle (radians)
  wavelength: number;          // Spatial extent (meters)

  // Position in phase space
  position: { x: number; y: number };
  momentum: { px: number; py: number };

  // Quantum-inspired properties
  probability: number;         // Probability density |ψ|²
  superposition: number[];     // Superposition coefficients
  entanglement: Map<string, number>; // Entanglement with other players
}

export interface ElectrostaticField {
  // Field properties
  charge: number;              // Player's tactical charge (-1 to +1)
  fieldStrength: number;       // E-field magnitude
  potential: number;           // Voltage at position

  // Gradient (force direction)
  gradient: { gx: number; gy: number };

  // Energy
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
}

export interface KernelCoordinate {
  playerId: string;
  // Raw coordinates
  x: number;
  y: number;
  z: number;  // Tactical height/pressure layer

  // Kernel-transformed coordinates
  kernelX: number;
  kernelY: number;
  kernelZ: number;

  // Similarity to ideal position
  kernelSimilarity: number;

  // Manifold embedding
  embeddingDim: number[];
}

export interface ResonanceState {
  // Individual wave states
  waveFunctions: Map<string, WaveFunction>;

  // Collective field
  electrostaticField: ElectrostaticField[];

  // Kernel coordinates
  kernelCoordinates: Map<string, KernelCoordinate>;

  // Global coherence metrics
  collectiveResonance: number;
  phaseCoherence: number;
  energyBalance: number;
  fieldStability: number;

  // Attractor states
  attractors: AttractorPoint[];

  // Timestamp
  timestamp: number;
  matchMinute: number;
}

export interface AttractorPoint {
  id: string;
  type: 'tactical' | 'ball' | 'space' | 'defensive' | 'offensive';
  position: { x: number; y: number };
  strength: number;           // Attraction magnitude
  radius: number;             // Effective radius
  charge: 'positive' | 'negative' | 'neutral';
  decayRate: number;          // How fast attraction fades
  players: string[];          // Players in this attractor's influence
}

export interface ResonanceCoherence {
  overall: number;            // 0-100 collective coherence
  waveAlignment: number;      // Phase alignment score
  fieldHarmony: number;       // Electrostatic balance
  kernelDensity: number;      // Spatial clustering quality
  attractorEfficiency: number;// How well players follow attractors

  // Per-unit coherence
  defensiveLine: number;
  midfieldBlock: number;
  attackingShape: number;

  // Anomalies
  decoherenceZones: { x: number; y: number; severity: number }[];
  resonanceBreaks: { playerId: string; deviation: number }[];
}

// ==================== PHYSICAL CONSTANTS ====================

const CONSTANTS = {
  // Wave mechanics
  PLANCK_TACTICAL: 0.1,       // Minimum tactical action quantum
  BASE_FREQUENCY: 1.0,        // Base oscillation (1 Hz)
  PHASE_VELOCITY: 10.0,       // Wave propagation speed (m/s)

  // Electrostatics
  COULOMB_TACTICAL: 8.99,     // Tactical Coulomb constant
  PERMITTIVITY: 0.1,          // Tactical permittivity
  CHARGE_DECAY: 0.95,         // Charge decay per tick

  // Kernel
  RBF_SIGMA: 10.0,            // RBF kernel bandwidth
  KERNEL_THRESHOLD: 0.5,      // Minimum kernel similarity

  // Attractors
  ATTRACTOR_BASE_STRENGTH: 1.0,
  ATTRACTOR_MIN_RADIUS: 5.0,
  ATTRACTOR_MAX_RADIUS: 25.0,

  // Energy
  MAX_KINETIC: 100.0,
  MAX_POTENTIAL: 100.0,
};

// ==================== RESONANCE KERNEL ENGINE ====================

export class ResonanceKernelEngine {
  private state: ResonanceState;
  private history: ResonanceState[] = [];
  private historyLimit = 100;

  // Ideal tactical positions (the "ground state")
  private groundState: Map<string, { x: number; y: number; role: string }> = new Map();

  constructor() {
    this.state = this.initializeState();
  }

  private initializeState(): ResonanceState {
    return {
      waveFunctions: new Map(),
      electrostaticField: [],
      kernelCoordinates: new Map(),
      collectiveResonance: 0,
      phaseCoherence: 0,
      energyBalance: 0.5,
      fieldStability: 1.0,
      attractors: [],
      timestamp: Date.now(),
      matchMinute: 0,
    };
  }

  // ==================== WAVE FUNCTION OPERATIONS ====================

  /**
   * Initialize a player's wave function from tracking data
   */
  initializeWaveFunction(
    playerId: string,
    position: { x: number; y: number },
    velocity: { vx: number; vy: number },
    fatigue: number,
    role: string
  ): WaveFunction {
    // Amplitude from energy (inverse fatigue)
    const amplitude = Math.max(0.1, 1 - fatigue / 100);

    // Frequency from movement intensity
    const speed = Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2);
    const frequency = CONSTANTS.BASE_FREQUENCY * (1 + speed / 10);

    // Phase from position relative to ideal
    const ideal = this.groundState.get(playerId);
    const phaseOffset = ideal
      ? Math.atan2(position.y - ideal.y, position.x - ideal.x)
      : 0;

    // Wavelength from role (defenders have longer wavelength = more coverage)
    const wavelengthByRole: Record<string, number> = {
      GK: 30, CB: 20, RB: 15, LB: 15, CDM: 18, CM: 12, CAM: 10, RW: 8, LW: 8, ST: 6
    };
    const wavelength = wavelengthByRole[role] || 12;

    // Momentum from velocity
    const momentum = {
      px: velocity.vx * amplitude,
      py: velocity.vy * amplitude,
    };

    // Probability density (Gaussian around position)
    const probability = this.calculateProbabilityDensity(position, ideal);

    // Initial superposition (role-based tactical states)
    const superposition = this.calculateSuperposition(role, position);

    const waveFunction: WaveFunction = {
      playerId,
      amplitude,
      frequency,
      phase: phaseOffset,
      wavelength,
      position,
      momentum,
      probability,
      superposition,
      entanglement: new Map(),
    };

    this.state.waveFunctions.set(playerId, waveFunction);
    return waveFunction;
  }

  /**
   * Evolve wave function through time (Schrödinger-like evolution)
   */
  evolveWaveFunction(playerId: string, dt: number): WaveFunction | null {
    const wave = this.state.waveFunctions.get(playerId);
    if (!wave) return null;

    // Phase evolution: φ(t) = φ₀ + ω*t
    const omega = 2 * Math.PI * wave.frequency;
    wave.phase = (wave.phase + omega * dt) % (2 * Math.PI);

    // Amplitude decay (energy dissipation)
    wave.amplitude *= Math.exp(-0.01 * dt);
    wave.amplitude = Math.max(0.1, wave.amplitude);

    // Position update from momentum
    wave.position.x += wave.momentum.px * dt;
    wave.position.y += wave.momentum.py * dt;

    // Boundary conditions (pitch limits)
    wave.position.x = Math.max(0, Math.min(100, wave.position.x));
    wave.position.y = Math.max(0, Math.min(100, wave.position.y));

    // Recalculate probability
    const ideal = this.groundState.get(playerId);
    wave.probability = this.calculateProbabilityDensity(wave.position, ideal);

    return wave;
  }

  /**
   * Calculate wave interference between two players
   */
  calculateInterference(player1Id: string, player2Id: string): number {
    const wave1 = this.state.waveFunctions.get(player1Id);
    const wave2 = this.state.waveFunctions.get(player2Id);

    if (!wave1 || !wave2) return 0;

    // Superposition principle: ψ_total = ψ_1 + ψ_2
    // Interference: I = |ψ_1|² + |ψ_2|² + 2|ψ_1||ψ_2|cos(Δφ)
    const phaseDiff = wave1.phase - wave2.phase;
    const interference =
      wave1.amplitude ** 2 +
      wave2.amplitude ** 2 +
      2 * wave1.amplitude * wave2.amplitude * Math.cos(phaseDiff);

    return interference;
  }

  /**
   * Calculate collective wave function (team superposition)
   */
  calculateCollectiveWaveFunction(playerIds: string[]): {
    totalAmplitude: number;
    meanPhase: number;
    coherenceLength: number;
  } {
    const waves = playerIds
      .map(id => this.state.waveFunctions.get(id))
      .filter(Boolean) as WaveFunction[];

    if (waves.length === 0) {
      return { totalAmplitude: 0, meanPhase: 0, coherenceLength: 0 };
    }

    // Total amplitude (superposition)
    let realPart = 0;
    let imagPart = 0;

    for (const wave of waves) {
      realPart += wave.amplitude * Math.cos(wave.phase);
      imagPart += wave.amplitude * Math.sin(wave.phase);
    }

    const totalAmplitude = Math.sqrt(realPart ** 2 + imagPart ** 2);
    const meanPhase = Math.atan2(imagPart, realPart);

    // Coherence length (how aligned are phases)
    const coherenceLength = totalAmplitude / waves.length;

    return { totalAmplitude, meanPhase, coherenceLength };
  }

  private calculateProbabilityDensity(
    position: { x: number; y: number },
    ideal?: { x: number; y: number }
  ): number {
    if (!ideal) return 0.5;

    const dx = position.x - ideal.x;
    const dy = position.y - ideal.y;
    const r2 = dx * dx + dy * dy;

    // Gaussian probability: |ψ|² = exp(-r²/2σ²)
    const sigma = 10; // Standard deviation
    return Math.exp(-r2 / (2 * sigma * sigma));
  }

  private calculateSuperposition(role: string, position: { x: number; y: number }): number[] {
    // Superposition of tactical states: [defending, pressing, building, attacking, transitioning]
    const states = [0, 0, 0, 0, 0];

    // Position-based superposition
    if (position.y < 30) {
      states[0] = 0.6; // Defending
      states[1] = 0.3; // Pressing
    } else if (position.y < 50) {
      states[2] = 0.5; // Building
      states[4] = 0.3; // Transitioning
    } else if (position.y < 70) {
      states[2] = 0.3; // Building
      states[3] = 0.4; // Attacking
      states[4] = 0.3; // Transitioning
    } else {
      states[3] = 0.7; // Attacking
      states[1] = 0.2; // Pressing (high)
    }

    // Normalize
    const sum = states.reduce((a, b) => a + b, 0);
    return states.map(s => s / (sum || 1));
  }

  // ==================== ELECTROSTATIC FIELD OPERATIONS ====================

  /**
   * Calculate electrostatic field for a player
   */
  calculateElectrostaticField(
    playerId: string,
    teammates: { id: string; x: number; y: number }[],
    opponents: { id: string; x: number; y: number }[],
    ballPosition: { x: number; y: number }
  ): ElectrostaticField {
    const wave = this.state.waveFunctions.get(playerId);
    if (!wave) {
      return this.createNeutralField();
    }

    const pos = wave.position;

    // Player's charge based on tactical role and state
    // Positive charge = attracts ball/space
    // Negative charge = repels (defensive)
    const charge = this.calculateTacticalCharge(wave);

    // Calculate field from all other charges
    let Ex = 0, Ey = 0;
    let potentialEnergy = 0;

    // Teammate interactions (same sign - repulsion for spacing)
    for (const mate of teammates) {
      if (mate.id === playerId) continue;

      const dx = pos.x - mate.x;
      const dy = pos.y - mate.y;
      const r = Math.sqrt(dx * dx + dy * dy) || 0.1;

      // Coulomb's law: F = k * q1 * q2 / r²
      const mateWave = this.state.waveFunctions.get(mate.id);
      const mateCharge = mateWave ? this.calculateTacticalCharge(mateWave) : 0.5;

      const force = CONSTANTS.COULOMB_TACTICAL * charge * mateCharge / (r * r);
      Ex += force * (dx / r);
      Ey += force * (dy / r);

      potentialEnergy += CONSTANTS.COULOMB_TACTICAL * charge * mateCharge / r;
    }

    // Opponent interactions (opposite sign - attraction for pressing)
    for (const opp of opponents) {
      const dx = pos.x - opp.x;
      const dy = pos.y - opp.y;
      const r = Math.sqrt(dx * dx + dy * dy) || 0.1;

      // Opponents have opposite charge (attracts for pressing)
      const oppCharge = -0.5;
      const force = CONSTANTS.COULOMB_TACTICAL * charge * oppCharge / (r * r);
      Ex += force * (dx / r);
      Ey += force * (dy / r);

      potentialEnergy += CONSTANTS.COULOMB_TACTICAL * charge * oppCharge / r;
    }

    // Ball attraction (strong positive attractor)
    const ballDx = ballPosition.x - pos.x;
    const ballDy = ballPosition.y - pos.y;
    const ballR = Math.sqrt(ballDx * ballDx + ballDy * ballDy) || 0.1;
    const ballAttraction = 5.0 * charge / (ballR + 1);
    Ex += ballAttraction * (ballDx / ballR);
    Ey += ballAttraction * (ballDy / ballR);

    const fieldStrength = Math.sqrt(Ex * Ex + Ey * Ey);
    const potential = potentialEnergy / (teammates.length + opponents.length + 1);

    // Kinetic energy from momentum
    const kineticEnergy = 0.5 * (wave.momentum.px ** 2 + wave.momentum.py ** 2);

    return {
      charge,
      fieldStrength,
      potential,
      gradient: { gx: Ex, gy: Ey },
      kineticEnergy,
      potentialEnergy: Math.abs(potentialEnergy),
      totalEnergy: kineticEnergy + Math.abs(potentialEnergy),
    };
  }

  /**
   * Calculate tactical charge from wave function
   */
  private calculateTacticalCharge(wave: WaveFunction): number {
    // Charge = weighted sum of superposition states
    // [defending(-), pressing(+), building(0), attacking(+), transitioning(0)]
    const weights = [-0.5, 0.8, 0.0, 0.7, 0.0];
    let charge = 0;

    for (let i = 0; i < wave.superposition.length; i++) {
      charge += wave.superposition[i] * weights[i];
    }

    // Amplitude modulates charge strength
    return charge * wave.amplitude;
  }

  private createNeutralField(): ElectrostaticField {
    return {
      charge: 0,
      fieldStrength: 0,
      potential: 0,
      gradient: { gx: 0, gy: 0 },
      kineticEnergy: 0,
      potentialEnergy: 0,
      totalEnergy: 0,
    };
  }

  // ==================== KERNEL COORDINATE OPERATIONS ====================

  /**
   * Transform position to kernel coordinates using RBF kernel
   */
  calculateKernelCoordinates(
    playerId: string,
    position: { x: number; y: number },
    idealPosition: { x: number; y: number },
    tacticalLayer: number
  ): KernelCoordinate {
    // RBF Kernel: K(x, y) = exp(-||x-y||² / 2σ²)
    const dx = position.x - idealPosition.x;
    const dy = position.y - idealPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const kernelSimilarity = Math.exp(
      -(distance * distance) / (2 * CONSTANTS.RBF_SIGMA * CONSTANTS.RBF_SIGMA)
    );

    // Kernel-transformed coordinates (project to feature space)
    // Using polynomial + RBF combination
    const kernelX = position.x * kernelSimilarity + idealPosition.x * (1 - kernelSimilarity);
    const kernelY = position.y * kernelSimilarity + idealPosition.y * (1 - kernelSimilarity);
    const kernelZ = tacticalLayer * kernelSimilarity;

    // Manifold embedding (higher dimensional representation)
    const embeddingDim = [
      Math.cos(position.x * Math.PI / 100) * kernelSimilarity,
      Math.sin(position.y * Math.PI / 100) * kernelSimilarity,
      Math.exp(-distance / 20),
      tacticalLayer / 3,
    ];

    const coord: KernelCoordinate = {
      playerId,
      x: position.x,
      y: position.y,
      z: tacticalLayer,
      kernelX,
      kernelY,
      kernelZ,
      kernelSimilarity,
      embeddingDim,
    };

    this.state.kernelCoordinates.set(playerId, coord);
    return coord;
  }

  /**
   * Calculate kernel matrix for all players (Gram matrix)
   */
  calculateKernelMatrix(playerIds: string[]): number[][] {
    const n = playerIds.length;
    const K: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const coord1 = this.state.kernelCoordinates.get(playerIds[i]);
        const coord2 = this.state.kernelCoordinates.get(playerIds[j]);

        if (coord1 && coord2) {
          // RBF kernel between kernel coordinates
          const dx = coord1.kernelX - coord2.kernelX;
          const dy = coord1.kernelY - coord2.kernelY;
          const dz = coord1.kernelZ - coord2.kernelZ;
          const dist2 = dx * dx + dy * dy + dz * dz;

          K[i][j] = Math.exp(-dist2 / (2 * CONSTANTS.RBF_SIGMA * CONSTANTS.RBF_SIGMA));
        }
      }
    }

    return K;
  }

  // ==================== ATTRACTOR DYNAMICS ====================

  /**
   * Create tactical attractor point
   */
  createAttractor(
    type: AttractorPoint['type'],
    position: { x: number; y: number },
    strength: number,
    charge: AttractorPoint['charge']
  ): AttractorPoint {
    const attractor: AttractorPoint = {
      id: `attr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      position,
      strength: strength * CONSTANTS.ATTRACTOR_BASE_STRENGTH,
      radius: Math.max(
        CONSTANTS.ATTRACTOR_MIN_RADIUS,
        Math.min(CONSTANTS.ATTRACTOR_MAX_RADIUS, strength * 10)
      ),
      charge,
      decayRate: 0.98,
      players: [],
    };

    this.state.attractors.push(attractor);
    return attractor;
  }

  /**
   * Update attractor influences
   */
  updateAttractors(playerPositions: Map<string, { x: number; y: number }>): void {
    for (const attractor of this.state.attractors) {
      attractor.players = [];

      // Decay strength over time
      attractor.strength *= attractor.decayRate;

      // Find players in influence radius
      for (const [playerId, pos] of playerPositions) {
        const dx = pos.x - attractor.position.x;
        const dy = pos.y - attractor.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < attractor.radius) {
          attractor.players.push(playerId);

          // Update player's wave function based on attractor
          const wave = this.state.waveFunctions.get(playerId);
          if (wave) {
            const influence = (1 - distance / attractor.radius) * attractor.strength;

            // Attractor modifies momentum (pulls/pushes player)
            const direction = attractor.charge === 'positive' ? 1 : -1;
            wave.momentum.px += direction * influence * (attractor.position.x - pos.x) / distance * 0.1;
            wave.momentum.py += direction * influence * (attractor.position.y - pos.y) / distance * 0.1;
          }
        }
      }
    }

    // Remove dead attractors
    this.state.attractors = this.state.attractors.filter(a => a.strength > 0.1);
  }

  /**
   * Create ball-based attractor (automatic)
   */
  createBallAttractor(ballPosition: { x: number; y: number }, possession: 'home' | 'away'): void {
    // Remove old ball attractor
    this.state.attractors = this.state.attractors.filter(a => a.type !== 'ball');

    // Create new ball attractor
    this.createAttractor(
      'ball',
      ballPosition,
      possession === 'home' ? 1.5 : 0.8, // Stronger when in possession
      possession === 'home' ? 'positive' : 'negative'
    );
  }

  // ==================== COHERENCE CALCULATION ====================

  /**
   * Calculate full resonance coherence
   */
  calculateCoherence(
    homePlayerIds: string[],
    awayPlayerIds: string[],
    ballPosition: { x: number; y: number }
  ): ResonanceCoherence {
    // Wave alignment (phase coherence)
    const homeWaves = this.calculateCollectiveWaveFunction(homePlayerIds);
    const waveAlignment = homeWaves.coherenceLength * 100;

    // Field harmony (energy balance)
    let totalEnergy = 0;
    let energyVariance = 0;
    const energies: number[] = [];

    for (const playerId of homePlayerIds) {
      const field = this.state.electrostaticField.find(f =>
        this.state.waveFunctions.get(playerId)?.playerId === playerId
      );
      if (field) {
        energies.push(field.totalEnergy);
        totalEnergy += field.totalEnergy;
      }
    }

    const meanEnergy = totalEnergy / (energies.length || 1);
    for (const e of energies) {
      energyVariance += (e - meanEnergy) ** 2;
    }
    energyVariance = Math.sqrt(energyVariance / (energies.length || 1));
    const fieldHarmony = Math.max(0, 100 - energyVariance * 10);

    // Kernel density (spatial clustering)
    const kernelMatrix = this.calculateKernelMatrix(homePlayerIds);
    let kernelSum = 0;
    for (let i = 0; i < kernelMatrix.length; i++) {
      for (let j = 0; j < kernelMatrix[i].length; j++) {
        if (i !== j) kernelSum += kernelMatrix[i][j];
      }
    }
    const kernelDensity = kernelSum / (homePlayerIds.length * (homePlayerIds.length - 1) || 1) * 100;

    // Attractor efficiency
    let playersInAttractors = 0;
    for (const attractor of this.state.attractors) {
      playersInAttractors += attractor.players.filter(p => homePlayerIds.includes(p)).length;
    }
    const attractorEfficiency = (playersInAttractors / (homePlayerIds.length || 1)) * 100;

    // Line coherence calculations
    const defensivePlayers = homePlayerIds.slice(1, 5); // GK excluded
    const midfieldPlayers = homePlayerIds.slice(5, 8);
    const attackingPlayers = homePlayerIds.slice(8, 11);

    const defensiveLine = this.calculateLineCoherence(defensivePlayers);
    const midfieldBlock = this.calculateLineCoherence(midfieldPlayers);
    const attackingShape = this.calculateLineCoherence(attackingPlayers);

    // Overall coherence
    const overall = (
      waveAlignment * 0.25 +
      fieldHarmony * 0.25 +
      kernelDensity * 0.25 +
      attractorEfficiency * 0.25
    );

    // Find decoherence zones
    const decoherenceZones = this.findDecoherenceZones(homePlayerIds);

    // Find resonance breaks
    const resonanceBreaks = this.findResonanceBreaks(homePlayerIds);

    return {
      overall,
      waveAlignment,
      fieldHarmony,
      kernelDensity,
      attractorEfficiency,
      defensiveLine,
      midfieldBlock,
      attackingShape,
      decoherenceZones,
      resonanceBreaks,
    };
  }

  private calculateLineCoherence(playerIds: string[]): number {
    if (playerIds.length < 2) return 100;

    const coords = playerIds
      .map(id => this.state.kernelCoordinates.get(id))
      .filter(Boolean) as KernelCoordinate[];

    if (coords.length < 2) return 50;

    // Calculate Y variance (horizontal line alignment)
    const yValues = coords.map(c => c.y);
    const meanY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    const variance = yValues.reduce((sum, y) => sum + (y - meanY) ** 2, 0) / yValues.length;

    // Lower variance = higher coherence
    const coherence = Math.max(0, 100 - variance);
    return coherence;
  }

  private findDecoherenceZones(playerIds: string[]): { x: number; y: number; severity: number }[] {
    const zones: { x: number; y: number; severity: number }[] = [];

    // Grid-based decoherence detection
    const gridSize = 20;
    for (let x = 0; x < 100; x += gridSize) {
      for (let y = 0; y < 100; y += gridSize) {
        const playersInZone = playerIds.filter(id => {
          const coord = this.state.kernelCoordinates.get(id);
          return coord &&
            coord.x >= x && coord.x < x + gridSize &&
            coord.y >= y && coord.y < y + gridSize;
        });

        if (playersInZone.length === 0) continue;

        // Calculate local coherence
        let localCoherence = 0;
        for (const id of playersInZone) {
          const coord = this.state.kernelCoordinates.get(id);
          if (coord) localCoherence += coord.kernelSimilarity;
        }
        localCoherence /= playersInZone.length;

        if (localCoherence < 0.5) {
          zones.push({
            x: x + gridSize / 2,
            y: y + gridSize / 2,
            severity: (0.5 - localCoherence) * 2,
          });
        }
      }
    }

    return zones;
  }

  private findResonanceBreaks(playerIds: string[]): { playerId: string; deviation: number }[] {
    const breaks: { playerId: string; deviation: number }[] = [];

    for (const playerId of playerIds) {
      const wave = this.state.waveFunctions.get(playerId);
      const coord = this.state.kernelCoordinates.get(playerId);

      if (!wave || !coord) continue;

      // Check for low probability density (far from ideal)
      if (wave.probability < 0.3) {
        breaks.push({
          playerId,
          deviation: (1 - wave.probability) * 100,
        });
      }
      // Check for low kernel similarity
      else if (coord.kernelSimilarity < CONSTANTS.KERNEL_THRESHOLD) {
        breaks.push({
          playerId,
          deviation: (1 - coord.kernelSimilarity) * 50,
        });
      }
    }

    return breaks.sort((a, b) => b.deviation - a.deviation);
  }

  // ==================== MAIN UPDATE LOOP ====================

  /**
   * Full system update - call this every tick
   */
  update(
    homePlayers: {
      id: string;
      position: { x: number; y: number };
      velocity: { vx: number; vy: number };
      fatigue: number;
      role: string;
      idealPosition: { x: number; y: number };
    }[],
    awayPlayers: {
      id: string;
      position: { x: number; y: number };
    }[],
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away',
    matchMinute: number,
    dt: number = 0.1
  ): ResonanceCoherence {
    this.state.matchMinute = matchMinute;
    this.state.timestamp = Date.now();

    // Update ground state
    for (const player of homePlayers) {
      this.groundState.set(player.id, {
        x: player.idealPosition.x,
        y: player.idealPosition.y,
        role: player.role
      });
    }

    // Initialize/update wave functions
    for (const player of homePlayers) {
      const existing = this.state.waveFunctions.get(player.id);
      if (existing) {
        // Update existing wave
        existing.position = player.position;
        existing.momentum = {
          px: player.velocity.vx * existing.amplitude,
          py: player.velocity.vy * existing.amplitude,
        };
        existing.amplitude = Math.max(0.1, 1 - player.fatigue / 100);
        this.evolveWaveFunction(player.id, dt);
      } else {
        // Initialize new wave
        this.initializeWaveFunction(
          player.id,
          player.position,
          player.velocity,
          player.fatigue,
          player.role
        );
      }
    }

    // Calculate kernel coordinates
    for (const player of homePlayers) {
      const tacticalLayer = player.position.y < 35 ? 1 : player.position.y < 65 ? 2 : 3;
      this.calculateKernelCoordinates(
        player.id,
        player.position,
        player.idealPosition,
        tacticalLayer
      );
    }

    // Calculate electrostatic fields
    this.state.electrostaticField = [];
    const teammates = homePlayers.map(p => ({ id: p.id, x: p.position.x, y: p.position.y }));
    const opponents = awayPlayers.map(p => ({ id: p.id, x: p.position.x, y: p.position.y }));

    for (const player of homePlayers) {
      const field = this.calculateElectrostaticField(player.id, teammates, opponents, ballPosition);
      this.state.electrostaticField.push(field);
    }

    // Update attractors
    this.createBallAttractor(ballPosition, possession);
    const positionMap = new Map(homePlayers.map(p => [p.id, p.position]));
    this.updateAttractors(positionMap);

    // Calculate entanglement between nearby players
    this.calculateEntanglement(homePlayers.map(p => p.id));

    // Calculate coherence
    const coherence = this.calculateCoherence(
      homePlayers.map(p => p.id),
      awayPlayers.map(p => p.id),
      ballPosition
    );

    // Update global state
    this.state.collectiveResonance = coherence.overall;
    this.state.phaseCoherence = coherence.waveAlignment;
    this.state.energyBalance = coherence.fieldHarmony / 100;
    this.state.fieldStability = 1 - (coherence.decoherenceZones.length / 25);

    // Store history
    this.history.push({ ...this.state });
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    return coherence;
  }

  private calculateEntanglement(playerIds: string[]): void {
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const wave1 = this.state.waveFunctions.get(playerIds[i]);
        const wave2 = this.state.waveFunctions.get(playerIds[j]);

        if (!wave1 || !wave2) continue;

        // Distance-based entanglement
        const dx = wave1.position.x - wave2.position.x;
        const dy = wave1.position.y - wave2.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Closer players are more entangled
        const entanglement = Math.exp(-distance / 15);

        wave1.entanglement.set(playerIds[j], entanglement);
        wave2.entanglement.set(playerIds[i], entanglement);
      }
    }
  }

  // ==================== GETTERS ====================

  getState(): ResonanceState {
    return this.state;
  }

  getWaveFunction(playerId: string): WaveFunction | undefined {
    return this.state.waveFunctions.get(playerId);
  }

  getKernelCoordinate(playerId: string): KernelCoordinate | undefined {
    return this.state.kernelCoordinates.get(playerId);
  }

  getAttractors(): AttractorPoint[] {
    return this.state.attractors;
  }

  getHistory(): ResonanceState[] {
    return this.history;
  }

  /**
   * Get visualization data for the resonance field
   */
  getFieldVisualization(gridResolution: number = 10): {
    x: number;
    y: number;
    potential: number;
    fieldX: number;
    fieldY: number;
  }[] {
    const data: { x: number; y: number; potential: number; fieldX: number; fieldY: number }[] = [];

    for (let x = 0; x <= 100; x += gridResolution) {
      for (let y = 0; y <= 100; y += gridResolution) {
        let potential = 0;
        let fieldX = 0;
        let fieldY = 0;

        // Contribution from all wave functions
        for (const [, wave] of this.state.waveFunctions) {
          const dx = x - wave.position.x;
          const dy = y - wave.position.y;
          const r = Math.sqrt(dx * dx + dy * dy) || 0.1;

          // Wave contribution
          const waveContrib = wave.amplitude * Math.cos(wave.phase - 2 * Math.PI * r / wave.wavelength);
          potential += waveContrib;

          // Field contribution
          const charge = this.calculateTacticalCharge(wave);
          const fieldMag = charge / (r * r + 1);
          fieldX += fieldMag * dx / r;
          fieldY += fieldMag * dy / r;
        }

        data.push({ x, y, potential, fieldX, fieldY });
      }
    }

    return data;
  }
}

// Export singleton instance
export const resonanceKernel = new ResonanceKernelEngine();
