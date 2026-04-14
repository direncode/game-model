"use client";

// TwinCard — compact metric card for a single player.
//
// Shows: shirt number, role, current speed, distance, fatigue, sprint count
// style indicator. Used in the "squad rail" on the right of the dashboard.

import type { DuncPlayerTick } from "@/lib/dunc/types";
import { cn } from "@/lib/utils";

export function TwinCard({
  player,
  selected,
  onSelect,
}: {
  player: DuncPlayerTick;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const teamBand =
    player.team === "home"
      ? "border-l-li-cyan"
      : "border-l-li-warm";
  const fatigueBar =
    player.fatigue > 0.66
      ? "bg-li-red"
      : player.fatigue > 0.33
        ? "bg-li-yellow"
        : "bg-li-green";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(player.id)}
      className={cn(
        "w-full text-left bg-li-black-surface border border-li-border rounded-md px-2.5 py-2",
        "hover:border-li-border-accent transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black",
        "border-l-2",
        teamBand,
        selected && "ring-1 ring-li-cyan/60 border-li-cyan/50",
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-li-white font-bold leading-none">
            #{player.number}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-li-text-secondary">
            {player.role}
          </span>
        </div>
        <span className="font-mono text-[10px] text-li-text-muted">
          {player.zone}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono text-li-text-secondary">
        <div>
          <div className="text-li-white text-[11px] leading-none">
            {player.speed.toFixed(1)}
          </div>
          <div className="uppercase tracking-widest">m/s</div>
        </div>
        <div>
          <div className="text-li-white text-[11px] leading-none">
            {(player.distance_m / 1000).toFixed(1)}
          </div>
          <div className="uppercase tracking-widest">km</div>
        </div>
        <div>
          <div className="text-li-white text-[11px] leading-none">
            {(player.fatigue * 100).toFixed(0)}
          </div>
          <div className="uppercase tracking-widest">fat</div>
        </div>
      </div>

      <div className="mt-1.5 h-1 rounded-full bg-li-gray-900 overflow-hidden">
        <div
          className={cn("h-full transition-all duration-700", fatigueBar)}
          style={{ width: `${Math.min(player.fatigue * 100, 100)}%` }}
        />
      </div>
    </button>
  );
}
