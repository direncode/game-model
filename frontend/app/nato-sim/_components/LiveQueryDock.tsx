"use client";

/**
 * Live Query dock — docked at the bottom of the /nato-sim main canvas.
 *
 * Sends the operator's question to /api/v1/nato_sim/query (which routes
 * to the deep model with RAG context from the corpus) and renders the
 * INR-voice synthesized answer inline. Ctrl+Enter or the button submits.
 */

import { useState } from "react";

export function LiveQueryDock() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<
    { title: string | null; origin: string | null; url: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim() || loading) return;
    setLoading(true);
    setAnswer("");
    setSources([]);
    try {
      const res = await fetch("/api/v1/nato_sim/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const j = res.ok
        ? ((await res.json()) as {
            answer: string;
            sources: typeof sources;
          })
        : { answer: "(query failed)", sources: [] };
      setAnswer(j.answer);
      setSources(j.sources ?? []);
    } catch {
      setAnswer("(query failed — check backend logs)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-li-border bg-li-black-surface/90 p-3">
      <form onSubmit={submit} className="flex gap-2 items-start">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
          }}
          rows={2}
          className="flex-1 bg-li-bg border border-li-border rounded px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:border-li-cyan/40"
          placeholder="Live query — Opus deep-model, RAG-grounded on the briefing + starter corpus. Ctrl+Enter to submit."
        />
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className="px-4 py-2 bg-li-cyan/20 hover:bg-li-cyan/30 border border-li-cyan/40 text-li-cyan rounded text-xs font-mono tracking-wider uppercase disabled:opacity-40 transition-colors self-stretch"
        >
          {loading ? "…" : "Ask"}
        </button>
      </form>
      {answer && (
        <div className="mt-3 max-h-60 overflow-auto">
          <pre className="whitespace-pre-wrap text-sm font-sans text-li-text-primary">
            {answer}
          </pre>
          {sources.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {sources.map((s, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded bg-li-border text-li-text-secondary font-mono"
                >
                  {s.title ?? s.origin}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
