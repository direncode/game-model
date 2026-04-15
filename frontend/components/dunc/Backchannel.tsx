"use client";

// Backchannel — staff ↔ manager communication channel.
//
// Technical staff can send curated insights to the manager. The manager
// sees a simplified feed of only what the staff has flagged — not the
// raw engine output. This mirrors how real dugout comms work: the analyst
// in the stands radios down a simplified message to the touchline.
//
// v0: client-side only (messages stored in Zustand). When the backend
// gets a real-time messaging layer, this becomes a WS subscription.

import { useState } from "react";
import { useDuncStore } from "@/lib/dunc/store";
import type { DuncInsight, DuncRole } from "@/lib/dunc/types";
import { cn } from "@/lib/utils";
import { Send, Radio } from "lucide-react";
import { create } from "zustand";

// ── Backchannel store ─────────────────────────────────────────────────
interface BackchannelMessage {
  id: string;
  from: DuncRole;
  text: string;
  timestamp: number;      // match clock seconds
  insightRef?: string;    // optional insight id this message references
}

interface BackchannelState {
  messages: BackchannelMessage[];
  send: (msg: Omit<BackchannelMessage, "id">) => void;
  clear: () => void;
}

export const useBackchannel = create<BackchannelState>((set) => ({
  messages: [],
  send: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id: `bc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
      ].slice(-50),
    })),
  clear: () => set({ messages: [] }),
}));

// ── Staff view: compose + send insights to manager ────────────────────
export function StaffBackchannel() {
  const role = useDuncStore((s) => s.role);
  const clockSec = useDuncStore((s) => s.clockSec);
  const insights = useDuncStore((s) => s.insights);
  const send = useBackchannel((s) => s.send);
  const messages = useBackchannel((s) => s.messages);
  const [input, setInput] = useState("");

  if (role !== "technical_staff") return null;

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    send({ from: "technical_staff", text, timestamp: clockSec });
    setInput("");
  }

  function forwardInsight(insight: DuncInsight) {
    send({
      from: "technical_staff",
      text: `[${insight.kind.toUpperCase()}] ${insight.title} — ${insight.summary.slice(0, 100)}`,
      timestamp: clockSec,
      insightRef: insight.id,
    });
  }

  // Recent insights staff can forward
  const recentInsights = insights.slice(-5).reverse();

  return (
    <div className="border border-li-green/30 bg-li-green/5 rounded-md overflow-hidden">
      <div className="px-3 py-1.5 border-b border-li-green/20 flex items-center gap-2">
        <Radio className="w-3 h-3 text-li-green" />
        <span className="text-[9px] uppercase tracking-widest text-li-green font-mono font-bold">
          Backchannel → Manager
        </span>
        <span className="text-[9px] font-mono text-li-text-muted ml-auto">
          {messages.length} sent
        </span>
      </div>

      {/* Manager instructions received */}
      {(() => {
        const mgrMsgs = messages.filter((m) => m.from === "manager").slice(-3).reverse();
        if (mgrMsgs.length === 0) return null;
        return (
          <div className="px-3 py-1.5 border-b border-li-cyan/20 bg-li-cyan/5">
            <div className="text-[9px] uppercase tracking-widest text-li-cyan font-mono mb-1 font-bold">
              ⚡ From manager
            </div>
            {mgrMsgs.map((m) => (
              <div key={m.id} className="text-[10px] text-li-white py-0.5">
                <span className="text-[9px] font-mono text-li-cyan tabular-nums mr-1">
                  {Math.floor(m.timestamp / 60)}:{String(Math.floor(m.timestamp % 60)).padStart(2, "0")}
                </span>
                {m.text}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Quick-forward recent insights */}
      {recentInsights.length > 0 && (
        <div className="px-3 py-1.5 border-b border-li-green/10">
          <div className="text-[9px] uppercase tracking-widest text-li-text-muted font-mono mb-1">
            Forward to manager
          </div>
          {recentInsights.slice(0, 3).map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => forwardInsight(i)}
              className="block w-full text-left text-[10px] text-li-text-secondary hover:text-li-green py-0.5 truncate focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black"
            >
              → {i.title}
            </button>
          ))}
        </div>
      )}

      {/* Compose */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="px-2 py-1.5 flex gap-1.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message to manager…"
          className="flex-1 bg-li-black-surface border border-li-border rounded-sm px-2 py-1 text-[11px] text-li-white placeholder:text-li-text-muted focus:outline-none focus:border-li-green"
        />
        <button
          type="submit"
          className="px-2 py-1 bg-li-green text-li-black rounded-sm hover:bg-li-green/90 focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black"
        >
          <Send className="w-3 h-3" />
          <span className="sr-only">Send message</span>
        </button>
      </form>
    </div>
  );
}

// ── Manager view: received messages from staff ────────────────────────
export function ManagerBackchannel() {
  const role = useDuncStore((s) => s.role);
  const messages = useBackchannel((s) => s.messages);

  if (role !== "manager") return null;

  const staffMessages = messages.filter((m) => m.from === "technical_staff");

  if (staffMessages.length === 0) {
    return (
      <div className="border border-li-green/20 bg-li-green/5 rounded-md px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio className="w-3 h-3 text-li-green/50" />
          <span className="text-[9px] uppercase tracking-widest text-li-green/50 font-mono">
            Staff channel — waiting
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-li-green/30 bg-li-green/5 rounded-md overflow-hidden">
      <div className="px-3 py-1.5 border-b border-li-green/20 flex items-center gap-2">
        <Radio className="w-3 h-3 text-li-green animate-pulse motion-reduce:animate-none" />
        <span className="text-[9px] uppercase tracking-widest text-li-green font-mono font-bold">
          From technical staff
        </span>
        <span className="text-[9px] font-mono text-li-text-muted ml-auto">
          {staffMessages.length} messages
        </span>
      </div>
      <div className="px-3 py-1.5 space-y-1.5 max-h-40 overflow-y-auto">
        {staffMessages.slice(-5).reverse().map((m) => (
          <div key={m.id} className="text-[10px]">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-li-green tabular-nums">
                {Math.floor(m.timestamp / 60)}:{String(Math.floor(m.timestamp % 60)).padStart(2, "0")}
              </span>
              <span className="text-li-white">{m.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
