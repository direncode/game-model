"use client";

import React from "react";
import { cn } from "@/lib/utils";

const variantStyles = {
  primary: "bg-li-primary/10 text-li-primary",
  accent: "bg-li-accent/10 text-li-accent",
  warning: "bg-li-warning/10 text-li-warning",
  danger: "bg-li-danger/10 text-li-danger",
  neutral: "bg-li-border/20 text-li-text-secondary",
};

const sizeStyles = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
};

export interface BadgeProps {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({
  variant = "primary",
  size = "md",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
