'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  BigDuncEngine,
  bigDunc,
  formatState,
  formatChain,
  getStateColor,
  type DuncState,
  type DuncPrediction,
  type DuncMetrics,
  type DuncSequence,
  type DuncTransition,
} from '@/lib/big-dunc';
import { Play, Pause, RotateCcw, Zap, Activity, GitBranch, Layers } from 'lucide-react';

export default function Home() {
  // Engine state
  const [isRunning, setIsRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [currentState, setCurrentState] = useState<DuncState>('idle');
  const [prediction, setPrediction] = useState<DuncPrediction | null>(null);
  const [metrics, setMetrics] = useState<DuncMetrics | null>(null);
  const [currentChain, setCurrentChain] = useState<DuncState[]>([]);
  const [sequences, setSequences] = useState<DuncSequence[]>([]);
  const [transitions, setTransitions] = useState<DuncTransition[]>([]);
  const [history, setHistory] = useState<{ state: DuncState; timestamp: number; success: boolean }[]>([]);
  const [speed, setSpeed] = useState(500); // ms per tick

  // Initialize engine callbacks
  useEffect(() => {
    bigDunc.onStateChanged((state, pred) => {
      setCurrentState(state);
      setPrediction(pred);
      setTick(bigDunc.getTick());
      setCurrentChain(bigDunc.getCurrentChain());
      setHistory(bigDunc.getHistory(30));
      setTransitions(bigDunc.getTransitionMatrix());
      setSequences(bigDunc.getSequences());
    });

    bigDunc.onMetrics((m) => {
      setMetrics(m);
    });

    bigDunc.onSequenceFound((seq) => {
      setSequences(bigDunc.getSequences());
    });

    return () => {
      bigDunc.stop();
    };
  }, []);

  // Handle start/stop
  const handleToggle = useCallback(() => {
    if (isRunning) {
      bigDunc.stop();
    } else {
      bigDunc.start(speed);
    }
    setIsRunning(!isRunning);
  }, [isRunning, speed]);

  // Handle reset
  const handleReset = useCallback(() => {
    bigDunc.reset();
    setCurrentState('idle');
    setPrediction(null);
    setMetrics(null);
    setCurrentChain([]);
    setSequences([]);
    setTransitions([]);
    setHistory([]);
    setTick(0);
    setIsRunning(false);
  }, []);

  // Handle speed change
  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    if (isRunning) {
      bigDunc.stop();
      bigDunc.start(newSpeed);
    }
  }, [isRunning]);

  // Manual state injection
  const handleInjectState = useCallback((state: DuncState) => {
    bigDunc.injectState(state);
  }, []);

  // Get health color
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'strong': return 'text-emerald-400';
      case 'building': return 'text-amber-400';
      case 'exploring': return 'text-purple-400';
      default: return 'text-red-400';
    }
  };

  return (
    <div className="h-screen bg-zinc-950 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-14 flex items-center justify-between px-6 bg-black/50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-white">BIG</span>
            <span className="text-orange-500"> DUNC</span>
          </h1>
          <span className="text-xs text-white/30 font-mono">Markov Chain Engine</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Speed Control */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Speed:</span>
            <select
              value={speed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
            >
              <option value={1000}>Slow (1s)</option>
              <option value={500}>Normal (500ms)</option>
              <option value={250}>Fast (250ms)</option>
              <option value={100}>Turbo (100ms)</option>
            </select>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isRunning
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-white text-black hover:bg-white/90'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Tick Counter */}
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg">
            <Activity className="w-3 h-3 text-white/40" />
            <span className="text-sm font-mono">{tick}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Current State & Chain */}
        <div className="w-80 flex flex-col border-r border-white/5 bg-zinc-900/50">
          {/* Current State */}
          <div className="p-6 border-b border-white/5">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3">Current State</div>
            <div
              className="text-3xl font-bold mb-2"
              style={{ color: getStateColor(currentState) }}
            >
              {formatState(currentState)}
            </div>
            {metrics && (
              <div className={`text-sm ${getHealthColor(metrics.chainHealth)}`}>
                Chain: {metrics.chainHealth}
              </div>
            )}
          </div>

          {/* Prediction */}
          <div className="p-6 border-b border-white/5">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="w-3 h-3" />
              Prediction
            </div>
            {prediction ? (
              <div className="space-y-3">
                <div>
                  <div
                    className="text-xl font-semibold"
                    style={{ color: getStateColor(prediction.nextState) }}
                  >
                    {formatState(prediction.nextState)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${prediction.probability * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/60 w-12 text-right">
                      {(prediction.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                {prediction.alternatives.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-white/30">Alternatives:</div>
                    {prediction.alternatives.map((alt, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-white/50">{formatState(alt.state)}</span>
                        <span className="text-white/30">{(alt.probability * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-white/30 text-sm">Learning...</div>
            )}
          </div>

          {/* Current Chain */}
          <div className="p-6 flex-1 overflow-hidden flex flex-col">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
              <GitBranch className="w-3 h-3" />
              Current Chain ({currentChain.length})
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {currentChain.length > 0 ? (
                currentChain.map((state, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getStateColor(state) }}
                    />
                    <span className="text-sm text-white/70">{formatState(state)}</span>
                    {i < currentChain.length - 1 && (
                      <span className="text-white/20 text-xs">{'->'}</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-white/30 text-sm">No chain yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Visualization */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* State Grid - Manual Injection */}
          <div className="mb-6">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3">Inject State</div>
            <div className="grid grid-cols-4 gap-2">
              {(['press_high', 'press_mid', 'press_low', 'build_slow', 'build_direct', 'build_switch',
                'attack_wide', 'attack_central', 'attack_counter', 'defend_compact', 'defend_aggressive',
                'defend_drop', 'transition_quick', 'transition_controlled', 'transition_reset', 'idle'
              ] as DuncState[]).map((state) => (
                <button
                  key={state}
                  onClick={() => handleInjectState(state)}
                  className={`px-3 py-2 rounded text-xs font-medium transition-all ${
                    currentState === state
                      ? 'ring-2 ring-white/50'
                      : 'hover:ring-1 hover:ring-white/20'
                  }`}
                  style={{
                    backgroundColor: `${getStateColor(state)}20`,
                    color: getStateColor(state),
                  }}
                >
                  {formatState(state)}
                </button>
              ))}
            </div>
          </div>

          {/* Transition Matrix Visualization */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="w-3 h-3" />
              Transition Matrix ({transitions.length} learned)
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {transitions
                  .sort((a, b) => b.probability - a.probability)
                  .slice(0, 20)
                  .map((trans, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 bg-white/5 rounded text-xs"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getStateColor(trans.from) }}
                      />
                      <span className="text-white/50 truncate flex-1">
                        {formatState(trans.from)}
                      </span>
                      <span className="text-white/20">{'->'}</span>
                      <span className="text-white/70 truncate flex-1">
                        {formatState(trans.to)}
                      </span>
                      <span className="text-white/40 w-10 text-right">
                        {(trans.probability * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
              </div>
              {transitions.length === 0 && (
                <div className="text-white/30 text-sm text-center py-8">
                  No transitions learned yet. Start the engine!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Sequences & History */}
        <div className="w-80 flex flex-col border-l border-white/5 bg-zinc-900/50">
          {/* Metrics */}
          {metrics && (
            <div className="p-4 border-b border-white/5 grid grid-cols-2 gap-3">
              <div className="bg-black/20 rounded p-3">
                <div className="text-xs text-white/40">Transitions</div>
                <div className="text-lg font-semibold">{metrics.totalTransitions}</div>
              </div>
              <div className="bg-black/20 rounded p-3">
                <div className="text-xs text-white/40">Unique</div>
                <div className="text-lg font-semibold">{metrics.uniqueTransitions}</div>
              </div>
              <div className="bg-black/20 rounded p-3">
                <div className="text-xs text-white/40">Entropy</div>
                <div className="text-lg font-semibold">{metrics.currentEntropy.toFixed(2)}</div>
              </div>
              <div className="bg-black/20 rounded p-3">
                <div className="text-xs text-white/40">Avg Chain</div>
                <div className="text-lg font-semibold">{metrics.avgChainLength.toFixed(1)}</div>
              </div>
            </div>
          )}

          {/* Sequences */}
          <div className="p-4 border-b border-white/5 flex-1 overflow-hidden flex flex-col">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
              Detected Sequences ({sequences.length})
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {sequences.length > 0 ? (
                sequences.slice(0, 10).map((seq) => (
                  <div key={seq.id} className="p-2 bg-white/5 rounded">
                    <div className="text-xs text-white/70 mb-1">
                      {seq.states.map(formatState).join(' -> ')}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span>{seq.occurrences}x</span>
                      <span>{(seq.successRate * 100).toFixed(0)}% success</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-white/30 text-sm">No sequences detected</div>
              )}
            </div>
          </div>

          {/* History */}
          <div className="p-4 flex-1 overflow-hidden flex flex-col">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
              Recent History
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {history.length > 0 ? (
                history.slice().reverse().map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="text-white/30 w-8 font-mono">{h.timestamp}</span>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getStateColor(h.state) }}
                    />
                    <span className="text-white/60 flex-1">{formatState(h.state)}</span>
                    <span className={h.success ? 'text-emerald-400' : 'text-red-400'}>
                      {h.success ? '+' : '-'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-white/30 text-sm">No history yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status */}
      <footer className="flex-shrink-0 h-8 flex items-center justify-center px-4 bg-black/30 border-t border-white/5">
        <div className="flex items-center gap-6 text-xs text-white/40">
          <span>Big Dunc Algorithm v1.0</span>
          <span>|</span>
          <span className={isRunning ? 'text-emerald-400' : 'text-white/40'}>
            {isRunning ? 'RUNNING' : 'STOPPED'}
          </span>
          <span>|</span>
          <span>Self-Sustaining Markov Chain</span>
        </div>
      </footer>
    </div>
  );
}
