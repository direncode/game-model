'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useGameStore } from '@/store/game-store';
import {
  KernelWaveViz,
  BlankPitch,
  type KernelData,
  type KernelLogEntry,
} from '@/components/dashboard/kernel-wave-viz';
import { createDigitalTwin } from '@/lib/digital-twin';
import { getPLSquadData } from '@/lib/premier-league-api';
import {
  GameEngine,
  createManchesterDerby,
  type MatchEvent,
  type MatchState,
  type MatchStats,
} from '@/lib/game-engine';
import {
  PatternRecognitionEngine,
  type TacticalPattern,
  type TacticalCoherence,
  type RecurrentSequence,
  type MarkovTransition,
} from '@/lib/pattern-recognition';
import {
  catapultService,
  type FatigueModel,
  type InjuryRiskModel,
} from '@/lib/catapult-integration';
import type { Player, TrackingMetrics } from '@/types';
import {
  Play,
  Pause,
  Square,
  Activity,
  Radio,
  Cpu,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Shield,
  Zap,
  Target,
  BarChart3,
} from 'lucide-react';
import {
  GameModelManager,
  createGameModelManager,
  type StaffMember,
} from '@/lib/game-model-manager';
import {
  DemoDataProvider,
  type GranularOutput,
} from '@/lib/demo-data-provider';

// ── Local types ────────────────────────────────────────────────────────

interface PatternRecognitionData {
  activePatterns: { home: TacticalPattern[]; away: TacticalPattern[] };
  coherence: { home: TacticalCoherence | null; away: TacticalCoherence | null };
  markov?: {
    recurrentSequences: RecurrentSequence[];
    currentChains: { home: string; away: string };
    topTransitions: { home: MarkovTransition[]; away: MarkovTransition[] };
    predictedNext: { home: string | null; away: string | null };
  };
}

interface FatigueData {
  home: Map<string, FatigueModel>;
  away: Map<string, FatigueModel>;
  injuryRisks: Map<string, InjuryRiskModel>;
}

// ═══════════════════════════════════════════════════════════════════════
// THE BIG DUNC — Granular Computation Dashboard
// ═══════════════════════════════════════════════════════════════════════

export default function Home() {
  const {
    players, setPlayers, setTwin,
    liveData, updateLiveData,
    isLive, startMatch, updateMatch, endMatch,
  } = useGameStore();

  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Engine refs
  const gameEngineRef = useRef<GameEngine | null>(null);
  const patternEngineRef = useRef<PatternRecognitionEngine | null>(null);
  const gameModelManagerRef = useRef<GameModelManager | null>(null);
  const demoProviderRef = useRef<DemoDataProvider>(new DemoDataProvider());

  // Match state
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);

  // Pattern recognition
  const [patternRecognitionData, setPatternRecognitionData] = useState<PatternRecognitionData>({
    activePatterns: { home: [], away: [] },
    coherence: { home: null, away: null },
    markov: {
      recurrentSequences: [],
      currentChains: { home: 'No chain', away: 'No chain' },
      topTransitions: { home: [], away: [] },
      predictedNext: { home: null, away: null },
    },
  });

  // Fatigue
  const [, setFatigueData] = useState<FatigueData>({
    home: new Map(), away: new Map(), injuryRisks: new Map(),
  });

  // Granular output (demo data + computed metrics)
  const [granular, setGranular] = useState<GranularOutput>(() =>
    demoProviderRef.current.tick(0),
  );

  // Kernel wave function state
  const [kernelLogs, setKernelLogs] = useState<Record<string, KernelLogEntry[]>>({
    defense: [], midfield: [], forward: [],
  });
  const prevKernelMeans = useRef<Record<string, number>>({});
  const prevKernelStdDevs = useRef<Record<string, number>>({});
  const lastKernelLogMinute = useRef<Record<string, number>>({});

  // ── Ideal 4-3-3 positions ──────────────────────────────────────────

  const idealPositions = useMemo(() => {
    const roles = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'RW', 'ST', 'LW'];
    const positions = [
      { x: 50, y: 5 }, { x: 85, y: 25 }, { x: 65, y: 20 },
      { x: 35, y: 20 }, { x: 15, y: 25 }, { x: 50, y: 35 },
      { x: 70, y: 45 }, { x: 30, y: 45 }, { x: 85, y: 70 },
      { x: 50, y: 80 }, { x: 15, y: 70 },
    ];
    return positions.map((p, i) => ({ ...p, role: roles[i] }));
  }, []);

  // ── Kernel computation ─────────────────────────────────────────────

  const kernels: KernelData[] = useMemo(() => {
    const getPlayerY = (player: Player, fallbackIdx: number) => {
      const metrics = liveData.get(player.id);
      return metrics?.position?.y ?? idealPositions[fallbackIdx]?.y ?? 50;
    };
    const hp = players.slice(0, 11);
    const def = hp.length >= 5 ? [1, 2, 3, 4].map(i => getPlayerY(hp[i], i)) : [20, 20, 25, 25];
    const mid = hp.length >= 8 ? [5, 6, 7].map(i => getPlayerY(hp[i], i)) : [35, 45, 45];
    const fwd = hp.length >= 11 ? [8, 9, 10].map(i => getPlayerY(hp[i], i)) : [70, 80, 70];

    return [
      { id: 'defense', name: 'Defensive Line', color: '#3b82f6', positions: def, logs: kernelLogs.defense || [] },
      { id: 'midfield', name: 'Midfield Line', color: '#22c55e', positions: mid, logs: kernelLogs.midfield || [] },
      { id: 'forward', name: 'Forward Line', color: '#f97316', positions: fwd, logs: kernelLogs.forward || [] },
    ];
  }, [players, liveData, idealPositions, kernelLogs]);

  const updateKernelLogs = useCallback((minute: number) => {
    const newLogs: Record<string, KernelLogEntry[]> = {};
    kernels.forEach(({ id, positions }) => {
      if (!positions.length) return;
      const mean = positions.reduce((a, b) => a + b, 0) / positions.length;
      const stdDev = Math.sqrt(positions.reduce((s, p) => s + (p - mean) ** 2, 0) / positions.length);
      const prevMean = prevKernelMeans.current[id] ?? mean;
      const prevStdDev = prevKernelStdDevs.current[id] ?? stdDev;
      const lastMin = lastKernelLogMinute.current[id] ?? -2;
      if (minute - lastMin < 2) { prevKernelMeans.current[id] = mean; prevKernelStdDevs.current[id] = stdDev; return; }
      const entries: KernelLogEntry[] = [];
      if (Math.abs(mean - prevMean) > 4) entries.push({ id: `${id}-${Date.now()}`, minute, message: mean > prevMean ? `Pushed up to ${mean.toFixed(0)}m` : `Dropped back to ${mean.toFixed(0)}m`, type: 'shift' });
      if (stdDev - prevStdDev > 2.5) entries.push({ id: `${id}-e-${Date.now()}`, minute, message: `Line stretching (\u03c3=${stdDev.toFixed(1)})`, type: 'expand' });
      else if (prevStdDev - stdDev > 2.5) entries.push({ id: `${id}-c-${Date.now()}`, minute, message: `Line compacting (\u03c3=${stdDev.toFixed(1)})`, type: 'compress' });
      positions.forEach((pos, i) => { if (Math.abs(pos - mean) > 18) entries.push({ id: `${id}-b-${i}-${Date.now()}`, minute, message: `Player breaking line at ${pos.toFixed(0)}m`, type: 'break' }); });
      if (entries.length) { newLogs[id] = entries; lastKernelLogMinute.current[id] = minute; }
      prevKernelMeans.current[id] = mean; prevKernelStdDevs.current[id] = stdDev;
    });
    if (Object.keys(newLogs).length) {
      setKernelLogs(prev => {
        const u = { ...prev };
        Object.entries(newLogs).forEach(([k, e]) => { u[k] = [...e, ...(prev[k] || [])].slice(0, 20); });
        return u;
      });
    }
  }, [kernels]);

  // ── Initialize squads ──────────────────────────────────────────────

  useEffect(() => {
    const citySquad = getPLSquadData('MCI');
    if (citySquad.length) {
      setPlayers(citySquad);
      citySquad.forEach(p => setTwin(p.id, createDigitalTwin(p, [])));
    }
    const unitedSquad = getPLSquadData('MUN');
    if (unitedSquad.length) setAwayPlayers(unitedSquad);

    if (!gameEngineRef.current) gameEngineRef.current = createManchesterDerby();
    if (!patternEngineRef.current) patternEngineRef.current = new PatternRecognitionEngine();
    if (!gameModelManagerRef.current && patternEngineRef.current && citySquad.length) {
      gameModelManagerRef.current = createGameModelManager(patternEngineRef.current, catapultService, citySquad);
      const manager: StaffMember = { id: 'mgr-1', name: 'Duncan Ferguson', role: 'manager', canVerify: true, canModify: true };
      const staff: StaffMember[] = [{ id: 'c-1', name: 'Paul Tait', role: 'assistant_coach', canVerify: true, canModify: false }];
      gameModelManagerRef.current.startSession(manager, staff);
    }
  }, [setPlayers, setTwin]);

  // ── Simulation loop ────────────────────────────────────────────────

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive && isSimulating && !isPaused && gameEngineRef.current) {
      interval = setInterval(() => {
        const engine = gameEngineRef.current;
        const pe = patternEngineRef.current;
        if (!engine) return;

        const events = engine.tick(1);
        const state = engine.getState();
        const stats = engine.getStats();
        setMatchState(state);
        setMatchStats(stats);
        if (events.length) setMatchEvents(prev => [...events, ...prev].slice(0, 50));
        updateMatch({ currentMinute: Math.floor(state.minute), score: { home: state.homeScore, away: state.awayScore } });

        // Player metrics
        players.forEach((player, idx) => updateLiveData(player.id, engine.generatePlayerMetrics(player, true, idx)));
        const newAway = new Map<string, TrackingMetrics>();
        awayPlayers.forEach((player, idx) => newAway.set(player.id, engine.generatePlayerMetrics(player, false, idx)));

        // Pattern recognition
        if (pe) {
          const minute = Math.floor(state.minute);
          const roles = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'RW', 'ST', 'LW'];
          const hp = players.slice(0, 11).map((p, i) => ({ x: liveData.get(p.id)?.position?.x ?? 50, y: liveData.get(p.id)?.position?.y ?? 50, name: p.name, role: roles[i] || 'MF' }));
          const ap = awayPlayers.slice(0, 11).map((p, i) => ({ x: newAway.get(p.id)?.position?.x ?? 50, y: newAway.get(p.id)?.position?.y ?? 50, name: p.name, role: roles[i] || 'MF' }));
          const detected = pe.analyzePositions(hp, ap, state.ballPosition || { x: 50, y: 50 }, state.ballPossession || 'home', minute);
          detected.forEach(pat => { if (pat.confidence > 0.5) pe.logPattern(pat, events[0]?.type || 'pass_completed', { success: Math.random() > 0.4, result: Math.random() > 0.5 ? 'possession_retained' : 'turnover', duration: Math.random() * 5 + 2, endZone: 'middle_third' }); });
          const homeP = detected.filter(p => p.team === 'home');
          const awayP = detected.filter(p => p.team === 'away');
          const hCoh = calcCoherence('home', 'total_football', homeP, pe.getChainSummary('home'), minute);
          const aCoh = calcCoherence('away', 'counter_attacking', awayP, pe.getChainSummary('away'), minute);
          setPatternRecognitionData({
            activePatterns: { home: homeP, away: awayP },
            coherence: { home: hCoh, away: aCoh },
            markov: {
              recurrentSequences: pe.getRecurrentSequences(),
              currentChains: { home: pe.getChainSummary('home').currentChain, away: pe.getChainSummary('away').currentChain },
              topTransitions: { home: pe.getTopTransitions('home', 5), away: pe.getTopTransitions('away', 5) },
              predictedNext: { home: pe.getPredictedNextPattern('home')?.pattern?.replace(/_/g, ' ') || null, away: pe.getPredictedNextPattern('away')?.pattern?.replace(/_/g, ' ') || null },
            },
          });
        }

        // Fatigue
        const cm = Math.floor(state.minute);
        const hfm = new Map<string, FatigueModel>();
        const afm = new Map<string, FatigueModel>();
        const air = new Map<string, InjuryRiskModel>();
        players.slice(0, 11).forEach(p => {
          const m = liveData.get(p.id);
          if (m?.position) catapultService.feedLivePosition(p.id, { timestamp: Date.now(), x: m.position.x, y: m.position.y, speed: (m.currentSpeed || 0) / 3.6, acceleration: m.maxAcceleration || 0, heading: 0 });
          hfm.set(p.id, catapultService.calculateFatigueModel(p.id, cm));
          air.set(p.id, catapultService.calculateInjuryRisk(p.id));
        });
        awayPlayers.slice(0, 11).forEach(p => {
          const m = newAway.get(p.id);
          if (m?.position) catapultService.feedLivePosition(p.id, { timestamp: Date.now(), x: m.position.x, y: m.position.y, speed: (m.currentSpeed || 0) / 3.6, acceleration: m.maxAcceleration || 0, heading: 0 });
          afm.set(p.id, catapultService.calculateFatigueModel(p.id, cm));
          air.set(p.id, catapultService.calculateInjuryRisk(p.id));
        });
        setFatigueData({ home: hfm, away: afm, injuryRisks: air });

        // Demo data provider tick
        setGranular(demoProviderRef.current.tick(cm));

        updateKernelLogs(cm);
        if (state.phase === 'full_time') { setIsSimulating(false); endMatch(); }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isLive, isSimulating, isPaused, players, awayPlayers, liveData, updateLiveData, updateMatch, endMatch, updateKernelLogs]);

  function calcCoherence(
    team: 'home' | 'away', gm: string, patterns: TacticalPattern[],
    ms: { currentChain: string; topSequences: { sequence: string; count: number; successRate: number }[]; predictedNext: string | null; chainHealth: 'strong' | 'building' | 'broken' },
    _minute: number,
  ): TacticalCoherence {
    const exp: Record<string, string[]> = {
      total_football: ['positional_rotation', 'half_space_occupation', 'inverted_fullback', 'false_nine_drop', 'high_press_trigger', 'build_from_back'],
      counter_attacking: ['deep_block', 'quick_transition', 'direct_ball', 'wing_isolation', 'defensive_compact', 'counter_press_recovery'],
    };
    const e = exp[gm] || [];
    const dt = patterns.map(p => p.type);
    const matched = e.filter(x => dt.some(d => d.includes(x.split('_')[0]) || x.includes(d.split('_')[0])));
    const pc = e.length > 0 ? (matched.length / e.length) * 100 : 50;
    const chb = ms.chainHealth === 'strong' ? 20 : ms.chainHealth === 'building' ? 10 : 0;
    const sb = Math.min(15, ms.topSequences.filter(s => s.count > 2).length * 5);
    const hc = patterns.filter(p => p.confidence > 0.7);
    const cb = Math.min(15, hc.length * 3);
    const score = Math.min(100, Math.max(0, pc + chb + sb + cb));
    return {
      gameModel: gm, coherenceScore: Math.round(score),
      deviations: e.filter(x => !matched.includes(x)).slice(0, 3).map(p => ({ pattern: p.replace(/_/g, ' '), deviation: 30 + Math.random() * 40, reason: `${p.replace(/_/g, ' ')} not detected` })),
      suggestions: [],
      historicalComparison: { avgCoherence: 65, trend: hc.length > 3 ? 'improving' : hc.length < 1 ? 'declining' : 'stable' },
    };
  }

  // ── Match controls ─────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    gameEngineRef.current = createManchesterDerby();
    gameEngineRef.current.kickoff();
    patternEngineRef.current = new PatternRecognitionEngine();
    demoProviderRef.current.reset();
    setMatchEvents([]);
    setMatchState(gameEngineRef.current.getState());
    setMatchStats(gameEngineRef.current.getStats());
    startMatch({ matchId: `match-${Date.now()}`, gameApproach: undefined });
    setIsSimulating(true);
    setIsPaused(false);
  }, [startMatch]);

  const handlePause = useCallback(() => setIsPaused(prev => !prev), []);
  const handleEnd = useCallback(() => {
    setIsSimulating(false); setIsPaused(false);
    endMatch(); setMatchState(null); setMatchStats(null);
  }, [endMatch]);

  // ── Derived display values ─────────────────────────────────────────

  const { feeds, computed } = granular;
  const minute = matchState ? Math.floor(matchState.minute) : 0;

  // ═════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════

  return (
    <div className="h-screen bg-zinc-950 text-white overflow-hidden flex flex-col">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 h-11 flex items-center justify-between px-4 bg-black/60 border-b border-white/5">
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-bold tracking-wider text-white/70">THE BIG DUNC</span>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-sky-400 text-xs font-medium">MCI</span>
          <span className="text-sm font-semibold tabular-nums">
            {matchState ? `${matchState.homeScore} – ${matchState.awayScore}` : '0–0'}
          </span>
          <span className="text-red-400 text-xs font-medium">MUN</span>
          {isLive && matchState && (
            <div className="flex items-center gap-1.5 ml-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-white/40 tabular-nums">{minute}&apos;</span>
            </div>
          )}
        </div>
        {/* API feed status dots */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            {[
              { name: 'Catapult', s: feeds.catapult.status },
              { name: 'Opta', s: feeds.opta.status },
              { name: 'StatsBomb', s: feeds.statsbomb.status },
              { name: '2nd Spec', s: feeds.secondSpectrum.status },
              { name: 'SkillCnr', s: feeds.skillcorner.status },
            ].map(f => (
              <div key={f.name} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-white/20'}`} />
                <span className="text-[8px] text-white/30">{f.name}</span>
              </div>
            ))}
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            {!isLive ? (
              <button onClick={handleStart} className="flex items-center gap-1.5 px-3 py-1 bg-white text-black rounded-full text-xs font-medium hover:bg-white/90">
                <Play className="w-3 h-3" /> Start
              </button>
            ) : (
              <>
                <button onClick={handlePause} className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full">
                  {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                </button>
                <button onClick={handleEnd} className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-red-500/80 rounded-full">
                  <Square className="w-2.5 h-2.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT COLUMN: Pitch + API Feeds ──────────────────────── */}
        <div className="w-[34%] flex flex-col border-r border-white/5">
          {/* Blank pitch */}
          <div className="flex-1 flex flex-col p-2 min-h-0">
            <div className="flex-1 bg-zinc-900 rounded-lg overflow-hidden flex flex-col">
              <div className="flex-shrink-0 px-3 py-1.5 bg-black/40 flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-white/30 font-medium">Kernel Pitch View</span>
                <div className="flex items-center gap-2">
                  {kernels.map(k => (
                    <div key={k.id} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: k.color }} />
                      <span className="text-[8px] text-white/30">{k.name.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-hidden flex items-center justify-center bg-zinc-950/50 p-1">
                <BlankPitch kernels={kernels} />
              </div>
            </div>
          </div>

          {/* API Data Feeds */}
          <div className="flex-shrink-0 px-2 pb-2">
            <div className="bg-zinc-900 rounded-lg border border-white/5 overflow-hidden">
              <div className="px-3 py-1.5 bg-black/40 flex items-center gap-2">
                <Radio className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] uppercase tracking-wider text-white/40">Live Data Feeds</span>
                <span className="ml-auto text-[8px] text-emerald-400/60">{isLive ? '5/5 streaming' : 'standby'}</span>
              </div>
              <div className="divide-y divide-white/5">
                {/* Catapult */}
                <div className="px-3 py-1.5 flex items-center gap-3">
                  <div className="w-16">
                    <div className="text-[9px] font-medium text-white/60">Catapult</div>
                    <div className="text-[7px] text-white/25">Vector S7 · 10Hz</div>
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-1.5 text-center">
                    <MicroStat label="PL" value={feeds.catapult.teamAggregates.avgPlayerLoad.toFixed(0)} />
                    <MicroStat label="Dist" value={`${(feeds.catapult.teamAggregates.totalDistance / 1000).toFixed(1)}k`} />
                    <MicroStat label="Peak" value={`${feeds.catapult.teamAggregates.peakSpeed.toFixed(1)}`} unit="km/h" />
                    <MicroStat label="HR" value={`${feeds.catapult.teamAggregates.avgHR.toFixed(0)}`} unit="bpm" />
                  </div>
                </div>
                {/* Opta */}
                <div className="px-3 py-1.5 flex items-center gap-3">
                  <div className="w-16">
                    <div className="text-[9px] font-medium text-white/60">Opta</div>
                    <div className="text-[7px] text-white/25">F24 · Events</div>
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-1.5 text-center">
                    <MicroStat label="Pass" value={`${feeds.opta.aggregates.passes}`} />
                    <MicroStat label="Acc%" value={`${feeds.opta.aggregates.passAccuracy.toFixed(1)}`} />
                    <MicroStat label="Shots" value={`${feeds.opta.aggregates.shots}`} />
                    <MicroStat label="Tkl" value={`${feeds.opta.aggregates.tackles}`} />
                  </div>
                </div>
                {/* StatsBomb */}
                <div className="px-3 py-1.5 flex items-center gap-3">
                  <div className="w-16">
                    <div className="text-[9px] font-medium text-white/60">StatsBomb</div>
                    <div className="text-[7px] text-white/25">360 · 25Hz</div>
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-1.5 text-center">
                    <MicroStat label="xG" value={feeds.statsbomb.metrics.xG.toFixed(2)} highlight />
                    <MicroStat label="xT" value={feeds.statsbomb.metrics.xT.toFixed(1)} />
                    <MicroStat label="Prog" value={`${feeds.statsbomb.metrics.progressivePasses}`} />
                    <MicroStat label="SCA" value={`${feeds.statsbomb.metrics.shotCreatingActions}`} />
                  </div>
                </div>
                {/* Second Spectrum */}
                <div className="px-3 py-1.5 flex items-center gap-3">
                  <div className="w-16">
                    <div className="text-[9px] font-medium text-white/60">2nd Spec</div>
                    <div className="text-[7px] text-white/25">Optical · 25fps</div>
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-1.5 text-center">
                    <MicroStat label="Spread" value={`${feeds.secondSpectrum.spatial.teamSpread.toFixed(0)}m`} />
                    <MicroStat label="DefH" value={`${feeds.secondSpectrum.spatial.defLineHeight.toFixed(0)}m`} />
                    <MicroStat label="Box" value={`${feeds.secondSpectrum.possession.boxEntries}`} />
                    <MicroStat label="Runs" value={`${feeds.secondSpectrum.movement.offBallRuns}`} />
                  </div>
                </div>
                {/* SkillCorner */}
                <div className="px-3 py-1.5 flex items-center gap-3">
                  <div className="w-16">
                    <div className="text-[9px] font-medium text-white/60">SkillCorner</div>
                    <div className="text-[7px] text-white/25">Broadcast · 10fps</div>
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-1.5 text-center">
                    <MicroStat label="Phys" value={`${feeds.skillcorner.physical.teamPhysicalOutput.toFixed(0)}%`} />
                    <MicroStat label="Sym" value={feeds.skillcorner.physical.runningSymmetry.toFixed(2)} />
                    <MicroStat label="FrmS" value={feeds.skillcorner.tactical.formationStability.toFixed(2)} />
                    <MicroStat label="RecT" value={`${feeds.skillcorner.tactical.defensiveRecoveryTime.toFixed(1)}s`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Kernel Viz + Computation ──────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Kernel wave functions + composite */}
          <div className="flex-shrink-0">
            <KernelWaveViz kernels={kernels} />
          </div>

          {/* Granular Computation Engine */}
          <div className="flex-1 overflow-auto px-2 pb-2">
            <div className="bg-zinc-900 rounded-lg border border-white/5 overflow-hidden">
              <div className="px-3 py-1.5 bg-black/40 flex items-center gap-2">
                <Cpu className="w-3 h-3 text-purple-400" />
                <span className="text-[9px] uppercase tracking-wider text-white/40">Granular Computation Engine</span>
                <span className="ml-auto text-[8px] text-purple-400/60">10 metrics · {isLive ? 'real-time' : 'idle'}</span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-5 gap-px bg-white/5">
                <ComputeCell
                  icon={<Target className="w-3 h-3" />}
                  label="PPDA"
                  value={computed.ppda.value.toFixed(1)}
                  sub={`trend: ${computed.ppda.trend}`}
                  color="text-orange-400"
                  trend={computed.ppda.trend}
                  sources={computed.ppda.sources}
                />
                <ComputeCell
                  icon={<Zap className="w-3 h-3" />}
                  label="xT"
                  value={computed.xT.value.toFixed(1)}
                  sub={`${computed.xT.perMinute.toFixed(2)}/min`}
                  color="text-amber-400"
                  sources={computed.xT.sources}
                />
                <ComputeCell
                  icon={<BarChart3 className="w-3 h-3" />}
                  label="Space Ctrl"
                  value={`${computed.spaceControl.value}%`}
                  sub={`atk ${computed.spaceControl.attacking}% / def ${computed.spaceControl.defensive}%`}
                  color="text-sky-400"
                  sources={computed.spaceControl.sources}
                />
                <ComputeCell
                  icon={<AlertTriangle className="w-3 h-3" />}
                  label="Def Vuln"
                  value={computed.defensiveVulnerability.value.toFixed(2)}
                  sub={computed.defensiveVulnerability.zones.length ? computed.defensiveVulnerability.zones.join(', ') : 'no weak zones'}
                  color={computed.defensiveVulnerability.value > 0.4 ? 'text-red-400' : 'text-emerald-400'}
                  sources={computed.defensiveVulnerability.sources}
                />
                <ComputeCell
                  icon={<Shield className="w-3 h-3" />}
                  label="Coherence"
                  value={`${computed.coherenceScore.value}`}
                  sub={`F:${computed.coherenceScore.breakdown.formation} P:${computed.coherenceScore.breakdown.pressing} B:${computed.coherenceScore.breakdown.possession}`}
                  color={computed.coherenceScore.value >= 70 ? 'text-emerald-400' : computed.coherenceScore.value >= 50 ? 'text-amber-400' : 'text-red-400'}
                  sources={computed.coherenceScore.sources}
                />
                <ComputeCell
                  icon={<Activity className="w-3 h-3" />}
                  label="Counter-Press"
                  value={`${computed.counterPressEfficiency.value}%`}
                  sub={`${computed.counterPressEfficiency.successes}/${computed.counterPressEfficiency.attempts} regains`}
                  color="text-violet-400"
                  sources={computed.counterPressEfficiency.sources}
                />
                <ComputeCell
                  icon={<TrendingUp className="w-3 h-3" />}
                  label="Prog Rate"
                  value={`${computed.progressiveActionRate.value}`}
                  sub={`${computed.progressiveActionRate.passes}p + ${computed.progressiveActionRate.carries}c`}
                  color="text-cyan-400"
                  sources={computed.progressiveActionRate.sources}
                />
                <ComputeCell
                  icon={<Activity className="w-3 h-3" />}
                  label="Fatigue"
                  value={`${computed.teamFatigue.value.toFixed(0)}%`}
                  sub={`+15m: ${computed.teamFatigue.projected15}%`}
                  color={computed.teamFatigue.value > 50 ? 'text-red-400' : computed.teamFatigue.value > 30 ? 'text-amber-400' : 'text-emerald-400'}
                  sources={computed.teamFatigue.sources}
                />
                <ComputeCell
                  icon={<Target className="w-3 h-3" />}
                  label="Press Intns"
                  value={`${computed.pressingIntensity.value}`}
                  sub={`ppda ${computed.pressingIntensity.ppda.toFixed(1)} · hi ${computed.pressingIntensity.highPress.toFixed(1)}`}
                  color="text-orange-400"
                  sources={computed.pressingIntensity.sources}
                />
                <ComputeCell
                  icon={<BarChart3 className="w-3 h-3" />}
                  label="Buildup"
                  value={`${computed.buildUpSpeed.value}s`}
                  sub={`${computed.buildUpSpeed.avgPasses} passes/seq`}
                  color="text-teal-400"
                  sources={computed.buildUpSpeed.sources}
                />
              </div>
            </div>

            {/* Opta Event Stream */}
            <div className="mt-2 bg-zinc-900 rounded-lg border border-white/5 overflow-hidden">
              <div className="px-3 py-1.5 bg-black/40 flex items-center gap-2">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] uppercase tracking-wider text-white/40">Opta Event Stream</span>
                <span className="ml-auto text-[8px] text-white/25">{feeds.opta.matchEvents} events</span>
              </div>
              <div className="max-h-24 overflow-y-auto">
                {feeds.opta.recentEvents.length === 0 ? (
                  <div className="px-3 py-2 text-[9px] text-white/20 text-center">Awaiting match start</div>
                ) : (
                  feeds.opta.recentEvents.map(e => (
                    <div key={e.id} className="px-3 py-1 flex items-center gap-2 text-[9px] border-b border-white/[0.03] last:border-0">
                      <span className="text-white/25 tabular-nums w-5 text-right">{e.minute}&apos;</span>
                      <span className={`px-1 py-0.5 rounded text-[7px] font-medium ${
                        e.type === 'shot' ? 'bg-amber-500/20 text-amber-300' :
                        e.type === 'tackle' ? 'bg-blue-500/20 text-blue-300' :
                        e.type === 'interception' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-white/5 text-white/40'
                      }`}>{e.type}</span>
                      <span className="text-white/50">{e.player}</span>
                      <span className={`ml-auto text-[8px] ${e.outcome === 'complete' || e.outcome === 'success' || e.outcome === 'won' || e.outcome === 'goal' ? 'text-emerald-400/60' : 'text-red-400/40'}`}>{e.outcome}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* StatsBomb Shot Map */}
            {feeds.statsbomb.shotMap.length > 0 && (
              <div className="mt-2 bg-zinc-900 rounded-lg border border-white/5 overflow-hidden">
                <div className="px-3 py-1.5 bg-black/40 flex items-center gap-2">
                  <Target className="w-3 h-3 text-amber-400" />
                  <span className="text-[9px] uppercase tracking-wider text-white/40">StatsBomb Shot Map</span>
                </div>
                <div className="px-3 py-1.5 flex flex-wrap gap-1.5">
                  {feeds.statsbomb.shotMap.map((shot, i) => (
                    <div key={i} className={`px-1.5 py-0.5 rounded text-[8px] ${
                      shot.outcome === 'goal' ? 'bg-emerald-500/20 text-emerald-300' :
                      shot.outcome === 'saved' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-white/5 text-white/40'
                    }`}>
                      {shot.minute}&apos; {shot.player.split(' ').pop()} xG:{shot.xG.toFixed(2)} ({shot.outcome})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Inline sub-components
// ═══════════════════════════════════════════════════════════════════════

function MicroStat({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div className="bg-black/20 rounded px-1 py-0.5">
      <div className="text-[7px] text-white/25">{label}</div>
      <div className={`text-[9px] font-medium tabular-nums ${highlight ? 'text-amber-400' : 'text-white/60'}`}>
        {value}{unit && <span className="text-[7px] text-white/25 ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

function ComputeCell({
  icon, label, value, sub, color, trend, sources,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  trend?: 'up' | 'down' | 'stable';
  sources: string[];
}) {
  return (
    <div className="bg-zinc-950 p-2 flex flex-col gap-1 group relative">
      <div className="flex items-center gap-1.5">
        <span className={color}>{icon}</span>
        <span className="text-[8px] uppercase tracking-wider text-white/35">{label}</span>
        {trend && (
          <span className="ml-auto">
            {trend === 'up' ? <TrendingUp className="w-2.5 h-2.5 text-emerald-400/50" /> :
             trend === 'down' ? <TrendingDown className="w-2.5 h-2.5 text-red-400/50" /> :
             <Minus className="w-2.5 h-2.5 text-white/20" />}
          </span>
        )}
      </div>
      <div className={`text-base font-semibold tabular-nums leading-none ${color}`}>{value}</div>
      <div className="text-[7px] text-white/25 truncate">{sub}</div>
      {/* Source tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
        <div className="bg-zinc-800 border border-white/10 rounded px-2 py-1 text-[7px] text-white/50 whitespace-nowrap shadow-lg">
          Sources: {sources.join(' + ')}
        </div>
      </div>
    </div>
  );
}
