/**
 * BigDunc Autonomous Digital Twin
 *
 * Each player is a self-governing agent with awareness vectors and intent evaluation.
 * Twins query the resonance kernel for local field state, then act autonomously.
 */

import {
  ResonanceKernel,
  KernelOutput,
  KernelPlayer,
  PlayerPhase,
  Vec2,
  PHASE_MAP,
  vec2Normalize,
  clamp,
} from './resonance-kernel';

export type PlayerIntent =
  | 'hold_position'
  | 'move_to_space'
  | 'press_opponent'
  | 'support_ball'
  | 'create_passing_lane'
  | 'recover_shape';

export interface Awareness {
  ball: number;       // 0–1 proximity/relevance
  space: number;      // 0–1 open space available
  threat: number;     // 0–1 opponent pressure
  teammates: number;  // 0–1 support nearby
}

export interface IntentRecord {
  tick: number;
  intent: PlayerIntent;
  confidence: number;
}

export class AutonomousTwin {
  readonly playerId: string;
  awareness: Awareness;
  intentHistory: IntentRecord[] = [];
  private currentIntent: PlayerIntent = 'hold_position';
  private confidence: number = 0.5;

  constructor(playerId: string) {
    this.playerId = playerId;
    this.awareness = { ball: 0.5, space: 0.5, threat: 0.3, teammates: 0.5 };
  }

  /** Score all possible intents from kernel state + awareness, pick the best. */
  evaluateIntent(kernelState: KernelOutput, kernel: ResonanceKernel): { intent: PlayerIntent; confidence: number } {
    const coh = kernelState.players[this.playerId];
    const player = kernel.getPlayer(this.playerId);
    if (!player || !coh) return { intent: 'hold_position', confidence: 0.3 };

    const scores: Record<PlayerIntent, number> = {
      hold_position: coh.coherenceScore * 0.6 + (1 - this.awareness.threat) * 0.4,
      move_to_space: this.awareness.space * 0.7 + (1 - this.awareness.threat) * 0.3,
      press_opponent: this.awareness.threat * 0.5 + player.wave.amplitude * 0.3 + this.awareness.ball * 0.2,
      support_ball: this.awareness.ball * 0.6 + (1 - this.awareness.teammates) * 0.4,
      create_passing_lane: this.awareness.space * 0.4 + this.awareness.ball * 0.3 + this.awareness.teammates * 0.3,
      recover_shape: (1 - coh.coherenceScore) * 0.7 + (1 - coh.phaseAlignment) * 0.3,
    };

    let bestIntent: PlayerIntent = 'hold_position';
    let bestScore = -1;
    for (const [intent, score] of Object.entries(scores) as [PlayerIntent, number][]) {
      if (score > bestScore) { bestScore = score; bestIntent = intent; }
    }

    this.currentIntent = bestIntent;
    this.confidence = clamp(bestScore, 0, 1);
    this.intentHistory.push({ tick: kernelState.tick, intent: bestIntent, confidence: this.confidence });
    if (this.intentHistory.length > 50) this.intentHistory = this.intentHistory.slice(-50);

    return { intent: bestIntent, confidence: this.confidence };
  }

  /** Execute the chosen intent — mutate player velocity/phase via the kernel. */
  executeIntent(kernel: ResonanceKernel): void {
    const player = kernel.getPlayer(this.playerId);
    if (!player) return;

    switch (this.currentIntent) {
      case 'hold_position':
        player.velocity.x *= 0.5;
        player.velocity.y *= 0.5;
        break;
      case 'move_to_space':
        this.moveToOpenSpace(player, kernel);
        break;
      case 'press_opponent':
        player.tacticalCharge = clamp(player.tacticalCharge - 0.2, -1, 1);
        player.velocity.x += (Math.random() - 0.3) * 2;
        player.velocity.y += (Math.random() - 0.5) * 2;
        break;
      case 'support_ball':
        player.velocity.x += (Math.random() - 0.5) * 1.5;
        player.velocity.y += (Math.random() - 0.5) * 1.5;
        break;
      case 'create_passing_lane':
        player.velocity.y += (Math.random() - 0.5) * 3;
        player.velocity.x += 0.5;
        break;
      case 'recover_shape':
        player.wave.phase += Math.sin(PHASE_MAP[player.state] - player.wave.phase) * 0.2;
        player.velocity.x *= 0.3;
        player.velocity.y *= 0.3;
        break;
    }
  }

  /** Update awareness from sensor/simulation data. */
  updateAwareness(sensorData: {
    ballDist?: number;
    nearestOpponentDist?: number;
    nearestTeammateDist?: number;
    openSpaceRadius?: number;
  }): void {
    if (sensorData.ballDist !== undefined)
      this.awareness.ball = clamp(1 - sensorData.ballDist / 50, 0, 1);
    if (sensorData.nearestOpponentDist !== undefined)
      this.awareness.threat = clamp(1 - sensorData.nearestOpponentDist / 20, 0, 1);
    if (sensorData.nearestTeammateDist !== undefined)
      this.awareness.teammates = clamp(1 - sensorData.nearestTeammateDist / 30, 0, 1);
    if (sensorData.openSpaceRadius !== undefined)
      this.awareness.space = clamp(sensorData.openSpaceRadius / 15, 0, 1);
  }

  getCurrentIntent(): PlayerIntent { return this.currentIntent; }
  getConfidence(): number { return this.confidence; }

  private moveToOpenSpace(player: KernelPlayer, kernel: ResonanceKernel): void {
    const teammates = kernel.getPlayers().filter(p => p.id !== this.playerId);
    if (teammates.length === 0) return;
    const cx = teammates.reduce((s, p) => s + p.position.x, 0) / teammates.length;
    const cy = teammates.reduce((s, p) => s + p.position.y, 0) / teammates.length;
    const dir = vec2Normalize({ x: player.position.x - cx, y: player.position.y - cy });
    player.velocity.x += dir.x * 1.5;
    player.velocity.y += dir.y * 1.5;
  }
}
