'use client';

import { useState } from 'react';

interface Algorithm {
  id: string;
  num: string;
  name: string;
  tagline: string;
  body: string;
  techniques: string[];
  capabilities: string[];
  implementation: string;
  metrics: { label: string; value: string }[];
}

const ALGORITHMS: Algorithm[] = [
  {
    id: 'tactical-ai',
    num: '01',
    name: 'Tactical AI Engine',
    tagline: 'Q-Learning reinforcement learning agent for real-time tactical decisions',
    body: 'A reinforcement learning agent that evaluates match context — score differential, possession percentage, expected goals differential, momentum, and fatigue — to recommend optimal tactical adjustments. The Q-table maps five match states across three game phases and three pressure levels to seven decision types. Each decision carries a confidence score, urgency rating, reasoning chain, and expected impact on possession and xG.',
    techniques: [
      'Q-Learning with learning rate 0.1, discount factor 0.95, and epsilon-greedy exploration at 0.15',
      'Monte Carlo simulation — 1,000 runs per decision for confidence scoring',
      'Opponent modeling tracking build-up style, preferred flank, pressing triggers, and counter-attack speed',
      'Pre-populated Q-table covering winning_comfortable, winning_narrow, drawing, losing_narrow, and losing_heavy states',
    ],
    capabilities: [
      'Formation change recommendations with expected impact vectors',
      'Pressing intensity optimization across low, medium, high, and max bands',
      'Tempo shift analysis contextualized to game state',
      'Width and defensive line height tuning',
      'Player-specific instruction generation',
      'Substitution timing suggestions based on fatigue and tactical need',
      'What-if scenario simulation across 1,000 Monte Carlo runs',
      'Opponent build-up pattern prediction and counter-attack speed estimation',
    ],
    implementation: 'TacticalQLearner, PatternRecognizer, TacticalAI — src/lib/tactical-ai.ts',
    metrics: [
      { label: 'Q-Table States', value: '5' },
      { label: 'Decision Types', value: '7' },
      { label: 'Monte Carlo Runs', value: '1,000' },
      { label: 'Learning Rate', value: '0.1' },
    ],
  },
  {
    id: 'pattern-recognition',
    num: '02',
    name: 'Pattern Recognition Engine',
    tagline: 'Markov chain tactical pattern detection with 40+ pattern types',
    body: 'Detects, classifies, and tracks over forty tactical patterns in real-time using positional data. Builds Markov chain state transition matrices per team to predict pattern sequences, identify recurrent chains, and measure tactical coherence against the game model. Pattern confidence decays at 0.95 per minute without observation. Compounding effects model synergy, fatigue, psychological, and positional interactions between concurrent patterns.',
    techniques: [
      'Markov chain state transition matrices tracking pattern-to-pattern probabilities per team',
      'Recurrent subsequence detection for chains of length 2 to 5 within 3-minute windows',
      'Confidence decay at 0.95 per minute without fresh observation',
      'Compounding effects: synergy (+0.15), counter (-0.2), fatigue, psychological, and positional modifiers',
    ],
    capabilities: [
      '14 attacking patterns — overloads, combinations, third man runs, halfspace penetration, channel runs, crosses, cutbacks',
      '10 defensive patterns — high press trigger, mid block, low block, press traps, cover shadow, zonal and man marking, offside trap',
      '5 transition patterns — counter-attack, counter-press, quick restart, possession recovery, controlled transition',
      '6 build-up patterns — play from back, long ball outlet, goalkeeper sweep, split centre-backs, double pivot, single pivot',
      'Markov chain state prediction from current chain position',
      'Counter-pattern identification and synergy detection',
      'Game model coherence scoring from 0 to 100 against positional play, counter-attacking, high pressing, direct play, and tiki-taka models',
      'Zone-based pattern classification across defensive, middle, and attacking thirds',
    ],
    implementation: 'PatternRecognitionEngine — src/lib/pattern-recognition.ts',
    metrics: [
      { label: 'Pattern Types', value: '40+' },
      { label: 'Sequence Length', value: '2–5' },
      { label: 'Decay Rate', value: '0.95/min' },
      { label: 'Game Models', value: '5' },
    ],
  },
  {
    id: 'multi-agent',
    num: '03',
    name: 'Multi-Agent System',
    tagline: 'Boid-based autonomous movement with genetic algorithm evolution',
    body: 'Models all twenty-two players as autonomous agents with boid-based flocking behaviours — separation, alignment, and cohesion — combined with tactical force vectors for space-seeking, opponent marking, and formation maintenance. A genetic algorithm evolves eight player trait profiles across generations using tournament selection, single-point crossover, and Gaussian mutation.',
    techniques: [
      'Boid algorithm with separation (8m radius), alignment (15m), and cohesion (25m) perception ranges',
      'Force composition with maximum speed 8 m/s and maximum force 5 m/s squared',
      'Genetic algorithm with tournament selection (size 3), single-point crossover (rate 0.7), Gaussian mutation (rate 0.1, sigma 0.15)',
      'Gegenpressing trigger system for coordinated high press with formation-aware positioning',
    ],
    capabilities: [
      'Separation forces to avoid crowding teammates within 8-metre perception radius',
      'Alignment forces to match velocity of nearby teammates within 15-metre radius',
      'Cohesion forces to move toward centre of teammate cluster within 25-metre radius',
      'Space-seeking behaviour for optimal off-ball positioning',
      'Opponent marking and cover shadow calculation for passing lane blocking',
      'Attacking run generation with timing intelligence',
      'Gegenpressing trigger system for coordinated high press',
      '8-trait genetic evolution — pressing sensitivity, space recognition, run timing, defensive awareness, offensive creativity, teamwork, risk tolerance, adaptability',
    ],
    implementation: 'BoidSystem, GegenpressingSystem, TacticalGeneticAlgorithm, MultiAgentController — src/lib/multi-agent-system.ts',
    metrics: [
      { label: 'Agents', value: '22' },
      { label: 'Behaviours', value: '9' },
      { label: 'Evolved Traits', value: '8' },
      { label: 'Max Speed', value: '8 m/s' },
    ],
  },
  {
    id: 'analytics',
    num: '04',
    name: 'Analytics Engine',
    tagline: 'Expected goals model, graph-theory passing networks, pressing trap detection',
    body: 'A comprehensive analytics suite containing an expected goals model with seven contextual modifiers, graph-theory passing network analysis using eigenvector and betweenness centrality, configurable heatmap generation with hotspot detection, pressing trap identification across five trap types, and phase transition analysis with momentum shift detection.',
    techniques: [
      'Exponential decay xG model with base probability from shot position and seven contextual modifiers',
      'Eigenvector centrality via power iteration (tolerance 1e-6) for creative hub identification',
      'Betweenness centrality via modified Dijkstra for zone connector detection',
      'Graph density, clustering coefficient, and average path length computation',
    ],
    capabilities: [
      'Expected goals with modifiers for distance, angle, body part, pressure, assist type, game state, and shot type',
      'Passing network graph construction with progressive pass tracking and success rate',
      'Eigenvector centrality — influence scoring to identify the most creative passers',
      'Betweenness centrality — hub detection for players connecting different zones',
      'Network metrics including density, clustering coefficient, average path length, isolated players, and strong connections',
      'Heatmap generation with configurable resolution and automatic hotspot detection',
      'Pressing trap detection across sideline, corner, halfspace, central, and goalkeeper trap types',
      'Phase transition analysis with tactical momentum shift detection',
    ],
    implementation: 'xGModel, PassingNetworkAnalyzer, HeatmapGenerator, PressingTrapDetector, PhaseTransitionAnalyzer, AnalyticsEngine — src/lib/analytics-engine.ts',
    metrics: [
      { label: 'xG Modifiers', value: '7' },
      { label: 'Trap Types', value: '5' },
      { label: 'Network Metrics', value: '6' },
      { label: 'Classes', value: '6' },
    ],
  },
  {
    id: 'coherence',
    num: '05',
    name: 'Coherence Analysis',
    tagline: 'Game model adherence scoring across every player and every phase',
    body: 'Measures how well the team executes the chosen game model in real-time. Scores are computed per player across four weighted dimensions — position adherence at 30%, physical output at 25%, movement patterns at 25%, and tactical role execution at 20%. Results aggregate by phase and by principle for comprehensive coherence reports with critical deviation detection and auto-generated recommendations.',
    techniques: [
      'Exponential moving average to smooth coherence fluctuations with configurable alpha',
      'Four-dimension weighted scoring — position (30%), physical (25%), movement (25%), role (20%)',
      'Deviation detection with severity classification at minor, moderate, and major levels',
      'Historical comparison against rolling session averages',
    ],
    capabilities: [
      'Per-player coherence scoring on a 0 to 100 scale',
      'Position adherence — expected versus actual GPS position within formation tolerance',
      'Physical output adherence — distance, sprints, and high-intensity runs versus baseline',
      'Movement pattern adherence — overlaps, runs, and positioning sequences versus expectations',
      'Tactical role execution — responsibility completion, passing options used, defensive duties fulfilled',
      'Phase-level coherence across build-up, progression, final third, pressing, and transitions',
      'Principle-level adherence for in-possession, out-of-possession, and transition principles',
      'Critical deviation detection with auto-generated suggested actions',
    ],
    implementation: 'calculateCoherence, updateCoherenceInRealTime, generateCoherenceAlerts — src/lib/coherence-analysis.ts',
    metrics: [
      { label: 'Score Range', value: '0–100' },
      { label: 'Dimensions', value: '4' },
      { label: 'Game Phases', value: '7' },
      { label: 'Alert Levels', value: '3' },
    ],
  },
  {
    id: 'digital-twin',
    num: '06',
    name: 'Digital Twin System',
    tagline: 'Player behavioural models with fatigue, readiness, and decision profiling',
    body: 'Creates and maintains a digital twin for every player — tracking fatigue trajectories, decision tendencies, physical limits, and reaction times. Each twin contains a behavioural model built from historical tracking data, a performance baseline computed from average and peak sessions, and an adaptation log recording tactical, physical, and technical changes with impact scoring.',
    techniques: [
      'Behavioural modeling with movement patterns tracking frequency, duration, distance, and triggering conditions',
      'Performance baselining from historical tracking sessions with average and peak metric computation',
      'Trend analysis across weekly, monthly, and seasonal periods with improving, stable, or declining classification',
      'Adaptation tracking with impact scoring from -100 to +100 and duration classification',
    ],
    capabilities: [
      'Twin state tracking — fatigue, readiness, confidence level, current work rate, position adherence, tactical compliance',
      'Movement pattern analysis with type, frequency, average duration, average distance, and triggering conditions',
      'Decision tendency modeling — situation mapped to likely action with probability distribution and alternatives',
      'Physical limits — maximum sustainable speed, sprint recovery time, high-intensity capacity, fatigue threshold',
      'Reaction time profiling for pressure triggers, transition responses, and positional adjustments',
      'Historical trend analysis across weekly, monthly, and seasonal periods',
      'Adaptation log with date, type, description, impact, and duration',
      'Performance baseline comparison against average and peak metrics',
    ],
    implementation: 'createDigitalTwin — src/lib/digital-twin.ts',
    metrics: [
      { label: 'State Dims', value: '6' },
      { label: 'Trend Periods', value: '3' },
      { label: 'Reaction Types', value: '3' },
      { label: 'Adaptation Types', value: '3' },
    ],
  },
];

export function AlgorithmSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section id="algorithms" className="py-32 border-t border-[#2F343C]/40">
      <div className="max-w-[1200px] mx-auto px-8">
        <p className="text-[13px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-6">
          Algorithms
        </p>

        <h2
          className="text-[#F6F7F9] font-semibold leading-[1.08] tracking-tight max-w-[700px]"
          style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', letterSpacing: '-0.025em' }}
        >
          Six engines. Zero guesswork.
        </h2>

        <p className="text-[#8F99A8] text-base leading-relaxed max-w-[600px] mt-6 mb-20">
          Each algorithm module is purpose-built for a specific analytical domain.
          Together they form a complete tactical intelligence pipeline from raw sensor
          data to actionable decisions.
        </p>

        {/* Algorithm blocks */}
        <div className="space-y-0">
          {ALGORITHMS.map((algo) => {
            const isOpen = expandedId === algo.id;
            return (
              <div key={algo.id} className="border-t border-[#2F343C]/40">
                {/* Header row */}
                <button
                  className="w-full text-left py-8 flex items-start gap-8 group"
                  onClick={() => setExpandedId(isOpen ? null : algo.id)}
                >
                  <span className="text-[13px] text-[#5F6B7C] font-mono pt-1 flex-shrink-0 w-8">
                    {algo.num}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[#F6F7F9] text-xl font-semibold group-hover:text-[#ABB3BF] transition-colors">
                      {algo.name}
                    </h3>
                    <p className="text-[#8F99A8] text-sm mt-1">{algo.tagline}</p>
                  </div>
                  <span className="text-[#5F6B7C] text-sm pt-1 flex-shrink-0">
                    {isOpen ? '\u2212' : '+'}
                  </span>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="pb-12 pl-16 pr-8">
                    <p className="text-[#8F99A8] text-[15px] leading-relaxed max-w-[700px] mb-10">
                      {algo.body}
                    </p>

                    {/* Metrics */}
                    <div className="flex items-center gap-10 mb-10">
                      {algo.metrics.map((m) => (
                        <div key={m.label}>
                          <span className="text-[#F6F7F9] text-2xl font-semibold font-mono tabular-nums">
                            {m.value}
                          </span>
                          <span className="block text-[12px] text-[#5F6B7C] mt-1">{m.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Techniques */}
                    <div className="mb-10">
                      <h4 className="text-[12px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-4">
                        Core Techniques
                      </h4>
                      <div className="space-y-3">
                        {algo.techniques.map((t, i) => (
                          <p key={i} className="text-[#ABB3BF] text-sm leading-relaxed pl-4 border-l border-[#2F343C]">
                            {t}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Capabilities */}
                    <div className="mb-8">
                      <h4 className="text-[12px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-4">
                        Capabilities
                      </h4>
                      <div className="grid md:grid-cols-2 gap-x-12 gap-y-2">
                        {algo.capabilities.map((c, i) => (
                          <p key={i} className="text-[#8F99A8] text-sm leading-relaxed py-1">
                            {c}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Implementation */}
                    <p className="text-[12px] text-[#5F6B7C] font-mono">
                      {algo.implementation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          <div className="border-t border-[#2F343C]/40" />
        </div>
      </div>
    </section>
  );
}
