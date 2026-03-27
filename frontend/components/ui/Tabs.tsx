"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b border-li-border",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
            activeTab === tab.key
              ? "border-li-primary text-li-primary"
              : "border-transparent text-li-text-muted hover:text-li-text-secondary hover:border-li-border-light"
          )}
        >
          {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-display",
                activeTab === tab.key
                  ? "bg-li-primary/10 text-li-primary"
                  : "bg-li-border/30 text-li-text-muted"
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
