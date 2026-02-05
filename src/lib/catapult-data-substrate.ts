/**
 * CATAPULT DATA SUBSTRATE
 *
 * Real-time data ingestion layer for Catapult GPS/wearable devices.
 * This provides the physical foundation that feeds the Resonance Kernel.
 *
 * Includes:
 * - Real-time data stream handlers
 * - Historical data storage and retrieval
 * - Sample data for development/testing
 * - Data normalization and validation
 */

// ==================== DATA TYPES ====================

export interface CatapultRawFrame {
  timestamp: number;           // Unix timestamp (ms)
  deviceId: string;            // Catapult device ID
  playerId: string;            // Mapped player ID

  // Position data (GPS)
  latitude: number;
  longitude: number;
  altitude: number;
  gpsAccuracy: number;         // Horizontal accuracy (m)

  // Motion data (IMU)
  accelerometerX: number;      // g-force
  accelerometerY: number;
  accelerometerZ: number;
  gyroscopeX: number;          // deg/s
  gyroscopeY: number;
  gyroscopeZ: number;
  magnetometerX: number;       // μT
  magnetometerY: number;
  magnetometerZ: number;

  // Derived metrics
  speed: number;               // m/s
  acceleration: number;        // m/s²
  distance: number;            // Cumulative distance (m)
  playerLoad: number;          // Cumulative player load

  // Heart rate (if available)
  heartRate: number | null;    // BPM
}

export interface CatapultProcessedFrame {
  timestamp: number;
  playerId: string;

  // Position (normalized to pitch coordinates 0-100)
  x: number;
  y: number;

  // Velocity
  vx: number;                  // m/s
  vy: number;

  // Acceleration
  ax: number;                  // m/s²
  ay: number;

  // Metrics
  speed: number;               // m/s
  playerLoad: number;          // Instantaneous load
  cumulativeLoad: number;      // Total load
  distance: number;            // Session distance (m)
  hsr: number;                 // High-speed running distance (>5.5 m/s)
  sprint: number;              // Sprint distance (>7.0 m/s)

  // Physiological
  heartRate: number;
  heartRateZone: 1 | 2 | 3 | 4 | 5;
  metabolicPower: number;      // W/kg

  // Activity classification
  activity: 'standing' | 'walking' | 'jogging' | 'running' | 'sprinting';
}

export interface CatapultSessionSummary {
  sessionId: string;
  playerId: string;
  date: Date;
  duration: number;            // minutes

  // Distance metrics
  totalDistance: number;       // m
  hsrDistance: number;         // m (>5.5 m/s)
  sprintDistance: number;      // m (>7.0 m/s)

  // Speed zones
  zone1Distance: number;       // 0-2 m/s (walking)
  zone2Distance: number;       // 2-4 m/s (jogging)
  zone3Distance: number;       // 4-5.5 m/s (running)
  zone4Distance: number;       // 5.5-7 m/s (high speed)
  zone5Distance: number;       // >7 m/s (sprinting)

  // Load metrics
  totalPlayerLoad: number;
  playerLoadPerMinute: number;
  accelerations: number;       // Count >2.5 m/s²
  decelerations: number;       // Count <-2.5 m/s²

  // Heart rate
  avgHeartRate: number;
  maxHeartRate: number;
  timeInZone: { zone1: number; zone2: number; zone3: number; zone4: number; zone5: number };

  // Peaks
  maxSpeed: number;
  maxAcceleration: number;
  maxDeceleration: number;
}

export interface CatapultHistoricalData {
  playerId: string;
  playerName: string;
  sessions: CatapultSessionSummary[];
  averages: {
    distancePerMatch: number;
    hsrPerMatch: number;
    sprintPerMatch: number;
    loadPerMatch: number;
    avgMaxSpeed: number;
  };
  baselines: {
    normalLoad: number;
    normalDistance: number;
    normalHSR: number;
    injuryThreshold: number;   // Load above this = injury risk
  };
}

// ==================== SAMPLE HISTORICAL DATA ====================

export const SAMPLE_HISTORICAL_DATA: CatapultHistoricalData[] = [
  {
    playerId: 'p1', playerName: 'Ederson',
    sessions: [
      { sessionId: 's1', playerId: 'p1', date: new Date('2024-01-15'), duration: 95, totalDistance: 5800, hsrDistance: 120, sprintDistance: 45, zone1Distance: 3500, zone2Distance: 1500, zone3Distance: 600, zone4Distance: 120, zone5Distance: 45, totalPlayerLoad: 380, playerLoadPerMinute: 4.0, accelerations: 35, decelerations: 38, avgHeartRate: 125, maxHeartRate: 165, timeInZone: { zone1: 45, zone2: 30, zone3: 15, zone4: 4, zone5: 1 }, maxSpeed: 7.2, maxAcceleration: 3.8, maxDeceleration: -4.2 },
      { sessionId: 's2', playerId: 'p1', date: new Date('2024-01-22'), duration: 90, totalDistance: 5650, hsrDistance: 95, sprintDistance: 30, zone1Distance: 3600, zone2Distance: 1400, zone3Distance: 520, zone4Distance: 95, zone5Distance: 30, totalPlayerLoad: 365, playerLoadPerMinute: 4.1, accelerations: 32, decelerations: 35, avgHeartRate: 122, maxHeartRate: 162, timeInZone: { zone1: 48, zone2: 28, zone3: 12, zone4: 2, zone5: 0 }, maxSpeed: 6.8, maxAcceleration: 3.5, maxDeceleration: -3.9 },
    ],
    averages: { distancePerMatch: 5725, hsrPerMatch: 107, sprintPerMatch: 37, loadPerMatch: 372, avgMaxSpeed: 7.0 },
    baselines: { normalLoad: 400, normalDistance: 6000, normalHSR: 150, injuryThreshold: 650 },
  },
  {
    playerId: 'p2', playerName: 'Kyle Walker',
    sessions: [
      { sessionId: 's3', playerId: 'p2', date: new Date('2024-01-15'), duration: 95, totalDistance: 11200, hsrDistance: 980, sprintDistance: 420, zone1Distance: 2800, zone2Distance: 3500, zone3Distance: 3100, zone4Distance: 980, zone5Distance: 420, totalPlayerLoad: 720, playerLoadPerMinute: 7.6, accelerations: 85, decelerations: 92, avgHeartRate: 158, maxHeartRate: 192, timeInZone: { zone1: 15, zone2: 25, zone3: 30, zone4: 18, zone5: 7 }, maxSpeed: 9.8, maxAcceleration: 5.2, maxDeceleration: -5.8 },
      { sessionId: 's4', playerId: 'p2', date: new Date('2024-01-22'), duration: 90, totalDistance: 10850, hsrDistance: 920, sprintDistance: 380, zone1Distance: 2900, zone2Distance: 3400, zone3Distance: 2950, zone4Distance: 920, zone5Distance: 380, totalPlayerLoad: 695, playerLoadPerMinute: 7.7, accelerations: 78, decelerations: 85, avgHeartRate: 155, maxHeartRate: 188, timeInZone: { zone1: 16, zone2: 26, zone3: 28, zone4: 17, zone5: 6 }, maxSpeed: 9.5, maxAcceleration: 4.9, maxDeceleration: -5.5 },
    ],
    averages: { distancePerMatch: 11025, hsrPerMatch: 950, sprintPerMatch: 400, loadPerMatch: 707, avgMaxSpeed: 9.65 },
    baselines: { normalLoad: 750, normalDistance: 11500, normalHSR: 1000, injuryThreshold: 950 },
  },
  {
    playerId: 'p3', playerName: 'Ruben Dias',
    sessions: [
      { sessionId: 's5', playerId: 'p3', date: new Date('2024-01-15'), duration: 95, totalDistance: 10200, hsrDistance: 450, sprintDistance: 120, zone1Distance: 3200, zone2Distance: 3800, zone3Distance: 2630, zone4Distance: 450, zone5Distance: 120, totalPlayerLoad: 620, playerLoadPerMinute: 6.5, accelerations: 55, decelerations: 62, avgHeartRate: 148, maxHeartRate: 182, timeInZone: { zone1: 20, zone2: 35, zone3: 30, zone4: 12, zone5: 3 }, maxSpeed: 8.2, maxAcceleration: 4.2, maxDeceleration: -4.8 },
      { sessionId: 's6', playerId: 'p3', date: new Date('2024-01-22'), duration: 90, totalDistance: 9980, hsrDistance: 420, sprintDistance: 105, zone1Distance: 3300, zone2Distance: 3650, zone3Distance: 2505, zone4Distance: 420, zone5Distance: 105, totalPlayerLoad: 598, playerLoadPerMinute: 6.6, accelerations: 52, decelerations: 58, avgHeartRate: 145, maxHeartRate: 178, timeInZone: { zone1: 22, zone2: 34, zone3: 28, zone4: 11, zone5: 2 }, maxSpeed: 7.9, maxAcceleration: 4.0, maxDeceleration: -4.5 },
    ],
    averages: { distancePerMatch: 10090, hsrPerMatch: 435, sprintPerMatch: 112, loadPerMatch: 609, avgMaxSpeed: 8.05 },
    baselines: { normalLoad: 650, normalDistance: 10500, normalHSR: 500, injuryThreshold: 850 },
  },
  {
    playerId: 'p4', playerName: 'John Stones',
    sessions: [
      { sessionId: 's7', playerId: 'p4', date: new Date('2024-01-15'), duration: 95, totalDistance: 10450, hsrDistance: 520, sprintDistance: 140, zone1Distance: 3100, zone2Distance: 3700, zone3Distance: 2990, zone4Distance: 520, zone5Distance: 140, totalPlayerLoad: 640, playerLoadPerMinute: 6.7, accelerations: 58, decelerations: 65, avgHeartRate: 150, maxHeartRate: 184, timeInZone: { zone1: 18, zone2: 33, zone3: 32, zone4: 13, zone5: 4 }, maxSpeed: 8.5, maxAcceleration: 4.4, maxDeceleration: -5.0 },
    ],
    averages: { distancePerMatch: 10450, hsrPerMatch: 520, sprintPerMatch: 140, loadPerMatch: 640, avgMaxSpeed: 8.5 },
    baselines: { normalLoad: 680, normalDistance: 10800, normalHSR: 550, injuryThreshold: 880 },
  },
  {
    playerId: 'p5', playerName: 'Josko Gvardiol',
    sessions: [
      { sessionId: 's8', playerId: 'p5', date: new Date('2024-01-15'), duration: 95, totalDistance: 10800, hsrDistance: 720, sprintDistance: 280, zone1Distance: 3000, zone2Distance: 3500, zone3Distance: 3300, zone4Distance: 720, zone5Distance: 280, totalPlayerLoad: 680, playerLoadPerMinute: 7.2, accelerations: 68, decelerations: 75, avgHeartRate: 152, maxHeartRate: 186, timeInZone: { zone1: 17, zone2: 30, zone3: 32, zone4: 15, zone5: 6 }, maxSpeed: 9.0, maxAcceleration: 4.8, maxDeceleration: -5.2 },
    ],
    averages: { distancePerMatch: 10800, hsrPerMatch: 720, sprintPerMatch: 280, loadPerMatch: 680, avgMaxSpeed: 9.0 },
    baselines: { normalLoad: 720, normalDistance: 11200, normalHSR: 750, injuryThreshold: 920 },
  },
  {
    playerId: 'p6', playerName: 'Rodri',
    sessions: [
      { sessionId: 's9', playerId: 'p6', date: new Date('2024-01-15'), duration: 95, totalDistance: 11500, hsrDistance: 580, sprintDistance: 150, zone1Distance: 3400, zone2Distance: 4200, zone3Distance: 3170, zone4Distance: 580, zone5Distance: 150, totalPlayerLoad: 710, playerLoadPerMinute: 7.5, accelerations: 72, decelerations: 78, avgHeartRate: 155, maxHeartRate: 188, timeInZone: { zone1: 20, zone2: 35, zone3: 28, zone4: 12, zone5: 3 }, maxSpeed: 8.4, maxAcceleration: 4.5, maxDeceleration: -5.0 },
      { sessionId: 's10', playerId: 'p6', date: new Date('2024-01-22'), duration: 90, totalDistance: 11200, hsrDistance: 550, sprintDistance: 135, zone1Distance: 3500, zone2Distance: 4050, zone3Distance: 2965, zone4Distance: 550, zone5Distance: 135, totalPlayerLoad: 685, playerLoadPerMinute: 7.6, accelerations: 68, decelerations: 74, avgHeartRate: 152, maxHeartRate: 185, timeInZone: { zone1: 22, zone2: 34, zone3: 27, zone4: 11, zone5: 2 }, maxSpeed: 8.2, maxAcceleration: 4.3, maxDeceleration: -4.8 },
    ],
    averages: { distancePerMatch: 11350, hsrPerMatch: 565, sprintPerMatch: 142, loadPerMatch: 697, avgMaxSpeed: 8.3 },
    baselines: { normalLoad: 730, normalDistance: 11800, normalHSR: 600, injuryThreshold: 920 },
  },
  {
    playerId: 'p7', playerName: 'Kevin De Bruyne',
    sessions: [
      { sessionId: 's11', playerId: 'p7', date: new Date('2024-01-15'), duration: 95, totalDistance: 11800, hsrDistance: 850, sprintDistance: 320, zone1Distance: 2800, zone2Distance: 3900, zone3Distance: 3930, zone4Distance: 850, zone5Distance: 320, totalPlayerLoad: 750, playerLoadPerMinute: 7.9, accelerations: 82, decelerations: 88, avgHeartRate: 160, maxHeartRate: 194, timeInZone: { zone1: 15, zone2: 30, zone3: 32, zone4: 16, zone5: 7 }, maxSpeed: 9.2, maxAcceleration: 5.0, maxDeceleration: -5.4 },
    ],
    averages: { distancePerMatch: 11800, hsrPerMatch: 850, sprintPerMatch: 320, loadPerMatch: 750, avgMaxSpeed: 9.2 },
    baselines: { normalLoad: 780, normalDistance: 12200, normalHSR: 900, injuryThreshold: 980 },
  },
  {
    playerId: 'p8', playerName: 'Bernardo Silva',
    sessions: [
      { sessionId: 's12', playerId: 'p8', date: new Date('2024-01-15'), duration: 95, totalDistance: 12200, hsrDistance: 920, sprintDistance: 280, zone1Distance: 2600, zone2Distance: 3800, zone3Distance: 4600, zone4Distance: 920, zone5Distance: 280, totalPlayerLoad: 780, playerLoadPerMinute: 8.2, accelerations: 88, decelerations: 95, avgHeartRate: 162, maxHeartRate: 196, timeInZone: { zone1: 12, zone2: 28, zone3: 36, zone4: 17, zone5: 5 }, maxSpeed: 8.8, maxAcceleration: 4.8, maxDeceleration: -5.2 },
    ],
    averages: { distancePerMatch: 12200, hsrPerMatch: 920, sprintPerMatch: 280, loadPerMatch: 780, avgMaxSpeed: 8.8 },
    baselines: { normalLoad: 820, normalDistance: 12500, normalHSR: 950, injuryThreshold: 1020 },
  },
  {
    playerId: 'p9', playerName: 'Phil Foden',
    sessions: [
      { sessionId: 's13', playerId: 'p9', date: new Date('2024-01-15'), duration: 95, totalDistance: 11600, hsrDistance: 980, sprintDistance: 420, zone1Distance: 2400, zone2Distance: 3500, zone3Distance: 4300, zone4Distance: 980, zone5Distance: 420, totalPlayerLoad: 760, playerLoadPerMinute: 8.0, accelerations: 92, decelerations: 98, avgHeartRate: 158, maxHeartRate: 192, timeInZone: { zone1: 10, zone2: 26, zone3: 38, zone4: 18, zone5: 8 }, maxSpeed: 9.4, maxAcceleration: 5.2, maxDeceleration: -5.6 },
    ],
    averages: { distancePerMatch: 11600, hsrPerMatch: 980, sprintPerMatch: 420, loadPerMatch: 760, avgMaxSpeed: 9.4 },
    baselines: { normalLoad: 800, normalDistance: 12000, normalHSR: 1000, injuryThreshold: 1000 },
  },
  {
    playerId: 'p10', playerName: 'Erling Haaland',
    sessions: [
      { sessionId: 's14', playerId: 'p10', date: new Date('2024-01-15'), duration: 95, totalDistance: 9800, hsrDistance: 1100, sprintDistance: 580, zone1Distance: 2200, zone2Distance: 2800, zone3Distance: 3120, zone4Distance: 1100, zone5Distance: 580, totalPlayerLoad: 680, playerLoadPerMinute: 7.2, accelerations: 95, decelerations: 102, avgHeartRate: 155, maxHeartRate: 190, timeInZone: { zone1: 12, zone2: 22, zone3: 34, zone4: 20, zone5: 12 }, maxSpeed: 10.2, maxAcceleration: 5.5, maxDeceleration: -6.0 },
    ],
    averages: { distancePerMatch: 9800, hsrPerMatch: 1100, sprintPerMatch: 580, loadPerMatch: 680, avgMaxSpeed: 10.2 },
    baselines: { normalLoad: 720, normalDistance: 10200, normalHSR: 1150, injuryThreshold: 920 },
  },
  {
    playerId: 'p11', playerName: 'Jeremy Doku',
    sessions: [
      { sessionId: 's15', playerId: 'p11', date: new Date('2024-01-15'), duration: 75, totalDistance: 9200, hsrDistance: 1050, sprintDistance: 520, zone1Distance: 1800, zone2Distance: 2600, zone3Distance: 3230, zone4Distance: 1050, zone5Distance: 520, totalPlayerLoad: 640, playerLoadPerMinute: 8.5, accelerations: 88, decelerations: 95, avgHeartRate: 162, maxHeartRate: 195, timeInZone: { zone1: 8, zone2: 20, zone3: 36, zone4: 22, zone5: 14 }, maxSpeed: 10.5, maxAcceleration: 5.8, maxDeceleration: -6.2 },
    ],
    averages: { distancePerMatch: 9200, hsrPerMatch: 1050, sprintPerMatch: 520, loadPerMatch: 640, avgMaxSpeed: 10.5 },
    baselines: { normalLoad: 680, normalDistance: 9500, normalHSR: 1100, injuryThreshold: 880 },
  },
];

// ==================== SAMPLE LIVE STREAM DATA ====================

export function generateSampleLiveFrame(
  playerId: string,
  basePosition: { x: number; y: number },
  minute: number,
  fatigueLevel: number
): CatapultProcessedFrame {
  // Add some random variation
  const noise = () => (Math.random() - 0.5) * 2;

  // Speed decreases with fatigue
  const baseSpeed = 3 + Math.random() * 4;
  const speed = baseSpeed * (1 - fatigueLevel / 150);

  // Determine activity based on speed
  let activity: CatapultProcessedFrame['activity'] = 'standing';
  if (speed > 7.0) activity = 'sprinting';
  else if (speed > 5.5) activity = 'running';
  else if (speed > 4.0) activity = 'jogging';
  else if (speed > 1.0) activity = 'walking';

  // Heart rate zone from intensity
  let heartRateZone: 1 | 2 | 3 | 4 | 5 = 1;
  if (speed > 7.0) heartRateZone = 5;
  else if (speed > 5.5) heartRateZone = 4;
  else if (speed > 4.0) heartRateZone = 3;
  else if (speed > 2.0) heartRateZone = 2;

  // Calculate cumulative metrics
  const cumulativeLoad = fatigueLevel * 8 + minute * 5;
  const distance = minute * 110 + Math.random() * 50;
  const hsr = distance * 0.08 * (1 + speed / 20);
  const sprint = hsr * 0.4;

  return {
    timestamp: Date.now(),
    playerId,
    x: basePosition.x + noise() * 3,
    y: basePosition.y + noise() * 3,
    vx: noise() * speed,
    vy: noise() * speed,
    ax: noise() * 2,
    ay: noise() * 2,
    speed,
    playerLoad: cumulativeLoad / minute || 5,
    cumulativeLoad,
    distance,
    hsr,
    sprint,
    heartRate: 100 + speed * 10 + fatigueLevel * 0.5,
    heartRateZone,
    metabolicPower: speed * 3 + fatigueLevel * 0.2,
    activity,
  };
}

// ==================== CATAPULT DATA SUBSTRATE ENGINE ====================

export interface CatapultConnectionConfig {
  apiKey: string;
  teamId: string;
  endpoint: string;
  streamingEnabled: boolean;
}

export interface DataSubstrateStatus {
  connected: boolean;
  lastUpdate: number;
  frameRate: number;
  playersTracked: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  latency: number;
}

export class CatapultDataSubstrate {
  private config: CatapultConnectionConfig | null = null;
  private isConnected: boolean = false;
  private lastFrame: Map<string, CatapultProcessedFrame> = new Map();
  private frameBuffer: Map<string, CatapultProcessedFrame[]> = new Map();
  private bufferSize = 100;

  private historicalData: Map<string, CatapultHistoricalData> = new Map();
  private sessionData: Map<string, CatapultSessionSummary> = new Map();

  private listeners: Map<string, (frame: CatapultProcessedFrame) => void> = new Map();
  private status: DataSubstrateStatus = {
    connected: false,
    lastUpdate: 0,
    frameRate: 0,
    playersTracked: 0,
    dataQuality: 'fair',
    latency: 0,
  };

  constructor() {
    // Load sample historical data
    this.loadSampleData();
  }

  // ==================== CONNECTION MANAGEMENT ====================

  /**
   * Configure Catapult API connection
   * PLACEHOLDER: Replace with real Catapult API credentials
   */
  configure(config: CatapultConnectionConfig): void {
    this.config = config;
    console.log('[CatapultDataSubstrate] Configured with endpoint:', config.endpoint);
  }

  /**
   * Connect to Catapult data stream
   * PLACEHOLDER: Implement real WebSocket/API connection
   */
  async connect(): Promise<boolean> {
    if (!this.config) {
      console.warn('[CatapultDataSubstrate] Not configured. Using sample data mode.');
      this.isConnected = true;
      this.status.connected = true;
      this.status.dataQuality = 'good';
      return true;
    }

    // PLACEHOLDER: Real connection logic
    // const ws = new WebSocket(this.config.endpoint);
    // ws.onmessage = (event) => this.handleRawFrame(JSON.parse(event.data));
    // await new Promise(resolve => ws.onopen = resolve);

    console.log('[CatapultDataSubstrate] Connected (sample mode)');
    this.isConnected = true;
    this.status.connected = true;
    this.status.lastUpdate = Date.now();
    return true;
  }

  disconnect(): void {
    this.isConnected = false;
    this.status.connected = false;
    console.log('[CatapultDataSubstrate] Disconnected');
  }

  // ==================== DATA INGESTION ====================

  /**
   * Feed raw frame from Catapult device
   * PLACEHOLDER: Called by real data stream handler
   */
  ingestRawFrame(raw: CatapultRawFrame): CatapultProcessedFrame {
    const processed = this.processRawFrame(raw);
    this.updateBuffer(processed);
    this.notifyListeners(processed);
    return processed;
  }

  /**
   * Feed pre-processed frame (for simulation/testing)
   */
  ingestProcessedFrame(frame: CatapultProcessedFrame): void {
    this.updateBuffer(frame);
    this.notifyListeners(frame);
  }

  /**
   * Process raw GPS/IMU data into normalized frame
   */
  private processRawFrame(raw: CatapultRawFrame): CatapultProcessedFrame {
    // PLACEHOLDER: Real coordinate transformation
    // This would use pitch calibration data to convert GPS to pitch coordinates

    // Simplified: assume pitch is 100m x 100m centered at origin
    const pitchCenterLat = 53.4631; // Example: Etihad Stadium
    const pitchCenterLon = -2.2913;
    const metersPerDegLat = 111320;
    const metersPerDegLon = 111320 * Math.cos(pitchCenterLat * Math.PI / 180);

    const x = 50 + (raw.longitude - pitchCenterLon) * metersPerDegLon;
    const y = 50 + (raw.latitude - pitchCenterLat) * metersPerDegLat;

    // Calculate velocity from acceleration integration (simplified)
    const vx = raw.accelerometerX * 0.1; // Very simplified
    const vy = raw.accelerometerY * 0.1;

    // Determine activity and heart rate zone
    let activity: CatapultProcessedFrame['activity'] = 'standing';
    if (raw.speed > 7.0) activity = 'sprinting';
    else if (raw.speed > 5.5) activity = 'running';
    else if (raw.speed > 4.0) activity = 'jogging';
    else if (raw.speed > 1.0) activity = 'walking';

    let heartRateZone: 1 | 2 | 3 | 4 | 5 = 1;
    if (raw.heartRate) {
      if (raw.heartRate > 170) heartRateZone = 5;
      else if (raw.heartRate > 150) heartRateZone = 4;
      else if (raw.heartRate > 130) heartRateZone = 3;
      else if (raw.heartRate > 110) heartRateZone = 2;
    }

    // Get cumulative from buffer
    const previousFrames = this.frameBuffer.get(raw.playerId) || [];
    const lastFrame = previousFrames[previousFrames.length - 1];
    const dt = lastFrame ? (raw.timestamp - lastFrame.timestamp) / 1000 : 0.1;

    const cumulativeLoad = (lastFrame?.cumulativeLoad || 0) + raw.playerLoad * dt;
    const distance = (lastFrame?.distance || 0) + raw.speed * dt;
    const hsr = (lastFrame?.hsr || 0) + (raw.speed > 5.5 ? raw.speed * dt : 0);
    const sprint = (lastFrame?.sprint || 0) + (raw.speed > 7.0 ? raw.speed * dt : 0);

    // Metabolic power (simplified: P = m * v * a + aerobic)
    const metabolicPower = raw.speed * raw.acceleration * 0.5 + raw.speed * 0.3;

    return {
      timestamp: raw.timestamp,
      playerId: raw.playerId,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      vx,
      vy,
      ax: raw.accelerometerX,
      ay: raw.accelerometerY,
      speed: raw.speed,
      playerLoad: raw.playerLoad,
      cumulativeLoad,
      distance,
      hsr,
      sprint,
      heartRate: raw.heartRate || 120,
      heartRateZone,
      metabolicPower,
      activity,
    };
  }

  private updateBuffer(frame: CatapultProcessedFrame): void {
    this.lastFrame.set(frame.playerId, frame);

    let buffer = this.frameBuffer.get(frame.playerId);
    if (!buffer) {
      buffer = [];
      this.frameBuffer.set(frame.playerId, buffer);
    }

    buffer.push(frame);
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }

    // Update status
    this.status.lastUpdate = frame.timestamp;
    this.status.playersTracked = this.lastFrame.size;
    this.status.frameRate = this.calculateFrameRate(frame.playerId);
    this.status.latency = Date.now() - frame.timestamp;
    this.status.dataQuality = this.assessDataQuality();
  }

  private calculateFrameRate(playerId: string): number {
    const buffer = this.frameBuffer.get(playerId);
    if (!buffer || buffer.length < 2) return 0;

    const timeSpan = buffer[buffer.length - 1].timestamp - buffer[0].timestamp;
    if (timeSpan === 0) return 0;

    return (buffer.length / timeSpan) * 1000; // frames per second
  }

  private assessDataQuality(): DataSubstrateStatus['dataQuality'] {
    const frameRate = this.status.frameRate;
    const latency = this.status.latency;

    if (frameRate >= 9 && latency < 100) return 'excellent';
    if (frameRate >= 5 && latency < 200) return 'good';
    if (frameRate >= 2 && latency < 500) return 'fair';
    return 'poor';
  }

  // ==================== DATA ACCESS ====================

  /**
   * Get latest frame for a player
   */
  getLatestFrame(playerId: string): CatapultProcessedFrame | undefined {
    return this.lastFrame.get(playerId);
  }

  /**
   * Get all latest frames
   */
  getAllLatestFrames(): Map<string, CatapultProcessedFrame> {
    return new Map(this.lastFrame);
  }

  /**
   * Get frame buffer for a player (for smoothing/prediction)
   */
  getFrameBuffer(playerId: string): CatapultProcessedFrame[] {
    return this.frameBuffer.get(playerId) || [];
  }

  /**
   * Get historical data for a player
   */
  getHistoricalData(playerId: string): CatapultHistoricalData | undefined {
    return this.historicalData.get(playerId);
  }

  /**
   * Get all historical data
   */
  getAllHistoricalData(): CatapultHistoricalData[] {
    return Array.from(this.historicalData.values());
  }

  /**
   * Get current session summary
   */
  getSessionSummary(playerId: string): CatapultSessionSummary | undefined {
    return this.sessionData.get(playerId);
  }

  /**
   * Get substrate status
   */
  getStatus(): DataSubstrateStatus {
    return { ...this.status };
  }

  // ==================== LISTENERS ====================

  /**
   * Subscribe to frame updates for a player
   */
  subscribe(playerId: string, callback: (frame: CatapultProcessedFrame) => void): void {
    this.listeners.set(playerId, callback);
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(playerId: string): void {
    this.listeners.delete(playerId);
  }

  private notifyListeners(frame: CatapultProcessedFrame): void {
    const listener = this.listeners.get(frame.playerId);
    if (listener) {
      listener(frame);
    }
  }

  // ==================== SAMPLE DATA ====================

  private loadSampleData(): void {
    for (const data of SAMPLE_HISTORICAL_DATA) {
      this.historicalData.set(data.playerId, data);
    }
  }

  /**
   * Generate sample live data for all players (for simulation)
   */
  generateSampleFrames(
    players: { id: string; x: number; y: number; fatigue: number }[],
    minute: number
  ): Map<string, CatapultProcessedFrame> {
    const frames = new Map<string, CatapultProcessedFrame>();

    for (const player of players) {
      const frame = generateSampleLiveFrame(
        player.id,
        { x: player.x, y: player.y },
        minute,
        player.fatigue
      );
      this.ingestProcessedFrame(frame);
      frames.set(player.id, frame);
    }

    return frames;
  }

  // ==================== INJURY RISK CALCULATION ====================

  /**
   * Calculate injury risk based on current load vs baseline
   */
  calculateInjuryRisk(playerId: string): {
    risk: number;
    factors: string[];
    recommendation: string;
  } {
    const current = this.lastFrame.get(playerId);
    const historical = this.historicalData.get(playerId);

    if (!current || !historical) {
      return { risk: 0.1, factors: ['Insufficient data'], recommendation: 'Continue monitoring' };
    }

    const factors: string[] = [];
    let risk = 0;

    // Load ratio (current vs baseline)
    const loadRatio = current.cumulativeLoad / historical.baselines.normalLoad;
    if (loadRatio > 1.2) {
      risk += 0.3;
      factors.push(`High load ratio: ${(loadRatio * 100).toFixed(0)}%`);
    }

    // HSR ratio
    const hsrRatio = current.hsr / historical.baselines.normalHSR;
    if (hsrRatio > 1.3) {
      risk += 0.2;
      factors.push(`Elevated HSR: ${(hsrRatio * 100).toFixed(0)}%`);
    }

    // Near injury threshold
    if (current.cumulativeLoad > historical.baselines.injuryThreshold * 0.9) {
      risk += 0.4;
      factors.push('Approaching injury threshold');
    }

    // Heart rate zone consideration
    if (current.heartRateZone >= 4) {
      risk += 0.1;
      factors.push('High heart rate zone');
    }

    risk = Math.min(1, risk);

    // Recommendation
    let recommendation = 'Continue normal activity';
    if (risk > 0.7) recommendation = 'Consider substitution';
    else if (risk > 0.5) recommendation = 'Reduce intensity';
    else if (risk > 0.3) recommendation = 'Monitor closely';

    return { risk, factors, recommendation };
  }
}

// Export singleton
export const catapultDataSubstrate = new CatapultDataSubstrate();
