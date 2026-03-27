"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface PurityModule {
  name: string;
  purity_score: number;
}

export interface PurityChartProps {
  modules: PurityModule[];
  height?: number;
}

function purityColor(score: number): string {
  if (score >= 0.9) return "#10B981";
  if (score >= 0.7) return "#F59E0B";
  return "#EF4444";
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PurityModule }>;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const mod = payload[0].payload;
  return (
    <div className="bg-li-surface border border-li-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-li-text-primary font-display mb-1">{mod.name}</p>
      <p className="text-xs" style={{ color: purityColor(mod.purity_score) }}>
        Purity: {(mod.purity_score * 100).toFixed(1)}%
      </p>
    </div>
  );
};

export default function PurityChart({ modules, height = 300 }: PurityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={modules}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 1]}
          stroke="#6B7280"
          tick={{ fill: "#6B7280", fontSize: 11 }}
          axisLine={{ stroke: "#1F2937" }}
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#6B7280"
          tick={{ fill: "#9CA3AF", fontSize: 11 }}
          axisLine={{ stroke: "#1F2937" }}
          width={100}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59,130,246,0.05)" }} />
        <Bar dataKey="purity_score" radius={[0, 4, 4, 0]} barSize={18}>
          {modules.map((mod, idx) => (
            <Cell key={idx} fill={purityColor(mod.purity_score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
