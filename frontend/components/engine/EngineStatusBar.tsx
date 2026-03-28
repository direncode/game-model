"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useEngineStore } from "@/stores/engine";

export default function EngineStatusBar() {
  const {
    engineStatus,
    progress,
    currentEpoch,
    totalEpochs,
    discoveredModules,
    lastRunSummary,
  } = useEngineStore();

  const dotColor = {
    idle: "bg-green-400",
    processing: "bg-white animate-pulse",
    converged: "bg-amber-400",
    error: "bg-red-400",
  }[engineStatus];

  const avgPurity =
    discoveredModules.length > 0
      ? Math.round(
          (discoveredModules.reduce((s, m) => s + m.purity_score, 0) /
            discoveredModules.length) *
            100
        )
      : lastRunSummary?.avgPurity ?? 0;

  const moduleCount =
    discoveredModules.length > 0
      ? discoveredModules.length
      : lastRunSummary?.moduleCount ?? 0;

  function renderCenter() {
    switch (engineStatus) {
      case "idle":
        return (
          <span className="text-sm text-li-text-muted">TCD-JEPA ready</span>
        );
      case "processing":
        return (
          <div className="flex items-center gap-3">
            <span className="text-sm text-li-text-secondary">
              TCD-JEPA is analyzing... {Math.round(progress * 100)}% — Epoch{" "}
              {currentEpoch}/{totalEpochs || "?"}
            </span>
            <div className="w-24 h-1 bg-li-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        );
      case "converged":
        return (
          <span className="text-sm text-li-text-secondary">
            TCD-JEPA discovered {moduleCount} modules — {avgPurity}% purity
          </span>
        );
      case "error":
        return (
          <span className="text-sm text-red-400">
            TCD-JEPA encountered an error
          </span>
        );
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-11 z-50 bg-li-surface/95 backdrop-blur-sm border-t border-li-border">
      <div className="h-full max-w-screen-2xl mx-auto px-4 flex items-center justify-between">
        {/* Left: Label + Dot */}
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dotColor)} />
          <span className="text-xs font-medium text-li-text-muted">
            TCD-JEPA
          </span>
        </div>

        {/* Center: Status text */}
        <div className="flex-1 flex justify-center">{renderCenter()}</div>

        {/* Right: Open Console link */}
        <Link
          href="/engine"
          className="text-xs text-white hover:text-li-gray-300 transition-colors font-medium"
        >
          Open Console
        </Link>
      </div>
    </div>
  );
}
