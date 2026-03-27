"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { truncate, percentColor } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import type { Module } from "@/lib/types";

export interface ModuleCardProps {
  module: Module;
  onChallenge?: (moduleId: string) => void;
}

const confidenceVariant: Record<string, "accent" | "warning" | "danger"> = {
  high: "accent",
  medium: "warning",
  low: "danger",
};

export default function ModuleCard({ module, onChallenge }: ModuleCardProps) {
  const router = useRouter();
  const purityPct = module.purity_score * 100;

  return (
    <div
      onClick={() => router.push(`/modules/${module.id}`)}
      className="li-card hover:border-li-border-light transition-colors cursor-pointer relative group"
    >
      {/* Challenge button */}
      {onChallenge && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChallenge(module.id);
          }}
          className="absolute top-3 right-3 p-1.5 rounded-md text-li-text-muted opacity-0 group-hover:opacity-100 hover:bg-li-surface-hover hover:text-li-warning transition-all"
          title="Challenge this module"
        >
          <Swords className="w-4 h-4" />
        </button>
      )}

      {/* Module name */}
      <h3 className="font-display text-li-text-primary text-sm mb-2 pr-8">
        {module.name || `Module ${module.index}`}
      </h3>

      {/* Purity score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-li-text-muted">Purity</span>
          <span className={cn("text-xs font-mono font-medium", percentColor(purityPct))}>
            {purityPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 bg-li-bg rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              purityPct >= 90
                ? "bg-li-accent"
                : purityPct >= 70
                ? "bg-li-warning"
                : "bg-li-danger"
            )}
            style={{ width: `${Math.min(purityPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-li-text-muted">
          <span className="font-mono text-li-text-secondary">{module.entity_count}</span> entities
        </span>
        {module.dominant_type && (
          <Badge variant="primary" size="sm">
            {module.dominant_type}
          </Badge>
        )}
      </div>

      {/* Description */}
      {module.description && (
        <p className="text-xs text-li-text-muted line-clamp-2 mb-2">
          {module.description}
        </p>
      )}

      {/* Confidence */}
      <Badge variant={confidenceVariant[module.confidence] || "neutral"} size="sm">
        {module.confidence} confidence
      </Badge>
    </div>
  );
}
