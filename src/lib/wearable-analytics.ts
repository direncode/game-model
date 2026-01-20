// GPS/Wearable Data Analytics Functions

import {
  WearableData,
  TrackingMetrics,
  SpeedZoneData,
  AccelerationData,
  HeartRateData,
  HeartRateZones,
  PositionalData,
  HeatmapData,
  Player,
  PhysicalProfile,
  DigitalTwin,
  TwinState,
} from '@/types';

// ==================== Speed Zone Thresholds (km/h) ====================
const SPEED_ZONES = {
  zone1: { min: 0, max: 6 },      // Walking
  zone2: { min: 6, max: 12 },     // Jogging
  zone3: { min: 12, max: 18 },    // Running
  zone4: { min: 18, max: 21 },    // High-speed running
  zone5: { min: 21, max: 24 },    // Sprinting
  zone6: { min: 24, max: Infinity }, // Max sprinting
};

// ==================== Acceleration Thresholds (m/s²) ====================
const ACCELERATION_THRESHOLDS = {
  low: { min: 1, max: 2 },
  medium: { min: 2, max: 3 },
  high: { min: 3, max: Infinity },
};

// ==================== Heart Rate Zone Percentages ====================
const HR_ZONE_PERCENTAGES = {
  zone1: { min: 50, max: 60 },
  zone2: { min: 60, max: 70 },
  zone3: { min: 70, max: 80 },
  zone4: { min: 80, max: 90 },
  zone5: { min: 90, max: 100 },
};

// ==================== Core Calculation Functions ====================

export function calculateDistance(
  positions: { x: number; y: number; timestamp: number }[]
): number {
  let totalDistance = 0;
  for (let i = 1; i < positions.length; i++) {
    const dx = positions[i].x - positions[i - 1].x;
    const dy = positions[i].y - positions[i - 1].y;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }
  return totalDistance;
}

export function calculateSpeed(
  position1: { x: number; y: number; timestamp: number },
  position2: { x: number; y: number; timestamp: number }
): number {
  const dx = position2.x - position1.x;
  const dy = position2.y - position1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const timeDiff = (position2.timestamp - position1.timestamp) / 1000; // seconds
  const speedMs = distance / timeDiff;
  return speedMs * 3.6; // Convert to km/h
}

export function calculateAcceleration(
  speed1: number,
  speed2: number,
  timeDiff: number
): number {
  const speedMs1 = speed1 / 3.6;
  const speedMs2 = speed2 / 3.6;
  return (speedMs2 - speedMs1) / timeDiff;
}

// ==================== Distance Breakdown Functions ====================

export function calculateDistanceBySpeedZone(
  positions: { x: number; y: number; timestamp: number }[]
): { [key: string]: number } {
  const distanceByZone: { [key: string]: number } = {
    walking: 0,
    jogging: 0,
    running: 0,
    highSpeedRunning: 0,
    sprinting: 0,
    maxSprinting: 0,
  };

  for (let i = 1; i < positions.length; i++) {
    const speed = calculateSpeed(positions[i - 1], positions[i]);
    const dx = positions[i].x - positions[i - 1].x;
    const dy = positions[i].y - positions[i - 1].y;
    const segmentDistance = Math.sqrt(dx * dx + dy * dy);

    if (speed < SPEED_ZONES.zone1.max) {
      distanceByZone.walking += segmentDistance;
    } else if (speed < SPEED_ZONES.zone2.max) {
      distanceByZone.jogging += segmentDistance;
    } else if (speed < SPEED_ZONES.zone3.max) {
      distanceByZone.running += segmentDistance;
    } else if (speed < SPEED_ZONES.zone4.max) {
      distanceByZone.highSpeedRunning += segmentDistance;
    } else if (speed < SPEED_ZONES.zone5.max) {
      distanceByZone.sprinting += segmentDistance;
    } else {
      distanceByZone.maxSprinting += segmentDistance;
    }
  }

  return distanceByZone;
}

export function calculateSpeedZoneTime(
  positions: { x: number; y: number; timestamp: number }[]
): SpeedZoneData {
  const zoneTime: SpeedZoneData = {
    zone1: 0,
    zone2: 0,
    zone3: 0,
    zone4: 0,
    zone5: 0,
    zone6: 0,
  };

  for (let i = 1; i < positions.length; i++) {
    const speed = calculateSpeed(positions[i - 1], positions[i]);
    const timeDiff = (positions[i].timestamp - positions[i - 1].timestamp) / 1000;

    if (speed < SPEED_ZONES.zone1.max) {
      zoneTime.zone1 += timeDiff;
    } else if (speed < SPEED_ZONES.zone2.max) {
      zoneTime.zone2 += timeDiff;
    } else if (speed < SPEED_ZONES.zone3.max) {
      zoneTime.zone3 += timeDiff;
    } else if (speed < SPEED_ZONES.zone4.max) {
      zoneTime.zone4 += timeDiff;
    } else if (speed < SPEED_ZONES.zone5.max) {
      zoneTime.zone5 += timeDiff;
    } else {
      zoneTime.zone6 += timeDiff;
    }
  }

  return zoneTime;
}

// ==================== Acceleration Analysis ====================

export function analyzeAccelerations(
  positions: { x: number; y: number; timestamp: number }[]
): { accelerations: AccelerationData; decelerations: AccelerationData; max: number; min: number } {
  const accelerations: AccelerationData = { low: 0, medium: 0, high: 0, total: 0 };
  const decelerations: AccelerationData = { low: 0, medium: 0, high: 0, total: 0 };
  let maxAccel = 0;
  let maxDecel = 0;

  const speeds: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    speeds.push(calculateSpeed(positions[i - 1], positions[i]));
  }

  for (let i = 1; i < speeds.length; i++) {
    const timeDiff = (positions[i + 1].timestamp - positions[i].timestamp) / 1000;
    const accel = calculateAcceleration(speeds[i - 1], speeds[i], timeDiff);
    const absAccel = Math.abs(accel);

    if (accel > 0) {
      // Acceleration
      accelerations.total++;
      if (absAccel >= ACCELERATION_THRESHOLDS.high.min) {
        accelerations.high++;
        maxAccel = Math.max(maxAccel, accel);
      } else if (absAccel >= ACCELERATION_THRESHOLDS.medium.min) {
        accelerations.medium++;
      } else if (absAccel >= ACCELERATION_THRESHOLDS.low.min) {
        accelerations.low++;
      }
    } else if (accel < 0) {
      // Deceleration
      decelerations.total++;
      if (absAccel >= ACCELERATION_THRESHOLDS.high.min) {
        decelerations.high++;
        maxDecel = Math.min(maxDecel, accel);
      } else if (absAccel >= ACCELERATION_THRESHOLDS.medium.min) {
        decelerations.medium++;
      } else if (absAccel >= ACCELERATION_THRESHOLDS.low.min) {
        decelerations.low++;
      }
    }
  }

  return {
    accelerations,
    decelerations,
    max: maxAccel,
    min: maxDecel,
  };
}

// ==================== Player Load Calculation ====================

export function calculatePlayerLoad(
  accelerometerData: { x: number; y: number; z: number; timestamp: number }[]
): number {
  let playerLoad = 0;

  for (let i = 1; i < accelerometerData.length; i++) {
    const dx = Math.abs(accelerometerData[i].x - accelerometerData[i - 1].x);
    const dy = Math.abs(accelerometerData[i].y - accelerometerData[i - 1].y);
    const dz = Math.abs(accelerometerData[i].z - accelerometerData[i - 1].z);
    playerLoad += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return playerLoad / 100; // Normalize to standard units
}

export function calculateMetabolicPower(
  positions: { x: number; y: number; timestamp: number }[],
  playerMass: number = 75 // kg
): number {
  let totalPower = 0;
  let count = 0;

  for (let i = 1; i < positions.length - 1; i++) {
    const speed1 = calculateSpeed(positions[i - 1], positions[i]) / 3.6; // m/s
    const speed2 = calculateSpeed(positions[i], positions[i + 1]) / 3.6;
    const timeDiff = (positions[i + 1].timestamp - positions[i].timestamp) / 1000;
    const acceleration = (speed2 - speed1) / timeDiff;

    // Metabolic power calculation (di Prampero et al.)
    const equivalentSlope = Math.atan(acceleration / 9.81);
    const equivalentMass = Math.sqrt(1 + Math.pow(Math.tan(equivalentSlope), 2));
    const energyCost = (155.4 * Math.pow(equivalentSlope, 5) -
      30.4 * Math.pow(equivalentSlope, 4) -
      43.3 * Math.pow(equivalentSlope, 3) +
      46.3 * Math.pow(equivalentSlope, 2) +
      19.5 * equivalentSlope + 3.6) * equivalentMass;

    const power = energyCost * speed2;
    totalPower += power;
    count++;
  }

  return count > 0 ? totalPower / count : 0;
}

// ==================== Heart Rate Analysis ====================

export function analyzeHeartRate(
  heartRateData: { value: number; timestamp: number }[],
  maxHR: number
): HeartRateData {
  const values = heartRateData.map(d => d.value);
  const zones: HeartRateZones = {
    zone1: 0,
    zone2: 0,
    zone3: 0,
    zone4: 0,
    zone5: 0,
  };

  for (let i = 1; i < heartRateData.length; i++) {
    const hr = heartRateData[i].value;
    const hrPercent = (hr / maxHR) * 100;
    const timeDiff = (heartRateData[i].timestamp - heartRateData[i - 1].timestamp) / 1000;

    if (hrPercent < HR_ZONE_PERCENTAGES.zone1.max) {
      zones.zone1 += timeDiff;
    } else if (hrPercent < HR_ZONE_PERCENTAGES.zone2.max) {
      zones.zone2 += timeDiff;
    } else if (hrPercent < HR_ZONE_PERCENTAGES.zone3.max) {
      zones.zone3 += timeDiff;
    } else if (hrPercent < HR_ZONE_PERCENTAGES.zone4.max) {
      zones.zone4 += timeDiff;
    } else {
      zones.zone5 += timeDiff;
    }
  }

  return {
    current: values[values.length - 1] || 0,
    average: values.reduce((a, b) => a + b, 0) / values.length,
    max: Math.max(...values),
    min: Math.min(...values),
    zones,
  };
}

// ==================== Positional Heatmap ====================

export function generateHeatmap(
  positions: { x: number; y: number; timestamp: number }[],
  pitchLength: number = 105,
  pitchWidth: number = 68,
  resolution: { x: number; y: number } = { x: 21, y: 14 }
): HeatmapData {
  const cells: number[][] = Array(resolution.y)
    .fill(null)
    .map(() => Array(resolution.x).fill(0));

  const cellWidth = pitchLength / resolution.x;
  const cellHeight = pitchWidth / resolution.y;

  for (let i = 1; i < positions.length; i++) {
    const x = Math.min(Math.floor((positions[i].x + pitchLength / 2) / cellWidth), resolution.x - 1);
    const y = Math.min(Math.floor((positions[i].y + pitchWidth / 2) / cellHeight), resolution.y - 1);
    const timeDiff = (positions[i].timestamp - positions[i - 1].timestamp) / 1000;

    if (x >= 0 && x < resolution.x && y >= 0 && y < resolution.y) {
      cells[y][x] += timeDiff;
    }
  }

  // Normalize to percentages
  const totalTime = positions.length > 1 ?
    (positions[positions.length - 1].timestamp - positions[0].timestamp) / 1000 : 1;

  for (let y = 0; y < resolution.y; y++) {
    for (let x = 0; x < resolution.x; x++) {
      cells[y][x] = (cells[y][x] / totalTime) * 100;
    }
  }

  return { cells, resolution };
}

// ==================== Comprehensive Metrics Calculation ====================

export function calculateTrackingMetrics(
  positions: { x: number; y: number; timestamp: number }[],
  accelerometerData?: { x: number; y: number; z: number; timestamp: number }[],
  heartRateData?: { value: number; timestamp: number }[],
  maxHR: number = 190
): TrackingMetrics {
  const totalDistance = calculateDistance(positions);
  const duration = positions.length > 1 ?
    (positions[positions.length - 1].timestamp - positions[0].timestamp) / 60000 : 1; // minutes

  const distanceByZone = calculateDistanceBySpeedZone(positions);
  const speedZones = calculateSpeedZoneTime(positions);
  const accelAnalysis = analyzeAccelerations(positions);

  const speeds: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    speeds.push(calculateSpeed(positions[i - 1], positions[i]));
  }

  const currentSpeed = speeds.length > 0 ? speeds[speeds.length - 1] : 0;
  const averageSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

  const playerLoad = accelerometerData ? calculatePlayerLoad(accelerometerData) : 0;
  const metabolicPower = calculateMetabolicPower(positions);

  const heatmap = generateHeatmap(positions);
  const lastPos = positions[positions.length - 1] || { x: 0, y: 0 };

  const metrics: TrackingMetrics = {
    totalDistance,
    distancePerMinute: totalDistance / duration,
    highSpeedRunningDistance: distanceByZone.highSpeedRunning + distanceByZone.sprinting,
    sprintDistance: distanceByZone.sprinting + distanceByZone.maxSprinting,
    walkingDistance: distanceByZone.walking,
    joggingDistance: distanceByZone.jogging,
    runningDistance: distanceByZone.running,
    currentSpeed,
    averageSpeed,
    maxSpeed,
    speedZones,
    accelerations: accelAnalysis.accelerations,
    decelerations: accelAnalysis.decelerations,
    maxAcceleration: accelAnalysis.max,
    maxDeceleration: accelAnalysis.min,
    playerLoad,
    playerLoadPerMinute: playerLoad / duration,
    metabolicPower,
    highMetabolicLoadDistance: distanceByZone.highSpeedRunning + distanceByZone.sprinting + distanceByZone.maxSprinting,
    position: {
      x: lastPos.x,
      y: lastPos.y,
      zone: determineZone(lastPos.x, lastPos.y),
      heatmap,
    },
  };

  if (heartRateData && heartRateData.length > 0) {
    metrics.heartRate = analyzeHeartRate(heartRateData, maxHR);
  }

  return metrics;
}

function determineZone(x: number, y: number): PositionalData['zone'] {
  // Assuming pitch is 105m x 68m, centered at 0,0
  const pitchLength = 105;

  if (x < -pitchLength / 6) {
    return 'defensive_third';
  } else if (x > pitchLength / 6) {
    return 'attacking_third';
  }
  return 'middle_third';
}

// ==================== Digital Twin State Calculation ====================

export function calculateTwinState(
  currentMetrics: TrackingMetrics,
  baseline: TrackingMetrics,
  matchMinute: number
): TwinState {
  // Calculate fatigue based on accumulated load vs expected
  const expectedLoadRatio = matchMinute / 90;
  const actualLoadRatio = currentMetrics.playerLoad / (baseline.playerLoad || 1);
  const fatigueScore = Math.min(100, Math.max(0, (actualLoadRatio / expectedLoadRatio) * 50));

  // Calculate readiness based on recent performance
  const speedRatio = currentMetrics.averageSpeed / (baseline.averageSpeed || 1);
  const readinessScore = Math.min(100, Math.max(0, speedRatio * 100));

  // Calculate work rate
  const distanceRatio = currentMetrics.distancePerMinute / (baseline.distancePerMinute || 1);
  const workRate = Math.min(100, Math.max(0, distanceRatio * 100));

  return {
    fatigue: fatigueScore,
    readiness: readinessScore,
    confidenceLevel: 85, // Base confidence
    currentWorkRate: workRate,
    positionAdherence: 0, // Calculated separately with tactical data
    tacticalCompliance: 0, // Calculated separately with game model
  };
}

// ==================== Advanced Derivative Metrics ====================

export function calculateSprintRecovery(
  positions: { x: number; y: number; timestamp: number }[]
): { avgRecoveryTime: number; sprints: { startTime: number; endTime: number; recoveryTime: number }[] } {
  const sprints: { startTime: number; endTime: number; recoveryTime: number }[] = [];
  let sprintStart: number | null = null;
  let lastSprintEnd: number | null = null;

  for (let i = 1; i < positions.length; i++) {
    const speed = calculateSpeed(positions[i - 1], positions[i]);

    if (speed >= 24 && sprintStart === null) {
      // Sprint started
      sprintStart = positions[i].timestamp;
    } else if (speed < 24 && sprintStart !== null) {
      // Sprint ended
      const sprintEnd = positions[i].timestamp;
      const recoveryTime = lastSprintEnd ? (sprintStart - lastSprintEnd) / 1000 : 0;

      sprints.push({
        startTime: sprintStart,
        endTime: sprintEnd,
        recoveryTime,
      });

      lastSprintEnd = sprintEnd;
      sprintStart = null;
    }
  }

  const avgRecoveryTime = sprints.length > 1 ?
    sprints.slice(1).reduce((sum, s) => sum + s.recoveryTime, 0) / (sprints.length - 1) : 0;

  return { avgRecoveryTime, sprints };
}

export function calculateWorkRateDecay(
  positions: { x: number; y: number; timestamp: number }[],
  windowSize: number = 5 // minutes
): number[] {
  const decay: number[] = [];
  const windowMs = windowSize * 60 * 1000;

  if (positions.length < 2) return decay;

  const startTime = positions[0].timestamp;
  const endTime = positions[positions.length - 1].timestamp;

  for (let windowStart = startTime; windowStart < endTime - windowMs; windowStart += windowMs) {
    const windowPositions = positions.filter(
      p => p.timestamp >= windowStart && p.timestamp < windowStart + windowMs
    );

    if (windowPositions.length > 1) {
      const distance = calculateDistance(windowPositions);
      decay.push(distance / windowSize); // meters per minute
    }
  }

  return decay;
}

export function calculateEffectivePlayingTime(
  positions: { x: number; y: number; timestamp: number }[]
): { totalTime: number; activeTime: number; ratio: number } {
  let activeTime = 0;
  const activeThreshold = 2; // km/h

  for (let i = 1; i < positions.length; i++) {
    const speed = calculateSpeed(positions[i - 1], positions[i]);
    const timeDiff = (positions[i].timestamp - positions[i - 1].timestamp) / 1000;

    if (speed > activeThreshold) {
      activeTime += timeDiff;
    }
  }

  const totalTime = positions.length > 1 ?
    (positions[positions.length - 1].timestamp - positions[0].timestamp) / 1000 : 0;

  return {
    totalTime,
    activeTime,
    ratio: totalTime > 0 ? activeTime / totalTime : 0,
  };
}

// ==================== Team-Level Metrics ====================

export function calculateTeamCompactness(
  playerPositions: Map<string, { x: number; y: number }>
): { horizontal: number; vertical: number; area: number } {
  const positions = Array.from(playerPositions.values());

  if (positions.length < 2) {
    return { horizontal: 0, vertical: 0, area: 0 };
  }

  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);

  const horizontal = Math.max(...xs) - Math.min(...xs);
  const vertical = Math.max(...ys) - Math.min(...ys);

  return {
    horizontal,
    vertical,
    area: horizontal * vertical,
  };
}

export function calculateFormationShape(
  playerPositions: Map<string, { x: number; y: number; role: string }>
): { centroid: { x: number; y: number }; spread: number; asymmetry: number } {
  const positions = Array.from(playerPositions.values());

  const centroidX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
  const centroidY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

  const spread = Math.sqrt(
    positions.reduce((sum, p) =>
      sum + Math.pow(p.x - centroidX, 2) + Math.pow(p.y - centroidY, 2), 0
    ) / positions.length
  );

  // Calculate asymmetry (difference between left and right spread)
  const leftPlayers = positions.filter(p => p.y < 0);
  const rightPlayers = positions.filter(p => p.y > 0);

  const leftSpread = leftPlayers.length > 0 ?
    Math.abs(Math.min(...leftPlayers.map(p => p.y))) : 0;
  const rightSpread = rightPlayers.length > 0 ?
    Math.max(...rightPlayers.map(p => p.y)) : 0;

  const asymmetry = Math.abs(leftSpread - rightSpread);

  return {
    centroid: { x: centroidX, y: centroidY },
    spread,
    asymmetry,
  };
}

// ==================== Export utilities ====================

export function aggregateSessionMetrics(
  sessionData: WearableData[]
): TrackingMetrics | null {
  if (sessionData.length === 0) return null;

  const aggregated: TrackingMetrics = {
    totalDistance: 0,
    distancePerMinute: 0,
    highSpeedRunningDistance: 0,
    sprintDistance: 0,
    walkingDistance: 0,
    joggingDistance: 0,
    runningDistance: 0,
    currentSpeed: 0,
    averageSpeed: 0,
    maxSpeed: 0,
    speedZones: { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0, zone6: 0 },
    accelerations: { low: 0, medium: 0, high: 0, total: 0 },
    decelerations: { low: 0, medium: 0, high: 0, total: 0 },
    maxAcceleration: 0,
    maxDeceleration: 0,
    playerLoad: 0,
    playerLoadPerMinute: 0,
    metabolicPower: 0,
    highMetabolicLoadDistance: 0,
    position: {
      x: 0,
      y: 0,
      zone: 'middle_third',
      heatmap: { cells: [], resolution: { x: 21, y: 14 } },
    },
  };

  for (const data of sessionData) {
    const m = data.metrics;
    aggregated.totalDistance += m.totalDistance;
    aggregated.highSpeedRunningDistance += m.highSpeedRunningDistance;
    aggregated.sprintDistance += m.sprintDistance;
    aggregated.walkingDistance += m.walkingDistance;
    aggregated.joggingDistance += m.joggingDistance;
    aggregated.runningDistance += m.runningDistance;
    aggregated.playerLoad += m.playerLoad;
    aggregated.maxSpeed = Math.max(aggregated.maxSpeed, m.maxSpeed);
    aggregated.maxAcceleration = Math.max(aggregated.maxAcceleration, m.maxAcceleration);
    aggregated.maxDeceleration = Math.min(aggregated.maxDeceleration, m.maxDeceleration);

    // Aggregate speed zones
    aggregated.speedZones.zone1 += m.speedZones.zone1;
    aggregated.speedZones.zone2 += m.speedZones.zone2;
    aggregated.speedZones.zone3 += m.speedZones.zone3;
    aggregated.speedZones.zone4 += m.speedZones.zone4;
    aggregated.speedZones.zone5 += m.speedZones.zone5;
    aggregated.speedZones.zone6 += m.speedZones.zone6;

    // Aggregate accelerations
    aggregated.accelerations.low += m.accelerations.low;
    aggregated.accelerations.medium += m.accelerations.medium;
    aggregated.accelerations.high += m.accelerations.high;
    aggregated.accelerations.total += m.accelerations.total;

    aggregated.decelerations.low += m.decelerations.low;
    aggregated.decelerations.medium += m.decelerations.medium;
    aggregated.decelerations.high += m.decelerations.high;
    aggregated.decelerations.total += m.decelerations.total;
  }

  // Calculate averages
  const count = sessionData.length;
  aggregated.averageSpeed = sessionData.reduce((sum, d) => sum + d.metrics.averageSpeed, 0) / count;
  aggregated.metabolicPower = sessionData.reduce((sum, d) => sum + d.metrics.metabolicPower, 0) / count;

  // Get last position
  const lastData = sessionData[sessionData.length - 1];
  aggregated.currentSpeed = lastData.metrics.currentSpeed;
  aggregated.position = lastData.metrics.position;

  return aggregated;
}
