"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";
import {
  BrainCircuit,
  Activity,
  Layers,
  Fingerprint,
  Users,
  Search,
  ChevronRight,
  ArrowUpDown,
  Zap,
  Target,
  Gauge,
  X,
  SlidersHorizontal,
  BarChart3,
  GitCompare,
  AlertTriangle,
  Terminal,
  Filter,
} from "lucide-react";
import type {
  BTUTStatus,
  BTUTSurvivor,
  BTUTAnalysis,
  BTUTCluster,
  BTUTSearchHit,
} from "@/lib/types";

// ── Tab definitions ─────────────────────────────────────────────────
type Tab = "overview" | "survivors" | "query" | "clusters" | "compare" | "anomalies" | "search";

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "survivors", label: "Survivors", icon: Target },
  { id: "query", label: "Query", icon: SlidersHorizontal },
  { id: "clusters", label: "Clusters", icon: Layers },
  { id: "compare", label: "Compare", icon: GitCompare },
  { id: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { id: "search", label: "Search", icon: Search },
];

// ── Score bar component ─────────────────────────────────────────────
function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-li-text-muted">{label}</span>
        <span className="font-mono text-li-text-primary">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-li-gray-900 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

// ── Fingerprint visualizer ──────────────────────────────────────────
function FingerprintViz({ fingerprint }: { fingerprint: string }) {
  return (
    <div className="flex gap-[1px] items-center">
      {fingerprint.split("").map((bit, i) => (
        <div
          key={i}
          className={cn(
            "w-[6px] h-4 rounded-[1px] transition-colors",
            bit === "1" ? "bg-li-cyan" : "bg-li-gray-800",
            i === 15 || i === 31 ? "ml-1" : "",
          )}
          title={`Rotation ${i + 1}: ${bit === "1" ? "flipped" : "stable"}`}
        />
      ))}
    </div>
  );
}

// ── Type badge ──────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    company: "bg-li-cyan/10 text-li-cyan border-li-cyan/20",
    filing: "bg-li-purple/10 text-li-purple border-li-purple/20",
    financial_fact: "bg-li-green/10 text-li-green border-li-green/20",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono uppercase border", colors[type] || "bg-li-gray-800 text-li-text-muted border-li-gray-700")}>
      {type.replace("_", " ")}
    </span>
  );
}

// ── Survivor detail panel ───────────────────────────────────────────
function SurvivorDetail({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["btut-analyze", ticker],
    queryFn: () => api.getBTUTAnalysis(ticker),
    enabled: !!ticker,
  });

  if (isLoading) {
    return (
      <div className="li-card p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-li-gray-800 rounded w-1/3" />
        <div className="h-4 bg-li-gray-800 rounded w-2/3" />
        <div className="h-20 bg-li-gray-800 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const a = data as BTUTAnalysis;
  return (
    <div className="li-card p-6 space-y-6 border border-li-cyan/20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-display text-li-text-primary">{a.company_name}</h2>
            <span className="font-mono text-li-cyan text-sm">{a.ticker}</span>
            <TypeBadge type={a.entity_type} />
          </div>
          <p className="text-xs text-li-text-muted font-mono mt-1">CIK {a.cik}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-li-gray-800 text-li-text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-mono font-bold text-li-cyan">{(a.scores.composite * 100).toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-wider text-li-text-muted">Composite</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-mono font-bold text-li-green">{(a.scores.diversity * 100).toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-wider text-li-text-muted">Diversity</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-mono font-bold text-li-blue">{(a.scores.reconstruction * 100).toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-wider text-li-text-muted">Reconstruction</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-mono font-bold text-li-red">{(a.scores.anomaly * 100).toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-wider text-li-text-muted">Anomaly</div>
        </div>
      </div>

      {/* Lattice Profile */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-li-text-muted">48-bit Lattice Fingerprint</h3>
        <FingerprintViz fingerprint={a.lattice_profile.fingerprint_48bit} />
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-li-gray-900 rounded p-2">
            <div className="text-li-text-muted mb-1">Coarse (4-bin)</div>
            <div className="font-mono text-li-text-secondary">{a.lattice_profile.coarse_resolution}</div>
          </div>
          <div className="bg-li-gray-900 rounded p-2">
            <div className="text-li-text-muted mb-1">Medium (8-bin)</div>
            <div className="font-mono text-li-text-secondary">{a.lattice_profile.medium_resolution}</div>
          </div>
          <div className="bg-li-gray-900 rounded p-2">
            <div className="text-li-text-muted mb-1">Fine (16-bin)</div>
            <div className="font-mono text-li-text-secondary">{a.lattice_profile.fine_resolution}</div>
          </div>
        </div>
        <div className="text-xs text-li-text-muted">
          {a.lattice_profile.total_flips}/{a.lattice_profile.total_rotations} flips ({(a.lattice_profile.flip_rate * 100).toFixed(0)}%)
        </div>
      </div>

      {/* Cluster Peers */}
      {a.cluster.peers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-li-text-muted">
            Cluster {a.cluster.id} ({a.cluster.total_members} members)
          </h3>
          <div className="space-y-1">
            {a.cluster.peers.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-li-gray-900 rounded px-3 py-1.5">
                <div className="flex items-center gap-2">
                  {p.ticker && <span className="font-mono text-li-cyan">{p.ticker}</span>}
                  <span className="text-li-text-secondary">{p.name}</span>
                  <TypeBadge type={p.type} />
                </div>
                <span className="font-mono text-li-text-muted">{p.composite.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomaly Story */}
      <div className="bg-li-red/5 border border-li-red/10 rounded-lg p-4">
        <h3 className="text-xs uppercase tracking-wider text-li-red mb-2">Anomaly Narrative</h3>
        <p className="text-sm text-li-text-secondary leading-relaxed">{a.anomaly_story}</p>
      </div>

      {/* ── ENRICHED METADATA ──────────────────────────────── */}
      {(a as any).metadata && (() => {
        const m = (a as any).metadata;
        return (
          <>
            {/* Structural Role */}
            {m.structural_role && (
              <div className="flex items-center gap-3 bg-li-cyan/5 border border-li-cyan/10 rounded-lg p-4">
                <span className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-li-cyan/20 text-li-cyan border border-li-cyan/30">
                  {m.structural_role.role}
                </span>
                <span className="text-sm text-li-text-secondary">{m.structural_role.description}</span>
              </div>
            )}

            {/* Signal Decomposition */}
            {m.signal_decomposition && (
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-li-text-muted">Signal Decomposition</h3>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(m.signal_decomposition).map(([axis, d]: [string, any]) => (
                    <div key={axis} className="bg-li-gray-900 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-li-text-muted capitalize">{axis}</span>
                        <span className="text-[10px] font-mono text-li-text-muted">#{d.rank_in_axis} ({d.percentile}%ile)</span>
                      </div>
                      <div className="text-lg font-mono font-bold text-li-text-primary">{(d.raw_score * 100).toFixed(1)}</div>
                      <div className="text-[10px] text-li-text-muted">
                        {d.pct_of_composite}% of composite | weight {(d.weight * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Anomaly Tags */}
            {m.anomaly_taxonomy?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-li-text-muted">Anomaly Tags</h3>
                <div className="space-y-1">
                  {m.anomaly_taxonomy.map((tag: any, i: number) => (
                    <div key={i} className={cn(
                      "flex items-start gap-3 rounded-lg p-3 text-xs",
                      tag.severity === "critical" ? "bg-li-red/10 border border-li-red/20" :
                      tag.severity === "high" ? "bg-li-yellow/10 border border-li-yellow/20" :
                      tag.severity === "medium" ? "bg-li-purple/10 border border-li-purple/20" :
                      "bg-li-gray-900 border border-li-gray-800"
                    )}>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded font-mono text-[9px] font-bold shrink-0",
                        tag.severity === "critical" ? "bg-li-red/20 text-li-red" :
                        tag.severity === "high" ? "bg-li-yellow/20 text-li-yellow" :
                        tag.severity === "medium" ? "bg-li-purple/20 text-li-purple" :
                        "bg-li-gray-800 text-li-text-muted"
                      )}>{tag.tag}</span>
                      <span className="text-li-text-secondary">{tag.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fingerprint Analytics */}
            {m.fingerprint_analytics?.total_bits && (
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-li-text-muted">Fingerprint Analytics</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-li-gray-900 rounded p-2 text-center">
                    <div className="text-sm font-mono text-li-text-primary">{m.fingerprint_analytics.entropy.toFixed(3)}</div>
                    <div className="text-[9px] text-li-text-muted">Entropy</div>
                  </div>
                  <div className="bg-li-gray-900 rounded p-2 text-center">
                    <div className="text-sm font-mono text-li-text-primary">{m.fingerprint_analytics.transitions}</div>
                    <div className="text-[9px] text-li-text-muted">Transitions</div>
                  </div>
                  <div className="bg-li-gray-900 rounded p-2 text-center">
                    <div className="text-sm font-mono text-li-text-primary">{m.fingerprint_analytics.avg_run_length}</div>
                    <div className="text-[9px] text-li-text-muted">Avg Run</div>
                  </div>
                  <div className="bg-li-gray-900 rounded p-2 text-center">
                    <div className="text-sm font-mono text-li-text-primary">{(m.fingerprint_analytics.flip_ratio * 100).toFixed(0)}%</div>
                    <div className="text-[9px] text-li-text-muted">Flip Ratio</div>
                  </div>
                </div>
                <p className="text-[10px] text-li-text-muted italic">{m.fingerprint_analytics.entropy_interpretation}</p>
              </div>
            )}

            {/* Peer Network */}
            {m.peer_network?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-li-text-muted">Nearest Structural Peers</h3>
                <div className="space-y-1">
                  {m.peer_network.map((peer: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-li-gray-900 rounded px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        {peer.ticker && <span className="font-mono text-li-cyan">{peer.ticker}</span>}
                        <span className="text-li-text-secondary">{peer.name}</span>
                        <TypeBadge type={peer.type} />
                        {peer.shared_cluster && <span className="text-[9px] text-li-green">same cluster</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-li-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-li-cyan rounded-full" style={{ width: `${peer.similarity * 100}%` }} />
                        </div>
                        <span className="font-mono text-li-text-muted w-12 text-right">{(peer.similarity * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence + Position */}
            <div className="grid grid-cols-2 gap-4">
              {m.confidence && (
                <div className="bg-li-gray-900 rounded-lg p-4 space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-li-text-muted">Confidence Assessment</h3>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-2xl font-mono font-bold",
                      m.confidence.level === "very_high" ? "text-li-green" :
                      m.confidence.level === "high" ? "text-li-cyan" :
                      m.confidence.level === "medium" ? "text-li-yellow" : "text-li-red"
                    )}>{(m.confidence.score * 100).toFixed(0)}%</span>
                    <span className="text-xs text-li-text-muted uppercase">{m.confidence.level}</span>
                  </div>
                  <div className="space-y-0.5">
                    {m.confidence.factors.map((f: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span className="text-li-text-muted">{f.factor.replace(/_/g, " ")}</span>
                        <span className="font-mono text-li-green">+{(f.impact * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {m.relative_position && (
                <div className="bg-li-gray-900 rounded-lg p-4 space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-li-text-muted">Relative Position</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-li-text-muted">Global rank</span>
                      <span className="font-mono text-li-text-primary">#{m.relative_position.global_rank} of {m.relative_position.type_total > 0 ? '298' : '298'} ({m.relative_position.global_percentile}%ile)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-li-text-muted">Type rank</span>
                      <span className="font-mono text-li-text-primary">#{m.relative_position.type_rank} of {m.relative_position.type_total} ({m.relative_position.type_percentile}%ile)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-li-text-muted">Z-score</span>
                      <span className={cn("font-mono", m.relative_position.composite_z_score > 1 ? "text-li-green" : "text-li-text-primary")}>
                        {m.relative_position.sigma_label}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Data Quality */}
            {m.data_quality && (
              <div className="text-[10px] text-li-text-muted space-x-2">
                {m.data_quality.map((q: string, i: number) => (
                  <span key={i} className={cn(
                    "inline-block px-2 py-0.5 rounded",
                    q.startsWith("CLEAN") ? "bg-li-green/10 text-li-green" : "bg-li-yellow/10 text-li-yellow"
                  )}>{q}</span>
                ))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────
export default function BTUTPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [survivorType, setSurvivorType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Query builder state
  const [qTypes, setQTypes] = useState("");
  const [qMinComposite, setQMinComposite] = useState("");
  const [qMinAnomaly, setQMinAnomaly] = useState("");
  const [qMinFlips, setQMinFlips] = useState("");
  const [qMaxFlips, setQMaxFlips] = useState("");
  const [qHasTicker, setQHasTicker] = useState<string>("");
  const [qSortBy, setQSortBy] = useState("composite");
  const [qSortOrder, setQSortOrder] = useState("desc");
  const [queryTrigger, setQueryTrigger] = useState(0);

  // Compare state
  const [compareInput, setCompareInput] = useState("RIG,OKLO,AMPG");
  const [compareTickers, setCompareTickers] = useState<string[]>([]);

  // Queries
  const statusQ = useQuery({
    queryKey: ["btut-status"],
    queryFn: () => api.getBTUTStatus(),
  });

  const survivorsQ = useQuery({
    queryKey: ["btut-survivors", survivorType],
    queryFn: () => api.getBTUTSurvivors({ top_n: 50, type: survivorType || undefined }),
    enabled: activeTab === "survivors" || activeTab === "overview",
  });

  const clustersQ = useQuery({
    queryKey: ["btut-clusters"],
    queryFn: () => api.getBTUTClusters({ min_size: 2, top_n: 50 }),
    enabled: activeTab === "clusters",
  });

  const searchQ = useQuery({
    queryKey: ["btut-search", searchQuery],
    queryFn: () => api.getBTUTSearch(searchQuery),
    enabled: !!searchQuery && activeTab === "search",
  });

  const advancedQ = useQuery({
    queryKey: ["btut-query", qTypes, qMinComposite, qMinAnomaly, qMinFlips, qMaxFlips, qHasTicker, qSortBy, qSortOrder, queryTrigger],
    queryFn: () => api.getBTUTQuery({
      types: qTypes || undefined,
      min_composite: qMinComposite ? parseFloat(qMinComposite) : undefined,
      min_anomaly: qMinAnomaly ? parseFloat(qMinAnomaly) : undefined,
      min_flips: qMinFlips ? parseInt(qMinFlips) : undefined,
      max_flips: qMaxFlips ? parseInt(qMaxFlips) : undefined,
      has_ticker: qHasTicker === "true" ? true : qHasTicker === "false" ? false : undefined,
      sort_by: qSortBy,
      sort_order: qSortOrder,
      limit: 100,
    }),
    enabled: activeTab === "query" && queryTrigger > 0,
  });

  const compareQ = useQuery({
    queryKey: ["btut-compare", compareTickers],
    queryFn: () => api.getBTUTCompare(compareTickers),
    enabled: activeTab === "compare" && compareTickers.length >= 2,
  });

  const anomaliesQ = useQuery({
    queryKey: ["btut-anomalies"],
    queryFn: () => api.getBTUTAnomalies(30),
    enabled: activeTab === "anomalies",
  });

  const distributionsQ = useQuery({
    queryKey: ["btut-distributions"],
    queryFn: () => api.getBTUTDistributions(),
    enabled: activeTab === "anomalies" || activeTab === "query",
  });

  const status = statusQ.data as BTUTStatus | undefined;

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14">
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="heading-section flex items-center gap-3">
                <BrainCircuit className="w-6 h-6 text-li-cyan" />
                BTUT Intelligence
              </h1>
              <p className="text-sm text-li-text-muted mt-1">
                Mean-field game data reduction engine &mdash; structural signal extraction from SEC EDGAR
              </p>
            </div>
            {status && (
              <div className={cn(
                "px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider",
                status.pipeline_status === "ready"
                  ? "bg-li-green/10 text-li-green border border-li-green/20"
                  : "bg-li-red/10 text-li-red border border-li-red/20",
              )}>
                {status.pipeline_status}
              </div>
            )}
          </div>

          {/* Stat Cards */}
          {status && (
            <div className="grid grid-cols-5 gap-4">
              <StatCard label="Total Entities" value={status.total_entities.toLocaleString()} icon={Users} />
              <StatCard label="Micro-Clusters" value={status.total_clusters.toLocaleString()} icon={Layers} />
              <StatCard label="Fingerprints" value={status.unique_fingerprints.toLocaleString()} icon={Fingerprint} />
              <StatCard label="Survivors" value={status.survivor_count.toLocaleString()} icon={Target} change={`${status.reduction_ratio}x reduction`} />
              <StatCard label="Variance Kept" value={`${((status.reconstruction?.variance_preservation ?? 0) * 100).toFixed(1)}%`} icon={Gauge} change={`${status.wall_seconds.toFixed(1)}s processing`} />
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-li-gray-900">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                  activeTab === tab.id
                    ? "text-li-cyan border-li-cyan"
                    : "text-li-text-muted border-transparent hover:text-li-text-secondary hover:border-li-gray-700",
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {/* ── OVERVIEW ────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <>
                {/* Type distribution */}
                {status?.survivor_types && (
                  <div className="li-card p-6">
                    <h3 className="text-xs uppercase tracking-wider text-li-text-muted mb-4">Survivor Type Distribution</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(status.survivor_types).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between bg-li-gray-900 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <TypeBadge type={type} />
                            <span className="text-sm text-li-text-secondary capitalize">{type.replace("_", " ")}</span>
                          </div>
                          <span className="text-xl font-mono font-bold text-li-text-primary">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top 10 survivors preview */}
                {survivorsQ.data && (
                  <div className="li-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs uppercase tracking-wider text-li-text-muted">Top Survivors by Composite Score</h3>
                      <button onClick={() => setActiveTab("survivors")} className="text-xs text-li-cyan hover:underline flex items-center gap-1">
                        View all <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {(survivorsQ.data.survivors as BTUTSurvivor[]).slice(0, 10).map((sv) => (
                        <button
                          key={sv.rank}
                          onClick={() => sv.ticker && setSelectedTicker(sv.ticker)}
                          className="w-full flex items-center gap-4 px-4 py-2.5 rounded-lg hover:bg-li-gray-900 transition-colors text-left"
                        >
                          <span className="text-xs font-mono text-li-text-muted w-6">{sv.rank}</span>
                          <span className="font-mono text-li-cyan text-sm w-16">{sv.ticker || "-"}</span>
                          <span className="text-sm text-li-text-secondary flex-1 truncate">{sv.name}</span>
                          <TypeBadge type={sv.type} />
                          <span className="font-mono text-sm text-li-text-primary w-16 text-right">{(sv.scores.composite * 100).toFixed(1)}</span>
                          <div className="w-24">
                            <ScoreBar label="" value={sv.scores.anomaly} color="bg-li-red" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected detail */}
                {selectedTicker && (
                  <SurvivorDetail ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
                )}
              </>
            )}

            {/* ── SURVIVORS ───────────────────────────────────────── */}
            {activeTab === "survivors" && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-li-text-muted">Filter:</span>
                  {["", "company", "filing", "financial_fact"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSurvivorType(t)}
                      className={cn(
                        "px-3 py-1 rounded text-xs font-mono transition-colors",
                        survivorType === t
                          ? "bg-li-cyan/10 text-li-cyan border border-li-cyan/20"
                          : "text-li-text-muted hover:text-li-text-secondary bg-li-gray-900",
                      )}
                    >
                      {t || "All"}
                    </button>
                  ))}
                </div>

                {survivorsQ.data && (
                  <div className="space-y-1">
                    {(survivorsQ.data.survivors as BTUTSurvivor[]).map((sv) => (
                      <button
                        key={`${sv.rank}-${sv.name}`}
                        onClick={() => sv.ticker && setSelectedTicker(sv.ticker)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-li-gray-900 transition-colors text-left li-card"
                      >
                        <span className="text-xs font-mono text-li-text-muted w-8">{sv.rank}</span>
                        <span className="font-mono text-li-cyan text-sm w-16">{sv.ticker || "-"}</span>
                        <span className="text-sm text-li-text-secondary flex-1 truncate">{sv.name}</span>
                        <TypeBadge type={sv.type} />
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="text-center w-14">
                            <div className="text-li-text-primary">{(sv.scores.composite * 100).toFixed(1)}</div>
                            <div className="text-li-text-muted text-[9px]">SCORE</div>
                          </div>
                          <div className="text-center w-14">
                            <div className="text-li-red">{(sv.scores.anomaly * 100).toFixed(1)}</div>
                            <div className="text-li-text-muted text-[9px]">ANOMALY</div>
                          </div>
                          <div className="text-center w-14">
                            <div className="text-li-text-muted">{sv.flips}/48</div>
                            <div className="text-li-text-muted text-[9px]">FLIPS</div>
                          </div>
                        </div>
                        <FingerprintViz fingerprint={sv.fingerprint} />
                      </button>
                    ))}
                  </div>
                )}

                {selectedTicker && (
                  <SurvivorDetail ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
                )}
              </>
            )}

            {/* ── CLUSTERS ────────────────────────────────────────── */}
            {activeTab === "clusters" && clustersQ.data && (
              <div className="space-y-2">
                {(clustersQ.data.clusters as BTUTCluster[]).map((cl) => (
                  <div key={cl.cluster_id} className="li-card p-4 flex items-start gap-6">
                    <div className="text-center min-w-[60px]">
                      <div className="text-lg font-mono font-bold text-li-text-primary">{cl.member_count}</div>
                      <div className="text-[10px] text-li-text-muted uppercase">Members</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-li-text-muted">Cluster {cl.cluster_id}</span>
                        <span className="text-xs text-li-text-muted">|</span>
                        <span className="text-xs font-mono text-li-green">max {(cl.max_composite * 100).toFixed(1)}</span>
                        <span className="text-xs font-mono text-li-text-muted">avg {(cl.avg_composite * 100).toFixed(1)}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(cl.type_distribution).map(([type, count]) => (
                          <div key={type} className="flex items-center gap-1">
                            <TypeBadge type={type} />
                            <span className="text-xs font-mono text-li-text-muted">{count}</span>
                          </div>
                        ))}
                      </div>
                      {cl.sample_members.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {cl.sample_members.map((m, i) => (
                            <button
                              key={i}
                              onClick={() => m.ticker && setSelectedTicker(m.ticker)}
                              className="text-xs text-li-cyan hover:underline font-mono"
                            >
                              {m.ticker ? `[${m.ticker}]` : m.name.substring(0, 20)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {selectedTicker && (
                  <SurvivorDetail ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
                )}
              </div>
            )}

            {/* ── QUERY BUILDER ────────────────────────────────────── */}
            {activeTab === "query" && (
              <>
                <div className="li-card p-6 space-y-4">
                  <h3 className="text-xs uppercase tracking-wider text-li-text-muted flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5" /> Advanced Query Builder
                  </h3>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-li-text-muted block mb-1">Entity Types</label>
                      <select value={qTypes} onChange={(e) => setQTypes(e.target.value)}
                        className="w-full bg-li-gray-900 border border-li-gray-800 rounded px-3 py-2 text-sm text-li-text-primary">
                        <option value="">All types</option>
                        <option value="company">Companies only</option>
                        <option value="filing">Filings only</option>
                        <option value="financial_fact">Financial facts only</option>
                        <option value="company,filing">Companies + Filings</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-li-text-muted block mb-1">Min Composite Score</label>
                      <input type="number" step="0.05" min="0" max="1" value={qMinComposite}
                        onChange={(e) => setQMinComposite(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-li-gray-900 border border-li-gray-800 rounded px-3 py-2 text-sm text-li-text-primary font-mono" />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-li-text-muted block mb-1">Min Anomaly Score</label>
                      <input type="number" step="0.05" min="0" max="1" value={qMinAnomaly}
                        onChange={(e) => setQMinAnomaly(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-li-gray-900 border border-li-gray-800 rounded px-3 py-2 text-sm text-li-text-primary font-mono" />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-li-text-muted block mb-1">Has Ticker</label>
                      <select value={qHasTicker} onChange={(e) => setQHasTicker(e.target.value)}
                        className="w-full bg-li-gray-900 border border-li-gray-800 rounded px-3 py-2 text-sm text-li-text-primary">
                        <option value="">Any</option>
                        <option value="true">Yes (companies)</option>
                        <option value="false">No (filings/facts)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-li-text-muted block mb-1">Min Flips</label>
                      <input type="number" min="0" max="48" value={qMinFlips}
                        onChange={(e) => setQMinFlips(e.target.value)} placeholder="0"
                        className="w-full bg-li-gray-900 border border-li-gray-800 rounded px-3 py-2 text-sm text-li-text-primary font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-li-text-muted block mb-1">Max Flips</label>
                      <input type="number" min="0" max="48" value={qMaxFlips}
                        onChange={(e) => setQMaxFlips(e.target.value)} placeholder="48"
                        className="w-full bg-li-gray-900 border border-li-gray-800 rounded px-3 py-2 text-sm text-li-text-primary font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-li-text-muted block mb-1">Sort By</label>
                      <select value={qSortBy} onChange={(e) => setQSortBy(e.target.value)}
                        className="w-full bg-li-gray-900 border border-li-gray-800 rounded px-3 py-2 text-sm text-li-text-primary">
                        <option value="composite">Composite Score</option>
                        <option value="anomaly">Anomaly Score</option>
                        <option value="diversity">Diversity Score</option>
                        <option value="reconstruction">Reconstruction Score</option>
                        <option value="flips">Flip Count</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button onClick={() => setQueryTrigger(t => t + 1)}
                        className="li-btn-primary w-full flex items-center justify-center gap-2">
                        <Terminal className="w-4 h-4" /> Execute Query
                      </button>
                    </div>
                  </div>
                </div>

                {/* Query results */}
                {advancedQ.data && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-li-text-muted">
                        {advancedQ.data.total} results
                        {Object.keys(advancedQ.data.filters_applied || {}).length > 0 && (
                          <> | Filters: {Object.entries(advancedQ.data.filters_applied).map(([k, v]) =>
                            <span key={k} className="ml-1 px-1.5 py-0.5 bg-li-cyan/10 text-li-cyan rounded text-[10px] font-mono">{k}={String(v)}</span>
                          )}</>
                        )}
                      </p>
                    </div>

                    {(advancedQ.data.results as BTUTSurvivor[]).map((sv) => (
                      <button
                        key={`${sv.rank}-${sv.name}`}
                        onClick={() => sv.ticker && setSelectedTicker(sv.ticker)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-li-gray-900 transition-colors text-left li-card"
                      >
                        <span className="text-xs font-mono text-li-text-muted w-8">{sv.rank}</span>
                        <span className="font-mono text-li-cyan text-sm w-16">{sv.ticker || "-"}</span>
                        <span className="text-sm text-li-text-secondary flex-1 truncate">{sv.name}</span>
                        <TypeBadge type={sv.type} />
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="text-center w-14">
                            <div className="text-li-text-primary">{(sv.scores.composite * 100).toFixed(1)}</div>
                            <div className="text-li-text-muted text-[9px]">SCORE</div>
                          </div>
                          <div className="text-center w-14">
                            <div className="text-li-red">{(sv.scores.anomaly * 100).toFixed(1)}</div>
                            <div className="text-li-text-muted text-[9px]">ANOMALY</div>
                          </div>
                          <div className="text-center w-14">
                            <div className="text-li-text-muted">{sv.flips}/48</div>
                            <div className="text-li-text-muted text-[9px]">FLIPS</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedTicker && (
                  <SurvivorDetail ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
                )}
              </>
            )}

            {/* ── COMPARE ─────────────────────────────────────────── */}
            {activeTab === "compare" && (
              <>
                <div className="li-card p-6 space-y-4">
                  <h3 className="text-xs uppercase tracking-wider text-li-text-muted flex items-center gap-2">
                    <GitCompare className="w-3.5 h-3.5" /> Side-by-Side Entity Comparison
                  </h3>
                  <div className="flex gap-3">
                    <input
                      type="text" value={compareInput}
                      onChange={(e) => setCompareInput(e.target.value)}
                      placeholder="Enter comma-separated tickers: RIG,OKLO,AMPG"
                      className="flex-1 bg-li-gray-900 border border-li-gray-800 rounded-lg px-4 py-2.5 text-sm text-li-text-primary font-mono placeholder:text-li-text-muted focus:outline-none focus:border-li-cyan/50"
                    />
                    <button onClick={() => setCompareTickers(compareInput.split(",").map(t => t.trim().toUpperCase()).filter(Boolean))}
                      className="li-btn-primary px-6">Compare</button>
                  </div>
                </div>

                {compareQ.data && compareQ.data.entities?.length > 0 && (
                  <>
                    {/* Score comparison grid */}
                    <div className="li-card p-6">
                      <h3 className="text-xs uppercase tracking-wider text-li-text-muted mb-4">Score Comparison</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-li-gray-800">
                              <th className="text-left text-li-text-muted py-2 pr-4 text-xs uppercase">Axis</th>
                              {compareQ.data.entities.map((e: any) => (
                                <th key={e.ticker} className="text-center text-li-cyan py-2 px-4 font-mono text-xs">{e.ticker}</th>
                              ))}
                              <th className="text-center text-li-text-muted py-2 px-4 text-xs">Spread</th>
                              <th className="text-center text-li-green py-2 px-4 text-xs">Leader</th>
                            </tr>
                          </thead>
                          <tbody>
                            {["composite", "diversity", "reconstruction", "anomaly"].map((axis) => {
                              const comp = compareQ.data.comparison[axis];
                              if (!comp) return null;
                              return (
                                <tr key={axis} className="border-b border-li-gray-900">
                                  <td className="py-2 pr-4 text-li-text-secondary capitalize">{axis}</td>
                                  {compareQ.data.entities.map((e: any) => {
                                    const val = comp.values[e.ticker] ?? 0;
                                    const isMax = val === comp.max;
                                    return (
                                      <td key={e.ticker} className={cn("text-center py-2 px-4 font-mono", isMax ? "text-li-green font-bold" : "text-li-text-primary")}>
                                        {(val * 100).toFixed(1)}
                                      </td>
                                    );
                                  })}
                                  <td className="text-center py-2 px-4 font-mono text-li-text-muted">{(comp.spread * 100).toFixed(1)}</td>
                                  <td className="text-center py-2 px-4 font-mono text-li-green">{comp.leader}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Fingerprint similarity */}
                      {compareQ.data.comparison.fingerprint_similarity && (
                        <div className="mt-4 pt-4 border-t border-li-gray-900">
                          <h4 className="text-xs text-li-text-muted mb-2">Fingerprint Similarity (Hamming)</h4>
                          <div className="flex gap-3 flex-wrap">
                            {Object.entries(compareQ.data.comparison.fingerprint_similarity).map(([pair, sim]: [string, any]) => (
                              <div key={pair} className="bg-li-gray-900 rounded px-3 py-2 text-xs font-mono">
                                <span className="text-li-text-muted">{pair.replace("_vs_", " vs ")}</span>
                                <span className={cn("ml-2 font-bold", sim > 0.8 ? "text-li-green" : sim > 0.5 ? "text-li-yellow" : "text-li-red")}>
                                  {(sim * 100).toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-li-text-muted mt-2">
                            {compareQ.data.comparison.same_cluster ? "These entities share the same cluster." : "These entities occupy different clusters."}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Individual entity cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {compareQ.data.entities.map((e: any) => (
                        <div key={e.ticker} className="li-card p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono text-li-cyan text-lg">{e.ticker}</span>
                              <p className="text-xs text-li-text-secondary mt-0.5">{e.company_name}</p>
                            </div>
                            <TypeBadge type={e.type} />
                          </div>
                          <div className="space-y-2">
                            <ScoreBar label="Composite" value={e.scores.composite} color="bg-li-cyan" />
                            <ScoreBar label="Anomaly" value={e.scores.anomaly} color="bg-li-red" />
                            <ScoreBar label="Diversity" value={e.scores.diversity} color="bg-li-green" />
                            <ScoreBar label="Reconstruction" value={e.scores.reconstruction} color="bg-li-blue" />
                          </div>
                          <div className="text-xs text-li-text-muted">
                            {e.flips}/48 flips | Cluster {e.cluster} ({e.cluster_size} members)
                          </div>
                          <FingerprintViz fingerprint={e.fingerprint} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── ANOMALIES ───────────────────────────────────────── */}
            {activeTab === "anomalies" && anomaliesQ.data && (
              <>
                <div className="li-card p-6">
                  <h3 className="text-xs uppercase tracking-wider text-li-text-muted flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-3.5 h-3.5 text-li-red" /> Top 30 Structural Anomalies
                  </h3>
                  <div className="space-y-1">
                    {(anomaliesQ.data as any[]).map((a: any) => (
                      <button
                        key={a.rank}
                        onClick={() => a.ticker && setSelectedTicker(a.ticker)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-li-gray-900 transition-colors text-left"
                      >
                        <span className={cn(
                          "text-xs font-mono w-8",
                          a.rank <= 3 ? "text-li-red font-bold" : "text-li-text-muted"
                        )}>{a.rank}</span>
                        <span className="font-mono text-li-cyan text-sm w-16">{a.ticker || "-"}</span>
                        <span className="text-sm text-li-text-secondary flex-1 truncate">{a.name}</span>
                        <TypeBadge type={a.type} />
                        <div className="w-32">
                          <ScoreBar label="" value={a.anomaly_score} color="bg-li-red" />
                        </div>
                        <span className="font-mono text-xs text-li-red w-16 text-right">{(a.anomaly_score * 100).toFixed(1)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Distribution chart */}
                {distributionsQ.data?.score_distributions && (
                  <div className="li-card p-6">
                    <h3 className="text-xs uppercase tracking-wider text-li-text-muted flex items-center gap-2 mb-4">
                      <BarChart3 className="w-3.5 h-3.5" /> Score Distributions
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      {["composite", "anomaly", "diversity", "reconstruction"].map((axis) => {
                        const dist = distributionsQ.data.score_distributions[axis];
                        if (!dist) return null;
                        const maxCount = Math.max(...(dist.histogram?.counts || [1]));
                        return (
                          <div key={axis} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-li-text-secondary capitalize">{axis}</span>
                              <span className="text-xs font-mono text-li-text-muted">
                                mean={dist.mean} | p50={dist.p50} | std={dist.std}
                              </span>
                            </div>
                            <div className="flex items-end gap-[2px] h-16">
                              {(dist.histogram?.counts || []).map((count: number, i: number) => (
                                <div
                                  key={i}
                                  className={cn("flex-1 rounded-t transition-all", axis === "anomaly" ? "bg-li-red/60" : axis === "diversity" ? "bg-li-green/60" : axis === "reconstruction" ? "bg-li-blue/60" : "bg-li-cyan/60")}
                                  style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? "2px" : "0" }}
                                  title={`${dist.histogram.edges[i]}-${dist.histogram.edges[i+1]}: ${count}`}
                                />
                              ))}
                            </div>
                            <div className="flex justify-between text-[9px] font-mono text-li-text-muted">
                              <span>0.0</span>
                              <span>0.5</span>
                              <span>1.0</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Type breakdown */}
                    {distributionsQ.data.type_breakdown && (
                      <div className="mt-6 pt-4 border-t border-li-gray-900">
                        <h4 className="text-xs text-li-text-muted mb-3">Type Breakdown</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {Object.entries(distributionsQ.data.type_breakdown).map(([type, stats]: [string, any]) => (
                            <div key={type} className="bg-li-gray-900 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <TypeBadge type={type} />
                                <span className="text-lg font-mono font-bold text-li-text-primary">{stats.count}</span>
                              </div>
                              <div className="text-[10px] text-li-text-muted space-y-0.5">
                                <div>{stats.pct}% of survivors</div>
                                <div>Avg composite: {stats.composite_avg}</div>
                                <div>Avg anomaly: {stats.anomaly_avg}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedTicker && (
                  <SurvivorDetail ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
                )}
              </>
            )}

            {/* ── SEARCH ──────────────────────────────────────────── */}
            {activeTab === "search" && (
              <>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-li-text-muted" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && setSearchQuery(searchInput)}
                      placeholder="Search companies, filings, XBRL concepts..."
                      className="w-full pl-10 pr-4 py-2.5 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-li-text-primary placeholder:text-li-text-muted focus:outline-none focus:border-li-cyan/50"
                    />
                  </div>
                  <button
                    onClick={() => setSearchQuery(searchInput)}
                    className="li-btn-primary px-6"
                  >
                    Search
                  </button>
                </div>

                {searchQ.data && (
                  <div className="space-y-1">
                    <p className="text-xs text-li-text-muted">{searchQ.data.total} results for &ldquo;{searchQuery}&rdquo;</p>
                    {(searchQ.data.results as BTUTSearchHit[]).map((hit, i) => (
                      <button
                        key={i}
                        onClick={() => hit.ticker && hit.is_survivor && setSelectedTicker(hit.ticker)}
                        className="w-full flex items-center gap-4 px-4 py-2.5 rounded-lg hover:bg-li-gray-900 transition-colors text-left"
                      >
                        <span className="font-mono text-li-cyan text-sm w-16">{hit.ticker || "-"}</span>
                        <span className="text-sm text-li-text-secondary flex-1 truncate">{hit.name}</span>
                        <TypeBadge type={hit.type} />
                        {hit.is_survivor && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-li-green/10 text-li-green border border-li-green/20">
                            SURVIVOR
                          </span>
                        )}
                        {hit.composite > 0 && (
                          <span className="font-mono text-xs text-li-text-muted">{(hit.composite * 100).toFixed(1)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedTicker && (
                  <SurvivorDetail ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
