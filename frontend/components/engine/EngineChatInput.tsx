"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  ChevronUp,
  Settings2,
  X,
  Database,
  Square,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { useEngineStore } from "@/stores/engine";

export default function EngineChatInput() {
  const {
    engineStatus,
    startJob,
    cancelJob,
    activeDatasetId,
    activeDatasetName,
    setActiveDataset,
  } = useEngineStore();

  const [showConfig, setShowConfig] = useState(false);
  const [showDatasetSelect, setShowDatasetSelect] = useState(false);
  const [moduleCount, setModuleCount] = useState("");
  const [epochs, setEpochs] = useState("");
  const [learningRate, setLearningRate] = useState("");
  const [phThreshold, setPhThreshold] = useState("");
  const [moduleCapacity, setModuleCapacity] = useState("");

  const configRef = useRef<HTMLDivElement>(null);
  const datasetRef = useRef<HTMLDivElement>(null);

  const isProcessing = engineStatus === "processing";
  const { isSignedIn, getToken } = useAuth();

  const { data: datasetsResponse } = useQuery({
    queryKey: ["datasets"],
    queryFn: async () => {
      const token = await getToken();
      if (token) api.setToken(token);
      return api.listDatasets();
    },
    enabled: !!isSignedIn,
  });

  const datasets: Array<{ id: string; name: string }> = Array.isArray(
    datasetsResponse
  )
    ? datasetsResponse
    : (datasetsResponse as any)?.items || [];

  // Close popovers on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setShowConfig(false);
      }
      if (
        datasetRef.current &&
        !datasetRef.current.contains(e.target as Node)
      ) {
        setShowDatasetSelect(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSubmit() {
    if (!activeDatasetId || !activeDatasetName || isProcessing) return;

    // Ensure fresh token before API call
    const token = await getToken();
    if (token) api.setToken(token);

    const config: Record<string, any> = {};
    if (moduleCount) config.module_count = parseInt(moduleCount, 10);
    if (epochs) config.epochs = parseInt(epochs, 10);
    if (learningRate) config.learning_rate = parseFloat(learningRate);
    if (phThreshold)
      config.ph_filtration_threshold = parseFloat(phThreshold);
    if (moduleCapacity)
      config.module_capacity = parseInt(moduleCapacity, 10);

    setShowConfig(false);
    await startJob(
      activeDatasetId,
      activeDatasetName,
      Object.keys(config).length > 0 ? config : undefined
    );
  }

  return (
    <div className="border-t border-li-border bg-li-bg/80 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto px-4 py-3">
        {/* Config popover */}
        {showConfig && (
          <div ref={configRef} className="mb-3 li-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-li-text-muted uppercase tracking-wider font-medium">
                Configuration
              </p>
              <button
                onClick={() => setShowConfig(false)}
                className="text-li-text-muted hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-li-text-muted mb-1">
                  Module Count
                </label>
                <input
                  type="number"
                  placeholder="Auto"
                  value={moduleCount}
                  onChange={(e) => setModuleCount(e.target.value)}
                  className="li-input w-full text-sm"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs text-li-text-muted mb-1">
                  Epochs
                </label>
                <input
                  type="number"
                  placeholder="Auto"
                  value={epochs}
                  onChange={(e) => setEpochs(e.target.value)}
                  className="li-input w-full text-sm"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs text-li-text-muted mb-1">
                  Learning Rate
                </label>
                <input
                  type="number"
                  placeholder="Auto"
                  value={learningRate}
                  onChange={(e) => setLearningRate(e.target.value)}
                  className="li-input w-full text-sm"
                  step={0.0001}
                  min={0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-li-text-muted mb-1">
                  PH Threshold
                </label>
                <input
                  type="number"
                  placeholder="0.5"
                  value={phThreshold}
                  onChange={(e) => setPhThreshold(e.target.value)}
                  className="li-input w-full text-sm"
                  step={0.01}
                  min={0}
                  max={1}
                />
              </div>
              <div>
                <label className="block text-xs text-li-text-muted mb-1">
                  Module Capacity
                </label>
                <input
                  type="number"
                  placeholder="500"
                  value={moduleCapacity}
                  onChange={(e) => setModuleCapacity(e.target.value)}
                  className="li-input w-full text-sm"
                  min={1}
                />
              </div>
            </div>
          </div>
        )}

        {/* Dataset select popover */}
        {showDatasetSelect && (
          <div ref={datasetRef} className="mb-3 li-card p-3 space-y-1 max-h-48 overflow-y-auto">
            {datasets.map((ds) => (
              <button
                key={ds.id}
                onClick={() => {
                  setActiveDataset(ds.id, ds.name);
                  setShowDatasetSelect(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  ds.id === activeDatasetId
                    ? "bg-li-surface text-white"
                    : "text-li-text-secondary hover:text-white hover:bg-li-surface/50"
                }`}
              >
                {ds.name}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-center gap-2">
          {/* Dataset selector button */}
          <button
            onClick={() => {
              setShowDatasetSelect(!showDatasetSelect);
              setShowConfig(false);
            }}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-li-border hover:border-li-gray-600 transition-colors text-li-text-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="max-w-[140px] truncate">
              {activeDatasetName || "Dataset"}
            </span>
            <ChevronUp
              className={`w-3 h-3 transition-transform ${showDatasetSelect ? "" : "rotate-180"}`}
            />
          </button>

          {/* Config button */}
          <button
            onClick={() => {
              setShowConfig(!showConfig);
              setShowDatasetSelect(false);
            }}
            disabled={isProcessing}
            className={`p-2 rounded-lg border transition-colors flex-shrink-0 ${
              showConfig
                ? "border-li-gray-600 text-white bg-li-surface"
                : "border-li-border text-li-text-muted hover:text-white hover:border-li-gray-600"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Submit / Cancel */}
          {isProcessing ? (
            <button
              onClick={cancelJob}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-li-surface border border-li-border text-li-text-secondary hover:text-white hover:border-li-gray-600 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Cancel
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!activeDatasetId}
              className="li-btn-primary flex items-center gap-2 px-5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              Run TCD-JEPA
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
