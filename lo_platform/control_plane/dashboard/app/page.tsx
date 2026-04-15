"use client";

import { useEffect, useState } from "react";
import {
  GitFork,
  Database,
  Search,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { HealthGauge } from "@/components/HealthGauge";
import { UsageChart } from "@/components/UsageChart";
import { ForkStatusBadge, HealthBadge } from "@/components/ForkStatusBadge";
import { controlPlaneAPI } from "@/lib/api";
import type { Fork, FleetMetrics } from "@/lib/types";

// Mock data for demo — replaced by API calls once backend is wired
function generateMockData() {
  const statuses = ["active", "active", "active", "active", "suspended", "provisioning"] as const;
  const healths = ["healthy", "healthy", "healthy", "degraded", "critical"] as const;
  const modules = ["fsd", "btut", "qr-identity", "flow-engine", "niv-economics"];

  const forks: Fork[] = Array.from({ length: 12 }, (_, i) => ({
    id: `fork-${String(i + 1).padStart(3, "0")}`,
    customer_id: `cust-${String((i % 5) + 1).padStart(3, "0")}`,
    subdomain: `${["acme", "globex", "initech", "umbrella", "hooli", "piedpiper", "waystar", "delos", "cyberdyne", "weyland", "tyrell", "aperture"][i]}.latentocean.io`,
    status: statuses[i % statuses.length],
    entity_count: Math.floor(Math.random() * 500000) + 10000,
    last_reduction_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    queries_served_total: Math.floor(Math.random() * 100000) + 5000,
    storage_used_bytes: Math.floor(Math.random() * 50 * 1e9),
    enabled_modules: modules.slice(0, Math.floor(Math.random() * 4) + 1),
    health_status: healths[i % healths.length],
    created_at: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
  }));

  const metrics: FleetMetrics = {
    total_forks: forks.length,
    active_forks: forks.filter((f) => f.status === "active").length,
    suspended_forks: forks.filter((f) => f.status === "suspended").length,
    provisioning_forks: forks.filter((f) => f.status === "provisioning").length,
    total_entities: forks.reduce((s, f) => s + f.entity_count, 0),
    total_queries_30d: forks.reduce((s, f) => s + f.queries_served_total, 0),
    total_mrr: 47500,
    health_distribution: {
      healthy: forks.filter((f) => f.health_status === "healthy").length,
      degraded: forks.filter((f) => f.health_status === "degraded").length,
      critical: forks.filter((f) => f.health_status === "critical").length,
      unknown: 0,
    },
  };

  const chartData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: Math.floor(Math.random() * 5000) + 15000,
  }));

  return { forks, metrics, chartData };
}

export default function FleetOverview() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReturnType<typeof generateMockData> | null>(null);

  useEffect(() => {
    // Try API first, fallback to mock
    (async () => {
      try {
        const forks = await controlPlaneAPI.listForks();
        if (Array.isArray(forks) && forks.length > 0) {
          // TODO: transform API data into FleetMetrics
          setData(generateMockData());
        } else {
          setData(generateMockData());
        }
      } catch {
        setData(generateMockData());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cp-cyan border-t-transparent" />
      </div>
    );
  }

  const { forks, metrics, chartData } = data;
  const topForks = [...forks]
    .sort((a, b) => b.queries_served_total - a.queries_served_total)
    .slice(0, 5);

  const healthScore = Math.round(
    (metrics.health_distribution.healthy / metrics.total_forks) * 100
  );

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-cp-white">Fleet Overview</h1>
        <p className="mt-1 text-sm text-cp-gray-500">
          Real-time status of all managed fork instances
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Forks"
          value={metrics.total_forks}
          change={8.3}
          icon={<GitFork className="h-4 w-4" />}
        />
        <StatCard
          title="Total Entities"
          value={metrics.total_entities.toLocaleString()}
          change={12.1}
          icon={<Database className="h-4 w-4" />}
        />
        <StatCard
          title="Queries (30d)"
          value={metrics.total_queries_30d.toLocaleString()}
          change={5.7}
          icon={<Search className="h-4 w-4" />}
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${metrics.total_mrr.toLocaleString()}`}
          change={15.2}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UsageChart data={chartData} label="Queries Served (30d)" />
        </div>
        <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Fleet Health
          </p>
          <div className="flex items-center justify-center py-2">
            <HealthGauge score={healthScore} size="lg" label="Fleet Score" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-cp-green">
                <CheckCircle className="h-3.5 w-3.5" />
                Healthy
              </span>
              <span className="font-mono text-cp-gray-300">
                {metrics.health_distribution.healthy}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-cp-yellow">
                <AlertTriangle className="h-3.5 w-3.5" />
                Degraded
              </span>
              <span className="font-mono text-cp-gray-300">
                {metrics.health_distribution.degraded}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-cp-red">
                <XCircle className="h-3.5 w-3.5" />
                Critical
              </span>
              <span className="font-mono text-cp-gray-300">
                {metrics.health_distribution.critical}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status distribution + Top forks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Fork status breakdown */}
        <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Fork Status Distribution
          </p>
          <div className="space-y-3">
            {(["active", "suspended", "provisioning", "teardown"] as const).map((status) => {
              const count = forks.filter((f) => f.status === status).length;
              const pct = metrics.total_forks > 0 ? (count / metrics.total_forks) * 100 : 0;
              return (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between">
                    <ForkStatusBadge status={status} />
                    <span className="font-mono text-xs text-cp-gray-400">
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-cp-gray-800">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          status === "active"
                            ? "#3fb950"
                            : status === "provisioning"
                            ? "#00d4ff"
                            : status === "suspended"
                            ? "#d29922"
                            : "#f85149",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top forks */}
        <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Top Forks by Queries
          </p>
          <div className="space-y-2">
            {topForks.map((fork, i) => (
              <div
                key={fork.id}
                className="flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-cp-gray-900"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-cp-gray-600">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-cp-gray-200">
                      {fork.subdomain}
                    </p>
                    <p className="text-xs text-cp-gray-600">{fork.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <HealthBadge health={fork.health_status} />
                  <span className="font-mono text-sm text-cp-gray-300">
                    {fork.queries_served_total.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
          Recent Activity
        </p>
        <div className="space-y-2">
          {[
            { icon: CheckCircle, color: "text-cp-green", msg: "fork-003 reduction completed", time: "2m ago" },
            { icon: GitFork, color: "text-cp-cyan", msg: "fork-012 provisioning started", time: "15m ago" },
            { icon: AlertTriangle, color: "text-cp-yellow", msg: "fork-007 health degraded", time: "1h ago" },
            { icon: Clock, color: "text-cp-gray-400", msg: "fork-001 config updated", time: "3h ago" },
            { icon: DollarSign, color: "text-cp-green", msg: "Invoice INV-2026-042 paid by Globex", time: "5h ago" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-cp-gray-900"
            >
              <item.icon className={`h-4 w-4 flex-shrink-0 ${item.color}`} />
              <span className="flex-1 text-cp-gray-300">{item.msg}</span>
              <span className="text-xs text-cp-gray-600">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
