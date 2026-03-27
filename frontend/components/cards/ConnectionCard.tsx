"use client";

import React from "react";
import { ArrowRight, Check, X, Clock } from "lucide-react";
import Badge from "@/components/ui/Badge";
import type { HiddenConnection } from "@/lib/types";

export interface ConnectionCardProps {
  connection: HiddenConnection;
}

const validationIcons: Record<string, React.ReactNode> = {
  validated: <Check className="w-3.5 h-3.5 text-li-accent" />,
  invalidated: <X className="w-3.5 h-3.5 text-li-danger" />,
  unvalidated: <Clock className="w-3.5 h-3.5 text-li-text-muted" />,
};

const validationLabels: Record<string, string> = {
  validated: "Validated",
  invalidated: "Invalidated",
  unvalidated: "Pending",
};

export default function ConnectionCard({ connection }: ConnectionCardProps) {
  const simPct = connection.similarity_score * 100;

  return (
    <div className="li-card hover:border-li-border-light transition-colors">
      {/* Source -> Target */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-display text-li-text-primary truncate max-w-[40%]">
          {connection.source_entity_name}
        </span>
        <ArrowRight className="w-4 h-4 text-li-primary flex-shrink-0" />
        <span className="text-sm font-display text-li-text-primary truncate max-w-[40%]">
          {connection.target_entity_name}
        </span>
      </div>

      {/* Similarity score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-li-text-muted">Similarity</span>
          <span className="text-xs font-display text-li-primary font-medium">
            {simPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 bg-li-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-li-primary rounded-full"
            style={{ width: `${Math.min(simPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Module badges */}
      <div className="flex items-center gap-2 mb-3">
        {connection.source_module_name && (
          <Badge variant="neutral" size="sm">
            {connection.source_module_name}
          </Badge>
        )}
        {connection.target_module_name && (
          <Badge variant="neutral" size="sm">
            {connection.target_module_name}
          </Badge>
        )}
      </div>

      {/* Validation status */}
      <div className="flex items-center gap-1.5">
        {validationIcons[connection.validation_status]}
        <span className="text-xs text-li-text-secondary">
          {validationLabels[connection.validation_status]}
        </span>
      </div>
    </div>
  );
}
