"use client";

import { useState } from "react";
import {
  METHODOLOGY_STAGES,
  RESULTS_TCD_VS_BASELINE,
  RESULTS_TCD_VS_GNN,
  INTERPRETABLE_MODULES,
  HIDDEN_CONNECTIONS,
} from "@/lib/demo-data";
import { ArrowRight, Zap, Search, Shield, FileText, Link2, Database } from "lucide-react";

const STAGE_ICONS = [Database, Zap, Search, Shield, FileText, ArrowRight];

function TypeDistributionMini() {
  const types = [
    { name: "Organization", count: 218, pct: 42 },
    { name: "Person", count: 142, pct: 27 },
    { name: "Location", count: 89, pct: 17 },
    { name: "Product", count: 45, pct: 9 },
    { name: "Event", count: 25, pct: 5 },
  ];
  const colors = ["#3fb950", "#00d4ff", "#d29922", "#a371f7", "#f85149"];

  return (
    <div className="space-y-3">
      {types.map((t, i) => (
        <div key={t.name} className="flex items-center gap-3">
          <span className="text-xs font-mono text-li-gray-500 w-24">{t.name}</span>
          <div className="flex-1 h-2 bg-li-gray-900 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${t.pct}%`, backgroundColor: colors[i] }}
            />
          </div>
          <span className="text-xs font-mono text-li-gray-400 w-8 text-right">{t.count}</span>
        </div>
      ))}
    </div>
  );
}

function PurityChartMini() {
  const modules = INTERPRETABLE_MODULES;
  return (
    <div className="space-y-2.5">
      {modules.map((m) => (
        <div key={m.name} className="flex items-center gap-3">
          <span className="text-xs font-mono text-li-gray-400 w-28 truncate">{m.name}</span>
          <div className="flex-1 h-2 bg-li-gray-900 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${m.purity}%`,
                backgroundColor: m.purity >= 95 ? "#3fb950" : m.purity >= 80 ? "#d29922" : "#f85149",
              }}
            />
          </div>
          <span className="text-xs font-mono text-white w-10 text-right">{m.purity}%</span>
        </div>
      ))}
    </div>
  );
}

function ResultsTableMini() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-li-gray-500 border-b border-li-gray-900">
            <th className="text-left py-2 pr-3">Dataset</th>
            <th className="text-right py-2 px-2">TCD</th>
            <th className="text-right py-2 px-2">Baseline</th>
            <th className="text-right py-2 pl-2">Gain</th>
          </tr>
        </thead>
        <tbody>
          {RESULTS_TCD_VS_BASELINE.map((r) => (
            <tr key={r.dataset} className="border-b border-li-gray-900/50">
              <td className="py-2 pr-3 text-li-gray-400">{r.dataset}</td>
              <td className="py-2 px-2 text-right text-white font-medium">{r.tcdAuc}%</td>
              <td className="py-2 px-2 text-right text-li-gray-500">{r.baselineAuc}%</td>
              <td className="py-2 pl-2 text-right text-li-green">+{r.improvement}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GNNComparisonMini() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-li-gray-500 border-b border-li-gray-900">
            <th className="text-left py-2 pr-2">Method</th>
            <th className="text-right py-2 px-1">Semi</th>
            <th className="text-right py-2 px-1">GDELT</th>
            <th className="text-right py-2 pl-1">SEC</th>
          </tr>
        </thead>
        <tbody>
          {RESULTS_TCD_VS_GNN.map((r) => {
            const isTCD = r.method === "TCD-JEPA";
            return (
              <tr key={r.method} className={`border-b border-li-gray-900/50 ${isTCD ? "bg-white/5" : ""}`}>
                <td className={`py-1.5 pr-2 ${isTCD ? "text-white font-medium" : "text-li-gray-400"}`}>
                  {r.method}
                </td>
                <td className={`py-1.5 px-1 text-right ${isTCD ? "text-white font-medium" : "text-white"}`}>
                  {r.semi}%
                </td>
                <td className="py-1.5 px-1 text-right text-white">{r.gdelt}%</td>
                <td className="py-1.5 pl-1 text-right text-white">{r.sec ? `${r.sec}%` : "OOM"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HiddenConnectionsMini() {
  return (
    <div className="space-y-3">
      {HIDDEN_CONNECTIONS.map((c, i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-li-depth-1 border border-li-border-accent rounded-lg">
          <Link2 className="w-3.5 h-3.5 text-li-warm mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-mono text-white">
              {c.source} <span className="text-li-warm">↔</span> {c.target}
            </p>
            <p className="text-[10px] text-li-gray-500 mt-0.5">{c.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChallengeUIMini() {
  return (
    <div className="space-y-3">
      <div className="p-3 bg-li-depth-1 border border-li-yellow/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-li-yellow" />
          <span className="text-xs font-mono text-li-yellow">Challenge #7</span>
          <span className="text-[10px] text-li-gray-500 ml-auto">Pending Review</span>
        </div>
        <p className="text-xs text-li-gray-400">
          School-crime nexus module (8 EDU + 7 CRM) — should &quot;School Board&quot; entity be in GOV module instead?
        </p>
        <div className="flex gap-2 mt-3">
          <span className="px-2 py-0.5 bg-li-green/10 text-li-green text-[10px] font-mono rounded">Validate</span>
          <span className="px-2 py-0.5 bg-li-red/10 text-li-red text-[10px] font-mono rounded">Invalidate</span>
          <span className="px-2 py-0.5 bg-white/10 text-white text-[10px] font-mono rounded">Reassign</span>
        </div>
      </div>
      <div className="p-3 bg-li-depth-1 border border-li-green/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-li-green" />
          <span className="text-xs font-mono text-li-green">Challenge #3</span>
          <span className="text-[10px] text-li-gray-500 ml-auto">Resolved</span>
        </div>
        <p className="text-xs text-li-gray-400">
          Health department cluster validated — 15/15 GOV entities confirmed pure specialization.
        </p>
      </div>
    </div>
  );
}

function LineageMini() {
  const steps = [
    { label: "Source CSV", type: "data", color: "#00d4ff" },
    { label: "Ingestion", type: "process", color: "#3fb950" },
    { label: "Validation", type: "process", color: "#3fb950" },
    { label: "Crystallization", type: "process", color: "#a371f7" },
    { label: "Modules", type: "data", color: "#d29922" },
    { label: "Report", type: "data", color: "#f85149" },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className={`px-3 py-1.5 text-[10px] font-mono border ${
              s.type === "data" ? "rounded-full" : "rounded-md"
            }`}
            style={{ borderColor: s.color + "40", color: s.color }}
          >
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="w-3 h-3 text-li-gray-600 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// Stage visualization components
const STAGE_VISUALIZATIONS: Record<string, React.ReactNode> = {
  "01": <TypeDistributionMini />,
  "02": <ResultsTableMini />,
  "03": <PurityChartMini />,
  "04": <ChallengeUIMini />,
  "05": <LineageMini />,
  "06": (
    <div className="space-y-4">
      <GNNComparisonMini />
      <div className="pt-3 border-t border-li-gray-900">
        <p className="data-label mb-2">Hidden Connections Discovered</p>
        <HiddenConnectionsMini />
      </div>
    </div>
  ),
};

export function MethodologyWalkthrough() {
  const [activeStep, setActiveStep] = useState(0);
  const stage = METHODOLOGY_STAGES[activeStep];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 border border-li-gray-900 overflow-hidden">
      {/* Step List (left) */}
      <div className="bg-li-depth-1 border-r border-li-gray-900 lg:border-b-0 border-b">
        <div className="lg:py-2">
          {METHODOLOGY_STAGES.map((s, i) => {
            const Icon = STAGE_ICONS[i];
            const isActive = i === activeStep;

            return (
              <button
                key={s.num}
                onClick={() => setActiveStep(i)}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-all duration-300 border-l-2 ${
                  isActive
                    ? "bg-li-black-light border-l-white"
                    : "border-l-transparent hover:bg-li-black-light/50"
                }`}
              >
                <span
                  className="font-mono text-xs font-medium"
                  style={{ color: isActive ? s.color : "#525252" }}
                >
                  {s.num}
                </span>
                <span className={`text-sm transition-colors duration-300 ${isActive ? "text-white" : "text-li-gray-500"}`}>
                  {s.title}
                </span>
                {isActive && <Icon className="w-3.5 h-3.5 ml-auto" style={{ color: s.color }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Panel (right) */}
      <div className="bg-li-black p-8 md:p-10 min-h-[500px]">
        <div key={stage.num} className="animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-sm font-medium" style={{ color: stage.color }}>
              {stage.num}
            </span>
            <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${stage.color}30, transparent)` }} />
          </div>
          <h3 className="font-display text-2xl text-white mb-3" style={{ letterSpacing: "-0.02em" }}>
            {stage.title}
          </h3>
          <p className="body-text mb-6 max-w-lg">{stage.detail}</p>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {stage.stats.map((stat) => (
              <div key={stat.label} className="p-3 bg-li-depth-2 border border-li-border-accent rounded-lg">
                <p className="data-label">{stat.label}</p>
                <p className="font-mono text-sm font-medium text-white mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Visualization */}
          <div className="p-4 bg-li-depth-1 border border-li-border-accent rounded-lg">
            <p className="data-label mb-4">
              {stage.num === "01" && "Entity Type Distribution"}
              {stage.num === "02" && "TCD-JEPA vs Baseline (Link AUC)"}
              {stage.num === "03" && "Module Purity Scores"}
              {stage.num === "04" && "Contestation Workflow"}
              {stage.num === "05" && "W3C PROV Lineage Trace"}
              {stage.num === "06" && "Benchmark Results & Hidden Connections"}
            </p>
            {STAGE_VISUALIZATIONS[stage.num]}
          </div>
        </div>
      </div>
    </div>
  );
}
