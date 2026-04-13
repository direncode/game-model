"use client";

// ScenarioControls — demo-only buttons that trigger scripted scenarios.
//
// These are here so a user demoing D-U-N-C can force the three core
// scenarios the brief called out. Production would remove or gate this
// behind a tech-staff-only feature flag.

import { useState } from "react";
import { duncApi } from "@/lib/dunc/api";
import type { DuncScenario } from "@/lib/dunc/types";
import { cn } from "@/lib/utils";

const SCENARIOS: {
  key: DuncScenario;
  label: string;
  hint: string;
  narrative: string;
}[] = [
  {
    key: "under_run",
    label: "01 · Under-run",
    hint: "Accountability — strikers peels, mids caught high",
    narrative:
      "Striker under-ran, then screamed at the midfielders. Fire this to surface the position/velocity evidence the manager needs to show him who was actually at fault.",
  },
  {
    key: "convergence",
    label: "02 · Convergence",
    hint: "Translation — central collapse, staff → manager in one sentence",
    narrative:
      "Technical staff spotted a complex central convergence. Fire this to watch D-U-N-C compress the pattern into one line the manager can act on from the touchline.",
  },
  {
    key: "pressing_shift",
    label: "03 · Pressing shift",
    hint: "Alignment — whole staff onto a new pressing model",
    narrative:
      "Manager wants to change the pressing model mid-half. Fire this to push the new model to every staff screen and align overlays, triggers and twins in one instruction.",
  },
];

export function ScenarioControls({ matchId }: { matchId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [hovered, setHovered] = useState<DuncScenario | null>(null);

  async function fire(scenario: DuncScenario) {
    setBusy(scenario);
    try {
      await duncApi.trigger(matchId, scenario);
    } catch (e) {
      // swallow — UI already feels responsive enough that a silent failure
      // is acceptable for a demo panel. Surface via a toast later.
      console.error("dunc: scenario trigger failed", e);
    } finally {
      setTimeout(() => setBusy(null), 400);
    }
  }

  const active = SCENARIOS.find((s) => s.key === hovered) ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => fire(s.key)}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(s.key)}
            onBlur={() => setHovered(null)}
            title={s.hint}
            className={cn(
              "px-2 py-1 text-[10px] font-mono uppercase tracking-wider",
              "border border-li-border rounded-sm bg-li-black-surface",
              "hover:border-li-cyan hover:text-li-cyan transition-colors",
              busy === s.key && "border-li-cyan text-li-cyan",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {active && (
        <div className="text-[10px] text-li-text-secondary leading-snug max-w-md">
          <span className="text-li-cyan font-mono">{active.hint}.</span>{" "}
          {active.narrative}
        </div>
      )}
    </div>
  );
}
