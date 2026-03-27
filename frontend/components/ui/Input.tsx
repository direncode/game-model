"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-li-text-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-li-text-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "li-input w-full",
              icon && "pl-9",
              error && "border-li-danger focus:ring-li-danger focus:border-li-danger",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-li-danger">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-li-text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
