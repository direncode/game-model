/**
 * BigDunc Insight Layer
 *
 * Converts raw KernelOutput into human-readable, actionable insights.
 * Designed for coaching staff: plain language, urgency indicators, recommendations.
 */

import { KernelOutput, DriftPrediction, PlayerCoherence, EntanglementPair } from './resonance-kernel';

export interface Insight {
  level: 'info' | 'warning' | 'critical';
  message: string;
  tick: number;
}

/** Generate all insights from a single kernel tick output. */
export function insightFromKernel(output: KernelOutput): Insight[] {
  const insights: Insight[] = [];

  insights.push(...harmonyInsights(output));
  insights.push(...driftInsights(output));
  insights.push(...coherenceInsights(output));
  insights.push(...entanglementInsights(output));

  return insights;
}

function harmonyInsights(output: KernelOutput): Insight[] {
  const h = output.harmony;
  if (h >= 0.85) {
    return [{ level: 'info', message: `Field harmony strong (${(h * 100).toFixed(0)}%) — team in resonance.`, tick: output.tick }];
  }
  if (h >= 0.6) {
    return [{ level: 'warning', message: `Field harmony drifting (${(h * 100).toFixed(0)}%) — monitor phase alignment.`, tick: output.tick }];
  }
  return [{ level: 'critical', message: `Field harmony critical (${(h * 100).toFixed(0)}%) — tactical shape collapsing.`, tick: output.tick }];
}

function driftInsights(output: KernelOutput): Insight[] {
  return output.drifts.map((d: DriftPrediction) => ({
    level: d.severity > 0.7 ? 'critical' as const : d.severity > 0.4 ? 'warning' as const : 'info' as const,
    message: `${d.description} — collapse in ~${d.timeToCollapse.toFixed(0)}s.`,
    tick: output.tick,
  }));
}

function coherenceInsights(output: KernelOutput): Insight[] {
  const insights: Insight[] = [];
  const players = Object.values(output.players) as PlayerCoherence[];

  const weak = players.filter(p => p.coherenceScore < 0.35);
  if (weak.length > 0) {
    const ids = weak.map(p => p.id).join(', ');
    insights.push({
      level: weak.length >= 3 ? 'critical' : 'warning',
      message: `Low coherence players: [${ids}] — losing tactical connection.`,
      tick: output.tick,
    });
  }

  const drifters = players.filter(p => p.phaseAlignment < 0.3);
  if (drifters.length > 0) {
    const ids = drifters.map(p => p.id).join(', ');
    insights.push({
      level: 'warning',
      message: `Phase-drifting players: [${ids}] — out of sync with team rhythm.`,
      tick: output.tick,
    });
  }

  return insights;
}

function entanglementInsights(output: KernelOutput): Insight[] {
  const insights: Insight[] = [];
  const strong = output.entanglements.filter((e: EntanglementPair) => e.correlation > 0.7);
  if (strong.length > 0) {
    const pairs = strong.map((e: EntanglementPair) => `${e.playerA}↔${e.playerB}`).join(', ');
    insights.push({
      level: 'info',
      message: `Strong entanglement pairs: ${pairs} — high phase-spatial lock.`,
      tick: output.tick,
    });
  }

  if (output.entanglements.length === 0) {
    insights.push({
      level: 'critical',
      message: 'No entangled pairs — team is fragmented, no phase correlation.',
      tick: output.tick,
    });
  }

  return insights;
}
