"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  change?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, change, className }: StatCardProps) {
  return (
    <div className={cn("li-stat-card", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-data uppercase tracking-wider text-li-text-muted">
          {label}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-li-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-li-primary" />
          </div>
        )}
      </div>
      <span className="text-2xl font-mono font-medium text-li-text-primary">
        {value}
      </span>
      {change && (
        <span className="text-xs text-li-accent font-data">{change}</span>
      )}
    </div>
  );
}
