"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface TypeDistributionProps {
  distribution: Record<string, number>;
  height?: number;
}

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#14B8A6",
  "#6366F1",
];

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="bg-li-surface border border-li-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-li-text-primary">{entry.name}</p>
      <p className="text-xs font-display" style={{ color: entry.payload.fill }}>
        {entry.value.toLocaleString()}
      </p>
    </div>
  );
};

export default function TypeDistribution({
  distribution,
  height = 300,
}: TypeDistributionProps) {
  const data = Object.entries(distribution).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
          stroke="none"
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs text-li-text-secondary">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
