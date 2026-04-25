"use client";

/**
 * Direct Query — interactive client.
 *
 * Big multi-line input, submit on Cmd/Ctrl+Enter, query history with
 * each Q & A rendered as a card. Sources rendered as pill chips.
 * Quick prompts for common analyst probes.
 */

import { useEffect, useRef, useState } from "react";
import { InrProse } from "../_components/inr/InrProse";

interface QueryEntry {
  id: number;
  q: string;
  answer: string;
  sources: { title: string | null; origin: string | null; url: string | null }[];
  loading: boolean;
  error?: string;
  ts: number;
}

const QUICK_PROMPTS = [
  "What is Russia's current disposition toward the Suwałki corridor?",
  "Assess Turkey's likely behavior on a NATO Article 5 invocation.",
  "What would constitute a Russian decision to invade Latvia?",
  "How does the Belarus succession crisis change Russian options?",
  "Identify the three most consequential indicators to watch in the next 72 hours.",
  "What is the most likely off-ramp scenario, and what would trigger it?",
];

export function QueryClient() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<QueryEntry[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim()) return;
    const id = nextId.current++;
    const q = input.trim();
    const entry: QueryEntry = {
      id,
      q,
      answer: "",
      sources: [],
      loading: true,
      ts: Date.now(),
    };
    setHistory((h) => [entry, ...h]);
    setInput("");
    taRef.current?.focus();
    try {
      const res = await fetch("/api/v1/nato_sim/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setHistory((h) =>
          h.map((e) =>
            e.id === id
              ? { ...e, loading: false, error: `failed (${res.status}): ${txt.slice(0, 120)}` }
              : e,
          ),
        );
        return;
      }
      const j = (await res.json()) as { answer: string; sources: QueryEntry["sources"] };
      setHistory((h) =>
        h.map((e) =>
          e.id === id
            ? { ...e, loading: false, answer: j.answer, sources: j.sources ?? [] }
            : e,
        ),
      );
    } catch (err) {
      setHistory((h) =>
        h.map((e) =>
          e.id === id
            ? {
                ...e,
                loading: false,
                error:
                  err instanceof Error ? err.message : "unknown query error",
              }
            : e,
        ),
      );
    }
  }

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  return (
    <div className="space-y-8">
      {/* Quick prompts */}
      <section>
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-2">
          Quick Prompts
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setInput(p);
                taRef.current?.focus();
              }}
              className="text-left px-2.5 py-1 text-[11px] font-mono border border-li-border rounded-sm text-li-text-secondary hover:text-li-text-primary hover:border-li-cyan/50 transition-colors max-w-md truncate"
              title={p}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* Input */}
      <form onSubmit={submit} className="space-y-2">
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
          Query
        </div>
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
          }}
          rows={6}
          className="w-full bg-li-black-surface/40 border border-li-border outline-0 px-4 py-3 text-[14px] font-mono text-li-text-primary leading-[1.6] resize-y focus:border-li-cyan/60 placeholder:text-li-text-muted"
          placeholder="ask the corpus directly… &#10;&#10;e.g. 'What pre-conditions, if observed in the next 48 hours, would shift the assessment of Russian intent from coercive signaling to invasion?'&#10;&#10;⌘/Ctrl+↵ to submit · Grok-4 (deep model)"
        />
        <div className="flex items-center justify-between font-mono text-[10.5px]">
          <span className="text-li-text-muted">
            {input.length} chars · {input.split(/\s+/).filter(Boolean).length} words
          </span>
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-5 py-1.5 bg-li-cyan/15 hover:bg-li-cyan/25 border border-li-cyan/40 text-li-cyan rounded-sm tracking-[0.32em] uppercase disabled:opacity-30 transition-colors"
          >
            submit
          </button>
        </div>
      </form>

      {/* History */}
      {history.length > 0 && (
        <section className="space-y-8 mt-12">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
            Session History
          </div>
          {history.map((entry) => (
            <article
              key={entry.id}
              className="border-l-2 border-li-cyan/40 pl-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-display text-[16px] text-li-text-primary leading-snug flex-1">
                  {entry.q}
                </div>
                <div className="font-mono text-[10px] text-li-text-muted whitespace-nowrap">
                  {new Date(entry.ts).toUTCString().match(/\d{2}:\d{2}:\d{2}/)?.[0]}Z
                </div>
              </div>

              {entry.loading ? (
                <div className="mt-3 font-mono text-[11px] text-li-cyan animate-pulse">
                  …Grok-4 synthesizing
                </div>
              ) : entry.error ? (
                <div className="mt-3 font-mono text-[11px] text-li-red">
                  {entry.error}
                </div>
              ) : (
                <div className="mt-4">
                  <InrProse text={entry.answer} />
                  {entry.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-li-border/60 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-li-text-muted">
                      <span className="tracking-[0.32em] uppercase">retrieved</span>
                      {entry.sources.map((s, i) => (
                        <span key={i} className="text-li-cyan/85">
                          {s.title ?? s.origin}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
