"use client";

import React from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, truncate, statusColor } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import type { Challenge } from "@/lib/types";

export interface ChallengeCardProps {
  challenge: Challenge;
  commentCount?: number;
  onClick?: () => void;
}

const typeLabels: Record<string, string> = {
  module_assignment: "Module Assignment",
  connection_validity: "Connection Validity",
  data_quality: "Data Quality",
  interpretation: "Interpretation",
};

const statusVariant: Record<string, "primary" | "warning" | "accent" | "danger" | "neutral"> = {
  open: "primary",
  under_review: "warning",
  accepted: "accent",
  rejected: "danger",
  deferred: "neutral",
};

export default function ChallengeCard({
  challenge,
  commentCount = 0,
  onClick,
}: ChallengeCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "li-card hover:border-li-border-light transition-colors",
        onClick && "cursor-pointer"
      )}
    >
      {/* Title */}
      <h3 className="text-sm font-medium text-li-text-primary mb-2">
        {challenge.title}
      </h3>

      {/* Type + Status badges */}
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="neutral" size="sm">
          {typeLabels[challenge.type] || challenge.type}
        </Badge>
        <Badge variant={statusVariant[challenge.status] || "neutral"} size="sm">
          {challenge.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Challenger + date */}
      <p className="text-xs text-li-text-muted mb-2">
        {challenge.challenger_name} &middot; {formatDate(challenge.created_at)}
      </p>

      {/* Reasoning preview */}
      <p className="text-xs text-li-text-secondary line-clamp-2 mb-3">
        {challenge.reasoning}
      </p>

      {/* Comment count */}
      {commentCount > 0 && (
        <div className="flex items-center gap-1.5 text-li-text-muted">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="text-xs">{commentCount}</span>
        </div>
      )}
    </div>
  );
}
