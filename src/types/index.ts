// Core Types for Football Analytics System

// ==================== Player & Physical Data ====================

export interface Player {
  id: string;
  name: string;
  number: number;
  position: PlayerPosition;
  preferredFoot: 'left' | 'right' | 'both';
  physicalProfile: PhysicalProfile;
  currentStatus: PlayerStatus;
  digitalTwin?: DigitalTwin;
}

export type PlayerPosition =
  | 'GK' | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB'
  | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM'
  | 'LW' | 'RW' | 'CF' | 'ST';

export interface PhysicalProfile {
  maxSpeed: number; // km/h
  accelerationPeak: number; // m/s²
  sprintCapacity: number; // meters
  highIntensityThreshold: number; // km/h
  aerobicThreshold: number; // heart rate
  anaerobicThreshold: number; // heart rate
}

export type PlayerStatus = 'available' | 'injured' | 'fatigued' | 'rested' | 'matchday';

// ==================== GPS/Wearable Tracking Data ====================

export interface WearableData {
  id: string;
  playerId: string;
  sessionId: string;
  timestamp: Date;
  metrics: TrackingMetrics;
  rawData?: RawSensorData;
}

export interface TrackingMetrics {
  // Distance Metrics
  totalDistance: number; // meters
  distancePerMinute: number;
  highSpeedRunningDistance: number; // >19.8 km/h
  sprintDistance: number; // >25.2 km/h
  walkingDistance: number;
  joggingDistance: number;
  runningDistance: number;

  // Speed Metrics
  currentSpeed: number; // km/h
  averageSpeed: number;
  maxSpeed: number;
  speedZones: SpeedZoneData;

  // Acceleration/Deceleration
  accelerations: AccelerationData;
  decelerations: AccelerationData;
  maxAcceleration: number;
  maxDeceleration: number;

  // Load Metrics
  playerLoad: number; // arbitrary units
  playerLoadPerMinute: number;
  metabolicPower: number; // W/kg
  highMetabolicLoadDistance: number;

  // Heart Rate (if available)
  heartRate?: HeartRateData;

  // Position
  position: PositionalData;
}

export interface SpeedZoneData {
  zone1: number; // 0-6 km/h (walking)
  zone2: number; // 6-12 km/h (jogging)
  zone3: number; // 12-18 km/h (running)
  zone4: number; // 18-21 km/h (high-speed running)
  zone5: number; // 21-24 km/h (sprinting)
  zone6: number; // 24+ km/h (max sprinting)
}

export interface AccelerationData {
  low: number; // 1-2 m/s²
  medium: number; // 2-3 m/s²
  high: number; // 3+ m/s²
  total: number;
}

export interface HeartRateData {
  current: number;
  average: number;
  max: number;
  min: number;
  zones: HeartRateZones;
}

export interface HeartRateZones {
  zone1: number; // 50-60% max HR
  zone2: number; // 60-70%
  zone3: number; // 70-80%
  zone4: number; // 80-90%
  zone5: number; // 90-100%
}

export interface PositionalData {
  x: number; // meters from center
  y: number;
  zone: PitchZone;
  heatmap: HeatmapData;
}

export type PitchZone =
  | 'defensive_third' | 'middle_third' | 'attacking_third'
  | 'left_flank' | 'center' | 'right_flank'
  | 'penalty_area_own' | 'penalty_area_opp';

export interface HeatmapData {
  cells: number[][]; // 2D grid of time spent
  resolution: { x: number; y: number };
}

export interface RawSensorData {
  gps: { lat: number; lon: number; accuracy: number }[];
  accelerometer: { x: number; y: number; z: number; timestamp: number }[];
  gyroscope: { x: number; y: number; z: number; timestamp: number }[];
  magnetometer?: { x: number; y: number; z: number; timestamp: number }[];
}

// ==================== Game Model & Tactical System ====================

export interface GameModel {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  formation: Formation;
  principles: TacticalPrinciples;
  phases: GamePhases;
  pressureTriggers: PressureTrigger[];
  transitionRules: TransitionRule[];
  setPlays: SetPlay[];
  playerInstructions: Map<string, PlayerInstruction>;
  validatedBy: string[];
  status: 'draft' | 'validated' | 'active';
}

export interface Formation {
  name: string; // e.g., "4-3-3", "3-5-2"
  shape: FormationShape;
  compactness: CompactnessMetrics;
  width: WidthMetrics;
  depth: DepthMetrics;
}

export interface FormationShape {
  positions: FormationPosition[];
  lines: DefensiveLine[];
}

export interface FormationPosition {
  role: string;
  baseX: number; // 0-100 representing pitch position
  baseY: number;
  movementRange: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface DefensiveLine {
  type: 'goalkeeper' | 'defensive' | 'midfield' | 'attacking';
  height: number; // average Y position
  spacing: number; // horizontal distance between players
}

export interface CompactnessMetrics {
  vertical: { min: number; max: number; target: number }; // meters between lines
  horizontal: { min: number; max: number; target: number };
}

export interface WidthMetrics {
  inPossession: number; // meters
  outOfPossession: number;
  transitions: number;
}

export interface DepthMetrics {
  defensiveLineHeight: number; // meters from own goal
  pressureLineHeight: number;
  compactZoneDepth: number;
}

export interface TacticalPrinciples {
  inPossession: PossessionPrinciple[];
  outOfPossession: DefensivePrinciple[];
  transitions: TransitionPrinciple[];
  generalPrinciples: string[];
}

export interface PossessionPrinciple {
  id: string;
  name: string;
  description: string;
  priority: number;
  triggers: string[];
  expectedBehaviors: ExpectedBehavior[];
}

export interface DefensivePrinciple {
  id: string;
  name: string;
  description: string;
  pressureType: 'high' | 'mid' | 'low' | 'variable';
  triggers: string[];
  expectedBehaviors: ExpectedBehavior[];
}

export interface TransitionPrinciple {
  id: string;
  type: 'attacking' | 'defensive';
  name: string;
  description: string;
  timeWindow: number; // seconds
  expectedBehaviors: ExpectedBehavior[];
}

export interface ExpectedBehavior {
  playerId?: string;
  position?: PlayerPosition;
  action: string;
  metrics: BehaviorMetrics;
}

export interface BehaviorMetrics {
  expectedSpeed?: { min: number; max: number };
  expectedPosition?: { x: number; y: number; tolerance: number };
  expectedDistance?: { min: number; max: number };
  expectedAcceleration?: { min: number; max: number };
}

export interface GamePhases {
  buildUp: PhaseInstructions;
  progression: PhaseInstructions;
  finalThird: PhaseInstructions;
  pressing: PhaseInstructions;
  defensiveBlock: PhaseInstructions;
  attackingTransition: PhaseInstructions;
  defensiveTransition: PhaseInstructions;
}

export interface PhaseInstructions {
  description: string;
  keyPoints: string[];
  playerMovements: PlayerMovement[];
  passingPatterns: PassingPattern[];
  triggers: PhaseTrigger[];
}

export interface PlayerMovement {
  playerId: string;
  movementType: 'run' | 'drop' | 'drift' | 'overlap' | 'underlap' | 'hold';
  from: { x: number; y: number };
  to: { x: number; y: number };
  timing: 'immediate' | 'delayed' | 'on_trigger';
  trigger?: string;
}

export interface PassingPattern {
  name: string;
  sequence: { from: string; to: string; type: 'short' | 'long' | 'through' }[];
  purpose: string;
}

export interface PhaseTrigger {
  condition: string;
  action: string;
}

export interface PressureTrigger {
  id: string;
  name: string;
  description: string;
  condition: string;
  intensity: 'low' | 'medium' | 'high' | 'max';
  duration: number; // seconds
  coverShadows: boolean;
}

export interface TransitionRule {
  id: string;
  type: 'positive' | 'negative';
  trigger: string;
  immediateActions: string[];
  timeLimit: number; // seconds
  fallbackAction: string;
}

export interface SetPlay {
  id: string;
  type: 'corner' | 'freekick' | 'throw_in' | 'goal_kick' | 'penalty';
  side: 'attacking' | 'defending';
  name: string;
  positions: FormationPosition[];
  movements: PlayerMovement[];
  variations: SetPlayVariation[];
}

export interface SetPlayVariation {
  name: string;
  signal: string;
  modifications: Partial<SetPlay>;
}

export interface PlayerInstruction {
  playerId: string;
  role: string;
  responsibilities: string[];
  movementPatterns: string[];
  passingOptions: string[];
  defensiveDuties: string[];
  triggers: string[];
  physicalRequirements: PhysicalRequirements;
}

export interface PhysicalRequirements {
  expectedDistance: { min: number; max: number };
  expectedSprints: { min: number; max: number };
  expectedHighIntensityRuns: { min: number; max: number };
  positionHeatmap: number[][]; // expected position distribution
}

// ==================== Digital Twin ====================

export interface DigitalTwin {
  id: string;
  playerId: string;
  lastUpdated: Date;
  currentState: TwinState;
  behaviorModel: BehaviorModel;
  performanceBaseline: PerformanceBaseline;
  adaptations: Adaptation[];
}

export interface TwinState {
  fatigue: number; // 0-100
  readiness: number; // 0-100
  confidenceLevel: number; // 0-100
  currentWorkRate: number;
  positionAdherence: number; // 0-100
  tacticalCompliance: number; // 0-100
}

export interface BehaviorModel {
  movementPatterns: MovementPattern[];
  decisionTendencies: DecisionTendency[];
  physicalLimits: PhysicalLimits;
  reactionTimes: ReactionTimes;
}

export interface MovementPattern {
  type: string;
  frequency: number;
  avgDuration: number;
  avgDistance: number;
  conditions: string[];
}

export interface DecisionTendency {
  situation: string;
  likelyAction: string;
  probability: number;
  alternatives: { action: string; probability: number }[];
}

export interface PhysicalLimits {
  maxSustainableSpeed: number;
  sprintRecoveryTime: number;
  highIntensityCapacity: number;
  fatigueThreshold: number;
}

export interface ReactionTimes {
  pressureTrigger: number; // ms
  transitionResponse: number;
  positionalAdjustment: number;
}

export interface PerformanceBaseline {
  averageMetrics: TrackingMetrics;
  peakMetrics: TrackingMetrics;
  historicalTrends: HistoricalTrend[];
}

export interface HistoricalTrend {
  metric: string;
  period: 'weekly' | 'monthly' | 'seasonal';
  values: { date: Date; value: number }[];
  trend: 'improving' | 'stable' | 'declining';
}

export interface Adaptation {
  id: string;
  date: Date;
  type: 'tactical' | 'physical' | 'technical';
  description: string;
  impact: number; // -100 to 100
  duration: 'temporary' | 'permanent';
}

// ==================== Game Approach (Match-Specific) ====================

export interface GameApproach {
  id: string;
  matchId: string;
  baseGameModel: string; // GameModel ID
  opponent: OpponentAnalysis;
  adjustments: TacticalAdjustment[];
  playerSpecificInstructions: Map<string, string[]>;
  priorityFocus: string[];
  keyBattles: KeyBattle[];
  createdAt: Date;
  validatedBy: string[];
}

export interface OpponentAnalysis {
  teamName: string;
  formation: string;
  strengths: string[];
  weaknesses: string[];
  keyPlayers: { name: string; threats: string[] }[];
  patterns: string[];
}

export interface TacticalAdjustment {
  id: string;
  area: 'formation' | 'pressing' | 'possession' | 'transitions' | 'setPlays';
  description: string;
  reason: string;
  affectedPlayers: string[];
}

export interface KeyBattle {
  description: string;
  ourPlayer: string;
  theirPlayer: string;
  strategy: string;
  successMetrics: string[];
}

// ==================== Live Match & Coherence ====================

export interface LiveMatchData {
  matchId: string;
  gameApproach: GameApproach;
  currentMinute: number;
  phase: 'pre_match' | 'first_half' | 'half_time' | 'second_half' | 'full_time';
  score: { home: number; away: number };
  playerData: Map<string, LivePlayerData>;
  teamMetrics: TeamMetrics;
  coherenceReport: CoherenceReport;
  events: MatchEvent[];
}

export interface LivePlayerData {
  playerId: string;
  currentMetrics: TrackingMetrics;
  cumulativeMetrics: TrackingMetrics;
  coherenceScore: number; // 0-100
  deviations: TacticalDeviation[];
  alerts: PlayerAlert[];
}

export interface TeamMetrics {
  possession: number;
  passAccuracy: number;
  pressureSuccess: number;
  territorialControl: number;
  compactness: number;
  formationMaintenance: number;
}

export interface CoherenceReport {
  overallScore: number; // 0-100
  byPhase: Map<string, number>;
  byPlayer: Map<string, number>;
  byPrinciple: Map<string, number>;
  criticalDeviations: CriticalDeviation[];
  recommendations: string[];
}

export interface TacticalDeviation {
  id: string;
  timestamp: Date;
  minute: number;
  type: 'position' | 'movement' | 'intensity' | 'timing';
  expected: string;
  actual: string;
  severity: 'minor' | 'moderate' | 'major';
  context: string;
}

export interface CriticalDeviation {
  description: string;
  affectedPlayers: string[];
  impact: string;
  suggestedAction: string;
}

export interface PlayerAlert {
  type: 'fatigue' | 'injury_risk' | 'tactical' | 'physical';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: Date;
}

export interface MatchEvent {
  id: string;
  minute: number;
  type: 'goal' | 'card' | 'substitution' | 'injury' | 'tactical_change';
  description: string;
  playersInvolved: string[];
  impact?: string;
}

// ==================== AI Manager Interface ====================

export interface ManagerInput {
  id: string;
  timestamp: Date;
  inputType: 'text' | 'voice' | 'tactical_board';
  rawInput: string;
  processedInstructions: ProcessedInstruction[];
  confidence: number;
  needsVerification: boolean;
}

export interface ProcessedInstruction {
  category: 'formation' | 'pressing' | 'possession' | 'transition' | 'player_specific' | 'general';
  instruction: string;
  affectedPlayers: string[];
  affectedPhases: string[];
  priority: number;
  confidence: number;
}

export interface VerificationRequest {
  id: string;
  originalInput: ManagerInput;
  interpretations: ProcessedInstruction[];
  questions: ClarificationQuestion[];
  status: 'pending' | 'verified' | 'modified' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: Date;
  modifications?: string;
}

export interface ClarificationQuestion {
  question: string;
  options?: string[];
  context: string;
}

// ==================== Session & Analytics ====================

export interface TrainingSession {
  id: string;
  date: Date;
  type: 'match' | 'training' | 'recovery' | 'tactical';
  duration: number; // minutes
  players: string[];
  gameModelUsed?: string;
  sessionData: Map<string, WearableData[]>;
  analysis?: SessionAnalysis;
}

export interface SessionAnalysis {
  summary: string;
  playerPerformance: Map<string, PlayerSessionPerformance>;
  teamInsights: string[];
  coherenceWithGameModel: number;
  recommendations: string[];
}

export interface PlayerSessionPerformance {
  playerId: string;
  metrics: TrackingMetrics;
  comparedToBaseline: MetricComparison[];
  tacticalAdherence: number;
  notes: string[];
}

export interface MetricComparison {
  metric: string;
  value: number;
  baseline: number;
  deviation: number; // percentage
  significance: 'normal' | 'notable' | 'concerning';
}

// ==================== Multi-Screen Types ====================

export type ActiveScreen = 'backend' | 'analytics' | 'manager';

export interface StaffComment {
  id: string;
  author: string;
  category: 'line_order' | 'tag_internal' | 'natural' | 'comment';
  content: string;
  timestamp: Date;
  minute: number;
}

export interface AlgorithmStatus {
  id: string;
  name: string;
  module: string;
  status: 'active' | 'idle' | 'error' | 'warming_up';
  metrics: Record<string, number | string>;
  lastUpdate: Date;
  tickRate?: number;
}

export interface DataSourceStatus {
  id: string;
  name: string;
  connected: boolean;
  lastUpdate: Date;
  dataRate: number;
  errors: number;
}

export interface PipelineLogEntry {
  id: string;
  timestamp: Date;
  module: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}
