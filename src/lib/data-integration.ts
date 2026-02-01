/**
 * Premier League Data Integration Layer
 *
 * Unified interface for third-party football data providers:
 * - Opta (Stats Perform)
 * - StatsBomb
 * - Wyscout
 * - Transfermarkt
 * - Internal GPS/Wearable systems
 *
 * Provides normalized data structures for seamless integration
 * with the tactical analysis engine.
 */

// ==================== DATA PROVIDER INTERFACES ====================

export interface DataProvider {
  name: string;
  type: 'events' | 'tracking' | 'video' | 'recruitment' | 'medical';
  priority: number;
  isActive: boolean;
  lastSync: Date | null;
  errorCount: number;
}

export interface ProviderCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  baseUrl: string;
  rateLimit: number; // requests per minute
}

// ==================== OPTA/STATS PERFORM DATA MODELS ====================

export interface OptaEvent {
  id: string;
  eventId: number;
  typeId: number; // 1=pass, 13=shot, 3=tackle, etc.
  typeName: string;
  periodId: number;
  timeMin: number;
  timeSec: number;
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  outcome: 'successful' | 'unsuccessful';
  x: number; // 0-100 normalized
  y: number; // 0-100 normalized
  endX?: number;
  endY?: number;
  qualifiers: OptaQualifier[];
}

export interface OptaQualifier {
  qualifierId: number;
  value?: string | number;
}

export interface OptaMatch {
  matchId: string;
  competition: string;
  season: string;
  matchday: number;
  homeTeam: OptaTeam;
  awayTeam: OptaTeam;
  score: { home: number; away: number };
  events: OptaEvent[];
  formations: OptaFormation[];
}

export interface OptaTeam {
  teamId: number;
  name: string;
  shortName: string;
  formation: string;
  players: OptaPlayer[];
}

export interface OptaPlayer {
  playerId: number;
  name: string;
  position: string;
  shirtNumber: number;
  isStarter: boolean;
  subOn?: number;
  subOff?: number;
}

export interface OptaFormation {
  teamId: number;
  periodId: number;
  formationUsed: string;
  playerPositions: { playerId: number; position: string; slot: number }[];
}

// ==================== STATSBOMB DATA MODELS ====================

export interface StatsBombEvent {
  id: string;
  index: number;
  period: number;
  timestamp: string;
  minute: number;
  second: number;
  type: StatsBombEventType;
  possession: number;
  possession_team: { id: number; name: string };
  play_pattern: { id: number; name: string };
  team: { id: number; name: string };
  player: { id: number; name: string };
  position: { id: number; name: string };
  location: [number, number];
  duration?: number;
  under_pressure?: boolean;
  counterpress?: boolean;
  // Type-specific fields
  pass?: StatsBombPass;
  shot?: StatsBombShot;
  carry?: StatsBombCarry;
  duel?: StatsBombDuel;
}

export interface StatsBombEventType {
  id: number;
  name: string;
}

export interface StatsBombPass {
  recipient: { id: number; name: string };
  length: number;
  angle: number;
  height: { id: number; name: string };
  end_location: [number, number];
  body_part: { id: number; name: string };
  type?: { id: number; name: string };
  outcome?: { id: number; name: string };
  technique?: { id: number; name: string };
  cross?: boolean;
  switch?: boolean;
  through_ball?: boolean;
  cut_back?: boolean;
}

export interface StatsBombShot {
  statsbomb_xg: number;
  end_location: [number, number, number];
  technique: { id: number; name: string };
  body_part: { id: number; name: string };
  type: { id: number; name: string };
  outcome: { id: number; name: string };
  first_time?: boolean;
  freeze_frame?: StatsBombFreezeFrame[];
}

export interface StatsBombFreezeFrame {
  location: [number, number];
  player: { id: number; name: string };
  position: { id: number; name: string };
  teammate: boolean;
}

export interface StatsBombCarry {
  end_location: [number, number];
  under_pressure?: boolean;
}

export interface StatsBombDuel {
  type: { id: number; name: string };
  outcome: { id: number; name: string };
  counterpress?: boolean;
}

// ==================== NORMALIZED INTERNAL MODELS ====================

export interface NormalizedEvent {
  id: string;
  source: 'opta' | 'statsbomb' | 'wyscout' | 'internal';
  timestamp: Date;
  matchId: string;
  minute: number;
  second: number;
  period: 1 | 2 | 3 | 4; // 1=1H, 2=2H, 3=ET1, 4=ET2

  // Event classification
  type: NormalizedEventType;
  subType?: string;
  outcome: 'success' | 'fail' | 'neutral';

  // Spatial data (normalized to 105x68m pitch)
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;

  // Actors
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  recipientId?: string;
  recipientName?: string;

  // Metrics
  xG?: number;
  xA?: number;
  passLength?: number;
  passAngle?: number;

  // Context
  underPressure: boolean;
  counterpress: boolean;
  possession: 'home' | 'away';
  gameState: 'winning' | 'drawing' | 'losing';

  // Raw data for debugging
  rawData?: unknown;
}

export type NormalizedEventType =
  | 'pass'
  | 'shot'
  | 'dribble'
  | 'carry'
  | 'tackle'
  | 'interception'
  | 'clearance'
  | 'aerial'
  | 'foul'
  | 'ball_recovery'
  | 'dispossessed'
  | 'error'
  | 'goal_kick'
  | 'throw_in'
  | 'corner'
  | 'free_kick'
  | 'penalty'
  | 'substitution'
  | 'card'
  | 'injury'
  | 'other';

// ==================== AGGREGATED STATISTICS ====================

export interface PlayerMatchStats {
  playerId: string;
  playerName: string;
  teamId: string;
  minutesPlayed: number;

  // Passing
  passesAttempted: number;
  passesCompleted: number;
  passAccuracy: number;
  keyPasses: number;
  throughBalls: number;
  crossesAttempted: number;
  crossesCompleted: number;
  progressivePasses: number;
  passesIntoFinalThird: number;
  passesIntoPenaltyArea: number;

  // Shooting
  shots: number;
  shotsOnTarget: number;
  goals: number;
  xG: number;
  xGPerShot: number;
  npxG: number; // non-penalty xG

  // Chance creation
  assists: number;
  xA: number;
  shotCreatingActions: number;
  goalCreatingActions: number;

  // Ball carrying
  carries: number;
  carryDistance: number;
  progressiveCarries: number;
  carriesIntoFinalThird: number;
  carriesIntoPenaltyArea: number;

  // Dribbling
  dribblesAttempted: number;
  dribblesCompleted: number;
  dribbleSuccessRate: number;

  // Defending
  tackles: number;
  tacklesWon: number;
  interceptions: number;
  blocks: number;
  clearances: number;
  aerialDuelsWon: number;
  aerialDuelsLost: number;

  // Possession
  touches: number;
  touchesAttPenArea: number;
  touchesAttThird: number;
  touchesMidThird: number;
  touchesDefThird: number;

  // Pressure
  pressures: number;
  pressureSuccessRate: number;
  pressuresAttThird: number;
  pressuresMidThird: number;
  pressuresDefThird: number;

  // Errors
  dispossessed: number;
  miscontrols: number;
  errorsLeadingToShot: number;

  // Physical (from tracking)
  distanceCovered?: number;
  sprintDistance?: number;
  topSpeed?: number;
  accelerations?: number;
  decelerations?: number;
}

export interface TeamMatchStats {
  teamId: string;
  teamName: string;

  // Possession
  possession: number;
  touches: number;
  passAccuracy: number;

  // Attacking
  shots: number;
  shotsOnTarget: number;
  goals: number;
  xG: number;

  // Defending
  tackles: number;
  interceptions: number;
  fouls: number;

  // Set pieces
  corners: number;
  freeKicks: number;

  // Advanced
  ppda: number; // Passes allowed Per Defensive Action
  fieldTilt: number; // % of touches in attacking third
  highPress: number; // Pressures in opp. third
  buildUpDirectness: number; // Avg pass progression

  // Tracking
  totalDistance?: number;
  highIntensityDistance?: number;
  sprints?: number;
}

// ==================== DATA INTEGRATION SERVICE ====================

export class DataIntegrationService {
  private providers: Map<string, DataProvider> = new Map();
  private credentials: Map<string, ProviderCredentials> = new Map();
  private eventCache: Map<string, NormalizedEvent[]> = new Map();
  private syncQueue: string[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Register default providers
    this.registerProvider({
      name: 'opta',
      type: 'events',
      priority: 1,
      isActive: false,
      lastSync: null,
      errorCount: 0
    });

    this.registerProvider({
      name: 'statsbomb',
      type: 'events',
      priority: 2,
      isActive: false,
      lastSync: null,
      errorCount: 0
    });

    this.registerProvider({
      name: 'internal_tracking',
      type: 'tracking',
      priority: 1,
      isActive: true,
      lastSync: null,
      errorCount: 0
    });
  }

  registerProvider(provider: DataProvider): void {
    this.providers.set(provider.name, provider);
  }

  setCredentials(providerName: string, credentials: ProviderCredentials): void {
    this.credentials.set(providerName, credentials);
    const provider = this.providers.get(providerName);
    if (provider) {
      provider.isActive = true;
    }
  }

  // ==================== OPTA NORMALIZATION ====================

  normalizeOptaEvent(event: OptaEvent, matchId: string): NormalizedEvent {
    const eventTypeMap: Record<number, NormalizedEventType> = {
      1: 'pass',
      2: 'pass', // Offside pass
      3: 'tackle',
      4: 'aerial',
      5: 'tackle', // Foul
      6: 'other', // Out
      7: 'tackle', // Tackle
      8: 'interception',
      9: 'other', // Turnover
      10: 'other', // Save
      11: 'other', // Claim
      12: 'clearance',
      13: 'shot',
      14: 'shot', // Miss
      15: 'shot', // Post
      16: 'goal_kick',
      17: 'card',
      18: 'substitution',
    };

    return {
      id: event.id,
      source: 'opta',
      timestamp: new Date(),
      matchId,
      minute: event.timeMin,
      second: event.timeSec,
      period: event.periodId as 1 | 2 | 3 | 4,
      type: eventTypeMap[event.typeId] || 'other',
      outcome: event.outcome === 'successful' ? 'success' : 'fail',
      startX: (event.x / 100) * 105,
      startY: (event.y / 100) * 68,
      endX: event.endX ? (event.endX / 100) * 105 : undefined,
      endY: event.endY ? (event.endY / 100) * 68 : undefined,
      playerId: event.playerId.toString(),
      playerName: event.playerName,
      teamId: event.teamId.toString(),
      teamName: event.teamName,
      underPressure: false,
      counterpress: false,
      possession: 'home', // Would need match context
      gameState: 'drawing', // Would need match context
    };
  }

  // ==================== STATSBOMB NORMALIZATION ====================

  normalizeStatsBombEvent(event: StatsBombEvent, matchId: string): NormalizedEvent {
    const typeMap: Record<string, NormalizedEventType> = {
      'Pass': 'pass',
      'Shot': 'shot',
      'Dribble': 'dribble',
      'Carry': 'carry',
      'Tackle': 'tackle',
      'Interception': 'interception',
      'Clearance': 'clearance',
      'Ball Recovery': 'ball_recovery',
      'Dispossessed': 'dispossessed',
      'Error': 'error',
      'Foul Committed': 'foul',
      'Foul Won': 'foul',
    };

    const normalized: NormalizedEvent = {
      id: event.id,
      source: 'statsbomb',
      timestamp: new Date(),
      matchId,
      minute: event.minute,
      second: event.second,
      period: event.period as 1 | 2 | 3 | 4,
      type: typeMap[event.type.name] || 'other',
      outcome: this.determineStatsBombOutcome(event),
      startX: event.location[0],
      startY: event.location[1],
      playerId: event.player.id.toString(),
      playerName: event.player.name,
      teamId: event.team.id.toString(),
      teamName: event.team.name,
      underPressure: event.under_pressure || false,
      counterpress: event.counterpress || false,
      possession: 'home', // Would need match context
      gameState: 'drawing', // Would need match context
    };

    // Add pass-specific data
    if (event.pass) {
      normalized.endX = event.pass.end_location[0];
      normalized.endY = event.pass.end_location[1];
      normalized.passLength = event.pass.length;
      normalized.passAngle = event.pass.angle;
      if (event.pass.recipient) {
        normalized.recipientId = event.pass.recipient.id.toString();
        normalized.recipientName = event.pass.recipient.name;
      }
    }

    // Add shot-specific data
    if (event.shot) {
      normalized.xG = event.shot.statsbomb_xg;
      normalized.endX = event.shot.end_location[0];
      normalized.endY = event.shot.end_location[1];
    }

    // Add carry-specific data
    if (event.carry) {
      normalized.endX = event.carry.end_location[0];
      normalized.endY = event.carry.end_location[1];
    }

    return normalized;
  }

  private determineStatsBombOutcome(event: StatsBombEvent): 'success' | 'fail' | 'neutral' {
    if (event.pass?.outcome) {
      return event.pass.outcome.name === 'Incomplete' ? 'fail' : 'success';
    }
    if (event.shot?.outcome) {
      return event.shot.outcome.name === 'Goal' ? 'success' : 'fail';
    }
    if (event.duel?.outcome) {
      return event.duel.outcome.name.includes('Won') ? 'success' : 'fail';
    }
    return 'neutral';
  }

  // ==================== STATISTICS AGGREGATION ====================

  aggregatePlayerStats(events: NormalizedEvent[], playerId: string): PlayerMatchStats {
    const playerEvents = events.filter(e => e.playerId === playerId);

    const passes = playerEvents.filter(e => e.type === 'pass');
    const shots = playerEvents.filter(e => e.type === 'shot');
    const tackles = playerEvents.filter(e => e.type === 'tackle');
    const carries = playerEvents.filter(e => e.type === 'carry');
    const dribbles = playerEvents.filter(e => e.type === 'dribble');

    const successfulPasses = passes.filter(e => e.outcome === 'success');
    const goals = shots.filter(e => e.outcome === 'success');
    const shotsOnTarget = shots.filter(e => e.endX && e.endX > 100); // Simplified

    // Calculate progressive passes (>10m toward goal)
    const progressivePasses = successfulPasses.filter(e => {
      if (!e.endX || !e.startX) return false;
      return e.endX - e.startX > 10;
    });

    // Calculate passes into final third
    const passesIntoFinalThird = successfulPasses.filter(e => {
      if (!e.endX || !e.startX) return false;
      return e.startX < 70 && e.endX >= 70;
    });

    return {
      playerId,
      playerName: playerEvents[0]?.playerName || '',
      teamId: playerEvents[0]?.teamId || '',
      minutesPlayed: 90, // Would need sub data

      passesAttempted: passes.length,
      passesCompleted: successfulPasses.length,
      passAccuracy: passes.length > 0 ? (successfulPasses.length / passes.length) * 100 : 0,
      keyPasses: 0, // Would need assist chain analysis
      throughBalls: 0,
      crossesAttempted: 0,
      crossesCompleted: 0,
      progressivePasses: progressivePasses.length,
      passesIntoFinalThird: passesIntoFinalThird.length,
      passesIntoPenaltyArea: 0,

      shots: shots.length,
      shotsOnTarget: shotsOnTarget.length,
      goals: goals.length,
      xG: shots.reduce((sum, s) => sum + (s.xG || 0), 0),
      xGPerShot: shots.length > 0 ? shots.reduce((sum, s) => sum + (s.xG || 0), 0) / shots.length : 0,
      npxG: 0,

      assists: 0,
      xA: 0,
      shotCreatingActions: 0,
      goalCreatingActions: 0,

      carries: carries.length,
      carryDistance: carries.reduce((sum, c) => {
        if (!c.endX || !c.startX) return sum;
        return sum + Math.sqrt(Math.pow(c.endX - c.startX, 2) + Math.pow((c.endY || 0) - c.startY, 2));
      }, 0),
      progressiveCarries: 0,
      carriesIntoFinalThird: 0,
      carriesIntoPenaltyArea: 0,

      dribblesAttempted: dribbles.length,
      dribblesCompleted: dribbles.filter(d => d.outcome === 'success').length,
      dribbleSuccessRate: dribbles.length > 0
        ? (dribbles.filter(d => d.outcome === 'success').length / dribbles.length) * 100
        : 0,

      tackles: tackles.length,
      tacklesWon: tackles.filter(t => t.outcome === 'success').length,
      interceptions: playerEvents.filter(e => e.type === 'interception').length,
      blocks: 0,
      clearances: playerEvents.filter(e => e.type === 'clearance').length,
      aerialDuelsWon: 0,
      aerialDuelsLost: 0,

      touches: playerEvents.length,
      touchesAttPenArea: playerEvents.filter(e => e.startX > 88 && Math.abs(e.startY - 34) < 20).length,
      touchesAttThird: playerEvents.filter(e => e.startX > 70).length,
      touchesMidThird: playerEvents.filter(e => e.startX >= 35 && e.startX <= 70).length,
      touchesDefThird: playerEvents.filter(e => e.startX < 35).length,

      pressures: playerEvents.filter(e => e.underPressure).length,
      pressureSuccessRate: 0,
      pressuresAttThird: 0,
      pressuresMidThird: 0,
      pressuresDefThird: 0,

      dispossessed: playerEvents.filter(e => e.type === 'dispossessed').length,
      miscontrols: 0,
      errorsLeadingToShot: playerEvents.filter(e => e.type === 'error').length,
    };
  }

  aggregateTeamStats(events: NormalizedEvent[], teamId: string): TeamMatchStats {
    const teamEvents = events.filter(e => e.teamId === teamId);
    const totalEvents = events.length;

    const passes = teamEvents.filter(e => e.type === 'pass');
    const successfulPasses = passes.filter(e => e.outcome === 'success');
    const shots = teamEvents.filter(e => e.type === 'shot');

    // Calculate PPDA (opponent passes / defensive actions)
    const oppEvents = events.filter(e => e.teamId !== teamId);
    const oppPassesInDefHalf = oppEvents.filter(e => e.type === 'pass' && e.startX < 52.5);
    const defActions = teamEvents.filter(e =>
      e.type === 'tackle' || e.type === 'interception' || e.type === 'foul'
    );

    return {
      teamId,
      teamName: teamEvents[0]?.teamName || '',
      possession: totalEvents > 0 ? (teamEvents.length / totalEvents) * 100 : 50,
      touches: teamEvents.length,
      passAccuracy: passes.length > 0 ? (successfulPasses.length / passes.length) * 100 : 0,
      shots: shots.length,
      shotsOnTarget: shots.filter(s => s.outcome === 'success' || (s.endX && s.endX > 100)).length,
      goals: shots.filter(s => s.outcome === 'success').length,
      xG: shots.reduce((sum, s) => sum + (s.xG || 0), 0),
      tackles: teamEvents.filter(e => e.type === 'tackle').length,
      interceptions: teamEvents.filter(e => e.type === 'interception').length,
      fouls: teamEvents.filter(e => e.type === 'foul').length,
      corners: teamEvents.filter(e => e.type === 'corner').length,
      freeKicks: teamEvents.filter(e => e.type === 'free_kick').length,
      ppda: defActions.length > 0 ? oppPassesInDefHalf.length / defActions.length : 0,
      fieldTilt: teamEvents.length > 0
        ? (teamEvents.filter(e => e.startX > 70).length / teamEvents.length) * 100
        : 50,
      highPress: teamEvents.filter(e =>
        (e.type === 'tackle' || e.type === 'interception') && e.startX > 70
      ).length,
      buildUpDirectness: 0, // Would need sequence analysis
    };
  }

  // ==================== CACHING AND SYNC ====================

  cacheEvents(matchId: string, events: NormalizedEvent[]): void {
    this.eventCache.set(matchId, events);
  }

  getCachedEvents(matchId: string): NormalizedEvent[] | undefined {
    return this.eventCache.get(matchId);
  }

  getProviderStatus(): DataProvider[] {
    return Array.from(this.providers.values());
  }

  async syncProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider || !provider.isActive) {
      return false;
    }

    try {
      // Sync logic would go here
      provider.lastSync = new Date();
      provider.errorCount = 0;
      return true;
    } catch (error) {
      provider.errorCount++;
      return false;
    }
  }
}

// Singleton instance
let dataIntegrationService: DataIntegrationService | null = null;

export function getDataIntegrationService(): DataIntegrationService {
  if (!dataIntegrationService) {
    dataIntegrationService = new DataIntegrationService();
  }
  return dataIntegrationService;
}

export function resetDataIntegrationService(): void {
  dataIntegrationService = null;
}
