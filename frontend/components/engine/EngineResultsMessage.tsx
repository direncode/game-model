"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Boxes, Target, Link2, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEngineStore } from "@/stores/engine";

function MetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-li-surface border border-li-border">
      <Icon className="w-3 h-3 text-li-text-muted" />
      <span className="text-xs text-li-text-muted">{label}</span>
      <span className="text-xs font-mono text-white">{value}</span>
    </div>
  );
}

export default function EngineResultsMessage() {
  const { discoveredModules, lastRunSummary, activeDatasetId, metrics, reset } =
    useEngineStore();

  const moduleCount = discoveredModules.length || lastRunSummary?.moduleCount || 0;
  const avgPurity =
    discoveredModules.length > 0
      ? Math.round(
          (discoveredModules.reduce((s, m) => s + m.purity_score, 0) /
            discoveredModules.length) *
            100
        )
      : lastRunSummary?.avgPurity ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-medium text-white">
          TCD-JEPA discovered{" "}
          <span className="text-li-cyan font-mono">{moduleCount}</span> modules
        </h3>
        <p className="text-sm text-li-text-muted mt-0.5">
          Analysis complete with {avgPurity}% average purity
        </p>
      </div>

      {/* Metrics row */}
      <div className="flex flex-wrap gap-2">
        <MetricPill icon={Boxes} label="Modules" value={String(moduleCount)} />
        <MetricPill icon={Target} label="Purity" value={`${avgPurity}%`} />
        <MetricPill
          icon={Link2}
          label="AUC"
          value={`${Math.round((metrics.linkAuc || lastRunSummary?.avgPurity || 0) * 100) / 100}`}
        />
        <MetricPill
          icon={TrendingDown}
          label="Loss"
          value={metrics.loss ? metrics.loss.toFixed(3) : "—"}
        />
      </div>

      {/* Module cards */}
      {discoveredModules.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {discoveredModules.map((mod) => (
            <Link
              key={mod.id}
              href={`/datasets/${activeDatasetId}/modules/${mod.id}`}
              className="li-card px-3.5 py-3 hover:border-li-gray-600 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {mod.name}
                  </p>
                  <p className="text-xs text-li-text-muted mt-0.5">
                    {mod.entity_count} entities
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-li-surface border border-li-border text-li-text-secondary">
                    {mod.dominant_type}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
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
              <div className="mt-2">
                <div className="w-full h-1 bg-li-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${mod.purity_score * 100}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {activeDatasetId && (
          <Link
            href={`/datasets/${activeDatasetId}/modules`}
            className="flex items-center gap-1.5 text-sm text-white hover:text-li-gray-300 transition-colors"
          >
            View full results
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm text-li-text-muted hover:text-white transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          New Analysis
        </button>
      </div>
    </div>
  );
}
