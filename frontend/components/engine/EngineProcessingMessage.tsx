"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Cpu, Loader2 } from "lucide-react";
import { useEngineStore } from "@/stores/engine";
import EngineSimulation from "@/components/landing/EngineSimulation";

export default function EngineProcessingMessage() {
  const {
    lossHistory,
    currentEpoch,
    totalEpochs,
    metrics,
    progress,
    activeDatasetName,
  } = useEngineStore();

  const progressPercent = Math.round(progress * 100);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-li-cyan animate-spin" />
        <p className="text-sm font-medium text-white">
          Analyzing {activeDatasetName || "dataset"}...
        </p>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-li-text-muted font-mono">
            Epoch {currentEpoch}/{totalEpochs || "?"}
          </p>
          <p className="text-xs text-li-text-muted">
            {metrics.estimatedTimeRemaining > 0
              ? `~${Math.ceil(metrics.estimatedTimeRemaining / 60)}m remaining`
              : progressPercent > 0
                ? `${progressPercent}%`
                : "Starting..."}
          </p>
        </div>
        <div className="w-full h-1.5 bg-li-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-li-cyan rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(progressPercent, 2)}%` }}
          />
        </div>
      </div>

      {/* Compact visualization */}
      <div className="rounded-xl overflow-hidden border border-li-border" style={{ height: "200px" }}>
        <EngineSimulation compact />
      </div>

      {/* Mini loss chart */}
      {lossHistory.length > 1 && (
        <div className="li-card p-3">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={lossHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="epoch"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                yAxisId="loss"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                domain={["auto", "auto"]}
              />
              <YAxis
                yAxisId="auc"
                orientation="right"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                domain={[0, 1]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  fontSize: 11,
                }}
              />
              <Line
                yAxisId="loss"
                type="monotone"
                dataKey="loss"
                stroke="#06B6D4"
                strokeWidth={1.5}
                dot={false}
                name="Loss"
              />
              <Line
                yAxisId="auc"
                type="monotone"
                dataKey="linkAuc"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={false}
                name="Link AUC"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* GPU utilization */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-li-text-muted">
          <Cpu className="w-3 h-3" />
          GPU
        </div>
        <div className="flex-1 h-1 bg-li-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-white/60 rounded-full transition-all duration-500"
            style={{ width: `${metrics.gpuUtilization}%` }}
          />
        </div>
        <span className="text-li-text-muted font-mono w-8 text-right">
          {Math.round(metrics.gpuUtilization)}%
        </span>
      </div>
    </div>
  );
}
