"use client";

/**
 * Inbound Traffic — interactive client component.
 *
 *   1. Source-tag input + quick-chip presets for common origins.
 *   2. Big resizable textarea (10 rows default, drag-to-grow).
 *   3. Submit on Cmd/Ctrl+Enter or button click.
 *   4. Below: recent-ingests panel polling every 4s, showing the last
 *      20 messages with their priority dot, outlier flag (+ explanation),
 *      and the first ~150 chars of content. Most-recent paste highlights
 *      briefly so the operator sees confirmation.
 */

import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  source: string;
  channel: string | null;
  author: string | null;
  content: string;
  ts: string;
  priority: "FLASH" | "IMMEDIATE" | "PRIORITY" | "ROUTINE" | null;
  outlier_score?: number | null;
  outlier_signals?: string | null;
}

const QUICK_TAGS = [
  "control:inject",
  "control:tasking",
  "control:rfi-response",
  "discord:dni",
  "discord:cia-team",
  "discord:dia-team",
  "discord:nsa-team",
  "discord:nga-team",
  "discord:fbi-team",
  "discord:eucom-j2",
  "discord:nato-nifc",
  "post:Riga",
  "post:Tallinn",
  "post:Vilnius",
  "post:Ankara",
  "post:Warsaw",
  "post:Kyiv",
  "reuters",
  "ap",
  "afp",
  "bbc",
  "ru-mod",
  "ru-mfa",
  "ria-novosti",
  "tass",
  "aljazeera",
];

function priorityMark(p: string | null | undefined) {
  switch (p) {
    case "FLASH":
      return { color: "bg-li-red", label: "FLASH" };
    case "IMMEDIATE":
      return { color: "bg-orange-500", label: "IMMEDIATE" };
    case "PRIORITY":
      return { color: "bg-li-yellow", label: "PRIORITY" };
    default:
      return { color: "bg-li-gray-700", label: "ROUTINE" };
  }
}

function signalsText(signals: string | null | undefined): string {
  if (!signals) return "";
  return signals
    .split(",")
    .map((s) =>
      ({
        novel_entity: "novel entity",
        rare_co_occurrence: "rare link",
        sparse_topic: "sparse topic",
        contradicts_kj: "contradicts KJ",
        length_anomaly: "length anomaly",
        burst: "burst",
      }[s.trim()] ?? s.trim()),
    )
    .filter(Boolean)
    .join(" · ");
}

export function InboundTrafficClient() {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastIngestedId, setLastIngestedId] = useState<string | null>(null);
  const [recent, setRecent] = useState<Message[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function fetchRecent() {
    try {
      const res = await fetch("/api/v1/nato_sim/messages?limit=20");
      if (!res.ok) return;
      const j = (await res.json()) as { items: Message[] };
      setRecent(j.items ?? []);
    } catch {
      /* ignore */
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
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
        setError(`ingest failed (${res.status}): ${txt.slice(0, 160)}`);
        return;
      }
      const j = (await res.json()) as { id?: string };
      setLastIngestedId(j.id ?? null);
      setContent("");
      taRef.current?.focus();
      // give the ingest pipeline a beat to finish resolver + scoring
      setTimeout(fetchRecent, 800);
    } catch (e) {
      setError(`ingest error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    fetchRecent();
    const t = setInterval(fetchRecent, 4000);
    return () => clearInterval(t);
  }, []);

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* Source tag */}
      <section>
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-2">
          Source Tag
        </div>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="e.g. control:inject · discord:cia-team · post:Riga · reuters · ru-mod"
          className="w-full bg-transparent border-0 border-b border-li-border outline-0 px-1 py-2 text-[14px] font-mono text-li-text-primary placeholder:text-li-text-muted focus:border-li-cyan/60"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setAuthor(tag)}
              className={
                "px-2 py-0.5 text-[10.5px] font-mono border rounded-sm transition-colors " +
                (author === tag
                  ? "border-li-cyan/60 text-li-cyan bg-li-cyan/10"
                  : "border-li-border text-li-text-muted hover:text-li-text-primary hover:border-li-text-secondary")
              }
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* Body textarea */}
      <section>
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-2">
          Message Body
        </div>
        <textarea
          ref={taRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
          }}
          rows={14}
          className="w-full bg-li-black-surface/40 border border-li-border outline-0 px-4 py-3 text-[14px] font-mono text-li-text-primary leading-[1.6] resize-y focus:border-li-cyan/60 placeholder:text-li-text-muted"
          placeholder="paste discord message, foreign-press snippet, FSO cable excerpt, sim inject, or any free-text traffic…&#10;&#10;the entity resolver is invoked on submit; entities upsert into the knowledge graph; mentions edges link co-occurring entities; priority + outlier are scored; the result appends to the Traffic column.&#10;&#10;⌘/Ctrl+↵ to submit"
        />
        <div className="mt-2 flex items-baseline justify-between font-mono text-[10.5px]">
          <span className="text-li-text-muted">
            {content.length} chars · {wordCount} words
            {lastIngestedId && (
              <span className="ml-3 text-li-green normal-case">
                ✓ last ingested
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!content.trim() || submitting}
            className="px-5 py-1.5 bg-li-cyan/15 hover:bg-li-cyan/25 border border-li-cyan/40 text-li-cyan rounded-sm tracking-[0.32em] uppercase disabled:opacity-30 transition-colors"
          >
            {submitting ? "ingesting…" : "ingest"}
          </button>
        </div>
        {error && (
          <div className="mt-2 text-[11px] text-li-red font-mono">{error}</div>
        )}
      </section>

      {/* Recent ingests */}
      <section>
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-3">
          Recent Ingests · last 20
        </div>
        {recent.length === 0 ? (
          <div className="text-[13px] text-li-text-muted font-mono py-3 px-1">
            no traffic yet.
          </div>
        ) : (
          <ul className="divide-y divide-li-border border-y border-li-border">
            {recent.map((m) => {
              const pri = priorityMark(m.priority);
              const score = m.outlier_score ?? 0;
              const isOutlier = score >= 0.4;
              const isJustIngested = m.id === lastIngestedId;
              return (
                <li
                  key={m.id}
                  className={
                    "px-1 py-3 transition-colors " +
                    (isJustIngested
                      ? "bg-li-green/[0.05]"
                      : isOutlier
                        ? "bg-li-purple/[0.04]"
                        : "")
                  }
                >
                  <div className="flex items-baseline gap-3 font-mono text-[10.5px]">
                    <span className="text-li-text-muted tracking-wider w-14">
                      {new Date(m.ts).toUTCString().match(/\d{2}:\d{2}/)?.[0]}Z
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${pri.color}`}
                        aria-hidden
                      />
                      <span className="tracking-[0.2em] uppercase text-li-text-secondary w-20">
                        {pri.label}
                      </span>
                    </span>
                    {isOutlier && (
                      <span
                        className="text-li-purple"
                        title={signalsText(m.outlier_signals)}
                      >
                        ✦ {Math.round(score * 100)}
                      </span>
                    )}
                    <span className="text-li-text-muted truncate">
                      {m.source}
                      {m.channel ? ` · ${m.channel}` : ""}
                      {m.author ? ` · ${m.author}` : ""}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-li-text-secondary mt-1.5 leading-snug line-clamp-3">
                    {m.content}
                  </p>
                  {isOutlier && (
                    <p className="text-[10px] text-li-purple/70 font-mono mt-1">
                      {signalsText(m.outlier_signals)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
