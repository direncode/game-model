"use client";

// AIAgentDrawer — collapsible side panel with a role-scoped assistant.
//
// Sends questions to POST /api/v1/dunc/agent/query and displays the reply.
// The assistant stub on the backend is LLM-free in v0, but the protocol
// is ready to plug a real model in.

import { useState } from "react";
import { duncApi } from "@/lib/dunc/api";
import { useDuncStore } from "@/lib/dunc/store";
import type { DuncAgentReply } from "@/lib/dunc/types";
import { cn } from "@/lib/utils";

interface ChatTurn {
  id: string;
  q: string;
  reply: DuncAgentReply | null;
  loading: boolean;
  error: string | null;
}

const SUGGESTED = [
  "Is the striker under-running?",
  "How should we beat their press?",
  "Whose legs are tired?",
  "Are we getting numbers in midfield?",
];

export function AIAgentDrawer({ matchId }: { matchId: string }) {
  const role = useDuncStore((s) => s.role);
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || !matchId) return;
    const id = `t${Date.now()}`;
    setTurns((prev) => [
      ...prev,
      { id, q: trimmed, reply: null, loading: true, error: null },
    ]);
    setInput("");
    try {
      const reply = await duncApi.agentQuery(matchId, role, trimmed);
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, reply, loading: false } : t)),
      );
    } catch (e) {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, loading: false, error: (e as Error).message }
            : t,
        ),
      );
    }
  }

  return (
    <div
      className={cn(
        "fixed right-0 top-0 bottom-0 z-30 flex flex-col bg-li-black-elevated border-l border-li-border transition-all",
        open ? "w-[340px]" : "w-12",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-12 flex items-center justify-center border-b border-li-border hover:bg-li-black-surface"
        aria-label={open ? "Collapse AI agent" : "Expand AI agent"}
      >
        <span className="font-mono text-[11px] uppercase tracking-widest text-li-cyan">
          {open ? "◢ D-U-N-C AI" : "AI"}
        </span>
      </button>

      {open && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-[12px]">
            <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
              Assistant — {role === "manager" ? "Manager view" : "Tech staff view"}
            </div>
            {turns.map((t) => (
              <div key={t.id} className="space-y-1">
                <div className="text-li-text-secondary">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-li-text-muted mr-1">
                    You
                  </span>
                  {t.q}
                </div>
                {t.loading && (
                  <div className="text-li-text-muted italic">thinking…</div>
                )}
                {t.error && <div className="text-li-red">Error: {t.error}</div>}
                {t.reply && (
                  <div className="text-li-white border-l-2 border-li-cyan pl-2 py-1">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-li-cyan">
                      D-U-N-C
                    </div>
                    {t.reply.answer}
                    {t.reply.citations.length > 0 && (
                      <div className="text-[9px] font-mono text-li-text-muted mt-1">
                        refs: {t.reply.citations.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Permanent quick-ask buttons */}
          <div className="border-t border-li-border px-3 py-2 space-y-1">
            <div className="text-[9px] uppercase tracking-widest text-li-text-muted font-mono mb-1">
              Quick ask
            </div>
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="block w-full text-left text-[11px] text-li-cyan hover:underline py-0.5"
              >
                → {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="border-t border-li-border p-2 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the engine…"
              className="flex-1 bg-li-black-surface border border-li-border rounded-sm px-2 py-1 text-[12px] text-li-white placeholder:text-li-text-muted focus:outline-none focus:border-li-cyan"
            />
            <button
              type="submit"
              className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider bg-li-cyan text-li-black rounded-sm hover:bg-li-cyan/90"
            >
              Ask
            </button>
          </form>
        </>
      )}
    </div>
  );
}
