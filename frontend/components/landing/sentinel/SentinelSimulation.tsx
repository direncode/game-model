"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

// Runnable buyer-facing simulation. Streams from /api/sentinel-sim via SSE.
// Each tick is a real packet from the server, not a precomputed animation.

type Phase = { name: string; blurb: string; duration: number };

type SimEvent =
  | { kind: "hello"; scenario: string; seed: number; tick_ms: number; total_events: number; phases: Phase[]; target_host: string }
  | { kind: "phase"; idx: number; name: string; blurb: string; t: number }
  | { kind: "log"; t: number; source: string; host: string; line: string; rare: boolean }
  | { kind: "pipeline"; t: number; stage: "L0" | "L1" | "L2" | "L3" | "L4"; count: number }
  | { kind: "metric"; t: number; name: string; value: number; unit?: string }
  | { kind: "detection"; t: number; lineage: string; family: string; z: number; host: string; ts: string; novel: boolean }
  | { kind: "done"; t: number; lineage: string; response_digest: string; wall_ms: number }
  | { kind: "end" };

const STAGES: { code: "L0" | "L1" | "L2" | "L3" | "L4"; label: string; color: string }[] = [
  { code: "L0", label: "Ingest",       color: "#00d4ff" },
  { code: "L1", label: "BTUT",         color: "#3fb950" },
  { code: "L2", label: "TCD-JEPA",     color: "#a371f7" },
  { code: "L3", label: "Lineage",      color: "#d29922" },
  { code: "L4", label: "Detection",    color: "#f85149" },
];

const SOURCE_COLOR: Record<string, string> = {
  zeek: "#00d4ff",
  sysmon: "#a371f7",
  netflow: "#3fb950",
  edr: "#d29922",
};

type Detection = { lineage: string; family: string; z: number; host: string; ts: string; novel: boolean };

export function SentinelSimulation() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(-1);
  const [phaseName, setPhaseName] = useState("STANDBY");
  const [phaseBlurb, setPhaseBlurb] = useState("Press LAUNCH to begin OPERATION HALCYON-7.");
  const [phases, setPhases] = useState<Phase[]>([]);
  const [logs, setLogs] = useState<({ id: number } & SimEvent & { kind: "log" })[]>([]);
  const [counters, setCounters] = useState<Record<"L0" | "L1" | "L2" | "L3" | "L4", number>>({
    L0: 0, L1: 0, L2: 0, L3: 0, L4: 0,
  });
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [detections, setDetections] = useState<Detection[]>([]);
  const [doneInfo, setDoneInfo] = useState<{ lineage: string; response_digest: string; wall_ms: number } | null>(null);
  const [meta, setMeta] = useState<{ scenario: string; seed: number; tick_ms: number; total_events: number; target_host: string } | null>(null);
  const [eventsSeen, setEventsSeen] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const logIdRef = useRef(0);
  const tailRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setRunning(false);
    setDone(false);
    setPhaseIdx(-1);
    setPhaseName("STANDBY");
    setPhaseBlurb("Press LAUNCH to begin OPERATION HALCYON-7.");
    setLogs([]);
    setCounters({ L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 });
    setMetrics({});
    setDetections([]);
    setDoneInfo(null);
    setMeta(null);
    setEventsSeen(0);
    setError(null);
    logIdRef.current = 0;
  }, []);

  const launch = useCallback(() => {
    reset();
    setRunning(true);
    setPhaseName("CONNECTING…");
    setPhaseBlurb("opening SSE channel to /api/sentinel-sim");

    const es = new EventSource("/api/sentinel-sim");
    esRef.current = es;

    es.onerror = () => {
      // EventSource auto-reconnects; if we already saw 'done' that's fine.
      if (!doneInfo) {
        setError("stream interrupted");
      }
      es.close();
      esRef.current = null;
      setRunning(false);
    };

    es.onmessage = (msg) => {
      let ev: SimEvent;
      try {
        ev = JSON.parse(msg.data);
      } catch {
        return;
      }
      setEventsSeen((n) => n + 1);

      switch (ev.kind) {
        case "hello":
          setMeta({
            scenario: ev.scenario,
            seed: ev.seed,
            tick_ms: ev.tick_ms,
            total_events: ev.total_events,
            target_host: ev.target_host,
          });
          setPhases(ev.phases);
          break;
        case "phase":
          setPhaseIdx(ev.idx);
          setPhaseName(ev.name);
          setPhaseBlurb(ev.blurb);
          break;
        case "log":
          setLogs((prev) => {
            const id = ++logIdRef.current;
            const next = [...prev, { ...ev, id }];
            return next.length > 80 ? next.slice(-80) : next;
          });
          break;
        case "pipeline":
          setCounters((c) => ({ ...c, [ev.stage]: ev.count }));
          break;
        case "metric":
          setMetrics((m) => ({ ...m, [ev.name]: ev.value }));
          break;
        case "detection":
          setDetections((d) => [{ lineage: ev.lineage, family: ev.family, z: ev.z, host: ev.host, ts: ev.ts, novel: ev.novel }, ...d]);
          break;
        case "done":
          setDoneInfo({ lineage: ev.lineage, response_digest: ev.response_digest, wall_ms: ev.wall_ms });
          setDone(true);
          break;
        case "end":
          es.close();
          esRef.current = null;
          setRunning(false);
          break;
      }
    };
  }, [doneInfo, reset]);

  // Auto-scroll log tail
  useEffect(() => {
    const el = tailRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  // Cleanup on unmount
  useEffect(() => () => esRef.current?.close(), []);

  const progressPct = useMemo(() => {
    if (!meta) return 0;
    return Math.min(100, (eventsSeen / meta.total_events) * 100);
  }, [eventsSeen, meta]);

  const fingerprintRate = useMemo(() => {
    if (!metrics.fingerprints_written || !meta?.tick_ms) return 0;
    return Math.round(metrics.fingerprints_written / Math.max(1, eventsSeen / 5));
  }, [metrics.fingerprints_written, meta, eventsSeen]);

  return (
    <section id="simulation" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        {/* Heading */}
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-red mb-4">
            Operation HALCYON-7 · runnable simulation
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Press launch.<br />
            <span className="text-white/40">Watch ingest become evidence.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl">
            A 28-second red-team scenario on a 47-host classified subnet.
            Telemetry streams from the appliance over an open SSE channel;
            every event is computed deterministically from{" "}
            <code className="font-mono text-li-cyan">sha256(scenario || seed=42 || tick)</code>.
            EDR clears the beacon as benign. Sentinel does not.
          </p>
        </motion.div>

        {/* Briefing strip */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-10 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  running ? "bg-li-green animate-pulse" : done ? "bg-li-cyan" : "bg-white/40"
                }`}
                style={{
                  boxShadow: running ? "0 0 12px #3fb950" : done ? "0 0 12px #00d4ff" : "none",
                }}
              />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Scenario · scenario={meta?.scenario ?? "halcyon-7"} · seed={meta?.seed ?? 42}
                </div>
                <div className="font-display text-2xl text-white tracking-tight leading-tight">
                  {phaseName}
                </div>
                <div className="text-[12px] text-white/55 mt-0.5">{phaseBlurb}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={launch}
                disabled={running}
                className={`inline-flex items-center justify-center h-10 px-5 rounded-full text-sm font-medium transition-colors ${
                  running
                    ? "bg-white/10 text-white/40 cursor-not-allowed"
                    : "bg-white text-black hover:bg-white/90"
                }`}
              >
                {running ? "running…" : done ? "Re-launch" : "▶  Launch"}
              </button>
              <button
                onClick={reset}
                disabled={!running && !done && logs.length === 0}
                className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-white/15 text-white/70 text-xs font-mono hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
              >
                reset
              </button>
            </div>
          </div>

          {/* Phase rail */}
          <div className="grid grid-cols-3 md:grid-cols-6 border-b border-white/10">
            {phases.length > 0
              ? phases.map((p, i) => {
                  const active = i === phaseIdx;
                  const past = i < phaseIdx;
                  return (
                    <div
                      key={p.name}
                      className={`px-4 py-3 border-r border-white/[0.06] last:border-r-0 ${
                        active
                          ? "bg-li-cyan/[0.05]"
                          : past
                            ? "bg-white/[0.02]"
                            : ""
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full mb-2 ${
                          active ? "bg-li-cyan animate-pulse" : past ? "bg-li-green" : "bg-white/15"
                        }`}
                      />
                      <div
                        className={`font-mono text-[10px] uppercase tracking-widest ${
                          active ? "text-li-cyan" : past ? "text-li-green" : "text-white/35"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")} · {p.name}
                      </div>
                    </div>
                  );
                })
              : Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 border-r border-white/[0.06] last:border-r-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/10 mb-2" />
                    <div className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                      {String(i + 1).padStart(2, "0")} · standby
                    </div>
                  </div>
                ))}
          </div>

          {/* Progress */}
          <div className="px-6 py-3 flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40 shrink-0">
              progress
            </span>
            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                ref={progressRef}
                className="h-full bg-gradient-to-r from-li-cyan via-li-green to-li-red transition-all duration-200 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-white/50 tabular-nums shrink-0">
              {eventsSeen.toString().padStart(3, "0")} / {meta?.total_events ?? "—"}
            </span>
          </div>
        </motion.div>

        {/* Pipeline + tail */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
          {/* Pipeline diagram */}
          <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Pipeline · L0 → L4
              </span>
              <span className="font-mono text-[10px] text-white/30">
                target host: {meta?.target_host ?? "DCDA-WS-0419"}
              </span>
            </div>
            <div className="p-5 space-y-3">
              {STAGES.map((s, i) => {
                const max = Math.max(1, ...Object.values(counters));
                const w = (counters[s.code] / max) * 100;
                const flowing = running && counters[s.code] > 0;
                return (
                  <div key={s.code}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[10px] tracking-[0.2em] uppercase"
                          style={{ color: s.color }}
                        >
                          {s.code}
                        </span>
                        <span className="text-sm text-white/85">{s.label}</span>
                      </div>
                      <span className="font-mono text-[11px] text-white/60 tabular-nums">
                        {counters[s.code].toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden relative">
                      <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                          width: `${w}%`,
                          backgroundColor: s.color,
                          boxShadow: flowing ? `0 0 8px ${s.color}80` : "none",
                        }}
                      />
                      {flowing && (
                        <div
                          className="absolute top-0 bottom-0 w-12 opacity-50"
                          style={{
                            background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`,
                            animation: "pktflow 1.6s linear infinite",
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <style>{`
                @keyframes pktflow {
                  0%   { transform: translateX(-100%); }
                  100% { transform: translateX(900%); }
                }
              `}</style>
            </div>

            {/* Live KPIs */}
            <div className="grid grid-cols-3 border-t border-white/10">
              <KPI
                label="ingest pps"
                value={metrics.ingest_pps?.toLocaleString() ?? "—"}
                tone="cyan"
              />
              <KPI
                label="rare share"
                value={
                  metrics.rare_share != null ? (metrics.rare_share * 100).toFixed(2) + "%" : "—"
                }
                tone="purple"
              />
              <KPI
                label="fingerprints"
                value={metrics.fingerprints_written?.toLocaleString() ?? "—"}
                tone="green"
              />
            </div>
          </div>

          {/* Live tail */}
          <div className="rounded-2xl border border-white/10 bg-black overflow-hidden flex flex-col h-[440px]">
            <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-li-red/70" />
                  <div className="w-2 h-2 rounded-full bg-li-yellow/70" />
                  <div className="w-2 h-2 rounded-full bg-li-green/70" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                  /var/log/sentinel/ingest.tail
                </span>
              </div>
              <span className="font-mono text-[10px] text-white/30">
                {logs.length}/80 lines
              </span>
            </div>
            <div
              ref={tailRef}
              className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-[1.5] text-white/85 space-y-0.5"
            >
              {logs.length === 0 && (
                <div className="text-white/30 italic">
                  awaiting first packet … press LAUNCH to begin.
                </div>
              )}
              {logs.map((l) => (
                <div
                  key={l.id}
                  className={`flex items-start gap-2 ${
                    l.rare ? "text-li-red" : "text-white/75"
                  }`}
                >
                  <span
                    className="font-mono text-[10px] uppercase tracking-widest shrink-0 w-14"
                    style={{ color: SOURCE_COLOR[l.source] ?? "#888" }}
                  >
                    {l.source}
                  </span>
                  <span className="shrink-0 w-32 truncate text-white/40">{l.host}</span>
                  <span className="break-all">{l.line}</span>
                  {l.rare && (
                    <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-widest text-li-red">
                      rare
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detections + final lineage */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
          <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-red">
                Detections
              </span>
              <span className="font-mono text-[10px] text-white/30">
                {detections.length} {detections.length === 1 ? "event" : "events"}
              </span>
            </div>
            <div className="p-5 space-y-3 min-h-[180px]">
              {detections.length === 0 && (
                <div className="font-mono text-[11px] text-white/30 italic">
                  no detections yet · structural taxonomy still crystallizing
                </div>
              )}
              {detections.map((d) => (
                <div
                  key={d.lineage}
                  className={`rounded-xl border p-4 ${
                    d.novel
                      ? "border-li-purple/40 bg-li-purple/[0.05]"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: d.novel ? "#a371f7" : "#f85149",
                          boxShadow: d.novel ? "0 0 10px #a371f7" : "0 0 10px #f85149",
                        }}
                      />
                      <span
                        className="font-display text-xl tracking-tight"
                        style={{ color: d.novel ? "#a371f7" : "#fff" }}
                      >
                        {d.family}
                      </span>
                      {d.novel && (
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-li-purple ml-1 px-1.5 py-0.5 rounded border border-li-purple/40">
                          novel
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-sm text-li-green tabular-nums">
                      {d.z.toFixed(1)} σ
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-white/55 leading-relaxed break-all">
                    host:    <span className="text-white/85">{d.host}</span><br />
                    ts:      <span className="text-white/85">{d.ts}</span><br />
                    lineage: <span className="text-li-cyan">{d.lineage}</span>
                  </div>
                  <a
                    href={`#replay-anchor`}
                    onClick={(e) => {
                      e.preventDefault();
                      // Hand off to the existing live replay section by scrolling
                      // and dispatching a custom event the SentinelReplay can pick up.
                      const target = document.querySelector("[data-replay-input]") as HTMLInputElement | null;
                      if (target) {
                        target.value = d.lineage;
                        target.dispatchEvent(new Event("input", { bubbles: true }));
                        target.scrollIntoView({ behavior: "smooth", block: "center" });
                        target.focus();
                      }
                    }}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-mono text-li-cyan hover:text-white transition-colors"
                  >
                    open in replay →
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Done card */}
          <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green">
                Final state
              </span>
              {doneInfo && (
                <span className="font-mono text-[10px] text-white/40">
                  wall {doneInfo.wall_ms} ms (sim)
                </span>
              )}
            </div>
            <div className="p-5">
              {!doneInfo && (
                <div className="font-mono text-[11px] text-white/30 italic">
                  awaiting end-of-run packet · scenario must reach the lineage anchor phase
                </div>
              )}
              {doneInfo && (
                <>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
                    response_digest
                  </div>
                  <div className="font-mono text-xs text-li-green break-all leading-relaxed">
                    sha256:{doneInfo.response_digest}
                  </div>
                  <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
                    final lineage
                  </div>
                  <div className="font-mono text-xs text-white/85 break-all leading-relaxed">
                    {doneInfo.lineage}
                  </div>
                  <div className="mt-5 rounded-lg bg-li-green/[0.05] border border-li-green/20 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green mb-1">
                      determinism contract
                    </div>
                    <div className="text-[12px] text-white/75 leading-relaxed">
                      Re-launch this scenario on any appliance. The final
                      response_digest will be byte-identical, forever, under
                      seed = {meta?.seed ?? 42}.
                    </div>
                  </div>
                </>
              )}
              {error && (
                <div className="mt-4 font-mono text-[11px] text-li-red">
                  stream error: {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "cyan" | "green" | "purple" }) {
  const c = tone === "green" ? "text-li-green" : tone === "purple" ? "text-li-purple" : "text-li-cyan";
  return (
    <div className="px-5 py-4 border-r border-white/[0.06] last:border-r-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
        {label}
      </div>
      <div className={`font-display text-2xl tabular-nums tracking-tight ${c}`}>{value}</div>
    </div>
  );
}
