'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  createInitialState,
  runStep,
  type PipelineState,
  type PipelineLog,
  type StepContext,
} from '@/lib/demo-pipeline';
import { DEMO_SQUAD } from '@/lib/demo-randomizer';

// ============================================================================
// STEP METADATA
// ============================================================================

const STEP_META = [
  { name: 'Data Ingestion', desc: 'Catapult GPS/IMU data randomizer — generates 10Hz position + 100Hz accelerometer data for full squad' },
  { name: 'Wearable Processing', desc: 'Speed zone classification, acceleration analysis, player load calculation, heart rate zone mapping' },
  { name: 'Fatigue Modeling', desc: 'Weighted composite model — muscular (40%) + cardiovascular (35%) + neuromuscular (25%)' },
  { name: 'Pattern Recognition', desc: '40+ tactical patterns via positional analysis. Markov chain sequence detection with 3-minute timeout' },
  { name: 'Analytics Engine', desc: 'xG model (7 modifiers), passing network (eigenvector centrality), pressing trap detection' },
  { name: 'Tactical AI', desc: 'Q-Learning agent — 60 state-action pairs, 7 decision types. Real-time formation + pressing + tempo' },
  { name: 'Coherence Analysis', desc: '4-dimension scoring: position (30%) + physical (25%) + movement (25%) + role (20%)' },
  { name: 'Digital Twin Sync', desc: 'Update all player twin states. Generate alerts, substitution priorities, injury risk flags' },
];

// ============================================================================
// LOG LINE COMPONENT
// ============================================================================

function LogLine({ entry }: { entry: PipelineLog }) {
  const levelColor = {
    info: 'text-[#5F6B7C]',
    data: 'text-[#ABB3BF]',
    metric: 'text-[#2D72D2]',
    warn: 'text-[#D4A017]',
    result: 'text-[#F6F7F9]',
  }[entry.level];

  const levelTag = {
    info: 'INF',
    data: 'DAT',
    metric: 'MET',
    warn: 'WRN',
    result: 'RES',
  }[entry.level];

  return (
    <div className={`font-mono text-[12px] leading-[1.7] ${levelColor} whitespace-pre-wrap break-all`}>
      <span className="text-[#383E47] select-none">[{levelTag}] </span>
      {entry.message}
    </div>
  );
}

// ============================================================================
// STEP PANEL COMPONENT
// ============================================================================

function StepPanel({
  index,
  state,
  isActive,
  onClick,
}: {
  index: number;
  state: PipelineState;
  isActive: boolean;
  onClick: () => void;
}) {
  const stepState = state.steps[index];
  const meta = STEP_META[index];

  const statusLabel = {
    pending: '—',
    running: 'RUNNING',
    complete: 'DONE',
    error: 'ERROR',
  }[stepState.status];

  const statusColor = {
    pending: 'text-[#383E47]',
    running: 'text-[#D4A017]',
    complete: 'text-[#2D72D2]',
    error: 'text-[#CD4246]',
  }[stepState.status];

  const isClickable = stepState.status === 'pending' && (index === 0 || state.steps[index - 1].status === 'complete');

  return (
    <button
      onClick={onClick}
      disabled={!isClickable && stepState.status !== 'complete'}
      className={`w-full text-left border-b border-[#2F343C]/40 py-4 px-0 transition-colors ${
        isActive ? 'bg-[#1C2127]' : ''
      } ${isClickable ? 'cursor-pointer hover:bg-[#1C2127]/60' : stepState.status === 'complete' ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-[13px] text-[#383E47] font-mono w-5 shrink-0">{index}</span>
          <span className={`text-[14px] ${stepState.status === 'complete' ? 'text-[#F6F7F9]' : stepState.status === 'running' ? 'text-[#D4A017]' : 'text-[#5F6B7C]'}`}>
            {meta.name}
          </span>
        </div>
        <div className="flex items-baseline gap-3 shrink-0">
          {stepState.duration > 0 && (
            <span className="text-[11px] text-[#383E47] font-mono">{stepState.duration}ms</span>
          )}
          <span className={`text-[11px] font-mono ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>
      {isActive && (
        <p className="text-[12px] text-[#5F6B7C] mt-1.5 pl-8 leading-relaxed">{meta.desc}</p>
      )}
    </button>
  );
}

// ============================================================================
// MAIN DEMO PAGE
// ============================================================================

export default function DemoPage() {
  const [minute, setMinute] = useState(65);
  const [state, setState] = useState<PipelineState>(createInitialState(65));
  const [context, setContext] = useState<StepContext>({});
  const [activeStep, setActiveStep] = useState<number>(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const autoRunRef = useRef(false);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.totalLogs.length]);

  const executeStep = useCallback((stepIndex: number) => {
    setState(prev => {
      const next = { ...prev, steps: prev.steps.map(s => ({ ...s })), totalLogs: [...prev.totalLogs] };
      try {
        const newContext = runStep(next, stepIndex, { ...context });
        setContext(newContext);
        setActiveStep(stepIndex < 7 ? stepIndex + 1 : stepIndex);
      } catch {
        next.steps[stepIndex].status = 'error';
      }
      return next;
    });
  }, [context]);

  // Auto-run effect
  useEffect(() => {
    autoRunRef.current = autoRunning;
  }, [autoRunning]);

  useEffect(() => {
    if (!autoRunning) return;

    const nextPending = state.steps.findIndex(s => s.status === 'pending');
    if (nextPending === -1) {
      setAutoRunning(false);
      return;
    }

    const timer = setTimeout(() => {
      if (autoRunRef.current) {
        executeStep(nextPending);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [autoRunning, state.steps, executeStep]);

  const handleReset = () => {
    const newState = createInitialState(minute);
    setState(newState);
    setContext({});
    setActiveStep(0);
    setAutoRunning(false);
  };

  const handleRunAll = () => {
    if (state.steps[0].status === 'pending') {
      handleReset();
    }
    setAutoRunning(true);
  };

  const handleRunNext = () => {
    const nextPending = state.steps.findIndex(s => s.status === 'pending');
    if (nextPending !== -1) {
      executeStep(nextPending);
    }
  };

  const handleMinuteChange = (newMinute: number) => {
    setMinute(newMinute);
    const newState = createInitialState(newMinute);
    setState(newState);
    setContext({});
    setActiveStep(0);
    setAutoRunning(false);
  };

  // Logs for active step
  const activeLogs = state.steps[activeStep]?.logs || [];
  const completedSteps = state.steps.filter(s => s.status === 'complete').length;

  return (
    <div className="min-h-screen bg-[#111418]">
      {/* Header */}
      <header className="border-b border-[#2F343C]/40 py-4">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-baseline gap-6">
            <a href="/" className="text-[14px] text-[#5F6B7C] hover:text-[#8F99A8] transition-colors">
              BigDunc
            </a>
            <span className="text-[14px] text-[#F6F7F9]">Algorithm Pipeline Demo</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[12px] text-[#5F6B7C] font-mono">
              {completedSteps}/8 steps
            </span>
            {state.isComplete && (
              <span className="text-[12px] text-[#2D72D2] font-mono">PIPELINE COMPLETE</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Controls */}
        <div className="border-b border-[#2F343C]/40 pb-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div>
              <p className="text-[13px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-3">
                Match Simulation
              </p>
              <p className="text-[#8F99A8] text-sm leading-relaxed max-w-[540px]">
                Generate randomized Catapult session data for {DEMO_SQUAD.length} players, then run each
                algorithm step-by-step through the pipeline. All logs visible in real time.
              </p>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-[11px] text-[#5F6B7C] font-mono mb-1.5">MATCH MINUTE</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={minute}
                  onChange={e => handleMinuteChange(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
                  className="w-20 bg-[#1C2127] border border-[#2F343C] text-[#F6F7F9] text-[13px] font-mono px-3 py-2 focus:border-[#2D72D2] focus:outline-none"
                />
              </div>
              <button
                onClick={handleRunNext}
                disabled={state.isComplete || autoRunning}
                className="text-[13px] text-[#F6F7F9] border border-[#2F343C] px-5 py-2 hover:border-[#5F6B7C] transition-colors disabled:opacity-30 disabled:cursor-default"
              >
                Run next step
              </button>
              <button
                onClick={handleRunAll}
                disabled={state.isComplete}
                className="text-[13px] text-[#F6F7F9] border border-[#2D72D2] bg-[#2D72D2]/10 px-5 py-2 hover:bg-[#2D72D2]/20 transition-colors disabled:opacity-30 disabled:cursor-default"
              >
                {autoRunning ? 'Running...' : 'Run all'}
              </button>
              <button
                onClick={handleReset}
                className="text-[13px] text-[#5F6B7C] border border-[#2F343C] px-5 py-2 hover:text-[#8F99A8] hover:border-[#5F6B7C] transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Squad preview */}
          <div className="mt-6">
            <p className="text-[11px] text-[#383E47] font-mono mb-2">SQUAD</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {DEMO_SQUAD.map(p => (
                <span key={p.id} className="text-[11px] text-[#5F6B7C] font-mono">
                  {p.number} {p.name} <span className="text-[#383E47]">({p.position})</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Main layout: steps + logs */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-0 lg:gap-8">
          {/* Left: Step list */}
          <div className="border-b lg:border-b-0 lg:border-r border-[#2F343C]/40 lg:pr-8 pb-6 lg:pb-0">
            <p className="text-[11px] text-[#383E47] font-mono tracking-[0.15em] mb-4">PIPELINE STEPS</p>
            <div>
              {state.steps.map((_, i) => (
                <StepPanel
                  key={i}
                  index={i}
                  state={state}
                  isActive={activeStep === i}
                  onClick={() => {
                    if (state.steps[i].status === 'pending') {
                      const canRun = i === 0 || state.steps[i - 1].status === 'complete';
                      if (canRun) executeStep(i);
                    }
                    setActiveStep(i);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right: Log output */}
          <div className="pt-6 lg:pt-0">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-[11px] text-[#383E47] font-mono tracking-[0.15em]">
                LOG OUTPUT — {STEP_META[activeStep]?.name.toUpperCase()}
              </p>
              <p className="text-[11px] text-[#383E47] font-mono">
                {activeLogs.length} entries
              </p>
            </div>

            <div className="bg-[#0D1117] border border-[#2F343C]/30 overflow-y-auto max-h-[calc(100vh-380px)] min-h-[400px] p-4">
              {activeLogs.length === 0 ? (
                <p className="text-[12px] text-[#383E47] font-mono">
                  {state.steps[activeStep]?.status === 'pending'
                    ? 'Click step or press "Run next step" to execute'
                    : 'No logs for this step'}
                </p>
              ) : (
                activeLogs.map((entry, i) => <LogLine key={i} entry={entry} />)
              )}
              <div ref={logEndRef} />
            </div>

            {/* Summary metrics */}
            {state.steps[activeStep]?.status === 'complete' && (
              <div className="mt-6 border-t border-[#2F343C]/40 pt-6">
                <p className="text-[11px] text-[#383E47] font-mono tracking-[0.15em] mb-3">STEP RESULT</p>
                {state.steps[activeStep].logs
                  .filter(l => l.level === 'result')
                  .map((l, i) => (
                    <p key={i} className="text-[13px] text-[#F6F7F9] leading-relaxed">{l.message}</p>
                  ))}
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
                  {state.steps[activeStep].logs
                    .filter(l => l.level === 'metric')
                    .map((l, i) => (
                      <span key={i} className="text-[11px] text-[#2D72D2] font-mono">{l.message}</span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Full pipeline log */}
        {state.totalLogs.length > 0 && (
          <div className="mt-12 border-t border-[#2F343C]/40 pt-8">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-[11px] text-[#383E47] font-mono tracking-[0.15em]">
                FULL PIPELINE LOG
              </p>
              <p className="text-[11px] text-[#383E47] font-mono">
                {state.totalLogs.length} total entries
              </p>
            </div>
            <div className="bg-[#0D1117] border border-[#2F343C]/30 overflow-y-auto max-h-[500px] p-4">
              {state.totalLogs.map((entry, i) => (
                <div key={i}>
                  {(i === 0 || entry.step !== state.totalLogs[i - 1].step) && (
                    <div className="text-[11px] text-[#2D72D2] font-mono mt-3 mb-1 border-b border-[#2F343C]/20 pb-1">
                      === STEP {entry.step}: {entry.stepName.toUpperCase()} ===
                    </div>
                  )}
                  <LogLine entry={entry} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
