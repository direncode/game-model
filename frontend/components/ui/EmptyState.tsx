"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Button from "./Button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-li-text-muted">{icon}</div>
      )}
      <h3 className="text-lg font-display font-semibold text-li-text-primary mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-li-text-muted max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
