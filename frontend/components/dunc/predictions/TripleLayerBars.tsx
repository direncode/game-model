"use client";

import type { ProbabilitySet } from "@/lib/dunc/types";

interface Props {
  bookmaker: ProbabilitySet;
  polymarket: ProbabilitySet | null;
  mlModel: ProbabilitySet;
  blended: ProbabilitySet;
}

function ProbBar({ label, probs, color }: { label: string; probs: ProbabilitySet; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
        <span className="text-li-text-muted">{label}</span>
        <div className="flex gap-3 text-li-text-secondary">
          <span>H {(probs.home * 100).toFixed(0)}%</span>
          <span>D {(probs.draw * 100).toFixed(0)}%</span>
          <span>A {(probs.away * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-li-black-surface">
        <div className="bg-emerald-500" style={{ width: `${probs.home * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${probs.draw * 100}%` }} />
        <div className="bg-rose-500" style={{ width: `${probs.away * 100}%` }} />
      </div>
    </div>
  );
}

export function TripleLayerBars({ bookmaker, polymarket, mlModel, blended }: Props) {
  return (
    <div className="space-y-3">
      <ProbBar label="Bookmaker" probs={bookmaker} color="#3498db" />
      {polymarket && <ProbBar label="Polymarket" probs={polymarket} color="#e74c3c" />}
      <ProbBar label="ML Model" probs={mlModel} color="#2ecc71" />
      <div className="border-t border-li-border pt-2">
        <ProbBar label="Blended" probs={blended} color="#9b59b6" />
      </div>
    </div>
  );
}
