"use client";

import type { MatchPrediction } from "@/lib/dunc/types";
import { TripleLayerBars } from "./TripleLayerBars";
import { DivergenceIndicator } from "./DivergenceIndicator";

interface Props {
  prediction: MatchPrediction;
}

export function MatchPredictionCard({ prediction }: Props) {
  const p = prediction;
  const bestOutcome = p.blended.home >= p.blended.away && p.blended.home >= p.blended.draw
    ? p.home_team
    : p.blended.away >= p.blended.draw
      ? p.away_team
      : "Draw";

  return (
    <div className="border border-li-border rounded-md bg-li-black-surface overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-li-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-display text-li-white">{p.home_team}</span>
            <span className="text-sm text-li-text-muted">vs</span>
            <span className="text-lg font-display text-li-white">{p.away_team}</span>
          </div>
          <DivergenceIndicator
            maxDivergence={p.max_divergence}
            sourcesAgree={p.sources_agree}
            confidence={p.confidence}
          />
        </div>
        <div className="text-[10px] font-mono text-li-text-muted mt-1">
          {p.league} &middot; {p.date}
        </div>
      </div>

      {/* Probability Bars */}
      <div className="px-4 py-3">
        <TripleLayerBars
          bookmaker={p.bookmaker}
          polymarket={p.polymarket}
          mlModel={p.ml_model}
          blended={p.blended}
        />
      </div>

      {/* Prediction Summary */}
      <div className="px-4 py-3 border-t border-li-border bg-li-black/30">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
              Prediction
            </span>
            <div className="text-sm font-display text-li-cyan mt-0.5">{bestOutcome}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
              Blended
            </span>
            <div className="text-sm font-mono text-li-white mt-0.5">
              {(Math.max(p.blended.home, p.blended.draw, p.blended.away) * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Claude Report */}
      {p.claude_report && (
        <details className="border-t border-li-border">
          <summary className="px-4 py-2 text-[10px] uppercase tracking-widest text-li-cyan font-mono cursor-pointer hover:bg-li-black/20">
            Claude Analysis
          </summary>
          <div className="px-4 py-3 text-sm text-li-text-secondary leading-relaxed whitespace-pre-wrap">
            {p.claude_report}
          </div>
        </details>
      )}
    </div>
  );
}
