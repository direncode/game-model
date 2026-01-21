// Game Engine - Tactical Football Simulation
// City: Tiki-Taka (Pep Guardiola) - Short passes, constant movement, possession
// United: Counter-Attack (SAF style) - Defend deep, fast transitions, direct play

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

// ==================== Player Position ====================

interface PlayerPos {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  hasBall: boolean;
}

// City 4-3-3 Tiki-Taka positions (fluid, compact)
const CITY_BASE: { x: number; y: number; role: string }[] = [
  { x: 8, y: 50, role: 'GK' },      // 0: Ederson
  { x: 22, y: 78, role: 'RB' },     // 1: Walker
  { x: 18, y: 58, role: 'CB' },     // 2: Dias
  { x: 18, y: 42, role: 'CB' },     // 3: Stones
  { x: 22, y: 22, role: 'LB' },     // 4: Gvardiol
  { x: 35, y: 50, role: 'CDM' },    // 5: Kovacic
  { x: 42, y: 65, role: 'CM' },     // 6: De Bruyne
  { x: 42, y: 35, role: 'CM' },     // 7: Silva
  { x: 55, y: 82, role: 'RW' },     // 8: Foden
  { x: 58, y: 50, role: 'ST' },     // 9: Haaland
  { x: 55, y: 18, role: 'LW' },     // 10: Doku
];

// United 4-2-3-1 Counter-Attack positions (deeper, ready to spring)
const UNITED_BASE: { x: number; y: number; role: string }[] = [
  { x: 92, y: 50, role: 'GK' },     // 0: Onana
  { x: 78, y: 22, role: 'RB' },     // 1: Dalot
  { x: 82, y: 42, role: 'CB' },     // 2: De Ligt
  { x: 82, y: 58, role: 'CB' },     // 3: Martinez
  { x: 78, y: 78, role: 'LB' },     // 4: Shaw
  { x: 65, y: 42, role: 'CDM' },    // 5: Casemiro
  { x: 65, y: 58, role: 'CDM' },    // 6: Mainoo
  { x: 50, y: 18, role: 'RW' },     // 7: Diallo
  { x: 52, y: 50, role: 'CAM' },    // 8: Fernandes
  { x: 50, y: 82, role: 'LW' },     // 9: Rashford
  { x: 45, y: 50, role: 'ST' },     // 10: Hojlund
];

// ==================== Game Engine ====================

export class GameEngine {
  private config: MatchConfig;
  private state: MatchState;
  private stats: MatchStats;

  // Player positions
  private homePositions: PlayerPos[] = [];
  private awayPositions: PlayerPos[] = [];

  // Ball carrier tracking
  private ballCarrierTeam: 'home' | 'away' = 'home';
  private ballCarrierIndex: number = 9; // Starts with striker

  // Ball position (separate from carrier for smooth movement)
  private ballX: number = 50;
  private ballY: number = 50;

  // Tactical state
  private passCount: number = 0;
  private lastPassTime: number = 0;
  private possessionTime: { home: number; away: number } = { home: 0, away: 0 };
  private movementPhase: number = 0; // For cyclical movement

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
      passAccuracy: { home: 90, away: 78 },
      tackles: { home: 0, away: 0 },
      saves: { home: 0, away: 0 },
      xG: { home: 0, away: 0 },
    };
  }

  private initPositions(): void {
    // City positions
    for (let i = 0; i < 11; i++) {
      const base = CITY_BASE[i];
      this.homePositions.push({
        x: base.x,
        y: base.y,
        baseX: base.x,
        baseY: base.y,
        targetX: base.x,
        targetY: base.y,
        hasBall: i === 9, // Haaland starts with ball
      });
    }

    // United positions
    for (let i = 0; i < 11; i++) {
      const base = UNITED_BASE[i];
      this.awayPositions.push({
        x: base.x,
        y: base.y,
        baseX: base.x,
        baseY: base.y,
        targetX: base.x,
        targetY: base.y,
        hasBall: false,
      });
    }
  }

  // ==================== Main Tick ====================

  public tick(seconds: number = 1): MatchEvent[] {
    const events: MatchEvent[] = [];

    this.state.minute += seconds / 60;
    this.handlePhaseTransitions(events);

    if (this.state.phase === 'first_half' || this.state.phase === 'second_half') {
      // Track possession time
      this.possessionTime[this.ballCarrierTeam] += seconds;

      // Update based on which team has possession
      if (this.ballCarrierTeam === 'home') {
        this.updateCityTikiTaka(events);
      } else {
        this.updateUnitedCounter(events);
      }

      // Update defending team positions
      if (this.ballCarrierTeam === 'home') {
        this.updateUnitedDefending();
      } else {
        this.updateCityPressing();
      }

      // Ball follows the carrier
      this.updateBallPosition();

      // Maybe lose possession
      this.maybeChangePossession(events);

      // Update possession stats
      this.updatePossessionStats();
    }

    return events;
  }

  private handlePhaseTransitions(events: MatchEvent[]): void {
    const min = this.state.minute;

    if (min >= 0 && min < 0.5 && this.state.phase === 'pre_match') {
      this.state.phase = 'first_half';
      this.ballCarrierTeam = 'home';
      this.ballCarrierIndex = 9;
      this.homePositions[9].hasBall = true;
      events.push(this.createEvent('kickoff', 'home', 'Haaland', 'Kickoff! Manchester Derby begins - City in possession'));
    } else if (min >= 45 && min < 45.5 && this.state.phase === 'first_half') {
      this.state.phase = 'half_time';
      events.push(this.createEvent('half_time', 'home', '', `Half Time: MCI ${this.state.homeScore} - ${this.state.awayScore} MUN`));
    } else if (min >= 46 && min < 46.5 && this.state.phase === 'half_time') {
      this.state.phase = 'second_half';
      this.ballCarrierTeam = 'away';
      this.ballCarrierIndex = 10;
      this.clearBallCarriers();
      this.awayPositions[10].hasBall = true;
      events.push(this.createEvent('kickoff', 'away', 'Hojlund', 'Second half - United kick off'));
    } else if (min >= 90 && this.state.phase === 'second_half') {
      this.state.phase = 'full_time';
      events.push(this.createEvent('full_time', 'home', '', `Full Time: MCI ${this.state.homeScore} - ${this.state.awayScore} MUN`));
    }
  }

  // ==================== CITY TIKI-TAKA ====================

  private updateCityTikiTaka(events: MatchEvent[]): void {
    // Tiki-Taka: Quick short passes, constant movement
    this.lastPassTime += 1;
    this.movementPhase += 0.05; // Cyclical movement phase

    // Pass every 1-3 seconds (quick circulation)
    if (this.lastPassTime > 12 + Math.random() * 18) {
      this.cityPass(events);
      this.lastPassTime = 0;
    }

    const ballX = this.ballX;
    const ballY = this.ballY;

    // All players constantly move to create passing lanes
    for (let i = 0; i < 11; i++) {
      const pos = this.homePositions[i];
      const base = CITY_BASE[i];

      // Cyclical movement offset (each player has different phase)
      const phase = this.movementPhase + i * 0.5;
      const cycleX = Math.sin(phase) * 4;
      const cycleY = Math.cos(phase * 0.7) * 5;

      if (i === 0) {
        // Ederson sweeper keeper - comes out to receive back passes
        pos.targetX = this.ballCarrierIndex <= 4 ? 14 + cycleX * 0.3 : base.x;
        pos.targetY = base.y + cycleY * 0.5;
      } else if (pos.hasBall) {
        // Ball carrier moves forward with the ball
        pos.targetX = Math.min(72, pos.x + 1);
        pos.targetY = pos.y + cycleY * 0.3;
      } else {
        // Off-ball movement - create triangles, find space
        const pushUp = (ballX > 40) ? 8 : 0; // Push up when in attacking half
        const pullTowardsBall = (ballY - base.y) * 0.12; // Slight pull towards ball laterally

        pos.targetX = Math.max(12, Math.min(72, base.x + pushUp + cycleX));
        pos.targetY = Math.max(10, Math.min(90, base.y + pullTowardsBall + cycleY));
      }

      // Smooth movement - slightly faster for more visible motion
      pos.x += (pos.targetX - pos.x) * 0.06;
      pos.y += (pos.targetY - pos.y) * 0.06;
    }
  }

  private cityPass(events: MatchEvent[]): void {
    const fromIdx = this.ballCarrierIndex;
    const fromPlayer = this.config.homeTeam.startingXI[fromIdx];

    // Tiki-Taka: Prefer short passes to nearby players
    // Options weighted by distance and position
    const options: { idx: number; weight: number }[] = [];
    const carrier = this.homePositions[fromIdx];

    for (let i = 0; i < 11; i++) {
      if (i === fromIdx) continue;
      const target = this.homePositions[i];
      const dist = Math.sqrt(Math.pow(target.x - carrier.x, 2) + Math.pow(target.y - carrier.y, 2));

      // Tiki-Taka prefers short passes (weight inversely proportional to distance)
      let weight = Math.max(1, 50 - dist);

      // Bonus for forward passes
      if (target.x > carrier.x) weight *= 1.3;

      // Bonus for midfielders (circulation)
      if (i >= 5 && i <= 7) weight *= 1.5;

      options.push({ idx: i, weight });
    }

    // Pick target weighted by options
    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let rand = Math.random() * totalWeight;
    let toIdx = options[0].idx;

    for (const opt of options) {
      rand -= opt.weight;
      if (rand <= 0) {
        toIdx = opt.idx;
        break;
      }
    }

    const toPlayer = this.config.homeTeam.startingXI[toIdx];

    // Transfer ball
    this.homePositions[fromIdx].hasBall = false;
    this.homePositions[toIdx].hasBall = true;
    this.ballCarrierIndex = toIdx;

    this.passCount++;
    this.stats.passes.home++;

    // Only log some passes
    if (Math.random() < 0.15) {
      events.push(this.createEvent('pass_completed', 'home', fromPlayer, `${fromPlayer} → ${toPlayer}`));
    }

    // Check for shot opportunity
    if (this.homePositions[toIdx].x > 65 && Math.random() < 0.12) {
      this.attemptShot('home', toIdx, events);
    }
  }

  private updateCityPressing(): void {
    // City press high when out of possession (gegenpressing)
    const ballX = this.ballX;
    const ballY = this.ballY;
    this.movementPhase += 0.03;

    for (let i = 0; i < 11; i++) {
      const pos = this.homePositions[i];
      const base = CITY_BASE[i];

      // Small jitter for realistic movement
      const jitterX = Math.sin(this.movementPhase + i) * 2;
      const jitterY = Math.cos(this.movementPhase * 0.8 + i) * 2;

      // Distance to ball affects pressing intensity
      const distToBall = Math.sqrt(Math.pow(pos.x - ballX, 2) + Math.pow(pos.y - ballY, 2));
      const pressIntensity = Math.max(0, 1 - distToBall / 50); // Closer = more pressing

      if (i === 0) {
        // GK adjusts position based on ball
        pos.targetX = Math.max(6, Math.min(15, base.x + (ballX - 50) * 0.05));
        pos.targetY = base.y + (ballY - 50) * 0.15 + jitterY * 0.3;
      } else if (i >= 8) {
        // Forwards press the ball aggressively
        pos.targetX = Math.max(30, ballX - 8 - (1 - pressIntensity) * 15) + jitterX;
        pos.targetY = ballY + (i === 8 ? 12 : i === 10 ? -12 : 0) + jitterY;
      } else if (i >= 5) {
        // Midfield compact and reactive
        pos.targetX = Math.max(22, ballX - 18) + jitterX;
        pos.targetY = base.y + (ballY - 50) * 0.4 + jitterY;
      } else {
        // Defense holds line but shifts with ball
        pos.targetX = Math.min(32, ballX - 22) + jitterX * 0.5;
        pos.targetY = base.y + (ballY - 50) * 0.25 + jitterY * 0.5;
      }

      // Faster movement when pressing
      const speed = 0.07 + pressIntensity * 0.04;
      pos.x += (pos.targetX - pos.x) * speed;
      pos.y += (pos.targetY - pos.y) * speed;
    }
  }

  // ==================== UNITED COUNTER-ATTACK ====================

  private updateUnitedCounter(events: MatchEvent[]): void {
    this.lastPassTime += 1;
    this.movementPhase += 0.04;

    const ballX = this.ballX;
    const isCounter = ballX < 55; // Ball in City's half = counter opportunity

    // Counter-attack: Quick direct passes forward
    if (this.lastPassTime > 18 + Math.random() * 22) {
      this.unitedPass(events);
      this.lastPassTime = 0;
    }

    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const base = UNITED_BASE[i];

      // Movement variation
      const phase = this.movementPhase + i * 0.6;
      const moveX = Math.sin(phase) * 3;
      const moveY = Math.cos(phase * 0.8) * 4;

      if (i === 0) {
        // Onana stays deep but adjusts
        pos.targetX = base.x + moveX * 0.2;
        pos.targetY = base.y + (this.ballY - 50) * 0.1 + moveY * 0.3;
      } else if (pos.hasBall) {
        // Ball carrier drives forward
        pos.targetX = Math.max(18, pos.x - 2);
        pos.targetY = pos.y + moveY * 0.2;
      } else if (i === 7 || i === 9 || i === 10) {
        // Wingers and striker - sprint on counter, stay wide otherwise
        if (isCounter) {
          pos.targetX = Math.max(15, base.x - 25 + moveX); // Sprint forward
          pos.targetY = base.y + moveY;
        } else {
          pos.targetX = base.x + moveX;
          pos.targetY = base.y + moveY;
        }
      } else if (i === 8) {
        // Fernandes links play
        pos.targetX = isCounter ? Math.max(30, ballX + 5) : base.x + moveX;
        pos.targetY = this.ballY * 0.3 + base.y * 0.7 + moveY;
      } else {
        // Midfield and defense support
        const support = isCounter ? -10 : 0;
        pos.targetX = base.x + support + moveX;
        pos.targetY = base.y + moveY;
      }

      // United move faster on counter
      const speed = (isCounter && i >= 7) ? 0.10 : 0.06;
      pos.x += (pos.targetX - pos.x) * speed;
      pos.y += (pos.targetY - pos.y) * speed;
    }
  }

  private unitedPass(events: MatchEvent[]): void {
    const fromIdx = this.ballCarrierIndex;
    const fromPlayer = this.config.awayTeam.startingXI[fromIdx];
    const carrier = this.awayPositions[fromIdx];

    // Counter-attack: Prefer direct forward passes
    const options: { idx: number; weight: number }[] = [];

    for (let i = 0; i < 11; i++) {
      if (i === fromIdx) continue;
      const target = this.awayPositions[i];
      const dist = Math.sqrt(Math.pow(target.x - carrier.x, 2) + Math.pow(target.y - carrier.y, 2));

      let weight = 10;

      // Counter-attack: Bonus for forward passes (towards goal at x=0)
      if (target.x < carrier.x) weight *= 2;

      // Big bonus for attackers
      if (i >= 7) weight *= 2.5;

      // Fernandes as playmaker
      if (i === 8) weight *= 1.5;

      // Penalty for long passes (risky)
      if (dist > 40) weight *= 0.5;

      options.push({ idx: i, weight });
    }

    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let rand = Math.random() * totalWeight;
    let toIdx = options[0].idx;

    for (const opt of options) {
      rand -= opt.weight;
      if (rand <= 0) {
        toIdx = opt.idx;
        break;
      }
    }

    const toPlayer = this.config.awayTeam.startingXI[toIdx];

    // Transfer ball
    this.awayPositions[fromIdx].hasBall = false;
    this.awayPositions[toIdx].hasBall = true;
    this.ballCarrierIndex = toIdx;

    this.stats.passes.away++;

    if (Math.random() < 0.2) {
      events.push(this.createEvent('pass_completed', 'away', fromPlayer, `${fromPlayer} → ${toPlayer}`));
    }

    // Counter-attack shot opportunity
    if (this.awayPositions[toIdx].x < 35 && Math.random() < 0.15) {
      this.attemptShot('away', toIdx, events);
    }
  }

  private updateUnitedDefending(): void {
    // United defend deep in a compact block with reactive pressing
    const ballX = this.ballX;
    const ballY = this.ballY;
    this.movementPhase += 0.03;

    for (let i = 0; i < 11; i++) {
      const pos = this.awayPositions[i];
      const base = UNITED_BASE[i];

      // Subtle movement
      const phase = this.movementPhase + i * 0.5;
      const jitterX = Math.sin(phase) * 1.5;
      const jitterY = Math.cos(phase * 0.7) * 2;

      // React to ball position
      const ballPressure = (ballX > 60) ? 0.3 : 0.1; // Press harder in own half

      if (i === 0) {
        // GK positions based on ball
        pos.targetX = base.x + jitterX * 0.2;
        pos.targetY = ballY * 0.25 + 37.5 + jitterY * 0.3;
      } else if (i <= 4) {
        // Defensive line - drops deep, shifts with ball
        pos.targetX = Math.max(70, Math.min(86, ballX + 18)) + jitterX * 0.5;
        pos.targetY = base.y + (ballY - 50) * 0.3 + jitterY;
      } else if (i <= 6) {
        // Double pivot - shield and react
        pos.targetX = Math.max(58, Math.min(76, ballX + 8)) + jitterX;
        pos.targetY = base.y + (ballY - 50) * 0.35 + jitterY;
      } else if (i === 8) {
        // Fernandes tracks ball, ready to counter
        pos.targetX = Math.max(48, ballX + 3) + jitterX;
        pos.targetY = ballY * 0.6 + base.y * 0.4 + jitterY;
      } else {
        // Wingers stay wide but drift with ball, ready for counter
        const driftY = (ballY - 50) * 0.15;
        pos.targetX = Math.max(42, Math.min(58, base.x - ballPressure * 10)) + jitterX;
        pos.targetY = base.y + driftY + jitterY;
      }

      // Reactive speed - faster when ball is closer
      const distToBall = Math.sqrt(Math.pow(pos.x - ballX, 2) + Math.pow(pos.y - ballY, 2));
      const speed = 0.05 + (1 - Math.min(distToBall / 60, 1)) * 0.03;
      pos.x += (pos.targetX - pos.x) * speed;
      pos.y += (pos.targetY - pos.y) * speed;
    }
  }

  // ==================== Ball & Possession ====================

  private updateBallPosition(): void {
    const positions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
    const carrier = positions[this.ballCarrierIndex];

    // Ball moves slowly towards carrier (not instant)
    const dx = carrier.x - this.ballX;
    const dy = carrier.y - this.ballY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.5) {
      // Move ball at controlled speed (slower = more realistic)
      const speed = Math.min(dist * 0.15, 1.5); // Max 1.5 units per tick
      this.ballX += (dx / dist) * speed;
      this.ballY += (dy / dist) * speed;
    } else {
      this.ballX = carrier.x;
      this.ballY = carrier.y;
    }

    this.state.ballPosition.x = this.ballX;
    this.state.ballPosition.y = this.ballY;
    this.state.ballPossession = this.ballCarrierTeam;

    // Update zone
    const x = this.ballX;
    if (this.ballCarrierTeam === 'home') {
      this.state.ballPosition.zone = x < 33 ? 'defensive' : x > 66 ? 'attacking' : 'middle';
    } else {
      this.state.ballPosition.zone = x > 66 ? 'defensive' : x < 33 ? 'attacking' : 'middle';
    }
  }

  private maybeChangePossession(events: MatchEvent[]): void {
    // Chance to lose possession based on position and pressure
    const positions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
    const carrier = positions[this.ballCarrierIndex];

    let loseChance = 0.008; // Base chance per tick

    // Higher chance near opponent's goal (more pressure)
    if (this.ballCarrierTeam === 'home' && carrier.x > 70) loseChance *= 2;
    if (this.ballCarrierTeam === 'away' && carrier.x < 30) loseChance *= 2;

    // City keeps possession better (Tiki-Taka)
    if (this.ballCarrierTeam === 'home') loseChance *= 0.7;

    if (Math.random() < loseChance) {
      // Lose possession
      const oldTeam = this.ballCarrierTeam;
      const oldCarrier = this.ballCarrierTeam === 'home'
        ? this.config.homeTeam.startingXI[this.ballCarrierIndex]
        : this.config.awayTeam.startingXI[this.ballCarrierIndex];

      this.clearBallCarriers();

      // Find nearest opponent player to ball
      const opponents = this.ballCarrierTeam === 'home' ? this.awayPositions : this.homePositions;
      let nearestIdx = 5;
      let nearestDist = 1000;

      for (let i = 1; i < 11; i++) {
        const dist = Math.sqrt(
          Math.pow(opponents[i].x - carrier.x, 2) +
          Math.pow(opponents[i].y - carrier.y, 2)
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      this.ballCarrierTeam = oldTeam === 'home' ? 'away' : 'home';
      this.ballCarrierIndex = nearestIdx;

      const newTeamPositions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
      newTeamPositions[nearestIdx].hasBall = true;

      const newCarrier = this.ballCarrierTeam === 'home'
        ? this.config.homeTeam.startingXI[nearestIdx]
        : this.config.awayTeam.startingXI[nearestIdx];

      this.stats.tackles[this.ballCarrierTeam]++;

      events.push(this.createEvent(
        'tackle',
        this.ballCarrierTeam,
        newCarrier,
        `${newCarrier} wins the ball from ${oldCarrier}!`
      ));
    }
  }

  private clearBallCarriers(): void {
    for (const pos of this.homePositions) pos.hasBall = false;
    for (const pos of this.awayPositions) pos.hasBall = false;
  }

  // ==================== Shooting ====================

  private attemptShot(team: 'home' | 'away', shooterIdx: number, events: MatchEvent[]): void {
    const shooter = team === 'home'
      ? this.config.homeTeam.startingXI[shooterIdx]
      : this.config.awayTeam.startingXI[shooterIdx];

    const rand = Math.random();

    this.stats.shots[team]++;

    if (rand < 0.15) {
      // GOAL!
      if (team === 'home') {
        this.state.homeScore++;
      } else {
        this.state.awayScore++;
      }
      this.stats.shotsOnTarget[team]++;
      this.stats.xG[team] += 0.4 + Math.random() * 0.3;

      events.push(this.createEvent('goal', team, shooter, `GOAL! ${shooter} scores for ${team === 'home' ? 'City' : 'United'}!`));

      // Reset to center
      this.clearBallCarriers();
      this.ballCarrierTeam = team === 'home' ? 'away' : 'home';
      this.ballCarrierIndex = 10;
      const positions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
      positions[10].hasBall = true;
      this.state.ballPosition.x = 50;
      this.state.ballPosition.y = 50;

    } else if (rand < 0.45) {
      // Save
      this.stats.shotsOnTarget[team]++;
      this.stats.saves[team === 'home' ? 'away' : 'home']++;
      this.stats.xG[team] += 0.15 + Math.random() * 0.15;

      const keeper = team === 'home' ? 'Onana' : 'Ederson';
      events.push(this.createEvent('shot_on_target', team, shooter, `Shot by ${shooter}! Saved by ${keeper}`));

      // Keeper gets ball
      this.clearBallCarriers();
      this.ballCarrierTeam = team === 'home' ? 'away' : 'home';
      this.ballCarrierIndex = 0;
      const positions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
      positions[0].hasBall = true;

    } else {
      // Miss
      this.stats.xG[team] += 0.05 + Math.random() * 0.1;
      events.push(this.createEvent('shot_off_target', team, shooter, `${shooter}'s shot goes wide!`));

      // Goal kick
      this.clearBallCarriers();
      this.ballCarrierTeam = team === 'home' ? 'away' : 'home';
      this.ballCarrierIndex = 0;
      const positions = this.ballCarrierTeam === 'home' ? this.homePositions : this.awayPositions;
      positions[0].hasBall = true;
    }
  }

  private updatePossessionStats(): void {
    const total = this.possessionTime.home + this.possessionTime.away;
    if (total > 0) {
      const homePoss = Math.round((this.possessionTime.home / total) * 100);
      this.state.possession = { home: homePoss, away: 100 - homePoss };
      this.stats.possession = this.state.possession;
    }
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

  // ==================== Public API ====================

  public kickoff(): void {
    this.state.phase = 'first_half';
    this.state.minute = 0;
    this.ballCarrierTeam = 'home';
    this.ballCarrierIndex = 9;
    this.clearBallCarriers();
    this.homePositions[9].hasBall = true;
    this.state.ballPosition = { x: 50, y: 50, zone: 'center' };
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

  public generatePlayerMetrics(player: Player, isHome: boolean, playerIndex: number): TrackingMetrics {
    const idx = Math.min(playerIndex, 10);
    const pos = isHome ? this.homePositions[idx] : this.awayPositions[idx];
    const minute = Math.max(1, this.state.minute);

    const baseDistance = minute * 105;
    const isGK = idx === 0;
    const mult = isGK ? 0.35 : 1.0;

    return {
      totalDistance: baseDistance * mult,
      distancePerMinute: 105 * mult,
      highSpeedRunningDistance: baseDistance * 0.09 * mult,
      sprintDistance: baseDistance * 0.035 * mult,
      walkingDistance: baseDistance * 0.22,
      joggingDistance: baseDistance * 0.38,
      runningDistance: baseDistance * 0.31,
      currentSpeed: pos.hasBall ? 12 + Math.random() * 5 : 6 + Math.random() * 7,
      averageSpeed: 7.2,
      maxSpeed: player.physicalProfile?.maxSpeed || 33,
      speedZones: {
        zone1: minute * 14,
        zone2: minute * 22,
        zone3: minute * 14,
        zone4: minute * 7,
        zone5: minute * 3,
        zone6: minute * 1,
      },
      accelerations: { low: Math.floor(minute * 0.6), medium: Math.floor(minute * 0.35), high: Math.floor(minute * 0.12), total: Math.floor(minute * 1.07) },
      decelerations: { low: Math.floor(minute * 0.55), medium: Math.floor(minute * 0.3), high: Math.floor(minute * 0.1), total: Math.floor(minute * 0.95) },
      maxAcceleration: 3.8,
      maxDeceleration: -3.6,
      playerLoad: minute * 5.2,
      playerLoadPerMinute: 5.2,
      metabolicPower: 11.5,
      highMetabolicLoadDistance: baseDistance * 0.12,
      position: {
        x: pos.x,
        y: pos.y,
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
      manager: 'Sir Alex Ferguson',
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

export type { MatchConfig as TeamConfig };
