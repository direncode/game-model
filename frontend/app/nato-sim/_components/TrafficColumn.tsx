"use client";

/**
 * Live message firehose — displayed as a narrow left-edge column inside
 * the /nato-sim vertical. Subscribes to the backend SSE stream and does
 * an initial REST fetch on mount.
 *
 * Each message gets two visual cues:
 *   - Priority dot (FLASH=red, IMMEDIATE=orange, PRIORITY=amber,
 *     ROUTINE=gray) — analyst tradecraft.
 *   - Outlier flag (✦) — when the BTUT-style outlier scorer flags the
 *     message as anomalous against the rolling baseline. Hover for
 *     the human-readable explanation. This is the "find the unusual
 *     signal in the noise" surface the warning intel mission needs.
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

function priorityColor(p: string | null | undefined): string {
  switch (p) {
    case "FLASH":
      return "bg-li-red";
    case "IMMEDIATE":
      return "bg-orange-500";
    case "PRIORITY":
      return "bg-li-yellow";
    default:
      return "bg-li-gray-700";
  }
}

function OutlierFlag({ score, signals }: { score: number; signals: string }) {
  if (score < 0.25) return null;
  const tier = score >= 0.6 ? "high" : score >= 0.4 ? "med" : "low";
  const color =
    tier === "high"
      ? "text-li-purple"
      : tier === "med"
        ? "text-li-cyan"
        : "text-li-text-secondary";
  const friendlyLabel = signals
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
  return (
    <span
      className={`text-[11px] font-mono ${color}`}
      title={`outlier score ${(score * 100).toFixed(0)} · ${friendlyLabel}`}
    >
      ✦
    </span>
  );
}

export function TrafficColumn() {
  const [messages, setMessages] = useState<Message[]>([]);
  const esRef = useRef<EventSource | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/v1/nato_sim/messages?limit=30");
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
      es.addEventListener("message.ingested", () => {
        refresh();
      });
      es.onerror = () => {};
    } catch {
      // SSE unsupported; rely on initial fetch + manual refresh.
    }
    return () => {
      esRef.current?.close();
    };
  }, []);

  return (
    <aside className="w-72 border-r border-li-border bg-li-black-surface/70 text-xs font-mono overflow-auto flex-shrink-0">
      <div className="sticky top-0 bg-li-black-surface/90 backdrop-blur px-3 py-2 border-b border-li-border flex items-center justify-between">
        <div className="text-[10px] tracking-[0.3em] text-li-text-muted uppercase">
          Traffic · {messages.length}
        </div>
        <button
          onClick={refresh}
          className="text-[10px] text-li-text-muted hover:text-li-cyan font-mono"
          title="Refresh"
        >
          ↻
        </button>
      </div>
      {messages.length === 0 ? (
        <div className="p-3 text-li-text-muted leading-relaxed">
          — no messages yet —
          <div className="mt-2 text-[10px] opacity-70">
            Paste a cable into the box at the top of the canvas to ingest
            manually.
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-li-border/60">
          {messages.map((m) => {
            const score = m.outlier_score ?? 0;
            const signals = m.outlier_signals ?? "";
            const isOutlier = score >= 0.4;
            return (
              <li
                key={m.id}
                className={
                  "p-3 hover:bg-li-surface-hover " +
                  (isOutlier ? "bg-li-purple/5" : "")
                }
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityColor(m.priority)}`}
                    aria-hidden
                  />
                  <span className="uppercase text-[9px] text-li-text-muted tracking-widest">
                    {m.source}
                  </span>
                  {m.channel && (
                    <span className="text-li-text-muted text-[10px] truncate">
                      #{m.channel}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    <OutlierFlag score={score} signals={signals} />
                    {m.author && (
                      <span className="text-li-cyan text-[10px] truncate">
                        {m.author}
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-li-text-secondary line-clamp-3 leading-relaxed">
                  {m.content}
                </div>
                <div className="text-[9px] text-li-text-muted mt-1 flex items-center gap-2">
                  <span>{new Date(m.ts).toLocaleTimeString()}</span>
                  {isOutlier && (
                    <span className="text-li-purple/80">
                      anomaly {(score * 100).toFixed(0)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
