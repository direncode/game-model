/**
 * PSYCHOLOGICAL & MORALE SYSTEM
 * Models player mentality, confidence, pressure handling, and team chemistry
 * Uses probabilistic algorithms for mental states and crowd dynamics
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface MentalState {
  confidence: number;           // 0-100
  composure: number;            // 0-100 (pressure handling)
  motivation: number;           // 0-100
  focus: number;                // 0-100
  aggression: number;           // 0-100 (can be negative if too high)
  anxiety: number;              // 0-100 (lower is better)
  fatigueMental: number;        // 0-100 mental tiredness
}

export interface PersonalityProfile {
  leadership: number;           // 0-100
  temperament: number;          // 0-100 (100 = very calm)
  determination: number;        // 0-100
  pressureThreshold: number;    // 0-100 (how much pressure before cracking)
  workRate: number;             // 0-100
  professionalism: number;      // 0-100
  bigGamePlayer: number;        // 0-100 (performance in important matches)
  consistency: number;          // 0-100 (performance variance)
}

export interface TeamChemistry {
  overallHarmony: number;       // 0-100
  cohesion: number;             // 0-100 (how well they play together)
  trust: number;                // 0-100
  communication: number;        // 0-100
  leadershipPresence: number;   // 0-100
  rivalries: PlayerRivalry[];
  partnerships: PlayerPartnership[];
}

export interface PlayerRivalry {
  player1Id: string;
  player2Id: string;
  intensity: number;            // 0-100
  reason: string;
}

export interface PlayerPartnership {
  player1Id: string;
  player2Id: string;
  synergy: number;              // 0-100
  playStyle: string;
}

export interface CrowdAtmosphere {
  volume: number;               // 0-100
  hostility: number;            // 0-100 (to away team)
  enthusiasm: number;           // 0-100
  tension: number;              // 0-100
  homeSupport: number;          // 0-100
  awaySupport: number;          // 0-100
}

export interface MatchStakes {
  importance: number;           // 0-100
  rivalryLevel: number;         // 0-100
  mediaAttention: number;       // 0-100
  consequencesOfLoss: number;   // 0-100
  consequencesOfWin: number;    // 0-100
}

export interface MatchEvent {
  type: 'goal_for' | 'goal_against' | 'red_card' | 'yellow_card' | 'penalty_for' |
        'penalty_against' | 'penalty_miss' | 'big_miss' | 'great_save' | 'injury' |
        'substitution' | 'var_decision' | 'controversial_foul' | 'comeback';
  minute: number;
  playerId?: string;
  impactRadius: 'individual' | 'local' | 'team' | 'match';
}

// ============================================================================
// PLAYER MENTAL STATE MANAGER
// ============================================================================

export class PlayerPsychology {
  private playerId: string;
  private personality: PersonalityProfile;
  private currentState: MentalState;
  private baselineState: MentalState;
  private recentEvents: MatchEvent[] = [];
  private performanceHistory: number[] = [];  // Last 5 match ratings

  constructor(playerId: string, personality: PersonalityProfile, recentPerformance: number[] = []) {
    this.playerId = playerId;
    this.personality = personality;
    this.performanceHistory = recentPerformance.slice(-5);

    // Initialize baseline state from personality and recent form
    this.baselineState = this.calculateBaseline();
    this.currentState = { ...this.baselineState };
  }

  private calculateBaseline(): MentalState {
    const recentForm = this.performanceHistory.length > 0
      ? this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length
      : 70;

    return {
      confidence: Math.min(100, 40 + this.personality.determination * 0.3 + recentForm * 0.3),
      composure: Math.min(100, 30 + this.personality.temperament * 0.5 + this.personality.pressureThreshold * 0.2),
      motivation: Math.min(100, 50 + this.personality.workRate * 0.3 + this.personality.professionalism * 0.2),
      focus: Math.min(100, 40 + this.personality.professionalism * 0.4 + this.personality.consistency * 0.2),
      aggression: 30 + (100 - this.personality.temperament) * 0.3,
      anxiety: Math.max(0, 30 - this.personality.pressureThreshold * 0.2 - this.personality.bigGamePlayer * 0.1),
      fatigueMental: 10
    };
  }

  processEvent(event: MatchEvent, isDirectlyInvolved: boolean): void {
    this.recentEvents.push(event);

    // Impact multiplier based on involvement
    const involvementMultiplier = isDirectlyInvolved ? 2.0 : 1.0;

    // Process different event types
    switch (event.type) {
      case 'goal_for':
        if (isDirectlyInvolved) {
          this.currentState.confidence = Math.min(100, this.currentState.confidence + 15);
          this.currentState.motivation = Math.min(100, this.currentState.motivation + 10);
          this.currentState.anxiety = Math.max(0, this.currentState.anxiety - 10);
        } else {
          this.currentState.confidence = Math.min(100, this.currentState.confidence + 5);
          this.currentState.motivation = Math.min(100, this.currentState.motivation + 5);
        }
        break;

      case 'goal_against':
        const defensiveResponsibility = isDirectlyInvolved ? 15 : 5;
        this.currentState.confidence = Math.max(0, this.currentState.confidence - defensiveResponsibility);
        this.currentState.anxiety = Math.min(100, this.currentState.anxiety + defensiveResponsibility * 0.8);

        // Determined players respond better to adversity
        const recoveryBonus = this.personality.determination * 0.1;
        this.currentState.motivation = Math.min(100, this.currentState.motivation + recoveryBonus);
        break;

      case 'penalty_miss':
        if (isDirectlyInvolved) {
          this.currentState.confidence = Math.max(0, this.currentState.confidence - 25);
          this.currentState.composure = Math.max(0, this.currentState.composure - 15);
          this.currentState.anxiety = Math.min(100, this.currentState.anxiety + 20);
        }
        break;

      case 'big_miss':
        if (isDirectlyInvolved) {
          this.currentState.confidence = Math.max(0, this.currentState.confidence - 10);
          this.currentState.focus = Math.max(0, this.currentState.focus - 5);
        }
        break;

      case 'yellow_card':
        if (isDirectlyInvolved) {
          // Can go either way depending on temperament
          if (this.personality.temperament < 50) {
            this.currentState.aggression = Math.min(100, this.currentState.aggression + 15);
            this.currentState.composure = Math.max(0, this.currentState.composure - 10);
          } else {
            // Calmer players become more cautious
            this.currentState.aggression = Math.max(0, this.currentState.aggression - 10);
            this.currentState.focus = Math.min(100, this.currentState.focus + 5);
          }
        }
        break;

      case 'red_card':
        // Whole team affected
        this.currentState.anxiety = Math.min(100, this.currentState.anxiety + 15 * involvementMultiplier);
        this.currentState.composure = Math.max(0, this.currentState.composure - 10);
        break;

      case 'var_decision':
      case 'controversial_foul':
        // Depends on personality
        if (this.personality.temperament < 60) {
          this.currentState.aggression = Math.min(100, this.currentState.aggression + 10);
          this.currentState.focus = Math.max(0, this.currentState.focus - 5);
        }
        break;

      case 'comeback':
        // Massive morale boost
        this.currentState.confidence = Math.min(100, this.currentState.confidence + 20);
        this.currentState.motivation = Math.min(100, this.currentState.motivation + 20);
        this.currentState.anxiety = Math.max(0, this.currentState.anxiety - 15);
        break;
    }

    // Apply mental fatigue from constant pressure
    this.currentState.fatigueMental = Math.min(100,
      this.currentState.fatigueMental + Math.abs(this.currentState.anxiety - 50) * 0.01
    );
  }

  applyMatchStakes(stakes: MatchStakes): void {
    // Big game players thrive, others may struggle
    const bigGameBonus = (this.personality.bigGamePlayer - 50) / 100;
    const pressureImpact = stakes.importance * (1 - this.personality.pressureThreshold / 100);

    this.currentState.anxiety = Math.min(100, this.baselineState.anxiety + pressureImpact * 0.3);
    this.currentState.confidence = Math.max(0, Math.min(100,
      this.baselineState.confidence + bigGameBonus * stakes.importance * 0.2
    ));
    this.currentState.motivation = Math.min(100,
      this.baselineState.motivation + stakes.importance * 0.2 + stakes.rivalryLevel * 0.1
    );
  }

  applyCrowdEffect(atmosphere: CrowdAtmosphere, isHomeTeam: boolean): void {
    const support = isHomeTeam ? atmosphere.homeSupport : atmosphere.awaySupport;
    const hostility = isHomeTeam ? 0 : atmosphere.hostility;

    // Home advantage / away disadvantage
    const supportBonus = (support - 50) * 0.1;
    const hostilityPenalty = hostility * (1 - this.personality.pressureThreshold / 100) * 0.15;

    this.currentState.confidence = Math.max(0, Math.min(100,
      this.currentState.confidence + supportBonus - hostilityPenalty
    ));
    this.currentState.composure = Math.max(0, Math.min(100,
      this.currentState.composure - hostilityPenalty * 0.5
    ));

    // Crowd tension affects anxiety
    this.currentState.anxiety = Math.min(100,
      this.currentState.anxiety + atmosphere.tension * 0.1
    );
  }

  updateOverTime(deltaMinutes: number): void {
    // Natural regression toward baseline
    const regressionRate = 0.02 * deltaMinutes;

    for (const key of Object.keys(this.currentState) as (keyof MentalState)[]) {
      const current = this.currentState[key];
      const baseline = this.baselineState[key];
      const diff = baseline - current;
      this.currentState[key] = current + diff * regressionRate;
    }

    // Mental fatigue accumulates slowly
    this.currentState.fatigueMental = Math.min(100,
      this.currentState.fatigueMental + 0.5 * deltaMinutes
    );
  }

  // Calculate performance modifier based on mental state
  getPerformanceModifier(): {
    technicalMod: number;
    physicalMod: number;
    decisionMod: number;
    overall: number;
  } {
    // Confidence affects technical execution
    const confidenceMod = 0.8 + (this.currentState.confidence / 100) * 0.4;

    // Composure affects decision-making under pressure
    const composureMod = 0.7 + (this.currentState.composure / 100) * 0.6;

    // Motivation affects physical output
    const motivationMod = 0.75 + (this.currentState.motivation / 100) * 0.5;

    // Anxiety negatively impacts everything
    const anxietyPenalty = 1 - (this.currentState.anxiety / 100) * 0.3;

    // Focus affects consistency
    const focusMod = 0.8 + (this.currentState.focus / 100) * 0.4;

    // Mental fatigue reduces all
    const fatiguePenalty = 1 - (this.currentState.fatigueMental / 100) * 0.2;

    // Too much aggression is bad
    const aggressionMod = this.currentState.aggression > 70
      ? 1 - (this.currentState.aggression - 70) / 100 * 0.3
      : 1;

    return {
      technicalMod: confidenceMod * focusMod * anxietyPenalty * fatiguePenalty,
      physicalMod: motivationMod * fatiguePenalty,
      decisionMod: composureMod * focusMod * anxietyPenalty * aggressionMod,
      overall: (confidenceMod + composureMod + motivationMod) / 3 * anxietyPenalty * fatiguePenalty
    };
  }

  // Check for mental breakdown (bad decision, loss of focus, etc.)
  checkForMentalBreakdown(): { occurs: boolean; type: string; severity: number } {
    const breakdownChance = (this.currentState.anxiety / 100) *
                           (1 - this.currentState.composure / 100) *
                           (this.currentState.fatigueMental / 100);

    if (Math.random() < breakdownChance * 0.1) {
      const types = [
        'poor_decision',
        'loss_of_focus',
        'overreaction',
        'gives_ball_away',
        'unnecessary_foul'
      ];

      return {
        occurs: true,
        type: types[Math.floor(Math.random() * types.length)],
        severity: Math.random() * 50 + this.currentState.anxiety * 0.5
      };
    }

    return { occurs: false, type: '', severity: 0 };
  }

  // Check for clutch performance (big moment execution)
  checkForClutchMoment(momentImportance: number): { occurs: boolean; boost: number } {
    const clutchChance = (this.personality.bigGamePlayer / 100) *
                        (this.currentState.confidence / 100) *
                        (momentImportance / 100);

    if (Math.random() < clutchChance * 0.3) {
      return {
        occurs: true,
        boost: 0.2 + (this.personality.bigGamePlayer / 100) * 0.3
      };
    }

    return { occurs: false, boost: 0 };
  }

  getCurrentState(): MentalState {
    return { ...this.currentState };
  }

  getPersonality(): PersonalityProfile {
    return { ...this.personality };
  }
}

// ============================================================================
// TEAM MORALE MANAGER
// ============================================================================

export class TeamMorale {
  private teamId: string;
  private players: Map<string, PlayerPsychology> = new Map();
  private chemistry: TeamChemistry;
  private currentMorale: number;
  private momentum: number;  // -100 to 100
  private consecutiveResults: number[];  // Last 5 results (0=loss, 1=draw, 2=win)

  constructor(teamId: string, playerPsychologies: PlayerPsychology[], chemistry: TeamChemistry) {
    this.teamId = teamId;
    for (const player of playerPsychologies) {
      this.players.set(player['playerId'], player);
    }
    this.chemistry = chemistry;
    this.currentMorale = this.calculateTeamMorale();
    this.momentum = 0;
    this.consecutiveResults = [];
  }

  private calculateTeamMorale(): number {
    let totalMorale = 0;
    let count = 0;

    this.players.forEach(player => {
      const state = player.getCurrentState();
      const playerMorale = (state.confidence + state.motivation + state.composure) / 3;
      totalMorale += playerMorale;
      count++;
    });

    const avgPlayerMorale = count > 0 ? totalMorale / count : 50;

    // Chemistry affects team morale
    const chemistryBonus = (this.chemistry.overallHarmony - 50) * 0.2 +
                          (this.chemistry.cohesion - 50) * 0.15 +
                          (this.chemistry.trust - 50) * 0.15;

    return Math.max(0, Math.min(100, avgPlayerMorale + chemistryBonus));
  }

  processTeamEvent(event: MatchEvent, involvedPlayerId?: string): void {
    // Update individual players
    this.players.forEach((player, id) => {
      const isDirectlyInvolved = id === involvedPlayerId;
      player.processEvent(event, isDirectlyInvolved);
    });

    // Update momentum
    switch (event.type) {
      case 'goal_for':
        this.momentum = Math.min(100, this.momentum + 25);
        break;
      case 'goal_against':
        this.momentum = Math.max(-100, this.momentum - 25);
        break;
      case 'red_card':
        this.momentum = Math.max(-100, this.momentum - 30);
        break;
      case 'comeback':
        this.momentum = Math.min(100, this.momentum + 40);
        break;
    }

    // Recalculate team morale
    this.currentMorale = this.calculateTeamMorale();
  }

  applyLeadershipEffect(): void {
    // Find leaders and apply their influence
    let leadershipBoost = 0;

    this.players.forEach(player => {
      const personality = player.getPersonality();
      const state = player.getCurrentState();

      if (personality.leadership > 70) {
        // Leaders can lift the team
        const leaderConfidence = state.confidence;
        const leadershipEffect = (personality.leadership / 100) * (leaderConfidence / 100) * 5;
        leadershipBoost += leadershipEffect;
      }
    });

    // Apply leadership effect to all players
    this.players.forEach(player => {
      const event: MatchEvent = {
        type: 'goal_for',  // Simulating positive effect
        minute: 0,
        impactRadius: 'team'
      };
      // Small confidence boost from leadership
      const currentState = player.getCurrentState();
      if (currentState.confidence < 80) {
        player['currentState'].confidence = Math.min(100, currentState.confidence + leadershipBoost * 0.1);
      }
    });
  }

  checkPartnershipSynergy(player1Id: string, player2Id: string): number {
    const partnership = this.chemistry.partnerships.find(
      p => (p.player1Id === player1Id && p.player2Id === player2Id) ||
           (p.player1Id === player2Id && p.player2Id === player1Id)
    );

    return partnership ? partnership.synergy : 50;
  }

  getMomentum(): number {
    return this.momentum;
  }

  updateMomentum(deltaMinutes: number): void {
    // Momentum naturally decays toward 0
    const decayRate = 0.05 * deltaMinutes;
    if (this.momentum > 0) {
      this.momentum = Math.max(0, this.momentum - this.momentum * decayRate);
    } else {
      this.momentum = Math.min(0, this.momentum - this.momentum * decayRate);
    }
  }

  getTeamPerformanceModifier(): number {
    // Combine individual modifiers with team chemistry
    let totalMod = 0;
    let count = 0;

    this.players.forEach(player => {
      totalMod += player.getPerformanceModifier().overall;
      count++;
    });

    const avgMod = count > 0 ? totalMod / count : 1;

    // Chemistry bonus
    const chemistryMod = 0.9 + (this.chemistry.cohesion / 100) * 0.2;

    // Momentum bonus
    const momentumMod = 1 + (this.momentum / 100) * 0.15;

    return avgMod * chemistryMod * momentumMod;
  }

  getCurrentMorale(): number {
    return this.currentMorale;
  }

  getChemistry(): TeamChemistry {
    return { ...this.chemistry };
  }
}

// ============================================================================
// CROWD DYNAMICS SIMULATOR
// ============================================================================

export class CrowdSimulator {
  private atmosphere: CrowdAtmosphere;
  private stadiumCapacity: number;
  private attendance: number;
  private homeTeamScore: number = 0;
  private awayTeamScore: number = 0;
  private significantEvents: MatchEvent[] = [];

  constructor(
    capacity: number,
    attendance: number,
    initialAtmosphere: Partial<CrowdAtmosphere> = {}
  ) {
    this.stadiumCapacity = capacity;
    this.attendance = attendance;

    const attendanceRatio = attendance / capacity;

    this.atmosphere = {
      volume: 50 + attendanceRatio * 30,
      hostility: 40,
      enthusiasm: 60 + attendanceRatio * 20,
      tension: 30,
      homeSupport: 70 + attendanceRatio * 15,
      awaySupport: 15 + (1 - attendanceRatio) * 10,
      ...initialAtmosphere
    };
  }

  processMatchEvent(event: MatchEvent, isHomeTeam: boolean): void {
    this.significantEvents.push(event);

    switch (event.type) {
      case 'goal_for':
        if (isHomeTeam) {
          this.homeTeamScore++;
          this.atmosphere.volume = Math.min(100, this.atmosphere.volume + 30);
          this.atmosphere.enthusiasm = Math.min(100, this.atmosphere.enthusiasm + 20);
          this.atmosphere.homeSupport = Math.min(100, this.atmosphere.homeSupport + 10);
        } else {
          this.awayTeamScore++;
          this.atmosphere.awaySupport = Math.min(100, this.atmosphere.awaySupport + 15);
          // Home crowd gets quieter
          this.atmosphere.volume = Math.max(20, this.atmosphere.volume - 15);
        }
        break;

      case 'goal_against':
        if (isHomeTeam) {
          this.atmosphere.volume = Math.max(20, this.atmosphere.volume - 15);
          this.atmosphere.tension = Math.min(100, this.atmosphere.tension + 15);
        } else {
          this.atmosphere.volume = Math.min(100, this.atmosphere.volume + 25);
          this.atmosphere.hostility = Math.min(100, this.atmosphere.hostility + 10);
        }
        break;

      case 'red_card':
        this.atmosphere.tension = Math.min(100, this.atmosphere.tension + 25);
        if (!isHomeTeam) {
          // Home crowd celebrates opposition red card
          this.atmosphere.volume = Math.min(100, this.atmosphere.volume + 20);
        }
        break;

      case 'var_decision':
      case 'controversial_foul':
        this.atmosphere.tension = Math.min(100, this.atmosphere.tension + 20);
        this.atmosphere.hostility = Math.min(100, this.atmosphere.hostility + 15);
        break;

      case 'penalty_miss':
        if (isHomeTeam) {
          // Crowd groans
          this.atmosphere.enthusiasm = Math.max(20, this.atmosphere.enthusiasm - 20);
        } else {
          // Crowd celebrates
          this.atmosphere.volume = Math.min(100, this.atmosphere.volume + 20);
        }
        break;
    }

    // Update tension based on score difference
    const scoreDiff = Math.abs(this.homeTeamScore - this.awayTeamScore);
    if (scoreDiff <= 1 && event.minute > 75) {
      this.atmosphere.tension = Math.min(100, this.atmosphere.tension + 10);
    }
  }

  updateOverTime(deltaMinutes: number, currentMinute: number): void {
    // Natural atmosphere changes
    const timeFactor = deltaMinutes * 0.1;

    // Enthusiasm naturally declines unless stimulated
    this.atmosphere.enthusiasm = Math.max(30, this.atmosphere.enthusiasm - timeFactor);

    // Volume fluctuates
    this.atmosphere.volume = Math.max(30, Math.min(90,
      this.atmosphere.volume + (Math.random() - 0.5) * 5
    ));

    // Late game tension increases
    if (currentMinute > 80) {
      const scoreDiff = Math.abs(this.homeTeamScore - this.awayTeamScore);
      if (scoreDiff <= 1) {
        this.atmosphere.tension = Math.min(100, this.atmosphere.tension + timeFactor * 2);
        this.atmosphere.volume = Math.min(100, this.atmosphere.volume + timeFactor);
      }
    }

    // Halftime reset
    if (currentMinute >= 45 && currentMinute <= 46) {
      this.atmosphere.volume = Math.max(40, this.atmosphere.volume - 20);
      this.atmosphere.tension = Math.max(20, this.atmosphere.tension - 15);
    }
  }

  triggerChant(type: 'support' | 'taunt' | 'celebration'): void {
    switch (type) {
      case 'support':
        this.atmosphere.volume = Math.min(100, this.atmosphere.volume + 15);
        this.atmosphere.homeSupport = Math.min(100, this.atmosphere.homeSupport + 10);
        break;
      case 'taunt':
        this.atmosphere.hostility = Math.min(100, this.atmosphere.hostility + 10);
        this.atmosphere.awaySupport = Math.max(0, this.atmosphere.awaySupport - 5);
        break;
      case 'celebration':
        this.atmosphere.volume = 100;
        this.atmosphere.enthusiasm = Math.min(100, this.atmosphere.enthusiasm + 25);
        break;
    }
  }

  getAtmosphere(): CrowdAtmosphere {
    return { ...this.atmosphere };
  }

  // Calculate psychological pressure on players
  calculatePressureOnPlayer(isHomeTeam: boolean): number {
    const base = this.atmosphere.tension * 0.5;
    const crowdPressure = isHomeTeam
      ? (100 - this.atmosphere.homeSupport) * 0.2
      : this.atmosphere.hostility * 0.3 + (100 - this.atmosphere.awaySupport) * 0.2;

    return Math.min(100, base + crowdPressure);
  }
}

// ============================================================================
// INTEGRATED PSYCHOLOGY ENGINE
// ============================================================================

export class PsychologyEngine {
  private homeTeamMorale: TeamMorale;
  private awayTeamMorale: TeamMorale;
  private crowd: CrowdSimulator;
  private matchStakes: MatchStakes;
  private currentMinute: number = 0;

  constructor(
    homeTeam: { id: string; players: PlayerPsychology[]; chemistry: TeamChemistry },
    awayTeam: { id: string; players: PlayerPsychology[]; chemistry: TeamChemistry },
    crowdConfig: { capacity: number; attendance: number },
    stakes: MatchStakes
  ) {
    this.homeTeamMorale = new TeamMorale(homeTeam.id, homeTeam.players, homeTeam.chemistry);
    this.awayTeamMorale = new TeamMorale(awayTeam.id, awayTeam.players, awayTeam.chemistry);
    this.crowd = new CrowdSimulator(crowdConfig.capacity, crowdConfig.attendance);
    this.matchStakes = stakes;

    // Apply initial match stakes to all players
    homeTeam.players.forEach(p => p.applyMatchStakes(stakes));
    awayTeam.players.forEach(p => p.applyMatchStakes(stakes));
  }

  processEvent(event: MatchEvent, team: 'home' | 'away', involvedPlayerId?: string): void {
    this.currentMinute = event.minute;

    // Update team morale
    if (team === 'home') {
      this.homeTeamMorale.processTeamEvent(event, involvedPlayerId);
      this.crowd.processMatchEvent(event, true);
    } else {
      this.awayTeamMorale.processTeamEvent(event, involvedPlayerId);
      this.crowd.processMatchEvent(event, false);
    }

    // Apply crowd effects
    const atmosphere = this.crowd.getAtmosphere();
    this.homeTeamMorale['players'].forEach(p => p.applyCrowdEffect(atmosphere, true));
    this.awayTeamMorale['players'].forEach(p => p.applyCrowdEffect(atmosphere, false));
  }

  update(deltaMinutes: number): void {
    this.currentMinute += deltaMinutes;

    // Update crowd
    this.crowd.updateOverTime(deltaMinutes, this.currentMinute);

    // Update momentum
    this.homeTeamMorale.updateMomentum(deltaMinutes);
    this.awayTeamMorale.updateMomentum(deltaMinutes);

    // Update player mental states
    this.homeTeamMorale['players'].forEach(p => p.updateOverTime(deltaMinutes));
    this.awayTeamMorale['players'].forEach(p => p.updateOverTime(deltaMinutes));

    // Apply leadership effects periodically
    if (Math.floor(this.currentMinute) % 15 === 0) {
      this.homeTeamMorale.applyLeadershipEffect();
      this.awayTeamMorale.applyLeadershipEffect();
    }
  }

  getMatchPsychologyState(): {
    homeMorale: number;
    awayMorale: number;
    homeMomentum: number;
    awayMomentum: number;
    crowdAtmosphere: CrowdAtmosphere;
    homePerformanceMod: number;
    awayPerformanceMod: number;
  } {
    return {
      homeMorale: this.homeTeamMorale.getCurrentMorale(),
      awayMorale: this.awayTeamMorale.getCurrentMorale(),
      homeMomentum: this.homeTeamMorale.getMomentum(),
      awayMomentum: this.awayTeamMorale.getMomentum(),
      crowdAtmosphere: this.crowd.getAtmosphere(),
      homePerformanceMod: this.homeTeamMorale.getTeamPerformanceModifier(),
      awayPerformanceMod: this.awayTeamMorale.getTeamPerformanceModifier()
    };
  }
}
