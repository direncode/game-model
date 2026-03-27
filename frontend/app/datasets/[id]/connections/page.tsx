"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import type { HiddenConnection, PaginatedResponse } from "@/lib/types";
import toast from "react-hot-toast";
import { Link2, Check, X, Filter } from "lucide-react";

type ValidationFilter = "all" | "unvalidated" | "validated" | "invalidated";

export default function ConnectionsPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const datasetId = params.id as string;
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ValidationFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["connections", datasetId, page],
    queryFn: () =>
      api.listConnections(datasetId, page) as Promise<
        PaginatedResponse<HiddenConnection>
      >,
  });

  const validateMutation = useMutation({
    mutationFn: ({
      id,
      validated,
    }: {
      id: string;
      validated: boolean;
    }) => api.validateConnection(id, validated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", datasetId] });
      toast.success("Connection updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update connection");
    },
  });

  const filtered = useMemo(() => {
    if (!data?.items) return [];
    if (filter === "all") return data.items;
    return data.items.filter((c) => c.validation_status === filter);
  }, [data, filter]);

  const statusCounts = useMemo(() => {
    if (!data?.items) return { all: 0, unvalidated: 0, validated: 0, invalidated: 0 };
    return {
      all: data.items.length,
      unvalidated: data.items.filter((c) => c.validation_status === "unvalidated").length,
      validated: data.items.filter((c) => c.validation_status === "validated").length,
      invalidated: data.items.filter((c) => c.validation_status === "invalidated").length,
    };
  }, [data]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-display text-li-text-primary">
            Hidden Connections
          </h2>
          <p className="text-sm text-li-text-secondary mt-1">
            {data?.total || 0} connections discovered across modules
          </p>
        </div>
      </div>

      {/* Summary counts */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-li-text-muted font-data">
          Total: <span className="text-li-text-primary font-bold">{statusCounts.all}</span>
        </span>
        <span className="text-li-warning font-data">
          Unvalidated: <span className="font-bold">{statusCounts.unvalidated}</span>
        </span>
        <span className="text-li-accent font-data">
          Validated: <span className="font-bold">{statusCounts.validated}</span>
        </span>
        <span className="text-li-danger font-data">
          Invalidated: <span className="font-bold">{statusCounts.invalidated}</span>
        </span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-li-text-muted" />
        {(["all", "unvalidated", "validated", "invalidated"] as ValidationFilter[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-data capitalize transition-colors",
                filter === f
                  ? "bg-li-primary/10 text-li-primary"
                  : "text-li-text-muted hover:text-li-text-secondary"
              )}
            >
              {f}
            </button>
          )
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="li-card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-li-border">
                <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                  Source Entity
                </th>
                <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                  Target Entity
                </th>
                <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                  Similarity
                </th>
                <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                  Source Module
                </th>
                <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                  Target Module
                </th>
                <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                  Status
                </th>
                <th className="text-right text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-li-border">
              {filtered.map((conn) => (
                <tr
                  key={conn.id}
                  className="hover:bg-li-surface-hover transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-li-text-primary">
                    {conn.source_entity_name}
                  </td>
                  <td className="py-3 px-4 text-sm text-li-text-primary">
                    {conn.target_entity_name}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-li-bg rounded-full h-1.5 w-20">
                        <div
                          className="bg-li-primary h-1.5 rounded-full"
                          style={{
                            width: `${conn.similarity_score * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-data text-li-text-secondary">
                        {(conn.similarity_score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs font-data text-li-text-secondary">
                    {conn.source_module_name || conn.source_module_id.slice(0, 8)}
                  </td>
                  <td className="py-3 px-4 text-xs font-data text-li-text-secondary">
                    {conn.target_module_name || conn.target_module_id.slice(0, 8)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        "li-badge",
                        conn.validation_status === "validated"
                          ? "bg-li-accent/20 text-li-accent"
                          : conn.validation_status === "invalidated"
                          ? "bg-li-danger/20 text-li-danger"
                          : "bg-li-warning/20 text-li-warning"
                      )}
                    >
                      {conn.validation_status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() =>
                          validateMutation.mutate({
                            id: conn.id,
                            validated: true,
                          })
                        }
                        className="p-1.5 rounded-lg hover:bg-li-accent/10 text-li-text-muted hover:text-li-accent transition-colors"
                        title="Validate"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          validateMutation.mutate({
                            id: conn.id,
                            validated: false,
                          })
                        }
                        className="p-1.5 rounded-lg hover:bg-li-danger/10 text-li-text-muted hover:text-li-danger transition-colors"
                        title="Invalidate"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Link2}
          title="No connections found"
          description="Run crystallization first to discover hidden connections between entities."
        />
      )}
    </div>
  );
}
