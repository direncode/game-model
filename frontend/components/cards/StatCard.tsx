"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  value: string | number;
  label: string;
  trend?: {
    direction: "up" | "down";
    percentage: number;
  };
  icon?: React.ReactNode;
  className?: string;
}

export default function StatCard({
  value,
  label,
  trend,
  icon,
  className,
}: StatCardProps) {
  return (
    <div className={cn("li-card", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-mono font-medium text-li-text-primary">
            {value}
          </p>
          <p className="text-sm text-li-text-muted mt-1">{label}</p>
        </div>
        {icon && (
          <div className="text-li-text-muted">{icon}</div>
        )}
      </div>

      {trend && (
        <div className="flex items-center gap-1 mt-3">
          {trend.direction === "up" ? (
            <TrendingUp className="w-3.5 h-3.5 text-li-accent" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-li-danger" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              trend.direction === "up" ? "text-li-accent" : "text-li-danger"
            )}
          >
            {trend.percentage.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
