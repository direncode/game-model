"use client";
import { useMemo, useState } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceArea, Brush, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import type { HistoryFullItem, WFSeriesItem } from "@/hooks/useNIVData";

interface Props {
  history: HistoryFullItem[];
  nberRecessions: string[][];
  wfSeries?: WFSeriesItem[];
  focusedIndex: number | null;
  onFocusMonth: (index: number | null) => void;
  showSmoothed?: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-li-black/95 border border-li-gray-800 rounded px-2.5 py-2 text-[9px] font-mono shadow-xl">
      <div className="text-li-cyan font-bold mb-1">{d.dateLabel}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-li-text-muted">NIV</span>
        <span className={d.niv_score >= 0 ? "text-emerald-400" : "text-red-400"}>
          {d.niv_score >= 0 ? "+" : ""}{d.niv_score.toFixed(1)}
        </span>
        <span className="text-li-text-muted">P(rec)</span>
        <span className="text-white">{(d.recession_probability * 100).toFixed(1)}%</span>
        <span className="text-li-text-muted">Thrust</span>
        <span className="text-blue-400">{d.thrust.toFixed(3)}</span>
        <span className="text-li-text-muted">Eff&sup2;</span>
        <span className="text-violet-400">{d.efficiency_squared.toFixed(4)}</span>
        <span className="text-li-text-muted">Slack</span>
        <span className="text-teal-400">{d.slack.toFixed(3)}</span>
        <span className="text-li-text-muted">Drag</span>
        <span className="text-red-400">{d.drag_total.toFixed(5)}</span>
      </div>
      {d.wf_prob !== undefined && (
        <div className="mt-1 pt-1 border-t border-li-gray-800">
          <span className="text-li-text-muted">WF P(rec)</span>
          <span className="ml-2 text-li-purple">{(d.wf_prob * 100).toFixed(1)}%</span>
          <span className="text-li-text-muted ml-2">[{(d.wf_lower * 100).toFixed(0)}-{(d.wf_upper * 100).toFixed(0)}]</span>
        </div>
      )}
    </div>
  );
}

export function NIVTimeSeriesChart({ history, nberRecessions, wfSeries, focusedIndex, onFocusMonth, showSmoothed = true }: Props) {
  // Merge history + walk-forward series by date
  const chartData = useMemo(() => {
    const wfMap = new Map<string, WFSeriesItem>();
    if (wfSeries) {
      for (const w of wfSeries) {
        const key = w.date.slice(0, 7);
        wfMap.set(key, w);
      }
    }
    return history.map((h, i) => {
      const key = h.date.slice(0, 7);
      const wf = wfMap.get(key);
      return {
        ...h,
        index: i,
        dateLabel: key,
        score: showSmoothed && h.smoothed_niv != null ? h.smoothed_niv : h.niv_score,
        prob_pct: h.recession_probability * 100,
        wf_prob: wf?.prob,
        wf_lower: wf?.lower,
        wf_upper: wf?.upper,
      };
    });
  }, [history, wfSeries, showSmoothed]);

  // Convert NBER dates to index ranges
  const recessionAreas = useMemo(() => {
    return nberRecessions.map(([start, end]) => {
      const startKey = start.slice(0, 7);
      const endKey = end.slice(0, 7);
      const si = chartData.findIndex(d => d.dateLabel >= startKey);
      const ei = chartData.findIndex(d => d.dateLabel >= endKey);
      return { start: si >= 0 ? si : 0, end: ei >= 0 ? ei : chartData.length - 1 };
    }).filter(r => r.start < chartData.length);
  }, [nberRecessions, chartData]);

  if (!chartData.length) return <div className="flex-1 flex items-center justify-center text-li-text-muted text-xs">Loading...</div>;

  return (
    <div className="flex-1 relative">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          onClick={(e: any) => {
            if (e?.activeTooltipIndex != null) onFocusMonth(e.activeTooltipIndex);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />

          {/* NBER recession shading */}
          {recessionAreas.map((r, i) => (
            <ReferenceArea
              key={i}
              x1={r.start}
              x2={r.end}
              fill="#f85149"
              fillOpacity={0.06}
              strokeOpacity={0}
            />
          ))}

          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 8, fill: "#555" }}
            tickLine={false}
            axisLine={{ stroke: "#222" }}
            interval={Math.floor(chartData.length / 12)}
          />
          <YAxis
            yAxisId="niv"
            domain={[-100, 100]}
            tick={{ fontSize: 8, fill: "#555" }}
            tickLine={false}
            axisLine={false}
            width={35}
          />
          <YAxis
            yAxisId="prob"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 8, fill: "#555" }}
            tickLine={false}
            axisLine={false}
            width={30}
            tickFormatter={(v: number) => `${v}%`}
          />

          {/* Recession probability area */}
          <Area
            yAxisId="prob"
            dataKey="prob_pct"
            fill="#f85149"
            fillOpacity={0.08}
            stroke="#f85149"
            strokeWidth={0.5}
            strokeOpacity={0.4}
            type="monotone"
          />

          {/* Walk-forward conformal bands */}
          {wfSeries && (
            <>
              <Area yAxisId="prob" dataKey={(d: any) => d.wf_upper != null ? d.wf_upper * 100 : null}
                fill="#a371f7" fillOpacity={0.06} stroke="none" type="monotone" />
              <Area yAxisId="prob" dataKey={(d: any) => d.wf_lower != null ? d.wf_lower * 100 : null}
                fill="#000" fillOpacity={0.5} stroke="none" type="monotone" />
            </>
          )}

          {/* NIV score line */}
          <Line
            yAxisId="niv"
            dataKey="score"
            stroke="#00d4ff"
            strokeWidth={1.5}
            dot={false}
            type="monotone"
          />

          {/* Walk-forward predicted probability */}
          {wfSeries && (
            <Line
              yAxisId="prob"
              dataKey={(d: any) => d.wf_prob != null ? d.wf_prob * 100 : null}
              stroke="#a371f7"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              type="monotone"
              connectNulls={false}
            />
          )}

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#333", strokeWidth: 1 }} />
          <Brush
            dataKey="dateLabel"
            height={16}
            stroke="#333"
            fill="#000"
            travellerWidth={6}
            tickFormatter={(v: string) => v}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="absolute top-1 right-10 flex gap-3 text-[8px] font-mono">
        <span className="text-li-cyan">NIV Score</span>
        <span className="text-red-400/60">P(rec)</span>
        {wfSeries && <span className="text-li-purple">WF Pred</span>}
        <span className="text-red-400/30">NBER</span>
      </div>
    </div>
  );
}
