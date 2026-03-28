"use client";

import { useEffect } from "react";
import { useEngineStore } from "@/stores/engine";
import { useAppStore } from "@/stores/app";
import EngineConsoleVisualization from "@/components/engine/EngineConsoleVisualization";
import EngineStatusHeader from "@/components/engine/EngineStatusHeader";
import EngineMetricsRow from "@/components/engine/EngineMetricsRow";
import EngineQuickLaunch from "@/components/engine/EngineQuickLaunch";
import EngineResultsFeed from "@/components/engine/EngineResultsFeed";

export default function EngineConsolePage() {
  const { activeDatasetId, activeJobId, engineStatus, hydrateFromLastJob } = useEngineStore();
  const { token } = useAppStore();

  // Hydrate engine state on mount (reconnect to running job if any)
  useEffect(() => {
    if (activeDatasetId && activeJobId && engineStatus === "processing") {
      hydrateFromLastJob(activeDatasetId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-li-bg">
      {/* Engine Header */}
      <EngineStatusHeader />

      {/* Main Visualization */}
      <div className="relative" style={{ height: "55vh", minHeight: "400px" }}>
        <EngineConsoleVisualization />
      </div>

      {/* Metrics Row */}
      <div className="px-6 -mt-4 relative z-10">
        <EngineMetricsRow />
      </div>

      {/* Bottom Section: Quick Launch + Results */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Quick Launch (2 cols) */}
          <div className="lg:col-span-2">
            <EngineQuickLaunch />
          </div>

          {/* Right: Results Feed (3 cols) */}
          <div className="lg:col-span-3">
            <EngineResultsFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
