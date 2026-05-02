"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { parseCSV, scoreRows, type Scored } from "@/lib/csvClientFingerprint";
import { MultiTenantSplitWidget } from "@/components/landing/widgets/MultiTenantSplitWidget";
import { SparseFallbackChainWidget } from "@/components/landing/widgets/SparseFallbackChainWidget";
import { ProductLineupSection } from "@/components/landing/ProductLineupSection";

/**
 * HomeScroller — the long surface beneath the live console hero.
 *
 * Eight sections, each authentically Latent Ocean — not an xAI mirror.
 *
 *   I.   Live appliance pointers — real-time stats from /api/range-form,
 *        plus a capability strip with engineering-sheet density
 *   II.  Sonar Sweep — concentric ocean-depth pings sweeping a
 *        deterministic field of fingerprints (replaces the xAI-style
 *        radial starburst with our oceanic identity)
 *   III. CSV drop — drag a real .csv, fingerprinted in your browser via
 *        Web Crypto under seed=42 (kept; functional and unique)
 *   IV.  Determinism Contract — side-by-side proof of byte-identical
 *        digest across two repeated calls
 *   V.   Architecture Layers — L0 through L5 with brief pointers,
 *        public-safe (no IP-bound internals exposed)
 *   VI.  Citations — every primitive sourced to its primary publication
 *   VII. Engineering Channel — recent dispatches feed + direct mailto;
 *        replaces the SuperGrok-shaped subscription panel with something
 *        more in the spirit of how we actually work
 */

// =====================================================================
//  Section I — Live appliance pointers + capability strip
// =====================================================================

type FormedModelMeta = { id: string; name: string; corpus_records: number; corpus_bytes: number; fingerprinter_mode: "node" | "btut"; formed_at: string; formation_ms: number };

function LiveAppliance() {
  // The hero's scroll-down arrow targets #beneath on this section.
  const [models, setModels] = useState<FormedModelMeta[] | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    fetch("/api/range-form", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setModels(d.models ?? []))
      .catch(() => setModels([]));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const t1 = setInterval(refresh, 30_000);
    const t2 = setInterval(() => setTick((n) => n + 1), 1500);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [refresh]);

  const stats = useMemo(() => {
    if (!models) return null;
    const total_records = models.reduce((a, m) => a + (m.corpus_records || 0), 0);
    const total_bytes = models.reduce((a, m) => a + (m.corpus_bytes || 0), 0);
    const btut_share = models.length === 0 ? 0 : models.filter((m) => m.fingerprinter_mode === "btut").length / models.length;
    const median_ms = models.length === 0 ? 0 : (
      [...models].sort((a, b) => a.formation_ms - b.formation_ms)[Math.floor(models.length / 2)]?.formation_ms ?? 0
    );
    const latest = [...models].sort((a, b) => b.formed_at.localeCompare(a.formed_at))[0];
    return { count: models.length, total_records, total_bytes, btut_share, median_ms, latest };
  }, [models]);

  const heartbeat = ["▏","▎","▍","▌","▋","▊","▉","█","▉","▊","▋","▌","▍","▎"];
  const pulseChar = heartbeat[tick % heartbeat.length];

  return (
    <section id="beneath" className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <span className={`font-mono text-[10.5px] tabular-nums ${stats ? "text-white/70" : "text-white/30"}`}>{pulseChar}</span>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
            Live · this appliance · refreshed every 30s
          </p>
        </div>
        <h2 className="font-display font-medium text-[clamp(48px,8vw,116px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-16">
          What's actually running.
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-white/[0.05] border border-white/10 rounded-2xl overflow-hidden">
          <Stat label="formed models" value={stats ? stats.count.toLocaleString() : "—"} hint="encrypted artifacts on disk" />
          <Stat label="records ingested" value={stats ? stats.total_records.toLocaleString() : "—"} hint="across all models" />
          <Stat label="bytes hashed" value={stats ? fmtBytes(stats.total_bytes) : "—"} hint="byte-canonical sha256" />
          <Stat label="median formation" value={stats ? `${(stats.median_ms / 1000).toFixed(1)}s` : "—"} hint="wall-time per model" />
          <Stat label="btut bridge share" value={stats ? `${Math.round(stats.btut_share * 100)}%` : "—"} hint="real-pipeline coverage" />
        </div>

        {/* Capability strip — engineering-sheet density, sources every claim */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Capability ledger</span>
            <span className="font-mono text-[10px] text-white/35">Every line is a verified pointer to a primary source.</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {CAPABILITIES.map((c, i) => (
              <div key={i} className="grid grid-cols-[40px_1.2fr_2fr_1fr] px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors">
                <div className="font-mono text-[10px] text-white/35 tabular-nums">{String(i + 1).padStart(2, "0")}</div>
                <div className="font-mono text-[12px] text-white/85 tracking-[-0.005em]">{c.title}</div>
                <div className="text-[12.5px] text-white/55 leading-snug pr-4">{c.body}</div>
                <div className="font-mono text-[10.5px] text-white/45 text-right tabular-nums">{c.value}</div>
              </div>
            ))}
          </div>
        </div>

        {stats?.latest && (
          <div className="mt-6 font-mono text-[11px] text-white/35 leading-relaxed">
            most recent strike · <span className="text-white/65">{stats.latest.name}</span> ·{" "}
            <span className="text-white/65">{stats.latest.corpus_records.toLocaleString()}</span> records ·{" "}
            <span className="text-white/65">{stats.latest.fingerprinter_mode}</span>{" "}
            <span className="text-white/55">in {(stats.latest.formation_ms / 1000).toFixed(1)}s</span>
            <span className="text-white/30"> · id {stats.latest.id}</span>
          </div>
        )}
      </div>
    </section>
  );
}

const CAPABILITIES: { title: string; body: string; value: string }[] = [
  { title: "Determinism contract",       body: "Same input, same response_digest, byte-identical, on any appliance, in any decade. Enforced in CI on every commit.", value: "seed = 42" },
  { title: "Air-gap default",            body: "The appliance opens zero outbound sockets unless an operator explicitly bridges to RunPod. No telemetry, no phone-home, no license check-in.", value: "0 egress" },
  { title: "Sparse fallback chain",      body: "Primary BTUT path with cascading sparse operators (MinHash · SimHash · Bloom · byte-hash). No corpus rejected; coverage_pct stamped on every artifact.", value: "5 strategies" },
  { title: "Encryption at rest",         body: "AES-256-GCM with per-appliance master key. Keyed via env or auto-generated to /data/formed_models/_keys with chmod 600.", value: "AES-256-GCM" },
  { title: "Bearer auth",                body: "Internal HMAC-signed bearer tokens. No third-party SDK. Tenant + role embedded; revoke by rotating RANGE_AUTH_SECRET.", value: "HMAC-SHA-256" },
  { title: "Multi-format adapter",       body: "Auto-detects JSON / NDJSON / CSV / TSV / PSV / plaintext from byte shape. Schema inferred at ingest. No per-vertical adapter code.", value: "6 formats" },
  { title: "Append-only registry",       body: "Every form / query / delete / auth event sealed to /data/formed_models/_audit. Exportable as CEF or OCSF.", value: "CEF · OCSF" },
  { title: "Citation discipline",        body: "Every cryptographic primitive, every dataset, every algorithmic technique points to its primary published source.", value: "16 sources" },
];

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-black p-7 md:p-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 mb-3">{label}</div>
      <div className="font-display text-[clamp(28px,3.6vw,52px)] tracking-[-0.025em] text-white tabular-nums leading-[1]">{value}</div>
      <div className="font-mono text-[10px] text-white/35 mt-3 leading-snug">{hint}</div>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

// =====================================================================
//  Section II — Sonar Sweep (replaces the radial starburst)
// =====================================================================

type Marker = { id: number; x: number; y: number; r: number; size: number; tint: boolean };

function SonarSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  const markers = useMemo<Marker[]>(() => {
    let s = 0xC0FF33 >>> 0;
    const rand = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const center = { x: 220, y: 320 };
    const out: Marker[] = [];
    for (let i = 0; i < 90; i++) {
      // Oceanic scatter — bias outward, lower-right octant heavier
      const angle = (-Math.PI / 6) + rand() * (Math.PI * 1.0);
      const r = 80 + Math.pow(rand(), 0.6) * 920;
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + Math.sin(angle) * r * 0.65;
      const size = rand() < 0.10 ? 6 + rand() * 6 : 1.5 + rand() * 3;
      const tint = rand() < 0.18;
      out.push({ id: i, x, y, r, size, tint });
    }
    return out;
  }, []);

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-black border-t border-white/5">
      <div className="relative h-[78vh] min-h-[640px] w-full">
        {/* Depth-grid backdrop — subtle horizontal isobath lines */}
        <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden>
          <g stroke="rgba(255,255,255,0.04)">
            <line x1="0" y1="100" x2="1200" y2="100" />
            <line x1="0" y1="200" x2="1200" y2="200" />
            <line x1="0" y1="320" x2="1200" y2="320" strokeOpacity="0.08" />
            <line x1="0" y1="440" x2="1200" y2="440" />
            <line x1="0" y1="540" x2="1200" y2="540" />
          </g>

          {/* Sonar pings — three concentric rings on staggered loops */}
          <g>
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={220}
                cy={320}
                r={0}
                fill="none"
                stroke="rgba(180,210,255,0.55)"
                strokeWidth={0.9}
                className={`sonar-ring sonar-ring-${i}`}
                style={{ transformOrigin: "220px 320px" }}
              />
            ))}
            {/* Origin marker — the transducer */}
            <circle cx="220" cy="320" r="3" fill="rgba(180,210,255,0.9)" />
            <circle cx="220" cy="320" r="9" fill="none" stroke="rgba(180,210,255,0.35)" strokeWidth="0.6" />
          </g>

          {/* Hairline radials so the markers feel anchored */}
          <g stroke="rgba(255,255,255,0.04)" strokeWidth="0.4">
            {markers.map((m) => (
              <line key={`l${m.id}`} x1="220" y1="320" x2={m.x} y2={m.y} />
            ))}
          </g>

          {/* Markers */}
          <g>
            {markers.map((m, i) => (
              <motion.rect
                key={`r${m.id}`}
                x={m.x - m.size / 2}
                y={m.y - m.size / 2}
                width={m.size}
                height={m.size}
                fill={m.tint ? "#B7C8FF" : "rgba(255,255,255,0.7)"}
                opacity={m.tint ? 0.85 : 0.55}
                initial={{ opacity: 0, scale: 0 }}
                animate={inView ? {
                  opacity: [0, m.tint ? 0.9 : 0.6, m.tint ? 0.55 : 0.35, m.tint ? 0.9 : 0.6],
                  scale: 1,
                } : {}}
                transition={{
                  delay: 0.2 + (i % 24) * 0.018,
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                  opacity: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: (m.r / 1200) * 4 },
                }}
              />
            ))}
          </g>
        </svg>

        {/* Text overlay — left-aligned to the transducer, oceanic vocabulary */}
        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 h-full flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-5">
              Sonar · structural sounding
            </p>
            <h2 className="font-display font-medium text-[clamp(56px,8vw,140px)] leading-[0.92] tracking-[-0.04em] text-white">
              From rows<br />
              <span className="text-white/55">to receipts.</span>
            </h2>
            <p className="mt-7 text-[15.5px] text-white/55 leading-snug max-w-xl">
              Each ping resolves a record into a 48-bit structural
              fingerprint. The bright squares are the rare ones — records
              that lie far from their local neighbourhood under Hamming
              distance. Receipts on every output. The corpus tells you
              where to look.
            </p>
          </motion.div>
        </div>
      </div>

      <style jsx>{`
        .sonar-ring { animation: sonar-ping 7s linear infinite; opacity: 0; }
        .sonar-ring-1 { animation-delay: 2.4s; }
        .sonar-ring-2 { animation-delay: 4.8s; }
        @keyframes sonar-ping {
          0%   { r: 0;    opacity: 0.7; stroke-width: 0.9; }
          70%  { opacity: 0.18; }
          100% { r: 980;  opacity: 0;   stroke-width: 0.4; }
        }
      `}</style>
    </section>
  );
}

// =====================================================================
//  Section III — CSV drop (kept; functional, browser-only)
// =====================================================================

function CsvDropSection() {
  const [rows, setRows] = useState<Scored[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);

  const run = useCallback(async (text: string, name: string) => {
    setErr(null); setBusy(true); setProgress(0); setFileName(name);
    try {
      const parsed = parseCSV(text);
      if (parsed.length < 5) { setErr("Need at least 5 rows to run a structural analysis."); setBusy(false); return; }
      if (parsed.length > 2000) { setErr(`Browser mode caps at 2,000 rows. You sent ${parsed.length.toLocaleString()}. For larger runs, install on your stack.`); setBusy(false); return; }
      const scored = await scoreRows(parsed, (p) => setProgress(p));
      scored.sort((a, b) => b._composite - a._composite);
      setRows(scored);
    } catch (e) { setErr(String(e)); }
    setBusy(false);
  }, []);

  const onFile = useCallback(async (file: File) => {
    if (!/\.csv$/i.test(file.name)) { setErr("Drop a .csv file."); return; }
    const text = await file.text(); await run(text, file.name);
  }, [run]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files?.[0]; if (f) await onFile(f);
  }, [onFile]);

  const loadSample = useCallback(async () => {
    const demo = [
      "ticker,sector,revenue_usd_mn,ebitda_margin,debt_to_equity,net_margin,dividend_yield",
      "AAPL,tech,383000,0.31,1.9,0.25,0.005",
      "MSFT,tech,211900,0.48,0.4,0.36,0.007",
      "GOOG,tech,307400,0.30,0.1,0.24,0.000",
      "AMZN,tech,574800,0.11,0.8,0.06,0.000",
      "META,tech,134900,0.43,0.2,0.29,0.000",
      "NVDA,tech,60900,0.65,0.3,0.51,0.001",
      "TSLA,auto,96800,0.13,0.2,0.16,0.000",
      "BRKB,fin,364500,0.20,0.3,0.13,0.000",
      "JPM,fin,158100,0.42,1.1,0.31,0.030",
      "V,fin,32700,0.69,0.5,0.51,0.008",
      "MA,fin,25100,0.58,2.4,0.45,0.006",
      "XOM,energy,344600,0.18,0.2,0.10,0.034",
      "CVX,energy,200900,0.21,0.2,0.10,0.040",
      "WMT,retail,648100,0.04,0.7,0.02,0.014",
      "COST,retail,242300,0.04,0.5,0.03,0.007",
      "HD,retail,152700,0.16,7.4,0.10,0.025",
      "UNH,health,371600,0.08,0.7,0.06,0.014",
      "JNJ,health,85200,0.27,0.4,0.20,0.030",
      "PFE,health,58500,0.12,0.6,0.04,0.060",
      "MRK,health,60100,0.32,0.5,0.20,0.030",
      "BAC,fin,98800,0.28,1.0,0.18,0.025",
      "WFC,fin,82600,0.31,1.2,0.15,0.030",
      "DIS,media,88900,0.13,0.5,0.04,0.000",
      "NFLX,media,33700,0.20,0.7,0.16,0.000",
      "ADBE,tech,19400,0.42,0.3,0.27,0.000",
      "CRM,tech,34900,0.10,0.2,0.11,0.000",
      "ORCL,tech,52900,0.34,5.0,0.20,0.013",
      "INTC,tech,54200,0.13,0.4,0.04,0.012",
      "AMD,tech,22700,0.07,0.1,0.04,0.000",
      "QCOM,tech,35800,0.30,0.5,0.20,0.022",
      "TXN,tech,17500,0.41,0.5,0.39,0.029",
      "IBM,tech,61900,0.18,2.6,0.07,0.045",
      "GE,industrial,67900,0.10,1.1,0.05,0.005",
      "BA,industrial,77800,-0.02,9.0,-0.02,0.000",
      "CAT,industrial,67100,0.21,1.7,0.16,0.020",
    ];
    await run(demo.join("\n"), "sample · large-cap.csv");
  }, [run]);

  return (
    <section className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
          Try it · browser-only · seed 42
        </p>
        <h2 className="font-display font-medium text-[clamp(48px,7vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-6">
          Drop a CSV.<br />
          <span className="text-white/45">Watch your data become a private model.</span>
        </h2>
        <p className="text-lg text-white/55 max-w-2xl leading-snug mb-10">
          The 48-bit fingerprint primitive runs locally via Web Crypto.
          Nothing leaves your device. Outliers surface inline within seconds.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.6fr] gap-4">
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={`rounded-2xl border-2 border-dashed cursor-pointer transition-colors p-9 md:p-12 flex flex-col items-center justify-center text-center min-h-[360px] ${
              over ? "border-white/55 bg-white/[0.04]" : "border-white/15 bg-[#0a0a0a] hover:border-white/35"
            }`}
          >
            <input ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-white/55 mb-5">
              <rect x="6" y="6" width="28" height="28" rx="3" stroke="currentColor" strokeWidth="1" />
              <path d="M14 22l6-6 6 6M20 16v12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="font-display text-2xl font-medium text-white mb-2 tracking-[-0.02em]">Drop a .csv here</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45 mb-6">
              or click to browse · ≤ 2,000 rows
            </div>
            <button onClick={(e) => { e.stopPropagation(); loadSample(); }}
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/65 hover:text-white border border-white/15 hover:border-white/35 rounded-full px-4 py-2 transition-colors">
              ▶ Load sample · 35 large-cap rows
            </button>
            {fileName && <div className="mt-5 font-mono text-[11px] text-white/45 truncate max-w-full">{fileName}</div>}
            {busy && (
              <div className="mt-5 w-full max-w-[280px]">
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-white/85 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <div className="mt-2 font-mono text-[10px] tracking-[0.22em] uppercase text-white/45 tabular-nums">
                  fingerprinting · {Math.round(progress * 100)}%
                </div>
              </div>
            )}
            {err && <div className="mt-5 font-mono text-[11px] text-white/65 max-w-[28ch]">{err}</div>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col min-h-[360px]">
            <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
                Top structural outliers · seed 42
              </span>
              <span className="font-mono text-[10px] text-white/35">
                {rows ? `${rows.length} rows scored` : "awaiting drop"}
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              {!rows && !busy && (
                <div className="p-10 text-center font-mono text-[11px] text-white/35 italic">
                  drop a csv on the left, or click "Load sample"
                </div>
              )}
              {rows && rows.length > 0 && (
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-[#0a0a0a]">
                    <tr className="text-left border-b border-white/[0.06]">
                      <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 w-12">№</th>
                      {Object.keys(rows[0]).filter((k) => !k.startsWith("_")).slice(0, 4).map((k) => (
                        <th key={k} className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">{k}</th>
                      ))}
                      <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 text-right">composite</th>
                      <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 text-right">fp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => {
                      const cols = Object.keys(r).filter((k) => !k.startsWith("_")).slice(0, 4);
                      return (
                        <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5 font-mono text-[11px] text-white/40 tabular-nums">{i + 1}</td>
                          {cols.map((c) => (
                            <td key={c} className="px-4 py-2.5 text-white/85 truncate max-w-[180px]">{String(r[c] ?? "")}</td>
                          ))}
                          <td className="px-4 py-2.5 font-mono text-[11.5px] text-white tabular-nums text-right">{r._composite.toFixed(3)}</td>
                          <td className="px-4 py-2.5 font-mono text-[10px] text-white/45 text-right">{r._fp.slice(0, 12)}…</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
//  Section IV — Determinism Contract (NEW)
// =====================================================================

function DeterminismSection() {
  const [models, setModels] = useState<FormedModelMeta[]>([]);
  const [a, setA] = useState<{ digest: string; ms: number } | null>(null);
  const [b, setB] = useState<{ digest: string; ms: number } | null>(null);
  const [running, setRunning] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    fetch("/api/range-form", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setModels(d.models ?? []))
      .catch(() => {});
  }, []);

  const probe = useCallback(async () => {
    const m = models[0];
    if (!m) return;
    setRunning(true); setA(null); setB(null);
    try {
      const url = `/api/range-query?model_id=${m.id}&q=show+me+the+discovered+taxonomy`;
      const r1 = await fetch(url, { cache: "no-store" }).then((x) => x.json());
      setA({ digest: r1.response_digest, ms: r1.wall_ms });
      // Slight pause so the eye sees both calls land separately
      await new Promise((r) => setTimeout(r, 350));
      const r2 = await fetch(url, { cache: "no-store" }).then((x) => x.json());
      setB({ digest: r2.response_digest, ms: r2.wall_ms });
    } catch { /* ignore */ }
    setRunning(false);
  }, [models]);

  // Auto-probe once when section enters view
  useEffect(() => {
    if (inView && models.length > 0 && !a && !running) probe();
  }, [inView, models, a, running, probe]);

  const matches = a && b && a.digest === b.digest;

  return (
    <section ref={ref} className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
          [ Determinism contract · live proof ]
        </p>
        <h2 className="font-display font-medium text-[clamp(48px,7vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-6">
          Same query.<br />
          <span className="text-white/45">Same digest. Forever.</span>
        </h2>
        <p className="text-lg text-white/55 max-w-2xl leading-snug mb-10">
          Two requests, fired one after the other against the same formed
          model. The response digests are byte-identical. Run them again
          tomorrow, on a different appliance, in a different decade — same
          result. This is the load-bearing claim of the platform.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DigestCard label="run · A" data={a} running={running && !a} />
          <DigestCard label="run · B" data={b} running={running && a !== null && !b} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button onClick={probe} disabled={running || models.length === 0}
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[12.5px] font-medium hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {running ? "Verifying…" : "Re-run · verify byte-identity"}
          </button>
          {a && b && (
            <div className={`font-mono text-[11.5px] tracking-[-0.005em] ${matches ? "text-white" : "text-white/55"}`}>
              {matches ? "✓ digests match · contract holds" : "△ digests differ · contract broken"}
            </div>
          )}
          {models.length === 0 && (
            <div className="font-mono text-[11px] text-white/35">
              no formed models yet · drop a corpus into the workbench first
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DigestCard({ label, data, running }: { label: string; data: { digest: string; ms: number } | null; running: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">{label}</span>
        {data && <span className="font-mono text-[10px] text-white/35 tabular-nums">{data.ms} ms</span>}
      </div>
      <div className="p-5 min-h-[120px] flex items-center">
        {running && <div className="font-mono text-[12px] text-white/45 italic">computing deterministically …</div>}
        {!running && !data && <div className="font-mono text-[12px] text-white/30 italic">awaiting probe</div>}
        {data && (
          <div className="font-mono text-[13px] text-white/85 break-all leading-relaxed">
            <span className="text-white/45">sha256:</span>{data.digest}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
//  Section V — Architecture Layers (NEW · IP-safe)
// =====================================================================

const LAYERS = [
  { code: "L0", name: "Ingest",     pointer: "Schema-aware adapter. Auto-detects shape, hashes inputs on entry.", primitive: "sha256, RFC 4180" },
  { code: "L1", name: "Substrate",  pointer: "BTUT primitive. 48-bit deterministic projection per record under seed=42.", primitive: "trade-secret + locality-sensitive hashing literature" },
  { code: "L2", name: "Taxonomy",   pointer: "TCD-JEPA crystallization. Topology emerges from the substrate without labels.", primitive: "persistent homology · Edelsbrunner et al. 2002" },
  { code: "L3", name: "Lineage",    pointer: "Merkle proofs over inputs. Every output traces to source bytes.", primitive: "Bitcoin-anchored timestamping · OpenTimeStamps" },
  { code: "L4", name: "Replay",     pointer: "Bit-identical reconstruction from any prior state, on demand.", primitive: "deterministic re-execution under canonical JSON" },
  { code: "L5", name: "RangeQL",    pointer: "SQL superset with structural primitives — fingerprint(), lineage(), replay(), neighbors().", primitive: "Range-internal · API-exposed" },
];

function ArchitectureSection() {
  return (
    <section className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
          Architecture · six layers · public-safe pointers
        </p>
        <h2 className="font-display font-medium text-[clamp(48px,7vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-12">
          The stack,<br />
          <span className="text-white/45">in plain language.</span>
        </h2>

        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
          {LAYERS.map((l, i) => (
            <div key={l.code} className={`grid grid-cols-[80px_1.2fr_2fr_1.2fr] px-6 py-5 ${i < LAYERS.length - 1 ? "border-b border-white/[0.05]" : ""} hover:bg-white/[0.02] transition-colors`}>
              <div className="font-mono text-[12px] tracking-[0.18em] uppercase text-white/85">{l.code}</div>
              <div>
                <div className="font-display text-[18px] tracking-[-0.01em] text-white mb-1">{l.name}</div>
              </div>
              <div className="text-[13px] text-white/65 leading-snug pr-6">{l.pointer}</div>
              <div className="font-mono text-[10.5px] text-white/40 tracking-[0.005em] leading-relaxed text-right">{l.primitive}</div>
            </div>
          ))}
        </div>

        <p className="mt-6 font-mono text-[11px] text-white/35 leading-relaxed max-w-3xl">
          The layer names and the public-safe pointers above are stable.
          The internal mechanics of L1 (BTUT) and L2 (TCD-JEPA) are protected
          as trade secrets, anchored via OpenTimeStamps; the outputs they
          produce are fully verifiable through the determinism contract.
          You don't need to see the math to verify the receipt.
        </p>
      </div>
    </section>
  );
}

// =====================================================================
//  Section VI — Citations
// =====================================================================

const CITATIONS = [
  { label: "Cryptographic hash",       primitive: "SHA-256",                           source: "NIST FIPS 180-4 · Secure Hash Standard",                                                                   url: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",   used_for: "fingerprint primitive, response_digest, lineage, model id" },
  { label: "Bearer authentication",    primitive: "HMAC-SHA-256",                      source: "RFC 2104 · HMAC: Keyed-Hashing for Message Authentication",                                                  url: "https://datatracker.ietf.org/doc/html/rfc2104",                used_for: "token signing, identity verification on every endpoint" },
  { label: "Encryption at rest",       primitive: "AES-256-GCM",                       source: "NIST SP 800-38D · Galois/Counter Mode",                                                                       url: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf", used_for: "formed-model artifact encryption with appliance master key" },
  { label: "Approximate similarity",   primitive: "MinHash sparse fallback",            source: "Broder, A. — On the resemblance and containment of documents (1997)",                                         url: "https://www.cs.princeton.edu/courses/archive/spring13/cos598C/broder97resemblance.pdf", used_for: "fingerprint fallback when high-cardinality fields evade BTUT" },
  { label: "Locality-sensitive hashing", primitive: "SimHash",                          source: "Charikar, M. — Similarity estimation techniques from rounding algorithms (2002)",                            url: "https://www.cs.princeton.edu/courses/archive/spring04/cos598B/bib/CharikarEstim.pdf", used_for: "fingerprint fallback for free-text-heavy corpora" },
  { label: "Topological data analysis", primitive: "Persistent homology",              source: "Edelsbrunner, Letscher, Zomorodian — Topological persistence and simplification (2002)",                       url: "https://link.springer.com/article/10.1007/s00454-002-2885-2", used_for: "TCD-JEPA taxonomy crystallization on the fingerprint substrate" },
  { label: "Audit log standard",       primitive: "CEF / OCSF",                        source: "Common Event Format · ArcSight; Open Cybersecurity Schema Framework",                                          url: "https://schema.ocsf.io",                                       used_for: "exported audit log for SIEM ingest (ArcSight, QRadar, Splunk)" },
  { label: "Intrusion benchmark",      primitive: "NSL-KDD train",                     source: "Tavallaee, Bagheri, Lu, Ghorbani — A detailed analysis of the KDD CUP 99 data set (IEEE CISDA 2009)",         url: "https://www.unb.ca/cic/datasets/nsl.html",                     used_for: "primary cybersecurity benchmark · 125,973 labeled connections, 23 attack classes" },
  { label: "Financial reporting corpus", primitive: "SEC EDGAR XBRL",                  source: "U.S. Securities and Exchange Commission · public filings",                                                    url: "https://www.sec.gov/edgar.shtml",                              used_for: "finance vertical · public XBRL filings for structural anomaly surfacing" },
  { label: "Biomedical literature",    primitive: "PubMed / MEDLINE",                  source: "NIH National Library of Medicine · public abstracts",                                                         url: "https://pubmed.ncbi.nlm.nih.gov",                              used_for: "biomedical vertical · 35M+ peer-reviewed abstracts for novel-class discovery" },
  { label: "Patent corpus",            primitive: "USPTO PatentsView",                 source: "U.S. Patent and Trademark Office · CPC-classified",                                                           url: "https://patentsview.org",                                      used_for: "patents vertical · CPC classification + citation graph" },
  { label: "Trade flows",              primitive: "UN Comtrade",                       source: "United Nations Comtrade · public bilateral trade data",                                                        url: "https://comtradeplus.un.org",                                  used_for: "supply-chain vertical · HS-coded trade flow anomalies" },
  { label: "Seismicity feed",          primitive: "USGS Earthquake Hazards · all-week", source: "United States Geological Survey · public GeoJSON feed",                                                       url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson", used_for: "earth-systems vertical · live seismic event stream" },
  { label: "Crypto markets",           primitive: "CoinGecko top-250",                 source: "CoinGecko · public market data API",                                                                          url: "https://www.coingecko.com/en/api",                             used_for: "crypto vertical · daily snapshot of the top 250 by market cap" },
  { label: "Macroeconomic indicators", primitive: "World Bank Open Data · GDP/capita",  source: "The World Bank · 60-year economic series",                                                                  url: "https://data.worldbank.org",                                   used_for: "macro vertical · 60-year GDP series across 227 economies" },
  { label: "OpenTimeStamps",           primitive: "Bitcoin-anchored timestamping",     source: "Todd, P. — OpenTimeStamps: Scalable, trust-minimised timestamping (2016)",                                     url: "https://opentimestamps.org",                                   used_for: "lineage anchor for formed-model digests; trade-secret IP strategy" },
];

function CitationsSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <section ref={ref} className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
          Citations · {CITATIONS.length} primary sources
        </p>
        <h2 className="font-display font-medium text-[clamp(48px,7vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-6">
          Every primitive,<br />
          <span className="text-white/45">cited.</span>
        </h2>
        <p className="text-lg text-white/55 max-w-2xl leading-snug mb-12">
          Latent Ocean does not invent its own cryptography, its own
          datasets, or its own statistical machinery. Every load-bearing
          piece points to a primary published source. Click through and
          verify the receipt.
        </p>

        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
          <div className="grid grid-cols-[40px_1.2fr_1.4fr_2fr] px-5 py-3 border-b border-white/10 bg-white/[0.02] font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
            <div>№</div><div>Primitive</div><div>Source · authors</div><div>Used for</div>
          </div>
          {CITATIONS.map((c, i) => (
            <motion.a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer"
              initial={{ opacity: 0, y: 6 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.05 + i * 0.02, duration: 0.5, ease: "easeOut" }}
              className="grid grid-cols-[40px_1.2fr_1.4fr_2fr] px-5 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group items-start">
              <div className="font-mono text-[11px] text-white/35 tabular-nums">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <div className="font-mono text-[12.5px] text-white tracking-[-0.005em]">{c.primitive}</div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40 mt-0.5">{c.label}</div>
              </div>
              <div className="text-[12.5px] text-white/65 leading-snug pr-6">{c.source}</div>
              <div className="flex items-start gap-3">
                <span className="text-[12.5px] text-white/55 leading-snug flex-1">{c.used_for}</span>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="mt-1.5 shrink-0 text-white/35 group-hover:text-white transition-colors">
                  <path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
//  Section VIa — Multi-tenant split (real concurrent formations)
// =====================================================================

function MultiTenantSection() {
  return (
    <section className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
          Isolation · two tenants, one substrate · live
        </p>
        <h2 className="font-display font-medium text-[clamp(48px,7vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-8">
          Two API keys.<br />
          <span className="text-white/45">Two artifact stores.</span>
        </h2>
        <p className="text-[15px] text-white/55 leading-snug max-w-3xl mb-12">
          Click "form both" — two demo tokens are minted, two formations
          fire concurrently, two distinct artifact IDs come back. Each
          tenant's bearer token is then used against the OTHER tenant's
          ID; both probes return 404. The route's getModel(id, tenant_id)
          is the gate, the 404 is the proof.
        </p>
        <MultiTenantSplitWidget compact />
      </div>
    </section>
  );
}

// =====================================================================
//  Section VIb — Sparse fallback chain (real cascade)
// =====================================================================

function SparseFallbackSection() {
  return (
    <section className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
          Resilience · five strategies · zero rejections
        </p>
        <h2 className="font-display font-medium text-[clamp(48px,7vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-8">
          The orchestrator<br />
          <span className="text-white/45">falls through.</span>
        </h2>
        <p className="text-[15px] text-white/55 leading-snug max-w-3xl mb-12">
          BTUT primary, then dense Node, then MinHash 128 permutations,
          then SimHash 48-bit, then Bloom-projection, then byte-hash as
          the failsafe. Whichever stage produces coverage pulses bright;
          the others record their attempt and reason. No corpus rejected.
        </p>
        <SparseFallbackChainWidget compact />
      </div>
    </section>
  );
}

// =====================================================================
//  Section VII — Engineering channel (replaces SuperGrok-shaped panel)
// =====================================================================

const RECENT_DISPATCHES = [
  { date: "2026 · 04 · 30", line: "Range Console 1.0 — universal private model former, ten stack integrations, internal HMAC auth, encrypted artifact store." },
  { date: "2026 · 04 · 30", line: "Sparse-operator fallback chain online · MinHash · SimHash · Bloom · byte-hash failsafe." },
  { date: "2026 · 04 · 29", line: "5,000-record bridge cap removed · chunked formation merges 26 chunks for full NSL-KDD in 6.1 s." },
  { date: "2026 · 04 · 28", line: "Operator console — audit + encryption + identity. CEF and OCSF export for SIEM ingest." },
];

function EngineeringChannelSection() {
  return (
    <section className="relative px-6 py-32 border-t border-white/5 overflow-hidden">
      <div className="relative max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-start">
        {/* Left — pitch */}
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
            Bring this to your stack
          </p>
          <h2 className="font-display font-medium text-[clamp(48px,7vw,108px)] leading-[0.92] tracking-[-0.045em] text-white mb-8">
            One conversation,<br />
            <span className="text-white/45">no funnel.</span>
          </h2>
          <p className="text-lg text-white/55 leading-snug max-w-xl mb-10">
            We do not run a sales process before the appliance has answered
            on your data. Send corpus shape, deployment target, the
            integration you want first. We respond same business day with
            the next three commands you would actually run.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href="mailto:engineering@latentocean.com?subject=Range%20Console" className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
              engineering@latentocean.com
            </a>
            <Link href="/api-docs" className="inline-flex items-center justify-center h-12 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
              Read the API
            </Link>
            <Link href="/infrastructure" className="inline-flex items-center justify-center h-12 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
              Hardware envelopes
            </Link>
          </div>
        </div>

        {/* Right — recent dispatches feed (editorial, not a pricing card) */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Recent dispatches</span>
            <Link href="/news" className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 hover:text-white transition-colors">/news →</Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {RECENT_DISPATCHES.map((d, i) => (
              <div key={i} className="p-5">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-2">{d.date}</div>
                <div className="text-[14px] text-white/85 leading-snug">{d.line}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
//  Composer
// =====================================================================

export function HomeScroller() {
  return (
    <>
      <LiveAppliance />
      <ProductLineupSection />
      <SonarSection />
      <CsvDropSection />
      <DeterminismSection />
      <ArchitectureSection />
      <CitationsSection />
      <MultiTenantSection />
      <SparseFallbackSection />
      <EngineeringChannelSection />
    </>
  );
}
