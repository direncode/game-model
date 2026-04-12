"use client";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { EnsembleExplain } from "@/hooks/useNIVData";

export function FeatureImportancePanel({ data }: { data?: EnsembleExplain | null }) {
  const sorted = useMemo(() => {
    if (!data?.lr_coefficients) return [];
    return Object.entries(data.lr_coefficients)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));
  }, [data]);

  if (!sorted.length) return (
    <div className="border-b border-li-gray-900 px-3 py-2">
      <div className="text-[8px] uppercase tracking-wider text-li-text-muted">Feature Importance (LR)</div>
      <div className="text-[10px] text-li-text-muted mt-1">Loading...</div>
    </div>
  );

  const maxAbs = Math.max(...sorted.map(([, v]) => Math.abs(v)), 0.01);

  return (
    <div className="border-b border-li-gray-900 px-3 py-2">
      <div className="text-[8px] uppercase tracking-wider text-li-text-muted mb-1">Feature Importance (LR Coefficients)</div>
      <div className="space-y-0.5">
        {sorted.map(([name, coef]) => {
          const pct = (Math.abs(coef) / maxAbs) * 100;
          const isPos = coef > 0;
          return (
            <div key={name} className="flex items-center gap-1">
              <span className="text-[7px] font-mono text-li-text-muted w-[72px] text-right truncate" title={name}>
                {name.replace(/_/g, " ")}
              </span>
              <div className="flex-1 h-1.5 relative">
                <div className="absolute inset-0 bg-li-gray-900 rounded-full" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-li-gray-700" />
                {isPos ? (
                  <div
                    className="absolute left-1/2 top-0 h-full bg-red-500/70 rounded-r-full"
                    style={{ width: `${pct / 2}%` }}
                  />
                ) : (
                  <div
                    className="absolute top-0 h-full bg-emerald-500/70 rounded-l-full"
                    style={{ width: `${pct / 2}%`, right: "50%" }}
                  />
                )}
              </div>
              <span className={cn("text-[7px] font-mono w-10 text-right",
                isPos ? "text-red-400" : "text-emerald-400"
              )}>
                {coef >= 0 ? "+" : ""}{coef.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[6px] text-li-text-muted mt-0.5 px-[72px]">
        <span>Expansion</span>
        <span>Recession</span>
      </div>
    </div>
  );
}
