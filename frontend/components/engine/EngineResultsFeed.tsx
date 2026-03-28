"use client";

import React from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Cpu, ArrowRight, Sparkles, RotateCcw, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEngineStore } from "@/stores/engine";

/* ─── Processing View ─────────────────────────────────────────────── */

function ProcessingView() {
  const { lossHistory, currentEpoch, totalEpochs, metrics } = useEngineStore();

  return (
    <div className="space-y-5">
      {/* Epoch counter */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-li-text-secondary">
          Epoch{" "}
          <span className="text-white font-mono">
            {currentEpoch}/{totalEpochs || "?"}
          </span>
        </p>
        <p className="text-xs text-li-text-muted">
          {metrics.estimatedTimeRemaining > 0
            ? `~${Math.ceil(metrics.estimatedTimeRemaining / 60)}m remaining`
            : "Estimating..."}
        </p>
      </div>

      {/* Loss chart */}
      <div className="li-card p-4">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={lossHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="epoch"
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              label={{
                value: "Epoch",
                position: "insideBottomRight",
                offset: -5,
                style: { fontSize: 11, fill: "#64748b" },
              }}
            />
            <YAxis
              yAxisId="loss"
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
            />
            <YAxis
              yAxisId="auc"
              orientation="right"
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              domain={[0, 1]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="loss"
              type="monotone"
              dataKey="loss"
              stroke="#06B6D4"
              strokeWidth={2}
              dot={false}
              name="Loss"
            />
            <Line
              yAxisId="auc"
              type="monotone"
              dataKey="linkAuc"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={false}
              name="Link AUC"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* GPU Utilization */}
      <div className="li-card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm text-li-text-secondary">
            <Cpu className="w-3.5 h-3.5" />
            GPU Utilization
          </div>
          <span className="text-sm font-mono text-white">
            {Math.round(metrics.gpuUtilization)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-li-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${metrics.gpuUtilization}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Converged View ──────────────────────────────────────────────── */

function ConvergedView() {
  const { discoveredModules, lastRunSummary, activeDatasetId } =
    useEngineStore();

  const avgPurity =
    discoveredModules.length > 0
      ? Math.round(
          (discoveredModules.reduce((s, m) => s + m.purity_score, 0) /
            discoveredModules.length) *
            100
        )
      : lastRunSummary?.avgPurity ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-display font-semibold text-white">
          TCD-JEPA discovered {discoveredModules.length} modules
        </h2>
        <p className="text-sm text-li-text-muted mt-1">
          Average purity: {avgPurity}%
        </p>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {discoveredModules.map((mod) => (
          <Link
            key={mod.id}
            href={`/datasets/${activeDatasetId}/modules/${mod.id}`}
            className="li-card px-4 py-3.5 hover:border-li-gray-600 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-white transition-colors truncate">
                  {mod.name}
                </p>
                <p className="text-xs text-li-text-muted mt-0.5">
                  {mod.entity_count} entities
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs px-2 py-0.5 rounded-full bg-li-surface border border-li-border text-li-text-secondary">
                  {mod.dominant_type}
                </span>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    mod.confidence >= 0.8
                      ? "bg-green-500/10 text-green-400"
                      : mod.confidence >= 0.5
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-400"
                  )}
                >
                  {Math.round(mod.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Purity bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-li-text-muted">Purity</span>
                <span className="text-li-text-secondary font-mono">
                  {Math.round(mod.purity_score * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-li-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${mod.purity_score * 100}%` }}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {activeDatasetId && (
        <Link
          href={`/datasets/${activeDatasetId}/modules`}
          className="flex items-center gap-1.5 text-sm text-white hover:text-li-gray-300 transition-colors"
        >
          View full results
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}

      {/* Re-run actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-li-border">
        <button
          onClick={() => useEngineStore.getState().reset()}
          className="li-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Analysis
        </button>
        <Link
          href="/datasets/library"
          className="flex items-center gap-1.5 text-sm text-li-text-secondary hover:text-li-text-primary transition-colors"
        >
          <Library className="w-3.5 h-3.5" />
          Try Different Dataset
        </Link>
      </div>
    </div>
  );
}

/* ─── Idle View ───────────────────────────────────────────────────── */

function IdleView() {
  const { lastRunSummary } = useEngineStore();

  if (lastRunSummary) {
    return (
      <div className="li-card px-5 py-4">
        <p className="text-sm text-li-text-secondary">
          Last run:{" "}
          <span className="text-white font-medium">
            {lastRunSummary.moduleCount} modules
          </span>
          ,{" "}
          <span className="text-white font-medium">
            {lastRunSummary.avgPurity}% purity
          </span>
        </p>
        <Link
          href={`/datasets/${lastRunSummary.datasetId}/modules`}
          className="flex items-center gap-1.5 text-sm text-white hover:text-li-gray-300 transition-colors mt-2"
        >
          View results
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="li-card px-5 py-8 flex flex-col items-center text-center">
      <Sparkles className="w-8 h-8 text-li-text-muted mb-3" />
      <p className="text-sm text-li-text-muted max-w-xs">
        Select a dataset and run TCD-JEPA to discover hidden structure
      </p>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────── */

export default function EngineResultsFeed() {
  const { engineStatus } = useEngineStore();

  if (engineStatus === "processing") return <ProcessingView />;
  if (engineStatus === "converged") return <ConvergedView />;
  return <IdleView />;
}
