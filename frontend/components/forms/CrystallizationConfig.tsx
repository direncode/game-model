"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { CrystallizationConfig as CrystallizationConfigType, DatasetProfile } from "@/lib/types";

export interface CrystallizationConfigProps {
  datasetProfile?: DatasetProfile;
  onSubmit: (config: CrystallizationConfigType) => void;
  loading?: boolean;
}

export default function CrystallizationConfig({
  datasetProfile,
  onSubmit,
  loading = false,
}: CrystallizationConfigProps) {
  const [moduleCount, setModuleCount] = useState("");
  const [epochs, setEpochs] = useState("");
  const [learningRate, setLearningRate] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [phThreshold, setPhThreshold] = useState("");
  const [moduleCapacity, setModuleCapacity] = useState("");

  // Smart defaults based on dataset profile
  const defaults = {
    moduleCount: datasetProfile ? Math.max(3, Math.ceil(Math.sqrt(datasetProfile.entity_count / 50))) : 10,
    epochs: 100,
    learningRate: 0.001,
    phThreshold: 0.5,
    moduleCapacity: 500,
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const config: CrystallizationConfigType = {};
    if (moduleCount) config.module_count = parseInt(moduleCount, 10);
    if (epochs) config.epochs = parseInt(epochs, 10);
    if (learningRate) config.learning_rate = parseFloat(learningRate);
    if (phThreshold) config.ph_filtration_threshold = parseFloat(phThreshold);
    if (moduleCapacity) config.module_capacity = parseInt(moduleCapacity, 10);
    onSubmit(config);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Module Count"
          type="number"
          placeholder={defaults.moduleCount.toString()}
          value={moduleCount}
          onChange={(e) => setModuleCount(e.target.value)}
          helperText={`Default: ${defaults.moduleCount}`}
        />
        <Input
          label="Epochs"
          type="number"
          placeholder={defaults.epochs.toString()}
          value={epochs}
          onChange={(e) => setEpochs(e.target.value)}
          helperText={`Default: ${defaults.epochs}`}
        />
        <Input
          label="Learning Rate"
          type="number"
          step="0.0001"
          placeholder={defaults.learningRate.toString()}
          value={learningRate}
          onChange={(e) => setLearningRate(e.target.value)}
          helperText={`Default: ${defaults.learningRate}`}
        />
      </div>

      {/* Advanced section */}
      <div className="border border-li-border rounded-lg">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-li-text-secondary hover:text-li-text-primary transition-colors"
        >
          <span>Advanced Settings</span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {showAdvanced && (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-li-border pt-4">
            <Input
              label="PH Filtration Threshold"
              type="number"
              step="0.01"
              placeholder={defaults.phThreshold.toString()}
              value={phThreshold}
              onChange={(e) => setPhThreshold(e.target.value)}
              helperText="Persistent homology threshold"
            />
            <Input
              label="Module Capacity"
              type="number"
              placeholder={defaults.moduleCapacity.toString()}
              value={moduleCapacity}
              onChange={(e) => setModuleCapacity(e.target.value)}
              helperText="Max entities per module"
            />
          </div>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={loading}
        icon={<Sparkles className="w-4 h-4" />}
        className="w-full sm:w-auto"
      >
        Start Crystallization
      </Button>
    </form>
  );
}
