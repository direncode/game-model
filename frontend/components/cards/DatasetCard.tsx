"use client";

import React from "react";
import { formatDate, formatNumber, statusColor } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import type { Dataset } from "@/lib/types";

export interface DatasetCardProps {
  dataset: Dataset;
  onClick?: () => void;
}

export default function DatasetCard({ dataset, onClick }: DatasetCardProps) {
  return (
    <div
      onClick={onClick}
      className="li-card hover:border-li-border-light transition-colors cursor-pointer"
    >
      {/* Name + status */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-li-text-primary truncate pr-2">
          {dataset.name}
        </h3>
        <span className={`li-badge text-[10px] ${statusColor(dataset.status)}`}>
          {dataset.status}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-3 text-xs text-li-text-muted">
        <span>
          <span className="font-mono text-li-text-secondary">
            {formatNumber(dataset.entity_count)}
          </span>{" "}
          entities
        </span>
        <span>
          <span className="font-mono text-li-text-secondary">
            {formatNumber(dataset.edge_count)}
          </span>{" "}
          edges
        </span>
        <span>
          <span className="font-mono text-li-text-secondary">
            {dataset.density.toFixed(3)}
          </span>{" "}
          density
        </span>
      </div>

      {/* Created date */}
      <p className="text-xs text-li-text-muted">{formatDate(dataset.created_at)}</p>
    </div>
  );
}
