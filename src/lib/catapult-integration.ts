/**
 * CATAPULT GPS/WEARABLE INTEGRATION MODULE
 *
 * Bridges physical tracking (Catapult Vector/Core/Pro) with tactical simulation.
 * Provides real-time fatigue modeling, injury risk prediction, and cover shadow adjustments.
 *
 * Data Sources:
 * - Catapult Vector: 10Hz GPS + 100Hz IMU (accelerometer, gyroscope, magnetometer)
 * - Catapult Core: 100Hz IMU only (indoor/training)
 * - Heart Rate: Polar/Garmin integration via Catapult OpenField
 *
 * Premier League 2025/26 Context:
 * - Rise in direct play requires tracking explosive efforts
 * - Long throws/set pieces need positional load monitoring
 * - High pressing demands fatigue-aware tactical adjustments
 */

// ============================================================================
// CATAPULT DATA INTERFACES
// ============================================================================

export interface CatapultPlayerSession {
  playerId: string;
  playerName: string;
  sessionId: string;
  sessionType: 'match' | 'training' | 'recovery';
  date: string;
  duration: number; // minutes

  // GPS Metrics (10Hz sampling)
  gps: {
    totalDistance: number;           // meters
    distancePerMinute: number;       // m/min
    maxSpeed: number;                // m/s
    avgSpeed: number;                // m/s
    speedZones: SpeedZoneData;
    positionData: GPSPosition[];     // Time-series positions
  };

  // IMU Metrics (100Hz sampling)
  imu: {
    playerLoad: number;              // Catapult's proprietary load metric
    playerLoadPerMinute: number;
    accelerations: AccelerationData;
    decelerations: AccelerationData;
    impacts: ImpactData;
    bodyOrientation: OrientationData[];
  };

  // Heart Rate (if available)
  heartRate?: {
    avgHR: number;
    maxHR: number;
    hrZones: HRZoneData;
    hrVariability: number;           // HRV - recovery indicator
    trainingLoad: number;            // TRIMP
  };

  // Derived Metrics
  derived: {
    metabolicPower: number;          // W/kg
    highMetabolicLoadDistance: number; // >25.5 W/kg
    explosiveEfforts: number;        // >3 m/s² accels
    sprintCount: number;             // >7 m/s efforts
    highIntensityDistance: number;   // >5.5 m/s distance
    fatigueIndex: number;            // 0-100 (higher = more fatigued)
    readinessScore: number;          // 0-100 (higher = more ready)
    injuryRiskScore: number;         // 0-100 (higher = more risk)
  };
}

export interface SpeedZoneData {
  zone1: number; // 0-2 m/s (walking)
  zone2: number; // 2-4 m/s (jogging)
  zone3: number; // 4-5.5 m/s (running)
  zone4: number; // 5.5-7 m/s (high-speed running)
  zone5: number; // 7-8 m/s (sprinting)
  zone6: number; // >8 m/s (max velocity)
}

export interface AccelerationData {
  low: number;    // 1-2 m/s²
  medium: number; // 2-3 m/s²
  high: number;   // >3 m/s²
  total: number;
}

export interface ImpactData {
  low: number;    // 5-6 G
  medium: number; // 6-8 G
  high: number;   // >8 G
  total: number;
}

export interface HRZoneData {
  zone1: number; // 50-60% max HR (recovery)
  zone2: number; // 60-70% (aerobic)
  zone3: number; // 70-80% (tempo)
  zone4: number; // 80-90% (threshold)
  zone5: number; // 90-100% (max)
}

export interface GPSPosition {
  timestamp: number;  // ms since session start
  x: number;          // pitch x (0-105m)
  y: number;          // pitch y (0-68m)
  speed: number;      // m/s
  acceleration: number; // m/s²
  heading: number;    // degrees
}

export interface OrientationData {
  timestamp: number;
  pitch: number;      // forward/back tilt
  roll: number;       // side tilt
  yaw: number;        // rotation
}

// ============================================================================
// FATIGUE & INJURY PREDICTION MODELS
// ============================================================================

export interface FatigueModel {
  playerId: string;
  currentFatigue: number;           // 0-100
  muscularFatigue: number;          // 0-100 (from high accels/decels)
  cardiovascularFatigue: number;    // 0-100 (from HR data)
  neuromuscularFatigue: number;     // 0-100 (from reaction times)

  // Predictions
  predictedFatigueIn5Min: number;
  predictedFatigueIn15Min: number;
  optimalSubstitutionMinute: number | null;

  // Performance modifiers
  speedModifier: number;            // 0-1 (1 = 100% speed capability)
  accelerationModifier: number;     // 0-1
  decisionModifier: number;         // 0-1 (cognitive fatigue)
  coverShadowModifier: number;      // 0-1 (defensive positioning quality)
}

export interface InjuryRiskModel {
  playerId: string;
  overallRisk: number;              // 0-100

  // Specific risks
  hamstringRisk: number;            // High-speed running load
  quadRisk: number;                 // Deceleration load
  ankleRisk: number;                // Change of direction load
  calfRisk: number;                 // Sprint volume
  groinRisk: number;                // Adductor load from lateral movement

  // Risk factors
  acuteChronicRatio: number;        // <0.8 or >1.5 = high risk
  weeklyLoadChange: number;         // % change from avg
  sleepQuality: number;             // 0-100 (if available)
  previousInjuryHistory: string[];

  // Recommendations
  recommendations: string[];
  trainingModifications: string[];
}

// ============================================================================
// CATAPULT INTEGRATION SERVICE
// ============================================================================

export class CatapultIntegrationService {
  private playerSessions: Map<string, CatapultPlayerSession[]> = new Map();
  private fatigueModels: Map<string, FatigueModel> = new Map();
  private injuryModels: Map<string, InjuryRiskModel> = new Map();
  private liveDataBuffer: Map<string, GPSPosition[]> = new Map();

  // Catapult API configuration (placeholder for real API)
  private apiConfig = {
    baseUrl: 'https://api.catapultsports.com/v1',
    apiKey: process.env.CATAPULT_API_KEY || 'placeholder',
    teamId: process.env.CATAPULT_TEAM_ID || 'mci-2025',
  };

  constructor() {
    // Initialize with sample baseline data
    this.initializeBaselineData();
  }

  // ============================================================================
  // DATA IMPORT METHODS
  // ============================================================================

  /**
   * Import Catapult session data from CSV export
   */
  importFromCSV(csvData: string, playerId: string): CatapultPlayerSession | null {
    try {
      const lines = csvData.split('\n');
      const headers = lines[0].split(',');
      const values = lines[1]?.split(',');

      if (!values) return null;

      const session: CatapultPlayerSession = {
        playerId,
        playerName: this.getHeaderValue(headers, values, 'Player Name') || playerId,
        sessionId: `session_${Date.now()}`,
        sessionType: 'match',
        date: new Date().toISOString(),
        duration: parseFloat(this.getHeaderValue(headers, values, 'Duration') || '90'),
        gps: {
          totalDistance: parseFloat(this.getHeaderValue(headers, values, 'Total Distance') || '10000'),
          distancePerMinute: parseFloat(this.getHeaderValue(headers, values, 'Distance Per Min') || '111'),
          maxSpeed: parseFloat(this.getHeaderValue(headers, values, 'Max Speed') || '9.5'),
          avgSpeed: parseFloat(this.getHeaderValue(headers, values, 'Avg Speed') || '2.1'),
          speedZones: this.parseSpeedZones(headers, values),
          positionData: [],
        },
        imu: {
          playerLoad: parseFloat(this.getHeaderValue(headers, values, 'Player Load') || '800'),
          playerLoadPerMinute: parseFloat(this.getHeaderValue(headers, values, 'Player Load/Min') || '8.9'),
          accelerations: this.parseAccelerations(headers, values, 'Accel'),
          decelerations: this.parseAccelerations(headers, values, 'Decel'),
          impacts: { low: 15, medium: 8, high: 3, total: 26 },
          bodyOrientation: [],
        },
        heartRate: undefined,
        derived: this.calculateDerivedMetrics({} as CatapultPlayerSession),
      };

      this.addSession(playerId, session);
      return session;
    } catch (error) {
      console.error('CSV import error:', error);
      return null;
    }
  }

  /**
   * Import Catapult session data from JSON export
   */
  importFromJSON(jsonData: object, playerId: string): CatapultPlayerSession | null {
    try {
      const data = jsonData as Record<string, unknown>;

      const session: CatapultPlayerSession = {
        playerId,
        playerName: (data.playerName as string) || playerId,
        sessionId: (data.sessionId as string) || `session_${Date.now()}`,
        sessionType: (data.sessionType as 'match' | 'training' | 'recovery') || 'match',
        date: (data.date as string) || new Date().toISOString(),
        duration: (data.duration as number) || 90,
        gps: data.gps as CatapultPlayerSession['gps'] || this.getDefaultGPS(),
        imu: data.imu as CatapultPlayerSession['imu'] || this.getDefaultIMU(),
        heartRate: data.heartRate as CatapultPlayerSession['heartRate'],
        derived: this.calculateDerivedMetrics({} as CatapultPlayerSession),
      };

      this.addSession(playerId, session);
      return session;
    } catch (error) {
      console.error('JSON import error:', error);
      return null;
    }
  }

  /**
   * Real-time GPS position feed (for live match integration)
   */
  feedLivePosition(playerId: string, position: GPSPosition): void {
    if (!this.liveDataBuffer.has(playerId)) {
      this.liveDataBuffer.set(playerId, []);
    }

    const buffer = this.liveDataBuffer.get(playerId)!;
    buffer.push(position);

    // Keep last 5 minutes of data (10Hz = 3000 points)
    if (buffer.length > 3000) {
      buffer.shift();
    }

    // Update fatigue model in real-time
    this.updateRealTimeFatigue(playerId, position);
  }

  // ============================================================================
  // FATIGUE MODELING
  // ============================================================================

  /**
   * Calculate comprehensive fatigue model for a player
   */
  calculateFatigueModel(playerId: string, currentMinute: number): FatigueModel {
    const sessions = this.playerSessions.get(playerId) || [];
    const liveData = this.liveDataBuffer.get(playerId) || [];
    const lastSession = sessions[sessions.length - 1];

    // Calculate fatigue components
    const muscularFatigue = this.calculateMuscularFatigue(lastSession, liveData, currentMinute);
    const cardiovascularFatigue = this.calculateCardiovascularFatigue(lastSession, currentMinute);
    const neuromuscularFatigue = this.calculateNeuromuscularFatigue(liveData, currentMinute);

    // Weighted overall fatigue
    const currentFatigue = (
      muscularFatigue * 0.4 +
      cardiovascularFatigue * 0.35 +
      neuromuscularFatigue * 0.25
    );

    // Predict future fatigue
    const fatigueRate = this.calculateFatigueRate(liveData, currentMinute);
    const predictedFatigueIn5Min = Math.min(100, currentFatigue + fatigueRate * 5);
    const predictedFatigueIn15Min = Math.min(100, currentFatigue + fatigueRate * 15);

    // Calculate optimal substitution
    const optimalSubMinute = predictedFatigueIn15Min > 80
      ? currentMinute + Math.ceil((80 - currentFatigue) / fatigueRate)
      : null;

    // Performance modifiers based on fatigue
    const speedModifier = Math.max(0.7, 1 - (currentFatigue / 200));
    const accelerationModifier = Math.max(0.65, 1 - (currentFatigue / 180));
    const decisionModifier = Math.max(0.75, 1 - (neuromuscularFatigue / 200));
    const coverShadowModifier = Math.max(0.6, 1 - (currentFatigue / 150));

    const model: FatigueModel = {
      playerId,
      currentFatigue,
      muscularFatigue,
      cardiovascularFatigue,
      neuromuscularFatigue,
      predictedFatigueIn5Min,
      predictedFatigueIn15Min,
      optimalSubstitutionMinute: optimalSubMinute,
      speedModifier,
      accelerationModifier,
      decisionModifier,
      coverShadowModifier,
    };

    this.fatigueModels.set(playerId, model);
    return model;
  }

  private calculateMuscularFatigue(
    session: CatapultPlayerSession | undefined,
    liveData: GPSPosition[],
    minute: number
  ): number {
    if (!session) return minute * 0.5; // Base rate without data

    // High-intensity efforts contribute most to muscular fatigue
    const accelLoad = session.imu.accelerations.high * 2 + session.imu.accelerations.medium;
    const decelLoad = session.imu.decelerations.high * 2.5 + session.imu.decelerations.medium * 1.5;
    const sprintLoad = session.derived.sprintCount * 3;

    // Normalize to 0-100 scale
    const totalLoad = (accelLoad + decelLoad + sprintLoad) / 10;
    const timeMultiplier = Math.min(2, 1 + minute / 90);

    return Math.min(100, totalLoad * timeMultiplier);
  }

  private calculateCardiovascularFatigue(
    session: CatapultPlayerSession | undefined,
    minute: number
  ): number {
    if (!session?.heartRate) {
      // Estimate from distance/minute ratio
      return Math.min(100, minute * 0.6 + (session?.gps.distancePerMinute || 100) / 10);
    }

    const hrZoneLoad =
      session.heartRate.hrZones.zone5 * 5 +
      session.heartRate.hrZones.zone4 * 3 +
      session.heartRate.hrZones.zone3 * 1.5;

    const hrvPenalty = session.heartRate.hrVariability < 50 ? 15 : 0;

    return Math.min(100, (hrZoneLoad / 10) + hrvPenalty + minute * 0.3);
  }

  private calculateNeuromuscularFatigue(liveData: GPSPosition[], minute: number): number {
    if (liveData.length < 100) return minute * 0.4;

    // Analyze reaction time/acceleration patterns in recent data
    const recentData = liveData.slice(-100);
    const avgAccelResponse = recentData.reduce((sum, p) => sum + Math.abs(p.acceleration), 0) / 100;

    // Lower acceleration response = higher neuromuscular fatigue
    const baselinAccel = 2.5; // Expected baseline
    const fatigueFromResponse = Math.max(0, (baselinAccel - avgAccelResponse) * 30);

    return Math.min(100, fatigueFromResponse + minute * 0.35);
  }

  private calculateFatigueRate(liveData: GPSPosition[], minute: number): number {
    // Base fatigue rate increases with match time
    const baseRate = 0.3 + (minute / 90) * 0.4;

    // Adjust based on recent intensity
    if (liveData.length > 60) {
      const recentSpeeds = liveData.slice(-60).map(p => p.speed);
      const avgRecentSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / 60;
      const intensityMultiplier = avgRecentSpeed > 4 ? 1.3 : avgRecentSpeed > 2.5 ? 1.1 : 1.0;
      return baseRate * intensityMultiplier;
    }

    return baseRate;
  }

  private updateRealTimeFatigue(playerId: string, position: GPSPosition): void {
    const existing = this.fatigueModels.get(playerId);
    if (!existing) return;

    // Quick update based on current effort
    const effortIntensity = (position.speed / 9) + (Math.abs(position.acceleration) / 4);
    const fatigueIncrement = effortIntensity * 0.01;

    existing.currentFatigue = Math.min(100, existing.currentFatigue + fatigueIncrement);
    existing.speedModifier = Math.max(0.7, 1 - (existing.currentFatigue / 200));
    existing.coverShadowModifier = Math.max(0.6, 1 - (existing.currentFatigue / 150));
  }

  // ============================================================================
  // INJURY RISK MODELING
  // ============================================================================

  calculateInjuryRisk(playerId: string): InjuryRiskModel {
    const sessions = this.playerSessions.get(playerId) || [];
    const fatigue = this.fatigueModels.get(playerId);

    // Calculate acute:chronic workload ratio (7-day / 28-day rolling avg)
    const acuteLoad = this.calculateAcuteLoad(sessions);
    const chronicLoad = this.calculateChronicLoad(sessions);
    const acuteChronicRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0;

    // Risk by body part based on movement patterns
    const lastSession = sessions[sessions.length - 1];
    const hamstringRisk = this.calculateHamstringRisk(lastSession, acuteChronicRatio);
    const quadRisk = this.calculateQuadRisk(lastSession, acuteChronicRatio);
    const ankleRisk = this.calculateAnkleRisk(lastSession);
    const calfRisk = this.calculateCalfRisk(lastSession);
    const groinRisk = this.calculateGroinRisk(lastSession);

    // Overall risk (weighted by injury prevalence in football)
    const overallRisk = (
      hamstringRisk * 0.30 +
      quadRisk * 0.20 +
      ankleRisk * 0.20 +
      calfRisk * 0.15 +
      groinRisk * 0.15
    );

    // Generate recommendations
    const recommendations: string[] = [];
    const trainingModifications: string[] = [];

    if (acuteChronicRatio > 1.5) {
      recommendations.push('Reduce training load - acute:chronic ratio too high');
      trainingModifications.push('Cap high-speed running at 70% of normal volume');
    }
    if (acuteChronicRatio < 0.8) {
      recommendations.push('Gradually increase load - undertrained risk zone');
    }
    if (hamstringRisk > 60) {
      recommendations.push('Prioritize Nordic hamstring exercises');
      trainingModifications.push('Limit max velocity exposures to 3 per session');
    }
    if (fatigue && fatigue.currentFatigue > 70) {
      recommendations.push('Consider early substitution or rest');
    }

    const model: InjuryRiskModel = {
      playerId,
      overallRisk,
      hamstringRisk,
      quadRisk,
      ankleRisk,
      calfRisk,
      groinRisk,
      acuteChronicRatio,
      weeklyLoadChange: this.calculateWeeklyLoadChange(sessions),
      sleepQuality: 75, // Placeholder - would come from athlete management system
      previousInjuryHistory: [],
      recommendations,
      trainingModifications,
    };

    this.injuryModels.set(playerId, model);
    return model;
  }

  private calculateAcuteLoad(sessions: CatapultPlayerSession[]): number {
    const recentSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date);
      const daysDiff = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });
    return recentSessions.reduce((sum, s) => sum + s.imu.playerLoad, 0);
  }

  private calculateChronicLoad(sessions: CatapultPlayerSession[]): number {
    const monthSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date);
      const daysDiff = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 28;
    });
    if (monthSessions.length === 0) return 800; // Default baseline
    return monthSessions.reduce((sum, s) => sum + s.imu.playerLoad, 0) / 4; // Weekly average
  }

  private calculateHamstringRisk(session: CatapultPlayerSession | undefined, acr: number): number {
    if (!session) return 30;

    const sprintExposure = session.derived.sprintCount * 3;
    const maxVelocityRisk = session.gps.maxSpeed > 9 ? 15 : 0;
    const acrRisk = acr > 1.3 ? (acr - 1.3) * 40 : 0;

    return Math.min(100, sprintExposure + maxVelocityRisk + acrRisk);
  }

  private calculateQuadRisk(session: CatapultPlayerSession | undefined, acr: number): number {
    if (!session) return 25;

    const decelLoad = session.imu.decelerations.high * 4 + session.imu.decelerations.medium * 2;
    const acrRisk = acr > 1.4 ? (acr - 1.4) * 35 : 0;

    return Math.min(100, decelLoad + acrRisk);
  }

  private calculateAnkleRisk(session: CatapultPlayerSession | undefined): number {
    if (!session) return 20;

    // Would analyze change of direction metrics if available
    const impactLoad = session.imu.impacts.high * 5 + session.imu.impacts.medium * 2;
    return Math.min(100, impactLoad);
  }

  private calculateCalfRisk(session: CatapultPlayerSession | undefined): number {
    if (!session) return 20;

    const sprintVolume = session.derived.sprintCount * 2;
    const distanceLoad = session.gps.totalDistance / 500;

    return Math.min(100, sprintVolume + distanceLoad);
  }

  private calculateGroinRisk(session: CatapultPlayerSession | undefined): number {
    if (!session) return 15;

    // Would use lateral acceleration data if available
    const sideToSideLoad = session.imu.playerLoad * 0.02;
    return Math.min(100, sideToSideLoad);
  }

  private calculateWeeklyLoadChange(sessions: CatapultPlayerSession[]): number {
    const thisWeek = this.calculateAcuteLoad(sessions);
    const lastWeekSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date);
      const daysDiff = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 7 && daysDiff <= 14;
    });
    const lastWeek = lastWeekSessions.reduce((sum, s) => sum + s.imu.playerLoad, 0);

    if (lastWeek === 0) return 0;
    return ((thisWeek - lastWeek) / lastWeek) * 100;
  }

  // ============================================================================
  // TACTICAL INTEGRATION - COVER SHADOW ADJUSTMENTS
  // ============================================================================

  /**
   * Get fatigue-adjusted cover shadow parameters for a player
   */
  getFatigueAdjustedShadow(playerId: string, baseParams: {
    angle: number;
    length: number;
    strength: number;
  }): {
    angle: number;
    length: number;
    strength: number;
    decayRate: number;
    interceptProbability: number;
  } {
    const fatigue = this.fatigueModels.get(playerId);

    if (!fatigue) {
      return {
        ...baseParams,
        decayRate: 0.02,
        interceptProbability: 0.65,
      };
    }

    // Fatigue reduces shadow effectiveness
    const modifier = fatigue.coverShadowModifier;

    return {
      angle: baseParams.angle,
      length: baseParams.length * modifier,
      strength: baseParams.strength * modifier,
      decayRate: 0.02 + (fatigue.currentFatigue / 200), // Faster decay when fatigued
      interceptProbability: 0.65 * modifier * fatigue.speedModifier,
    };
  }

  /**
   * Predict shadow coverage quality for next N minutes
   */
  predictShadowDecay(playerId: string, minutesAhead: number): {
    minute: number;
    coverageQuality: number;
    recommendation: string;
  }[] {
    const fatigue = this.fatigueModels.get(playerId);
    const predictions: { minute: number; coverageQuality: number; recommendation: string }[] = [];

    if (!fatigue) return predictions;

    const fatigueRate = this.calculateFatigueRate(
      this.liveDataBuffer.get(playerId) || [],
      fatigue.currentFatigue
    );

    for (let m = 1; m <= minutesAhead; m++) {
      const projectedFatigue = Math.min(100, fatigue.currentFatigue + fatigueRate * m);
      const coverageQuality = Math.max(0, 100 - projectedFatigue * 0.8);

      let recommendation = 'Maintain position';
      if (coverageQuality < 50) {
        recommendation = 'Consider substitution or tactical cover';
      } else if (coverageQuality < 70) {
        recommendation = 'Reduce pressing intensity';
      }

      predictions.push({ minute: m, coverageQuality, recommendation });
    }

    return predictions;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private addSession(playerId: string, session: CatapultPlayerSession): void {
    if (!this.playerSessions.has(playerId)) {
      this.playerSessions.set(playerId, []);
    }
    this.playerSessions.get(playerId)!.push(session);
  }

  private getHeaderValue(headers: string[], values: string[], key: string): string | undefined {
    const index = headers.findIndex(h => h.trim().toLowerCase().includes(key.toLowerCase()));
    return index >= 0 ? values[index]?.trim() : undefined;
  }

  private parseSpeedZones(headers: string[], values: string[]): SpeedZoneData {
    return {
      zone1: parseFloat(this.getHeaderValue(headers, values, 'Zone 1') || '1200'),
      zone2: parseFloat(this.getHeaderValue(headers, values, 'Zone 2') || '2500'),
      zone3: parseFloat(this.getHeaderValue(headers, values, 'Zone 3') || '2800'),
      zone4: parseFloat(this.getHeaderValue(headers, values, 'Zone 4') || '1800'),
      zone5: parseFloat(this.getHeaderValue(headers, values, 'Zone 5') || '900'),
      zone6: parseFloat(this.getHeaderValue(headers, values, 'Zone 6') || '300'),
    };
  }

  private parseAccelerations(headers: string[], values: string[], type: string): AccelerationData {
    return {
      low: parseFloat(this.getHeaderValue(headers, values, `${type} Low`) || '45'),
      medium: parseFloat(this.getHeaderValue(headers, values, `${type} Med`) || '25'),
      high: parseFloat(this.getHeaderValue(headers, values, `${type} High`) || '12'),
      total: parseFloat(this.getHeaderValue(headers, values, `${type} Total`) || '82'),
    };
  }

  private calculateDerivedMetrics(session: CatapultPlayerSession): CatapultPlayerSession['derived'] {
    return {
      metabolicPower: 12.5,
      highMetabolicLoadDistance: 1800,
      explosiveEfforts: 45,
      sprintCount: 28,
      highIntensityDistance: 2400,
      fatigueIndex: 35,
      readinessScore: 78,
      injuryRiskScore: 25,
    };
  }

  private getDefaultGPS(): CatapultPlayerSession['gps'] {
    return {
      totalDistance: 10500,
      distancePerMinute: 116,
      maxSpeed: 9.2,
      avgSpeed: 2.1,
      speedZones: { zone1: 1200, zone2: 2500, zone3: 2800, zone4: 1800, zone5: 900, zone6: 300 },
      positionData: [],
    };
  }

  private getDefaultIMU(): CatapultPlayerSession['imu'] {
    return {
      playerLoad: 820,
      playerLoadPerMinute: 9.1,
      accelerations: { low: 45, medium: 25, high: 12, total: 82 },
      decelerations: { low: 40, medium: 22, high: 10, total: 72 },
      impacts: { low: 15, medium: 8, high: 3, total: 26 },
      bodyOrientation: [],
    };
  }

  private initializeBaselineData(): void {
    // Initialize with sample Premier League player baselines
    const plBaselines: Record<string, Partial<CatapultPlayerSession>> = {
      'Erling Haaland': {
        gps: { totalDistance: 9200, distancePerMinute: 102, maxSpeed: 9.8, avgSpeed: 1.9, speedZones: { zone1: 1400, zone2: 2200, zone3: 2300, zone4: 1600, zone5: 1100, zone6: 600 }, positionData: [] },
        imu: { playerLoad: 720, playerLoadPerMinute: 8.0, accelerations: { low: 35, medium: 20, high: 18, total: 73 }, decelerations: { low: 32, medium: 18, high: 14, total: 64 }, impacts: { low: 12, medium: 10, high: 8, total: 30 }, bodyOrientation: [] },
      },
      'Kevin De Bruyne': {
        gps: { totalDistance: 11200, distancePerMinute: 124, maxSpeed: 8.8, avgSpeed: 2.3, speedZones: { zone1: 1100, zone2: 2800, zone3: 3200, zone4: 2100, zone5: 1400, zone6: 600 }, positionData: [] },
        imu: { playerLoad: 920, playerLoadPerMinute: 10.2, accelerations: { low: 55, medium: 32, high: 15, total: 102 }, decelerations: { low: 48, medium: 28, high: 12, total: 88 }, impacts: { low: 18, medium: 8, high: 2, total: 28 }, bodyOrientation: [] },
      },
      'Alejandro Garnacho': {
        gps: { totalDistance: 10800, distancePerMinute: 120, maxSpeed: 9.5, avgSpeed: 2.2, speedZones: { zone1: 1000, zone2: 2400, zone3: 2900, zone4: 2200, zone5: 1600, zone6: 700 }, positionData: [] },
        imu: { playerLoad: 880, playerLoadPerMinute: 9.8, accelerations: { low: 48, medium: 30, high: 22, total: 100 }, decelerations: { low: 42, medium: 26, high: 18, total: 86 }, impacts: { low: 14, medium: 8, high: 4, total: 26 }, bodyOrientation: [] },
      },
    };

    // Store baselines for reference
    Object.entries(plBaselines).forEach(([name, baseline]) => {
      const session: CatapultPlayerSession = {
        playerId: name.toLowerCase().replace(/\s/g, '_'),
        playerName: name,
        sessionId: `baseline_${name}`,
        sessionType: 'match',
        date: new Date().toISOString(),
        duration: 90,
        gps: baseline.gps || this.getDefaultGPS(),
        imu: baseline.imu || this.getDefaultIMU(),
        derived: this.calculateDerivedMetrics({} as CatapultPlayerSession),
      };
      this.addSession(session.playerId, session);
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getPlayerSession(playerId: string): CatapultPlayerSession | undefined {
    const sessions = this.playerSessions.get(playerId);
    return sessions?.[sessions.length - 1];
  }

  getPlayerFatigue(playerId: string): FatigueModel | undefined {
    return this.fatigueModels.get(playerId);
  }

  getPlayerInjuryRisk(playerId: string): InjuryRiskModel | undefined {
    return this.injuryModels.get(playerId);
  }

  getAllFatigueModels(): Map<string, FatigueModel> {
    return this.fatigueModels;
  }

  getAllInjuryModels(): Map<string, InjuryRiskModel> {
    return this.injuryModels;
  }

  /**
   * Get tactical recommendations based on physical data
   */
  getTacticalRecommendations(minute: number): {
    substitutionTargets: { playerId: string; priority: 'urgent' | 'soon' | 'optional'; reason: string }[];
    pressingAdjustments: { recommendation: string; affectedPlayers: string[] }[];
    formationSuggestions: string[];
  } {
    const substitutionTargets: { playerId: string; priority: 'urgent' | 'soon' | 'optional'; reason: string }[] = [];
    const pressingAdjustments: { recommendation: string; affectedPlayers: string[] }[] = [];
    const formationSuggestions: string[] = [];

    // Analyze all fatigue models
    this.fatigueModels.forEach((fatigue, playerId) => {
      if (fatigue.currentFatigue > 80) {
        substitutionTargets.push({
          playerId,
          priority: 'urgent',
          reason: `Fatigue critical (${fatigue.currentFatigue.toFixed(0)}%) - high injury risk`,
        });
      } else if (fatigue.predictedFatigueIn15Min > 80) {
        substitutionTargets.push({
          playerId,
          priority: 'soon',
          reason: `Projected fatigue ${fatigue.predictedFatigueIn15Min.toFixed(0)}% in 15 mins`,
        });
      }

      if (fatigue.coverShadowModifier < 0.75) {
        pressingAdjustments.push({
          recommendation: 'Reduce pressing intensity for fatigued players',
          affectedPlayers: [playerId],
        });
      }
    });

    // Check injury risks
    this.injuryModels.forEach((injury, playerId) => {
      if (injury.overallRisk > 70) {
        substitutionTargets.push({
          playerId,
          priority: 'urgent',
          reason: `Injury risk ${injury.overallRisk.toFixed(0)}% - preventive substitution advised`,
        });
      }
    });

    // Formation suggestions based on team-wide fatigue
    const avgFatigue = Array.from(this.fatigueModels.values())
      .reduce((sum, f) => sum + f.currentFatigue, 0) / Math.max(1, this.fatigueModels.size);

    if (avgFatigue > 65 && minute > 70) {
      formationSuggestions.push('Consider switching to 5-4-1 to consolidate defense');
      formationSuggestions.push('Drop defensive line 5m to reduce sprint requirements');
    }

    return { substitutionTargets, pressingAdjustments, formationSuggestions };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const catapultService = new CatapultIntegrationService();
