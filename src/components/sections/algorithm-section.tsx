'use client';

import { useState } from 'react';
import {
  Brain, Eye, Users, BarChart3, Target, Layers,
  ChevronDown, ChevronRight, Zap, Dna, ArrowRight,
  GitCompare, Activity, Shield, TrendingUp, Cpu,
} from 'lucide-react';

interface Algorithm {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  sourceFile: string;
  classes: string[];
  techniques: { name: string; detail: string }[];
  capabilities: string[];
  inputsFrom: string[];
  outputsTo: string[];
  keyMetrics: { label: string; value: string }[];
  deepDive: string;
}

const ALGORITHMS: Algorithm[] = [
  {
    id: 'tactical-ai',
    name: 'Tactical AI Engine',
    tagline: 'Reinforcement learning for real-time tactical decisions',
    description: 'A Q-Learning inspired agent that evaluates match context — score differential, possession, xG, momentum, fatigue — and recommends optimal tactical adjustments with confidence scoring and what-if scenario simulation.',
    icon: <Brain className="w-6 h-6" />,
    color: '#E879F9',
    sourceFile: 'src/lib/tactical-ai.ts',
    classes: ['TacticalQLearner', 'PatternRecognizer', 'TacticalAI'],
    techniques: [
      { name: 'Q-Learning', detail: 'State-action value function with learning rate 0.1, discount factor 0.95' },
      { name: 'Epsilon-Greedy', detail: 'Exploration rate 0.15 — balances exploitation with discovery' },
      { name: 'Monte Carlo Simulation', detail: '1,000 simulated runs per decision for confidence scoring' },
      { name: 'Opponent Modeling', detail: 'Tracks build-up style, preferred flank, pressing triggers, counter-attack speed' },
    ],
    capabilities: [
      'Formation change recommendations with expected impact on possession and xG',
      'Pressing intensity optimization (low / medium / high / max)',
      'Tempo shift analysis for game-state context',
      'Width and defensive line height tuning',
      'Player-specific instruction generation',
      'Substitution timing suggestions based on fatigue and tactical need',
      'What-if scenario simulation (1,000 Monte Carlo runs)',
      'Opponent build-up and counter-attack prediction',
    ],
    inputsFrom: ['Pattern Recognition Engine', 'Football Data API Ingestor'],
    outputsTo: ['Coherence Analysis', 'Recommendations Output'],
    keyMetrics: [
      { label: 'Q-Table States', value: '5' },
      { label: 'Decision Types', value: '7' },
      { label: 'Learning Rate', value: '0.1' },
      { label: 'Monte Carlo Runs', value: '1,000' },
    ],
    deepDive: 'Pre-populated Q-table covers 5 match states (winning_comfortable, winning_narrow, drawing, losing_narrow, losing_heavy) across 3 game phases (early, mid, late) and 3 pressure levels. Each state maps to 7 decision types: formation_change, pressing_intensity, tempo_shift, width_adjustment, defensive_line, player_specific, and substitution. The agent processes MatchContext including minute, scoreDifferential, possession%, xG differential, pressure index, momentum, and fatigue to produce TacticalDecisions with confidence (0-1), urgency (0-1), reasoning, and expected impact vectors.',
  },
  {
    id: 'pattern-recognition',
    name: 'Pattern Recognition Engine',
    tagline: 'Markov chain tactical pattern detection with 40+ pattern types',
    description: 'Detects, classifies, and tracks 40+ tactical patterns in real-time using positional data. Builds Markov chain state transition matrices to predict opponent sequences, identify recurrent patterns, and measure tactical coherence against the game model.',
    icon: <Eye className="w-6 h-6" />,
    color: '#2D72D2',
    sourceFile: 'src/lib/pattern-recognition.ts',
    classes: ['PatternRecognitionEngine'],
    techniques: [
      { name: 'Markov Chains', detail: 'State transition matrices tracking pattern-to-pattern probabilities per team' },
      { name: 'Sequence Detection', detail: 'Recurrent subsequences of length 2-5 detected within 3-minute windows' },
      { name: 'Confidence Decay', detail: 'Pattern confidence decays at 0.95 per minute without observation' },
      { name: 'Compounding Effects', detail: 'Synergy (+0.15), counter (-0.2), fatigue, psychological, and positional effects' },
    ],
    capabilities: [
      '14 attacking patterns: overloads, combinations, third man runs, halfspace penetration, channel runs, crosses',
      '10 defensive patterns: high press, mid/low block, press traps, cover shadow, zonal/man marking, offside trap',
      '5 transition patterns: counter-attack, counter-press, quick restart, possession recovery',
      '6 build-up patterns: play from back, long ball outlet, GK sweep, split CBs, pivots',
      'Markov chain state prediction — predict next pattern from current chain',
      'Recurrent sequence detection (2-5 pattern chains with occurrence tracking)',
      'Compounding effects: synergy, fatigue, psychological, positional, tactical shifts',
      'Game model coherence scoring (0-100) against positional play, counter-attacking, high pressing, direct play, tiki-taka',
    ],
    inputsFrom: ['Catapult GPS/IMU Ingestor', 'Wearable Analytics Ingestor'],
    outputsTo: ['Tactical AI Engine', 'Coherence Analysis'],
    keyMetrics: [
      { label: 'Pattern Types', value: '40+' },
      { label: 'Sequence Length', value: '2-5' },
      { label: 'Decay Rate', value: '0.95/min' },
      { label: 'Game Models', value: '5' },
    ],
    deepDive: 'The engine classifies patterns across 4 categories: attacking (14 types including overload_left/right/central, switch_play, quick_combination, third_man_run, underlap, overlap, inverted_fullback, false_nine_drop, halfspace_penetration, channel_run, cutback/early/low crosses), defensive (10 types), transition (5 types), and build-up (6 types). Each pattern carries confidence (0-1), frequency count, zone classification, counter-pattern reference, and synergy list. The Markov chain maintains per-team transition matrices, recurrent sequence detection up to length 5, and pattern prediction with probability scores.',
  },
  {
    id: 'multi-agent',
    name: 'Multi-Agent System',
    tagline: 'Boid-based movement modeling with genetic algorithm evolution',
    description: 'Simulates all 22 players as autonomous agents with boid-based flocking behaviors (separation, alignment, cohesion) combined with tactical behaviors. Includes a genetic algorithm that evolves player trait profiles across generations.',
    icon: <Users className="w-6 h-6" />,
    color: '#0EA5E9',
    sourceFile: 'src/lib/multi-agent-system.ts',
    classes: ['BoidSystem', 'GegenpressingSystem', 'TacticalGeneticAlgorithm', 'MultiAgentController'],
    techniques: [
      { name: 'Boid Algorithm', detail: 'Separation (8m), Alignment (15m), Cohesion (25m) radius calculations' },
      { name: 'Genetic Algorithm', detail: 'Tournament selection, single-point crossover, Gaussian mutation (rate 0.1)' },
      { name: 'Force Composition', detail: 'Max speed 8 m/s, max force 5 m/s² — weighted sum of behavioral vectors' },
      { name: 'Gegenpressing Model', detail: 'Coordinated high-press trigger system with formation-aware positioning' },
    ],
    capabilities: [
      'Separation forces — avoid crowding teammates (8m perception radius)',
      'Alignment forces — match velocity of nearby teammates (15m radius)',
      'Cohesion forces — move toward center of teammates (25m radius)',
      'Space-seeking behavior for optimal positioning',
      'Opponent marking and cover shadow (passing lane blocking)',
      'Attacking run generation with timing intelligence',
      'Gegenpressing trigger system for coordinated high press',
      '8-trait genetic evolution: pressing sensitivity, space recognition, run timing, defensive awareness, offensive creativity, teamwork, risk tolerance, adaptability',
    ],
    inputsFrom: ['Catapult GPS/IMU Ingestor', 'Tactical AI Engine'],
    outputsTo: ['Pattern Recognition Engine', 'Digital Twin System'],
    keyMetrics: [
      { label: 'Agent Count', value: '22' },
      { label: 'Behaviors', value: '9' },
      { label: 'Evolved Traits', value: '8' },
      { label: 'Max Speed', value: '8 m/s' },
    ],
    deepDive: 'Each agent calculates 9 behavioral force vectors: separation, alignment, cohesion, seek_ball, seek_space, mark_opponent, maintain_formation, press_carrier, and cover_passing_lane. Forces are weighted and clamped to max acceleration of 5 m/s². The TacticalGeneticAlgorithm evolves 8 traits per player using tournament selection (size 3), single-point crossover (rate 0.7), and Gaussian mutation (rate 0.1, sigma 0.15). Agents also carry stamina and awareness (game reading 0-100) properties that decay during high-intensity actions.',
  },
  {
    id: 'analytics-engine',
    name: 'Analytics Engine',
    tagline: 'xG model, graph-theory passing networks, pressing trap detection',
    description: 'Comprehensive analytics suite including an Expected Goals model with 7 modifiers, graph-theory passing network analysis with eigenvector/betweenness centrality, heatmap generation, pressing trap detection across 5 trap types, and phase transition analysis.',
    icon: <BarChart3 className="w-6 h-6" />,
    color: '#C87619',
    sourceFile: 'src/lib/analytics-engine.ts',
    classes: ['xGModel', 'PassingNetworkAnalyzer', 'HeatmapGenerator', 'PressingTrapDetector', 'PhaseTransitionAnalyzer', 'AnalyticsEngine'],
    techniques: [
      { name: 'Exponential Decay xG', detail: 'Base probability from distance/angle with 7 contextual modifiers' },
      { name: 'Eigenvector Centrality', detail: 'Power iteration method — identifies most influential passers in the network' },
      { name: 'Betweenness Centrality', detail: 'Shortest-path analysis — finds players who connect different zones' },
      { name: 'Graph Density Analysis', detail: 'Network metrics: density, clustering coefficient, average path length' },
    ],
    capabilities: [
      'Expected Goals model: base xG from position + distance, angle, body part, pressure, assist type, game state modifiers',
      'Passing network construction: nodes (pass count, reception, centrality), edges (weight, distance, progressive, success rate)',
      'Eigenvector centrality — influence scoring to identify creative hubs',
      'Betweenness centrality — hub detection for players connecting zones',
      'Network metrics: density (0-1), clustering coefficient, average path length, isolated players, strong connections',
      'Heatmap generation with configurable resolution and hotspot detection',
      'Pressing trap detection across 5 types: sideline, corner, halfspace, central, goalkeeper',
      'Phase transition analysis with momentum shift detection',
    ],
    inputsFrom: ['Football Data API Ingestor', 'Pattern Recognition Engine'],
    outputsTo: ['Coherence Analysis', 'Tactical AI Engine'],
    keyMetrics: [
      { label: 'xG Modifiers', value: '7' },
      { label: 'Trap Types', value: '5' },
      { label: 'Network Metrics', value: '6' },
      { label: 'Classes', value: '6' },
    ],
    deepDive: 'The xG model calculates base probability from shot position using exponential distance decay and angle weighting, then applies 7 modifiers: distance (0.5-1.2x), angle (0.3-1.0x), body_part (foot 1.0x, head 0.85x, other 0.6x), pressure (none 1.1x, low 1.0x, high 0.75x), assist_type (through_ball 1.3x, cross 0.85x, cutback 1.15x), and game_state modifiers. The PassingNetworkAnalyzer builds a full directed graph with progressive pass tracking, then runs eigenvector centrality via power iteration (tolerance 1e-6) and betweenness centrality via modified Dijkstra.',
  },
  {
    id: 'coherence-analysis',
    name: 'Coherence Analysis',
    tagline: 'Game model adherence scoring across every player and phase',
    description: 'Measures how well the team executes the chosen game model in real-time. Scores are computed per-player across four dimensions — position, physical output, movement patterns, and tactical role — then aggregated by phase and principle for comprehensive coherence reports.',
    icon: <Target className="w-6 h-6" />,
    color: '#238551',
    sourceFile: 'src/lib/coherence-analysis.ts',
    classes: ['calculateCoherence', 'updateCoherenceInRealTime', 'generateCoherenceAlerts'],
    techniques: [
      { name: 'Exponential Moving Average', detail: 'Smooths coherence fluctuations with configurable alpha weighting' },
      { name: 'Multi-Factor Scoring', detail: '4-dimension weighted average: position (30%), physical (25%), movement (25%), role (20%)' },
      { name: 'Deviation Detection', detail: 'Identifies critical deviations with severity classification and auto-recommendations' },
      { name: 'Historical Comparison', detail: 'Compares current coherence against rolling session averages' },
    ],
    capabilities: [
      'Per-player coherence scoring on a 0-100 scale',
      'Position adherence — 30% weight: expected vs actual position within tolerance',
      'Physical output adherence — 25% weight: distance, sprints, high-intensity runs vs baseline',
      'Movement pattern adherence — 25% weight: overlaps, runs, positioning sequences',
      'Tactical role execution — 20% weight: responsibilities, passing options, defensive duties',
      'Phase-level coherence: build-up, progression, final third, pressing, transitions',
      'Principle-level adherence: per in-possession, out-of-possession, and transition principle',
      'Critical deviation detection with auto-generated recommendations and suggested actions',
    ],
    inputsFrom: ['Pattern Recognition Engine', 'Wearable Analytics Ingestor'],
    outputsTo: ['Digital Twin System', 'Recommendations Output'],
    keyMetrics: [
      { label: 'Score Range', value: '0-100' },
      { label: 'Dimensions', value: '4' },
      { label: 'Game Phases', value: '7' },
      { label: 'Alert Levels', value: '3' },
    ],
    deepDive: 'The system accepts a GameModel definition with formation, principles (in/out of possession + transitions), phase instructions, pressure triggers, and player instructions. For each player it computes: positionAdherence by comparing GPS position to FormationPosition base with movementRange tolerance; physicalAdherence by comparing TrackingMetrics against PhysicalRequirements baselines; movementAdherence by tracking PlayerMovement patterns against expected sequences; and roleAdherence by scoring responsibility execution. The final coherenceScore is the weighted sum (0.30 + 0.25 + 0.25 + 0.20), aggregated into CoherenceReport with byPhase, byPlayer, and byPrinciple breakdowns.',
  },
  {
    id: 'digital-twin',
    name: 'Digital Twin System',
    tagline: 'Player behavioral models with fatigue, readiness, and decision profiling',
    description: 'Creates and maintains digital twin models for every player — tracking fatigue trajectories, decision tendencies, physical limits, and reaction times. Enables comparison of actual performance against predicted baselines with historical trend analysis.',
    icon: <Layers className="w-6 h-6" />,
    color: '#CD4246',
    sourceFile: 'src/lib/digital-twin.ts',
    classes: ['createDigitalTwin'],
    techniques: [
      { name: 'Behavioral Modeling', detail: 'Movement patterns with frequency, duration, distance, and triggering conditions' },
      { name: 'Performance Baselining', detail: 'Average and peak metrics computed from historical TrackingMetrics sessions' },
      { name: 'Trend Analysis', detail: 'Weekly, monthly, and seasonal trends with improving/stable/declining classification' },
      { name: 'Adaptation Tracking', detail: 'Records tactical, physical, and technical adaptations with impact scoring (-100 to +100)' },
    ],
    capabilities: [
      'Twin state tracking: fatigue (0-100), readiness (0-100), confidence level, current work rate',
      'Position adherence tracking — how well player holds formation under fatigue',
      'Tactical compliance scoring — instruction execution rate',
      'Movement pattern analysis: type, frequency, avg duration, avg distance, conditions',
      'Decision tendency modeling: situation → likely action with probability distribution',
      'Physical limits calculation: max sustainable speed, sprint recovery time, high-intensity capacity',
      'Reaction time profiling: pressure trigger, transition response, positional adjustment',
      'Historical trend analysis across weekly, monthly, and seasonal periods',
    ],
    inputsFrom: ['Catapult GPS/IMU Ingestor', 'Wearable Analytics Ingestor'],
    outputsTo: ['Coherence Analysis', 'Recommendations Output'],
    keyMetrics: [
      { label: 'State Dimensions', value: '6' },
      { label: 'Trend Periods', value: '3' },
      { label: 'Reaction Types', value: '3' },
      { label: 'Adaptation Types', value: '3' },
    ],
    deepDive: 'Each DigitalTwin contains a TwinState (fatigue, readiness, confidenceLevel, currentWorkRate, positionAdherence, tacticalCompliance), a BehaviorModel (movementPatterns, decisionTendencies, physicalLimits, reactionTimes), and a PerformanceBaseline (average/peak TrackingMetrics with historicalTrends). DecisionTendency maps situations to probability distributions over actions. PhysicalLimits tracks maxSustainableSpeed, sprintRecoveryTime, highIntensityCapacity, and fatigueThreshold. Adaptations log changes with date, type, description, impact (-100 to 100), and duration (temporary/permanent).',
  },
];

function AlgorithmCard({ algo, isExpanded, onToggle }: { algo: Algorithm; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div
      className={`rounded-xl border transition-all duration-300 ${
        isExpanded ? 'border-opacity-100' : ''
      }`}
      style={{
        background: isExpanded ? `${algo.color}06` : 'var(--surface)',
        borderColor: isExpanded ? algo.color : 'var(--border)',
      }}
    >
      {/* Header */}
      <button
        className="w-full text-left p-6 flex items-start gap-5"
        onClick={onToggle}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${algo.color}15` }}
        >
          <div style={{ color: algo.color }}>{algo.icon}</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-heading-3 text-[#F6F7F9]">{algo.name}</h3>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: `${algo.color}20`, color: algo.color }}
            >
              Active
            </span>
          </div>
          <p className="text-sm text-[#8F99A8]">{algo.tagline}</p>

          {/* Metrics strip (always visible) */}
          <div className="flex items-center gap-4 mt-3">
            {algo.keyMetrics.map((m) => (
              <div key={m.label} className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-[#F6F7F9] font-mono tabular-nums">{m.value}</span>
                <span className="text-[11px] text-[#5F6B7C]">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 mt-2">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-[#5F6B7C]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[#5F6B7C]" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* Description */}
          <p className="text-body mt-5 mb-6">{algo.description}</p>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Techniques */}
            <div>
              <div className="text-overline mb-3" style={{ color: algo.color }}>
                Core Techniques
              </div>
              <div className="space-y-3">
                {algo.techniques.map((t) => (
                  <div key={t.name} className="p-3 rounded-lg" style={{ background: `${algo.color}08` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Dna className="w-3.5 h-3.5" style={{ color: algo.color }} />
                      <span className="text-sm font-semibold text-[#F6F7F9]">{t.name}</span>
                    </div>
                    <p className="text-xs text-[#8F99A8] leading-relaxed">{t.detail}</p>
                  </div>
                ))}
              </div>

              {/* Classes */}
              <div className="text-overline mt-5 mb-2">Implementation</div>
              <div className="space-y-1">
                {algo.classes.map((c) => (
                  <div key={c} className="text-xs font-mono px-2 py-1 rounded bg-[#2F343C]/50" style={{ color: algo.color }}>
                    {c}
                  </div>
                ))}
              </div>
              <div className="text-[11px] font-mono text-[#5F6B7C] mt-2">{algo.sourceFile}</div>
            </div>

            {/* Capabilities */}
            <div className="lg:col-span-2">
              <div className="text-overline mb-3" style={{ color: algo.color }}>
                Full Capabilities
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {algo.capabilities.map((cap) => (
                  <div key={cap} className="flex items-start gap-2 p-2.5 rounded-lg bg-[#2F343C]/30">
                    <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: algo.color }} />
                    <span className="text-sm text-[#C5CBD3] leading-snug">{cap}</span>
                  </div>
                ))}
              </div>

              {/* I/O */}
              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <div>
                  <div className="text-overline mb-2 text-[#0EA5E9]">Inputs From</div>
                  {algo.inputsFrom.map((input) => (
                    <div key={input} className="flex items-center gap-2 text-sm text-[#8F99A8] py-0.5">
                      <ArrowRight className="w-3 h-3 text-[#0EA5E9]" /> {input}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-overline mb-2 text-[#238551]">Outputs To</div>
                  {algo.outputsTo.map((output) => (
                    <div key={output} className="flex items-center gap-2 text-sm text-[#8F99A8] py-0.5">
                      <ArrowRight className="w-3 h-3 text-[#238551]" /> {output}
                    </div>
                  ))}
                </div>
              </div>

              {/* Deep dive */}
              <div className="mt-5 p-4 rounded-lg border border-[#2F343C] bg-[#1C2127]">
                <div className="text-overline mb-2">Technical Deep Dive</div>
                <p className="text-xs text-[#8F99A8] leading-relaxed">{algo.deepDive}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AlgorithmSection() {
  const [expandedId, setExpandedId] = useState<string | null>('tactical-ai');

  return (
    <section id="algorithms" className="section-full">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-overline mb-3 text-[#7961DB]">Algorithms</div>
          <h2 className="text-heading-1 text-[#F6F7F9] mb-4">
            Six engines. Zero guesswork.
          </h2>
          <p className="text-body-large">
            Each algorithm module is purpose-built for a specific analytical domain.
            Together they form a complete tactical intelligence pipeline.
          </p>
        </div>

        {/* Algorithm cards */}
        <div className="space-y-4 max-w-5xl mx-auto">
          {ALGORITHMS.map((algo) => (
            <AlgorithmCard
              key={algo.id}
              algo={algo}
              isExpanded={expandedId === algo.id}
              onToggle={() => setExpandedId(expandedId === algo.id ? null : algo.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
