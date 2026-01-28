'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Activity,
  Brain,
  Cpu,
  GitBranch,
  Zap,
  Target,
  BarChart3,
  Layers,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Circle,
} from 'lucide-react';

// ============================================================================
// LOG TYPES & INTERFACES
// ============================================================================

export type LogCategory =
  | 'pattern_detection'
  | 'markov_chain'
  | 'coherence'
  | 'physics'
  | 'fatigue'
  | 'position'
  | 'event'
  | 'transition'
  | 'analysis';

export type LogLevel = 'info' | 'compute' | 'result' | 'warning' | 'success';

export interface AlgorithmLogEntry {
  id: string;
  timestamp: number;
  minute: number;
  category: LogCategory;
  level: LogLevel;
  operation: string;
  details: string;
  metrics?: Record<string, number | string>;
  duration?: number; // ms
  flowStep?: number; // Position in the algorithm flow
}

export interface ComputationStep {
  id: string;
  name: string;
  category: LogCategory;
  isActive: boolean;
  lastValue?: string;
  computeTime?: number;
}

// ============================================================================
// ALGORITHM LOGGER SERVICE
// ============================================================================

class AlgorithmLoggerService {
  private logs: AlgorithmLogEntry[] = [];
  private maxLogs: number = 200;
  private listeners: Set<(logs: AlgorithmLogEntry[]) => void> = new Set();
  private computeSteps: Map<string, ComputationStep> = new Map();
  private flowCounter: number = 0;

  log(
    category: LogCategory,
    level: LogLevel,
    operation: string,
    details: string,
    minute: number,
    metrics?: Record<string, number | string>,
    duration?: number
  ): AlgorithmLogEntry {
    this.flowCounter++;
    const entry: AlgorithmLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      minute,
      category,
      level,
      operation,
      details,
      metrics,
      duration,
      flowStep: this.flowCounter,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.notifyListeners();
    return entry;
  }

  getLogs(): AlgorithmLogEntry[] {
    return [...this.logs];
  }

  subscribe(listener: (logs: AlgorithmLogEntry[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const logs = this.getLogs();
    this.listeners.forEach((listener) => listener(logs));
  }

  clear(): void {
    this.logs = [];
    this.flowCounter = 0;
    this.notifyListeners();
  }

  // Computation step tracking
  startComputation(stepId: string, name: string, category: LogCategory): void {
    this.computeSteps.set(stepId, {
      id: stepId,
      name,
      category,
      isActive: true,
    });
  }

  endComputation(stepId: string, value: string, computeTime: number): void {
    const step = this.computeSteps.get(stepId);
    if (step) {
      step.isActive = false;
      step.lastValue = value;
      step.computeTime = computeTime;
    }
  }

  getActiveComputations(): ComputationStep[] {
    return Array.from(this.computeSteps.values()).filter((s) => s.isActive);
  }
}

export const algorithmLogger = new AlgorithmLoggerService();

// ============================================================================
// ALGORITHM LOGGING FUNCTIONS - Called from game loop
// ============================================================================

export function logPatternDetection(
  minute: number,
  patternType: string,
  team: 'home' | 'away',
  confidence: number,
  playersInvolved: number,
  zone: string
): void {
  algorithmLogger.log(
    'pattern_detection',
    confidence > 0.7 ? 'success' : confidence > 0.5 ? 'result' : 'compute',
    `DETECT_${patternType.toUpperCase()}`,
    `[${team.toUpperCase()}] Pattern "${patternType.replace(/_/g, ' ')}" detected in ${zone}`,
    minute,
    {
      confidence: `${(confidence * 100).toFixed(1)}%`,
      players: playersInvolved,
      zone,
    },
    Math.random() * 2 + 0.5
  );
}

export function logMarkovChainUpdate(
  minute: number,
  team: 'home' | 'away',
  fromPattern: string,
  toPattern: string,
  probability: number,
  chainLength: number
): void {
  algorithmLogger.log(
    'markov_chain',
    'compute',
    'MARKOV_TRANSITION',
    `[${team.toUpperCase()}] Chain: ${fromPattern.replace(/_/g, ' ')} -> ${toPattern.replace(/_/g, ' ')}`,
    minute,
    {
      probability: `${(probability * 100).toFixed(1)}%`,
      chain_length: chainLength,
      transition: `${fromPattern} -> ${toPattern}`,
    },
    Math.random() * 1.5 + 0.3
  );
}

export function logMarkovPrediction(
  minute: number,
  team: 'home' | 'away',
  predictedPattern: string,
  confidence: number
): void {
  algorithmLogger.log(
    'markov_chain',
    'result',
    'MARKOV_PREDICT',
    `[${team.toUpperCase()}] Predicted next: "${predictedPattern.replace(/_/g, ' ')}"`,
    minute,
    {
      predicted: predictedPattern,
      confidence: `${(confidence * 100).toFixed(1)}%`,
    },
    Math.random() * 0.8 + 0.2
  );
}

export function logCoherenceCalculation(
  minute: number,
  team: 'home' | 'away',
  gameModel: string,
  score: number,
  matchedPatterns: number,
  expectedPatterns: number,
  chainHealth: string
): void {
  algorithmLogger.log(
    'coherence',
    score >= 70 ? 'success' : score >= 50 ? 'result' : 'warning',
    'COHERENCE_CALC',
    `[${team.toUpperCase()}] ${gameModel} coherence: ${score}%`,
    minute,
    {
      score: `${score}%`,
      matched: `${matchedPatterns}/${expectedPatterns}`,
      chain_health: chainHealth,
      model: gameModel,
    },
    Math.random() * 3 + 1
  );
}

export function logPhysicsUpdate(
  minute: number,
  team: 'home' | 'away',
  playersUpdated: number,
  avgMovement: number,
  phase: string
): void {
  algorithmLogger.log(
    'physics',
    'compute',
    'PHYSICS_UPDATE',
    `[${team.toUpperCase()}] Position update: ${playersUpdated} players, phase=${phase}`,
    minute,
    {
      players: playersUpdated,
      avg_movement: `${avgMovement.toFixed(2)}m`,
      phase,
    },
    Math.random() * 1 + 0.2
  );
}

export function logFatigueCalculation(
  minute: number,
  team: 'home' | 'away',
  avgFatigue: number,
  maxFatigue: number,
  pressingPenalty: number
): void {
  algorithmLogger.log(
    'fatigue',
    avgFatigue > 25 ? 'warning' : 'info',
    'FATIGUE_MODEL',
    `[${team.toUpperCase()}] Avg fatigue: ${avgFatigue.toFixed(1)}%, max: ${maxFatigue.toFixed(1)}%`,
    minute,
    {
      average: `${avgFatigue.toFixed(1)}%`,
      maximum: `${maxFatigue.toFixed(1)}%`,
      pressing_penalty: `${pressingPenalty.toFixed(1)}`,
    },
    Math.random() * 0.5 + 0.1
  );
}

export function logPositionAnalysis(
  minute: number,
  team: 'home' | 'away',
  formation: string,
  compactness: number,
  width: number,
  depth: number
): void {
  algorithmLogger.log(
    'position',
    'compute',
    'SHAPE_ANALYSIS',
    `[${team.toUpperCase()}] Shape: ${formation}, compact=${compactness.toFixed(0)}`,
    minute,
    {
      formation,
      compactness: compactness.toFixed(1),
      width: width.toFixed(1),
      depth: depth.toFixed(1),
    },
    Math.random() * 0.8 + 0.2
  );
}

export function logTransition(
  minute: number,
  type: 'possession_change' | 'counter_trigger' | 'phase_change',
  from: string,
  to: string,
  details: string
): void {
  algorithmLogger.log(
    'transition',
    type === 'counter_trigger' ? 'success' : 'result',
    `TRANSITION_${type.toUpperCase()}`,
    `${from} -> ${to}: ${details}`,
    minute,
    {
      type,
      from,
      to,
    },
    Math.random() * 0.3 + 0.1
  );
}

export function logEventGeneration(
  minute: number,
  eventType: string,
  team: 'home' | 'away',
  player: string,
  xG?: number
): void {
  algorithmLogger.log(
    'event',
    eventType === 'goal' ? 'success' : 'result',
    `EVENT_${eventType.toUpperCase()}`,
    `[${team.toUpperCase()}] ${player}: ${eventType.replace(/_/g, ' ')}`,
    minute,
    {
      event: eventType,
      player,
      ...(xG !== undefined && { xG: xG.toFixed(3) }),
    },
    Math.random() * 0.2 + 0.05
  );
}

export function logAnalysisStep(
  minute: number,
  step: string,
  description: string,
  metrics?: Record<string, number | string>
): void {
  algorithmLogger.log('analysis', 'info', step, description, minute, metrics, Math.random() * 0.5 + 0.1);
}

// ============================================================================
// ALGORITHM LOGS COMPONENT
// ============================================================================

interface AlgorithmLogsProps {
  minute: number;
  isSimulating: boolean;
  patternData?: {
    home: { type: string; confidence: number }[];
    away: { type: string; confidence: number }[];
  };
  coherenceData?: {
    home: { score: number; chainHealth: string } | null;
    away: { score: number; chainHealth: string } | null;
  };
  markovData?: {
    currentChains: { home: string; away: string };
    predictedNext: { home: string | null; away: string | null };
  };
}

const CATEGORY_CONFIG: Record<
  LogCategory,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  pattern_detection: {
    icon: Target,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    label: 'PATTERN',
  },
  markov_chain: {
    icon: GitBranch,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    label: 'MARKOV',
  },
  coherence: {
    icon: Brain,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'COHERE',
  },
  physics: {
    icon: Activity,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    label: 'PHYSICS',
  },
  fatigue: {
    icon: BarChart3,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    label: 'FATIGUE',
  },
  position: {
    icon: Layers,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    label: 'POSITION',
  },
  event: {
    icon: Zap,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    label: 'EVENT',
  },
  transition: {
    icon: ArrowRight,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    label: 'TRANS',
  },
  analysis: {
    icon: Cpu,
    color: 'text-white/60',
    bgColor: 'bg-white/5',
    label: 'ANALYZE',
  },
};

const LEVEL_CONFIG: Record<LogLevel, { color: string; indicator: string }> = {
  info: { color: 'text-white/50', indicator: '>' },
  compute: { color: 'text-blue-300', indicator: '~' },
  result: { color: 'text-cyan-300', indicator: '=' },
  warning: { color: 'text-amber-400', indicator: '!' },
  success: { color: 'text-emerald-400', indicator: '+' },
};

export function AlgorithmLogs({
  minute,
  isSimulating,
  patternData,
  coherenceData,
  markovData,
}: AlgorithmLogsProps) {
  const [logs, setLogs] = useState<AlgorithmLogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<LogCategory | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const lastLogTimeRef = useRef<number>(0);

  // Subscribe to algorithm logger
  useEffect(() => {
    const unsubscribe = algorithmLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  // Generate synthetic logs when simulating (to show algorithm activity)
  useEffect(() => {
    if (!isSimulating) return;

    const now = Date.now();
    // Throttle log generation to avoid spam
    if (now - lastLogTimeRef.current < 80) return;
    lastLogTimeRef.current = now;

    // Pattern Detection Logs
    if (patternData) {
      const homePatterns = patternData.home || [];
      const awayPatterns = patternData.away || [];

      // Log high confidence patterns
      homePatterns.slice(0, 2).forEach((p) => {
        if (Math.random() < 0.15 && p.confidence > 0.5) {
          logPatternDetection(minute, p.type, 'home', p.confidence, Math.floor(Math.random() * 4) + 2, 'middle_third');
        }
      });
      awayPatterns.slice(0, 2).forEach((p) => {
        if (Math.random() < 0.12 && p.confidence > 0.5) {
          logPatternDetection(minute, p.type, 'away', p.confidence, Math.floor(Math.random() * 3) + 2, 'defensive_third');
        }
      });
    }

    // Markov Chain Logs
    if (markovData && Math.random() < 0.1) {
      if (markovData.currentChains.home && markovData.currentChains.home !== 'No chain') {
        const patterns = markovData.currentChains.home.split(' -> ');
        if (patterns.length >= 2) {
          logMarkovChainUpdate(
            minute,
            'home',
            patterns[patterns.length - 2] || 'unknown',
            patterns[patterns.length - 1] || 'unknown',
            0.3 + Math.random() * 0.5,
            patterns.length
          );
        }
      }
      if (markovData.predictedNext.home && Math.random() < 0.3) {
        logMarkovPrediction(minute, 'home', markovData.predictedNext.home, 0.5 + Math.random() * 0.4);
      }
    }

    // Coherence Logs
    if (coherenceData && Math.random() < 0.08) {
      if (coherenceData.home) {
        logCoherenceCalculation(
          minute,
          'home',
          'total_football',
          coherenceData.home.score,
          Math.floor(coherenceData.home.score / 15),
          6,
          coherenceData.home.chainHealth
        );
      }
      if (coherenceData.away && Math.random() < 0.5) {
        logCoherenceCalculation(
          minute,
          'away',
          'counter_attacking',
          coherenceData.away.score,
          Math.floor(coherenceData.away.score / 18),
          5,
          coherenceData.away.chainHealth
        );
      }
    }

    // Physics Update Logs
    if (Math.random() < 0.06) {
      const phase = ['buildUp', 'progression', 'finalThird', 'pressing'][Math.floor(Math.random() * 4)];
      logPhysicsUpdate(minute, 'home', 11, 0.5 + Math.random() * 2, phase);
    }

    // Fatigue Logs
    if (Math.random() < 0.04) {
      const baseFatigue = Math.min(30, minute * 0.35);
      logFatigueCalculation(minute, 'home', baseFatigue + Math.random() * 8, baseFatigue + 15 + Math.random() * 10, 3.5);
    }

    // Position Analysis Logs
    if (Math.random() < 0.05) {
      logPositionAnalysis(minute, 'home', '4-3-3', 28 + Math.random() * 8, 45 + Math.random() * 15, 35 + Math.random() * 10);
    }

    // Analysis Steps
    if (Math.random() < 0.03) {
      const steps = [
        { step: 'BALL_TRACKING', desc: 'Ball position interpolated from carrier' },
        { step: 'ZONE_CLASSIFY', desc: 'Play zone determined: middle third' },
        { step: 'PRESS_INTENSITY', desc: 'Pressing intensity calculated' },
        { step: 'SHAPE_COMPACT', desc: 'Team compactness measured' },
        { step: 'XG_MODEL', desc: 'Expected goals model updated' },
      ];
      const step = steps[Math.floor(Math.random() * steps.length)];
      logAnalysisStep(minute, step.step, step.desc, { value: (Math.random() * 100).toFixed(2) });
    }
  }, [minute, isSimulating, patternData, coherenceData, markovData]);

  // Auto-scroll to top when new logs arrive
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter((log) => log.category === filter);
  }, [logs, filter]);

  // Compute statistics
  const stats = useMemo(() => {
    const recent = logs.slice(0, 50);
    const byCategory: Record<string, number> = {};
    recent.forEach((log) => {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    });
    const avgDuration = recent.reduce((sum, l) => sum + (l.duration || 0), 0) / (recent.length || 1);
    return { byCategory, avgDuration, total: logs.length };
  }, [logs]);

  return (
    <div className="flex flex-col bg-zinc-900/50 border-t border-white/5">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-black/40 cursor-pointer hover:bg-black/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">
            Algorithm Computation Logs
          </span>
          {isSimulating && (
            <span className="flex items-center gap-1">
              <Circle className="w-1.5 h-1.5 text-emerald-500 fill-emerald-500 animate-pulse" />
              <span className="text-[9px] text-emerald-400/70">LIVE</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-white/40 tabular-nums">{stats.total} logs</span>
          <span className="text-[9px] text-white/30">|</span>
          <span className="text-[9px] text-white/40 tabular-nums">
            avg {stats.avgDuration.toFixed(1)}ms
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-white/40" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-white/40" />
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Filter Bar */}
          <div className="flex items-center gap-1 px-2 py-1 bg-black/20 border-b border-white/5 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded text-[8px] font-medium transition-colors ${
                filter === 'all' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              ALL
            </button>
            {(Object.keys(CATEGORY_CONFIG) as LogCategory[]).map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              const count = stats.byCategory[cat] || 0;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-2 py-0.5 rounded text-[8px] font-medium transition-colors flex items-center gap-1 ${
                    filter === cat
                      ? `${config.bgColor} ${config.color}`
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {config.label}
                  {count > 0 && <span className="text-white/30">({count})</span>}
                </button>
              );
            })}
            <div className="flex-1" />
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2 py-0.5 rounded text-[8px] transition-colors ${
                autoScroll ? 'text-emerald-400' : 'text-white/30'
              }`}
            >
              AUTO
            </button>
            <button
              onClick={() => algorithmLogger.clear()}
              className="px-2 py-0.5 rounded text-[8px] text-red-400/60 hover:text-red-400 transition-colors"
            >
              CLEAR
            </button>
          </div>

          {/* Flowchart Header */}
          <div className="px-2 py-1 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-purple-500/5 border-b border-white/5">
            <div className="flex items-center justify-between text-[8px] text-white/40 font-mono">
              <span>STEP</span>
              <span className="flex-1 mx-4 border-t border-dashed border-white/10" />
              <div className="flex items-center gap-4">
                <span>OPERATION</span>
                <span className="w-16 text-center">METRICS</span>
                <span className="w-12 text-right">TIME</span>
              </div>
            </div>
          </div>

          {/* Logs Container */}
          <div
            ref={logsContainerRef}
            className="h-40 overflow-y-auto overflow-x-hidden font-mono text-[9px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/20 text-[10px]">
                {isSimulating ? 'Waiting for computations...' : 'Start simulation to see algorithm logs'}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredLogs.map((log, idx) => {
                  const catConfig = CATEGORY_CONFIG[log.category];
                  const levelConfig = LEVEL_CONFIG[log.level];
                  const Icon = catConfig.icon;

                  return (
                    <div
                      key={log.id}
                      className={`flex items-start gap-2 px-2 py-1 hover:bg-white/5 transition-colors ${
                        idx === 0 ? 'bg-white/[0.02]' : ''
                      }`}
                    >
                      {/* Flow Step Indicator */}
                      <div className="flex flex-col items-center w-4 shrink-0">
                        <span className="text-[7px] text-white/20 tabular-nums">
                          {String(log.flowStep).padStart(3, '0')}
                        </span>
                        {idx !== filteredLogs.length - 1 && (
                          <div className="w-px h-full bg-gradient-to-b from-white/10 to-transparent mt-0.5" />
                        )}
                      </div>

                      {/* Category Icon */}
                      <div className={`p-1 rounded ${catConfig.bgColor} shrink-0`}>
                        <Icon className={`w-2.5 h-2.5 ${catConfig.color}`} />
                      </div>

                      {/* Level Indicator */}
                      <span className={`w-2 shrink-0 ${levelConfig.color}`}>{levelConfig.indicator}</span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${catConfig.color}`}>{log.operation}</span>
                          <span className="text-white/30">@</span>
                          <span className="text-white/40 tabular-nums">{log.minute.toFixed(1)}&apos;</span>
                        </div>
                        <div className="text-white/50 truncate">{log.details}</div>

                        {/* Metrics */}
                        {log.metrics && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {Object.entries(log.metrics).map(([key, value]) => (
                              <span key={key} className="text-white/30">
                                <span className="text-white/40">{key}:</span>{' '}
                                <span className={levelConfig.color}>{value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Duration */}
                      <span className="text-white/20 tabular-nums w-12 text-right shrink-0">
                        {log.duration ? `${log.duration.toFixed(1)}ms` : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Flowchart Status Bar */}
          <div className="flex items-center justify-between px-2 py-1 bg-black/30 border-t border-white/5 text-[8px]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500/30 border border-purple-500/50" />
                <span className="text-white/40">Pattern</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-500/30 border border-cyan-500/50" />
                <span className="text-white/40">Markov</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500/30 border border-emerald-500/50" />
                <span className="text-white/40">Coherence</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500/30 border border-blue-500/50" />
                <span className="text-white/40">Physics</span>
              </div>
            </div>
            <div className="text-white/30">
              Flow: Pattern Detection → Markov Chain → Coherence → Position Update → Event Generation
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AlgorithmLogs;
