"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface TrainingMetric {
  epoch: number;
  loss?: number;
  link_auc?: number;
  knn_accuracy?: number;
}

export interface TrainingProgressProps {
  data: TrainingMetric[];
  height?: number;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-li-surface border border-li-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-li-text-muted font-display mb-1">
        Epoch {label}
      </p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(4)}
        </p>
      ))}
    </div>
  );
};

export default function TrainingProgress({
  data,
  height = 300,
}: TrainingProgressProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
        <XAxis
          dataKey="epoch"
          stroke="#6B7280"
          tick={{ fill: "#6B7280", fontSize: 11 }}
          axisLine={{ stroke: "#1F2937" }}
        />
        <YAxis
          stroke="#6B7280"
          tick={{ fill: "#6B7280", fontSize: 11 }}
          axisLine={{ stroke: "#1F2937" }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#9CA3AF" }}
        />
        <Line
          type="monotone"
          dataKey="loss"
          name="Loss"
          stroke="#EF4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="link_auc"
          name="Link AUC"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="knn_accuracy"
          name="KNN Accuracy"
          stroke="#10B981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
