"use client";
import { cn } from "@/lib/utils";
import type { NIVLatest, NIVHealth } from "@/hooks/useNIVData";

function StatCell({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="px-3 py-1.5 min-w-[70px]">
      <div className="text-[8px] uppercase tracking-[0.1em] text-li-text-muted leading-none mb-0.5">{label}</div>
      <div className={cn("text-[11px] font-mono font-bold leading-none", color || "text-white")}>
        {typeof value === "number" ? value.toFixed(4) : value}
      </div>
    </div>
  );
}

const alertTextColor: Record<string, string> = {
  normal: "text-emerald-400", elevated: "text-amber-400",
  warning: "text-orange-400", critical: "text-red-400",
};

export function NIVStatusBar({
  latest, health, playing, onTogglePlay,
}: {
  latest?: NIVLatest | null; health?: NIVHealth | null;
  playing: boolean; onTogglePlay: () => void;
}) {
  const l = latest;
  return (
    <div className="border-b border-li-gray-900 bg-li-black flex items-center justify-between px-2">
      <div className="flex items-center gap-0.5 divide-x divide-li-gray-800 overflow-x-auto">
        <StatCell label="NIV" value={l ? (l.niv_score >= 0 ? "+" : "") + l.niv_score.toFixed(1) : "—"} color="text-li-cyan" />
        <StatCell label="P(rec)" value={l ? (l.recession_probability * 100).toFixed(1) + "%" : "—"} color={l && l.recession_probability > 0.5 ? "text-red-400" : "text-emerald-400"} />
        <StatCell label="Alert" value={l?.alert.level.toUpperCase() || "—"} color={alertTextColor[l?.alert.level || "normal"]} />
        <StatCell label="Thrust" value={l?.components.thrust ?? 0} />
        <StatCell label="Eff\u00B2" value={l?.components.efficiency_squared ?? 0} />
        <StatCell label="Slack" value={l?.components.slack ?? 0} />
        <StatCell label="Drag" value={l?.components.drag_total ?? 0} />
        <StatCell label="Spread" value={l?.components.drag_spread ?? 0} color="text-red-400" />
        <StatCell label="Real Rate" value={l?.components.drag_real_rate ?? 0} color="text-orange-400" />
        <StatCell label="Vol" value={l?.components.drag_vol ?? 0} color="text-amber-400" />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        <button
          onClick={onTogglePlay}
          className="px-2 py-1 rounded text-[9px] font-mono bg-li-cyan/10 text-li-cyan border border-li-cyan/20 hover:bg-li-cyan/20"
        >
          {playing ? "\u23F8 Pause" : "\u25B6 Play"}
        </button>
        {health?.vintage && (
          <span className="text-[9px] font-mono text-li-text-muted">{health.vintage}</span>
        )}
        <div className={cn("w-2 h-2 rounded-full", health?.fred_api_key_set ? "bg-li-green animate-pulse" : "bg-li-red")} />
        <span className="text-[9px] font-mono text-li-green uppercase tracking-wider">
          {health?.fred_api_key_set ? "FRED" : "No Key"}
        </span>
      </div>
    </div>
  );
}
