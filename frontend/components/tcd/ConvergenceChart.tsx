"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useTCDStore } from "@/lib/tcd/store";

export default function ConvergenceChart() {
  const data = useTCDStore((s) => s.convergenceHistory);

  if (data.length === 0) {
    return (
      <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg p-4 h-64 flex items-center justify-center text-li-text-muted text-sm">
        Convergence data will appear during crystallization
      </div>
    );
  }

  return (
    <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg p-4">
      <h3 className="text-[10px] uppercase tracking-widest text-li-text-muted mb-3">
        Convergence (Loss + Link AUC + Module Count)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          <XAxis dataKey="epoch" tick={{ fill: "#666", fontSize: 10 }} />
          <YAxis yAxisId="loss" tick={{ fill: "#666", fontSize: 10 }} domain={[0, "auto"]} />
          <YAxis yAxisId="auc" orientation="right" tick={{ fill: "#666", fontSize: 10 }} domain={[0, 1]} />
          <Tooltip
            contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #1a1a2e", borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: "#888" }}
          />
          <Line yAxisId="loss" type="monotone" dataKey="loss" stroke="#00d4ff" strokeWidth={2} dot={false} name="Loss" />
          <Line yAxisId="auc" type="monotone" dataKey="link_auc" stroke="#f59e0b" strokeWidth={2} dot={false} name="Link AUC" />
          <Line yAxisId="loss" type="stepAfter" dataKey="module_count" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Modules" strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
