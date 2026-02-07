// Synthetic tracking data generator
// Produces realistic GPS-level metrics scaled by player position, physicalProfile, and match minute

import type { Player, TrackingMetrics, PlayerAlert } from '@/types';
import type { DigitalTwin, TwinState } from '@/types';

// Position-based baseline multipliers (how much each position typically runs)
const POSITION_LOAD: Record<string, number> = {
  GK: 0.35,
  CB: 0.75,
  LB: 1.05,
  RB: 1.05,
  LWB: 1.15,
  RWB: 1.15,
  CDM: 0.9,
  CM: 1.0,
  CAM: 0.95,
  LM: 1.05,
  RM: 1.05,
  LW: 1.0,
  RW: 1.0,
  CF: 0.85,
  ST: 0.8,
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateLiveTracking(
  players: Player[],
  minute: number
): Map<string, TrackingMetrics> {
  const map = new Map<string, TrackingMetrics>();

  players.forEach((player, index) => {
    const seed = index * 1000 + minute;
    const rand = () => seededRandom(seed + map.size + Math.random() * 100);

    const posLoad = POSITION_LOAD[player.position] ?? 0.85;
    const maxSpd = player.physicalProfile.maxSpeed;
    const minuteFactor = Math.min(minute / 90, 1);
    const fatigueDrop = 1 - minuteFactor * 0.18; // 18% performance drop at 90'

    // Cumulative distance scales with minute
    const baseDistPerMin = 110 * posLoad; // meters per minute
    const totalDistance = baseDistPerMin * minute * (1 - minuteFactor * 0.08);
    const distPerMin = baseDistPerMin * fatigueDrop;

    // Current speed: most players are jogging/walking, occasional sprints
    const isSprintBurst = rand() > 0.85;
    const currentSpeed = isSprintBurst
      ? maxSpd * (0.7 + rand() * 0.3) * fatigueDrop
      : 4 + rand() * 8; // 4-12 km/h normal movement

    const avgSpeed = 6.5 + posLoad * 1.5;

    // Sprint/high intensity distances scale with position and minute
    const sprintDist = totalDistance * 0.03 * posLoad * fatigueDrop + rand() * 30;
    const hsrDist = totalDistance * 0.08 * posLoad * fatigueDrop + rand() * 50;

    // Heart rate
    const baseHR = 140 + minuteFactor * 15;
    const currentHR = Math.round(baseHR + (isSprintBurst ? 25 : 0) + rand() * 10 - 5);

    // Player load
    const playerLoad = (4.5 + posLoad * 2) * minute * fatigueDrop * 0.07;

    const metrics: TrackingMetrics = {
      totalDistance,
      distancePerMinute: distPerMin,
      highSpeedRunningDistance: hsrDist,
      sprintDistance: sprintDist,
      walkingDistance: totalDistance * 0.22,
      joggingDistance: totalDistance * 0.38,
      runningDistance: totalDistance * 0.28,
      currentSpeed,
      averageSpeed: avgSpeed,
      maxSpeed: maxSpd * fatigueDrop,
      speedZones: {
        zone1: minute * 12 * posLoad,
        zone2: minute * 16 * posLoad,
        zone3: minute * 10 * posLoad,
        zone4: minute * 5 * posLoad,
        zone5: minute * 2 * posLoad,
        zone6: minute * 0.6 * posLoad,
      },
      accelerations: {
        low: Math.round(minute * 0.5 * posLoad),
        medium: Math.round(minute * 0.3 * posLoad),
        high: Math.round(minute * 0.15 * posLoad),
        total: Math.round(minute * 0.95 * posLoad),
      },
      decelerations: {
        low: Math.round(minute * 0.5 * posLoad),
        medium: Math.round(minute * 0.28 * posLoad),
        high: Math.round(minute * 0.12 * posLoad),
        total: Math.round(minute * 0.9 * posLoad),
      },
      maxAcceleration: player.physicalProfile.accelerationPeak * fatigueDrop,
      maxDeceleration: -(player.physicalProfile.accelerationPeak * fatigueDrop),
      playerLoad,
      playerLoadPerMinute: playerLoad / Math.max(1, minute),
      metabolicPower: (9 + posLoad * 3) * fatigueDrop,
      highMetabolicLoadDistance: totalDistance * 0.11 * posLoad * fatigueDrop,
      heartRate: {
        current: currentHR,
        average: Math.round(baseHR - 5),
        max: Math.round(baseHR + 30),
        min: Math.round(baseHR - 30),
        zones: {
          zone1: minute * 2,
          zone2: minute * 5,
          zone3: minute * 15,
          zone4: minute * 20,
          zone5: minute * 8,
        },
      },
      position: {
        x: 50, // will be overridden by simulation
        y: 50,
        zone: 'middle_third',
        heatmap: { cells: [], resolution: { x: 21, y: 14 } },
      },
    };

    map.set(player.id, metrics);
  });

  return map;
}

export interface SimpleTwin {
  playerId: string;
  fatigue: number;
  readiness: number;
  positionAdherence: number;
  currentWorkRate: number;
  tacticalCompliance: number;
  confidenceLevel: number;
}

export function generateDigitalTwins(
  players: Player[],
  minute: number
): Map<string, SimpleTwin> {
  const map = new Map<string, SimpleTwin>();

  players.forEach((player, index) => {
    const posLoad = POSITION_LOAD[player.position] ?? 0.85;
    const minuteFactor = Math.min(minute / 90, 1);
    const seed = index * 137 + minute;
    const rand = seededRandom(seed);

    // Fatigue increases with time, more for high-load positions
    const baseFatigue = minuteFactor * 60 * posLoad;
    const fatigue = Math.min(100, baseFatigue + rand * 15);

    // Readiness inversely proportional to fatigue
    const readiness = Math.max(10, 100 - fatigue * 0.85 - rand * 8);

    // Position adherence decreases with fatigue
    const positionAdherence = Math.max(40, 95 - fatigue * 0.4 - rand * 10);

    // Work rate drops with fatigue
    const currentWorkRate = Math.max(50, 100 - fatigue * 0.35 - rand * 8);

    // Tactical compliance
    const tacticalCompliance = Math.max(55, 92 - fatigue * 0.25 - rand * 10);

    const confidenceLevel = Math.max(45, 85 - minuteFactor * 15 + rand * 10);

    map.set(player.id, {
      playerId: player.id,
      fatigue: Math.round(fatigue),
      readiness: Math.round(readiness),
      positionAdherence: Math.round(positionAdherence),
      currentWorkRate: Math.round(currentWorkRate),
      tacticalCompliance: Math.round(tacticalCompliance),
      confidenceLevel: Math.round(confidenceLevel),
    });
  });

  return map;
}

export function generatePlayerAlerts(
  players: Player[],
  twins: Map<string, SimpleTwin>,
  minute: number
): PlayerAlert[] {
  const alerts: PlayerAlert[] = [];

  if (minute < 30) return alerts; // No alerts early in the match

  players.forEach((player) => {
    const twin = twins.get(player.id);
    if (!twin) return;

    const posLoad = POSITION_LOAD[player.position] ?? 0.85;
    const surname = player.name.split(' ').pop() || player.name;

    // High fatigue alert
    if (twin.fatigue > 72) {
      alerts.push({
        type: 'fatigue',
        severity: twin.fatigue > 85 ? 'high' : 'medium',
        message: `${surname} fatigue at ${twin.fatigue}% — consider substitution`,
        timestamp: new Date(),
      });
    }

    // Low position adherence
    if (twin.positionAdherence < 60) {
      alerts.push({
        type: 'tactical',
        severity: twin.positionAdherence < 45 ? 'high' : 'medium',
        message: `${surname} position adherence dropped to ${twin.positionAdherence}%`,
        timestamp: new Date(),
      });
    }

    // Work rate decline for high-load positions
    if (posLoad > 0.9 && twin.currentWorkRate < 65 && minute > 60) {
      alerts.push({
        type: 'physical',
        severity: 'medium',
        message: `${surname} covering ${100 - twin.currentWorkRate}% less distance than baseline`,
        timestamp: new Date(),
      });
    }

    // Injury risk for very fatigued players
    if (twin.fatigue > 80 && posLoad > 0.9) {
      alerts.push({
        type: 'injury_risk',
        severity: 'high',
        message: `${surname} at elevated injury risk — fatigue ${twin.fatigue}%, high workload position`,
        timestamp: new Date(),
      });
    }
  });

  return alerts;
}
