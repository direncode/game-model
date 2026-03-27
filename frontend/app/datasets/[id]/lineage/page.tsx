"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import { formatDateTime } from "@/lib/utils";
import type { LineageEvent } from "@/lib/types";
import { GitBranch, ChevronDown, ChevronRight, User, Clock } from "lucide-react";

const eventTypeIcons: Record<string, string> = {
  upload: "Upload",
  profile: "Profile",
  crystallize: "Crystallize",
  validate: "Validate",
  challenge: "Challenge",
  report: "Report",
};

export default function LineagePage() {
  const params = useParams();
  const datasetId = params.id as string;
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const { data: lineageData, isLoading } = useQuery({
    queryKey: ["lineage", datasetId],
    queryFn: () => api.getLineage(datasetId) as Promise<{ events: LineageEvent[] }>,
  });

  if (isLoading) return <PageLoader />;

  const events = (lineageData as any)?.events || (lineageData as any) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display text-li-text-primary">
          Lineage
        </h2>
        <p className="text-sm text-li-text-secondary mt-1">
          Track the provenance and transformation history of this dataset
        </p>
      </div>

      {/* Graph Placeholder */}
      <div className="li-card">
        <h3 className="text-sm font-display text-li-text-primary mb-4">
          Lineage Graph
        </h3>
        <div className="h-48 rounded-lg bg-li-bg border border-li-border flex items-center justify-center">
          <div className="text-center">
            <GitBranch className="w-8 h-8 text-li-text-muted mx-auto mb-2" />
            <p className="text-sm text-li-text-muted">
              D3 force-directed lineage graph
            </p>
            <p className="text-xs text-li-text-muted mt-1">
              Visualizing data transformation pipeline
            </p>
          </div>
        </div>
      </div>

      {/* Event Timeline */}
      <div className="li-card">
        <h3 className="text-sm font-display text-li-text-primary mb-6">
          Event Timeline
        </h3>

        {Array.isArray(events) && events.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-li-border" />

            <div className="space-y-1">
              {events.map((event: LineageEvent) => {
                const isExpanded = expandedEvent === event.id;

                return (
                  <div key={event.id} className="relative pl-12">
                    {/* Timeline dot */}
                    <div className="absolute left-3 top-3 w-3 h-3 rounded-full bg-li-primary border-2 border-li-bg" />

                    <button
                      onClick={() =>
                        setExpandedEvent(isExpanded ? null : event.id)
                      }
                      className="w-full text-left p-3 rounded-lg hover:bg-li-surface-hover transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-li-text-muted flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-li-text-muted flex-shrink-0" />
                          )}
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-data uppercase tracking-wider text-li-primary">
                                {eventTypeIcons[event.type] || event.type}
                              </span>
                              <span className="text-sm text-li-text-primary">
                                {event.action}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-li-text-muted">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {event.actor}
                              </span>
                              <span className="flex items-center gap-1 font-data">
                                <Clock className="w-3 h-3" />
                                {formatDateTime(event.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-4 ml-7 space-y-3">
                          {event.inputs && Object.keys(event.inputs).length > 0 && (
                            <div>
                              <p className="text-xs font-data text-li-text-muted uppercase mb-1">
                                Inputs
                              </p>
                              <pre className="text-xs font-data text-li-text-secondary bg-li-bg p-2 rounded border border-li-border overflow-auto max-h-32">
                                {JSON.stringify(event.inputs, null, 2)}
                              </pre>
                            </div>
                          )}
                          {event.outputs && Object.keys(event.outputs).length > 0 && (
                            <div>
                              <p className="text-xs font-data text-li-text-muted uppercase mb-1">
                                Outputs
                              </p>
                              <pre className="text-xs font-data text-li-text-secondary bg-li-bg p-2 rounded border border-li-border overflow-auto max-h-32">
                                {JSON.stringify(event.outputs, null, 2)}
                              </pre>
                            </div>
                          )}
                          {event.parameters &&
                            Object.keys(event.parameters).length > 0 && (
                              <div>
                                <p className="text-xs font-data text-li-text-muted uppercase mb-1">
                                  Parameters
                                </p>
                                <pre className="text-xs font-data text-li-text-secondary bg-li-bg p-2 rounded border border-li-border overflow-auto max-h-32">
                                  {JSON.stringify(event.parameters, null, 2)}
                                </pre>
                              </div>
                            )}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={GitBranch}
            title="No lineage events"
            description="Lineage events will appear here as you process and transform this dataset."
          />
        )}
      </div>
    </div>
  );
}
