"use client";

interface Props {
  maxDivergence: number | null;
  sourcesAgree: boolean;
  confidence: "high" | "medium" | "low";
}

export function DivergenceIndicator({ maxDivergence, sourcesAgree, confidence }: Props) {
  const confColors = { high: "text-emerald-400", medium: "text-amber-400", low: "text-rose-400" };
  const confBg = { high: "bg-emerald-400/10", medium: "bg-amber-400/10", low: "bg-rose-400/10" };

  return (
    <div className="flex items-center gap-3">
      <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${confBg[confidence]} ${confColors[confidence]}`}>
        {confidence}
      </span>
      {sourcesAgree ? (
        <span className="text-[10px] font-mono text-emerald-400">Sources agree</span>
      ) : (
        <span className="text-[10px] font-mono text-amber-400">
          Divergence: {maxDivergence ? (maxDivergence * 100).toFixed(1) : "?"}%
        </span>
      )}
    </div>
  );
}
