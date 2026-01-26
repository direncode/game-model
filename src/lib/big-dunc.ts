/**
 * BIG DUNC ALGORITHM
 *
 * A self-sustaining Markov Chain system that models tactical state transitions.
 * Named after the legendary Duncan Ferguson - unpredictable, powerful, autonomous.
 *
 * The algorithm:
 * 1. Maintains a transition matrix of state probabilities
 * 2. Tracks recurrent sequences (repeating patterns)
 * 3. Predicts next states based on current chain
 * 4. Self-evolves through continuous state generation
 * 5. Learns and adapts its transition probabilities over time
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type DuncState =
  | 'press_high' | 'press_mid' | 'press_low'
  | 'build_slow' | 'build_direct' | 'build_switch'
  | 'attack_wide' | 'attack_central' | 'attack_counter'
  | 'defend_compact' | 'defend_aggressive' | 'defend_drop'
  | 'transition_quick' | 'transition_controlled' | 'transition_reset'
  | 'idle';

export interface DuncTransition {
  from: DuncState;
  to: DuncState;
  count: number;
  probability: number;
  avgInterval: number;
  successRate: number;
  lastSeen: number;
}

export interface DuncSequence {
  id: string;
  states: DuncState[];
  occurrences: number;
  avgDuration: number;
  successRate: number;
  xG: number; // Expected value generated
  lastSeen: number;
}

export interface DuncChainState {
  transitionMatrix: Map<string, DuncTransition>;
  sequences: DuncSequence[];
  currentChain: DuncState[];
  history: { state: DuncState; timestamp: number; success: boolean }[];
  entropy: number; // Measure of unpredictability
  stability: number; // How stable the chain is
}

export interface DuncPrediction {
  nextState: DuncState;
  probability: number;
  confidence: number;
  alternatives: { state: DuncState; probability: number }[];
}

export interface DuncMetrics {
  totalTransitions: number;
  uniqueTransitions: number;
  avgChainLength: number;
  topSequences: DuncSequence[];
  currentEntropy: number;
  learningRate: number;
  chainHealth: 'strong' | 'building' | 'exploring' | 'chaotic';
}

// ============================================================================
// BIG DUNC ENGINE
// ============================================================================

export class BigDuncEngine {
  private state: DuncChainState;
  private tick: number = 0;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  // Configuration
  private readonly HISTORY_LIMIT = 500;
  private readonly SEQUENCE_MIN_LENGTH = 2;
  private readonly SEQUENCE_MAX_LENGTH = 5;
  private readonly SEQUENCE_TIMEOUT = 10; // ticks
  private readonly LEARNING_RATE = 0.1;
  private readonly EXPLORATION_RATE = 0.15; // Chance to try random transition
  private readonly DECAY_RATE = 0.995; // How fast old transitions fade

  // All possible states
  private readonly ALL_STATES: DuncState[] = [
    'press_high', 'press_mid', 'press_low',
    'build_slow', 'build_direct', 'build_switch',
    'attack_wide', 'attack_central', 'attack_counter',
    'defend_compact', 'defend_aggressive', 'defend_drop',
    'transition_quick', 'transition_controlled', 'transition_reset',
    'idle'
  ];

  // Natural transition affinities (what tends to follow what)
  private readonly TRANSITION_AFFINITIES: Record<DuncState, DuncState[]> = {
    'press_high': ['transition_quick', 'attack_counter', 'press_mid', 'defend_aggressive'],
    'press_mid': ['press_high', 'press_low', 'build_slow', 'transition_controlled'],
    'press_low': ['defend_compact', 'defend_drop', 'transition_reset', 'build_direct'],
    'build_slow': ['build_switch', 'attack_wide', 'attack_central', 'press_mid'],
    'build_direct': ['attack_counter', 'attack_wide', 'transition_quick', 'press_high'],
    'build_switch': ['attack_wide', 'build_slow', 'build_direct', 'attack_central'],
    'attack_wide': ['attack_central', 'build_switch', 'transition_quick', 'press_high'],
    'attack_central': ['attack_wide', 'attack_counter', 'build_slow', 'transition_controlled'],
    'attack_counter': ['press_high', 'transition_quick', 'attack_wide', 'defend_aggressive'],
    'defend_compact': ['defend_drop', 'press_low', 'transition_reset', 'build_direct'],
    'defend_aggressive': ['press_high', 'press_mid', 'attack_counter', 'defend_compact'],
    'defend_drop': ['defend_compact', 'transition_reset', 'build_direct', 'press_low'],
    'transition_quick': ['attack_counter', 'press_high', 'attack_wide', 'build_direct'],
    'transition_controlled': ['build_slow', 'press_mid', 'attack_central', 'defend_compact'],
    'transition_reset': ['build_slow', 'defend_compact', 'press_low', 'idle'],
    'idle': ['build_slow', 'press_mid', 'defend_compact', 'transition_controlled']
  };

  // Event callbacks
  private onStateChange: ((state: DuncState, prediction: DuncPrediction | null) => void) | null = null;
  private onSequenceDetected: ((sequence: DuncSequence) => void) | null = null;
  private onMetricsUpdate: ((metrics: DuncMetrics) => void) | null = null;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): DuncChainState {
    return {
      transitionMatrix: new Map(),
      sequences: [],
      currentChain: [],
      history: [],
      entropy: 1.0,
      stability: 0.5
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Start the self-sustaining loop
   */
  start(intervalMs: number = 500): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.evolve();
    }, intervalMs);
  }

  /**
   * Stop the loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.stop();
    this.state = this.createInitialState();
    this.tick = 0;
  }

  /**
   * Manually inject a state (external influence)
   */
  injectState(state: DuncState): void {
    this.transitionTo(state, true);
  }

  /**
   * Get current state
   */
  getCurrentState(): DuncState {
    return this.state.currentChain[this.state.currentChain.length - 1] || 'idle';
  }

  /**
   * Get current chain
   */
  getCurrentChain(): DuncState[] {
    return [...this.state.currentChain];
  }

  /**
   * Get prediction for next state
   */
  getPrediction(): DuncPrediction | null {
    const current = this.getCurrentState();
    if (current === 'idle' && this.state.history.length < 3) return null;

    const transitions = this.getTransitionsFrom(current);
    if (transitions.length === 0) return null;

    const sorted = transitions.sort((a, b) => b.probability - a.probability);
    const top = sorted[0];

    return {
      nextState: top.to,
      probability: top.probability,
      confidence: this.calculateConfidence(top),
      alternatives: sorted.slice(1, 4).map(t => ({ state: t.to, probability: t.probability }))
    };
  }

  /**
   * Get all metrics
   */
  getMetrics(): DuncMetrics {
    const transitions = Array.from(this.state.transitionMatrix.values());
    const totalCount = transitions.reduce((sum, t) => sum + t.count, 0);

    return {
      totalTransitions: totalCount,
      uniqueTransitions: transitions.length,
      avgChainLength: this.calculateAvgChainLength(),
      topSequences: this.state.sequences.slice(0, 5),
      currentEntropy: this.state.entropy,
      learningRate: this.LEARNING_RATE,
      chainHealth: this.calculateChainHealth()
    };
  }

  /**
   * Get transition matrix as array
   */
  getTransitionMatrix(): DuncTransition[] {
    return Array.from(this.state.transitionMatrix.values());
  }

  /**
   * Get sequences
   */
  getSequences(): DuncSequence[] {
    return [...this.state.sequences];
  }

  /**
   * Get history
   */
  getHistory(limit: number = 50): { state: DuncState; timestamp: number; success: boolean }[] {
    return this.state.history.slice(-limit);
  }

  /**
   * Register callbacks
   */
  onStateChanged(callback: (state: DuncState, prediction: DuncPrediction | null) => void): void {
    this.onStateChange = callback;
  }

  onSequenceFound(callback: (sequence: DuncSequence) => void): void {
    this.onSequenceDetected = callback;
  }

  onMetrics(callback: (metrics: DuncMetrics) => void): void {
    this.onMetricsUpdate = callback;
  }

  /**
   * Get tick count
   */
  getTick(): number {
    return this.tick;
  }

  /**
   * Is the engine running?
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  // ============================================================================
  // CORE ALGORITHM
  // ============================================================================

  /**
   * Main evolution step - called each tick
   */
  private evolve(): void {
    this.tick++;

    // Decay old transitions
    this.applyDecay();

    // Determine next state
    const nextState = this.determineNextState();

    // Transition to it
    this.transitionTo(nextState, Math.random() > 0.3);

    // Update entropy and stability
    this.updateDynamics();

    // Emit metrics periodically
    if (this.tick % 10 === 0 && this.onMetricsUpdate) {
      this.onMetricsUpdate(this.getMetrics());
    }
  }

  /**
   * Determine the next state based on Markov chain + exploration
   */
  private determineNextState(): DuncState {
    const current = this.getCurrentState();

    // Exploration: sometimes pick random
    if (Math.random() < this.EXPLORATION_RATE * this.state.entropy) {
      return this.getRandomAffineState(current);
    }

    // Exploitation: follow learned transitions
    const transitions = this.getTransitionsFrom(current);

    if (transitions.length === 0) {
      // No learned transitions yet, use affinities
      return this.getRandomAffineState(current);
    }

    // Weighted random selection based on probabilities
    const totalProb = transitions.reduce((sum, t) => sum + t.probability, 0);
    let rand = Math.random() * totalProb;

    for (const trans of transitions) {
      rand -= trans.probability;
      if (rand <= 0) return trans.to;
    }

    return transitions[0].to;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(nextState: DuncState, success: boolean): void {
    const current = this.getCurrentState();

    // Record transition
    if (current !== 'idle' || this.state.history.length > 0) {
      this.recordTransition(current, nextState, success);
    }

    // Add to history
    this.state.history.push({
      state: nextState,
      timestamp: this.tick,
      success
    });

    // Trim history
    if (this.state.history.length > this.HISTORY_LIMIT) {
      this.state.history.shift();
    }

    // Update current chain
    this.updateCurrentChain(nextState);

    // Detect sequences
    this.detectSequences();

    // Emit state change
    if (this.onStateChange) {
      this.onStateChange(nextState, this.getPrediction());
    }
  }

  /**
   * Record a transition in the matrix
   */
  private recordTransition(from: DuncState, to: DuncState, success: boolean): void {
    const key = `${from}->${to}`;
    const existing = this.state.transitionMatrix.get(key);

    if (existing) {
      existing.count++;
      existing.lastSeen = this.tick;
      // Update success rate with exponential moving average
      existing.successRate = existing.successRate * (1 - this.LEARNING_RATE) +
                             (success ? 1 : 0) * this.LEARNING_RATE;
    } else {
      this.state.transitionMatrix.set(key, {
        from,
        to,
        count: 1,
        probability: 0,
        avgInterval: 0,
        successRate: success ? 0.7 : 0.3,
        lastSeen: this.tick
      });
    }

    // Recalculate probabilities from this state
    this.recalculateProbabilities(from);
  }

  /**
   * Recalculate transition probabilities from a state
   */
  private recalculateProbabilities(from: DuncState): void {
    const transitions = this.getTransitionsFrom(from);
    const totalCount = transitions.reduce((sum, t) => sum + t.count, 0);

    for (const trans of transitions) {
      trans.probability = totalCount > 0 ? trans.count / totalCount : 0;
    }
  }

  /**
   * Update the current chain (recent states within timeout)
   */
  private updateCurrentChain(newState: DuncState): void {
    const recentHistory = this.state.history.filter(
      h => this.tick - h.timestamp < this.SEQUENCE_TIMEOUT
    );
    this.state.currentChain = recentHistory.map(h => h.state);
  }

  /**
   * Detect recurrent sequences
   */
  private detectSequences(): void {
    const chain = this.state.currentChain;
    if (chain.length < this.SEQUENCE_MIN_LENGTH) return;

    for (let len = this.SEQUENCE_MIN_LENGTH; len <= Math.min(this.SEQUENCE_MAX_LENGTH, chain.length); len++) {
      const sequence = chain.slice(-len);
      const sequenceKey = sequence.join('->');

      // Check if exists
      const existing = this.state.sequences.find(s => s.states.join('->') === sequenceKey);

      if (existing) {
        existing.occurrences++;
        existing.lastSeen = this.tick;

        // Update success rate
        const recentSuccess = this.state.history
          .slice(-len)
          .filter(h => h.success).length / len;
        existing.successRate = existing.successRate * 0.8 + recentSuccess * 0.2;

        if (this.onSequenceDetected) {
          this.onSequenceDetected(existing);
        }
      } else if (this.hasOccurredBefore(sequence)) {
        // New recurrent sequence
        const newSeq: DuncSequence = {
          id: `seq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          states: sequence,
          occurrences: 2,
          avgDuration: len,
          successRate: 0.5,
          xG: Math.random() * 0.5,
          lastSeen: this.tick
        };
        this.state.sequences.push(newSeq);

        if (this.onSequenceDetected) {
          this.onSequenceDetected(newSeq);
        }
      }
    }

    // Prune old sequences
    this.state.sequences = this.state.sequences
      .filter(s => this.tick - s.lastSeen < 200)
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 20);
  }

  /**
   * Check if a sequence has occurred before in history
   */
  private hasOccurredBefore(sequence: DuncState[]): boolean {
    const history = this.state.history.slice(0, -sequence.length);
    if (history.length < sequence.length) return false;

    for (let i = 0; i <= history.length - sequence.length; i++) {
      let match = true;
      for (let j = 0; j < sequence.length; j++) {
        if (history[i + j].state !== sequence[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }

  /**
   * Apply decay to old transitions
   */
  private applyDecay(): void {
    for (const [key, trans] of this.state.transitionMatrix) {
      const age = this.tick - trans.lastSeen;
      if (age > 50) {
        trans.count *= this.DECAY_RATE;
        if (trans.count < 0.1) {
          this.state.transitionMatrix.delete(key);
        }
      }
    }
  }

  /**
   * Update entropy and stability metrics
   */
  private updateDynamics(): void {
    const transitions = this.getTransitionsFrom(this.getCurrentState());

    // Calculate entropy (Shannon entropy of transition probabilities)
    if (transitions.length > 0) {
      let entropy = 0;
      for (const t of transitions) {
        if (t.probability > 0) {
          entropy -= t.probability * Math.log2(t.probability);
        }
      }
      // Normalize by max possible entropy
      const maxEntropy = Math.log2(transitions.length);
      this.state.entropy = maxEntropy > 0 ? entropy / maxEntropy : 1;
    }

    // Calculate stability (inverse of state change frequency)
    const recentHistory = this.state.history.slice(-20);
    const uniqueStates = new Set(recentHistory.map(h => h.state)).size;
    this.state.stability = 1 - (uniqueStates / Math.min(20, recentHistory.length));
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getTransitionsFrom(state: DuncState): DuncTransition[] {
    return Array.from(this.state.transitionMatrix.values())
      .filter(t => t.from === state);
  }

  private getRandomAffineState(current: DuncState): DuncState {
    const affinities = this.TRANSITION_AFFINITIES[current] || this.ALL_STATES;
    return affinities[Math.floor(Math.random() * affinities.length)];
  }

  private calculateConfidence(transition: DuncTransition): number {
    // Higher count and success rate = higher confidence
    const countFactor = Math.min(1, transition.count / 20);
    const successFactor = transition.successRate;
    const recencyFactor = Math.max(0, 1 - (this.tick - transition.lastSeen) / 100);

    return (countFactor * 0.4 + successFactor * 0.4 + recencyFactor * 0.2);
  }

  private calculateAvgChainLength(): number {
    if (this.state.sequences.length === 0) return 0;
    return this.state.sequences.reduce((sum, s) => sum + s.states.length, 0) / this.state.sequences.length;
  }

  private calculateChainHealth(): 'strong' | 'building' | 'exploring' | 'chaotic' {
    const transitions = this.state.transitionMatrix.size;
    const sequences = this.state.sequences.length;
    const entropy = this.state.entropy;

    if (transitions > 30 && sequences > 5 && entropy < 0.7) return 'strong';
    if (transitions > 15 && sequences > 2) return 'building';
    if (entropy > 0.8) return 'exploring';
    return 'chaotic';
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const bigDunc = new BigDuncEngine();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatState(state: DuncState): string {
  return state.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function formatChain(chain: DuncState[]): string {
  return chain.map(formatState).join(' -> ');
}

export function getStateColor(state: DuncState): string {
  if (state.startsWith('press')) return '#f97316'; // orange
  if (state.startsWith('build')) return '#22c55e'; // green
  if (state.startsWith('attack')) return '#ef4444'; // red
  if (state.startsWith('defend')) return '#3b82f6'; // blue
  if (state.startsWith('transition')) return '#a855f7'; // purple
  return '#6b7280'; // gray
}
