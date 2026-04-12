"use client";
import { cn } from "@/lib/utils";
import type { ProtocolDResult } from "@/hooks/useNIVData";

export function ProtocolDStrip({
  data, onRun, loading,
}: {
  data?: ProtocolDResult | null;
  onRun: () => void;
  loading: boolean;
}) {
  return (
    <div className="border-b border-li-gray-900 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[8px] uppercase tracking-wider text-li-text-muted">Protocol D (Frozen Forward)</div>
        <button onClick={onRun} disabled={loading}
          className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-li-purple/10 text-li-purple border border-li-purple/20 hover:bg-li-purple/20 disabled:opacity-50">
          {loading ? "..." : data ? "Re-run" : "Run"}
        </button>
      </div>
      {data ? (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[7px] text-li-text-muted font-mono">Freeze: {data.freeze_date.slice(0, 7)}</span>
            <span className="text-[7px] text-li-text-muted font-mono">|</span>
            <span className="text-[7px] text-li-text-muted font-mono">{data.n_forward_months} months fwd</span>
            <span className="text-[7px] text-li-text-muted font-mono">|</span>
            <span className="text-[7px] text-li-text-muted font-mono">{data.n_retrain} retrains</span>
          </div>
          <div className="flex gap-1.5">
            {Object.entries(data.auc_by_horizon).map(([h, auc]) => {
              const color = auc >= 0.65 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : auc > 0.5 ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-li-gray-900 text-li-text-muted border-li-gray-800";
              return (
                <span key={h} className={cn("text-[7px] font-mono px-1.5 py-0.5 rounded border", color)}>
                  {h}m: {auc.toFixed(2)}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-[9px] text-li-text-muted">Freeze model at 2022-12, predict forward with zero retraining</div>
      )}
    </div>
  );
}
