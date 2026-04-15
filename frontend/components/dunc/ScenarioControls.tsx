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

const SCENARIOS: { key: DuncScenario; label: string; hint: string }[] = [
  { key: "under_run", label: "Under-run", hint: "Striker drops off, mids push" },
  { key: "pressing_shift", label: "High press", hint: "Away block jumps forward" },
  { key: "convergence", label: "Convergence", hint: "Central mids collapse on ball" },
];

export function ScenarioControls({ matchId }: { matchId: string }) {
  const [busy, setBusy] = useState<string | null>(null);

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

  return (
    <div className="flex items-center gap-1.5">
      {SCENARIOS.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => fire(s.key)}
          title={s.hint}
          className={cn(
            "px-2 py-1 text-[10px] font-mono uppercase tracking-wider",
            "border border-li-border rounded-sm bg-li-black-surface",
            "hover:border-li-cyan hover:text-li-cyan transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black",
            busy === s.key && "border-li-cyan text-li-cyan",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
