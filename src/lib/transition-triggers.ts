// Transition Trigger System - Real-time Detection and Visualization
// Tailored for Carlos Corberán's emphasis on immediate transitions

import type { TrackingMetrics, Player } from '@/types';
import type { CoachPersona, TacticalProfile } from './coach-persona';

// ==================== Transition Trigger Types ====================

export interface TransitionTrigger {
  id: string;
  type: 'possession_won' | 'possession_lost' | 'pressing_opportunity' | 'counter_attack';
  timestamp: number;
  minute: number;
  position: { x: number; y: number };
  zone: 'defensive_third' | 'middle_third' | 'attacking_third';
  intensity: 'low' | 'medium' | 'high' | 'critical';
  involvedPlayers: string[];
  suggestedAction: string;
  expectedResponse: ExpectedResponse;
  deadline: number; // seconds to respond
  active: boolean;
  responded: boolean;
  responseTime?: number;
  success?: boolean;
}

export interface ExpectedResponse {
  primaryAction: string;
  secondaryAction: string;
  playerRoles: {
    playerId: string;
    role: string;
    expectedPosition?: { x: number; y: number };
    expectedSpeed?: { min: number; max: number };
  }[];
  formationAdjustment?: string;
}

export interface TransitionMetrics {
  averageResponseTime: number;
  successRate: number;
  triggersDetected: number;
  triggersResponded: number;
  triggersMissed: number;
  counterPressSuccess: number;
  counterAttackSuccess: number;
  byZone: {
    defensive: { triggers: number; successRate: number };
    middle: { triggers: number; successRate: number };
    attacking: { triggers: number; successRate: number };
  };
}

export interface DoublePivotStatus {
  player1: {
    id: string;
    name: string;
    position: { x: number; y: number };
    isAvailable: boolean;
    passingLanesClear: number;
    distanceFromBall: number;
  };
  player2: {
    id: string;
    name: string;
    position: { x: number; y: number };
    isAvailable: boolean;
    passingLanesClear: number;
    distanceFromBall: number;
  };
  formationShape: 'split' | 'stacked' | 'compact' | 'stretched';
  spacing: 'optimal' | 'too_close' | 'too_far';
  transitionReadiness: number; // 0-100
  suggestedReceiver: string;
}

// ==================== Transition Trigger Engine ====================

export class TransitionTriggerEngine {
  private activeTriggers: Map<string, TransitionTrigger> = new Map();
  private triggerHistory: TransitionTrigger[] = [];
  private metrics: TransitionMetrics = this.initializeMetrics();
  private persona: CoachPersona | null = null;
  private doublePivotPlayerIds: string[] = [];

  constructor(persona?: CoachPersona) {
    if (persona) {
      this.persona = persona;
    }
  }

  setPersona(persona: CoachPersona): void {
    this.persona = persona;
  }

  setDoublePivotPlayers(player1Id: string, player2Id: string): void {
    this.doublePivotPlayerIds = [player1Id, player2Id];
  }

  private initializeMetrics(): TransitionMetrics {
    return {
      averageResponseTime: 0,
      successRate: 0,
      triggersDetected: 0,
      triggersResponded: 0,
      triggersMissed: 0,
      counterPressSuccess: 0,
      counterAttackSuccess: 0,
      byZone: {
        defensive: { triggers: 0, successRate: 0 },
        middle: { triggers: 0, successRate: 0 },
        attacking: { triggers: 0, successRate: 0 },
      },
    };
  }

  // ==================== Trigger Detection ====================

  detectTriggers(
    homePositions: { playerId: string; x: number; y: number; metrics?: TrackingMetrics }[],
    awayPositions: { playerId: string; x: number; y: number; metrics?: TrackingMetrics }[],
    ballPosition: { x: number; y: number },
    previousBallPosition: { x: number; y: number },
    possession: 'home' | 'away',
    previousPossession: 'home' | 'away',
    minute: number
  ): TransitionTrigger[] {
    const newTriggers: TransitionTrigger[] = [];

    // Detect possession change
    if (possession !== previousPossession) {
      if (possession === 'home') {
        // We won the ball
        const trigger = this.createPossessionWonTrigger(
          ballPosition,
          homePositions,
          minute
        );
        newTriggers.push(trigger);
        this.activeTriggers.set(trigger.id, trigger);
      } else {
        // We lost the ball
        const trigger = this.createPossessionLostTrigger(
          ballPosition,
          homePositions,
          minute
        );
        newTriggers.push(trigger);
        this.activeTriggers.set(trigger.id, trigger);
      }
    }

    // Detect pressing opportunities (even without possession change)
    if (possession === 'away') {
      const pressingTrigger = this.detectPressingOpportunity(
        homePositions,
        awayPositions,
        ballPosition,
        previousBallPosition,
        minute
      );
      if (pressingTrigger) {
        newTriggers.push(pressingTrigger);
        this.activeTriggers.set(pressingTrigger.id, pressingTrigger);
      }
    }

    // Update metrics
    this.metrics.triggersDetected += newTriggers.length;

    // Expire old triggers
    this.expireOldTriggers(minute);

    return newTriggers;
  }

  private createPossessionWonTrigger(
    ballPosition: { x: number; y: number },
    homePositions: { playerId: string; x: number; y: number; metrics?: TrackingMetrics }[],
    minute: number
  ): TransitionTrigger {
    const zone = this.getZone(ballPosition.x);
    const recoveryTarget = this.persona?.tacticalProfile.pressingStyle.recoveryTarget || 5;

    // Find nearest players to ball
    const sortedByDistance = [...homePositions].sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.x - ballPosition.x, 2) + Math.pow(a.y - ballPosition.y, 2));
      const distB = Math.sqrt(Math.pow(b.x - ballPosition.x, 2) + Math.pow(b.y - ballPosition.y, 2));
      return distA - distB;
    });

    const nearestPlayers = sortedByDistance.slice(0, 3).map(p => p.playerId);

    // Determine suggested action based on zone
    let suggestedAction: string;
    let primaryAction: string;
    let secondaryAction: string;

    if (zone === 'attacking_third') {
      suggestedAction = 'SHOOT OR PLAY FINAL BALL';
      primaryAction = 'Immediate shot or through ball';
      secondaryAction = 'Quick combination play';
    } else if (zone === 'middle_third') {
      suggestedAction = 'VERTICAL PASS FORWARD';
      primaryAction = 'Play forward to runners';
      secondaryAction = 'Find double pivot to switch';
    } else {
      suggestedAction = 'FIND DOUBLE PIVOT';
      primaryAction = 'Play into double pivot';
      secondaryAction = 'Carry forward if space';
    }

    return {
      id: `trigger-pw-${Date.now()}`,
      type: 'possession_won',
      timestamp: Date.now(),
      minute,
      position: ballPosition,
      zone,
      intensity: zone === 'attacking_third' ? 'critical' : 'high',
      involvedPlayers: nearestPlayers,
      suggestedAction,
      expectedResponse: {
        primaryAction,
        secondaryAction,
        playerRoles: this.getExpectedRolesForTransition(homePositions, ballPosition, 'attacking'),
      },
      deadline: zone === 'attacking_third' ? 3 : 5,
      active: true,
      responded: false,
    };
  }

  private createPossessionLostTrigger(
    ballPosition: { x: number; y: number },
    homePositions: { playerId: string; x: number; y: number; metrics?: TrackingMetrics }[],
    minute: number
  ): TransitionTrigger {
    const zone = this.getZone(ballPosition.x);
    const counterPressIntensity = this.persona?.tacticalProfile.counterPressIntensity || 80;

    // Find nearest players for counter-press
    const sortedByDistance = [...homePositions].sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.x - ballPosition.x, 2) + Math.pow(a.y - ballPosition.y, 2));
      const distB = Math.sqrt(Math.pow(b.x - ballPosition.x, 2) + Math.pow(b.y - ballPosition.y, 2));
      return distA - distB;
    });

    const counterPressPlayers = sortedByDistance.slice(0, 3).map(p => p.playerId);

    return {
      id: `trigger-pl-${Date.now()}`,
      type: 'possession_lost',
      timestamp: Date.now(),
      minute,
      position: ballPosition,
      zone,
      intensity: counterPressIntensity > 80 ? 'critical' : 'high',
      involvedPlayers: counterPressPlayers,
      suggestedAction: 'COUNTER-PRESS NOW',
      expectedResponse: {
        primaryAction: 'Nearest 3 players sprint to ball',
        secondaryAction: 'Others recover to shape',
        playerRoles: counterPressPlayers.map(playerId => ({
          playerId,
          role: 'counter-press',
          expectedSpeed: { min: 22, max: 30 },
        })),
      },
      deadline: 5,
      active: true,
      responded: false,
    };
  }

  private detectPressingOpportunity(
    homePositions: { playerId: string; x: number; y: number; metrics?: TrackingMetrics }[],
    awayPositions: { playerId: string; x: number; y: number; metrics?: TrackingMetrics }[],
    ballPosition: { x: number; y: number },
    previousBallPosition: { x: number; y: number },
    minute: number
  ): TransitionTrigger | null {
    const pressTriggers = this.persona?.tacticalProfile.pressingStyle.primaryTriggers || [];

    // Check for backward pass
    const ballMovedBackward = ballPosition.x > previousBallPosition.x + 3;
    if (ballMovedBackward && pressTriggers.includes('Backward pass')) {
      return this.createPressingTrigger(
        ballPosition,
        homePositions,
        minute,
        'BACKWARD PASS - PRESS NOW',
        'Press triggered by backward pass'
      );
    }

    // Check for ball wide
    const ballIsWide = ballPosition.y < 20 || ballPosition.y > 80;
    if (ballIsWide && pressTriggers.includes('Ball into wide area')) {
      return this.createPressingTrigger(
        ballPosition,
        homePositions,
        minute,
        'TOUCHLINE TRAP',
        'Trap against touchline'
      );
    }

    // Check for GK distribution
    const ballNearGK = ballPosition.x > 90;
    if (ballNearGK && pressTriggers.includes('Goalkeeper distribution')) {
      return this.createPressingTrigger(
        ballPosition,
        homePositions,
        minute,
        'PRESS GK DISTRIBUTION',
        'Press the goalkeeper distribution'
      );
    }

    return null;
  }

  private createPressingTrigger(
    ballPosition: { x: number; y: number },
    homePositions: { playerId: string; x: number; y: number; metrics?: TrackingMetrics }[],
    minute: number,
    suggestedAction: string,
    primaryAction: string
  ): TransitionTrigger {
    const zone = this.getZone(ballPosition.x);

    const sortedByDistance = [...homePositions].sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.x - ballPosition.x, 2) + Math.pow(a.y - ballPosition.y, 2));
      const distB = Math.sqrt(Math.pow(b.x - ballPosition.x, 2) + Math.pow(b.y - ballPosition.y, 2));
      return distA - distB;
    });

    return {
      id: `trigger-po-${Date.now()}`,
      type: 'pressing_opportunity',
      timestamp: Date.now(),
      minute,
      position: ballPosition,
      zone,
      intensity: 'high',
      involvedPlayers: sortedByDistance.slice(0, 3).map(p => p.playerId),
      suggestedAction,
      expectedResponse: {
        primaryAction,
        secondaryAction: 'Cover shadows to block passing lanes',
        playerRoles: [],
      },
      deadline: 4,
      active: true,
      responded: false,
    };
  }

  private getExpectedRolesForTransition(
    homePositions: { playerId: string; x: number; y: number; metrics?: TrackingMetrics }[],
    ballPosition: { x: number; y: number },
    transitionType: 'attacking' | 'defensive'
  ): ExpectedResponse['playerRoles'] {
    const roles: ExpectedResponse['playerRoles'] = [];

    if (transitionType === 'attacking') {
      // Double pivot should offer option
      const pivots = homePositions.filter(p =>
        this.doublePivotPlayerIds.includes(p.playerId)
      );
      pivots.forEach(pivot => {
        roles.push({
          playerId: pivot.playerId,
          role: 'transition_hub',
          expectedPosition: { x: 40, y: 50 },
        });
      });

      // Forwards should run in behind
      const attackers = homePositions.filter(p => p.x > 50);
      attackers.forEach(attacker => {
        roles.push({
          playerId: attacker.playerId,
          role: 'run_in_behind',
          expectedSpeed: { min: 24, max: 32 },
        });
      });
    }

    return roles;
  }

  private getZone(x: number): 'defensive_third' | 'middle_third' | 'attacking_third' {
    if (x < 33) return 'defensive_third';
    if (x > 67) return 'attacking_third';
    return 'middle_third';
  }

  private expireOldTriggers(currentMinute: number): void {
    const now = Date.now();

    for (const [id, trigger] of this.activeTriggers) {
      const age = (now - trigger.timestamp) / 1000;

      if (age > trigger.deadline) {
        trigger.active = false;

        if (!trigger.responded) {
          this.metrics.triggersMissed++;
        }

        this.triggerHistory.push(trigger);
        this.activeTriggers.delete(id);
      }
    }
  }

  // ==================== Double Pivot Analysis ====================

  analyzeDoublePivot(
    homePositions: { playerId: string; x: number; y: number; metrics?: TrackingMetrics }[],
    ballPosition: { x: number; y: number },
    players: Player[]
  ): DoublePivotStatus | null {
    if (this.doublePivotPlayerIds.length !== 2) return null;

    const pivot1Pos = homePositions.find(p => p.playerId === this.doublePivotPlayerIds[0]);
    const pivot2Pos = homePositions.find(p => p.playerId === this.doublePivotPlayerIds[1]);

    if (!pivot1Pos || !pivot2Pos) return null;

    const pivot1 = players.find(p => p.id === this.doublePivotPlayerIds[0]);
    const pivot2 = players.find(p => p.id === this.doublePivotPlayerIds[1]);

    if (!pivot1 || !pivot2) return null;

    // Calculate distances from ball
    const dist1 = Math.sqrt(Math.pow(pivot1Pos.x - ballPosition.x, 2) + Math.pow(pivot1Pos.y - ballPosition.y, 2));
    const dist2 = Math.sqrt(Math.pow(pivot2Pos.x - ballPosition.x, 2) + Math.pow(pivot2Pos.y - ballPosition.y, 2));

    // Analyze shape
    const pivotSpread = Math.abs(pivot1Pos.y - pivot2Pos.y);
    const pivotDepth = Math.abs(pivot1Pos.x - pivot2Pos.x);

    let formationShape: DoublePivotStatus['formationShape'];
    if (pivotSpread > 25 && pivotDepth < 10) {
      formationShape = 'split';
    } else if (pivotSpread < 15 && pivotDepth > 10) {
      formationShape = 'stacked';
    } else if (pivotSpread < 15 && pivotDepth < 10) {
      formationShape = 'compact';
    } else {
      formationShape = 'stretched';
    }

    // Calculate availability (not marked, has space)
    const isAvailable1 = dist1 < 30 && dist1 > 8;
    const isAvailable2 = dist2 < 30 && dist2 > 8;

    // Transition readiness score
    let transitionReadiness = 50;
    if (formationShape === 'split') transitionReadiness += 25; // Optimal for transitions
    if (isAvailable1 || isAvailable2) transitionReadiness += 15;
    if (dist1 < 20 || dist2 < 20) transitionReadiness += 10;

    // Suggest who should receive
    const suggestedReceiver = dist1 < dist2 && isAvailable1 ? pivot1.name :
                             dist2 < dist1 && isAvailable2 ? pivot2.name :
                             isAvailable1 ? pivot1.name : pivot2.name;

    // Calculate spacing status
    let spacing: DoublePivotStatus['spacing'];
    if (pivotSpread < 10) {
      spacing = 'too_close';
    } else if (pivotSpread > 30) {
      spacing = 'too_far';
    } else {
      spacing = 'optimal';
    }

    return {
      player1: {
        id: pivot1.id,
        name: pivot1.name,
        position: { x: pivot1Pos.x, y: pivot1Pos.y },
        isAvailable: isAvailable1,
        passingLanesClear: isAvailable1 ? 2 : 0, // Simplified
        distanceFromBall: dist1,
      },
      player2: {
        id: pivot2.id,
        name: pivot2.name,
        position: { x: pivot2Pos.x, y: pivot2Pos.y },
        isAvailable: isAvailable2,
        passingLanesClear: isAvailable2 ? 2 : 0,
        distanceFromBall: dist2,
      },
      formationShape,
      spacing,
      transitionReadiness: Math.min(100, transitionReadiness),
      suggestedReceiver,
    };
  }

  // ==================== Trigger Response ====================

  respondToTrigger(triggerId: string, success: boolean, responseTime: number): void {
    const trigger = this.activeTriggers.get(triggerId);

    if (trigger) {
      trigger.responded = true;
      trigger.success = success;
      trigger.responseTime = responseTime;

      this.metrics.triggersResponded++;

      if (success) {
        if (trigger.type === 'possession_lost') {
          this.metrics.counterPressSuccess++;
        } else if (trigger.type === 'possession_won') {
          this.metrics.counterAttackSuccess++;
        }
      }

      // Update average response time
      const totalResponded = this.metrics.triggersResponded;
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * (totalResponded - 1) + responseTime) / totalResponded;

      // Update success rate
      const successes = this.triggerHistory.filter(t => t.success).length + (success ? 1 : 0);
      this.metrics.successRate = (successes / totalResponded) * 100;

      // Update zone stats
      const zoneKey = trigger.zone === 'defensive_third' ? 'defensive' :
                      trigger.zone === 'attacking_third' ? 'attacking' : 'middle';
      this.metrics.byZone[zoneKey].triggers++;
    }
  }

  // ==================== Getters ====================

  getActiveTriggers(): TransitionTrigger[] {
    return Array.from(this.activeTriggers.values());
  }

  getMostUrgentTrigger(): TransitionTrigger | null {
    const triggers = this.getActiveTriggers();
    if (triggers.length === 0) return null;

    return triggers.reduce((most, current) => {
      const mostAge = (Date.now() - most.timestamp) / 1000;
      const currentAge = (Date.now() - current.timestamp) / 1000;
      const mostUrgency = most.deadline - mostAge;
      const currentUrgency = current.deadline - currentAge;

      return currentUrgency < mostUrgency ? current : most;
    });
  }

  getTriggerHistory(): TransitionTrigger[] {
    return [...this.triggerHistory];
  }

  getMetrics(): TransitionMetrics {
    return { ...this.metrics };
  }

  // ==================== Visual Helper ====================

  getTriggerVisualization(trigger: TransitionTrigger): {
    color: string;
    pulseAnimation: boolean;
    icon: string;
    urgency: number; // 0-100
  } {
    const age = (Date.now() - trigger.timestamp) / 1000;
    const urgency = Math.max(0, Math.min(100, (1 - age / trigger.deadline) * 100));

    let color: string;
    let pulseAnimation: boolean;

    if (trigger.intensity === 'critical' || urgency < 30) {
      color = '#DC2626'; // Red
      pulseAnimation = true;
    } else if (trigger.intensity === 'high' || urgency < 60) {
      color = '#F59E0B'; // Orange/Amber
      pulseAnimation = true;
    } else {
      color = '#10B981'; // Green
      pulseAnimation = false;
    }

    const iconMap: Record<TransitionTrigger['type'], string> = {
      'possession_won': '⚡',
      'possession_lost': '🔄',
      'pressing_opportunity': '⬆️',
      'counter_attack': '🎯',
    };

    return {
      color,
      pulseAnimation,
      icon: iconMap[trigger.type] || '⚠️',
      urgency,
    };
  }
}

// ==================== Factory ====================

export function createTransitionEngine(persona?: CoachPersona): TransitionTriggerEngine {
  return new TransitionTriggerEngine(persona);
}

// ==================== Corberán-Specific Helpers ====================

export function getCorberanTransitionGuidance(
  trigger: TransitionTrigger,
  doublePivotStatus: DoublePivotStatus | null
): string {
  if (trigger.type === 'possession_won') {
    if (trigger.zone === 'attacking_third') {
      return 'SHOOT OR PLAY FINAL BALL - No time to waste!';
    }

    if (doublePivotStatus && doublePivotStatus.transitionReadiness > 70) {
      return `FIND ${doublePivotStatus.suggestedReceiver.toUpperCase()} - Pivot is open for transition`;
    }

    return 'VERTICAL PASS FORWARD - Look for runners in behind';
  }

  if (trigger.type === 'possession_lost') {
    return 'COUNTER-PRESS NOW - 5 seconds to win it back!';
  }

  if (trigger.type === 'pressing_opportunity') {
    return trigger.suggestedAction;
  }

  return 'TRANSITION - React immediately';
}

export function calculateReactionTime(
  trigger: TransitionTrigger,
  targetResponseTime: number = 5
): { actual: number; target: number; status: 'excellent' | 'good' | 'slow' | 'missed' } {
  if (!trigger.responseTime) {
    return { actual: 0, target: targetResponseTime, status: 'missed' };
  }

  const actual = trigger.responseTime;

  let status: 'excellent' | 'good' | 'slow' | 'missed';
  if (actual <= targetResponseTime * 0.6) {
    status = 'excellent';
  } else if (actual <= targetResponseTime) {
    status = 'good';
  } else {
    status = 'slow';
  }

  return { actual, target: targetResponseTime, status };
}
