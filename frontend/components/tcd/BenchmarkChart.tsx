"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const BENCHMARKS = [
  { name: "TCD-JEPA", auc: 82.7, color: "#00d4ff" },
  { name: "JEPA", auc: 72.0, color: "#6366f1" },
  { name: "GAT", auc: 70.3, color: "#8b5cf6" },
  { name: "GraphSAGE", auc: 67.1, color: "#a78bfa" },
  { name: "GCN", auc: 63.9, color: "#c4b5fd" },
];

export default function BenchmarkChart() {
  return (
    <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg p-4">
      <h3 className="text-[10px] uppercase tracking-widest text-li-text-muted mb-1">
        Semiconductor Supply Chain Benchmark
      </h3>
      <p className="text-[9px] text-li-text-muted mb-3">Link Prediction AUC (%)</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={BENCHMARKS} layout="vertical" margin={{ left: 70, right: 20 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#666", fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: "#aaa", fontSize: 11 }} width={70} />
          <Tooltip
            contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #1a1a2e", borderRadius: 8 }}
            formatter={(val: number) => [`${val}%`, "Link AUC"]}
          />
          <Bar dataKey="auc" radius={[0, 4, 4, 0]} barSize={18}>
            {BENCHMARKS.map((b, i) => (
              <Cell key={i} fill={b.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
