"use client";
import { useMemo } from "react";
import type { HistoryFullItem } from "@/hooks/useNIVData";

function interpolateColor(value: number, min: number, max: number, negColor: string, posColor: string): string {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  // Simple interpolation: low=negColor, mid=dark, high=posColor
  if (t < 0.5) {
    const a = t * 2; // 0..1 within the negative half
    return negColor.replace("1)", `${0.1 + a * 0.5})`);
  }
  const a = (t - 0.5) * 2;
  return posColor.replace("1)", `${0.1 + a * 0.7})`);
}

const rows = [
  { key: "thrust" as const, label: "THR", negColor: "rgba(248,81,73,1)", posColor: "rgba(63,185,80,1)" },
  { key: "efficiency_squared" as const, label: "EFF\u00B2", negColor: "rgba(30,30,30,1)", posColor: "rgba(163,113,247,1)" },
  { key: "slack" as const, label: "SLK", negColor: "rgba(248,81,73,1)", posColor: "rgba(63,185,80,1)" },
  { key: "drag_total" as const, label: "DRG", negColor: "rgba(30,30,30,1)", posColor: "rgba(248,81,73,1)" },
];

export function ComponentHeatmapStrip({ history, brushStart, brushEnd }: {
  history: HistoryFullItem[];
  brushStart?: number;
  brushEnd?: number;
}) {
  const visibleData = useMemo(() => {
    const start = brushStart ?? 0;
    const end = brushEnd ?? history.length;
    return history.slice(start, end);
  }, [history, brushStart, brushEnd]);

  const ranges = useMemo(() => {
    const r: Record<string, { min: number; max: number }> = {};
    for (const row of rows) {
      const vals = history.map(d => d[row.key]);
      r[row.key] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return r;
  }, [history]);

  if (!visibleData.length) return null;

  const cellW = Math.max(1, Math.floor(800 / visibleData.length));
  const rowH = 14;

  return (
    <div className="h-20 border-t border-li-gray-900 flex flex-col overflow-hidden">
      {rows.map(row => (
        <div key={row.key} className="flex items-center">
          <span className="text-[7px] font-mono text-li-text-muted w-6 text-right pr-1 flex-shrink-0">
            {row.label}
          </span>
          <div className="flex-1 flex overflow-hidden" style={{ height: rowH }}>
            {visibleData.map((d, i) => {
              const { min, max } = ranges[row.key];
              const val = d[row.key];
              const t = max === min ? 0.5 : (val - min) / (max - min);
              let opacity: number;
              let hue: string;
              if (row.key === "thrust" || row.key === "slack") {
                // diverging: red (low) → black (mid) → green (high)
                if (t < 0.5) {
                  opacity = (0.5 - t) * 2;
                  hue = "#f85149";
                } else {
                  opacity = (t - 0.5) * 2;
                  hue = "#3fb950";
                }
              } else if (row.key === "efficiency_squared") {
                opacity = t;
                hue = "#a371f7";
              } else {
                // drag: higher = redder
                opacity = t;
                hue = "#f85149";
              }
              return (
                <div
                  key={i}
                  className="flex-1"
                  style={{
                    backgroundColor: hue,
                    opacity: Math.max(0.05, opacity * 0.8),
                    minWidth: 1,
                  }}
                  title={`${d.date.slice(0,7)} ${row.label}: ${val.toFixed(4)}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
