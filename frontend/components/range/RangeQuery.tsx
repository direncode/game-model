"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

type Vertical = "cyber" | "finance" | "pubmed" | "patents" | "comtrade" | "seismic" | "crypto" | "macro";

const VERTICALS: { id: Vertical; label: string; tone: string }[] = [
  { id: "cyber",    label: "Cyber",    tone: "#f85149" },
  { id: "finance",  label: "Finance",  tone: "#388bfd" },
  { id: "pubmed",   label: "PubMed",   tone: "#3fb950" },
  { id: "patents",  label: "Patents",  tone: "#a371f7" },
  { id: "comtrade", label: "Trade",    tone: "#c9a96e" },
  { id: "seismic",  label: "Seismic",  tone: "#d29922" },
  { id: "crypto",   label: "Crypto",   tone: "#00d4ff" },
  { id: "macro",    label: "Macro",    tone: "#9aa3b2" },
];

const SUGGESTIONS = [
  "What is the most rare record in this corpus?",
  "Are there novel classes outside the published taxonomy?",
  "Compare Range to ChatGPT on this corpus.",
  "Show me the discovered taxonomy.",
  "Describe this corpus.",
];

type Citation = { record_idx: number; sha256: string; preview: string };

type Answer = {
  intent: string;
  question_canonical: string;
  vertical: Vertical;
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

type Turn = { id: number; q: string; vertical: Vertical; loading: boolean; ans?: Answer; err?: string };

export function RangeQuery() {
  const [vertical, setVertical] = useState<Vertical>("cyber");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const turnIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const ask = useCallback(async (q: string) => {
    if (!q.trim()) return;
    const id = ++turnIdRef.current;
    const turn: Turn = { id, q, vertical, loading: true };
    setTurns((t) => [...t, turn]);
    setInput("");
    try {
      const url = `/api/range-query?vertical=${vertical}&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ans = (await r.json()) as Answer;
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, loading: false, ans } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, loading: false, err: String(e) } : x)));
    }
  }, [vertical]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <section id="query" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Query the formed model
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            ChatGPT for your data.<br />
            <span className="text-white/40">Without the cloud, the drift, or the guesswork.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl leading-relaxed">
            Every answer is computed deterministically against the formed
            model. Same question, same corpus, same byte-identical answer
            and lineage hash. No probabilistic generation. No invented
            citations. No external network.
          </p>
        </motion.div>

        {/* Query controls */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-12 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-cyan">
              Active model
            </span>
            <span className="font-mono text-[10px] text-white/30">
              GET /api/range-query
            </span>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8">
            {VERTICALS.map((v) => {
              const active = v.id === vertical;
              return (
                <button
                  key={v.id}
                  onClick={() => setVertical(v.id)}
                  className={`px-3 py-3 border-r border-white/[0.06] last:border-r-0 transition-colors text-left ${
                    active ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: v.tone, boxShadow: active ? `0 0 8px ${v.tone}` : "none" }}
                    />
                    <span className={`font-mono text-[10.5px] uppercase tracking-[0.18em] ${active ? "text-white" : "text-white/55"}`}>
                      {v.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Conversation */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-4 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden flex flex-col"
        >
          <div ref={scrollRef} className="flex-1 max-h-[640px] overflow-y-auto p-6 space-y-5">
            {turns.length === 0 && (
              <div className="space-y-4">
                <div className="font-mono text-[11px] text-white/40">
                  Try one of these against the {vertical.toUpperCase()} model:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="text-left text-sm text-white/75 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 hover:border-white/25 hover:bg-white/[0.04] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t) => (
              <div key={t.id} className="space-y-3">
                {/* User turn */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] text-white/70 shrink-0">
                    you
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-white/85 leading-relaxed">{t.q}</div>
                    <div className="font-mono text-[10px] text-white/30 mt-1">vertical={t.vertical}</div>
                  </div>
                </div>

                {/* Model turn */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-li-cyan/15 border border-li-cyan/30 flex items-center justify-center font-mono text-[9.5px] text-li-cyan shrink-0">
                    rng
                  </div>
                  <div className="flex-1 min-w-0">
                    {t.loading && (
                      <div className="font-mono text-[12px] text-white/45 italic">computing deterministically …</div>
                    )}
                    {t.err && (
                      <div className="font-mono text-[12px] text-li-red">error: {t.err}</div>
                    )}
                    {t.ans && <AnswerCard ans={t.ans} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <form onSubmit={handleSubmit} className="border-t border-white/10 bg-black/40 p-4 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`ask the ${vertical.toUpperCase()} model …`}
              spellCheck={false}
              className="flex-1 min-w-0 font-mono text-[13px] text-white/90 bg-black/60 border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:border-li-cyan/60 placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ask →
            </button>
          </form>
        </motion.div>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-6 text-[12px] font-mono text-white/40 leading-relaxed max-w-3xl"
        >
          Each answer carries a <code className="text-li-cyan">response_digest</code>{" "}
          — a SHA-256 over the canonicalized answer + citations + metrics.
          Re-issuing the same query against the same formed model returns the
          same digest, every time, on any appliance, forever.
        </motion.p>
      </div>
    </section>
  );
}

function AnswerCard({ ans }: { ans: Answer }) {
  return (
    <div className="space-y-3">
      <div className="text-[14px] text-white/90 leading-relaxed whitespace-pre-line">{ans.answer}</div>

      {ans.citations.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02] font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/40">
            citations · real records by index
          </div>
          <div className="divide-y divide-white/[0.04]">
            {ans.citations.map((c, i) => (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] text-li-cyan">record #{c.record_idx.toLocaleString()}</span>
                  <span className="font-mono text-[10px] text-white/35 truncate ml-3">sha256: {c.sha256.slice(0, 14)}…{c.sha256.slice(-4)}</span>
                </div>
                <div className="font-mono text-[11px] text-white/65 break-all leading-relaxed">{c.preview}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ans.metrics && Object.keys(ans.metrics).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(ans.metrics).map(([k, v]) => (
            <span key={k} className="font-mono text-[10.5px] text-white/65 px-2 py-1 rounded border border-white/10 bg-white/[0.02]">
              {k}: <span className="text-white/90">{typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(3)) : String(v)}</span>
            </span>
          ))}
        </div>
      )}

      {ans.llm_comparison && (
        <div className="rounded-lg border border-li-purple/25 bg-li-purple/[0.04] p-3">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-li-purple mb-1">vs. an LLM</div>
          <div className="text-[12.5px] text-white/75 leading-relaxed">{ans.llm_comparison}</div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-white/40 pt-1">
        <span>intent: <span className="text-white/65">{ans.intent}</span></span>
        <span>·</span>
        <span>wall: <span className="text-white/65">{ans.wall_ms}ms</span></span>
        <span>·</span>
        <span>digest: <span className="text-li-green">sha256:{ans.response_digest.slice(0, 16)}…</span></span>
        <span>·</span>
        <span>lineage: <span className="text-white/65">{ans.lineage.slice(0, 12)}…</span></span>
      </div>
    </div>
  );
}
