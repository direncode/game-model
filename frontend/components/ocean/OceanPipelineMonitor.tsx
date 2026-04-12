"use client";

import React from "react";

const SOURCE_COLORS: Record<string, string> = {
  edgar: "#00d4ff",
  pubmed: "#3fb950",
  patents: "#a371f7",
  comtrade: "#d29922",
  climate: "#388bfd",
  tesla: "#f85149",
};

export interface OceanPipelineMonitorProps {
  sources: string[];
  progress: Record<string, "pending" | "running" | "done" | "failed">;
  currentMessage?: string;
}

function statusDotClass(status: "pending" | "running" | "done" | "failed"): string {
  switch (status) {
    case "pending":
      return "bg-gray-500";
    case "running":
      return "bg-li-cyan animate-pulse";
    case "done":
      return "bg-li-green";
    case "failed":
      return "bg-li-red";
  }
}

function statusLabel(status: "pending" | "running" | "done" | "failed"): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "running":
      return "Running...";
    case "done":
      return "Complete";
    case "failed":
      return "Failed";
  }
}

export default function OceanPipelineMonitor({
  sources,
  progress,
  currentMessage,
}: OceanPipelineMonitorProps) {
  return (
    <div className="bg-li-depth-1 border border-li-border rounded-lg p-5">
      <div className="text-[10px] uppercase tracking-widest text-li-text-muted mb-4">
        Pipeline Progress
      </div>

      <div className="space-y-3">
        {sources.map((src, i) => {
          const status = progress[src] ?? "pending";
          return (
            <div key={src} className="flex items-center gap-3">
              {/* Vertical connector line */}
              <div className="flex flex-col items-center w-4">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusDotClass(status)}`} />
                {i < sources.length - 1 && (
                  <div className="w-px h-4 bg-li-border mt-1" />
                )}
              </div>

              {/* Source name */}
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SOURCE_COLORS[src] ?? "#6B7280" }}
                />
                <span className="text-sm text-li-text-primary font-mono">{src}</span>
              </div>

              {/* Status label */}
              <span
                className={`text-xs font-mono ${
                  status === "done"
                    ? "text-li-green"
                    : status === "failed"
                      ? "text-li-red"
                      : status === "running"
                        ? "text-li-cyan"
                        : "text-li-text-muted"
                }`}
              >
                {statusLabel(status)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current message */}
      {currentMessage && (
        <div className="mt-4 pt-3 border-t border-li-border">
          <div className="text-xs font-mono text-li-text-secondary bg-li-depth-2 rounded px-3 py-2">
            {currentMessage}
          </div>
        </div>
      )}
    </div>
  );
}
