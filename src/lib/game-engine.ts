// Game Engine - Premier League Level Tactical Intelligence
// Dynamic counter-tactics: Opposition plays OPPOSITE of City's style

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
  tacticalMatchup: {
    home: TacticalStyle;
    away: TacticalStyle;
  };
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
  | 'pass_completed' | 'tackle' | 'dribble' | 'cross' | 'clearance' | 'counter_attack';

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
  counterAttacks: { home: number; away: number };
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

// ==================== Tactical Style System ====================

export interface TacticalStyle {
  name: string;
  // Attack (0-100)
  possession: number;      // 100 = Tiki-Taka, 0 = Direct
  passingLength: number;   // 100 = Long balls, 0 = Short passes
  tempo: number;           // 100 = Blitz, 0 = Patient
  width: number;           // 100 = Wide play, 0 = Central
  creativity: number;      // 100 = Individual, 0 = Systematic

  // Defense (0-100)
  defensiveLine: number;   // 100 = High line, 0 = Deep block
  pressingIntensity: number; // 100 = Gegenpress, 0 = Passive
  compactness: number;     // 100 = Narrow, 0 = Wide cover

  // Transition (0-100)
  counterSpeed: number;    // 100 = Lightning counter, 0 = Controlled
  riskTaking: number;      // 100 = Aggressive, 0 = Safe
}

// Guardiola's Total Football / Positional Play
const GUARDIOLA_STYLE: TacticalStyle = {
  name: 'Total Football',
  possession: 95,
  passingLength: 15,  // Short passes
  tempo: 55,          // Controlled but can accelerate
  width: 70,          // Uses width but half-spaces key
  creativity: 40,     // Systematic positional play
  defensiveLine: 85,  // High line
  pressingIntensity: 92, // Intense gegenpressing
  compactness: 80,    // Very compact
  counterSpeed: 30,   // Rarely counters
  riskTaking: 65,     // Plays out from back
};

// Generate OPPOSITE tactical style
function generateCounterStyle(style: TacticalStyle): TacticalStyle {
  return {
    name: 'Counter-Tactical',
    possession: 100 - style.possession,           // Direct, give up possession
    passingLength: 100 - style.passingLength,     // Long balls vs short
    tempo: 100 - style.tempo + 20,                // Fast breaks
    width: 100 - style.width,                     // Opposite width
    creativity: 100 - style.creativity,           // Individual brilliance
    defensiveLine: 100 - style.defensiveLine,     // Deep block vs high line
    pressingIntensity: Math.max(20, 100 - style.pressingIntensity + 30), // Strategic press
    compactness: 100 - style.compactness + 10,    // Absorb and spring
    counterSpeed: 100 - style.counterSpeed + 20,  // Lightning counters
    riskTaking: 100 - style.riskTaking,           // Clinical, safe
  };
}

// ==================== Player Profiles ====================

interface PlayerProfile {
  name: string;
  maxSpeed: number;
  acceleration: number;
  sprintCapacity: number;
  workRate: number;
  positioningIQ: number;
  passingRange: number;
  finishing: number;
  counterAttackThreat: number;
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
  fatigue: number;
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

  // Tactical styles
  private homeStyle: TacticalStyle;
  private awayStyle: TacticalStyle;

  // Counter-attack tracking
  private isCounterActive: boolean = false;
  private counterStartTime: number = 0;
  private transitionZone: number = 50;

  constructor(config: MatchConfig) {
    this.config = config;
    this.homeStyle = GUARDIOLA_STYLE;
    this.awayStyle = generateCounterStyle(GUARDIOLA_STYLE);
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
      intensity: 0.92,
      defensiveBlock: {
        team: 'away',
        type: 'low',
        lines: {
          defensive: { x: 82, players: [] },
          midfield: { x: 65, players: [] },
          forward: { x: 50, players: [] },
        },
      },
      pressingIntensity: 45,
      tacticalMatchup: {
        home: this.homeStyle,
        away: this.awayStyle,
      },
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
      passAccuracy: { home: 92, away: 72 },
      tackles: { home: 0, away: 0 },
      saves: { home: 0, away: 0 },
      xG: { home: 0, away: 0 },
      counterAttacks: { home: 0, away: 0 },
    };
  }

  private initPositions(): void {
    const citySquad = getPLSquadData('MCI');
    const unitedSquad = getPLSquadData('MUN');

    // City 4-3-3 - Positional Play setup
    const cityFormation = [
      { x: 6, y: 50, role: 'GK', idx: 0 },
      { x: 18, y: 82, role: 'RB', idx: 1 },
      { x: 15, y: 60, role: 'CB', idx: 2 },
      { x: 15, y: 40, role: 'CB', idx: 3 },
      { x: 18, y: 18, role: 'LB', idx: 5 },
      { x: 30, y: 50, role: 'CDM', idx: 6 },
      { x: 42, y: 65, role: 'CM', idx: 8 },
      { x: 42, y: 35, role: 'CM', idx: 9 },
      { x: 55, y: 85, role: 'RW', idx: 12 },
      { x: 58, y: 50, role: 'ST', idx: 14 },
      { x: 55, y: 15, role: 'LW', idx: 10 },
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
        workRate: ((phys?.highIntensityThreshold || 19) - 17) / 5,
        positioningIQ: this.getPositioningIQ(formation.role, playerData?.name),
        passingRange: this.getPassingRange(formation.role, playerData?.name),
        finishing: this.getFinishing(formation.role, playerData?.name),
        counterAttackThreat: 0.3, // City rarely counters
      };

      this.homePositions.push({
        x: formation.x, y: formation.y,
        baseX: formation.x, baseY: formation.y,
        targetX: formation.x, targetY: formation.y,
        hasBall: i === 5, profile, fatigue: 0, role: formation.role,
      });
    }

    // United 4-2-3-1 - Counter-Attack Setup (OPPOSITE of City)
    // Deep defensive block, ready to spring on transition
    // FIXED: Better player separation - Garnacho and Hojlund have distinct zones
    const unitedFormation = [
      { x: 94, y: 50, role: 'GK', idx: 0 },
      { x: 85, y: 80, role: 'RB', idx: 1 },   // Wide right
      { x: 88, y: 58, role: 'CB', idx: 2 },   // Right CB
      { x: 88, y: 42, role: 'CB', idx: 3 },   // Left CB
      { x: 85, y: 20, role: 'LB', idx: 4 },   // Wide left
      { x: 72, y: 58, role: 'CDM', idx: 5 },  // Shield right
      { x: 72, y: 42, role: 'CDM', idx: 6 },  // Shield left
      { x: 58, y: 80, role: 'RM', idx: 8 },   // Rashford - wide right threat
      { x: 52, y: 50, role: 'CAM', idx: 7 },  // Fernandes - central link
      { x: 58, y: 20, role: 'LM', idx: 9 },   // Garnacho - wide left threat (SEPARATED)
      { x: 45, y: 50, role: 'ST', idx: 10 },  // Hojlund - central striker (SEPARATED)
    ];

    for (let i = 0; i < 11; i++) {
      const formation = unitedFormation[i];
      const playerData = unitedSquad[formation.idx] || unitedSquad[i];
      const phys = playerData?.physicalProfile;

      // Counter-attack specialists have higher threat ratings
      const counterThreat = this.getCounterThreat(formation.role, playerData?.name);

      const profile: PlayerProfile = {
        name: playerData?.name || this.config.awayTeam.startingXI[i],
        maxSpeed: phys?.maxSpeed || 31,
        acceleration: phys?.accelerationPeak || 3.9,
        sprintCapacity: phys?.sprintCapacity || 340,
        workRate: ((phys?.highIntensityThreshold || 19.5) - 17) / 5,
        positioningIQ: 0.75,
        passingRange: 0.7, // Prefer longer passes
        finishing: this.getFinishing(formation.role, playerData?.name),
        counterAttackThreat: counterThreat,
      };

      this.awayPositions.push({
        x: formation.x, y: formation.y,
        baseX: formation.x, baseY: formation.y,
        targetX: formation.x, targetY: formation.y,
        hasBall: false, profile, fatigue: 0, role: formation.role,
      });
    }
  }

  private getCounterThreat(role: string, name?: string): number {
    // Players dangerous on the counter
    const counterSpecialists: Record<string, number> = {
      'Marcus Rashford': 0.95,  // Pace king
      'Alejandro Garnacho': 0.90,
      'Rasmus Hojlund': 0.85,
      'Bruno Fernandes': 0.80,  // Killer pass
      'Kobbie Mainoo': 0.70,
    };
    if (name && counterSpecialists[name]) return counterSpecialists[name];

    const roleThreat: Record<string, number> = {
      'ST': 0.85, 'LM': 0.80, 'RM': 0.80, 'CAM': 0.75,
      'CDM': 0.40, 'CB': 0.20, 'RB': 0.50, 'LB': 0.50, 'GK': 0.1,
    };
    return roleThreat[role] || 0.5;
  }

  private getPositioningIQ(role: string, name?: string): number {
    const elitePositioners: Record<string, number> = {
      'Rodri': 0.98, 'Bernardo Silva': 0.95, 'Kevin De Bruyne': 0.97,
      'Ruben Dias': 0.92, 'John Stones': 0.88, 'Phil Foden': 0.93,
      'Kyle Walker': 0.85, 'Erling Haaland': 0.90, 'Mateo Kovacic': 0.90,
    };
    if (name && elitePositioners[name]) return elitePositioners[name];
    const roleIQ: Record<string, number> = {
      'GK': 0.85, 'CB': 0.82, 'RB': 0.78, 'LB': 0.78,
      'CDM': 0.92, 'CM': 0.88, 'CAM': 0.85, 'RW': 0.80, 'LW': 0.80, 'ST': 0.82,
    };
    return roleIQ[role] || 0.8;
  }

  private getPassingRange(role: string, name?: string): number {
    const longPassers: Record<string, number> = {
      'Ederson': 0.85, 'Kevin De Bruyne': 0.75, 'Ruben Dias': 0.6,
    };
    if (name && longPassers[name]) return longPassers[name];
    const roleRange: Record<string, number> = {
      'GK': 0.7, 'CB': 0.4, 'RB': 0.35, 'LB': 0.35,
      'CDM': 0.3, 'CM': 0.45, 'CAM': 0.5, 'RW': 0.4, 'LW': 0.4, 'ST': 0.35,
    };
    return roleRange[role] || 0.4;
  }

  private getFinishing(role: string, name?: string): number {
    const finishers: Record<string, number> = {
      'Erling Haaland': 0.95, 'Phil Foden': 0.82, 'Kevin De Bruyne': 0.78,
      'Marcus Rashford': 0.80, 'Rasmus Hojlund': 0.78, 'Bruno Fernandes': 0.75,
      'Alejandro Garnacho': 0.76,
    };
    if (name && finishers[name]) return finishers[name];
    const roleFinish: Record<string, number> = {
      'ST': 0.80, 'LW': 0.70, 'RW': 0.70, 'CAM': 0.65, 'CM': 0.50,
      'CDM': 0.35, 'CB': 0.25, 'RB': 0.30, 'LB': 0.30, 'GK': 0.05,
    };
    return roleFinish[role] || 0.4;
  }

  // ==================== Main Tick ====================

  public tick(seconds: number = 1): MatchEvent[] {
    const events: MatchEvent[] = [];

    this.state.minute += seconds / 60;
    this.movementPhase += 0.05;
    this.handlePhaseTransitions(events);

    if (this.state.phase === 'first_half' || this.state.phase === 'second_half') {
      this.possessionTime[this.ballCarrierTeam] += seconds;
      this.updateFatigue();

      if (this.ballCarrierTeam === 'home') {
        this.updateCityPositionalPlay(events);
        this.updateUnitedDeepBlock(); // OPPOSITE: Deep block, wait to counter
      } else {
        if (this.isCounterActive) {
          this.updateUnitedCounter(events); // OPPOSITE: Lightning counter
        } else {
          this.updateUnitedPossession(events);
        }
        this.updateCityGegenpress();
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
      // City tires from constant pressing
      const pressPenalty = this.homeStyle.pressingIntensity / 20;
      pos.fatigue = Math.min(45, baseFatigue + pressPenalty + Math.random() * 5);
    }
    for (const pos of this.awayPositions) {
      // United conserves energy in deep block
      const conserve = this.isCounterActive ? 8 : -3;
      pos.fatigue = Math.min(35, baseFatigue + conserve + Math.random() * 3);
    }
  }

  private handlePhaseTransitions(events: MatchEvent[]): void {
    const min = this.state.minute;

    if (min >= 0 && min < 0.5 && this.state.phase === 'pre_match') {
      this.state.phase = 'first_half';
      this.ballCarrierTeam = 'home';
      this.ballCarrierIndex = 5;
      this.homePositions[5].hasBall = true;
      events.push(this.createEvent('kickoff', 'home', this.homePositions[5].profile.name,
        'Kickoff! City begin their positional play'));
    } else if (min >= 45 && min < 45.5 && this.state.phase === 'first_half') {
      this.state.phase = 'half_time';
      events.push(this.createEvent('half_time', 'home', '',
        `Half Time: MCI ${this.state.homeScore} - ${this.state.awayScore} MUN`));
    } else if (min >= 46 && min < 46.5 && this.state.phase === 'half_time') {
      this.state.phase = 'second_half';
      this.resetBallToCenter('away');
      events.push(this.createEvent('kickoff', 'away', 'United', 'Second half begins'));
    } else if (min >= 90 && this.state.phase === 'second_half') {
      this.state.phase = 'full_time';
      events.push(this.createEvent('full_time', 'home', '',
        `Full Time: MCI ${this.state.homeScore} - ${this.state.awayScore} MUN`));
    }
  }

  // ==================== CITY - POSITIONAL PLAY ====================

  private updateCityPositionalPlay(events: MatchEvent[]): void {
    this.lastPassTime += 1;

    if (this.ballX < 35) this.playPhase = 'buildUp';
    else if (this.ballX < 65) this.playPhase = 'progression';
    else this.playPhase = 'finalThird';

    const carrier = this.homePositions[this.ballCarrierIndex];
    // Short, patient passing (OPPOSITE of United's directness)
    const passThreshold = 10 + (1 - this.homeStyle.passingLength / 100) * 12;

    if (this.lastPassTime > passThreshold + Math.random() * 8) {
      this.cityPredictivePass(events);
      this.lastPassTime = 0;
    }

    this.updateCityPositions();
  }

  private updateCityPositions(): void {
    const ballX = this.ballX;
    const ballY = this.ballY;
    const style = this.homeStyle;

    for (let i = 0; i < 11; i++) {
      const pos = this.homePositions[i];
      const profile = pos.profile;

      const phase = this.movementPhase + i * 0.6;
      const iqFactor = profile.positioningIQ;
      const speedMod = (profile.maxSpeed / 35) * (1 - pos.fatigue / 100);

      // Systematic movement (low creativity = structured)
      const cycleAmp = 3 + (1 - style.creativity / 100) * 3;
      const cycleX = Math.sin(phase) * cycleAmp * iqFactor;
      const cycleY = Math.cos(phase * 0.7) * cycleAmp * iqFactor;

      const predictedBallX = ballX + 5;

      switch (pos.role) {
        case 'GK':
          pos.targetX = 8 + (this.playPhase === 'buildUp' ? 10 : 3);
          pos.targetY = ballY * 0.15 + 42.5 + cycleY * 0.2;
          break;

        case 'RB':
          // Inverted fullback (Guardiola signature)
          if (ballX > 40 && iqFactor > 0.8) {
            pos.targetX = Math.min(50, ballX - 8) + cycleX;
            pos.targetY = 58 + cycleY;
          } else {
            pos.targetX = pos.baseX + (ballX - 30) * 0.25 + cycleX;
            pos.targetY = pos.baseY + cycleY;
          }
          break;

        case 'CB':
          const cbAdvance = iqFactor * (this.playPhase === 'buildUp' ? 14 : 6);
          pos.targetX = pos.baseX + cbAdvance + cycleX * 0.4;
          pos.targetY = pos.baseY + (ballY - 50) * 0.15 * iqFactor + cycleY * 0.4;
          break;

        case 'LB':
          // Overlapping runs
          const overlapPush = speedMod * 20;
          pos.targetX = pos.baseX + (this.playPhase === 'finalThird' ? overlapPush : 10) + cycleX;
          pos.targetY = Math.max(8, pos.baseY + cycleY);
          break;

        case 'CDM':
          // Rodri: The metronome
          pos.targetX = Math.max(25, predictedBallX - 18) + cycleX * 0.3;
          pos.targetY = 50 + (ballY - 50) * 0.2 * iqFactor + cycleY * 0.3;
          break;

        case 'CM':
          // Half-space occupation
          const isRightCM = pos.baseY > 50;
          const cmPush = iqFactor * (this.playPhase === 'finalThird' ? 15 : 8);
          pos.targetX = Math.min(72, predictedBallX + cmPush) + cycleX;
          pos.targetY = (isRightCM ? 65 : 35) + cycleY;
          break;

        case 'RW':
          // Width stretching
          pos.targetX = Math.min(78, ballX + 15 * speedMod) + cycleX;
          pos.targetY = Math.min(92, 85 + cycleY);
          break;

        case 'LW':
          pos.targetX = Math.min(75, ballX + 12 * iqFactor) + cycleX;
          pos.targetY = Math.max(8, 15 + cycleY);
          break;

        case 'ST':
          pos.targetX = Math.max(55, Math.min(82, predictedBallX + 10)) + cycleX * 0.4;
          pos.targetY = 50 + (ballY - 50) * 0.3 + cycleY * 0.5;
          break;
      }

      if (pos.hasBall) {
        pos.targetX = Math.min(80, pos.x + 0.5 * speedMod);
      }

      const moveSpeed = 0.045 + speedMod * 0.025;
      pos.x += (pos.targetX - pos.x) * moveSpeed;
      pos.y += (pos.targetY - pos.y) * moveSpeed;
    }
  }

  private cityPredictivePass(events: MatchEvent[]): void {
    const fromIdx = this.ballCarrierIndex;
    const carrier = this.homePositions[fromIdx];
    const style = this.homeStyle;

    const options: { idx: number; weight: number }[] = [];

    for (let i = 0; i < 11; i++) {
      if (i === fromIdx) continue;
      const target = this.homePositions[i];
      const dist = Math.sqrt(Math.pow(target.x - carrier.x, 2) + Math.pow(target.y - carrier.y, 2));

      let weight = 10;

      // SHORT PASSES (opposite of United's long balls)
      if (dist < 15) weight *= 3.5;
      else if (dist < 25) weight *= 1.8;
      else if (dist > 40) weight *= 0.2;

      // High IQ receivers
      weight *= 0.5 + target.profile.positioningIQ;

      // Forward progression (but patient)
      if (target.x > carrier.x) weight *= 1.3;

      // Half-spaces preference
      if ((target.y > 20 && target.y < 40) || (target.y > 60 && target.y < 80)) {
        weight *= 1.6;
      }

      // Key players
      if (target.profile.name === 'Kevin De Bruyne') weight *= 1.6;
      if (target.profile.name === 'Bernardo Silva') weight *= 1.4;

      options.push({ idx: i, weight });
    }

    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let rand = Math.random() * totalWeight;
    let toIdx = options[0].idx;

    for (const opt of options) {
      rand -= opt.weight;
      if (rand <= 0) { toIdx = opt.idx; break; }
    }

    this.homePositions[fromIdx].hasBall = false;
    this.homePositions[toIdx].hasBall = true;
    this.ballCarrierIndex = toIdx;
    this.stats.passes.home++;

    if (Math.random() < 0.08) {
      events.push(this.createEvent('pass_completed', 'home', carrier.profile.name,
        `${carrier.profile.name} → ${this.homePositions[toIdx].profile.name}`));
    }

    if (this.homePositions[toIdx].x > 68 && Math.random() < 0.16) {
      this.attemptShot('home', toIdx, events);
    }
  }

  // ==================== UNITED - DEEP BLOCK (OPPOSITE OF HIGH PRESS) ====================

  private updateUnitedDeepBlock(): void {
    const ballX = this.ballX;
    const ballY = this.ballY;
    const style = this.awayStyle;

    // OPPOSITE of City's high line: DEEP BLOCK
    const baseDefLine = 82 + (100 - style.defensiveLine) / 5; // Deep line

    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const profile = pos.profile;

      const phase = this.movementPhase + i * 0.4;
      const jitterX = Math.sin(phase) * 1.5;
      const jitterY = Math.cos(phase * 0.6) * 2;

      // COMPACT shape (absorb pressure)
      const compactPull = style.compactness / 100;

      if (i === 0) {
        // GK stays deep
        pos.targetX = 93 + jitterX * 0.1;
        pos.targetY = ballY * 0.2 + 40 + jitterY * 0.2;
      } else if (i <= 4) {
        // DEEP defensive line (OPPOSITE of high line)
        pos.targetX = Math.max(78, Math.min(88, baseDefLine - (100 - ballX) * 0.05)) + jitterX * 0.3;
        pos.targetY = pos.baseY + (ballY - 50) * 0.2 * compactPull + jitterY;
      } else if (i <= 7) {
        // Midfield shields, stays compact
        pos.targetX = Math.max(62, Math.min(75, ballX + 15)) + jitterX * 0.5;
        pos.targetY = pos.baseY + (ballY - 50) * 0.3 * compactPull + jitterY;
      } else {
        // Forwards drop to help BUT stay ready to spring
        // This is key: they're lazy defensively but explosive on counter
        const stayHighForCounter = profile.counterAttackThreat * 8;
        pos.targetX = Math.max(45 - stayHighForCounter, Math.min(60, ballX + 8)) + jitterX;
        pos.targetY = pos.baseY + (ballY - 50) * 0.15 + jitterY;
      }

      // Slower defensive movement (conserving energy)
      const moveSpeed = 0.04;
      pos.x += (pos.targetX - pos.x) * moveSpeed;
      pos.y += (pos.targetY - pos.y) * moveSpeed;
    }
  }

  // ==================== UNITED - LIGHTNING COUNTER (OPPOSITE OF SLOW BUILD-UP) ====================

  private updateUnitedCounter(events: MatchEvent[]): void {
    const ballX = this.ballX;
    const ballY = this.ballY;
    const style = this.awayStyle;

    // Check if counter should end
    const counterDuration = this.state.minute - this.counterStartTime;
    if (counterDuration > 0.15 || ballX < 25) { // 9 seconds or in final third
      this.isCounterActive = false;
    }

    this.lastPassTime += 1;

    // FAST, DIRECT passes (OPPOSITE of patient build-up)
    const passThreshold = 6 + (1 - style.tempo / 100) * 4;

    if (this.lastPassTime > passThreshold) {
      this.unitedCounterPass(events);
      this.lastPassTime = 0;
    }

    // EXPLOSIVE movement
    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const profile = pos.profile;

      const phase = this.movementPhase + i * 0.3;
      const speedMod = (profile.maxSpeed / 32) * (1 - pos.fatigue / 100);
      const counterThreat = profile.counterAttackThreat;

      if (i === 0) {
        // GK stays
        pos.targetX = 92;
        pos.targetY = 50;
      } else if (i <= 4) {
        // Defenders push up but not too far
        pos.targetX = Math.max(55, ballX + 25) + Math.sin(phase) * 2;
        pos.targetY = pos.baseY + Math.cos(phase) * 3;
      } else if (i <= 7) {
        // Midfield BOMBS forward
        pos.targetX = Math.max(35, ballX - 5) + Math.sin(phase) * 3;
        pos.targetY = ballY + (pos.baseY - 50) * 0.4;
      } else {
        // FORWARDS SPRINT (pace merchants)
        // FIXED: Each player has unique movement pattern - no pairing
        const sprintTarget = Math.max(15, ballX - 20 * counterThreat);

        // Player-specific counter-attack movement
        const playerName = pos.profile.name;

        if (playerName.includes('Rashford') || pos.role === 'RM') {
          // Rashford: Hugs the right touchline, exploits space in behind
          pos.targetX = sprintTarget + Math.sin(phase) * 2;
          pos.targetY = 88 + Math.sin(phase * 1.3) * 5; // Right flank
        } else if (playerName.includes('Garnacho') || pos.role === 'LM') {
          // Garnacho: Hugs the left touchline, cuts inside occasionally
          pos.targetX = sprintTarget - 3 + Math.sin(phase * 0.8) * 3;
          pos.targetY = 12 + Math.cos(phase * 1.5) * 5; // Left flank - WIDE SEPARATION
        } else if (playerName.includes('Hojlund') || pos.role === 'ST') {
          // Hojlund: Central striker, stretches defense vertically
          pos.targetX = Math.max(12, sprintTarget - 8);
          pos.targetY = 50 + Math.sin(phase * 0.6) * 12; // Central but moves laterally
        } else if (pos.role === 'CAM') {
          // Fernandes: Links play, arrives late in box
          pos.targetX = Math.max(28, sprintTarget + 5);
          pos.targetY = 50 + (ballY - 50) * 0.4 + Math.sin(phase) * 8;
        } else {
          pos.targetX = sprintTarget + Math.sin(phase) * 2;
          pos.targetY = pos.baseY;
        }
      }

      // FAST counter movement
      const moveSpeed = 0.08 + speedMod * counterThreat * 0.06;
      pos.x += (pos.targetX - pos.x) * moveSpeed;
      pos.y += (pos.targetY - pos.y) * moveSpeed;
    }
  }

  private unitedCounterPass(events: MatchEvent[]): void {
    const fromIdx = this.ballCarrierIndex;
    const carrier = this.awayPositions[fromIdx];

    const options: { idx: number; weight: number }[] = [];

    for (let i = 0; i < 11; i++) {
      if (i === fromIdx) continue;
      const target = this.awayPositions[i];

      let weight = 10;

      // LONG, DIRECT passes (OPPOSITE of short passing)
      // Prefer players ahead of the ball
      if (target.x < carrier.x) weight *= 3;

      // Counter-attack threat rating
      weight *= 1 + target.profile.counterAttackThreat * 2;

      // Speed matters on counter
      weight *= target.profile.maxSpeed / 30;

      // Forward players preferred
      if (target.role === 'ST' || target.role === 'LM' || target.role === 'RM') {
        weight *= 2.5;
      }

      options.push({ idx: i, weight });
    }

    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let rand = Math.random() * totalWeight;
    let toIdx = 10; // Default to striker

    for (const opt of options) {
      rand -= opt.weight;
      if (rand <= 0) { toIdx = opt.idx; break; }
    }

    this.awayPositions[fromIdx].hasBall = false;
    this.awayPositions[toIdx].hasBall = true;
    this.ballCarrierIndex = toIdx;
    this.stats.passes.away++;

    // More likely to shoot on counter
    if (this.awayPositions[toIdx].x < 30 && Math.random() < 0.28) {
      this.attemptShot('away', toIdx, events);
    }
  }

  private updateUnitedPossession(events: MatchEvent[]): void {
    this.lastPassTime += 1;

    // Quick, direct passing (not patient)
    if (this.lastPassTime > 15 + Math.random() * 10) {
      this.unitedDirectPass(events);
      this.lastPassTime = 0;
    }

    // Forward movement
    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const phase = this.movementPhase + i * 0.4;

      pos.targetX = pos.baseX - (pos.hasBall ? 8 : 4) + Math.sin(phase) * 4;
      pos.targetY = pos.baseY + Math.cos(phase * 0.6) * 5;

      pos.x += (pos.targetX - pos.x) * 0.05;
      pos.y += (pos.targetY - pos.y) * 0.05;
    }
  }

  private unitedDirectPass(events: MatchEvent[]): void {
    const fromIdx = this.ballCarrierIndex;

    const options = [];
    for (let i = 0; i < 11; i++) {
      if (i === fromIdx) continue;
      let weight = 1;

      // Direct forward passes
      if (this.awayPositions[i].x < this.awayPositions[fromIdx].x) weight *= 2.5;
      if (i >= 8) weight *= 2; // Forward targets

      options.push({ idx: i, weight });
    }

    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let rand = Math.random() * totalWeight;
    let toIdx = 7;

    for (const opt of options) {
      rand -= opt.weight;
      if (rand <= 0) { toIdx = opt.idx; break; }
    }

    this.awayPositions[fromIdx].hasBall = false;
    this.awayPositions[toIdx].hasBall = true;
    this.ballCarrierIndex = toIdx;
    this.stats.passes.away++;

    if (this.awayPositions[toIdx].x < 30 && Math.random() < 0.2) {
      this.attemptShot('away', toIdx, events);
    }
  }

  private updateCityGegenpress(): void {
    const ballX = this.ballX;
    const ballY = this.ballY;
    const style = this.homeStyle;

    // HIGH PRESS (opposite of United's deep block)
    for (let i = 0; i < 11; i++) {
      const pos = this.homePositions[i];
      const profile = pos.profile;

      const phase = this.movementPhase + i * 0.5;
      const speedMod = (profile.maxSpeed / 35) * (1 - pos.fatigue / 100);
      const jitterX = Math.sin(phase) * 2;
      const jitterY = Math.cos(phase * 0.7) * 2.5;

      const distToBall = Math.sqrt(Math.pow(pos.x - ballX, 2) + Math.pow(pos.y - ballY, 2));
      const pressIntensity = Math.max(0.5, 1 - distToBall / 40);

      if (i === 0) {
        pos.targetX = Math.max(15, Math.min(35, ballX - 40));
        pos.targetY = ballY * 0.2 + 40 + jitterY * 0.3;
      } else if (i >= 8) {
        // Forwards HUNT
        pos.targetX = Math.max(25, ballX - 10 * pressIntensity) + jitterX;
        pos.targetY = ballY + (i === 8 ? 12 : i === 10 ? -12 : 0) + jitterY;
      } else if (i >= 5 && i <= 7) {
        // Midfield swarms
        pos.targetX = Math.max(20, ballX - 18) + jitterX;
        pos.targetY = pos.baseY + (ballY - 50) * 0.5 + jitterY;
      } else {
        // Defense pushes HIGH
        pos.targetX = Math.min(45, ballX - 22) + jitterX * 0.5;
        pos.targetY = pos.baseY + (ballY - 50) * 0.35 + jitterY * 0.5;
      }

      const moveSpeed = 0.07 + speedMod * style.pressingIntensity / 1500;
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

    // Ball speed varies: faster on counter
    const speedMult = this.isCounterActive ? 0.25 : 0.15;

    if (dist > 0.5) {
      const speed = Math.min(dist * speedMult, 2);
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

    // United = LOW block, City = HIGH block
    let blockType: 'high' | 'mid' | 'low';
    if (defendingTeam === 'away') {
      blockType = avgDefX > 80 ? 'low' : avgDefX > 65 ? 'mid' : 'high';
    } else {
      blockType = avgDefX < 35 ? 'high' : avgDefX < 50 ? 'mid' : 'low';
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

    // Pressing intensity based on style
    if (defendingTeam === 'away') {
      // United: Low pressing (wait and spring)
      this.state.pressingIntensity = Math.min(50, 20 + (100 - this.ballX) * 0.3);
    } else {
      // City: High pressing
      this.state.pressingIntensity = Math.min(98, 80 + this.ballX * 0.2);
    }
  }

  private maybeChangePossession(events: MatchEvent[]): void {
    const positions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
    const carrier = positions[this.ballCarrierIndex];

    let loseChance = this.ballCarrierTeam === 'home' ? 0.004 : 0.012;

    // City more likely to lose in final third (United's trap)
    if (this.ballCarrierTeam === 'home' && carrier.x > 72) loseChance *= 2.2;

    // United more risky on counter
    if (this.isCounterActive) loseChance *= 1.5;

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

    // TRIGGER COUNTER-ATTACK for United
    if (this.ballCarrierTeam === 'away' && this.ballX > 40) {
      this.isCounterActive = true;
      this.counterStartTime = this.state.minute;
      this.transitionZone = this.ballX;
      this.stats.counterAttacks.away++;
      events.push(this.createEvent('counter_attack', 'away', newCarrier,
        `COUNTER! ${newCarrier} wins it and United break!`));
    } else {
      events.push(this.createEvent('tackle', this.ballCarrierTeam, newCarrier,
        `${newCarrier} wins it from ${oldCarrier}`));
    }
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
    this.isCounterActive = false;
  }

  private attemptShot(team: 'home' | 'away', shooterIdx: number, events: MatchEvent[]): void {
    const positions = team === 'home' ? this.homePositions : this.awayPositions;
    const shooter = positions[shooterIdx].profile;

    const rand = Math.random();
    this.stats.shots[team]++;

    // Goal chance based on finishing ability and counter bonus
    let goalChance = shooter.finishing * 0.22;
    if (team === 'away' && this.isCounterActive) {
      goalChance *= 1.4; // Counter-attack bonus
    }

    if (rand < goalChance) {
      if (team === 'home') this.state.homeScore++;
      else this.state.awayScore++;

      this.stats.shotsOnTarget[team]++;
      this.stats.xG[team] += 0.35 + Math.random() * 0.35;

      const goalType = this.isCounterActive ? 'COUNTER GOAL!' : 'GOAL!';
      events.push(this.createEvent('goal', team, shooter.name, `${goalType} ${shooter.name} scores!`));
      this.resetBallToCenter(team === 'home' ? 'away' : 'home');

    } else if (rand < 0.45) {
      this.stats.shotsOnTarget[team]++;
      this.stats.saves[team === 'home' ? 'away' : 'home']++;
      this.stats.xG[team] += 0.12 + Math.random() * 0.15;

      const keeper = team === 'home' ? 'Onana' : 'Ederson';
      events.push(this.createEvent('shot_on_target', team, shooter.name,
        `${shooter.name}'s shot saved by ${keeper}`));

      this.clearBallCarriers();
      this.ballCarrierTeam = team === 'home' ? 'away' : 'home';
      this.ballCarrierIndex = 0;
      const pos = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
      pos[0].hasBall = true;
      this.isCounterActive = false;

    } else {
      this.stats.xG[team] += 0.04 + Math.random() * 0.08;
      events.push(this.createEvent('shot_off_target', team, shooter.name,
        `${shooter.name}'s shot goes wide`));

      this.clearBallCarriers();
      this.ballCarrierTeam = team === 'home' ? 'away' : 'home';
      this.ballCarrierIndex = 0;
      const pos = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
      pos[0].hasBall = true;
      this.isCounterActive = false;
    }
  }

  private updatePossessionStats(): void {
    const total = this.possessionTime.home + this.possessionTime.away;
    if (total > 0) {
      const homePoss = Math.round((this.possessionTime.home / total) * 100);
      this.state.possession = {
        home: Math.max(58, Math.min(78, homePoss)),
        away: Math.min(42, Math.max(22, 100 - homePoss))
      };
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
  public getHomeStyle(): TacticalStyle { return this.homeStyle; }
  public getAwayStyle(): TacticalStyle { return this.awayStyle; }

  public generatePlayerMetrics(player: Player, isHome: boolean, playerIndex: number): TrackingMetrics {
    const idx = Math.min(playerIndex, 10);
    const pos = isHome ? this.homePositions[idx] : this.awayPositions[idx];
    const minute = Math.max(1, this.state.minute);

    const baseDistance = minute * 112;
    const isGK = idx === 0;
    const mult = isGK ? 0.32 : 1.0;

    return {
      totalDistance: baseDistance * mult,
      distancePerMinute: 112 * mult,
      highSpeedRunningDistance: baseDistance * 0.11 * mult,
      sprintDistance: baseDistance * 0.045 * mult,
      walkingDistance: baseDistance * 0.17,
      joggingDistance: baseDistance * 0.38,
      runningDistance: baseDistance * 0.34,
      currentSpeed: pos.hasBall ? 13 + Math.random() * 8 : 4 + Math.random() * 11,
      averageSpeed: 7.8,
      maxSpeed: pos.profile.maxSpeed,
      speedZones: {
        zone1: minute * 11, zone2: minute * 25, zone3: minute * 17,
        zone4: minute * 10, zone5: minute * 4, zone6: minute * 2,
      },
      accelerations: { low: Math.floor(minute * 0.75), medium: Math.floor(minute * 0.45), high: Math.floor(minute * 0.18), total: Math.floor(minute * 1.38) },
      decelerations: { low: Math.floor(minute * 0.65), medium: Math.floor(minute * 0.38), high: Math.floor(minute * 0.14), total: Math.floor(minute * 1.17) },
      maxAcceleration: pos.profile.acceleration,
      maxDeceleration: -pos.profile.acceleration * 0.95,
      playerLoad: minute * 5.8,
      playerLoadPerMinute: 5.8,
      metabolicPower: 12.8,
      highMetabolicLoadDistance: baseDistance * 0.15,
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
