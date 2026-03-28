"use client";

import React from "react";
import { Boxes, Target, Link2, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEngineStore } from "@/stores/engine";

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  isLive?: boolean;
}

function MetricCard({ label, value, icon, isLive }: MetricCardProps) {
  return (
    <div className="li-card px-4 py-3.5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-li-text-muted uppercase tracking-wider">
            {label}
          </p>
          <p
            className={cn(
              "text-2xl font-mono font-medium text-white mt-1",
              isLive && "transition-all duration-300"
            )}
          >
            {value}
          </p>
        </div>
        <div className="text-li-text-muted flex-shrink-0">{icon}</div>
      </div>
    </div>
  );
}

export default function EngineMetricsRow() {
  const { engineStatus, metrics, lastRunSummary, discoveredModules } =
    useEngineStore();

  const isLive = engineStatus === "processing";
  const hasData =
    engineStatus === "processing" ||
    engineStatus === "converged" ||
    lastRunSummary !== null;

  // Module count
  const moduleCount =
    discoveredModules.length > 0
      ? discoveredModules.length
      : lastRunSummary?.moduleCount ?? null;

  // Average purity
  const avgPurity =
    discoveredModules.length > 0
      ? Math.round(
          (discoveredModules.reduce((s, m) => s + m.purity_score, 0) /
            discoveredModules.length) *
            100
        )
      : lastRunSummary?.avgPurity ?? null;

  // Link AUC
  const linkAuc = metrics.linkAuc > 0 ? metrics.linkAuc : null;

  // Training loss
  const loss = metrics.loss > 0 ? metrics.loss : null;

  function fmt(val: number | null, type: "count" | "pct" | "loss"): string {
    if (!hasData || val === null) return "\u2014";
    if (type === "count") return val.toString();
    if (type === "pct") return `${(val * 100).toFixed(1)}%`;
    if (type === "loss") return val.toFixed(4);
    return String(val);
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label="Modules Discovered"
        value={fmt(moduleCount, "count")}
        icon={<Boxes className="w-4 h-4" />}
        isLive={isLive}
      />
      <MetricCard
        label="Average Purity"
        value={
          hasData && avgPurity !== null ? `${avgPurity}%` : "\u2014"
        }
        icon={<Target className="w-4 h-4" />}
        isLive={isLive}
      />
      <MetricCard
        label="Link AUC"
        value={fmt(linkAuc, "pct")}
        icon={<Link2 className="w-4 h-4" />}
        isLive={isLive}
      />
      <MetricCard
        label="Training Loss"
        value={fmt(loss, "loss")}
        icon={<TrendingDown className="w-4 h-4" />}
        isLive={isLive}
      />
    </div>
  );
}
