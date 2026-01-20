// AI Manager Interface for Processing Tactical Instructions

import {
  ManagerInput,
  ProcessedInstruction,
  VerificationRequest,
  ClarificationQuestion,
  GameModel,
  GameApproach,
  TacticalAdjustment,
  Player,
} from '@/types';

// ==================== Instruction Categories ====================

const INSTRUCTION_PATTERNS = {
  formation: [
    /form(ation)?/i,
    /shape/i,
    /\d-\d-\d/,
    /back\s*(three|four|five)/i,
    /midfield\s*(diamond|flat|triangle)/i,
  ],
  pressing: [
    /press(ing)?/i,
    /high\s*line/i,
    /low\s*block/i,
    /trigger/i,
    /counter-?press/i,
    /intensity/i,
    /gegenpress/i,
  ],
  possession: [
    /possess(ion)?/i,
    /build[- ]?up/i,
    /play\s*out/i,
    /circulate/i,
    /patient/i,
    /tempo/i,
    /direct/i,
  ],
  transition: [
    /transition/i,
    /counter[- ]?attack/i,
    /break/i,
    /recovery/i,
    /quick/i,
    /vertical/i,
  ],
  player_specific: [
    /\b[A-Z][a-z]+\s+(should|needs|must|will)/i,
    /number\s*\d+/i,
    /(striker|forward|midfielder|defender|keeper|winger|fullback)/i,
    /left|right|central/i,
  ],
  setPlays: [
    /corner/i,
    /free[- ]?kick/i,
    /throw[- ]?in/i,
    /set[- ]?piece/i,
    /penalty/i,
  ],
};

const TACTICAL_KEYWORDS = {
  high_press: ['high press', 'press high', 'front foot', 'aggressive', 'suffocate', 'trap'],
  low_block: ['low block', 'deep', 'compact', 'deny space', 'sit back'],
  possession: ['keep ball', 'patient', 'circulate', 'work angles', 'find space'],
  direct: ['direct', 'quick', 'vertical', 'long ball', 'in behind', 'early ball'],
  width: ['wide', 'stretch', 'touchline', 'width', 'spread'],
  compact: ['compact', 'narrow', 'tight', 'close gaps', 'reduce space'],
  overlap: ['overlap', 'get forward', 'underlap', 'support run'],
  cover: ['cover', 'protect', 'screen', 'shield', 'block'],
};

// ==================== Natural Language Processing ====================

export function processManagerInput(
  input: string,
  context: { players: Player[]; currentGameModel?: GameModel }
): ManagerInput {
  const timestamp = new Date();
  const id = `input-${timestamp.getTime()}`;

  // Analyze input and extract instructions
  const processedInstructions = extractInstructions(input, context);

  // Calculate overall confidence
  const avgConfidence =
    processedInstructions.length > 0
      ? processedInstructions.reduce((sum, i) => sum + i.confidence, 0) / processedInstructions.length
      : 0;

  // Determine if verification is needed
  const needsVerification =
    avgConfidence < 0.8 ||
    processedInstructions.some(i => i.confidence < 0.7) ||
    processedInstructions.length === 0;

  return {
    id,
    timestamp,
    inputType: 'text',
    rawInput: input,
    processedInstructions,
    confidence: avgConfidence,
    needsVerification,
  };
}

function extractInstructions(
  input: string,
  context: { players: Player[]; currentGameModel?: GameModel }
): ProcessedInstruction[] {
  const instructions: ProcessedInstruction[] = [];
  const sentences = input.split(/[.!?]+/).filter(s => s.trim());

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // Determine category
    const category = categorizeInstruction(trimmed);

    // Extract affected players
    const affectedPlayers = extractAffectedPlayers(trimmed, context.players);

    // Extract affected phases
    const affectedPhases = extractAffectedPhases(trimmed);

    // Calculate confidence based on keyword matches and clarity
    const confidence = calculateInstructionConfidence(trimmed, category);

    instructions.push({
      category,
      instruction: trimmed,
      affectedPlayers,
      affectedPhases,
      priority: determinePriority(trimmed, category),
      confidence,
    });
  }

  // Sort by priority
  instructions.sort((a, b) => b.priority - a.priority);

  return instructions;
}

function categorizeInstruction(text: string): ProcessedInstruction['category'] {
  const scores: Record<ProcessedInstruction['category'], number> = {
    formation: 0,
    pressing: 0,
    possession: 0,
    transition: 0,
    player_specific: 0,
    general: 0,
  };

  for (const [category, patterns] of Object.entries(INSTRUCTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        scores[category as keyof typeof scores] += 1;
      }
    }
  }

  // Find highest scoring category
  let maxCategory: ProcessedInstruction['category'] = 'general';
  let maxScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = category as ProcessedInstruction['category'];
    }
  }

  return maxCategory;
}

function extractAffectedPlayers(text: string, players: Player[]): string[] {
  const affected: string[] = [];
  const textLower = text.toLowerCase();

  // Check for player names
  for (const player of players) {
    if (textLower.includes(player.name.toLowerCase())) {
      affected.push(player.id);
    }
  }

  // Check for position references
  const positionMap: Record<string, string[]> = {
    striker: ['ST', 'CF'],
    forward: ['ST', 'CF', 'LW', 'RW'],
    winger: ['LW', 'RW', 'LM', 'RM'],
    midfielder: ['CM', 'CAM', 'CDM', 'LM', 'RM'],
    defender: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
    'centre back': ['CB'],
    'center back': ['CB'],
    fullback: ['LB', 'RB'],
    'full-back': ['LB', 'RB'],
    wingback: ['LWB', 'RWB'],
    'wing-back': ['LWB', 'RWB'],
    keeper: ['GK'],
    goalkeeper: ['GK'],
  };

  for (const [term, positions] of Object.entries(positionMap)) {
    if (textLower.includes(term)) {
      for (const player of players) {
        if (positions.includes(player.position) && !affected.includes(player.id)) {
          affected.push(player.id);
        }
      }
    }
  }

  // Check for "left" and "right" modifiers
  if (textLower.includes('left')) {
    for (const player of players) {
      if (['LB', 'LWB', 'LM', 'LW'].includes(player.position) && !affected.includes(player.id)) {
        affected.push(player.id);
      }
    }
  }

  if (textLower.includes('right')) {
    for (const player of players) {
      if (['RB', 'RWB', 'RM', 'RW'].includes(player.position) && !affected.includes(player.id)) {
        affected.push(player.id);
      }
    }
  }

  return affected;
}

function extractAffectedPhases(text: string): string[] {
  const phases: string[] = [];
  const textLower = text.toLowerCase();

  const phaseKeywords: Record<string, string[]> = {
    buildUp: ['build up', 'build-up', 'play out', 'from back', 'possession in own half'],
    progression: ['progress', 'advance', 'move up', 'through midfield'],
    finalThird: ['final third', 'attacking third', 'box', 'in behind', 'finish'],
    pressing: ['press', 'trigger', 'intensity', 'high line'],
    defensiveBlock: ['block', 'deep', 'compact', 'protect lead'],
    attackingTransition: ['counter', 'break', 'win ball', 'attack quickly'],
    defensiveTransition: ['lose ball', 'counter-press', 'recovery', 'get back'],
  };

  for (const [phase, keywords] of Object.entries(phaseKeywords)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        phases.push(phase);
        break;
      }
    }
  }

  // If no specific phases detected, consider it general (all phases)
  if (phases.length === 0) {
    phases.push('all');
  }

  return phases;
}

function calculateInstructionConfidence(text: string, category: string): number {
  let confidence = 0.6; // Base confidence

  // Increase confidence for specific keywords
  const textLower = text.toLowerCase();

  for (const keywords of Object.values(TACTICAL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        confidence += 0.05;
      }
    }
  }

  // Increase confidence for clear action words
  const actionWords = ['must', 'should', 'need', 'want', 'always', 'never', 'when', 'if'];
  for (const word of actionWords) {
    if (textLower.includes(word)) {
      confidence += 0.03;
    }
  }

  // Decrease confidence for ambiguous language
  const ambiguousWords = ['maybe', 'perhaps', 'sometimes', 'could', 'might'];
  for (const word of ambiguousWords) {
    if (textLower.includes(word)) {
      confidence -= 0.1;
    }
  }

  return Math.min(0.98, Math.max(0.3, confidence));
}

function determinePriority(text: string, category: string): number {
  let priority = 5; // Default medium priority

  const textLower = text.toLowerCase();

  // High priority keywords
  if (textLower.includes('critical') || textLower.includes('essential') || textLower.includes('must')) {
    priority = 10;
  } else if (textLower.includes('important') || textLower.includes('key')) {
    priority = 8;
  }

  // Formation changes are high priority
  if (category === 'formation') {
    priority = Math.max(priority, 9);
  }

  // Player-specific instructions get medium-high priority
  if (category === 'player_specific') {
    priority = Math.max(priority, 7);
  }

  return priority;
}

// ==================== Verification System ====================

export function createVerificationRequest(
  input: ManagerInput
): VerificationRequest {
  const questions = generateClarificationQuestions(input);

  return {
    id: `verify-${input.id}`,
    originalInput: input,
    interpretations: input.processedInstructions,
    questions,
    status: 'pending',
  };
}

function generateClarificationQuestions(input: ManagerInput): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];

  for (const instruction of input.processedInstructions) {
    if (instruction.confidence < 0.7) {
      // Low confidence - need clarification
      questions.push({
        question: `Did you mean: "${instruction.instruction}"?`,
        options: ['Yes, correct', 'No, I meant something else', 'Partially correct'],
        context: `Category: ${instruction.category}, Confidence: ${Math.round(instruction.confidence * 100)}%`,
      });
    }

    if (instruction.affectedPlayers.length === 0 && instruction.category === 'player_specific') {
      questions.push({
        question: 'Which players should this instruction apply to?',
        options: ['All players', 'Forwards only', 'Midfielders only', 'Defenders only'],
        context: instruction.instruction,
      });
    }

    if (instruction.affectedPhases.includes('all')) {
      questions.push({
        question: 'Should this apply to all phases of play or specific ones?',
        options: ['All phases', 'Only in possession', 'Only out of possession', 'Only in transitions'],
        context: instruction.instruction,
      });
    }
  }

  return questions.slice(0, 5); // Limit to 5 questions
}

// ==================== Game Model Integration ====================

export function applyInstructionsToGameModel(
  gameModel: GameModel,
  instructions: ProcessedInstruction[]
): GameModel {
  const updatedModel = { ...gameModel };

  for (const instruction of instructions) {
    switch (instruction.category) {
      case 'formation':
        updatedModel.formation = applyFormationInstruction(updatedModel.formation, instruction);
        break;
      case 'pressing':
        updatedModel.principles = applyPressingInstruction(updatedModel.principles, instruction);
        break;
      case 'possession':
        updatedModel.phases = applyPossessionInstruction(updatedModel.phases, instruction);
        break;
      case 'transition':
        updatedModel.transitionRules = applyTransitionInstruction(updatedModel.transitionRules, instruction);
        break;
      case 'player_specific':
        applyPlayerInstruction(updatedModel.playerInstructions, instruction);
        break;
      default:
        // Add to general principles
        updatedModel.principles.generalPrinciples.push(instruction.instruction);
    }
  }

  updatedModel.updatedAt = new Date();
  return updatedModel;
}

function applyFormationInstruction(
  formation: GameModel['formation'],
  instruction: ProcessedInstruction
): GameModel['formation'] {
  const text = instruction.instruction.toLowerCase();

  // Detect formation pattern (e.g., "4-3-3", "4-4-2")
  const formationMatch = text.match(/(\d)-(\d)-(\d)(?:-(\d))?/);
  if (formationMatch) {
    formation.name = formationMatch[0];
  }

  // Detect compactness adjustments
  if (text.includes('compact') || text.includes('narrow')) {
    formation.compactness.horizontal.target = Math.max(25, formation.compactness.horizontal.target - 5);
    formation.width.outOfPossession = Math.max(30, formation.width.outOfPossession - 5);
  }

  if (text.includes('spread') || text.includes('wide') || text.includes('stretch')) {
    formation.width.inPossession = Math.min(65, formation.width.inPossession + 5);
  }

  // Detect line height adjustments
  if (text.includes('high line') || text.includes('push up')) {
    formation.depth.defensiveLineHeight = Math.min(50, formation.depth.defensiveLineHeight + 5);
  }

  if (text.includes('deep') || text.includes('drop')) {
    formation.depth.defensiveLineHeight = Math.max(20, formation.depth.defensiveLineHeight - 5);
  }

  return formation;
}

function applyPressingInstruction(
  principles: GameModel['principles'],
  instruction: ProcessedInstruction
): GameModel['principles'] {
  const text = instruction.instruction.toLowerCase();

  // Find or create pressing principle
  let pressingPrinciple = principles.outOfPossession.find(p => p.name.toLowerCase().includes('press'));

  if (!pressingPrinciple) {
    pressingPrinciple = {
      id: `press-${Date.now()}`,
      name: 'Pressing',
      description: '',
      pressureType: 'mid',
      triggers: [],
      expectedBehaviors: [],
    };
    principles.outOfPossession.push(pressingPrinciple);
  }

  // Update pressing type
  if (text.includes('high press') || text.includes('press high')) {
    pressingPrinciple.pressureType = 'high';
    pressingPrinciple.description = 'High pressing to win ball in opponent half';
  } else if (text.includes('mid') || text.includes('medium')) {
    pressingPrinciple.pressureType = 'mid';
  } else if (text.includes('low') || text.includes('deep')) {
    pressingPrinciple.pressureType = 'low';
  }

  // Extract triggers
  const triggerPatterns = [
    /when\s+(.+?)(?:\.|,|$)/i,
    /trigger[: ]+(.+?)(?:\.|,|$)/i,
    /if\s+(.+?)(?:\.|,|$)/i,
  ];

  for (const pattern of triggerPatterns) {
    const match = text.match(pattern);
    if (match) {
      pressingPrinciple.triggers.push(match[1].trim());
    }
  }

  return principles;
}

function applyPossessionInstruction(
  phases: GameModel['phases'],
  instruction: ProcessedInstruction
): GameModel['phases'] {
  const text = instruction.instruction.toLowerCase();

  // Determine which phase to update
  let targetPhase: keyof GameModel['phases'] = 'buildUp';

  if (text.includes('final third') || text.includes('attacking')) {
    targetPhase = 'finalThird';
  } else if (text.includes('progress') || text.includes('advance')) {
    targetPhase = 'progression';
  }

  // Add instruction to phase
  phases[targetPhase].keyPoints.push(instruction.instruction);

  // Adjust based on keywords
  if (text.includes('patient') || text.includes('circulate')) {
    phases[targetPhase].description += ' Focus on patient build-up.';
  }

  if (text.includes('direct') || text.includes('quick') || text.includes('vertical')) {
    phases[targetPhase].description += ' Prioritize direct, vertical play.';
  }

  return phases;
}

function applyTransitionInstruction(
  rules: GameModel['transitionRules'],
  instruction: ProcessedInstruction
): GameModel['transitionRules'] {
  const text = instruction.instruction.toLowerCase();

  const isPositive = text.includes('counter') || text.includes('attack') || text.includes('break');

  const newRule = {
    id: `trans-${Date.now()}`,
    type: isPositive ? 'positive' as const : 'negative' as const,
    trigger: instruction.instruction,
    immediateActions: [instruction.instruction],
    timeLimit: isPositive ? 8 : 5, // seconds
    fallbackAction: isPositive ? 'Keep possession' : 'Reset shape',
  };

  rules.push(newRule);
  return rules;
}

function applyPlayerInstruction(
  instructions: Map<string, import('@/types').PlayerInstruction>,
  processedInstruction: ProcessedInstruction
): void {
  for (const playerId of processedInstruction.affectedPlayers) {
    const existing = instructions.get(playerId);

    if (existing) {
      existing.responsibilities.push(processedInstruction.instruction);
    } else {
      instructions.set(playerId, {
        playerId,
        role: 'Custom',
        responsibilities: [processedInstruction.instruction],
        movementPatterns: [],
        passingOptions: [],
        defensiveDuties: [],
        triggers: [],
        physicalRequirements: {
          expectedDistance: { min: 9000, max: 12000 },
          expectedSprints: { min: 10, max: 30 },
          expectedHighIntensityRuns: { min: 30, max: 60 },
          positionHeatmap: [],
        },
      });
    }
  }
}

// ==================== Game Approach Generation ====================

export function generateGameApproach(
  baseGameModel: GameModel,
  opponentInfo: string,
  matchContext: string,
  additionalInstructions: ProcessedInstruction[]
): GameApproach {
  // Parse opponent info
  const opponentAnalysis = parseOpponentInfo(opponentInfo);

  // Generate tactical adjustments based on opponent
  const adjustments = generateTacticalAdjustments(baseGameModel, opponentAnalysis);

  // Add any additional instructions
  for (const instruction of additionalInstructions) {
    adjustments.push({
      id: `adj-${Date.now()}-${Math.random()}`,
      area: instruction.category as TacticalAdjustment['area'],
      description: instruction.instruction,
      reason: 'Manager instruction',
      affectedPlayers: instruction.affectedPlayers,
    });
  }

  return {
    id: `approach-${Date.now()}`,
    matchId: `match-${Date.now()}`,
    baseGameModel: baseGameModel.id,
    opponent: opponentAnalysis,
    adjustments,
    playerSpecificInstructions: new Map(),
    priorityFocus: extractPriorityFocus(matchContext),
    keyBattles: [],
    createdAt: new Date(),
    validatedBy: [],
  };
}

function parseOpponentInfo(info: string): GameApproach['opponent'] {
  // Simple parsing - in production this would use more sophisticated NLP
  const lines = info.split('\n').filter(l => l.trim());

  return {
    teamName: lines[0] || 'Unknown',
    formation: extractFormation(info) || '4-4-2',
    strengths: extractListItems(info, 'strength'),
    weaknesses: extractListItems(info, 'weakness'),
    keyPlayers: [],
    patterns: extractListItems(info, 'pattern'),
  };
}

function extractFormation(text: string): string | null {
  const match = text.match(/\d-\d-\d(?:-\d)?/);
  return match ? match[0] : null;
}

function extractListItems(text: string, keyword: string): string[] {
  const items: string[] = [];
  const regex = new RegExp(`${keyword}[s]?[:\\s]+([^.]+)`, 'gi');
  let match;

  while ((match = regex.exec(text)) !== null) {
    items.push(match[1].trim());
  }

  return items;
}

function generateTacticalAdjustments(
  gameModel: GameModel,
  opponent: GameApproach['opponent']
): TacticalAdjustment[] {
  const adjustments: TacticalAdjustment[] = [];

  // Example: If opponent is weak on left side, suggest attacking there
  if (opponent.weaknesses.some(w => w.toLowerCase().includes('left'))) {
    adjustments.push({
      id: `adj-${Date.now()}-1`,
      area: 'possession',
      description: 'Overload the right side to exploit opponent weak left flank',
      reason: 'Opponent weakness on left side',
      affectedPlayers: [],
    });
  }

  return adjustments;
}

function extractPriorityFocus(context: string): string[] {
  const focuses: string[] = [];
  const textLower = context.toLowerCase();

  if (textLower.includes('win') || textLower.includes('must')) {
    focuses.push('Attacking intent');
  }

  if (textLower.includes('draw') || textLower.includes('point')) {
    focuses.push('Defensive solidity');
  }

  if (textLower.includes('away')) {
    focuses.push('Counter-attacking');
  }

  if (textLower.includes('home')) {
    focuses.push('Dominate possession');
  }

  return focuses.length > 0 ? focuses : ['Balanced approach'];
}

// ==================== System Prompt for AI Integration ====================

export const TACTICAL_AI_SYSTEM_PROMPT = `You are a football (soccer) tactical analysis AI assistant integrated with a GPS/wearable data analytics system. Your role is to:

1. UNDERSTAND manager and technical staff instructions given in natural language (potentially from voice dictation)
2. INTERPRET tactical concepts and translate them into specific player instructions
3. VALIDATE that instructions are clear and implementable
4. SUGGEST clarifications when instructions are ambiguous

Key Football Tactical Concepts You Understand:
- Formations (4-3-3, 4-4-2, 3-5-2, etc.)
- Pressing systems (high press, mid-block, low block, counter-pressing)
- Build-up play (short, direct, from goalkeeper)
- Attacking phases (build-up, progression, final third)
- Defensive phases (organized, transition, set-pieces)
- Player roles (inverted fullback, false 9, box-to-box, etc.)
- Space management (compactness, width, depth)
- Transitions (positive/negative)
- Set pieces

When processing instructions:
- Extract specific tactical adjustments
- Identify affected players by position or name
- Determine which game phases are impacted
- Flag any ambiguous or contradictory instructions
- Maintain consistency with the base game model

Output format should be structured JSON with:
- instruction: the processed instruction
- category: formation | pressing | possession | transition | player_specific | general
- affectedPlayers: list of player positions or IDs
- affectedPhases: list of game phases
- priority: 1-10 scale
- confidence: 0-1 score of interpretation confidence
- clarificationNeeded: boolean
- suggestedClarification: optional question if clarification needed`;
