// Coach Persona System - Tailored Tactical Intelligence
// Designed for Carlos Corberán and coaches with similar profiles

import type {
  GameModel,
  Formation,
  TacticalPrinciples,
  GamePhases,
  PressureTrigger,
  TransitionRule,
  PlayerInstruction,
  PhysicalRequirements,
} from '@/types';

// ==================== Coach Persona Type System ====================

export interface CoachPersona {
  id: string;
  name: string;
  role: string;
  club: string;

  // Background & Influences
  influences: CoachInfluence[];
  education: string;
  philosophy: string;

  // Personality Profile (0-100)
  personality: {
    intensity: number;      // How demanding during matches
    analytical: number;     // Data-driven decision making
    adaptable: number;      // Willingness to adjust mid-game
    demanding: number;      // Expectations of players
    communication: number;  // Clarity of instructions
  };

  // Digital Literacy (0-100)
  digitalLiteracy: {
    videoAnalysis: number;
    gpsInterpretation: number;
    codingScripts: number;
    tacticalSoftware: number;
  };

  // Tactical Preferences
  tacticalProfile: TacticalProfile;

  // Communication Style
  communicationStyle: CommunicationStyle;

  // UI/UX Preferences
  uiPreferences: UIPreferences;
}

export interface CoachInfluence {
  name: string;
  relationship: 'mentor' | 'inspiration' | 'colleague';
  concepts: string[];
}

export interface TacticalProfile {
  // Formation Preferences
  preferredFormations: string[];
  formationFlexibility: 'rigid' | 'moderate' | 'fluid';

  // Pressing Philosophy
  pressingStyle: PressingStyle;
  pressingIntensityPreference: number; // 0-100
  pressingTriggerSensitivity: 'aggressive' | 'measured' | 'reactive';

  // Positional Play
  positioningStyle: 'compact' | 'stretched' | 'variable';
  compactnessTarget: { vertical: number; horizontal: number }; // meters
  defensiveLineHeight: 'high' | 'mid' | 'low' | 'adaptive';

  // Transition Philosophy
  transitionSpeed: 'immediate' | 'controlled' | 'patient';
  counterPressIntensity: number; // 0-100
  counterAttackPriority: number; // 0-100

  // Build-up
  buildUpStyle: 'short' | 'direct' | 'mixed';
  goalkeeperInvolvement: number; // 0-100

  // Key Tactical Concepts (mapped to patterns)
  keyConceptKeywords: string[];
}

export interface PressingStyle {
  type: 'gegenpressing' | 'positional' | 'zonal' | 'man_oriented' | 'hybrid';
  primaryTriggers: string[];
  recoveryTarget: number; // seconds to win ball back
  pressLineHeight: number; // 0-100 (pitch position)
}

export interface CommunicationStyle {
  // How instructions should be phrased
  preferredTerminology: string[];
  avoidTerminology: string[];

  // Instruction Templates
  instructionTemplates: InstructionTemplate[];

  // Feedback Preferences
  feedbackFrequency: 'constant' | 'periodic' | 'milestone';
  feedbackDetail: 'minimal' | 'moderate' | 'comprehensive';

  // Alert Preferences
  alertThresholds: AlertThresholds;
}

export interface InstructionTemplate {
  id: string;
  category: 'pressing' | 'transition' | 'shape' | 'possession' | 'setpiece';
  name: string;
  instruction: string;
  shortcut?: string;
  icon?: string;
  affectsPhases: string[];
  expectedOutcome: string;
}

export interface AlertThresholds {
  coherenceWarning: number;
  coherenceCritical: number;
  fatigueWarning: number;
  fatigueCritical: number;
  transitionDelayWarning: number; // seconds
  compactnessViolation: number; // meters
}

export interface UIPreferences {
  // Dashboard Layout
  primaryMetrics: string[];
  secondaryMetrics: string[];
  hiddenMetrics: string[];

  // Visualization Preferences
  showFormationLines: boolean;
  showTransitionArrows: boolean;
  showPressingZones: boolean;
  showCoherenceHeatmap: boolean;
  showFatigueIndicators: boolean;

  // Color Coding (for their team)
  teamColor: string;
  accentColor: string;
  warningColor: string;
  criticalColor: string;

  // Language
  useSimplifiedTerms: boolean;
  playerNameFormat: 'full' | 'surname' | 'nickname';
}

// ==================== Corberán Instruction Templates ====================
// NOTE: Defined before CARLOS_CORBERAN_PERSONA to avoid forward reference

export const CORBERAN_INSTRUCTION_TEMPLATES: InstructionTemplate[] = [
  // PRESSING TEMPLATES
  {
    id: 'press_high_now',
    category: 'pressing',
    name: 'Press High',
    instruction: 'Press high immediately - suffocate their build-up',
    shortcut: 'P',
    icon: '⬆️',
    affectsPhases: ['pressing', 'defensiveTransition'],
    expectedOutcome: 'Force turnover in attacking third',
  },
  {
    id: 'counter_press',
    category: 'pressing',
    name: 'Counter-Press',
    instruction: 'Counter-press on loss - first 5 seconds are critical',
    shortcut: 'C',
    icon: '🔄',
    affectsPhases: ['defensiveTransition'],
    expectedOutcome: 'Immediate ball recovery',
  },
  {
    id: 'press_trap_touchline',
    category: 'pressing',
    name: 'Touchline Trap',
    instruction: 'Force to touchline and trap - no escape route',
    shortcut: 'T',
    icon: '◀️',
    affectsPhases: ['pressing'],
    expectedOutcome: 'Win possession in wide area',
  },
  {
    id: 'cover_shadows',
    category: 'pressing',
    name: 'Cover Shadows',
    instruction: 'Tighten cover shadows - block passing lanes',
    shortcut: 'S',
    icon: '👤',
    affectsPhases: ['pressing', 'defensiveBlock'],
    expectedOutcome: 'Reduce opponent passing options',
  },
  {
    id: 'press_gk_distribution',
    category: 'pressing',
    name: 'Press GK',
    instruction: 'Press the goalkeeper distribution - force long',
    shortcut: 'G',
    icon: '🧤',
    affectsPhases: ['pressing'],
    expectedOutcome: 'Win second ball from long kick',
  },

  // TRANSITION TEMPLATES
  {
    id: 'transition_vertical',
    category: 'transition',
    name: 'Vertical Transition',
    instruction: 'On winning ball: immediate vertical pass forward',
    shortcut: 'V',
    icon: '↑',
    affectsPhases: ['attackingTransition'],
    expectedOutcome: 'Quick counter-attack opportunity',
  },
  {
    id: 'transition_double_pivot',
    category: 'transition',
    name: 'Double Pivot Trigger',
    instruction: 'Highlight the transition triggers for the double pivot when possession is won',
    shortcut: 'D',
    icon: '🎯',
    affectsPhases: ['attackingTransition', 'progression'],
    expectedOutcome: 'Controlled transition through midfield',
  },
  {
    id: 'transition_wide',
    category: 'transition',
    name: 'Wide Transition',
    instruction: 'Switch play quickly on transition - stretch them',
    shortcut: 'W',
    icon: '↔️',
    affectsPhases: ['attackingTransition'],
    expectedOutcome: 'Exploit space on far side',
  },
  {
    id: 'recovery_positions',
    category: 'transition',
    name: 'Recovery Runs',
    instruction: 'Recovery runs now - get back into shape',
    shortcut: 'R',
    icon: '🏃',
    affectsPhases: ['defensiveTransition'],
    expectedOutcome: 'Organized defensive shape',
  },

  // SHAPE TEMPLATES
  {
    id: 'compact_20m',
    category: 'shape',
    name: 'Compact 20m',
    instruction: 'Compact lines - maximum 20m between defensive and forward line',
    shortcut: '2',
    icon: '📏',
    affectsPhases: ['defensiveBlock', 'pressing'],
    expectedOutcome: 'Deny space between lines',
  },
  {
    id: 'squeeze_high',
    category: 'shape',
    name: 'Squeeze High',
    instruction: 'Squeeze high - defensive line at halfway',
    shortcut: 'H',
    icon: '⬆️',
    affectsPhases: ['pressing'],
    expectedOutcome: 'High defensive block',
  },
  {
    id: 'drop_protect',
    category: 'shape',
    name: 'Drop & Protect',
    instruction: 'Drop and protect - consolidate shape',
    shortcut: 'L',
    icon: '⬇️',
    affectsPhases: ['defensiveBlock'],
    expectedOutcome: 'Organized low block',
  },
  {
    id: 'narrow_central',
    category: 'shape',
    name: 'Narrow Central',
    instruction: 'Narrow centrally - protect the middle',
    shortcut: 'N',
    icon: '🛡️',
    affectsPhases: ['defensiveBlock'],
    expectedOutcome: 'Force play wide',
  },

  // POSSESSION TEMPLATES
  {
    id: 'build_patient',
    category: 'possession',
    name: 'Patient Build',
    instruction: 'Build patiently - circulate and find the gap',
    shortcut: 'B',
    icon: '🔁',
    affectsPhases: ['buildUp', 'progression'],
    expectedOutcome: 'Create passing lane',
  },
  {
    id: 'direct_forward',
    category: 'possession',
    name: 'Direct Forward',
    instruction: 'Play direct - bypass their press',
    shortcut: 'F',
    icon: '⏩',
    affectsPhases: ['buildUp'],
    expectedOutcome: 'Progress quickly through thirds',
  },
  {
    id: 'overload_left',
    category: 'possession',
    name: 'Overload Left',
    instruction: 'Create overload on the left side',
    shortcut: '[',
    icon: '◀️',
    affectsPhases: ['progression', 'finalThird'],
    expectedOutcome: 'Numerical superiority left',
  },
  {
    id: 'overload_right',
    category: 'possession',
    name: 'Overload Right',
    instruction: 'Create overload on the right side',
    shortcut: ']',
    icon: '▶️',
    affectsPhases: ['progression', 'finalThird'],
    expectedOutcome: 'Numerical superiority right',
  },

  // SET PIECE TEMPLATES
  {
    id: 'corner_near_post',
    category: 'setpiece',
    name: 'Near Post',
    instruction: 'Corner: near post attack - first contact finish',
    shortcut: '1',
    icon: '🎯',
    affectsPhases: ['finalThird'],
    expectedOutcome: 'Scoring opportunity at near post',
  },
  {
    id: 'freekick_quick',
    category: 'setpiece',
    name: 'Quick Free Kick',
    instruction: 'Take it quick - catch them unorganized',
    shortcut: 'Q',
    icon: '⚡',
    affectsPhases: ['attackingTransition'],
    expectedOutcome: 'Exploit disorganized defense',
  },
];

// ==================== Carlos Corberán Persona ====================

export const CARLOS_CORBERAN_PERSONA: CoachPersona = {
  id: 'corberan_v1',
  name: 'Carlos Corberán',
  role: 'Head Coach',
  club: 'West Bromwich Albion',

  influences: [
    {
      name: 'Marcelo Bielsa',
      relationship: 'mentor',
      concepts: ['High pressing', 'Man-oriented marking', 'Vertical football', 'Athletic demands', 'Relentless intensity'],
    },
    {
      name: 'Pep Guardiola',
      relationship: 'inspiration',
      concepts: ['Positional play', 'Third man combinations', 'Superiority concepts', 'Control through position'],
    },
    {
      name: 'Technical Staff',
      relationship: 'colleague',
      concepts: ['Data interpretation', 'Video analysis', 'Physical monitoring'],
    },
  ],

  education: 'PhD in Sports Science',

  philosophy: 'Bridge the gap between physical data and tactical execution. Players must understand WHY they run, not just that they ran 12km. Tactical perfection through intelligent pressing and rapid transitions.',

  personality: {
    intensity: 95,      // Very High
    analytical: 95,     // Very High
    adaptable: 75,      // High
    demanding: 80,      // High
    communication: 85,  // High
  },

  digitalLiteracy: {
    videoAnalysis: 95,        // Very High
    gpsInterpretation: 80,    // High
    codingScripts: 25,        // Low
    tacticalSoftware: 70,     // Moderate-High
  },

  tacticalProfile: {
    preferredFormations: ['4-2-3-1', '4-3-3', '3-4-2-1'],
    formationFlexibility: 'moderate',

    pressingStyle: {
      type: 'hybrid', // Bielsa's man-oriented with positional triggers
      primaryTriggers: [
        'Poor first touch',
        'Backward pass',
        'Ball into wide area',
        'Goalkeeper distribution',
        'Slow build-up tempo',
        'Player receiving with back to goal',
      ],
      recoveryTarget: 5, // 5-second rule (Bielsa influence)
      pressLineHeight: 70, // High pressing line
    },

    pressingIntensityPreference: 85,
    pressingTriggerSensitivity: 'aggressive',

    positioningStyle: 'compact',
    compactnessTarget: { vertical: 25, horizontal: 35 }, // 25m between lines, 35m width
    defensiveLineHeight: 'high',

    transitionSpeed: 'immediate',
    counterPressIntensity: 90, // Very high - Bielsa's 6-second rule
    counterAttackPriority: 75, // Quick transitions when available

    buildUpStyle: 'mixed', // Can play short or direct based on pressure
    goalkeeperInvolvement: 60,

    keyConceptKeywords: [
      'compact',
      'squeeze',
      'transition trigger',
      'double pivot',
      'recovery run',
      'counter-press',
      'vertical pass',
      'overload',
      'half-space',
      'cover shadow',
    ],
  },

  communicationStyle: {
    preferredTerminology: [
      'Squeeze', 'Compact', 'Trigger', 'Transition', 'Recovery',
      'Double pivot', 'Reference point', 'Cover shadow', 'Overload',
      'Verticality', 'First contact', 'Second ball', 'Half-space',
    ],

    avoidTerminology: [
      'Digital twin', 'Machine learning', 'Algorithm', 'Neural network',
      'Regression analysis', 'Data pipeline', 'API', 'Backend',
    ],

    instructionTemplates: CORBERAN_INSTRUCTION_TEMPLATES,

    feedbackFrequency: 'constant',
    feedbackDetail: 'moderate',

    alertThresholds: {
      coherenceWarning: 65,
      coherenceCritical: 50,
      fatigueWarning: 60,
      fatigueCritical: 75,
      transitionDelayWarning: 3, // Alert if transition takes > 3 seconds
      compactnessViolation: 30, // Alert if lines spread > 30m
    },
  },

  uiPreferences: {
    primaryMetrics: [
      'Coherence %',
      'Pressing Success',
      'Transition Time',
      'Compactness',
      'Recovery Runs',
    ],

    secondaryMetrics: [
      'xG',
      'Possession %',
      'Pass Accuracy',
      'Distance Covered',
      'Sprints',
    ],

    hiddenMetrics: [
      'Algorithm confidence',
      'Model accuracy',
      'Data latency',
      'API response time',
    ],

    showFormationLines: true,
    showTransitionArrows: true,
    showPressingZones: true,
    showCoherenceHeatmap: false, // Too technical
    showFatigueIndicators: true,

    teamColor: '#122F67',     // WBA Navy
    accentColor: '#FFFFFF',   // White
    warningColor: '#FFA500',  // Orange
    criticalColor: '#DC2626', // Red

    useSimplifiedTerms: true,
    playerNameFormat: 'surname',
  },
};

// ==================== Corberán Game Model ====================

export function createCorberanGameModel(personaId: string = 'corberan_v1'): GameModel {
  const persona = CARLOS_CORBERAN_PERSONA;
  const now = new Date();

  const formation: Formation = {
    name: '4-2-3-1',
    shape: {
      positions: [
        { role: 'GK', baseX: 5, baseY: 50, movementRange: { minX: 0, maxX: 18, minY: 30, maxY: 70 } },
        { role: 'RB', baseX: 25, baseY: 85, movementRange: { minX: 15, maxX: 50, minY: 65, maxY: 100 } },
        { role: 'RCB', baseX: 22, baseY: 62, movementRange: { minX: 10, maxX: 40, minY: 45, maxY: 75 } },
        { role: 'LCB', baseX: 22, baseY: 38, movementRange: { minX: 10, maxX: 40, minY: 25, maxY: 55 } },
        { role: 'LB', baseX: 25, baseY: 15, movementRange: { minX: 15, maxX: 50, minY: 0, maxY: 35 } },
        { role: 'RDM', baseX: 38, baseY: 60, movementRange: { minX: 25, maxX: 55, minY: 40, maxY: 80 } }, // Double Pivot
        { role: 'LDM', baseX: 38, baseY: 40, movementRange: { minX: 25, maxX: 55, minY: 20, maxY: 60 } }, // Double Pivot
        { role: 'RAM', baseX: 55, baseY: 80, movementRange: { minX: 40, maxX: 80, minY: 55, maxY: 100 } },
        { role: 'CAM', baseX: 52, baseY: 50, movementRange: { minX: 35, maxX: 75, minY: 30, maxY: 70 } },
        { role: 'LAM', baseX: 55, baseY: 20, movementRange: { minX: 40, maxX: 80, minY: 0, maxY: 45 } },
        { role: 'ST', baseX: 70, baseY: 50, movementRange: { minX: 50, maxX: 95, minY: 25, maxY: 75 } },
      ],
      lines: [
        { type: 'goalkeeper', height: 5, spacing: 0 },
        { type: 'defensive', height: 23, spacing: 20 },
        { type: 'midfield', height: 38, spacing: 12 }, // Double pivot
        { type: 'attacking', height: 54, spacing: 25 },
      ],
    },
    compactness: {
      vertical: { min: 20, max: 30, target: persona.tacticalProfile.compactnessTarget.vertical },
      horizontal: { min: 30, max: 40, target: persona.tacticalProfile.compactnessTarget.horizontal },
    },
    width: {
      inPossession: 55,
      outOfPossession: 35, // Compact when defending
      transitions: 40,
    },
    depth: {
      defensiveLineHeight: 45, // High line
      pressureLineHeight: persona.tacticalProfile.pressingStyle.pressLineHeight,
      compactZoneDepth: 25,
    },
  };

  const principles: TacticalPrinciples = {
    inPossession: [
      {
        id: 'cc-poss-1',
        name: 'Double Pivot as Reference',
        description: 'The double pivot must always offer a passing option - they are the transition hub',
        priority: 10,
        triggers: ['Ball in defensive third', 'Under pressure'],
        expectedBehaviors: [
          {
            position: 'CDM',
            action: 'Position between lines to receive',
            metrics: { expectedPosition: { x: 38, y: 50, tolerance: 8 } },
          },
        ],
      },
      {
        id: 'cc-poss-2',
        name: 'Vertical Progression',
        description: 'Always look for the forward pass first - play through opponents',
        priority: 9,
        triggers: ['Space available centrally'],
        expectedBehaviors: [],
      },
      {
        id: 'cc-poss-3',
        name: 'Half-Space Occupation',
        description: 'Wide attackers must drift into half-spaces to receive between the lines',
        priority: 8,
        triggers: ['Ball in midfield', 'Numerical superiority'],
        expectedBehaviors: [
          {
            position: 'RAM',
            action: 'Drift into right half-space',
            metrics: { expectedPosition: { x: 55, y: 65, tolerance: 10 } },
          },
          {
            position: 'LAM',
            action: 'Drift into left half-space',
            metrics: { expectedPosition: { x: 55, y: 35, tolerance: 10 } },
          },
        ],
      },
      {
        id: 'cc-poss-4',
        name: 'Width from Full-backs',
        description: 'Full-backs provide width in possession - push high and wide',
        priority: 7,
        triggers: ['Established possession'],
        expectedBehaviors: [],
      },
    ],

    outOfPossession: [
      {
        id: 'cc-def-1',
        name: 'Aggressive High Press',
        description: 'Press immediately on loss - 5 second rule to win ball back',
        pressureType: 'high',
        triggers: persona.tacticalProfile.pressingStyle.primaryTriggers,
        expectedBehaviors: [
          {
            action: 'Sprint to press ball carrier',
            metrics: { expectedSpeed: { min: 20, max: 30 }, expectedAcceleration: { min: 3, max: 6 } },
          },
        ],
      },
      {
        id: 'cc-def-2',
        name: 'Cover Shadows',
        description: 'Every pressing player must block a passing lane while pressing',
        pressureType: 'high',
        triggers: ['Press initiated'],
        expectedBehaviors: [],
      },
      {
        id: 'cc-def-3',
        name: 'Compact Block',
        description: 'Maximum 25m between defensive and forward line when not pressing',
        pressureType: 'mid',
        triggers: ['Press beaten', 'Ball in wide area'],
        expectedBehaviors: [],
      },
      {
        id: 'cc-def-4',
        name: 'Touchline Trap',
        description: 'Force opponent to touchline and trap with coordinated press',
        pressureType: 'high',
        triggers: ['Ball played wide', 'Receiver facing touchline'],
        expectedBehaviors: [],
      },
    ],

    transitions: [
      {
        id: 'cc-trans-1',
        type: 'attacking',
        name: 'Immediate Vertical',
        description: 'On winning ball, look for immediate vertical pass. First thought is forward.',
        timeWindow: 5,
        expectedBehaviors: [
          {
            action: 'Sprint into space behind defense',
            metrics: { expectedSpeed: { min: 22, max: 32 } },
          },
        ],
      },
      {
        id: 'cc-trans-2',
        type: 'attacking',
        name: 'Double Pivot Transition',
        description: 'If no immediate forward option, play into double pivot to transition controlled',
        timeWindow: 8,
        expectedBehaviors: [],
      },
      {
        id: 'cc-trans-3',
        type: 'defensive',
        name: 'Counter-Press Immediate',
        description: 'Immediate counter-press on ball loss - nearest 3 players sprint to ball',
        timeWindow: persona.tacticalProfile.pressingStyle.recoveryTarget,
        expectedBehaviors: [
          {
            action: 'Sprint to counter-press',
            metrics: { expectedSpeed: { min: 24, max: 34 }, expectedAcceleration: { min: 4, max: 8 } },
          },
        ],
      },
      {
        id: 'cc-trans-4',
        type: 'defensive',
        name: 'Recovery Shape',
        description: 'If counter-press fails after 5 seconds, sprint to recover defensive shape',
        timeWindow: 8,
        expectedBehaviors: [],
      },
    ],

    generalPrinciples: [
      'Press with purpose - every press must block a passing option',
      '5 second rule: win the ball back within 5 seconds of losing it',
      'Compact shape: 25m maximum between lines',
      'Transition immediately: first thought is always forward',
      'Double pivot is the hub: all play flows through them',
      'Half-spaces are key: overload them in possession',
      'Touchline is our friend: trap opponents against it',
      'High defensive line: squeeze the pitch',
      'Cover shadows: never let a pressing player be bypassed',
      'Recovery runs: if counter-press fails, sprint back',
    ],
  };

  const phases: GamePhases = {
    buildUp: {
      description: 'Patient build through double pivot when pressed, direct when opportunity exists',
      keyPoints: [
        'GK can play short or long based on press',
        'Double pivot must split to receive',
        'CBs can carry into midfield if space exists',
        'Full-backs provide width and outlet',
      ],
      playerMovements: [],
      passingPatterns: [
        {
          name: 'Split Pivot Build',
          sequence: [
            { from: 'GK', to: 'CB', type: 'short' },
            { from: 'CB', to: 'CDM', type: 'short' },
            { from: 'CDM', to: 'CAM', type: 'through' },
          ],
          purpose: 'Progress through the thirds via double pivot',
        },
      ],
      triggers: [],
    },
    progression: {
      description: 'Quick vertical progression through half-spaces',
      keyPoints: [
        'Look for forward pass first',
        'Wide players drift into half-spaces',
        'Double pivot recycle if blocked',
        'Full-backs overlap to create 2v1',
      ],
      playerMovements: [],
      passingPatterns: [],
      triggers: [],
    },
    finalThird: {
      description: 'Quick combination play and crosses from deep',
      keyPoints: [
        'Overload one side then switch',
        'Striker makes runs in behind',
        'Wide players cut inside for shots',
        'Full-backs deliver crosses',
      ],
      playerMovements: [],
      passingPatterns: [],
      triggers: [],
    },
    pressing: {
      description: 'Aggressive coordinated press with cover shadows',
      keyPoints: [
        'Press triggers: back pass, wide ball, poor touch',
        'Nearest player presses, others cover shadows',
        'Trap against touchline',
        'Force play predictably',
      ],
      playerMovements: [],
      passingPatterns: [],
      triggers: [
        { condition: 'Opponent plays backward', action: 'Trigger high press' },
        { condition: 'Ball goes wide', action: 'Initiate touchline trap' },
        { condition: 'GK has ball', action: 'Press distribution' },
      ],
    },
    defensiveBlock: {
      description: 'Compact mid-block with 25m max between lines',
      keyPoints: [
        'Defend centrally - protect the middle',
        'Force play wide',
        'Stay connected - no gaps between lines',
        'Win second balls',
      ],
      playerMovements: [],
      passingPatterns: [],
      triggers: [],
    },
    attackingTransition: {
      description: 'Immediate vertical pass or through double pivot',
      keyPoints: [
        'First thought: can we play forward?',
        'Runners in behind immediately',
        'If blocked, find double pivot',
        'Counter within 5 seconds or consolidate',
      ],
      playerMovements: [],
      passingPatterns: [],
      triggers: [],
    },
    defensiveTransition: {
      description: 'Immediate counter-press then recovery',
      keyPoints: [
        '5-second counter-press',
        'Nearest 3 players engage',
        'Others drop to recovery positions',
        'If not won, sprint to shape',
      ],
      playerMovements: [],
      passingPatterns: [],
      triggers: [],
    },
  };

  const pressureTriggers: PressureTrigger[] = [
    {
      id: 'cc-pt-1',
      name: 'Back Pass Trigger',
      description: 'Press immediately when opponent plays backward to GK or CB',
      condition: 'backward_pass',
      intensity: 'max',
      duration: 6,
      coverShadows: true,
    },
    {
      id: 'cc-pt-2',
      name: 'Poor Touch Trigger',
      description: 'Press when opponent takes heavy touch or ball is loose',
      condition: 'poor_touch',
      intensity: 'max',
      duration: 4,
      coverShadows: true,
    },
    {
      id: 'cc-pt-3',
      name: 'Wide Ball Trap',
      description: 'Trap opponent against touchline when ball goes wide',
      condition: 'ball_wide',
      intensity: 'high',
      duration: 5,
      coverShadows: true,
    },
    {
      id: 'cc-pt-4',
      name: 'GK Distribution',
      description: 'Press goalkeeper when about to distribute',
      condition: 'gk_has_ball',
      intensity: 'high',
      duration: 8,
      coverShadows: true,
    },
    {
      id: 'cc-pt-5',
      name: 'Back to Goal',
      description: 'Press receiver who is facing their own goal',
      condition: 'receiver_facing_back',
      intensity: 'high',
      duration: 4,
      coverShadows: true,
    },
  ];

  const transitionRules: TransitionRule[] = [
    {
      id: 'cc-tr-1',
      type: 'positive',
      trigger: 'Ball won in any zone',
      immediateActions: [
        'Look for forward pass immediately',
        'Runners in behind',
        'Wide players stretch play',
        'Double pivot offers central option',
      ],
      timeLimit: 5,
      fallbackAction: 'Find double pivot and build controlled',
    },
    {
      id: 'cc-tr-2',
      type: 'positive',
      trigger: 'Ball won in attacking third',
      immediateActions: [
        'Shoot or play final ball immediately',
        'Quick combination',
        'No backward passes',
      ],
      timeLimit: 3,
      fallbackAction: 'Recycle to edge of box',
    },
    {
      id: 'cc-tr-3',
      type: 'negative',
      trigger: 'Ball lost anywhere',
      immediateActions: [
        'Nearest 3 players counter-press',
        'Others recover to shape',
        'Block forward passing lanes',
        'Force play backward or wide',
      ],
      timeLimit: 5,
      fallbackAction: 'Sprint to recover shape - 25m block',
    },
    {
      id: 'cc-tr-4',
      type: 'negative',
      trigger: 'Counter-press beaten',
      immediateActions: [
        'All players sprint to recovery positions',
        'Reform 25m block',
        'Protect central areas',
      ],
      timeLimit: 8,
      fallbackAction: 'Low block if overwhelmed',
    },
  ];

  return {
    id: `gm-corberan-${Date.now()}`,
    name: 'Corberán System',
    createdBy: personaId,
    createdAt: now,
    updatedAt: now,
    formation,
    principles,
    phases,
    pressureTriggers,
    transitionRules,
    setPlays: [],
    playerInstructions: new Map(),
    validatedBy: [],
    status: 'active',
  };
}

// ==================== Corberán Coherence Weights ====================

export interface CoherenceWeights {
  positionAdherence: number;
  physicalOutput: number;
  movementPattern: number;
  roleExecution: number;
  pressingIntensity: number;
  transitionSpeed: number;
  compactness: number;
}

export const CORBERAN_COHERENCE_WEIGHTS: CoherenceWeights = {
  positionAdherence: 0.20,    // 20% - Position matters but less rigid
  physicalOutput: 0.15,       // 15% - Important but not everything
  movementPattern: 0.15,      // 15% - Right patterns
  roleExecution: 0.15,        // 15% - Doing your job
  pressingIntensity: 0.20,    // 20% - Bielsa influence: pressing is key
  transitionSpeed: 0.10,      // 10% - Quick transitions
  compactness: 0.05,          // 5% - Shape maintenance
};

// ==================== Helper Functions ====================

export function getPersonaById(id: string): CoachPersona | null {
  if (id === 'corberan_v1') {
    return CARLOS_CORBERAN_PERSONA;
  }
  return null;
}

export function getInstructionsByCategory(
  persona: CoachPersona,
  category: InstructionTemplate['category']
): InstructionTemplate[] {
  return persona.communicationStyle.instructionTemplates.filter(t => t.category === category);
}

export function translateToPersonaTerminology(
  instruction: string,
  persona: CoachPersona
): string {
  // Replace technical terms with preferred terminology
  let translated = instruction;

  // Example translations
  const translations: Record<string, string> = {
    'gegenpressing': 'counter-press',
    'defensive transition': 'recovery',
    'ball recovery': 'winning it back',
    'playing out from the back': 'build-up',
    'central midfield pivot': 'double pivot',
    'half-spaces': 'half-spaces', // Keep this one
    'final third': 'attacking third',
  };

  for (const [technical, simple] of Object.entries(translations)) {
    translated = translated.replace(new RegExp(technical, 'gi'), simple);
  }

  return translated;
}

export function shouldAlertCoach(
  metric: string,
  value: number,
  persona: CoachPersona
): { alert: boolean; severity: 'warning' | 'critical' | null; message: string } {
  const thresholds = persona.communicationStyle.alertThresholds;

  switch (metric) {
    case 'coherence':
      if (value < thresholds.coherenceCritical) {
        return { alert: true, severity: 'critical', message: `Coherence critical: ${value.toFixed(0)}%` };
      }
      if (value < thresholds.coherenceWarning) {
        return { alert: true, severity: 'warning', message: `Coherence dropping: ${value.toFixed(0)}%` };
      }
      break;

    case 'fatigue':
      if (value > thresholds.fatigueCritical) {
        return { alert: true, severity: 'critical', message: `High fatigue: ${value.toFixed(0)}%` };
      }
      if (value > thresholds.fatigueWarning) {
        return { alert: true, severity: 'warning', message: `Fatigue building: ${value.toFixed(0)}%` };
      }
      break;

    case 'transitionDelay':
      if (value > thresholds.transitionDelayWarning) {
        return { alert: true, severity: 'warning', message: `Slow transition: ${value.toFixed(1)}s` };
      }
      break;

    case 'compactness':
      if (value > thresholds.compactnessViolation) {
        return { alert: true, severity: 'warning', message: `Shape stretched: ${value.toFixed(0)}m between lines` };
      }
      break;
  }

  return { alert: false, severity: null, message: '' };
}
