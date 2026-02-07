'use client';

import { useState, useMemo } from 'react';
import { Zap, GitCompare, Brain, Activity, Target, TrendingUp, Layers, ChevronRight, Shield, Eye } from 'lucide-react';

// Blueprint Palette
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
  purple: '#7C3AED',
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
    label: 'Match Input',
    description: 'Live GPS data, player positions, ball tracking',
    icon: <Activity className="w-5 h-5" />,
    color: BP.cyan,
    phase: 'Data Ingestion',
    details: [
      'Catapult GPS feed (10Hz)',
      'Ball position tracking',
      'Player velocity vectors',
      'Heart rate streaming',
    ],
  },
  {
    id: 'pattern',
    label: 'Pattern Recognition',
    description: 'Detect 40+ tactical patterns from positional data',
    icon: <Eye className="w-5 h-5" />,
    color: BP.blue,
    phase: 'Analysis',
    details: [
      'High press trigger detection',
      'Half-space occupation',
      'Inverted fullback movement',
      'False nine drop analysis',
      'Defensive block classification',
    ],
  },
  {
    id: 'markov',
    label: 'Markov Chain',
    description: 'Predict recurrent tactical sequences',
    icon: <GitCompare className="w-5 h-5" />,
    color: BP.purple,
    phase: 'Analysis',
    details: [
      'Transition probability matrix',
      'Chain health scoring',
      'Sequence recurrence detection',
      'Next-pattern prediction',
    ],
  },
  {
    id: 'coherence',
    label: 'Coherence Scoring',
    description: 'Measure game model adherence in real-time',
    icon: <Target className="w-5 h-5" />,
    color: BP.green,
    phase: 'Evaluation',
    details: [
      'Per-player coherence (0-100)',
      'Phase-level scoring',
      'Deviation detection',
      'Historical comparison',
    ],
  },
  {
    id: 'twin',
    label: 'Digital Twin',
    description: 'Compare actual vs ideal positions',
    icon: <Layers className="w-5 h-5" />,
    color: BP.orange,
    phase: 'Evaluation',
    details: [
      'Position deviation vectors',
      'Fatigue-adjusted expectations',
      'Work rate tracking',
      'Tactical compliance score',
    ],
  },
  {
    id: 'fatigue',
    label: 'Fatigue Model',
    description: 'Physical state from GPS/wearable data',
    icon: <Activity className="w-5 h-5" />,
    color: BP.red,
    phase: 'Physical',
    details: [
      'Muscular fatigue index',
      'Cardiovascular load',
      'Sprint capacity remaining',
      'Injury risk assessment',
      'Optimal substitution timing',
    ],
  },
  {
    id: 'ai',
    label: 'Tactical AI',
    description: 'Process manager instructions via NLP',
    icon: <Brain className="w-5 h-5" />,
    color: '#E879F9',
    phase: 'Decision',
    details: [
      'Natural language parsing',
      'Instruction classification',
      'Confidence scoring',
      'Verification pipeline',
    ],
  },
  {
    id: 'output',
    label: 'Recommendations',
    description: 'Actionable tactical and physical alerts',
    icon: <TrendingUp className="w-5 h-5" />,
    color: '#34D399',
    phase: 'Output',
    details: [
      'Substitution intelligence',
      'Pressing adjustments',
      'Formation suggestions',
      'Player-specific warnings',
    ],
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
  { from: 'ai', to: 'coherence', label: 'instructions' },
  { from: 'fatigue', to: 'output', label: 'physical alerts' },
  { from: 'coherence', to: 'output', label: 'tactical alerts' },
];

// Layout positions for each node in a flow diagram
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

export function AlgorithmFlow() {
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
    <div className="h-full flex flex-col" style={{ background: BP.bg }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 py-3 flex items-center justify-between border-b"
        style={{ borderColor: BP.border }}
      >
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5" style={{ color: BP.blue }} />
          <div>
            <h2 className="text-sm font-semibold" style={{ color: BP.text }}>
              BigDunc Engine — Algorithm Pipeline
            </h2>
            <p className="text-xs" style={{ color: BP.textDim }}>
              Real-time tactical analysis flow
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: `${BP.green}22`, color: BP.green }}
          >
            8 modules
          </span>
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: `${BP.blue}22`, color: BP.blue }}
          >
            11 connections
          </span>
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative p-6 overflow-auto">
          {/* SVG edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {EDGES.map((edge) => {
              const from = NODE_POSITIONS[edge.from];
              const to = NODE_POSITIONS[edge.to];
              if (!from || !to) return null;

              const x1 = from.col * 200 + 140;
              const y1 = from.row * 140 + 70;
              const x2 = to.col * 200 + 60;
              const y2 = to.row * 140 + 70;
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
                    opacity={hoveredNode && !isActive ? 0.2 : 1}
                    className="transition-all duration-200"
                  />
                  {/* Arrow */}
                  <circle
                    cx={x2}
                    cy={y2}
                    r={3}
                    fill={isActive ? BP.blue : BP.border}
                    opacity={hoveredNode && !isActive ? 0.2 : 1}
                  />
                  {/* Edge label */}
                  {isActive && edge.label && (
                    <text
                      x={midX}
                      y={(y1 + y2) / 2 - 6}
                      textAnchor="middle"
                      fill={BP.textMuted}
                      fontSize="10"
                    >
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
                  left: pos.col * 200 + 24,
                  top: pos.row * 140 + 24,
                  width: 160,
                  transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                  zIndex: isHovered ? 10 : 1,
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() =>
                  setSelectedNode(selectedNode === node.id ? null : node.id)
                }
              >
                <div
                  className="rounded-lg p-3 border transition-all duration-200"
                  style={{
                    background: isSelected ? `${node.color}18` : BP.bgAlt,
                    borderColor: isHovered || isSelected ? node.color : BP.border,
                    boxShadow:
                      isHovered || isSelected
                        ? `0 0 20px ${node.color}30`
                        : 'none',
                  }}
                >
                  {/* Phase badge */}
                  <div
                    className="text-[9px] uppercase tracking-wider font-medium mb-2"
                    style={{ color: BP.textDim }}
                  >
                    {node.phase}
                  </div>

                  {/* Icon + Title */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div style={{ color: node.color }}>{node.icon}</div>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: BP.text }}
                    >
                      {node.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p
                    className="text-[10px] leading-relaxed"
                    style={{ color: BP.textMuted }}
                  >
                    {node.description}
                  </p>

                  {/* Connector indicator */}
                  <div className="flex items-center justify-end mt-2">
                    <ChevronRight
                      className="w-3 h-3"
                      style={{ color: BP.textDim }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div
          className="w-72 flex-shrink-0 border-l overflow-y-auto"
          style={{ borderColor: BP.border, background: BP.bgAlt }}
        >
          {selectedNodeData ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div style={{ color: selectedNodeData.color }}>
                  {selectedNodeData.icon}
                </div>
                <div>
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: BP.text }}
                  >
                    {selectedNodeData.label}
                  </h3>
                  <span
                    className="text-xs"
                    style={{ color: BP.textDim }}
                  >
                    {selectedNodeData.phase}
                  </span>
                </div>
              </div>

              <p
                className="text-xs mb-4 leading-relaxed"
                style={{ color: BP.textMuted }}
              >
                {selectedNodeData.description}
              </p>

              <div className="space-y-1.5">
                <span
                  className="text-[10px] uppercase tracking-wider font-medium"
                  style={{ color: BP.textDim }}
                >
                  Capabilities
                </span>
                {selectedNodeData.details.map((detail, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-2 py-1.5 rounded text-xs"
                    style={{
                      background: `${selectedNodeData.color}0D`,
                      color: BP.text,
                    }}
                  >
                    <Zap
                      className="w-3 h-3 mt-0.5 flex-shrink-0"
                      style={{ color: selectedNodeData.color }}
                    />
                    {detail}
                  </div>
                ))}
              </div>

              {/* Connections */}
              <div className="mt-4">
                <span
                  className="text-[10px] uppercase tracking-wider font-medium"
                  style={{ color: BP.textDim }}
                >
                  Connections
                </span>
                <div className="mt-1.5 space-y-1">
                  {EDGES.filter(
                    (e) =>
                      e.from === selectedNodeData.id ||
                      e.to === selectedNodeData.id
                  ).map((edge, i) => {
                    const isOutbound = edge.from === selectedNodeData.id;
                    const otherId = isOutbound ? edge.to : edge.from;
                    const otherNode = NODES.find((n) => n.id === otherId);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-2 py-1 rounded text-[11px]"
                        style={{ background: `${BP.border}80`, color: BP.textMuted }}
                      >
                        <span style={{ color: isOutbound ? BP.green : BP.blue }}>
                          {isOutbound ? '→' : '←'}
                        </span>
                        <span style={{ color: BP.text }}>
                          {otherNode?.label}
                        </span>
                        {edge.label && (
                          <span style={{ color: BP.textDim }}>
                            ({edge.label})
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-6 text-center">
              <div>
                <Zap
                  className="w-8 h-8 mx-auto mb-3"
                  style={{ color: BP.textDim }}
                />
                <p className="text-sm" style={{ color: BP.textMuted }}>
                  Click a module to see details
                </p>
                <p className="text-xs mt-1" style={{ color: BP.textDim }}>
                  Hover to highlight connections
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
