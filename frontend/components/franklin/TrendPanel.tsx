"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { FSDTrends, FSDIntel } from "@/lib/fsd-api";
import { TrendingUp, CalendarDays } from "lucide-react";

interface TrendPanelProps {
  trends: FSDTrends | undefined;
  intel: FSDIntel | undefined;
  isLoading: boolean;
}

export default function TrendPanel({ trends, intel, isLoading }: TrendPanelProps) {
  const chartData = useMemo(() => {
    if (!trends?.type_interest) return [];
    return Object.entries(trends.type_interest)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 12)
      .map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [trends]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-li-gray-700 border-t-li-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!trends?.has_data) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-li-text-muted">
        No trend data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-li-border">
        <TrendingUp className="w-4 h-4 text-li-cyan" />
        <h3 className="text-sm font-medium text-white">Local Trends</h3>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Bar chart */}
        <div className="flex-1 p-3 min-h-[200px]">
          <p className="text-[10px] uppercase tracking-wider text-li-text-muted mb-2">
            Type Interest
          </p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#888", fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#00d4ff" }}
              />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.value > 70 ? "#00d4ff" : entry.value > 40 ? "#0a6e8a" : "#1a3a4a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trending + Topics */}
        <div className="lg:w-56 p-3 border-t lg:border-t-0 lg:border-l border-li-border overflow-y-auto">
          {/* Trending now */}
          {trends.trending_now.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-li-text-muted mb-2">
                Trending Now
              </p>
              <div className="flex flex-wrap gap-1">
                {trends.trending_now.map((kw) => (
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
          {trends.local_topics.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-li-text-muted mb-2">
                Local Topics
              </p>
              <div className="space-y-1.5">
                {trends.local_topics.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-li-gray-300 leading-snug flex-1">
                      {t.topic}
                    </span>
                    <span className="text-[10px] font-mono text-li-text-muted flex-shrink-0">
                      {t.score.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UNC Events */}
          {intel?.events && intel.events.count > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarDays className="w-3 h-3 text-li-cyan" />
                <p className="text-[10px] uppercase tracking-wider text-li-text-muted">
                  UNC Events · {intel.events.count}
                </p>
              </div>
              <div className="space-y-1.5">
                {intel.events.events.slice(0, 4).map((e, i) => (
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
