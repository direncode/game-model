"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLoader } from "@/components/LoadingSpinner";
import { cn, percentColor, formatPercent } from "@/lib/utils";
import type { Module, Entity, PaginatedResponse } from "@/lib/types";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Boxes, Crown, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

export default function ModuleDetailPage() {
  const params = useParams();
  const datasetId = params.id as string;
  const moduleId = params.moduleId as string;
  const [entityPage, setEntityPage] = useState(1);

  const { data: module, isLoading: moduleLoading } = useQuery({
    queryKey: ["module", moduleId],
    queryFn: () => api.getModule(moduleId) as Promise<Module>,
  });

  const { data: entitiesData, isLoading: entitiesLoading } = useQuery({
    queryKey: ["module-entities", moduleId, entityPage],
    queryFn: () =>
      api.getModuleEntities(moduleId, entityPage, 20) as Promise<
        PaginatedResponse<Entity>
      >,
  });

  if (moduleLoading) return <PageLoader />;
  if (!module) return <div className="text-li-text-muted">Module not found</div>;

  const typeDistData = Object.entries(module.type_distribution || {}).map(
    ([name, value]) => ({ name, value })
  );

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href={`/datasets/${datasetId}/modules`}
        className="inline-flex items-center gap-1 text-sm text-li-text-muted hover:text-li-primary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Modules
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-display text-li-text-primary">
              {module.name || `Module ${module.index}`}
            </h2>
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
              {module.confidence} confidence
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-li-text-secondary">
              <span className={cn("font-display", percentColor(module.purity_score * 100))}>
                {formatPercent(module.purity_score * 100)}
              </span>{" "}
              purity
            </span>
            <span className="text-li-text-secondary">
              <span className="font-display text-li-text-primary">
                {module.entity_count}
              </span>{" "}
              entities
            </span>
            {module.dominant_type && (
              <span className="li-badge bg-li-primary/10 text-li-primary">
                {module.dominant_type}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/datasets/${datasetId}/challenges`}
          className="li-btn-secondary flex items-center gap-2 text-sm"
        >
          <AlertTriangle className="w-4 h-4" />
          Challenge
        </Link>
      </div>

      {/* Description */}
      {module.description && (
        <div className="li-card">
          <h3 className="text-sm font-display text-li-text-primary mb-2">
            Description
          </h3>
          <p className="text-sm text-li-text-secondary">{module.description}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Distribution Pie Chart */}
        {typeDistData.length > 0 && (
          <div className="li-card">
            <h3 className="text-sm font-display text-li-text-primary mb-4">
              Type Distribution
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={typeDistData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {typeDistData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #1F2937",
                    borderRadius: "8px",
                    color: "#F9FAFB",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Anchor Entities */}
        <div className="li-card">
          <h3 className="text-sm font-display text-li-text-primary mb-4 flex items-center gap-2">
            <Crown className="w-4 h-4 text-li-warning" />
            Anchor Entities
          </h3>
          {module.anchor_entities && module.anchor_entities.length > 0 ? (
            <div className="space-y-3">
              {module.anchor_entities.slice(0, 5).map((entity, i) => (
                <div
                  key={entity.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-li-bg border border-li-border"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-data text-li-text-muted w-5">
                      #{i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-li-text-primary">
                        {entity.name}
                      </p>
                      <p className="text-xs text-li-text-muted">{entity.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-data font-bold text-li-primary">
                      {entity.centrality.toFixed(4)}
                    </p>
                    <p className="text-xs text-li-text-muted">centrality</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-li-text-muted">No anchor entities</p>
          )}
        </div>
      </div>

      {/* Entity Table */}
      <div className="li-card">
        <h3 className="text-sm font-display text-li-text-primary mb-4">
          All Entities
        </h3>

        {entitiesLoading ? (
          <PageLoader />
        ) : entitiesData?.items ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-li-border">
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Name
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Type
                    </th>
                    <th className="text-right text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Centrality
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-li-border">
                  {entitiesData.items.map((entity: Entity) => (
                    <tr
                      key={entity.id}
                      className="hover:bg-li-surface-hover transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-li-text-primary">
                        {entity.name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="li-badge bg-li-primary/10 text-li-primary">
                          {entity.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-data text-li-text-secondary text-right">
                        {entity.centrality.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {entitiesData.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-li-border">
                <p className="text-xs text-li-text-muted font-data">
                  Page {entitiesData.page} of {entitiesData.total_pages} ({entitiesData.total} total)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEntityPage(Math.max(1, entityPage - 1))}
                    disabled={entityPage <= 1}
                    className="li-btn-ghost p-2 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setEntityPage(
                        Math.min(entitiesData.total_pages, entityPage + 1)
                      )
                    }
                    disabled={entityPage >= entitiesData.total_pages}
                    className="li-btn-ghost p-2 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-li-text-muted">No entities</p>
        )}
      </div>

      {/* Graph Visualization Placeholder */}
      <div className="li-card">
        <h3 className="text-sm font-display text-li-text-primary mb-4">
          Internal Graph
        </h3>
        <div className="h-64 rounded-lg bg-li-bg border border-li-border flex items-center justify-center">
          <div className="text-center">
            <Boxes className="w-8 h-8 text-li-text-muted mx-auto mb-2" />
            <p className="text-sm text-li-text-muted">
              D3 force-directed graph visualization
            </p>
            <p className="text-xs text-li-text-muted mt-1">
              Showing internal module structure
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
