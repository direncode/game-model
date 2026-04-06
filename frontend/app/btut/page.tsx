"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { cn } from "@/lib/utils";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { BTUTSurvivor, BTUTAnalysis } from "@/lib/types";

// =====================================================================
// SUB-COMPONENTS
// =====================================================================

// ── Radial Gauge (SVG) ──────────────────────────────────────────────
function Gauge({ value, label, color, max = 1 }: { value: number; label: string; color: string; max?: number }) {
  const pct = Math.min(value / max, 1);
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = circ * 0.75; // 270 degree arc
  const offset = dash * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="52" viewBox="0 0 80 52">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1a1a1a" strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset="0"
          transform="rotate(135 40 40)" strokeLinecap="round" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={offset}
          transform="rotate(135 40 40)" strokeLinecap="round"
          className="transition-all duration-1000" />
        <text x="40" y="38" textAnchor="middle" fill="white" fontSize="14" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          {(value * 100).toFixed(0)}
        </text>
      </svg>
      <span className="text-[9px] uppercase tracking-widest text-li-text-muted">{label}</span>
    </div>
  );
}

// ── Micro Score Bar (inline in table) ───────────────────────────────
function MicroBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 w-20">
      <div className="flex-1 h-1 bg-li-gray-900 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-[10px] font-mono text-li-text-primary w-7 text-right">{(value * 100).toFixed(0)}</span>
    </div>
  );
}

// ── Fingerprint (compact) ───────────────────────────────────────────
function FP({ fp }: { fp: string }) {
  return (
    <div className="flex gap-[1px] items-center">
      {fp.split("").map((b, i) => (
        <div key={i} className={cn("w-[3px] h-3 rounded-[0.5px]", b === "1" ? "bg-li-cyan/70" : "bg-li-gray-800",
          i === 15 || i === 31 ? "ml-[2px]" : "")} />
      ))}
    </div>
  );
}

// ── Role Badge ──────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    PIONEER: "bg-li-red/20 text-li-red border-li-red/30",
    ISOLATE: "bg-li-purple/20 text-li-purple border-li-purple/30",
    ANCHOR: "bg-li-green/20 text-li-green border-li-green/30",
    BOUNDARY: "bg-li-yellow/20 text-li-yellow border-li-yellow/30",
    HUB: "bg-li-cyan/20 text-li-cyan border-li-cyan/30",
    BRIDGE: "bg-li-blue/20 text-li-blue border-li-blue/30",
    MEMBER: "bg-li-gray-800 text-li-text-muted border-li-gray-700",
  };
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border leading-none",
      colors[role] || colors.MEMBER)}>{role}</span>
  );
}

// ── Type Dot (dynamic from dataset metadata) ───────────────────────
const DEFAULT_TYPE_COLORS: Record<string, string> = {
  company: "#00d4ff", filing: "#a371f7", financial_fact: "#3fb950",
  paper: "#388bfd", author: "#f0883e", gene: "#3fb950", mesh_term: "#a371f7",
  patent: "#00d4ff", inventor: "#f0883e", assignee: "#3fb950", cpc_class: "#a371f7",
  country: "#00d4ff", commodity: "#3fb950", trade_flow: "#a371f7",
  station: "#00d4ff", observation: "#f0883e", region: "#a371f7",
};

function TypeDot({ type }: { type: string }) {
  const hex = DEFAULT_TYPE_COLORS[type] || "#555";
  return <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} title={type} />;
}

// ── Confidence Dot ──────────────────────────────────────────────────
function ConfDot({ level }: { level: string }) {
  const c = level === "very_high" ? "bg-li-green" : level === "high" ? "bg-li-cyan" :
    level === "medium" ? "bg-li-yellow" : "bg-li-red";
  return <div className={cn("w-2 h-2 rounded-full shrink-0", c)} title={level} />;
}

// ── Status Cell ─────────────────────────────────────────────────────
function StatusCell({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5">
      <span className="text-[8px] uppercase tracking-[0.12em] text-li-text-muted">{label}</span>
      <span className="text-sm font-mono font-bold text-li-cyan">{typeof value === "number" ? value.toLocaleString() : value}</span>
      {unit && <span className="text-[8px] text-li-text-muted">{unit}</span>}
    </div>
  );
}

// ── Severity Tag ────────────────────────────────────────────────────
function SeverityTag({ tag, severity, desc }: { tag: string; severity: string; desc: string }) {
  const c = severity === "critical" ? "bg-li-red/15 text-li-red border-li-red/20" :
    severity === "high" ? "bg-li-yellow/15 text-li-yellow border-li-yellow/20" :
    severity === "medium" ? "bg-li-purple/15 text-li-purple border-li-purple/20" :
    "bg-li-gray-900 text-li-text-muted border-li-gray-800";
  return (
    <div className={cn("flex items-start gap-2 rounded px-2 py-1 text-[10px] border", c)}>
      <span className="font-mono font-bold shrink-0">{tag}</span>
      <span className="opacity-80">{desc}</span>
    </div>
  );
}

// =====================================================================
// DOSSIER PANEL
// =====================================================================
function Dossier({ entityKey, onClose }: { entityKey: string; onClose: () => void }) {
  const [lineageData, setLineageData] = useState<any>(null);
  const [lineageLoading, setLineageLoading] = useState(false);
  const [reportTaskId, setReportTaskId] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<any>(null);

  const { data } = useQuery({
    queryKey: ["btut-analyze", entityKey],
    queryFn: () => api.getBTUTAnalysis(entityKey),
    enabled: !!entityKey,
  });

  const handleTraceLineage = async () => {
    setLineageLoading(true);
    try {
      const result = await api.getBTUTLineage(entityKey);
      setLineageData(result);
    } catch (e) { console.error(e); }
    setLineageLoading(false);
  };

  const handleGenerateReport = async () => {
    try {
      const result = await api.generateBTUTReport({ entity_keys: [entityKey], format: "pdf" });
      setReportTaskId(result.task_id);
      const poll = setInterval(async () => {
        try {
          const status = await api.getBTUTReportStatus(result.task_id);
          setReportStatus(status);
          if (status.status === "completed" || status.status === "failed") clearInterval(poll);
        } catch { clearInterval(poll); }
      }, 3000);
    } catch (e) { console.error(e); }
  };

  if (!data) return (
    <div className="col-span-full lg:col-span-7 border border-li-gray-800 rounded bg-li-surface p-4 animate-pulse">
      <div className="h-4 bg-li-gray-800 rounded w-1/3" />
    </div>
  );

  const a = data as BTUTAnalysis & { metadata?: any };
  const m = a.metadata || {};

  return (
    <div className="col-span-full lg:col-span-7 border border-li-cyan/20 rounded bg-li-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-li-gray-800 bg-li-black">
        <div className="flex items-center gap-3">
          <span className="font-mono text-li-cyan text-lg font-bold">{a.ticker}</span>
          <span className="text-sm text-li-text-secondary">{a.company_name}</span>
          <span className="text-[10px] font-mono text-li-text-muted">CIK {a.cik}</span>
          {m.structural_role && <RoleBadge role={m.structural_role.role} />}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleTraceLineage} disabled={lineageLoading}
            className="px-3 py-1 rounded text-[10px] font-mono bg-li-cyan/10 text-li-cyan border border-li-cyan/20 hover:bg-li-cyan/20 disabled:opacity-50">
            {lineageLoading ? "Tracing..." : "Trace Lineage"}
          </button>
          <button onClick={handleGenerateReport}
            className="px-3 py-1 rounded text-[10px] font-mono bg-li-purple/10 text-li-purple border border-li-purple/20 hover:bg-li-purple/20">
            Generate Report
          </button>
          <button onClick={onClose} className="text-li-text-muted hover:text-white text-xs px-2 py-1">ESC</button>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto">
        {/* Left: Scores + Tags */}
        <div className="space-y-3">
          {/* Score Cards */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { k: "composite", c: "#00d4ff" }, { k: "diversity", c: "#3fb950" },
              { k: "reconstruction", c: "#388bfd" }, { k: "anomaly", c: "#f85149" },
            ].map(({ k, c }) => (
              <div key={k} className="bg-li-gray-900 rounded p-2 text-center">
                <div className="text-lg font-mono font-bold" style={{ color: c }}>
                  {((a.scores as any)[k] * 100).toFixed(1)}
                </div>
                <div className="text-[8px] uppercase tracking-wider text-li-text-muted">{k}</div>
                {m.signal_decomposition?.[k] && (
                  <div className="text-[8px] font-mono text-li-text-muted mt-0.5">
                    #{m.signal_decomposition[k].rank_in_axis} ({m.signal_decomposition[k].percentile}%ile)
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Role description */}
          {m.structural_role && (
            <p className="text-[10px] text-li-text-secondary leading-relaxed bg-li-gray-900 rounded px-3 py-2">
              {m.structural_role.description}
            </p>
          )}

          {/* Anomaly tags */}
          {m.anomaly_taxonomy?.length > 0 && (
            <div className="space-y-1">
              <span className="text-[8px] uppercase tracking-widest text-li-text-muted">Anomaly Tags</span>
              {m.anomaly_taxonomy.map((t: any, i: number) => (
                <SeverityTag key={i} tag={t.tag} severity={t.severity} desc={t.description} />
              ))}
            </div>
          )}

          {/* Confidence */}
          {m.confidence && (
            <div className="bg-li-gray-900 rounded px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] uppercase tracking-widest text-li-text-muted">Confidence</span>
                <span className={cn("text-sm font-mono font-bold",
                  m.confidence.level === "very_high" ? "text-li-green" : m.confidence.level === "high" ? "text-li-cyan" : "text-li-yellow"
                )}>{(m.confidence.score * 100).toFixed(0)}%</span>
              </div>
              <div className="space-y-0.5">
                {m.confidence.factors?.map((f: any, i: number) => (
                  <div key={i} className="flex justify-between text-[9px]">
                    <span className="text-li-text-muted">{f.factor.replace(/_/g, " ")}</span>
                    <span className="font-mono text-li-green">+{(f.impact * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Fingerprint + Peers + Position */}
        <div className="space-y-3">
          {/* Fingerprint */}
          <div className="bg-li-gray-900 rounded px-3 py-2">
            <span className="text-[8px] uppercase tracking-widest text-li-text-muted">48-bit Lattice Fingerprint</span>
            <div className="mt-1.5 flex gap-[1px]">
              {a.lattice_profile.fingerprint_48bit.split("").map((b, i) => (
                <div key={i} className={cn("w-[5px] h-5 rounded-[1px]", b === "1" ? "bg-li-cyan" : "bg-li-gray-700",
                  i === 15 || i === 31 ? "ml-1" : "")} />
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[8px] text-li-text-muted font-mono">
              <span>COARSE (4-bin)</span><span>MEDIUM (8-bin)</span><span>FINE (16-bin)</span>
            </div>
            <div className="text-[10px] text-li-text-muted mt-1">
              {a.lattice_profile.total_flips}/48 flips ({(a.lattice_profile.flip_rate * 100).toFixed(0)}%)
            </div>
            {m.fingerprint_analytics && (
              <div className="grid grid-cols-4 gap-1 mt-2">
                {[
                  { l: "Entropy", v: m.fingerprint_analytics.entropy?.toFixed(3) },
                  { l: "Transitions", v: m.fingerprint_analytics.transitions },
                  { l: "Avg Run", v: m.fingerprint_analytics.avg_run_length },
                  { l: "Flip%", v: `${(m.fingerprint_analytics.flip_ratio * 100).toFixed(0)}%` },
                ].map(({ l, v }) => (
                  <div key={l} className="text-center">
                    <div className="text-[10px] font-mono text-li-text-primary">{v}</div>
                    <div className="text-[7px] text-li-text-muted uppercase">{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Peers */}
          {m.peer_network?.length > 0 && (
            <div className="bg-li-gray-900 rounded px-3 py-2">
              <span className="text-[8px] uppercase tracking-widest text-li-text-muted">Nearest Peers</span>
              <div className="mt-1 space-y-0.5">
                {m.peer_network.slice(0, 5).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <TypeDot type={p.type} />
                      <span className="font-mono text-li-cyan">{p.ticker || "-"}</span>
                      <span className="text-li-text-muted truncate max-w-[100px]">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1 bg-li-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-li-cyan rounded-full" style={{ width: `${p.similarity * 100}%` }} />
                      </div>
                      <span className="font-mono text-li-text-muted w-8 text-right">{(p.similarity * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Position */}
          {m.relative_position && (
            <div className="bg-li-gray-900 rounded px-3 py-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-mono font-bold text-li-text-primary">#{m.relative_position.global_rank}</div>
                <div className="text-[7px] uppercase text-li-text-muted">Global</div>
              </div>
              <div>
                <div className="text-sm font-mono font-bold text-li-text-primary">#{m.relative_position.type_rank}</div>
                <div className="text-[7px] uppercase text-li-text-muted">In Type</div>
              </div>
              <div>
                <div className={cn("text-sm font-mono font-bold",
                  m.relative_position.composite_z_score > 1 ? "text-li-green" : "text-li-text-primary"
                )}>{m.relative_position.sigma_label}</div>
                <div className="text-[7px] uppercase text-li-text-muted">Z-Score</div>
              </div>
            </div>
          )}

          {/* Cluster */}
          {a.cluster.peers?.length > 0 && (
            <div className="bg-li-gray-900 rounded px-3 py-2">
              <span className="text-[8px] uppercase tracking-widest text-li-text-muted">
                Cluster {a.cluster.id} ({a.cluster.total_members} members)
              </span>
              <div className="mt-1 space-y-0.5">
                {a.cluster.peers.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <TypeDot type={p.type} />
                      <span className="font-mono text-li-cyan">{p.ticker || "-"}</span>
                      <span className="text-li-text-muted truncate max-w-[120px]">{p.name}</span>
                    </div>
                    <span className="font-mono text-li-text-muted">{(p.composite * 100).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data quality */}
          {m.data_quality && (
            <div className="flex flex-wrap gap-1">
              {m.data_quality.map((q: string, i: number) => (
                <span key={i} className={cn("text-[8px] px-1.5 py-0.5 rounded font-mono",
                  q.startsWith("CLEAN") ? "bg-li-green/10 text-li-green" : "bg-li-yellow/10 text-li-yellow"
                )}>{q.split(":")[0]}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Structural Lineage ──────────────────────────────── */}
        {lineageData && (
          <div className="col-span-2 border-t border-li-gray-800 p-4 space-y-3">
            <span className="text-[8px] uppercase tracking-widest text-li-cyan">Structural Lineage</span>

            {/* Lineage summary */}
            {lineageData.lineage_summary && (
              <div className="bg-li-cyan/5 border border-li-cyan/10 rounded p-3">
                <p className="text-[10px] text-li-text-secondary leading-relaxed">{lineageData.lineage_summary}</p>
              </div>
            )}

            {/* Lineage chain — each stage of the pipeline */}
            {lineageData.lineage_chain?.length > 0 && (
              <div className="space-y-1">
                <span className="text-[8px] uppercase tracking-widest text-li-text-muted">Pipeline Trace</span>
                {lineageData.lineage_chain.map((node: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 bg-li-gray-900 rounded px-3 py-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold shrink-0 mt-0.5",
                      node.stage === "selection" ? "bg-li-green/20 text-li-green" :
                      node.stage === "scoring" ? "bg-li-cyan/20 text-li-cyan" :
                      node.stage === "magnitude" ? "bg-li-purple/20 text-li-purple" :
                      "bg-li-gray-800 text-li-text-muted"
                    )}>{node.stage}</span>
                    <p className="text-[9px] text-li-text-secondary leading-relaxed">{node.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Magnitude trail */}
            {lineageData.magnitude_trail && (
              <div className="grid grid-cols-3 gap-2">
                {["coarse", "medium", "fine"].map((res) => {
                  const t = lineageData.magnitude_trail[res];
                  if (!t) return null;
                  return (
                    <div key={res} className="bg-li-gray-900 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] uppercase tracking-widest text-li-text-muted">{res}</span>
                        <span className="text-[10px] font-mono text-li-text-primary">{t.flips}/{t.total}</span>
                      </div>
                      <p className="text-[8px] text-li-text-muted leading-relaxed">{t.interpretation}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cluster ancestry */}
            {lineageData.cluster_ancestry && (
              <div className="bg-li-gray-900 rounded p-3 space-y-1">
                <span className="text-[8px] uppercase tracking-widest text-li-text-muted">Cluster Ancestry</span>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div>
                    <div className="font-mono text-li-text-primary text-lg">{lineageData.cluster_ancestry.cluster_size}</div>
                    <div className="text-[8px] text-li-text-muted">Cluster Members</div>
                  </div>
                  <div>
                    <div className="font-mono text-li-red text-lg">{lineageData.cluster_ancestry.eliminated_count?.toLocaleString()}</div>
                    <div className="text-[8px] text-li-text-muted">Eliminated</div>
                  </div>
                  <div>
                    <div className="font-mono text-li-green text-lg">{lineageData.cluster_ancestry.total_in_mega_cluster?.toLocaleString()}</div>
                    <div className="text-[8px] text-li-text-muted">Total Entities</div>
                  </div>
                </div>
                <p className="text-[9px] text-li-cyan mt-2">Selection: {lineageData.cluster_ancestry.survival_reason}</p>
              </div>
            )}

            {/* Score provenance */}
            {lineageData.score_provenance && (
              <div className="space-y-1">
                <span className="text-[8px] uppercase tracking-widest text-li-text-muted">Score Provenance</span>
                {Object.entries(lineageData.score_provenance).map(([axis, prov]: [string, any]) => (
                  <div key={axis} className="bg-li-gray-900 rounded px-3 py-2 flex items-start gap-3">
                    <div className="text-center min-w-[50px]">
                      <div className="text-sm font-mono font-bold text-li-text-primary">{((prov.raw_score || 0) * 100).toFixed(1)}</div>
                      <div className="text-[7px] uppercase text-li-text-muted">{axis}</div>
                    </div>
                    <p className="text-[9px] text-li-text-secondary leading-relaxed">{prov.explanation}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Peer survivors */}
            {lineageData.peer_survivors?.length > 0 && (
              <div className="space-y-1">
                <span className="text-[8px] uppercase tracking-widest text-li-text-muted">Structural Peers</span>
                {lineageData.peer_survivors.slice(0, 5).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-li-gray-900 rounded px-3 py-1.5 text-[9px]">
                    <div className="flex items-center gap-2">
                      <TypeDot type={p.type} />
                      <span className="font-mono text-li-cyan">{p.ticker || "-"}</span>
                      <span className="text-li-text-muted">{p.name}</span>
                      {p.shared_cluster && <span className="text-[7px] text-li-green">same cluster</span>}
                    </div>
                    <span className="font-mono text-li-text-muted">{(p.similarity * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Report Status ──────────────────────────────────── */}
        {reportTaskId && (
          <div className="col-span-2 border-t border-li-gray-800 p-3 flex items-center gap-3">
            {reportStatus?.status === "completed" ? (
              <>
                <span className="text-[10px] text-li-green font-mono">Report ready</span>
                <span className="text-[10px] text-li-text-muted">{reportStatus.filename}</span>
              </>
            ) : reportStatus?.status === "failed" ? (
              <span className="text-[10px] text-li-red font-mono">Report failed: {reportStatus.error}</span>
            ) : (
              <>
                <div className="w-3 h-3 border-2 border-li-cyan border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-li-text-muted font-mono">
                  Generating report... {reportStatus?.progress?.step || ""}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// CLUSTER MATRIX
// =====================================================================
function ClusterMatrix({ clusters, onSelect }: { clusters: any[]; onSelect: (id: number) => void }) {
  if (!clusters?.length) return null;

  const maxSize = Math.max(...clusters.map((c: any) => c.member_count));

  return (
    <div className="flex flex-wrap gap-[2px] p-2">
      {clusters.slice(0, 60).map((c: any) => {
        const sizePct = Math.max(0.3, c.member_count / maxSize);
        const dominantType = Object.entries(c.type_distribution || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "company";
        const bgColor = dominantType === "company" ? "bg-li-cyan" : dominantType === "filing" ? "bg-li-purple" : "bg-li-green";

        return (
          <button
            key={c.cluster_id}
            onClick={() => onSelect(c.cluster_id)}
            className={cn("rounded-sm transition-all hover:ring-1 hover:ring-white/30", bgColor)}
            style={{ width: `${Math.max(8, sizePct * 28)}px`, height: `${Math.max(8, sizePct * 28)}px`, opacity: 0.2 + c.avg_composite * 0.8 }}
            title={`Cluster ${c.cluster_id}: ${c.member_count} members, avg ${(c.avg_composite * 100).toFixed(0)}`}
          />
        );
      })}
    </div>
  );
}

// =====================================================================
// SCATTER TOOLTIP
// =====================================================================
function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-li-black border border-li-gray-800 rounded px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-li-cyan font-bold">{d.ticker || d.name}</div>
      <div className="text-li-text-muted">{d.type}</div>
      <div className="mt-1 font-mono">
        anomaly: {(d.anomaly * 100).toFixed(1)} | recon: {(d.reconstruction * 100).toFixed(1)}
      </div>
    </div>
  );
}

// =====================================================================
// MAIN PAGE
// =====================================================================
export default function BTUTPage() {
  const [datasetId, setDatasetId] = useState("edgar");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState("composite");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [clusterFilter, setClusterFilter] = useState<number | null>(null);

  // Datasets list
  const datasetsQ = useQuery({
    queryKey: ["btut-datasets"],
    queryFn: () => api.getBTUTDatasets(),
  });

  // Data queries (keyed by dataset)
  const statusQ = useQuery({ queryKey: ["btut-status", datasetId], queryFn: () => api.getBTUTStatus(datasetId) });
  const survivorsQ = useQuery({
    queryKey: ["btut-survivors-all", datasetId],
    queryFn: () => api.getBTUTSurvivors({ top_n: 300, dataset: datasetId }),
  });
  const clustersQ = useQuery({
    queryKey: ["btut-clusters-all", datasetId],
    queryFn: () => api.getBTUTClusters({ min_size: 1, top_n: 100, dataset: datasetId }),
  });

  const status = statusQ.data;
  const allSurvivors = (survivorsQ.data?.survivors || []) as (BTUTSurvivor & { metadata?: any })[];

  // Sort & filter
  const sortedSurvivors = useMemo(() => {
    let pool = [...allSurvivors];

    if (filterType) pool = pool.filter(s => s.type === filterType);
    if (filterRole) pool = pool.filter(s => s.metadata?.structural_role?.role === filterRole);
    if (clusterFilter !== null) pool = pool.filter(s => s.cluster === clusterFilter);

    pool.sort((a, b) => {
      let va: number, vb: number;
      if (sortCol === "flips") { va = a.flips; vb = b.flips; }
      else if (sortCol === "cluster") { va = a.cluster; vb = b.cluster; }
      else { va = (a.scores as any)[sortCol] || 0; vb = (b.scores as any)[sortCol] || 0; }
      return sortDir === "desc" ? vb - va : va - vb;
    });

    return pool;
  }, [allSurvivors, sortCol, sortDir, filterType, filterRole, clusterFilter]);

  // Scatter data
  const scatterData = useMemo(() =>
    allSurvivors.map(s => ({
      anomaly: s.scores.anomaly,
      reconstruction: s.scores.reconstruction,
      composite: s.scores.composite,
      ticker: s.ticker,
      name: s.name,
      type: s.type,
    })),
    [allSurvivors],
  );

  // Aggregate scores for gauges
  const aggScores = useMemo(() => {
    if (!allSurvivors.length) return { composite: 0, anomaly: 0, diversity: 0, reconstruction: 0 };
    const n = allSurvivors.length;
    return {
      composite: allSurvivors.reduce((s, v) => s + v.scores.composite, 0) / n,
      anomaly: allSurvivors.reduce((s, v) => s + v.scores.anomaly, 0) / n,
      diversity: allSurvivors.reduce((s, v) => s + v.scores.diversity, 0) / n,
      reconstruction: allSurvivors.reduce((s, v) => s + v.scores.reconstruction, 0) / n,
    };
  }, [allSurvivors]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <th onClick={() => handleSort(col)}
      className={cn("px-2 py-1.5 text-left cursor-pointer hover:text-li-cyan transition-colors select-none",
        sortCol === col ? "text-li-cyan" : "text-li-text-muted"
      )}>
      <div className="flex items-center gap-0.5">
        {children}
        {sortCol === col && <span className="text-[8px]">{sortDir === "desc" ? "\u25BC" : "\u25B2"}</span>}
      </div>
    </th>
  );

  return (
    <div className="min-h-screen bg-li-bg text-li-text-primary">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14">
        {/* ═══════════════ STATUS BAR ═══════════════ */}
        <div className="border-b border-li-gray-900 bg-li-black flex items-center justify-between px-4">
          {/* Dataset switcher */}
          <select
            value={datasetId}
            onChange={(e) => { setDatasetId(e.target.value); setSelectedKey(null); setFilterType(""); setFilterRole(""); setClusterFilter(null); }}
            className="bg-li-black border border-li-gray-800 rounded px-2 py-1 text-xs font-mono text-li-cyan mr-3 focus:outline-none focus:border-li-cyan/50"
          >
            {(datasetsQ.data || []).map((ds) => (
              <option key={ds.id} value={ds.id} disabled={!ds.has_results}>
                {ds.name} {ds.has_results ? "" : "(no data)"}
              </option>
            ))}
            {!datasetsQ.data && <option value="edgar">SEC EDGAR</option>}
          </select>
          <div className="flex items-center gap-0.5 divide-x divide-li-gray-800">
            {status && [
              { l: "Entities", v: status.total_entities },
              { l: "Clusters", v: status.total_clusters },
              { l: "Fingerprints", v: status.unique_fingerprints },
              { l: "Survivors", v: status.survivor_count },
              { l: "Reduction", v: `${status.reduction_ratio}x` },
              { l: "Variance", v: `${((status.reconstruction?.variance_preservation ?? 0) * 100).toFixed(1)}%` },
              { l: "Coverage", v: `${((status.reconstruction?.coverages?.["1.0"] ?? 0) * 100).toFixed(1)}%` },
              { l: "Time", v: `${status.wall_seconds.toFixed(1)}s` },
            ].map(({ l, v }) => <StatusCell key={l} label={l} value={v} />)}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-li-green animate-pulse" />
            <span className="text-[10px] font-mono text-li-green uppercase tracking-wider">Ready</span>
          </div>
        </div>

        {/* ═══════════════ MAIN GRID ═══════════════ */}
        <div className="grid grid-cols-12 gap-0 h-[calc(100vh-3.5rem-2.5rem)]">

          {/* ── LEFT: Table (col 1-7) ────────────────────────────── */}
          <div className="col-span-7 border-r border-li-gray-900 flex flex-col overflow-hidden">

            {/* Filter bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-li-gray-900 bg-li-black/50">
              <span className="text-[9px] text-li-text-muted uppercase tracking-wider">Filter:</span>
              {["", "company", "filing", "financial_fact"].map(t => (
                <button key={t} onClick={() => { setFilterType(t); setClusterFilter(null); }}
                  className={cn("px-2 py-0.5 rounded text-[9px] font-mono",
                    filterType === t ? "bg-li-cyan/15 text-li-cyan" : "text-li-text-muted hover:text-li-text-secondary")}>
                  {t || "ALL"}
                </button>
              ))}
              <span className="text-li-gray-800">|</span>
              {["", "PIONEER", "ANCHOR", "HUB", "BOUNDARY", "ISOLATE", "BRIDGE"].map(r => (
                <button key={r} onClick={() => setFilterRole(r)}
                  className={cn("px-1.5 py-0.5 rounded text-[9px] font-mono",
                    filterRole === r ? "bg-li-cyan/15 text-li-cyan" : "text-li-text-muted hover:text-li-text-secondary")}>
                  {r || "ALL ROLES"}
                </button>
              ))}
              {clusterFilter !== null && (
                <button onClick={() => setClusterFilter(null)}
                  className="px-2 py-0.5 rounded text-[9px] font-mono bg-li-yellow/15 text-li-yellow">
                  Cluster {clusterFilter} x
                </button>
              )}
              <span className="ml-auto text-[9px] font-mono text-li-text-muted">{sortedSurvivors.length} results</span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-li-black z-10">
                  <tr className="border-b border-li-gray-800">
                    <th className="px-2 py-1.5 text-li-text-muted text-left w-6">#</th>
                    <th className="px-2 py-1.5 text-li-text-muted text-left">ROLE</th>
                    <SortHeader col="composite">TICKER</SortHeader>
                    <th className="px-2 py-1.5 text-li-text-muted text-left">NAME</th>
                    <th className="px-2 py-1.5 text-li-text-muted text-center">T</th>
                    <SortHeader col="composite">COMP</SortHeader>
                    <SortHeader col="anomaly">ANOM</SortHeader>
                    <SortHeader col="diversity">DIV</SortHeader>
                    <SortHeader col="reconstruction">REC</SortHeader>
                    <SortHeader col="flips">FLIPS</SortHeader>
                    <th className="px-2 py-1.5 text-li-text-muted text-center">C</th>
                    <th className="px-2 py-1.5 text-li-text-muted text-left">FINGERPRINT</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSurvivors.map((sv, i) => {
                    const entityKey = sv.ticker || sv.name;
                    const isSelected = entityKey === selectedKey;
                    return (
                      <tr key={`${sv.rank}-${sv.name}`}
                        onClick={() => setSelectedKey(isSelected ? null : entityKey)}
                        className={cn(
                          "cursor-pointer border-b border-li-gray-900/50 transition-colors",
                          isSelected ? "bg-li-cyan/5 border-l-2 border-l-li-cyan" : "hover:bg-li-gray-900/30",
                        )}>
                        <td className="px-2 py-1 text-li-text-muted font-mono">{i + 1}</td>
                        <td className="px-2 py-1">
                          <RoleBadge role={sv.metadata?.structural_role?.role || "MEMBER"} />
                        </td>
                        <td className="px-2 py-1 font-mono text-li-cyan font-bold">{sv.ticker || "-"}</td>
                        <td className="px-2 py-1 text-li-text-secondary truncate max-w-[140px]">{sv.name}</td>
                        <td className="px-2 py-1 text-center"><TypeDot type={sv.type} /></td>
                        <td className="px-2 py-1"><MicroBar value={sv.scores.composite} color="bg-li-cyan" /></td>
                        <td className="px-2 py-1"><MicroBar value={sv.scores.anomaly} color="bg-li-red" /></td>
                        <td className="px-2 py-1"><MicroBar value={sv.scores.diversity} color="bg-li-green" /></td>
                        <td className="px-2 py-1"><MicroBar value={sv.scores.reconstruction} color="bg-li-blue" /></td>
                        <td className="px-2 py-1 font-mono text-li-text-muted text-center">{sv.flips}</td>
                        <td className="px-2 py-1 font-mono text-li-text-muted text-center">{sv.cluster}</td>
                        <td className="px-2 py-1"><FP fp={sv.fingerprint} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── RIGHT (col 8-12) ─────────────────────────────────── */}
          <div className="col-span-5 flex flex-col overflow-hidden">

            {/* Gauges */}
            <div className="flex items-center justify-around py-3 border-b border-li-gray-900">
              <Gauge value={aggScores.composite} label="Composite" color="#00d4ff" />
              <Gauge value={aggScores.anomaly} label="Anomaly" color="#f85149" />
              <Gauge value={aggScores.diversity} label="Diversity" color="#3fb950" />
              <Gauge value={aggScores.reconstruction} label="Recon" color="#388bfd" />
            </div>

            {/* Scatter plot */}
            <div className="h-[240px] border-b border-li-gray-900 px-2 py-1">
              <div className="text-[8px] uppercase tracking-widest text-li-text-muted px-2">Anomaly x Reconstruction</div>
              <ResponsiveContainer width="100%" height="90%">
                <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <XAxis dataKey="anomaly" type="number" domain={[0, 1]} tick={{ fontSize: 8, fill: "#555" }}
                    axisLine={{ stroke: "#222" }} tickLine={false} />
                  <YAxis dataKey="reconstruction" type="number" domain={[0, 1]} tick={{ fontSize: 8, fill: "#555" }}
                    axisLine={{ stroke: "#222" }} tickLine={false} />
                  <Tooltip content={<ScatterTooltip />} />
                  <Scatter data={scatterData} cursor="pointer"
                    onClick={(data: any) => setSelectedKey(data?.ticker || data?.name || null)}>
                    {scatterData.map((d, i) => (
                      <Cell key={i}
                        fill={d.type === "company" ? "#00d4ff" : d.type === "filing" ? "#a371f7" : "#3fb950"}
                        fillOpacity={0.6}
                        r={Math.max(2, d.composite * 6)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Cluster matrix */}
            <div className="flex-1 overflow-auto p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] uppercase tracking-widest text-li-text-muted">Cluster Matrix</span>
                <div className="flex items-center gap-2 text-[8px]">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-li-cyan rounded-sm" /> Company</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-li-purple rounded-sm" /> Filing</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-li-green rounded-sm" /> Fact</span>
                </div>
              </div>
              <ClusterMatrix clusters={clustersQ.data?.clusters || []} onSelect={setClusterFilter} />
            </div>
          </div>
        </div>

        {/* ═══════════════ DOSSIER (slides in at bottom) ═══════════════ */}
        {selectedKey && (
          <div className="fixed bottom-0 left-60 right-0 z-50 border-t border-li-cyan/20 bg-li-bg shadow-2xl animate-fade-in-up">
            <Dossier entityKey={selectedKey} onClose={() => setSelectedKey(null)} />
          </div>
        )}
      </main>
    </div>
  );
}
