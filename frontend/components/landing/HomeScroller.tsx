"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { parseCSV, scoreRows, type Scored } from "@/lib/csvClientFingerprint";

/**
 * HomeScroller — everything below the fold on / .
 *
 * Section sequence (mirrors the cinematic shape of xAI's homepage scroll
 * but each panel is functional and citation-backed, not a brochure):
 *
 *   I.   Products grid — Console, API, Infrastructure
 *   II.  Starburst — "Understand the corpus" with a deterministic
 *        radial-point cloud rendered in SVG, animated
 *   III. CSV drop — drag a real .csv, watch it get fingerprinted in
 *        your browser, top outliers materialise inline
 *   IV.  Citations — every primitive we use, sourced to NIST, RFCs,
 *        peer-reviewed papers, public datasets
 *   V.   Access — pro tier CTA, mailto engineering, RSS
 */

// =====================================================================
//  Section I — Products grid
// =====================================================================

function ProductsSection() {
  return (
    <section id="beneath" className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
          [ Products ]
        </p>
        <h2 className="font-display font-medium text-[clamp(56px,9vw,128px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-20">
          Modelling for<br />
          <span className="text-white/45">regulated humanity.</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.05] border border-white/10 rounded-2xl overflow-hidden">
          <ProductCard
            title="Console"
            href="/"
            body="The live front door. Mount any corpus, form a deterministic private model, query it inline. The same input returns byte-identical answers every time, on every appliance, forever."
            icon={<IconConsole />}
          />
          <ProductCard
            title="API"
            href="/api-docs"
            body="Every action is also an HTTP call. Eleven endpoints, internal HMAC bearer auth, response_digest receipt on every reply. Drop into Snowflake, Databricks, Postgres, S3, Kafka."
            icon={<IconApi />}
          />
          <ProductCard
            title="Infrastructure"
            href="/infrastructure"
            body="Single binary that mounts into the rack you already run. Helm, Terraform, Docker Compose, sealed offline bundle. Air-gap default. AES-256-GCM at rest. Zero phone-home."
            icon={<IconRack />}
          />
        </div>
      </div>
    </section>
  );
}

function ProductCard({ title, href, body, icon }: { title: string; href: string; body: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group bg-black p-9 md:p-11 hover:bg-white/[0.02] transition-colors flex flex-col min-h-[440px]"
    >
      <h3 className="font-display font-medium text-3xl md:text-4xl tracking-[-0.025em] text-white mb-6">
        {title}
      </h3>
      <p className="text-[15.5px] text-white/55 leading-snug max-w-[36ch]">{body}</p>
      <div className="mt-auto pt-12 flex items-end justify-between gap-4">
        <div className="text-white/45 group-hover:text-white/85 transition-colors w-full">
          {icon}
        </div>
      </div>
      <div className="mt-6 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/40 group-hover:text-white/85 transition-colors">
        Read more
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </Link>
  );
}

// Hairline-line illustrations, each unique to its product
function IconConsole() {
  return (
    <svg viewBox="0 0 240 120" className="w-full max-w-[280px]" fill="none" stroke="currentColor" strokeWidth="0.6">
      <rect x="10" y="14" width="220" height="92" rx="6" />
      <line x1="10" y1="32" x2="230" y2="32" />
      <circle cx="22" cy="23" r="2.5" />
      <circle cx="32" cy="23" r="2.5" />
      <circle cx="42" cy="23" r="2.5" />
      <line x1="22" y1="48" x2="80" y2="48" />
      <line x1="22" y1="58" x2="120" y2="58" />
      <line x1="22" y1="68" x2="100" y2="68" />
      <rect x="22" y="80" width="196" height="14" rx="7" />
      <line x1="40" y1="87" x2="190" y2="87" strokeDasharray="2 3" />
    </svg>
  );
}
function IconApi() {
  return (
    <svg viewBox="0 0 240 120" className="w-full max-w-[280px]" fill="none" stroke="currentColor" strokeWidth="0.6">
      <rect x="10" y="14" width="220" height="92" rx="6" />
      <line x1="10" y1="32" x2="230" y2="32" />
      <text x="22" y="50" fontSize="7" fontFamily="monospace" fill="currentColor" stroke="none">POST /api/range-form</text>
      <text x="22" y="64" fontSize="7" fontFamily="monospace" fill="currentColor" stroke="none">GET  /api/range-query</text>
      <text x="22" y="78" fontSize="7" fontFamily="monospace" fill="currentColor" stroke="none">GET  /api/range-audit</text>
      <text x="22" y="92" fontSize="7" fontFamily="monospace" fill="currentColor" stroke="none">POST /api/range-auth/issue</text>
    </svg>
  );
}
function IconRack() {
  return (
    <svg viewBox="0 0 240 120" className="w-full max-w-[280px]" fill="none" stroke="currentColor" strokeWidth="0.6">
      <rect x="40" y="10" width="160" height="100" rx="3" />
      <line x1="40" y1="26" x2="200" y2="26" />
      <line x1="40" y1="42" x2="200" y2="42" />
      <line x1="40" y1="58" x2="200" y2="58" />
      <line x1="40" y1="74" x2="200" y2="74" />
      <line x1="40" y1="90" x2="200" y2="90" />
      <circle cx="50" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="34" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="50" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="66" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="82" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="98" r="1.5" fill="currentColor" stroke="none" />
      <text x="60" y="20" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">FRONTEND</text>
      <text x="60" y="36" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">API + BTUT</text>
      <text x="60" y="52" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">POSTGRES</text>
      <text x="60" y="68" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">REDIS</text>
      <text x="60" y="84" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">FORMED MODELS</text>
      <text x="60" y="100" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">AUDIT REGISTRY</text>
    </svg>
  );
}

// =====================================================================
//  Section II — Starburst
// =====================================================================

type Pt = { id: number; x: number; y: number; size: number; tint: boolean };

function StarburstSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  // Deterministic point cloud — same seed → same starburst, every render
  const points = useMemo<Pt[]>(() => generatePoints(140, 0xC0FF33), []);

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-black border-t border-white/5">
      <div className="relative h-[78vh] min-h-[640px] w-full flex items-center">
        {/* Burst SVG */}
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          {/* Lines from centre to each point */}
          <g>
            {points.map((p, i) => (
              <motion.line
                key={`l${p.id}`}
                x1={500}
                y1={300}
                x2={p.x}
                y2={p.y}
                stroke={p.tint ? "rgba(180,200,255,0.18)" : "rgba(255,255,255,0.10)"}
                strokeWidth={0.5}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={inView ? { pathLength: 1, opacity: 1 } : {}}
                transition={{ delay: 0.2 + (i % 16) * 0.012, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </g>
          {/* Squares at the end of each line */}
          <g>
            {points.map((p, i) => (
              <motion.rect
                key={`r${p.id}`}
                x={p.x - p.size / 2}
                y={p.y - p.size / 2}
                width={p.size}
                height={p.size}
                fill={p.tint ? "#B7C8FF" : "rgba(255,255,255,0.6)"}
                opacity={p.tint ? 0.85 : 0.55}
                initial={{ opacity: 0, scale: 0 }}
                animate={inView ? {
                  opacity: [0, p.tint ? 0.85 : 0.55, p.tint ? 0.7 : 0.45, p.tint ? 0.85 : 0.55],
                  scale: 1,
                } : {}}
                transition={{
                  delay: 0.6 + (i % 24) * 0.022,
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                  opacity: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                }}
              />
            ))}
          </g>
        </svg>

        {/* Text overlays */}
        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 grid grid-cols-2 items-center gap-6">
          <motion.h2
            initial={{ opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="font-display font-normal text-[clamp(56px,8vw,140px)] leading-[0.92] tracking-[-0.04em] text-white/85 text-left"
          >
            Understand
          </motion.h2>
          <motion.h2
            initial={{ opacity: 0, x: 24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
            className="font-display font-normal text-[clamp(56px,8vw,140px)] leading-[0.92] tracking-[-0.04em] text-white/55 text-right"
          >
            the corpus.
          </motion.h2>
        </div>
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 pb-24 -mt-4">
        <p className="text-[15.5px] text-white/55 leading-snug max-w-2xl">
          Each square is a record fingerprinted through the BTUT primitive.
          Each line is the deterministic edge from the corpus centroid to
          that record's structural position. The cloud is the formed model.
          The bright squares are the rare ones — the edges of the
          distribution. Inquire of the formed model and Range answers in
          terms of these.
        </p>
      </div>
    </section>
  );
}

function generatePoints(n: number, seed: number): Pt[] {
  // tiny mulberry32 — deterministic
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cx = 500, cy = 300;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const angle = rand() * Math.PI * 2;
    // Distance: bias outward so the burst looks fuller at the edges
    const r = 120 + Math.pow(rand(), 0.55) * 480;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r * 0.62; // slight squish to fit the 16:10 viewBox
    const size = rand() < 0.12 ? 6 + rand() * 8 : 1 + rand() * 3;
    const tint = rand() < 0.18;
    out.push({ id: i, x, y, size, tint });
  }
  return out;
}

// =====================================================================
//  Section III — CSV drop (functional, browser-only)
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
    setErr(null);
    setBusy(true);
    setProgress(0);
    setFileName(name);
    try {
      const parsed = parseCSV(text);
      if (parsed.length < 5) {
        setErr("Need at least 5 rows to run a structural analysis.");
        setBusy(false);
        return;
      }
      if (parsed.length > 2000) {
        setErr(`Browser mode caps at 2,000 rows. You sent ${parsed.length.toLocaleString()}. For larger runs, install on your stack.`);
        setBusy(false);
        return;
      }
      const scored = await scoreRows(parsed, (p) => setProgress(p));
      scored.sort((a, b) => b._composite - a._composite);
      setRows(scored);
    } catch (e) {
      setErr(String(e));
    }
    setBusy(false);
  }, []);

  const onFile = useCallback(async (file: File) => {
    if (!/\.csv$/i.test(file.name)) { setErr("Drop a .csv file."); return; }
    const text = await file.text();
    await run(text, file.name);
  }, [run]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) await onFile(f);
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
          [ Try it · browser-only ]
        </p>
        <h2 className="font-display font-medium text-[clamp(48px,7vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-6">
          Drop a CSV.<br />
          <span className="text-white/45">Get a private model.</span>
        </h2>
        <p className="text-lg text-white/55 max-w-2xl leading-snug mb-10">
          The 48-bit fingerprint primitive runs locally in your browser
          via Web Crypto. Nothing leaves your device. Outliers surface
          inline within seconds.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.6fr] gap-4">
          {/* Drop zone */}
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
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-white/55 mb-5">
              <rect x="6" y="6" width="28" height="28" rx="3" stroke="currentColor" strokeWidth="1" />
              <path d="M14 22l6-6 6 6M20 16v12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="font-display text-2xl font-medium text-white mb-2 tracking-[-0.02em]">Drop a .csv here</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45 mb-6">
              or click to browse · ≤ 2,000 rows
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); loadSample(); }}
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/65 hover:text-white border border-white/15 hover:border-white/35 rounded-full px-4 py-2 transition-colors"
            >
              ▶ Load sample · 35 large-cap rows
            </button>
            {fileName && (
              <div className="mt-5 font-mono text-[11px] text-white/45 truncate max-w-full">
                {fileName}
              </div>
            )}
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
            {err && (
              <div className="mt-5 font-mono text-[11px] text-white/65 max-w-[28ch]">{err}</div>
            )}
          </div>

          {/* Results */}
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
//  Section IV — Citations (every primitive, sourced)
// =====================================================================

const CITATIONS = [
  {
    label: "Cryptographic hash",
    primitive: "SHA-256",
    source: "NIST FIPS 180-4 · Secure Hash Standard",
    url: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
    used_for: "fingerprint primitive, response_digest, lineage, model id",
  },
  {
    label: "Bearer authentication",
    primitive: "HMAC-SHA-256",
    source: "RFC 2104 · HMAC: Keyed-Hashing for Message Authentication",
    url: "https://datatracker.ietf.org/doc/html/rfc2104",
    used_for: "token signing, identity verification on every endpoint",
  },
  {
    label: "Encryption at rest",
    primitive: "AES-256-GCM",
    source: "NIST SP 800-38D · Galois/Counter Mode",
    url: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf",
    used_for: "formed-model artifact encryption with appliance master key",
  },
  {
    label: "Approximate similarity",
    primitive: "MinHash sparse fallback",
    source: "Broder, A. — On the resemblance and containment of documents (1997)",
    url: "https://www.cs.princeton.edu/courses/archive/spring13/cos598C/broder97resemblance.pdf",
    used_for: "fingerprint fallback when high-cardinality fields evade BTUT",
  },
  {
    label: "Locality-sensitive hashing",
    primitive: "SimHash",
    source: "Charikar, M. — Similarity estimation techniques from rounding algorithms (2002)",
    url: "https://www.cs.princeton.edu/courses/archive/spring04/cos598B/bib/CharikarEstim.pdf",
    used_for: "fingerprint fallback for free-text-heavy corpora",
  },
  {
    label: "Topological data analysis",
    primitive: "Persistent homology",
    source: "Edelsbrunner, Letscher, Zomorodian — Topological persistence and simplification (2002)",
    url: "https://link.springer.com/article/10.1007/s00454-002-2885-2",
    used_for: "TCD-JEPA taxonomy crystallization on the fingerprint substrate",
  },
  {
    label: "Audit log standard",
    primitive: "CEF / OCSF",
    source: "Common Event Format · ArcSight; Open Cybersecurity Schema Framework",
    url: "https://schema.ocsf.io",
    used_for: "exported audit log for SIEM ingest (ArcSight, QRadar, Splunk)",
  },
  {
    label: "Intrusion benchmark",
    primitive: "NSL-KDD train",
    source: "Tavallaee, Bagheri, Lu, Ghorbani — A detailed analysis of the KDD CUP 99 data set (IEEE CISDA 2009)",
    url: "https://www.unb.ca/cic/datasets/nsl.html",
    used_for: "primary cybersecurity benchmark · 125,973 labeled connections, 23 attack classes",
  },
  {
    label: "Financial reporting corpus",
    primitive: "SEC EDGAR XBRL",
    source: "U.S. Securities and Exchange Commission · public filings",
    url: "https://www.sec.gov/edgar.shtml",
    used_for: "finance vertical · public XBRL filings for structural anomaly surfacing",
  },
  {
    label: "Biomedical literature",
    primitive: "PubMed / MEDLINE",
    source: "NIH National Library of Medicine · public abstracts",
    url: "https://pubmed.ncbi.nlm.nih.gov",
    used_for: "biomedical vertical · 35M+ peer-reviewed abstracts for novel-class discovery",
  },
  {
    label: "Patent corpus",
    primitive: "USPTO PatentsView",
    source: "U.S. Patent and Trademark Office · CPC-classified",
    url: "https://patentsview.org",
    used_for: "patents vertical · CPC classification + citation graph",
  },
  {
    label: "Trade flows",
    primitive: "UN Comtrade",
    source: "United Nations Comtrade · public bilateral trade data",
    url: "https://comtradeplus.un.org",
    used_for: "supply-chain vertical · HS-coded trade flow anomalies",
  },
  {
    label: "Seismicity feed",
    primitive: "USGS Earthquake Hazards · all-week",
    source: "United States Geological Survey · public GeoJSON feed",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
    used_for: "earth-systems vertical · live seismic event stream",
  },
  {
    label: "Crypto markets",
    primitive: "CoinGecko top-250",
    source: "CoinGecko · public market data API",
    url: "https://www.coingecko.com/en/api",
    used_for: "crypto vertical · daily snapshot of the top 250 by market cap",
  },
  {
    label: "Macroeconomic indicators",
    primitive: "World Bank Open Data · GDP/capita",
    source: "The World Bank · 60-year economic series",
    url: "https://data.worldbank.org",
    used_for: "macro vertical · 60-year GDP series across 227 economies",
  },
  {
    label: "OpenTimeStamps",
    primitive: "Bitcoin-anchored timestamping",
    source: "Todd, P. — OpenTimeStamps: Scalable, trust-minimised timestamping (2016)",
    url: "https://opentimestamps.org",
    used_for: "lineage anchor for formed-model digests",
  },
];

function CitationsSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <section ref={ref} className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
          [ Citations · {CITATIONS.length} primary sources ]
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
            <div>№</div>
            <div>Primitive</div>
            <div>Source · authors</div>
            <div>Used for</div>
          </div>
          {CITATIONS.map((c, i) => (
            <motion.a
              key={c.url}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 6 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.05 + i * 0.02, duration: 0.5, ease: "easeOut" }}
              className="grid grid-cols-[40px_1.2fr_1.4fr_2fr] px-5 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group items-start"
            >
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

        <p className="mt-6 font-mono text-[11px] text-white/35 leading-relaxed max-w-3xl">
          When Range outputs a finding, the answer panel cites the formed
          model's own record indices. When Range describes a primitive,
          the citation panel above points to the primary source. Two
          different layers of provenance, both addressable.
        </p>
      </div>
    </section>
  );
}

// =====================================================================
//  Section V — Access
// =====================================================================

function AccessSection() {
  return (
    <section className="relative px-6 py-32 border-t border-white/5 overflow-hidden">
      {/* Faint star backdrop */}
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.6]">
        <Stars n={70} seed={0xACE5} />
      </div>

      <div className="relative max-w-[860px] mx-auto text-center">
        <div className="inline-flex items-center gap-2.5 mb-7">
          <SvgMark />
          <div className="font-display font-medium text-3xl md:text-4xl tracking-[-0.025em] text-white">
            Range Pro
          </div>
        </div>
        <p className="text-lg md:text-xl text-white/65 leading-relaxed mb-3">
          Do more with the Console.
        </p>
        <p className="text-lg md:text-xl text-white/65 leading-relaxed mb-8">
          Unlock <span className="text-white">Range Pro</span> for unlimited
          formations, RunPod GPU-bridge access, custom integrations,
          dedicated engineering channel.
        </p>
        <p className="text-base md:text-lg text-white/45 leading-relaxed max-w-xl mx-auto mb-10">
          We have just shipped <span className="text-white">Range Pro Cluster</span>,
          providing multi-replica appliance, OIDC SSO, and
          higher per-tenant RunPod budgets.
        </p>
        <a
          href="mailto:engineering@latentocean.com?subject=Range%20Pro"
          className="inline-flex items-center gap-2 h-11 px-7 rounded-full border border-white/30 text-white text-[11.5px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors"
        >
          Sign up now
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </a>
      </div>

      {/* Lower-left blog link, xAI-style */}
      <div className="relative mt-32 flex items-end">
        <Link
          href="/news"
          className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 hover:text-white transition-colors"
        >
          [ news ]
        </Link>
      </div>
    </section>
  );
}

function SvgMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="text-white/85">
      <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 18 L27 18 M18 9 L18 27" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="18" cy="18" r="3" fill="currentColor" />
    </svg>
  );
}

function Stars({ n, seed }: { n: number; seed: number }) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const stars = Array.from({ length: n }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 100,
    r: rand() < 0.85 ? 0.6 : 1.2,
    o: 0.3 + rand() * 0.55,
  }));
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      {stars.map((st) => (
        <circle key={st.id} cx={st.x} cy={st.y} r={st.r} fill="white" opacity={st.o} />
      ))}
    </svg>
  );
}

// =====================================================================
//  Composer
// =====================================================================

export function HomeScroller() {
  return (
    <>
      <ProductsSection />
      <StarburstSection />
      <CsvDropSection />
      <CitationsSection />
      <AccessSection />
    </>
  );
}
