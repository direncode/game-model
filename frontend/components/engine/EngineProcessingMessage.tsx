"use client";

import React from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useEngineStore } from "@/stores/engine";

export default function EngineProcessingMessage() {
  const {
    engineStatus,
    currentEpoch,
    totalEpochs,
    metrics,
    progress,
    activeDatasetName,
  } = useEngineStore();

  const isComplete = engineStatus === "converged" || engineStatus === "error" || engineStatus === "idle";
  const progressPercent = isComplete ? 100 : Math.round(progress * 100);

  if (isComplete) {
    return (
      <div className="flex items-center gap-2 py-1">
        <CheckCircle2 className="w-4 h-4 text-green-400" />
        <p className="text-sm text-li-text-secondary">
          Analysis complete
          {totalEpochs > 0 && (
            <span className="text-li-text-muted">
              {" "}&mdash; {totalEpochs} epochs
              {metrics.loss > 0 && `, loss ${metrics.loss.toFixed(3)}`}
            </span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-li-cyan animate-spin" />
        <p className="text-sm font-medium text-white">
          Analyzing {activeDatasetName || "dataset"}...
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-li-text-muted font-mono">
            Epoch {currentEpoch}/{totalEpochs || "?"}
          </p>
          <p className="text-xs text-li-text-muted">
            {metrics.estimatedTimeRemaining > 0
              ? `~${Math.ceil(metrics.estimatedTimeRemaining / 60)}m remaining`
              : progressPercent > 0
                ? `${progressPercent}%`
                : "Starting..."}
          </p>
        </div>
        <div className="w-full h-1.5 bg-li-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-li-cyan rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(progressPercent, 2)}%` }}
          />
        </div>
      </div>

      {metrics.loss > 0 && (
        <div className="flex items-center gap-4 text-xs text-li-text-muted font-mono">
          <span>Loss: <span className="text-white">{metrics.loss.toFixed(4)}</span></span>
          <span>AUC: <span className="text-white">{(metrics.linkAuc * 100).toFixed(1)}%</span></span>
          {metrics.gpuUtilization > 0 && (
            <span>GPU: <span className="text-white">{Math.round(metrics.gpuUtilization)}%</span></span>
          )}
        </div>
      )}
    </div>
  );
}
