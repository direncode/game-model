// ═══════════════════════════════════════════════════════════════════════
// THE BIG DUNC — Demo Data Provider
// Simulates live feeds from 5 football analytics API providers and
// computes granular derived metrics from the combined data.
// ═══════════════════════════════════════════════════════════════════════

// ── API Feed Types ─────────────────────────────────────────────────────

export interface CatapultFeed {
  provider: string;
  device: string;
  frequency: string;
  status: 'connected' | 'buffering' | 'offline';
  players: CatapultPlayerData[];
  teamAggregates: {
    avgPlayerLoad: number;
    totalDistance: number;
    avgHighSpeedDist: number;
    avgSprintDist: number;
    avgMetabolicPower: number;
    avgHR: number;
    peakSpeed: number;
  };
}

export interface CatapultPlayerData {
  playerId: string;
  playerLoad: number;
  totalDistance: number;
  highSpeedDistance: number;
  sprintDistance: number;
  accelerations: number;
  decelerations: number;
  maxSpeed: number;
  metabolicPower: number;
  heartRate: number;
  heartRateMax: number;
  speedZone5Pct: number;
  speedZone6Pct: number;
}

export interface OptaFeed {
  provider: string;
  feedType: string;
  frequency: string;
  status: 'connected' | 'buffering' | 'offline';
  matchEvents: number;
  aggregates: {
    passes: number;
    passAccuracy: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    fouls: number;
    tackles: number;
    tackleSuccess: number;
    interceptions: number;
    duelsWon: number;
    duelsPct: number;
    crosses: number;
    crossAccuracy: number;
    aerialDuelsWon: number;
    aerialDuelsPct: number;
    offsides: number;
    clearances: number;
  };
  recentEvents: OptaEvent[];
}

export interface OptaEvent {
  id: string;
  minute: number;
  type: string;
  player: string;
  outcome: string;
  x: number;
  y: number;
}

export interface StatsBombFeed {
  provider: string;
  feedType: string;
  frequency: string;
  status: 'connected' | 'buffering' | 'offline';
  metrics: {
    xG: number;
    xGChain: number;
    xGBuildup: number;
    xA: number;
    xT: number;
    obv: number;
    pressures: number;
    pressureRegains: number;
    pressureRegainPct: number;
    progressivePasses: number;
    progressiveCarries: number;
    shotCreatingActions: number;
    goalCreatingActions: number;
    deepCompletions: number;
    throughBalls: number;
    switchesOfPlay: number;
    lineBreakingPasses: number;
  };
  shotMap: ShotMapEntry[];
}

export interface ShotMapEntry {
  minute: number;
  player: string;
  xG: number;
  x: number;
  y: number;
  outcome: 'goal' | 'saved' | 'blocked' | 'off_target';
  bodyPart: 'right_foot' | 'left_foot' | 'head';
}

export interface SecondSpectrumFeed {
  provider: string;
  feedType: string;
  frequency: string;
  status: 'connected' | 'buffering' | 'offline';
  spatial: {
    teamSpread: number;
    teamLength: number;
    compactness: number;
    effectivePlayingSpace: number;
    defLineHeight: number;
    defLineWidth: number;
    midLineHeight: number;
    fwdLineHeight: number;
    distanceBetweenLines: number;
    avgDefCompactness: number;
  };
  movement: {
    offBallRuns: number;
    overlapRuns: number;
    underlaps: number;
    thirdManRuns: number;
    pressureEvents: number;
    highTurnovers: number;
    lowTurnovers: number;
    counterAttacks: number;
  };
  possession: {
    avgSequenceLength: number;
    avgSequencePasses: number;
    directAttackPct: number;
    buildUpPct: number;
    sustainedPressurePct: number;
    finalThirdEntries: number;
    boxEntries: number;
  };
}

export interface SkillCornerFeed {
  provider: string;
  feedType: string;
  frequency: string;
  status: 'connected' | 'buffering' | 'offline';
  physical: {
    teamPhysicalOutput: number;
    sprintCount: number;
    highAccelCount: number;
    runningSymmetry: number;
    fatigueIndicator: number;
    recoveryRate: number;
    peakSpeedReached: number;
    topSpeedPlayers: { name: string; speed: number }[];
  };
  tactical: {
    formationStability: number;
    pressingTriggerRate: number;
    defensiveRecoveryTime: number;
    transitionSpeed: number;
    attackingWidth: number;
    defensiveWidth: number;
  };
}

// ── Combined Feed ──────────────────────────────────────────────────────

export interface APIFeedData {
  catapult: CatapultFeed;
  opta: OptaFeed;
  statsbomb: StatsBombFeed;
  secondSpectrum: SecondSpectrumFeed;
  skillcorner: SkillCornerFeed;
}

// ── Computed Metrics ───────────────────────────────────────────────────

export interface ComputedMetrics {
  ppda: { value: number; trend: 'up' | 'down' | 'stable'; sources: string[] };
  xT: { value: number; perMinute: number; sources: string[] };
  spaceControl: { value: number; attacking: number; defensive: number; sources: string[] };
  defensiveVulnerability: { value: number; zones: string[]; sources: string[] };
  coherenceScore: { value: number; breakdown: { formation: number; pressing: number; possession: number }; sources: string[] };
  counterPressEfficiency: { value: number; attempts: number; successes: number; sources: string[] };
  progressiveActionRate: { value: number; passes: number; carries: number; sources: string[] };
  teamFatigue: { value: number; projected15: number; sources: string[] };
  pressingIntensity: { value: number; ppda: number; highPress: number; sources: string[] };
  buildUpSpeed: { value: number; avgPasses: number; sources: string[] };
}

export interface GranularOutput {
  feeds: APIFeedData;
  computed: ComputedMetrics;
  lastUpdate: number;
}

// ── Helper: bounded random walk ────────────────────────────────────────

function drift(current: number, min: number, max: number, volatility: number = 0.02): number {
  const d = (Math.random() - 0.5) * 2 * volatility * (max - min);
  return Math.max(min, Math.min(max, current + d));
}

function driftInt(current: number, min: number, max: number, volatility: number = 0.03): number {
  return Math.round(drift(current, min, max, volatility));
}

function accumulate(current: number, rate: number, jitter: number = 0.2): number {
  return current + rate * (1 + (Math.random() - 0.5) * jitter);
}

// ── Names for events ───────────────────────────────────────────────────

const CITY_PLAYERS = [
  'Ederson', 'Walker', 'Dias', 'Akanji', 'Gvardiol',
  'Rodri', 'De Bruyne', 'Bernardo', 'Saka', 'Haaland', 'Foden',
  'Grealish', 'Doku', 'Kovacic', 'Stones', 'Ake',
];

const EVENT_TYPES = [
  'pass', 'pass', 'pass', 'pass',
  'shot', 'tackle', 'interception', 'cross',
  'dribble', 'clearance', 'foul', 'aerial',
];

const EVENT_OUTCOMES: Record<string, string[]> = {
  pass: ['complete', 'complete', 'complete', 'incomplete'],
  shot: ['saved', 'blocked', 'off_target', 'goal'],
  tackle: ['won', 'won', 'lost'],
  interception: ['success', 'success'],
  cross: ['complete', 'incomplete', 'blocked'],
  dribble: ['success', 'success', 'dispossessed'],
  clearance: ['success'],
  foul: ['committed'],
  aerial: ['won', 'lost'],
};

// ── Demo Data Provider Class ───────────────────────────────────────────

export class DemoDataProvider {
  private minute = 0;
  private feeds: APIFeedData;
  private computed: ComputedMetrics;

  // Accumulating state
  private totalPasses = 0;
  private passesComplete = 0;
  private totalShots = 0;
  private shotsOnTarget = 0;
  private optaEventId = 0;
  private totalXG = 0;
  private totalXT = 0;
  private totalPressures = 0;
  private pressureRegains = 0;
  private progressivePasses = 0;
  private progressiveCarries = 0;
  private scaTotal = 0;
  private shotMap: ShotMapEntry[] = [];
  private recentEvents: OptaEvent[] = [];

  constructor() {
    this.feeds = this.initFeeds();
    this.computed = this.initComputed();
  }

  private initFeeds(): APIFeedData {
    return {
      catapult: {
        provider: 'Catapult',
        device: 'Vector S7',
        frequency: '10 Hz',
        status: 'connected',
        players: CITY_PLAYERS.slice(0, 11).map((_, i) => ({
          playerId: `p${i}`,
          playerLoad: 0,
          totalDistance: 0,
          highSpeedDistance: 0,
          sprintDistance: 0,
          accelerations: 0,
          decelerations: 0,
          maxSpeed: 0,
          metabolicPower: 8 + Math.random() * 4,
          heartRate: 70 + Math.random() * 10,
          heartRateMax: 70 + Math.random() * 10,
          speedZone5Pct: 0,
          speedZone6Pct: 0,
        })),
        teamAggregates: {
          avgPlayerLoad: 0,
          totalDistance: 0,
          avgHighSpeedDist: 0,
          avgSprintDist: 0,
          avgMetabolicPower: 10.2,
          avgHR: 75,
          peakSpeed: 0,
        },
      },
      opta: {
        provider: 'Opta',
        feedType: 'F24 Event Stream',
        frequency: 'Event-driven',
        status: 'connected',
        matchEvents: 0,
        aggregates: {
          passes: 0, passAccuracy: 0, shots: 0, shotsOnTarget: 0,
          corners: 0, fouls: 0, tackles: 0, tackleSuccess: 0,
          interceptions: 0, duelsWon: 0, duelsPct: 0,
          crosses: 0, crossAccuracy: 0, aerialDuelsWon: 0, aerialDuelsPct: 0,
          offsides: 0, clearances: 0,
        },
        recentEvents: [],
      },
      statsbomb: {
        provider: 'StatsBomb',
        feedType: '360 Freeze-Frame',
        frequency: '25 Hz',
        status: 'connected',
        metrics: {
          xG: 0, xGChain: 0, xGBuildup: 0, xA: 0,
          xT: 0, obv: 0, pressures: 0, pressureRegains: 0,
          pressureRegainPct: 0, progressivePasses: 0, progressiveCarries: 0,
          shotCreatingActions: 0, goalCreatingActions: 0,
          deepCompletions: 0, throughBalls: 0,
          switchesOfPlay: 0, lineBreakingPasses: 0,
        },
        shotMap: [],
      },
      secondSpectrum: {
        provider: 'Second Spectrum',
        feedType: 'Optical Tracking',
        frequency: '25 fps',
        status: 'connected',
        spatial: {
          teamSpread: 40, teamLength: 32, compactness: 28,
          effectivePlayingSpace: 0.55, defLineHeight: 35,
          defLineWidth: 32, midLineHeight: 48,
          fwdLineHeight: 68, distanceBetweenLines: 12,
          avgDefCompactness: 14,
        },
        movement: {
          offBallRuns: 0, overlapRuns: 0, underlaps: 0,
          thirdManRuns: 0, pressureEvents: 0,
          highTurnovers: 0, lowTurnovers: 0, counterAttacks: 0,
        },
        possession: {
          avgSequenceLength: 8.2, avgSequencePasses: 4.1,
          directAttackPct: 22, buildUpPct: 48, sustainedPressurePct: 30,
          finalThirdEntries: 0, boxEntries: 0,
        },
      },
      skillcorner: {
        provider: 'SkillCorner',
        feedType: 'Broadcast Tracking',
        frequency: '10 fps',
        status: 'connected',
        physical: {
          teamPhysicalOutput: 65,
          sprintCount: 0, highAccelCount: 0,
          runningSymmetry: 0.95, fatigueIndicator: 0.05,
          recoveryRate: 0.92, peakSpeedReached: 0,
          topSpeedPlayers: [
            { name: 'Walker', speed: 0 },
            { name: 'Haaland', speed: 0 },
            { name: 'Foden', speed: 0 },
          ],
        },
        tactical: {
          formationStability: 0.88,
          pressingTriggerRate: 3.2,
          defensiveRecoveryTime: 4.8,
          transitionSpeed: 3.1,
          attackingWidth: 52, defensiveWidth: 34,
        },
      },
    };
  }

  private initComputed(): ComputedMetrics {
    return {
      ppda: { value: 0, trend: 'stable', sources: ['Opta F24', 'StatsBomb 360'] },
      xT: { value: 0, perMinute: 0, sources: ['StatsBomb 360'] },
      spaceControl: { value: 55, attacking: 58, defensive: 52, sources: ['Second Spectrum', 'SkillCorner'] },
      defensiveVulnerability: { value: 0.18, zones: [], sources: ['Second Spectrum', 'Catapult S7', 'StatsBomb 360'] },
      coherenceScore: { value: 75, breakdown: { formation: 80, pressing: 72, possession: 73 }, sources: ['All Feeds'] },
      counterPressEfficiency: { value: 0, attempts: 0, successes: 0, sources: ['Opta F24', 'StatsBomb 360'] },
      progressiveActionRate: { value: 0, passes: 0, carries: 0, sources: ['StatsBomb 360', 'Opta F24'] },
      teamFatigue: { value: 5, projected15: 8, sources: ['Catapult S7', 'SkillCorner'] },
      pressingIntensity: { value: 68, ppda: 0, highPress: 0, sources: ['Opta F24', 'Second Spectrum'] },
      buildUpSpeed: { value: 8.2, avgPasses: 4.1, sources: ['Second Spectrum', 'Opta F24'] },
    };
  }

  /** Call on each simulation tick to advance all feeds */
  tick(gameMinute: number): GranularOutput {
    this.minute = gameMinute;
    if (gameMinute <= 0) return { feeds: this.feeds, computed: this.computed, lastUpdate: Date.now() };

    this.tickCatapult(gameMinute);
    this.tickOpta(gameMinute);
    this.tickStatsBomb(gameMinute);
    this.tickSecondSpectrum(gameMinute);
    this.tickSkillCorner(gameMinute);
    this.computeMetrics(gameMinute);

    return { feeds: this.feeds, computed: this.computed, lastUpdate: Date.now() };
  }

  // ── Catapult tick ────────────────────────────────────────────────────

  private tickCatapult(minute: number) {
    const cat = this.feeds.catapult;
    const fatigueFactor = 1 - minute / 200; // gradual performance decline

    cat.players.forEach((p) => {
      p.totalDistance = accumulate(p.totalDistance, 90 + Math.random() * 30);
      p.highSpeedDistance = accumulate(p.highSpeedDistance, 5 + Math.random() * 4);
      p.sprintDistance = accumulate(p.sprintDistance, 1.5 + Math.random() * 2);
      p.playerLoad = accumulate(p.playerLoad, 3.5 + Math.random() * 1.5);
      p.accelerations = Math.round(accumulate(p.accelerations, 0.4 + Math.random() * 0.3));
      p.decelerations = Math.round(accumulate(p.decelerations, 0.35 + Math.random() * 0.25));
      p.maxSpeed = Math.max(p.maxSpeed, 28 + Math.random() * 8);
      p.metabolicPower = drift(p.metabolicPower, 6, 18, 0.05);
      p.heartRate = drift(p.heartRate, 120 + minute * 0.2, 185, 0.04);
      p.heartRateMax = Math.max(p.heartRateMax, p.heartRate);
      p.speedZone5Pct = drift(p.speedZone5Pct, 2, 12, 0.02);
      p.speedZone6Pct = drift(p.speedZone6Pct, 0.5, 5, 0.01);
    });

    const players = cat.players;
    cat.teamAggregates = {
      avgPlayerLoad: players.reduce((s, p) => s + p.playerLoad, 0) / players.length,
      totalDistance: players.reduce((s, p) => s + p.totalDistance, 0),
      avgHighSpeedDist: players.reduce((s, p) => s + p.highSpeedDistance, 0) / players.length,
      avgSprintDist: players.reduce((s, p) => s + p.sprintDistance, 0) / players.length,
      avgMetabolicPower: players.reduce((s, p) => s + p.metabolicPower, 0) / players.length * fatigueFactor,
      avgHR: players.reduce((s, p) => s + p.heartRate, 0) / players.length,
      peakSpeed: Math.max(...players.map((p) => p.maxSpeed)),
    };
  }

  // ── Opta tick ────────────────────────────────────────────────────────

  private tickOpta(minute: number) {
    const opta = this.feeds.opta;

    // Generate 0-3 events per tick (roughly 6-18 events per game minute)
    const eventsThisTick = Math.floor(Math.random() * 3);
    for (let i = 0; i < eventsThisTick; i++) {
      const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
      const outcomes = EVENT_OUTCOMES[type] || ['success'];
      const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
      const player = CITY_PLAYERS[Math.floor(Math.random() * 11)];

      this.optaEventId++;
      const event: OptaEvent = {
        id: `evt-${this.optaEventId}`,
        minute: Math.floor(minute),
        type,
        player,
        outcome,
        x: 10 + Math.random() * 80,
        y: 5 + Math.random() * 90,
      };
      this.recentEvents.unshift(event);
      if (this.recentEvents.length > 10) this.recentEvents.pop();

      // Accumulate aggregates
      if (type === 'pass') {
        this.totalPasses++;
        if (outcome === 'complete') this.passesComplete++;
      }
      if (type === 'shot') {
        this.totalShots++;
        if (outcome === 'saved' || outcome === 'goal') this.shotsOnTarget++;
      }
    }

    opta.matchEvents = this.optaEventId;
    opta.recentEvents = this.recentEvents;
    opta.aggregates.passes = this.totalPasses;
    opta.aggregates.passAccuracy = this.totalPasses > 0
      ? Math.round((this.passesComplete / this.totalPasses) * 1000) / 10
      : 0;
    opta.aggregates.shots = this.totalShots;
    opta.aggregates.shotsOnTarget = this.shotsOnTarget;
    opta.aggregates.corners = driftInt(opta.aggregates.corners, opta.aggregates.corners, opta.aggregates.corners + 1, 0.005);
    opta.aggregates.fouls = driftInt(opta.aggregates.fouls, opta.aggregates.fouls, opta.aggregates.fouls + 1, 0.008);
    opta.aggregates.tackles = Math.round(minute * 0.25 + Math.random() * 3);
    opta.aggregates.tackleSuccess = drift(65, 55, 85, 0.01);
    opta.aggregates.interceptions = Math.round(minute * 0.18 + Math.random() * 2);
    opta.aggregates.duelsWon = Math.round(minute * 0.4 + Math.random() * 4);
    opta.aggregates.duelsPct = drift(52, 42, 62, 0.02);
    opta.aggregates.crosses = Math.round(minute * 0.12 + Math.random() * 2);
    opta.aggregates.crossAccuracy = drift(28, 18, 40, 0.02);
    opta.aggregates.aerialDuelsWon = Math.round(minute * 0.1 + Math.random() * 2);
    opta.aggregates.aerialDuelsPct = drift(48, 38, 62, 0.02);
    opta.aggregates.offsides = driftInt(0, 0, Math.floor(minute / 15) + 1, 0.01);
    opta.aggregates.clearances = Math.round(minute * 0.15 + Math.random() * 2);
  }

  // ── StatsBomb tick ───────────────────────────────────────────────────

  private tickStatsBomb(minute: number) {
    const sb = this.feeds.statsbomb;

    // xG accumulates slowly with occasional spikes (shots)
    if (Math.random() < 0.02) {
      const shotXG = Math.random() * 0.4;
      this.totalXG += shotXG;
      const player = CITY_PLAYERS[Math.floor(Math.random() * 5) + 6];
      this.shotMap.push({
        minute: Math.floor(minute),
        player,
        xG: shotXG,
        x: 75 + Math.random() * 25,
        y: 20 + Math.random() * 60,
        outcome: Math.random() < 0.1 ? 'goal' : Math.random() < 0.3 ? 'saved' : Math.random() < 0.6 ? 'blocked' : 'off_target',
        bodyPart: Math.random() < 0.6 ? 'right_foot' : Math.random() < 0.8 ? 'left_foot' : 'head',
      });
    }

    this.totalXT = accumulate(this.totalXT, 0.12 + Math.random() * 0.08);
    this.totalPressures = Math.round(minute * 1.5 + Math.random() * 4);
    this.pressureRegains = Math.round(this.totalPressures * (0.2 + Math.random() * 0.15));
    this.progressivePasses = Math.round(minute * 0.45 + Math.random() * 3);
    this.progressiveCarries = Math.round(minute * 0.3 + Math.random() * 2);
    this.scaTotal = Math.round(minute * 0.13 + Math.random() * 2);

    sb.metrics.xG = Math.round(this.totalXG * 100) / 100;
    sb.metrics.xGChain = Math.round(this.totalXG * 1.4 * 100) / 100;
    sb.metrics.xGBuildup = Math.round(this.totalXG * 1.2 * 100) / 100;
    sb.metrics.xA = Math.round(this.totalXG * 0.6 * 100) / 100;
    sb.metrics.xT = Math.round(this.totalXT * 100) / 100;
    sb.metrics.obv = Math.round((this.totalXT * 0.8 + this.totalXG * 0.5) * 100) / 100;
    sb.metrics.pressures = this.totalPressures;
    sb.metrics.pressureRegains = this.pressureRegains;
    sb.metrics.pressureRegainPct = this.totalPressures > 0
      ? Math.round((this.pressureRegains / this.totalPressures) * 1000) / 10
      : 0;
    sb.metrics.progressivePasses = this.progressivePasses;
    sb.metrics.progressiveCarries = this.progressiveCarries;
    sb.metrics.shotCreatingActions = this.scaTotal;
    sb.metrics.goalCreatingActions = Math.round(this.scaTotal * 0.25);
    sb.metrics.deepCompletions = Math.round(minute * 0.08 + Math.random());
    sb.metrics.throughBalls = Math.round(minute * 0.04 + Math.random());
    sb.metrics.switchesOfPlay = Math.round(minute * 0.1 + Math.random());
    sb.metrics.lineBreakingPasses = Math.round(minute * 0.22 + Math.random() * 2);
    sb.shotMap = this.shotMap.slice(-10);
  }

  // ── Second Spectrum tick ─────────────────────────────────────────────

  private tickSecondSpectrum(minute: number) {
    const ss = this.feeds.secondSpectrum;
    const fatigue = Math.min(minute / 90, 1);

    ss.spatial.teamSpread = drift(ss.spatial.teamSpread, 34, 52, 0.03);
    ss.spatial.teamLength = drift(ss.spatial.teamLength, 26, 42, 0.03);
    ss.spatial.compactness = drift(ss.spatial.compactness, 20 + fatigue * 8, 38 + fatigue * 6, 0.03);
    ss.spatial.effectivePlayingSpace = drift(ss.spatial.effectivePlayingSpace, 0.42, 0.72, 0.02);
    ss.spatial.defLineHeight = drift(ss.spatial.defLineHeight, 28 - fatigue * 6, 45 - fatigue * 4, 0.04);
    ss.spatial.defLineWidth = drift(ss.spatial.defLineWidth, 26, 40, 0.02);
    ss.spatial.midLineHeight = drift(ss.spatial.midLineHeight, 40, 58, 0.04);
    ss.spatial.fwdLineHeight = drift(ss.spatial.fwdLineHeight, 58, 78, 0.03);
    ss.spatial.distanceBetweenLines = drift(ss.spatial.distanceBetweenLines, 8, 18, 0.03);
    ss.spatial.avgDefCompactness = drift(ss.spatial.avgDefCompactness, 10, 22, 0.02);

    ss.movement.offBallRuns = Math.round(accumulate(ss.movement.offBallRuns, 2.2 + Math.random()));
    ss.movement.overlapRuns = Math.round(accumulate(ss.movement.overlapRuns, 0.12 + Math.random() * 0.1));
    ss.movement.underlaps = Math.round(accumulate(ss.movement.underlaps, 0.08 + Math.random() * 0.06));
    ss.movement.thirdManRuns = Math.round(accumulate(ss.movement.thirdManRuns, 0.15 + Math.random() * 0.1));
    ss.movement.pressureEvents = Math.round(minute * 0.7 + Math.random() * 3);
    ss.movement.highTurnovers = driftInt(ss.movement.highTurnovers, ss.movement.highTurnovers, ss.movement.highTurnovers + 1, 0.008);
    ss.movement.lowTurnovers = driftInt(ss.movement.lowTurnovers, ss.movement.lowTurnovers, ss.movement.lowTurnovers + 1, 0.01);
    ss.movement.counterAttacks = driftInt(ss.movement.counterAttacks, ss.movement.counterAttacks, ss.movement.counterAttacks + 1, 0.005);

    ss.possession.avgSequenceLength = drift(ss.possession.avgSequenceLength, 5, 14, 0.03);
    ss.possession.avgSequencePasses = drift(ss.possession.avgSequencePasses, 2, 8, 0.03);
    ss.possession.directAttackPct = drift(ss.possession.directAttackPct, 15, 35, 0.02);
    ss.possession.buildUpPct = drift(ss.possession.buildUpPct, 35, 60, 0.02);
    ss.possession.sustainedPressurePct = 100 - ss.possession.directAttackPct - ss.possession.buildUpPct;
    ss.possession.finalThirdEntries = Math.round(minute * 0.35 + Math.random() * 3);
    ss.possession.boxEntries = Math.round(minute * 0.12 + Math.random() * 2);
  }

  // ── SkillCorner tick ─────────────────────────────────────────────────

  private tickSkillCorner(minute: number) {
    const sk = this.feeds.skillcorner;
    const fatigue = Math.min(minute / 90, 1);

    sk.physical.teamPhysicalOutput = drift(sk.physical.teamPhysicalOutput, 45 - fatigue * 15, 85 - fatigue * 10, 0.03);
    sk.physical.sprintCount = Math.round(minute * 0.7 + Math.random() * 3);
    sk.physical.highAccelCount = Math.round(minute * 0.5 + Math.random() * 2);
    sk.physical.runningSymmetry = drift(sk.physical.runningSymmetry, 0.82, 0.98, 0.01);
    sk.physical.fatigueIndicator = drift(fatigue * 0.6, 0, 0.8, 0.02);
    sk.physical.recoveryRate = drift(0.95 - fatigue * 0.3, 0.5, 1, 0.02);
    sk.physical.peakSpeedReached = Math.max(sk.physical.peakSpeedReached, 30 + Math.random() * 6);

    sk.physical.topSpeedPlayers[0].speed = Math.max(sk.physical.topSpeedPlayers[0].speed, 33 + Math.random() * 3.5);
    sk.physical.topSpeedPlayers[1].speed = Math.max(sk.physical.topSpeedPlayers[1].speed, 32 + Math.random() * 3);
    sk.physical.topSpeedPlayers[2].speed = Math.max(sk.physical.topSpeedPlayers[2].speed, 31 + Math.random() * 3);

    sk.tactical.formationStability = drift(sk.tactical.formationStability, 0.68 - fatigue * 0.15, 0.95 - fatigue * 0.1, 0.02);
    sk.tactical.pressingTriggerRate = drift(sk.tactical.pressingTriggerRate, 2 - fatigue, 5 - fatigue * 2, 0.03);
    sk.tactical.defensiveRecoveryTime = drift(sk.tactical.defensiveRecoveryTime, 3 + fatigue * 2, 7 + fatigue * 3, 0.03);
    sk.tactical.transitionSpeed = drift(sk.tactical.transitionSpeed, 2 + fatigue, 5, 0.03);
    sk.tactical.attackingWidth = drift(sk.tactical.attackingWidth, 42, 62, 0.02);
    sk.tactical.defensiveWidth = drift(sk.tactical.defensiveWidth, 26, 42, 0.02);
  }

  // ── Granular computation from combined feeds ─────────────────────────

  private computeMetrics(minute: number) {
    const { opta, statsbomb: sb, secondSpectrum: ss, catapult: cat, skillcorner: sk } = this.feeds;
    const fatigue = Math.min(minute / 90, 1);

    // PPDA — Passes allowed per defensive action (lower = more intense pressing)
    const defActions = opta.aggregates.tackles + opta.aggregates.interceptions + opta.aggregates.fouls;
    const oppPassesEst = Math.round(this.totalPasses * 0.85); // estimate opponent passes
    const ppda = defActions > 0 ? Math.round((oppPassesEst / defActions) * 10) / 10 : 0;
    const prevPPDA = this.computed.ppda.value;
    this.computed.ppda = {
      value: ppda,
      trend: ppda < prevPPDA - 0.5 ? 'down' : ppda > prevPPDA + 0.5 ? 'up' : 'stable',
      sources: ['Opta F24', 'StatsBomb 360'],
    };

    // xT — Expected Threat per minute
    this.computed.xT = {
      value: sb.metrics.xT,
      perMinute: minute > 0 ? Math.round((sb.metrics.xT / minute) * 100) / 100 : 0,
      sources: ['StatsBomb 360'],
    };

    // Space control — derived from Second Spectrum spatial data
    const eps = ss.spatial.effectivePlayingSpace;
    this.computed.spaceControl = {
      value: Math.round(eps * 100),
      attacking: Math.round(eps * 100 + drift(3, -5, 8, 0.3)),
      defensive: Math.round(eps * 100 - drift(3, -5, 8, 0.3)),
      sources: ['Second Spectrum', 'SkillCorner'],
    };

    // Defensive vulnerability — multi-source
    const compactnessRisk = Math.max(0, (ss.spatial.compactness - 25) / 30);
    const fatigueRisk = fatigue * 0.4;
    const lineGapRisk = Math.max(0, (ss.spatial.distanceBetweenLines - 12) / 15);
    const vulnScore = Math.min(1, (compactnessRisk + fatigueRisk + lineGapRisk) / 3);
    const vulnZones: string[] = [];
    if (compactnessRisk > 0.4) vulnZones.push('wide channels');
    if (lineGapRisk > 0.3) vulnZones.push('between lines');
    if (fatigueRisk > 0.3) vulnZones.push('transition defense');
    this.computed.defensiveVulnerability = {
      value: Math.round(vulnScore * 100) / 100,
      zones: vulnZones,
      sources: ['Second Spectrum', 'Catapult S7', 'StatsBomb 360'],
    };

    // Coherence score — weighted multi-feed
    const formationCoh = sk.tactical.formationStability * 100;
    const pressingCoh = sb.metrics.pressureRegainPct > 0
      ? Math.min(100, sb.metrics.pressureRegainPct * 3)
      : 65;
    const possessionCoh = Math.min(100, opta.aggregates.passAccuracy * 1.1);
    this.computed.coherenceScore = {
      value: Math.round(formationCoh * 0.4 + pressingCoh * 0.3 + possessionCoh * 0.3),
      breakdown: {
        formation: Math.round(formationCoh),
        pressing: Math.round(pressingCoh),
        possession: Math.round(possessionCoh),
      },
      sources: ['All Feeds'],
    };

    // Counter-press efficiency
    const cpAttempts = Math.round(sb.metrics.pressures * 0.35);
    const cpSuccesses = Math.round(cpAttempts * (0.25 + Math.random() * 0.15));
    this.computed.counterPressEfficiency = {
      value: cpAttempts > 0 ? Math.round((cpSuccesses / cpAttempts) * 100) : 0,
      attempts: cpAttempts,
      successes: cpSuccesses,
      sources: ['Opta F24', 'StatsBomb 360'],
    };

    // Progressive action rate
    this.computed.progressiveActionRate = {
      value: minute > 0
        ? Math.round(((sb.metrics.progressivePasses + sb.metrics.progressiveCarries) / minute) * 100) / 100
        : 0,
      passes: sb.metrics.progressivePasses,
      carries: sb.metrics.progressiveCarries,
      sources: ['StatsBomb 360', 'Opta F24'],
    };

    // Team fatigue — Catapult + SkillCorner
    const avgPL = cat.teamAggregates.avgPlayerLoad;
    const fatigueIdx = sk.physical.fatigueIndicator;
    const teamFat = Math.round(((avgPL / (minute * 4 || 1)) * 30 + fatigueIdx * 70) * 10) / 10;
    this.computed.teamFatigue = {
      value: Math.min(100, Math.max(0, teamFat)),
      projected15: Math.min(100, Math.round(teamFat * 1.25)),
      sources: ['Catapult S7', 'SkillCorner'],
    };

    // Pressing intensity
    this.computed.pressingIntensity = {
      value: Math.round(
        (sk.tactical.pressingTriggerRate / 5) * 40 +
        (1 - Math.min(ppda, 15) / 15) * 40 +
        (sb.metrics.pressureRegainPct / 50) * 20,
      ),
      ppda,
      highPress: sk.tactical.pressingTriggerRate,
      sources: ['Opta F24', 'Second Spectrum'],
    };

    // Build-up speed
    this.computed.buildUpSpeed = {
      value: Math.round(ss.possession.avgSequenceLength * 10) / 10,
      avgPasses: Math.round(ss.possession.avgSequencePasses * 10) / 10,
      sources: ['Second Spectrum', 'Opta F24'],
    };
  }

  /** Reset all state (for new match) */
  reset(): void {
    this.minute = 0;
    this.totalPasses = 0;
    this.passesComplete = 0;
    this.totalShots = 0;
    this.shotsOnTarget = 0;
    this.optaEventId = 0;
    this.totalXG = 0;
    this.totalXT = 0;
    this.totalPressures = 0;
    this.pressureRegains = 0;
    this.progressivePasses = 0;
    this.progressiveCarries = 0;
    this.scaTotal = 0;
    this.shotMap = [];
    this.recentEvents = [];
    this.feeds = this.initFeeds();
    this.computed = this.initComputed();
  }
}
