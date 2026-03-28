"use client";

import React from "react";
import { Database, AlertCircle, Sparkles, RotateCcw } from "lucide-react";
import { ChatMessage } from "@/stores/engine";
import { useEngineStore } from "@/stores/engine";
import EngineDatasetPicker from "./EngineDatasetPicker";
import EngineProcessingMessage from "./EngineProcessingMessage";
import EngineResultsMessage from "./EngineResultsMessage";

interface Props {
  message: ChatMessage;
}

export default function EngineChatMessage({ message }: Props) {
  const { startJob, activeDatasetId, activeDatasetName } = useEngineStore();

  switch (message.type) {
    case "welcome":
      return (
        <div className="py-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-li-surface border border-li-border mb-4">
            <Sparkles className="w-4 h-4 text-li-cyan" />
            <span className="text-sm font-medium text-white">TCD-JEPA Engine</span>
          </div>
          <p className="text-sm text-li-text-muted max-w-md mx-auto">
            Select a dataset below to discover hidden modular structure using
            topological crystallization.
          </p>
        </div>
      );

    case "dataset-picker":
      return (
        <div className="py-2">
          <EngineDatasetPicker />
        </div>
      );

    case "user-action":
      return (
        <div className="flex items-center gap-2 py-2">
          <Database className="w-3.5 h-3.5 text-li-text-muted" />
          <p className="text-sm text-li-text-secondary">
            Selected{" "}
            <span className="text-white font-medium">
              {message.data?.datasetName || "dataset"}
            </span>
          </p>
        </div>
      );

    case "processing":
      return (
        <div className="py-3 li-card p-4">
          <EngineProcessingMessage />
        </div>
      );

    case "result":
      return (
        <div className="py-3 li-card p-4">
          <EngineResultsMessage />
        </div>
      );

    case "error":
      return (
        <div className="py-3 li-card p-4 border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-400 font-medium">Analysis failed</p>
              <p className="text-xs text-li-text-muted mt-1">
                {message.data?.error || "An unexpected error occurred."}
              </p>
              {activeDatasetId && activeDatasetName && (
                <button
                  onClick={() => startJob(activeDatasetId, activeDatasetName)}
                  className="flex items-center gap-1.5 text-xs text-li-text-secondary hover:text-white transition-colors mt-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}
