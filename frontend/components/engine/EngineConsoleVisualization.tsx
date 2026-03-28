"use client";

import { EngineSimulation } from "@/components/landing/EngineSimulation";
import { useEngineStore } from "@/stores/engine";

/**
 * EngineConsoleVisualization — wraps the EngineSimulation canvas
 * and overrides its internal demo state with real engine store data
 * when in "live" mode.
 *
 * For now, the EngineSimulation component is self-contained with demo data.
 * This wrapper provides the real-time overlay: progress-driven stage mapping,
 * live metric display, and a visual connection to the engine store.
 *
 * The EngineSimulation itself handles the canvas rendering. We overlay
 * real metrics on top when the engine is processing.
 */
export default function EngineConsoleVisualization() {
  const {
    engineStatus,
    progress,
    metrics,
    currentEpoch,
    totalEpochs,
    discoveredModules,
  } = useEngineStore();

  // Map engine status to visual overlay
  const isLive = engineStatus === "processing" || engineStatus === "converged";

  return (
    <div className="relative w-full h-full">
      {/* Base visualization — always renders the demo animation */}
      <EngineSimulation />

      {/* Live overlay when engine is active */}
      {isLive && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top-left: Live indicator */}
          <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-li-border">
              <div className={`w-2 h-2 rounded-full ${
                engineStatus === "processing" ? "bg-cyan-400 animate-pulse" : "bg-amber-400"
              }`} />
              <span className="text-xs font-data text-white">
                {engineStatus === "processing" ? "LIVE" : "CONVERGED"}
              </span>
            </div>
          </div>

          {/* Top-right: Real-time metrics overlay */}
          <div className="absolute top-4 right-4 pointer-events-auto">
            <div className="bg-black/70 backdrop-blur-sm border border-li-border rounded-lg p-3 space-y-2 min-w-[180px]">
              {engineStatus === "processing" && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-li-text-muted">Epoch</span>
                    <span className="font-data text-white">
                      {currentEpoch}/{totalEpochs || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-li-text-muted">Loss</span>
                    <span className="font-data text-cyan-400">
                      {metrics.loss > 0 ? metrics.loss.toFixed(4) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-li-text-muted">Link AUC</span>
                    <span className="font-data text-emerald-400">
                      {metrics.linkAuc > 0 ? (metrics.linkAuc * 100).toFixed(1) + "%" : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-li-text-muted">GPU</span>
                    <span className="font-data text-amber-400">
                      {metrics.gpuUtilization > 0 ? metrics.gpuUtilization + "%" : "—"}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 bg-li-bg rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </>
              )}

              {engineStatus === "converged" && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-li-text-muted">Modules</span>
                    <span className="font-data text-white">
                      {discoveredModules.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-li-text-muted">Avg Purity</span>
                    <span className="font-data text-emerald-400">
                      {discoveredModules.length > 0
                        ? (
                            (discoveredModules.reduce((s, m) => s + m.purity_score, 0) /
                              discoveredModules.length) *
                            100
                          ).toFixed(1) + "%"
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-li-text-muted">Link AUC</span>
                    <span className="font-data text-cyan-400">
                      {metrics.linkAuc > 0 ? (metrics.linkAuc * 100).toFixed(1) + "%" : "—"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom: Progress text */}
          {engineStatus === "processing" && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
              <div className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-cyan-500/30">
                <span className="text-sm font-data text-cyan-400">
                  TCD-JEPA is discovering hidden structure... {(progress * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {engineStatus === "converged" && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
              <div className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-amber-500/30">
                <span className="text-sm font-data text-amber-400">
                  TCD-JEPA discovered {discoveredModules.length} modules
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
