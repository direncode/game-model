"use client";

export function DragWaterfallChart({ spread, realRate, vol, total }: {
  spread: number; realRate: number; vol: number; total: number;
}) {
  const sum = spread + realRate + vol || 0.001;
  const pctSpread = (spread / sum) * 100;
  const pctRate = (realRate / sum) * 100;
  const pctVol = (vol / sum) * 100;

  return (
    <div className="border-b border-li-gray-900 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[8px] uppercase tracking-wider text-li-text-muted">Drag Decomposition</div>
        <span className="text-[8px] font-mono text-red-400">{total.toFixed(5)}</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-li-gray-900">
        <div className="bg-red-500/70 transition-all" style={{ width: `${pctSpread}%` }}
          title={`Spread: ${spread.toFixed(5)} (${pctSpread.toFixed(0)}%)`} />
        <div className="bg-orange-500/70 transition-all" style={{ width: `${pctRate}%` }}
          title={`Real Rate: ${realRate.toFixed(5)} (${pctRate.toFixed(0)}%)`} />
        <div className="bg-amber-500/70 transition-all" style={{ width: `${pctVol}%` }}
          title={`Volatility: ${vol.toFixed(5)} (${pctVol.toFixed(0)}%)`} />
      </div>
      <div className="flex justify-between mt-0.5 text-[7px] font-mono">
        <span className="text-red-400">Spread {spread.toFixed(4)}</span>
        <span className="text-orange-400">Rate {realRate.toFixed(4)}</span>
        <span className="text-amber-400">Vol {vol.toFixed(4)}</span>
      </div>
    </div>
  );
}
