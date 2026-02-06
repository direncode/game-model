'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ResonanceKernel,
  type KernelOutput,
  type PlayerPhase,
} from '@/lib/resonance-kernel';
import { AutonomousTwin } from '@/lib/autonomous-twin';
import { DataSubstrate } from '@/lib/catapult-data-substrate';
import { insightFromKernel, type Insight } from '@/lib/resonance-insight';
import {
  HoverCard,
  getNodeExplanation,
  getStatExplanation,
  type ComputationSection,
} from '@/components/computation-hover';
import { FieldConstructor, type FieldMutation, type ConstructionSnapshot } from '@/lib/field-constructor';
import { EventIngestionPipeline, type AbstractEvent, type EnrichedEvent } from '@/lib/event-ingestion';

// ─── Blueprint palette constants (used in SVG) ─────────────────────────
const BP = {
  black: '#111418',
  bg1: '#1C2127',
  bg2: '#252A31',
  bg3: '#2F343C',
  bg4: '#383E47',
  bg5: '#404854',
  text1: '#F6F7F9',
  text2: '#D3D8DE',
  text3: '#8F99A8',
  text4: '#5F6B7C',
  blue: '#2D72D2',
  blueL: '#4C90F0',
  blueM: '#8ABBFF',
  green: '#238551',
  greenL: '#32A467',
  greenM: '#72CA9B',
  orange: '#C87619',
  orangeL: '#EC9A3C',
  orangeM: '#FBB360',
  red: '#CD4246',
  redL: '#E76A6E',
  violet: '#7C3AED',
  teal: '#0D9488',
  rose: '#DB2777',
  cyan: '#06B6D4',
};

// ─── Formation setup ───────────────────────────────────────────────

interface PlayerSetup {
  id: string; x: number; y: number; state: PlayerPhase; load: number;
}

const FORMATION: PlayerSetup[] = [
  { id: 'GK',  x: 5,  y: 34, state: 'defending',  load: 30 },
  { id: 'LB',  x: 20, y: 10, state: 'defending',  load: 55 },
  { id: 'CB1', x: 18, y: 28, state: 'defending',  load: 50 },
  { id: 'CB2', x: 18, y: 40, state: 'defending',  load: 50 },
  { id: 'RB',  x: 20, y: 58, state: 'defending',  load: 55 },
  { id: 'CM1', x: 40, y: 22, state: 'building',   load: 65 },
  { id: 'CM2', x: 42, y: 34, state: 'building',   load: 70 },
  { id: 'CM3', x: 40, y: 46, state: 'building',   load: 65 },
  { id: 'LW',  x: 70, y: 12, state: 'attacking',  load: 75 },
  { id: 'ST',  x: 78, y: 34, state: 'attacking',  load: 80 },
  { id: 'RW',  x: 70, y: 56, state: 'attacking',  load: 75 },
];

// ─── Diagram layout ────────────────────────────────────────────────

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  sub?: string;
  group?: string;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

const W = 1400;
const H = 1020;

const NODES: Node[] = [
  // Layer 0 — Data Sources
  { id: 'catapult',    label: 'Catapult GPS/IMU',     x: 80,   y: 40,  w: 180, h: 52, color: BP.blueL, sub: 'speed, acc, load, HR', group: 'source' },
  { id: 'synthetic',   label: 'Synthetic Generator',   x: 80,   y: 120, w: 180, h: 52, color: BP.blueL, sub: '11 players × random', group: 'source' },

  // Layer 1 — Substrate
  { id: 'substrate',   label: 'DataSubstrate',         x: 380,  y: 80,  w: 200, h: 60, color: BP.violet, sub: 'ingestFrame() → normalize', group: 'substrate' },

  // Layer 2 — Kernel core
  { id: 'kernel',      label: 'ResonanceKernel',       x: 700,  y: 30,  w: 220, h: 50, color: BP.orangeL, sub: 'tick(Δt) — main loop', group: 'kernel' },

  // Kernel sub-steps
  { id: 'attractors',  label: '① Attractor Forces',    x: 520,  y: 150, w: 180, h: 48, color: BP.orangeL, sub: 'F = s·e^(-d/r) · dir', group: 'kernel' },
  { id: 'coulomb',     label: '② Coulomb Spacing',     x: 520,  y: 220, w: 180, h: 48, color: BP.orangeL, sub: 'F = k·q₁q₂/d²', group: 'kernel' },
  { id: 'fokker',      label: '③ Wave Evolution',      x: 520,  y: 290, w: 180, h: 48, color: BP.orangeL, sub: 'Fokker-Planck diffuse/drift', group: 'kernel' },
  { id: 'positions',   label: '④ Update Positions',    x: 520,  y: 360, w: 180, h: 48, color: BP.orangeL, sub: 'v → pos, boundary clamp', group: 'kernel' },

  // Wave details
  { id: 'waveamp',     label: 'Amplitude',             x: 760,  y: 150, w: 140, h: 40, color: BP.orangeM, sub: 'load → energy 0–1', group: 'wave' },
  { id: 'wavephase',   label: 'Phase',                 x: 760,  y: 210, w: 140, h: 40, color: BP.orangeM, sub: 'state → radians', group: 'wave' },
  { id: 'wavefreq',    label: 'Frequency',             x: 760,  y: 270, w: 140, h: 40, color: BP.orangeM, sub: 'speed → Hz rhythm', group: 'wave' },
  { id: 'wavelength',  label: 'Wavelength',            x: 760,  y: 330, w: 140, h: 40, color: BP.orangeM, sub: 'coverage meters', group: 'wave' },

  // Layer 3 — Outputs
  { id: 'harmony',     label: 'Field Harmony',         x: 1000, y: 40,  w: 170, h: 52, color: BP.greenL, sub: 'cos(Δφ) + entropy', group: 'output' },
  { id: 'coherence',   label: 'Player Coherence',      x: 1000, y: 115, w: 170, h: 52, color: BP.greenL, sub: '|ψ|² + phase align', group: 'output' },
  { id: 'entangle',    label: 'Entanglement Map',      x: 1000, y: 190, w: 170, h: 52, color: BP.greenL, sub: 'RBF × cos(Δφ) pairs', group: 'output' },
  { id: 'drifts',      label: 'Drift Detection',       x: 1000, y: 265, w: 170, h: 52, color: BP.redL, sub: '3–6s collapse warning', group: 'output' },
  { id: 'energy',      label: 'Field Energy',          x: 1000, y: 340, w: 170, h: 52, color: BP.greenL, sub: 'KE + wave²', group: 'output' },

  // Layer 4 — Twins
  { id: 'twins',       label: 'AutonomousTwin ×11',    x: 380,  y: 460, w: 210, h: 56, color: BP.rose, sub: 'evaluate → execute intent', group: 'agent' },
  { id: 'awareness',   label: 'Awareness Vector',      x: 120,  y: 460, w: 180, h: 50, color: BP.rose, sub: 'ball, space, threat, team', group: 'agent' },
  { id: 'intents',     label: 'Intent Scoring',        x: 120,  y: 540, w: 180, h: 50, color: BP.rose, sub: '6 intents ranked', group: 'agent' },

  // Layer 5 — Insights
  { id: 'insight',     label: 'Insight Layer',         x: 700,  y: 460, w: 200, h: 56, color: BP.violet, sub: 'insightFromKernel()', group: 'insight' },

  // Layer 6 — Monte Carlo
  { id: 'montecarlo',  label: 'Monte Carlo What-If',   x: 1000, y: 460, w: 190, h: 56, color: BP.cyan, sub: 'N scenarios × T ticks', group: 'mc' },

  // Superposition states
  { id: 'states',      label: 'Superposition States',  x: 380,  y: 580, w: 530, h: 44, color: BP.bg5, sub: 'defending | pressing | building | attacking | transitioning', group: 'meta' },

  // Pre-decision output
  { id: 'predecision', label: 'PRE-DECISION OUTPUT',   x: 380,  y: 660, w: 530, h: 54, color: BP.redL, sub: '"Harmony dropping in midfield — shift phase now"', group: 'output' },

  // Layer 7 — Event Pipeline
  { id: 'eventingest', label: 'Event Ingestion',       x: 80,   y: 760, w: 190, h: 52, color: BP.teal, sub: '"CB1 passed to CM2"', group: 'event' },
  { id: 'vectorenrich',label: 'Vector Enrichment',     x: 340,  y: 760, w: 200, h: 52, color: BP.teal, sub: 'coords, trajectory, velocity', group: 'event' },
  { id: 'fieldconst',  label: 'Field Constructor',     x: 620,  y: 760, w: 200, h: 52, color: BP.teal, sub: 'organic mutations → kernel', group: 'event' },
  { id: 'eventlog',    label: 'Mutation Log',          x: 900,  y: 760, w: 170, h: 52, color: BP.teal, sub: 'player_move, phase, ball', group: 'event' },
];

const EDGES: Edge[] = [
  { from: 'catapult',  to: 'substrate', label: 'raw frames' },
  { from: 'synthetic', to: 'substrate', label: 'sample data' },
  { from: 'substrate', to: 'kernel',    label: 'normalized {id,x,y,v,load,state}' },

  { from: 'kernel',    to: 'attractors' },
  { from: 'attractors',to: 'coulomb' },
  { from: 'coulomb',   to: 'fokker' },
  { from: 'fokker',    to: 'positions' },

  { from: 'fokker',    to: 'waveamp' },
  { from: 'fokker',    to: 'wavephase' },
  { from: 'fokker',    to: 'wavefreq' },
  { from: 'fokker',    to: 'wavelength' },

  { from: 'positions', to: 'harmony',   label: 'output' },
  { from: 'positions', to: 'coherence' },
  { from: 'positions', to: 'entangle' },
  { from: 'positions', to: 'drifts' },
  { from: 'positions', to: 'energy' },

  { from: 'harmony',   to: 'insight',   label: 'KernelOutput' },
  { from: 'drifts',    to: 'insight' },
  { from: 'coherence', to: 'twins',     label: 'kernelState', dashed: true },
  { from: 'twins',     to: 'kernel',    label: 'mutate v/φ', dashed: true },
  { from: 'awareness', to: 'twins' },
  { from: 'intents',   to: 'twins' },
  { from: 'substrate', to: 'awareness', label: 'sensor data', dashed: true },

  { from: 'insight',   to: 'predecision', label: 'actionable insights' },
  { from: 'montecarlo',to: 'predecision', label: 'avg/worst/best' },
  { from: 'harmony',   to: 'montecarlo',  dashed: true },
  { from: 'states',    to: 'twins',       dashed: true },
  { from: 'states',    to: 'predecision', dashed: true },

  // Event pipeline edges
  { from: 'eventingest',  to: 'vectorenrich', label: 'abstract events' },
  { from: 'vectorenrich', to: 'fieldconst',   label: 'enriched vectors' },
  { from: 'fieldconst',   to: 'kernel',       label: 'mutations', dashed: true },
  { from: 'fieldconst',   to: 'eventlog',     label: 'log' },
  { from: 'substrate',    to: 'vectorenrich', label: 'player state', dashed: true },
];

// ─── Helpers ───────────────────────────────────────────────────────

function getNodeCenter(n: Node): { cx: number; cy: number } {
  return { cx: n.x + n.w / 2, cy: n.y + n.h / 2 };
}

function edgePath(from: Node, to: Node): string {
  const a = getNodeCenter(from);
  const b = getNodeCenter(to);
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return '';
  const nx = dx / dist;
  const ny = dy / dist;
  const fx = a.cx + nx * (from.w / 2) * Math.min(1, Math.abs(nx) + 0.3);
  const fy = a.cy + ny * (from.h / 2) * Math.min(1, Math.abs(ny) + 0.3);
  const tx = b.cx - nx * (to.w / 2) * Math.min(1, Math.abs(nx) + 0.3);
  const ty = b.cy - ny * (to.h / 2) * Math.min(1, Math.abs(ny) + 0.3);
  const mx = (fx + tx) / 2;
  const my = (fy + ty) / 2;
  const off = Math.min(30, dist * 0.1);
  const cx = mx - ny * off;
  const cy = my + nx * off;
  return `M${fx},${fy} Q${cx},${cy} ${tx},${ty}`;
}

// Group label config
const GROUP_LABELS: { text: string; x: number; y: number }[] = [
  { text: 'DATA SOURCES', x: 80, y: 25 },
  { text: 'SUBSTRATE', x: 380, y: 68 },
  { text: 'KERNEL PIPELINE', x: 520, y: 140 },
  { text: 'WAVE FUNCTION', x: 760, y: 140 },
  { text: 'OUTPUTS', x: 1000, y: 28 },
  { text: 'AGENT SYSTEM', x: 120, y: 448 },
  { text: 'INSIGHT LAYER', x: 700, y: 448 },
  { text: 'EVENT PIPELINE', x: 80, y: 748 },
];

// ─── Component ─────────────────────────────────────────────────────

export default function BigDuncFlowDiagram() {
  const kernelRef = useRef<ResonanceKernel | null>(null);
  const twinsRef = useRef<Map<string, AutonomousTwin>>(new Map());
  const [output, setOutput] = useState<KernelOutput | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [mcResult, setMcResult] = useState<{ avgHarmony: number; worstCase: number; bestCase: number } | null>(null);
  const [twinIntents, setTwinIntents] = useState<Record<string, { intent: string; confidence: number }>>({});
  const [activeEdge, setActiveEdge] = useState<string | null>(null);
  const edgeTimerRef = useRef(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const fieldConstructorRef = useRef<FieldConstructor | null>(null);
  const [recentEvents, setRecentEvents] = useState<EnrichedEvent[]>([]);
  const [recentMutations, setRecentMutations] = useState<FieldMutation[]>([]);
  const [constructionState, setConstructionState] = useState<ConstructionSnapshot | null>(null);
  const sampleEventsRef = useRef<AbstractEvent[]>([]);
  const eventIndexRef = useRef(0);

  // Init engine
  useEffect(() => {
    const kernel = new ResonanceKernel();
    for (const p of FORMATION) kernel.addPlayer(p.id, p.x, p.y, p.state, p.load);
    kernel.addAttractor('ball', 52, 34, 15, 0.8);
    kernel.addAttractor('tactical', 35, 34, 25, 0.6);
    kernel.addAttractor('defensive', 18, 34, 20, 0.5);
    kernel.addAttractor('offensive', 75, 34, 18, 0.4);
    kernel.addAttractor('space', 60, 15, 12, 0.3);
    kernelRef.current = kernel;

    const twins = new Map<string, AutonomousTwin>();
    for (const p of FORMATION) twins.set(p.id, new AutonomousTwin(p.id));

    const substrate = new DataSubstrate();
    const frame = substrate.getSampleFrame();
    for (const np of frame.players) {
      const twin = twins.get(np.id);
      if (twin) {
        twin.updateAwareness({
          ballDist: Math.sqrt((np.x - 52) ** 2 + (np.y - 34) ** 2),
          nearestOpponentDist: 5 + Math.random() * 15,
          nearestTeammateDist: 3 + Math.random() * 10,
          openSpaceRadius: 4 + Math.random() * 10,
        });
      }
    }
    twinsRef.current = twins;

    const fc = new FieldConstructor(kernel);
    fieldConstructorRef.current = fc;
    sampleEventsRef.current = fc.getPipeline().generateSampleEvents(200, 1);
    eventIndexRef.current = 0;
  }, []);

  // Simulation loop
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const kernel = kernelRef.current;
      if (!kernel) return;

      const edgeOrder = ['substrate', 'kernel', 'attractors', 'coulomb', 'fokker', 'positions', 'harmony', 'insight', 'predecision'];
      edgeTimerRef.current = (edgeTimerRef.current + 1) % edgeOrder.length;
      setActiveEdge(edgeOrder[edgeTimerRef.current]);

      const fc = fieldConstructorRef.current;
      if (fc && sampleEventsRef.current.length > 0) {
        const idx = eventIndexRef.current % sampleEventsRef.current.length;
        const event = sampleEventsRef.current[idx];
        eventIndexRef.current = idx + 1;
        const { enriched, mutations } = fc.processEvent(event);
        setRecentEvents(prev => [...prev.slice(-14), enriched]);
        setRecentMutations(prev => [...prev.slice(-14), ...mutations]);
        setConstructionState(fc.getSnapshot());
      }

      const pre = kernel.tick(1);
      const intents: Record<string, { intent: string; confidence: number }> = {};
      for (const [id, twin] of twinsRef.current) {
        const r = twin.evaluateIntent(pre, kernel);
        twin.executeIntent(kernel);
        intents[id] = { intent: r.intent, confidence: r.confidence };
      }
      setTwinIntents(intents);

      const out = kernel.tick(1);
      setOutput(out);
      setTick(out.tick);
      setInsights(insightFromKernel(out));

      if (out.tick % 10 === 0) {
        setMcResult(kernel.monteCarloWhatIf(10, 5));
      }
    }, speed);
    return () => clearInterval(iv);
  }, [running, speed]);

  const handleStep = useCallback(() => {
    const kernel = kernelRef.current;
    if (!kernel) return;

    const fc = fieldConstructorRef.current;
    if (fc && sampleEventsRef.current.length > 0) {
      const idx = eventIndexRef.current % sampleEventsRef.current.length;
      const event = sampleEventsRef.current[idx];
      eventIndexRef.current = idx + 1;
      const { enriched, mutations } = fc.processEvent(event);
      setRecentEvents(prev => [...prev.slice(-14), enriched]);
      setRecentMutations(prev => [...prev.slice(-14), ...mutations]);
      setConstructionState(fc.getSnapshot());
    }

    const pre = kernel.tick(1);
    const intents: Record<string, { intent: string; confidence: number }> = {};
    for (const [id, twin] of twinsRef.current) {
      const r = twin.evaluateIntent(pre, kernel);
      twin.executeIntent(kernel);
      intents[id] = { intent: r.intent, confidence: r.confidence };
    }
    setTwinIntents(intents);
    const out = kernel.tick(1);
    setOutput(out);
    setTick(out.tick);
    setInsights(insightFromKernel(out));
    if (out.tick % 10 === 0) setMcResult(kernel.monteCarloWhatIf(10, 5));
  }, []);

  const handleReset = useCallback(() => {
    setRunning(false);
    const kernel = new ResonanceKernel();
    for (const p of FORMATION) kernel.addPlayer(p.id, p.x, p.y, p.state, p.load);
    kernel.addAttractor('ball', 52, 34, 15, 0.8);
    kernel.addAttractor('tactical', 35, 34, 25, 0.6);
    kernel.addAttractor('defensive', 18, 34, 20, 0.5);
    kernel.addAttractor('offensive', 75, 34, 18, 0.4);
    kernel.addAttractor('space', 60, 15, 12, 0.3);
    kernelRef.current = kernel;
    setOutput(null);
    setTick(0);
    setInsights([]);
    setMcResult(null);
    setTwinIntents({});
    const fc = new FieldConstructor(kernel);
    fieldConstructorRef.current = fc;
    sampleEventsRef.current = fc.getPipeline().generateSampleEvents(200, 1);
    eventIndexRef.current = 0;
    setRecentEvents([]);
    setRecentMutations([]);
    setConstructionState(null);
  }, []);

  // Build node map
  const nodeMap = new Map<string, Node>();
  for (const n of NODES) nodeMap.set(n.id, n);

  // Live values overlay
  const liveValues: Record<string, string> = {};
  if (output) {
    liveValues['harmony'] = `${(output.harmony * 100).toFixed(1)}%`;
    liveValues['energy'] = output.fieldEnergy.toFixed(2);
    liveValues['entangle'] = `${output.entanglements.length} pairs`;
    liveValues['drifts'] = output.drifts.length > 0 ? `${output.drifts.length} active` : 'none';
    liveValues['montecarlo'] = mcResult ? `avg ${(mcResult.avgHarmony * 100).toFixed(0)}%` : '—';
    liveValues['twins'] = Object.values(twinIntents).length > 0
      ? Object.entries(twinIntents).slice(0, 3).map(([id, t]) => `${id}:${t.intent.slice(0, 6)}`).join(' ')
      : '—';
    liveValues['kernel'] = `tick ${output.tick}`;

    const cohVals = Object.values(output.players);
    if (cohVals.length > 0) {
      const avg = cohVals.reduce((s, c) => s + c.coherenceScore, 0) / cohVals.length;
      liveValues['coherence'] = `avg ${(avg * 100).toFixed(0)}%`;
    }
    if (insights.length > 0) {
      liveValues['insight'] = insights[0].message.slice(0, 30) + '…';
    }
    if (output.drifts.length > 0) {
      liveValues['predecision'] = output.drifts[0].description.slice(0, 45);
    } else if (insights.length > 0) {
      liveValues['predecision'] = insights[0].message.slice(0, 45);
    }
  }
  if (recentEvents.length > 0) {
    const last = recentEvents[recentEvents.length - 1];
    liveValues['eventingest'] = `${last.abstract.type}: ${last.abstract.from}`;
    liveValues['vectorenrich'] = `(${last.origin.x.toFixed(0)},${last.origin.y.toFixed(0)})→(${last.destination.x.toFixed(0)},${last.destination.y.toFixed(0)})`;
    liveValues['fieldconst'] = constructionState ? `${constructionState.fieldState} ${(constructionState.organicCoverage * 100).toFixed(0)}%` : '—';
    liveValues['eventlog'] = `${recentMutations.length} mutations`;
  }

  // Harmony status
  const harmonyVal = output?.harmony ?? 0;
  const harmonyColor = harmonyVal > 0.7 ? BP.greenL : harmonyVal > 0.4 ? BP.orangeL : BP.redL;
  const harmonyLabel = harmonyVal > 0.7 ? 'RESONANT' : harmonyVal > 0.4 ? 'DRIFTING' : 'CRITICAL';

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: BP.black, color: BP.text1 }}>
      {/* ═══ Header ═══════════════════════════════════════════════════ */}
      <header
        className="flex-shrink-0 h-11 flex items-center justify-between px-5"
        style={{ background: BP.bg1, borderBottom: `1px solid ${BP.bg3}` }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: running ? BP.greenL : BP.bg5 }} />
            <span className="text-[13px] font-semibold tracking-wide" style={{ color: BP.text1 }}>BigDunc</span>
          </div>
          <div className="h-4 w-px" style={{ background: BP.bg3 }} />
          <span className="text-[11px]" style={{ color: BP.text4 }}>Resonance Kernel — Algorithm Flow</span>
          {output && (
            <>
              <div className="h-4 w-px" style={{ background: BP.bg3 }} />
              <span className="text-[11px] font-mono tabular-nums" style={{ color: harmonyColor }}>
                {harmonyLabel} {(harmonyVal * 100).toFixed(0)}%
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1 text-[11px] rounded transition-colors"
            style={{ background: BP.bg2, color: BP.text3, border: `1px solid ${BP.bg3}` }}
            onMouseEnter={e => { e.currentTarget.style.background = BP.bg3; e.currentTarget.style.color = BP.text2; }}
            onMouseLeave={e => { e.currentTarget.style.background = BP.bg2; e.currentTarget.style.color = BP.text3; }}
          >
            Reset
          </button>
          <button
            onClick={handleStep}
            className="px-3 py-1 text-[11px] rounded transition-colors"
            style={{ background: BP.bg2, color: BP.text2, border: `1px solid ${BP.bg3}` }}
            onMouseEnter={e => { e.currentTarget.style.background = BP.bg3; }}
            onMouseLeave={e => { e.currentTarget.style.background = BP.bg2; }}
          >
            Step
          </button>
          <button
            onClick={() => setRunning(r => !r)}
            className="px-4 py-1 text-[11px] rounded font-medium transition-colors"
            style={{
              background: running ? 'rgba(205,66,70,0.15)' : 'rgba(35,133,81,0.15)',
              color: running ? BP.redL : BP.greenL,
              border: `1px solid ${running ? 'rgba(205,66,70,0.3)' : 'rgba(35,133,81,0.3)'}`,
            }}
          >
            {running ? 'Pause' : 'Run'}
          </button>
          <select
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="text-[11px] px-2 py-1 rounded outline-none"
            style={{ background: BP.bg2, color: BP.text3, border: `1px solid ${BP.bg3}` }}
          >
            <option value={1000}>1s</option>
            <option value={500}>500ms</option>
            <option value={200}>200ms</option>
            <option value={100}>100ms</option>
          </select>
          <span className="text-[11px] font-mono tabular-nums ml-1" style={{ color: BP.text4 }}>t={tick}</span>
        </div>
      </header>

      {/* ═══ Main: Diagram + Sidebar ══════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── Diagram Panel ─────────────────────────────────────── */}
        <div ref={diagramRef} className="flex-1 overflow-auto p-3 relative" style={{ background: BP.black }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-full"
            style={{ minWidth: 900, minHeight: 600 }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={BP.bg5} />
              </marker>
              <marker id="arrow-active" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={BP.blueL} />
              </marker>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Grid */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={BP.bg2} strokeWidth="0.3" />
            </pattern>
            <rect width={W} height={H} fill="url(#grid)" />

            {/* Section labels */}
            {GROUP_LABELS.map(g => (
              <text key={g.text} x={g.x} y={g.y} fill={BP.text4} fontSize="9" fontWeight="600" letterSpacing="0.08em">
                {g.text}
              </text>
            ))}

            {/* Edges */}
            {EDGES.map((edge, i) => {
              const fromNode = nodeMap.get(edge.from);
              const toNode = nodeMap.get(edge.to);
              if (!fromNode || !toNode) return null;
              const path = edgePath(fromNode, toNode);
              const isActive = activeEdge === edge.from || activeEdge === edge.to;
              return (
                <g key={i}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isActive ? BP.blueL : BP.bg3}
                    strokeWidth={isActive ? 1.5 : 0.8}
                    strokeDasharray={edge.dashed ? '6 4' : undefined}
                    markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow)'}
                    opacity={isActive ? 1 : 0.5}
                    style={{ transition: 'all 0.2s ease' }}
                  />
                  {edge.label && (
                    <text
                      x={(getNodeCenter(fromNode).cx + getNodeCenter(toNode).cx) / 2}
                      y={(getNodeCenter(fromNode).cy + getNodeCenter(toNode).cy) / 2 - 6}
                      fill={isActive ? BP.blueM : BP.text4}
                      fontSize="8"
                      textAnchor="middle"
                      style={{ transition: 'fill 0.2s ease' }}
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {NODES.map(node => {
              const live = liveValues[node.id];
              const isActive = activeEdge === node.id;
              const isHovered = hoveredNode === node.id;
              return (
                <g
                  key={node.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(() => {
                      setHoveredNode(node.id);
                      if (diagramRef.current) {
                        const svgEl = diagramRef.current.querySelector('svg');
                        if (svgEl) {
                          const svgRect = svgEl.getBoundingClientRect();
                          const scaleX = svgRect.width / W;
                          const scaleY = svgRect.height / H;
                          setHoverPos({
                            x: (node.x + node.w) * scaleX + svgRect.left - (diagramRef.current.getBoundingClientRect().left) + 12,
                            y: node.y * scaleY + svgRect.top - (diagramRef.current.getBoundingClientRect().top),
                          });
                        }
                      }
                    }, 120);
                  }}
                  onMouseLeave={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(() => setHoveredNode(null), 200);
                  }}
                >
                  {/* Glow ring on hover/active */}
                  {(isActive || isHovered) && (
                    <rect
                      x={node.x - 3} y={node.y - 3}
                      width={node.w + 6} height={node.h + 6}
                      rx={7} fill="none"
                      stroke={isHovered ? node.color : BP.blueL}
                      strokeWidth={1.5}
                      opacity={0.4}
                      filter="url(#glow)"
                    />
                  )}

                  {/* Background */}
                  <rect
                    x={node.x} y={node.y}
                    width={node.w} height={node.h}
                    rx={4}
                    fill={isHovered ? BP.bg2 : BP.bg1}
                    stroke={isHovered ? node.color : `${node.color}40`}
                    strokeWidth={isHovered ? 1.5 : 0.8}
                    style={{ transition: 'all 0.15s ease' }}
                  />

                  {/* Left accent bar */}
                  <rect
                    x={node.x} y={node.y}
                    width={3} height={node.h}
                    rx={2}
                    fill={node.color}
                    opacity={isHovered ? 1 : 0.6}
                  />

                  {/* Label */}
                  <text
                    x={node.x + 12} y={node.y + 16}
                    fill={isHovered ? BP.text1 : BP.text2}
                    fontSize="11" fontWeight="600"
                    style={{ transition: 'fill 0.15s ease' }}
                  >
                    {node.label}
                  </text>

                  {/* Sub label */}
                  {node.sub && (
                    <text
                      x={node.x + 12} y={node.y + 30}
                      fill={BP.text4} fontSize="8.5"
                    >
                      {node.sub}
                    </text>
                  )}

                  {/* Live value */}
                  {live && (
                    <text
                      x={node.x + node.w - 8} y={node.y + node.h - 8}
                      fill={node.color} fontSize="9" fontWeight="600"
                      textAnchor="end"
                      style={{ fontFamily: 'monospace' }}
                    >
                      {live}
                    </text>
                  )}

                  {/* Hover indicator */}
                  <circle
                    cx={node.x + node.w - 8} cy={node.y + 10}
                    r={3}
                    fill={isHovered ? node.color : 'none'}
                    stroke={isHovered ? node.color : BP.bg4}
                    strokeWidth={0.8}
                    opacity={isHovered ? 1 : 0.5}
                  />
                </g>
              );
            })}

            {/* Footer */}
            <text x={W / 2} y={H - 24} textAnchor="middle" fill={BP.text4} fontSize="10" letterSpacing="0.04em">
              BigDunc Engine — Quantum-Inspired Pre-Decision Resonance Kernel
            </text>
          </svg>

          {/* ─── Floating Hover Panel ────────────────────────────── */}
          {hoveredNode && (() => {
            const cohVals = output ? Object.values(output.players) : [];
            const avgCoh = cohVals.length > 0 ? cohVals.reduce((s, c) => s + c.coherenceScore, 0) / cohVals.length : undefined;
            const explanation = getNodeExplanation(hoveredNode, {
              harmony: output?.harmony,
              fieldEnergy: output?.fieldEnergy,
              entanglementCount: output?.entanglements.length,
              driftCount: output?.drifts.length,
              tick: output?.tick,
              avgCoherence: avgCoh,
              mcResult: mcResult,
              twinIntents,
            });
            return (
              <div
                className="absolute z-[200] pointer-events-auto animate-fadeIn"
                style={{ left: hoverPos.x, top: hoverPos.y, maxWidth: 400, minWidth: 340 }}
                onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
                onMouseLeave={() => {
                  if (hoverTimer.current) clearTimeout(hoverTimer.current);
                  hoverTimer.current = setTimeout(() => setHoveredNode(null), 200);
                }}
              >
                <div
                  className="rounded-md overflow-hidden"
                  style={{
                    background: BP.bg1,
                    border: `1px solid ${BP.bg3}`,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 1px rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Header */}
                  <div
                    className="px-4 py-2.5 flex items-start justify-between gap-3"
                    style={{ borderBottom: `1px solid ${BP.bg3}`, background: BP.bg2 }}
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold tracking-wide" style={{ color: BP.text1 }}>{explanation.title}</div>
                      {explanation.liveValue && (
                        <div className="text-[11px] font-mono mt-0.5" style={{ color: BP.blueL }}>{explanation.liveValue}</div>
                      )}
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 opacity-70" style={{ background: BP.blueL }} />
                  </div>

                  {/* Sections */}
                  <div className="max-h-[360px] overflow-y-auto">
                    {explanation.sections.map((sec: ComputationSection, si: number) => (
                      <div key={si} style={{ borderBottom: si < explanation.sections.length - 1 ? `1px solid ${BP.bg2}` : 'none' }}>
                        <div className="px-4 py-1.5" style={{ background: `${BP.bg2}80` }}>
                          <span className={`text-[10px] font-semibold ${sec.color}`}>{sec.title}</span>
                        </div>
                        <div className="px-4 pb-3 space-y-2">
                          {sec.steps.map((step, stIdx) => (
                            <div key={stIdx} className="ml-3">
                              {step.formula && (
                                <div
                                  className="text-[10px] font-mono px-2.5 py-1 rounded mb-1 leading-relaxed break-all"
                                  style={{ color: BP.blueM, background: 'rgba(45,114,210,0.07)', border: '1px solid rgba(45,114,210,0.1)' }}
                                >
                                  {step.formula}
                                </div>
                              )}
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-[10px] leading-snug" style={{ color: BP.text3 }}>{step.label}</span>
                                {step.value && (
                                  <span className="text-[11px] font-mono tabular-nums flex-shrink-0" style={{ color: BP.text2 }}>{step.value}</span>
                                )}
                              </div>
                              {step.detail && (
                                <div className="text-[9px] leading-relaxed mt-0.5" style={{ color: BP.text4 }}>{step.detail}</div>
                              )}
                            </div>
                          ))}
                          {sec.conceptNote && (
                            <div
                              className="ml-3 mt-2 px-3 py-2 rounded"
                              style={{ background: 'rgba(124,58,237,0.05)', borderLeft: '2px solid rgba(124,58,237,0.25)' }}
                            >
                              <div className="text-[9px] leading-relaxed" style={{ color: 'rgba(167,139,250,0.65)' }}>{sec.conceptNote}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ─── Right Sidebar ─────────────────────────────────────── */}
        <div
          className="w-[320px] flex-shrink-0 flex flex-col overflow-hidden"
          style={{ background: BP.bg1, borderLeft: `1px solid ${BP.bg3}` }}
        >
          {/* Harmony Gauge */}
          <div className="p-4" style={{ borderBottom: `1px solid ${BP.bg3}` }}>
            <HoverCard
              title="Field Harmony — Team Synchronization"
              anchor="left"
              width={380}
              sections={[{
                title: 'Harmony Formula',
                color: 'text-[#32A467]',
                steps: [
                  { label: 'Phase alignment', formula: 'align = Σcos(φᵢ - φⱼ) / C(n,2)', detail: '70% of final harmony score' },
                  { label: 'Energy uniformity', formula: '1 - H/log₂(n)', detail: '30% weight — penalizes uneven workload' },
                  { label: 'Final', formula: '0.7 × align + 0.3 × (1 - entropy)', value: output ? `${(output.harmony * 100).toFixed(1)}%` : '—' },
                ],
                conceptNote: '>70% = team in resonance. 40-70% = drifting. <40% = collapsing. Measures BOTH tactical sync AND energy balance.',
              }]}
              liveValue={output ? `${(output.harmony * 100).toFixed(1)}%` : undefined}
            >
              <div className="text-[10px] uppercase tracking-[0.12em] font-medium" style={{ color: BP.text4 }}>Field Harmony</div>
            </HoverCard>

            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: BP.bg3 }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${harmonyVal * 100}%`, background: harmonyColor }}
                />
              </div>
              <span className="text-[12px] font-mono font-semibold tabular-nums" style={{ color: harmonyColor }}>
                {output ? `${(output.harmony * 100).toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="mt-1.5 text-[9px] font-medium tracking-wide" style={{ color: harmonyColor }}>
              {harmonyLabel}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2" style={{ borderBottom: `1px solid ${BP.bg3}` }}>
            {[
              { label: 'Tick', statId: 'tick', value: tick.toString(), color: BP.orangeL },
              { label: 'Energy', statId: 'energy', value: output?.fieldEnergy.toFixed(2) ?? '—', color: BP.greenL },
              { label: 'Entangled', statId: 'entangled', value: output ? `${output.entanglements.length}` : '—', color: BP.violet },
              { label: 'Drifts', statId: 'drifts', value: output ? `${output.drifts.length}` : '—', color: BP.redL },
            ].map((s, i) => {
              const statExp = getStatExplanation(s.statId, s.value);
              return (
                <div
                  key={s.label}
                  className="p-3"
                  style={{
                    background: BP.bg1,
                    borderRight: i % 2 === 0 ? `1px solid ${BP.bg3}` : 'none',
                    borderBottom: i < 2 ? `1px solid ${BP.bg3}` : 'none',
                  }}
                >
                  <HoverCard
                    title={statExp.title}
                    sections={statExp.sections}
                    liveValue={statExp.liveValue}
                    anchor="left"
                    width={320}
                  >
                    <div className="text-[9px] uppercase tracking-[0.1em]" style={{ color: BP.text4 }}>{s.label}</div>
                  </HoverCard>
                  <div className="text-[15px] font-semibold tabular-nums mt-0.5 font-mono" style={{ color: s.color }}>{s.value}</div>
                </div>
              );
            })}
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto">

            {/* Monte Carlo */}
            {mcResult && (
              <div className="p-3" style={{ borderBottom: `1px solid ${BP.bg3}` }}>
                <HoverCard
                  title="Monte Carlo What-If — Scenario Simulation"
                  anchor="left"
                  width={360}
                  liveValue={`avg ${(mcResult.avgHarmony * 100).toFixed(0)}%`}
                  sections={[{
                    title: 'Monte Carlo Method',
                    color: 'text-[#06B6D4]',
                    steps: [
                      { label: 'Scenarios', value: '10', detail: '10 random perturbations of current state' },
                      { label: 'Lookahead', value: '5 ticks' },
                      { label: 'Best case', value: `${(mcResult.bestCase * 100).toFixed(0)}%` },
                      { label: 'Worst case', value: `${(mcResult.worstCase * 100).toFixed(0)}%` },
                      { label: 'Spread', value: `${((mcResult.bestCase - mcResult.worstCase) * 100).toFixed(0)}%`, detail: 'Wide = fragile. Narrow = robust.' },
                    ],
                    conceptNote: '"How stable is our shape?" Wide best-worst gap = fragile state.',
                  }]}
                >
                  <div className="text-[9px] uppercase tracking-[0.1em] font-medium mb-2" style={{ color: BP.cyan }}>Monte Carlo (10×5)</div>
                </HoverCard>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'worst', val: mcResult.worstCase, color: BP.redL },
                    { label: 'avg', val: mcResult.avgHarmony, color: BP.orangeL },
                    { label: 'best', val: mcResult.bestCase, color: BP.greenL },
                  ].map(m => (
                    <div key={m.label} className="rounded p-1.5" style={{ background: BP.bg2 }}>
                      <div className="text-[8px] uppercase tracking-wider" style={{ color: BP.text4 }}>{m.label}</div>
                      <div className="text-[13px] font-semibold font-mono tabular-nums" style={{ color: m.color }}>
                        {(m.val * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Entanglements */}
            <div className="p-3" style={{ borderBottom: `1px solid ${BP.bg3}` }}>
              <HoverCard
                title="Entanglement Map — Player Pair Correlations"
                anchor="left"
                width={380}
                liveValue={output ? `${output.entanglements.length} pairs above threshold` : undefined}
                sections={[{
                  title: 'How Entanglement Is Computed',
                  color: 'text-[#A78BFA]',
                  steps: [
                    { label: 'Spatial RBF', formula: 'RBF(d, σ=20) = e^(-d²/(2×400))' },
                    { label: 'Phase correlation', formula: '(cos(φA - φB) + 1) / 2' },
                    { label: 'Combined', formula: 'correlation = spatial × phase' },
                    { label: 'Threshold', value: '> 0.30' },
                  ],
                  conceptNote: 'Two "entangled" players move as a coordinated unit. 5-8 pairs = well-organized structure.',
                }]}
              >
                <div className="text-[9px] uppercase tracking-[0.1em] font-medium mb-2" style={{ color: BP.violet }}>Entanglements</div>
              </HoverCard>
              <div className="space-y-1">
                {(output?.entanglements ?? []).slice(0, 5).map((e, i) => (
                  <HoverCard
                    key={i}
                    title={`${e.playerA} ↔ ${e.playerB}`}
                    anchor="left"
                    width={300}
                    liveValue={`${(e.correlation * 100).toFixed(1)}%`}
                    sections={[{
                      title: 'Pair',
                      color: 'text-[#A78BFA]',
                      steps: [
                        { label: 'Correlation', value: `${(e.correlation * 100).toFixed(1)}%` },
                        { label: 'Meaning', value: e.correlation > 0.7 ? 'Phase-locked' : e.correlation > 0.5 ? 'Loosely coupled' : 'Weak link' },
                      ],
                    }]}
                  >
                    <div className="flex items-center gap-2 text-[10px] rounded px-2 py-1" style={{ background: BP.bg2 }}>
                      <span className="font-mono" style={{ color: BP.text3 }}>{e.playerA}</span>
                      <span style={{ color: BP.violet }}>↔</span>
                      <span className="font-mono" style={{ color: BP.text3 }}>{e.playerB}</span>
                      <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: BP.bg4 }}>
                        <div className="h-full rounded-full" style={{ width: `${e.correlation * 100}%`, background: BP.violet }} />
                      </div>
                      <span className="tabular-nums font-mono" style={{ color: BP.violet }}>{(e.correlation * 100).toFixed(0)}%</span>
                    </div>
                  </HoverCard>
                ))}
                {(!output || output.entanglements.length === 0) && (
                  <div className="text-[10px]" style={{ color: BP.text4 }}>No entangled pairs yet</div>
                )}
              </div>
            </div>

            {/* Twin Intents */}
            <div className="p-3" style={{ borderBottom: `1px solid ${BP.bg3}` }}>
              <HoverCard
                title="Autonomous Twin Intents — Agent Decisions"
                anchor="left"
                width={380}
                sections={[{
                  title: 'Intent Scoring System',
                  color: 'text-[#DB2777]',
                  steps: [
                    { label: 'hold_position', formula: 'coherence × 0.6 + (1-threat) × 0.4' },
                    { label: 'move_to_space', formula: 'space × 0.7 + (1-threat) × 0.3' },
                    { label: 'press_opponent', formula: 'threat × 0.5 + amplitude × 0.3 + ball × 0.2' },
                    { label: 'support_ball', formula: 'ball × 0.6 + (1-teammates) × 0.4' },
                    { label: 'create_passing_lane', formula: 'space × 0.4 + ball × 0.3 + teammates × 0.3' },
                    { label: 'recover_shape', formula: '(1-coherence) × 0.7 + (1-phaseAlign) × 0.3' },
                  ],
                  conceptNote: 'Each twin independently scores all 6 intents and picks the highest. No central controller — team behavior emerges from 11 autonomous decisions.',
                }]}
              >
                <div className="text-[9px] uppercase tracking-[0.1em] font-medium mb-2" style={{ color: BP.rose }}>Twin Intents</div>
              </HoverCard>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(twinIntents).slice(0, 11).map(([id, t]) => {
                  const intentExplanations: Record<string, string> = {
                    hold_position: 'Staying in position — coherence high, safe.',
                    move_to_space: 'Seeking open space.',
                    press_opponent: 'Closing down opponent.',
                    support_ball: 'Moving toward ball to offer option.',
                    create_passing_lane: 'Positioning for receiving angle.',
                    recover_shape: 'Returning to tactical position.',
                  };
                  return (
                    <HoverCard
                      key={id}
                      title={`${id} — ${t.intent.replace(/_/g, ' ')}`}
                      anchor="left"
                      width={280}
                      liveValue={`${(t.confidence * 100).toFixed(0)}%`}
                      sections={[{
                        title: 'Decision',
                        color: 'text-[#DB2777]',
                        steps: [
                          { label: 'Intent', value: t.intent.replace(/_/g, ' ') },
                          { label: 'Confidence', value: `${(t.confidence * 100).toFixed(0)}%` },
                          { label: 'Why', value: intentExplanations[t.intent] || 'Context-dependent' },
                        ],
                      }]}
                    >
                      <div className="flex items-center gap-1 text-[9px] rounded px-1.5 py-1" style={{ background: BP.bg2 }}>
                        <span className="font-mono w-7" style={{ color: BP.text3 }}>{id}</span>
                        <span className="truncate flex-1" style={{ color: BP.rose }}>{t.intent.replace(/_/g, ' ')}</span>
                        <span className="tabular-nums font-mono" style={{ color: BP.text4 }}>{(t.confidence * 100).toFixed(0)}</span>
                      </div>
                    </HoverCard>
                  );
                })}
              </div>
            </div>

            {/* Event Feed */}
            <div className="p-3" style={{ borderBottom: `1px solid ${BP.bg3}` }}>
              <HoverCard
                title="Event Ingestion — Organic Field Construction"
                anchor="left"
                width={380}
                liveValue={constructionState ? `${constructionState.eventCount} events, ${constructionState.fieldState}` : undefined}
                sections={[{
                  title: 'How Events Build the Field',
                  color: 'text-[#0D9488]',
                  steps: [
                    { label: 'Abstract event', value: '"CB1 passed to CM2"' },
                    { label: 'Vector enrichment', formula: 'origin=resolve(actor), dest=resolve(target)+lead, trajectory=bezier(origin,dest)' },
                    { label: 'Field mutation', value: 'kernel.player.pos += lerp(enriched, 0.4)' },
                    { label: 'Phase cascade', formula: 'P(shift) = 0.6 × (1 - d/25)' },
                    { label: 'Coverage', value: constructionState ? `${(constructionState.organicCoverage * 100).toFixed(0)}%` : '—' },
                  ],
                  conceptNote: 'The field grows organically from events. Each pass, tackle, shot enriches abstract data with full vectors, then mutates the kernel.',
                }]}
              >
                <div className="text-[9px] uppercase tracking-[0.1em] font-medium mb-2" style={{ color: BP.teal }}>Event Feed</div>
              </HoverCard>
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {recentEvents.slice(-8).reverse().map((e, i) => {
                  const ev = e.abstract;
                  const typeColors: Record<string, string> = {
                    pass: BP.blueL, shot: BP.redL, tackle: BP.orangeL,
                    dribble: BP.violet, press_trigger: BP.orangeL,
                    cross: BP.cyan, through_ball: BP.greenL,
                    interception: BP.orangeM, clearance: BP.text3,
                    recovery_run: BP.rose,
                  };
                  return (
                    <HoverCard
                      key={i}
                      title={`${ev.type.replace(/_/g, ' ')} — Vector Detail`}
                      anchor="left"
                      width={340}
                      liveValue={`${e.distanceCovered.toFixed(1)}m at ${e.ballSpeed.toFixed(0)} m/s`}
                      sections={[
                        {
                          title: 'Spatial Vectors',
                          color: 'text-[#0D9488]',
                          steps: [
                            { label: 'Origin', value: `(${e.origin.x.toFixed(1)}, ${e.origin.y.toFixed(1)})` },
                            { label: 'Destination', value: `(${e.destination.x.toFixed(1)}, ${e.destination.y.toFixed(1)})` },
                            { label: 'Ball velocity', value: `(${e.ballVelocity.x.toFixed(1)}, ${e.ballVelocity.y.toFixed(1)}) m/s` },
                            { label: 'Distance', value: `${e.distanceCovered.toFixed(1)}m` },
                            { label: 'Angle', value: `${(e.angle * 180 / Math.PI).toFixed(0)}°` },
                            { label: 'Progressive dist', value: `${e.progressiveDistance.toFixed(1)}m` },
                          ],
                        },
                        {
                          title: 'Context',
                          color: 'text-[#5EEAD4]',
                          steps: [
                            { label: 'Passing lane', value: `${e.passingLaneWidth.toFixed(1)}m` },
                            { label: 'Pressure', value: `${(e.pressureOnActor * 100).toFixed(0)}%` },
                            { label: 'Space at dest', value: `${(e.spaceAtDestination * 100).toFixed(0)}%` },
                            { label: 'Phase', value: e.actorPhase },
                            ...(e.phaseShift ? [{ label: 'Cascade', value: e.phaseShift }] : []),
                          ],
                        },
                      ]}
                    >
                      <div className="flex items-center gap-1.5 text-[9px] rounded px-1.5 py-0.5" style={{ background: BP.bg2 }}>
                        <span className="tabular-nums w-8 font-mono" style={{ color: BP.text4 }}>
                          {ev.minute}&apos;{ev.second !== undefined ? String(ev.second).padStart(2, '0') : ''}
                        </span>
                        <span className="font-medium" style={{ color: typeColors[ev.type] ?? BP.text3 }}>
                          {ev.type.replace(/_/g, ' ')}
                        </span>
                        <span className="truncate" style={{ color: BP.text4 }}>
                          {ev.from}{ev.to ? ` → ${ev.to}` : ''}
                        </span>
                        {ev.success === false && <span className="text-[8px]" style={{ color: BP.redL }}>FAIL</span>}
                      </div>
                    </HoverCard>
                  );
                })}
                {recentEvents.length === 0 && (
                  <div className="text-[10px]" style={{ color: BP.text4 }}>Run to see events flow</div>
                )}
              </div>
            </div>

            {/* Insights */}
            <div className="p-3">
              <HoverCard
                title="Insight Layer — Human-Readable Intelligence"
                anchor="left"
                width={360}
                sections={[{
                  title: 'How Insights Are Generated',
                  color: 'text-[#A78BFA]',
                  steps: [
                    { label: 'Harmony check', value: '≥85% info, ≥60% warn, <60% critical' },
                    { label: 'Drift check', value: 'severity > 0.7 → critical' },
                    { label: 'Coherence check', value: '< 0.35 → flag player' },
                    { label: 'Entanglement check', value: '0 pairs = critical' },
                  ],
                  conceptNote: 'Translates kernel math into coaching language. The bridge between computation and decision-making.',
                }]}
              >
                <div className="text-[9px] uppercase tracking-[0.1em] font-medium mb-2" style={{ color: BP.violet }}>Insights</div>
              </HoverCard>
              <div className="space-y-1.5">
                {insights.map((ins, i) => {
                  const insightSource = ins.message.includes('harmony')
                    ? 'From field harmony computation.'
                    : ins.message.includes('coherence') || ins.message.includes('tactical connection')
                    ? 'From per-player coherence.'
                    : ins.message.includes('entangle') || ins.message.includes('phase correlation')
                    ? 'From entanglement map.'
                    : ins.message.includes('zone') || ins.message.includes('collapse')
                    ? 'From drift detection.'
                    : 'From kernel output.';

                  const insColor = ins.level === 'critical' ? BP.redL : ins.level === 'warning' ? BP.orangeL : BP.greenL;
                  const insBg = ins.level === 'critical' ? 'rgba(205,66,70,0.08)' : ins.level === 'warning' ? 'rgba(200,118,25,0.08)' : 'rgba(35,133,81,0.08)';
                  const insBorder = ins.level === 'critical' ? 'rgba(205,66,70,0.2)' : ins.level === 'warning' ? 'rgba(200,118,25,0.2)' : 'rgba(35,133,81,0.2)';

                  return (
                    <HoverCard
                      key={i}
                      title={`${ins.level.toUpperCase()} Insight`}
                      anchor="left"
                      width={320}
                      sections={[{
                        title: 'Source',
                        color: ins.level === 'critical' ? 'text-[#E76A6E]' : ins.level === 'warning' ? 'text-[#EC9A3C]' : 'text-[#32A467]',
                        steps: [
                          { label: 'Level', value: ins.level },
                          { label: 'Tick', value: `${ins.tick}` },
                          { label: 'Source', value: insightSource },
                        ],
                      }]}
                    >
                      <div
                        className="text-[10px] px-2.5 py-1.5 rounded"
                        style={{ background: insBg, color: insColor, border: `1px solid ${insBorder}` }}
                      >
                        {ins.message}
                      </div>
                    </HoverCard>
                  );
                })}
                {insights.length === 0 && (
                  <div className="text-[10px]" style={{ color: BP.text4 }}>Run the engine to see insights</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
