/**
 * TACTICAL PATTERN RECOGNITION ENGINE
 * Granular compounding tactical identifications and logs
 * Forms the basis of coherence to the selected game model
 */

// ============================================================================
// PATTERN TYPES & INTERFACES
// ============================================================================

export interface TacticalPattern {
  id: string;
  type: PatternType;
  team: 'home' | 'away';
  confidence: number;         // 0-1
  frequency: number;          // Times observed
  lastSeen: number;           // Game minute
  players: string[];          // Players involved
  zone: PitchZone;
  description: string;
  counterPattern?: string;    // Pattern that counters this
  synergies: string[];        // Patterns that work with this
}

export type PatternType =
  // Attacking patterns
  | 'overload_left' | 'overload_right' | 'overload_central'
  | 'switch_play' | 'quick_combination' | 'third_man_run'
  | 'underlap' | 'overlap' | 'inverted_fullback'
  | 'false_nine_drop' | 'striker_drift_wide'
  | 'halfspace_penetration' | 'channel_run'
  | 'cutback_cross' | 'early_cross' | 'low_driven_cross'
  // Defensive patterns
  | 'high_press_trigger' | 'mid_block' | 'low_block'
  | 'press_trap_sideline' | 'press_trap_corner'
  | 'cover_shadow' | 'zonal_marking' | 'man_marking'
  | 'offside_trap' | 'drop_deep'
  // Transition patterns
  | 'counter_attack' | 'counter_press' | 'quick_restart'
  | 'possession_recovery' | 'controlled_transition'
  // Build-up patterns
  | 'play_from_back' | 'long_ball_outlet' | 'goalkeeper_sweep'
  | 'split_cbs' | 'double_pivot' | 'single_pivot';

export type PitchZone =
  | 'defensive_third' | 'middle_third' | 'final_third'
  | 'left_channel' | 'right_channel' | 'central_corridor'
  | 'left_halfspace' | 'right_halfspace'
  | 'box' | 'six_yard_box';

export interface PatternLog {
  id: string;
  timestamp: number;          // Game minute
  pattern: TacticalPattern;
  triggerEvent: string;       // What caused this pattern
  outcome: PatternOutcome;
  xGCreated: number;
  xGConceded: number;
  compoundingEffects: CompoundingEffect[];
}

export interface PatternOutcome {
  success: boolean;
  result: 'goal' | 'shot' | 'chance' | 'turnover' | 'possession_retained' | 'foul_won' | 'nothing';
  duration: number;           // Seconds the pattern lasted
  endZone: PitchZone;
}

export interface CompoundingEffect {
  type: 'synergy' | 'fatigue' | 'psychological' | 'positional' | 'tactical_shift';
  description: string;
  magnitude: number;          // -1 to 1
  affectedPlayers: string[];
  duration: number;           // Minutes the effect lasts
}

export interface TacticalCoherence {
  gameModel: string;          // e.g., 'positional_play', 'counter_attacking'
  coherenceScore: number;     // 0-100 how well team is executing model
  deviations: {
    pattern: string;
    deviation: number;
    reason: string;
  }[];
  suggestions: string[];
  historicalComparison: {
    avgCoherence: number;
    trend: 'improving' | 'declining' | 'stable';
  };
}

// ============================================================================
// MARKOV CHAIN INTERFACES
// ============================================================================

export interface MarkovTransition {
  from: PatternType;
  to: PatternType;
  count: number;
  probability: number;
  avgTimeBetween: number;  // Minutes between patterns
  successRate: number;     // When this transition leads to success
}

export interface RecurrentSequence {
  id: string;
  patterns: PatternType[];
  team: 'home' | 'away';
  occurrences: number;
  avgDuration: number;
  successRate: number;
  xGGenerated: number;
  lastSeen: number;
  description: string;
}

export interface MarkovChainState {
  transitionMatrix: Map<string, MarkovTransition>;
  recurrentSequences: RecurrentSequence[];
  currentChain: PatternType[];
  stateHistory: { pattern: PatternType; timestamp: number; team: 'home' | 'away' }[];
}

// ============================================================================
// PATTERN RECOGNITION ENGINE
// ============================================================================

export class PatternRecognitionEngine {
  private observedPatterns: Map<string, TacticalPattern> = new Map();
  private patternLogs: PatternLog[] = [];
  private activeCompoundingEffects: CompoundingEffect[] = [];
  private gameModelReference: Record<string, PatternType[]>;

  // MARKOV CHAIN STATE
  private markovState: {
    home: MarkovChainState;
    away: MarkovChainState;
  };
  private readonly MIN_SEQUENCE_LENGTH = 2;
  private readonly MAX_SEQUENCE_LENGTH = 5;
  private readonly SEQUENCE_TIMEOUT = 3; // Minutes - patterns within this time are considered a sequence

  private readonly PATTERN_DECAY = 0.95;     // Confidence decay per minute without observation
  private readonly SYNERGY_BOOST = 0.15;     // Boost when synergistic patterns occur together
  private readonly COUNTER_PENALTY = 0.2;    // Penalty when countered

  constructor() {
    // Initialize Markov chain state for both teams
    this.markovState = {
      home: {
        transitionMatrix: new Map(),
        recurrentSequences: [],
        currentChain: [],
        stateHistory: []
      },
      away: {
        transitionMatrix: new Map(),
        recurrentSequences: [],
        currentChain: [],
        stateHistory: []
      }
    };

    // Define game model pattern expectations
    this.gameModelReference = {
      'positional_play': [
        'overload_left', 'overload_right', 'halfspace_penetration',
        'inverted_fullback', 'false_nine_drop', 'quick_combination',
        'play_from_back', 'split_cbs', 'double_pivot', 'cover_shadow'
      ],
      'counter_attacking': [
        'low_block', 'counter_attack', 'long_ball_outlet',
        'channel_run', 'quick_restart', 'drop_deep',
        'zonal_marking', 'cover_shadow'
      ],
      'high_pressing': [
        'high_press_trigger', 'press_trap_sideline', 'press_trap_corner',
        'counter_press', 'possession_recovery', 'offside_trap',
        'man_marking', 'quick_combination'
      ],
      'direct_play': [
        'long_ball_outlet', 'early_cross', 'channel_run',
        'striker_drift_wide', 'quick_restart', 'mid_block'
      ],
      'tiki_taka': [
        'quick_combination', 'third_man_run', 'halfspace_penetration',
        'play_from_back', 'split_cbs', 'overload_central',
        'false_nine_drop', 'single_pivot', 'cover_shadow'
      ]
    };
  }

  // ============================================================================
  // PATTERN DETECTION
  // ============================================================================

  analyzePositions(
    homePlayers: { x: number; y: number; name: string; role: string }[],
    awayPlayers: { x: number; y: number; name: string; role: string }[],
    ballPosition: { x: number; y: number },
    ballTeam: 'home' | 'away',
    minute: number
  ): TacticalPattern[] {
    const detectedPatterns: TacticalPattern[] = [];
    const attackingTeam = ballTeam === 'home' ? homePlayers : awayPlayers;
    const defendingTeam = ballTeam === 'home' ? awayPlayers : homePlayers;

    // Detect attacking patterns
    detectedPatterns.push(...this.detectOverloads(attackingTeam, ballPosition, ballTeam, minute));
    detectedPatterns.push(...this.detectCombinationPlay(attackingTeam, ballPosition, ballTeam, minute));
    detectedPatterns.push(...this.detectWidePlay(attackingTeam, ballPosition, ballTeam, minute));
    detectedPatterns.push(...this.detectBuildUpPatterns(attackingTeam, ballPosition, ballTeam, minute));

    // Detect defensive patterns
    detectedPatterns.push(...this.detectDefensiveShape(defendingTeam, ballPosition, ballTeam === 'home' ? 'away' : 'home', minute));
    detectedPatterns.push(...this.detectPressingPatterns(defendingTeam, attackingTeam, ballPosition, ballTeam === 'home' ? 'away' : 'home', minute));

    // Detect transition patterns
    detectedPatterns.push(...this.detectTransitionPatterns(attackingTeam, defendingTeam, ballPosition, ballTeam, minute));

    // Update pattern registry
    for (const pattern of detectedPatterns) {
      this.updatePatternRegistry(pattern);
    }

    // MARKOV CHAIN: Track state transitions
    for (const pattern of detectedPatterns) {
      this.updateMarkovChain(pattern.team, pattern.type, minute);
    }

    // Apply compounding effects
    this.applyCompoundingEffects(detectedPatterns, minute);

    return detectedPatterns;
  }

  private detectOverloads(
    players: { x: number; y: number; name: string; role: string }[],
    ball: { x: number; y: number },
    team: 'home' | 'away',
    minute: number
  ): TacticalPattern[] {
    const patterns: TacticalPattern[] = [];
    const outfieldPlayers = players.filter(p => p.role !== 'GK');

    // Count players in each vertical third
    const leftCount = outfieldPlayers.filter(p => p.y < 28).length;
    const centralCount = outfieldPlayers.filter(p => p.y >= 28 && p.y <= 40).length;
    const rightCount = outfieldPlayers.filter(p => p.y > 40).length;

    const leftPlayers = outfieldPlayers.filter(p => p.y < 28).map(p => p.name);
    const centralPlayers = outfieldPlayers.filter(p => p.y >= 28 && p.y <= 40).map(p => p.name);
    const rightPlayers = outfieldPlayers.filter(p => p.y > 40).map(p => p.name);

    if (leftCount >= 4) {
      patterns.push({
        id: `${team}_overload_left_${minute}`,
        type: 'overload_left',
        team,
        confidence: Math.min(1, 0.5 + leftCount * 0.1),
        frequency: 1,
        lastSeen: minute,
        players: leftPlayers,
        zone: 'left_channel',
        description: `${leftCount} players overloading left side to create numerical superiority`,
        counterPattern: 'switch_play',
        synergies: ['overlap', 'underlap', 'cutback_cross']
      });
    }

    if (rightCount >= 4) {
      patterns.push({
        id: `${team}_overload_right_${minute}`,
        type: 'overload_right',
        team,
        confidence: Math.min(1, 0.5 + rightCount * 0.1),
        frequency: 1,
        lastSeen: minute,
        players: rightPlayers,
        zone: 'right_channel',
        description: `${rightCount} players overloading right side for combination play`,
        counterPattern: 'switch_play',
        synergies: ['overlap', 'underlap', 'cutback_cross']
      });
    }

    if (centralCount >= 5) {
      patterns.push({
        id: `${team}_overload_central_${minute}`,
        type: 'overload_central',
        team,
        confidence: Math.min(1, 0.5 + centralCount * 0.08),
        frequency: 1,
        lastSeen: minute,
        players: centralPlayers,
        zone: 'central_corridor',
        description: `Central overload with ${centralCount} players - Guardiola-style positional play`,
        counterPattern: 'low_block',
        synergies: ['quick_combination', 'third_man_run', 'halfspace_penetration']
      });
    }

    return patterns;
  }

  private detectCombinationPlay(
    players: { x: number; y: number; name: string; role: string }[],
    ball: { x: number; y: number },
    team: 'home' | 'away',
    minute: number
  ): TacticalPattern[] {
    const patterns: TacticalPattern[] = [];

    // Find players close to ball (potential combination)
    const nearBall = players.filter(p => {
      const dist = Math.sqrt(Math.pow(p.x - ball.x, 2) + Math.pow(p.y - ball.y, 2));
      return dist < 18 && p.role !== 'GK';
    });

    if (nearBall.length >= 3) {
      // Check for triangle formation (quick combination)
      const avgX = nearBall.reduce((s, p) => s + p.x, 0) / nearBall.length;
      const avgY = nearBall.reduce((s, p) => s + p.y, 0) / nearBall.length;
      const spread = nearBall.reduce((s, p) =>
        s + Math.sqrt(Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2)), 0) / nearBall.length;

      if (spread > 6 && spread < 15) {
        patterns.push({
          id: `${team}_quick_combination_${minute}`,
          type: 'quick_combination',
          team,
          confidence: 0.7 + (nearBall.length - 3) * 0.1,
          frequency: 1,
          lastSeen: minute,
          players: nearBall.map(p => p.name),
          zone: this.getZoneFromPosition(ball),
          description: `${nearBall.length}-player combination forming in ${this.getZoneFromPosition(ball)}`,
          counterPattern: 'high_press_trigger',
          synergies: ['third_man_run', 'halfspace_penetration', 'overload_central']
        });
      }
    }

    // Detect third man runs
    const advancedPlayers = players.filter(p =>
      (team === 'home' && p.x > ball.x + 10) ||
      (team === 'away' && p.x < ball.x - 10)
    );

    if (advancedPlayers.length >= 2 && nearBall.length >= 2) {
      patterns.push({
        id: `${team}_third_man_run_${minute}`,
        type: 'third_man_run',
        team,
        confidence: 0.65,
        frequency: 1,
        lastSeen: minute,
        players: [...advancedPlayers.map(p => p.name).slice(0, 2)],
        zone: 'final_third',
        description: 'Third man run creating depth behind initial pass receiver',
        counterPattern: 'cover_shadow',
        synergies: ['quick_combination', 'channel_run']
      });
    }

    return patterns;
  }

  private detectWidePlay(
    players: { x: number; y: number; name: string; role: string }[],
    ball: { x: number; y: number },
    team: 'home' | 'away',
    minute: number
  ): TacticalPattern[] {
    const patterns: TacticalPattern[] = [];

    const widePlayers = players.filter(p => p.y < 15 || p.y > 53);
    const fullbacks = players.filter(p => p.role === 'RB' || p.role === 'LB');
    const wingers = players.filter(p => p.role === 'RW' || p.role === 'LW' || p.role === 'RM' || p.role === 'LM');

    // Detect overlaps (fullback ahead of winger)
    for (const fb of fullbacks) {
      for (const winger of wingers) {
        const sameSide = (fb.y < 34 && winger.y < 34) || (fb.y > 34 && winger.y > 34);
        const isAhead = team === 'home' ? fb.x > winger.x + 5 : fb.x < winger.x - 5;
        const isWider = Math.abs(fb.y - 34) > Math.abs(winger.y - 34);

        if (sameSide && isAhead && isWider) {
          patterns.push({
            id: `${team}_overlap_${fb.name}_${minute}`,
            type: 'overlap',
            team,
            confidence: 0.75,
            frequency: 1,
            lastSeen: minute,
            players: [fb.name, winger.name],
            zone: fb.y < 34 ? 'left_channel' : 'right_channel',
            description: `${fb.name} overlapping ${winger.name} - stretching defense wide`,
            counterPattern: 'man_marking',
            synergies: ['early_cross', 'cutback_cross', 'overload_left', 'overload_right']
          });
        }

        // Detect underlaps (fullback inside of winger)
        const isInside = Math.abs(fb.y - 34) < Math.abs(winger.y - 34);
        if (sameSide && isAhead && isInside) {
          patterns.push({
            id: `${team}_underlap_${fb.name}_${minute}`,
            type: 'underlap',
            team,
            confidence: 0.7,
            frequency: 1,
            lastSeen: minute,
            players: [fb.name, winger.name],
            zone: fb.y < 34 ? 'left_halfspace' : 'right_halfspace',
            description: `${fb.name} underlapping into halfspace - creating passing lane`,
            counterPattern: 'zonal_marking',
            synergies: ['halfspace_penetration', 'quick_combination']
          });
        }
      }
    }

    // Detect inverted fullback
    for (const fb of fullbacks) {
      const isInverted = Math.abs(fb.y - 34) < 20 &&
                         ((team === 'home' && fb.x > 30) || (team === 'away' && fb.x < 70));
      if (isInverted) {
        patterns.push({
          id: `${team}_inverted_fullback_${fb.name}_${minute}`,
          type: 'inverted_fullback',
          team,
          confidence: 0.8,
          frequency: 1,
          lastSeen: minute,
          players: [fb.name],
          zone: 'central_corridor',
          description: `${fb.name} inverting into midfield - Guardiola tactical signature`,
          counterPattern: 'counter_attack',
          synergies: ['overload_central', 'double_pivot', 'quick_combination']
        });
      }
    }

    return patterns;
  }

  private detectBuildUpPatterns(
    players: { x: number; y: number; name: string; role: string }[],
    ball: { x: number; y: number },
    team: 'home' | 'away',
    minute: number
  ): TacticalPattern[] {
    const patterns: TacticalPattern[] = [];
    const isInDefThird = team === 'home' ? ball.x < 35 : ball.x > 70;

    if (!isInDefThird) return patterns;

    const cbs = players.filter(p => p.role === 'CB');
    const cdms = players.filter(p => p.role === 'CDM' || p.role === 'DM');
    const gk = players.find(p => p.role === 'GK');

    // Split CBs pattern
    if (cbs.length >= 2) {
      const cbSpread = Math.abs(cbs[0].y - cbs[1].y);
      if (cbSpread > 30) {
        patterns.push({
          id: `${team}_split_cbs_${minute}`,
          type: 'split_cbs',
          team,
          confidence: 0.85,
          frequency: 1,
          lastSeen: minute,
          players: cbs.map(p => p.name),
          zone: 'defensive_third',
          description: 'Center-backs splitting wide to stretch opposition press and create passing angles',
          counterPattern: 'high_press_trigger',
          synergies: ['play_from_back', 'double_pivot', 'goalkeeper_sweep']
        });
      }
    }

    // Double/Single pivot
    if (cdms.length >= 2) {
      const pivotSpread = Math.abs(cdms[0].y - cdms[1].y);
      if (pivotSpread < 20) {
        patterns.push({
          id: `${team}_double_pivot_${minute}`,
          type: 'double_pivot',
          team,
          confidence: 0.75,
          frequency: 1,
          lastSeen: minute,
          players: cdms.map(p => p.name),
          zone: 'defensive_third',
          description: 'Double pivot protecting defense and offering passing options in build-up',
          counterPattern: 'press_trap_central',
          synergies: ['split_cbs', 'play_from_back', 'inverted_fullback']
        });
      }
    } else if (cdms.length === 1) {
      patterns.push({
        id: `${team}_single_pivot_${minute}`,
        type: 'single_pivot',
        team,
        confidence: 0.7,
        frequency: 1,
        lastSeen: minute,
        players: [cdms[0].name],
        zone: 'defensive_third',
        description: `${cdms[0].name} as single pivot - allowing extra attacker in advanced positions`,
        counterPattern: 'man_marking',
        synergies: ['overload_central', 'quick_combination']
      });
    }

    // Play from back
    if (gk && cbs.length >= 2) {
      const nearGK = players.filter(p => {
        const dist = Math.sqrt(Math.pow(p.x - gk.x, 2) + Math.pow(p.y - gk.y, 2));
        return dist < 25 && p.role !== 'GK';
      });

      if (nearGK.length >= 3) {
        patterns.push({
          id: `${team}_play_from_back_${minute}`,
          type: 'play_from_back',
          team,
          confidence: 0.8,
          frequency: 1,
          lastSeen: minute,
          players: [gk.name, ...nearGK.map(p => p.name).slice(0, 3)],
          zone: 'defensive_third',
          description: 'Committed build-up from goalkeeper - patient positional play',
          counterPattern: 'high_press_trigger',
          synergies: ['split_cbs', 'goalkeeper_sweep', 'double_pivot']
        });
      }
    }

    return patterns;
  }

  private detectDefensiveShape(
    defenders: { x: number; y: number; name: string; role: string }[],
    ball: { x: number; y: number },
    team: 'home' | 'away',
    minute: number
  ): TacticalPattern[] {
    const patterns: TacticalPattern[] = [];
    const outfield = defenders.filter(p => p.role !== 'GK');

    // Calculate defensive line position
    const defLine = outfield
      .filter(p => ['CB', 'RB', 'LB'].includes(p.role))
      .reduce((sum, p) => sum + p.x, 0) / 4;

    const isHighLine = team === 'home' ? defLine > 40 : defLine < 60;
    const isMidBlock = team === 'home' ? (defLine >= 25 && defLine <= 40) : (defLine >= 60 && defLine <= 75);
    const isLowBlock = team === 'home' ? defLine < 25 : defLine > 75;

    // Calculate compactness
    const xPositions = outfield.map(p => p.x);
    const verticalCompact = Math.max(...xPositions) - Math.min(...xPositions);

    if (isLowBlock && verticalCompact < 30) {
      patterns.push({
        id: `${team}_low_block_${minute}`,
        type: 'low_block',
        team,
        confidence: 0.85,
        frequency: 1,
        lastSeen: minute,
        players: outfield.map(p => p.name),
        zone: 'defensive_third',
        description: `Compact low block - ${verticalCompact.toFixed(0)}m between lines. Inviting pressure, ready to counter`,
        counterPattern: 'overload_central',
        synergies: ['counter_attack', 'long_ball_outlet', 'zonal_marking']
      });
    }

    if (isMidBlock) {
      patterns.push({
        id: `${team}_mid_block_${minute}`,
        type: 'mid_block',
        team,
        confidence: 0.75,
        frequency: 1,
        lastSeen: minute,
        players: outfield.map(p => p.name),
        zone: 'middle_third',
        description: 'Mid-block setup - balanced between pressing and protecting',
        counterPattern: 'quick_combination',
        synergies: ['cover_shadow', 'zonal_marking']
      });
    }

    if (isHighLine && verticalCompact < 35) {
      patterns.push({
        id: `${team}_high_line_${minute}`,
        type: 'offside_trap',
        team,
        confidence: 0.7,
        frequency: 1,
        lastSeen: minute,
        players: defenders.filter(p => ['CB', 'RB', 'LB'].includes(p.role)).map(p => p.name),
        zone: 'middle_third',
        description: 'High defensive line - risking offside trap, squeezing space',
        counterPattern: 'channel_run',
        synergies: ['high_press_trigger', 'counter_press']
      });
    }

    return patterns;
  }

  private detectPressingPatterns(
    defenders: { x: number; y: number; name: string; role: string }[],
    attackers: { x: number; y: number; name: string; role: string }[],
    ball: { x: number; y: number },
    team: 'home' | 'away',
    minute: number
  ): TacticalPattern[] {
    const patterns: TacticalPattern[] = [];

    // Find players near ball (pressing)
    const pressers = defenders.filter(p => {
      const dist = Math.sqrt(Math.pow(p.x - ball.x, 2) + Math.pow(p.y - ball.y, 2));
      return dist < 15;
    });

    if (pressers.length >= 3) {
      // Determine press type
      const isHighPress = (team === 'home' && ball.x > 70) || (team === 'away' && ball.x < 30);
      const isSidelinePress = ball.y < 15 || ball.y > 53;
      const isCornerPress = isSidelinePress &&
        ((team === 'home' && ball.x > 80) || (team === 'away' && ball.x < 20));

      if (isCornerPress) {
        patterns.push({
          id: `${team}_press_trap_corner_${minute}`,
          type: 'press_trap_corner',
          team,
          confidence: 0.85,
          frequency: 1,
          lastSeen: minute,
          players: pressers.map(p => p.name),
          zone: ball.y < 34 ? 'left_channel' : 'right_channel',
          description: `Corner press trap with ${pressers.length} players - forcing turnover or long ball`,
          counterPattern: 'switch_play',
          synergies: ['high_press_trigger', 'counter_press', 'possession_recovery']
        });
      } else if (isSidelinePress) {
        patterns.push({
          id: `${team}_press_trap_sideline_${minute}`,
          type: 'press_trap_sideline',
          team,
          confidence: 0.8,
          frequency: 1,
          lastSeen: minute,
          players: pressers.map(p => p.name),
          zone: ball.y < 34 ? 'left_channel' : 'right_channel',
          description: `Sideline pressing trap - using touchline as extra defender`,
          counterPattern: 'switch_play',
          synergies: ['high_press_trigger', 'man_marking']
        });
      } else if (isHighPress) {
        patterns.push({
          id: `${team}_high_press_trigger_${minute}`,
          type: 'high_press_trigger',
          team,
          confidence: 0.75 + pressers.length * 0.05,
          frequency: 1,
          lastSeen: minute,
          players: pressers.map(p => p.name),
          zone: 'defensive_third',
          description: `High press triggered - ${pressers.length} players hunting ball in opponent's third`,
          counterPattern: 'long_ball_outlet',
          synergies: ['press_trap_sideline', 'counter_press', 'offside_trap']
        });
      }
    }

    return patterns;
  }

  private detectTransitionPatterns(
    attacking: { x: number; y: number; name: string; role: string }[],
    defending: { x: number; y: number; name: string; role: string }[],
    ball: { x: number; y: number },
    team: 'home' | 'away',
    minute: number
  ): TacticalPattern[] {
    const patterns: TacticalPattern[] = [];

    // Detect counter-attack potential
    const attackingThird = team === 'home' ? ball.x > 65 : ball.x < 35;
    const fastPlayers = attacking.filter(p =>
      ['ST', 'RW', 'LW', 'RM', 'LM'].includes(p.role)
    );

    // Check if defending team is caught high
    const defLine = defending
      .filter(p => ['CB', 'RB', 'LB'].includes(p.role))
      .reduce((sum, p) => sum + p.x, 0) / 4;

    const spaceToExploit = team === 'home' ? (100 - defLine) : defLine;

    if (spaceToExploit > 40 && fastPlayers.length >= 2) {
      patterns.push({
        id: `${team}_counter_attack_${minute}`,
        type: 'counter_attack',
        team,
        confidence: 0.7 + (spaceToExploit - 40) * 0.01,
        frequency: 1,
        lastSeen: minute,
        players: fastPlayers.map(p => p.name).slice(0, 3),
        zone: 'middle_third',
        description: `Counter-attack opportunity! ${spaceToExploit.toFixed(0)}m of space behind high line`,
        counterPattern: 'counter_press',
        synergies: ['channel_run', 'long_ball_outlet', 'quick_restart']
      });
    }

    return patterns;
  }

  private getZoneFromPosition(pos: { x: number; y: number }): PitchZone {
    if (pos.x < 35) return 'defensive_third';
    if (pos.x > 70) return 'final_third';
    if (pos.y < 20) return 'left_channel';
    if (pos.y > 48) return 'right_channel';
    if (pos.y < 30) return 'left_halfspace';
    if (pos.y > 38) return 'right_halfspace';
    return 'central_corridor';
  }

  // ============================================================================
  // PATTERN REGISTRY & LOGGING
  // ============================================================================

  private updatePatternRegistry(pattern: TacticalPattern): void {
    const existing = this.observedPatterns.get(pattern.type + '_' + pattern.team);

    if (existing) {
      existing.frequency++;
      existing.lastSeen = pattern.lastSeen;
      existing.confidence = Math.min(1, existing.confidence + 0.05);
      existing.players = [...new Set([...existing.players, ...pattern.players])];
    } else {
      this.observedPatterns.set(pattern.type + '_' + pattern.team, pattern);
    }
  }

  logPattern(
    pattern: TacticalPattern,
    triggerEvent: string,
    outcome: PatternOutcome,
    xGCreated: number = 0,
    xGConceded: number = 0
  ): PatternLog {
    const compoundingEffects = this.calculateCompoundingEffects(pattern, outcome);

    const log: PatternLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: pattern.lastSeen,
      pattern,
      triggerEvent,
      outcome,
      xGCreated,
      xGConceded,
      compoundingEffects
    };

    this.patternLogs.push(log);
    this.activeCompoundingEffects.push(...compoundingEffects);

    return log;
  }

  private calculateCompoundingEffects(
    pattern: TacticalPattern,
    outcome: PatternOutcome
  ): CompoundingEffect[] {
    const effects: CompoundingEffect[] = [];

    // Success breeds confidence
    if (outcome.success) {
      effects.push({
        type: 'psychological',
        description: `Successful ${pattern.type.replace(/_/g, ' ')} boosting team confidence`,
        magnitude: 0.1 + (outcome.result === 'goal' ? 0.3 : outcome.result === 'chance' ? 0.15 : 0),
        affectedPlayers: pattern.players,
        duration: 5
      });

      // Synergy effects
      for (const synergy of pattern.synergies) {
        const synergyPattern = this.observedPatterns.get(synergy + '_' + pattern.team);
        if (synergyPattern && synergyPattern.lastSeen > pattern.lastSeen - 2) {
          effects.push({
            type: 'synergy',
            description: `${pattern.type} + ${synergy} creating compound threat`,
            magnitude: this.SYNERGY_BOOST,
            affectedPlayers: [...new Set([...pattern.players, ...synergyPattern.players])],
            duration: 3
          });
        }
      }
    } else {
      // Failure effects
      effects.push({
        type: 'psychological',
        description: `Failed ${pattern.type.replace(/_/g, ' ')} - players may hesitate`,
        magnitude: -0.08,
        affectedPlayers: pattern.players,
        duration: 3
      });

      // Positional exposure
      if (pattern.counterPattern) {
        effects.push({
          type: 'positional',
          description: `Position exposed after failed ${pattern.type}`,
          magnitude: -0.12,
          affectedPlayers: pattern.players,
          duration: 2
        });
      }
    }

    // Fatigue from high-intensity patterns
    const highIntensityPatterns: PatternType[] = [
      'high_press_trigger', 'counter_press', 'counter_attack', 'press_trap_corner'
    ];
    if (highIntensityPatterns.includes(pattern.type)) {
      effects.push({
        type: 'fatigue',
        description: `Energy expenditure from ${pattern.type.replace(/_/g, ' ')}`,
        magnitude: -0.05,
        affectedPlayers: pattern.players,
        duration: 10
      });
    }

    return effects;
  }

  private applyCompoundingEffects(patterns: TacticalPattern[], minute: number): void {
    // Remove expired effects
    this.activeCompoundingEffects = this.activeCompoundingEffects.filter(effect => {
      const elapsedMinutes = minute - (this.patternLogs.find(l =>
        l.compoundingEffects.includes(effect))?.timestamp || 0);
      return elapsedMinutes < effect.duration;
    });

    // Apply decay to pattern confidence
    for (const [key, pattern] of this.observedPatterns) {
      const timeSinceLastSeen = minute - pattern.lastSeen;
      if (timeSinceLastSeen > 1) {
        pattern.confidence *= Math.pow(this.PATTERN_DECAY, timeSinceLastSeen);
      }
    }
  }

  // ============================================================================
  // MARKOV CHAIN PATTERN DETECTION
  // ============================================================================

  private updateMarkovChain(team: 'home' | 'away', patternType: PatternType, minute: number): void {
    const state = this.markovState[team];
    const history = state.stateHistory;

    // Add to history
    history.push({ pattern: patternType, timestamp: minute, team });

    // Keep history bounded
    if (history.length > 100) {
      history.shift();
    }

    // Update current chain (patterns within SEQUENCE_TIMEOUT of each other)
    const recentHistory = history.filter(h => minute - h.timestamp < this.SEQUENCE_TIMEOUT);
    state.currentChain = recentHistory.map(h => h.pattern);

    // Update transition matrix if we have a previous pattern
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      const timeBetween = minute - prev.timestamp;

      // Only count as transition if within reasonable time
      if (timeBetween < this.SEQUENCE_TIMEOUT) {
        this.recordTransition(team, prev.pattern, patternType, timeBetween);
      }
    }

    // Detect recurrent sequences
    if (state.currentChain.length >= this.MIN_SEQUENCE_LENGTH) {
      this.detectRecurrentSequence(team, state.currentChain, minute);
    }
  }

  private recordTransition(
    team: 'home' | 'away',
    from: PatternType,
    to: PatternType,
    timeBetween: number
  ): void {
    const key = `${team}_${from}_${to}`;
    const state = this.markovState[team];
    const existing = state.transitionMatrix.get(key);

    if (existing) {
      // Update existing transition
      existing.count++;
      existing.avgTimeBetween = (existing.avgTimeBetween * (existing.count - 1) + timeBetween) / existing.count;
    } else {
      // New transition
      state.transitionMatrix.set(key, {
        from,
        to,
        count: 1,
        probability: 0, // Will be calculated
        avgTimeBetween: timeBetween,
        successRate: 0.5
      });
    }

    // Recalculate probabilities for all transitions from this pattern
    this.recalculateTransitionProbabilities(team, from);
  }

  private recalculateTransitionProbabilities(team: 'home' | 'away', from: PatternType): void {
    const state = this.markovState[team];
    const transitions = Array.from(state.transitionMatrix.entries())
      .filter(([key]) => key.startsWith(`${team}_${from}_`))
      .map(([, trans]) => trans);

    const totalCount = transitions.reduce((sum, t) => sum + t.count, 0);

    for (const trans of transitions) {
      trans.probability = totalCount > 0 ? trans.count / totalCount : 0;
    }
  }

  private detectRecurrentSequence(team: 'home' | 'away', chain: PatternType[], minute: number): void {
    const state = this.markovState[team];

    // Look for repeating subsequences
    for (let len = this.MIN_SEQUENCE_LENGTH; len <= Math.min(this.MAX_SEQUENCE_LENGTH, chain.length); len++) {
      const sequence = chain.slice(-len);
      const sequenceKey = sequence.join('->');

      // Check if this sequence has occurred before
      const existingSeq = state.recurrentSequences.find(s =>
        s.patterns.join('->') === sequenceKey && s.team === team
      );

      if (existingSeq) {
        // Update existing sequence
        existingSeq.occurrences++;
        existingSeq.lastSeen = minute;

        // Update success rate from recent logs
        const relevantLogs = this.patternLogs.filter(l =>
          l.pattern.team === team &&
          sequence.includes(l.pattern.type) &&
          l.timestamp > minute - 10
        );
        if (relevantLogs.length > 0) {
          existingSeq.successRate = relevantLogs.filter(l => l.outcome.success).length / relevantLogs.length;
          existingSeq.xGGenerated = relevantLogs.reduce((sum, l) => sum + l.xGCreated, 0);
        }
      } else if (this.hasSequenceOccurredBefore(state.stateHistory, sequence)) {
        // New recurrent sequence detected
        state.recurrentSequences.push({
          id: `seq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          patterns: sequence,
          team,
          occurrences: 2, // This is the second occurrence
          avgDuration: this.SEQUENCE_TIMEOUT * len,
          successRate: 0.5,
          xGGenerated: 0,
          lastSeen: minute,
          description: this.generateSequenceDescription(sequence)
        });
      }
    }

    // Prune old sequences
    state.recurrentSequences = state.recurrentSequences
      .filter(s => minute - s.lastSeen < 30) // Keep sequences seen in last 30 min
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10); // Keep top 10
  }

  private hasSequenceOccurredBefore(
    history: { pattern: PatternType; timestamp: number }[],
    sequence: PatternType[]
  ): boolean {
    if (history.length < sequence.length * 2) return false;

    // Look for the sequence in history (excluding the current occurrence at the end)
    const historyWithoutCurrent = history.slice(0, -sequence.length);

    for (let i = 0; i <= historyWithoutCurrent.length - sequence.length; i++) {
      let match = true;
      for (let j = 0; j < sequence.length; j++) {
        if (historyWithoutCurrent[i + j].pattern !== sequence[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }

  private generateSequenceDescription(sequence: PatternType[]): string {
    const names = sequence.map(p => p.replace(/_/g, ' '));

    if (sequence.includes('high_press_trigger') && sequence.includes('counter_attack')) {
      return `Press-to-counter sequence: ${names.join(' → ')}`;
    }
    if (sequence.includes('overload_left') || sequence.includes('overload_right')) {
      return `Width exploitation chain: ${names.join(' → ')}`;
    }
    if (sequence.includes('quick_combination')) {
      return `Combination play sequence: ${names.join(' → ')}`;
    }
    if (sequence.includes('play_from_back')) {
      return `Build-up progression: ${names.join(' → ')}`;
    }
    return `Tactical chain: ${names.join(' → ')}`;
  }

  // Update success rate when a pattern outcome is logged
  updateTransitionSuccess(team: 'home' | 'away', pattern: PatternType, success: boolean): void {
    const state = this.markovState[team];

    // Update all transitions leading TO this pattern
    for (const [key, trans] of state.transitionMatrix.entries()) {
      if (trans.to === pattern && key.startsWith(`${team}_`)) {
        const weight = 0.1; // Learning rate
        trans.successRate = trans.successRate * (1 - weight) + (success ? 1 : 0) * weight;
      }
    }
  }

  // ============================================================================
  // TACTICAL COHERENCE
  // ============================================================================

  calculateCoherence(team: 'home' | 'away', gameModel: string, minute: number): TacticalCoherence {
    const expectedPatterns = this.gameModelReference[gameModel] || [];
    const teamPatterns = Array.from(this.observedPatterns.values())
      .filter(p => p.team === team && p.lastSeen > minute - 10);

    const observedTypes = new Set(teamPatterns.map(p => p.type));
    let matchScore = 0;
    const deviations: TacticalCoherence['deviations'] = [];

    // Check how many expected patterns are being executed
    for (const expected of expectedPatterns) {
      if (observedTypes.has(expected)) {
        const pattern = teamPatterns.find(p => p.type === expected);
        matchScore += pattern?.confidence || 0.5;
      } else {
        deviations.push({
          pattern: expected,
          deviation: 1,
          reason: `${expected.replace(/_/g, ' ')} not observed in recent play`
        });
      }
    }

    // Check for unexpected patterns (not in game model)
    for (const pattern of teamPatterns) {
      if (!expectedPatterns.includes(pattern.type)) {
        deviations.push({
          pattern: pattern.type,
          deviation: 0.5,
          reason: `${pattern.type.replace(/_/g, ' ')} deviates from ${gameModel} model`
        });
      }
    }

    const coherenceScore = expectedPatterns.length > 0
      ? (matchScore / expectedPatterns.length) * 100
      : 50;

    // Generate suggestions
    const suggestions: string[] = [];
    const missingCritical = expectedPatterns
      .filter(e => !observedTypes.has(e))
      .slice(0, 3);

    for (const missing of missingCritical) {
      const synergyPatterns = teamPatterns.filter(p =>
        p.synergies.includes(missing)
      );
      if (synergyPatterns.length > 0) {
        suggestions.push(
          `Use ${synergyPatterns[0].type.replace(/_/g, ' ')} to set up ${missing.replace(/_/g, ' ')}`
        );
      } else {
        suggestions.push(`Implement ${missing.replace(/_/g, ' ')} to improve ${gameModel} execution`);
      }
    }

    // Historical comparison
    const recentLogs = this.patternLogs.filter(l =>
      l.pattern.team === team && l.timestamp > minute - 15
    );
    const successRate = recentLogs.length > 0
      ? recentLogs.filter(l => l.outcome.success).length / recentLogs.length
      : 0.5;

    return {
      gameModel,
      coherenceScore: Math.round(coherenceScore),
      deviations,
      suggestions,
      historicalComparison: {
        avgCoherence: coherenceScore * 0.9 + successRate * 10,
        trend: successRate > 0.6 ? 'improving' : successRate < 0.4 ? 'declining' : 'stable'
      }
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getPatternLogs(team?: 'home' | 'away', limit: number = 20): PatternLog[] {
    let logs = [...this.patternLogs];
    if (team) {
      logs = logs.filter(l => l.pattern.team === team);
    }
    return logs.slice(-limit);
  }

  getActivePatterns(team?: 'home' | 'away'): TacticalPattern[] {
    let patterns = Array.from(this.observedPatterns.values());
    if (team) {
      patterns = patterns.filter(p => p.team === team);
    }
    return patterns.filter(p => p.confidence > 0.3);
  }

  getCompoundingEffects(): CompoundingEffect[] {
    return [...this.activeCompoundingEffects];
  }

  getPatternSummary(team: 'home' | 'away'): {
    dominant: PatternType[];
    missing: PatternType[];
    effectiveness: number;
    recommendations: string[];
  } {
    const teamPatterns = this.getActivePatterns(team);
    const logs = this.getPatternLogs(team);

    const dominant = teamPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map(p => p.type);

    const allTypes: PatternType[] = [
      'quick_combination', 'third_man_run', 'halfspace_penetration',
      'overlap', 'counter_attack', 'high_press_trigger'
    ];
    const missing = allTypes.filter(t => !teamPatterns.some(p => p.type === t));

    const successfulLogs = logs.filter(l => l.outcome.success);
    const effectiveness = logs.length > 0
      ? (successfulLogs.length / logs.length) * 100
      : 50;

    const recommendations: string[] = [];
    if (missing.includes('quick_combination') && dominant.includes('overload_central')) {
      recommendations.push('Add quick combinations to exploit central overload');
    }
    if (missing.includes('counter_attack') && dominant.includes('low_block')) {
      recommendations.push('Look for counter-attack opportunities from low block');
    }
    if (effectiveness < 50) {
      recommendations.push('Pattern execution needs improvement - focus on key players');
    }

    return { dominant, missing, effectiveness, recommendations };
  }

  reset(): void {
    this.observedPatterns.clear();
    this.patternLogs = [];
    this.activeCompoundingEffects = [];
    this.markovState = {
      home: { transitionMatrix: new Map(), recurrentSequences: [], currentChain: [], stateHistory: [] },
      away: { transitionMatrix: new Map(), recurrentSequences: [], currentChain: [], stateHistory: [] }
    };
  }

  // ============================================================================
  // MARKOV CHAIN PUBLIC API
  // ============================================================================

  getMarkovState(team: 'home' | 'away'): MarkovChainState {
    return {
      transitionMatrix: new Map(this.markovState[team].transitionMatrix),
      recurrentSequences: [...this.markovState[team].recurrentSequences],
      currentChain: [...this.markovState[team].currentChain],
      stateHistory: [...this.markovState[team].stateHistory]
    };
  }

  getRecurrentSequences(team?: 'home' | 'away'): RecurrentSequence[] {
    if (team) {
      return [...this.markovState[team].recurrentSequences];
    }
    return [
      ...this.markovState.home.recurrentSequences,
      ...this.markovState.away.recurrentSequences
    ];
  }

  getTopTransitions(team: 'home' | 'away', limit: number = 5): MarkovTransition[] {
    return Array.from(this.markovState[team].transitionMatrix.values())
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit);
  }

  getPredictedNextPattern(team: 'home' | 'away'): { pattern: PatternType; probability: number } | null {
    const state = this.markovState[team];
    if (state.currentChain.length === 0) return null;

    const lastPattern = state.currentChain[state.currentChain.length - 1];
    const transitions = Array.from(state.transitionMatrix.entries())
      .filter(([key]) => key.startsWith(`${team}_${lastPattern}_`))
      .map(([, trans]) => trans)
      .sort((a, b) => b.probability - a.probability);

    if (transitions.length === 0) return null;

    return {
      pattern: transitions[0].to,
      probability: transitions[0].probability
    };
  }

  getCurrentChain(team: 'home' | 'away'): PatternType[] {
    return [...this.markovState[team].currentChain];
  }

  getChainSummary(team: 'home' | 'away'): {
    currentChain: string;
    topSequences: { sequence: string; count: number; successRate: number }[];
    predictedNext: string | null;
    chainHealth: 'strong' | 'building' | 'broken';
  } {
    const state = this.markovState[team];
    const predicted = this.getPredictedNextPattern(team);

    const chainHealth = state.currentChain.length >= 3 ? 'strong' :
                        state.currentChain.length >= 1 ? 'building' : 'broken';

    return {
      currentChain: state.currentChain.map(p => p.replace(/_/g, ' ')).join(' → ') || 'No active chain',
      topSequences: state.recurrentSequences
        .slice(0, 3)
        .map(s => ({
          sequence: s.patterns.map(p => p.replace(/_/g, ' ')).join(' → '),
          count: s.occurrences,
          successRate: Math.round(s.successRate * 100)
        })),
      predictedNext: predicted ? predicted.pattern.replace(/_/g, ' ') : null,
      chainHealth
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const patternEngine = new PatternRecognitionEngine();
