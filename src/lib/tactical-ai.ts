/**
 * TACTICAL AI ENGINE
 * ML-inspired adaptive decision-making system
 * Uses reinforcement learning concepts for real-time tactical adjustments
 */

// Game state type for tactical AI
export interface GameState {
  ballPosition: { x: number; y: number };
  players: {
    home: { x: number; y: number }[];
    away: { x: number; y: number }[];
  };
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface TacticalDecision {
  type: 'formation_change' | 'pressing_trigger' | 'tempo_shift' | 'width_adjustment' |
        'defensive_line' | 'player_instruction' | 'substitution_suggestion';
  confidence: number;       // 0-1 confidence in decision
  urgency: number;          // 0-1 how urgent the change is
  reasoning: string;        // Human-readable explanation
  parameters: Record<string, number | string | boolean | string[]>;
  expectedImpact: {
    possessionChange: number;
    xGChange: number;
    pressureReduction: number;
  };
}

export interface MatchContext {
  minute: number;
  scoreDifferential: number;  // positive = winning
  possession: number;
  xGDifferential: number;
  pressureIndex: number;      // 0-100 how much pressure we're under
  momentumScore: number;      // -100 to 100
  fatigueLevel: number;       // 0-100 team average
  recentEvents: MatchEvent[];
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'shot' | 'chance' | 'foul' | 'card' | 'substitution' | 'pressing_success' | 'pressing_fail';
  team: 'home' | 'away';
  xG?: number;
  zone?: string;
}

export interface OpponentPattern {
  buildUpStyle: 'short' | 'direct' | 'mixed';
  preferredFlank: 'left' | 'right' | 'central' | 'balanced';
  pressingTrigger: 'high' | 'mid' | 'low';
  counterAttackSpeed: number;
  setPlayDanger: number;
  weakZones: string[];
  strongZones: string[];
}

export interface TacticalState {
  formation: string;
  pressingIntensity: number;
  defensiveLine: number;
  tempo: number;
  width: number;
  riskLevel: number;
}

// ============================================================================
// Q-LEARNING INSPIRED TACTICAL AGENT
// ============================================================================

interface StateAction {
  state: string;
  action: string;
  reward: number;
  visits: number;
}

export class TacticalQLearner {
  private qTable: Map<string, StateAction[]> = new Map();
  private learningRate = 0.1;
  private discountFactor = 0.95;
  private explorationRate = 0.15;

  constructor() {
    this.initializeQTable();
  }

  private initializeQTable(): void {
    // Pre-populate with football knowledge
    const states = ['winning_comfortable', 'winning_narrow', 'drawing', 'losing_narrow', 'losing_heavy'];
    const phases = ['early', 'mid', 'late', 'injury_time'];
    const pressures = ['low', 'medium', 'high'];

    for (const state of states) {
      for (const phase of phases) {
        for (const pressure of pressures) {
          const key = `${state}_${phase}_${pressure}`;
          this.qTable.set(key, this.getDefaultActions(state, phase, pressure));
        }
      }
    }
  }

  private getDefaultActions(state: string, phase: string, pressure: string): StateAction[] {
    const actions: StateAction[] = [];

    // Knowledge-based initialization
    if (state === 'winning_comfortable') {
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'maintain_possession', reward: 0.8, visits: 10 });
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'drop_deeper', reward: 0.6, visits: 10 });
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'reduce_tempo', reward: 0.7, visits: 10 });
    } else if (state === 'losing_heavy') {
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'all_out_attack', reward: 0.7, visits: 10 });
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'increase_pressing', reward: 0.6, visits: 10 });
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'push_fullbacks', reward: 0.65, visits: 10 });
    } else if (state === 'drawing' && phase === 'late') {
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'calculated_risks', reward: 0.7, visits: 10 });
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'overload_flanks', reward: 0.65, visits: 10 });
    }

    // Default actions for all states
    if (actions.length === 0) {
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'maintain_shape', reward: 0.5, visits: 5 });
      actions.push({ state: `${state}_${phase}_${pressure}`, action: 'adapt_to_opponent', reward: 0.5, visits: 5 });
    }

    return actions;
  }

  selectAction(context: MatchContext): string {
    const stateKey = this.contextToState(context);
    const actions = this.qTable.get(stateKey) || [];

    // Epsilon-greedy exploration
    if (Math.random() < this.explorationRate) {
      return actions[Math.floor(Math.random() * actions.length)]?.action || 'maintain_shape';
    }

    // Exploit best action
    const bestAction = actions.reduce((best, current) =>
      (current.reward / Math.max(1, current.visits)) > (best.reward / Math.max(1, best.visits)) ? current : best
    , actions[0]);

    return bestAction?.action || 'maintain_shape';
  }

  updateReward(context: MatchContext, action: string, reward: number): void {
    const stateKey = this.contextToState(context);
    const actions = this.qTable.get(stateKey);

    if (actions) {
      const actionEntry = actions.find(a => a.action === action);
      if (actionEntry) {
        // Q-learning update rule
        actionEntry.reward = actionEntry.reward + this.learningRate * (reward - actionEntry.reward);
        actionEntry.visits++;
      }
    }
  }

  private contextToState(context: MatchContext): string {
    let scoreState: string;
    if (context.scoreDifferential >= 2) scoreState = 'winning_comfortable';
    else if (context.scoreDifferential === 1) scoreState = 'winning_narrow';
    else if (context.scoreDifferential === 0) scoreState = 'drawing';
    else if (context.scoreDifferential === -1) scoreState = 'losing_narrow';
    else scoreState = 'losing_heavy';

    let phase: string;
    if (context.minute < 30) phase = 'early';
    else if (context.minute < 60) phase = 'mid';
    else if (context.minute < 85) phase = 'late';
    else phase = 'injury_time';

    let pressure: string;
    if (context.pressureIndex < 33) pressure = 'low';
    else if (context.pressureIndex < 66) pressure = 'medium';
    else pressure = 'high';

    return `${scoreState}_${phase}_${pressure}`;
  }
}

// ============================================================================
// OPPONENT PATTERN RECOGNITION
// ============================================================================

export class PatternRecognizer {
  private observationWindow: MatchEvent[] = [];
  private readonly WINDOW_SIZE = 50;

  addObservation(event: MatchEvent): void {
    this.observationWindow.push(event);
    if (this.observationWindow.length > this.WINDOW_SIZE) {
      this.observationWindow.shift();
    }
  }

  analyzeOpponent(team: 'home' | 'away'): OpponentPattern {
    const teamEvents = this.observationWindow.filter(e => e.team === team);

    // Analyze build-up style
    const shortPasses = teamEvents.filter(e => e.zone?.includes('defensive')).length;
    const directPlays = teamEvents.filter(e => e.type === 'chance' && e.zone?.includes('attacking')).length;
    let buildUpStyle: 'short' | 'direct' | 'mixed' = 'mixed';
    if (shortPasses > directPlays * 2) buildUpStyle = 'short';
    else if (directPlays > shortPasses) buildUpStyle = 'direct';

    // Analyze flank preference
    const leftEvents = teamEvents.filter(e => e.zone?.includes('left')).length;
    const rightEvents = teamEvents.filter(e => e.zone?.includes('right')).length;
    const centralEvents = teamEvents.filter(e => e.zone?.includes('central')).length;
    let preferredFlank: 'left' | 'right' | 'central' | 'balanced' = 'balanced';
    if (leftEvents > rightEvents * 1.5 && leftEvents > centralEvents) preferredFlank = 'left';
    else if (rightEvents > leftEvents * 1.5 && rightEvents > centralEvents) preferredFlank = 'right';
    else if (centralEvents > leftEvents && centralEvents > rightEvents) preferredFlank = 'central';

    // Analyze pressing trigger
    const highPresses = teamEvents.filter(e => e.type === 'pressing_success' && e.zone?.includes('high')).length;
    const midPresses = teamEvents.filter(e => e.type === 'pressing_success' && e.zone?.includes('mid')).length;
    let pressingTrigger: 'high' | 'mid' | 'low' = 'mid';
    if (highPresses > midPresses * 1.3) pressingTrigger = 'high';
    else if (midPresses > highPresses * 2) pressingTrigger = 'low';

    // Calculate counter-attack speed
    const counterGoals = teamEvents.filter(e =>
      e.type === 'goal' && e.zone?.includes('counter')
    ).length;
    const counterAttackSpeed = Math.min(100, 50 + counterGoals * 15);

    // Set play danger
    const setPieceChances = teamEvents.filter(e =>
      e.type === 'chance' && e.zone?.includes('setpiece')
    ).length;
    const setPlayDanger = Math.min(100, 40 + setPieceChances * 10);

    // Identify weak/strong zones
    const zoneXG: Record<string, number> = {};
    teamEvents.forEach(e => {
      if (e.zone && e.xG) {
        zoneXG[e.zone] = (zoneXG[e.zone] || 0) + e.xG;
      }
    });

    const sortedZones = Object.entries(zoneXG).sort((a, b) => b[1] - a[1]);
    const strongZones = sortedZones.slice(0, 2).map(([zone]) => zone);
    const weakZones = sortedZones.slice(-2).map(([zone]) => zone);

    return {
      buildUpStyle,
      preferredFlank,
      pressingTrigger,
      counterAttackSpeed,
      setPlayDanger,
      weakZones,
      strongZones
    };
  }

  predictNextMove(pattern: OpponentPattern): { zone: string; probability: number; threat: number } {
    // Use Markov-like prediction based on observed patterns
    const predictions: { zone: string; probability: number; threat: number }[] = [];

    if (pattern.preferredFlank === 'left') {
      predictions.push({ zone: 'left_channel', probability: 0.45, threat: 70 });
      predictions.push({ zone: 'left_halfspace', probability: 0.30, threat: 65 });
    } else if (pattern.preferredFlank === 'right') {
      predictions.push({ zone: 'right_channel', probability: 0.45, threat: 70 });
      predictions.push({ zone: 'right_halfspace', probability: 0.30, threat: 65 });
    } else if (pattern.preferredFlank === 'central') {
      predictions.push({ zone: 'central_corridor', probability: 0.50, threat: 75 });
      predictions.push({ zone: 'box_edge', probability: 0.25, threat: 80 });
    }

    if (pattern.counterAttackSpeed > 70) {
      predictions.push({ zone: 'transition_space', probability: 0.35, threat: 85 });
    }

    // Return highest threat prediction
    return predictions.reduce((max, p) => p.threat > max.threat ? p : max,
      { zone: 'unknown', probability: 0.3, threat: 50 });
  }
}

// ============================================================================
// MAIN TACTICAL AI ENGINE
// ============================================================================

export class TacticalAI {
  private qLearner: TacticalQLearner;
  private patternRecognizer: PatternRecognizer;
  private currentTactics: TacticalState;
  private decisionHistory: TacticalDecision[] = [];

  constructor() {
    this.qLearner = new TacticalQLearner();
    this.patternRecognizer = new PatternRecognizer();
    this.currentTactics = {
      formation: '4-3-3',
      pressingIntensity: 70,
      defensiveLine: 60,
      tempo: 65,
      width: 70,
      riskLevel: 50
    };
  }

  processMatchEvent(event: MatchEvent): void {
    this.patternRecognizer.addObservation(event);
  }

  generateDecisions(context: MatchContext, gameState: GameState): TacticalDecision[] {
    const decisions: TacticalDecision[] = [];

    // Get Q-learning recommended action
    const recommendedAction = this.qLearner.selectAction(context);

    // Analyze opponent patterns
    const opponentPattern = this.patternRecognizer.analyzeOpponent('away');
    const nextMovePrediction = this.patternRecognizer.predictNextMove(opponentPattern);

    // Generate specific decisions based on context
    decisions.push(...this.generatePressingDecisions(context, opponentPattern));
    decisions.push(...this.generateFormationDecisions(context, opponentPattern));
    decisions.push(...this.generateTempoDecisions(context, recommendedAction));
    decisions.push(...this.generateCounterTactics(opponentPattern, nextMovePrediction));

    // Filter and prioritize decisions
    const prioritizedDecisions = this.prioritizeDecisions(decisions, context);

    this.decisionHistory.push(...prioritizedDecisions);

    return prioritizedDecisions;
  }

  private generatePressingDecisions(
    context: MatchContext,
    pattern: OpponentPattern
  ): TacticalDecision[] {
    const decisions: TacticalDecision[] = [];

    // Adjust pressing based on opponent build-up
    if (pattern.buildUpStyle === 'short' && this.currentTactics.pressingIntensity < 75) {
      decisions.push({
        type: 'pressing_trigger',
        confidence: 0.85,
        urgency: 0.7,
        reasoning: 'Opponent plays short from back - increase pressing to force errors',
        parameters: {
          newIntensity: 80,
          trigger: 'goalkeeper_possession',
          trapZone: 'left_channel'
        },
        expectedImpact: {
          possessionChange: 5,
          xGChange: 0.15,
          pressureReduction: -10
        }
      });
    }

    // Reduce pressing if fatigued
    if (context.fatigueLevel > 70 && this.currentTactics.pressingIntensity > 60) {
      decisions.push({
        type: 'pressing_trigger',
        confidence: 0.9,
        urgency: 0.8,
        reasoning: 'High fatigue levels - drop into mid-block to conserve energy',
        parameters: {
          newIntensity: 50,
          trigger: 'midfield_entry',
          recoveryMode: true
        },
        expectedImpact: {
          possessionChange: -3,
          xGChange: -0.05,
          pressureReduction: 25
        }
      });
    }

    return decisions;
  }

  private generateFormationDecisions(
    context: MatchContext,
    pattern: OpponentPattern
  ): TacticalDecision[] {
    const decisions: TacticalDecision[] = [];

    // Counter flank-heavy opponents
    if (pattern.preferredFlank === 'left' || pattern.preferredFlank === 'right') {
      decisions.push({
        type: 'formation_change',
        confidence: 0.75,
        urgency: 0.5,
        reasoning: `Opponent overloads ${pattern.preferredFlank} side - shift to asymmetric 4-4-2`,
        parameters: {
          formation: '4-4-2-asymmetric',
          overloadSide: pattern.preferredFlank === 'left' ? 'right' : 'left',
          compactness: 75
        },
        expectedImpact: {
          possessionChange: -2,
          xGChange: -0.1,
          pressureReduction: 15
        }
      });
    }

    // Late game losing - go attacking
    if (context.minute > 75 && context.scoreDifferential < 0) {
      decisions.push({
        type: 'formation_change',
        confidence: 0.8,
        urgency: 0.9,
        reasoning: 'Losing late - switch to 3-4-3 for attacking overload',
        parameters: {
          formation: '3-4-3',
          mentalityShift: 'all_out_attack',
          fullbacksToWingbacks: true
        },
        expectedImpact: {
          possessionChange: 3,
          xGChange: 0.25,
          pressureReduction: -20
        }
      });
    }

    return decisions;
  }

  private generateTempoDecisions(
    context: MatchContext,
    recommendedAction: string
  ): TacticalDecision[] {
    const decisions: TacticalDecision[] = [];

    if (recommendedAction === 'reduce_tempo' && context.scoreDifferential > 0) {
      decisions.push({
        type: 'tempo_shift',
        confidence: 0.85,
        urgency: 0.6,
        reasoning: 'Leading - slow tempo to control game and frustrate opponent',
        parameters: {
          newTempo: 45,
          passingStyle: 'patient_buildup',
          recycleThreshold: 3
        },
        expectedImpact: {
          possessionChange: 8,
          xGChange: -0.05,
          pressureReduction: 20
        }
      });
    }

    if (recommendedAction === 'all_out_attack') {
      decisions.push({
        type: 'tempo_shift',
        confidence: 0.8,
        urgency: 0.95,
        reasoning: 'Desperate measures needed - maximize tempo and directness',
        parameters: {
          newTempo: 95,
          passingStyle: 'direct_vertical',
          riskThreshold: 0.8
        },
        expectedImpact: {
          possessionChange: -5,
          xGChange: 0.3,
          pressureReduction: -30
        }
      });
    }

    return decisions;
  }

  private generateCounterTactics(
    pattern: OpponentPattern,
    prediction: { zone: string; probability: number; threat: number }
  ): TacticalDecision[] {
    const decisions: TacticalDecision[] = [];

    // Predict and counter
    if (prediction.threat > 70) {
      decisions.push({
        type: 'defensive_line',
        confidence: prediction.probability,
        urgency: prediction.threat / 100,
        reasoning: `Predicted attack through ${prediction.zone} - preemptively cover`,
        parameters: {
          coverZone: prediction.zone,
          shiftDefense: true,
          doubleMarkTarget: pattern.strongZones[0]
        },
        expectedImpact: {
          possessionChange: 0,
          xGChange: -0.2,
          pressureReduction: 15
        }
      });
    }

    // Exploit weak zones
    if (pattern.weakZones.length > 0) {
      decisions.push({
        type: 'player_instruction',
        confidence: 0.7,
        urgency: 0.5,
        reasoning: `Exploit opponent weakness in ${pattern.weakZones[0]}`,
        parameters: {
          targetZone: pattern.weakZones[0],
          attackingFocus: 'overload',
          keyPlayers: ['winger', 'fullback']
        },
        expectedImpact: {
          possessionChange: 2,
          xGChange: 0.15,
          pressureReduction: 0
        }
      });
    }

    return decisions;
  }

  private prioritizeDecisions(
    decisions: TacticalDecision[],
    context: MatchContext
  ): TacticalDecision[] {
    // Score each decision
    const scored = decisions.map(d => ({
      decision: d,
      score: d.confidence * 0.4 + d.urgency * 0.4 +
             (d.expectedImpact.xGChange > 0 ? 0.2 : 0)
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Return top 3 decisions
    return scored.slice(0, 3).map(s => s.decision);
  }

  applyDecision(decision: TacticalDecision): void {
    switch (decision.type) {
      case 'pressing_trigger':
        this.currentTactics.pressingIntensity = decision.parameters.newIntensity as number;
        break;
      case 'formation_change':
        this.currentTactics.formation = decision.parameters.formation as string;
        break;
      case 'tempo_shift':
        this.currentTactics.tempo = decision.parameters.newTempo as number;
        break;
      case 'defensive_line':
        // Adjust defensive line based on cover zone
        break;
    }
  }

  getCurrentTactics(): TacticalState {
    return { ...this.currentTactics };
  }

  getDecisionHistory(): TacticalDecision[] {
    return [...this.decisionHistory];
  }

  // Feedback loop for reinforcement learning
  provideFeedback(context: MatchContext, action: string, outcome: 'positive' | 'negative' | 'neutral'): void {
    const reward = outcome === 'positive' ? 1 : outcome === 'negative' ? -0.5 : 0.1;
    this.qLearner.updateReward(context, action, reward);
  }
}

// ============================================================================
// WHAT-IF SCENARIO SIMULATOR
// ============================================================================

export interface ScenarioResult {
  scenario: string;
  xGFor: number;
  xGAgainst: number;
  possessionProjection: number;
  riskLevel: number;
  recommendation: string;
}

export function simulateScenario(
  currentState: TacticalState,
  proposedChange: Partial<TacticalState>,
  opponentPattern: OpponentPattern,
  simulations: number = 1000
): ScenarioResult {
  let totalXGFor = 0;
  let totalXGAgainst = 0;
  let totalPossession = 0;

  const newState = { ...currentState, ...proposedChange };

  for (let i = 0; i < simulations; i++) {
    // Monte Carlo simulation with tactical parameters
    const possessionBase = 50 + (newState.pressingIntensity - 50) * 0.2 +
                          (newState.tempo - 50) * 0.1;
    const possession = possessionBase + (Math.random() - 0.5) * 20;

    // xG based on tactical choices
    const xGFor = (newState.riskLevel / 100) * 0.3 +
                  (newState.tempo / 100) * 0.2 +
                  Math.random() * 0.5;

    // xG against based on defensive settings and opponent
    const xGAgainst = ((100 - newState.defensiveLine) / 100) * 0.15 +
                      (opponentPattern.counterAttackSpeed / 100) * 0.2 +
                      Math.random() * 0.4;

    totalXGFor += xGFor;
    totalXGAgainst += xGAgainst;
    totalPossession += possession;
  }

  const avgXGFor = totalXGFor / simulations;
  const avgXGAgainst = totalXGAgainst / simulations;
  const avgPossession = totalPossession / simulations;

  // Generate recommendation
  let recommendation = 'Maintain current approach';
  const xGDiff = avgXGFor - avgXGAgainst;

  if (xGDiff > 0.3) {
    recommendation = 'Highly recommended - significant attacking advantage';
  } else if (xGDiff > 0.1) {
    recommendation = 'Recommended - positive expected outcome';
  } else if (xGDiff < -0.2) {
    recommendation = 'Not recommended - defensive vulnerability';
  } else {
    recommendation = 'Marginal change - consider match context';
  }

  return {
    scenario: Object.entries(proposedChange).map(([k, v]) => `${k}: ${v}`).join(', '),
    xGFor: avgXGFor,
    xGAgainst: avgXGAgainst,
    possessionProjection: avgPossession,
    riskLevel: newState.riskLevel,
    recommendation
  };
}
