"use client";

import { clsx } from "clsx";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ title, value, change, icon, className }: StatCardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-cp-border bg-cp-black-elevated p-5 transition-colors hover:border-cp-border-light",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            {title}
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-cp-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {change !== undefined && (
            <p
              className={clsx(
                "mt-1 text-xs font-medium",
                change > 0 && "text-cp-green",
                change < 0 && "text-cp-red",
                change === 0 && "text-cp-gray-500"
              )}
            >
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}%
              <span className="ml-1 text-cp-gray-600">vs last month</span>
            </p>
          )}
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-cp-cyan-glow text-cp-cyan">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
