// Advanced Soccer Tactics Library
// Comprehensive terminology for AI game modeling engine

export type TacticPhase = 'attacking' | 'defensive' | 'transition' | 'formation';

export interface TacticTrigger {
  event: string;
  condition?: string;
  windowSeconds?: number;
}

export interface TacticSynergy {
  tactic: string;
  boost: number; // percentage boost when combined
}

export interface TacticCounter {
  tactic: string;
  reduction: number; // percentage reduction in effectiveness
}

export interface Tactic {
  id: string;
  name: string;
  phase: TacticPhase;
  description: string;
  intensity: number; // 1-10 default
  triggers?: TacticTrigger[];
  synergies?: TacticSynergy[];
  counters?: TacticCounter[];
  params: Record<string, number | string | boolean | string[]>;
}

export interface Formation {
  id: string;
  name: string;
  shape: string;
  description: string;
  positions: { role: string; x: number; y: number }[];
  strengths: string[];
  weaknesses: string[];
}

// ==================== FORMATIONS ====================

export const FORMATIONS: Formation[] = [
  {
    id: 'f433',
    name: '4-3-3',
    shape: '4-3-3',
    description: 'Balanced attacking system with three forwards; emphasizes width and midfield control.',
    positions: [
      { role: 'GK', x: 5, y: 50 },
      { role: 'RB', x: 20, y: 85 },
      { role: 'RCB', x: 18, y: 65 },
      { role: 'LCB', x: 18, y: 35 },
      { role: 'LB', x: 20, y: 15 },
      { role: 'CDM', x: 35, y: 50 },
      { role: 'RCM', x: 45, y: 70 },
      { role: 'LCM', x: 45, y: 30 },
      { role: 'RW', x: 70, y: 85 },
      { role: 'ST', x: 75, y: 50 },
      { role: 'LW', x: 70, y: 15 },
    ],
    strengths: ['Width', 'Pressing', 'Midfield Control'],
    weaknesses: ['Central Defense', 'Transitions'],
  },
  {
    id: 'f442',
    name: '4-4-2',
    shape: '4-4-2',
    description: 'Traditional dual-striker setup; focuses on partnerships and defensive solidity.',
    positions: [
      { role: 'GK', x: 5, y: 50 },
      { role: 'RB', x: 20, y: 85 },
      { role: 'RCB', x: 18, y: 65 },
      { role: 'LCB', x: 18, y: 35 },
      { role: 'LB', x: 20, y: 15 },
      { role: 'RM', x: 45, y: 85 },
      { role: 'RCM', x: 40, y: 60 },
      { role: 'LCM', x: 40, y: 40 },
      { role: 'LM', x: 45, y: 15 },
      { role: 'RST', x: 70, y: 60 },
      { role: 'LST', x: 70, y: 40 },
    ],
    strengths: ['Compactness', 'Partnerships', 'Counter-Attack'],
    weaknesses: ['Width', 'Midfield Overloads'],
  },
  {
    id: 'f352',
    name: '3-5-2',
    shape: '3-5-2',
    description: 'Three center-backs with wing-backs; allows midfield dominance and quick counters.',
    positions: [
      { role: 'GK', x: 5, y: 50 },
      { role: 'RCB', x: 18, y: 70 },
      { role: 'CB', x: 15, y: 50 },
      { role: 'LCB', x: 18, y: 30 },
      { role: 'RWB', x: 40, y: 95 },
      { role: 'RCM', x: 38, y: 65 },
      { role: 'CDM', x: 32, y: 50 },
      { role: 'LCM', x: 38, y: 35 },
      { role: 'LWB', x: 40, y: 5 },
      { role: 'RST', x: 70, y: 60 },
      { role: 'LST', x: 70, y: 40 },
    ],
    strengths: ['Midfield Dominance', 'Wing Play', 'Defensive Cover'],
    weaknesses: ['Wide Areas', 'Counter-Attacks'],
  },
  {
    id: 'f4231',
    name: '4-2-3-1',
    shape: '4-2-3-1',
    description: 'Defensive double pivot with attacking midfielder; versatile for possession and transitions.',
    positions: [
      { role: 'GK', x: 5, y: 50 },
      { role: 'RB', x: 20, y: 85 },
      { role: 'RCB', x: 18, y: 65 },
      { role: 'LCB', x: 18, y: 35 },
      { role: 'LB', x: 20, y: 15 },
      { role: 'RCDM', x: 32, y: 60 },
      { role: 'LCDM', x: 32, y: 40 },
      { role: 'RAM', x: 55, y: 75 },
      { role: 'CAM', x: 55, y: 50 },
      { role: 'LAM', x: 55, y: 25 },
      { role: 'ST', x: 75, y: 50 },
    ],
    strengths: ['Defensive Stability', 'Creativity', 'Flexibility'],
    weaknesses: ['Striker Isolation', 'Wing Depth'],
  },
  {
    id: 'f343',
    name: '3-4-3',
    shape: '3-4-3',
    description: 'Aggressive diamond midfield; promotes overloads and high pressing.',
    positions: [
      { role: 'GK', x: 5, y: 50 },
      { role: 'RCB', x: 18, y: 70 },
      { role: 'CB', x: 15, y: 50 },
      { role: 'LCB', x: 18, y: 30 },
      { role: 'RWB', x: 45, y: 90 },
      { role: 'RCM', x: 40, y: 60 },
      { role: 'LCM', x: 40, y: 40 },
      { role: 'LWB', x: 45, y: 10 },
      { role: 'RW', x: 70, y: 80 },
      { role: 'ST', x: 75, y: 50 },
      { role: 'LW', x: 70, y: 20 },
    ],
    strengths: ['High Press', 'Overloads', 'Attacking Width'],
    weaknesses: ['Defensive Transitions', 'Wide Defense'],
  },
  {
    id: 'f532',
    name: '5-3-2',
    shape: '5-3-2',
    description: 'Defensive-oriented with five at the back; used for low blocks.',
    positions: [
      { role: 'GK', x: 5, y: 50 },
      { role: 'RWB', x: 25, y: 90 },
      { role: 'RCB', x: 15, y: 70 },
      { role: 'CB', x: 12, y: 50 },
      { role: 'LCB', x: 15, y: 30 },
      { role: 'LWB', x: 25, y: 10 },
      { role: 'RCM', x: 40, y: 65 },
      { role: 'CDM', x: 35, y: 50 },
      { role: 'LCM', x: 40, y: 35 },
      { role: 'RST', x: 70, y: 60 },
      { role: 'LST', x: 70, y: 40 },
    ],
    strengths: ['Defensive Solidity', 'Counter-Attack', 'Compactness'],
    weaknesses: ['Possession', 'Width in Attack'],
  },
  {
    id: 'f4141',
    name: '4-1-4-1',
    shape: '4-1-4-1',
    description: 'Single holding midfielder; enables advanced full-backs and wide attacks.',
    positions: [
      { role: 'GK', x: 5, y: 50 },
      { role: 'RB', x: 20, y: 85 },
      { role: 'RCB', x: 18, y: 65 },
      { role: 'LCB', x: 18, y: 35 },
      { role: 'LB', x: 20, y: 15 },
      { role: 'CDM', x: 30, y: 50 },
      { role: 'RM', x: 50, y: 85 },
      { role: 'RCM', x: 48, y: 60 },
      { role: 'LCM', x: 48, y: 40 },
      { role: 'LM', x: 50, y: 15 },
      { role: 'ST', x: 75, y: 50 },
    ],
    strengths: ['Midfield Protection', 'Width', 'Counter-Attack'],
    weaknesses: ['Central Creativity', 'Striker Support'],
  },
];

// ==================== ATTACKING TACTICS ====================

export const ATTACKING_TACTICS: Tactic[] = [
  {
    id: 'positional_play',
    name: 'Positional Play (Juego de Posición)',
    phase: 'attacking',
    description: 'Zonal occupation to create overloads and exploit spaces through rotations.',
    intensity: 8,
    synergies: [
      { tactic: 'tiki_taka', boost: 30 },
      { tactic: 'half_spaces', boost: 25 },
      { tactic: 'rotations', boost: 20 },
    ],
    counters: [
      { tactic: 'high_press', reduction: 15 },
      { tactic: 'man_marking', reduction: 20 },
    ],
    params: {
      corridors: 5,
      zoneOccupancy: 0.85,
      rotationFrequency: 0.7,
      passWeight: 'short',
    },
  },
  {
    id: 'tiki_taka',
    name: 'Tiki-Taka',
    phase: 'attacking',
    description: 'Short, patient passing to retain possession and tire opponents.',
    intensity: 7,
    synergies: [
      { tactic: 'positional_play', boost: 30 },
      { tactic: 'combination_play', boost: 25 },
    ],
    counters: [
      { tactic: 'gegenpressing', reduction: 20 },
      { tactic: 'high_press', reduction: 15 },
    ],
    params: {
      passDistance: 12,
      passAccuracy: 0.92,
      possessionTarget: 0.65,
      tempo: 'slow',
    },
  },
  {
    id: 'false_9',
    name: 'False 9',
    phase: 'attacking',
    description: 'Striker drops deep to create space for midfield runs.',
    intensity: 7,
    triggers: [
      { event: 'ball_in_final_third', condition: 'striker_marked' },
    ],
    synergies: [
      { tactic: 'ghosting_runs', boost: 35 },
      { tactic: 'third_man_runs', boost: 30 },
    ],
    params: {
      dropDepth: 25,
      channelCreation: 0.8,
      runTrigger: 'ball_progression',
    },
  },
  {
    id: 'inverted_wingers',
    name: 'Inverted Wingers',
    phase: 'attacking',
    description: 'Wide players cut inside on their stronger foot for shots or combinations.',
    intensity: 7,
    synergies: [
      { tactic: 'overlap', boost: 30 },
      { tactic: 'half_spaces', boost: 25 },
    ],
    params: {
      cutInsideAngle: 45,
      shotFrequency: 0.35,
      combinationFrequency: 0.65,
    },
  },
  {
    id: 'overlap',
    name: 'Overlap',
    phase: 'attacking',
    description: 'Full-back runs beyond the winger to create 2v1s on the flank.',
    intensity: 6,
    triggers: [
      { event: 'winger_receives_ball', condition: 'fullback_available' },
    ],
    synergies: [
      { tactic: 'inverted_wingers', boost: 30 },
      { tactic: 'width', boost: 20 },
    ],
    params: {
      runDepth: 0.9,
      crossProbability: 0.6,
      cutbackProbability: 0.4,
    },
  },
  {
    id: 'underlap',
    name: 'Underlap',
    phase: 'attacking',
    description: 'Midfielder or full-back runs inside the winger for central penetration.',
    intensity: 6,
    triggers: [
      { event: 'winger_has_ball', condition: 'central_space_available' },
    ],
    synergies: [
      { tactic: 'half_spaces', boost: 30 },
      { tactic: 'combination_play', boost: 25 },
    ],
    params: {
      runAngle: 30,
      penetrationDepth: 0.85,
      passProbability: 0.7,
    },
  },
  {
    id: 'third_man_runs',
    name: 'Third Man Runs',
    phase: 'attacking',
    description: 'Pass to A, who lays off to B, exploiting the run of unmarked C.',
    intensity: 8,
    triggers: [
      { event: 'pass_received', condition: 'third_player_making_run' },
    ],
    synergies: [
      { tactic: 'combination_play', boost: 35 },
      { tactic: 'false_9', boost: 25 },
    ],
    params: {
      layoffTiming: 0.8,
      runTiming: 'early',
      successRate: 0.7,
    },
  },
  {
    id: 'ghosting_runs',
    name: 'Ghosting Runs',
    phase: 'attacking',
    description: 'Late, unmarked arrivals into space (e.g., box runs by midfielders).',
    intensity: 7,
    triggers: [
      { event: 'ball_in_wide_area', condition: 'midfielder_near_box' },
    ],
    synergies: [
      { tactic: 'false_9', boost: 30 },
      { tactic: 'overlap', boost: 20 },
    ],
    params: {
      arrivalTiming: 'late',
      targetZone: 'penalty_area',
      unmarkedProbability: 0.75,
    },
  },
  {
    id: 'switch_of_play',
    name: 'Switch of Play',
    phase: 'attacking',
    description: 'Quick ball transfer from one flank to the opposite to exploit weak sides.',
    intensity: 6,
    triggers: [
      { event: 'overload_detected', condition: 'opposite_flank_open' },
    ],
    synergies: [
      { tactic: 'width', boost: 30 },
      { tactic: 'direct_play', boost: 20 },
    ],
    params: {
      switchDistance: 40,
      switchSpeed: 'fast',
      targetPlayer: 'winger',
    },
  },
  {
    id: 'la_pausa',
    name: 'La Pausa',
    phase: 'attacking',
    description: 'Deliberate pause on the ball to draw defenders and then accelerate.',
    intensity: 6,
    triggers: [
      { event: 'ball_received', condition: 'space_ahead_limited' },
    ],
    synergies: [
      { tactic: 'positional_play', boost: 25 },
      { tactic: 'third_man_runs', boost: 30 },
    ],
    params: {
      pauseDuration: 1.5,
      drawRadius: 8,
      accelerationTrigger: 'defender_committed',
    },
  },
  {
    id: 'build_up',
    name: 'Build-Up from the Back',
    phase: 'attacking',
    description: 'Goalkeeper and defenders initiate play with short passes.',
    intensity: 7,
    synergies: [
      { tactic: 'positional_play', boost: 25 },
      { tactic: 'tiki_taka', boost: 20 },
    ],
    counters: [
      { tactic: 'high_press', reduction: 25 },
    ],
    params: {
      gkInvolvement: 0.8,
      shortPassPreference: 0.85,
      riskTolerance: 0.6,
    },
  },
  {
    id: 'direct_play',
    name: 'Direct Play (Route One)',
    phase: 'attacking',
    description: 'Long balls to target forwards, bypassing midfield.',
    intensity: 5,
    synergies: [
      { tactic: 'counter_attack', boost: 30 },
    ],
    counters: [
      { tactic: 'high_line', reduction: 15 },
    ],
    params: {
      longBallFrequency: 0.7,
      targetPlayer: 'striker',
      secondBallFocus: 0.8,
    },
  },
  {
    id: 'verticality',
    name: 'Verticality',
    phase: 'attacking',
    description: 'Emphasis on forward passes to progress quickly through lines.',
    intensity: 7,
    synergies: [
      { tactic: 'through_balls', boost: 25 },
      { tactic: 'third_man_runs', boost: 20 },
    ],
    params: {
      forwardPassPreference: 0.75,
      lineBreakingPasses: 0.6,
      tempo: 'high',
    },
  },
  {
    id: 'overload',
    name: 'Overload',
    phase: 'attacking',
    description: 'Numerical superiority in a zone (e.g., 3v2 on one side).',
    intensity: 7,
    triggers: [
      { event: 'ball_in_zone', condition: 'can_create_overload' },
    ],
    synergies: [
      { tactic: 'positional_play', boost: 30 },
      { tactic: 'rotations', boost: 25 },
    ],
    params: {
      targetSuperioity: 2,
      overloadZone: 'half_space',
      switchFrequency: 0.4,
    },
  },
  {
    id: 'combination_play',
    name: 'Combination Play',
    phase: 'attacking',
    description: 'Tight triangles or diamonds for short passing sequences.',
    intensity: 7,
    synergies: [
      { tactic: 'tiki_taka', boost: 30 },
      { tactic: 'third_man_runs', boost: 25 },
    ],
    params: {
      triangleSize: 15,
      passSpeed: 'quick',
      oneTouch: 0.6,
    },
  },
  {
    id: 'half_spaces',
    name: 'Half-Space Exploitation',
    phase: 'attacking',
    description: 'Exploitation of areas between central and wide channels.',
    intensity: 8,
    synergies: [
      { tactic: 'positional_play', boost: 30 },
      { tactic: 'inverted_wingers', boost: 25 },
      { tactic: 'underlap', boost: 20 },
    ],
    params: {
      halfSpaceOccupancy: 0.85,
      runFrequency: 0.7,
      passPriority: 1.5,
    },
  },
  {
    id: 'rotations',
    name: 'Rotations',
    phase: 'attacking',
    description: 'Players swap positions to confuse markers.',
    intensity: 7,
    synergies: [
      { tactic: 'positional_play', boost: 30 },
      { tactic: 'total_football', boost: 35 },
    ],
    params: {
      rotationFrequency: 0.6,
      positionSwaps: ['winger-fullback', 'striker-midfielder', 'midfielder-midfielder'],
      triggerCondition: 'space_created',
    },
  },
  {
    id: 'inverted_fullbacks',
    name: 'Inverted Full-Backs',
    phase: 'attacking',
    description: 'Defenders move centrally into midfield during possession.',
    intensity: 8,
    synergies: [
      { tactic: 'positional_play', boost: 30 },
      { tactic: 'build_up', boost: 25 },
    ],
    counters: [
      { tactic: 'counter_attack', reduction: 20 },
    ],
    params: {
      invertTrigger: 'ball_progression',
      centralPosition: 0.6,
      defensiveRecovery: 0.85,
    },
  },
  {
    id: 'total_football',
    name: 'Total Football',
    phase: 'attacking',
    description: 'Fluid system where players interchange positions dynamically.',
    intensity: 9,
    synergies: [
      { tactic: 'rotations', boost: 35 },
      { tactic: 'positional_play', boost: 30 },
      { tactic: 'high_press', boost: 25 },
    ],
    params: {
      fluidity: 0.9,
      positionInterchange: true,
      pressOnLoss: true,
      corridorOccupancy: 5,
    },
  },
];

// ==================== DEFENSIVE TACTICS ====================

export const DEFENSIVE_TACTICS: Tactic[] = [
  {
    id: 'cover_shadow',
    name: 'Cover Shadow',
    phase: 'defensive',
    description: 'Defender positions to block passing lanes while shadowing an opponent.',
    intensity: 7,
    triggers: [
      { event: 'opponent_receive_ball', condition: 'defender_nearby' },
    ],
    synergies: [
      { tactic: 'zonal_marking', boost: 25 },
      { tactic: 'compactness', boost: 20 },
    ],
    params: {
      shadowAngle: 45,
      laneBlockPriority: 0.8,
      pressureDistance: 3,
    },
  },
  {
    id: 'high_press',
    name: 'High Press',
    phase: 'defensive',
    description: 'Aggressive pressure in the opponent\'s half to force turnovers.',
    intensity: 9,
    triggers: [
      { event: 'opponent_possession', condition: 'ball_in_their_half' },
      { event: 'backward_pass', windowSeconds: 3 },
    ],
    synergies: [
      { tactic: 'high_line', boost: 30 },
      { tactic: 'gegenpressing', boost: 35 },
    ],
    counters: [
      { tactic: 'direct_play', reduction: 20 },
      { tactic: 'build_up', reduction: 25 },
    ],
    params: {
      pressLine: 70,
      intensity: 0.9,
      trapZone: 'flank',
      recoverySpeed: 0.85,
    },
  },
  {
    id: 'low_block',
    name: 'Low Block',
    phase: 'defensive',
    description: 'Deep, compact defense to deny space behind (parking the bus).',
    intensity: 6,
    synergies: [
      { tactic: 'compactness', boost: 35 },
      { tactic: 'counter_attack', boost: 30 },
    ],
    counters: [
      { tactic: 'positional_play', reduction: 15 },
      { tactic: 'half_spaces', reduction: 20 },
    ],
    params: {
      defensiveLine: 25,
      blockWidth: 35,
      counterTrigger: 'ball_won',
      patience: 0.9,
    },
  },
  {
    id: 'mid_block',
    name: 'Mid-Block',
    phase: 'defensive',
    description: 'Pressing in midfield to disrupt build-up without overcommitting.',
    intensity: 7,
    synergies: [
      { tactic: 'compactness', boost: 25 },
      { tactic: 'pressing_triggers', boost: 20 },
    ],
    params: {
      defensiveLine: 45,
      engagementLine: 55,
      compactness: 0.8,
    },
  },
  {
    id: 'gegenpressing',
    name: 'Gegenpressing (Counter-Pressing)',
    phase: 'defensive',
    description: 'Immediate swarm press after losing possession.',
    intensity: 10,
    triggers: [
      { event: 'ball_lost', windowSeconds: 5 },
    ],
    synergies: [
      { tactic: 'high_press', boost: 35 },
      { tactic: 'high_line', boost: 25 },
    ],
    counters: [
      { tactic: 'direct_play', reduction: 25 },
    ],
    params: {
      reactionTime: 0.5,
      pressRadius: 15,
      playerCommitment: 4,
      recoveryWindow: 5,
    },
  },
  {
    id: 'man_marking',
    name: 'Man-Marking',
    phase: 'defensive',
    description: 'Players assigned to track specific opponents individually.',
    intensity: 8,
    synergies: [
      { tactic: 'high_press', boost: 20 },
    ],
    counters: [
      { tactic: 'rotations', reduction: 30 },
      { tactic: 'total_football', reduction: 35 },
    ],
    params: {
      assignmentStrict: true,
      followDistance: 2,
      switchAllowed: false,
    },
  },
  {
    id: 'zonal_marking',
    name: 'Zonal Marking',
    phase: 'defensive',
    description: 'Defenders cover areas rather than players; common in set-pieces.',
    intensity: 6,
    synergies: [
      { tactic: 'compactness', boost: 30 },
      { tactic: 'cover_shadow', boost: 25 },
    ],
    counters: [
      { tactic: 'overload', reduction: 20 },
    ],
    params: {
      zoneSize: 10,
      handoffTrigger: 'player_leaves_zone',
      setPieceZones: 6,
    },
  },
  {
    id: 'high_line',
    name: 'High Defensive Line',
    phase: 'defensive',
    description: 'Backline pushes up to compress space and catch offsides.',
    intensity: 8,
    synergies: [
      { tactic: 'high_press', boost: 30 },
      { tactic: 'offside_trap', boost: 35 },
    ],
    counters: [
      { tactic: 'through_balls', reduction: 30 },
      { tactic: 'direct_play', reduction: 25 },
    ],
    params: {
      lineHeight: 45,
      stepUpTrigger: 'ball_played',
      sweeperKeeper: true,
    },
  },
  {
    id: 'pressing_triggers',
    name: 'Pressing Triggers',
    phase: 'defensive',
    description: 'Specific cues (e.g., backward pass) to initiate coordinated pressure.',
    intensity: 7,
    triggers: [
      { event: 'backward_pass' },
      { event: 'heavy_touch' },
      { event: 'receiver_facing_own_goal' },
    ],
    synergies: [
      { tactic: 'high_press', boost: 30 },
      { tactic: 'mid_block', boost: 20 },
    ],
    params: {
      triggers: ['backward_pass', 'heavy_touch', 'bad_reception', 'isolated_player'],
      responseTime: 0.8,
      coordinatedPress: true,
    },
  },
  {
    id: 'compactness',
    name: 'Compactness',
    phase: 'defensive',
    description: 'Horizontal and vertical narrowing to reduce gaps.',
    intensity: 7,
    synergies: [
      { tactic: 'low_block', boost: 30 },
      { tactic: 'zonal_marking', boost: 25 },
    ],
    counters: [
      { tactic: 'switch_of_play', reduction: 25 },
      { tactic: 'width', reduction: 20 },
    ],
    params: {
      verticalDistance: 25,
      horizontalDistance: 35,
      shiftSpeed: 0.8,
    },
  },
  {
    id: 'defensive_shifting',
    name: 'Defensive Shifting',
    phase: 'defensive',
    description: 'Team slides as a unit to cover the ball side.',
    intensity: 6,
    synergies: [
      { tactic: 'compactness', boost: 25 },
      { tactic: 'zonal_marking', boost: 20 },
    ],
    params: {
      shiftSpeed: 0.85,
      overloadSide: true,
      weakSideCover: 0.7,
    },
  },
  {
    id: 'sweeper_keeper',
    name: 'Sweeper-Keeper',
    phase: 'defensive',
    description: 'Goalkeeper advances to clear balls behind the high line.',
    intensity: 7,
    synergies: [
      { tactic: 'high_line', boost: 35 },
      { tactic: 'build_up', boost: 20 },
    ],
    counters: [
      { tactic: 'long_ball', reduction: 15 },
    ],
    params: {
      sweepRange: 25,
      passingAbility: 0.85,
      riskTolerance: 0.7,
    },
  },
  {
    id: 'rest_defense',
    name: 'Rest-Defense',
    phase: 'defensive',
    description: '3-4 players stay back during attacks to counter transitions.',
    intensity: 5,
    synergies: [
      { tactic: 'counter_attack', boost: 20 },
    ],
    counters: [
      { tactic: 'overload', reduction: 15 },
    ],
    params: {
      playersBack: 3,
      coverPositions: ['cb', 'cb', 'cdm'],
      transitionReadiness: 0.9,
    },
  },
  {
    id: 'offside_trap',
    name: 'Offside Trap',
    phase: 'defensive',
    description: 'Coordinated backline movement to catch attackers offside.',
    intensity: 8,
    triggers: [
      { event: 'through_ball_anticipated' },
    ],
    synergies: [
      { tactic: 'high_line', boost: 35 },
    ],
    counters: [
      { tactic: 'timed_runs', reduction: 30 },
    ],
    params: {
      stepUpTiming: 'on_pass',
      coordinationLevel: 0.9,
      riskLevel: 0.8,
    },
  },
  {
    id: 'catenaccio',
    name: 'Catenaccio',
    phase: 'defensive',
    description: 'Ultra-defensive system with a sweeper behind a back-four; prioritizes counter-attacks.',
    intensity: 5,
    synergies: [
      { tactic: 'low_block', boost: 35 },
      { tactic: 'counter_attack', boost: 30 },
    ],
    counters: [
      { tactic: 'positional_play', reduction: 10 },
    ],
    params: {
      sweeperDepth: 5,
      defensiveLine: 20,
      counterSpeed: 0.9,
      patience: 0.95,
    },
  },
];

// ==================== TRANSITION TACTICS ====================

export const TRANSITION_TACTICS: Tactic[] = [
  {
    id: 'attacking_transition',
    name: 'Attacking Transition',
    phase: 'transition',
    description: 'Quick shift from defense to attack post-regain.',
    intensity: 8,
    triggers: [
      { event: 'ball_won' },
    ],
    synergies: [
      { tactic: 'counter_attack', boost: 35 },
      { tactic: 'verticality', boost: 25 },
    ],
    params: {
      transitionSpeed: 0.9,
      forwardPassPriority: 0.8,
      runnerCount: 3,
    },
  },
  {
    id: 'defensive_transition',
    name: 'Defensive Transition',
    phase: 'transition',
    description: 'Immediate reorganization after losing the ball.',
    intensity: 8,
    triggers: [
      { event: 'ball_lost' },
    ],
    synergies: [
      { tactic: 'gegenpressing', boost: 30 },
      { tactic: 'rest_defense', boost: 25 },
    ],
    params: {
      recoverySpeed: 0.85,
      shapeRecoveryTime: 4,
      pressOrRetreat: 'press',
    },
  },
  {
    id: 'counter_attack',
    name: 'Counter-Attack',
    phase: 'transition',
    description: 'Rapid exploitation of space when opponents are unbalanced.',
    intensity: 8,
    triggers: [
      { event: 'ball_won', condition: 'opponents_high' },
    ],
    synergies: [
      { tactic: 'low_block', boost: 30 },
      { tactic: 'direct_play', boost: 25 },
      { tactic: 'attacking_transition', boost: 35 },
    ],
    params: {
      breakSpeed: 0.95,
      passesBefore: 3,
      targetRunners: 2,
      finishWindow: 8,
    },
  },
  {
    id: 'quick_recovery',
    name: 'Quick Recovery',
    phase: 'transition',
    description: 'Regrouping to defensive shape within seconds.',
    intensity: 7,
    triggers: [
      { event: 'ball_lost', condition: 'counter_press_failed' },
    ],
    synergies: [
      { tactic: 'compactness', boost: 25 },
      { tactic: 'defensive_transition', boost: 30 },
    ],
    params: {
      recoveryTime: 5,
      targetShape: 'compact_block',
      sprintRecovery: true,
    },
  },
];

// ==================== ALL TACTICS COMBINED ====================

export const ALL_TACTICS: Tactic[] = [
  ...ATTACKING_TACTICS,
  ...DEFENSIVE_TACTICS,
  ...TRANSITION_TACTICS,
];

// ==================== PRESET SYSTEMS ====================

export interface TacticalPreset {
  id: string;
  name: string;
  manager?: string;
  description: string;
  formation: string;
  attackingTactics: string[];
  defensiveTactics: string[];
  transitionTactics: string[];
  intensityProfile: {
    pressing: number;
    possession: number;
    directness: number;
    tempo: number;
  };
}

export const TACTICAL_PRESETS: TacticalPreset[] = [
  {
    id: 'guardiola_total_football',
    name: 'Total Football (Guardiola)',
    manager: 'Pep Guardiola',
    description: 'Positional play with maximum pressing, fluid rotations, and half-space dominance.',
    formation: '4-3-3',
    attackingTactics: ['total_football', 'positional_play', 'tiki_taka', 'half_spaces', 'inverted_fullbacks', 'false_9', 'la_pausa', 'overload', 'rotations'],
    defensiveTactics: ['gegenpressing', 'high_press', 'high_line', 'sweeper_keeper', 'pressing_triggers'],
    transitionTactics: ['attacking_transition', 'defensive_transition'],
    intensityProfile: {
      pressing: 95,
      possession: 90,
      directness: 30,
      tempo: 70,
    },
  },
  {
    id: 'mourinho_pragmatic',
    name: 'Pragmatic Counter (Mourinho)',
    manager: 'José Mourinho',
    description: 'Defensive solidity with lethal counter-attacks; organized low block.',
    formation: '4-2-3-1',
    attackingTactics: ['direct_play', 'verticality', 'overlap'],
    defensiveTactics: ['low_block', 'compactness', 'man_marking', 'rest_defense', 'defensive_shifting'],
    transitionTactics: ['counter_attack', 'quick_recovery'],
    intensityProfile: {
      pressing: 40,
      possession: 35,
      directness: 80,
      tempo: 50,
    },
  },
  {
    id: 'klopp_heavy_metal',
    name: 'Heavy Metal Football (Klopp)',
    manager: 'Jürgen Klopp',
    description: 'Relentless pressing with fast transitions and emotional intensity.',
    formation: '4-3-3',
    attackingTactics: ['verticality', 'overlap', 'third_man_runs', 'ghosting_runs', 'switch_of_play'],
    defensiveTactics: ['gegenpressing', 'high_press', 'high_line', 'pressing_triggers'],
    transitionTactics: ['attacking_transition', 'counter_attack', 'defensive_transition'],
    intensityProfile: {
      pressing: 98,
      possession: 55,
      directness: 70,
      tempo: 95,
    },
  },
  {
    id: 'ancelotti_balanced',
    name: 'Balanced Excellence (Ancelotti)',
    manager: 'Carlo Ancelotti',
    description: 'Tactical flexibility with emphasis on individual quality and game management.',
    formation: '4-3-3',
    attackingTactics: ['combination_play', 'overlap', 'inverted_wingers', 'switch_of_play'],
    defensiveTactics: ['mid_block', 'zonal_marking', 'compactness', 'cover_shadow'],
    transitionTactics: ['attacking_transition', 'quick_recovery'],
    intensityProfile: {
      pressing: 60,
      possession: 55,
      directness: 50,
      tempo: 60,
    },
  },
  {
    id: 'simeone_intensity',
    name: 'Cholismo (Simeone)',
    manager: 'Diego Simeone',
    description: 'Maximum defensive intensity, emotional commitment, and clinical counters.',
    formation: '4-4-2',
    attackingTactics: ['direct_play', 'overlap'],
    defensiveTactics: ['low_block', 'compactness', 'man_marking', 'pressing_triggers', 'defensive_shifting'],
    transitionTactics: ['counter_attack', 'quick_recovery', 'defensive_transition'],
    intensityProfile: {
      pressing: 70,
      possession: 35,
      directness: 85,
      tempo: 55,
    },
  },
  {
    id: 'cruyff_dream_team',
    name: 'Dream Team (Cruyff)',
    manager: 'Johan Cruyff',
    description: 'Original Total Football with attacking freedom and positional interchange.',
    formation: '3-4-3',
    attackingTactics: ['total_football', 'positional_play', 'rotations', 'false_9', 'inverted_wingers'],
    defensiveTactics: ['high_press', 'high_line', 'zonal_marking'],
    transitionTactics: ['attacking_transition'],
    intensityProfile: {
      pressing: 80,
      possession: 85,
      directness: 40,
      tempo: 75,
    },
  },
];

// ==================== UTILITY FUNCTIONS ====================

export function getTacticById(id: string): Tactic | undefined {
  return ALL_TACTICS.find((t) => t.id === id);
}

export function getTacticsByPhase(phase: TacticPhase): Tactic[] {
  return ALL_TACTICS.filter((t) => t.phase === phase);
}

export function getFormationById(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id);
}

export function getPresetById(id: string): TacticalPreset | undefined {
  return TACTICAL_PRESETS.find((p) => p.id === id);
}

export function calculateSynergy(tactics: string[]): number {
  let totalBoost = 0;
  const tacticObjects = tactics.map(getTacticById).filter(Boolean) as Tactic[];

  for (const tactic of tacticObjects) {
    if (tactic.synergies) {
      for (const synergy of tactic.synergies) {
        if (tactics.includes(synergy.tactic)) {
          totalBoost += synergy.boost;
        }
      }
    }
  }

  return totalBoost;
}

export function calculateCounters(attackingTactics: string[], defensiveTactics: string[]): number {
  let totalReduction = 0;
  const attackObjects = attackingTactics.map(getTacticById).filter(Boolean) as Tactic[];
  const defenseObjects = defensiveTactics.map(getTacticById).filter(Boolean) as Tactic[];

  for (const attack of attackObjects) {
    if (attack.counters) {
      for (const counter of attack.counters) {
        if (defensiveTactics.includes(counter.tactic)) {
          totalReduction += counter.reduction;
        }
      }
    }
  }

  for (const defense of defenseObjects) {
    if (defense.counters) {
      for (const counter of defense.counters) {
        if (attackingTactics.includes(counter.tactic)) {
          totalReduction += counter.reduction;
        }
      }
    }
  }

  return totalReduction;
}

export function searchTactics(query: string): Tactic[] {
  const lowerQuery = query.toLowerCase();
  return ALL_TACTICS.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.id.toLowerCase().includes(lowerQuery)
  );
}
