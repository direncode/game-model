// Simple Game Engine for Match Simulation
// Keeps it minimal and focused on visual correctness

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

// ==================== Simple Position Storage ====================

interface PlayerPosition {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
}

// Home team 4-3-3 base positions (attacking right, x: 0-50 is defensive half)
const HOME_BASE: { x: number; y: number }[] = [
  { x: 6, y: 50 },   // 0: GK
  { x: 18, y: 80 },  // 1: RB
  { x: 16, y: 60 },  // 2: CB
  { x: 16, y: 40 },  // 3: CB
  { x: 18, y: 20 },  // 4: LB
  { x: 32, y: 50 },  // 5: CDM
  { x: 38, y: 70 },  // 6: CM
  { x: 38, y: 30 },  // 7: CM
  { x: 45, y: 85 },  // 8: RW
  { x: 48, y: 50 },  // 9: ST
  { x: 45, y: 15 },  // 10: LW
];

// Away team 4-2-3-1 base positions (attacking left, x: 50-100 is their defensive half)
const AWAY_BASE: { x: number; y: number }[] = [
  { x: 94, y: 50 },  // 0: GK
  { x: 82, y: 20 },  // 1: RB
  { x: 84, y: 40 },  // 2: CB
  { x: 84, y: 60 },  // 3: CB
  { x: 82, y: 80 },  // 4: LB
  { x: 68, y: 40 },  // 5: CDM
  { x: 68, y: 60 },  // 6: CDM
  { x: 55, y: 15 },  // 7: RW
  { x: 55, y: 50 },  // 8: CAM
  { x: 55, y: 85 },  // 9: LW
  { x: 52, y: 50 },  // 10: ST
];

// ==================== Game Engine ====================

export class GameEngine {
  private config: MatchConfig;
  private state: MatchState;
  private stats: MatchStats;

  // Simple position storage - indexed by player index (0-10)
  private homePositions: PlayerPosition[] = [];
  private awayPositions: PlayerPosition[] = [];

  // Ball movement
  private ballTargetX: number = 50;
  private ballTargetY: number = 50;
  private ballSpeed: number = 2;
  private ticksSinceTargetChange: number = 0;

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
      possession: { home: 50, away: 50 },
      events: [],
      currentPhase: 'buildUp',
      ballPosition: { x: 50, y: 50, zone: 'center' },
      ballPossession: 'home',
      momentum: 'neutral',
      intensity: 0.5,
    };
  }

  private initStats(): MatchStats {
    return {
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 },
      offsides: { home: 0, away: 0 },
      passes: { home: 0, away: 0 },
      passAccuracy: { home: 85, away: 82 },
      tackles: { home: 0, away: 0 },
      saves: { home: 0, away: 0 },
      xG: { home: 0, away: 0 },
    };
  }

  private initPositions(): void {
    // Initialize home team positions
    for (let i = 0; i < 11; i++) {
      const base = HOME_BASE[i];
      this.homePositions.push({
        x: base.x,
        y: base.y,
        baseX: base.x,
        baseY: base.y,
      });
    }

    // Initialize away team positions
    for (let i = 0; i < 11; i++) {
      const base = AWAY_BASE[i];
      this.awayPositions.push({
        x: base.x,
        y: base.y,
        baseX: base.x,
        baseY: base.y,
      });
    }
  }

  // ==================== Main Tick ====================

  public tick(seconds: number = 1): MatchEvent[] {
    const events: MatchEvent[] = [];

    // Advance time
    this.state.minute += seconds / 60;

    // Handle phase transitions
    this.handlePhaseTransitions(events);

    // Only simulate during play
    if (this.state.phase === 'first_half' || this.state.phase === 'second_half') {
      this.updateBall();
      this.updatePlayers();
      this.maybeGenerateEvent(events);
      this.updatePossessionStats();
    }

    return events;
  }

  private handlePhaseTransitions(events: MatchEvent[]): void {
    const min = this.state.minute;

    if (min >= 0 && min < 0.5 && this.state.phase === 'pre_match') {
      this.state.phase = 'first_half';
      events.push(this.createEvent('kickoff', 'home', 'Haaland', 'Kickoff! Manchester Derby underway'));
    } else if (min >= 45 && min < 45.5 && this.state.phase === 'first_half') {
      this.state.phase = 'half_time';
      events.push(this.createEvent('half_time', 'home', '', `Half Time: MCI ${this.state.homeScore} - ${this.state.awayScore} MUN`));
    } else if (min >= 46 && min < 46.5 && this.state.phase === 'half_time') {
      this.state.phase = 'second_half';
      events.push(this.createEvent('kickoff', 'away', 'Hojlund', 'Second half begins'));
    } else if (min >= 90 && this.state.phase === 'second_half') {
      this.state.phase = 'full_time';
      events.push(this.createEvent('full_time', 'home', '', `Full Time: MCI ${this.state.homeScore} - ${this.state.awayScore} MUN`));
    }
  }

  // ==================== Ball Movement ====================

  private updateBall(): void {
    const ball = this.state.ballPosition;

    // Move ball towards target
    const dx = this.ballTargetX - ball.x;
    const dy = this.ballTargetY - ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      // Move towards target
      ball.x += (dx / dist) * this.ballSpeed;
      ball.y += (dy / dist) * this.ballSpeed;
    } else {
      // Reached target, pick a new one after some ticks
      this.ticksSinceTargetChange++;
      if (this.ticksSinceTargetChange > 5 + Math.random() * 10) {
        this.pickNewBallTarget();
        this.ticksSinceTargetChange = 0;
      }
    }

    // Keep ball on pitch
    ball.x = Math.max(3, Math.min(97, ball.x));
    ball.y = Math.max(5, Math.min(95, ball.y));

    // Update zone
    ball.zone = ball.x < 35 ? 'defensive' : ball.x > 65 ? 'attacking' : 'middle';
  }

  private pickNewBallTarget(): void {
    const poss = this.state.ballPossession;

    // Ball moves forward for possessing team
    if (poss === 'home') {
      // Home attacks right (towards x=100)
      this.ballTargetX = 20 + Math.random() * 60; // Range: 20-80
      this.ballTargetY = 20 + Math.random() * 60; // Range: 20-80
    } else {
      // Away attacks left (towards x=0)
      this.ballTargetX = 20 + Math.random() * 60;
      this.ballTargetY = 20 + Math.random() * 60;
    }

    // Random chance to change possession (every ~15 seconds on average)
    if (Math.random() < 0.07) {
      this.state.ballPossession = poss === 'home' ? 'away' : 'home';
    }
  }

  // ==================== Player Movement ====================

  private updatePlayers(): void {
    const ball = this.state.ballPosition;
    const poss = this.state.ballPossession;

    // Update home team
    for (let i = 0; i < 11; i++) {
      const pos = this.homePositions[i];
      const isAttacking = poss === 'home';

      // Calculate target based on formation + ball influence
      let targetX = pos.baseX;
      let targetY = pos.baseY;

      // Shift formation based on attacking/defending
      if (i > 0) { // Not goalkeeper
        targetX += isAttacking ? 8 : -5;

        // Follow ball horizontally (more for midfielders/forwards)
        const ballInfluence = i >= 5 ? 0.15 : 0.08;
        targetX += (ball.x - 50) * ballInfluence;
        targetY += (ball.y - 50) * ballInfluence * 0.5;
      }

      // Clamp to valid range
      targetX = Math.max(3, Math.min(i === 0 ? 15 : 70, targetX));
      targetY = Math.max(8, Math.min(92, targetY));

      // Smooth movement
      pos.x += (targetX - pos.x) * 0.05;
      pos.y += (targetY - pos.y) * 0.05;
    }

    // Update away team
    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const isAttacking = poss === 'away';

      let targetX = pos.baseX;
      let targetY = pos.baseY;

      if (i > 0) {
        targetX += isAttacking ? -8 : 5;

        const ballInfluence = i >= 5 ? 0.15 : 0.08;
        targetX += (ball.x - 50) * ballInfluence;
        targetY += (ball.y - 50) * ballInfluence * 0.5;
      }

      targetX = Math.max(i === 0 ? 85 : 30, Math.min(97, targetX));
      targetY = Math.max(8, Math.min(92, targetY));

      pos.x += (targetX - pos.x) * 0.05;
      pos.y += (targetY - pos.y) * 0.05;
    }
  }

  // ==================== Events ====================

  private maybeGenerateEvent(events: MatchEvent[]): void {
    if (Math.random() > 0.12) return;

    const team = this.state.ballPossession;
    const teamConfig = team === 'home' ? this.config.homeTeam : this.config.awayTeam;
    const players = teamConfig.startingXI;

    // Pick random event type
    const rand = Math.random();
    let type: EventType;
    let player: string;
    let desc: string;

    if (rand < 0.5) {
      type = 'pass_completed';
      player = players[Math.floor(Math.random() * 11)];
      const receiver = players[Math.floor(Math.random() * 11)];
      desc = `${player} passes to ${receiver}`;
      this.stats.passes[team]++;
    } else if (rand < 0.65) {
      type = 'tackle';
      const opposingTeam = team === 'home' ? 'away' : 'home';
      const tackler = (team === 'home' ? this.config.awayTeam : this.config.homeTeam).startingXI[Math.floor(Math.random() * 4) + 1];
      player = tackler;
      desc = `Strong tackle by ${tackler}`;
      this.stats.tackles[opposingTeam]++;
      if (Math.random() < 0.5) this.state.ballPossession = opposingTeam;
    } else if (rand < 0.75) {
      type = 'dribble';
      player = players[Math.floor(Math.random() * 4) + 7];
      desc = `${player} takes on the defender`;
    } else if (rand < 0.85) {
      type = 'shot_off_target';
      player = players[Math.floor(Math.random() * 3) + 8];
      desc = `Shot by ${player} goes wide`;
      this.stats.shots[team]++;
      this.stats.xG[team] += 0.05 + Math.random() * 0.1;
    } else if (rand < 0.92) {
      type = 'shot_on_target';
      player = players[Math.floor(Math.random() * 3) + 8];
      const keeper = (team === 'home' ? this.config.awayTeam : this.config.homeTeam).startingXI[0];
      desc = `Shot by ${player}, saved by ${keeper}`;
      this.stats.shots[team]++;
      this.stats.shotsOnTarget[team]++;
      this.stats.saves[team === 'home' ? 'away' : 'home']++;
      this.stats.xG[team] += 0.1 + Math.random() * 0.15;
    } else if (rand < 0.97) {
      type = 'foul';
      player = players[Math.floor(Math.random() * 10) + 1];
      desc = `Foul by ${player}`;
      this.stats.fouls[team]++;
      this.state.ballPossession = team === 'home' ? 'away' : 'home';
    } else {
      // Goal!
      type = 'goal';
      const scorers = team === 'home'
        ? ['Haaland', 'Foden', 'De Bruyne', 'Doku']
        : ['Hojlund', 'Rashford', 'Fernandes', 'Diallo'];
      player = scorers[Math.floor(Math.random() * scorers.length)];
      desc = `GOAL! ${player} scores for ${teamConfig.shortName}!`;

      if (team === 'home') {
        this.state.homeScore++;
      } else {
        this.state.awayScore++;
      }
      this.stats.shots[team]++;
      this.stats.shotsOnTarget[team]++;
      this.stats.xG[team] += 0.3 + Math.random() * 0.4;

      // Reset ball to center after goal
      this.state.ballPosition.x = 50;
      this.state.ballPosition.y = 50;
      this.ballTargetX = 50;
      this.ballTargetY = 50;
      this.state.ballPossession = team === 'home' ? 'away' : 'home';
    }

    events.push(this.createEvent(type, team, player, desc));
  }

  private createEvent(type: EventType, team: 'home' | 'away', player: string, description: string): MatchEvent {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      minute: Math.floor(this.state.minute),
      type,
      team,
      primaryPlayer: player,
      description,
    };
  }

  private updatePossessionStats(): void {
    // City typically dominates possession
    const base = 57 + (Math.random() - 0.5) * 6;
    this.state.possession = { home: Math.round(base), away: Math.round(100 - base) };
    this.stats.possession = this.state.possession;
  }

  // ==================== Public Methods ====================

  public kickoff(): void {
    this.state.phase = 'first_half';
    this.state.minute = 0;
    this.state.ballPosition = { x: 50, y: 50, zone: 'center' };
    this.state.ballPossession = 'home';
    this.ballTargetX = 50;
    this.ballTargetY = 50;
  }

  public getState(): MatchState {
    return { ...this.state };
  }

  public getStats(): MatchStats {
    return { ...this.stats };
  }

  public getConfig(): MatchConfig {
    return this.config;
  }

  // Generate metrics for a player - uses index to get position
  public generatePlayerMetrics(player: Player, isHome: boolean, playerIndex: number): TrackingMetrics {
    const idx = Math.min(playerIndex, 10);
    const pos = isHome ? this.homePositions[idx] : this.awayPositions[idx];
    const minute = Math.max(1, this.state.minute);

    // Simple metrics based on position and time
    const baseDistance = minute * 100;
    const isGK = idx === 0;
    const distMultiplier = isGK ? 0.4 : 1.0;

    return {
      totalDistance: baseDistance * distMultiplier,
      distancePerMinute: 100 * distMultiplier,
      highSpeedRunningDistance: baseDistance * 0.08 * distMultiplier,
      sprintDistance: baseDistance * 0.03 * distMultiplier,
      walkingDistance: baseDistance * 0.25,
      joggingDistance: baseDistance * 0.4,
      runningDistance: baseDistance * 0.27,
      currentSpeed: 5 + Math.random() * 8,
      averageSpeed: 7,
      maxSpeed: player.physicalProfile?.maxSpeed || 32,
      speedZones: {
        zone1: minute * 15,
        zone2: minute * 20,
        zone3: minute * 15,
        zone4: minute * 8,
        zone5: minute * 3,
        zone6: minute * 1,
      },
      accelerations: { low: Math.floor(minute * 0.5), medium: Math.floor(minute * 0.3), high: Math.floor(minute * 0.1), total: Math.floor(minute * 0.9) },
      decelerations: { low: Math.floor(minute * 0.5), medium: Math.floor(minute * 0.3), high: Math.floor(minute * 0.1), total: Math.floor(minute * 0.9) },
      maxAcceleration: 3.5,
      maxDeceleration: -3.5,
      playerLoad: minute * 5,
      playerLoadPerMinute: 5,
      metabolicPower: 12,
      highMetabolicLoadDistance: baseDistance * 0.1,
      position: {
        x: pos?.x ?? 50,
        y: pos?.y ?? 50,
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
      startingXI: ['Ederson', 'Walker', 'Dias', 'Stones', 'Gvardiol', 'Kovacic', 'De Bruyne', 'Silva', 'Foden', 'Haaland', 'Doku'],
      manager: 'Pep Guardiola',
    },
    awayTeam: {
      name: 'Manchester United',
      shortName: 'MUN',
      formation: '4-2-3-1',
      startingXI: ['Onana', 'Dalot', 'De Ligt', 'Martinez', 'Shaw', 'Casemiro', 'Mainoo', 'Diallo', 'Fernandes', 'Rashford', 'Hojlund'],
      manager: 'Ruben Amorim',
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
    pre_match: 'Pre-Match',
    first_half: '1st Half',
    half_time: 'Half Time',
    second_half: '2nd Half',
    full_time: 'Full Time',
    extra_time: 'Extra Time',
    penalties: 'Penalties',
  };
  return displays[phase];
}

// Keep these exports for backward compatibility
export type { MatchConfig as TeamConfig };
