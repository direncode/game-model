"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: boolean;
  className?: string;
}

export default function Skeleton({
  width,
  height = "16px",
  rounded = false,
  className,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-li-border/50",
        rounded ? "rounded-full" : "rounded-md",
        className
      )}
      style={{ width: width || "100%", height }}
    />
  );
}
