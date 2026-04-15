"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GitFork,
  Search,
  Filter,
  Pause,
  Play,
  Zap,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ForkStatusBadge, HealthBadge } from "@/components/ForkStatusBadge";
import { controlPlaneAPI } from "@/lib/api";
import type { Fork, ForkStatus } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1e6) return `${(bytes / 1e3).toFixed(0)} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Mock forks for demo
function generateMockForks(): Fork[] {
  const names = [
    "acme", "globex", "initech", "umbrella", "hooli",
    "piedpiper", "waystar", "delos", "cyberdyne", "weyland", "tyrell", "aperture",
  ];
  const statuses: ForkStatus[] = ["active", "active", "active", "active", "suspended", "provisioning"];
  const healths = ["healthy", "healthy", "healthy", "degraded", "critical"] as const;
  const modules = ["fsd", "btut", "qr-identity", "flow-engine"];

  return names.map((name, i) => ({
    id: `fork-${String(i + 1).padStart(3, "0")}`,
    customer_id: `cust-${String((i % 5) + 1).padStart(3, "0")}`,
    subdomain: `${name}.latentocean.io`,
    status: statuses[i % statuses.length],
    entity_count: Math.floor(Math.random() * 500000) + 10000,
    last_reduction_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    queries_served_total: Math.floor(Math.random() * 100000) + 5000,
    storage_used_bytes: Math.floor(Math.random() * 50 * 1e9),
    enabled_modules: modules.slice(0, Math.floor(Math.random() * 4) + 1),
    health_status: healths[i % healths.length],
    created_at: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
  }));
}

type SortField = "subdomain" | "entity_count" | "queries_served_total" | "storage_used_bytes";

export default function ForksPage() {
  const [forks, setForks] = useState<Fork[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ForkStatus | "all">("all");
  const [sortField, setSortField] = useState<SortField>("subdomain");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await controlPlaneAPI.listForks();
        setForks(Array.isArray(data) && data.length > 0 ? data : generateMockForks());
      } catch {
        setForks(generateMockForks());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAction = async (forkId: string, action: "suspend" | "resume" | "reduce" | "delete") => {
    setActionLoading(forkId);
    try {
      if (action === "suspend") await controlPlaneAPI.suspendFork(forkId);
      else if (action === "resume") await controlPlaneAPI.resumeFork(forkId);
      else if (action === "reduce") await controlPlaneAPI.triggerReduction(forkId);
      else if (action === "delete") await controlPlaneAPI.deleteFork(forkId);
    } catch {
      // silently handle — in real impl, show toast
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === "asc" ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )
    ) : null;

  const filtered = forks
    .filter((f) => (statusFilter === "all" ? true : f.status === statusFilter))
    .filter((f) =>
      search
        ? f.subdomain.toLowerCase().includes(search.toLowerCase()) ||
          f.id.toLowerCase().includes(search.toLowerCase())
        : true
    )
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "subdomain") return a.subdomain.localeCompare(b.subdomain) * dir;
      return ((a[sortField] as number) - (b[sortField] as number)) * dir;
    });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cp-cyan border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cp-white">Fork Management</h1>
          <p className="mt-1 text-sm text-cp-gray-500">
            {forks.length} fork{forks.length !== 1 ? "s" : ""} deployed
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-md bg-cp-cyan/10 px-4 py-2 text-sm font-medium text-cp-cyan transition-colors hover:bg-cp-cyan/20">
          <GitFork className="h-4 w-4" />
          New Fork
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cp-gray-600" />
          <input
            type="text"
            placeholder="Search forks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-cp-border bg-cp-black-elevated py-2 pl-9 pr-4 text-sm text-cp-gray-200 placeholder:text-cp-gray-700 focus:border-cp-cyan/40 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-cp-gray-600" />
          {(["all", "active", "suspended", "provisioning", "teardown"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-cp-cyan/10 text-cp-cyan"
                  : "text-cp-gray-500 hover:bg-cp-gray-800 hover:text-cp-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-cp-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cp-border bg-cp-black-light">
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500"
                onClick={() => toggleSort("subdomain")}
              >
                <span className="flex items-center gap-1">
                  Subdomain <SortIcon field="subdomain" />
                </span>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500">
                Status
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500"
                onClick={() => toggleSort("entity_count")}
              >
                <span className="flex items-center gap-1">
                  Entities <SortIcon field="entity_count" />
                </span>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500"
                onClick={() => toggleSort("queries_served_total")}
              >
                <span className="flex items-center gap-1">
                  Queries <SortIcon field="queries_served_total" />
                </span>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500"
                onClick={() => toggleSort("storage_used_bytes")}
              >
                <span className="flex items-center gap-1">
                  Storage <SortIcon field="storage_used_bytes" />
                </span>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500">
                Health
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500">
                Last Reduction
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-cp-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((fork) => (
              <tr
                key={fork.id}
                className="table-row-hover border-b border-cp-border/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/forks/${fork.id}`}
                    className="font-medium text-cp-gray-200 hover:text-cp-cyan"
                  >
                    {fork.subdomain}
                  </Link>
                  <p className="font-mono text-xs text-cp-gray-700">{fork.id}</p>
                </td>
                <td className="px-4 py-3">
                  <ForkStatusBadge status={fork.status} />
                </td>
                <td className="px-4 py-3 font-mono text-cp-gray-300">
                  {fork.entity_count.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-cp-gray-300">
                  {fork.queries_served_total.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-cp-gray-300">
                  {formatBytes(fork.storage_used_bytes)}
                </td>
                <td className="px-4 py-3">
                  <HealthBadge health={fork.health_status} />
                </td>
                <td className="px-4 py-3 text-xs text-cp-gray-500">
                  {formatRelative(fork.last_reduction_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {fork.status === "active" ? (
                      <button
                        title="Suspend"
                        onClick={() => handleAction(fork.id, "suspend")}
                        disabled={actionLoading === fork.id}
                        className="rounded p-1.5 text-cp-gray-500 transition-colors hover:bg-cp-yellow/10 hover:text-cp-yellow"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    ) : fork.status === "suspended" ? (
                      <button
                        title="Resume"
                        onClick={() => handleAction(fork.id, "resume")}
                        disabled={actionLoading === fork.id}
                        className="rounded p-1.5 text-cp-gray-500 transition-colors hover:bg-cp-green/10 hover:text-cp-green"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <button
                      title="Trigger Reduction"
                      onClick={() => handleAction(fork.id, "reduce")}
                      disabled={actionLoading === fork.id}
                      className="rounded p-1.5 text-cp-gray-500 transition-colors hover:bg-cp-cyan/10 hover:text-cp-cyan"
                    >
                      <Zap className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => handleAction(fork.id, "delete")}
                      disabled={actionLoading === fork.id}
                      className="rounded p-1.5 text-cp-gray-500 transition-colors hover:bg-cp-red/10 hover:text-cp-red"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-cp-gray-600">
            No forks match your filters
          </div>
        )}
      </div>
    </div>
  );
}
