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
} from "lucide-react";
import type {
  BTUTStatus,
  BTUTSurvivor,
  BTUTAnalysis,
  BTUTCluster,
  BTUTSearchHit,
} from "@/lib/types";

// ── Tab definitions ─────────────────────────────────────────────────
type Tab = "overview" | "survivors" | "clusters" | "search";

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "survivors", label: "Survivors", icon: Target },
  { id: "clusters", label: "Clusters", icon: Layers },
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
