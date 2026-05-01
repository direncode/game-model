"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// RangeQL Playground.
//
// Real round-trip against /api/range-query. The query route classifies the
// natural-language question into an intent and runs a deterministic
// computation against a formed model. We surface:
//   - the answer text
//   - the metrics
//   - the citations (record indices in the source corpus)
//   - the response_digest (the deterministic contract)
//   - wall-time
//
// Six canned queries are provided. The query route accepts a free-form
// question; we map it to an intent server-side. The textarea shows the
// query; pill-clicks load a canned query. Visitor clicks Execute.
//
// Syntax color: in-house regex tokenizer over a small RangeQL keyword set.
// Zero new deps.

type QueryResponse = {
  intent: string;
  question_canonical: string;
  model_id: string;
  model_name: string;
  corpus_records: number;
  answer: string;
  citations: { record_idx: number; sha256: string; preview: string }[];
  metrics?: Record<string, number | string>;
  lineage: string;
  response_digest: string;
  wall_ms: number;
  determinism_contract: string;
  llm_comparison?: string;
};

const CANNED: { label: string; q: string }[] = [
  { label: "what is rare",       q: "what are the most rare records in this corpus?" },
  { label: "novel classes",      q: "show me novel classes outside the three most populous" },
  { label: "show taxonomy",      q: "show the taxonomy and class sizes" },
  { label: "describe corpus",    q: "tell me about the corpus, fields, and entropy" },
  { label: "compare to llm",     q: "how does this compare to an llm baseline?" },
  { label: "summarize",          q: "summarize this formed model in one paragraph" },
];

// Lightweight syntax tokens — purely cosmetic.
const KEYWORDS = /\b(select|from|where|order|by|limit|asc|desc|count|histogram|bins|hamming|explain|and|or|not|null|true|false|distinct|group)\b/gi;
const NUMBERS = /\b\d+(?:\.\d+)?\b/g;
const STRINGS = /'[^']*'|"[^"]*"/g;
const VARIABLES = /\$[a-zA-Z_][a-zA-Z0-9_]*/g;
const COMPARATORS = /(=|!=|<=|>=|<|>)/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(src: string): string {
  let h = escapeHtml(src);
  h = h.replace(STRINGS, (m) => `<span class="text-emerald-300/85">${m}</span>`);
  h = h.replace(KEYWORDS, (m) => `<span class="text-cyan-300/85">${m}</span>`);
  h = h.replace(VARIABLES, (m) => `<span class="text-violet-300/85">${m}</span>`);
  h = h.replace(NUMBERS, (m) => `<span class="text-amber-300/85">${m}</span>`);
  h = h.replace(COMPARATORS, (m) => `<span class="text-white/55">${m}</span>`);
  return h;
}

type Props = { compact?: boolean };

export function RangeQLPlaygroundWidget({ compact = false }: Props) {
  const [q, setQ] = useState(CANNED[0].q);
  const [resp, setResp] = useState<QueryResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondDigest, setSecondDigest] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // For the displayed code: render as either the SQL surface (canned) or the
  // free-form natural-language string (which the engine accepts and
  // canonicalizes server-side). When the canned label is "what is rare",
  // we show a stylized SQL surface; otherwise we render the question.
  const displaySrc = q;

  const tokens = useMemo(() => highlight(displaySrc), [displaySrc]);
  const lineCount = useMemo(() => Math.max(displaySrc.split("\n").length, 1), [displaySrc]);

  const execute = useCallback(async (override?: string) => {
    setBusy(true);
    setErr(null);
    setSecondDigest(null);
    const useQ = override ?? q;
    try {
      const url = `/api/range-query?q=${encodeURIComponent(useQ)}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as Record<string, unknown>));
        throw new Error(typeof j.error === "string" ? j.error : `status ${r.status}`);
      }
      const j = (await r.json()) as QueryResponse;
      setResp(j);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }, [q]);

  // Kick off a default query so visitors see a populated panel on first load.
  useEffect(() => {
    if (!resp && !busy) execute(CANNED[0].q).catch(() => {/* ignore */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reissue = useCallback(async () => {
    if (!resp) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/range-query?q=${encodeURIComponent(resp.question_canonical)}`, { cache: "no-store" });
      const j = (await r.json()) as QueryResponse;
      setSecondDigest(j.response_digest);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }, [resp]);

  const copyDigest = useCallback(async () => {
    if (!resp) return;
    try {
      await navigator.clipboard.writeText(resp.response_digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard denied */ }
  }, [resp]);

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"} gap-6 lg:gap-10`}>
      {/* Editor pane */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex items-baseline gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">RangeQL</span>
          <span className="font-mono text-[10px] text-white/30">·</span>
          <span className="font-mono text-[10px] text-white/45">deterministic surface</span>
        </div>

        {/* Canned-query pills */}
        <div className="flex flex-wrap gap-1.5 p-3 border-b border-white/[0.06] bg-white/[0.01]">
          {CANNED.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => { setQ(c.q); taRef.current?.focus(); }}
              className={`inline-flex items-center h-7 px-2.5 rounded-full font-mono text-[10px] tracking-wide transition-colors ${
                q === c.q
                  ? "bg-white text-black"
                  : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] border border-white/10"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Editor with overlayed syntax highlight */}
        <div className="relative flex-1">
          <pre
            aria-hidden
            className="absolute inset-0 m-0 pointer-events-none p-4 font-mono text-[12.5px] text-white/0 leading-relaxed whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: tokens }}
            style={{ color: "rgb(255 255 255 / 0.85)" }}
          />
          <textarea
            ref={taRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            spellCheck={false}
            className="relative w-full min-h-[140px] md:min-h-[180px] bg-transparent text-transparent caret-white p-4 font-mono text-[12.5px] leading-relaxed resize-y outline-none"
          />
          <div className="absolute top-3 right-3 font-mono text-[9.5px] text-white/25 tabular-nums">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </div>
        </div>

        {/* Execute */}
        <div className="flex items-center gap-3 p-3 border-t border-white/[0.06] bg-white/[0.01]">
          <button
            type="button"
            onClick={() => execute()}
            disabled={busy}
            className="inline-flex items-center h-9 px-4 rounded-full bg-white text-black text-[11.5px] font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {busy ? "executing…" : resp ? "execute again" : "execute"}
          </button>
          {resp && (
            <button
              type="button"
              onClick={reissue}
              disabled={busy}
              className="inline-flex items-center h-9 px-4 rounded-full border border-white/20 text-white/85 text-[11px] font-mono tracking-wide hover:border-white/40 transition-colors disabled:opacity-50"
            >
              re-issue (verify digest)
            </button>
          )}
          <span className="font-mono text-[10px] text-white/35 ml-auto">
            POST → /api/range-query
          </span>
        </div>
      </div>

      {/* Response pane */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col">
        <div className="flex items-baseline gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Response</span>
          {resp && (
            <span className="font-mono text-[10px] text-white/40 ml-auto tabular-nums">
              intent: <span className="text-white/75">{resp.intent}</span> · {resp.wall_ms} ms
            </span>
          )}
        </div>

        <div className="flex-1 p-4 md:p-5 overflow-auto max-h-[420px]">
          {err && <pre className="font-mono text-[11px] text-rose-400 whitespace-pre-wrap">{err}</pre>}
          {!err && !resp && (
            <pre className="font-mono text-[11px] text-white/35">awaiting first execution …</pre>
          )}
          {!err && resp && (
            <div className="space-y-4">
              {/* Answer */}
              <div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">answer</div>
                <pre className="font-mono text-[11.5px] text-white/85 whitespace-pre-wrap leading-relaxed">{resp.answer}</pre>
              </div>

              {/* Citations */}
              {resp.citations.length > 0 && (
                <div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">citations</div>
                  <div className="space-y-1">
                    {resp.citations.slice(0, 6).map((c, i) => (
                      <div key={i} className="font-mono text-[10.5px] text-white/65">
                        <span className="text-white/35">#{c.record_idx}</span>{" "}
                        <code className="text-white/45">{c.sha256.slice(0, 16)}…</code>{" "}
                        <span className="text-white/55">{c.preview.slice(0, 80)}{c.preview.length > 80 ? "…" : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics */}
              {resp.metrics && Object.keys(resp.metrics).length > 0 && (
                <div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">metrics</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(resp.metrics).slice(0, 8).map(([k, v]) => (
                      <div key={k} className="font-mono text-[10.5px] flex justify-between gap-3">
                        <span className="text-white/45">{k}</span>
                        <span className="text-white/85 tabular-nums truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Digest bar */}
        {resp && (
          <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center gap-3">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/55">digest</span>
            <button
              type="button"
              onClick={copyDigest}
              className="font-mono text-[10.5px] text-white/85 truncate flex-1 min-w-0 text-left hover:text-white transition-colors"
              title="click to copy"
            >
              sha256:{resp.response_digest}
            </button>
            {copied && <span className="font-mono text-[10px] text-emerald-300">copied</span>}
            {secondDigest && (
              <span className={`font-mono text-[10px] tabular-nums ${
                secondDigest === resp.response_digest ? "text-emerald-300" : "text-rose-300"
              }`}>
                {secondDigest === resp.response_digest ? "byte-identical ✓" : "diverged ✗"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Determinism caption (full-width on /method, hidden on compact) */}
      {!compact && (
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/45 leading-relaxed">
          The query interface accepts free-form natural language and
          canonicalizes it server-side; the SQL-shaped surface above is
          how the engine prefers it written. Same model + same
          canonicalized question → byte-identical sha256 response digest.
          Re-issue to verify; the green check appears when both runs
          produce the same hash. The digest is the contract.
        </div>
      )}
    </div>
  );
}
