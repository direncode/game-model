"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLoader } from "@/components/LoadingSpinner";
import { formatDateTime } from "@/lib/utils";
import type { Challenge, ChallengeComment } from "@/lib/types";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  User,
} from "lucide-react";

const typeLabels: Record<string, string> = {
  module_assignment: "Module Assignment",
  connection_validity: "Connection Validity",
  data_quality: "Data Quality",
  interpretation: "Interpretation",
};

export default function ChallengeDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const datasetId = params.id as string;
  const challengeId = params.challengeId as string;

  const [comment, setComment] = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [resolveStatus, setResolveStatus] = useState<string>("accepted");
  const [resolveReasoning, setResolveReasoning] = useState("");

  const { data: challenge, isLoading } = useQuery({
    queryKey: ["challenge", challengeId],
    queryFn: () => api.getChallenge(challengeId) as Promise<Challenge & { comments?: ChallengeComment[] }>,
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => api.addComment(challengeId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenge", challengeId] });
      setComment("");
      toast.success("Comment added");
    },
    onError: (err: any) => toast.error(err.message || "Failed to add comment"),
  });

  const resolveMutation = useMutation({
    mutationFn: (data: { status: string; resolution_reasoning: string }) =>
      api.resolveChallenge(challengeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenge", challengeId] });
      setShowResolve(false);
      toast.success("Challenge resolved");
    },
    onError: (err: any) => toast.error(err.message || "Failed to resolve"),
  });

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    addCommentMutation.mutate(comment.trim());
  };

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveReasoning.trim()) {
      toast.error("Please provide reasoning");
      return;
    }
    resolveMutation.mutate({
      status: resolveStatus,
      resolution_reasoning: resolveReasoning.trim(),
    });
  };

  if (isLoading) return <PageLoader />;
  if (!challenge)
    return <div className="text-li-text-muted">Challenge not found</div>;

  const isOperator = user?.role === "admin" || user?.role === "operator";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <Link
        href={`/datasets/${datasetId}/challenges`}
        className="inline-flex items-center gap-1 text-sm text-li-text-muted hover:text-li-primary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Challenges
      </Link>

      {/* Header */}
      <div className="li-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-display text-li-text-primary mb-2">
              {challenge.title}
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="li-badge bg-li-surface text-li-text-secondary border border-li-border">
                {typeLabels[challenge.type] || challenge.type}
              </span>
              <span className="text-li-text-muted flex items-center gap-1">
                <User className="w-3 h-3" />
                {challenge.challenger_name}
              </span>
              <span className="text-li-text-muted font-data">
                {formatDateTime(challenge.created_at)}
              </span>
            </div>
          </div>
          <StatusBadge status={challenge.status} />
        </div>

        {/* Reasoning */}
        <div className="mb-4">
          <h3 className="text-xs font-data uppercase tracking-wider text-li-text-muted mb-2">
            Reasoning
          </h3>
          <p className="text-sm text-li-text-secondary">{challenge.reasoning}</p>
        </div>

        {/* Evidence */}
        {challenge.evidence && (
          <div className="mb-4">
            <h3 className="text-xs font-data uppercase tracking-wider text-li-text-muted mb-2">
              Evidence
            </h3>
            <p className="text-sm text-li-text-secondary">{challenge.evidence}</p>
          </div>
        )}

        {/* Proposed Resolution */}
        {challenge.proposed_resolution && (
          <div className="mb-4">
            <h3 className="text-xs font-data uppercase tracking-wider text-li-text-muted mb-2">
              Proposed Resolution
            </h3>
            <p className="text-sm text-li-text-secondary">
              {challenge.proposed_resolution}
            </p>
          </div>
        )}

        {/* Resolution (if resolved) */}
        {challenge.resolution_reasoning && (
          <div className="p-4 rounded-lg bg-li-bg border border-li-border">
            <h3 className="text-xs font-data uppercase tracking-wider text-li-text-muted mb-2">
              Resolution
            </h3>
            <p className="text-sm text-li-text-secondary">
              {challenge.resolution_reasoning}
            </p>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="li-card">
        <h3 className="text-sm font-display text-li-text-primary mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Comments
        </h3>

        {(challenge as any).comments && (challenge as any).comments.length > 0 ? (
          <div className="space-y-4 mb-6">
            {((challenge as any).comments as ChallengeComment[]).map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-lg bg-li-bg border border-li-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-li-text-primary">
                    {c.author_name}
                  </span>
                  <span className="text-xs text-li-text-muted font-data">
                    {formatDateTime(c.created_at)}
                  </span>
                </div>
                <p className="text-sm text-li-text-secondary">{c.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-li-text-muted mb-6">No comments yet</p>
        )}

        {/* Add comment form */}
        <form onSubmit={handleComment} className="flex gap-3">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="li-input flex-1"
            placeholder="Add a comment..."
          />
          <button
            type="submit"
            disabled={!comment.trim() || addCommentMutation.isPending}
            className="li-btn-primary flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>

      {/* Resolve (for operators) */}
      {isOperator && challenge.status !== "accepted" && challenge.status !== "rejected" && (
        <div className="li-card">
          {!showResolve ? (
            <button
              onClick={() => setShowResolve(true)}
              className="li-btn-primary"
            >
              Resolve Challenge
            </button>
          ) : (
            <form onSubmit={handleResolve} className="space-y-4">
              <h3 className="text-sm font-display text-li-text-primary">
                Resolve Challenge
              </h3>

              <div className="flex gap-3">
                {(["accepted", "rejected", "deferred"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setResolveStatus(s)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                      resolveStatus === s
                        ? s === "accepted"
                          ? "bg-li-accent/10 text-li-accent border border-li-accent/30"
                          : s === "rejected"
                          ? "bg-li-danger/10 text-li-danger border border-li-danger/30"
                          : "bg-li-warning/10 text-li-warning border border-li-warning/30"
                        : "bg-li-bg border border-li-border text-li-text-secondary"
                    }`}
                  >
                    {s === "accepted" && <CheckCircle2 className="w-4 h-4" />}
                    {s === "rejected" && <XCircle className="w-4 h-4" />}
                    {s === "deferred" && <Clock className="w-4 h-4" />}
                    <span className="capitalize">{s}</span>
                  </button>
                ))}
              </div>

              <textarea
                value={resolveReasoning}
                onChange={(e) => setResolveReasoning(e.target.value)}
                className="li-input min-h-[100px] resize-y"
                placeholder="Provide reasoning for your resolution..."
                required
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowResolve(false)}
                  className="li-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveMutation.isPending}
                  className="li-btn-primary"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
