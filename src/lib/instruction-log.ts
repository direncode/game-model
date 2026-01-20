// Comprehensive AI Instruction Logging System
// Tracks all manager instructions, their interpretation, application, and outcomes

import type {
  GameModel,
  GameApproach,
  Player,
  ProcessedInstruction,
  ManagerInput,
  CoherenceReport,
} from '@/types';

// ==================== Log Entry Types ====================

export interface InstructionLogEntry {
  id: string;
  timestamp: Date;
  sessionId: string;
  matchId?: string;

  // Input data
  rawInput: string;
  inputType: 'text' | 'voice' | 'tactical_board' | 'preset';
  inputSource: 'manager' | 'assistant_coach' | 'analyst' | 'system';

  // Processing data
  processedInstructions: ProcessedInstruction[];
  interpretation: InstructionInterpretation;
  confidence: number;

  // Verification
  verificationStatus: 'pending' | 'verified' | 'modified' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: Date;
  modifications?: string;

  // Application
  applicationStatus: 'pending' | 'applied' | 'failed' | 'partial';
  appliedTo: AppliedChange[];
  previousState?: StateSnapshot;
  newState?: StateSnapshot;

  // Outcome tracking
  outcomes: InstructionOutcome[];
  coherenceImpact?: CoherenceImpact;

  // Context
  matchContext?: MatchContext;
  tags: string[];
  notes: string[];
}

export interface InstructionInterpretation {
  summary: string;
  tacticalConcepts: string[];
  affectedAreas: ('formation' | 'pressing' | 'possession' | 'transition' | 'set_plays' | 'individual')[];
  urgency: 'immediate' | 'next_phase' | 'next_half' | 'next_match';
  complexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];
  conflicts: string[];
}

export interface AppliedChange {
  type: 'game_model' | 'game_approach' | 'player_instruction' | 'formation' | 'principle';
  target: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  timestamp: Date;
}

export interface StateSnapshot {
  gameModelId: string;
  gameModelName: string;
  formation: string;
  principles: string[];
  playerInstructions: Map<string, string[]>;
}

export interface InstructionOutcome {
  timestamp: Date;
  matchMinute?: number;
  type: 'coherence_change' | 'player_behavior' | 'team_metric' | 'event';
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
  metrics?: Record<string, number>;
}

export interface CoherenceImpact {
  beforeScore: number;
  afterScore: number;
  change: number;
  byPhase: Map<string, { before: number; after: number }>;
  byPlayer: Map<string, { before: number; after: number }>;
  analysisWindow: number; // minutes
}

export interface MatchContext {
  matchId: string;
  minute: number;
  score: { home: number; away: number };
  phase: string;
  possession: number;
  momentum: 'home' | 'away' | 'neutral';
  recentEvents: string[];
}

// ==================== Instruction Log Manager ====================

export class InstructionLogManager {
  private logs: InstructionLogEntry[] = [];
  private sessionId: string;
  private currentMatchId?: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session-${Date.now()}`;
  }

  // Create new log entry
  createEntry(
    input: ManagerInput,
    interpretation: InstructionInterpretation,
    source: InstructionLogEntry['inputSource'] = 'manager'
  ): InstructionLogEntry {
    const entry: InstructionLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      sessionId: this.sessionId,
      matchId: this.currentMatchId,
      rawInput: input.rawInput,
      inputType: input.inputType,
      inputSource: source,
      processedInstructions: input.processedInstructions,
      interpretation,
      confidence: input.confidence,
      verificationStatus: input.needsVerification ? 'pending' : 'verified',
      applicationStatus: 'pending',
      appliedTo: [],
      outcomes: [],
      tags: this.extractTags(input),
      notes: [],
    };

    this.logs.push(entry);
    return entry;
  }

  // Update log entry after verification
  updateVerification(
    logId: string,
    status: InstructionLogEntry['verificationStatus'],
    verifiedBy?: string,
    modifications?: string
  ): void {
    const entry = this.logs.find(l => l.id === logId);
    if (entry) {
      entry.verificationStatus = status;
      entry.verifiedBy = verifiedBy;
      entry.verifiedAt = new Date();
      entry.modifications = modifications;
    }
  }

  // Record application of instructions
  recordApplication(
    logId: string,
    changes: AppliedChange[],
    previousState: StateSnapshot,
    newState: StateSnapshot,
    status: InstructionLogEntry['applicationStatus'] = 'applied'
  ): void {
    const entry = this.logs.find(l => l.id === logId);
    if (entry) {
      entry.applicationStatus = status;
      entry.appliedTo = changes;
      entry.previousState = previousState;
      entry.newState = newState;
    }
  }

  // Record outcome
  recordOutcome(logId: string, outcome: InstructionOutcome): void {
    const entry = this.logs.find(l => l.id === logId);
    if (entry) {
      entry.outcomes.push(outcome);
    }
  }

  // Record coherence impact
  recordCoherenceImpact(logId: string, impact: CoherenceImpact): void {
    const entry = this.logs.find(l => l.id === logId);
    if (entry) {
      entry.coherenceImpact = impact;
    }
  }

  // Set match context
  setMatchContext(logId: string, context: MatchContext): void {
    const entry = this.logs.find(l => l.id === logId);
    if (entry) {
      entry.matchContext = context;
    }
  }

  // Add note
  addNote(logId: string, note: string): void {
    const entry = this.logs.find(l => l.id === logId);
    if (entry) {
      entry.notes.push(`[${new Date().toISOString()}] ${note}`);
    }
  }

  // Get all logs
  getLogs(): InstructionLogEntry[] {
    return [...this.logs];
  }

  // Get logs for current session
  getSessionLogs(): InstructionLogEntry[] {
    return this.logs.filter(l => l.sessionId === this.sessionId);
  }

  // Get logs for a match
  getMatchLogs(matchId: string): InstructionLogEntry[] {
    return this.logs.filter(l => l.matchId === matchId);
  }

  // Get logs by tag
  getLogsByTag(tag: string): InstructionLogEntry[] {
    return this.logs.filter(l => l.tags.includes(tag));
  }

  // Search logs
  searchLogs(query: string): InstructionLogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.logs.filter(l =>
      l.rawInput.toLowerCase().includes(lowerQuery) ||
      l.interpretation.summary.toLowerCase().includes(lowerQuery) ||
      l.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  // Get instruction effectiveness
  getInstructionEffectiveness(logId: string): {
    overallSuccess: number;
    coherenceChange: number;
    positiveOutcomes: number;
    negativeOutcomes: number;
  } {
    const entry = this.logs.find(l => l.id === logId);
    if (!entry) {
      return { overallSuccess: 0, coherenceChange: 0, positiveOutcomes: 0, negativeOutcomes: 0 };
    }

    const positiveOutcomes = entry.outcomes.filter(o => o.impact === 'positive').length;
    const negativeOutcomes = entry.outcomes.filter(o => o.impact === 'negative').length;
    const coherenceChange = entry.coherenceImpact?.change || 0;

    const outcomeScore = entry.outcomes.length > 0
      ? (positiveOutcomes - negativeOutcomes) / entry.outcomes.length
      : 0;

    const overallSuccess = (
      (entry.applicationStatus === 'applied' ? 30 : 0) +
      (coherenceChange > 0 ? Math.min(40, coherenceChange * 2) : Math.max(-40, coherenceChange * 2)) +
      (outcomeScore * 30)
    );

    return {
      overallSuccess: Math.max(0, Math.min(100, overallSuccess + 50)),
      coherenceChange,
      positiveOutcomes,
      negativeOutcomes,
    };
  }

  // Set current match
  setCurrentMatch(matchId: string): void {
    this.currentMatchId = matchId;
  }

  // Extract tags from input
  private extractTags(input: ManagerInput): string[] {
    const tags: string[] = [];

    for (const instruction of input.processedInstructions) {
      tags.push(instruction.category);

      if (instruction.affectedPhases) {
        tags.push(...instruction.affectedPhases);
      }
    }

    // Add tactical keyword tags
    const text = input.rawInput.toLowerCase();
    const keywordTags: Record<string, string[]> = {
      'pressing': ['press', 'pressure', 'trigger'],
      'possession': ['keep ball', 'circulate', 'patient'],
      'counter': ['counter', 'transition', 'break'],
      'defensive': ['defend', 'block', 'compact'],
      'set-piece': ['corner', 'free kick', 'set piece'],
    };

    for (const [tag, keywords] of Object.entries(keywordTags)) {
      if (keywords.some(k => text.includes(k))) {
        tags.push(tag);
      }
    }

    return [...new Set(tags)];
  }

  // Export logs
  exportLogs(): string {
    return JSON.stringify(this.logs, (key, value) => {
      if (value instanceof Map) {
        return { __type: 'Map', entries: Array.from(value.entries()) };
      }
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }
      return value;
    }, 2);
  }

  // Import logs
  importLogs(json: string): void {
    const parsed = JSON.parse(json, (key, value) => {
      if (value && typeof value === 'object') {
        if (value.__type === 'Map') {
          return new Map(value.entries);
        }
        if (value.__type === 'Date') {
          return new Date(value.value);
        }
      }
      return value;
    });
    this.logs = parsed;
  }
}

// ==================== Interpretation Generator ====================

export function generateInterpretation(
  input: ManagerInput,
  context?: { gameModel?: GameModel; matchMinute?: number }
): InstructionInterpretation {
  const concepts: string[] = [];
  const affectedAreas: InstructionInterpretation['affectedAreas'] = [];
  const dependencies: string[] = [];
  const conflicts: string[] = [];

  // Analyze each processed instruction
  for (const instruction of input.processedInstructions) {
    // Map category to affected area
    switch (instruction.category) {
      case 'formation':
        affectedAreas.push('formation');
        concepts.push('Shape adjustment');
        break;
      case 'pressing':
        affectedAreas.push('pressing');
        concepts.push('Pressing system');
        break;
      case 'possession':
        affectedAreas.push('possession');
        concepts.push('Build-up play');
        break;
      case 'transition':
        affectedAreas.push('transition');
        concepts.push('Transition play');
        break;
      case 'player_specific':
        affectedAreas.push('individual');
        concepts.push('Individual role');
        break;
    }

    // Detect dependencies
    if (instruction.affectedPlayers.length > 3) {
      dependencies.push('Requires team-wide coordination');
    }

    if (instruction.category === 'pressing' && context?.gameModel) {
      if (context.gameModel.formation.depth.defensiveLineHeight < 30) {
        conflicts.push('High press conflicts with deep defensive line');
      }
    }
  }

  // Determine urgency
  let urgency: InstructionInterpretation['urgency'] = 'next_phase';
  const text = input.rawInput.toLowerCase();
  if (text.includes('now') || text.includes('immediately') || text.includes('right away')) {
    urgency = 'immediate';
  } else if (text.includes('second half') || text.includes('after half')) {
    urgency = 'next_half';
  } else if (text.includes('next game') || text.includes('going forward')) {
    urgency = 'next_match';
  }

  // Determine complexity
  let complexity: InstructionInterpretation['complexity'] = 'simple';
  if (input.processedInstructions.length > 3 || affectedAreas.length > 2) {
    complexity = 'complex';
  } else if (input.processedInstructions.length > 1 || affectedAreas.length > 1) {
    complexity = 'moderate';
  }

  // Generate summary
  const summary = generateSummary(input, affectedAreas, concepts);

  return {
    summary,
    tacticalConcepts: [...new Set(concepts)],
    affectedAreas: [...new Set(affectedAreas)],
    urgency,
    complexity,
    dependencies,
    conflicts,
  };
}

function generateSummary(
  input: ManagerInput,
  areas: string[],
  concepts: string[]
): string {
  const areaStr = areas.length > 0 ? areas.join(', ') : 'general tactics';
  const conceptStr = concepts.length > 0 ? concepts.join(' and ') : 'tactical adjustment';

  if (input.processedInstructions.length === 1) {
    return `${conceptStr} affecting ${areaStr}`;
  }

  return `Multiple adjustments (${input.processedInstructions.length}) affecting ${areaStr}, involving ${conceptStr.toLowerCase()}`;
}

// ==================== Log Display Formatting ====================

export function formatLogEntry(entry: InstructionLogEntry): string {
  const lines: string[] = [];

  lines.push(`=== Instruction Log: ${entry.id} ===`);
  lines.push(`Timestamp: ${entry.timestamp.toISOString()}`);
  lines.push(`Session: ${entry.sessionId}`);
  if (entry.matchId) lines.push(`Match: ${entry.matchId}`);
  lines.push('');

  lines.push('--- INPUT ---');
  lines.push(`Type: ${entry.inputType}`);
  lines.push(`Source: ${entry.inputSource}`);
  lines.push(`Raw: "${entry.rawInput}"`);
  lines.push(`Confidence: ${(entry.confidence * 100).toFixed(1)}%`);
  lines.push('');

  lines.push('--- INTERPRETATION ---');
  lines.push(`Summary: ${entry.interpretation.summary}`);
  lines.push(`Concepts: ${entry.interpretation.tacticalConcepts.join(', ')}`);
  lines.push(`Affected Areas: ${entry.interpretation.affectedAreas.join(', ')}`);
  lines.push(`Urgency: ${entry.interpretation.urgency}`);
  lines.push(`Complexity: ${entry.interpretation.complexity}`);
  if (entry.interpretation.dependencies.length > 0) {
    lines.push(`Dependencies: ${entry.interpretation.dependencies.join('; ')}`);
  }
  if (entry.interpretation.conflicts.length > 0) {
    lines.push(`Conflicts: ${entry.interpretation.conflicts.join('; ')}`);
  }
  lines.push('');

  lines.push('--- PROCESSED INSTRUCTIONS ---');
  entry.processedInstructions.forEach((inst, i) => {
    lines.push(`${i + 1}. [${inst.category}] ${inst.instruction}`);
    lines.push(`   Priority: ${inst.priority}, Confidence: ${(inst.confidence * 100).toFixed(1)}%`);
    if (inst.affectedPlayers.length > 0) {
      lines.push(`   Affected Players: ${inst.affectedPlayers.join(', ')}`);
    }
  });
  lines.push('');

  lines.push('--- STATUS ---');
  lines.push(`Verification: ${entry.verificationStatus}`);
  if (entry.verifiedBy) lines.push(`Verified by: ${entry.verifiedBy}`);
  if (entry.modifications) lines.push(`Modifications: ${entry.modifications}`);
  lines.push(`Application: ${entry.applicationStatus}`);
  lines.push('');

  if (entry.appliedTo.length > 0) {
    lines.push('--- CHANGES APPLIED ---');
    entry.appliedTo.forEach((change, i) => {
      lines.push(`${i + 1}. ${change.type}: ${change.target}.${change.field}`);
      lines.push(`   ${JSON.stringify(change.previousValue)} → ${JSON.stringify(change.newValue)}`);
    });
    lines.push('');
  }

  if (entry.coherenceImpact) {
    lines.push('--- COHERENCE IMPACT ---');
    lines.push(`Before: ${entry.coherenceImpact.beforeScore}%`);
    lines.push(`After: ${entry.coherenceImpact.afterScore}%`);
    lines.push(`Change: ${entry.coherenceImpact.change > 0 ? '+' : ''}${entry.coherenceImpact.change}%`);
    lines.push('');
  }

  if (entry.outcomes.length > 0) {
    lines.push('--- OUTCOMES ---');
    entry.outcomes.forEach((outcome, i) => {
      const minute = outcome.matchMinute ? `${outcome.matchMinute}'` : '';
      lines.push(`${i + 1}. [${outcome.impact.toUpperCase()}] ${minute} ${outcome.description}`);
    });
    lines.push('');
  }

  if (entry.notes.length > 0) {
    lines.push('--- NOTES ---');
    entry.notes.forEach(note => lines.push(note));
    lines.push('');
  }

  lines.push(`Tags: ${entry.tags.join(', ')}`);
  lines.push('='.repeat(40));

  return lines.join('\n');
}

// ==================== Singleton Instance ====================

let logManagerInstance: InstructionLogManager | null = null;

export function getInstructionLogManager(): InstructionLogManager {
  if (!logManagerInstance) {
    logManagerInstance = new InstructionLogManager();
  }
  return logManagerInstance;
}

export function resetInstructionLogManager(sessionId?: string): InstructionLogManager {
  logManagerInstance = new InstructionLogManager(sessionId);
  return logManagerInstance;
}
