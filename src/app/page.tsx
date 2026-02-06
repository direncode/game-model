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

// ─── Diagram layout coordinates ────────────────────────────────────

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  sub?: string;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

const W = 1400;
const H = 920;

const NODES: Node[] = [
  // Layer 0 — Data Sources
  { id: 'catapult',    label: 'Catapult GPS/IMU',     x: 80,   y: 40,  w: 180, h: 52, color: '#0ea5e9', sub: 'speed, acc, load, HR' },
  { id: 'synthetic',   label: 'Synthetic Generator',   x: 80,   y: 120, w: 180, h: 52, color: '#0ea5e9', sub: '11 players × random' },

  // Layer 1 — Substrate
  { id: 'substrate',   label: 'DataSubstrate',         x: 380,  y: 80,  w: 200, h: 60, color: '#8b5cf6', sub: 'ingestFrame() → normalize' },

  // Layer 2 — Kernel core
  { id: 'kernel',      label: 'ResonanceKernel',       x: 700,  y: 30,  w: 220, h: 50, color: '#f59e0b', sub: 'tick(Δt) — main loop' },

  // Layer 2 sub-steps (inside kernel)
  { id: 'attractors',  label: '① Attractor Forces',    x: 520,  y: 150, w: 180, h: 48, color: '#f59e0b', sub: 'F = s·e^(-d/r) · dir' },
  { id: 'coulomb',     label: '② Coulomb Spacing',     x: 520,  y: 220, w: 180, h: 48, color: '#f59e0b', sub: 'F = k·q₁q₂/d²' },
  { id: 'fokker',      label: '③ Wave Evolution',      x: 520,  y: 290, w: 180, h: 48, color: '#f59e0b', sub: 'Fokker-Planck diffuse/drift' },
  { id: 'positions',   label: '④ Update Positions',    x: 520,  y: 360, w: 180, h: 48, color: '#f59e0b', sub: 'v → pos, boundary clamp' },

  // Layer 2 wave details
  { id: 'waveamp',     label: 'Amplitude',             x: 760,  y: 150, w: 140, h: 40, color: '#fb923c', sub: 'load → energy 0–1' },
  { id: 'wavephase',   label: 'Phase',                 x: 760,  y: 210, w: 140, h: 40, color: '#fb923c', sub: 'state → radians' },
  { id: 'wavefreq',    label: 'Frequency',             x: 760,  y: 270, w: 140, h: 40, color: '#fb923c', sub: 'speed → Hz rhythm' },
  { id: 'wavelength',  label: 'Wavelength',            x: 760,  y: 330, w: 140, h: 40, color: '#fb923c', sub: 'coverage meters' },

  // Layer 3 — Outputs
  { id: 'harmony',     label: 'Field Harmony',         x: 1000, y: 40,  w: 170, h: 52, color: '#22c55e', sub: 'cos(Δφ) + entropy' },
  { id: 'coherence',   label: 'Player Coherence',      x: 1000, y: 115, w: 170, h: 52, color: '#22c55e', sub: '|ψ|² + phase align' },
  { id: 'entangle',    label: 'Entanglement Map',      x: 1000, y: 190, w: 170, h: 52, color: '#22c55e', sub: 'RBF × cos(Δφ) pairs' },
  { id: 'drifts',      label: 'Drift Detection',       x: 1000, y: 265, w: 170, h: 52, color: '#ef4444', sub: '3–6s collapse warning' },
  { id: 'energy',      label: 'Field Energy',          x: 1000, y: 340, w: 170, h: 52, color: '#22c55e', sub: 'KE + wave²' },

  // Layer 4 — Twins
  { id: 'twins',       label: 'AutonomousTwin ×11',    x: 380,  y: 460, w: 210, h: 56, color: '#ec4899', sub: 'evaluate → execute intent' },
  { id: 'awareness',   label: 'Awareness Vector',      x: 120,  y: 460, w: 180, h: 50, color: '#ec4899', sub: 'ball, space, threat, team' },
  { id: 'intents',     label: 'Intent Scoring',        x: 120,  y: 540, w: 180, h: 50, color: '#ec4899', sub: '6 intents ranked' },

  // Layer 5 — Insights
  { id: 'insight',     label: 'Insight Layer',         x: 700,  y: 460, w: 200, h: 56, color: '#a855f7', sub: 'insightFromKernel()' },

  // Layer 6 — Monte Carlo
  { id: 'montecarlo',  label: 'Monte Carlo What-If',   x: 1000, y: 460, w: 190, h: 56, color: '#06b6d4', sub: 'N scenarios × T ticks' },

  // Superposition states
  { id: 'states',      label: 'Superposition States',  x: 380,  y: 580, w: 530, h: 44, color: '#64748b', sub: 'defending | pressing | building | attacking | transitioning' },

  // Pre-decision output
  { id: 'predecision', label: 'PRE-DECISION OUTPUT',   x: 380,  y: 660, w: 530, h: 54, color: '#ef4444', sub: '"Harmony dropping in midfield — shift phase now"' },
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

  // Exit point on from-node border
  const fx = a.cx + nx * (from.w / 2) * Math.min(1, Math.abs(nx) + 0.3);
  const fy = a.cy + ny * (from.h / 2) * Math.min(1, Math.abs(ny) + 0.3);

  // Entry point on to-node border
  const tx = b.cx - nx * (to.w / 2) * Math.min(1, Math.abs(nx) + 0.3);
  const ty = b.cy - ny * (to.h / 2) * Math.min(1, Math.abs(ny) + 0.3);

  // Subtle curve
  const mx = (fx + tx) / 2;
  const my = (fy + ty) / 2;
  const off = Math.min(30, dist * 0.1);
  const cx = mx - ny * off;
  const cy = my + nx * off;

  return `M${fx},${fy} Q${cx},${cy} ${tx},${ty}`;
}

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
  }, []);

  // Simulation loop
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const kernel = kernelRef.current;
      if (!kernel) return;

      // Animate edge flow
      const edgeOrder = ['substrate', 'kernel', 'attractors', 'coulomb', 'fokker', 'positions', 'harmony', 'insight', 'predecision'];
      edgeTimerRef.current = (edgeTimerRef.current + 1) % edgeOrder.length;
      setActiveEdge(edgeOrder[edgeTimerRef.current]);

      // Twin evaluate + execute
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

      // Run Monte Carlo every 10 ticks
      if (out.tick % 10 === 0) {
        setMcResult(kernel.monteCarloWhatIf(10, 5));
      }
    }, speed);
    return () => clearInterval(iv);
  }, [running, speed]);

  const handleStep = useCallback(() => {
    const kernel = kernelRef.current;
    if (!kernel) return;
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
  }, []);

  // Build node map for edge drawing
  const nodeMap = new Map<string, Node>();
  for (const n of NODES) nodeMap.set(n.id, n);

  // Live values for overlay inside nodes
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

  return (
    <div className="h-screen bg-[#0a0e1a] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-12 flex items-center justify-between px-6 bg-black/40 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-amber-400">BigDunc</span>
          <span className="text-xs text-white/30">Resonance Kernel — Algorithm Flow</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-3 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-white/60 transition"
          >
            Reset
          </button>
          <button
            onClick={handleStep}
            className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white/80 transition"
          >
            Step
          </button>
          <button
            onClick={() => setRunning(r => !r)}
            className={`px-4 py-1 text-xs rounded font-medium transition ${
              running
                ? 'bg-red-500/80 hover:bg-red-500 text-white'
                : 'bg-emerald-500/80 hover:bg-emerald-500 text-white'
            }`}
          >
            {running ? 'Pause' : 'Run'}
          </button>
          <select
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="bg-white/5 text-xs text-white/60 px-2 py-1 rounded border border-white/10"
          >
            <option value={1000}>1s</option>
            <option value={500}>500ms</option>
            <option value={200}>200ms</option>
            <option value={100}>100ms</option>
          </select>
          <span className="text-xs text-white/40 tabular-nums ml-2">tick {tick}</span>
        </div>
      </header>

      {/* Main: SVG Diagram + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Diagram */}
        <div className="flex-1 overflow-auto p-4">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-full"
            style={{ minWidth: 900, minHeight: 600 }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
              </marker>
              <marker id="arrow-active" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
              </marker>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Background grid */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.3" />
            </pattern>
            <rect width={W} height={H} fill="url(#grid)" />

            {/* Section labels */}
            <text x="80" y="25" fill="#475569" fontSize="10" fontFamily="monospace" fontWeight="bold">DATA SOURCES</text>
            <text x="380" y="68" fill="#475569" fontSize="10" fontFamily="monospace" fontWeight="bold">SUBSTRATE</text>
            <text x="520" y="140" fill="#475569" fontSize="10" fontFamily="monospace" fontWeight="bold">KERNEL PIPELINE</text>
            <text x="760" y="140" fill="#475569" fontSize="10" fontFamily="monospace" fontWeight="bold">WAVE FUNCTION</text>
            <text x="1000" y="28" fill="#475569" fontSize="10" fontFamily="monospace" fontWeight="bold">OUTPUTS</text>
            <text x="120" y="448" fill="#475569" fontSize="10" fontFamily="monospace" fontWeight="bold">AGENT SYSTEM</text>
            <text x="700" y="448" fill="#475569" fontSize="10" fontFamily="monospace" fontWeight="bold">INSIGHT LAYER</text>

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
                    stroke={isActive ? '#f59e0b' : '#334155'}
                    strokeWidth={isActive ? 1.8 : 1}
                    strokeDasharray={edge.dashed ? '6 4' : undefined}
                    markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow)'}
                    opacity={isActive ? 1 : 0.6}
                  />
                  {edge.label && (
                    <text
                      x={(getNodeCenter(fromNode).cx + getNodeCenter(toNode).cx) / 2}
                      y={(getNodeCenter(fromNode).cy + getNodeCenter(toNode).cy) / 2 - 6}
                      fill={isActive ? '#f59e0b' : '#475569'}
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="middle"
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
              return (
                <g key={node.id}>
                  {/* Shadow/glow when active */}
                  {isActive && (
                    <rect
                      x={node.x - 2} y={node.y - 2}
                      width={node.w + 4} height={node.h + 4}
                      rx={8} fill="none"
                      stroke={node.color} strokeWidth={2}
                      opacity={0.4} filter="url(#glow)"
                    />
                  )}
                  {/* Background */}
                  <rect
                    x={node.x} y={node.y}
                    width={node.w} height={node.h}
                    rx={6}
                    fill="#0f172a"
                    stroke={node.color + (isActive ? '' : '60')}
                    strokeWidth={isActive ? 1.5 : 1}
                  />
                  {/* Color bar on left */}
                  <rect
                    x={node.x} y={node.y}
                    width={4} height={node.h}
                    rx={2}
                    fill={node.color}
                  />
                  {/* Label */}
                  <text
                    x={node.x + 14} y={node.y + 16}
                    fill="#e2e8f0" fontSize="11" fontFamily="monospace" fontWeight="bold"
                  >
                    {node.label}
                  </text>
                  {/* Sub label */}
                  {node.sub && (
                    <text
                      x={node.x + 14} y={node.y + 30}
                      fill="#64748b" fontSize="8.5" fontFamily="monospace"
                    >
                      {node.sub}
                    </text>
                  )}
                  {/* Live value */}
                  {live && (
                    <text
                      x={node.x + node.w - 8} y={node.y + node.h - 8}
                      fill={node.color} fontSize="9" fontFamily="monospace" fontWeight="bold"
                      textAnchor="end"
                    >
                      {live}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Title block */}
            <text x={W / 2} y={H - 30} textAnchor="middle" fill="#334155" fontSize="11" fontFamily="monospace">
              BigDunc Engine — Quantum-Inspired Pre-Decision Resonance Kernel
            </text>
          </svg>
        </div>

        {/* Right sidebar — live data */}
        <div className="w-80 flex-shrink-0 bg-[#0c1220] border-l border-white/5 flex flex-col overflow-hidden">
          {/* Harmony gauge */}
          <div className="p-4 border-b border-white/5">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Field Harmony</div>
            <div className="h-5 bg-white/5 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(output?.harmony ?? 0) * 100}%`,
                  background: (output?.harmony ?? 0) > 0.7 ? '#22c55e' : (output?.harmony ?? 0) > 0.4 ? '#eab308' : '#ef4444',
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">
                {output ? `${(output.harmony * 100).toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-white/5">
            {[
              { label: 'Tick', value: tick.toString(), color: '#f59e0b' },
              { label: 'Energy', value: output?.fieldEnergy.toFixed(2) ?? '—', color: '#22c55e' },
              { label: 'Entangled', value: output ? `${output.entanglements.length}` : '—', color: '#a855f7' },
              { label: 'Drifts', value: output ? `${output.drifts.length}` : '—', color: '#ef4444' },
            ].map(s => (
              <div key={s.label} className="bg-[#0c1220] p-3">
                <div className="text-[9px] uppercase text-white/30">{s.label}</div>
                <div className="text-sm font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Monte Carlo */}
          {mcResult && (
            <div className="p-3 border-b border-white/5">
              <div className="text-[9px] uppercase tracking-widest text-cyan-400/60 mb-1">Monte Carlo (10×5)</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[8px] text-white/30">worst</div>
                  <div className="text-xs font-bold text-red-400">{(mcResult.worstCase * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-[8px] text-white/30">avg</div>
                  <div className="text-xs font-bold text-amber-400">{(mcResult.avgHarmony * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-[8px] text-white/30">best</div>
                  <div className="text-xs font-bold text-emerald-400">{(mcResult.bestCase * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Top entanglements */}
          <div className="p-3 border-b border-white/5">
            <div className="text-[9px] uppercase tracking-widest text-purple-400/60 mb-2">Entanglements</div>
            <div className="space-y-1">
              {(output?.entanglements ?? []).slice(0, 5).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-white/60 font-mono">{e.playerA}</span>
                  <span className="text-purple-400">↔</span>
                  <span className="text-white/60 font-mono">{e.playerB}</span>
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${e.correlation * 100}%` }} />
                  </div>
                  <span className="text-purple-400 tabular-nums">{(e.correlation * 100).toFixed(0)}%</span>
                </div>
              ))}
              {(!output || output.entanglements.length === 0) && (
                <div className="text-[10px] text-white/20">No entangled pairs yet</div>
              )}
            </div>
          </div>

          {/* Twin intents */}
          <div className="p-3 border-b border-white/5">
            <div className="text-[9px] uppercase tracking-widest text-pink-400/60 mb-2">Twin Intents</div>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(twinIntents).slice(0, 11).map(([id, t]) => (
                <div key={id} className="flex items-center gap-1 text-[9px] bg-white/3 rounded px-1.5 py-0.5">
                  <span className="text-white/50 font-mono w-7">{id}</span>
                  <span className="text-pink-300 truncate flex-1">{t.intent.replace(/_/g, ' ')}</span>
                  <span className="text-white/30 tabular-nums">{(t.confidence * 100).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="flex-1 overflow-auto p-3">
            <div className="text-[9px] uppercase tracking-widest text-violet-400/60 mb-2">Insights</div>
            <div className="space-y-1.5">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className={`text-[10px] px-2 py-1.5 rounded ${
                    ins.level === 'critical' ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                    : ins.level === 'warning' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  }`}
                >
                  {ins.message}
                </div>
              ))}
              {insights.length === 0 && (
                <div className="text-[10px] text-white/20">Run the engine to see insights</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
