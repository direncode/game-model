// Game Engine - Guardiola's Total Football / Positional Play (Juego de Posición)
// Based on Johan Cruyff's principles, evolved through Barcelona, Bayern, and Manchester City
// Core: Possession as control, high pressing, positional fluidity, 5 vertical corridors

import type { Player, TrackingMetrics } from '@/types';

// ==================== Types ====================

export interface MatchState {
  minute: number;
  phase: 'pre_match' | 'first_half' | 'half_time' | 'second_half' | 'full_time' | 'extra_time' | 'penalties';
  homeScore: number;
  awayScore: number;
  possession: { home: number; away: number };
  events: MatchEvent[];
  currentPhase: 'buildUp' | 'progression' | 'finalThird' | 'pressing' | 'defensiveBlock' | 'transition';
  ballPosition: { x: number; y: number; zone: string };
  ballPossession: 'home' | 'away';
  momentum: 'home' | 'away' | 'neutral';
  intensity: number;
  // Defensive block visualization
  defensiveBlock: {
    team: 'home' | 'away';
    type: 'high' | 'mid' | 'low';
    lines: {
      defensive: { x: number; players: { x: number; y: number }[] };
      midfield: { x: number; players: { x: number; y: number }[] };
      forward: { x: number; players: { x: number; y: number }[] };
    };
  };
  pressingIntensity: number; // 0-100
}

export interface MatchEvent {
  id: string;
  minute: number;
  type: EventType;
  team: 'home' | 'away';
  primaryPlayer: string;
  secondaryPlayer?: string;
  description: string;
  coordinates?: { x: number; y: number };
  xG?: number;
  metadata?: Record<string, unknown>;
}

export type EventType =
  | 'goal' | 'shot_on_target' | 'shot_off_target' | 'shot_blocked' | 'save'
  | 'yellow_card' | 'red_card' | 'foul' | 'corner' | 'free_kick' | 'penalty'
  | 'offside' | 'substitution' | 'kickoff' | 'half_time' | 'full_time'
  | 'pass_completed' | 'tackle' | 'dribble' | 'cross' | 'clearance';

export interface MatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };
  offsides: { home: number; away: number };
  passes: { home: number; away: number };
  passAccuracy: { home: number; away: number };
  tackles: { home: number; away: number };
  saves: { home: number; away: number };
  xG: { home: number; away: number };
}

export interface MatchConfig {
  homeTeam: { name: string; shortName: string; formation: string; startingXI: string[]; manager: string };
  awayTeam: { name: string; shortName: string; formation: string; startingXI: string[]; manager: string };
  competition: string;
  matchday: number;
  venue: string;
  referee: string;
  season: string;
}

// ==================== Player Position ====================

interface PlayerPos {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  hasBall: boolean;
  corridor: number; // 1-5 vertical corridors
  role: string;
}

// ==================== 5 VERTICAL CORRIDORS ====================
// Corridor 1: Left flank (y: 0-20)
// Corridor 2: Left half-space (y: 20-40)
// Corridor 3: Central (y: 40-60)
// Corridor 4: Right half-space (y: 60-80)
// Corridor 5: Right flank (y: 80-100)

// City 4-3-3 → In Possession becomes 3-2-4-1 or 2-3-5
// Inverted full-backs, sweeper keeper, positional fluidity
const CITY_BASE: { x: number; y: number; role: string; corridor: number }[] = [
  { x: 6, y: 50, role: 'GK', corridor: 3 },        // 0: Ederson - Sweeper Keeper
  { x: 20, y: 82, role: 'RB_INV', corridor: 5 },   // 1: Walker - Inverts to midfield
  { x: 16, y: 60, role: 'CB', corridor: 4 },       // 2: Dias - Ball-playing CB
  { x: 16, y: 40, role: 'CB', corridor: 2 },       // 3: Stones - Can step into midfield
  { x: 20, y: 18, role: 'LB', corridor: 1 },       // 4: Gvardiol - Overlapping runs
  { x: 32, y: 50, role: 'PIVOT', corridor: 3 },    // 5: Rodri - Single pivot, recycler
  { x: 45, y: 65, role: 'CM_ADV', corridor: 4 },   // 6: De Bruyne - Right half-space
  { x: 45, y: 35, role: 'CM_ADV', corridor: 2 },   // 7: Silva - Left half-space
  { x: 58, y: 85, role: 'RW', corridor: 5 },       // 8: Foden - Width + cut inside
  { x: 60, y: 50, role: 'ST', corridor: 3 },       // 9: Haaland - Target man
  { x: 58, y: 15, role: 'LW', corridor: 1 },       // 10: Doku - Width + dribbling
];

// Opposition - Generic deep block (represents typical low-block opposition)
const OPPOSITION_BASE: { x: number; y: number; role: string }[] = [
  { x: 94, y: 50, role: 'GK' },
  { x: 82, y: 20, role: 'RB' },
  { x: 85, y: 40, role: 'CB' },
  { x: 85, y: 60, role: 'CB' },
  { x: 82, y: 80, role: 'LB' },
  { x: 70, y: 35, role: 'CM' },
  { x: 70, y: 65, role: 'CM' },
  { x: 60, y: 20, role: 'RM' },
  { x: 55, y: 50, role: 'CAM' },
  { x: 60, y: 80, role: 'LM' },
  { x: 50, y: 50, role: 'ST' },
];

// ==================== Game Engine ====================

export class GameEngine {
  private config: MatchConfig;
  private state: MatchState;
  private stats: MatchStats;

  private homePositions: PlayerPos[] = [];
  private awayPositions: PlayerPos[] = [];

  private ballCarrierTeam: 'home' | 'away' = 'home';
  private ballCarrierIndex: number = 5; // Rodri starts

  private ballX: number = 50;
  private ballY: number = 50;

  private lastPassTime: number = 0;
  private possessionTime: { home: number; away: number } = { home: 0, away: 0 };
  private movementPhase: number = 0;

  // Total Football specific
  private playPhase: 'buildUp' | 'progression' | 'finalThird' | 'pressing' = 'buildUp';
  private pauseTimer: number = 0; // La Pausa mechanic
  private overloadSide: 'left' | 'right' | 'center' = 'center';
  private invertedFullbacks: boolean = false;

  constructor(config: MatchConfig) {
    this.config = config;
    this.state = this.initState();
    this.stats = this.initStats();
    this.initPositions();
  }

  private initState(): MatchState {
    return {
      minute: 0,
      phase: 'pre_match',
      homeScore: 0,
      awayScore: 0,
      possession: { home: 65, away: 35 }, // City typical dominance
      events: [],
      currentPhase: 'buildUp',
      ballPosition: { x: 50, y: 50, zone: 'center' },
      ballPossession: 'home',
      momentum: 'home',
      intensity: 0.85, // Premier League intensity
      defensiveBlock: {
        team: 'away',
        type: 'low',
        lines: {
          defensive: { x: 85, players: [] },
          midfield: { x: 70, players: [] },
          forward: { x: 55, players: [] },
        },
      },
      pressingIntensity: 85, // High PL intensity
    };
  }

  private initStats(): MatchStats {
    return {
      possession: { home: 65, away: 35 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 },
      offsides: { home: 0, away: 0 },
      passes: { home: 0, away: 0 },
      passAccuracy: { home: 92, away: 75 }, // City's high accuracy
      tackles: { home: 0, away: 0 },
      saves: { home: 0, away: 0 },
      xG: { home: 0, away: 0 },
    };
  }

  private initPositions(): void {
    for (let i = 0; i < 11; i++) {
      const base = CITY_BASE[i];
      this.homePositions.push({
        x: base.x, y: base.y,
        baseX: base.x, baseY: base.y,
        targetX: base.x, targetY: base.y,
        hasBall: i === 5,
        corridor: base.corridor,
        role: base.role,
      });
    }

    for (let i = 0; i < 11; i++) {
      const base = OPPOSITION_BASE[i];
      this.awayPositions.push({
        x: base.x, y: base.y,
        baseX: base.x, baseY: base.y,
        targetX: base.x, targetY: base.y,
        hasBall: false,
        corridor: 3,
        role: base.role,
      });
    }
  }

  // ==================== Main Tick ====================

  public tick(seconds: number = 1): MatchEvent[] {
    const events: MatchEvent[] = [];

    this.state.minute += seconds / 60;
    this.movementPhase += 0.04;
    this.handlePhaseTransitions(events);

    if (this.state.phase === 'first_half' || this.state.phase === 'second_half') {
      this.possessionTime[this.ballCarrierTeam] += seconds;

      if (this.ballCarrierTeam === 'home') {
        this.updateTotalFootball(events);
      } else {
        this.updateOppositionPossession(events);
      }

      // Update defending team
      if (this.ballCarrierTeam === 'home') {
        this.updateOppositionDefending();
      } else {
        this.updateCityGegenpressing();
      }

      this.updateBallPosition();
      this.updateDefensiveBlockLines();
      this.maybeChangePossession(events);
      this.updatePossessionStats();
    }

    return events;
  }

  private handlePhaseTransitions(events: MatchEvent[]): void {
    const min = this.state.minute;

    if (min >= 0 && min < 0.5 && this.state.phase === 'pre_match') {
      this.state.phase = 'first_half';
      this.ballCarrierTeam = 'home';
      this.ballCarrierIndex = 5; // Rodri
      this.homePositions[5].hasBall = true;
      events.push(this.createEvent('kickoff', 'home', 'Rodri', 'Kickoff! City begin their positional play'));
    } else if (min >= 45 && min < 45.5 && this.state.phase === 'first_half') {
      this.state.phase = 'half_time';
      events.push(this.createEvent('half_time', 'home', '', `Half Time: MCI ${this.state.homeScore} - ${this.state.awayScore} OPP`));
    } else if (min >= 46 && min < 46.5 && this.state.phase === 'half_time') {
      this.state.phase = 'second_half';
      this.resetBallToCenter('away');
      events.push(this.createEvent('kickoff', 'away', 'Opposition', 'Second half begins'));
    } else if (min >= 90 && this.state.phase === 'second_half') {
      this.state.phase = 'full_time';
      events.push(this.createEvent('full_time', 'home', '', `Full Time: MCI ${this.state.homeScore} - ${this.state.awayScore} OPP`));
    }
  }

  // ==================== TOTAL FOOTBALL - POSITIONAL PLAY ====================

  private updateTotalFootball(events: MatchEvent[]): void {
    this.lastPassTime += 1;

    // Determine play phase based on ball position
    if (this.ballX < 35) {
      this.playPhase = 'buildUp';
    } else if (this.ballX < 65) {
      this.playPhase = 'progression';
    } else {
      this.playPhase = 'finalThird';
    }

    // LA PAUSA - Pause to draw press, then accelerate
    this.pauseTimer += 1;
    const isPausing = this.pauseTimer < 8 && Math.random() < 0.3;

    // Passing frequency varies by phase
    const passThreshold = this.playPhase === 'buildUp' ? 18 :
                          this.playPhase === 'progression' ? 14 : 10;

    if (this.lastPassTime > passThreshold + Math.random() * 12 && !isPausing) {
      this.totalFootballPass(events);
      this.lastPassTime = 0;
      this.pauseTimer = 0;
    }

    // Decide overload side periodically
    if (Math.random() < 0.02) {
      this.overloadSide = ['left', 'right', 'center'][Math.floor(Math.random() * 3)] as 'left' | 'right' | 'center';
    }

    // Inverted fullbacks when in progression/final third
    this.invertedFullbacks = this.ballX > 40 && Math.random() < 0.7;

    // Update all player positions based on Total Football principles
    this.updateCityPositionalPlay();
  }

  private updateCityPositionalPlay(): void {
    const ballX = this.ballX;
    const ballY = this.ballY;

    for (let i = 0; i < 11; i++) {
      const pos = this.homePositions[i];
      const base = CITY_BASE[i];

      // Cyclical movement for fluidity
      const phase = this.movementPhase + i * 0.7;
      const cycleX = Math.sin(phase) * 3;
      const cycleY = Math.cos(phase * 0.6) * 4;

      // Overload calculation
      const overloadPull = this.overloadSide === 'left' ? -8 :
                           this.overloadSide === 'right' ? 8 : 0;

      switch (i) {
        case 0: // Ederson - Sweeper Keeper
          // Comes high to receive back passes, acts as extra defender
          const gkAdvance = this.playPhase === 'buildUp' ? 10 : 4;
          pos.targetX = base.x + gkAdvance + cycleX * 0.2;
          pos.targetY = ballY * 0.15 + 42.5 + cycleY * 0.3;
          break;

        case 1: // Walker - Inverted RB
          if (this.invertedFullbacks) {
            // Inverts to become extra midfielder in right half-space
            pos.targetX = Math.min(55, ballX - 5) + cycleX;
            pos.targetY = 60 + cycleY; // Right half-space
          } else {
            pos.targetX = base.x + (ballX - 30) * 0.2 + cycleX;
            pos.targetY = base.y + overloadPull * 0.3 + cycleY;
          }
          break;

        case 2: // Dias - Ball-playing CB
          // Steps up when building, pauses to scan (La Pausa)
          pos.targetX = base.x + (this.playPhase === 'buildUp' ? 8 : 4) + cycleX * 0.5;
          pos.targetY = base.y + (ballY - 50) * 0.15 + cycleY * 0.5;
          break;

        case 3: // Stones - Can step into midfield
          const stonesAdvance = this.invertedFullbacks && ballX > 45 ? 15 : 5;
          pos.targetX = base.x + stonesAdvance + cycleX * 0.5;
          pos.targetY = base.y + (ballY - 50) * 0.15 + cycleY * 0.5;
          break;

        case 4: // Gvardiol - Overlapping LB
          // Overlaps to provide width on left
          const gvardiolPush = this.playPhase === 'finalThird' ? 20 : 8;
          pos.targetX = base.x + gvardiolPush + cycleX;
          pos.targetY = Math.max(8, base.y + overloadPull * 0.5 + cycleY);
          break;

        case 5: // Rodri - Single Pivot
          // Screens, recycles, maintains balance - 80% recycling
          pos.targetX = Math.max(25, ballX - 18) + cycleX * 0.5;
          pos.targetY = 50 + (ballY - 50) * 0.2 + cycleY * 0.5;
          break;

        case 6: // De Bruyne - Right half-space maestro
          // Occupies right half-space, ghosting runs, key passes
          const kdbPush = this.playPhase === 'finalThird' ? 15 : 8;
          pos.targetX = Math.min(75, ballX + kdbPush) + cycleX;
          pos.targetY = 65 + overloadPull + cycleY; // Right half-space
          break;

        case 7: // Silva - Left half-space
          // Left half-space orchestrator, tight combinations
          const silvaPush = this.playPhase === 'finalThird' ? 12 : 6;
          pos.targetX = Math.min(70, ballX + silvaPush) + cycleX;
          pos.targetY = 35 + overloadPull + cycleY; // Left half-space
          break;

        case 8: // Foden - Right Wing
          // Stretches defense, cuts inside, combinations
          const fodenWidth = this.overloadSide === 'right' ? 90 : 82;
          pos.targetX = Math.min(78, ballX + 12) + cycleX;
          pos.targetY = Math.min(92, fodenWidth + cycleY);
          break;

        case 9: // Haaland - Target Man
          // Stays high, occupies CBs, finisher
          pos.targetX = Math.max(55, Math.min(82, ballX + 8)) + cycleX * 0.5;
          pos.targetY = 50 + (ballY - 50) * 0.25 + cycleY * 0.7;
          break;

        case 10: // Doku - Left Wing (Ball carrier emphasis)
          // Width + direct dribbling, 1v1 specialist
          const dokuWidth = this.overloadSide === 'left' ? 8 : 18;
          pos.targetX = Math.min(75, ballX + 10) + cycleX;
          pos.targetY = Math.max(8, dokuWidth + cycleY);
          break;
      }

      // Ball carrier moves differently
      if (pos.hasBall) {
        pos.targetX = Math.min(78, pos.x + 0.8);
      }

      // Smooth movement with varying speeds
      const speed = pos.hasBall ? 0.05 : 0.055;
      pos.x += (pos.targetX - pos.x) * speed;
      pos.y += (pos.targetY - pos.y) * speed;

      // Corridor awareness
      pos.corridor = Math.ceil(pos.y / 20);
    }
  }

  private totalFootballPass(events: MatchEvent[]): void {
    const fromIdx = this.ballCarrierIndex;
    const fromPlayer = this.config.homeTeam.startingXI[fromIdx];
    const carrier = this.homePositions[fromIdx];

    // Build passing options weighted by Guardiola principles
    const options: { idx: number; weight: number; type: string }[] = [];

    for (let i = 0; i < 11; i++) {
      if (i === fromIdx) continue;
      const target = this.homePositions[i];
      const dist = Math.sqrt(Math.pow(target.x - carrier.x, 2) + Math.pow(target.y - carrier.y, 2));

      let weight = 10;
      let passType = 'short';

      // SHORT PASSES PREFERRED (Tiki-Taka principle)
      if (dist < 15) {
        weight *= 2.5; // Strong preference for short passes
        passType = 'short';
      } else if (dist < 25) {
        weight *= 1.5;
        passType = 'medium';
      } else if (dist > 40) {
        weight *= 0.4; // Penalty for long passes
        passType = 'long';
      }

      // TRIANGLES - Prefer adjacent corridors
      const corridorDiff = Math.abs(target.corridor - carrier.corridor);
      if (corridorDiff <= 1) weight *= 1.4;

      // PROGRESSION - Forward passes rewarded
      if (target.x > carrier.x) weight *= 1.3;

      // HALF-SPACE PREFERENCE (corridors 2 and 4)
      if (target.corridor === 2 || target.corridor === 4) weight *= 1.5;

      // KEY PLAYERS bonus
      if (i === 5) weight *= 1.3; // Rodri recycling
      if (i === 6) weight *= 1.4; // De Bruyne vision
      if (i === 7) weight *= 1.3; // Silva combinations

      // OVERLOAD awareness
      if (this.overloadSide === 'left' && target.y < 40) weight *= 1.3;
      if (this.overloadSide === 'right' && target.y > 60) weight *= 1.3;

      options.push({ idx: i, weight, type: passType });
    }

    // Select pass target
    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let rand = Math.random() * totalWeight;
    let toIdx = options[0].idx;
    let passType = 'short';

    for (const opt of options) {
      rand -= opt.weight;
      if (rand <= 0) {
        toIdx = opt.idx;
        passType = opt.type;
        break;
      }
    }

    const toPlayer = this.config.homeTeam.startingXI[toIdx];

    // Execute pass
    this.homePositions[fromIdx].hasBall = false;
    this.homePositions[toIdx].hasBall = true;
    this.ballCarrierIndex = toIdx;

    this.stats.passes.home++;

    // Log significant passes
    if (Math.random() < 0.12 || passType === 'long') {
      const desc = passType === 'short' ? `${fromPlayer} → ${toPlayer}` :
                   passType === 'long' ? `${fromPlayer} switches to ${toPlayer}` :
                   `${fromPlayer} finds ${toPlayer}`;
      events.push(this.createEvent('pass_completed', 'home', fromPlayer, desc));
    }

    // Shot opportunity in final third
    if (this.homePositions[toIdx].x > 68 && Math.random() < 0.14) {
      this.attemptShot('home', toIdx, events);
    }
  }

  // ==================== GEGENPRESSING - PREMIER LEAGUE MAX INTENSITY ====================

  private updateCityGegenpressing(): void {
    // MAXIMUM INTENSITY - Premier League gegenpressing
    // Immediate counter-press on ball loss - 5 second rule, swarm the ball
    const ballX = this.ballX;
    const ballY = this.ballY;

    for (let i = 0; i < 11; i++) {
      const pos = this.homePositions[i];
      const base = CITY_BASE[i];

      const phase = this.movementPhase + i * 0.5;
      const jitterX = Math.sin(phase) * 2.5;
      const jitterY = Math.cos(phase * 0.7) * 3;

      // Distance affects pressing intensity - MAXIMUM for PL
      const distToBall = Math.sqrt(Math.pow(pos.x - ballX, 2) + Math.pow(pos.y - ballY, 2));
      const pressIntensity = Math.max(0.4, 1 - distToBall / 40); // Higher baseline

      if (i === 0) {
        // Ederson sweeps aggressively
        pos.targetX = Math.max(12, Math.min(28, ballX - 30));
        pos.targetY = ballY * 0.25 + 37.5 + jitterY * 0.4;
      } else if (i >= 8) {
        // Forwards HUNT the ball - max press
        pos.targetX = Math.max(30, ballX - 5 * pressIntensity) + jitterX;
        pos.targetY = ballY + (i === 8 ? 8 : i === 10 ? -8 : 0) * pressIntensity + jitterY;
      } else if (i >= 5 && i <= 7) {
        // Midfield swarms aggressively
        pos.targetX = Math.max(25, ballX - 12) + jitterX;
        pos.targetY = base.y + (ballY - 50) * 0.6 + jitterY;
      } else {
        // Defense pushes HIGH - aggressive line
        pos.targetX = Math.min(42, ballX - 15) + jitterX * 0.6;
        pos.targetY = base.y + (ballY - 50) * 0.35 + jitterY * 0.6;
      }

      // MAXIMUM press speed for PL intensity
      const speed = 0.08 + pressIntensity * 0.07;
      pos.x += (pos.targetX - pos.x) * speed;
      pos.y += (pos.targetY - pos.y) * speed;
    }
  }

  // ==================== OPPOSITION ====================

  private updateOppositionPossession(events: MatchEvent[]): void {
    this.lastPassTime += 1;

    // Opposition plays direct, less sophisticated
    if (this.lastPassTime > 25 + Math.random() * 20) {
      this.opponentPass(events);
      this.lastPassTime = 0;
    }

    // Basic movement
    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const base = OPPOSITION_BASE[i];
      const phase = this.movementPhase + i * 0.4;

      pos.targetX = base.x + Math.sin(phase) * 3 + (pos.hasBall ? -3 : 0);
      pos.targetY = base.y + Math.cos(phase * 0.6) * 4;

      pos.x += (pos.targetX - pos.x) * 0.05;
      pos.y += (pos.targetY - pos.y) * 0.05;
    }
  }

  private opponentPass(events: MatchEvent[]): void {
    const fromIdx = this.ballCarrierIndex;

    // Simple forward passing
    const options = [];
    for (let i = 0; i < 11; i++) {
      if (i === fromIdx) continue;
      const target = this.awayPositions[i];
      let weight = target.x < this.awayPositions[fromIdx].x ? 2 : 1;
      if (i >= 8) weight *= 1.5;
      options.push({ idx: i, weight });
    }

    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let rand = Math.random() * totalWeight;
    let toIdx = 5;

    for (const opt of options) {
      rand -= opt.weight;
      if (rand <= 0) { toIdx = opt.idx; break; }
    }

    this.awayPositions[fromIdx].hasBall = false;
    this.awayPositions[toIdx].hasBall = true;
    this.ballCarrierIndex = toIdx;
    this.stats.passes.away++;

    if (this.awayPositions[toIdx].x < 30 && Math.random() < 0.18) {
      this.attemptShot('away', toIdx, events);
    }
  }

  private updateOppositionDefending(): void {
    // Deep block against City's possession
    const ballX = this.ballX;
    const ballY = this.ballY;

    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const base = OPPOSITION_BASE[i];

      const phase = this.movementPhase + i * 0.4;
      const jitterX = Math.sin(phase) * 1.5;
      const jitterY = Math.cos(phase * 0.6) * 2;

      if (i === 0) {
        pos.targetX = base.x + jitterX * 0.2;
        pos.targetY = ballY * 0.2 + 40 + jitterY * 0.3;
      } else if (i <= 4) {
        // Deep defensive line
        pos.targetX = Math.max(72, Math.min(88, ballX + 22)) + jitterX * 0.5;
        pos.targetY = base.y + (ballY - 50) * 0.25 + jitterY;
      } else if (i <= 7) {
        // Midfield blocks
        pos.targetX = Math.max(55, Math.min(75, ballX + 12)) + jitterX;
        pos.targetY = base.y + (ballY - 50) * 0.35 + jitterY;
      } else {
        // Forwards drop to help
        pos.targetX = Math.max(45, Math.min(65, ballX + 5)) + jitterX;
        pos.targetY = base.y + (ballY - 50) * 0.2 + jitterY;
      }

      pos.x += (pos.targetX - pos.x) * 0.05;
      pos.y += (pos.targetY - pos.y) * 0.05;
    }
  }

  // ==================== Ball & Possession ====================

  private updateBallPosition(): void {
    const positions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
    const carrier = positions[this.ballCarrierIndex];

    const dx = carrier.x - this.ballX;
    const dy = carrier.y - this.ballY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.5) {
      const speed = Math.min(dist * 0.12, 1.2);
      this.ballX += (dx / dist) * speed;
      this.ballY += (dy / dist) * speed;
    } else {
      this.ballX = carrier.x;
      this.ballY = carrier.y;
    }

    this.state.ballPosition.x = this.ballX;
    this.state.ballPosition.y = this.ballY;
    this.state.ballPossession = this.ballCarrierTeam;
    this.state.currentPhase = this.playPhase;
  }

  private updateDefensiveBlockLines(): void {
    // Determine which team is defending
    const defendingTeam = this.ballCarrierTeam === 'home' ? 'away' : 'home';
    const positions = defendingTeam === 'home' ? this.homePositions : this.awayPositions;

    // Calculate defensive lines from player positions
    const defLine: { x: number; y: number }[] = [];
    const midLine: { x: number; y: number }[] = [];
    const fwdLine: { x: number; y: number }[] = [];

    if (defendingTeam === 'away') {
      // Opposition defending (low/mid block against City)
      // GK excluded, defenders 1-4, midfielders 5-7, forwards 8-10
      for (let i = 1; i <= 4; i++) defLine.push({ x: positions[i].x, y: positions[i].y });
      for (let i = 5; i <= 7; i++) midLine.push({ x: positions[i].x, y: positions[i].y });
      for (let i = 8; i <= 10; i++) fwdLine.push({ x: positions[i].x, y: positions[i].y });

      // Determine block type based on average defensive line position
      const avgDefX = defLine.reduce((s, p) => s + p.x, 0) / defLine.length;
      const blockType = avgDefX > 80 ? 'low' : avgDefX > 65 ? 'mid' : 'high';

      this.state.defensiveBlock = {
        team: 'away',
        type: blockType,
        lines: {
          defensive: { x: avgDefX, players: defLine.sort((a, b) => a.y - b.y) },
          midfield: { x: midLine.reduce((s, p) => s + p.x, 0) / midLine.length, players: midLine.sort((a, b) => a.y - b.y) },
          forward: { x: fwdLine.reduce((s, p) => s + p.x, 0) / fwdLine.length, players: fwdLine.sort((a, b) => a.y - b.y) },
        },
      };

      // Pressing intensity based on ball position (higher when ball is closer)
      this.state.pressingIntensity = Math.min(95, 70 + (100 - this.ballX) * 0.4);
    } else {
      // City defending (high press / gegenpressing)
      for (let i = 1; i <= 4; i++) defLine.push({ x: positions[i].x, y: positions[i].y });
      for (let i = 5; i <= 7; i++) midLine.push({ x: positions[i].x, y: positions[i].y });
      for (let i = 8; i <= 10; i++) fwdLine.push({ x: positions[i].x, y: positions[i].y });

      const avgDefX = defLine.reduce((s, p) => s + p.x, 0) / defLine.length;
      const blockType = avgDefX < 25 ? 'high' : avgDefX < 40 ? 'mid' : 'low';

      this.state.defensiveBlock = {
        team: 'home',
        type: blockType,
        lines: {
          defensive: { x: avgDefX, players: defLine.sort((a, b) => a.y - b.y) },
          midfield: { x: midLine.reduce((s, p) => s + p.x, 0) / midLine.length, players: midLine.sort((a, b) => a.y - b.y) },
          forward: { x: fwdLine.reduce((s, p) => s + p.x, 0) / fwdLine.length, players: fwdLine.sort((a, b) => a.y - b.y) },
        },
      };

      // City presses intensely - PL max intensity
      this.state.pressingIntensity = Math.min(98, 85 + this.ballX * 0.15);
    }
  }

  private maybeChangePossession(events: MatchEvent[]): void {
    const positions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
    const carrier = positions[this.ballCarrierIndex];

    // City's 92% pass accuracy means lower loss rate
    let loseChance = this.ballCarrierTeam === 'home' ? 0.005 : 0.012;

    // Higher risk in final third
    if (this.ballCarrierTeam === 'home' && carrier.x > 70) loseChance *= 1.8;
    if (this.ballCarrierTeam === 'away' && carrier.x < 30) loseChance *= 1.5;

    if (Math.random() < loseChance) {
      this.transferPossession(events);
    }
  }

  private transferPossession(events: MatchEvent[]): void {
    const oldTeam = this.ballCarrierTeam;
    const oldCarrier = oldTeam === 'home'
      ? this.config.homeTeam.startingXI[this.ballCarrierIndex]
      : this.config.awayTeam.startingXI[this.ballCarrierIndex];

    this.clearBallCarriers();

    const opponents = oldTeam === 'home' ? this.awayPositions : this.homePositions;
    let nearestIdx = 5;
    let nearestDist = 1000;

    for (let i = 1; i < 11; i++) {
      const dist = Math.sqrt(
        Math.pow(opponents[i].x - this.ballX, 2) +
        Math.pow(opponents[i].y - this.ballY, 2)
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    this.ballCarrierTeam = oldTeam === 'home' ? 'away' : 'home';
    this.ballCarrierIndex = nearestIdx;

    const newPositions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
    newPositions[nearestIdx].hasBall = true;

    const newCarrier = this.ballCarrierTeam === 'home'
      ? this.config.homeTeam.startingXI[nearestIdx]
      : this.config.awayTeam.startingXI[nearestIdx];

    this.stats.tackles[this.ballCarrierTeam]++;
    events.push(this.createEvent('tackle', this.ballCarrierTeam, newCarrier, `${newCarrier} wins possession from ${oldCarrier}`));
  }

  private clearBallCarriers(): void {
    for (const pos of this.homePositions) pos.hasBall = false;
    for (const pos of this.awayPositions) pos.hasBall = false;
  }

  private resetBallToCenter(team: 'home' | 'away'): void {
    this.clearBallCarriers();
    this.ballCarrierTeam = team;
    this.ballCarrierIndex = team === 'home' ? 9 : 10;
    const positions = team === 'home' ? this.homePositions : this.awayPositions;
    positions[this.ballCarrierIndex].hasBall = true;
    this.ballX = 50;
    this.ballY = 50;
  }

  // ==================== Shooting ====================

  private attemptShot(team: 'home' | 'away', shooterIdx: number, events: MatchEvent[]): void {
    const shooter = team === 'home'
      ? this.config.homeTeam.startingXI[shooterIdx]
      : this.config.awayTeam.startingXI[shooterIdx];

    const rand = Math.random();
    this.stats.shots[team]++;

    // City's higher xG conversion
    const goalChance = team === 'home' ? 0.18 : 0.12;

    if (rand < goalChance) {
      if (team === 'home') this.state.homeScore++;
      else this.state.awayScore++;

      this.stats.shotsOnTarget[team]++;
      this.stats.xG[team] += 0.35 + Math.random() * 0.35;
      events.push(this.createEvent('goal', team, shooter, `GOAL! ${shooter} scores!`));
      this.resetBallToCenter(team === 'home' ? 'away' : 'home');

    } else if (rand < 0.45) {
      this.stats.shotsOnTarget[team]++;
      this.stats.saves[team === 'home' ? 'away' : 'home']++;
      this.stats.xG[team] += 0.12 + Math.random() * 0.15;

      const keeper = team === 'home' ? 'Opposition GK' : 'Ederson';
      events.push(this.createEvent('shot_on_target', team, shooter, `${shooter}'s shot saved by ${keeper}`));

      this.clearBallCarriers();
      this.ballCarrierTeam = team === 'home' ? 'away' : 'home';
      this.ballCarrierIndex = 0;
      const pos = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
      pos[0].hasBall = true;

    } else {
      this.stats.xG[team] += 0.04 + Math.random() * 0.08;
      events.push(this.createEvent('shot_off_target', team, shooter, `${shooter}'s shot goes wide`));

      this.clearBallCarriers();
      this.ballCarrierTeam = team === 'home' ? 'away' : 'home';
      this.ballCarrierIndex = 0;
      const pos = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
      pos[0].hasBall = true;
    }
  }

  private updatePossessionStats(): void {
    const total = this.possessionTime.home + this.possessionTime.away;
    if (total > 0) {
      const homePoss = Math.round((this.possessionTime.home / total) * 100);
      this.state.possession = { home: Math.max(55, Math.min(75, homePoss)), away: Math.min(45, Math.max(25, 100 - homePoss)) };
      this.stats.possession = this.state.possession;
    }
  }

  private createEvent(type: EventType, team: 'home' | 'away', player: string, description: string): MatchEvent {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      minute: Math.floor(this.state.minute),
      type, team, primaryPlayer: player, description,
    };
  }

  // ==================== Public API ====================

  public kickoff(): void {
    this.state.phase = 'first_half';
    this.state.minute = 0;
    this.ballCarrierTeam = 'home';
    this.ballCarrierIndex = 5;
    this.clearBallCarriers();
    this.homePositions[5].hasBall = true;
    this.ballX = 50;
    this.ballY = 50;
  }

  public getState(): MatchState { return { ...this.state }; }
  public getStats(): MatchStats { return { ...this.stats }; }
  public getConfig(): MatchConfig { return this.config; }

  public generatePlayerMetrics(player: Player, isHome: boolean, playerIndex: number): TrackingMetrics {
    const idx = Math.min(playerIndex, 10);
    const pos = isHome ? this.homePositions[idx] : this.awayPositions[idx];
    const minute = Math.max(1, this.state.minute);

    const baseDistance = minute * 108;
    const isGK = idx === 0;
    const mult = isGK ? 0.38 : 1.0;

    return {
      totalDistance: baseDistance * mult,
      distancePerMinute: 108 * mult,
      highSpeedRunningDistance: baseDistance * 0.095 * mult,
      sprintDistance: baseDistance * 0.038 * mult,
      walkingDistance: baseDistance * 0.20,
      joggingDistance: baseDistance * 0.38,
      runningDistance: baseDistance * 0.33,
      currentSpeed: pos.hasBall ? 11 + Math.random() * 6 : 5 + Math.random() * 9,
      averageSpeed: 7.4,
      maxSpeed: player.physicalProfile?.maxSpeed || 34,
      speedZones: {
        zone1: minute * 13, zone2: minute * 23, zone3: minute * 15,
        zone4: minute * 8, zone5: minute * 3, zone6: minute * 1,
      },
      accelerations: { low: Math.floor(minute * 0.65), medium: Math.floor(minute * 0.38), high: Math.floor(minute * 0.14), total: Math.floor(minute * 1.17) },
      decelerations: { low: Math.floor(minute * 0.58), medium: Math.floor(minute * 0.32), high: Math.floor(minute * 0.12), total: Math.floor(minute * 1.02) },
      maxAcceleration: 3.9,
      maxDeceleration: -3.7,
      playerLoad: minute * 5.4,
      playerLoadPerMinute: 5.4,
      metabolicPower: 12.2,
      highMetabolicLoadDistance: baseDistance * 0.13,
      position: {
        x: pos.x, y: pos.y,
        zone: 'middle_third',
        heatmap: { cells: [], resolution: { x: 21, y: 14 } },
      },
    };
  }
}

// ==================== Factory ====================

export function createManchesterDerby(): GameEngine {
  return new GameEngine({
    homeTeam: {
      name: 'Manchester City',
      shortName: 'MCI',
      formation: '4-3-3',
      startingXI: ['Ederson', 'Walker', 'Dias', 'Stones', 'Gvardiol', 'Rodri', 'De Bruyne', 'Silva', 'Foden', 'Haaland', 'Doku'],
      manager: 'Pep Guardiola',
    },
    awayTeam: {
      name: 'Opposition',
      shortName: 'OPP',
      formation: '4-4-2',
      startingXI: ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'ST', 'ST'],
      manager: 'Opposition Manager',
    },
    competition: 'Premier League',
    matchday: 16,
    venue: 'Etihad Stadium',
    referee: 'Michael Oliver',
    season: '2025/26',
  });
}

// ==================== Utilities ====================

export function formatMatchTime(minute: number): string {
  const mins = Math.floor(minute);
  const secs = Math.floor((minute % 1) * 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getMatchPhaseDisplay(phase: MatchState['phase']): string {
  const displays: Record<MatchState['phase'], string> = {
    pre_match: 'Pre-Match', first_half: '1st Half', half_time: 'Half Time',
    second_half: '2nd Half', full_time: 'Full Time', extra_time: 'Extra Time', penalties: 'Penalties',
  };
  return displays[phase];
}

export type { MatchConfig as TeamConfig };
