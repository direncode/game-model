"use client";
import { cn } from "@/lib/utils";
import type { HistoryFullItem } from "@/hooks/useNIVData";

const alertColors: Record<string, string> = {
  normal: "border-emerald-500/40", elevated: "border-amber-500/40",
  warning: "border-orange-500/40", critical: "border-red-500/40",
};

export function NIVMonthDossier({
  month, thesis, onClose,
}: {
  month: HistoryFullItem;
  thesis?: string;
  onClose: () => void;
}) {
  const border = alertColors[month.alert_level] || "border-li-gray-800";
  return (
    <div className={cn("fixed bottom-0 left-60 right-0 z-50 bg-li-black/98 border-t-2", border, "backdrop-blur-sm")}
      style={{ height: "40vh" }}>
      <div className="h-full overflow-y-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-bold text-white">{month.date.slice(0, 7)}</span>
            <span className={cn("text-xs font-mono px-2 py-0.5 rounded",
              month.niv_score >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            )}>
              NIV {month.niv_score >= 0 ? "+" : ""}{month.niv_score.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-li-text-muted">
              P(rec) = {(month.recession_probability * 100).toFixed(1)}%
            </span>
          </div>
          <button onClick={onClose}
            className="text-li-text-muted hover:text-white text-sm px-2 py-1 rounded hover:bg-white/5">
            x
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Component breakdown */}
          <div>
            <div className="text-[8px] uppercase tracking-wider text-li-text-muted mb-2">Components</div>
            <div className="space-y-1.5 text-[10px] font-mono">
              {[
                { label: "Thrust", value: month.thrust, color: "text-blue-400" },
                { label: "Efficiency\u00B2", value: month.efficiency_squared, color: "text-violet-400" },
                { label: "Slack", value: month.slack, color: "text-teal-400" },
                { label: "Drag (total)", value: month.drag_total, color: "text-red-400" },
                { label: "  Spread", value: month.drag_spread, color: "text-red-400/70" },
                { label: "  Real Rate", value: month.drag_real_rate, color: "text-orange-400/70" },
                { label: "  Volatility", value: month.drag_vol, color: "text-amber-400/70" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-li-text-muted">{label}</span>
                  <span className={color}>{value.toFixed(6)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Position guidance */}
          <div>
            <div className="text-[8px] uppercase tracking-wider text-li-text-muted mb-2">Position</div>
            <div className="text-[10px] font-mono">
              <div className="flex justify-between mb-1">
                <span className="text-li-text-muted">Alert</span>
                <span className={cn(
                  month.alert_level === "critical" ? "text-red-400" :
                  month.alert_level === "warning" ? "text-orange-400" :
                  month.alert_level === "elevated" ? "text-amber-400" : "text-emerald-400"
                )}>{month.alert_level.toUpperCase()}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-li-text-muted">Equity Alloc</span>
                <span className="text-white">{(month.dollar_stakes * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 bg-li-gray-900 rounded-full overflow-hidden mt-1">
                <div className={cn("h-full rounded-full",
                  month.dollar_stakes >= 0.7 ? "bg-emerald-500" :
                  month.dollar_stakes >= 0.3 ? "bg-amber-500" : "bg-red-500"
                )} style={{ width: `${month.dollar_stakes * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Investment thesis */}
          <div>
            <div className="text-[8px] uppercase tracking-wider text-li-text-muted mb-2">Thesis</div>
            {thesis ? (
              <p className="text-[10px] text-li-text-secondary leading-relaxed">{thesis}</p>
            ) : (
              <p className="text-[10px] text-li-text-muted italic">Click "Generate" to produce thesis for this month</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
