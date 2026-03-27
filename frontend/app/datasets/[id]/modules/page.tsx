"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import { cn, percentColor, truncate, formatPercent } from "@/lib/utils";
import type { Module } from "@/lib/types";
import { Boxes, Filter, ArrowUpDown } from "lucide-react";

type SortKey = "purity" | "entity_count" | "index";
type SortDir = "asc" | "desc";

export default function ModulesPage() {
  const params = useParams();
  const datasetId = params.id as string;

  const [sortKey, setSortKey] = useState<SortKey>("index");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const { data: modules, isLoading } = useQuery({
    queryKey: ["modules", datasetId],
    queryFn: () => api.listModules(datasetId) as Promise<Module[]>,
  });

  const allTypes = useMemo(() => {
    if (!modules) return [];
    const types = new Set<string>();
    (modules as Module[]).forEach((m) => {
      if (m.dominant_type) types.add(m.dominant_type);
    });
    return Array.from(types).sort();
  }, [modules]);

  const filteredSorted = useMemo(() => {
    if (!modules) return [];
    let result = [...(modules as Module[])];

    if (filterConfidence !== "all") {
      result = result.filter((m) => m.confidence === filterConfidence);
    }
    if (filterType !== "all") {
      result = result.filter((m) => m.dominant_type === filterType);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "purity") cmp = a.purity_score - b.purity_score;
      else if (sortKey === "entity_count") cmp = a.entity_count - b.entity_count;
      else cmp = a.index - b.index;
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [modules, filterConfidence, filterType, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-display text-li-text-primary">
            Modules
          </h2>
          <p className="text-sm text-li-text-secondary mt-1">
            {filteredSorted.length} modules discovered
          </p>
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-li-text-muted" />
          <select
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value)}
            className="li-input py-1.5 px-3 text-sm w-auto"
          >
            <option value="all">All Confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {allTypes.length > 0 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="li-input py-1.5 px-3 text-sm w-auto"
            >
              <option value="all">All Types</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="w-4 h-4 text-li-text-muted" />
          {(["index", "purity", "entity_count"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-data transition-colors",
                sortKey === key
                  ? "bg-li-primary/10 text-li-primary"
                  : "text-li-text-muted hover:text-li-text-secondary"
              )}
            >
              {key === "entity_count"
                ? "Count"
                : key.charAt(0).toUpperCase() + key.slice(1)}
              {sortKey === key && (sortDir === "asc" ? " ^" : " v")}
            </button>
          ))}
        </div>
      </div>

      {/* Module Grid */}
      {filteredSorted.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSorted.map((module) => (
            <Link
              key={module.id}
              href={`/datasets/${datasetId}/modules/${module.id}`}
              className="li-card group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-li-text-primary group-hover:text-li-primary transition-colors">
                    {module.name || `Module ${module.index}`}
                  </h3>
                  <p className="text-xs text-li-text-muted font-data mt-0.5">
                    {module.entity_count} entities
                  </p>
                </div>
                <span
                  className={cn(
                    "li-badge",
                    module.confidence === "high"
                      ? "bg-li-accent/20 text-li-accent"
                      : module.confidence === "medium"
                      ? "bg-li-warning/20 text-li-warning"
                      : "bg-li-text-muted/20 text-li-text-muted"
                  )}
                >
                  {module.confidence}
                </span>
              </div>

              {/* Purity score */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-li-text-muted">Purity</span>
                  <span
                    className={cn(
                      "text-sm font-display",
                      percentColor(module.purity_score * 100)
                    )}
                  >
                    {formatPercent(module.purity_score * 100)}
                  </span>
                </div>
                <div className="w-full bg-li-bg rounded-full h-1.5">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      module.purity_score >= 0.9
                        ? "bg-li-accent"
                        : module.purity_score >= 0.7
                        ? "bg-li-warning"
                        : "bg-li-danger"
                    )}
                    style={{ width: `${module.purity_score * 100}%` }}
                  />
                </div>
              </div>

              {/* Dominant type */}
              {module.dominant_type && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-li-text-muted">Type:</span>
                  <span className="li-badge bg-li-primary/10 text-li-primary">
                    {module.dominant_type}
                  </span>
                </div>
              )}

              {/* Description */}
              {module.description && (
                <p className="text-xs text-li-text-secondary mt-3 line-clamp-2">
                  {truncate(module.description, 120)}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Boxes}
          title="No modules found"
          description="Run crystallization on this dataset to discover latent modules."
          action={
            <Link
              href={`/datasets/${datasetId}/crystallize`}
              className="li-btn-primary"
            >
              Start Crystallization
            </Link>
          }
        />
      )}
    </div>
  );
}
