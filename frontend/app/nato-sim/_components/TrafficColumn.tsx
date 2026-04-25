"use client";

/**
 * Live message firehose — narrow left column, terminal-flavored,
 * dense by design. Every message line is two rows of mono text:
 *   row 1: priority dot · source · channel · author · outlier flag
 *   row 2: content (clamped to 2 lines)
 *
 * No badges, no rounded boxes, no colorful borders. Hover reveals the
 * outlier explanation. Click pins to right-side rail (TBD).
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

function priorityMark(p: string | null | undefined): { color: string; label: string } {
  switch (p) {
    case "FLASH":
      return { color: "bg-li-red", label: "F" };
    case "IMMEDIATE":
      return { color: "bg-orange-500", label: "I" };
    case "PRIORITY":
      return { color: "bg-li-yellow", label: "P" };
    default:
      return { color: "bg-li-gray-700", label: "R" };
  }
}

function outlierTitle(score: number, signals: string): string {
  const friendly = signals
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
  return `outlier ${(score * 100).toFixed(0)} — ${friendly || "baseline"}`;
}

export function TrafficColumn() {
  const [messages, setMessages] = useState<Message[]>([]);
  const esRef = useRef<EventSource | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/v1/nato_sim/messages?limit=40");
      if (!res.ok) return;
      const j = (await res.json()) as { items: Message[] };
      setMessages(j.items ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh();
    try {
      const es = new EventSource("/api/v1/nato_sim/stream");
      esRef.current = es;
      es.addEventListener("message.ingested", () => refresh());
      es.onerror = () => {};
    } catch {
      /* SSE unsupported */
    }
    return () => {
      esRef.current?.close();
    };
  }, []);

  return (
    <aside className="w-64 border-r border-li-border bg-li-bg flex-shrink-0 flex flex-col font-mono">
      <div className="px-3 py-2 border-b border-li-border flex items-center justify-between">
        <span className="text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
          Cable Traffic
        </span>
        <span className="text-[10px] text-li-text-muted">
          {messages.length}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {messages.length === 0 ? (
          <div className="p-3 text-[11px] text-li-text-muted leading-relaxed">
            no traffic.
            <br />
            paste a cable in the top of the canvas to ingest.
          </div>
        ) : (
          <ul>
            {messages.map((m) => {
              const score = m.outlier_score ?? 0;
              const sig = m.outlier_signals ?? "";
              const isOutlier = score >= 0.4;
              const pri = priorityMark(m.priority);
              return (
                <li
                  key={m.id}
                  className={
                    "px-3 py-2 border-b border-li-border/50 hover:bg-li-surface-hover " +
                    (isOutlier ? "bg-li-purple/[0.04]" : "")
                  }
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-li-text-muted">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${pri.color}`}
                      aria-hidden
                    />
                    <span className="uppercase tracking-wider">{m.source}</span>
                    {m.channel && (
                      <span className="truncate text-li-text-muted">
                        ·{m.channel}
                      </span>
                    )}
                    {m.author && (
                      <span className="truncate text-li-text-secondary ml-auto">
                        {m.author}
                      </span>
                    )}
                    {isOutlier && (
                      <span
                        className="text-li-purple"
                        title={outlierTitle(score, sig)}
                      >
                        ✦
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-li-text-secondary mt-1 leading-snug line-clamp-2">
                    {m.content}
                  </div>
                  <div className="text-[9.5px] text-li-text-muted mt-1 tracking-wider">
                    {new Date(m.ts).toUTCString().match(/\d{2}:\d{2}/)?.[0]}Z
                    {isOutlier && (
                      <span className="text-li-purple/70 ml-2">
                        anom {Math.round(score * 100)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
