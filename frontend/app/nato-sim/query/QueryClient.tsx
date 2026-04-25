"use client";

/**
 * Direct Query — interactive client with server-persisted session.
 *
 * History pulls from /api/v1/nato_sim/queries on mount and after every
 * submit, so the operator's session survives page reloads, container
 * restarts, and use across multiple tabs. Each entry can be pinned
 * (with optional note) or deleted. Pinned entries float to the top.
 */

import { useEffect, useRef, useState } from "react";
import { InrProse } from "../_components/inr/InrProse";

interface QueryEntry {
  id: string;
  q: string;
  answer: string;
  sources: { title: string | null; origin: string | null; url: string | null }[];
  pinned?: number | boolean | null;
  note?: string | null;
  ts: string;
  loading?: boolean;
  error?: string;
}

const QUICK_PROMPTS = [
  "What is Russia's current disposition toward the Suwałki corridor?",
  "Assess Turkey's likely behavior on a NATO Article 5 invocation.",
  "What would constitute a Russian decision to invade Latvia?",
  "How does the Belarus succession crisis change Russian options?",
  "Identify the three most consequential indicators to watch in the next 72 hours.",
  "What is the most likely off-ramp scenario, and what would trigger it?",
];

function fmtTime(ts: string): string {
  if (!ts) return "—";
  try {
    return (
      new Date(ts + (ts.endsWith("Z") ? "" : "Z"))
        .toUTCString()
        .match(/\d{2}:\d{2}:\d{2}/)?.[0] ?? "—"
    );
  } catch {
    return "—";
  }
}

export function QueryClient() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<QueryEntry[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pinned">("all");
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function loadHistory() {
    try {
      const res = await fetch("/api/v1/nato_sim/queries?limit=100");
      if (!res.ok) return;
      const j = (await res.json()) as { items: QueryEntry[] };
      setHistory(j.items ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadHistory();
    taRef.current?.focus();
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || pendingId) return;
    const q = input.trim();
    const optimisticId = `pending-${Date.now()}`;
    setHistory((h) => [
      {
        id: optimisticId,
        q,
        answer: "",
        sources: [],
        ts: new Date().toISOString(),
        loading: true,
      },
      ...h,
    ]);
    setPendingId(optimisticId);
    setInput("");
    setError(null);
    try {
      const res = await fetch("/api/v1/nato_sim/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setHistory((h) =>
          h.map((entry) =>
            entry.id === optimisticId
              ? { ...entry, loading: false, error: `failed (${res.status}): ${txt.slice(0, 120)}` }
              : entry,
          ),
        );
        setError(`query failed: ${res.status}`);
        return;
      }
      // Reload from server so we get the persisted record (with real id).
      await loadHistory();
    } catch (err) {
      setHistory((h) =>
        h.map((entry) =>
          entry.id === optimisticId
            ? {
                ...entry,
                loading: false,
                error: err instanceof Error ? err.message : "unknown query error",
              }
            : entry,
        ),
      );
    } finally {
      setPendingId(null);
      taRef.current?.focus();
    }
  }

  async function togglePin(entry: QueryEntry) {
    const newState = !entry.pinned;
    await fetch(`/api/v1/nato_sim/queries/${entry.id}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: newState }),
    });
    loadHistory();
  }

  async function deleteEntry(entry: QueryEntry) {
    if (!confirm(`Delete this query?\n\n${entry.q}`)) return;
    await fetch(`/api/v1/nato_sim/queries/${entry.id}`, { method: "DELETE" });
    loadHistory();
  }

  const visible = filter === "pinned" ? history.filter((h) => h.pinned) : history;
  // pinned float to top within "all"
  const sorted =
    filter === "all"
      ? [...visible].sort((a, b) => {
          const ap = a.pinned ? 1 : 0;
          const bp = b.pinned ? 1 : 0;
          if (ap !== bp) return bp - ap;
          return (b.ts ?? "").localeCompare(a.ts ?? "");
        })
      : visible;

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
          placeholder="ask the corpus directly… &#10;&#10;e.g. 'What pre-conditions, if observed in the next 48 hours, would shift the assessment of Russian intent from coercive signaling to invasion?'&#10;&#10;⌘/Ctrl+↵ to submit · Grok-4 (deep model) · history is server-persisted"
        />
        <div className="flex items-center justify-between font-mono text-[10.5px]">
          <span className="text-li-text-muted">
            {input.length} chars · {input.split(/\s+/).filter(Boolean).length} words
          </span>
          <button
            type="submit"
            disabled={!input.trim() || !!pendingId}
            className="px-5 py-1.5 bg-li-cyan/15 hover:bg-li-cyan/25 border border-li-cyan/40 text-li-cyan rounded-sm tracking-[0.32em] uppercase disabled:opacity-30 transition-colors"
          >
            {pendingId ? "synthesizing…" : "submit"}
          </button>
        </div>
        {error && <div className="text-[11px] text-li-red font-mono">{error}</div>}
      </form>

      {/* History */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
            Session History · {sorted.length}
            {history.length > 0 && (
              <span className="text-li-text-secondary normal-case tracking-normal ml-2">
                — server-persisted
              </span>
            )}
          </div>
          <div className="flex gap-3 font-mono text-[10px] tracking-[0.28em] uppercase">
            <button
              onClick={() => setFilter("all")}
              className={
                filter === "all"
                  ? "text-li-cyan"
                  : "text-li-text-muted hover:text-li-text-primary"
              }
            >
              all ({history.length})
            </button>
            <button
              onClick={() => setFilter("pinned")}
              className={
                filter === "pinned"
                  ? "text-li-cyan"
                  : "text-li-text-muted hover:text-li-text-primary"
              }
            >
              pinned ({history.filter((h) => h.pinned).length})
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-[12.5px] text-li-text-muted font-mono">
            no queries yet.
          </div>
        ) : (
          <div className="space-y-8">
            {sorted.map((entry) => (
              <article
                key={entry.id}
                className={
                  "pl-5 transition-colors " +
                  (entry.pinned
                    ? "border-l-2 border-li-yellow/60"
                    : "border-l-2 border-li-cyan/30")
                }
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="font-display text-[16px] text-li-text-primary leading-snug flex-1">
                    {entry.q}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10px] text-li-text-muted whitespace-nowrap">
                    <span>{fmtTime(entry.ts)}Z</span>
                    {!entry.loading && !entry.error && (
                      <>
                        <button
                          onClick={() => togglePin(entry)}
                          className={
                            entry.pinned
                              ? "text-li-yellow hover:text-li-text-primary tracking-wider"
                              : "text-li-text-muted hover:text-li-yellow tracking-wider"
                          }
                          title={entry.pinned ? "unpin" : "pin"}
                        >
                          {entry.pinned ? "★" : "☆"}
                        </button>
                        <button
                          onClick={() => deleteEntry(entry)}
                          className="text-li-text-muted hover:text-li-red tracking-wider"
                          title="delete"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {entry.note && (
                  <div className="font-mono text-[10.5px] text-li-yellow/70 mb-2">
                    note: {entry.note}
                  </div>
                )}

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
                    {entry.sources && entry.sources.length > 0 && (
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
          </div>
        )}
      </section>
    </div>
  );
}
