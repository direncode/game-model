"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import {
  dataLayerClient,
  formatCost,
  formatReduction,
  describeCoverage,
  type SourceInfo,
  type RunResponse,
  type LinkResponse,
  type QualityMetrics,
  type VerticalName,
} from "@/lib/data-layer";

// ── Sub-components ──────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-li-depth-1 border border-li-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-widest text-li-text-muted mb-1">{label}</div>
      <div className="text-2xl font-mono font-bold text-li-text-primary">{value}</div>
      {sub && <div className="text-xs text-li-text-secondary mt-1">{sub}</div>}
    </div>
  );
}

function QualityPanel({ q }: { q: QualityMetrics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard label="Input" value={q.n_input.toLocaleString()} />
      <MetricCard label="Survivors" value={q.n_survivors.toLocaleString()} sub={formatReduction(q.reduction_ratio)} />
      <MetricCard label="Coverage @ 1.0" value={q.coverage_at_1_0.toFixed(3)} sub={describeCoverage(q.coverage_at_1_0)} />
      <MetricCard label="Variance Ratio" value={q.variance_ratio.toFixed(3)} sub="var(surv)/var(input)" />
      <MetricCard label="Median NN" value={q.reconstruction_median_nn.toFixed(3)} sub="reconstruction" />
      <MetricCard label="Clusters" value={q.n_clusters.toString()} />
      <MetricCard label="Fingerprints" value={q.unique_fingerprints.toString()} />
      <MetricCard label="Cost" value={formatCost(q.estimated_cost_usd)} sub={`wall: ${q.wall_seconds.toFixed(1)}s`} />
    </div>
  );
}

function CostBreakdownPanel({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <div className="bg-li-depth-1 border border-li-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-widest text-li-text-muted mb-3">Cost Breakdown</div>
      <div className="space-y-2">
        {Object.entries(breakdown).map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span className="text-li-text-secondary font-mono">{k.replace(/_/g, " ")}</span>
            <span className="text-li-text-primary font-mono">${v.toFixed(6)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sources tab ─────────────────────────────────────────────────────

function SourcesTab() {
  const { data: sources, isLoading } = useQuery({
    queryKey: ["data-layer", "sources"],
    queryFn: () => dataLayerClient.listSources(),
  });

  if (isLoading) return <div className="text-li-text-muted animate-pulse p-8">Loading sources...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {(sources ?? []).map((s: SourceInfo) => (
        <div key={s.id} className="bg-li-depth-1 border border-li-border rounded-lg p-5 hover:border-li-cyan/40 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-li-cyan" />
            <h3 className="text-sm font-medium text-li-text-primary">{s.name}</h3>
          </div>
          <p className="text-xs text-li-text-secondary mb-3 line-clamp-2">{s.description}</p>
          <div className="flex items-center gap-3 text-[10px] text-li-text-muted uppercase tracking-wider">
            <span>{s.id}</span>
            <span>{s.lookup_label}: {s.lookup_field}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Run Pipeline tab ────────────────────────────────────────────────

function RunTab() {
  const [source, setSource] = useState("edgar");
  const [limit, setLimit] = useState(500);
  const [target, setTarget] = useState(100);
  const [vertical, setVertical] = useState<VerticalName | "">("");

  const run = useMutation({
    mutationFn: () =>
      dataLayerClient.run({
        source,
        limit,
        target_survivors: target,
        vertical: vertical || undefined,
      }),
  });

  return (
    <div className="space-y-6">
      {/* Config form */}
      <div className="bg-li-depth-1 border border-li-border rounded-lg p-5">
        <h3 className="text-sm font-medium text-li-text-primary mb-4">Pipeline Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-li-text-muted mb-1">Source</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full bg-li-depth-2 border border-li-border rounded px-3 py-2 text-sm text-li-text-primary font-mono">
              {["edgar", "pubmed", "patents", "comtrade", "climate"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-li-text-muted mb-1">Limit</label>
            <input type="number" value={limit} onChange={e => setLimit(+e.target.value)}
              className="w-full bg-li-depth-2 border border-li-border rounded px-3 py-2 text-sm text-li-text-primary font-mono" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-li-text-muted mb-1">Target Survivors</label>
            <input type="number" value={target} onChange={e => setTarget(+e.target.value)}
              className="w-full bg-li-depth-2 border border-li-border rounded px-3 py-2 text-sm text-li-text-primary font-mono" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-li-text-muted mb-1">Vertical</label>
            <select value={vertical} onChange={e => setVertical(e.target.value as VerticalName | "")}
              className="w-full bg-li-depth-2 border border-li-border rounded px-3 py-2 text-sm text-li-text-primary font-mono">
              <option value="">None (summary only)</option>
              <option value="niv">NIV (finance)</option>
              <option value="tcd_jepa">TCD-JEPA (AI)</option>
              <option value="data">Data (full audit)</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="mt-4 px-6 py-2 bg-li-cyan text-black text-sm font-medium rounded hover:bg-li-cyan/80 disabled:opacity-50 transition-colors"
        >
          {run.isPending ? "Running pipeline..." : "Run Pipeline"}
        </button>
      </div>

      {/* Results */}
      {run.isError && (
        <div className="bg-li-red/10 border border-li-red/30 rounded-lg p-4 text-sm text-li-red">
          Error: {(run.error as Error).message}
        </div>
      )}

      {run.data && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-li-green" />
            <h3 className="text-sm font-medium text-li-text-primary">
              {run.data.dataset_id} — Pipeline Complete
            </h3>
          </div>
          <QualityPanel q={run.data.quality} />
          <CostBreakdownPanel breakdown={run.data.quality.cost_breakdown} />
        </div>
      )}
    </div>
  );
}

// ── Link tab ────────────────────────────────────────────────────────

function LinkTab() {
  const [sourceA, setSourceA] = useState("edgar");
  const [sourceB, setSourceB] = useState("pubmed");
  const [limit, setLimit] = useState(500);
  const [threshold, setThreshold] = useState(0.75);

  const link = useMutation({
    mutationFn: () =>
      dataLayerClient.link({
        source_a: sourceA,
        source_b: sourceB,
        limit,
        cosine_threshold: threshold,
      }),
  });

  return (
    <div className="space-y-6">
      <div className="bg-li-depth-1 border border-li-border rounded-lg p-5">
        <h3 className="text-sm font-medium text-li-text-primary mb-4">Cross-Source Linking</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-li-text-muted mb-1">Source A</label>
            <select value={sourceA} onChange={e => setSourceA(e.target.value)}
              className="w-full bg-li-depth-2 border border-li-border rounded px-3 py-2 text-sm text-li-text-primary font-mono">
              {["edgar", "pubmed", "patents", "comtrade", "climate"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-li-text-muted mb-1">Source B</label>
            <select value={sourceB} onChange={e => setSourceB(e.target.value)}
              className="w-full bg-li-depth-2 border border-li-border rounded px-3 py-2 text-sm text-li-text-primary font-mono">
              {["edgar", "pubmed", "patents", "comtrade", "climate"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-li-text-muted mb-1">Limit (each)</label>
            <input type="number" value={limit} onChange={e => setLimit(+e.target.value)}
              className="w-full bg-li-depth-2 border border-li-border rounded px-3 py-2 text-sm text-li-text-primary font-mono" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-li-text-muted mb-1">Cosine Threshold</label>
            <input type="number" step="0.05" min="0" max="1" value={threshold}
              onChange={e => setThreshold(+e.target.value)}
              className="w-full bg-li-depth-2 border border-li-border rounded px-3 py-2 text-sm text-li-text-primary font-mono" />
          </div>
        </div>
        <button
          onClick={() => link.mutate()}
          disabled={link.isPending}
          className="mt-4 px-6 py-2 bg-li-purple text-white text-sm font-medium rounded hover:bg-li-purple/80 disabled:opacity-50 transition-colors"
        >
          {link.isPending ? "Linking..." : "Run Cross-Source Link"}
        </button>
      </div>

      {link.isError && (
        <div className="bg-li-red/10 border border-li-red/30 rounded-lg p-4 text-sm text-li-red">
          Error: {(link.error as Error).message}
        </div>
      )}

      {link.data && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-li-purple" />
            <h3 className="text-sm font-medium text-li-text-primary">
              {link.data.dataset_a} x {link.data.dataset_b} — {link.data.n_links} links
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted mb-2">Quality A</div>
              <QualityPanel q={link.data.quality_a} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted mb-2">Quality B</div>
              <QualityPanel q={link.data.quality_b} />
            </div>
          </div>

          {/* Signal breakdown */}
          <div className="bg-li-depth-1 border border-li-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-widest text-li-text-muted mb-3">Links by Signal</div>
            <div className="flex gap-6">
              {Object.entries(link.data.links_by_signal).map(([sig, count]) => (
                <div key={sig} className="text-center">
                  <div className="text-xl font-mono font-bold text-li-text-primary">{count}</div>
                  <div className="text-[10px] text-li-text-muted uppercase">{sig}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top links table */}
          <div className="bg-li-depth-1 border border-li-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-li-border">
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest text-li-text-muted">Source A</th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest text-li-text-muted">Source B</th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest text-li-text-muted">Signal</th>
                  <th className="px-4 py-2 text-right text-[10px] uppercase tracking-widest text-li-text-muted">Strength</th>
                </tr>
              </thead>
              <tbody>
                {link.data.links.slice(0, 20).map((lk, i) => (
                  <tr key={i} className="border-b border-li-border/50 hover:bg-li-depth-2/50">
                    <td className="px-4 py-2 text-li-text-primary font-mono text-xs">{lk.source_a}</td>
                    <td className="px-4 py-2 text-li-text-primary font-mono text-xs">{lk.source_b}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        lk.signal === "cosine" ? "bg-li-cyan/20 text-li-cyan" :
                        lk.signal === "foreign_key" ? "bg-li-green/20 text-li-green" :
                        lk.signal === "semantic_field" ? "bg-li-purple/20 text-li-purple" :
                        "bg-li-yellow/20 text-li-yellow"
                      }`}>
                        {lk.signal}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-li-text-primary font-mono">{lk.strength.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

const TABS = [
  { id: "sources", label: "Sources" },
  { id: "run", label: "Run Pipeline" },
  { id: "link", label: "Cross-Source Link" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DataLayerPage() {
  const [activeTab, setActiveTab] = useState<TabId>("sources");

  return (
    <div className="flex h-screen bg-li-black">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-li-text-primary">Data Layer</h1>
              <p className="text-sm text-li-text-secondary mt-1">
                Unified ingest &rarr; BTUT &rarr; manifold &rarr; vertical export spine
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-li-border">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "text-li-cyan border-li-cyan"
                      : "text-li-text-muted border-transparent hover:text-li-text-secondary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "sources" && <SourcesTab />}
            {activeTab === "run" && <RunTab />}
            {activeTab === "link" && <LinkTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
