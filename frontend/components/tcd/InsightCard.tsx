"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightResult } from "@/lib/tcd/types";

const SEV_STYLES: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
  notable: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  info: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

export default function InsightCard({ insight }: { insight: InsightResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-li-gray-900/30 border border-li-gray-800/50 rounded-lg p-3 hover:border-li-gray-700 transition-colors">
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className={cn("px-1.5 py-0.5 text-[9px] uppercase rounded border font-mono", SEV_STYLES[insight.severity] || SEV_STYLES.info)}>
          {insight.severity}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-medium text-white leading-tight">{insight.title}</h4>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-12 h-1 bg-li-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${insight.confidence * 100}%` }} />
          </div>
          <span className="text-[9px] font-mono text-li-text-muted">{(insight.confidence * 100).toFixed(0)}%</span>
          {expanded ? <ChevronUp className="w-3 h-3 text-li-text-muted" /> : <ChevronDown className="w-3 h-3 text-li-text-muted" />}
        </div>
      </div>
      {expanded && (
        <div className="mt-2 pl-12 space-y-2">
          <p className="text-xs text-li-text-secondary leading-relaxed">{insight.description}</p>
          {insight.evidence.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-widest text-li-text-muted">Evidence</span>
              {insight.evidence.map((ev, i) => (
                <div key={i} className="text-[11px] text-li-text-muted font-mono pl-2 border-l border-li-gray-700">
                  {ev}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
