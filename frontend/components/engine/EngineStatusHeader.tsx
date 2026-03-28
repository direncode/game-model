"use client";

import React from "react";
import { Sparkles, X, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEngineStore } from "@/stores/engine";

export default function EngineStatusHeader() {
  const {
    engineStatus,
    progress,
    activeDatasetName,
    startJob,
    cancelJob,
    activeDatasetId,
  } = useEngineStore();

  const statusConfig = {
    idle: {
      dot: "bg-green-400",
      animate: false,
      label: "Ready",
    },
    processing: {
      dot: "bg-cyan-400",
      animate: true,
      label: `Analyzing... ${Math.round(progress * 100)}%`,
    },
    converged: {
      dot: "bg-amber-400",
      animate: false,
      label: "Converged",
    },
    error: {
      dot: "bg-red-400",
      animate: false,
      label: "Error",
    },
  };

  const status = statusConfig[engineStatus];

  return (
    <div className="w-full li-card flex items-center justify-between gap-4 px-6 py-4">
      {/* Left: Title */}
      <div className="flex-shrink-0">
        <h1 className="text-xl font-display font-semibold text-white tracking-tight">
          TCD-JEPA
        </h1>
        <p className="text-xs text-li-text-muted">Engine Console</p>
      </div>

      {/* Center: Status Badge */}
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-li-surface border border-li-border">
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            status.dot,
            status.animate && "animate-pulse"
          )}
        />
        <span className="text-sm font-medium text-li-text-secondary">
          {status.label}
        </span>
      </div>

      {/* Right: Dataset + Action */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {activeDatasetName && (
          <div className="flex items-center gap-1.5 text-sm text-li-text-muted">
            <Database className="w-3.5 h-3.5" />
            <span className="max-w-[160px] truncate">{activeDatasetName}</span>
          </div>
        )}

        {engineStatus === "processing" ? (
          <button
            onClick={() => cancelJob()}
            className="li-btn-secondary flex items-center gap-1.5 text-sm px-4 py-2"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        ) : (
          <button
            onClick={() => {
              if (activeDatasetId && activeDatasetName) {
                startJob(activeDatasetId, activeDatasetName);
              }
            }}
            disabled={!activeDatasetId || engineStatus === "processing"}
            className="li-btn-primary flex items-center gap-1.5 text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask TCD-JEPA
          </button>
        )}
      </div>
    </div>
  );
}
