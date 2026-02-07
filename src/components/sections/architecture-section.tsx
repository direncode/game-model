'use client';

import {
  Zap, GitCompare, Brain, Activity, Target,
  TrendingUp, Layers, ChevronRight, Eye, Database,
} from 'lucide-react';
import { useState, useMemo } from 'react';

const BP = {
  bg: '#1C2127',
  bgAlt: '#252A31',
  border: '#2F343C',
  text: '#F6F7F9',
  textMuted: '#8F99A8',
  textDim: '#5F6B7C',
  blue: '#2D72D2',
  green: '#238551',
  orange: '#C87619',
  red: '#CD4246',
  purple: '#7961DB',
  cyan: '#0EA5E9',
};

interface FlowNode {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  phase: string;
  details: string[];
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

const NODES: FlowNode[] = [
  {
    id: 'input',
    label: 'Data Ingestors',
    description: 'GPS feeds, player metrics, wearable analytics',
    icon: <Database className="w-5 h-5" />,
    color: BP.cyan,
    phase: 'Ingestion',
    details: ['Catapult GPS (10Hz)', 'Premier League data', 'Wearable analytics', 'Football Data API'],
  },
  {
    id: 'pattern',
    label: 'Pattern Engine',
    description: '40+ tactical patterns from positional data',
    icon: <Eye className="w-5 h-5" />,
    color: BP.blue,
    phase: 'Analysis',
    details: ['Press trigger detection', 'Halfspace occupation', 'Inverted fullback', 'Defensive block'],
  },
  {
    id: 'markov',
    label: 'Markov Chain',
    description: 'Recurrent tactical sequence prediction',
    icon: <GitCompare className="w-5 h-5" />,
    color: BP.purple,
    phase: 'Analysis',
    details: ['Transition matrix', 'Chain health', 'Sequence recurrence', 'Next-pattern prediction'],
  },
  {
    id: 'coherence',
    label: 'Coherence',
    description: 'Game model adherence in real-time',
    icon: <Target className="w-5 h-5" />,
    color: BP.green,
    phase: 'Evaluation',
    details: ['Per-player (0-100)', 'Phase-level scoring', 'Deviation detection', 'Historical comparison'],
  },
  {
    id: 'twin',
    label: 'Digital Twin',
    description: 'Actual vs ideal position comparison',
    icon: <Layers className="w-5 h-5" />,
    color: BP.orange,
    phase: 'Evaluation',
    details: ['Position vectors', 'Fatigue adjustment', 'Work rate tracking', 'Compliance score'],
  },
  {
    id: 'fatigue',
    label: 'Fatigue Model',
    description: 'Physical state from wearable data',
    icon: <Activity className="w-5 h-5" />,
    color: BP.red,
    phase: 'Physical',
    details: ['Muscular fatigue', 'Cardiovascular load', 'Sprint capacity', 'Injury risk'],
  },
  {
    id: 'ai',
    label: 'Tactical AI',
    description: 'Q-Learning RL decision agent',
    icon: <Brain className="w-5 h-5" />,
    color: '#E879F9',
    phase: 'Decision',
    details: ['Q-Learning pairs', 'Epsilon-greedy', 'Formation scoring', 'Pressing optimization'],
  },
  {
    id: 'output',
    label: 'Recommendations',
    description: 'Actionable tactical & physical alerts',
    icon: <TrendingUp className="w-5 h-5" />,
    color: '#34D399',
    phase: 'Output',
    details: ['Substitution intel', 'Pressing adjustments', 'Formation changes', 'Player warnings'],
  },
];

const EDGES: FlowEdge[] = [
  { from: 'input', to: 'pattern', label: 'positional data' },
  { from: 'input', to: 'fatigue', label: 'GPS metrics' },
  { from: 'pattern', to: 'markov', label: 'detected patterns' },
  { from: 'pattern', to: 'coherence', label: 'pattern match' },
  { from: 'markov', to: 'coherence', label: 'chain health' },
  { from: 'coherence', to: 'twin', label: 'coherence score' },
  { from: 'fatigue', to: 'twin', label: 'fatigue state' },
  { from: 'twin', to: 'output', label: 'deviations' },
  { from: 'ai', to: 'coherence', label: 'decisions' },
  { from: 'fatigue', to: 'output', label: 'physical alerts' },
  { from: 'coherence', to: 'output', label: 'tactical alerts' },
];

const NODE_POSITIONS: Record<string, { col: number; row: number }> = {
  input: { col: 0, row: 1 },
  pattern: { col: 1, row: 0 },
  fatigue: { col: 1, row: 2 },
  markov: { col: 2, row: 0 },
  coherence: { col: 2, row: 1 },
  ai: { col: 2, row: 2 },
  twin: { col: 3, row: 1 },
  output: { col: 4, row: 1 },
};

export function ArchitectureSection() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const activeEdges = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    return new Set(
      EDGES.filter((e) => e.from === hoveredNode || e.to === hoveredNode).map(
        (e) => `${e.from}-${e.to}`
      )
    );
  }, [hoveredNode]);

  const selectedNodeData = NODES.find((n) => n.id === selectedNode);

  return (
    <section id="architecture" className="section-full">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-overline mb-3 text-[#0EA5E9]">Architecture</div>
          <h2 className="text-heading-1 text-[#F6F7F9] mb-4">
            How it all connects
          </h2>
          <p className="text-body-large">
            Interactive architecture diagram. Hover to trace data flow.
            Click to inspect module capabilities.
          </p>
        </div>

        {/* Flow diagram */}
        <div className="rounded-xl border border-[#2F343C] bg-[#252A31] overflow-hidden">
          <div className="flex">
            {/* Graph */}
            <div className="flex-1 relative p-8 min-h-[480px]">
              {/* SVG edges */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {EDGES.map((edge) => {
                  const from = NODE_POSITIONS[edge.from];
                  const to = NODE_POSITIONS[edge.to];
                  if (!from || !to) return null;
                  const x1 = from.col * 190 + 160;
                  const y1 = from.row * 140 + 80;
                  const x2 = to.col * 190 + 60;
                  const y2 = to.row * 140 + 80;
                  const midX = (x1 + x2) / 2;
                  const edgeId = `${edge.from}-${edge.to}`;
                  const isActive = activeEdges.has(edgeId);
                  return (
                    <g key={edgeId}>
                      <path
                        d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={isActive ? BP.blue : BP.border}
                        strokeWidth={isActive ? 2 : 1}
                        opacity={hoveredNode && !isActive ? 0.15 : 1}
                        className="transition-all duration-200"
                      />
                      <circle cx={x2} cy={y2} r={3} fill={isActive ? BP.blue : BP.border} opacity={hoveredNode && !isActive ? 0.15 : 1} />
                      {isActive && edge.label && (
                        <text x={midX} y={(y1 + y2) / 2 - 8} textAnchor="middle" fill={BP.textMuted} fontSize="10" fontFamily="inherit">
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {NODES.map((node) => {
                const pos = NODE_POSITIONS[node.id];
                if (!pos) return null;
                const isHovered = hoveredNode === node.id;
                const isSelected = selectedNode === node.id;
                return (
                  <div
                    key={node.id}
                    className="absolute cursor-pointer transition-all duration-200"
                    style={{
                      left: pos.col * 190 + 24,
                      top: pos.row * 140 + 32,
                      width: 168,
                      transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                      zIndex: isHovered ? 10 : 1,
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                  >
                    <div
                      className="rounded-lg p-3 border transition-all duration-200"
                      style={{
                        background: isSelected ? `${node.color}15` : BP.bg,
                        borderColor: isHovered || isSelected ? node.color : BP.border,
                        boxShadow: isHovered || isSelected ? `0 0 24px ${node.color}25` : 'none',
                      }}
                    >
                      <div className="text-[9px] uppercase tracking-wider font-semibold mb-2" style={{ color: BP.textDim }}>
                        {node.phase}
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div style={{ color: node.color }}>{node.icon}</div>
                        <span className="text-xs font-semibold" style={{ color: BP.text }}>{node.label}</span>
                      </div>
                      <p className="text-[10px] leading-relaxed" style={{ color: BP.textMuted }}>{node.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail sidebar */}
            <div className="w-64 flex-shrink-0 border-l border-[#2F343C] bg-[#1C2127] overflow-y-auto">
              {selectedNodeData ? (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div style={{ color: selectedNodeData.color }}>{selectedNodeData.icon}</div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#F6F7F9]">{selectedNodeData.label}</h3>
                      <span className="text-xs text-[#5F6B7C]">{selectedNodeData.phase}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#8F99A8] mb-4 leading-relaxed">{selectedNodeData.description}</p>
                  <div className="text-overline mb-2">Capabilities</div>
                  <div className="space-y-1.5">
                    {selectedNodeData.details.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded text-xs" style={{ background: `${selectedNodeData.color}0D`, color: BP.text }}>
                        <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: selectedNodeData.color }} />
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="text-overline mt-4 mb-2">Connections</div>
                  <div className="space-y-1">
                    {EDGES.filter((e) => e.from === selectedNodeData.id || e.to === selectedNodeData.id).map((edge, i) => {
                      const isOut = edge.from === selectedNodeData.id;
                      const other = NODES.find((n) => n.id === (isOut ? edge.to : edge.from));
                      return (
                        <div key={i} className="flex items-center gap-2 px-2 py-1 rounded text-[11px]" style={{ background: `${BP.border}80`, color: BP.textMuted }}>
                          <span style={{ color: isOut ? BP.green : BP.blue }}>{isOut ? '\u2192' : '\u2190'}</span>
                          <span style={{ color: BP.text }}>{other?.label}</span>
                          {edge.label && <span style={{ color: BP.textDim }}>({edge.label})</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-6 text-center">
                  <div>
                    <Zap className="w-8 h-8 mx-auto mb-3 text-[#5F6B7C]" />
                    <p className="text-sm text-[#8F99A8]">Click a module to inspect</p>
                    <p className="text-xs mt-1 text-[#5F6B7C]">Hover to trace data flow</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
