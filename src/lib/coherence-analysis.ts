// Coherence Analysis System
// Compares live player data against tactical game model expectations

import {
  GameModel,
  GameApproach,
  TrackingMetrics,
  DigitalTwin,
  CoherenceReport,
  TacticalDeviation,
  CriticalDeviation,
  PlayerInstruction,
  FormationPosition,
  ExpectedBehavior,
  LivePlayerData,
  TeamMetrics,
  Player,
} from '@/types';

// ==================== Main Coherence Calculation ====================

export function calculateCoherence(
  gameModel: GameModel,
  gameApproach: GameApproach | null,
  playerData: Map<string, LivePlayerData>,
  digitalTwins: Map<string, DigitalTwin>,
  matchMinute: number,
  gamePhase: string
): CoherenceReport {
  const byPlayer = new Map<string, number>();
  const byPhase = new Map<string, number>();
  const byPrinciple = new Map<string, number>();
  const criticalDeviations: CriticalDeviation[] = [];
  const recommendations: string[] = [];

  let totalScore = 0;
  let playerCount = 0;

  // Calculate per-player coherence
  for (const [playerId, data] of playerData) {
    const twin = digitalTwins.get(playerId);
    const instruction = gameModel.playerInstructions.get(playerId);

    if (!twin || !instruction) continue;

    const playerCoherence = calculatePlayerCoherence(
      data,
      twin,
      instruction,
      gameModel,
      gamePhase,
      matchMinute
    );

    byPlayer.set(playerId, playerCoherence.score);
    totalScore += playerCoherence.score;
    playerCount++;

    // Check for critical deviations
    if (playerCoherence.score < 50) {
      criticalDeviations.push({
        description: `Player ${playerId} significantly deviating from tactical role`,
        affectedPlayers: [playerId],
        impact: 'Formation structure compromised',
        suggestedAction: playerCoherence.recommendation,
      });
    }

    // Collect deviations by phase and principle
    for (const deviation of data.deviations) {
      const phaseScore = byPhase.get(deviation.context) || 100;
      byPhase.set(deviation.context, phaseScore - (deviation.severity === 'major' ? 20 : deviation.severity === 'moderate' ? 10 : 5));
    }
  }

  // Calculate phase coherence
  const phaseCoherence = calculatePhaseCoherence(
    gameModel,
    playerData,
    gamePhase,
    matchMinute
  );
  byPhase.set(gamePhase, phaseCoherence.score);

  // Calculate principle adherence
  const principleScores = calculatePrincipleAdherence(
    gameModel,
    playerData,
    gamePhase
  );
  for (const [principle, score] of principleScores) {
    byPrinciple.set(principle, score);
  }

  // Generate recommendations
  recommendations.push(...generateRecommendations(
    gameModel,
    playerData,
    criticalDeviations,
    matchMinute
  ));

  const overallScore = playerCount > 0 ? totalScore / playerCount : 0;

  return {
    overallScore: Math.round(overallScore),
    byPhase,
    byPlayer,
    byPrinciple,
    criticalDeviations,
    recommendations,
  };
}

// ==================== Player-Level Coherence ====================

interface PlayerCoherenceResult {
  score: number;
  deviations: TacticalDeviation[];
  recommendation: string;
}

function calculatePlayerCoherence(
  data: LivePlayerData,
  twin: DigitalTwin,
  instruction: PlayerInstruction,
  gameModel: GameModel,
  gamePhase: string,
  matchMinute: number
): PlayerCoherenceResult {
  let score = 100;
  const deviations: TacticalDeviation[] = [];

  // 1. Position Adherence (30% weight)
  const positionScore = calculatePositionAdherence(
    data.currentMetrics.position,
    instruction,
    gameModel.formation,
    gamePhase
  );
  score -= (100 - positionScore) * 0.3;

  // 2. Physical Output Adherence (25% weight)
  const physicalScore = calculatePhysicalAdherence(
    data.currentMetrics,
    data.cumulativeMetrics,
    instruction.physicalRequirements,
    matchMinute
  );
  score -= (100 - physicalScore) * 0.25;

  // 3. Movement Pattern Adherence (25% weight)
  const movementScore = calculateMovementAdherence(
    data.currentMetrics,
    twin.behaviorModel.movementPatterns,
    instruction.movementPatterns,
    gamePhase
  );
  score -= (100 - movementScore) * 0.25;

  // 4. Tactical Role Execution (20% weight)
  const roleScore = calculateRoleExecution(
    data,
    instruction,
    gamePhase
  );
  score -= (100 - roleScore) * 0.2;

  // Record significant deviations
  if (positionScore < 60) {
    deviations.push({
      id: `dev-pos-${Date.now()}`,
      timestamp: new Date(),
      minute: matchMinute,
      type: 'position',
      expected: `Within tactical zone for ${instruction.role}`,
      actual: `${data.currentMetrics.position.zone}`,
      severity: positionScore < 40 ? 'major' : 'moderate',
      context: gamePhase,
    });
  }

  if (physicalScore < 60) {
    deviations.push({
      id: `dev-phys-${Date.now()}`,
      timestamp: new Date(),
      minute: matchMinute,
      type: 'intensity',
      expected: `${instruction.physicalRequirements.expectedDistance.min}-${instruction.physicalRequirements.expectedDistance.max}m`,
      actual: `${Math.round(data.cumulativeMetrics.totalDistance)}m`,
      severity: physicalScore < 40 ? 'major' : 'moderate',
      context: 'physical_output',
    });
  }

  const recommendation = score < 50
    ? `Consider tactical adjustment for ${instruction.role} - significant deviation from game model`
    : score < 70
    ? `Monitor ${instruction.role} - some tactical drift detected`
    : 'Performing within tactical parameters';

  return {
    score: Math.max(0, Math.min(100, score)),
    deviations,
    recommendation,
  };
}

// ==================== Position Adherence ====================

function calculatePositionAdherence(
  currentPosition: TrackingMetrics['position'],
  instruction: PlayerInstruction,
  formation: GameModel['formation'],
  gamePhase: string
): number {
  // Find expected position from formation
  const expectedPos = formation.shape.positions.find(
    p => p.role === instruction.role
  );

  if (!expectedPos) return 85; // Default if no specific position defined

  // Calculate distance from expected position (normalized to pitch)
  const dx = (currentPosition.x / 52.5) * 50 - expectedPos.baseX;
  const dy = (currentPosition.y / 34) * 50 - expectedPos.baseY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Check if within movement range
  const withinRange =
    currentPosition.x >= (expectedPos.movementRange.minX / 100) * 105 - 52.5 &&
    currentPosition.x <= (expectedPos.movementRange.maxX / 100) * 105 - 52.5 &&
    currentPosition.y >= (expectedPos.movementRange.minY / 100) * 68 - 34 &&
    currentPosition.y <= (expectedPos.movementRange.maxY / 100) * 68 - 34;

  if (withinRange) {
    // Within allowed range - score based on proximity to base position
    return Math.max(70, 100 - distance);
  } else {
    // Outside range - larger penalty
    return Math.max(0, 70 - distance * 2);
  }
}

// ==================== Physical Adherence ====================

function calculatePhysicalAdherence(
  currentMetrics: TrackingMetrics,
  cumulativeMetrics: TrackingMetrics,
  requirements: PlayerInstruction['physicalRequirements'],
  matchMinute: number
): number {
  let score = 100;

  // Expected progress through the match
  const progressRatio = matchMinute / 90;

  // Distance check
  const expectedDistanceMin = requirements.expectedDistance.min * progressRatio;
  const expectedDistanceMax = requirements.expectedDistance.max * progressRatio;
  const actualDistance = cumulativeMetrics.totalDistance;

  if (actualDistance < expectedDistanceMin * 0.8) {
    score -= 30; // Significantly under-performing
  } else if (actualDistance < expectedDistanceMin) {
    score -= 15;
  } else if (actualDistance > expectedDistanceMax * 1.2) {
    score -= 10; // Over-exerting (fatigue risk)
  }

  // Sprint count check
  const expectedSprintsMin = requirements.expectedSprints.min * progressRatio;
  const actualSprints = cumulativeMetrics.accelerations.high;

  if (actualSprints < expectedSprintsMin * 0.6) {
    score -= 25;
  } else if (actualSprints < expectedSprintsMin * 0.8) {
    score -= 10;
  }

  // High intensity runs check
  const expectedHIRMin = requirements.expectedHighIntensityRuns.min * progressRatio;
  const actualHIR = (cumulativeMetrics.highSpeedRunningDistance / 20); // Approximate count

  if (actualHIR < expectedHIRMin * 0.6) {
    score -= 20;
  } else if (actualHIR < expectedHIRMin * 0.8) {
    score -= 10;
  }

  return Math.max(0, score);
}

// ==================== Movement Adherence ====================

function calculateMovementAdherence(
  metrics: TrackingMetrics,
  actualPatterns: { type: string; frequency: number }[],
  expectedPatterns: string[],
  gamePhase: string
): number {
  let score = 100;

  // Check if movement patterns match expected for the phase
  const phaseSpecificPatterns = getExpectedPatternsForPhase(gamePhase);

  for (const expected of expectedPatterns) {
    const actual = actualPatterns.find(p => p.type === expected);
    if (!actual || actual.frequency < 0.5) {
      score -= 15; // Missing expected movement pattern
    }
  }

  // Check speed profile matches tactical requirements
  const speedProfile = calculateSpeedProfile(metrics);

  if (gamePhase === 'pressing' && speedProfile.highIntensityRatio < 0.3) {
    score -= 20; // Not enough high intensity during pressing
  }

  if (gamePhase === 'defensive_block' && speedProfile.highIntensityRatio > 0.5) {
    score -= 10; // Too much running when should be holding position
  }

  return Math.max(0, score);
}

function getExpectedPatternsForPhase(phase: string): string[] {
  const patterns: Record<string, string[]> = {
    pressing: ['sprint', 'cover_shadow', 'press_trigger'],
    buildUp: ['positional_movement', 'support_run', 'dropping_movement'],
    progression: ['third_man_run', 'overlap', 'underlap'],
    finalThird: ['run_in_behind', 'movement_in_box', 'decoy_run'],
    defensiveBlock: ['shuffle', 'drop', 'compact'],
    attackingTransition: ['sprint', 'counter_movement', 'stretch'],
    defensiveTransition: ['recovery_run', 'counter_press', 'drop'],
  };

  return patterns[phase] || [];
}

function calculateSpeedProfile(metrics: TrackingMetrics): {
  highIntensityRatio: number;
  sprintRatio: number;
} {
  const totalTime =
    metrics.speedZones.zone1 +
    metrics.speedZones.zone2 +
    metrics.speedZones.zone3 +
    metrics.speedZones.zone4 +
    metrics.speedZones.zone5 +
    metrics.speedZones.zone6;

  const highIntensityTime =
    metrics.speedZones.zone4 +
    metrics.speedZones.zone5 +
    metrics.speedZones.zone6;

  const sprintTime = metrics.speedZones.zone5 + metrics.speedZones.zone6;

  return {
    highIntensityRatio: totalTime > 0 ? highIntensityTime / totalTime : 0,
    sprintRatio: totalTime > 0 ? sprintTime / totalTime : 0,
  };
}

// ==================== Role Execution ====================

function calculateRoleExecution(
  data: LivePlayerData,
  instruction: PlayerInstruction,
  gamePhase: string
): number {
  let score = 100;

  // Check if player is fulfilling their responsibilities
  // This would ideally integrate with event data (passes, tackles, etc.)
  // For now, use positional and movement data as proxy

  const position = data.currentMetrics.position;

  // Role-specific checks
  if (instruction.role.includes('CB') || instruction.role.includes('defender')) {
    // Defenders should be in defensive areas when not in possession
    if (gamePhase === 'defensiveBlock' && position.zone === 'attacking_third') {
      score -= 30;
    }
  }

  if (instruction.role.includes('ST') || instruction.role.includes('forward')) {
    // Strikers should be advanced when in possession
    if (gamePhase === 'finalThird' && position.zone === 'defensive_third') {
      score -= 25;
    }
  }

  // Check current work rate matches role demands
  const workRate = data.currentMetrics.distancePerMinute;
  if (workRate < 80) {
    score -= 15; // Low work rate
  }

  return Math.max(0, score);
}

// ==================== Phase Coherence ====================

function calculatePhaseCoherence(
  gameModel: GameModel,
  playerData: Map<string, LivePlayerData>,
  currentPhase: string,
  matchMinute: number
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  const phaseInstructions = (gameModel.phases as unknown as Record<string, { keyPoints: string[] }>)[currentPhase];

  if (!phaseInstructions) {
    return { score: 85, issues: ['Phase not defined in game model'] };
  }

  // Calculate team shape metrics
  const positions = Array.from(playerData.values()).map(p => ({
    x: p.currentMetrics.position.x,
    y: p.currentMetrics.position.y,
  }));

  const teamShape = calculateTeamShape(positions);

  // Check compactness against game model requirements
  const compactnessReq = gameModel.formation.compactness;

  if (teamShape.verticalSpread > compactnessReq.vertical.max) {
    score -= 15;
    issues.push('Team too stretched vertically');
  }

  if (teamShape.horizontalSpread > compactnessReq.horizontal.max) {
    score -= 15;
    issues.push('Team too wide');
  }

  if (teamShape.verticalSpread < compactnessReq.vertical.min) {
    score -= 10;
    issues.push('Team too compact vertically - no depth');
  }

  // Phase-specific checks
  if (currentPhase === 'pressing') {
    // Check if pressing triggers are being activated
    const avgHighIntensity = Array.from(playerData.values())
      .reduce((sum, p) => sum + p.currentMetrics.speedZones.zone4 + p.currentMetrics.speedZones.zone5, 0) /
      playerData.size;

    if (avgHighIntensity < 10) {
      score -= 20;
      issues.push('Pressing intensity too low');
    }
  }

  if (currentPhase === 'buildUp') {
    // Check if players are in appropriate positions for build-up
    const defendersInPosition = Array.from(playerData.entries())
      .filter(([id]) => gameModel.playerInstructions.get(id)?.role.includes('CB'))
      .every(([, data]) => data.currentMetrics.position.zone === 'defensive_third');

    if (!defendersInPosition) {
      score -= 10;
      issues.push('Defenders not in build-up positions');
    }
  }

  return { score: Math.max(0, score), issues };
}

function calculateTeamShape(positions: { x: number; y: number }[]): {
  verticalSpread: number;
  horizontalSpread: number;
  centroid: { x: number; y: number };
} {
  if (positions.length === 0) {
    return { verticalSpread: 0, horizontalSpread: 0, centroid: { x: 0, y: 0 } };
  }

  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);

  return {
    verticalSpread: Math.max(...xs) - Math.min(...xs),
    horizontalSpread: Math.max(...ys) - Math.min(...ys),
    centroid: {
      x: xs.reduce((a, b) => a + b, 0) / xs.length,
      y: ys.reduce((a, b) => a + b, 0) / ys.length,
    },
  };
}

// ==================== Principle Adherence ====================

function calculatePrincipleAdherence(
  gameModel: GameModel,
  playerData: Map<string, LivePlayerData>,
  gamePhase: string
): Map<string, number> {
  const scores = new Map<string, number>();

  // In-possession principles
  for (const principle of gameModel.principles.inPossession) {
    const adherence = evaluatePrincipleAdherence(principle, playerData, gameModel);
    scores.set(principle.name, adherence);
  }

  // Out-of-possession principles
  for (const principle of gameModel.principles.outOfPossession) {
    const adherence = evaluateDefensivePrinciple(principle, playerData, gameModel);
    scores.set(principle.name, adherence);
  }

  // Transition principles
  for (const principle of gameModel.principles.transitions) {
    const adherence = evaluateTransitionPrinciple(principle, playerData, gameModel);
    scores.set(principle.name, adherence);
  }

  return scores;
}

function evaluatePrincipleAdherence(
  principle: GameModel['principles']['inPossession'][0],
  playerData: Map<string, LivePlayerData>,
  gameModel: GameModel
): number {
  let score = 100;

  for (const behavior of principle.expectedBehaviors) {
    if (behavior.playerId) {
      const data = playerData.get(behavior.playerId);
      if (!data) continue;

      // Check if player meets expected metrics
      if (behavior.metrics.expectedSpeed) {
        const speed = data.currentMetrics.currentSpeed;
        if (speed < behavior.metrics.expectedSpeed.min || speed > behavior.metrics.expectedSpeed.max) {
          score -= 10;
        }
      }

      if (behavior.metrics.expectedPosition) {
        const pos = data.currentMetrics.position;
        const distance = Math.sqrt(
          Math.pow(pos.x - behavior.metrics.expectedPosition.x, 2) +
          Math.pow(pos.y - behavior.metrics.expectedPosition.y, 2)
        );
        if (distance > (behavior.metrics.expectedPosition.tolerance || 10)) {
          score -= 15;
        }
      }
    }
  }

  return Math.max(0, score);
}

function evaluateDefensivePrinciple(
  principle: GameModel['principles']['outOfPossession'][0],
  playerData: Map<string, LivePlayerData>,
  gameModel: GameModel
): number {
  let score = 100;

  // Check pressure type adherence
  if (principle.pressureType === 'high') {
    const avgPosition = calculateTeamShape(
      Array.from(playerData.values()).map(p => p.currentMetrics.position)
    ).centroid;

    if (avgPosition.x < 20) { // Team not high enough
      score -= 25;
    }
  }

  for (const behavior of principle.expectedBehaviors) {
    if (behavior.metrics.expectedDistance) {
      // Check players are covering expected distances
    }
  }

  return Math.max(0, score);
}

function evaluateTransitionPrinciple(
  principle: GameModel['principles']['transitions'][0],
  playerData: Map<string, LivePlayerData>,
  gameModel: GameModel
): number {
  // Transition evaluation would require event data to detect transitions
  // For now, return baseline score
  return 85;
}

// ==================== Recommendations ====================

function generateRecommendations(
  gameModel: GameModel,
  playerData: Map<string, LivePlayerData>,
  criticalDeviations: CriticalDeviation[],
  matchMinute: number
): string[] {
  const recommendations: string[] = [];

  // Address critical deviations first
  for (const deviation of criticalDeviations) {
    recommendations.push(deviation.suggestedAction);
  }

  // Check for fatigue-based recommendations
  for (const [playerId, data] of playerData) {
    if (data.coherenceScore < 60 && matchMinute > 60) {
      const instruction = gameModel.playerInstructions.get(playerId);
      if (instruction) {
        recommendations.push(
          `Consider substitution for ${instruction.role} - coherence declining (${data.coherenceScore}%)`
        );
      }
    }
  }

  // Team-level recommendations
  const avgCoherence = Array.from(playerData.values())
    .reduce((sum, p) => sum + p.coherenceScore, 0) / playerData.size;

  if (avgCoherence < 70) {
    recommendations.push('Team coherence below threshold - consider tactical timeout or half-time adjustment');
  }

  // Remove duplicates and limit to top 5
  return [...new Set(recommendations)].slice(0, 5);
}

// ==================== Real-time Coherence Updates ====================

export function updateCoherenceInRealTime(
  previousReport: CoherenceReport,
  newPlayerData: Map<string, LivePlayerData>,
  deltaSeconds: number
): CoherenceReport {
  // Smooth the coherence scores using exponential moving average
  const alpha = Math.min(1, deltaSeconds / 30); // 30-second smoothing window

  const newByPlayer = new Map<string, number>();

  for (const [playerId, data] of newPlayerData) {
    const previousScore = previousReport.byPlayer.get(playerId) || data.coherenceScore;
    const smoothedScore = alpha * data.coherenceScore + (1 - alpha) * previousScore;
    newByPlayer.set(playerId, Math.round(smoothedScore));
  }

  const newOverall = Array.from(newByPlayer.values())
    .reduce((sum, score) => sum + score, 0) / newByPlayer.size;

  return {
    ...previousReport,
    overallScore: Math.round(newOverall),
    byPlayer: newByPlayer,
  };
}

// ==================== Coherence Alerts ====================

export function generateCoherenceAlerts(
  report: CoherenceReport,
  threshold: number = 60
): { playerId: string; message: string; severity: 'warning' | 'critical' }[] {
  const alerts: { playerId: string; message: string; severity: 'warning' | 'critical' }[] = [];

  for (const [playerId, score] of report.byPlayer) {
    if (score < threshold * 0.7) {
      alerts.push({
        playerId,
        message: `Critical tactical deviation (${score}%)`,
        severity: 'critical',
      });
    } else if (score < threshold) {
      alerts.push({
        playerId,
        message: `Tactical compliance below threshold (${score}%)`,
        severity: 'warning',
      });
    }
  }

  return alerts;
}
