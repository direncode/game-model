"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Home hero — the live Console as the front door.
 *
 * The input box actually queries. It binds to the latest formed model
 * the user can see, fires /api/range-query, and renders the answer
 * inline below — answer, real record citations, response_digest, and
 * a one-click handoff to the deep workbench.
 *
 * Visual identity: light-burst on the right (xAI-influenced), faint
 * structural grid backing (Latent Ocean specific), live activity
 * ticker stamped at the top of the inquiry surface.
 */

type FormedModelMeta = {
  id: string;
  name: string;
  corpus_records: number;
  fingerprinter_mode: "node" | "btut";
  formed_at: string;
};

type Citation = { record_idx: number; sha256: string; preview: string };
type Answer = {
  intent: string;
  model_id: string;
  model_name: string;
  corpus_records: number;
  answer: string;
  citations: Citation[];
  metrics?: Record<string, number | string>;
  lineage: string;
  response_digest: string;
  wall_ms: number;
  determinism_contract: string;
  llm_comparison?: string;
};

const SUGGESTIONS = [
  "What is the most rare record in the corpus?",
  "Show the discovered taxonomy.",
  "Compare to ChatGPT on this corpus.",
];

export function HomeHero() {
  const [q, setQ] = useState("");
  const [armed, setArmed] = useState(false);
  const [models, setModels] = useState<FormedModelMeta[]>([]);
  const [activeModel, setActiveModel] = useState<FormedModelMeta | null>(null);
  const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Fetch the latest formed model so the inquiry has somewhere to land
  useEffect(() => {
    fetch("/api/range-form", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: FormedModelMeta[] = d.models ?? [];
        setModels(list);
        if (list.length > 0) setActiveModel(list[0]);
      })
      .catch(() => { /* silent — input still navigates */ });
  }, []);

  // Soft entrance choreography
  useEffect(() => { const t = setTimeout(() => setArmed(true), 700); return () => clearTimeout(t); }, []);

  // Slow ticker for the structural-activity strip (re-render every 2.5s)
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 2500); return () => clearInterval(t); }, []);

  const submit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setErr(null);
    setAnswer(null);
    if (!activeModel) {
      setErr("No formed models on this appliance yet. Open the workbench to form one against any corpus.");
      return;
    }
    setRunning(true);
    try {
      const url = `/api/range-query?model_id=${encodeURIComponent(activeModel.id)}&q=${encodeURIComponent(trimmed)}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }
      const a = (await r.json()) as Answer;
      setAnswer(a);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  }, [activeModel]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); submit(q); };

  const tickerLine = useMemo(() => {
    if (models.length === 0) return "no formed models on this appliance · workbench is empty · awaiting first formation";
    const m = activeModel ?? models[0];
    const sample = models[(tick + models.length) % models.length];
    return `${models.length} formed models · active: ${m.name.slice(0, 36)}${m.name.length > 36 ? "…" : ""} · most recent strike: ${sample.name.slice(0, 28)}${sample.name.length > 28 ? "…" : ""} · seed = 42`;
  }, [models, activeModel, tick]);

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-black flex flex-col">
      {/* ============= LIGHT BURST + STRUCTURAL GRID (Latent Ocean identity, beyond xAI) ============= */}
      <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: "easeOut" }} className="pointer-events-none absolute inset-0 z-0">
        {/* Right-side glow */}
        <div className="absolute right-[-8vw] top-1/2 -translate-y-1/2 w-[68vw] h-[78vh] hb-orb" />
        <div className="absolute right-[-2vw] top-1/2 -translate-y-1/2 w-[42vw] h-[42vw] hb-core" />
        <div className="absolute inset-y-0 left-0 right-0 hb-sweep" />
        <div className="absolute inset-0 hb-vignette" />

        {/* Structural grid — our identity, faint cartographic underlay */}
        <div className="absolute inset-0 hb-grid" />

        {/* Sonar-pulse rings — subtle, deep-left, never overlap the wordmark */}
        <div className="absolute -left-32 top-1/3 w-[36vw] h-[36vw] rounded-full hb-sonar" />
      </motion.div>

      {/* ============= TOP TICKER ============= */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={armed ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-20 mt-20 md:mt-24 mx-auto max-w-[860px] w-full px-6"
      >
        <div className="flex items-center gap-2.5 justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white/55 animate-pulse" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 truncate">
            {tickerLine}
          </span>
        </div>
      </motion.div>

      {/* ============= WORDMARK ============= */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 mt-2">
        <motion.h1
          initial={{ opacity: 0, scale: 0.985, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="hb-word relative font-display select-none text-center leading-[0.85] tracking-[-0.06em] text-white font-medium"
          style={{ fontSize: "clamp(110px, 21vw, 340px)" }}
        >
          Console
        </motion.h1>
      </div>

      {/* ============= INQUIRY SURFACE ============= */}
      <div className="relative z-20 px-6 pb-32 md:pb-40">
        <motion.form
          ref={formRef}
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 18 }}
          animate={armed ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-[860px]"
        >
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/65 backdrop-blur-md px-5 py-3.5 hover:border-white/30 focus-within:border-white/40 transition-colors">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={activeModel ? `Inquire of ${activeModel.name.slice(0, 38)}${activeModel.name.length > 38 ? "…" : ""}` : "What do you want to know?"}
              className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 focus:outline-none"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              disabled={running}
            />
            <button
              type="submit"
              aria-label="Inquire"
              disabled={running || !q.trim()}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 11.5V2.5m0 0L3 6.5m4-4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>

          {/* Suggestions row, hidden once the user has typed or asked */}
          {!q && !answer && !running && !err && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={armed ? { opacity: 1 } : {}}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="mt-4 flex flex-wrap items-center justify-center gap-2"
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setQ(s); submit(s); }}
                  className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50 hover:text-white border border-white/10 hover:border-white/30 rounded-full px-3.5 py-1.5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}

          {/* Result / error / no-models surface */}
          <AnimatePresence mode="wait">
            {(answer || err) && (
              <motion.div
                key={answer?.response_digest ?? "err"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="mt-5 rounded-2xl border border-white/12 bg-black/70 backdrop-blur-md overflow-hidden"
              >
                {err && (
                  <div className="p-5 font-mono text-[12px] text-white/65 leading-relaxed">
                    {err}
                    {!activeModel && (
                      <div className="mt-3">
                        <Link href="/console" className="inline-flex items-center gap-1.5 text-white/85 hover:text-white border-b border-white/30 hover:border-white pb-0.5">
                          Open the workbench
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {answer && (
                  <div className="p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                        {answer.intent} · {answer.model_name}
                      </div>
                      <div className="font-mono text-[10px] text-white/35 tabular-nums">
                        {answer.wall_ms} ms
                      </div>
                    </div>

                    <div className="text-[15px] text-white/90 leading-relaxed whitespace-pre-line">
                      {answer.answer}
                    </div>

                    {answer.citations?.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/[0.04]">
                        {answer.citations.slice(0, 3).map((c, i) => (
                          <div key={i} className="px-4 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono text-[11px] text-white/85">
                                record #{c.record_idx.toLocaleString()}
                              </span>
                              <span className="font-mono text-[10px] text-white/40 truncate max-w-[40%]">
                                {c.sha256.slice(0, 12)}…{c.sha256.slice(-4)}
                              </span>
                            </div>
                            <div className="font-mono text-[11px] text-white/55 break-all leading-relaxed mt-1">
                              {c.preview}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {answer.llm_comparison && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/45 mb-1">vs. an LLM</div>
                        <div className="text-[12.5px] text-white/65 leading-relaxed">{answer.llm_comparison}</div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="font-mono text-[10px] text-white/40 truncate">
                        digest · <span className="text-white/65">sha256:{answer.response_digest.slice(0, 14)}…</span>
                        <span className="text-white/25 ml-2">deterministic · seed=42</span>
                      </div>
                      <Link
                        href={`/console?model_id=${answer.model_id}`}
                        className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-full px-3 py-1 transition-colors"
                      >
                        Open in workbench
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      </Link>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.form>
      </div>

      {/* ============= LOWER STRIP ============= */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-8 flex items-end justify-between gap-6">
        <motion.a
          href="#beneath"
          aria-label="Scroll for more"
          initial={{ opacity: 0 }}
          animate={armed ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/35 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="hb-arrow">
            <path d="M7 2.5v9m0 0L3 7.5m4 4l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.a>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={armed ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-end sm:items-center gap-3 sm:gap-5 max-w-[640px] text-right sm:text-left"
        >
          <div className="text-[13.5px] leading-snug text-white/85">
            <div className="font-medium">Console · 1.0</div>
            <div className="text-white/50">Mount any corpus. Form a deterministic private model. Air-gap by default.</div>
          </div>
          <Link
            href="/about"
            className="shrink-0 inline-flex items-center justify-center h-10 px-5 rounded-full border border-white/25 text-white text-[11px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors"
          >
            How it works
          </Link>
        </motion.div>
      </div>

      {/* ============= STYLES ============= */}
      <style jsx>{`
        .hb-orb {
          background: radial-gradient(
            ellipse at center,
            rgba(255,255,255,0.55) 0%,
            rgba(255,255,255,0.22) 18%,
            rgba(255,255,255,0.06) 38%,
            transparent 65%
          );
          filter: blur(60px);
          animation: hb-orb-drift 14s ease-in-out infinite;
        }
        .hb-core {
          background: radial-gradient(
            circle at center,
            rgba(255,255,255,0.92) 0%,
            rgba(255,255,255,0.45) 14%,
            rgba(255,255,255,0.12) 32%,
            transparent 56%
          );
          filter: blur(40px);
          mix-blend-mode: screen;
          animation: hb-core-pulse 7s ease-in-out infinite;
        }
        .hb-sweep {
          background: linear-gradient(
            90deg,
            transparent 0%,
            transparent 28%,
            rgba(255,255,255,0.04) 50%,
            rgba(255,255,255,0.10) 62%,
            rgba(255,255,255,0.04) 76%,
            transparent 100%
          );
          mix-blend-mode: screen;
          animation: hb-sweep-pan 9s ease-in-out infinite;
        }
        .hb-vignette {
          background: radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent 50%,
            rgba(0,0,0,0.55) 88%,
            rgba(0,0,0,0.85) 100%
          );
        }
        /* Structural grid — Latent Ocean identity. Faint cartographic
           underlay that's only visible in the dim left half. */
        .hb-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 80%);
          -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 80%);
          opacity: 0.65;
        }
        /* Sonar-pulse — slow concentric rings, our deterministic-ping motif */
        .hb-sonar {
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 0 0 32px rgba(255,255,255,0.02),
            0 0 0 64px rgba(255,255,255,0.012);
          animation: hb-sonar-pulse 6s ease-out infinite;
          opacity: 0.9;
        }
        .hb-word {
          background-image: linear-gradient(
            90deg,
            rgba(255,255,255,0.55) 0%,
            rgba(255,255,255,0.78) 40%,
            rgba(255,255,255,1) 65%,
            rgba(255,255,255,1) 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          text-shadow:
            0 0 60px rgba(255,255,255,0.12),
            0 0 120px rgba(255,255,255,0.08);
          filter: drop-shadow(0 0 18px rgba(255,255,255,0.04));
          animation: hb-word-shimmer 11s ease-in-out infinite;
        }
        .hb-arrow { animation: hb-arrow-bounce 2.6s ease-in-out infinite; }

        @keyframes hb-orb-drift {
          0%, 100% { transform: translate(0, -50%) scale(1); opacity: 1; }
          50%      { transform: translate(-3vw, -50%) scale(1.04); opacity: 0.92; }
        }
        @keyframes hb-core-pulse {
          0%, 100% { opacity: 0.85; transform: translateY(-50%) scale(1); }
          50%      { opacity: 1;    transform: translateY(-50%) scale(1.06); }
        }
        @keyframes hb-sweep-pan {
          0%, 100% { transform: translateX(-12%); opacity: 0.6; }
          50%      { transform: translateX( 14%); opacity: 1; }
        }
        @keyframes hb-word-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes hb-arrow-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(3px); }
        }
        @keyframes hb-sonar-pulse {
          0%   { transform: scale(0.6); opacity: 0; }
          25%  { opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @media (max-width: 768px) {
          .hb-word {
            background-image: linear-gradient(
              90deg,
              rgba(255,255,255,0.7) 0%,
              rgba(255,255,255,1) 60%,
              rgba(255,255,255,1) 100%
            );
          }
        }
      `}</style>
    </section>
  );
}
