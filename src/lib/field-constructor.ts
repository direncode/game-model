/**
 * BigDunc Organic Field Constructor
 *
 * Builds and mutates the resonance field entirely from enriched event streams.
 * No hardcoded positions — the field state emerges organically from what happened.
 *
 * Pipeline: AbstractEvent → EventIngestion → EnrichedEvent → FieldConstructor → Kernel
 */

import {
  ResonanceKernel,
  type KernelPlayer,
  type PlayerPhase,
  type Vec2,
  PITCH_WIDTH,
  PITCH_HEIGHT,
  PHASE_MAP,
  vec2Dist,
  clamp,
} from './resonance-kernel';

import {
  EventIngestionPipeline,
  type AbstractEvent,
  type EnrichedEvent,
  type AttractorMutation,
} from './event-ingestion';

// ======================== Field Construction Log ========================

export interface FieldMutation {
  tick: number;
  type: 'player_move' | 'player_phase' | 'player_load' | 'ball_move' | 'attractor_mutate' | 'energy_inject' | 'phase_cascade';
  target: string;
  before: string;
  after: string;
  cause: string; // which event caused this
}

export interface ConstructionSnapshot {
  tick: number;
  eventCount: number;
  mutations: FieldMutation[];
  ballPosition: Vec2;
  fieldState: 'organic' | 'initializing' | 'stable' | 'volatile';
  organicCoverage: number; // 0-1: how much of the field is event-derived vs default
}

// ======================== Field Constructor ========================

export class FieldConstructor {
  private pipeline: EventIngestionPipeline;
  private kernel: ResonanceKernel;
  private mutationLog: FieldMutation[] = [];
  private tickCounter = 0;
  private eventDrivenPlayers: Set<string> = new Set();
  private totalEventsProcessed = 0;
  private tempAttractorIds: string[] = [];

  constructor(kernel: ResonanceKernel) {
    this.kernel = kernel;
    this.pipeline = new EventIngestionPipeline();
  }

  /** Get the ingestion pipeline for external sync or inspection. */
  getPipeline(): EventIngestionPipeline { return this.pipeline; }

  /**
   * Process an abstract event: enrich it with vectors, then mutate the field.
   * Returns the enriched event and the mutations applied.
   */
  processEvent(event: AbstractEvent): { enriched: EnrichedEvent; mutations: FieldMutation[] } {
    this.tickCounter++;
    this.totalEventsProcessed++;

    // Sync pipeline with current kernel state
    this.pipeline.syncFromKernel(this.kernel.getPlayers(), this.findBallAttractor());

    // Enrich the event
    const enriched = this.pipeline.ingest(event);

    // Apply mutations to kernel
    const mutations = this.applyToKernel(enriched);

    return { enriched, mutations };
  }

  /**
   * Process a batch of events in sequence.
   * Useful for replaying a sequence or ingesting a full event log.
   */
  processBatch(events: AbstractEvent[]): { enriched: EnrichedEvent[]; totalMutations: number } {
    const enrichedList: EnrichedEvent[] = [];
    let totalMutations = 0;

    for (const event of events) {
      const { enriched, mutations } = this.processEvent(event);
      enrichedList.push(enriched);
      totalMutations += mutations.length;
    }

    return { enriched: enrichedList, totalMutations };
  }

  /** Get a snapshot of the current construction state. */
  getSnapshot(): ConstructionSnapshot {
    const totalPlayers = this.kernel.getPlayers().length;
    const organicCoverage = totalPlayers > 0 ? this.eventDrivenPlayers.size / totalPlayers : 0;

    let fieldState: ConstructionSnapshot['fieldState'] = 'initializing';
    if (this.totalEventsProcessed > 20 && organicCoverage > 0.5) fieldState = 'organic';
    else if (this.totalEventsProcessed > 10) fieldState = 'stable';
    if (this.recentMutationRate() > 5) fieldState = 'volatile';

    return {
      tick: this.tickCounter,
      eventCount: this.totalEventsProcessed,
      mutations: this.mutationLog.slice(-20),
      ballPosition: this.pipeline.getBallPosition(),
      fieldState,
      organicCoverage,
    };
  }

  getMutationLog(): FieldMutation[] { return this.mutationLog; }
  getEventHistory(): EnrichedEvent[] { return this.pipeline.getHistory(); }
  getTotalEvents(): number { return this.totalEventsProcessed; }

  // ======================== Private ========================

  private applyToKernel(enriched: EnrichedEvent): FieldMutation[] {
    const mutations: FieldMutation[] = [];
    const event = enriched.abstract;
    const cause = `${event.type}: ${event.from}${event.to ? ' → ' + event.to : ''}`;

    // 1. Move actor toward event origin
    const actor = this.kernel.getPlayer(event.from);
    if (actor) {
      const beforePos = `(${actor.position.x.toFixed(1)}, ${actor.position.y.toFixed(1)})`;

      // Smoothly interpolate toward enriched position (don't teleport)
      const targetX = enriched.actorPosition.x;
      const targetY = enriched.actorPosition.y;
      const lerpFactor = 0.4; // blend 40% toward event-inferred position
      actor.position.x = actor.position.x + (targetX - actor.position.x) * lerpFactor;
      actor.position.y = actor.position.y + (targetY - actor.position.y) * lerpFactor;
      actor.position.x = clamp(actor.position.x, 0, PITCH_WIDTH);
      actor.position.y = clamp(actor.position.y, 0, PITCH_HEIGHT);

      const afterPos = `(${actor.position.x.toFixed(1)}, ${actor.position.y.toFixed(1)})`;
      mutations.push({ tick: this.tickCounter, type: 'player_move', target: event.from, before: beforePos, after: afterPos, cause });
      this.eventDrivenPlayers.add(event.from);

      // Inject velocity from event context
      const dir = { x: enriched.destination.x - actor.position.x, y: enriched.destination.y - actor.position.y };
      const dist = Math.sqrt(dir.x ** 2 + dir.y ** 2);
      if (dist > 1) {
        actor.velocity.x += (dir.x / dist) * 0.8;
        actor.velocity.y += (dir.y / dist) * 0.8;
      }

      // Update actor phase
      const beforePhase = actor.state;
      actor.state = enriched.actorPhase;
      actor.wave.phase = PHASE_MAP[enriched.actorPhase] + (Math.random() * 0.2 - 0.1);
      actor.tacticalCharge = this.chargeFromState(enriched.actorPhase);
      if (beforePhase !== enriched.actorPhase) {
        mutations.push({ tick: this.tickCounter, type: 'player_phase', target: event.from, before: beforePhase, after: enriched.actorPhase, cause });
      }

      // Bump load from event
      const beforeLoad = actor.load;
      actor.load = clamp(enriched.actorLoad + enriched.fieldEnergyDelta * 5, 0, 100);
      actor.wave.amplitude = clamp(actor.load / 100, 0.1, 1);
      mutations.push({ tick: this.tickCounter, type: 'player_load', target: event.from, before: beforeLoad.toFixed(0), after: actor.load.toFixed(0), cause });
    }

    // 2. Move target player to receiving position
    if (event.to && enriched.targetPosition) {
      const target = this.kernel.getPlayer(event.to);
      if (target) {
        const beforePos = `(${target.position.x.toFixed(1)}, ${target.position.y.toFixed(1)})`;

        const lerpFactor = event.success !== false ? 0.35 : 0.1;
        target.position.x = target.position.x + (enriched.targetPosition.x - target.position.x) * lerpFactor;
        target.position.y = target.position.y + (enriched.targetPosition.y - target.position.y) * lerpFactor;
        target.position.x = clamp(target.position.x, 0, PITCH_WIDTH);
        target.position.y = clamp(target.position.y, 0, PITCH_HEIGHT);

        const afterPos = `(${target.position.x.toFixed(1)}, ${target.position.y.toFixed(1)})`;
        mutations.push({ tick: this.tickCounter, type: 'player_move', target: event.to, before: beforePos, after: afterPos, cause });
        this.eventDrivenPlayers.add(event.to);

        // Target phase shift on successful reception
        if (event.success !== false && enriched.targetPhase) {
          const beforePhase = target.state;
          target.state = enriched.targetPhase;
          target.wave.phase = PHASE_MAP[enriched.targetPhase] + (Math.random() * 0.2 - 0.1);
          target.tacticalCharge = this.chargeFromState(enriched.targetPhase);
          if (beforePhase !== enriched.targetPhase) {
            mutations.push({ tick: this.tickCounter, type: 'player_phase', target: event.to, before: beforePhase, after: enriched.targetPhase, cause });
          }
        }
      }
    }

    // 3. Move ball attractor
    if (enriched.attractorMutation) {
      const mut = enriched.attractorMutation;
      this.applyAttractorMutation(mut, mutations, cause);
    }

    // 4. Phase cascade — team-wide shift from events like interceptions or press triggers
    if (enriched.phaseShift) {
      this.applyPhaseCascade(enriched.phaseShift, event.from, mutations, cause);
    }

    // 5. Energy injection
    if (enriched.fieldEnergyDelta > 0.3) {
      // Significant energy event — boost nearby players' amplitudes
      for (const player of this.kernel.getPlayers()) {
        const dist = vec2Dist(player.position, enriched.destination);
        if (dist < 25) {
          const boost = enriched.fieldEnergyDelta * (1 - dist / 25) * 0.1;
          player.wave.amplitude = clamp(player.wave.amplitude + boost, 0.05, 1);
        }
      }
      mutations.push({
        tick: this.tickCounter,
        type: 'energy_inject',
        target: 'field',
        before: '',
        after: `+${enriched.fieldEnergyDelta.toFixed(2)}`,
        cause,
      });
    }

    // 6. Clean up old temporary attractors
    this.cleanupTempAttractors();

    // Store mutations
    this.mutationLog.push(...mutations);
    if (this.mutationLog.length > 500) this.mutationLog = this.mutationLog.slice(-500);

    return mutations;
  }

  private applyAttractorMutation(mut: AttractorMutation, mutations: FieldMutation[], cause: string): void {
    if (mut.action === 'move') {
      // Move the first attractor of the given type
      const attractors = this.kernel.getAttractors();
      const existing = attractors.find(a => a.type === mut.type);
      if (existing) {
        const beforePos = `(${existing.position.x.toFixed(1)}, ${existing.position.y.toFixed(1)})`;
        existing.position.x = mut.position.x;
        existing.position.y = mut.position.y;
        existing.strength = mut.strength;
        const afterPos = `(${mut.position.x.toFixed(1)}, ${mut.position.y.toFixed(1)})`;
        mutations.push({ tick: this.tickCounter, type: 'ball_move', target: mut.type, before: beforePos, after: afterPos, cause });
      }
    } else if (mut.action === 'create') {
      const id = this.kernel.addAttractor(mut.type, mut.position.x, mut.position.y, mut.radius, mut.strength);
      this.tempAttractorIds.push(id);
      mutations.push({ tick: this.tickCounter, type: 'attractor_mutate', target: id, before: 'none', after: `${mut.type} at (${mut.position.x.toFixed(0)},${mut.position.y.toFixed(0)})`, cause });
    } else if (mut.action === 'remove') {
      const attractors = this.kernel.getAttractors();
      const existing = attractors.find(a => a.type === mut.type);
      if (existing) {
        this.kernel.removeAttractor(existing.id);
        mutations.push({ tick: this.tickCounter, type: 'attractor_mutate', target: existing.id, before: mut.type, after: 'removed', cause });
      }
    }
  }

  private applyPhaseCascade(newPhase: PlayerPhase, triggerId: string, mutations: FieldMutation[], cause: string): void {
    // Cascade phase shift to nearby players (within 25m of triggering player)
    const triggerPos = this.pipeline.getPlayerPosition(triggerId);
    if (!triggerPos) return;

    for (const player of this.kernel.getPlayers()) {
      if (player.id === triggerId) continue;
      const dist = vec2Dist(player.position, triggerPos);
      if (dist < 25) {
        const beforePhase = player.state;
        // Stronger cascade for closer players
        const cascadeStrength = 1 - dist / 25;
        if (Math.random() < cascadeStrength * 0.6) {
          player.state = newPhase;
          player.wave.phase = PHASE_MAP[newPhase] + (Math.random() * 0.3 - 0.15);
          player.tacticalCharge = this.chargeFromState(newPhase);
          if (beforePhase !== newPhase) {
            mutations.push({
              tick: this.tickCounter,
              type: 'phase_cascade',
              target: player.id,
              before: beforePhase,
              after: newPhase,
              cause: `cascade from ${triggerId}: ${cause}`,
            });
          }
        }
      }
    }
  }

  private cleanupTempAttractors(): void {
    // Remove temp attractors older than 5 ticks
    if (this.tempAttractorIds.length > 3) {
      const toRemove = this.tempAttractorIds.splice(0, this.tempAttractorIds.length - 3);
      for (const id of toRemove) {
        this.kernel.removeAttractor(id);
      }
    }
  }

  private findBallAttractor(): Vec2 | undefined {
    const attractors = this.kernel.getAttractors();
    const ball = attractors.find(a => a.type === 'ball');
    return ball ? { ...ball.position } : undefined;
  }

  private recentMutationRate(): number {
    const recentTick = this.tickCounter - 5;
    return this.mutationLog.filter(m => m.tick > recentTick).length;
  }

  private chargeFromState(state: PlayerPhase): number {
    switch (state) {
      case 'defending': return -0.8;
      case 'pressing': return -0.4;
      case 'building': return 0;
      case 'attacking': return 0.6;
      case 'transitioning': return 0.2;
    }
  }
}
