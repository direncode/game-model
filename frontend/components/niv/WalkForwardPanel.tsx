"use client";
import { cn } from "@/lib/utils";
import type { WalkForwardResult } from "@/hooks/useNIVData";

function AUCGauge({ value, horizon, brier, f1 }: { value: number; horizon: number; brier: number; f1: number }) {
  const r = 16; const circ = 2 * Math.PI * r; const dash = circ * 0.75;
  const offset = dash * (1 - value);
  const color = value >= 0.75 ? "#3fb950" : value >= 0.65 ? "#d29922" : "#f85149";
  return (
    <div className="flex flex-col items-center">
      <svg width="40" height="28" viewBox="0 0 40 28">
        <circle cx="20" cy="22" r={r} fill="none" stroke="#1a1a1a" strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset="0"
          transform="rotate(135 20 22)" strokeLinecap="round" />
        <circle cx="20" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={offset}
          transform="rotate(135 20 22)" strokeLinecap="round" />
        <text x="20" y="20" textAnchor="middle" fill="white" fontSize="8" fontFamily="JetBrains Mono" fontWeight="bold">
          {value.toFixed(2)}
        </text>
      </svg>
      <span className="text-[7px] font-mono text-li-text-muted">{horizon}m</span>
      <div className="text-[6px] font-mono text-li-text-muted leading-none mt-0.5">
        B:{brier.toFixed(2)} F1:{f1.toFixed(2)}
      </div>
    </div>
  );
}

export function WalkForwardPanel({
  data, onRun, loading,
}: {
  data?: WalkForwardResult | null;
  onRun: () => void;
  loading: boolean;
}) {
  return (
    <div className="border-b border-li-gray-900 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[8px] uppercase tracking-wider text-li-text-muted">Walk-Forward OOS</div>
        <button onClick={onRun} disabled={loading}
          className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-li-cyan/10 text-li-cyan border border-li-cyan/20 hover:bg-li-cyan/20 disabled:opacity-50">
          {loading ? "Running..." : data ? "Re-run" : "Run"}
        </button>
      </div>
      {data ? (
        <>
          <div className="flex items-center justify-around">
            {data.horizons.map(h => (
              <AUCGauge
                key={h}
                value={data.auc_by_horizon[String(h)] ?? 0.5}
                horizon={h}
                brier={data.brier_by_horizon[String(h)] ?? 0.25}
                f1={data.f1_by_horizon[String(h)] ?? 0}
              />
            ))}
          </div>
          <div className="text-[7px] text-li-text-muted text-center mt-1 font-mono">
            {data.n_folds} folds | {data.n_skipped} skipped
          </div>
        </>
      ) : (
        <div className="text-[9px] text-li-text-muted text-center py-2">
          Run walk-forward to see AUC by horizon
        </div>
      )}
    </div>
  );
}
