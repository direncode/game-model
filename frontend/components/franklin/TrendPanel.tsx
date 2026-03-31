"use client";

import type { FSDTrends, FSDIntel, FSDHeatmapPoint, FSDSpot } from "@/lib/fsd-api";
import { TrendingUp, CalendarDays } from "lucide-react";
import DensityMap from "./DensityMap";

interface TrendPanelProps {
  trends: FSDTrends | undefined;
  intel: FSDIntel | undefined;
  heatmap: FSDHeatmapPoint[];
  spots: FSDSpot[];
  isLoading: boolean;
}

export default function TrendPanel({ trends, intel, heatmap, spots, isLoading }: TrendPanelProps) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-li-gray-700 border-t-li-cyan rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-li-border flex-shrink-0">
        <TrendingUp className="w-4 h-4 text-li-cyan" />
        <h3 className="text-sm font-medium text-white">Franklin Street</h3>
        <span className="text-[10px] text-li-text-muted ml-auto">
          {spots.filter(s => !s.closed).length} open
        </span>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Mapbox density heatmap */}
        <div className="flex-[2] min-w-0 relative overflow-hidden">
          <DensityMap heatmap={heatmap} spots={spots} />
        </div>

        {/* Trending + Topics + Events */}
        <div className="w-52 flex-shrink-0 p-3 border-l border-li-border overflow-y-auto space-y-4">
          {/* Trending now */}
          {trends?.trending_now && trends.trending_now.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-li-text-muted mb-2">
                Trending Now
              </p>
              <div className="flex flex-wrap gap-1">
                {trends.trending_now.slice(0, 8).map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 text-[11px] rounded-full bg-li-cyan/10 text-li-cyan border border-li-cyan/20"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Local topics */}
          {trends?.local_topics && trends.local_topics.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-li-text-muted mb-2">
                Local Topics
              </p>
              <div className="space-y-1.5">
                {trends.local_topics.slice(0, 5).map((t: any, i) => {
                  const label = t.topic || t.text || t.keyword || t.name || "";
                  if (!label) return null;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs text-white leading-snug flex-1">{label}</span>
                      <span className="text-[10px] font-mono text-li-cyan flex-shrink-0">
                        {typeof t.score === "number" ? t.score.toFixed(0) : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* UNC Events */}
          {intel?.events && intel.events.count > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarDays className="w-3 h-3 text-li-cyan" />
                <p className="text-[10px] uppercase tracking-wider text-li-text-muted">
                  UNC · {intel.events.count}
                </p>
              </div>
              <div className="space-y-1.5">
                {intel.events.events.slice(0, 3).map((e, i) => (
                  <div key={i} className="py-1 px-2 rounded bg-li-gray-900">
                    <p className="text-[11px] text-white leading-snug">{e.name}</p>
                    {e.date && (
                      <p className="text-[10px] text-li-text-muted mt-0.5">{e.date}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
