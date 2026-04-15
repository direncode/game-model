"use client";

import { useEffect, useState } from "react";
import { flowEngineApi, GraphState } from "@/lib/flow-engine/api";

const DEMO_GRAPH: GraphState = {
  wells: [
    { well_id: "btut", label: "BTUT Engine", state: "active", saturation: 0.42, conversion: 0.81, impulse: 0.55, staleness: 0.08, alert_level: "normal" },
    { well_id: "tcd_jepa", label: "TCD-JEPA", state: "active", saturation: 0.67, conversion: 0.73, impulse: 0.39, staleness: 0.15, alert_level: "normal" },
    { well_id: "data_estate", label: "Data Estate", state: "active", saturation: 0.31, conversion: 0.88, impulse: 0.62, staleness: 0.05, alert_level: "normal" },
    { well_id: "dunc", label: "DUNC Simulator", state: "saturated", saturation: 0.93, conversion: 0.45, impulse: 0.78, staleness: 0.12, alert_level: "critical" },
  ],
  wires: [
    { source: "btut", sink: "tcd_jepa", state: "flowing", liquidity: 90.0, friction: 0.032 },
    { source: "tcd_jepa", sink: "data_estate", state: "flowing", liquidity: 65.7, friction: 0.078 },
    { source: "btut", sink: "dunc", state: "throttled", liquidity: 22.4, friction: 0.210 },
    { source: "data_estate", sink: "dunc", state: "flowing", liquidity: 55.2, friction: 0.045 },
  ],
  metrics: { resilience: 2, circulation_rate: 233.3, saturation_pressure: 0.351, friction_index: 0.072 },
};

export default function FlowEnginePage() {
  const [graph, setGraph] = useState<GraphState | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await flowEngineApi.graphState();
        setGraph(data);
      } catch {
        setGraph(DEMO_GRAPH);
        setDemo(true);
      }
    };
    load();
    const interval = setInterval(load, demo ? 60000 : 5000);
    return () => clearInterval(interval);
  }, [demo]);

  if (!graph) return <div className="p-6 text-zinc-400">Loading flow graph...</div>;

  const m = graph.metrics;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Flow Engine</h1>
        {demo && (
          <span className="text-xs px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-800">
            Demo Data
          </span>
        )}
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Resilience", value: m.resilience },
          { label: "Circulation", value: m.circulation_rate.toFixed(1) },
          { label: "Saturation Pressure", value: m.saturation_pressure.toFixed(3) },
          { label: "Friction Index", value: m.friction_index.toFixed(3) },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</div>
            <div className="text-2xl font-mono mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Wells */}
      <h2 className="text-lg font-semibold mb-3">Wells</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {graph.wells.map((w) => (
          <div key={w.well_id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{w.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                w.alert_level === "critical" ? "bg-red-900 text-red-300" :
                w.alert_level === "warning" ? "bg-amber-900 text-amber-300" :
                w.alert_level === "elevated" ? "bg-yellow-900 text-yellow-300" :
                "bg-zinc-800 text-zinc-400"
              }`}>{w.state}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
              <span>Saturation: {(w.saturation * 100).toFixed(0)}%</span>
              <span>Conversion: {(w.conversion * 100).toFixed(0)}%</span>
              <span>Impulse: {(w.impulse * 100).toFixed(0)}%</span>
              <span>Staleness: {(w.staleness * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Wires */}
      <h2 className="text-lg font-semibold mb-3">Wires</h2>
      <div className="space-y-2">
        {graph.wires.map((w, i) => (
          <div key={i} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 flex items-center gap-4">
            <span className="font-mono text-sm">{w.source}</span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="font-mono text-sm">{w.sink}</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
              w.state === "blocked" ? "bg-red-900 text-red-300" :
              w.state === "throttled" ? "bg-amber-900 text-amber-300" :
              "bg-emerald-900 text-emerald-300"
            }`}>{w.state}</span>
            <span className="text-xs text-zinc-500">liq: {w.liquidity.toFixed(1)}</span>
            <span className="text-xs text-zinc-500">fric: {w.friction.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
