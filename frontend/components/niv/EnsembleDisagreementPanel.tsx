"use client";
import { cn } from "@/lib/utils";
import type { EnsembleExplain } from "@/hooks/useNIVData";

function MiniGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(value, 1);
  const r = 16; const circ = 2 * Math.PI * r; const dash = circ * 0.75;
  const offset = dash * (1 - pct);
  return (
    <div className="flex flex-col items-center">
      <svg width="40" height="28" viewBox="0 0 40 28">
        <circle cx="20" cy="22" r={r} fill="none" stroke="#1a1a1a" strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset="0"
          transform="rotate(135 20 22)" strokeLinecap="round" />
        <circle cx="20" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={offset}
          transform="rotate(135 20 22)" strokeLinecap="round" />
        <text x="20" y="22" textAnchor="middle" fill="white" fontSize="8" fontFamily="JetBrains Mono" fontWeight="bold">
          {(value * 100).toFixed(0)}
        </text>
      </svg>
      <span className="text-[7px] uppercase tracking-wider text-li-text-muted">{label}</span>
    </div>
  );
}

export function EnsembleDisagreementPanel({ data }: { data?: EnsembleExplain | null }) {
  if (!data) return (
    <div className="border-b border-li-gray-900 px-3 py-2">
      <div className="text-[8px] uppercase tracking-wider text-li-text-muted">Ensemble</div>
      <div className="text-[10px] text-li-text-muted mt-1">Loading...</div>
    </div>
  );

  const { per_learner, disagreement } = data;
  const disagColor = disagreement < 0.10 ? "bg-emerald-500" : disagreement < 0.25 ? "bg-amber-500" : "bg-red-500";
  const disagText = disagreement < 0.10 ? "text-emerald-400" : disagreement < 0.25 ? "text-amber-400" : "text-red-400";
  const disagLabel = disagreement < 0.10 ? "CONSENSUS" : disagreement < 0.25 ? "MODERATE" : "HIGH DISAGREEMENT";

  return (
    <div className="border-b border-li-gray-900 px-3 py-2">
      <div className="text-[8px] uppercase tracking-wider text-li-text-muted mb-1.5">Ensemble Learners</div>
      <div className="flex items-center justify-around">
        <MiniGauge value={per_learner.lr ?? 0.5} label="LR" color="#388bfd" />
        <MiniGauge value={per_learner.ada ?? 0.5} label="ADA" color="#3fb950" />
        <MiniGauge value={per_learner.mlp ?? 0.5} label="MLP" color="#a371f7" />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[7px] text-li-text-muted uppercase">Disagreement</span>
        <div className="flex-1 h-1.5 bg-li-gray-900 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full", disagColor)} style={{ width: `${Math.min(disagreement * 400, 100)}%` }} />
        </div>
        <span className={cn("text-[8px] font-mono", disagText)}>{(disagreement * 100).toFixed(0)}pp</span>
      </div>
      <div className={cn("text-[7px] uppercase tracking-wider mt-0.5 text-center", disagText)}>{disagLabel}</div>
    </div>
  );
}
