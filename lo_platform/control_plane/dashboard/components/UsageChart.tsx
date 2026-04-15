"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface UsageChartProps {
  data: { date: string; value: number }[];
  label: string;
  color?: string;
  height?: number;
}

export function UsageChart({
  data,
  label,
  color = "#00d4ff",
  height = 200,
}: UsageChartProps) {
  return (
    <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
        {label}
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b6b80", fontSize: 11 }}
            axisLine={{ stroke: "#1e1e2e" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6b6b80", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111118",
              border: "1px solid #2a2a3e",
              borderRadius: "6px",
              color: "#e5e5ea",
              fontSize: "12px",
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${label})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
