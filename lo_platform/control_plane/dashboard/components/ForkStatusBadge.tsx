"use client";

import { clsx } from "clsx";
import type { ForkStatus, HealthStatus } from "@/lib/types";

const statusStyles: Record<ForkStatus, string> = {
  active: "bg-cp-green/15 text-cp-green border-cp-green/30",
  provisioning: "bg-cp-cyan/15 text-cp-cyan border-cp-cyan/30",
  suspended: "bg-cp-yellow/15 text-cp-yellow border-cp-yellow/30",
  teardown: "bg-cp-red/15 text-cp-red border-cp-red/30",
};

const healthStyles: Record<HealthStatus, string> = {
  healthy: "bg-cp-green/15 text-cp-green border-cp-green/30",
  degraded: "bg-cp-yellow/15 text-cp-yellow border-cp-yellow/30",
  critical: "bg-cp-red/15 text-cp-red border-cp-red/30",
  unknown: "bg-cp-gray-700/50 text-cp-gray-400 border-cp-gray-700",
};

interface ForkStatusBadgeProps {
  status: ForkStatus;
  className?: string;
}

interface HealthBadgeProps {
  health: HealthStatus;
  className?: string;
}

export function ForkStatusBadge({ status, className }: ForkStatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        statusStyles[status],
        className
      )}
    >
      <span
        className={clsx("mr-1.5 h-1.5 w-1.5 rounded-full", {
          "bg-cp-green": status === "active",
          "bg-cp-cyan animate-pulse-soft": status === "provisioning",
          "bg-cp-yellow": status === "suspended",
          "bg-cp-red": status === "teardown",
        })}
      />
      {status}
    </span>
  );
}

export function HealthBadge({ health, className }: HealthBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        healthStyles[health],
        className
      )}
    >
      {health}
    </span>
  );
}
