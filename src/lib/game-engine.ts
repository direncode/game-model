// Game Engine for Match Simulation
// Premier League 2025/26 Season - Professional Match Engine

import type { Player, TrackingMetrics } from '@/types';

// ==================== Match Types ====================

export interface MatchConfig {
  homeTeam: TeamConfig;
  awayTeam: TeamConfig;
  competition: string;
  matchday: number;
  venue: string;
  referee: string;
  season: string;
}

export interface TeamConfig {
  name: string;
  shortName: string;
  formation: string;
  squad: Player[];
  startingXI: string[];
  substitutes: string[];
  manager: string;
}

export interface MatchState {
  minute: number;
  phase: 'pre_match' | 'first_half' | 'half_time' | 'second_half' | 'full_time' | 'extra_time' | 'penalties';
  homeScore: number;
  awayScore: number;
  possession: { home: number; away: number };
  events: MatchEvent[];
  currentPhase: 'buildUp' | 'progression' | 'finalThird' | 'pressing' | 'defensiveBlock' | 'transition';
  ballPosition: { x: number; y: number; zone: string };
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
  | 'goal'
  | 'assist'
  | 'shot_on_target'
  | 'shot_off_target'
  | 'shot_blocked'
  | 'save'
  | 'yellow_card'
  | 'red_card'
  | 'foul'
  | 'corner'
  | 'free_kick'
  | 'penalty'
  | 'offside'
  | 'substitution'
  | 'injury'
  | 'var_review'
  | 'kickoff'
  | 'half_time'
  | 'full_time'
  | 'pass_completed'
  | 'pass_intercepted'
  | 'tackle'
  | 'dribble'
  | 'cross'
  | 'clearance'
  | 'header';

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

// ==================== Manchester Derby Configuration ====================

export function getManchesterDerbyConfig(): MatchConfig {
  return {
    homeTeam: {
      name: 'Manchester City',
      shortName: 'MCI',
      formation: '4-3-3',
      squad: [],
      startingXI: [
        'Ederson',
        'Kyle Walker',
        'Ruben Dias',
        'John Stones',
        'Josko Gvardiol',
        'Mateo Kovacic',
        'Kevin De Bruyne',
        'Bernardo Silva',
        'Phil Foden',
        'Erling Haaland',
        'Jeremy Doku',
      ],
      substitutes: [
        'Ortega',
        'Nathan Ake',
        'Rico Lewis',
        'Matheus Nunes',
        'Jack Grealish',
        'Savinho',
        'Oscar Bobb',
      ],
      manager: 'Pep Guardiola',
    },
    awayTeam: {
      name: 'Manchester United',
      shortName: 'MUN',
      formation: '4-2-3-1',
      squad: [],
      startingXI: [
        'Andre Onana',
        'Diogo Dalot',
        'Matthijs de Ligt',
        'Lisandro Martinez',
        'Luke Shaw',
        'Casemiro',
        'Kobbie Mainoo',
        'Amad Diallo',
        'Bruno Fernandes',
        'Marcus Rashford',
        'Rasmus Hojlund',
      ],
      substitutes: [
        'Bayindir',
        'Harry Maguire',
        'Victor Lindelof',
        'Mason Mount',
        'Alejandro Garnacho',
        'Joshua Zirkzee',
        'Antony',
      ],
      manager: 'Ruben Amorim',
    },
    competition: 'Premier League',
    matchday: 16,
    venue: 'Etihad Stadium',
    referee: 'Michael Oliver',
    season: '2025/26',
  };
}

// ==================== Game Engine Class ====================

export class GameEngine {
  private config: MatchConfig;
  private state: MatchState;
  private stats: MatchStats;
  private playerMetrics: Map<string, TrackingMetrics>;
  private eventListeners: ((event: MatchEvent) => void)[];

  constructor(config: MatchConfig) {
    this.config = config;
    this.state = this.initializeState();
    this.stats = this.initializeStats();
    this.playerMetrics = new Map();
    this.eventListeners = [];
  }

  private initializeState(): MatchState {
    return {
      minute: 0,
      phase: 'pre_match',
      homeScore: 0,
      awayScore: 0,
      possession: { home: 50, away: 50 },
      events: [],
      currentPhase: 'buildUp',
      ballPosition: { x: 0, y: 0, zone: 'center' },
      momentum: 'neutral',
      intensity: 0.5,
    };
  }

  private initializeStats(): MatchStats {
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

  public onEvent(listener: (event: MatchEvent) => void): void {
    this.eventListeners.push(listener);
  }

  private emitEvent(event: MatchEvent): void {
    this.state.events.push(event);
    this.eventListeners.forEach((listener) => listener(event));
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

  // Advance match by specified seconds
  public tick(seconds: number = 1): MatchEvent[] {
    const events: MatchEvent[] = [];
    const minuteIncrement = seconds / 60;
    this.state.minute += minuteIncrement;

    // Update phase based on minute
    if (this.state.minute >= 0 && this.state.minute < 1 && this.state.phase === 'pre_match') {
      this.state.phase = 'first_half';
      events.push(this.createEvent('kickoff', 'home', this.config.homeTeam.startingXI[9], 'Kickoff - Manchester Derby underway'));
    } else if (this.state.minute >= 45 && this.state.minute < 46 && this.state.phase === 'first_half') {
      this.state.phase = 'half_time';
      events.push(this.createEvent('half_time', 'home', '', `Half Time: ${this.config.homeTeam.shortName} ${this.state.homeScore} - ${this.state.awayScore} ${this.config.awayTeam.shortName}`));
    } else if (this.state.minute >= 46 && this.state.minute < 47 && this.state.phase === 'half_time') {
      this.state.phase = 'second_half';
      events.push(this.createEvent('kickoff', 'away', this.config.awayTeam.startingXI[10], 'Second half begins'));
    } else if (this.state.minute >= 90 && this.state.phase === 'second_half') {
      this.state.phase = 'full_time';
      events.push(this.createEvent('full_time', 'home', '', `Full Time: ${this.config.homeTeam.shortName} ${this.state.homeScore} - ${this.state.awayScore} ${this.config.awayTeam.shortName}`));
    }

    // Generate match events during play
    if (this.state.phase === 'first_half' || this.state.phase === 'second_half') {
      const generatedEvents = this.simulateMatchEvents();
      events.push(...generatedEvents);
    }

    // Update possession dynamically
    this.updatePossession();

    // Update game phase
    this.updateGamePhase();

    // Emit all events
    events.forEach((event) => this.emitEvent(event));

    return events;
  }

  private createEvent(
    type: EventType,
    team: 'home' | 'away',
    player: string,
    description: string,
    metadata?: Record<string, unknown>
  ): MatchEvent {
    return {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      minute: Math.floor(this.state.minute),
      type,
      team,
      primaryPlayer: player,
      description,
      metadata,
    };
  }

  private simulateMatchEvents(): MatchEvent[] {
    const events: MatchEvent[] = [];
    const random = Math.random();

    // Base event probability per tick
    const eventChance = 0.15;

    if (random < eventChance) {
      const eventType = this.determineEventType();
      const team = this.determinePossessingTeam();
      const event = this.generateEvent(eventType, team);
      if (event) {
        events.push(event);
        this.updateStats(event);
      }
    }

    return events;
  }

  private determineEventType(): EventType {
    const weights: { type: EventType; weight: number }[] = [
      { type: 'pass_completed', weight: 40 },
      { type: 'tackle', weight: 10 },
      { type: 'foul', weight: 8 },
      { type: 'shot_off_target', weight: 5 },
      { type: 'shot_on_target', weight: 4 },
      { type: 'shot_blocked', weight: 3 },
      { type: 'corner', weight: 4 },
      { type: 'offside', weight: 3 },
      { type: 'dribble', weight: 8 },
      { type: 'cross', weight: 6 },
      { type: 'clearance', weight: 5 },
      { type: 'goal', weight: 1.5 },
      { type: 'yellow_card', weight: 0.8 },
      { type: 'save', weight: 2 },
    ];

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const { type, weight } of weights) {
      random -= weight;
      if (random <= 0) {
        return type;
      }
    }

    return 'pass_completed';
  }

  private determinePossessingTeam(): 'home' | 'away' {
    // City typically dominate possession
    const homePossessionChance = 0.58;
    return Math.random() < homePossessionChance ? 'home' : 'away';
  }

  private generateEvent(type: EventType, team: 'home' | 'away'): MatchEvent | null {
    const teamConfig = team === 'home' ? this.config.homeTeam : this.config.awayTeam;
    const opposingConfig = team === 'home' ? this.config.awayTeam : this.config.homeTeam;
    const players = teamConfig.startingXI;
    const opposingPlayers = opposingConfig.startingXI;

    switch (type) {
      case 'goal': {
        const scorers = team === 'home'
          ? ['Erling Haaland', 'Phil Foden', 'Kevin De Bruyne', 'Jeremy Doku', 'Bernardo Silva']
          : ['Rasmus Hojlund', 'Marcus Rashford', 'Bruno Fernandes', 'Amad Diallo', 'Alejandro Garnacho'];
        const assisters = team === 'home'
          ? ['Kevin De Bruyne', 'Phil Foden', 'Bernardo Silva', 'Jeremy Doku', 'Josko Gvardiol']
          : ['Bruno Fernandes', 'Amad Diallo', 'Marcus Rashford', 'Luke Shaw', 'Kobbie Mainoo'];
        const scorer = scorers[Math.floor(Math.random() * scorers.length)];
        const assister = assisters.filter(a => a !== scorer)[Math.floor(Math.random() * (assisters.length - 1))];

        if (team === 'home') {
          this.state.homeScore++;
        } else {
          this.state.awayScore++;
        }

        const xG = 0.15 + Math.random() * 0.6;
        this.stats.xG[team] += xG;
        this.stats.shots[team]++;
        this.stats.shotsOnTarget[team]++;

        return {
          id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          minute: Math.floor(this.state.minute),
          type: 'goal',
          team,
          primaryPlayer: scorer,
          secondaryPlayer: assister,
          description: `GOAL! ${scorer} scores for ${teamConfig.shortName}. Assisted by ${assister}.`,
          xG,
        };
      }

      case 'shot_on_target': {
        const shooter = players[Math.floor(Math.random() * 5) + 6];
        const keeper = opposingPlayers[0];
        this.stats.shots[team]++;
        this.stats.shotsOnTarget[team]++;
        this.stats.saves[team === 'home' ? 'away' : 'home']++;
        const xG = 0.08 + Math.random() * 0.25;
        this.stats.xG[team] += xG;
        return this.createEvent(type, team, shooter, `Shot on target by ${shooter}. Saved by ${keeper}.`, { xG });
      }

      case 'shot_off_target': {
        const shooter = players[Math.floor(Math.random() * 5) + 6];
        this.stats.shots[team]++;
        const xG = 0.03 + Math.random() * 0.12;
        this.stats.xG[team] += xG;
        return this.createEvent(type, team, shooter, `Shot off target by ${shooter}.`, { xG });
      }

      case 'shot_blocked': {
        const shooter = players[Math.floor(Math.random() * 5) + 6];
        const blocker = opposingPlayers[Math.floor(Math.random() * 4) + 1];
        this.stats.shots[team]++;
        return this.createEvent(type, team, shooter, `Shot blocked. ${shooter}'s effort blocked by ${blocker}.`);
      }

      case 'foul': {
        const fouler = players[Math.floor(Math.random() * 10) + 1];
        const fouled = opposingPlayers[Math.floor(Math.random() * 10) + 1];
        this.stats.fouls[team]++;
        return this.createEvent(type, team, fouler, `Foul by ${fouler} on ${fouled}.`);
      }

      case 'yellow_card': {
        const player = players[Math.floor(Math.random() * 10) + 1];
        this.stats.yellowCards[team]++;
        this.stats.fouls[team]++;
        return this.createEvent(type, team, player, `Yellow card shown to ${player}.`);
      }

      case 'corner': {
        const taker = team === 'home' ? 'Kevin De Bruyne' : 'Bruno Fernandes';
        this.stats.corners[team]++;
        return this.createEvent(type, team, taker, `Corner kick for ${teamConfig.shortName}. ${taker} to take.`);
      }

      case 'offside': {
        const offside = players[Math.floor(Math.random() * 3) + 8];
        this.stats.offsides[team]++;
        return this.createEvent(type, team, offside, `Offside called against ${offside}.`);
      }

      case 'tackle': {
        const tackler = players[Math.floor(Math.random() * 6) + 1];
        this.stats.tackles[team]++;
        return this.createEvent(type, team, tackler, `Strong tackle by ${tackler}.`);
      }

      case 'pass_completed': {
        const passer = players[Math.floor(Math.random() * 11)];
        const receiver = players[Math.floor(Math.random() * 11)];
        this.stats.passes[team]++;
        return this.createEvent(type, team, passer, `Pass completed from ${passer} to ${receiver}.`);
      }

      case 'dribble': {
        const dribbler = players[Math.floor(Math.random() * 4) + 7];
        return this.createEvent(type, team, dribbler, `${dribbler} takes on the defender.`);
      }

      case 'cross': {
        const crosser = players[Math.floor(Math.random() * 2) + 1];
        return this.createEvent(type, team, crosser, `Cross delivered by ${crosser}.`);
      }

      case 'clearance': {
        const clearer = players[Math.floor(Math.random() * 4) + 1];
        return this.createEvent(type, team, clearer, `Clearance by ${clearer}.`);
      }

      case 'save': {
        const keeper = players[0];
        this.stats.saves[team]++;
        return this.createEvent(type, team, keeper, `Save by ${keeper}.`);
      }

      default:
        return null;
    }
  }

  private updateStats(event: MatchEvent): void {
    // Stats are updated within generateEvent for accuracy
  }

  private updatePossession(): void {
    // City typically have higher possession
    const basePossession = 58;
    const variation = (Math.random() - 0.5) * 6;
    const homePossession = Math.min(70, Math.max(45, basePossession + variation));

    this.state.possession = {
      home: Math.round(homePossession),
      away: Math.round(100 - homePossession),
    };
    this.stats.possession = this.state.possession;
  }

  private updateGamePhase(): void {
    const phases: MatchState['currentPhase'][] = [
      'buildUp',
      'progression',
      'finalThird',
      'pressing',
      'defensiveBlock',
      'transition',
    ];

    // Weighted phase selection based on game state
    const random = Math.random();
    if (random < 0.25) {
      this.state.currentPhase = 'buildUp';
    } else if (random < 0.45) {
      this.state.currentPhase = 'progression';
    } else if (random < 0.6) {
      this.state.currentPhase = 'finalThird';
    } else if (random < 0.75) {
      this.state.currentPhase = 'pressing';
    } else if (random < 0.9) {
      this.state.currentPhase = 'defensiveBlock';
    } else {
      this.state.currentPhase = 'transition';
    }

    // Update momentum based on recent events
    const recentEvents = this.state.events.slice(-10);
    const homeEvents = recentEvents.filter(e => e.team === 'home').length;
    const awayEvents = recentEvents.filter(e => e.team === 'away').length;

    if (homeEvents > awayEvents + 2) {
      this.state.momentum = 'home';
    } else if (awayEvents > homeEvents + 2) {
      this.state.momentum = 'away';
    } else {
      this.state.momentum = 'neutral';
    }
  }

  // Generate player tracking metrics for the current state
  public generatePlayerMetrics(player: Player, isHome: boolean): TrackingMetrics {
    const minute = this.state.minute;
    const intensity = this.state.intensity;
    const isAttacking = (isHome && this.state.momentum === 'home') || (!isHome && this.state.momentum === 'away');

    const baseDistance = minute * 110;
    const positionMultiplier = this.getPositionMultiplier(player.position);
    const intensityMultiplier = 0.8 + intensity * 0.4;

    const variation = (Math.random() - 0.5) * 20;

    return {
      totalDistance: (baseDistance + variation * minute) * positionMultiplier * intensityMultiplier,
      distancePerMinute: (100 + variation) * positionMultiplier,
      highSpeedRunningDistance: baseDistance * 0.08 * positionMultiplier + Math.random() * 50,
      sprintDistance: baseDistance * 0.03 * positionMultiplier + Math.random() * 20,
      walkingDistance: baseDistance * 0.2,
      joggingDistance: baseDistance * 0.4,
      runningDistance: baseDistance * 0.3,
      currentSpeed: Math.random() * 15 + (Math.random() > 0.92 ? 15 : 0),
      averageSpeed: 7 + Math.random() * 2,
      maxSpeed: player.physicalProfile.maxSpeed * (0.9 + Math.random() * 0.1),
      speedZones: {
        zone1: minute * 15,
        zone2: minute * 20,
        zone3: minute * 15,
        zone4: minute * 8,
        zone5: minute * 3,
        zone6: minute * 1,
      },
      accelerations: {
        low: Math.floor(minute * 0.5),
        medium: Math.floor(minute * 0.3),
        high: Math.floor(minute * 0.15),
        total: Math.floor(minute * 0.95),
      },
      decelerations: {
        low: Math.floor(minute * 0.5),
        medium: Math.floor(minute * 0.3),
        high: Math.floor(minute * 0.15),
        total: Math.floor(minute * 0.95),
      },
      maxAcceleration: 3 + Math.random(),
      maxDeceleration: -(3 + Math.random()),
      playerLoad: minute * 5 + Math.random() * 20,
      playerLoadPerMinute: 5 + Math.random() * 2,
      metabolicPower: 10 + Math.random() * 5,
      highMetabolicLoadDistance: baseDistance * 0.11,
      position: {
        x: this.calculatePlayerX(player.position, isHome, isAttacking),
        y: this.calculatePlayerY(player.position),
        zone: this.getPlayerZone(player.position, isAttacking),
        heatmap: { cells: [], resolution: { x: 21, y: 14 } },
      },
    };
  }

  private getPositionMultiplier(position: string): number {
    const multipliers: Record<string, number> = {
      GK: 0.4,
      CB: 0.85,
      LB: 1.1,
      RB: 1.1,
      CDM: 1.0,
      CM: 1.05,
      CAM: 1.0,
      LM: 1.15,
      RM: 1.15,
      LW: 1.1,
      RW: 1.1,
      CF: 0.95,
      ST: 0.9,
    };
    return multipliers[position] || 1.0;
  }

  private calculatePlayerX(position: string, isHome: boolean, isAttacking: boolean): number {
    const baseX: Record<string, number> = {
      GK: -40,
      CB: -25,
      LB: -15,
      RB: -15,
      CDM: -5,
      CM: 5,
      CAM: 15,
      LM: 10,
      RM: 10,
      LW: 25,
      RW: 25,
      CF: 30,
      ST: 35,
    };

    let x = baseX[position] || 0;
    if (isAttacking) x += 10;
    if (!isHome) x = -x;

    return x + (Math.random() - 0.5) * 10;
  }

  private calculatePlayerY(position: string): number {
    const baseY: Record<string, number> = {
      GK: 0,
      CB: 0,
      LB: -20,
      RB: 20,
      CDM: 0,
      CM: 0,
      CAM: 0,
      LM: -25,
      RM: 25,
      LW: -25,
      RW: 25,
      CF: 0,
      ST: 0,
    };

    return (baseY[position] || 0) + (Math.random() - 0.5) * 8;
  }

  private getPlayerZone(position: string, isAttacking: boolean): 'defensive_third' | 'middle_third' | 'attacking_third' {
    if (['GK', 'CB'].includes(position)) {
      return isAttacking ? 'middle_third' : 'defensive_third';
    }
    if (['LB', 'RB', 'CDM', 'CM'].includes(position)) {
      return 'middle_third';
    }
    return isAttacking ? 'attacking_third' : 'middle_third';
  }

  // Start the match
  public kickoff(): void {
    this.state.phase = 'first_half';
    this.state.minute = 0;
  }

  // Resume from half time
  public startSecondHalf(): void {
    this.state.phase = 'second_half';
    this.state.minute = 45;
  }
}

// ==================== Export Utilities ====================

export function createManchesterDerby(): GameEngine {
  const config = getManchesterDerbyConfig();
  return new GameEngine(config);
}

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
