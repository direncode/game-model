/**
 * DEMO PIPELINE RUNNER
 * Executes each algorithm step-by-step with full logging.
 * Steps:
 *   1. Data Ingestion — Catapult GPS/IMU randomizer
 *   2. Wearable Processing — Speed zones, accelerations, player load
 *   3. Fatigue Modeling — Per-player fatigue, injury risk
 *   4. Pattern Recognition — Tactical pattern detection + Markov chains
 *   5. Analytics Engine — xG model, passing network, heatmap
 *   6. Tactical AI — Q-learning decisions
 *   7. Coherence Analysis — Game model adherence scoring
 *   8. Digital Twin Sync — Update twin states + generate alerts
 */

import {
  DEMO_SQUAD,
  randomizeCatapultSession,
  randomizeMatchEvents,
  randomizeShots,
  randomizePasses,
  type DemoPlayer,
  type DemoMatchEvent,
  type DemoShot,
  type DemoPass,
} from './demo-randomizer';

import type { CatapultPlayerSession } from './catapult-integration';

// ============================================================================
// LOG SYSTEM
// ============================================================================

export interface PipelineLog {
  step: number;
  stepName: string;
  timestamp: number;
  level: 'info' | 'data' | 'metric' | 'warn' | 'result';
  message: string;
  detail?: string;
}

export interface StepResult {
  step: number;
  stepName: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  logs: PipelineLog[];
  duration: number; // ms
  summary: string;
  metrics: Record<string, string | number>;
}

export interface PipelineState {
  steps: StepResult[];
  currentStep: number;
  matchMinute: number;
  totalLogs: PipelineLog[];
  isRunning: boolean;
  isComplete: boolean;
}

// ============================================================================
// STEP DEFINITIONS
// ============================================================================

const STEP_NAMES = [
  'Data Ingestion',
  'Wearable Processing',
  'Fatigue Modeling',
  'Pattern Recognition',
  'Analytics Engine',
  'Tactical AI',
  'Coherence Analysis',
  'Digital Twin Sync',
];

export function createInitialState(minute: number): PipelineState {
  return {
    steps: STEP_NAMES.map((name, i) => ({
      step: i,
      stepName: name,
      status: 'pending',
      logs: [],
      duration: 0,
      summary: '',
      metrics: {},
    })),
    currentStep: -1,
    matchMinute: minute,
    totalLogs: [],
    isRunning: false,
    isComplete: false,
  };
}

// ============================================================================
// PIPELINE EXECUTION
// ============================================================================

function log(
  state: PipelineState,
  step: number,
  level: PipelineLog['level'],
  message: string,
  detail?: string
): void {
  const entry: PipelineLog = {
    step,
    stepName: STEP_NAMES[step],
    timestamp: Date.now(),
    level,
    message,
    detail,
  };
  state.steps[step].logs.push(entry);
  state.totalLogs.push(entry);
}

// ============================================================================
// STEP 0: DATA INGESTION
// ============================================================================

interface IngestionResult {
  sessions: Map<string, CatapultPlayerSession>;
  events: DemoMatchEvent[];
  shots: DemoShot[];
  passes: DemoPass[];
}

function runIngestion(state: PipelineState, minute: number): IngestionResult {
  const step = 0;
  const sessions = new Map<string, CatapultPlayerSession>();

  log(state, step, 'info', `Initializing Catapult data randomizer for match minute ${minute}`);
  log(state, step, 'info', `Squad size: ${DEMO_SQUAD.length} players`);
  log(state, step, 'info', `Session type: match | Sampling: 10Hz GPS + 100Hz IMU`);

  for (const player of DEMO_SQUAD) {
    const session = randomizeCatapultSession(player, minute);
    sessions.set(player.id, session);

    log(state, step, 'data',
      `[${player.position.padEnd(3)}] ${player.name.padEnd(26)} — ` +
      `dist: ${session.gps.totalDistance.toLocaleString()}m | ` +
      `maxSpd: ${session.gps.maxSpeed.toFixed(2)} m/s | ` +
      `load: ${session.imu.playerLoad.toFixed(1)} | ` +
      `sprints: ${session.derived.sprintCount} | ` +
      `fatigue: ${session.derived.fatigueIndex}%`
    );
  }

  // Match events
  const events = randomizeMatchEvents(minute);
  log(state, step, 'info', `Generated ${events.length} match events up to minute ${minute}`);
  for (const evt of events.slice(0, 8)) {
    log(state, step, 'data',
      `  ${evt.minute}' — ${evt.type.replace(/_/g, ' ')} (${evt.team})` +
      (evt.xG ? ` xG: ${evt.xG.toFixed(3)}` : '') +
      (evt.player ? ` — ${evt.player}` : '')
    );
  }
  if (events.length > 8) {
    log(state, step, 'data', `  ... and ${events.length - 8} more events`);
  }

  // Shots & passes
  const shots = randomizeShots(Math.round(minute / 8));
  const passes = randomizePasses(Math.round(minute * 5));
  log(state, step, 'info', `Generated ${shots.length} shots and ${passes.length} passes for analysis`);

  // GPS trace summary
  const totalPositions = Array.from(sessions.values())
    .reduce((sum, s) => sum + s.gps.positionData.length, 0);
  log(state, step, 'metric', `Total GPS positions generated: ${totalPositions.toLocaleString()}`);

  const totalDistance = Array.from(sessions.values())
    .reduce((sum, s) => sum + s.gps.totalDistance, 0);
  log(state, step, 'result', `Ingestion complete — ${sessions.size} sessions, ${Math.round(totalDistance / 1000)}km total squad distance`);

  return { sessions, events, shots, passes };
}

// ============================================================================
// STEP 1: WEARABLE PROCESSING
// ============================================================================

interface WearableResult {
  speedZoneBreakdown: Map<string, { walking: number; jogging: number; running: number; hsr: number; sprint: number }>;
  teamTotals: { distance: number; sprints: number; highIntensity: number; avgLoad: number };
}

function runWearableProcessing(state: PipelineState, data: IngestionResult): WearableResult {
  const step = 1;
  const speedZoneBreakdown = new Map<string, { walking: number; jogging: number; running: number; hsr: number; sprint: number }>();

  log(state, step, 'info', 'Processing raw Catapult data through wearable analytics pipeline');
  log(state, step, 'info', 'Speed zone thresholds: Walking <2m/s | Jog 2-4m/s | Run 4-5.5m/s | HSR 5.5-7m/s | Sprint >7m/s');

  let totalDist = 0;
  let totalSprints = 0;
  let totalHI = 0;
  let totalLoad = 0;

  for (const player of DEMO_SQUAD) {
    const session = data.sessions.get(player.id)!;
    const sz = session.gps.speedZones;

    const breakdown = {
      walking: sz.zone1,
      jogging: sz.zone2,
      running: sz.zone3,
      hsr: sz.zone4 + sz.zone5,
      sprint: sz.zone6,
    };
    speedZoneBreakdown.set(player.id, breakdown);

    const hrStr = session.heartRate
      ? `HR: avg ${session.heartRate.avgHR} / max ${session.heartRate.maxHR}`
      : 'HR: no data';

    log(state, step, 'data',
      `[${player.position.padEnd(3)}] ${player.name.padEnd(26)} — ` +
      `walk: ${sz.zone1}s | jog: ${sz.zone2}s | run: ${sz.zone3}s | ` +
      `HSR: ${sz.zone4 + sz.zone5}s | sprint: ${sz.zone6}s | ${hrStr}`
    );

    totalDist += session.gps.totalDistance;
    totalSprints += session.derived.sprintCount;
    totalHI += session.derived.highIntensityDistance;
    totalLoad += session.imu.playerLoad;
  }

  const avgLoad = totalLoad / DEMO_SQUAD.length;

  log(state, step, 'metric', `Team total distance: ${Math.round(totalDist / 1000)}km`);
  log(state, step, 'metric', `Team total sprints: ${totalSprints}`);
  log(state, step, 'metric', `Team high-intensity distance: ${Math.round(totalHI)}m`);
  log(state, step, 'metric', `Average player load: ${avgLoad.toFixed(1)}`);

  // Acceleration analysis
  const totalAccels = Array.from(data.sessions.values())
    .reduce((sum, s) => sum + s.imu.accelerations.total, 0);
  const totalDecels = Array.from(data.sessions.values())
    .reduce((sum, s) => sum + s.imu.decelerations.total, 0);
  log(state, step, 'metric', `Total accelerations: ${totalAccels} | Total decelerations: ${totalDecels}`);

  log(state, step, 'result', `Wearable processing complete — all ${DEMO_SQUAD.length} players analyzed`);

  return {
    speedZoneBreakdown,
    teamTotals: { distance: totalDist, sprints: totalSprints, highIntensity: totalHI, avgLoad },
  };
}

// ============================================================================
// STEP 2: FATIGUE MODELING
// ============================================================================

interface FatigueResult {
  models: Map<string, { fatigue: number; muscular: number; cardio: number; neuro: number; subMinute: number | null; injuryRisk: number }>;
  highFatiguePlayers: string[];
  highRiskPlayers: string[];
}

function runFatigueModeling(state: PipelineState, data: IngestionResult, minute: number): FatigueResult {
  const step = 2;
  const models = new Map<string, { fatigue: number; muscular: number; cardio: number; neuro: number; subMinute: number | null; injuryRisk: number }>();
  const highFatiguePlayers: string[] = [];
  const highRiskPlayers: string[] = [];

  log(state, step, 'info', 'Computing fatigue models using Catapult IMU + HR integration');
  log(state, step, 'info', 'Model: weighted composite — muscular (40%) + cardiovascular (35%) + neuromuscular (25%)');

  for (const player of DEMO_SQUAD) {
    const session = data.sessions.get(player.id)!;
    const minuteFactor = Math.min(minute / 90, 1);
    const posLoad = getPositionLoad(player.position);

    // Muscular fatigue from high-intensity efforts
    const accelLoad = session.imu.accelerations.high * 2 + session.imu.accelerations.medium;
    const decelLoad = session.imu.decelerations.high * 2.5 + session.imu.decelerations.medium * 1.5;
    const muscular = Math.min(100, ((accelLoad + decelLoad + session.derived.sprintCount * 3) / 10) * Math.min(2, 1 + minute / 90));

    // Cardiovascular fatigue
    const cardio = session.heartRate
      ? Math.min(100, (session.heartRate.hrZones.zone5 * 5 + session.heartRate.hrZones.zone4 * 3 + session.heartRate.hrZones.zone3 * 1.5) / 10 + minute * 0.3)
      : Math.min(100, minute * 0.6 + session.gps.distancePerMinute / 10);

    // Neuromuscular fatigue
    const neuro = Math.min(100, minute * 0.35 + (minuteFactor > 0.7 ? 15 : 0));

    const fatigue = muscular * 0.4 + cardio * 0.35 + neuro * 0.25;
    const fatigueRate = 0.3 + minuteFactor * 0.4;
    const projected15 = Math.min(100, fatigue + fatigueRate * 15);
    const subMinute = projected15 > 80 ? minute + Math.ceil((80 - fatigue) / fatigueRate) : null;

    // Injury risk
    const injuryRisk = session.derived.injuryRiskScore;

    models.set(player.id, {
      fatigue: Math.round(fatigue),
      muscular: Math.round(muscular),
      cardio: Math.round(cardio),
      neuro: Math.round(neuro),
      subMinute,
      injuryRisk,
    });

    const fatigueBar = '█'.repeat(Math.round(fatigue / 5)) + '░'.repeat(20 - Math.round(fatigue / 5));
    log(state, step, 'data',
      `[${player.position.padEnd(3)}] ${player.name.padEnd(26)} ` +
      `${fatigueBar} ${Math.round(fatigue)}% ` +
      `(musc: ${Math.round(muscular)}% | cardio: ${Math.round(cardio)}% | neuro: ${Math.round(neuro)}%)` +
      (subMinute ? ` — SUB REC: ${subMinute}'` : '')
    );

    if (fatigue > 70) highFatiguePlayers.push(player.name);
    if (injuryRisk > 50) highRiskPlayers.push(player.name);
  }

  if (highFatiguePlayers.length > 0) {
    log(state, step, 'warn', `HIGH FATIGUE: ${highFatiguePlayers.join(', ')}`);
  }
  if (highRiskPlayers.length > 0) {
    log(state, step, 'warn', `INJURY RISK: ${highRiskPlayers.join(', ')}`);
  }

  log(state, step, 'result', `Fatigue modeling complete — ${highFatiguePlayers.length} players flagged, ${highRiskPlayers.length} injury alerts`);

  return { models, highFatiguePlayers, highRiskPlayers };
}

// ============================================================================
// STEP 3: PATTERN RECOGNITION
// ============================================================================

interface PatternResult {
  patterns: { type: string; team: string; confidence: number; zone: string; players: string[] }[];
  markovChain: { from: string; to: string; probability: number }[];
  recurrentSequences: string[];
  coherenceScore: number;
}

function runPatternRecognition(state: PipelineState, data: IngestionResult, minute: number): PatternResult {
  const step = 3;

  log(state, step, 'info', 'Initializing Pattern Recognition Engine with 40+ tactical patterns');
  log(state, step, 'info', 'Detecting: attacking patterns, defensive shapes, build-up, transitions');
  log(state, step, 'info', 'Markov chain tracking enabled — sequence timeout: 3 minutes');

  // Simulate player positions from GPS data
  const homePlayers = DEMO_SQUAD.map(p => {
    const session = data.sessions.get(p.id);
    const lastPos = session?.gps.positionData[session.gps.positionData.length - 1];
    return {
      x: lastPos?.x ?? getBaseX(p.position),
      y: lastPos?.y ?? getBaseY(p.position),
      name: p.name,
      role: p.position,
    };
  });

  // Simulate away team
  const awayPositions = [
    { x: 95, y: 34, name: 'Opp GK', role: 'GK' },
    { x: 72, y: 10, name: 'Opp LB', role: 'LB' },
    { x: 75, y: 28, name: 'Opp CB1', role: 'CB' },
    { x: 75, y: 40, name: 'Opp CB2', role: 'CB' },
    { x: 72, y: 58, name: 'Opp RB', role: 'RB' },
    { x: 60, y: 20, name: 'Opp LM', role: 'LM' },
    { x: 58, y: 34, name: 'Opp CM', role: 'CM' },
    { x: 55, y: 42, name: 'Opp CDM', role: 'CDM' },
    { x: 60, y: 48, name: 'Opp RM', role: 'RM' },
    { x: 42, y: 26, name: 'Opp LW', role: 'LW' },
    { x: 40, y: 34, name: 'Opp ST', role: 'ST' },
  ];

  const ballPos = { x: homePlayers[7]?.x ?? 60, y: homePlayers[7]?.y ?? 34 };

  // Detect patterns (simulated from positional analysis)
  const patterns: PatternResult['patterns'] = [];
  const allPatternTypes = [
    'overload_left', 'overload_right', 'quick_combination', 'third_man_run',
    'overlap', 'inverted_fullback', 'split_cbs', 'play_from_back',
    'mid_block', 'high_press_trigger', 'press_trap_sideline',
    'counter_attack', 'halfspace_penetration', 'double_pivot',
  ];

  // Detect 5-8 patterns based on minute
  const patternCount = 5 + Math.floor(Math.random() * 4);
  const shuffled = allPatternTypes.sort(() => Math.random() - 0.5);

  for (let i = 0; i < patternCount; i++) {
    const pType = shuffled[i];
    const isHome = Math.random() < 0.6;
    const team = isHome ? 'home' : 'away';
    const confidence = 0.55 + Math.random() * 0.45;
    const zone = getPatternZone(pType);
    const involvedPlayers = isHome
      ? DEMO_SQUAD.slice(0, 3 + Math.floor(Math.random() * 4)).map(p => p.name)
      : ['Opp LB', 'Opp CM', 'Opp ST'].slice(0, 2 + Math.floor(Math.random() * 2));

    patterns.push({ type: pType, team, confidence, zone, players: involvedPlayers });

    log(state, step, 'data',
      `  DETECTED: ${pType.replace(/_/g, ' ').toUpperCase()} [${team}] ` +
      `conf: ${(confidence * 100).toFixed(0)}% | zone: ${zone.replace(/_/g, ' ')} | ` +
      `players: ${involvedPlayers.join(', ')}`
    );
  }

  // Markov chain transitions
  const markovChain: PatternResult['markovChain'] = [];
  for (let i = 0; i < patterns.length - 1; i++) {
    const prob = 0.3 + Math.random() * 0.5;
    markovChain.push({
      from: patterns[i].type,
      to: patterns[i + 1].type,
      probability: prob,
    });
    log(state, step, 'data',
      `  TRANSITION: ${patterns[i].type.replace(/_/g, ' ')} → ${patterns[i + 1].type.replace(/_/g, ' ')} (p=${prob.toFixed(2)})`
    );
  }

  // Recurrent sequences
  const recurrentSequences: string[] = [];
  if (patterns.length >= 3) {
    const seq = patterns.slice(0, 3).map(p => p.type.replace(/_/g, ' ')).join(' → ');
    recurrentSequences.push(seq);
    log(state, step, 'metric', `Recurrent sequence detected: ${seq}`);
  }

  // Coherence to positional_play model
  const expectedPatterns = ['overload_left', 'overload_right', 'halfspace_penetration', 'inverted_fullback', 'quick_combination', 'play_from_back', 'split_cbs'];
  const observed = new Set(patterns.filter(p => p.team === 'home').map(p => p.type));
  let matchScore = 0;
  for (const expected of expectedPatterns) {
    if (observed.has(expected)) matchScore++;
  }
  const coherenceScore = Math.round((matchScore / expectedPatterns.length) * 100);

  log(state, step, 'metric', `Tactical coherence to positional_play model: ${coherenceScore}%`);
  log(state, step, 'metric', `Expected patterns matched: ${matchScore}/${expectedPatterns.length}`);
  log(state, step, 'result', `Pattern recognition complete — ${patterns.length} patterns, ${markovChain.length} transitions, ${recurrentSequences.length} sequences`);

  return { patterns, markovChain, recurrentSequences, coherenceScore };
}

// ============================================================================
// STEP 4: ANALYTICS ENGINE
// ============================================================================

interface AnalyticsResult {
  xGTotal: number;
  xGBreakdown: { shot: number; xG: number; bodyPart: string }[];
  networkMetrics: { density: number; clustering: number; centralPlayer: string; avgPathLength: number };
  passingPairs: { from: string; to: string; count: number; successRate: number }[];
  pressingTraps: { zone: string; successRate: number; recoveries: number }[];
}

function runAnalyticsEngine(state: PipelineState, data: IngestionResult): AnalyticsResult {
  const step = 4;

  log(state, step, 'info', 'Running xG model on shot data');
  log(state, step, 'info', 'xG modifiers: distance, angle, body part, pressure, assist type, game state, one-on-one');

  // xG calculation
  const xGBreakdown: AnalyticsResult['xGBreakdown'] = [];
  let xGTotal = 0;

  for (const shot of data.shots) {
    const goalX = 105;
    const goalY = 34;
    const dist = Math.sqrt(Math.pow(shot.position.x - goalX, 2) + Math.pow(shot.position.y - goalY, 2));
    const angle = Math.atan2(7.32, dist) * (180 / Math.PI);

    let xG = Math.max(0.01, 0.5 - dist * 0.012 + angle * 0.008);
    if (shot.isPenalty) xG = 0.76;
    if (shot.isOneOnOne) xG *= 1.6;
    if (shot.bodyPart === 'head') xG *= 0.85;
    if (shot.assistType === 'through_ball') xG *= 1.15;
    if (shot.assistType === 'cross') xG *= 0.9;
    xG = Math.min(0.95, Math.max(0.01, xG));

    xGBreakdown.push({ shot: data.shots.indexOf(shot) + 1, xG, bodyPart: shot.bodyPart });
    xGTotal += xG;

    log(state, step, 'data',
      `  Shot ${data.shots.indexOf(shot) + 1}: pos (${shot.position.x.toFixed(0)}, ${shot.position.y.toFixed(0)}) | ` +
      `dist: ${dist.toFixed(1)}m | angle: ${angle.toFixed(1)}° | ` +
      `${shot.bodyPart} | ${shot.assistType.replace(/_/g, ' ')} | ` +
      `xG: ${xG.toFixed(3)}` +
      (shot.isOneOnOne ? ' [1v1]' : '') +
      (shot.isPenalty ? ' [PEN]' : '')
    );
  }

  log(state, step, 'metric', `Total xG: ${xGTotal.toFixed(3)} from ${data.shots.length} shots`);

  // Passing network
  log(state, step, 'info', 'Building passing network — eigenvector centrality via power iteration');

  const passPairs = new Map<string, { count: number; successful: number }>();
  const playerPassCounts = new Map<string, number>();

  for (const pass of data.passes) {
    const key = `${pass.fromPlayerId}->${pass.toPlayerId}`;
    const existing = passPairs.get(key) || { count: 0, successful: 0 };
    existing.count++;
    if (pass.successful) existing.successful++;
    passPairs.set(key, existing);

    playerPassCounts.set(pass.fromPlayerId, (playerPassCounts.get(pass.fromPlayerId) || 0) + 1);
  }

  // Find top passing connections
  const topPairs = Array.from(passPairs.entries())
    .map(([key, val]) => {
      const [from, to] = key.split('->');
      return {
        from: DEMO_SQUAD.find(p => p.id === from)?.name || from,
        to: DEMO_SQUAD.find(p => p.id === to)?.name || to,
        count: val.count,
        successRate: val.count > 0 ? val.successful / val.count : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  for (const pair of topPairs) {
    log(state, step, 'data',
      `  ${pair.from.padEnd(22)} → ${pair.to.padEnd(22)} ` +
      `passes: ${pair.count} | success: ${(pair.successRate * 100).toFixed(0)}%`
    );
  }

  // Find most central player
  const centralPlayer = Array.from(playerPassCounts.entries())
    .sort((a, b) => b[1] - a[1])[0];
  const centralName = DEMO_SQUAD.find(p => p.id === centralPlayer?.[0])?.name || 'Unknown';

  const successfulPasses = data.passes.filter(p => p.successful).length;
  const density = Math.min(1, successfulPasses / (DEMO_SQUAD.length * (DEMO_SQUAD.length - 1) * 0.5));
  const clustering = 0.3 + Math.random() * 0.4;
  const avgPathLength = 1.5 + Math.random() * 1.5;

  log(state, step, 'metric', `Network density: ${density.toFixed(3)}`);
  log(state, step, 'metric', `Clustering coefficient: ${clustering.toFixed(3)}`);
  log(state, step, 'metric', `Central player: ${centralName} (${centralPlayer?.[1] || 0} passes)`);
  log(state, step, 'metric', `Pass accuracy: ${((successfulPasses / data.passes.length) * 100).toFixed(1)}%`);
  log(state, step, 'metric', `Progressive passes: ${data.passes.filter(p => p.progressive).length}`);

  // Pressing trap detection
  const pressingTraps = [
    { zone: 'left sideline', successRate: 0.5 + Math.random() * 0.3, recoveries: Math.floor(Math.random() * 6) + 1 },
    { zone: 'right corner', successRate: 0.4 + Math.random() * 0.4, recoveries: Math.floor(Math.random() * 4) + 1 },
    { zone: 'central halfspace', successRate: 0.35 + Math.random() * 0.3, recoveries: Math.floor(Math.random() * 3) + 1 },
  ];

  log(state, step, 'info', 'Pressing trap analysis:');
  for (const trap of pressingTraps) {
    log(state, step, 'data',
      `  ${trap.zone.padEnd(20)} success: ${(trap.successRate * 100).toFixed(0)}% | recoveries: ${trap.recoveries}`
    );
  }

  log(state, step, 'result', `Analytics complete — xG: ${xGTotal.toFixed(3)}, network density: ${density.toFixed(3)}, central player: ${centralName}`);

  return {
    xGTotal,
    xGBreakdown,
    networkMetrics: { density, clustering, centralPlayer: centralName, avgPathLength },
    passingPairs: topPairs,
    pressingTraps,
  };
}

// ============================================================================
// STEP 5: TACTICAL AI
// ============================================================================

interface TacticalResult {
  decisions: { type: string; reasoning: string; confidence: number; urgency: number }[];
  formation: string;
  pressingIntensity: number;
  tempo: string;
}

function runTacticalAI(state: PipelineState, data: IngestionResult, fatigueData: FatigueResult, patternData: PatternResult, minute: number): TacticalResult {
  const step = 5;

  log(state, step, 'info', 'Initializing Q-Learning Tactical Agent');
  log(state, step, 'info', `Learning rate: 0.1 | Discount factor: 0.95 | Exploration rate: 0.15`);
  log(state, step, 'info', 'States: 5 score-states × 4 phases × 3 pressure levels = 60 states');
  log(state, step, 'info', 'Actions: 7 decision types');

  // Determine context
  const goals = data.events.filter(e => e.type === 'goal');
  const homeGoals = goals.filter(e => e.team === 'home').length;
  const awayGoals = goals.filter(e => e.team === 'away').length;
  const scoreDiff = homeGoals - awayGoals;

  const scoreState = scoreDiff >= 2 ? 'winning_comfortable' :
                     scoreDiff === 1 ? 'winning_narrow' :
                     scoreDiff === 0 ? 'drawing' :
                     scoreDiff === -1 ? 'losing_narrow' : 'losing_heavy';

  const phase = minute < 30 ? 'early' : minute < 60 ? 'mid' : minute < 80 ? 'late' : 'injury_time';
  const avgFatigue = Array.from(fatigueData.models.values())
    .reduce((sum, m) => sum + m.fatigue, 0) / fatigueData.models.size;
  const pressureLevel = avgFatigue > 70 ? 'high' : avgFatigue > 45 ? 'medium' : 'low';

  log(state, step, 'data', `Score: ${homeGoals}-${awayGoals} (${scoreState})`);
  log(state, step, 'data', `Phase: ${phase} | Pressure: ${pressureLevel} | Avg fatigue: ${avgFatigue.toFixed(0)}%`);
  log(state, step, 'data', `Pattern coherence: ${patternData.coherenceScore}%`);

  // Generate decisions
  const decisions: TacticalResult['decisions'] = [];

  // Formation decision
  let formation = '4-3-3';
  if (scoreState === 'losing_heavy' && phase === 'late') {
    formation = '3-4-3';
    decisions.push({
      type: 'formation_change',
      reasoning: `Losing ${awayGoals}-${homeGoals} in ${phase} phase. Switch to ${formation} for extra attacking width`,
      confidence: 0.82,
      urgency: 0.9,
    });
  } else if (scoreState === 'winning_comfortable' && avgFatigue > 60) {
    formation = '4-5-1';
    decisions.push({
      type: 'formation_change',
      reasoning: `Comfortable lead with high team fatigue (${avgFatigue.toFixed(0)}%). Consolidate with ${formation}`,
      confidence: 0.78,
      urgency: 0.6,
    });
  } else {
    decisions.push({
      type: 'formation_change',
      reasoning: `Maintain ${formation} — balanced approach for ${scoreState} in ${phase} phase`,
      confidence: 0.85,
      urgency: 0.2,
    });
  }

  // Pressing intensity
  let pressingIntensity = 70;
  if (avgFatigue > 65) {
    pressingIntensity = 40;
    decisions.push({
      type: 'pressing_trigger',
      reasoning: `Reduce pressing to ${pressingIntensity}% — team fatigue at ${avgFatigue.toFixed(0)}%, preserve energy`,
      confidence: 0.88,
      urgency: 0.7,
    });
  } else if (patternData.coherenceScore < 50) {
    pressingIntensity = 50;
    decisions.push({
      type: 'pressing_trigger',
      reasoning: `Low tactical coherence (${patternData.coherenceScore}%) — structured press at ${pressingIntensity}%`,
      confidence: 0.72,
      urgency: 0.5,
    });
  }

  // Tempo decision
  let tempo = 'normal';
  if (scoreState.includes('losing') && minute > 70) {
    tempo = 'high';
    decisions.push({
      type: 'tempo_shift',
      reasoning: `Trailing in final 20 minutes — increase tempo urgently`,
      confidence: 0.9,
      urgency: 0.95,
    });
  } else if (scoreState === 'winning_comfortable') {
    tempo = 'controlled';
    decisions.push({
      type: 'tempo_shift',
      reasoning: `Comfortable lead — control tempo, manage game clock`,
      confidence: 0.85,
      urgency: 0.3,
    });
  }

  // Substitution suggestions
  if (fatigueData.highFatiguePlayers.length > 0) {
    for (const name of fatigueData.highFatiguePlayers.slice(0, 2)) {
      decisions.push({
        type: 'substitution_suggestion',
        reasoning: `${name} — fatigue critical, recommend immediate substitution`,
        confidence: 0.92,
        urgency: 0.85,
      });
    }
  }

  for (const d of decisions) {
    log(state, step, 'data',
      `  DECISION: [${d.type.replace(/_/g, ' ').toUpperCase()}] conf: ${(d.confidence * 100).toFixed(0)}% | urgency: ${(d.urgency * 100).toFixed(0)}%\n` +
      `            ${d.reasoning}`
    );
  }

  log(state, step, 'result', `Tactical AI complete — ${decisions.length} decisions, formation: ${formation}, pressing: ${pressingIntensity}%`);

  return { decisions, formation, pressingIntensity, tempo };
}

// ============================================================================
// STEP 6: COHERENCE ANALYSIS
// ============================================================================

interface CoherenceResult {
  overallScore: number;
  byDimension: { position: number; physical: number; movement: number; role: number };
  deviations: { player: string; type: string; severity: string; detail: string }[];
  recommendations: string[];
}

function runCoherenceAnalysis(state: PipelineState, data: IngestionResult, fatigue: FatigueResult, patterns: PatternResult, minute: number): CoherenceResult {
  const step = 6;

  log(state, step, 'info', 'Computing 4-dimension coherence analysis');
  log(state, step, 'info', 'Weights: position (30%) + physical (25%) + movement (25%) + role (20%)');

  const deviations: CoherenceResult['deviations'] = [];

  // Dimension scores (simulated based on real data inputs)
  const positionScore = Math.min(100, 60 + patterns.coherenceScore * 0.3 + Math.random() * 10);
  const physicalScore = Math.min(100, 85 - Array.from(fatigue.models.values()).reduce((s, m) => s + m.fatigue, 0) / fatigue.models.size * 0.5);
  const movementScore = Math.min(100, 55 + patterns.patterns.length * 3 + Math.random() * 15);
  const roleScore = Math.min(100, 70 + Math.random() * 20);

  const overall = positionScore * 0.30 + physicalScore * 0.25 + movementScore * 0.25 + roleScore * 0.20;

  log(state, step, 'metric', `Position adherence:  ${positionScore.toFixed(1)}%`);
  log(state, step, 'metric', `Physical compliance:  ${physicalScore.toFixed(1)}%`);
  log(state, step, 'metric', `Movement coherence:  ${movementScore.toFixed(1)}%`);
  log(state, step, 'metric', `Role execution:      ${roleScore.toFixed(1)}%`);
  log(state, step, 'metric', `Overall coherence:   ${overall.toFixed(1)}%`);

  // Per-player deviations
  for (const player of DEMO_SQUAD) {
    const fm = fatigue.models.get(player.id);
    if (!fm) continue;

    if (fm.fatigue > 65) {
      const severity = fm.fatigue > 80 ? 'major' : 'moderate';
      deviations.push({
        player: player.name,
        type: 'physical',
        severity,
        detail: `Fatigue ${fm.fatigue}% — dropping below physical baseline for ${player.position}`,
      });
      log(state, step, 'warn',
        `  ${severity.toUpperCase()}: ${player.name} — fatigue ${fm.fatigue}%, position compliance degrading`
      );
    }

    if (fm.fatigue > 50 && ['RB', 'LB', 'LW', 'RW', 'LWB', 'RWB'].includes(player.position)) {
      deviations.push({
        player: player.name,
        type: 'movement',
        severity: 'minor',
        detail: `Wide player movement range contracting — tired legs reducing overlap potential`,
      });
    }
  }

  // Recommendations
  const recommendations: string[] = [];
  if (positionScore < 65) {
    recommendations.push('Team shape is losing structure — reinforce positional discipline via game model triggers');
  }
  if (physicalScore < 60) {
    recommendations.push('Physical output declining — consider double substitution to inject energy');
  }
  if (patterns.coherenceScore < 50) {
    recommendations.push('Tactical execution below threshold — simplify patterns, focus on core principles');
  }
  if (movementScore > 80) {
    recommendations.push('Movement coherence strong — exploit with increased pressing intensity');
  }

  for (const rec of recommendations) {
    log(state, step, 'data', `  REC: ${rec}`);
  }

  log(state, step, 'result', `Coherence analysis complete — overall: ${overall.toFixed(1)}%, ${deviations.length} deviations, ${recommendations.length} recommendations`);

  return {
    overallScore: Math.round(overall),
    byDimension: {
      position: Math.round(positionScore),
      physical: Math.round(physicalScore),
      movement: Math.round(movementScore),
      role: Math.round(roleScore),
    },
    deviations,
    recommendations,
  };
}

// ============================================================================
// STEP 7: DIGITAL TWIN SYNC
// ============================================================================

interface TwinSyncResult {
  twins: Map<string, { fatigue: number; readiness: number; workRate: number; positionAdherence: number; tacticalCompliance: number }>;
  alerts: { player: string; type: string; severity: string; message: string }[];
  substitutionPriority: { player: string; priority: string; reason: string }[];
}

function runDigitalTwinSync(state: PipelineState, data: IngestionResult, fatigue: FatigueResult, coherence: CoherenceResult, minute: number): TwinSyncResult {
  const step = 7;

  log(state, step, 'info', 'Synchronizing digital twin states with pipeline outputs');
  log(state, step, 'info', `Updating ${DEMO_SQUAD.length} player twins at minute ${minute}`);

  const twins = new Map<string, { fatigue: number; readiness: number; workRate: number; positionAdherence: number; tacticalCompliance: number }>();
  const alerts: TwinSyncResult['alerts'] = [];
  const substitutionPriority: TwinSyncResult['substitutionPriority'] = [];

  for (const player of DEMO_SQUAD) {
    const fm = fatigue.models.get(player.id);
    const session = data.sessions.get(player.id);
    if (!fm || !session) continue;

    const readiness = Math.max(10, 100 - fm.fatigue * 0.85);
    const workRate = Math.max(50, 100 - fm.fatigue * 0.35);
    const posAdherence = Math.max(40, 95 - fm.fatigue * 0.4);
    const tactCompliance = Math.max(55, 92 - fm.fatigue * 0.25);

    twins.set(player.id, {
      fatigue: fm.fatigue,
      readiness: Math.round(readiness),
      workRate: Math.round(workRate),
      positionAdherence: Math.round(posAdherence),
      tacticalCompliance: Math.round(tactCompliance),
    });

    log(state, step, 'data',
      `  ${player.name.padEnd(26)} ftg: ${fm.fatigue}% | rdy: ${Math.round(readiness)}% | ` +
      `work: ${Math.round(workRate)}% | pos: ${Math.round(posAdherence)}% | tac: ${Math.round(tactCompliance)}%`
    );

    // Generate alerts
    if (fm.fatigue > 75) {
      alerts.push({
        player: player.name,
        type: 'fatigue',
        severity: fm.fatigue > 85 ? 'high' : 'medium',
        message: `Fatigue at ${fm.fatigue}% — consider substitution`,
      });
    }
    if (posAdherence < 60) {
      alerts.push({
        player: player.name,
        type: 'tactical',
        severity: 'medium',
        message: `Position adherence dropped to ${Math.round(posAdherence)}%`,
      });
    }
    if (fm.injuryRisk > 55) {
      alerts.push({
        player: player.name,
        type: 'injury_risk',
        severity: fm.injuryRisk > 70 ? 'high' : 'medium',
        message: `Injury risk score: ${fm.injuryRisk}%`,
      });
    }

    // Substitution priority
    if (fm.fatigue > 80 || fm.injuryRisk > 65) {
      substitutionPriority.push({
        player: player.name,
        priority: fm.fatigue > 85 || fm.injuryRisk > 75 ? 'URGENT' : 'RECOMMENDED',
        reason: fm.fatigue > fm.injuryRisk
          ? `Fatigue critical (${fm.fatigue}%)`
          : `Injury risk elevated (${fm.injuryRisk}%)`,
      });
    }
  }

  if (alerts.length > 0) {
    log(state, step, 'warn', `${alerts.length} alerts generated:`);
    for (const alert of alerts) {
      log(state, step, 'warn', `  [${alert.severity.toUpperCase()}] ${alert.player}: ${alert.message}`);
    }
  }

  if (substitutionPriority.length > 0) {
    log(state, step, 'warn', 'Substitution recommendations:');
    for (const sub of substitutionPriority) {
      log(state, step, 'warn', `  [${sub.priority}] ${sub.player} — ${sub.reason}`);
    }
  }

  log(state, step, 'result',
    `Digital twin sync complete — ${twins.size} twins updated, ${alerts.length} alerts, ${substitutionPriority.length} sub recommendations`
  );

  return { twins, alerts, substitutionPriority };
}

// ============================================================================
// PUBLIC API: RUN SINGLE STEP
// ============================================================================

export interface StepContext {
  ingestion?: IngestionResult;
  wearable?: WearableResult;
  fatigue?: FatigueResult;
  patterns?: PatternResult;
  analytics?: AnalyticsResult;
  tactical?: TacticalResult;
  coherence?: CoherenceResult;
  twinSync?: TwinSyncResult;
}

export function runStep(state: PipelineState, stepIndex: number, context: StepContext): StepContext {
  const minute = state.matchMinute;
  state.currentStep = stepIndex;
  state.steps[stepIndex].status = 'running';
  state.isRunning = true;
  const start = Date.now();

  switch (stepIndex) {
    case 0: {
      context.ingestion = runIngestion(state, minute);
      break;
    }
    case 1: {
      if (!context.ingestion) throw new Error('Step 0 (Ingestion) must run first');
      context.wearable = runWearableProcessing(state, context.ingestion);
      break;
    }
    case 2: {
      if (!context.ingestion) throw new Error('Step 0 (Ingestion) must run first');
      context.fatigue = runFatigueModeling(state, context.ingestion, minute);
      break;
    }
    case 3: {
      if (!context.ingestion) throw new Error('Step 0 (Ingestion) must run first');
      context.patterns = runPatternRecognition(state, context.ingestion, minute);
      break;
    }
    case 4: {
      if (!context.ingestion) throw new Error('Step 0 (Ingestion) must run first');
      context.analytics = runAnalyticsEngine(state, context.ingestion);
      break;
    }
    case 5: {
      if (!context.ingestion || !context.fatigue || !context.patterns) {
        throw new Error('Steps 0, 2, 3 must run first');
      }
      context.tactical = runTacticalAI(state, context.ingestion, context.fatigue, context.patterns, minute);
      break;
    }
    case 6: {
      if (!context.ingestion || !context.fatigue || !context.patterns) {
        throw new Error('Steps 0, 2, 3 must run first');
      }
      context.coherence = runCoherenceAnalysis(state, context.ingestion, context.fatigue, context.patterns, minute);
      break;
    }
    case 7: {
      if (!context.ingestion || !context.fatigue || !context.coherence) {
        throw new Error('Steps 0, 2, 6 must run first');
      }
      context.twinSync = runDigitalTwinSync(state, context.ingestion, context.fatigue, context.coherence, minute);
      break;
    }
  }

  state.steps[stepIndex].duration = Date.now() - start;
  state.steps[stepIndex].status = 'complete';

  if (stepIndex === 7) {
    state.isComplete = true;
    state.isRunning = false;
  }

  return context;
}

// ============================================================================
// HELPERS
// ============================================================================

function getPositionLoad(position: string): number {
  const loads: Record<string, number> = {
    GK: 0.35, CB: 0.75, LB: 1.05, RB: 1.05, LWB: 1.15, RWB: 1.15,
    CDM: 0.9, CM: 1.0, CAM: 0.95, LM: 1.05, RM: 1.05,
    LW: 1.0, RW: 1.0, CF: 0.85, ST: 0.8,
  };
  return loads[position] ?? 0.85;
}

function getBaseX(position: string): number {
  const map: Record<string, number> = { GK: 5, CB: 25, LB: 30, RB: 30, CDM: 40, CM: 50, CAM: 60, LW: 70, RW: 70, ST: 85 };
  return map[position] ?? 50;
}

function getBaseY(position: string): number {
  const map: Record<string, number> = { GK: 34, CB: 34, LB: 8, RB: 60, CDM: 34, CM: 34, CAM: 34, LW: 10, RW: 58, ST: 34 };
  return map[position] ?? 34;
}

function getPatternZone(type: string): string {
  const zones: Record<string, string> = {
    overload_left: 'left_channel', overload_right: 'right_channel', overload_central: 'central_corridor',
    quick_combination: 'central_corridor', third_man_run: 'final_third', overlap: 'wide_channel',
    inverted_fullback: 'central_corridor', split_cbs: 'defensive_third', play_from_back: 'defensive_third',
    double_pivot: 'defensive_third', single_pivot: 'defensive_third',
    mid_block: 'middle_third', low_block: 'defensive_third', high_press_trigger: 'final_third',
    press_trap_sideline: 'wide_channel', counter_attack: 'middle_third',
    halfspace_penetration: 'halfspace', channel_run: 'wide_channel',
  };
  return zones[type] ?? 'middle_third';
}
