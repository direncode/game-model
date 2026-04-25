"use client";

/**
 * Paste-in widget for live message traffic.
 *
 * The operator copies a Discord message (or any cable / report / inject)
 * and pastes it here. On submit, the content is POSTed to
 * /api/v1/nato_sim/ingest/paste, which runs it through the full pipeline
 * (resolver → graph diff → priority + outlier scoring → SSE push). The
 * Traffic column updates within seconds.
 *
 * This replaces the Discord gateway bot for tomorrow's sim — slower than
 * automatic ingest but reliable, no Discord-token risk, no admin invite
 * required. Single keystroke: Cmd/Ctrl+Enter to submit.
 */

import { useRef, useState } from "react";

export function PasteIngest() {
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastIngestedId, setLastIngestedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/nato_sim/ingest/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: author ? `[${author}] ${content}` : content,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`ingest failed (${res.status}): ${txt.slice(0, 120)}`);
        return;
      }
      const j = (await res.json()) as { id?: string };
      setLastIngestedId(j.id ?? null);
      setContent("");
      // refocus for the next paste
      taRef.current?.focus();
    } catch (e) {
      setError(`ingest error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <details className="mb-8 border border-li-border rounded bg-li-black-surface/40 group">
      <summary className="cursor-pointer px-4 py-2.5 text-[10px] tracking-[0.3em] uppercase font-mono text-li-text-muted flex items-center justify-between hover:text-li-cyan list-none">
        <span>
          ▸ Paste Inbound Message Traffic
          {lastIngestedId && (
            <span className="ml-3 text-li-green normal-case tracking-normal">
              · ✓ last ingested
            </span>
          )}
        </span>
        <span className="text-[9px] text-li-text-muted normal-case tracking-wider">
          Cmd/Ctrl+Enter to submit
        </span>
      </summary>
      <div className="px-4 pb-4 pt-2 border-t border-li-border">
        <div className="flex gap-3 mb-2">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="optional: source/author tag (e.g. control:tasking, reuters, ru-mod)"
            className="flex-1 bg-li-bg border border-li-border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-li-cyan/40"
          />
        </div>
        <textarea
          ref={taRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
          }}
          rows={5}
          className="w-full bg-li-bg border border-li-border rounded px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:border-li-cyan/40"
          placeholder="Paste a Discord message, foreign press snippet, FSO cable excerpt, or sim inject. The pipeline resolves entities, scores priority + outlierness, updates the knowledge graph, and pushes to the Traffic column."
        />
        <div className="flex items-center justify-between mt-2">
          <div className="text-[10px] text-li-text-muted font-mono">
            {content.length} chars · {content.split(/\s+/).filter(Boolean).length}{" "}
            words
          </div>
          <button
            onClick={submit}
            disabled={!content.trim() || submitting}
            className="px-4 py-1.5 bg-li-cyan/15 hover:bg-li-cyan/25 border border-li-cyan/40 text-li-cyan rounded text-xs font-mono tracking-widest uppercase disabled:opacity-40 transition-colors"
          >
            {submitting ? "ingesting…" : "Ingest"}
          </button>
        </div>
        {error && (
          <div className="mt-2 text-[11px] text-li-red font-mono">{error}</div>
        )}
      </div>
    </details>
  );
}
