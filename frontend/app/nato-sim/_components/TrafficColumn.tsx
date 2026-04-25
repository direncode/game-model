"use client";

/**
 * Live message firehose — displayed as a narrow left-edge column inside
 * the /nato-sim vertical. Subscribes to the backend SSE stream at
 * /api/v1/nato_sim/stream and also does an initial REST fetch to populate
 * on mount.
 *
 * Priority lights: FLASH red, IMMEDIATE orange, PRIORITY amber, ROUTINE gray.
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

export function TrafficColumn() {
  const [messages, setMessages] = useState<Message[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Initial fetch.
    fetch("/api/v1/nato_sim/messages?limit=30")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items: Message[] }) => setMessages(j.items ?? []))
      .catch(() => {});

    // Live stream.
    try {
      const es = new EventSource("/api/v1/nato_sim/stream");
      esRef.current = es;
      es.addEventListener("message.ingested", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          const messageId = data?.payload?.message_id;
          if (!messageId) return;
          fetch(`/api/v1/nato_sim/messages?limit=1`)
            .then((r) => r.json())
            .then((j: { items: Message[] }) => {
              if (j.items?.[0]) {
                setMessages((prev) => [j.items[0], ...prev].slice(0, 30));
              }
            })
            .catch(() => {});
        } catch {
          // ignore parse errors
        }
      });
      es.onerror = () => {
        // browsers auto-reconnect; no-op.
      };
    } catch {
      // SSE unsupported; fall back to initial fetch only.
    }

    return () => {
      esRef.current?.close();
    };
  }, []);

  return (
    <aside className="w-72 border-r border-li-border bg-li-black-surface/70 text-xs font-mono overflow-auto flex-shrink-0">
      <div className="sticky top-0 bg-li-black-surface/90 backdrop-blur px-3 py-2 border-b border-li-border">
        <div className="text-[10px] tracking-[0.3em] text-li-text-muted uppercase">
          Traffic · {messages.length}
        </div>
      </div>
      {messages.length === 0 ? (
        <div className="p-3 text-li-text-muted">— no messages yet —</div>
      ) : (
        <ul className="divide-y divide-li-border/60">
          {messages.map((m) => (
            <li key={m.id} className="p-3 hover:bg-li-surface-hover">
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
                {m.author && (
                  <span className="text-li-cyan text-[10px] truncate ml-auto">
                    {m.author}
                  </span>
                )}
              </div>
              <div className="text-li-text-secondary line-clamp-3 leading-relaxed">
                {m.content}
              </div>
              <div className="text-[9px] text-li-text-muted mt-1">
                {new Date(m.ts).toLocaleTimeString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
