"use client";

import React from "react";
import { cn } from "@/lib/utils";

const statusColors = {
  online: "bg-li-accent",
  warning: "bg-li-warning",
  error: "bg-li-danger",
  idle: "bg-li-text-muted",
};

export interface StatusIndicatorProps {
  status: keyof typeof statusColors;
  label?: string;
  className?: string;
}

export default function StatusIndicator({
  status,
  label,
  className,
}: StatusIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColors[status])}
      />
      {label && (
        <span className="text-xs text-li-text-secondary">{label}</span>
      )}
    </div>
  );
}
