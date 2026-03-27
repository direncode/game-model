"use client";

import { type LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-li-surface flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-li-text-muted" />
      </div>
      <h3 className="text-lg font-medium text-li-text-primary mb-2">{title}</h3>
      <p className="text-sm text-li-text-secondary max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}
