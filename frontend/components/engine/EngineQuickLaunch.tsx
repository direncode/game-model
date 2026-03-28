"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, ChevronDown, ChevronUp, Library } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEngineStore } from "@/stores/engine";

export default function EngineQuickLaunch() {
  const { engineStatus, startJob } = useEngineStore();

  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedDatasetName, setSelectedDatasetName] = useState("");
  const [moduleCount, setModuleCount] = useState("");
  const [epochs, setEpochs] = useState("");
  const [learningRate, setLearningRate] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [phThreshold, setPhThreshold] = useState("");
  const [moduleCapacity, setModuleCapacity] = useState("");

  const isDisabled = engineStatus === "processing";

  const { data: datasetsResponse } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => api.listDatasets(),
  });

  const datasets: Array<{ id: string; name: string }> = Array.isArray(
    datasetsResponse
  )
    ? datasetsResponse
    : (datasetsResponse as any)?.items || [];

  function handleDatasetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedDatasetId(id);
    const ds = datasets.find((d) => d.id === id);
    setSelectedDatasetName(ds?.name || "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDatasetId || !selectedDatasetName) return;

    const config: Record<string, any> = {};
    if (moduleCount) config.module_count = parseInt(moduleCount, 10);
    if (epochs) config.epochs = parseInt(epochs, 10);
    if (learningRate) config.learning_rate = parseFloat(learningRate);
    if (phThreshold) config.ph_filtration_threshold = parseFloat(phThreshold);
    if (moduleCapacity) config.module_capacity = parseInt(moduleCapacity, 10);

    await startJob(
      selectedDatasetId,
      selectedDatasetName,
      Object.keys(config).length > 0 ? config : undefined
    );
  }

  return (
    <form onSubmit={handleSubmit} className="li-card p-5 space-y-4">
      <h3 className="text-sm font-medium text-li-text-secondary uppercase tracking-wider">
        Quick Launch
      </h3>

      {/* Dataset selector */}
      <div>
        <label className="block text-xs text-li-text-muted mb-1.5">
          Dataset
        </label>
        <select
          value={selectedDatasetId}
          onChange={handleDatasetChange}
          disabled={isDisabled}
          className="li-input w-full text-sm"
        >
          <option value="">Select a dataset...</option>
          {datasets.map((ds) => (
            <option key={ds.id} value={ds.id}>
              {ds.name}
            </option>
          ))}
        </select>
        <Link
          href="/datasets/library"
          className="flex items-center gap-1.5 mt-1.5 text-xs text-li-text-muted hover:text-white transition-colors"
        >
          <Library className="w-3 h-3" />
          Browse Dataset Library
        </Link>
      </div>

      {/* Config inputs row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-li-text-muted mb-1.5">
            Module Count
          </label>
          <input
            type="number"
            placeholder="Auto"
            value={moduleCount}
            onChange={(e) => setModuleCount(e.target.value)}
            disabled={isDisabled}
            className="li-input w-full text-sm"
            min={1}
          />
        </div>
        <div>
          <label className="block text-xs text-li-text-muted mb-1.5">
            Epochs
          </label>
          <input
            type="number"
            placeholder="Auto"
            value={epochs}
            onChange={(e) => setEpochs(e.target.value)}
            disabled={isDisabled}
            className="li-input w-full text-sm"
            min={1}
          />
        </div>
        <div>
          <label className="block text-xs text-li-text-muted mb-1.5">
            Learning Rate
          </label>
          <input
            type="number"
            placeholder="Auto"
            value={learningRate}
            onChange={(e) => setLearningRate(e.target.value)}
            disabled={isDisabled}
            className="li-input w-full text-sm"
            step={0.0001}
            min={0}
          />
        </div>
      </div>

      {/* Advanced toggle */}
      <div className="border border-li-border rounded-lg">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-li-text-secondary hover:text-li-text-primary transition-colors"
        >
          <span>Advanced</span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {showAdvanced && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-li-border pt-3">
            <div>
              <label className="block text-xs text-li-text-muted mb-1.5">
                PH Threshold
              </label>
              <input
                type="number"
                placeholder="0.5"
                value={phThreshold}
                onChange={(e) => setPhThreshold(e.target.value)}
                disabled={isDisabled}
                className="li-input w-full text-sm"
                step={0.01}
                min={0}
                max={1}
              />
            </div>
            <div>
              <label className="block text-xs text-li-text-muted mb-1.5">
                Module Capacity
              </label>
              <input
                type="number"
                placeholder="500"
                value={moduleCapacity}
                onChange={(e) => setModuleCapacity(e.target.value)}
                disabled={isDisabled}
                className="li-input w-full text-sm"
                min={1}
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isDisabled || !selectedDatasetId}
        className="li-btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-4 h-4" />
        Ask TCD-JEPA
      </button>
    </form>
  );
}
