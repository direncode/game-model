"use client";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { HistoryFullItem } from "@/hooks/useNIVData";

const levels = [
  { key: "normal", label: "NRM", color: "bg-emerald-500", ring: "ring-emerald-500/50", text: "text-emerald-400" },
  { key: "elevated", label: "ELV", color: "bg-amber-500", ring: "ring-amber-500/50", text: "text-amber-400" },
  { key: "warning", label: "WRN", color: "bg-orange-500", ring: "ring-orange-500/50", text: "text-orange-400" },
  { key: "critical", label: "CRT", color: "bg-red-500", ring: "ring-red-500/50", text: "text-red-400" },
];

const alertDot: Record<string, string> = {
  normal: "bg-emerald-500", elevated: "bg-amber-500",
  warning: "bg-orange-500", critical: "bg-red-500",
};

export function AlertStateMachine({ currentLevel, history }: {
  currentLevel: string;
  history: HistoryFullItem[];
}) {
  const recentAlerts = useMemo(() => {
    return history.slice(-12).map(h => h.alert_level);
  }, [history]);

  return (
    <div className="border-b border-li-gray-900 px-3 py-2">
      <div className="text-[8px] uppercase tracking-wider text-li-text-muted mb-1.5">Alert State</div>
      {/* State machine */}
      <div className="flex items-center justify-around">
        {levels.map((l, i) => {
          const active = l.key === currentLevel;
          return (
            <div key={l.key} className="flex items-center gap-1">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center transition-all",
                active ? cn(l.color, "ring-2", l.ring, "animate-pulse") : "bg-li-gray-900",
              )}>
                <span className={cn("text-[6px] font-bold", active ? "text-white" : "text-li-text-muted")}>
                  {l.label}
                </span>
              </div>
              {i < levels.length - 1 && (
                <div className="w-3 h-px bg-li-gray-700" />
              )}
            </div>
          );
        })}
      </div>
      {/* Recent 12-month timeline */}
      <div className="flex gap-0.5 mt-2 justify-center">
        {recentAlerts.map((level, i) => (
          <div key={i} className={cn("w-2 h-2 rounded-full", alertDot[level] || "bg-li-gray-800")}
            title={`${history[history.length - 12 + i]?.date?.slice(0,7) || ""}: ${level}`} />
        ))}
      </div>
      <div className="flex justify-between text-[6px] text-li-text-muted mt-0.5 px-2">
        <span>-12m</span>
        <span>now</span>
      </div>
    </div>
  );
}
