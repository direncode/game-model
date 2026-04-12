"use client";

import { useTCDStore } from "@/lib/tcd/store";

const DIM_COLORS = ["#00d4ff", "#a855f7", "#f59e0b"];
const DIM_LABELS = ["H0 (clusters)", "H1 (cycles)", "H2 (voids)"];

export default function TopologyViz() {
  const intelligence = useTCDStore((s) => s.intelligence);
  const topoInsights = intelligence.topological || [];

  // Collect persistence bars from insights
  const bars: { dim: number; birth: number; death: number }[] = [];
  for (const ins of topoInsights) {
    if (ins.persistence_bars) {
      bars.push(...ins.persistence_bars);
    }
  }

  if (bars.length === 0) {
    return (
      <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg p-4 h-40 flex items-center justify-center text-li-text-muted text-sm">
        Persistence barcode will appear after crystallization
      </div>
    );
  }

  const maxDeath = Math.max(...bars.map((b) => b.death), 1);

  return (
    <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg p-4">
      <h3 className="text-[10px] uppercase tracking-widest text-li-text-muted mb-3">
        Persistence Barcode
      </h3>
      <div className="space-y-1.5">
        {bars.map((bar, i) => {
          const left = (bar.birth / maxDeath) * 100;
          const width = ((bar.death - bar.birth) / maxDeath) * 100;
          return (
            <div key={i} className="flex items-center gap-2 h-4">
              <span className="text-[8px] font-mono w-6 text-right" style={{ color: DIM_COLORS[bar.dim] || "#666" }}>
                H{bar.dim}
              </span>
              <div className="flex-1 relative h-2 bg-li-gray-800/50 rounded-full overflow-hidden">
                <div
                  className="absolute h-full rounded-full opacity-80"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 1)}%`,
                    backgroundColor: DIM_COLORS[bar.dim] || "#666",
                  }}
                />
              </div>
              <span className="text-[8px] font-mono text-li-text-muted w-16">
                [{bar.birth.toFixed(2)}, {bar.death.toFixed(2)}]
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3">
        {DIM_LABELS.map((label, i) => (
          <span key={i} className="text-[8px] flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DIM_COLORS[i] }} />
            <span className="text-li-text-muted">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
