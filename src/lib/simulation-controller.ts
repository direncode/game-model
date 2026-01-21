/**
 * SIMULATION CONTROLLER
 * Integrates all advanced systems: Tactical AI, Physics, Psychology, Analytics, Multi-Agent
 * World-class football simulation engine
 */

import { TacticalAI, TacticalDecision, MatchContext, PatternRecognizer, simulateScenario } from './tactical-ai';
import { BallPhysics, PlayerBiomechanics, EnvironmentalConditions, Vector2D, Vector } from './physics-engine';
import { PsychologyEngine, PlayerPsychology, TeamMorale, CrowdSimulator, PersonalityProfile, TeamChemistry, MatchStakes } from './psychology-system';
import { AnalyticsEngine, xGResult, PassingNetwork, HeatmapData, PressingTrap, PhaseTransition } from './analytics-engine';
import { MultiAgentController, BoidSystem, GegenpressingSystem, TacticalGeneticAlgorithm, AgentState, GeneticTraits } from './multi-agent-system';
import {
  PatternRecognitionEngine,
  TacticalPattern,
  PatternLog,
  CompoundingEffect,
  TacticalCoherence,
  PatternType,
  RecurrentSequence,
  MarkovTransition,
  patternEngine
} from './pattern-recognition';

// ============================================================================
// INTEGRATED SIMULATION STATE
// ============================================================================

export interface SimulationState {
  // Match basics
  minute: number;
  phase: 'pre_match' | 'first_half' | 'half_time' | 'second_half' | 'full_time';
  score: { home: number; away: number };

  // Ball state
  ball: {
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    carrier: string | null;
    team: 'home' | 'away' | null;
  };

  // Player states (11 per team)
  players: {
    home: PlayerState[];
    away: PlayerState[];
  };

  // Tactical state
  tactics: {
    home: TacticalState;
    away: TacticalState;
  };

  // Psychology
  psychology: {
    homeMorale: number;
    awayMorale: number;
    homeMomentum: number;
    awayMomentum: number;
    crowdVolume: number;
    crowdTension: number;
  };

  // Analytics
  analytics: {
    homeXG: number;
    awayXG: number;
    possession: { home: number; away: number };
    passingNetwork: PassingNetwork | null;
    heatmaps: { home: HeatmapData | null; away: HeatmapData | null };
    pressingTraps: PressingTrap[];
    phaseTransitions: PhaseTransition[];
  };

  // AI decisions
  recentDecisions: TacticalDecision[];
  predictions: {
    nextPhase: string;
    threatZone: string;
    suggestedAction: string;
  };

  // Pattern Recognition & Tactical Logs
  patternRecognition: {
    activePatterns: { home: TacticalPattern[]; away: TacticalPattern[] };
    recentLogs: PatternLog[];
    compoundingEffects: CompoundingEffect[];
    coherence: { home: TacticalCoherence | null; away: TacticalCoherence | null };
    // Markov Chain Data
    markov: {
      recurrentSequences: RecurrentSequence[];
      currentChains: { home: string; away: string };
      topTransitions: { home: MarkovTransition[]; away: MarkovTransition[] };
      predictedNext: { home: string | null; away: string | null };
    };
  };
}

export interface PlayerState {
  id: string;
  name: string;
  position: Vector2D;
  velocity: Vector2D;
  role: string;
  hasBall: boolean;

  // Physical
  stamina: number;
  fatigue: number;
  injuryRisk: number;

  // Mental
  confidence: number;
  composure: number;
  motivation: number;

  // Performance modifiers
  technicalMod: number;
  physicalMod: number;
  decisionMod: number;
}

export interface TacticalState {
  formation: string;
  style: string;
  pressingIntensity: number;
  defensiveLine: number;
  tempo: number;
  width: number;
}

// ============================================================================
// SIMULATION EVENTS
// ============================================================================

export interface SimulationEvent {
  id: string;
  minute: number;
  type: SimulationEventType;
  team: 'home' | 'away';
  player?: string;
  secondaryPlayer?: string;
  description: string;
  xG?: number;
  coordinates?: Vector2D;
  tacticalContext?: string;
  psychologicalImpact?: number;
}

export type SimulationEventType =
  | 'goal' | 'shot_on_target' | 'shot_off_target' | 'shot_blocked'
  | 'pass' | 'key_pass' | 'assist'
  | 'tackle' | 'interception' | 'clearance'
  | 'foul' | 'yellow_card' | 'red_card'
  | 'corner' | 'free_kick' | 'penalty'
  | 'substitution' | 'injury'
  | 'tactical_change' | 'pressing_trigger' | 'counter_attack'
  | 'momentum_shift' | 'crowd_surge'
  | 'phase_transition';

// ============================================================================
// MAIN SIMULATION CONTROLLER
// ============================================================================

export class SimulationController {
  // Core systems
  private tacticalAI: { home: TacticalAI; away: TacticalAI };
  private ballPhysics: BallPhysics;
  private psychologyEngine: PsychologyEngine | null = null;
  private analyticsEngine: AnalyticsEngine;
  private multiAgentController: MultiAgentController;
  private geneticAlgorithm: TacticalGeneticAlgorithm;
  private patternEngine: PatternRecognitionEngine;

  // State
  private state: SimulationState;
  private events: SimulationEvent[] = [];
  private positionHistory: { home: Vector2D[][]; away: Vector2D[][] } = { home: [], away: [] };

  // Configuration
  private environment: EnvironmentalConditions;
  private matchStakes: MatchStakes;

  constructor(config: {
    homeTeam: { name: string; formation: string; players: string[] };
    awayTeam: { name: string; formation: string; players: string[] };
    environment?: Partial<EnvironmentalConditions>;
    stakes?: Partial<MatchStakes>;
  }) {
    // Initialize tactical AI for both teams
    this.tacticalAI = {
      home: new TacticalAI(),
      away: new TacticalAI()
    };

    // Initialize environment
    this.environment = {
      windSpeed: 0,
      windDirection: 0,
      temperature: 15,
      humidity: 60,
      altitude: 50,
      pitchCondition: 'dry',
      grassLength: 25,
      ...config.environment
    };

    // Initialize ball physics
    this.ballPhysics = new BallPhysics({}, this.environment);

    // Initialize analytics
    this.analyticsEngine = new AnalyticsEngine();

    // Initialize multi-agent controller
    this.multiAgentController = new MultiAgentController();
    this.geneticAlgorithm = new TacticalGeneticAlgorithm();

    // Initialize pattern recognition engine
    this.patternEngine = new PatternRecognitionEngine();

    // Match stakes
    this.matchStakes = {
      importance: 75,
      rivalryLevel: 85,
      mediaAttention: 80,
      consequencesOfLoss: 60,
      consequencesOfWin: 70,
      ...config.stakes
    };

    // Initialize state
    this.state = this.initializeState(config);
  }

  private initializeState(config: {
    homeTeam: { name: string; formation: string; players: string[] };
    awayTeam: { name: string; formation: string; players: string[] };
  }): SimulationState {
    return {
      minute: 0,
      phase: 'pre_match',
      score: { home: 0, away: 0 },
      ball: {
        position: { x: 52.5, y: 34, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        carrier: null,
        team: null
      },
      players: {
        home: this.initializePlayers(config.homeTeam.players, 'home', config.homeTeam.formation),
        away: this.initializePlayers(config.awayTeam.players, 'away', config.awayTeam.formation)
      },
      tactics: {
        home: {
          formation: config.homeTeam.formation,
          style: 'possession',
          pressingIntensity: 80,
          defensiveLine: 70,
          tempo: 60,
          width: 75
        },
        away: {
          formation: config.awayTeam.formation,
          style: 'counter',
          pressingIntensity: 40,
          defensiveLine: 35,
          tempo: 75,
          width: 60
        }
      },
      psychology: {
        homeMorale: 75,
        awayMorale: 70,
        homeMomentum: 0,
        awayMomentum: 0,
        crowdVolume: 60,
        crowdTension: 40
      },
      analytics: {
        homeXG: 0,
        awayXG: 0,
        possession: { home: 50, away: 50 },
        passingNetwork: null,
        heatmaps: { home: null, away: null },
        pressingTraps: [],
        phaseTransitions: []
      },
      recentDecisions: [],
      predictions: {
        nextPhase: 'buildup',
        threatZone: 'central',
        suggestedAction: 'maintain_shape'
      },
      patternRecognition: {
        activePatterns: { home: [], away: [] },
        recentLogs: [],
        compoundingEffects: [],
        coherence: { home: null, away: null },
        markov: {
          recurrentSequences: [],
          currentChains: { home: 'No chain', away: 'No chain' },
          topTransitions: { home: [], away: [] },
          predictedNext: { home: null, away: null }
        }
      }
    };
  }

  private initializePlayers(names: string[], team: 'home' | 'away', formation: string): PlayerState[] {
    const positions = this.getFormationPositions(formation, team);

    return names.map((name, i) => ({
      id: `${team}_${i}`,
      name,
      position: positions[i] || { x: 50, y: 34 },
      velocity: { x: 0, y: 0 },
      role: this.getRoleForIndex(i, formation),
      hasBall: false,
      stamina: 100,
      fatigue: 0,
      injuryRisk: 0,
      confidence: 70 + Math.random() * 20,
      composure: 65 + Math.random() * 25,
      motivation: 75 + Math.random() * 20,
      technicalMod: 1,
      physicalMod: 1,
      decisionMod: 1
    }));
  }

  private getFormationPositions(formation: string, team: 'home' | 'away'): Vector2D[] {
    // Base positions for home team (left to right), will be mirrored for away
    const formations: Record<string, Vector2D[]> = {
      '4-3-3': [
        { x: 5, y: 34 },     // GK
        { x: 20, y: 60 },    // RB
        { x: 18, y: 45 },    // CB
        { x: 18, y: 23 },    // CB
        { x: 20, y: 8 },     // LB
        { x: 35, y: 34 },    // CDM
        { x: 45, y: 50 },    // CM
        { x: 45, y: 18 },    // CM
        { x: 60, y: 60 },    // RW
        { x: 65, y: 34 },    // ST
        { x: 60, y: 8 }      // LW
      ],
      '4-2-3-1': [
        { x: 5, y: 34 },     // GK
        { x: 20, y: 60 },    // RB
        { x: 18, y: 45 },    // CB
        { x: 18, y: 23 },    // CB
        { x: 20, y: 8 },     // LB
        { x: 35, y: 45 },    // CDM
        { x: 35, y: 23 },    // CDM
        { x: 50, y: 55 },    // RM
        { x: 50, y: 34 },    // CAM
        { x: 50, y: 13 },    // LM
        { x: 65, y: 34 }     // ST
      ],
      '3-5-2': [
        { x: 5, y: 34 },     // GK
        { x: 20, y: 50 },    // CB
        { x: 18, y: 34 },    // CB
        { x: 20, y: 18 },    // CB
        { x: 35, y: 62 },    // RWB
        { x: 35, y: 45 },    // CM
        { x: 35, y: 34 },    // CDM
        { x: 35, y: 23 },    // CM
        { x: 35, y: 6 },     // LWB
        { x: 60, y: 42 },    // ST
        { x: 60, y: 26 }     // ST
      ]
    };

    let positions = formations[formation] || formations['4-3-3'];

    // Mirror for away team
    if (team === 'away') {
      positions = positions.map(p => ({ x: 105 - p.x, y: p.y }));
    }

    return positions;
  }

  private getRoleForIndex(index: number, formation: string): string {
    const roles: Record<string, string[]> = {
      '4-3-3': ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'RW', 'ST', 'LW'],
      '4-2-3-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CDM', 'RM', 'CAM', 'LM', 'ST'],
      '3-5-2': ['GK', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CDM', 'CM', 'LWB', 'ST', 'ST']
    };

    return (roles[formation] || roles['4-3-3'])[index] || 'MF';
  }

  // ============================================================================
  // MAIN SIMULATION TICK
  // ============================================================================

  public tick(deltaTime: number = 1): SimulationEvent[] {
    const newEvents: SimulationEvent[] = [];

    // Update time
    this.state.minute += deltaTime / 60;

    // Phase transitions
    this.handlePhaseTransitions(newEvents);

    if (this.state.phase === 'first_half' || this.state.phase === 'second_half') {
      // 1. Update physics (ball trajectory, player movement)
      this.updatePhysics(deltaTime);

      // 2. Update multi-agent system (boid behaviors)
      this.updateAgents(deltaTime, newEvents);

      // 3. Update tactical AI (decisions, pattern recognition)
      this.updateTacticalAI(newEvents);

      // 4. Update psychology (morale, momentum, crowd)
      this.updatePsychology(deltaTime, newEvents);

      // 5. Update analytics (xG, passing networks, heatmaps)
      this.updateAnalytics();

      // 6. Update pattern recognition (tactical logs)
      this.updatePatternRecognition(newEvents);

      // 7. Check for game events (shots, tackles, etc.)
      this.checkGameEvents(newEvents);

      // 8. Record history for heatmaps
      this.recordPositionHistory();
    }

    this.events.push(...newEvents);
    return newEvents;
  }

  private handlePhaseTransitions(events: SimulationEvent[]): void {
    const min = this.state.minute;

    if (this.state.phase === 'pre_match' && min >= 0) {
      this.state.phase = 'first_half';
      this.kickoff('home');
      events.push(this.createEvent('phase_transition', 'home', 'Kickoff', 'First half begins'));
    } else if (this.state.phase === 'first_half' && min >= 45) {
      this.state.phase = 'half_time';
      events.push(this.createEvent('phase_transition', 'home', 'Half Time',
        `HT: ${this.state.score.home} - ${this.state.score.away}`));
    } else if (this.state.phase === 'half_time' && min >= 46) {
      this.state.phase = 'second_half';
      this.kickoff('away');
      events.push(this.createEvent('phase_transition', 'away', 'Kickoff', 'Second half begins'));
    } else if (this.state.phase === 'second_half' && min >= 90) {
      this.state.phase = 'full_time';
      events.push(this.createEvent('phase_transition', 'home', 'Full Time',
        `FT: ${this.state.score.home} - ${this.state.score.away}`));
    }
  }

  private kickoff(team: 'home' | 'away'): void {
    this.state.ball.position = { x: 52.5, y: 34, z: 0 };
    this.state.ball.velocity = { x: 0, y: 0, z: 0 };
    this.state.ball.team = team;

    // Give ball to striker
    const striker = team === 'home' ? this.state.players.home[9] : this.state.players.away[10];
    this.state.ball.carrier = striker.id;
    striker.hasBall = true;
  }

  private updatePhysics(deltaTime: number): void {
    // Update ball physics
    const ballState = this.ballPhysics.update(deltaTime);
    this.state.ball.position = { ...ballState.position };
    this.state.ball.velocity = { ...ballState.velocity };

    // Update player fatigue and stamina
    this.updatePlayerPhysics(deltaTime);
  }

  private updatePlayerPhysics(deltaTime: number): void {
    const allPlayers = [...this.state.players.home, ...this.state.players.away];

    for (const player of allPlayers) {
      const speed = Vector.magnitude(player.velocity);

      // Stamina consumption based on movement intensity
      const staminaDrain = speed > 7 ? 0.5 : speed > 5 ? 0.2 : 0.05;
      player.stamina = Math.max(0, player.stamina - staminaDrain * deltaTime);

      // Fatigue accumulation
      player.fatigue = Math.min(100, player.fatigue + staminaDrain * 0.3 * deltaTime);

      // Injury risk increases with fatigue
      player.injuryRisk = Math.min(100, player.fatigue * 0.5 + (100 - player.stamina) * 0.3);

      // Performance modifiers based on physical state
      const staminaMod = 0.7 + (player.stamina / 100) * 0.3;
      player.physicalMod = staminaMod * (1 - player.fatigue / 200);
    }
  }

  private updateAgents(deltaTime: number, events: SimulationEvent[]): void {
    // Get current ball position
    const ballPos: Vector2D = { x: this.state.ball.position.x, y: this.state.ball.position.y };

    // Update multi-agent system
    const agentPositions = this.multiAgentController.update(ballPos, deltaTime);

    // Apply agent positions to player state
    for (const [id, agent] of agentPositions) {
      const isHome = id.startsWith('home');
      const players = isHome ? this.state.players.home : this.state.players.away;
      const player = players.find(p => p.id === id);

      if (player) {
        // Smooth interpolation to agent position
        player.velocity = {
          x: (agent.position.x - player.position.x) * 2,
          y: (agent.position.y - player.position.y) * 2
        };
        player.position = Vector.lerp(player.position, agent.position, deltaTime * 3);
      }
    }
  }

  private updateTacticalAI(events: SimulationEvent[]): void {
    // Build match context
    const context: MatchContext = {
      minute: this.state.minute,
      scoreDifferential: this.state.score.home - this.state.score.away,
      possession: this.state.analytics.possession.home,
      xGDifferential: this.state.analytics.homeXG - this.state.analytics.awayXG,
      pressureIndex: 50,  // Calculate based on opponent positions
      momentumScore: this.state.psychology.homeMomentum - this.state.psychology.awayMomentum,
      fatigueLevel: this.state.players.home.reduce((sum, p) => sum + p.fatigue, 0) / 11,
      recentEvents: []
    };

    // Generate tactical decisions for home team
    const gameState = {
      ballPosition: { x: this.state.ball.position.x, y: this.state.ball.position.y },
      players: {
        home: this.state.players.home.map(p => ({ x: p.position.x, y: p.position.y })),
        away: this.state.players.away.map(p => ({ x: p.position.x, y: p.position.y }))
      }
    };

    const decisions = this.tacticalAI.home.generateDecisions(context, gameState as any);
    this.state.recentDecisions = decisions;

    // Apply top decision if urgent enough
    if (decisions.length > 0 && decisions[0].urgency > 0.7) {
      this.tacticalAI.home.applyDecision(decisions[0]);
      events.push(this.createEvent(
        'tactical_change',
        'home',
        'Tactical Adjustment',
        decisions[0].reasoning
      ));
    }

    // Update predictions
    const awayPattern = new PatternRecognizer();
    const prediction = awayPattern.predictNextMove({
      buildUpStyle: 'direct',
      preferredFlank: 'balanced',
      pressingTrigger: 'mid',
      counterAttackSpeed: 80,
      setPlayDanger: 60,
      weakZones: ['left_channel'],
      strongZones: ['counter']
    });

    this.state.predictions = {
      nextPhase: 'progression',
      threatZone: prediction.zone,
      suggestedAction: decisions[0]?.type || 'maintain_shape'
    };
  }

  private updatePsychology(deltaTime: number, events: SimulationEvent[]): void {
    // Simple psychology update without full engine
    const minuteFactor = this.state.minute / 90;

    // Momentum shifts based on possession and chances
    if (this.state.analytics.possession.home > 60) {
      this.state.psychology.homeMomentum = Math.min(100, this.state.psychology.homeMomentum + 0.1);
      this.state.psychology.awayMomentum = Math.max(-100, this.state.psychology.awayMomentum - 0.1);
    }

    // Crowd tension increases in close games late on
    if (Math.abs(this.state.score.home - this.state.score.away) <= 1 && this.state.minute > 70) {
      this.state.psychology.crowdTension = Math.min(100, this.state.psychology.crowdTension + 0.2);
    }

    // Morale affects player performance
    const homeMoraleMod = 0.9 + (this.state.psychology.homeMorale / 100) * 0.2;
    const awayMoraleMod = 0.9 + (this.state.psychology.awayMorale / 100) * 0.2;

    for (const player of this.state.players.home) {
      player.decisionMod = homeMoraleMod * (player.composure / 100);
    }
    for (const player of this.state.players.away) {
      player.decisionMod = awayMoraleMod * (player.composure / 100);
    }

    // Check for momentum shifts
    if (Math.abs(this.state.psychology.homeMomentum) > 50 && Math.random() < 0.01) {
      events.push(this.createEvent(
        'momentum_shift',
        this.state.psychology.homeMomentum > 0 ? 'home' : 'away',
        'Momentum Shift',
        `${this.state.psychology.homeMomentum > 0 ? 'Home' : 'Away'} team gaining momentum!`
      ));
    }
  }

  private updateAnalytics(): void {
    // Update possession based on ball carrier
    const possessionTeam = this.state.ball.team;
    if (possessionTeam) {
      const poss = this.state.analytics.possession;
      if (possessionTeam === 'home') {
        poss.home = Math.min(75, poss.home + 0.1);
        poss.away = Math.max(25, 100 - poss.home);
      } else {
        poss.away = Math.min(55, poss.away + 0.1);
        poss.home = Math.max(45, 100 - poss.away);
      }
    }

    // Update passing network periodically
    if (Math.floor(this.state.minute) % 5 === 0) {
      this.state.analytics.passingNetwork = this.analyticsEngine.passingNetwork.buildNetwork();
    }

    // Update pressing traps
    this.state.analytics.pressingTraps = this.analyticsEngine.pressingDetector.detectTraps();
  }

  private updatePatternRecognition(events: SimulationEvent[]): void {
    // Convert player states to pattern recognition format
    const homePlayers = this.state.players.home.map(p => ({
      x: p.position.x,
      y: p.position.y,
      name: p.name,
      role: p.role
    }));

    const awayPlayers = this.state.players.away.map(p => ({
      x: p.position.x,
      y: p.position.y,
      name: p.name,
      role: p.role
    }));

    const ballPos = {
      x: this.state.ball.position.x,
      y: this.state.ball.position.y
    };

    // Detect patterns from current positions
    const detectedPatterns = this.patternEngine.analyzePositions(
      homePlayers,
      awayPlayers,
      ballPos,
      this.state.ball.team || 'home',
      this.state.minute
    );

    // Update state with active patterns
    this.state.patternRecognition.activePatterns = {
      home: this.patternEngine.getActivePatterns('home'),
      away: this.patternEngine.getActivePatterns('away')
    };

    // Log patterns MORE FREQUENTLY for faster tactical log updates
    // Lower threshold to 0.5 confidence for more granular logging
    for (const pattern of detectedPatterns) {
      if (pattern.confidence > 0.5) {
        // Determine outcome based on recent events
        const recentEvent = events.find(e => e.team === pattern.team);
        const outcome = {
          success: !recentEvent || !['interception', 'shot_off_target'].includes(recentEvent.type),
          result: (recentEvent?.type === 'goal' ? 'goal' :
                   recentEvent?.type?.includes('shot') ? 'shot' :
                   recentEvent?.type === 'key_pass' ? 'chance' :
                   recentEvent?.type === 'interception' ? 'turnover' :
                   'possession_retained') as 'goal' | 'shot' | 'chance' | 'turnover' | 'possession_retained' | 'foul_won' | 'nothing',
          duration: 1,
          endZone: pattern.zone
        };

        const xGCreated = recentEvent?.xG || 0;
        this.patternEngine.logPattern(pattern, recentEvent?.description || 'Pattern detected', outcome, xGCreated, 0);
      }
    }

    // Update logs and effects - keep more logs for faster scrolling display
    this.state.patternRecognition.recentLogs = this.patternEngine.getPatternLogs(undefined, 25);
    this.state.patternRecognition.compoundingEffects = this.patternEngine.getCompoundingEffects();

    // DYNAMIC COHERENCE - Update EVERY TICK for real-time display
    this.state.patternRecognition.coherence = {
      home: this.patternEngine.calculateCoherence('home', 'positional_play', this.state.minute),
      away: this.patternEngine.calculateCoherence('away', 'counter_attacking', this.state.minute)
    };

    // MARKOV CHAIN - Update recurrent sequences and predictions
    const homeChain = this.patternEngine.getChainSummary('home');
    const awayChain = this.patternEngine.getChainSummary('away');
    const homePredicted = this.patternEngine.getPredictedNextPattern('home');
    const awayPredicted = this.patternEngine.getPredictedNextPattern('away');

    this.state.patternRecognition.markov = {
      recurrentSequences: this.patternEngine.getRecurrentSequences(),
      currentChains: {
        home: homeChain.currentChain,
        away: awayChain.currentChain
      },
      topTransitions: {
        home: this.patternEngine.getTopTransitions('home', 3),
        away: this.patternEngine.getTopTransitions('away', 3)
      },
      predictedNext: {
        home: homePredicted ? `${homePredicted.pattern.replace(/_/g, ' ')} (${(homePredicted.probability * 100).toFixed(0)}%)` : null,
        away: awayPredicted ? `${awayPredicted.pattern.replace(/_/g, ' ')} (${(awayPredicted.probability * 100).toFixed(0)}%)` : null
      }
    };

    // Generate tactical log events more frequently (30% chance)
    if (detectedPatterns.length > 0) {
      const topPattern = detectedPatterns.reduce((best, p) =>
        p.confidence > best.confidence ? p : best, detectedPatterns[0]);

      if (topPattern.confidence > 0.6 && Math.random() < 0.3) { // 30% chance to log
        events.push(this.createEvent(
          'tactical_change',
          topPattern.team,
          topPattern.players[0] || 'Team',
          `TACTICAL: ${topPattern.description}`,
          undefined,
          ballPos
        ));
      }
    }
  }

  private checkGameEvents(events: SimulationEvent[]): void {
    // Check for shots
    const carrier = this.state.ball.carrier;
    if (carrier) {
      const isHome = carrier.startsWith('home');
      const players = isHome ? this.state.players.home : this.state.players.away;
      const player = players.find(p => p.id === carrier);

      if (player) {
        const goalX = isHome ? 105 : 0;
        const distToGoal = Math.abs(player.position.x - goalX);

        // Shot chance in final third
        if (distToGoal < 25 && Math.random() < 0.02) {
          this.attemptShot(isHome ? 'home' : 'away', player, events);
        }
      }
    }

    // Check for possession changes
    if (Math.random() < 0.005) {
      this.changePossession(events);
    }
  }

  private attemptShot(team: 'home' | 'away', shooter: PlayerState, events: SimulationEvent[]): void {
    // Calculate xG
    const goalX = team === 'home' ? 105 : 0;
    const distance = Math.abs(shooter.position.x - goalX);
    const angle = Math.atan2(3.66, distance);  // Half goal width
    const baseXG = Math.max(0.02, 0.35 - distance * 0.01) * Math.sin(angle);

    // Performance modifiers
    const modifier = shooter.technicalMod * shooter.decisionMod;
    const finalXG = baseXG * modifier;

    // Record shot in analytics
    this.analyticsEngine.recordShot({
      position: shooter.position,
      bodyPart: 'right_foot',
      assistType: 'none',
      defendersPressure: 50,
      goalkeeperPosition: { x: goalX, y: 34 },
      isOneOnOne: false,
      isPenalty: false,
      isFreeKick: false,
      gameState: 'open_play',
      minute: this.state.minute,
      shotPower: 70,
      shotPlacement: { x: goalX, y: 34 }
    }, team === 'home');

    // Update xG
    this.state.analytics[team === 'home' ? 'homeXG' : 'awayXG'] += finalXG;

    // Determine outcome
    const rand = Math.random();
    if (rand < finalXG * 1.5) {
      // GOAL!
      this.state.score[team]++;
      events.push(this.createEvent('goal', team, shooter.name,
        `GOAL! ${shooter.name} scores!`, finalXG, shooter.position));

      // Psychology impact
      this.state.psychology[team === 'home' ? 'homeMorale' : 'awayMorale'] += 10;
      this.state.psychology[team === 'home' ? 'homeMomentum' : 'awayMomentum'] += 30;
      this.state.psychology.crowdVolume = 100;

      this.kickoff(team === 'home' ? 'away' : 'home');
    } else if (rand < 0.4) {
      events.push(this.createEvent('shot_on_target', team, shooter.name,
        `${shooter.name}'s shot saved`, finalXG, shooter.position));
      this.changePossession(events);
    } else {
      events.push(this.createEvent('shot_off_target', team, shooter.name,
        `${shooter.name}'s shot goes wide`, finalXG, shooter.position));
      this.changePossession(events);
    }
  }

  private changePossession(events: SimulationEvent[]): void {
    const oldTeam = this.state.ball.team;
    const newTeam = oldTeam === 'home' ? 'away' : 'home';

    // Clear old carrier
    if (this.state.ball.carrier) {
      const oldPlayers = oldTeam === 'home' ? this.state.players.home : this.state.players.away;
      const oldCarrier = oldPlayers.find(p => p.id === this.state.ball.carrier);
      if (oldCarrier) oldCarrier.hasBall = false;
    }

    // Find nearest opponent
    const newPlayers = newTeam === 'home' ? this.state.players.home : this.state.players.away;
    const ballPos = { x: this.state.ball.position.x, y: this.state.ball.position.y };

    let nearestPlayer = newPlayers[5];  // Default to midfielder
    let nearestDist = Infinity;

    for (const player of newPlayers) {
      if (player.role === 'GK') continue;
      const dist = Vector.distance(player.position, ballPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPlayer = player;
      }
    }

    nearestPlayer.hasBall = true;
    this.state.ball.carrier = nearestPlayer.id;
    this.state.ball.team = newTeam;

    events.push(this.createEvent('interception', newTeam, nearestPlayer.name,
      `${nearestPlayer.name} wins possession`));

    // Momentum shift on turnover
    this.state.psychology[newTeam === 'home' ? 'homeMomentum' : 'awayMomentum'] += 5;
  }

  private recordPositionHistory(): void {
    this.positionHistory.home.push(this.state.players.home.map(p => ({ ...p.position })));
    this.positionHistory.away.push(this.state.players.away.map(p => ({ ...p.position })));

    // Keep last 500 frames
    if (this.positionHistory.home.length > 500) {
      this.positionHistory.home.shift();
      this.positionHistory.away.shift();
    }
  }

  private createEvent(
    type: SimulationEventType,
    team: 'home' | 'away',
    player: string,
    description: string,
    xG?: number,
    coordinates?: Vector2D
  ): SimulationEvent {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      minute: Math.floor(this.state.minute),
      type,
      team,
      player,
      description,
      xG,
      coordinates
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public getState(): SimulationState {
    return { ...this.state };
  }

  public getEvents(): SimulationEvent[] {
    return [...this.events];
  }

  public getRecentEvents(count: number = 10): SimulationEvent[] {
    return this.events.slice(-count);
  }

  public getAnalytics() {
    return this.analyticsEngine.getMatchAnalytics();
  }

  public getTacticalDecisions(): TacticalDecision[] {
    return this.state.recentDecisions;
  }

  public getPatternRecognition() {
    return {
      activePatterns: this.state.patternRecognition.activePatterns,
      recentLogs: this.state.patternRecognition.recentLogs,
      compoundingEffects: this.state.patternRecognition.compoundingEffects,
      coherence: this.state.patternRecognition.coherence
    };
  }

  public getPatternSummary(team: 'home' | 'away') {
    return this.patternEngine.getPatternSummary(team);
  }

  public getTacticalCoherence(team: 'home' | 'away', gameModel: string): TacticalCoherence {
    return this.patternEngine.calculateCoherence(team, gameModel, this.state.minute);
  }

  public simulateScenario(changes: Partial<TacticalState>): {
    xGFor: number;
    xGAgainst: number;
    recommendation: string;
  } {
    const result = simulateScenario(
      this.tacticalAI.home.getCurrentTactics(),
      changes,
      {
        buildUpStyle: 'direct',
        preferredFlank: 'balanced',
        pressingTrigger: 'mid',
        counterAttackSpeed: 80,
        setPlayDanger: 60,
        weakZones: [],
        strongZones: []
      },
      100
    );

    return {
      xGFor: result.xGFor,
      xGAgainst: result.xGAgainst,
      recommendation: result.recommendation
    };
  }

  public setTacticalStyle(team: 'home' | 'away', style: Partial<TacticalState>): void {
    this.state.tactics[team] = { ...this.state.tactics[team], ...style };
  }

  public getPositionHeatmap(team: 'home' | 'away', playerIndex?: number): HeatmapData {
    const history = this.positionHistory[team];
    const positions: Vector2D[] = [];

    for (const frame of history) {
      if (playerIndex !== undefined) {
        positions.push(frame[playerIndex]);
      } else {
        positions.push(...frame);
      }
    }

    return this.analyticsEngine.heatmapGenerator.generateFromPositions(positions);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createAdvancedSimulation(): SimulationController {
  return new SimulationController({
    homeTeam: {
      name: 'Manchester City',
      formation: '4-3-3',
      players: ['Ederson', 'Walker', 'Dias', 'Stones', 'Gvardiol', 'Rodri', 'De Bruyne', 'Silva', 'Doku', 'Haaland', 'Foden']
    },
    awayTeam: {
      name: 'Manchester United',
      formation: '4-2-3-1',
      players: ['Onana', 'Dalot', 'de Ligt', 'Martinez', 'Shaw', 'Casemiro', 'Mainoo', 'Fernandes', 'Garnacho', 'Rashford', 'Hojlund']
    },
    environment: {
      temperature: 12,
      humidity: 65,
      pitchCondition: 'dry',
      windSpeed: 3
    },
    stakes: {
      importance: 90,
      rivalryLevel: 95,
      mediaAttention: 95
    }
  });
}
