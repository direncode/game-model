"use client";

import type { FSDDensity, FSDStatus } from "@/lib/fsd-api";
import { Activity, Zap } from "lucide-react";

interface DensityPanelProps {
  density: FSDDensity | undefined;
  status: FSDStatus | undefined;
  isLoading: boolean;
}

function SignalBadge({ name, state }: { name: string; state: string }) {
  const isActive = state === "active" || state === "available";
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-li-gray-900">
      <span className="text-[11px] text-li-gray-400">{name.replace("_", " ")}</span>
      <span
        className={`text-[10px] font-mono uppercase tracking-wider ${
          isActive ? "text-li-green" : state === "no_key" ? "text-li-yellow" : "text-li-red"
        }`}
      >
        {isActive ? "LIVE" : state === "no_key" ? "NO KEY" : "OFF"}
      </span>
    </div>
  );
}

export default function DensityPanel({ density, status, isLoading }: DensityPanelProps) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-li-gray-700 border-t-li-cyan rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-li-border">
        <Activity className="w-4 h-4 text-li-cyan" />
        <h3 className="text-sm font-medium text-white">MFG Engine</h3>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Metrics */}
        <div className="flex-1 p-4 space-y-4">
          <p className="text-[10px] uppercase tracking-wider text-li-text-muted">
            Fokker-Planck Solver
          </p>

          {density && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-li-gray-900 border border-li-border">
                <p className="text-[10px] text-li-text-muted uppercase tracking-wider mb-1">Nash Gap</p>
                <p className="text-xl font-mono font-semibold text-white">
                  {density.nash_gap.toFixed(4)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-li-gray-900 border border-li-border">
                <p className="text-[10px] text-li-text-muted uppercase tracking-wider mb-1">Iterations</p>
                <p className="text-xl font-mono font-semibold text-white">
                  {density.iterations}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-li-gray-900 border border-li-border">
                <p className="text-[10px] text-li-text-muted uppercase tracking-wider mb-1">Grid Size</p>
                <p className="text-xl font-mono font-semibold text-white">
                  {density.grid_size}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-li-gray-900 border border-li-border">
                <p className="text-[10px] text-li-text-muted uppercase tracking-wider mb-1">Converged</p>
                <div className="flex items-center gap-2 mt-1">
                  <Zap className={`w-4 h-4 ${density.converged ? "text-li-green" : "text-li-yellow"}`} />
                  <span className={`text-sm font-mono ${density.converged ? "text-li-green" : "text-li-yellow"}`}>
                    {density.converged ? "YES" : "NO"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {density && (
            <div>
              <p className="text-[10px] text-li-text-muted mb-1">{density.algorithm}</p>
              <p className="text-[10px] font-mono text-li-gray-600 break-all">{density.equation}</p>
            </div>
          )}
        </div>

        {/* Signal feeds */}
        <div className="lg:w-52 p-3 border-t lg:border-t-0 lg:border-l border-li-border overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-li-text-muted mb-2">
            Data Feeds
          </p>
          <div className="space-y-1">
            {status?.data_feeds &&
              Object.entries(status.data_feeds).map(([name, state]) => (
                <SignalBadge key={name} name={name} state={state} />
              ))}
          </div>

          {status && (
            <div className="mt-3 pt-3 border-t border-li-border">
              <p className="text-[10px] text-li-text-muted">Engine v{status.version}</p>
              <p className="text-[10px] text-li-gray-600 mt-0.5">
                {status.surveillance_area.venue_source}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
