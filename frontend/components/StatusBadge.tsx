"use client";

import { statusColor } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`li-badge ${statusColor(status)} ${className}`}
    >
      {label}
    </span>
  );
}
