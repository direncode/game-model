"use client";

import { Package, BarChart3, Activity, Layers, Zap, AlertTriangle } from "lucide-react";
import { useTCDStore } from "@/lib/tcd/store";

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: any; accent: string }) {
  return (
    <div className="bg-li-gray-900/60 border border-li-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="text-[10px] uppercase tracking-widest text-li-text-muted">{label}</span>
      </div>
      <div className="text-xl font-bold text-white font-mono">{value}</div>
    </div>
  );
}

export default function StatCardGrid() {
  const modules = useTCDStore((s) => s.modules);
  const intelligence = useTCDStore((s) => s.intelligence);
  const convergence = useTCDStore((s) => s.convergenceHistory);

  const n = modules.length;
  const avgPurity = n > 0 ? (modules.reduce((s, m) => s + m.purity, 0) / n * 100).toFixed(1) + "%" : "--";
  const lastAuc = convergence.length > 0 ? (convergence[convergence.length - 1].link_auc * 100).toFixed(1) + "%" : "--";
  const causalCount = (intelligence.causal || []).length;
  const gapCount = (intelligence.topological || []).filter((i) => i.category === "knowledge_gap").length;
  const totalInsights = Object.values(intelligence).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="grid grid-cols-6 gap-3">
      <StatCard label="Modules" value={n} icon={Package} accent="text-cyan-400" />
      <StatCard label="Avg Purity" value={avgPurity} icon={BarChart3} accent="text-green-400" />
      <StatCard label="Link AUC" value={lastAuc} icon={Activity} accent="text-amber-400" />
      <StatCard label="Insights" value={totalInsights} icon={Layers} accent="text-purple-400" />
      <StatCard label="Causal Chains" value={causalCount} icon={Zap} accent="text-blue-400" />
      <StatCard label="Knowledge Gaps" value={gapCount} icon={AlertTriangle} accent="text-red-400" />
    </div>
  );
}
