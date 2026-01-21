// Unified Game Model Manager - Bridges GPS/Wearable Data with Tactical Instructions
// This creates a digital twin system for coherence analysis between physical data and tactical setup

import {
  GameModel,
  GameApproach,
  Player,
  ManagerInput,
  ProcessedInstruction,
  VerificationRequest,
  LiveMatchData,
  CoherenceReport,
  TacticalDeviation,
  DigitalTwin,
  TwinState,
  TrackingMetrics,
  PlayerInstruction,
  Formation,
  TacticalPrinciples,
  GamePhases,
  TransitionRule,
  PressureTrigger,
} from '@/types';
import {
  processManagerInput,
  createVerificationRequest,
  applyInstructionsToGameModel,
  generateGameApproach,
  TACTICAL_AI_SYSTEM_PROMPT,
} from './ai-manager-interface';
import { PatternRecognitionEngine, TacticalPattern, TacticalCoherence } from './pattern-recognition';
import { CatapultIntegrationService, CatapultPlayerSession, FatigueModel } from './catapult-integration';
import { createDigitalTwin, updateTwinState, predictPerformanceDecline } from './digital-twin';
import { InstructionLogManager, InstructionLogEntry } from './instruction-log';

// ==================== Types for Game Model Manager ====================

export interface ManagerSession {
  id: string;
  startedAt: Date;
  manager: StaffMember;
  technicalStaff: StaffMember[];
  activeGameModel: GameModel | null;
  activeGameApproach: GameApproach | null;
  pendingVerifications: VerificationRequest[];
  instructionHistory: ManagerInput[];
  coherenceSnapshots: CoherenceSnapshot[];
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'manager' | 'assistant_coach' | 'analyst' | 'fitness_coach' | 'goalkeeper_coach';
  canVerify: boolean;
  canModify: boolean;
}

export interface CoherenceSnapshot {
  timestamp: Date;
  minute: number;
  overallScore: number;
  byPhase: Record<string, number>;
  byPlayer: Record<string, number>;
  deviations: TacticalDeviation[];
  gpsCoherence: number; // How well physical data matches tactical expectations
  tacticalCoherence: number; // How well patterns match game model
}

export interface AIQueryResult {
  query: string;
  response: string;
  coherenceData?: CoherenceSnapshot;
  suggestions: string[];
  affectedPlayers: string[];
  timestamp: Date;
}

export interface GameModelTemplate {
  id: string;
  name: string;
  description: string;
  baseFormation: string;
  style: 'possession' | 'counter_attacking' | 'high_press' | 'balanced' | 'total_football';
  principles: string[];
}

// ==================== Pre-built Game Model Templates ====================

export const GAME_MODEL_TEMPLATES: GameModelTemplate[] = [
  {
    id: 'total_football',
    name: 'Total Football',
    description: 'Fluid, position-rotating system with high pressing and possession dominance',
    baseFormation: '4-3-3',
    style: 'total_football',
    principles: [
      'Positional rotation - players interchange freely',
      'High defensive line with aggressive pressing',
      'Build from back with goalkeeper involvement',
      'Create overloads through movement',
      'Quick combination play in tight spaces',
    ],
  },
  {
    id: 'counter_attacking',
    name: 'Counter Attacking',
    description: 'Compact defensive block with quick vertical transitions',
    baseFormation: '4-4-2',
    style: 'counter_attacking',
    principles: [
      'Deep defensive block - deny space centrally',
      'Quick transitions on ball recovery',
      'Direct vertical passes to forwards',
      'Wing play for crosses',
      'Compact shape - 30m between lines',
    ],
  },
  {
    id: 'high_press',
    name: 'High Press Intensity',
    description: 'Aggressive pressing to win ball high and create chances',
    baseFormation: '4-3-3',
    style: 'high_press',
    principles: [
      'Press triggers on backward passes',
      'Cover shadows to force play wide',
      'Counter-press immediately on loss',
      'High defensive line to squeeze space',
      'Intense 6-second rule after losing ball',
    ],
  },
  {
    id: 'possession_based',
    name: 'Possession Based',
    description: 'Patient build-up with controlled tempo and positional play',
    baseFormation: '4-3-3',
    style: 'possession',
    principles: [
      'Patient circulation - find the free man',
      'Positional superiority in each zone',
      'Third man combinations',
      'Control tempo - slow to fast',
      'Width in possession, compact without',
    ],
  },
];

// ==================== Game Model Manager Class ====================

export class GameModelManager {
  private session: ManagerSession | null = null;
  private patternEngine: PatternRecognitionEngine;
  private catapultService: CatapultIntegrationService;
  private instructionLog: InstructionLogManager;
  private digitalTwins: Map<string, DigitalTwin> = new Map();
  private players: Player[] = [];
  private liveCoherenceCallbacks: ((snapshot: CoherenceSnapshot) => void)[] = [];

  constructor(
    patternEngine: PatternRecognitionEngine,
    catapultService: CatapultIntegrationService,
    players: Player[]
  ) {
    this.patternEngine = patternEngine;
    this.catapultService = catapultService;
    this.instructionLog = new InstructionLogManager();
    this.players = players;

    // Initialize digital twins for all players
    this.initializeDigitalTwins();
  }

  private initializeDigitalTwins(): void {
    for (const player of this.players) {
      // Initialize with empty historical data - will be populated as match progresses
      const twin = createDigitalTwin(player, []);
      this.digitalTwins.set(player.id, twin);
    }
  }

  // ==================== Session Management ====================

  startSession(manager: StaffMember, technicalStaff: StaffMember[] = []): ManagerSession {
    this.session = {
      id: `session-${Date.now()}`,
      startedAt: new Date(),
      manager,
      technicalStaff,
      activeGameModel: null,
      activeGameApproach: null,
      pendingVerifications: [],
      instructionHistory: [],
      coherenceSnapshots: [],
    };
    return this.session;
  }

  getSession(): ManagerSession | null {
    return this.session;
  }

  // ==================== Game Model Creation ====================

  createGameModelFromTemplate(templateId: string, customizations?: Partial<GameModel>): GameModel {
    const template = GAME_MODEL_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const gameModel = this.createBaseGameModel(template);

    if (customizations) {
      Object.assign(gameModel, customizations);
    }

    if (this.session) {
      this.session.activeGameModel = gameModel;
    }

    return gameModel;
  }

  private createBaseGameModel(template: GameModelTemplate): GameModel {
    const now = new Date();

    const formation: Formation = {
      name: template.baseFormation,
      shape: {
        positions: this.getFormationPositions(template.baseFormation),
        lines: this.getFormationLines(template.baseFormation),
      },
      compactness: {
        vertical: { min: 25, max: 40, target: 32 },
        horizontal: { min: 30, max: 45, target: 38 },
      },
      width: {
        inPossession: template.style === 'possession' ? 60 : 50,
        outOfPossession: template.style === 'counter_attacking' ? 35 : 45,
        transitions: 45,
      },
      depth: {
        defensiveLineHeight: template.style === 'high_press' ? 45 : template.style === 'counter_attacking' ? 25 : 35,
        pressureLineHeight: template.style === 'high_press' ? 70 : 50,
        compactZoneDepth: 30,
      },
    };

    const principles: TacticalPrinciples = {
      inPossession: template.principles.filter(p =>
        p.toLowerCase().includes('possess') ||
        p.toLowerCase().includes('build') ||
        p.toLowerCase().includes('combination')
      ).map((p, i) => ({
        id: `poss-${i}`,
        name: p.split(' - ')[0] || p.substring(0, 30),
        description: p,
        priority: 10 - i,
        triggers: [],
        expectedBehaviors: [],
      })),
      outOfPossession: template.principles.filter(p =>
        p.toLowerCase().includes('press') ||
        p.toLowerCase().includes('block') ||
        p.toLowerCase().includes('compact') ||
        p.toLowerCase().includes('defensive')
      ).map((p, i) => ({
        id: `def-${i}`,
        name: p.split(' - ')[0] || p.substring(0, 30),
        description: p,
        pressureType: template.style === 'high_press' ? 'high' : template.style === 'counter_attacking' ? 'low' : 'mid',
        triggers: [],
        expectedBehaviors: [],
      })),
      transitions: [
        {
          id: 'trans-pos',
          type: 'attacking',
          name: 'Positive Transition',
          description: template.style === 'counter_attacking' ? 'Quick vertical transition' : 'Controlled transition',
          timeWindow: template.style === 'counter_attacking' ? 6 : 10,
          expectedBehaviors: [],
        },
        {
          id: 'trans-neg',
          type: 'defensive',
          name: 'Negative Transition',
          description: template.style === 'high_press' ? 'Immediate counter-press' : 'Organized recovery',
          timeWindow: template.style === 'high_press' ? 6 : 8,
          expectedBehaviors: [],
        },
      ],
      generalPrinciples: template.principles,
    };

    const phases: GamePhases = {
      buildUp: {
        description: 'Build-up play from goalkeeper',
        keyPoints: ['Goalkeeper involvement', 'Play through thirds'],
        playerMovements: [],
        passingPatterns: [],
        triggers: [],
      },
      progression: {
        description: 'Progress ball through midfield',
        keyPoints: ['Third man runs', 'Switch play'],
        playerMovements: [],
        passingPatterns: [],
        triggers: [],
      },
      finalThird: {
        description: 'Create and convert chances',
        keyPoints: ['Width and depth', 'Overloads'],
        playerMovements: [],
        passingPatterns: [],
        triggers: [],
      },
      pressing: {
        description: 'Pressing structure and triggers',
        keyPoints: template.style === 'high_press'
          ? ['Press on back pass', '6 second rule', 'Cover shadows']
          : ['Organized mid-block', 'Force wide'],
        playerMovements: [],
        passingPatterns: [],
        triggers: [],
      },
      defensiveBlock: {
        description: 'Organized defensive shape',
        keyPoints: ['Compact lines', 'Cover centrally'],
        playerMovements: [],
        passingPatterns: [],
        triggers: [],
      },
      attackingTransition: {
        description: 'Transition to attack',
        keyPoints: template.style === 'counter_attacking'
          ? ['Quick vertical pass', 'Run in behind', 'Support quickly']
          : ['Secure possession', 'Progress with control'],
        playerMovements: [],
        passingPatterns: [],
        triggers: [],
      },
      defensiveTransition: {
        description: 'Transition to defense',
        keyPoints: template.style === 'high_press'
          ? ['Counter-press immediately', 'Win it back high']
          : ['Recover shape', 'Protect central areas'],
        playerMovements: [],
        passingPatterns: [],
        triggers: [],
      },
    };

    return {
      id: `gm-${Date.now()}`,
      name: template.name,
      createdBy: this.session?.manager.id || 'system',
      createdAt: now,
      updatedAt: now,
      formation,
      principles,
      phases,
      pressureTriggers: this.getDefaultPressureTriggers(template.style),
      transitionRules: this.getDefaultTransitionRules(template.style),
      setPlays: [],
      playerInstructions: new Map(),
      validatedBy: [],
      status: 'draft',
    };
  }

  private getFormationPositions(formation: string): Formation['shape']['positions'] {
    // Simplified - return positions based on formation
    const positions: Formation['shape']['positions'] = [];
    const parts = formation.split('-').map(Number);

    // GK
    positions.push({ role: 'GK', baseX: 50, baseY: 5, movementRange: { minX: 30, maxX: 70, minY: 0, maxY: 20 } });

    let y = 20;
    for (const count of parts) {
      const spacing = 100 / (count + 1);
      for (let i = 0; i < count; i++) {
        positions.push({
          role: this.getRoleForLine(y, i, count),
          baseX: spacing * (i + 1),
          baseY: y,
          movementRange: { minX: spacing * i, maxX: spacing * (i + 2), minY: y - 15, maxY: y + 15 },
        });
      }
      y += 25;
    }

    return positions;
  }

  private getRoleForLine(y: number, index: number, count: number): string {
    if (y <= 25) return count === 4 ? ['LB', 'CB', 'CB', 'RB'][index] : ['CB', 'CB', 'CB'][index];
    if (y <= 50) return count === 3 ? ['CDM', 'CM', 'CM'][index] : ['LM', 'CM', 'CM', 'RM'][index];
    return count === 3 ? ['LW', 'ST', 'RW'][index] : ['LW', 'ST'][index];
  }

  private getFormationLines(formation: string): Formation['shape']['lines'] {
    return [
      { type: 'goalkeeper', height: 5, spacing: 0 },
      { type: 'defensive', height: 20, spacing: 15 },
      { type: 'midfield', height: 45, spacing: 12 },
      { type: 'attacking', height: 70, spacing: 20 },
    ];
  }

  private getDefaultPressureTriggers(style: string): PressureTrigger[] {
    const triggers: PressureTrigger[] = [];

    if (style === 'high_press' || style === 'total_football') {
      triggers.push({
        id: 'pt-backpass',
        name: 'Back Pass Trigger',
        description: 'Press immediately when opponent plays backward',
        condition: 'backward_pass',
        intensity: 'high',
        duration: 6,
        coverShadows: true,
      });
      triggers.push({
        id: 'pt-wide',
        name: 'Wide Area Trap',
        description: 'Trap in wide areas with aggressive press',
        condition: 'ball_wide',
        intensity: 'max',
        duration: 4,
        coverShadows: true,
      });
    }

    return triggers;
  }

  private getDefaultTransitionRules(style: string): TransitionRule[] {
    return [
      {
        id: 'tr-pos',
        type: 'positive',
        trigger: 'Ball won in middle or attacking third',
        immediateActions: style === 'counter_attacking'
          ? ['Look forward immediately', 'Run in behind', 'Support ball carrier']
          : ['Secure possession', 'Assess options', 'Progress when ready'],
        timeLimit: style === 'counter_attacking' ? 6 : 10,
        fallbackAction: 'Keep possession and recycle',
      },
      {
        id: 'tr-neg',
        type: 'negative',
        trigger: 'Ball lost',
        immediateActions: style === 'high_press'
          ? ['Counter-press immediately', 'Nearest player to ball', 'Cover passing lanes']
          : ['Drop into shape', 'Protect central areas', 'Recover behind ball'],
        timeLimit: 6,
        fallbackAction: 'Reset defensive shape',
      },
    ];
  }

  // ==================== AI Instruction Processing ====================

  async processManagerInstruction(
    input: string,
    inputType: 'text' | 'voice' = 'text'
  ): Promise<{
    processed: ManagerInput;
    verification?: VerificationRequest;
    applied: boolean;
  }> {
    if (!this.session) {
      throw new Error('No active session. Start a session first.');
    }

    // Process the natural language input
    const processed = processManagerInput(input, {
      players: this.players,
      currentGameModel: this.session.activeGameModel || undefined,
    });

    // Override input type
    processed.inputType = inputType;

    // Log the instruction
    const interpretation = {
      summary: processed.processedInstructions.map(i => i.instruction).join('; '),
      tacticalConcepts: processed.processedInstructions.map(i => i.category),
      affectedAreas: processed.processedInstructions.map(i => {
        if (i.category === 'formation') return 'formation' as const;
        if (i.category === 'pressing') return 'pressing' as const;
        if (i.category === 'possession') return 'possession' as const;
        if (i.category === 'transition') return 'transition' as const;
        if (i.category === 'player_specific') return 'individual' as const;
        return 'possession' as const;
      }),
      urgency: 'immediate' as const,
      complexity: processed.processedInstructions.length > 2 ? 'complex' as const : 'moderate' as const,
      dependencies: [] as string[],
      conflicts: [] as string[],
    };
    const logEntry = this.instructionLog.createEntry(processed, interpretation, 'manager');

    // Add to history
    this.session.instructionHistory.push(processed);

    // Check if verification is needed
    let verification: VerificationRequest | undefined;
    let applied = false;

    if (processed.needsVerification) {
      verification = createVerificationRequest(processed);
      this.session.pendingVerifications.push(verification);

      // Update log
      this.instructionLog.updateVerification(logEntry.id, 'pending');
    } else if (this.session.activeGameModel) {
      // Apply directly if high confidence
      const previousModel = { ...this.session.activeGameModel };
      this.session.activeGameModel = applyInstructionsToGameModel(
        this.session.activeGameModel,
        processed.processedInstructions
      );
      applied = true;

      // Update log with applied changes
      const changes = processed.processedInstructions.map(i => ({
        type: 'game_model' as const,
        target: this.session!.activeGameModel!.id,
        field: i.category,
        previousValue: null as unknown,
        newValue: i.instruction as unknown,
        timestamp: new Date(),
      }));
      // Convert playerInstructions to Map<string, string[]> for snapshot
      const convertInstructions = (map: Map<string, PlayerInstruction>) => {
        const result = new Map<string, string[]>();
        map.forEach((value, key) => result.set(key, value.responsibilities));
        return result;
      };
      const previousSnapshot = {
        gameModelId: previousModel.id,
        gameModelName: previousModel.name,
        formation: previousModel.formation.name,
        principles: previousModel.principles.generalPrinciples,
        playerInstructions: convertInstructions(previousModel.playerInstructions),
      };
      const newSnapshot = {
        gameModelId: this.session.activeGameModel.id,
        gameModelName: this.session.activeGameModel.name,
        formation: this.session.activeGameModel.formation.name,
        principles: this.session.activeGameModel.principles.generalPrinciples,
        playerInstructions: convertInstructions(this.session.activeGameModel.playerInstructions),
      };
      this.instructionLog.recordApplication(
        logEntry.id,
        changes,
        previousSnapshot,
        newSnapshot
      );
    }

    return { processed, verification, applied };
  }

  verifyInstruction(
    verificationId: string,
    verifiedBy: StaffMember,
    status: 'verified' | 'modified' | 'rejected',
    modifications?: string
  ): boolean {
    if (!this.session) return false;

    const verification = this.session.pendingVerifications.find(v => v.id === verificationId);
    if (!verification) return false;

    verification.status = status;
    verification.verifiedBy = verifiedBy.id;
    verification.verifiedAt = new Date();
    verification.modifications = modifications;

    // If verified or modified, apply the instructions
    if ((status === 'verified' || status === 'modified') && this.session.activeGameModel) {
      const instructionsToApply = status === 'modified' && modifications
        ? processManagerInput(modifications, { players: this.players }).processedInstructions
        : verification.interpretations;

      this.session.activeGameModel = applyInstructionsToGameModel(
        this.session.activeGameModel,
        instructionsToApply
      );

      // Remove from pending
      this.session.pendingVerifications = this.session.pendingVerifications.filter(
        v => v.id !== verificationId
      );

      return true;
    }

    return status === 'rejected';
  }

  // ==================== Game Approach (Match-Specific) ====================

  createGameApproach(
    matchId: string,
    opponentInfo: string,
    matchContext: string,
    additionalInstructions: string = ''
  ): GameApproach {
    if (!this.session?.activeGameModel) {
      throw new Error('No active game model. Create or load a game model first.');
    }

    // Process any additional instructions
    const processed = additionalInstructions
      ? processManagerInput(additionalInstructions, {
          players: this.players,
          currentGameModel: this.session.activeGameModel,
        })
      : { processedInstructions: [] };

    // Generate game approach
    const approach = generateGameApproach(
      this.session.activeGameModel,
      opponentInfo,
      matchContext,
      processed.processedInstructions
    );

    approach.matchId = matchId;
    this.session.activeGameApproach = approach;

    return approach;
  }

  // ==================== Live Coherence Analysis ====================

  calculateLiveCoherence(
    minute: number,
    homePositions: { playerId: string; x: number; y: number }[],
    awayPositions: { playerId: string; x: number; y: number }[],
    ballPosition: { x: number; y: number },
    possession: 'home' | 'away',
    playerMetrics: Map<string, TrackingMetrics>
  ): CoherenceSnapshot {
    if (!this.session?.activeGameModel) {
      throw new Error('No active game model for coherence analysis');
    }

    const gameModel = this.session.activeGameModel;

    // Update digital twins with current metrics
    for (const [playerId, metrics] of playerMetrics) {
      const twin = this.digitalTwins.get(playerId);
      if (twin) {
        updateTwinState(twin, metrics, minute);
      }
    }

    // Calculate GPS coherence (how well physical output matches expectations)
    const gpsCoherence = this.calculateGPSCoherence(playerMetrics, gameModel);

    // Calculate tactical coherence (how well patterns match game model)
    const patterns = this.patternEngine.getActivePatterns('home');
    const tacticalCoherence = this.calculateTacticalCoherenceScore(patterns, gameModel);

    // Calculate position coherence
    const positionCoherence = this.calculatePositionCoherence(homePositions, gameModel);

    // Calculate phase-specific coherence
    const currentPhase = this.determineCurrentPhase(possession, ballPosition);
    const byPhase: Record<string, number> = {
      [currentPhase]: (gpsCoherence + tacticalCoherence + positionCoherence) / 3,
    };

    // Calculate player-specific coherence
    const byPlayer: Record<string, number> = {};
    for (const pos of homePositions) {
      const twin = this.digitalTwins.get(pos.playerId);
      byPlayer[pos.playerId] = twin?.currentState.tacticalCompliance || 70;
    }

    // Identify deviations
    const deviations = this.identifyDeviations(homePositions, playerMetrics, gameModel, minute);

    // Overall score
    const overallScore = Math.round(
      (gpsCoherence * 0.3 + tacticalCoherence * 0.4 + positionCoherence * 0.3)
    );

    const snapshot: CoherenceSnapshot = {
      timestamp: new Date(),
      minute,
      overallScore,
      byPhase,
      byPlayer,
      deviations,
      gpsCoherence,
      tacticalCoherence,
    };

    // Store snapshot
    if (this.session) {
      this.session.coherenceSnapshots.push(snapshot);
    }

    // Notify listeners
    for (const callback of this.liveCoherenceCallbacks) {
      callback(snapshot);
    }

    return snapshot;
  }

  private calculateGPSCoherence(
    playerMetrics: Map<string, TrackingMetrics>,
    gameModel: GameModel
  ): number {
    let totalScore = 0;
    let playerCount = 0;

    for (const [playerId, metrics] of playerMetrics) {
      const instruction = gameModel.playerInstructions.get(playerId);
      if (!instruction) continue;

      const expected = instruction.physicalRequirements;
      let playerScore = 100;

      // Check distance
      if (metrics.totalDistance < expected.expectedDistance.min * 0.8) {
        playerScore -= 20;
      } else if (metrics.totalDistance > expected.expectedDistance.max * 1.2) {
        playerScore -= 10;
      }

      // Check sprints (use high-speed running as proxy)
      const sprintCount = Math.floor(metrics.sprintDistance / 20); // Rough estimate
      if (sprintCount < expected.expectedSprints.min * 0.7) {
        playerScore -= 15;
      }

      totalScore += Math.max(0, playerScore);
      playerCount++;
    }

    return playerCount > 0 ? totalScore / playerCount : 70;
  }

  private calculateTacticalCoherenceScore(
    patterns: TacticalPattern[],
    gameModel: GameModel
  ): number {
    const expectedPatterns = this.getExpectedPatterns(gameModel);
    const detectedTypes = patterns.map(p => p.type);

    // Count matches
    const matchedPatterns = expectedPatterns.filter(exp =>
      detectedTypes.some(det => det.includes(exp) || exp.includes(det))
    );

    const baseScore = expectedPatterns.length > 0
      ? (matchedPatterns.length / expectedPatterns.length) * 100
      : 50;

    // Bonus for high confidence patterns
    const highConfidence = patterns.filter(p => p.confidence > 0.7);
    const confidenceBonus = Math.min(15, highConfidence.length * 3);

    return Math.min(100, baseScore + confidenceBonus);
  }

  private getExpectedPatterns(gameModel: GameModel): string[] {
    const patterns: string[] = [];

    // Extract from principles
    for (const principle of gameModel.principles.inPossession) {
      if (principle.description.toLowerCase().includes('rotation')) patterns.push('positional_rotation');
      if (principle.description.toLowerCase().includes('combination')) patterns.push('quick_combination');
      if (principle.description.toLowerCase().includes('width')) patterns.push('switch_play');
    }

    for (const principle of gameModel.principles.outOfPossession) {
      if (principle.pressureType === 'high') patterns.push('high_press_trigger');
      if (principle.pressureType === 'low') patterns.push('deep_block');
      if (principle.description.toLowerCase().includes('compact')) patterns.push('defensive_compact');
    }

    return patterns;
  }

  private calculatePositionCoherence(
    positions: { playerId: string; x: number; y: number }[],
    gameModel: GameModel
  ): number {
    let totalDeviation = 0;
    let count = 0;

    for (const pos of positions) {
      const expectedPos = gameModel.formation.shape.positions.find(
        p => this.players.find(pl => pl.id === pos.playerId)?.position === p.role
      );

      if (expectedPos) {
        const dx = Math.abs(pos.x - expectedPos.baseX);
        const dy = Math.abs(pos.y - expectedPos.baseY);
        const distance = Math.sqrt(dx * dx + dy * dy);
        totalDeviation += Math.min(100, distance * 2);
        count++;
      }
    }

    return count > 0 ? Math.max(0, 100 - (totalDeviation / count)) : 70;
  }

  private determineCurrentPhase(
    possession: 'home' | 'away',
    ballPosition: { x: number; y: number }
  ): string {
    if (possession === 'home') {
      if (ballPosition.y < 33) return 'buildUp';
      if (ballPosition.y < 66) return 'progression';
      return 'finalThird';
    } else {
      if (ballPosition.y > 66) return 'pressing';
      return 'defensiveBlock';
    }
  }

  private identifyDeviations(
    positions: { playerId: string; x: number; y: number }[],
    metrics: Map<string, TrackingMetrics>,
    gameModel: GameModel,
    minute: number
  ): TacticalDeviation[] {
    const deviations: TacticalDeviation[] = [];

    for (const pos of positions) {
      const player = this.players.find(p => p.id === pos.playerId);
      if (!player) continue;

      const expectedPos = gameModel.formation.shape.positions.find(p => p.role === player.position);
      if (!expectedPos) continue;

      const dx = Math.abs(pos.x - expectedPos.baseX);
      const dy = Math.abs(pos.y - expectedPos.baseY);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 15) {
        deviations.push({
          id: `dev-${minute}-${pos.playerId}`,
          timestamp: new Date(),
          minute,
          type: 'position',
          expected: `Near (${expectedPos.baseX.toFixed(0)}, ${expectedPos.baseY.toFixed(0)})`,
          actual: `At (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`,
          severity: distance > 25 ? 'major' : 'moderate',
          context: `${player.name} out of expected zone`,
        });
      }

      // Check intensity
      const playerMetrics = metrics.get(pos.playerId);
      const instruction = gameModel.playerInstructions.get(pos.playerId);

      if (playerMetrics && instruction) {
        const expectedDist = instruction.physicalRequirements.expectedDistance;
        const currentRate = playerMetrics.distancePerMinute;
        const expectedRate = (expectedDist.min + expectedDist.max) / 2 / 90;

        if (currentRate < expectedRate * 0.7) {
          deviations.push({
            id: `dev-${minute}-${pos.playerId}-intensity`,
            timestamp: new Date(),
            minute,
            type: 'intensity',
            expected: `${expectedRate.toFixed(0)}m/min`,
            actual: `${currentRate.toFixed(0)}m/min`,
            severity: currentRate < expectedRate * 0.5 ? 'major' : 'minor',
            context: `${player.name} below expected work rate`,
          });
        }
      }
    }

    return deviations;
  }

  // ==================== AI Query Interface ====================

  async queryLiveCoherence(query: string): Promise<AIQueryResult> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const latestSnapshot = this.session.coherenceSnapshots.slice(-1)[0];
    const suggestions: string[] = [];
    const affectedPlayers: string[] = [];

    // Analyze query and provide response
    const queryLower = query.toLowerCase();
    let response = '';

    if (queryLower.includes('coherence') || queryLower.includes('how are we doing')) {
      response = this.generateCoherenceResponse(latestSnapshot);
    } else if (queryLower.includes('fatigue') || queryLower.includes('tired')) {
      response = this.generateFatigueResponse();
      const fatigued = this.getFatiguedPlayers();
      affectedPlayers.push(...fatigued.map(p => p.id));
      if (fatigued.length > 0) {
        suggestions.push(`Consider substituting ${fatigued[0].name}`);
      }
    } else if (queryLower.includes('pressing') || queryLower.includes('press')) {
      response = this.generatePressingResponse(latestSnapshot);
    } else if (queryLower.includes('deviation') || queryLower.includes('problem')) {
      response = this.generateDeviationResponse(latestSnapshot);
    } else {
      response = this.generateGeneralResponse(query, latestSnapshot);
    }

    return {
      query,
      response,
      coherenceData: latestSnapshot,
      suggestions,
      affectedPlayers,
      timestamp: new Date(),
    };
  }

  private generateCoherenceResponse(snapshot?: CoherenceSnapshot): string {
    if (!snapshot) {
      return 'No coherence data available yet. Start the match simulation to see live coherence.';
    }

    const score = snapshot.overallScore;
    const status = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'needs attention' : 'poor';

    let response = `Current coherence is ${status} at ${score}%.\n`;
    response += `- GPS Coherence: ${snapshot.gpsCoherence.toFixed(0)}% (physical output vs expectations)\n`;
    response += `- Tactical Coherence: ${snapshot.tacticalCoherence.toFixed(0)}% (pattern matching)\n`;

    if (snapshot.deviations.length > 0) {
      response += `\nActive deviations: ${snapshot.deviations.length}\n`;
      const major = snapshot.deviations.filter(d => d.severity === 'major');
      if (major.length > 0) {
        response += `⚠️ Major issue: ${major[0].context}`;
      }
    }

    return response;
  }

  private generateFatigueResponse(): string {
    const fatigued = this.getFatiguedPlayers();

    if (fatigued.length === 0) {
      return 'All players showing good energy levels. No fatigue concerns at this time.';
    }

    let response = `${fatigued.length} player(s) showing fatigue:\n`;
    for (const player of fatigued.slice(0, 3)) {
      const twin = this.digitalTwins.get(player.id);
      const fatigue = twin?.currentState.fatigue || 0;
      response += `- ${player.name}: ${fatigue.toFixed(0)}% fatigue\n`;
    }

    return response;
  }

  private getFatiguedPlayers(): Player[] {
    return this.players.filter(p => {
      const twin = this.digitalTwins.get(p.id);
      return twin && twin.currentState.fatigue > 70;
    });
  }

  private generatePressingResponse(snapshot?: CoherenceSnapshot): string {
    if (!this.session?.activeGameModel) {
      return 'No game model loaded to analyze pressing.';
    }

    const gameModel = this.session.activeGameModel;
    const pressingType = gameModel.principles.outOfPossession[0]?.pressureType || 'mid';
    const triggers = gameModel.pressureTriggers;

    let response = `Current pressing system: ${pressingType} block\n`;
    response += `Active triggers: ${triggers.map(t => t.name).join(', ') || 'None defined'}\n`;

    if (snapshot) {
      response += `\nPress execution coherence: ${snapshot.tacticalCoherence.toFixed(0)}%`;
    }

    return response;
  }

  private generateDeviationResponse(snapshot?: CoherenceSnapshot): string {
    if (!snapshot || snapshot.deviations.length === 0) {
      return 'No significant tactical deviations detected.';
    }

    let response = `Found ${snapshot.deviations.length} deviation(s):\n`;

    for (const dev of snapshot.deviations.slice(0, 5)) {
      const icon = dev.severity === 'major' ? '🔴' : dev.severity === 'moderate' ? '🟡' : '🟢';
      response += `${icon} ${dev.context}\n`;
      response += `   Expected: ${dev.expected}, Actual: ${dev.actual}\n`;
    }

    return response;
  }

  private generateGeneralResponse(query: string, snapshot?: CoherenceSnapshot): string {
    return `Analyzing: "${query}"\n\n` +
      `Current match status:\n` +
      `- Overall coherence: ${snapshot?.overallScore || 'N/A'}%\n` +
      `- Game model: ${this.session?.activeGameModel?.name || 'None loaded'}\n` +
      `- Active deviations: ${snapshot?.deviations.length || 0}\n\n` +
      `Ask about specific aspects like "coherence", "fatigue", "pressing", or "deviations" for detailed analysis.`;
  }

  // ==================== Subscription ====================

  onCoherenceUpdate(callback: (snapshot: CoherenceSnapshot) => void): () => void {
    this.liveCoherenceCallbacks.push(callback);
    return () => {
      this.liveCoherenceCallbacks = this.liveCoherenceCallbacks.filter(cb => cb !== callback);
    };
  }

  // ==================== Getters ====================

  getActiveGameModel(): GameModel | null {
    return this.session?.activeGameModel || null;
  }

  getActiveGameApproach(): GameApproach | null {
    return this.session?.activeGameApproach || null;
  }

  getPendingVerifications(): VerificationRequest[] {
    return this.session?.pendingVerifications || [];
  }

  getCoherenceHistory(): CoherenceSnapshot[] {
    return this.session?.coherenceSnapshots || [];
  }

  getDigitalTwin(playerId: string): DigitalTwin | undefined {
    return this.digitalTwins.get(playerId);
  }

  getInstructionLog(): InstructionLogEntry[] {
    return this.instructionLog.getLogs();
  }
}

// ==================== Factory Function ====================

export function createGameModelManager(
  patternEngine: PatternRecognitionEngine,
  catapultService: CatapultIntegrationService,
  players: Player[]
): GameModelManager {
  return new GameModelManager(patternEngine, catapultService, players);
}
