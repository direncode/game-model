"use client";

import type { ModelStatus } from "@/lib/dunc/types";

interface Props {
  status: ModelStatus | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ModelStatusPanel({ status, onRefresh, refreshing }: Props) {
  if (!status) return null;

  return (
    <div className="border border-li-border rounded-md p-4 bg-li-black-surface">
      <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-3">
        Model Status
      </div>
      <div className="space-y-2 text-sm font-mono">
        <div className="flex justify-between">
          <span className="text-li-text-secondary">Status</span>
          <span className={status.status === "ready" ? "text-emerald-400" : "text-amber-400"}>
            {status.status}
          </span>
        </div>
        {status.accuracy != null && (
          <div className="flex justify-between">
            <span className="text-li-text-secondary">Accuracy</span>
            <span className="text-li-white">{(status.accuracy * 100).toFixed(1)}%</span>
          </div>
        )}
        {status.matches_in_dataset > 0 && (
          <div className="flex justify-between">
            <span className="text-li-text-secondary">Matches</span>
            <span className="text-li-white">{status.matches_in_dataset.toLocaleString()}</span>
          </div>
        )}
        {status.leagues.length > 0 && (
          <div className="flex justify-between">
            <span className="text-li-text-secondary">Leagues</span>
            <span className="text-li-white">{status.leagues.length}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="mt-3 w-full py-1.5 text-[10px] uppercase tracking-widest font-mono border border-li-border rounded-sm hover:border-li-cyan disabled:opacity-50 transition-colors"
      >
        {refreshing ? "Refreshing..." : "Refresh Model"}
      </button>
    </div>
  );
}
