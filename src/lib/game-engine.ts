// Game Engine - Data-Driven Predictive System
// City plays with player-data-based predictions, Opposition chases aggressively

import type { Player, TrackingMetrics } from '@/types';
import { getPLSquadData } from './premier-league-api';

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
  defensiveBlock: {
    team: 'home' | 'away';
    type: 'high' | 'mid' | 'low';
    lines: {
      defensive: { x: number; players: { x: number; y: number }[] };
      midfield: { x: number; players: { x: number; y: number }[] };
      forward: { x: number; players: { x: number; y: number }[] };
    };
  };
  pressingIntensity: number;
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

// ==================== Player Data Profile ====================

interface PlayerProfile {
  name: string;
  maxSpeed: number;
  acceleration: number;
  sprintCapacity: number;
  workRate: number; // Derived from thresholds
  positioningIQ: number; // How well they read the game
  passingRange: number; // Short/medium/long preference
}

interface PlayerPos {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  hasBall: boolean;
  profile: PlayerProfile;
  fatigue: number; // 0-100, affects speed
  role: string;
}

// ==================== Game Engine ====================

export class GameEngine {
  private config: MatchConfig;
  private state: MatchState;
  private stats: MatchStats;

  private homePositions: PlayerPos[] = [];
  private awayPositions: PlayerPos[] = [];

  private ballCarrierTeam: 'home' | 'away' = 'home';
  private ballCarrierIndex: number = 5;

  private ballX: number = 50;
  private ballY: number = 50;

  private lastPassTime: number = 0;
  private possessionTime: { home: number; away: number } = { home: 0, away: 0 };
  private movementPhase: number = 0;

  private playPhase: 'buildUp' | 'progression' | 'finalThird' | 'pressing' = 'buildUp';

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
      possession: { home: 65, away: 35 },
      events: [],
      currentPhase: 'buildUp',
      ballPosition: { x: 50, y: 50, zone: 'center' },
      ballPossession: 'home',
      momentum: 'home',
      intensity: 0.9,
      defensiveBlock: {
        team: 'away',
        type: 'high',
        lines: {
          defensive: { x: 50, players: [] },
          midfield: { x: 40, players: [] },
          forward: { x: 30, players: [] },
        },
      },
      pressingIntensity: 90,
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
      passAccuracy: { home: 92, away: 78 },
      tackles: { home: 0, away: 0 },
      saves: { home: 0, away: 0 },
      xG: { home: 0, away: 0 },
    };
  }

  private initPositions(): void {
    // Load City player data for predictive positioning
    const citySquad = getPLSquadData('MCI');
    const unitedSquad = getPLSquadData('MUN');

    // City 4-3-3 starting positions with player profiles
    const cityFormation = [
      { x: 6, y: 50, role: 'GK', idx: 0 },      // Ederson
      { x: 18, y: 82, role: 'RB', idx: 1 },     // Walker
      { x: 15, y: 60, role: 'CB', idx: 2 },     // Dias
      { x: 15, y: 40, role: 'CB', idx: 3 },     // Stones
      { x: 18, y: 18, role: 'LB', idx: 5 },     // Gvardiol
      { x: 30, y: 50, role: 'CDM', idx: 6 },    // Rodri (use Kovacic if injured)
      { x: 42, y: 65, role: 'CM', idx: 8 },     // De Bruyne
      { x: 42, y: 35, role: 'CM', idx: 9 },     // Silva
      { x: 55, y: 85, role: 'RW', idx: 12 },    // Doku
      { x: 58, y: 50, role: 'ST', idx: 14 },    // Haaland
      { x: 55, y: 15, role: 'LW', idx: 10 },    // Foden
    ];

    for (let i = 0; i < 11; i++) {
      const formation = cityFormation[i];
      const playerData = citySquad[formation.idx] || citySquad[i];
      const phys = playerData?.physicalProfile;

      const profile: PlayerProfile = {
        name: playerData?.name || this.config.homeTeam.startingXI[i],
        maxSpeed: phys?.maxSpeed || 30,
        acceleration: phys?.accelerationPeak || 3.8,
        sprintCapacity: phys?.sprintCapacity || 300,
        workRate: ((phys?.highIntensityThreshold || 19) - 17) / 5, // 0-1 scale
        positioningIQ: this.getPositioningIQ(formation.role, playerData?.name),
        passingRange: this.getPassingRange(formation.role, playerData?.name),
      };

      this.homePositions.push({
        x: formation.x,
        y: formation.y,
        baseX: formation.x,
        baseY: formation.y,
        targetX: formation.x,
        targetY: formation.y,
        hasBall: i === 5,
        profile,
        fatigue: 0,
        role: formation.role,
      });
    }

    // United 4-2-3-1 - They will CHASE aggressively
    const unitedFormation = [
      { x: 94, y: 50, role: 'GK', idx: 0 },
      { x: 78, y: 80, role: 'RB', idx: 1 },
      { x: 80, y: 60, role: 'CB', idx: 2 },
      { x: 80, y: 40, role: 'CB', idx: 3 },
      { x: 78, y: 20, role: 'LB', idx: 4 },
      { x: 65, y: 55, role: 'CDM', idx: 5 },
      { x: 65, y: 45, role: 'CDM', idx: 6 },
      { x: 50, y: 80, role: 'RM', idx: 9 },
      { x: 45, y: 50, role: 'CAM', idx: 7 },
      { x: 50, y: 20, role: 'LM', idx: 10 },
      { x: 40, y: 50, role: 'ST', idx: 11 },
    ];

    for (let i = 0; i < 11; i++) {
      const formation = unitedFormation[i];
      const playerData = unitedSquad[formation.idx] || unitedSquad[i];
      const phys = playerData?.physicalProfile;

      const profile: PlayerProfile = {
        name: playerData?.name || this.config.awayTeam.startingXI[i],
        maxSpeed: phys?.maxSpeed || 31,
        acceleration: phys?.accelerationPeak || 3.9,
        sprintCapacity: phys?.sprintCapacity || 320,
        workRate: ((phys?.highIntensityThreshold || 19.5) - 17) / 5,
        positioningIQ: 0.7,
        passingRange: 0.5,
      };

      this.awayPositions.push({
        x: formation.x,
        y: formation.y,
        baseX: formation.x,
        baseY: formation.y,
        targetX: formation.x,
        targetY: formation.y,
        hasBall: false,
        profile,
        fatigue: 0,
        role: formation.role,
      });
    }
  }

  private getPositioningIQ(role: string, name?: string): number {
    // Elite positioning intelligence based on player reputation
    const elitePositioners: Record<string, number> = {
      'Rodri': 0.98, 'Bernardo Silva': 0.95, 'Kevin De Bruyne': 0.97,
      'Ruben Dias': 0.92, 'John Stones': 0.88, 'Phil Foden': 0.93,
      'Kyle Walker': 0.85, 'Erling Haaland': 0.90,
    };
    if (name && elitePositioners[name]) return elitePositioners[name];

    const roleIQ: Record<string, number> = {
      'GK': 0.85, 'CB': 0.82, 'RB': 0.78, 'LB': 0.78,
      'CDM': 0.92, 'CM': 0.88, 'CAM': 0.85, 'RW': 0.80, 'LW': 0.80, 'ST': 0.82,
    };
    return roleIQ[role] || 0.8;
  }

  private getPassingRange(role: string, name?: string): number {
    // Passing range preference (0 = short, 1 = long)
    const longPassers: Record<string, number> = {
      'Ederson': 0.85, 'Kevin De Bruyne': 0.75, 'Ruben Dias': 0.6,
      'John Stones': 0.55, 'Kyle Walker': 0.5,
    };
    if (name && longPassers[name]) return longPassers[name];

    const roleRange: Record<string, number> = {
      'GK': 0.7, 'CB': 0.4, 'RB': 0.35, 'LB': 0.35,
      'CDM': 0.3, 'CM': 0.45, 'CAM': 0.5, 'RW': 0.4, 'LW': 0.4, 'ST': 0.35,
    };
    return roleRange[role] || 0.4;
  }

  // ==================== Main Tick ====================

  public tick(seconds: number = 1): MatchEvent[] {
    const events: MatchEvent[] = [];

    this.state.minute += seconds / 60;
    this.movementPhase += 0.05;
    this.handlePhaseTransitions(events);

    if (this.state.phase === 'first_half' || this.state.phase === 'second_half') {
      this.possessionTime[this.ballCarrierTeam] += seconds;

      // Update fatigue
      this.updateFatigue();

      if (this.ballCarrierTeam === 'home') {
        this.updateCityPredictive(events);
        this.updateUnitedChasing(); // Opposition CHASES
      } else {
        this.updateUnitedPossession(events);
        this.updateCityPressing();
      }

      this.updateBallPosition();
      this.updateDefensiveBlockLines();
      this.maybeChangePossession(events);
      this.updatePossessionStats();
    }

    return events;
  }

  private updateFatigue(): void {
    const min = this.state.minute;
    const baseFatigue = Math.min(30, min * 0.3);

    for (const pos of this.homePositions) {
      const workRateMod = pos.profile.workRate * 5;
      pos.fatigue = Math.min(40, baseFatigue + workRateMod + Math.random() * 5);
    }
    for (const pos of this.awayPositions) {
      // United gets more tired from chasing
      const chasingPenalty = 8;
      pos.fatigue = Math.min(50, baseFatigue + chasingPenalty + Math.random() * 5);
    }
  }

  private handlePhaseTransitions(events: MatchEvent[]): void {
    const min = this.state.minute;

    if (min >= 0 && min < 0.5 && this.state.phase === 'pre_match') {
      this.state.phase = 'first_half';
      this.ballCarrierTeam = 'home';
      this.ballCarrierIndex = 5;
      this.homePositions[5].hasBall = true;
      events.push(this.createEvent('kickoff', 'home', this.homePositions[5].profile.name, 'Kickoff! City start with possession'));
    } else if (min >= 45 && min < 45.5 && this.state.phase === 'first_half') {
      this.state.phase = 'half_time';
      events.push(this.createEvent('half_time', 'home', '', `Half Time: MCI ${this.state.homeScore} - ${this.state.awayScore} MUN`));
    } else if (min >= 46 && min < 46.5 && this.state.phase === 'half_time') {
      this.state.phase = 'second_half';
      this.resetBallToCenter('away');
      events.push(this.createEvent('kickoff', 'away', 'United', 'Second half begins'));
    } else if (min >= 90 && this.state.phase === 'second_half') {
      this.state.phase = 'full_time';
      events.push(this.createEvent('full_time', 'home', '', `Full Time: MCI ${this.state.homeScore} - ${this.state.awayScore} MUN`));
    }
  }

  // ==================== CITY - PREDICTIVE POSITIONING ====================

  private updateCityPredictive(events: MatchEvent[]): void {
    this.lastPassTime += 1;

    // Determine play phase
    if (this.ballX < 35) {
      this.playPhase = 'buildUp';
    } else if (this.ballX < 65) {
      this.playPhase = 'progression';
    } else {
      this.playPhase = 'finalThird';
    }

    // Passing based on player profiles
    const carrier = this.homePositions[this.ballCarrierIndex];
    const passThreshold = 12 + (1 - carrier.profile.passingRange) * 8; // Better passers pass faster

    if (this.lastPassTime > passThreshold + Math.random() * 10) {
      this.cityPredictivePass(events);
      this.lastPassTime = 0;
    }

    // Position all players using their predictive profiles
    this.updateCityPositions();
  }

  private updateCityPositions(): void {
    const ballX = this.ballX;
    const ballY = this.ballY;

    for (let i = 0; i < 11; i++) {
      const pos = this.homePositions[i];
      const profile = pos.profile;

      // Movement influenced by positioning IQ
      const phase = this.movementPhase + i * 0.6;
      const iqFactor = profile.positioningIQ;
      const speedMod = (profile.maxSpeed / 35) * (1 - pos.fatigue / 100);

      // Cyclical movement scaled by work rate
      const cycleAmp = 3 + profile.workRate * 4;
      const cycleX = Math.sin(phase) * cycleAmp * iqFactor;
      const cycleY = Math.cos(phase * 0.7) * cycleAmp * iqFactor;

      // Predictive positioning - anticipate where ball WILL be
      const predictedBallX = ballX + (this.ballCarrierTeam === 'home' ? 5 : -3);
      const predictedBallY = ballY;

      switch (pos.role) {
        case 'GK':
          pos.targetX = 8 + (this.playPhase === 'buildUp' ? 8 : 2);
          pos.targetY = ballY * 0.15 + 42.5 + cycleY * 0.2;
          break;

        case 'RB': // Walker - inverts based on IQ prediction
          if (ballX > 40 && iqFactor > 0.8) {
            // Predict: invert into midfield
            pos.targetX = Math.min(50, ballX - 8) + cycleX;
            pos.targetY = 58 + cycleY;
          } else {
            pos.targetX = pos.baseX + (ballX - 30) * 0.25 + cycleX;
            pos.targetY = pos.baseY + cycleY;
          }
          break;

        case 'CB':
          // CBs read play and step up intelligently
          const cbAdvance = iqFactor * (this.playPhase === 'buildUp' ? 12 : 6);
          pos.targetX = pos.baseX + cbAdvance + cycleX * 0.4;
          pos.targetY = pos.baseY + (ballY - 50) * 0.15 * iqFactor + cycleY * 0.4;
          break;

        case 'LB': // Gvardiol - overlaps based on speed
          const overlapPush = speedMod * 18;
          pos.targetX = pos.baseX + (this.playPhase === 'finalThird' ? overlapPush : 8) + cycleX;
          pos.targetY = Math.max(8, pos.baseY + cycleY);
          break;

        case 'CDM': // Rodri - elite positioning
          // Predicts where to be to receive recycled possession
          pos.targetX = Math.max(25, predictedBallX - 18) + cycleX * 0.3;
          pos.targetY = 50 + (ballY - 50) * 0.2 * iqFactor + cycleY * 0.3;
          break;

        case 'CM':
          // De Bruyne / Silva - half-space occupation with prediction
          const isRightCM = pos.baseY > 50;
          const cmPush = iqFactor * (this.playPhase === 'finalThird' ? 15 : 8);
          pos.targetX = Math.min(72, predictedBallX + cmPush) + cycleX;
          pos.targetY = (isRightCM ? 65 : 35) + cycleY;
          break;

        case 'RW':
          // Doku - pace-based width stretching
          pos.targetX = Math.min(78, ballX + 15 * speedMod) + cycleX;
          pos.targetY = Math.min(92, 85 + cycleY);
          break;

        case 'LW':
          // Foden - intelligent positioning
          pos.targetX = Math.min(75, ballX + 12 * iqFactor) + cycleX;
          pos.targetY = Math.max(8, 15 + cycleY);
          break;

        case 'ST':
          // Haaland - predicts crosses, stays central
          pos.targetX = Math.max(55, Math.min(82, predictedBallX + 10)) + cycleX * 0.4;
          pos.targetY = 50 + (ballY - 50) * 0.3 + cycleY * 0.5;
          break;
      }

      // Ball carrier
      if (pos.hasBall) {
        pos.targetX = Math.min(80, pos.x + 0.6 * speedMod);
      }

      // Move with speed based on profile
      const moveSpeed = 0.045 + speedMod * 0.025;
      pos.x += (pos.targetX - pos.x) * moveSpeed;
      pos.y += (pos.targetY - pos.y) * moveSpeed;
    }
  }

  private cityPredictivePass(events: MatchEvent[]): void {
    const fromIdx = this.ballCarrierIndex;
    const carrier = this.homePositions[fromIdx];

    const options: { idx: number; weight: number }[] = [];

    for (let i = 0; i < 11; i++) {
      if (i === fromIdx) continue;
      const target = this.homePositions[i];
      const dist = Math.sqrt(Math.pow(target.x - carrier.x, 2) + Math.pow(target.y - carrier.y, 2));

      let weight = 10;

      // Short passes heavily preferred (Guardiola style)
      if (dist < 15) weight *= 3;
      else if (dist < 25) weight *= 1.5;
      else if (dist > 40) weight *= 0.3 * carrier.profile.passingRange;

      // High positioning IQ players receive more
      weight *= 0.5 + target.profile.positioningIQ;

      // Forward progression
      if (target.x > carrier.x) weight *= 1.4;

      // Half-spaces (y: 20-40 or 60-80)
      if ((target.y > 20 && target.y < 40) || (target.y > 60 && target.y < 80)) {
        weight *= 1.5;
      }

      // Key players bonus
      if (target.profile.name === 'Kevin De Bruyne') weight *= 1.5;
      if (target.profile.name === 'Bernardo Silva') weight *= 1.3;
      if (target.profile.name === 'Rodri' || target.profile.name === 'Mateo Kovacic') weight *= 1.2;

      options.push({ idx: i, weight });
    }

    // Select
    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let rand = Math.random() * totalWeight;
    let toIdx = options[0].idx;

    for (const opt of options) {
      rand -= opt.weight;
      if (rand <= 0) { toIdx = opt.idx; break; }
    }

    // Execute pass
    this.homePositions[fromIdx].hasBall = false;
    this.homePositions[toIdx].hasBall = true;
    this.ballCarrierIndex = toIdx;
    this.stats.passes.home++;

    // Log
    if (Math.random() < 0.1) {
      events.push(this.createEvent('pass_completed', 'home', carrier.profile.name,
        `${carrier.profile.name} → ${this.homePositions[toIdx].profile.name}`));
    }

    // Shot opportunity
    if (this.homePositions[toIdx].x > 68 && Math.random() < 0.15) {
      this.attemptShot('home', toIdx, events);
    }
  }

  // ==================== UNITED - AGGRESSIVE CHASING ====================

  private updateUnitedChasing(): void {
    const ballX = this.ballX;
    const ballY = this.ballY;

    // United LEAVES their half to chase the ball aggressively
    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const profile = pos.profile;

      const phase = this.movementPhase + i * 0.5;
      const speedMod = (profile.maxSpeed / 32) * (1 - pos.fatigue / 100);

      const jitterX = Math.sin(phase) * 3;
      const jitterY = Math.cos(phase * 0.7) * 4;

      // Distance to ball determines chase intensity
      const distToBall = Math.sqrt(Math.pow(pos.x - ballX, 2) + Math.pow(pos.y - ballY, 2));
      const chaseIntensity = Math.max(0.5, 1 - distToBall / 50);

      if (i === 0) {
        // GK stays but sweeps aggressively
        pos.targetX = Math.max(75, Math.min(92, ballX + 35));
        pos.targetY = ballY * 0.25 + 37.5 + jitterY * 0.3;
      } else if (i <= 4) {
        // DEFENDERS PUSH UP HIGH - leave their half!
        // They chase to around halfway or further
        const defPush = Math.max(35, ballX - 15); // Push to at least 35%
        pos.targetX = Math.min(70, defPush + chaseIntensity * 10) + jitterX * 0.5;
        pos.targetY = pos.baseY + (ballY - 50) * 0.4 + jitterY;
      } else if (i <= 7) {
        // MIDFIELDERS HUNT THE BALL
        pos.targetX = Math.max(25, ballX - 8 * chaseIntensity) + jitterX;
        pos.targetY = ballY + (pos.baseY - 50) * 0.3 + jitterY;
      } else {
        // FORWARDS PRESS HARD - In City's half!
        pos.targetX = Math.max(15, ballX - 5) + jitterX;
        pos.targetY = ballY + (i === 8 ? 12 : i === 10 ? -12 : 0) * chaseIntensity + jitterY;
      }

      // Fast chasing movement
      const moveSpeed = 0.06 + speedMod * 0.04;
      pos.x += (pos.targetX - pos.x) * moveSpeed;
      pos.y += (pos.targetY - pos.y) * moveSpeed;
    }
  }

  private updateUnitedPossession(events: MatchEvent[]): void {
    this.lastPassTime += 1;

    if (this.lastPassTime > 20 + Math.random() * 15) {
      this.unitedPass(events);
      this.lastPassTime = 0;
    }

    // Basic forward movement
    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const phase = this.movementPhase + i * 0.4;

      // Move forward when in possession
      pos.targetX = pos.baseX - (pos.hasBall ? 5 : 3) + Math.sin(phase) * 3;
      pos.targetY = pos.baseY + Math.cos(phase * 0.6) * 4;

      pos.x += (pos.targetX - pos.x) * 0.05;
      pos.y += (pos.targetY - pos.y) * 0.05;
    }
  }

  private unitedPass(events: MatchEvent[]): void {
    const fromIdx = this.ballCarrierIndex;

    const options = [];
    for (let i = 0; i < 11; i++) {
      if (i === fromIdx) continue;
      let weight = 1;
      if (this.awayPositions[i].x < this.awayPositions[fromIdx].x) weight *= 2;
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

  private updateCityPressing(): void {
    const ballX = this.ballX;
    const ballY = this.ballY;

    for (let i = 0; i < 11; i++) {
      const pos = this.homePositions[i];
      const profile = pos.profile;

      const phase = this.movementPhase + i * 0.5;
      const speedMod = (profile.maxSpeed / 35) * (1 - pos.fatigue / 100);
      const jitterX = Math.sin(phase) * 2;
      const jitterY = Math.cos(phase * 0.7) * 2.5;

      const distToBall = Math.sqrt(Math.pow(pos.x - ballX, 2) + Math.pow(pos.y - ballY, 2));
      const pressIntensity = Math.max(0.4, 1 - distToBall / 45);

      if (i === 0) {
        pos.targetX = Math.max(12, Math.min(30, ballX - 35));
        pos.targetY = ballY * 0.2 + 40 + jitterY * 0.3;
      } else if (i >= 8) {
        pos.targetX = Math.max(28, ballX - 8 * pressIntensity) + jitterX;
        pos.targetY = ballY + (i === 8 ? 10 : i === 10 ? -10 : 0) + jitterY;
      } else if (i >= 5 && i <= 7) {
        pos.targetX = Math.max(22, ballX - 15) + jitterX;
        pos.targetY = pos.baseY + (ballY - 50) * 0.5 + jitterY;
      } else {
        pos.targetX = Math.min(40, ballX - 20) + jitterX * 0.5;
        pos.targetY = pos.baseY + (ballY - 50) * 0.3 + jitterY * 0.5;
      }

      const moveSpeed = 0.065 + speedMod * 0.045;
      pos.x += (pos.targetX - pos.x) * moveSpeed;
      pos.y += (pos.targetY - pos.y) * moveSpeed;
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
      const speed = Math.min(dist * 0.15, 1.5);
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
    const defendingTeam = this.ballCarrierTeam === 'home' ? 'away' : 'home';
    const positions = defendingTeam === 'home' ? this.homePositions : this.awayPositions;

    const defLine: { x: number; y: number }[] = [];
    const midLine: { x: number; y: number }[] = [];
    const fwdLine: { x: number; y: number }[] = [];

    for (let i = 1; i <= 4; i++) defLine.push({ x: positions[i].x, y: positions[i].y });
    for (let i = 5; i <= 7; i++) midLine.push({ x: positions[i].x, y: positions[i].y });
    for (let i = 8; i <= 10; i++) fwdLine.push({ x: positions[i].x, y: positions[i].y });

    const avgDefX = defLine.reduce((s, p) => s + p.x, 0) / defLine.length;

    // United is chasing so their block is HIGH
    let blockType: 'high' | 'mid' | 'low' = 'mid';
    if (defendingTeam === 'away') {
      blockType = avgDefX < 55 ? 'high' : avgDefX < 70 ? 'mid' : 'low';
    } else {
      blockType = avgDefX < 30 ? 'high' : avgDefX < 45 ? 'mid' : 'low';
    }

    this.state.defensiveBlock = {
      team: defendingTeam,
      type: blockType,
      lines: {
        defensive: { x: avgDefX, players: defLine.sort((a, b) => a.y - b.y) },
        midfield: { x: midLine.reduce((s, p) => s + p.x, 0) / midLine.length, players: midLine.sort((a, b) => a.y - b.y) },
        forward: { x: fwdLine.reduce((s, p) => s + p.x, 0) / fwdLine.length, players: fwdLine.sort((a, b) => a.y - b.y) },
      },
    };

    // Pressing intensity - United chases hard
    if (defendingTeam === 'away') {
      this.state.pressingIntensity = Math.min(98, 85 + (100 - this.ballX) * 0.2);
    } else {
      this.state.pressingIntensity = Math.min(95, 80 + this.ballX * 0.2);
    }
  }

  private maybeChangePossession(events: MatchEvent[]): void {
    const positions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
    const carrier = positions[this.ballCarrierIndex];

    // City's superior technique means lower loss rate
    let loseChance = this.ballCarrierTeam === 'home' ? 0.004 : 0.015;

    // Higher risk in final third
    if (this.ballCarrierTeam === 'home' && carrier.x > 70) loseChance *= 2;
    if (this.ballCarrierTeam === 'away' && carrier.x < 30) loseChance *= 1.8;

    // Fatigue increases errors
    loseChance *= 1 + carrier.fatigue / 200;

    if (Math.random() < loseChance) {
      this.transferPossession(events);
    }
  }

  private transferPossession(events: MatchEvent[]): void {
    const oldTeam = this.ballCarrierTeam;
    const oldCarrier = oldTeam === 'home'
      ? this.homePositions[this.ballCarrierIndex].profile.name
      : this.awayPositions[this.ballCarrierIndex].profile.name;

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

    const newCarrier = newPositions[nearestIdx].profile.name;

    this.stats.tackles[this.ballCarrierTeam]++;
    events.push(this.createEvent('tackle', this.ballCarrierTeam, newCarrier, `${newCarrier} wins it from ${oldCarrier}`));
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

  private attemptShot(team: 'home' | 'away', shooterIdx: number, events: MatchEvent[]): void {
    const shooter = team === 'home'
      ? this.homePositions[shooterIdx].profile.name
      : this.awayPositions[shooterIdx].profile.name;

    const rand = Math.random();
    this.stats.shots[team]++;

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

      const keeper = team === 'home' ? 'Onana' : 'Ederson';
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

    const baseDistance = minute * 110;
    const isGK = idx === 0;
    const mult = isGK ? 0.35 : 1.0;

    return {
      totalDistance: baseDistance * mult,
      distancePerMinute: 110 * mult,
      highSpeedRunningDistance: baseDistance * 0.1 * mult,
      sprintDistance: baseDistance * 0.04 * mult,
      walkingDistance: baseDistance * 0.18,
      joggingDistance: baseDistance * 0.4,
      runningDistance: baseDistance * 0.32,
      currentSpeed: pos.hasBall ? 12 + Math.random() * 7 : 4 + Math.random() * 10,
      averageSpeed: 7.6,
      maxSpeed: pos.profile.maxSpeed,
      speedZones: {
        zone1: minute * 12, zone2: minute * 24, zone3: minute * 16,
        zone4: minute * 9, zone5: minute * 3, zone6: minute * 1.5,
      },
      accelerations: { low: Math.floor(minute * 0.7), medium: Math.floor(minute * 0.4), high: Math.floor(minute * 0.15), total: Math.floor(minute * 1.25) },
      decelerations: { low: Math.floor(minute * 0.6), medium: Math.floor(minute * 0.35), high: Math.floor(minute * 0.12), total: Math.floor(minute * 1.07) },
      maxAcceleration: pos.profile.acceleration,
      maxDeceleration: -pos.profile.acceleration * 0.95,
      playerLoad: minute * 5.6,
      playerLoadPerMinute: 5.6,
      metabolicPower: 12.5,
      highMetabolicLoadDistance: baseDistance * 0.14,
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
      startingXI: ['Ederson', 'Walker', 'Dias', 'Stones', 'Gvardiol', 'Kovacic', 'De Bruyne', 'Silva', 'Doku', 'Haaland', 'Foden'],
      manager: 'Pep Guardiola',
    },
    awayTeam: {
      name: 'Manchester United',
      shortName: 'MUN',
      formation: '4-2-3-1',
      startingXI: ['Onana', 'Dalot', 'de Ligt', 'Martinez', 'Shaw', 'Casemiro', 'Mainoo', 'Fernandes', 'Garnacho', 'Rashford', 'Hojlund'],
      manager: 'Erik ten Hag',
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
