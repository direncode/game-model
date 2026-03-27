"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "li-card",
        hover && "hover:border-li-border-light transition-colors cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}
