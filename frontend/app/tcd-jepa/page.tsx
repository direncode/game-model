"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { cn } from "@/lib/utils";
import {
  Network,
  Zap,
  Database,
  ArrowRight,
  Package,
  BarChart3,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  Download,
  Play,
  RefreshCw,
} from "lucide-react";

// =====================================================================
// TYPES
// =====================================================================

interface ModuleEntry {
  id: string;
  vertical: string;
  module_type: string;
  purity: number;
  quality_score: number;
  members: string[];
  provenance_job_id: string | null;
  created_at: string;
}

interface RouteDecision {
  module_id: string | null;
  score: number;
  reason: string;
}

// =====================================================================
// SUB-COMPONENTS
// =====================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="bg-li-gray-900/60 border border-li-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", accent)} />
        <span className="text-[10px] uppercase tracking-widest text-li-text-muted">
          {label}
        </span>
      </div>
      <div className="text-xl font-bold text-white font-mono">{value}</div>
    </div>
  );
}

function ModuleTypeTag({ type }: { type: string }) {
  const colors: Record<string, string> = {
    attractor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    cycle: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    boundary: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[10px] font-mono uppercase rounded border",
        colors[type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30"
      )}
    >
      {type}
    </span>
  );
}

function PurityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 w-24">
      <div className="flex-1 h-1.5 bg-li-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-li-text-muted">{pct}%</span>
    </div>
  );
}

function ModuleRow({
  module,
  onExport,
}: {
  module: ModuleEntry;
  onExport: (id: string, format: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr
        className="border-b border-li-gray-800/50 hover:bg-li-gray-900/40 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-2 px-3 font-mono text-xs text-li-text-muted">
          {module.id.slice(0, 8)}
        </td>
        <td className="py-2 px-3">
          <ModuleTypeTag type={module.module_type} />
        </td>
        <td className="py-2 px-3">
          <PurityBar value={module.purity} />
        </td>
        <td className="py-2 px-3 font-mono text-xs text-white">
          {module.quality_score.toFixed(3)}
        </td>
        <td className="py-2 px-3 text-xs text-li-text-muted">
          {module.members.length} entities
        </td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExport(module.id, "json");
              }}
              className="text-[10px] px-2 py-0.5 bg-li-gray-800 hover:bg-li-gray-700 rounded text-li-text-muted transition-colors"
            >
              JSON
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExport(module.id, "pt");
              }}
              className="text-[10px] px-2 py-0.5 bg-li-gray-800 hover:bg-li-gray-700 rounded text-li-text-muted transition-colors"
            >
              PT
            </button>
            {expanded ? (
              <ChevronUp className="w-3 h-3 text-li-text-muted" />
            ) : (
              <ChevronDown className="w-3 h-3 text-li-text-muted" />
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-li-gray-900/20">
          <td colSpan={6} className="py-3 px-6">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-li-text-muted">Provenance: </span>
                <span className="font-mono text-white">
                  {module.provenance_job_id ?? "unknown"}
                </span>
              </div>
              <div>
                <span className="text-li-text-muted">Created: </span>
                <span className="font-mono text-white">
                  {new Date(module.created_at).toLocaleString()}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-li-text-muted">Members: </span>
                <span className="font-mono text-white">
                  {module.members.slice(0, 10).join(", ")}
                  {module.members.length > 10 &&
                    ` (+${module.members.length - 10} more)`}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// =====================================================================
// PIPELINE VISUALIZATION
// =====================================================================

function PipelineStage({
  label,
  icon: Icon,
  status,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "idle" | "active" | "done";
}) {
  const colors = {
    idle: "border-li-gray-700 text-li-text-muted",
    active: "border-cyan-500 text-cyan-400 animate-pulse",
    done: "border-green-500/50 text-green-400",
  };
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border bg-li-gray-900/40",
        colors[status]
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function PipelineFlow() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <PipelineStage label="BTUT Survivors" icon={Database} status="done" />
      <ArrowRight className="w-4 h-4 text-li-text-muted" />
      <PipelineStage label="Stream Encoder" icon={Zap} status="idle" />
      <ArrowRight className="w-4 h-4 text-li-text-muted" />
      <PipelineStage label="Langevin Explorer" icon={Activity} status="idle" />
      <ArrowRight className="w-4 h-4 text-li-text-muted" />
      <PipelineStage
        label="Module Crystallizer"
        icon={Layers}
        status="idle"
      />
      <ArrowRight className="w-4 h-4 text-li-text-muted" />
      <PipelineStage label="Registry" icon={Package} status="idle" />
    </div>
  );
}

// =====================================================================
// MAIN PAGE
// =====================================================================

export default function TCDJEPAPage() {
  const [modules, setModules] = useState<ModuleEntry[]>([]);
  const [routeResult, setRouteResult] = useState<RouteDecision[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState("trading");

  const fetchModules = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/tcd/verticals/${sessionId}/modules?min_quality=0`
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setModules(data.modules ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const createSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/tcd/verticals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setSessionId(data.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [preset]);

  const handleExport = useCallback(
    async (moduleId: string, format: string) => {
      try {
        const res = await fetch(
          `/api/v1/tcd/modules/${moduleId}/export?format=${format}`
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${moduleId.slice(0, 8)}.${format === "pt" ? "pt" : "json"}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e: any) {
        setError(e.message);
      }
    },
    []
  );

  // ── Summary stats ──
  const totalModules = modules.length;
  const avgPurity =
    totalModules > 0
      ? modules.reduce((s, m) => s + m.purity, 0) / totalModules
      : 0;
  const avgQuality =
    totalModules > 0
      ? modules.reduce((s, m) => s + m.quality_score, 0) / totalModules
      : 0;
  const typeBreakdown = modules.reduce(
    (acc, m) => {
      acc[m.module_type] = (acc[m.module_type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14 p-6">
        {/* ── Header ─────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Network className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">
              TCD-JEPA Module Factory
            </h1>
          </div>
          <p className="text-sm text-li-text-muted max-w-2xl">
            Topological Crystallization Dynamics applied to JEPA. Turns
            BTUT-thinned survivors into interpretable, typed, routable neural
            modules via persistent homology and Langevin energy landscape
            exploration.
          </p>
        </div>

        {/* ── Pipeline Flow ─────────────────────────── */}
        <div className="mb-6 bg-li-gray-900/40 border border-li-gray-800 rounded-lg p-4">
          <h2 className="text-xs uppercase tracking-widest text-li-text-muted mb-3">
            3-System Recursive Loop
          </h2>
          <PipelineFlow />
        </div>

        {/* ── Session Controls ──────────────────────── */}
        <div className="mb-6 flex items-center gap-3">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="bg-li-gray-900 border border-li-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="trading">Trading</option>
            <option value="inference">Inference</option>
            <option value="sovereign">Sovereign</option>
            <option value="generic">Generic</option>
          </select>
          {!sessionId ? (
            <button
              onClick={createSession}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm text-white font-medium transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Create Session
            </button>
          ) : (
            <>
              <span className="text-xs font-mono text-li-text-muted">
                Session: {sessionId.slice(0, 8)}...
              </span>
              <button
                onClick={fetchModules}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-li-gray-800 hover:bg-li-gray-700 disabled:opacity-50 rounded-md text-sm text-white transition-colors"
              >
                <RefreshCw
                  className={cn("w-3.5 h-3.5", loading && "animate-spin")}
                />
                Refresh Modules
              </button>
            </>
          )}
          {error && (
            <span className="text-xs text-red-400 ml-2">{error}</span>
          )}
        </div>

        {/* ── Stats Grid ──────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Modules"
            value={totalModules}
            icon={Package}
            accent="text-cyan-400"
          />
          <StatCard
            label="Avg Purity"
            value={avgPurity > 0 ? `${(avgPurity * 100).toFixed(1)}%` : "--"}
            icon={BarChart3}
            accent="text-green-400"
          />
          <StatCard
            label="Avg Quality"
            value={
              avgQuality > 0 ? `${(avgQuality * 100).toFixed(1)}%` : "--"
            }
            icon={Activity}
            accent="text-amber-400"
          />
          <StatCard
            label="Module Types"
            value={
              Object.keys(typeBreakdown).length > 0
                ? Object.entries(typeBreakdown)
                    .map(([k, v]) => `${v} ${k}`)
                    .join(", ")
                : "--"
            }
            icon={Layers}
            accent="text-purple-400"
          />
        </div>

        {/* ── Module Registry Table ─────────────────── */}
        <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-li-gray-800">
            <h2 className="text-xs uppercase tracking-widest text-li-text-muted">
              Crystallized Module Registry
            </h2>
            {totalModules > 0 && (
              <button
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify(modules, null, 2)],
                    { type: "application/json" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "modules_export.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1 text-[10px] text-li-text-muted hover:text-white transition-colors"
              >
                <Download className="w-3 h-3" />
                Export All
              </button>
            )}
          </div>
          {totalModules === 0 ? (
            <div className="p-12 text-center text-li-text-muted text-sm">
              {sessionId
                ? "No modules yet. Run crystallization on a BTUT job or push incremental bundles."
                : "Create a session to start discovering modules."}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-li-gray-800 text-[10px] uppercase tracking-widest text-li-text-muted">
                  <th className="py-2 px-3 text-left">ID</th>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-left">Purity</th>
                  <th className="py-2 px-3 text-left">Quality</th>
                  <th className="py-2 px-3 text-left">Members</th>
                  <th className="py-2 px-3 text-left">Export</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <ModuleRow
                    key={m.id}
                    module={m}
                    onExport={handleExport}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
