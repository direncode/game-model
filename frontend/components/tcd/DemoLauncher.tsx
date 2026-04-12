"use client";

import { Play, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { useTCDStore } from "@/lib/tcd/store";
import { useTCDStream } from "@/lib/tcd/ws";
import { cn } from "@/lib/utils";

export default function DemoLauncher() {
  const { status, progress, currentStage, lastMessage, jobId, startDemo, reset } = useTCDStore();
  useTCDStream(jobId);

  return (
    <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {status === "idle" ? "Semiconductor Supply Chain Demo" : status === "running" ? "Crystallizing..." : status === "complete" ? "Demo Complete" : "Demo Failed"}
          </h2>
          <p className="text-xs text-li-text-muted mt-1">
            {status === "idle"
              ? "100 entities, 6 types, 5 clusters. Runs in ~20 seconds on CPU."
              : lastMessage || currentStage}
          </p>
        </div>
        {status === "idle" && (
          <button
            onClick={startDemo}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-semibold text-white transition-all shadow-lg shadow-cyan-600/20"
          >
            <Play className="w-4 h-4" />
            Run Demo
          </button>
        )}
        {status === "complete" && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-li-gray-800 hover:bg-li-gray-700 rounded-lg text-sm text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      {status !== "idle" && (
        <div className="space-y-2">
          {/* Progress bar */}
          <div className="w-full h-2 bg-li-gray-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                status === "error" ? "bg-red-500" : status === "complete" ? "bg-green-500" : "bg-cyan-500"
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {/* Stage indicators */}
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
            {["generating", "crystallizing", "registering", "intelligence", "complete"].map((s) => (
              <span
                key={s}
                className={cn(
                  "transition-colors",
                  currentStage === s ? "text-cyan-400 font-semibold" :
                  (["generating", "crystallizing", "registering", "intelligence", "complete"].indexOf(currentStage) >
                   ["generating", "crystallizing", "registering", "intelligence", "complete"].indexOf(s))
                    ? "text-green-400" : "text-li-text-muted"
                )}
              >
                {s === "complete" ? (
                  <CheckCircle className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                ) : null}
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
