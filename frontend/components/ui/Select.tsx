"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export default function Select({
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
  error,
  className,
  disabled,
}: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-li-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "li-input w-full appearance-none pr-8",
            error && "border-li-danger focus:ring-li-danger focus:border-li-danger",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-li-text-muted pointer-events-none" />
      </div>
      {error && <p className="text-xs text-li-danger">{error}</p>}
    </div>
  );
}
