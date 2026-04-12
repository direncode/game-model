"use client";

// GameApproachWindow — live tactical suggestions panel.
//
// This is the "what should we do next?" card. It looks at the most recent
// insights and produces 1–3 templated suggestions. In v0 this is pure
// client-side logic; when the real AI agent is wired up, this component
// will subscribe to server-pushed suggestions instead.

import { useMemo } from "react";
import { useDuncStore } from "@/lib/dunc/store";
import type { DuncInsight } from "@/lib/dunc/types";

interface Suggestion {
  id: string;
  title: string;
  body: string;
  priority: "high" | "medium" | "low";
}

function deriveSuggestions(
  insights: DuncInsight[],
  role: "manager" | "technical_staff",
): Suggestion[] {
  if (insights.length === 0) return [];

  const recent = insights.slice(-8);
  const out: Suggestion[] = [];
  const seen = new Set<string>();

  for (const i of recent.slice().reverse()) {
    if (seen.has(i.kind)) continue;
    seen.add(i.kind);

    if (i.kind === "under_run") {
      out.push({
        id: `sug-${i.id}`,
        title: "Re-sync the front line",
        body:
          role === "manager"
            ? "Tell the striker to hold the last shoulder until we turn possession."
            : "ST vx is opposing midfield vx avg. Recommend cue to stay on the last defender line; revisit after next 2 possessions.",
        priority: "high",
      });
    } else if (i.kind === "pressing_shift") {
      out.push({
        id: `sug-${i.id}`,
        title: "Break the press directly",
        body:
          role === "manager"
            ? "Go long from the back. Don't try to play through it — pin their full-backs."
            : `${i.evidence?.share_in_home_half ?? "?"} of their block is in our half. Switch to direct vertical outlet, pin full-backs high, consider 3rd-man runner.`,
        priority: "high",
      });
    } else if (i.kind === "convergence") {
      out.push({
        id: `sug-${i.id}`,
        title: "Switch to the weak side",
        body:
          role === "manager"
            ? "We've got the numbers in the middle — open the field with a diagonal switch."
            : "Central density peak detected. Weak-side channel has maximum space. Recommend switching angle or drawing into half-space.",
        priority: "medium",
      });
    }
  }
  return out.slice(0, 3);
}

export function GameApproachWindow() {
  const insights = useDuncStore((s) => s.insights);
  const role = useDuncStore((s) => s.role);
  const suggestions = useMemo(
    () => deriveSuggestions(insights, role),
    [insights, role],
  );

  return (
    <div className="border border-li-border bg-li-black-surface rounded-md">
      <div className="flex items-center justify-between px-3 py-2 border-b border-li-border">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            D-U-N-C
          </div>
          <div className="text-sm font-display text-li-white leading-none mt-0.5">
            Game Approach
          </div>
        </div>
        <span className="text-[10px] font-mono text-li-cyan">LIVE</span>
      </div>
      <div className="p-3 space-y-2">
        {suggestions.length === 0 ? (
          <div className="text-xs text-li-text-muted font-mono">
            No tactical action recommended. Match is stable.
          </div>
        ) : (
          suggestions.map((s) => (
            <div
              key={s.id}
              className="border-l-2 border-li-cyan pl-2 py-1"
            >
              <div className="text-[11px] uppercase tracking-widest text-li-cyan font-mono">
                {s.priority}
              </div>
              <div className="text-[13px] text-li-white font-medium">
                {s.title}
              </div>
              <div className="text-[11px] text-li-text-secondary leading-snug">
                {s.body}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
