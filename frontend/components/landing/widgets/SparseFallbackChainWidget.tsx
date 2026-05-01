"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// SparseFallbackChainWidget
//
// Demonstrates the orchestrator's cascade. Posts a deliberately small,
// generic corpus to /api/range-form. The response carries:
//   - fingerprinter_mode (which class of strategy actually ran)
//   - effective_strategy (the specific strategy that produced coverage)
//   - coverage_pct (how much of the corpus that strategy covered)
//   - adapter_chain (per-strategy attempts, success flags, ms)
//
// We render a horizontal chain. The strategy that *succeeded* pulses
// bright; strategies tried-and-failed fade red; strategies skipped stay
// dim. The raw telemetry JSON lives on the right.

const CORPORA: { label: string; body: string; expected: string }[] = [
  {
    label: "small text",
    body: "the quick brown fox jumps over the lazy dog\n" +
          "she sells seashells by the seashore\n" +
          "peter piper picked a peck of pickled peppers\n" +
          "how much wood would a woodchuck chuck if a woodchuck could chuck wood\n" +
          "the rain in spain falls mainly on the plain\n",
    expected: "byte-hash",
  },
  {
    label: "ndjson 200 rows",
    // Generated client-side below; placeholder body
    body: "",
    expected: "btut · node · minhash",
  },
  {
    label: "tabular 100 rows",
    body: "",
    expected: "btut · node",
  },
];

// Strategy display chain, in cascade order.
const STAGES: { id: string; label: string; matchers: RegExp[] }[] = [
  { id: "btut",     label: "BTUT",        matchers: [/^btut$/i] },
  { id: "node",     label: "Dense Node",  matchers: [/^node$/i, /^dense/i, /^sha[-_]?prefix/i] },
  { id: "minhash",  label: "MinHash·128", matchers: [/^minhash/i] },
  { id: "simhash",  label: "SimHash·48",  matchers: [/^simhash/i] },
  { id: "bloom",    label: "Bloom",       matchers: [/^bloom/i] },
  { id: "bytehash", label: "byte-hash",   matchers: [/^byte[-_]?hash/i, /^bytehash/i, /^plaintext/i] },
];

type AdapterAttempt = { strategy: string; tried: boolean; succeeded: boolean; records_covered: number; ms: number; reason?: string };
type FormResponse = {
  id: string;
  name: string;
  corpus_records: number;
  fingerprinter_mode: string;
  effective_strategy?: string;
  coverage_pct?: number;
  adapter_chain?: AdapterAttempt[];
  formation_ms?: number;
};

function classify(strategy: string | undefined): string | null {
  if (!strategy) return null;
  for (const s of STAGES) {
    if (s.matchers.some((re) => re.test(strategy))) return s.id;
  }
  return null;
}

type Props = { compact?: boolean };

export function SparseFallbackChainWidget({ compact = false }: Props) {
  const [corpusIdx, setCorpusIdx] = useState(0);
  const [resp, setResp] = useState<FormResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pulseTick, setPulseTick] = useState(0);

  // Build fuller test corpora client-side (some corpora benefit from more rows)
  const corpusBody = useMemo(() => {
    if (corpusIdx === 0) return CORPORA[0].body;
    if (corpusIdx === 1) {
      // ndjson — 200 generic records
      const rows: string[] = [];
      for (let i = 0; i < 200; i++) {
        rows.push(JSON.stringify({
          id: i,
          a: (i * 17 + 3) % 97,
          b: (i * 11 + 7) % 53,
          c: ["alpha", "beta", "gamma", "delta"][i % 4],
          d: i % 13 === 0,
        }));
      }
      return rows.join("\n");
    }
    // CSV — 100 generic rows
    const rows: string[] = ["id,score,bucket,active"];
    for (let i = 0; i < 100; i++) {
      rows.push(`${i},${((i * 7 + 13) % 100) / 100},${["A","B","C","D"][i % 4]},${(i % 5 === 0).toString()}`);
    }
    return rows.join("\n");
  }, [corpusIdx]);

  // Run a sonar-pulse animation while the request is in flight
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setPulseTick((n) => n + 1), 220);
    return () => clearInterval(t);
  }, [busy]);

  const fire = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setResp(null);
    setPulseTick(0);
    try {
      // Mint a scoped demo token so this formation lands in its own demo
      // tenant, never the shared anonymous space. Works whether or not the
      // appliance has RANGE_REQUIRE_AUTH=1.
      const tokRes = await fetch("/api/range-demo-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: "chain" }),
      });
      if (!tokRes.ok) throw new Error(`demo token status ${tokRes.status}`);
      const tok = (await tokRes.json()) as { token: string };

      const r = await fetch("/api/range-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tok.token}`,
        },
        body: JSON.stringify({
          name: `chain-demo-${CORPORA[corpusIdx].label.replace(/\s+/g, "-")}-${Date.now().toString(36)}`,
          corpus_text: corpusBody,
          corpus_filename_hint: corpusIdx === 1 ? "demo.ndjson" : corpusIdx === 2 ? "demo.csv" : "demo.txt",
        }),
        cache: "no-store",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as Record<string, unknown>));
        throw new Error(typeof j.error === "string" ? j.error : `status ${r.status}`);
      }
      const j = (await r.json()) as FormResponse;
      setResp(j);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }, [corpusBody, corpusIdx]);

  const effectiveId = classify(resp?.effective_strategy ?? resp?.fingerprinter_mode);
  const attempts = resp?.adapter_chain ?? [];

  function attemptFor(stageId: string): AdapterAttempt | null {
    for (const a of attempts) {
      if (classify(a.strategy) === stageId) return a;
    }
    return null;
  }

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.4fr_1fr]"} gap-6 lg:gap-10`}>
      {/* Chain pane */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 md:p-8">
        {/* Corpus selector */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mr-2">corpus</span>
          {CORPORA.map((c, i) => (
            <button
              key={c.label}
              type="button"
              onClick={() => { setCorpusIdx(i); setResp(null); }}
              className={`inline-flex items-center h-7 px-2.5 rounded-full font-mono text-[10px] tracking-wide transition-colors ${
                corpusIdx === i ? "bg-white text-black" : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] border border-white/10"
              }`}
            >
              {c.label}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] text-white/35">
            {resp ? (
              <>fired in {resp.formation_ms ?? 0} ms · {resp.corpus_records} records</>
            ) : (
              <>{CORPORA[corpusIdx].body.length || corpusBody.length} bytes inline</>
            )}
          </span>
        </div>

        {/* The chain */}
        <div className="relative flex flex-wrap items-stretch gap-2 md:gap-3 mb-6">
          {STAGES.map((s, i) => {
            const a = attemptFor(s.id);
            const isEffective = effectiveId === s.id;
            const failed = a && a.tried && !a.succeeded;
            const skipped = !a;
            const pulseActive = busy && (pulseTick % STAGES.length) === i;
            return (
              <div key={s.id} className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <div
                  className={`relative flex-1 min-w-0 rounded-xl border px-3 py-3 transition-all duration-300 ${
                    isEffective
                      ? "border-emerald-400/60 bg-emerald-500/[0.08]"
                      : failed
                        ? "border-rose-400/30 bg-rose-500/[0.04]"
                        : skipped
                          ? "border-white/[0.08] bg-white/[0.01]"
                          : "border-white/15 bg-white/[0.02]"
                  } ${pulseActive ? "ring-1 ring-cyan-400/40" : ""}`}
                >
                  <div className={`font-mono text-[10px] uppercase tracking-[0.18em] mb-1 ${
                    isEffective ? "text-emerald-300" : failed ? "text-rose-300" : skipped ? "text-white/30" : "text-white/55"
                  }`}>
                    {s.label}
                  </div>
                  <div className={`font-mono text-[11px] tabular-nums ${
                    isEffective ? "text-white" : "text-white/65"
                  }`}>
                    {a
                      ? a.succeeded
                        ? `cov ${a.records_covered}/${resp?.corpus_records ?? "?"}`
                        : (a.reason?.slice(0, 14) ?? "passed")
                      : skipped
                        ? "—"
                        : "pending"
                    }
                  </div>
                  <div className={`font-mono text-[9.5px] mt-0.5 tabular-nums ${
                    isEffective ? "text-emerald-300/85" : "text-white/35"
                  }`}>
                    {a ? `${a.ms} ms` : ""}
                  </div>
                  {isEffective && (
                    <div className="absolute -top-1 -right-1 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300 bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 rounded-full">
                      effective
                    </div>
                  )}
                </div>
                {i < STAGES.length - 1 && (
                  <span className="text-white/20 font-mono text-[14px] shrink-0">→</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Status + run */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fire}
            disabled={busy}
            className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-white text-black text-[12px] font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {busy ? "forming…" : resp ? "form again" : "form this corpus"}
          </button>
          {resp && (
            <span className="font-mono text-[10.5px] text-white/55 tabular-nums">
              effective: <span className="text-emerald-300">{resp.effective_strategy ?? resp.fingerprinter_mode}</span>
              {typeof resp.coverage_pct === "number" && (
                <> · coverage <span className="text-white/85">{resp.coverage_pct.toFixed(1)}%</span></>
              )}
            </span>
          )}
          {err && <span className="font-mono text-[10.5px] text-rose-400">{err}</span>}
        </div>

        <div className="mt-6 pt-5 border-t border-white/[0.06] font-mono text-[10.5px] text-white/45 leading-relaxed">
          No corpus rejected. The orchestrator falls through until something fits.
        </div>
      </div>

      {/* Telemetry pane */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">telemetry · adapter_chain</span>
          </div>
          <pre className="p-4 font-mono text-[10.5px] text-white/75 leading-relaxed whitespace-pre overflow-auto max-h-[260px]">
{resp ? JSON.stringify({
  id: resp.id,
  fingerprinter_mode: resp.fingerprinter_mode,
  effective_strategy: resp.effective_strategy,
  coverage_pct: resp.coverage_pct,
  formation_ms: resp.formation_ms,
  adapter_chain: resp.adapter_chain,
}, null, 2) : "// click 'form this corpus' to populate"}
          </pre>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/45 leading-relaxed">
          MinHash · SimHash · Bloom · byte-hash are public crypto / sketch
          primitives, each with a published reference (Broder 1997,
          Charikar 2002, Bloom 1970). The orchestrator's job is to know
          which one to reach for; that judgement is the contribution.
        </div>
      </div>
    </div>
  );
}
