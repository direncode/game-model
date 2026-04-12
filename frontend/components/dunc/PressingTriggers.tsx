"use client";

// PressingTriggers — row of one-click tactical nudges.
//
// Ported from the reference repo's TacticControls. The full trigger set is:
//   high_press, counter_press, trap_sideline, trap_corner, mid_block,
//   low_block, man_mark, zonal, drop_deep, hold_line, step_up
// Each corresponds to a scenario the backend simulator knows how to
// realize via anchor shifts (see `services/dunc/simulator.py`).

import { useState } from "react";
import { duncApi } from "@/lib/dunc/api";
import { cn } from "@/lib/utils";

type Trigger = {
  key: string;
  label: string;
  hint: string;
  group: "pressing" | "block" | "marking" | "line";
};

const TRIGGERS: Trigger[] = [
  { key: "high_press", label: "High press", hint: "Push entire line forward", group: "pressing" },
  { key: "counter_press", label: "Counter-press", hint: "Immediate press on loss", group: "pressing" },
  { key: "trap_sideline", label: "Trap sideline", hint: "Funnel to touchline", group: "pressing" },
  { key: "trap_corner", label: "Trap corner", hint: "Collapse on nearest corner", group: "pressing" },
  { key: "mid_block", label: "Mid block", hint: "Compact around halfway", group: "block" },
  { key: "low_block", label: "Low block", hint: "Drop very deep", group: "block" },
  { key: "man_mark", label: "Man mark", hint: "Each home player shadows nearest away", group: "marking" },
  { key: "zonal", label: "Zonal", hint: "Reset to formation", group: "marking" },
  { key: "drop_deep", label: "Drop deep", hint: "Drop 10m", group: "line" },
  { key: "hold_line", label: "Hold line", hint: "Compress back four x", group: "line" },
  { key: "step_up", label: "Step up", hint: "Back line +8m", group: "line" },
];

const GROUP_LABEL: Record<string, string> = {
  pressing: "Press",
  block: "Block",
  marking: "Mark",
  line: "Line",
};

export function PressingTriggers({ matchId }: { matchId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [lastFired, setLastFired] = useState<string | null>(null);

  async function fire(key: string) {
    setBusy(key);
    try {
      await duncApi.trigger(matchId, key as any);
      setLastFired(key);
      setTimeout(() => setLastFired(null), 1800);
    } catch (e) {
      console.error("dunc: trigger failed", e);
    } finally {
      setTimeout(() => setBusy(null), 300);
    }
  }

  const groups = Array.from(new Set(TRIGGERS.map((t) => t.group)));

  return (
    <div className="border border-li-border bg-li-black-surface rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            Tactical triggers
          </div>
          <div className="text-sm font-display text-li-white leading-none mt-0.5">
            Manager console
          </div>
        </div>
        {lastFired && (
          <span className="text-[10px] font-mono text-li-cyan">
            → {lastFired}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g}>
            <div className="text-[9px] uppercase tracking-widest text-li-text-muted font-mono mb-1">
              {GROUP_LABEL[g]}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TRIGGERS.filter((t) => t.group === g).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => fire(t.key)}
                  title={t.hint}
                  className={cn(
                    "px-2 py-1 text-[10px] font-mono uppercase tracking-wider",
                    "border border-li-border rounded-sm bg-li-black-elevated",
                    "hover:border-li-cyan hover:text-li-cyan transition-colors",
                    busy === t.key && "border-li-cyan text-li-cyan",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
