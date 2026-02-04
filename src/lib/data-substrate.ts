// Global Data Substrate - Universal Football Data Ingestion Layer
// Ingests, normalizes, and processes data from the world's largest football data sources
// Handles billions of tracking points, events, and contextual information

import type {
  Player,
  TrackingMetrics,
  WearableData,
  RawSensorData,
} from '@/types';

// ==================== Data Source Types ====================

export interface DataSourceConfig {
  id: string;
  name: string;
  type: DataSourceType;
  endpoint: string;
  credentials: DataCredentials;
  dataFormat: DataFormat;
  refreshRate: number; // milliseconds
  priority: number; // 1-10
  enabled: boolean;
  mappings: FieldMapping[];
  qualityThreshold: number; // 0-1
}

export type DataSourceType =
  | 'tracking_provider' // Second Spectrum, TRACAB, ChyronHego
  | 'event_provider' // Opta, StatsBomb, Wyscout
  | 'wearable_provider' // Catapult, STATSports, Polar
  | 'video_provider' // Broadcast feeds, tactical cameras
  | 'medical_system' // Club medical databases
  | 'scouting_platform' // InStat, SciSports
  | 'public_api' // FBref, Transfermarkt
  | 'custom_feed';

export interface DataCredentials {
  type: 'api_key' | 'oauth' | 'certificate' | 'basic';
  key?: string;
  secret?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export type DataFormat =
  | 'json'
  | 'xml'
  | 'protobuf'
  | 'csv'
  | 'parquet'
  | 'avro'
  | 'binary_tracking';

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: TransformFunction;
  required: boolean;
  defaultValue?: unknown;
}

export type TransformFunction =
  | 'identity'
  | 'to_meters'
  | 'to_km_per_hour'
  | 'timestamp_to_date'
  | 'normalize_position'
  | 'custom';

// ==================== Raw Data Types ====================

export interface RawTrackingFrame {
  sourceId: string;
  timestamp: number;
  frameId: number;
  matchId: string;
  period: number;
  gameClock: number;

  homeTeam: RawTeamTracking;
  awayTeam: RawTeamTracking;
  ball: RawBallTracking;

  metadata: FrameMetadata;
}

export interface RawTeamTracking {
  teamId: string;
  players: RawPlayerTracking[];
}

export interface RawPlayerTracking {
  playerId: string;
  jerseyNumber: number;
  x: number;
  y: number;
  z?: number;
  speed?: number;
  acceleration?: number;
  direction?: number;
  heartRate?: number;
  distance?: number;
  confidence: number;
}

export interface RawBallTracking {
  x: number;
  y: number;
  z: number;
  speed: number;
  inPlay: boolean;
  possession?: string;
  confidence: number;
}

export interface FrameMetadata {
  captureTime: number;
  processingLatency: number;
  quality: number;
  source: string;
  cameraCount?: number;
}

export interface RawEventData {
  sourceId: string;
  eventId: string;
  matchId: string;
  timestamp: number;
  minute: number;
  second: number;

  type: string;
  subType?: string;

  playerId?: string;
  teamId: string;

  startPosition: { x: number; y: number };
  endPosition?: { x: number; y: number };

  outcome: string;
  qualifiers: EventQualifier[];

  metadata: EventMetadata;
}

export interface EventQualifier {
  type: string;
  value?: string | number | boolean;
}

export interface EventMetadata {
  provider: string;
  confidence: number;
  validated: boolean;
  videoTimestamp?: number;
}

// ==================== Normalized Data Types ====================

export interface NormalizedTrackingFrame {
  id: string;
  timestamp: number;
  matchId: string;
  minute: number;
  second: number;

  players: Map<string, NormalizedPlayerPosition>;
  ball: NormalizedBallPosition;

  // Derived metrics
  teamShapes: {
    home: TeamShape;
    away: TeamShape;
  };

  possession: {
    team: 'home' | 'away' | 'contested';
    player?: string;
    duration: number;
  };

  quality: DataQualityReport;
}

export interface NormalizedPlayerPosition {
  playerId: string;
  team: 'home' | 'away';
  position: string;
  jerseyNumber: number;

  // Position (normalized to 105x68 pitch)
  x: number;
  y: number;
  z: number;

  // Kinematics
  velocity: { vx: number; vy: number; vz: number };
  speed: number; // m/s
  acceleration: { ax: number; ay: number };
  accelerationMagnitude: number;
  direction: number; // radians

  // Physical metrics
  heartRate?: number;
  metabolicPower?: number;
  cumulativeDistance: number;
  sprintDistance: number;

  // Quality
  confidence: number;
  interpolated: boolean;
}

export interface NormalizedBallPosition {
  x: number;
  y: number;
  z: number;
  velocity: { vx: number; vy: number; vz: number };
  speed: number;
  inPlay: boolean;
  confidence: number;
}

export interface TeamShape {
  centroid: { x: number; y: number };
  spread: { x: number; y: number };
  compactness: number;
  width: number;
  depth: number;
  convexHull: { x: number; y: number }[];
  lines: {
    defensive: { height: number; width: number; players: string[] };
    midfield: { height: number; width: number; players: string[] };
    attacking: { height: number; width: number; players: string[] };
  };
}

export interface DataQualityReport {
  overallScore: number;
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  issues: DataQualityIssue[];
}

export interface DataQualityIssue {
  type: 'missing_player' | 'position_anomaly' | 'speed_anomaly' | 'interpolation' | 'latency';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedEntity?: string;
}

// ==================== Event Types ====================

export interface NormalizedEvent {
  id: string;
  matchId: string;
  timestamp: number;
  minute: number;
  second: number;

  type: NormalizedEventType;
  subType?: string;

  actor: {
    playerId: string;
    playerName: string;
    team: 'home' | 'away';
    position: string;
  };

  location: {
    x: number;
    y: number;
    zone: string;
  };

  endLocation?: {
    x: number;
    y: number;
    zone: string;
  };

  outcome: EventOutcome;

  metrics: EventMetrics;

  context: EventContext;

  quality: number;
}

export type NormalizedEventType =
  | 'pass'
  | 'shot'
  | 'duel'
  | 'interception'
  | 'clearance'
  | 'tackle'
  | 'foul'
  | 'card'
  | 'substitution'
  | 'goal'
  | 'save'
  | 'cross'
  | 'corner'
  | 'free_kick'
  | 'penalty'
  | 'throw_in'
  | 'goal_kick'
  | 'offside'
  | 'dribble'
  | 'carry'
  | 'ball_recovery'
  | 'dispossessed'
  | 'error';

export type EventOutcome = 'successful' | 'unsuccessful' | 'neutral';

export interface EventMetrics {
  xG?: number;
  xA?: number;
  xT?: number;
  passDistance?: number;
  passAngle?: number;
  shotDistance?: number;
  shotAngle?: number;
  pressingIntensity?: number;
  duelIntensity?: number;
}

export interface EventContext {
  gameState: {
    scoreDifferential: number;
    minute: number;
    momentum: number;
  };
  possession: {
    sequence: number;
    phase: string;
  };
  pressure: number;
  options: number;
}

// ==================== Aggregated Data Types ====================

export interface MatchDataPacket {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  date: Date;
  competition: string;
  venue: string;

  trackingFrames: number;
  events: number;

  aggregatedMetrics: MatchAggregatedMetrics;
  playerMetrics: Map<string, PlayerMatchMetrics>;

  qualityScore: number;
  completeness: number;
}

export interface MatchAggregatedMetrics {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  xG: { home: number; away: number };
  passes: { home: number; away: number };
  passAccuracy: { home: number; away: number };
  pressures: { home: number; away: number };
  ppda: { home: number; away: number };
  territorialControl: { home: number; away: number };
  highPress: { home: number; away: number };
}

export interface PlayerMatchMetrics {
  playerId: string;
  playerName: string;
  team: 'home' | 'away';
  minutesPlayed: number;

  // Distance metrics
  totalDistance: number;
  sprintDistance: number;
  highSpeedDistance: number;

  // Actions
  touches: number;
  passes: number;
  passAccuracy: number;
  shots: number;
  xG: number;
  xA: number;
  duels: number;
  duelSuccess: number;

  // Defensive
  pressures: number;
  pressureSuccess: number;
  interceptions: number;
  tackles: number;
  clearances: number;

  // Possession
  carries: number;
  carryDistance: number;
  progressiveCarries: number;

  // Physical
  maxSpeed: number;
  avgSpeed: number;
  accelerations: number;
  decelerations: number;

  // Quality
  dataCompleteness: number;
}

// ==================== Streaming Infrastructure ====================

export interface StreamConfig {
  batchSize: number;
  flushInterval: number; // ms
  bufferSize: number;
  compression: 'none' | 'gzip' | 'lz4' | 'zstd';
  deduplication: boolean;
  ordering: 'strict' | 'relaxed';
}

export interface DataStream {
  id: string;
  sourceId: string;
  type: 'tracking' | 'events' | 'mixed';
  status: 'active' | 'paused' | 'error';
  config: StreamConfig;

  stats: StreamStats;
}

export interface StreamStats {
  framesReceived: number;
  framesProcessed: number;
  framesDropped: number;
  bytesReceived: number;
  avgLatency: number;
  maxLatency: number;
  errorCount: number;
  lastFrameTime: number;
}

// ==================== Main Data Substrate Engine ====================

export interface DataSubstrateConfig {
  // Processing
  maxConcurrentStreams: number;
  processingWorkers: number;
  batchSize: number;

  // Storage
  cacheSize: number; // MB
  persistenceEnabled: boolean;
  compressionLevel: number;

  // Quality
  minQualityThreshold: number;
  interpolationEnabled: boolean;
  anomalyDetectionEnabled: boolean;

  // Performance
  targetLatency: number; // ms
  backpressureThreshold: number;
}

export class DataSubstrateEngine {
  private config: DataSubstrateConfig;
  private sources: Map<string, DataSourceConfig>;
  private streams: Map<string, DataStream>;
  private frameBuffer: NormalizedTrackingFrame[];
  private eventBuffer: NormalizedEvent[];
  private qualityMonitor: QualityMonitor;

  constructor(config?: Partial<DataSubstrateConfig>) {
    this.config = {
      maxConcurrentStreams: 10,
      processingWorkers: 4,
      batchSize: 100,
      cacheSize: 1024,
      persistenceEnabled: true,
      compressionLevel: 6,
      minQualityThreshold: 0.7,
      interpolationEnabled: true,
      anomalyDetectionEnabled: true,
      targetLatency: 50,
      backpressureThreshold: 0.8,
      ...config,
    };

    this.sources = new Map();
    this.streams = new Map();
    this.frameBuffer = [];
    this.eventBuffer = [];
    this.qualityMonitor = new QualityMonitor();

    this.initializeDefaultSources();
  }

  private initializeDefaultSources(): void {
    // Register common data source templates
    const defaultSources: DataSourceConfig[] = [
      {
        id: 'second_spectrum',
        name: 'Second Spectrum Tracking',
        type: 'tracking_provider',
        endpoint: 'wss://tracking.secondspectrum.com/v2',
        credentials: { type: 'api_key' },
        dataFormat: 'protobuf',
        refreshRate: 40, // 25 FPS
        priority: 1,
        enabled: false,
        mappings: this.getTrackingMappings('second_spectrum'),
        qualityThreshold: 0.85,
      },
      {
        id: 'statsbomb',
        name: 'StatsBomb Events',
        type: 'event_provider',
        endpoint: 'https://api.statsbomb.com/v3',
        credentials: { type: 'api_key' },
        dataFormat: 'json',
        refreshRate: 1000,
        priority: 2,
        enabled: false,
        mappings: this.getEventMappings('statsbomb'),
        qualityThreshold: 0.9,
      },
      {
        id: 'catapult',
        name: 'Catapult Wearables',
        type: 'wearable_provider',
        endpoint: 'https://api.catapult.com/v2',
        credentials: { type: 'oauth' },
        dataFormat: 'json',
        refreshRate: 100, // 10 Hz
        priority: 1,
        enabled: false,
        mappings: this.getWearableMappings('catapult'),
        qualityThreshold: 0.8,
      },
      {
        id: 'opta',
        name: 'Opta F24 Feed',
        type: 'event_provider',
        endpoint: 'https://api.performgroup.com/opta/v2',
        credentials: { type: 'api_key' },
        dataFormat: 'xml',
        refreshRate: 5000,
        priority: 2,
        enabled: false,
        mappings: this.getEventMappings('opta'),
        qualityThreshold: 0.85,
      },
    ];

    defaultSources.forEach(s => this.sources.set(s.id, s));
  }

  private getTrackingMappings(provider: string): FieldMapping[] {
    const baseMappings: FieldMapping[] = [
      { sourceField: 'timestamp', targetField: 'timestamp', transform: 'identity', required: true },
      { sourceField: 'frame_id', targetField: 'frameId', transform: 'identity', required: true },
      { sourceField: 'match_id', targetField: 'matchId', transform: 'identity', required: true },
    ];

    // Provider-specific mappings
    switch (provider) {
      case 'second_spectrum':
        return [
          ...baseMappings,
          { sourceField: 'player_x', targetField: 'x', transform: 'to_meters', required: true },
          { sourceField: 'player_y', targetField: 'y', transform: 'to_meters', required: true },
          { sourceField: 'speed_mps', targetField: 'speed', transform: 'identity', required: false },
        ];
      default:
        return baseMappings;
    }
  }

  private getEventMappings(provider: string): FieldMapping[] {
    const baseMappings: FieldMapping[] = [
      { sourceField: 'id', targetField: 'eventId', transform: 'identity', required: true },
      { sourceField: 'match_id', targetField: 'matchId', transform: 'identity', required: true },
      { sourceField: 'type', targetField: 'type', transform: 'identity', required: true },
    ];

    switch (provider) {
      case 'statsbomb':
        return [
          ...baseMappings,
          { sourceField: 'location[0]', targetField: 'startPosition.x', transform: 'normalize_position', required: true },
          { sourceField: 'location[1]', targetField: 'startPosition.y', transform: 'normalize_position', required: true },
        ];
      case 'opta':
        return [
          ...baseMappings,
          { sourceField: 'x', targetField: 'startPosition.x', transform: 'normalize_position', required: true },
          { sourceField: 'y', targetField: 'startPosition.y', transform: 'normalize_position', required: true },
        ];
      default:
        return baseMappings;
    }
  }

  private getWearableMappings(provider: string): FieldMapping[] {
    return [
      { sourceField: 'player_id', targetField: 'playerId', transform: 'identity', required: true },
      { sourceField: 'timestamp', targetField: 'timestamp', transform: 'timestamp_to_date', required: true },
      { sourceField: 'heart_rate', targetField: 'heartRate', transform: 'identity', required: false },
      { sourceField: 'speed', targetField: 'speed', transform: 'to_km_per_hour', required: false },
      { sourceField: 'distance', targetField: 'distance', transform: 'to_meters', required: false },
    ];
  }

  // Register a new data source
  registerSource(source: DataSourceConfig): void {
    this.sources.set(source.id, source);
  }

  // Start streaming from a source
  async startStream(sourceId: string): Promise<DataStream> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (this.streams.size >= this.config.maxConcurrentStreams) {
      throw new Error('Maximum concurrent streams reached');
    }

    const stream: DataStream = {
      id: `stream_${sourceId}_${Date.now()}`,
      sourceId,
      type: source.type === 'tracking_provider' ? 'tracking' :
            source.type === 'event_provider' ? 'events' : 'mixed',
      status: 'active',
      config: {
        batchSize: this.config.batchSize,
        flushInterval: 1000,
        bufferSize: 10000,
        compression: 'lz4',
        deduplication: true,
        ordering: 'strict',
      },
      stats: {
        framesReceived: 0,
        framesProcessed: 0,
        framesDropped: 0,
        bytesReceived: 0,
        avgLatency: 0,
        maxLatency: 0,
        errorCount: 0,
        lastFrameTime: Date.now(),
      },
    };

    this.streams.set(stream.id, stream);

    // Start processing loop (simulated)
    this.processStream(stream, source);

    return stream;
  }

  private async processStream(stream: DataStream, source: DataSourceConfig): Promise<void> {
    // Simulated stream processing
    const processFrame = () => {
      if (stream.status !== 'active') return;

      // Generate mock data for demonstration
      const frame = this.generateMockFrame(source);
      const normalizedFrame = this.normalizeTrackingFrame(frame, source);

      this.frameBuffer.push(normalizedFrame);
      stream.stats.framesReceived++;
      stream.stats.framesProcessed++;
      stream.stats.lastFrameTime = Date.now();

      // Buffer management
      if (this.frameBuffer.length > 1000) {
        this.frameBuffer = this.frameBuffer.slice(-500);
      }

      // Continue processing
      if (stream.status === 'active') {
        setTimeout(processFrame, source.refreshRate);
      }
    };

    processFrame();
  }

  private generateMockFrame(source: DataSourceConfig): RawTrackingFrame {
    const generatePlayers = (teamId: string, count: number): RawPlayerTracking[] => {
      const players: RawPlayerTracking[] = [];
      for (let i = 0; i < count; i++) {
        players.push({
          playerId: `${teamId}_player_${i + 1}`,
          jerseyNumber: i + 1,
          x: Math.random() * 105,
          y: Math.random() * 68 - 34,
          z: 0,
          speed: Math.random() * 8,
          acceleration: (Math.random() - 0.5) * 4,
          direction: Math.random() * Math.PI * 2,
          confidence: 0.95,
        });
      }
      return players;
    };

    return {
      sourceId: source.id,
      timestamp: Date.now(),
      frameId: Math.floor(Math.random() * 1000000),
      matchId: 'match_001',
      period: 1,
      gameClock: Math.random() * 2700,
      homeTeam: {
        teamId: 'home',
        players: generatePlayers('home', 11),
      },
      awayTeam: {
        teamId: 'away',
        players: generatePlayers('away', 11),
      },
      ball: {
        x: Math.random() * 105,
        y: Math.random() * 68 - 34,
        z: Math.random() * 2,
        speed: Math.random() * 30,
        inPlay: true,
        possession: Math.random() > 0.5 ? 'home' : 'away',
        confidence: 0.98,
      },
      metadata: {
        captureTime: Date.now(),
        processingLatency: Math.random() * 20,
        quality: 0.95,
        source: source.id,
      },
    };
  }

  // Normalize tracking frame to standard format
  normalizeTrackingFrame(
    raw: RawTrackingFrame,
    source: DataSourceConfig
  ): NormalizedTrackingFrame {
    const players = new Map<string, NormalizedPlayerPosition>();

    // Process home team
    raw.homeTeam.players.forEach(p => {
      players.set(p.playerId, this.normalizePlayerPosition(p, 'home', source));
    });

    // Process away team
    raw.awayTeam.players.forEach(p => {
      players.set(p.playerId, this.normalizePlayerPosition(p, 'away', source));
    });

    // Calculate team shapes
    const homeShape = this.calculateTeamShape(
      raw.homeTeam.players.map(p => this.normalizePlayerPosition(p, 'home', source))
    );
    const awayShape = this.calculateTeamShape(
      raw.awayTeam.players.map(p => this.normalizePlayerPosition(p, 'away', source))
    );

    // Quality assessment
    const quality = this.qualityMonitor.assessFrame(raw, source);

    return {
      id: `frame_${raw.matchId}_${raw.timestamp}`,
      timestamp: raw.timestamp,
      matchId: raw.matchId,
      minute: Math.floor(raw.gameClock / 60),
      second: Math.floor(raw.gameClock % 60),
      players,
      ball: {
        x: raw.ball.x,
        y: raw.ball.y,
        z: raw.ball.z,
        velocity: { vx: 0, vy: 0, vz: 0 },
        speed: raw.ball.speed,
        inPlay: raw.ball.inPlay,
        confidence: raw.ball.confidence,
      },
      teamShapes: {
        home: homeShape,
        away: awayShape,
      },
      possession: {
        team: raw.ball.possession as 'home' | 'away' || 'contested',
        duration: 0,
      },
      quality,
    };
  }

  private normalizePlayerPosition(
    raw: RawPlayerTracking,
    team: 'home' | 'away',
    source: DataSourceConfig
  ): NormalizedPlayerPosition {
    return {
      playerId: raw.playerId,
      team,
      position: 'unknown', // Would be looked up from player registry
      jerseyNumber: raw.jerseyNumber,
      x: raw.x,
      y: raw.y,
      z: raw.z || 0,
      velocity: {
        vx: (raw.speed || 0) * Math.cos(raw.direction || 0),
        vy: (raw.speed || 0) * Math.sin(raw.direction || 0),
        vz: 0,
      },
      speed: raw.speed || 0,
      acceleration: {
        ax: raw.acceleration || 0,
        ay: 0,
      },
      accelerationMagnitude: Math.abs(raw.acceleration || 0),
      direction: raw.direction || 0,
      heartRate: raw.heartRate,
      cumulativeDistance: raw.distance || 0,
      sprintDistance: 0,
      confidence: raw.confidence,
      interpolated: false,
    };
  }

  private calculateTeamShape(players: NormalizedPlayerPosition[]): TeamShape {
    const xs = players.map(p => p.x);
    const ys = players.map(p => p.y);

    const centroidX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const centroidY = ys.reduce((a, b) => a + b, 0) / ys.length;

    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);

    // Calculate compactness (average distance from centroid)
    const distances = players.map(p =>
      Math.sqrt(Math.pow(p.x - centroidX, 2) + Math.pow(p.y - centroidY, 2))
    );
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const compactness = 1 - Math.min(1, avgDistance / 30);

    // Sort by x position for line detection
    const sorted = [...players].sort((a, b) => a.x - b.x);

    const defensiveLine = sorted.slice(0, 4);
    const midfieldLine = sorted.slice(4, 7);
    const attackingLine = sorted.slice(7);

    return {
      centroid: { x: centroidX, y: centroidY },
      spread: { x: spreadX, y: spreadY },
      compactness,
      width: spreadY,
      depth: spreadX,
      convexHull: [], // Would calculate actual convex hull
      lines: {
        defensive: {
          height: defensiveLine.reduce((s, p) => s + p.x, 0) / defensiveLine.length,
          width: Math.max(...defensiveLine.map(p => p.y)) - Math.min(...defensiveLine.map(p => p.y)),
          players: defensiveLine.map(p => p.playerId),
        },
        midfield: {
          height: midfieldLine.reduce((s, p) => s + p.x, 0) / midfieldLine.length,
          width: Math.max(...midfieldLine.map(p => p.y)) - Math.min(...midfieldLine.map(p => p.y)),
          players: midfieldLine.map(p => p.playerId),
        },
        attacking: {
          height: attackingLine.length > 0 ?
            attackingLine.reduce((s, p) => s + p.x, 0) / attackingLine.length : 0,
          width: attackingLine.length > 0 ?
            Math.max(...attackingLine.map(p => p.y)) - Math.min(...attackingLine.map(p => p.y)) : 0,
          players: attackingLine.map(p => p.playerId),
        },
      },
    };
  }

  // Process event data
  normalizeEvent(raw: RawEventData, source: DataSourceConfig): NormalizedEvent {
    const eventType = this.mapEventType(raw.type, source);

    return {
      id: raw.eventId,
      matchId: raw.matchId,
      timestamp: raw.timestamp,
      minute: raw.minute,
      second: raw.second,
      type: eventType,
      subType: raw.subType,
      actor: {
        playerId: raw.playerId || 'unknown',
        playerName: 'Unknown Player', // Would be looked up
        team: raw.teamId as 'home' | 'away',
        position: 'unknown',
      },
      location: {
        x: raw.startPosition.x,
        y: raw.startPosition.y,
        zone: this.determineZone(raw.startPosition.x, raw.startPosition.y),
      },
      endLocation: raw.endPosition ? {
        x: raw.endPosition.x,
        y: raw.endPosition.y,
        zone: this.determineZone(raw.endPosition.x, raw.endPosition.y),
      } : undefined,
      outcome: this.mapOutcome(raw.outcome),
      metrics: this.calculateEventMetrics(raw, eventType),
      context: {
        gameState: {
          scoreDifferential: 0,
          minute: raw.minute,
          momentum: 0.5,
        },
        possession: {
          sequence: 0,
          phase: 'open_play',
        },
        pressure: 0.5,
        options: 3,
      },
      quality: raw.metadata.confidence,
    };
  }

  private mapEventType(rawType: string, source: DataSourceConfig): NormalizedEventType {
    const mappings: Record<string, NormalizedEventType> = {
      'Pass': 'pass',
      'Shot': 'shot',
      'Duel': 'duel',
      'Interception': 'interception',
      'Clearance': 'clearance',
      'Tackle': 'tackle',
      'Foul': 'foul',
      'Card': 'card',
      'Substitution': 'substitution',
      'Goal': 'goal',
      'Save': 'save',
      'Cross': 'cross',
      'Corner': 'corner',
      'Free Kick': 'free_kick',
      'Penalty': 'penalty',
      'Throw-in': 'throw_in',
      'Goal Kick': 'goal_kick',
      'Offside': 'offside',
      'Dribble': 'dribble',
      'Carry': 'carry',
      'Ball Recovery': 'ball_recovery',
      'Dispossessed': 'dispossessed',
      'Error': 'error',
    };

    return mappings[rawType] || 'pass';
  }

  private mapOutcome(rawOutcome: string): EventOutcome {
    const successTerms = ['successful', 'complete', 'won', 'goal'];
    const failTerms = ['unsuccessful', 'incomplete', 'lost', 'blocked', 'saved'];

    const lower = rawOutcome.toLowerCase();
    if (successTerms.some(t => lower.includes(t))) return 'successful';
    if (failTerms.some(t => lower.includes(t))) return 'unsuccessful';
    return 'neutral';
  }

  private calculateEventMetrics(raw: RawEventData, type: NormalizedEventType): EventMetrics {
    const metrics: EventMetrics = {};

    if (type === 'shot') {
      metrics.xG = this.calculateXG(raw.startPosition.x, raw.startPosition.y);
      metrics.shotDistance = this.calculateDistanceToGoal(raw.startPosition.x, raw.startPosition.y);
      metrics.shotAngle = this.calculateAngleToGoal(raw.startPosition.x, raw.startPosition.y);
    }

    if (type === 'pass' && raw.endPosition) {
      metrics.passDistance = Math.sqrt(
        Math.pow(raw.endPosition.x - raw.startPosition.x, 2) +
        Math.pow(raw.endPosition.y - raw.startPosition.y, 2)
      );
      metrics.passAngle = Math.atan2(
        raw.endPosition.y - raw.startPosition.y,
        raw.endPosition.x - raw.startPosition.x
      );
      metrics.xT = this.calculateXT(
        raw.startPosition.x, raw.startPosition.y,
        raw.endPosition.x, raw.endPosition.y
      );
    }

    return metrics;
  }

  private calculateXG(x: number, y: number): number {
    // Simplified xG model
    const distance = this.calculateDistanceToGoal(x, y);
    const angle = this.calculateAngleToGoal(x, y);

    // Basic logistic regression approximation
    const distanceFactor = Math.exp(-distance / 20);
    const angleFactor = Math.abs(angle) / (Math.PI / 2);

    return Math.min(0.95, distanceFactor * angleFactor * 0.5);
  }

  private calculateXT(x1: number, y1: number, x2: number, y2: number): number {
    // Expected threat model (simplified)
    const threatBefore = this.getZoneThreat(x1, y1);
    const threatAfter = this.getZoneThreat(x2, y2);
    return threatAfter - threatBefore;
  }

  private getZoneThreat(x: number, y: number): number {
    // Simplified threat values by zone
    if (x > 88 && Math.abs(y) < 20) return 0.15; // Penalty area
    if (x > 70 && Math.abs(y) < 30) return 0.05; // Final third central
    if (x > 70) return 0.02; // Final third wide
    if (x > 35) return 0.01; // Middle third
    return 0.001; // Own half
  }

  private calculateDistanceToGoal(x: number, y: number): number {
    return Math.sqrt(Math.pow(105 - x, 2) + Math.pow(y, 2));
  }

  private calculateAngleToGoal(x: number, y: number): number {
    const goalWidth = 7.32;
    const goalLeft = { x: 105, y: -goalWidth / 2 };
    const goalRight = { x: 105, y: goalWidth / 2 };

    const angleLeft = Math.atan2(goalLeft.y - y, goalLeft.x - x);
    const angleRight = Math.atan2(goalRight.y - y, goalRight.x - x);

    return angleRight - angleLeft;
  }

  private determineZone(x: number, y: number): string {
    let zone = '';

    if (x < 35) zone = 'defensive_third';
    else if (x < 70) zone = 'middle_third';
    else zone = 'attacking_third';

    if (y < -20) zone += '_left';
    else if (y > 20) zone += '_right';
    else zone += '_central';

    return zone;
  }

  // Get latest frame
  getLatestFrame(): NormalizedTrackingFrame | null {
    return this.frameBuffer[this.frameBuffer.length - 1] || null;
  }

  // Get frames in time window
  getFrames(startTime: number, endTime: number): NormalizedTrackingFrame[] {
    return this.frameBuffer.filter(f =>
      f.timestamp >= startTime && f.timestamp <= endTime
    );
  }

  // Get stream statistics
  getStreamStats(): Map<string, StreamStats> {
    const stats = new Map<string, StreamStats>();
    this.streams.forEach((stream, id) => {
      stats.set(id, stream.stats);
    });
    return stats;
  }

  // Get overall system status
  getSystemStatus(): DataSubstrateStatus {
    const activeStreams = [...this.streams.values()].filter(s => s.status === 'active').length;
    const totalFrames = this.frameBuffer.length;
    const avgQuality = this.frameBuffer.reduce((sum, f) => sum + f.quality.overallScore, 0) /
                       Math.max(1, totalFrames);

    return {
      activeStreams,
      totalSources: this.sources.size,
      framesBuffered: totalFrames,
      eventsBuffered: this.eventBuffer.length,
      avgDataQuality: avgQuality,
      systemLoad: activeStreams / this.config.maxConcurrentStreams,
      uptime: Date.now(),
    };
  }

  // Stop a stream
  stopStream(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.status = 'paused';
    }
  }

  // Stop all streams
  shutdown(): void {
    this.streams.forEach(stream => {
      stream.status = 'paused';
    });
    this.streams.clear();
  }
}

// Quality monitoring class
class QualityMonitor {
  assessFrame(frame: RawTrackingFrame, source: DataSourceConfig): DataQualityReport {
    const issues: DataQualityIssue[] = [];

    // Check completeness
    const expectedPlayers = 22;
    const actualPlayers = frame.homeTeam.players.length + frame.awayTeam.players.length;
    const completeness = actualPlayers / expectedPlayers;

    if (completeness < 1) {
      issues.push({
        type: 'missing_player',
        severity: completeness < 0.9 ? 'high' : 'low',
        description: `Missing ${expectedPlayers - actualPlayers} players from tracking`,
      });
    }

    // Check accuracy (confidence values)
    const allConfidences = [
      ...frame.homeTeam.players.map(p => p.confidence),
      ...frame.awayTeam.players.map(p => p.confidence),
      frame.ball.confidence,
    ];
    const accuracy = allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;

    // Check timeliness
    const latency = frame.metadata.processingLatency;
    const timeliness = Math.max(0, 1 - latency / 100);

    if (latency > 50) {
      issues.push({
        type: 'latency',
        severity: latency > 100 ? 'high' : 'medium',
        description: `High processing latency: ${latency}ms`,
      });
    }

    // Check consistency (speed anomalies)
    const speedAnomalies = [...frame.homeTeam.players, ...frame.awayTeam.players]
      .filter(p => (p.speed || 0) > 12); // 12 m/s = 43.2 km/h (unrealistic)

    if (speedAnomalies.length > 0) {
      issues.push({
        type: 'speed_anomaly',
        severity: 'medium',
        description: `${speedAnomalies.length} players with unrealistic speed`,
        affectedEntity: speedAnomalies.map(p => p.playerId).join(', '),
      });
    }

    const consistency = 1 - speedAnomalies.length / actualPlayers;

    const overallScore = (completeness * 0.3 + accuracy * 0.3 + timeliness * 0.2 + consistency * 0.2);

    return {
      overallScore,
      completeness,
      accuracy,
      timeliness,
      consistency,
      issues,
    };
  }
}

// Status type for monitoring
export interface DataSubstrateStatus {
  activeStreams: number;
  totalSources: number;
  framesBuffered: number;
  eventsBuffered: number;
  avgDataQuality: number;
  systemLoad: number;
  uptime: number;
}
