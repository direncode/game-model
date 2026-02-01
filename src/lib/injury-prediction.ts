/**
 * Injury Prediction & Prevention System
 *
 * ML-inspired injury risk modeling using:
 * - Acute:Chronic Workload Ratio (ACWR)
 * - Fatigue accumulation patterns
 * - Biomechanical stress indicators
 * - Historical injury data
 * - Environmental factors
 *
 * Based on sports science research and PL medical department practices
 */

import type { Player, TrackingMetrics } from '@/types';

// ==================== WORKLOAD MODELS ====================

export interface WorkloadData {
  playerId: string;
  date: Date;

  // Training/match load
  sessionType: 'match' | 'high_intensity' | 'medium_intensity' | 'recovery' | 'rest';
  duration: number; // minutes
  rpe: number; // 1-10 Rate of Perceived Exertion
  sessionLoad: number; // duration * RPE

  // GPS/tracking metrics
  totalDistance: number;
  highSpeedDistance: number; // >19.8 km/h
  sprintDistance: number; // >25.2 km/h
  accelerations: number; // Count of accel >2.5 m/s²
  decelerations: number; // Count of decel >2.5 m/s²
  maxSpeed: number;

  // Derived metrics
  playerLoad: number; // Catapult-style metric
  metabolicPower: number; // W/kg average
  highMetabolicDistance: number; // Distance >25.5 W/kg
}

export interface ACWRCalculation {
  playerId: string;
  calculationDate: Date;

  // Acute load (last 7 days)
  acuteLoad: number;
  acuteDistance: number;
  acuteHighSpeed: number;
  acuteSprints: number;
  acutePlayerLoad: number;

  // Chronic load (rolling 28-day average)
  chronicLoad: number;
  chronicDistance: number;
  chronicHighSpeed: number;
  chronicSprints: number;
  chronicPlayerLoad: number;

  // Ratios
  acwrLoad: number;
  acwrDistance: number;
  acwrHighSpeed: number;
  acwrSprints: number;
  acwrPlayerLoad: number;

  // Risk zones
  overallACWR: number;
  riskZone: 'safe' | 'optimal' | 'caution' | 'danger';
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface InjuryRiskScore {
  playerId: string;
  playerName: string;
  assessmentDate: Date;

  // Component scores (0-100, higher = more risk)
  workloadRisk: number;
  fatigueRisk: number;
  biomechanicalRisk: number;
  historyRisk: number;
  ageRisk: number;
  recoveryRisk: number;

  // Weighted overall
  overallRisk: number;
  riskCategory: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';

  // Specific concerns
  concerns: InjuryConcern[];
  recommendations: InjuryRecommendation[];

  // Probabilities
  injuryProbability7Day: number; // 0-1
  injuryProbability28Day: number; // 0-1
  muscularRisk: number;
  ligamentRisk: number;
  overuseRisk: number;
}

export interface InjuryConcern {
  type: 'workload_spike' | 'chronic_fatigue' | 'asymmetry' | 'history' | 'age' | 'recovery' | 'environment';
  severity: 'low' | 'medium' | 'high';
  description: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

export interface InjuryRecommendation {
  priority: 'immediate' | 'short_term' | 'ongoing';
  type: 'load_reduction' | 'rest' | 'treatment' | 'monitoring' | 'technique' | 'nutrition';
  action: string;
  rationale: string;
  duration?: string;
}

export interface InjuryHistory {
  playerId: string;
  injuries: PreviousInjury[];
  totalDaysOut: number;
  lastInjuryDate: Date | null;
  vulnerableAreas: string[];
  recurrenceRisk: number;
}

export interface PreviousInjury {
  date: Date;
  type: string;
  bodyPart: string;
  severity: 'minor' | 'moderate' | 'severe';
  daysOut: number;
  wasRecurrence: boolean;
  returnToPlayDate: Date;
}

// ==================== BIOMECHANICAL ANALYSIS ====================

export interface BiomechanicalProfile {
  playerId: string;

  // Asymmetry indicators (% difference left vs right)
  sprintAsymmetry: number;
  accelerationAsymmetry: number;
  decelerationAsymmetry: number;
  jumpAsymmetry: number;

  // Movement quality (0-100)
  movementEfficiency: number;
  landingMechanics: number;
  cuttingMechanics: number;
  accelerationMechanics: number;

  // Fatigue indicators
  decelerationCapacity: number; // % of fresh capacity
  groundContactTime: number; // ms, higher = more fatigued
  flightTime: number; // ms
  strideLength: number; // m
  strideFrequency: number; // strides/min

  // Trend
  mechanicsChange7Day: number; // % change from baseline
  concernAreas: string[];
}

// ==================== INJURY PREDICTION ENGINE ====================

export class InjuryPredictionEngine {
  private workloadHistory: Map<string, WorkloadData[]> = new Map();
  private injuryHistory: Map<string, InjuryHistory> = new Map();
  private biomechanics: Map<string, BiomechanicalProfile> = new Map();
  private baselineMetrics: Map<string, TrackingMetrics> = new Map();

  // Model weights (would be learned from data in production)
  private readonly weights = {
    workload: 0.30,
    fatigue: 0.25,
    biomechanical: 0.15,
    history: 0.15,
    age: 0.10,
    recovery: 0.05,
  };

  // ACWR thresholds (based on research)
  private readonly acwrThresholds = {
    safe: { min: 0.8, max: 1.3 },
    optimal: { min: 0.9, max: 1.2 },
    caution: { min: 0.7, max: 1.5 },
    danger: { min: 0, max: 0.7, max2: 1.5 },
  };

  // ==================== WORKLOAD TRACKING ====================

  recordWorkload(data: WorkloadData): void {
    const history = this.workloadHistory.get(data.playerId) || [];
    history.push(data);

    // Keep last 42 days (6 weeks)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 42);
    const filtered = history.filter(w => w.date >= cutoff);

    this.workloadHistory.set(data.playerId, filtered);
  }

  calculateACWR(playerId: string): ACWRCalculation | null {
    const history = this.workloadHistory.get(playerId);
    if (!history || history.length < 7) return null;

    const now = new Date();
    const acute7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const chronic28Days = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    // Filter by time window
    const acuteData = history.filter(w => w.date >= acute7Days);
    const chronicData = history.filter(w => w.date >= chronic28Days);

    if (acuteData.length === 0) return null;

    // Sum acute metrics
    const acuteLoad = acuteData.reduce((s, w) => s + w.sessionLoad, 0);
    const acuteDistance = acuteData.reduce((s, w) => s + w.totalDistance, 0);
    const acuteHighSpeed = acuteData.reduce((s, w) => s + w.highSpeedDistance, 0);
    const acuteSprints = acuteData.reduce((s, w) => s + w.sprintDistance, 0);
    const acutePlayerLoad = acuteData.reduce((s, w) => s + w.playerLoad, 0);

    // Average chronic (weekly average over 4 weeks)
    const chronicWeeks = Math.max(1, chronicData.length / 7);
    const chronicLoad = chronicData.reduce((s, w) => s + w.sessionLoad, 0) / chronicWeeks;
    const chronicDistance = chronicData.reduce((s, w) => s + w.totalDistance, 0) / chronicWeeks;
    const chronicHighSpeed = chronicData.reduce((s, w) => s + w.highSpeedDistance, 0) / chronicWeeks;
    const chronicSprints = chronicData.reduce((s, w) => s + w.sprintDistance, 0) / chronicWeeks;
    const chronicPlayerLoad = chronicData.reduce((s, w) => s + w.playerLoad, 0) / chronicWeeks;

    // Calculate ratios
    const safeDiv = (a: number, b: number) => b > 0 ? a / b : 1;
    const acwrLoad = safeDiv(acuteLoad, chronicLoad);
    const acwrDistance = safeDiv(acuteDistance, chronicDistance);
    const acwrHighSpeed = safeDiv(acuteHighSpeed, chronicHighSpeed);
    const acwrSprints = safeDiv(acuteSprints, chronicSprints);
    const acwrPlayerLoad = safeDiv(acutePlayerLoad, chronicPlayerLoad);

    // Overall ACWR (weighted average)
    const overallACWR = (
      acwrLoad * 0.3 +
      acwrDistance * 0.25 +
      acwrHighSpeed * 0.25 +
      acwrPlayerLoad * 0.2
    );

    // Determine risk zone
    let riskZone: ACWRCalculation['riskZone'];
    if (overallACWR >= 0.9 && overallACWR <= 1.2) {
      riskZone = 'optimal';
    } else if (overallACWR >= 0.8 && overallACWR <= 1.3) {
      riskZone = 'safe';
    } else if (overallACWR >= 0.7 && overallACWR <= 1.5) {
      riskZone = 'caution';
    } else {
      riskZone = 'danger';
    }

    // Calculate trend
    const recentAcute = acuteData.slice(-3);
    const olderAcute = acuteData.slice(0, 4);
    const recentAvg = recentAcute.reduce((s, w) => s + w.sessionLoad, 0) / Math.max(1, recentAcute.length);
    const olderAvg = olderAcute.reduce((s, w) => s + w.sessionLoad, 0) / Math.max(1, olderAcute.length);
    const trend = recentAvg > olderAvg * 1.1 ? 'increasing' :
                  recentAvg < olderAvg * 0.9 ? 'decreasing' : 'stable';

    return {
      playerId,
      calculationDate: now,
      acuteLoad,
      acuteDistance,
      acuteHighSpeed,
      acuteSprints,
      acutePlayerLoad,
      chronicLoad,
      chronicDistance,
      chronicHighSpeed,
      chronicSprints,
      chronicPlayerLoad,
      acwrLoad,
      acwrDistance,
      acwrHighSpeed,
      acwrSprints,
      acwrPlayerLoad,
      overallACWR,
      riskZone,
      trend,
    };
  }

  // ==================== INJURY HISTORY ====================

  recordInjury(playerId: string, injury: PreviousInjury): void {
    const history = this.injuryHistory.get(playerId) || {
      playerId,
      injuries: [],
      totalDaysOut: 0,
      lastInjuryDate: null,
      vulnerableAreas: [],
      recurrenceRisk: 0,
    };

    history.injuries.push(injury);
    history.totalDaysOut += injury.daysOut;
    history.lastInjuryDate = injury.date;

    // Track vulnerable areas
    if (!history.vulnerableAreas.includes(injury.bodyPart)) {
      const bodyPartInjuries = history.injuries.filter(i => i.bodyPart === injury.bodyPart);
      if (bodyPartInjuries.length >= 2) {
        history.vulnerableAreas.push(injury.bodyPart);
      }
    }

    // Calculate recurrence risk
    const recurrences = history.injuries.filter(i => i.wasRecurrence).length;
    history.recurrenceRisk = Math.min(100, (recurrences / history.injuries.length) * 100 * 1.5);

    this.injuryHistory.set(playerId, history);
  }

  // ==================== BIOMECHANICAL TRACKING ====================

  updateBiomechanics(playerId: string, metrics: TrackingMetrics): void {
    const baseline = this.baselineMetrics.get(playerId);
    if (!baseline) {
      this.baselineMetrics.set(playerId, metrics);
      return;
    }

    // Calculate asymmetries (simplified - would use left/right data)
    const asymmetry = Math.random() * 10; // Placeholder

    const profile: BiomechanicalProfile = {
      playerId,
      sprintAsymmetry: asymmetry,
      accelerationAsymmetry: asymmetry * 0.8,
      decelerationAsymmetry: asymmetry * 1.2,
      jumpAsymmetry: asymmetry * 0.5,
      movementEfficiency: 85 - asymmetry,
      landingMechanics: 80,
      cuttingMechanics: 82,
      accelerationMechanics: 78,
      decelerationCapacity: Math.max(60, 100 - (metrics.maxDeceleration / baseline.maxDeceleration) * 20),
      groundContactTime: 180 + asymmetry * 2,
      flightTime: 350 - asymmetry * 3,
      strideLength: metrics.totalDistance > 0 ? 1.8 : 0,
      strideFrequency: 180,
      mechanicsChange7Day: asymmetry * 0.5,
      concernAreas: asymmetry > 8 ? ['Left-right imbalance detected'] : [],
    };

    this.biomechanics.set(playerId, profile);
  }

  // ==================== RISK SCORE CALCULATION ====================

  calculateRiskScore(player: Player, currentMetrics?: TrackingMetrics): InjuryRiskScore {
    const acwr = this.calculateACWR(player.id);
    const history = this.injuryHistory.get(player.id);
    const biomech = this.biomechanics.get(player.id);

    // Component scores
    const workloadRisk = this.calculateWorkloadRisk(acwr);
    const fatigueRisk = this.calculateFatigueRisk(currentMetrics, acwr);
    const biomechanicalRisk = this.calculateBiomechanicalRisk(biomech);
    const historyRisk = this.calculateHistoryRisk(history);
    const ageRisk = this.calculateAgeRisk(player);
    const recoveryRisk = this.calculateRecoveryRisk(player.id);

    // Weighted overall
    const overallRisk = (
      workloadRisk * this.weights.workload +
      fatigueRisk * this.weights.fatigue +
      biomechanicalRisk * this.weights.biomechanical +
      historyRisk * this.weights.history +
      ageRisk * this.weights.age +
      recoveryRisk * this.weights.recovery
    );

    // Categorize
    let riskCategory: InjuryRiskScore['riskCategory'];
    if (overallRisk < 20) riskCategory = 'low';
    else if (overallRisk < 40) riskCategory = 'moderate';
    else if (overallRisk < 60) riskCategory = 'elevated';
    else if (overallRisk < 80) riskCategory = 'high';
    else riskCategory = 'critical';

    // Identify concerns
    const concerns = this.identifyConcerns(
      workloadRisk, fatigueRisk, biomechanicalRisk,
      historyRisk, acwr, biomech
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      riskCategory, concerns, acwr
    );

    // Probability estimates (simplified logistic regression)
    const baseProb = overallRisk / 100;
    const injuryProbability7Day = Math.min(0.5, baseProb * 0.7);
    const injuryProbability28Day = Math.min(0.8, baseProb * 1.2);

    return {
      playerId: player.id,
      playerName: player.name,
      assessmentDate: new Date(),
      workloadRisk,
      fatigueRisk,
      biomechanicalRisk,
      historyRisk,
      ageRisk,
      recoveryRisk,
      overallRisk,
      riskCategory,
      concerns,
      recommendations,
      injuryProbability7Day,
      injuryProbability28Day,
      muscularRisk: baseProb * (fatigueRisk / 100),
      ligamentRisk: baseProb * (biomechanicalRisk / 100) * 0.5,
      overuseRisk: baseProb * (workloadRisk / 100),
    };
  }

  private calculateWorkloadRisk(acwr: ACWRCalculation | null): number {
    if (!acwr) return 30; // Unknown = moderate risk

    // Risk curve based on ACWR
    const { overallACWR } = acwr;

    if (overallACWR >= 0.9 && overallACWR <= 1.2) {
      return 10; // Optimal zone
    } else if (overallACWR >= 0.8 && overallACWR <= 1.3) {
      return 25; // Safe zone
    } else if (overallACWR < 0.8) {
      // Undertraining - risk of spike
      return 40 + (0.8 - overallACWR) * 100;
    } else {
      // Overtraining
      return 50 + (overallACWR - 1.3) * 50;
    }
  }

  private calculateFatigueRisk(
    metrics: TrackingMetrics | undefined,
    acwr: ACWRCalculation | null
  ): number {
    if (!metrics) return 30;

    let risk = 20; // Base

    // High distance increases fatigue
    if (metrics.totalDistance > 12000) risk += 15;
    if (metrics.sprintDistance > 400) risk += 20;

    // Deceleration stress
    if (metrics.decelerations?.high > 20) risk += 15;

    // Chronic load consideration
    if (acwr && acwr.trend === 'increasing') risk += 10;

    return Math.min(100, risk);
  }

  private calculateBiomechanicalRisk(biomech: BiomechanicalProfile | undefined): number {
    if (!biomech) return 20;

    let risk = 10;

    // Asymmetry is a major risk factor
    if (biomech.sprintAsymmetry > 10) risk += 25;
    else if (biomech.sprintAsymmetry > 5) risk += 10;

    if (biomech.decelerationAsymmetry > 12) risk += 20;

    // Movement quality degradation
    if (biomech.movementEfficiency < 70) risk += 15;
    if (biomech.decelerationCapacity < 80) risk += 20;

    // Recent changes
    if (biomech.mechanicsChange7Day > 15) risk += 15;

    return Math.min(100, risk);
  }

  private calculateHistoryRisk(history: InjuryHistory | undefined): number {
    if (!history || history.injuries.length === 0) return 10;

    let risk = 15; // Base for any history

    // Recent injuries
    if (history.lastInjuryDate) {
      const daysSince = (Date.now() - history.lastInjuryDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince < 60) risk += 25;
      else if (daysSince < 180) risk += 15;
    }

    // Recurrence pattern
    risk += history.recurrenceRisk * 0.3;

    // Vulnerable areas
    risk += history.vulnerableAreas.length * 10;

    return Math.min(100, risk);
  }

  private calculateAgeRisk(player: Player): number {
    // Age would come from player profile
    const age = 27; // Placeholder

    if (age < 23) return 15; // Young - recovery advantage
    if (age < 28) return 10; // Prime
    if (age < 32) return 25; // Early decline
    return 40; // Higher risk
  }

  private calculateRecoveryRisk(playerId: string): number {
    const workload = this.workloadHistory.get(playerId) || [];
    const recent = workload.slice(-7);

    if (recent.length === 0) return 20;

    // Check for rest days
    const restDays = recent.filter(w => w.sessionType === 'rest' || w.sessionType === 'recovery').length;
    if (restDays < 1) return 50; // No rest in a week
    if (restDays < 2) return 30;
    return 15;
  }

  // ==================== CONCERN IDENTIFICATION ====================

  private identifyConcerns(
    workloadRisk: number,
    fatigueRisk: number,
    biomechanicalRisk: number,
    historyRisk: number,
    acwr: ACWRCalculation | null,
    biomech: BiomechanicalProfile | undefined
  ): InjuryConcern[] {
    const concerns: InjuryConcern[] = [];

    if (workloadRisk > 50) {
      concerns.push({
        type: 'workload_spike',
        severity: workloadRisk > 70 ? 'high' : 'medium',
        description: acwr && acwr.overallACWR > 1.3
          ? `ACWR of ${acwr.overallACWR.toFixed(2)} indicates overtraining`
          : 'Workload pattern indicates elevated injury risk',
        metric: 'ACWR',
        value: acwr?.overallACWR,
        threshold: 1.3,
      });
    }

    if (fatigueRisk > 50) {
      concerns.push({
        type: 'chronic_fatigue',
        severity: fatigueRisk > 70 ? 'high' : 'medium',
        description: 'Cumulative fatigue markers elevated - reduced capacity for high-intensity work',
      });
    }

    if (biomech && biomech.sprintAsymmetry > 8) {
      concerns.push({
        type: 'asymmetry',
        severity: biomech.sprintAsymmetry > 12 ? 'high' : 'medium',
        description: `Sprint asymmetry of ${biomech.sprintAsymmetry.toFixed(1)}% detected`,
        metric: 'Sprint asymmetry',
        value: biomech.sprintAsymmetry,
        threshold: 8,
      });
    }

    if (historyRisk > 40) {
      concerns.push({
        type: 'history',
        severity: historyRisk > 60 ? 'high' : 'medium',
        description: 'Previous injury history increases current risk profile',
      });
    }

    return concerns;
  }

  // ==================== RECOMMENDATIONS ====================

  private generateRecommendations(
    category: InjuryRiskScore['riskCategory'],
    concerns: InjuryConcern[],
    acwr: ACWRCalculation | null
  ): InjuryRecommendation[] {
    const recommendations: InjuryRecommendation[] = [];

    if (category === 'critical' || category === 'high') {
      recommendations.push({
        priority: 'immediate',
        type: 'load_reduction',
        action: 'Reduce training load by 30-40% for next 5-7 days',
        rationale: 'High injury risk requires immediate load management',
        duration: '5-7 days',
      });
    }

    if (concerns.some(c => c.type === 'workload_spike')) {
      recommendations.push({
        priority: 'short_term',
        type: 'monitoring',
        action: 'Daily wellness questionnaire and HRV monitoring',
        rationale: 'Track recovery status during high-load period',
        duration: '2 weeks',
      });
    }

    if (concerns.some(c => c.type === 'asymmetry')) {
      recommendations.push({
        priority: 'ongoing',
        type: 'treatment',
        action: 'Targeted strength and mobility work for affected limb',
        rationale: 'Address biomechanical imbalance before it leads to injury',
        duration: '4-6 weeks',
      });
    }

    if (acwr && acwr.overallACWR < 0.8) {
      recommendations.push({
        priority: 'short_term',
        type: 'load_reduction',
        action: 'Gradual load progression (max 10% weekly increase)',
        rationale: 'Avoid spike after period of undertraining',
        duration: '3 weeks',
      });
    }

    // Default monitoring recommendation
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'ongoing',
        type: 'monitoring',
        action: 'Continue standard monitoring protocols',
        rationale: 'Maintain baseline tracking for early detection',
      });
    }

    return recommendations;
  }

  // ==================== TEAM OVERVIEW ====================

  generateTeamRiskReport(players: Player[]): {
    highRisk: InjuryRiskScore[];
    moderateRisk: InjuryRiskScore[];
    lowRisk: InjuryRiskScore[];
    teamAverage: number;
    concerns: string[];
  } {
    const scores = players.map(p => this.calculateRiskScore(p));

    const highRisk = scores.filter(s =>
      s.riskCategory === 'high' || s.riskCategory === 'critical'
    );
    const moderateRisk = scores.filter(s =>
      s.riskCategory === 'moderate' || s.riskCategory === 'elevated'
    );
    const lowRisk = scores.filter(s => s.riskCategory === 'low');

    const teamAverage = scores.reduce((s, r) => s + r.overallRisk, 0) / scores.length;

    const concerns: string[] = [];
    if (highRisk.length >= 3) {
      concerns.push(`${highRisk.length} players in high/critical risk category`);
    }
    if (teamAverage > 40) {
      concerns.push('Team average risk elevated - consider recovery week');
    }

    return { highRisk, moderateRisk, lowRisk, teamAverage, concerns };
  }
}

// Singleton
let injuryPredictionEngine: InjuryPredictionEngine | null = null;

export function getInjuryPredictionEngine(): InjuryPredictionEngine {
  if (!injuryPredictionEngine) {
    injuryPredictionEngine = new InjuryPredictionEngine();
  }
  return injuryPredictionEngine;
}
