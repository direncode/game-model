"use client";

/**
 * Live query dock — bottom of the canvas, single-line input by default,
 * expands on focus. Restrained: no big colored ASK button, no glow,
 * no badge. Cmd/Ctrl+Enter to submit. Response renders in serif.
 */

import { useState } from "react";

export function LiveQueryDock() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<
    { title: string | null; origin: string | null; url: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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
        ? ((await res.json()) as { answer: string; sources: typeof sources })
        : { answer: "(query failed)", sources: [] };
      setAnswer(j.answer);
      setSources(j.sources ?? []);
    } catch {
      setAnswer("(query failed — check api logs)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-li-border bg-li-bg">
      <form
        onSubmit={submit}
        className="px-6 py-2 flex items-center gap-3"
      >
        <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
          Ad-hoc RFI
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
          }}
          className="flex-1 bg-transparent border-0 outline-0 text-[13px] font-mono text-li-text-primary placeholder:text-li-text-muted"
          placeholder="ask the corpus — e.g. 'what would constitute Russian commitment to invade Latvia?'"
        />
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-cyan disabled:opacity-30 hover:text-li-text-primary"
        >
          {loading ? "…" : "submit"}
        </button>
      </form>
      {open && answer && (
        <div className="border-t border-li-border max-h-72 overflow-auto px-6 py-4 bg-li-black-surface/40">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-2">
            Response
          </div>
          <pre className="whitespace-pre-wrap text-[13px] font-display text-li-text-primary leading-[1.65]">
            {answer}
          </pre>
          {sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-li-border/60 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-li-text-muted">
              <span className="tracking-[0.32em] uppercase">sources</span>
              {sources.map((s, i) => (
                <span key={i} className="text-li-cyan/85">
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
