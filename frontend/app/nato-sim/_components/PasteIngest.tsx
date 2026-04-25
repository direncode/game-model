"use client";

/**
 * Paste-in widget for live message traffic. Restrained: a thin
 * row collapsed by default, expands inline. No big colored chrome.
 */

import { useRef, useState } from "react";

export function PasteIngest() {
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastIngestedAt, setLastIngestedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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
      setLastIngestedAt(Date.now());
      setContent("");
      taRef.current?.focus();
    } catch (e) {
      setError(`ingest error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-8 border-t border-b border-li-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-1 py-2 flex items-center justify-between text-[10px] tracking-[0.32em] uppercase font-mono text-li-text-muted hover:text-li-text-primary"
      >
        <span>
          {open ? "▾" : "▸"} Inbound Traffic — Paste
          {lastIngestedAt && (
            <span className="ml-3 normal-case tracking-normal text-li-green">
              · ingested {new Date(lastIngestedAt).toLocaleTimeString()}
            </span>
          )}
        </span>
        <span className="normal-case text-[9.5px] tracking-wider">
          ⌘/Ctrl+↵
        </span>
      </button>
      {open && (
        <div className="pb-3">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="source tag (control:tasking · reuters · ru-mod · post:Riga)"
            className="w-full bg-transparent border-0 outline-0 px-1 py-1 text-[11px] font-mono text-li-text-primary placeholder:text-li-text-muted border-b border-li-border focus:border-li-cyan/40"
          />
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
            }}
            rows={4}
            className="w-full bg-transparent border-0 outline-0 px-1 pt-2 text-[13px] font-mono resize-y focus:outline-none placeholder:text-li-text-muted"
            placeholder="paste discord message, foreign-press snippet, FSO cable excerpt, or sim inject…"
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-li-text-muted px-1">
            <span>
              {content.length} chars · {content.split(/\s+/).filter(Boolean).length} words
            </span>
            <button
              onClick={submit}
              disabled={!content.trim() || submitting}
              className="tracking-[0.32em] uppercase text-li-cyan disabled:opacity-30 hover:text-li-text-primary"
            >
              {submitting ? "ingesting…" : "ingest"}
            </button>
          </div>
          {error && (
            <div className="mt-2 text-[10.5px] text-li-red font-mono px-1">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
