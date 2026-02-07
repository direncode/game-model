'use client';

import { useState } from 'react';
import {
  Brain,
  GitCompare,
  Target,
  Layers,
  BarChart3,
  Users,
  Dna,
  Eye,
  Zap,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

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

interface AlgorithmModule {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  sourceFile: string;
  classes: string[];
  techniques: string[];
  inputsFrom: string[];
  outputsTo: string[];
  capabilities: string[];
}

const ALGORITHMS: AlgorithmModule[] = [
  {
    id: 'tactical-ai',
    name: 'Tactical AI Engine',
    description: 'Q-Learning inspired reinforcement learning agent for real-time tactical decisions',
    icon: <Brain className="w-5 h-5" />,
    color: '#E879F9',
    sourceFile: 'src/lib/tactical-ai.ts',
    classes: ['TacticalQLearner', 'PatternRecognizer', 'TacticalAI'],
    techniques: ['Q-Learning', 'Epsilon-greedy exploration', 'Monte Carlo simulation', 'Reinforcement learning'],
    inputsFrom: ['Pattern Recognition', 'Ingestor: Football Data API'],
    outputsTo: ['Coherence Analysis', 'Recommendations Output'],
    capabilities: [
      'Formation change recommendations',
      'Pressing intensity adjustment',
      'Tempo shift analysis',
      'Width and defensive line tuning',
      'Player-specific instruction generation',
      'Substitution timing suggestions',
      'What-if scenario simulation (1000 Monte Carlo runs)',
      'Opponent pattern prediction',
    ],
  },
  {
    id: 'pattern-recognition',
    name: 'Pattern Recognition Engine',
    description: 'Markov chain tactical pattern detection with 40+ pattern types and compounding effects',
    icon: <Eye className="w-5 h-5" />,
    color: BP.blue,
    sourceFile: 'src/lib/pattern-recognition.ts',
    classes: ['PatternRecognitionEngine'],
    techniques: ['Markov Chains', 'State transition matrices', 'Sequence detection', 'Confidence decay'],
    inputsFrom: ['Ingestor: Catapult GPS', 'Ingestor: Wearable Analytics'],
    outputsTo: ['Tactical AI', 'Coherence Analysis'],
    capabilities: [
      '40+ tactical pattern types (attacking, defensive, transition, build-up)',
      'Markov chain state prediction',
      'Recurrent sequence detection (2-5 pattern chains)',
      'Compounding effects: synergy, fatigue, psychological, positional',
      'Pattern confidence decay over time',
      'Game model coherence scoring (0-100)',
      'Counter-pattern identification',
      'Zone-based pattern classification',
    ],
  },
  {
    id: 'multi-agent',
    name: 'Multi-Agent System',
    description: 'Boid-based agent modeling for off-ball movement with genetic algorithm evolution',
    icon: <Users className="w-5 h-5" />,
    color: BP.cyan,
    sourceFile: 'src/lib/multi-agent-system.ts',
    classes: ['BoidSystem', 'GegenpressingSystem', 'TacticalGeneticAlgorithm', 'MultiAgentController'],
    techniques: ['Boid algorithms', 'Genetic algorithms', 'Tournament selection', 'Gaussian mutation'],
    inputsFrom: ['Ingestor: Catapult GPS', 'Tactical AI'],
    outputsTo: ['Pattern Recognition', 'Digital Twin'],
    capabilities: [
      'Separation, alignment, cohesion forces',
      'Space-seeking behavior algorithms',
      'Opponent marking calculations',
      'Cover shadow (passing lane blocking)',
      'Attacking run generation',
      'Gegenpressing trigger system',
      '8-trait genetic evolution (pressing sensitivity, space recognition, etc.)',
      'Formation-aware positioning',
    ],
  },
  {
    id: 'analytics-engine',
    name: 'Analytics Engine',
    description: 'xG model, graph-theory passing networks, heatmaps, pressing trap detection',
    icon: <BarChart3 className="w-5 h-5" />,
    color: BP.orange,
    sourceFile: 'src/lib/analytics-engine.ts',
    classes: ['xGModel', 'PassingNetworkAnalyzer', 'HeatmapGenerator', 'PressingTrapDetector', 'PhaseTransitionAnalyzer', 'AnalyticsEngine'],
    techniques: ['Exponential decay xG', 'Eigenvector centrality', 'Betweenness centrality', 'Power iteration'],
    inputsFrom: ['Ingestor: Football Data API', 'Pattern Recognition'],
    outputsTo: ['Coherence Analysis', 'Tactical AI'],
    capabilities: [
      'Expected Goals model with 7 modifiers',
      'Passing network graph analysis (density, clustering, path length)',
      'Eigenvector centrality (influence scoring)',
      'Betweenness centrality (hub detection)',
      'Heatmap generation with hotspot detection',
      'Pressing trap detection (5 trap types)',
      'Phase transition analysis and prediction',
      'Progressive passing pattern detection',
    ],
  },
  {
    id: 'coherence-analysis',
    name: 'Coherence Analysis',
    description: 'Game model adherence scoring — position, physical, movement, and role execution',
    icon: <Target className="w-5 h-5" />,
    color: BP.green,
    sourceFile: 'src/lib/coherence-analysis.ts',
    classes: ['calculateCoherence', 'updateCoherenceInRealTime', 'generateCoherenceAlerts'],
    techniques: ['Exponential moving average', 'Multi-factor scoring', 'Deviation detection'],
    inputsFrom: ['Pattern Recognition', 'Ingestor: Wearable Analytics'],
    outputsTo: ['Digital Twin', 'Recommendations Output'],
    capabilities: [
      'Per-player coherence scoring (0-100)',
      'Position adherence (30% weight)',
      'Physical output adherence (25% weight)',
      'Movement pattern adherence (25% weight)',
      'Tactical role execution (20% weight)',
      'Phase-level coherence analysis',
      'Principle-level adherence scoring',
      'Critical deviation detection with auto-recommendations',
    ],
  },
  {
    id: 'digital-twin',
    name: 'Digital Twin System',
    description: 'Player behavioral models — fatigue, readiness, position adherence, tactical compliance',
    icon: <Layers className="w-5 h-5" />,
    color: BP.red,
    sourceFile: 'src/lib/digital-twin.ts',
    classes: ['createDigitalTwin'],
    techniques: ['Behavioral modeling', 'Performance baseline', 'Trend analysis'],
    inputsFrom: ['Ingestor: Catapult GPS', 'Ingestor: Wearable Analytics'],
    outputsTo: ['Coherence Analysis', 'Recommendations Output'],
    capabilities: [
      'Twin state tracking (fatigue, readiness, confidence)',
      'Movement pattern analysis',
      'Decision tendency modeling',
      'Physical limits calculation',
      'Reaction time profiling',
      'Historical trend analysis (weekly/monthly/seasonal)',
      'Adaptation tracking (tactical/physical/technical)',
      'Performance baseline comparison',
    ],
  },
];

export function AlgorithmModules() {
  const [expandedModule, setExpandedModule] = useState<string | null>('tactical-ai');

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: BP.bg }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: BP.text }}>
              Algorithm Modules
            </h2>
            <p className="text-xs mt-0.5" style={{ color: BP.textDim }}>
              Core analysis engines — click to explore capabilities
            </p>
          </div>
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: `${BP.green}22`, color: BP.green }}
          >
            {ALGORITHMS.length} modules loaded
          </span>
        </div>

        <div className="grid gap-3">
          {ALGORITHMS.map((algo) => {
            const isExpanded = expandedModule === algo.id;

            return (
              <div
                key={algo.id}
                className="rounded-lg border transition-all duration-200"
                style={{
                  background: isExpanded ? `${algo.color}06` : BP.bgAlt,
                  borderColor: isExpanded ? algo.color : BP.border,
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedModule(isExpanded ? null : algo.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${algo.color}18` }}
                    >
                      <div style={{ color: algo.color }}>{algo.icon}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold" style={{ color: BP.text }}>
                          {algo.name}
                        </h3>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                          style={{ background: `${BP.green}22`, color: BP.green }}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" /> active
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: BP.textMuted }}>
                        {algo.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: BP.textDim }}>
                        Techniques
                      </div>
                      <div className="text-[11px]" style={{ color: BP.textMuted }}>
                        {algo.techniques.length}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" style={{ color: BP.textDim }} />
                    ) : (
                      <ChevronRight className="w-4 h-4" style={{ color: BP.textDim }} />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: BP.border }}>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      {/* Techniques */}
                      <div>
                        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: BP.textDim }}>
                          Techniques
                        </div>
                        <div className="space-y-1">
                          {algo.techniques.map((t, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded"
                              style={{ background: `${algo.color}0D`, color: BP.text }}
                            >
                              <Dna className="w-3 h-3 flex-shrink-0" style={{ color: algo.color }} />
                              {t}
                            </div>
                          ))}
                        </div>

                        <div className="text-[10px] uppercase tracking-wider mt-3 mb-2" style={{ color: BP.textDim }}>
                          Classes
                        </div>
                        <div className="space-y-1">
                          {algo.classes.map((c, i) => (
                            <div key={i} className="text-[11px] font-mono px-2 py-0.5" style={{ color: algo.color }}>
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Capabilities */}
                      <div className="col-span-2">
                        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: BP.textDim }}>
                          Capabilities
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {algo.capabilities.map((cap, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-1.5 text-[11px] px-2 py-1.5 rounded"
                              style={{ background: `${BP.border}80`, color: BP.text }}
                            >
                              <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: algo.color }} />
                              {cap}
                            </div>
                          ))}
                        </div>

                        {/* I/O */}
                        <div className="flex gap-4 mt-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: BP.textDim }}>
                              Inputs from
                            </div>
                            {algo.inputsFrom.map((input, i) => (
                              <div key={i} className="text-[11px] flex items-center gap-1" style={{ color: BP.cyan }}>
                                <ChevronRight className="w-3 h-3" /> {input}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: BP.textDim }}>
                              Outputs to
                            </div>
                            {algo.outputsTo.map((output, i) => (
                              <div key={i} className="text-[11px] flex items-center gap-1" style={{ color: BP.green }}>
                                <ChevronRight className="w-3 h-3" /> {output}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-[10px] font-mono" style={{ color: BP.textDim }}>
                      {algo.sourceFile}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
