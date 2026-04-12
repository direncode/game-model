"use client";

import React from "react";

const SOURCE_COLORS: Record<string, string> = {
  edgar: "#00d4ff",
  pubmed: "#3fb950",
  patents: "#a371f7",
  comtrade: "#d29922",
  climate: "#388bfd",
  tesla: "#f85149",
};

interface BenchmarkRow {
  source: string;
  n_input: number;
  n_survivors: number;
  reduction_ratio: number;
  coverage_at_1_0: number;
  variance_ratio: number;
  n_clusters: number;
  wall_seconds: number;
  cost_usd: number;
}

export interface OceanBenchmarkProps {
  benchmark: BenchmarkRow[];
  totalCost: number;
  totalWall: number;
}

function coverageColor(v: number): string {
  if (v >= 0.9) return "text-li-green";
  if (v >= 0.7) return "text-li-yellow";
  return "text-li-red";
}

export default function OceanBenchmark({ benchmark, totalCost, totalWall }: OceanBenchmarkProps) {
  const totalInput = benchmark.reduce((s, r) => s + r.n_input, 0);
  const totalSurvivors = benchmark.reduce((s, r) => s + r.n_survivors, 0);

  return (
    <div className="bg-li-depth-1 border border-li-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-li-border">
            {["Source", "Input", "Survivors", "Reduction", "Coverage", "Variance", "Clusters", "Wall (s)", "Cost ($)"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-li-text-muted"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {benchmark.map((row) => (
            <tr key={row.source} className="border-b border-li-border/50 hover:bg-li-depth-2/50">
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: SOURCE_COLORS[row.source] ?? "#6B7280" }}
                  />
                  <span className="text-li-text-primary font-mono text-xs">{row.source}</span>
                </div>
              </td>
              <td className="px-4 py-2 text-li-text-primary font-mono text-xs">
                {row.n_input.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-li-text-primary font-mono text-xs">
                {row.n_survivors.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-li-text-primary font-mono text-xs">
                {row.reduction_ratio.toFixed(1)}x
              </td>
              <td className={`px-4 py-2 font-mono text-xs ${coverageColor(row.coverage_at_1_0)}`}>
                {row.coverage_at_1_0.toFixed(3)}
              </td>
              <td className="px-4 py-2 text-li-text-primary font-mono text-xs">
                {row.variance_ratio.toFixed(3)}
              </td>
              <td className="px-4 py-2 text-li-text-primary font-mono text-xs">
                {row.n_clusters}
              </td>
              <td className="px-4 py-2 text-li-text-primary font-mono text-xs">
                {row.wall_seconds.toFixed(1)}
              </td>
              <td className="px-4 py-2 text-li-text-primary font-mono text-xs">
                ${row.cost_usd.toFixed(6)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-li-border bg-li-depth-2/30">
            <td className="px-4 py-3 text-li-text-primary font-mono text-xs font-bold">Total</td>
            <td className="px-4 py-3 text-li-text-primary font-mono text-xs font-bold">
              {totalInput.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-li-text-primary font-mono text-xs font-bold">
              {totalSurvivors.toLocaleString()}
            </td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3" />
            <td className="px-4 py-3" />
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-li-text-primary font-mono text-xs font-bold">
              {totalWall.toFixed(1)}
            </td>
            <td className="px-4 py-3 text-li-text-primary font-mono text-xs font-bold">
              ${totalCost.toFixed(6)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
