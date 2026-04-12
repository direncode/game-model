"use client";

import { useTCDStore } from "@/lib/tcd/store";
import InsightCard from "./InsightCard";
import { cn } from "@/lib/utils";

const ENGINES = [
  { key: "causal", label: "Causal", color: "text-red-400" },
  { key: "topological", label: "Topology", color: "text-purple-400" },
  { key: "temporal", label: "Temporal", color: "text-amber-400" },
  { key: "oracle", label: "Oracle", color: "text-cyan-400" },
  { key: "meta", label: "Meta", color: "text-green-400" },
  { key: "deep_signals", label: "Signals", color: "text-blue-400" },
  { key: "uncertainty", label: "Uncertainty", color: "text-pink-400" },
];

export default function IntelligencePanel() {
  const intelligence = useTCDStore((s) => s.intelligence);
  const activeTab = useTCDStore((s) => s.activeIntelligenceTab);
  const setTab = useTCDStore((s) => s.setIntelligenceTab);

  const hasData = Object.keys(intelligence).length > 0;

  return (
    <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-li-gray-800 overflow-x-auto">
        {ENGINES.map((eng) => {
          const count = (intelligence[eng.key] || []).length;
          return (
            <button
              key={eng.key}
              onClick={() => setTab(eng.key)}
              className={cn(
                "px-3 py-2 text-[10px] uppercase tracking-wider whitespace-nowrap transition-colors border-b-2",
                activeTab === eng.key
                  ? `${eng.color} border-current font-semibold`
                  : "text-li-text-muted border-transparent hover:text-white"
              )}
            >
              {eng.label}
              {count > 0 && (
                <span className="ml-1 px-1 py-0.5 bg-white/10 rounded text-[8px]">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-3 max-h-96 overflow-y-auto space-y-2">
        {!hasData ? (
          <p className="text-center text-sm text-li-text-muted py-8">
            Run the demo to generate intelligence insights
          </p>
        ) : (intelligence[activeTab] || []).length === 0 ? (
          <p className="text-center text-sm text-li-text-muted py-8">
            No {activeTab} insights available
          </p>
        ) : (
          (intelligence[activeTab] || []).map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))
        )}
      </div>
    </div>
  );
}
