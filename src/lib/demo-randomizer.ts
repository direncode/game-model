/**
 * DEMO DATA RANDOMIZER
 * Generates realistic data matching exact ingestor module structures.
 * Emulates Catapult GPS/IMU sessions, Football Data API stats,
 * and Wearable Analytics output for a full squad.
 */

import type {
  CatapultPlayerSession,
  SpeedZoneData,
  AccelerationData,
  ImpactData,
  GPSPosition,
  OrientationData,
  HRZoneData,
} from './catapult-integration';

// ============================================================================
// SQUAD DEFINITION
// ============================================================================

export interface DemoPlayer {
  id: string;
  name: string;
  position: string;
  number: number;
  maxSpeed: number;         // m/s
  accelerationPeak: number; // m/s²
  baseDistance: number;      // expected meters per 90
  sprintCapacity: number;   // expected sprints per 90
}

export const DEMO_SQUAD: DemoPlayer[] = [
  { id: 'gk-1',  name: 'David Raya',        position: 'GK',  number: 1,  maxSpeed: 7.2,  accelerationPeak: 3.2, baseDistance: 5500,  sprintCapacity: 4 },
  { id: 'rb-2',  name: 'Trent Alexander-Arnold', position: 'RB', number: 66, maxSpeed: 9.1, accelerationPeak: 4.4, baseDistance: 10800, sprintCapacity: 28 },
  { id: 'cb-3',  name: 'Virgil van Dijk',   position: 'CB',  number: 4,  maxSpeed: 8.8,  accelerationPeak: 4.1, baseDistance: 9200,  sprintCapacity: 12 },
  { id: 'cb-4',  name: 'William Saliba',    position: 'CB',  number: 12, maxSpeed: 9.0,  accelerationPeak: 4.3, baseDistance: 9400,  sprintCapacity: 14 },
  { id: 'lb-5',  name: 'Andrew Robertson',  position: 'LB',  number: 26, maxSpeed: 9.3,  accelerationPeak: 4.5, baseDistance: 11200, sprintCapacity: 30 },
  { id: 'cm-6',  name: 'Declan Rice',       position: 'CDM', number: 41, maxSpeed: 8.5,  accelerationPeak: 4.0, baseDistance: 11500, sprintCapacity: 18 },
  { id: 'cm-7',  name: 'Martin Odegaard',   position: 'CM',  number: 8,  maxSpeed: 8.2,  accelerationPeak: 3.9, baseDistance: 10600, sprintCapacity: 16 },
  { id: 'cam-8', name: 'Bruno Fernandes',   position: 'CAM', number: 18, maxSpeed: 8.6,  accelerationPeak: 4.0, baseDistance: 11000, sprintCapacity: 20 },
  { id: 'lw-9',  name: 'Bukayo Saka',       position: 'RW',  number: 7,  maxSpeed: 9.4,  accelerationPeak: 4.6, baseDistance: 10400, sprintCapacity: 32 },
  { id: 'rw-10', name: 'Alejandro Garnacho', position: 'LW', number: 17, maxSpeed: 9.5, accelerationPeak: 4.7, baseDistance: 10200, sprintCapacity: 34 },
  { id: 'st-11', name: 'Erling Haaland',    position: 'ST',  number: 9,  maxSpeed: 9.8,  accelerationPeak: 4.8, baseDistance: 9200,  sprintCapacity: 24 },
];

// ============================================================================
// RANDOM UTILITIES
// ============================================================================

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function gaussRand(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ============================================================================
// CATAPULT SESSION RANDOMIZER
// ============================================================================

export function randomizeCatapultSession(player: DemoPlayer, minute: number): CatapultPlayerSession {
  const minuteFactor = Math.min(minute / 90, 1);
  const fatigueDrop = 1 - minuteFactor * 0.18;

  // Position-based load multiplier
  const posLoad = getPositionLoad(player.position);

  // GPS metrics
  const totalDistance = player.baseDistance * minuteFactor * rand(0.92, 1.08);
  const distPerMin = totalDistance / Math.max(1, minute);
  const maxSpeed = player.maxSpeed * fatigueDrop * rand(0.95, 1.05);
  const avgSpeed = distPerMin / 60; // m/s

  // Speed zone breakdown (time in seconds)
  const speedZones = randomizeSpeedZones(minute, posLoad, fatigueDrop);

  // GPS position trace (10Hz sampling - we generate key samples)
  const positionData = randomizeGPSTrace(player, minute);

  // IMU metrics
  const playerLoad = rand(600, 950) * posLoad * minuteFactor * fatigueDrop;
  const accels = randomizeAccelerations(minute, posLoad, fatigueDrop);
  const decels = randomizeAccelerations(minute, posLoad * 0.9, fatigueDrop);
  const impacts = randomizeImpacts(minute, posLoad);
  const bodyOrientation = randomizeOrientation(minute);

  // Heart rate
  const maxHR = randInt(185, 198);
  const avgHR = Math.round(140 + minuteFactor * 15 + posLoad * 5);
  const hrZones = randomizeHRZones(minute, posLoad);
  const hrv = Math.round(clamp(gaussRand(65, 15) - minuteFactor * 20, 20, 95));
  const trimp = Math.round(minute * posLoad * rand(1.8, 2.5));

  // Derived metrics
  const sprintCount = Math.round(player.sprintCapacity * minuteFactor * rand(0.8, 1.2));
  const explosiveEfforts = Math.round(sprintCount * rand(1.2, 1.8));
  const highIntensityDistance = totalDistance * rand(0.18, 0.25) * posLoad;
  const fatigueIndex = clamp(Math.round(minuteFactor * 65 * posLoad + rand(-5, 10)), 0, 100);
  const readinessScore = clamp(Math.round(100 - fatigueIndex * 0.85 - rand(0, 8)), 10, 100);
  const injuryRiskScore = clamp(Math.round(fatigueIndex * 0.4 + rand(-5, 15)), 0, 100);

  return {
    playerId: player.id,
    playerName: player.name,
    sessionId: `demo_session_${Date.now()}_${player.id}`,
    sessionType: 'match',
    date: new Date().toISOString(),
    duration: minute,
    gps: {
      totalDistance: Math.round(totalDistance),
      distancePerMinute: Math.round(distPerMin * 10) / 10,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      avgSpeed: Math.round(avgSpeed * 100) / 100,
      speedZones,
      positionData,
    },
    imu: {
      playerLoad: Math.round(playerLoad * 10) / 10,
      playerLoadPerMinute: Math.round((playerLoad / Math.max(1, minute)) * 100) / 100,
      accelerations: accels,
      decelerations: decels,
      impacts,
      bodyOrientation,
    },
    heartRate: {
      avgHR,
      maxHR,
      hrZones,
      hrVariability: hrv,
      trainingLoad: trimp,
    },
    derived: {
      metabolicPower: Math.round(rand(10, 16) * posLoad * fatigueDrop * 100) / 100,
      highMetabolicLoadDistance: Math.round(highIntensityDistance * rand(0.6, 0.8)),
      explosiveEfforts,
      sprintCount,
      highIntensityDistance: Math.round(highIntensityDistance),
      fatigueIndex,
      readinessScore,
      injuryRiskScore,
    },
  };
}

// ============================================================================
// SUB-RANDOMIZERS
// ============================================================================

function getPositionLoad(position: string): number {
  const loads: Record<string, number> = {
    GK: 0.35, CB: 0.75, LB: 1.05, RB: 1.05, LWB: 1.15, RWB: 1.15,
    CDM: 0.9, CM: 1.0, CAM: 0.95, LM: 1.05, RM: 1.05,
    LW: 1.0, RW: 1.0, CF: 0.85, ST: 0.8,
  };
  return loads[position] ?? 0.85;
}

function randomizeSpeedZones(minute: number, posLoad: number, fatigue: number): SpeedZoneData {
  return {
    zone1: Math.round(minute * rand(10, 14) * 0.35),             // walking
    zone2: Math.round(minute * rand(14, 18) * posLoad * 0.4),    // jogging
    zone3: Math.round(minute * rand(8, 12) * posLoad * fatigue),  // running
    zone4: Math.round(minute * rand(3, 6) * posLoad * fatigue),   // high-speed
    zone5: Math.round(minute * rand(1, 3) * posLoad * fatigue),   // sprinting
    zone6: Math.round(minute * rand(0.2, 1) * posLoad * fatigue), // max velocity
  };
}

function randomizeAccelerations(minute: number, posLoad: number, fatigue: number): AccelerationData {
  const low = Math.round(minute * rand(0.4, 0.6) * posLoad);
  const medium = Math.round(minute * rand(0.2, 0.35) * posLoad * fatigue);
  const high = Math.round(minute * rand(0.08, 0.18) * posLoad * fatigue);
  return { low, medium, high, total: low + medium + high };
}

function randomizeImpacts(minute: number, posLoad: number): ImpactData {
  const low = Math.round(minute * rand(0.1, 0.2) * posLoad);
  const medium = Math.round(minute * rand(0.05, 0.1) * posLoad);
  const high = Math.round(minute * rand(0.01, 0.04) * posLoad);
  return { low, medium, high, total: low + medium + high };
}

function randomizeHRZones(minute: number, posLoad: number): HRZoneData {
  return {
    zone1: Math.round(minute * rand(0.02, 0.05)),
    zone2: Math.round(minute * rand(0.05, 0.10)),
    zone3: Math.round(minute * rand(0.15, 0.25) * posLoad),
    zone4: Math.round(minute * rand(0.20, 0.35) * posLoad),
    zone5: Math.round(minute * rand(0.05, 0.15) * posLoad),
  };
}

function randomizeGPSTrace(player: DemoPlayer, minute: number): GPSPosition[] {
  const positions: GPSPosition[] = [];
  const basePos = getBasePosition(player.position);
  const sampleCount = Math.min(minute * 2, 180); // 2 samples per minute for demo

  for (let i = 0; i < sampleCount; i++) {
    const t = (i / sampleCount) * minute * 60 * 1000; // ms
    const drift = Math.sin(i * 0.3) * rand(3, 8);
    const lateralDrift = Math.cos(i * 0.2) * rand(2, 6);

    positions.push({
      timestamp: Math.round(t),
      x: clamp(basePos.x + drift + rand(-2, 2), 0, 105),
      y: clamp(basePos.y + lateralDrift + rand(-2, 2), 0, 68),
      speed: rand(0.5, player.maxSpeed * 0.9),
      acceleration: gaussRand(0, 1.5),
      heading: rand(0, 360),
    });
  }

  return positions;
}

function randomizeOrientation(minute: number): OrientationData[] {
  const samples: OrientationData[] = [];
  const count = Math.min(minute, 90);

  for (let i = 0; i < count; i++) {
    samples.push({
      timestamp: i * 60000,
      pitch: gaussRand(0, 8),
      roll: gaussRand(0, 5),
      yaw: rand(0, 360),
    });
  }

  return samples;
}

function getBasePosition(position: string): { x: number; y: number } {
  const positions: Record<string, { x: number; y: number }> = {
    GK:  { x: 5,  y: 34 },
    CB:  { x: 25, y: 34 },
    LB:  { x: 30, y: 8 },
    RB:  { x: 30, y: 60 },
    LWB: { x: 35, y: 6 },
    RWB: { x: 35, y: 62 },
    CDM: { x: 40, y: 34 },
    CM:  { x: 50, y: 34 },
    CAM: { x: 60, y: 34 },
    LM:  { x: 50, y: 12 },
    RM:  { x: 50, y: 56 },
    LW:  { x: 70, y: 10 },
    RW:  { x: 70, y: 58 },
    CF:  { x: 78, y: 34 },
    ST:  { x: 85, y: 34 },
  };
  return positions[position] ?? { x: 52, y: 34 };
}

// ============================================================================
// FULL SQUAD RANDOMIZER
// ============================================================================

export function randomizeSquadSessions(minute: number): Map<string, CatapultPlayerSession> {
  const sessions = new Map<string, CatapultPlayerSession>();
  for (const player of DEMO_SQUAD) {
    sessions.set(player.id, randomizeCatapultSession(player, minute));
  }
  return sessions;
}

// ============================================================================
// MATCH EVENT RANDOMIZER (for Tactical AI)
// ============================================================================

export interface DemoMatchEvent {
  minute: number;
  type: 'goal' | 'shot' | 'chance' | 'foul' | 'card' | 'substitution' | 'pressing_success' | 'pressing_fail';
  team: 'home' | 'away';
  xG?: number;
  zone?: string;
  player?: string;
}

export function randomizeMatchEvents(upToMinute: number): DemoMatchEvent[] {
  const events: DemoMatchEvent[] = [];
  const zones = ['left_channel', 'right_channel', 'central_corridor', 'box', 'left_halfspace', 'right_halfspace', 'defensive_third'];
  const eventTypes: DemoMatchEvent['type'][] = ['shot', 'chance', 'foul', 'pressing_success', 'pressing_fail'];

  for (let m = 1; m <= upToMinute; m++) {
    // ~1 event every 3 minutes on average
    if (Math.random() < 0.33) {
      const type = eventTypes[randInt(0, eventTypes.length - 1)];
      const team = Math.random() < 0.55 ? 'home' : 'away';

      events.push({
        minute: m,
        type,
        team,
        xG: type === 'shot' ? rand(0.02, 0.35) : type === 'chance' ? rand(0.05, 0.5) : undefined,
        zone: zones[randInt(0, zones.length - 1)],
        player: team === 'home' ? DEMO_SQUAD[randInt(0, 10)].name : `Opponent #${randInt(1, 11)}`,
      });
    }
  }

  // Possibly add a goal
  if (upToMinute > 20 && Math.random() < 0.4) {
    events.push({
      minute: randInt(15, Math.min(upToMinute, 88)),
      type: 'goal',
      team: Math.random() < 0.6 ? 'home' : 'away',
      xG: rand(0.15, 0.65),
      zone: 'box',
      player: Math.random() < 0.6 ? DEMO_SQUAD[10].name : `Opponent #${randInt(7, 11)}`,
    });
  }

  return events.sort((a, b) => a.minute - b.minute);
}

// ============================================================================
// SHOT DATA RANDOMIZER (for xG model)
// ============================================================================

export interface DemoShot {
  position: { x: number; y: number };
  bodyPart: 'right_foot' | 'left_foot' | 'head';
  assistType: 'through_ball' | 'cross' | 'cutback' | 'set_piece' | 'solo' | 'none';
  defendersPressure: number;
  goalkeeperPosition: { x: number; y: number };
  isOneOnOne: boolean;
  isPenalty: boolean;
  isFreeKick: boolean;
  gameState: 'open_play' | 'counter' | 'set_piece';
  minute: number;
  shotPower: number;
  shotPlacement: { x: number; y: number };
}

export function randomizeShots(count: number): DemoShot[] {
  const shots: DemoShot[] = [];
  const bodyParts: DemoShot['bodyPart'][] = ['right_foot', 'left_foot', 'head'];
  const assistTypes: DemoShot['assistType'][] = ['through_ball', 'cross', 'cutback', 'set_piece', 'solo', 'none'];
  const gameStates: DemoShot['gameState'][] = ['open_play', 'counter', 'set_piece'];

  for (let i = 0; i < count; i++) {
    shots.push({
      position: { x: rand(75, 104), y: rand(15, 53) },
      bodyPart: bodyParts[randInt(0, 2)],
      assistType: assistTypes[randInt(0, 5)],
      defendersPressure: rand(10, 85),
      goalkeeperPosition: { x: rand(103, 105), y: rand(30, 38) },
      isOneOnOne: Math.random() < 0.12,
      isPenalty: Math.random() < 0.05,
      isFreeKick: Math.random() < 0.08,
      gameState: gameStates[randInt(0, 2)],
      minute: randInt(1, 90),
      shotPower: rand(40, 95),
      shotPlacement: { x: 105, y: rand(30.34, 37.66) },
    });
  }

  return shots.sort((a, b) => a.minute - b.minute);
}

// ============================================================================
// PASS DATA RANDOMIZER (for Passing Network)
// ============================================================================

export interface DemoPass {
  from: { x: number; y: number };
  to: { x: number; y: number };
  fromPlayerId: string;
  toPlayerId: string;
  successful: boolean;
  type: 'short' | 'medium' | 'long' | 'through' | 'cross' | 'switch';
  progressive: boolean;
  underPressure: boolean;
  minute: number;
}

export function randomizePasses(count: number): DemoPass[] {
  const passes: DemoPass[] = [];
  const types: DemoPass['type'][] = ['short', 'short', 'short', 'medium', 'medium', 'long', 'through', 'cross', 'switch'];

  for (let i = 0; i < count; i++) {
    const fromPlayer = DEMO_SQUAD[randInt(0, 10)];
    let toPlayer = DEMO_SQUAD[randInt(0, 10)];
    while (toPlayer.id === fromPlayer.id) {
      toPlayer = DEMO_SQUAD[randInt(0, 10)];
    }

    const fromPos = getBasePosition(fromPlayer.position);
    const toPos = getBasePosition(toPlayer.position);

    passes.push({
      from: { x: fromPos.x + rand(-5, 5), y: fromPos.y + rand(-5, 5) },
      to: { x: toPos.x + rand(-5, 5), y: toPos.y + rand(-5, 5) },
      fromPlayerId: fromPlayer.id,
      toPlayerId: toPlayer.id,
      successful: Math.random() < 0.82,
      type: types[randInt(0, types.length - 1)],
      progressive: Math.random() < 0.3,
      underPressure: Math.random() < 0.25,
      minute: randInt(1, 90),
    });
  }

  return passes.sort((a, b) => a.minute - b.minute);
}
