"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Pause,
  Play,
  Zap,
  Settings,
  Package,
} from "lucide-react";
import { ForkStatusBadge, HealthBadge } from "@/components/ForkStatusBadge";
import { StatCard } from "@/components/StatCard";
import { HealthGauge } from "@/components/HealthGauge";
import { UsageChart } from "@/components/UsageChart";
import { controlPlaneAPI } from "@/lib/api";
import type { Fork } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1e6) return `${(bytes / 1e3).toFixed(0)} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

function generateMockFork(id: string): Fork {
  return {
    id,
    customer_id: "cust-001",
    subdomain: `${id.replace("fork-", "")}.latentocean.io`,
    status: "active",
    entity_count: 245000,
    last_reduction_at: new Date(Date.now() - 3600000).toISOString(),
    queries_served_total: 87432,
    storage_used_bytes: 12.4 * 1e9,
    enabled_modules: ["fsd", "btut", "qr-identity"],
    health_status: "healthy",
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
  };
}

export default function ForkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const forkId = params.forkId as string;

  const [fork, setFork] = useState<Fork | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const entityChart = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: Math.floor(200000 + Math.random() * 50000),
  }));

  const queryChart = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: Math.floor(2000 + Math.random() * 4000),
  }));

  const reductions = [
    { id: "red-005", started: "2h ago", duration: "4m 12s", entities: "245,000", status: "complete" },
    { id: "red-004", started: "1d ago", duration: "3m 58s", entities: "238,200", status: "complete" },
    { id: "red-003", started: "3d ago", duration: "4m 45s", entities: "231,000", status: "complete" },
    { id: "red-002", started: "5d ago", duration: "5m 01s", entities: "224,800", status: "complete" },
  ];

  useEffect(() => {
    (async () => {
      try {
        const data = await controlPlaneAPI.getFork(forkId);
        setFork(data?.id ? data : generateMockFork(forkId));
      } catch {
        setFork(generateMockFork(forkId));
      } finally {
        setLoading(false);
      }
    })();
  }, [forkId]);

  const handleAction = async (action: "suspend" | "resume" | "reduce") => {
    setActionLoading(true);
    try {
      if (action === "suspend") await controlPlaneAPI.suspendFork(forkId);
      else if (action === "resume") await controlPlaneAPI.resumeFork(forkId);
      else await controlPlaneAPI.triggerReduction(forkId);
    } catch {
      // toast
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !fork) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cp-cyan border-t-transparent" />
      </div>
    );
  }

  const healthScore =
    fork.health_status === "healthy" ? 95 : fork.health_status === "degraded" ? 62 : 28;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/forks")}
            className="rounded p-1 text-cp-gray-500 hover:bg-cp-gray-800 hover:text-cp-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-cp-white">{fork.subdomain}</h1>
              <a
                href={`https://${fork.subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cp-gray-600 hover:text-cp-cyan"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <ForkStatusBadge status={fork.status} />
              <HealthBadge health={fork.health_status} />
              <span className="font-mono text-xs text-cp-gray-600">{fork.id}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fork.status === "active" ? (
            <button
              onClick={() => handleAction("suspend")}
              disabled={actionLoading}
              className="flex items-center gap-1.5 rounded-md border border-cp-yellow/30 bg-cp-yellow/10 px-3 py-1.5 text-xs font-medium text-cp-yellow transition-colors hover:bg-cp-yellow/20"
            >
              <Pause className="h-3.5 w-3.5" />
              Suspend
            </button>
          ) : fork.status === "suspended" ? (
            <button
              onClick={() => handleAction("resume")}
              disabled={actionLoading}
              className="flex items-center gap-1.5 rounded-md border border-cp-green/30 bg-cp-green/10 px-3 py-1.5 text-xs font-medium text-cp-green transition-colors hover:bg-cp-green/20"
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </button>
          ) : null}
          <button
            onClick={() => handleAction("reduce")}
            disabled={actionLoading}
            className="flex items-center gap-1.5 rounded-md border border-cp-cyan/30 bg-cp-cyan/10 px-3 py-1.5 text-xs font-medium text-cp-cyan transition-colors hover:bg-cp-cyan/20"
          >
            <Zap className="h-3.5 w-3.5" />
            Trigger Reduction
          </button>
          <button className="flex items-center gap-1.5 rounded-md border border-cp-border px-3 py-1.5 text-xs font-medium text-cp-gray-400 transition-colors hover:bg-cp-gray-800 hover:text-cp-gray-200">
            <Settings className="h-3.5 w-3.5" />
            Config
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Entities" value={fork.entity_count.toLocaleString()} change={5.2} />
        <StatCard title="Queries Served" value={fork.queries_served_total.toLocaleString()} change={12.7} />
        <StatCard title="Storage Used" value={formatBytes(fork.storage_used_bytes)} change={3.1} />
        <StatCard
          title="Customer"
          value={fork.customer_id}
          icon={
            <Link href={`/customers/${fork.customer_id}`} className="text-cp-cyan hover:text-cp-cyan/80">
              <ExternalLink className="h-4 w-4" />
            </Link>
          }
        />
      </div>

      {/* Charts + Health */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <UsageChart data={entityChart} label="Entities (14d)" color="#3fb950" />
        <UsageChart data={queryChart} label="Queries (14d)" color="#00d4ff" />
        <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Health Score
          </p>
          <div className="flex items-center justify-center py-4">
            <HealthGauge score={healthScore} size="lg" />
          </div>
        </div>
      </div>

      {/* Modules + Reductions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Enabled Modules */}
        <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Enabled Modules
          </p>
          <div className="space-y-2">
            {fork.enabled_modules.map((mod) => (
              <div
                key={mod}
                className="flex items-center justify-between rounded-md bg-cp-gray-900 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-cp-cyan" />
                  <span className="text-sm font-medium text-cp-gray-200">{mod}</span>
                </div>
                <span className="rounded bg-cp-green/15 px-2 py-0.5 text-xs text-cp-green">
                  active
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reductions */}
        <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Recent Reductions
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-cp-gray-600">
                <th className="pb-2 text-left font-medium">ID</th>
                <th className="pb-2 text-left font-medium">Started</th>
                <th className="pb-2 text-left font-medium">Duration</th>
                <th className="pb-2 text-right font-medium">Entities</th>
              </tr>
            </thead>
            <tbody>
              {reductions.map((r) => (
                <tr key={r.id} className="border-t border-cp-border/30">
                  <td className="py-2 font-mono text-xs text-cp-gray-400">{r.id}</td>
                  <td className="py-2 text-cp-gray-400">{r.started}</td>
                  <td className="py-2 font-mono text-cp-gray-400">{r.duration}</td>
                  <td className="py-2 text-right font-mono text-cp-gray-300">{r.entities}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
