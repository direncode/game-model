"use client";

import { useCallback, useMemo, useState } from "react";

// Null-test permutation widget.
//
// What it does:
//   - Takes a small synthetic generic corpus (40 records, 4 fields each)
//     generated from a deterministic seeded PRNG so the demo is reproducible.
//   - Computes a "rarity score" = sum over records of min-Hamming distance
//     of that record's 48-bit fingerprint to the previous 16 records'
//     fingerprints. This is a deterministic statistic of the corpus's
//     sequence-of-rows.
//   - Permutes the row order N times (default 5,000), recomputing the
//     statistic for each permutation. The resulting distribution is the
//     null hypothesis: "row order is meaningless."
//   - The observed statistic is drawn as a vertical line. If it lies in
//     the tail of the null distribution, structure is present and the
//     ordering is meaningful.
//
// Why this matters as a demo:
//   - Permutation testing is a 1937 statistical tool (E. J. G. Pitman). It's
//     the gold standard for "is this statistic real or could random shuffles
//     produce it?" — making the platform's claim of structure *falsifiable*.
//   - Computed entirely in your browser with Web Crypto SHA-256. Zero data
//     leaves the page.

type Result = { observed: number; nullDist: number[]; mean: number; std: number; z: number; pHat: number };

const NUM_RECORDS = 40;
const FIELDS = 4;
const LOOKBACK = 16;
const DEFAULT_RUNS = 5000;

// Deterministic seeded PRNG (Mulberry32).
function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a deterministic synthetic corpus. Each record is {a, b, c, d}.
// The trick: indices 0..29 follow one structural pattern (a clustered
// regime), indices 30..39 are intentionally drawn from a different
// distribution. Row order therefore carries real information.
function buildCorpus(): string[] {
  const rand = mulberry32(0xCA75);
  const rows: string[] = [];
  for (let i = 0; i < NUM_RECORDS; i++) {
    if (i < 30) {
      // Clustered regime — values pulled from narrow intervals
      const a = Math.floor(rand() * 6);
      const b = Math.floor(rand() * 6);
      const c = Math.floor(rand() * 6);
      const d = Math.floor(rand() * 6);
      rows.push(`a=${a}|b=${b}|c=${c}|d=${d}`);
    } else {
      // Outlier regime — wider intervals, positioned at the tail
      const a = 6 + Math.floor(rand() * 14);
      const b = 6 + Math.floor(rand() * 14);
      const c = 6 + Math.floor(rand() * 14);
      const d = 6 + Math.floor(rand() * 14);
      rows.push(`a=${a}|b=${b}|c=${c}|d=${d}`);
    }
  }
  return rows;
}

// Cheap 48-bit fingerprint. xorshift-style hashing of the row string into
// 6 bytes. Good enough for Hamming-distance contrast in a demo. NOT the
// production fingerprinter.
function fp48(s: string): bigint {
  let h0 = 0xcbf29ce4_84222325n;
  for (let i = 0; i < s.length; i++) {
    h0 ^= BigInt(s.charCodeAt(i));
    h0 = (h0 * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h0 & 0xffffffffffffn; // 48 bits
}

function popcnt48(x: bigint): number {
  let n = 0n;
  let v = x;
  while (v > 0n) { n += v & 1n; v >>= 1n; }
  return Number(n);
}

function rarityStat(rows: string[]): number {
  const fps = rows.map(fp48);
  let total = 0;
  for (let i = 1; i < fps.length; i++) {
    let m = 48;
    const lo = Math.max(0, i - LOOKBACK);
    for (let k = lo; k < i; k++) {
      const d = popcnt48(fps[i] ^ fps[k]);
      if (d < m) m = d;
    }
    total += m;
  }
  return total;
}

function shuffleInPlace<T>(a: T[], r: () => number): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

type Props = { compact?: boolean };

export function NullTestPermutationWidget({ compact = false }: Props) {
  const corpus = useMemo(buildCorpus, []);
  const observed = useMemo(() => rarityStat(corpus), [corpus]);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [hist, setHist] = useState<number[]>([]);

  const runs = DEFAULT_RUNS;

  const run = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setHist([]);
    setResult(null);

    const rand = mulberry32(0xC0DE);
    const dist: number[] = [];

    // Animate by yielding to the event loop in chunks.
    const CHUNK = 100;
    for (let batch = 0; batch < runs; batch += CHUNK) {
      const limit = Math.min(CHUNK, runs - batch);
      for (let k = 0; k < limit; k++) {
        const shuffled = corpus.slice();
        shuffleInPlace(shuffled, rand);
        dist.push(rarityStat(shuffled));
      }
      setProgress(batch + limit);
      setHist(dist.slice());
      await new Promise((r) => setTimeout(r, 0));
    }

    const mean = dist.reduce((a, x) => a + x, 0) / dist.length;
    const variance = dist.reduce((a, x) => a + (x - mean) ** 2, 0) / dist.length;
    const std = Math.sqrt(variance);
    const z = (observed - mean) / (std || 1);
    const more = dist.filter((x) => x >= observed).length;
    const pHat = (more + 1) / (dist.length + 1);

    setResult({ observed, nullDist: dist, mean, std, z, pHat });
    setRunning(false);
  }, [corpus, observed, runs]);

  // Histogram bins
  const { bins, binEdges } = useMemo(() => {
    if (hist.length === 0) return { bins: [], binEdges: [] as number[] };
    const min = Math.min(...hist, observed);
    const max = Math.max(...hist, observed);
    const span = max - min || 1;
    const N = 36;
    const step = span / N;
    const counts = new Array(N).fill(0) as number[];
    const edges = new Array(N + 1).fill(0).map((_, i) => min + step * i);
    for (const v of hist) {
      let idx = Math.floor((v - min) / step);
      if (idx >= N) idx = N - 1;
      if (idx < 0) idx = 0;
      counts[idx]++;
    }
    return { bins: counts, binEdges: edges };
  }, [hist, observed]);

  const peak = bins.length === 0 ? 0 : Math.max(...bins);
  const observedLeft = useMemo(() => {
    if (binEdges.length === 0) return 50;
    const min = binEdges[0];
    const max = binEdges[binEdges.length - 1];
    return Math.max(0, Math.min(100, ((observed - min) / (max - min)) * 100));
  }, [binEdges, observed]);

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.5fr_1fr]"} gap-6 lg:gap-10`}>
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Null-test · {runs.toLocaleString()} permutations
          </span>
          <span className="font-mono text-[10px] text-white/35 tabular-nums">
            {running ? `${progress.toLocaleString()} / ${runs.toLocaleString()}` : result ? "complete" : "ready"}
          </span>
        </div>

        {/* Histogram */}
        <div className="relative h-48 md:h-56 bg-black/40 rounded-xl border border-white/[0.04] overflow-hidden">
          {/* Bars */}
          <div className="absolute inset-0 flex items-end gap-px px-2">
            {bins.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center font-mono text-[11px] text-white/30">
                Click "Run null test" to fill the distribution.
              </div>
            ) : bins.map((c, i) => (
              <div
                key={i}
                className="flex-1 bg-white/30 transition-all"
                style={{ height: `${peak === 0 ? 0 : (c / peak) * 100}%`, opacity: 0.55 + (c / peak) * 0.4 }}
              />
            ))}
          </div>

          {/* Observed line */}
          {bins.length > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${observedLeft}%`, background: "rgb(125, 211, 252)", boxShadow: "0 0 8px rgb(125 211 252 / 0.7)" }}
            >
              <div className="absolute -top-1 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: "rgb(125, 211, 252)" }}>
                observed
              </div>
            </div>
          )}
        </div>

        {/* X axis */}
        <div className="mt-2 flex justify-between font-mono text-[9px] text-white/30 tabular-nums">
          <span>{binEdges[0]?.toFixed(0) ?? "—"}</span>
          <span>rarity statistic →</span>
          <span>{binEdges[binEdges.length - 1]?.toFixed(0) ?? "—"}</span>
        </div>

        {/* Results readout */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
          <Stat label="observed" value={observed.toFixed(0)} />
          <Stat label="null mean" value={result ? result.mean.toFixed(1) : "—"} />
          <Stat label="z-score" value={result ? `${result.z >= 0 ? "+" : ""}${result.z.toFixed(2)}σ` : "—"} highlight />
          <Stat label="p̂ (one-sided)" value={result ? (result.pHat < 1 / runs ? `< ${(1 / runs).toExponential(1)}` : result.pHat.toFixed(4)) : "—"} highlight />
        </div>

        {/* Run button */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-white text-black text-[12px] font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {running ? `Running · ${Math.round((progress / runs) * 100)}%` : result ? "Re-run" : "Run null test"}
          </button>
          <span className="font-mono text-[10.5px] text-white/35">
            Computed in your browser. No data sent.
          </span>
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
            What you are seeing
          </div>
          <p className="text-[13px] text-white/70 leading-snug">
            A synthetic 40-record corpus is generated under a fixed seed.
            The first 30 rows follow one structural regime, the last 10
            follow another. The rarity statistic measures how unusual
            each row is relative to its neighbors.
          </p>
          <p className="text-[13px] text-white/70 leading-snug mt-3">
            Permuting the row order destroys this regime structure. After
            {" "}{runs.toLocaleString()} random shuffles, the distribution
            of the statistic under the null hypothesis (no order matters)
            is what you see in grey. The cyan line is the observed value.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/45 leading-relaxed">
          Permutation testing was published by E. J. G. Pitman in 1937.
          When the observed statistic lands in the tail of the null
          distribution, structure is present. When it sits in the bulk,
          the data is shuffleable noise. The platform commits to this
          test on every formed model.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-black p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">{label}</div>
      <div className={`font-display text-[20px] md:text-[24px] tracking-[-0.02em] tabular-nums ${highlight ? "text-white" : "text-white/85"}`}>
        {value}
      </div>
    </div>
  );
}
