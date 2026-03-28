"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import ChallengeForm from "@/components/forms/ChallengeForm";
import type { ChallengeFormData } from "@/components/forms/ChallengeForm";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import { cn, formatDate } from "@/lib/utils";
import type { Challenge } from "@/lib/types";
import { AlertTriangle, Plus, Filter, X } from "lucide-react";

const typeLabels: Record<string, string> = {
  module_assignment: "Module Assignment",
  connection_validity: "Connection Validity",
  data_quality: "Data Quality",
  interpretation: "Interpretation",
};

export default function ChallengesPage() {
  const params = useParams();
  const datasetId = params.id as string;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: challenges, isLoading } = useQuery({
    queryKey: ["challenges", datasetId],
    queryFn: () => api.listChallenges(datasetId) as Promise<Challenge[]>,
  });

  const statusCounts = useMemo(() => {
    if (!challenges) return { open: 0, under_review: 0, accepted: 0, rejected: 0, deferred: 0 };
    const counts: Record<string, number> = { open: 0, under_review: 0, accepted: 0, rejected: 0, deferred: 0 };
    (challenges as Challenge[]).forEach((c) => {
      if (counts[c.status] !== undefined) counts[c.status]++;
    });
    return counts;
  }, [challenges]);

  const filtered = useMemo(() => {
    if (!challenges) return [];
    let result = [...(challenges as Challenge[])];
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    if (typeFilter !== "all") result = result.filter((c) => c.type === typeFilter);
    return result;
  }, [challenges, statusFilter, typeFilter]);

  const createMutation = useMutation({
    mutationFn: (data: ChallengeFormData) =>
      api.createChallenge({
        dataset_id: datasetId,
        title: data.title,
        challenge_type: data.type,
        reasoning: data.reasoning,
        evidence: data.evidence ? data.evidence : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges", datasetId] });
      setShowCreateModal(false);
      toast.success("Challenge created successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create challenge"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-display text-li-text-primary">
            Challenges
          </h2>
          <p className="text-sm text-li-text-secondary mt-1">
            Contest and validate discovered structures
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(!showCreateModal)}
          className="li-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Challenge
        </button>
      </div>

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-li-card border border-li-border rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display text-li-text-primary">
                New Challenge
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded hover:bg-li-surface-hover text-li-text-muted hover:text-li-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ChallengeForm
              onSubmit={(data) => createMutation.mutate(data)}
              loading={createMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            className="li-card py-3 px-4 text-center cursor-pointer hover:border-li-primary/30"
            onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
          >
            <p className="text-lg font-display text-li-text-primary">
              {count}
            </p>
            <p className="text-xs text-li-text-muted capitalize">
              {status.replace(/_/g, " ")}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-li-text-muted" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="li-input py-1.5 px-3 text-sm w-auto"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="under_review">Under Review</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="deferred">Deferred</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="li-input py-1.5 px-3 text-sm w-auto"
        >
          <option value="all">All Types</option>
          <option value="module_assignment">Module Assignment</option>
          <option value="connection_validity">Connection Validity</option>
          <option value="data_quality">Data Quality</option>
          <option value="interpretation">Interpretation</option>
        </select>
      </div>

      {/* Challenge list */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((challenge) => (
            <Link
              key={challenge.id}
              href={`/datasets/${datasetId}/challenges/${challenge.id}`}
              className="li-card block group cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-medium text-li-text-primary group-hover:text-li-primary transition-colors truncate">
                      {challenge.title}
                    </h3>
                    <span className="li-badge bg-li-surface text-li-text-secondary border border-li-border flex-shrink-0">
                      {typeLabels[challenge.type] || challenge.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-li-text-muted">
                    <span>by {challenge.challenger_name}</span>
                    <span className="font-data">
                      {formatDate(challenge.created_at)}
                    </span>
                  </div>
                </div>
                <StatusBadge status={challenge.status} className="flex-shrink-0 ml-4" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={AlertTriangle}
          title="No challenges"
          description="No challenges have been filed for this dataset yet."
        />
      )}
    </div>
  );
}
