"use client";
import { cn } from "@/lib/utils";
import type { OrthogonalResult } from "@/hooks/useNIVData";

function Donut({ fraction, size = 44 }: { fraction: number; size?: number }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const filled = circ * fraction;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a1a" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#00d4ff" strokeWidth="4"
        strokeDasharray={`${filled} ${circ}`} strokeDashoffset={circ * 0.25}
        strokeLinecap="round" className="transition-all duration-500" />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold">
        {(fraction * 100).toFixed(0)}%
      </text>
    </svg>
  );
}

export function OrthogonalVariancePanel({
  data, onCompute, loading,
}: {
  data?: OrthogonalResult | null;
  onCompute: () => void;
  loading: boolean;
}) {
  return (
    <div className="border-b border-li-gray-900 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[8px] uppercase tracking-wider text-li-text-muted">Orthogonal Variance</div>
        {!data && (
          <button onClick={onCompute} disabled={loading}
            className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-li-cyan/10 text-li-cyan border border-li-cyan/20 hover:bg-li-cyan/20 disabled:opacity-50">
            {loading ? "..." : "Compute"}
          </button>
        )}
      </div>
      {data ? (
        <div className="flex items-center gap-3">
          <Donut fraction={data.fraction} />
          <div className="flex-1">
            <div className="text-[9px] text-li-text-secondary">
              <span className="text-white font-mono font-bold">{(data.fraction * 100).toFixed(1)}%</span> independent from {data.benchmark_series}
            </div>
            <div className="text-[7px] text-li-text-muted font-mono">
              95% CI: [{(data.ci_95[0] * 100).toFixed(1)}, {(data.ci_95[1] * 100).toFixed(1)}]%
            </div>
            {/* Per-lag beta bars */}
            <div className="flex items-end gap-0.5 mt-1 h-4">
              {Object.entries(data.betas).map(([lag, beta]) => {
                const maxBeta = Math.max(...Object.values(data.betas).map(Math.abs), 0.01);
                const h = (Math.abs(beta) / maxBeta) * 16;
                return (
                  <div key={lag} className="flex flex-col items-center" style={{ width: 8 }}>
                    <div className={cn("rounded-sm", beta > 0 ? "bg-li-cyan/60" : "bg-red-400/60")}
                      style={{ height: h, width: 5 }} />
                  </div>
                );
              })}
            </div>
            <div className="text-[6px] text-li-text-muted font-mono">lag 0..6</div>
            <div className="text-[7px] text-li-text-muted mt-0.5">{data.n_obs} obs</div>
          </div>
        </div>
      ) : (
        <div className="text-[9px] text-li-text-muted">Click compute to analyze independence from yield curve</div>
      )}
    </div>
  );
}
