"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AttackCat = "normal" | "dos" | "probe" | "r2l" | "u2r";

type PhasePlan = { name: string; blurb: string; records: number; ms: number };
type Hello = {
  kind: "hello";
  scenario: string;
  seed: number;
  total_records: number;
  sampling_target: number;
  phases: PhasePlan[];
  corpus: { name: string; records: number; classes: number; size_bytes: number; sha256_top100: string };
  target_host: string;
};
type SimEvent =
  | Hello
  | { kind: "phase"; idx: number; name: string; blurb: string; t: number }
  | { kind: "log"; t: number; source: string; host: string; line: string; rare: boolean; category: AttackCat; record_idx: number; label: string }
  | { kind: "pipeline"; t: number; stage: "L0" | "L1" | "L2" | "L3" | "L4"; count: number }
  | { kind: "metric"; t: number; name: string; value: number }
  | { kind: "matrix"; t: number; cell: { actual: AttackCat; predicted_by: "edr" | "sentinel"; correct: boolean } }
  | { kind: "detection"; t: number; lineage: string; family: string; category: AttackCat; z: number; host: string; ts: string; novel: boolean; record_idx: number; record_bytes_sha256: string; record_preview: string }
  | { kind: "done"; t: number; lineage: string; response_digest: string; wall_ms: number; n_records: number; n_detections: number; novel_classes: number }
  | { kind: "end" }
  | { kind: "error"; detail: string };

type Detection = Extract<SimEvent, { kind: "detection" }>;

const STAGES: { code: "L0" | "L1" | "L2" | "L3" | "L4"; label: string; sub: string; color: string }[] = [
  { code: "L0", label: "Ingest",     sub: "schema-aware parsers, byte-hash on entry",      color: "#00d4ff" },
  { code: "L1", label: "BTUT",       sub: "48-bit structural fingerprint substrate",        color: "#3fb950" },
  { code: "L2", label: "TCD-JEPA",   sub: "persistent-homology taxonomy crystallization",   color: "#a371f7" },
  { code: "L3", label: "Lineage",    sub: "merkle proofs + OTS anchors",                    color: "#d29922" },
  { code: "L4", label: "Detection",  sub: "null-permutation gated emit",                    color: "#f85149" },
];

const CATS: { id: AttackCat; label: string; tone: string; sub: string }[] = [
  { id: "normal", label: "Normal", tone: "#9aa3b2", sub: "benign baseline" },
  { id: "dos",    label: "DoS",    tone: "#f85149", sub: "neptune, smurf, back, teardrop" },
  { id: "probe",  label: "Probe",  tone: "#d29922", sub: "satan, ipsweep, portsweep, nmap" },
  { id: "r2l",    label: "R2L",    tone: "#00d4ff", sub: "warezclient, guess_passwd, ftp_write" },
  { id: "u2r",    label: "U2R",    tone: "#a371f7", sub: "buffer_overflow, rootkit, perl" },
];

const SOURCE_COLOR: Record<string, string> = {
  zeek: "#00d4ff",
  sysmon: "#a371f7",
  netflow: "#3fb950",
  edr: "#d29922",
};

type CMRow = { edr_correct: number; edr_wrong: number; sentinel_correct: number; sentinel_wrong: number };
const ZERO: CMRow = { edr_correct: 0, edr_wrong: 0, sentinel_correct: 0, sentinel_wrong: 0 };

function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}
function shortHash(h: string, head = 12, tail = 4) {
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}
function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}
function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function RangeConsole() {
  // state
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [hello, setHello] = useState<Hello | null>(null);
  const [phaseIdx, setPhaseIdx] = useState(-1);
  const [phaseName, setPhaseName] = useState("STANDBY");
  const [phaseBlurb, setPhaseBlurb] = useState("Configure scenario, then press LAUNCH.");
  const [logs, setLogs] = useState<({ id: number } & Extract<SimEvent, { kind: "log" }>)[]>([]);
  const [counters, setCounters] = useState<Record<"L0" | "L1" | "L2" | "L3" | "L4", number>>({ L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 });
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [cm, setCm] = useState<Record<AttackCat, CMRow>>({ normal: { ...ZERO }, dos: { ...ZERO }, probe: { ...ZERO }, r2l: { ...ZERO }, u2r: { ...ZERO } });
  const [detections, setDetections] = useState<Detection[]>([]);
  const [selectedDet, setSelectedDet] = useState<Detection | null>(null);
  const [doneInfo, setDoneInfo] = useState<{ lineage: string; response_digest: string; wall_ms: number; n_records: number; n_detections: number; novel_classes: number } | null>(null);
  const [eventsSeen, setEventsSeen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const tailRef = useRef<HTMLDivElement | null>(null);
  const logIdRef = useRef(0);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setRunning(false);
    setDone(false);
    setHello(null);
    setPhaseIdx(-1);
    setPhaseName("STANDBY");
    setPhaseBlurb("Configure scenario, then press LAUNCH.");
    setLogs([]);
    setCounters({ L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 });
    setMetrics({});
    setCm({ normal: { ...ZERO }, dos: { ...ZERO }, probe: { ...ZERO }, r2l: { ...ZERO }, u2r: { ...ZERO } });
    setDetections([]);
    setSelectedDet(null);
    setDoneInfo(null);
    setEventsSeen(0);
    setError(null);
    setExpectedTotal(null);
    logIdRef.current = 0;
  }, []);

  const launch = useCallback(() => {
    reset();
    setRunning(true);
    setPhaseName("CONNECTING…");
    setPhaseBlurb("opening SSE channel to /api/sentinel-range");

    const es = new EventSource(`/api/sentinel-range`);
    esRef.current = es;

    es.onerror = () => {
      if (!doneInfo) setError("stream interrupted");
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
          setHello(ev);
          // we expect roughly 9 events per record (log + 5 pipeline + 2 matrix + occasional metric)
          // plus phases, plus detections, plus hello/done/end. Use sampling_target * 10 as
          // a rough denominator for the progress bar.
          setExpectedTotal(ev.sampling_target * 10);
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
            return next.length > 120 ? next.slice(-120) : next;
          });
          break;
        case "pipeline":
          setCounters((c) => ({ ...c, [ev.stage]: ev.count }));
          break;
        case "metric":
          setMetrics((m) => ({ ...m, [ev.name]: ev.value }));
          break;
        case "matrix":
          setCm((prev) => {
            const cell = ev.cell;
            const slot = { ...prev[cell.actual] };
            if (cell.predicted_by === "edr") {
              if (cell.correct) slot.edr_correct++;
              else slot.edr_wrong++;
            } else {
              if (cell.correct) slot.sentinel_correct++;
              else slot.sentinel_wrong++;
            }
            return { ...prev, [cell.actual]: slot };
          });
          break;
        case "detection":
          setDetections((d) => [ev, ...d]);
          break;
        case "done":
          setDoneInfo({ lineage: ev.lineage, response_digest: ev.response_digest, wall_ms: ev.wall_ms, n_records: ev.n_records, n_detections: ev.n_detections, novel_classes: ev.novel_classes });
          setDone(true);
          break;
        case "end":
          es.close();
          esRef.current = null;
          setRunning(false);
          break;
        case "error":
          setError(ev.detail);
          break;
      }
    };
  }, [reset, doneInfo]);

  // Auto-scroll log tail
  useEffect(() => {
    const el = tailRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  useEffect(() => () => esRef.current?.close(), []);

  const progressPct = useMemo(() => {
    if (!expectedTotal) return 0;
    return Math.min(100, (eventsSeen / expectedTotal) * 100);
  }, [eventsSeen, expectedTotal]);

  return (
    <div className="space-y-6">
      {/* Top status strip */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${
                running ? "bg-li-green animate-pulse" : done ? "bg-li-cyan" : "bg-white/40"
              }`}
              style={{ boxShadow: running ? "0 0 14px #3fb950" : done ? "0 0 14px #00d4ff" : "none" }}
            />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 truncate">
                scenario={hello?.scenario ?? "nsl-kdd-2025"} · seed={hello?.seed ?? 42} · corpus={hello?.corpus.name ?? "NSL-KDD train"}
              </div>
              <div className="font-display text-2xl md:text-3xl text-white tracking-tight leading-tight truncate">
                {phaseName}
              </div>
              <div className="text-[12.5px] text-white/55 mt-0.5">{phaseBlurb}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={launch}
              disabled={running}
              className={`inline-flex items-center justify-center h-11 px-6 rounded-full text-sm font-medium transition-colors ${
                running ? "bg-white/10 text-white/40 cursor-not-allowed" : "bg-white text-black hover:bg-white/90"
              }`}
            >
              {running ? "running…" : done ? "▶  Re-launch" : "▶  Launch"}
            </button>
            <button
              onClick={reset}
              disabled={!running && !done && logs.length === 0}
              className="inline-flex items-center justify-center h-11 px-4 rounded-full border border-white/15 text-white/70 text-xs font-mono hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
            >
              reset
            </button>
          </div>
        </div>

        {/* Phase rail */}
        {hello && (
          <div className="grid grid-cols-4 md:grid-cols-8 border-b border-white/10">
            {hello.phases.map((p, i) => {
              const active = i === phaseIdx;
              const past = i < phaseIdx;
              return (
                <div
                  key={p.name}
                  title={p.blurb}
                  className={`px-3 py-3 border-r border-white/[0.06] last:border-r-0 ${
                    active ? "bg-li-cyan/[0.05]" : past ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mb-2 ${active ? "bg-li-cyan animate-pulse" : past ? "bg-li-green" : "bg-white/15"}`} />
                  <div className={`font-mono text-[9.5px] uppercase tracking-widest leading-tight ${active ? "text-li-cyan" : past ? "text-li-green" : "text-white/35"}`}>
                    {String(i + 1).padStart(2, "0")} · {p.name}
                  </div>
                  <div className="font-mono text-[9px] text-white/30 mt-1 tabular-nums">
                    {p.records} rec · {fmtMs(p.ms)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Top-level KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 border-b border-white/10">
          <KPI label="records ingested" value={counters.L0.toLocaleString()} tone="cyan" />
          <KPI label="fingerprints" value={counters.L1.toLocaleString()} tone="green" />
          <KPI label="detections" value={detections.length.toString()} tone="red" />
          <KPI label="novel classes" value={String(new Set(detections.filter((d) => d.novel).map((d) => d.family)).size)} tone="purple" />
          <KPI label="ingest pps" value={metrics.ingest_pps?.toLocaleString() ?? "—"} tone="cyan" />
        </div>

        {/* Progress */}
        <div className="px-6 py-3 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40 shrink-0">
            progress
          </span>
          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-li-cyan via-li-green via-50% to-li-red transition-all duration-200 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-white/50 tabular-nums shrink-0">
            {eventsSeen.toString().padStart(4, "0")} events
          </span>
        </div>
      </div>

      {/* Pipeline + tail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-4">
        {/* Pipeline */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              Pipeline · L0 → L4
            </span>
            <span className="font-mono text-[10px] text-white/30">
              target host: {hello?.target_host ?? "—"}
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
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: s.color }}>
                        {s.code}
                      </span>
                      <span className="text-sm text-white/85">{s.label}</span>
                      <span className="hidden md:inline font-mono text-[10px] text-white/35 truncate">· {s.sub}</span>
                    </div>
                    <span className="font-mono text-[11px] text-white/60 tabular-nums shrink-0">
                      {counters[s.code].toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden relative">
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
                          animation: "rangeflow 1.6s linear infinite",
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            <style>{`
              @keyframes rangeflow {
                0%   { transform: translateX(-100%); }
                100% { transform: translateX(900%); }
              }
            `}</style>
          </div>

          {/* Live KPIs row */}
          <div className="grid grid-cols-3 border-t border-white/10">
            <SmallKPI label="rare share" value={metrics.rare_share != null ? `${(metrics.rare_share * 100).toFixed(2)}%` : "—"} tone="purple" />
            <SmallKPI label="L4 emit" value={counters.L4.toString()} tone="red" />
            <SmallKPI label="phase t" value={hello && phaseIdx >= 0 ? fmtMs(hello.phases[phaseIdx]?.ms ?? 0) : "—"} tone="cyan" />
          </div>
        </div>

        {/* Live tail */}
        <div className="rounded-2xl border border-white/10 bg-black overflow-hidden flex flex-col h-[500px]">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-li-red/70" />
                <div className="w-2 h-2 rounded-full bg-li-yellow/70" />
                <div className="w-2 h-2 rounded-full bg-li-green/70" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                /var/log/sentinel/ingest.tail · nsl-kdd → telemetry
              </span>
            </div>
            <span className="font-mono text-[10px] text-white/30">
              {logs.length}/120 lines
            </span>
          </div>
          <div ref={tailRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-[1.5] space-y-0.5">
            {logs.length === 0 && (
              <div className="text-white/30 italic">
                awaiting first packet · press LAUNCH to begin streaming nsl-kdd records
              </div>
            )}
            {logs.map((l) => (
              <div key={l.id} className={`flex items-start gap-2 ${l.rare ? "text-li-red" : "text-white/75"}`}>
                <span className="font-mono text-[10px] uppercase tracking-widest shrink-0 w-14" style={{ color: SOURCE_COLOR[l.source] ?? "#888" }}>
                  {l.source}
                </span>
                <span className="shrink-0 w-32 truncate text-white/40">{l.host}</span>
                <span className="break-all flex-1">{l.line}</span>
                {l.rare && (
                  <span
                    className="shrink-0 font-mono text-[9px] uppercase tracking-widest px-1 rounded border ml-1"
                    style={{
                      color: CATS.find((c) => c.id === l.category)?.tone ?? "#fff",
                      borderColor: (CATS.find((c) => c.id === l.category)?.tone ?? "#fff") + "55",
                    }}
                  >
                    {l.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confusion matrix + corpus card */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              Detection rate · EDR baseline vs Sentinel
            </span>
            <span className="font-mono text-[10px] text-white/30">running totals</span>
          </div>
          <div className="grid grid-cols-[1.4fr_1fr_1fr] px-5 py-2 border-b border-white/10 text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
            <div>Class</div>
            <div className="text-right">EDR</div>
            <div className="text-right">Sentinel</div>
          </div>
          {CATS.map((cat) => {
            const row = cm[cat.id];
            const edrTotal = row.edr_correct + row.edr_wrong;
            const sentTotal = row.sentinel_correct + row.sentinel_wrong;
            return (
              <div key={cat.id} className="grid grid-cols-[1.4fr_1fr_1fr] px-5 py-3 border-b border-white/[0.04] items-center">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.tone }} />
                  <div className="min-w-0">
                    <div className="text-sm text-white tracking-tight">{cat.label}</div>
                    <div className="text-[10px] font-mono text-white/35 truncate">{cat.sub}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-white/85 tabular-nums">{pct(row.edr_correct, edrTotal)}</div>
                  <div className="font-mono text-[10px] text-white/35 tabular-nums">
                    {row.edr_correct.toLocaleString()} / {edrTotal.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm tabular-nums" style={{ color: row.sentinel_correct >= row.edr_correct ? "#3fb950" : "#fff" }}>
                    {pct(row.sentinel_correct, sentTotal)}
                  </div>
                  <div className="font-mono text-[10px] text-white/35 tabular-nums">
                    {row.sentinel_correct.toLocaleString()} / {sentTotal.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="px-5 py-3 text-[11px] font-mono text-white/45 leading-relaxed">
            EDR baseline rates per class match the well-documented signature/EDR
            performance envelope on NSL-KDD: strong on DoS/Probe, weak on R2L/U2R.
            Sentinel's structural fingerprinting closes the rare-class gap.
          </div>
        </div>

        {/* Corpus card */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              Real corpus
            </span>
            <span className="font-mono text-[10px] text-white/30">
              read-only mount · /data/cache
            </span>
          </div>
          <div className="p-5 space-y-3">
            <Field k="dataset" v={hello?.corpus.name ?? "NSL-KDD train"} />
            <Field k="records" v={hello?.corpus.records.toLocaleString() ?? "—"} />
            <Field k="distinct labels" v={hello?.corpus.classes?.toString() ?? "—"} />
            <Field k="size on disk" v={hello?.corpus.size_bytes ? fmtBytes(hello.corpus.size_bytes) : "—"} />
            <Field
              k="sha256(top-100)"
              v={
                hello?.corpus.sha256_top100 ? (
                  <span className="font-mono text-[11px] text-li-cyan break-all">
                    {hello.corpus.sha256_top100}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <div className="pt-2 border-t border-white/[0.04]">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
                citation
              </div>
              <div className="text-[12px] text-white/70 leading-relaxed">
                Tavallaee et al., 2009. <span className="italic">A Detailed Analysis of the
                KDD CUP 99 Data Set</span>. IEEE CISDA. Public dataset; widely used as
                the standard intrusion-detection benchmark.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detections feed + record drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-red">
              Detections · click any card for record drawer
            </span>
            <span className="font-mono text-[10px] text-white/30">
              {detections.length} {detections.length === 1 ? "event" : "events"}
            </span>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-4 space-y-2">
            {detections.length === 0 && (
              <div className="font-mono text-[11px] text-white/30 italic px-2 py-6">
                no detections yet · structural taxonomy still crystallizing
              </div>
            )}
            {detections.map((d) => {
              const cat = CATS.find((c) => c.id === d.category);
              return (
                <button
                  key={`${d.lineage}-${d.record_idx}`}
                  onClick={() => setSelectedDet(d)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selectedDet?.record_idx === d.record_idx
                      ? "border-white/40 bg-white/[0.05]"
                      : d.novel
                        ? "border-li-purple/30 bg-li-purple/[0.04] hover:border-li-purple/60"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: cat?.tone ?? "#888",
                          boxShadow: d.novel ? "0 0 10px #a371f7" : "none",
                        }}
                      />
                      <span className="font-display text-base tracking-tight text-white truncate">
                        {d.family}
                      </span>
                      {d.novel && (
                        <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-li-purple px-1.5 py-0.5 rounded border border-li-purple/40 shrink-0">
                          novel
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-li-green tabular-nums shrink-0">{d.z.toFixed(1)} σ</span>
                  </div>
                  <div className="font-mono text-[10.5px] text-white/55 leading-relaxed">
                    host: <span className="text-white/85">{d.host}</span> ·{" "}
                    record: <span className="text-li-cyan">#{d.record_idx.toLocaleString()}</span> ·{" "}
                    label: <span style={{ color: cat?.tone ?? "#fff" }}>{d.family.split(" ")[0]}</span>
                  </div>
                  <div className="font-mono text-[10px] text-white/35 mt-0.5 break-all">
                    lineage: {shortHash(d.lineage, 16, 6)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              Record drawer
            </span>
            {selectedDet && (
              <span className="font-mono text-[10px] text-white/30">
                nsl-kdd #{selectedDet.record_idx.toLocaleString()}
              </span>
            )}
          </div>
          <div className="p-5 space-y-3">
            {!selectedDet && (
              <div className="font-mono text-[11px] text-white/30 italic">
                click a detection card to inspect the originating nsl-kdd record
              </div>
            )}
            {selectedDet && (
              <>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                    family / class
                  </div>
                  <div className="font-display text-lg text-white tracking-tight">
                    {selectedDet.family}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field k="z-score" v={`${selectedDet.z.toFixed(2)} σ`} />
                  <Field k="host" v={selectedDet.host} />
                  <Field k="ts" v={selectedDet.ts.replace("T", " ").replace("Z", "")} />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                    record preview (raw nsl-kdd projection)
                  </div>
                  <pre className="rounded-lg border border-white/10 bg-black/60 p-3 text-[11px] font-mono text-white/85 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{selectedDet.record_preview}
                  </pre>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                    sha256(record_bytes)
                  </div>
                  <div className="font-mono text-[11px] text-li-cyan break-all leading-relaxed">
                    {selectedDet.record_bytes_sha256}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                    lineage
                  </div>
                  <div className="font-mono text-[11px] text-white/85 break-all leading-relaxed">
                    {selectedDet.lineage}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const el = document.querySelector("[data-replay-input]") as HTMLInputElement | null;
                    if (el) {
                      el.value = selectedDet.lineage;
                      el.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                    window.location.href = `/sentinel#replay-anchor`;
                  }}
                  className="w-full inline-flex items-center justify-center h-10 px-5 rounded-full border border-li-cyan/40 text-li-cyan text-xs font-mono hover:bg-li-cyan/10 hover:border-li-cyan/70 transition-colors"
                >
                  open in live replay →
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Final state + reproducer */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green">
              Final state · evidence package
            </span>
            {doneInfo && (
              <span className="font-mono text-[10px] text-white/40">
                wall {fmtMs(doneInfo.wall_ms)}
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
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Stat label="records" value={doneInfo.n_records.toLocaleString()} tone="cyan" />
                  <Stat label="detections" value={doneInfo.n_detections.toString()} tone="red" />
                  <Stat label="novel classes" value={doneInfo.novel_classes.toString()} tone="purple" />
                </div>
                <Field k="response_digest" v={
                  <span className="font-mono text-[11px] text-li-green break-all">sha256:{doneInfo.response_digest}</span>
                } />
                <div className="mt-3" />
                <Field k="final lineage" v={
                  <span className="font-mono text-[11px] text-white/85 break-all">{doneInfo.lineage}</span>
                } />
                <div className="mt-5 rounded-lg bg-li-green/[0.05] border border-li-green/20 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green mb-1">
                    determinism contract
                  </div>
                  <div className="text-[12px] text-white/75 leading-relaxed">
                    Re-launch this scenario on any appliance with the same NSL-KDD
                    file. response_digest is byte-identical across runs, hosts,
                    fiscal years, under seed = {hello?.seed ?? 42}.
                  </div>
                </div>
              </>
            )}
            {error && (
              <div className="mt-4 font-mono text-[11px] text-li-red">stream error: {error}</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-li-cyan" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-cyan">
              Reproduce on appliance
            </span>
            <span className="font-mono text-[10px] text-white/30 ml-auto">
              air-gapped · zero external i/o
            </span>
          </div>
          <pre className="p-5 text-[12px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{`# 1. Mount NSL-KDD shard onto the appliance.
sentinel ingest --source nsl-kdd-train \\
                --path  /media/usb/nsl_kdd_train.txt
# -> 125,973 records ingested · sha256 ${hello?.corpus.sha256_top100?.slice(0, 12) ?? "----"}…

# 2. Score every record under seed=42.
sentinel score --corpus nsl-kdd-train --seed 42

# 3. Crystallize the structural taxonomy.
sentinel taxonomy crystallize --corpus nsl-kdd-train --persist
# -> 5 classes · 1+ novel · entropy gap > 3.4 bits

# 4. Replay any detection back to its source record.
sentinel replay <lineage>

# Every digest above will match on every fresh appliance, in every
# facility, for every fiscal year, under seed=42.`}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ---------- subcomponents ----------
function KPI({ label, value, tone }: { label: string; value: string; tone: "cyan" | "green" | "red" | "purple" }) {
  const c = tone === "cyan" ? "text-li-cyan" : tone === "green" ? "text-li-green" : tone === "purple" ? "text-li-purple" : "text-li-red";
  return (
    <div className="px-5 py-4 border-r border-white/[0.06] last:border-r-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{label}</div>
      <div className={`font-display text-2xl md:text-3xl tabular-nums tracking-tight ${c}`}>{value}</div>
    </div>
  );
}
function SmallKPI({ label, value, tone }: { label: string; value: string; tone: "cyan" | "purple" | "red" }) {
  const c = tone === "cyan" ? "text-li-cyan" : tone === "purple" ? "text-li-purple" : "text-li-red";
  return (
    <div className="px-4 py-3 border-r border-white/[0.06] last:border-r-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{label}</div>
      <div className={`font-mono text-base tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{k}</div>
      <div className="text-sm text-white/85">{v}</div>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone: "cyan" | "red" | "purple" }) {
  const c = tone === "cyan" ? "text-li-cyan" : tone === "red" ? "text-li-red" : "text-li-purple";
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{label}</div>
      <div className={`font-display text-2xl tabular-nums tracking-tight ${c}`}>{value}</div>
    </div>
  );
}
