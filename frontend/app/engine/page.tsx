"use client";

import { useEffect } from "react";
import { useEngineStore } from "@/stores/engine";
import EngineChat from "@/components/engine/EngineChat";
import EngineChatInput from "@/components/engine/EngineChatInput";

export default function EngineConsolePage() {
  const { activeDatasetId, activeJobId, engineStatus, hydrateFromLastJob } =
    useEngineStore();

  // Hydrate engine state on mount (reconnect to running job if any)
  useEffect(() => {
    if (activeDatasetId && activeJobId && engineStatus === "processing") {
      hydrateFromLastJob(activeDatasetId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen flex flex-col bg-li-bg">
      {/* Minimal header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-li-border flex-shrink-0">
        <div>
          <h1 className="text-lg font-display font-semibold text-white tracking-tight">
            TCD-JEPA
          </h1>
          <p className="text-xs text-li-text-muted">Engine Console</p>
        </div>
      </header>

      {/* Chat thread */}
      <EngineChat />

      {/* Fixed bottom input */}
      <EngineChatInput />
    </div>
  );
}
