"use client";

// ActiveScenarioBanner — persistent strip showing which scenarios are active.
// Stacks multiple scenarios. Shows countdown + affected player count.

import { useDuncStore } from "@/lib/dunc/store";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  high_press: "HIGH PRESS",
  counter_press: "COUNTER-PRESS",
  trap_sideline: "SIDELINE TRAP",
  trap_corner: "CORNER TRAP",
  mid_block: "MID BLOCK",
  low_block: "LOW BLOCK",
  man_mark: "MAN MARK",
  zonal: "ZONAL RESET",
  drop_deep: "DROP DEEP",
  hold_line: "HOLD LINE",
  step_up: "STEP UP",
  under_run: "UNDER-RUN",
  pressing_shift: "PRESSING SHIFT",
  convergence: "CONVERGENCE",
};

export function ActiveScenarioBanner() {
  const scenarios = useDuncStore((s) => s.activeScenarios);

  if (scenarios.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-li-cyan/10 border-b border-li-cyan/20 overflow-x-auto">
      <span className="text-[9px] uppercase tracking-widest text-li-cyan font-mono shrink-0">
        Active
      </span>
      {scenarios.map((sc) => (
        <div
          key={sc.name}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-sm",
            "bg-li-cyan/15 border border-li-cyan/30",
            "animate-pulse-glow motion-reduce:animate-none",
          )}
        >
          <span className="text-[11px] font-mono font-bold text-li-cyan uppercase tracking-wider">
            {LABELS[sc.name] ?? sc.name}
          </span>
          <span className="text-[10px] font-mono text-li-cyan/80 tabular-nums">
            {sc.remaining_sec.toFixed(1)}s
          </span>
          <span className="text-[9px] font-mono text-li-text-muted">
            {sc.affected_count} players
          </span>
          {/* Countdown bar */}
          <div className="w-16 h-1 bg-li-cyan/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-li-cyan transition-all duration-200"
              style={{
                width: `${Math.min(100, (sc.remaining_sec / 12) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
