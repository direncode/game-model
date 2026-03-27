"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variantStyles = {
  primary: "bg-li-primary hover:bg-li-primary-hover text-white",
  secondary:
    "bg-li-surface hover:bg-li-surface-hover border border-li-border text-li-text-primary",
  danger: "bg-li-danger hover:bg-li-danger-hover text-white",
  ghost: "bg-transparent hover:bg-li-surface-hover text-li-text-secondary",
};

const sizeStyles = {
  sm: "px-2.5 py-1 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-2.5 text-base gap-2",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-li-primary/50 disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
}
