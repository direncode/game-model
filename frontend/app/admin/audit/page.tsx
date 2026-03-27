"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { PageLoader } from "@/components/LoadingSpinner";
import { cn, formatDateTime } from "@/lib/utils";
import type { AuditEvent, PaginatedResponse } from "@/lib/types";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
} from "lucide-react";

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", page],
    queryFn: () =>
      api.getAuditLog(page) as Promise<PaginatedResponse<AuditEvent>>,
  });

  const filtered =
    data?.items?.filter((event) => {
      if (actionFilter && !event.action.toLowerCase().includes(actionFilter.toLowerCase()))
        return false;
      if (
        searchQuery &&
        !event.actor.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !event.resource.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !event.action.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    }) || [];

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-64 pt-16">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-display text-li-text-primary flex items-center gap-3">
              <FileText className="w-6 h-6 text-li-accent" />
              Audit Log
            </h1>
            <p className="text-sm text-li-text-secondary mt-1">
              System activity and security audit trail
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-li-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="li-input pl-10"
                placeholder="Search events..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-li-text-muted" />
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="li-input py-1.5 px-3 text-sm w-40"
                placeholder="Filter by action..."
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <PageLoader />
          ) : (
            <>
              <div className="li-card overflow-x-auto p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-li-border">
                      <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                        Timestamp
                      </th>
                      <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                        Actor
                      </th>
                      <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                        Action
                      </th>
                      <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                        Resource
                      </th>
                      <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-li-border">
                    {filtered.map((event) => (
                      <tr
                        key={event.id}
                        className="hover:bg-li-surface-hover transition-colors"
                      >
                        <td className="py-3 px-4 text-xs font-data text-li-text-secondary whitespace-nowrap">
                          {formatDateTime(event.timestamp)}
                        </td>
                        <td className="py-3 px-4 text-sm text-li-text-primary">
                          {event.actor}
                        </td>
                        <td className="py-3 px-4 text-sm text-li-text-secondary">
                          {event.action}
                        </td>
                        <td className="py-3 px-4 text-xs font-data text-li-text-muted max-w-xs truncate">
                          {event.resource}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "li-badge",
                              event.result === "success"
                                ? "bg-li-accent/20 text-li-accent"
                                : "bg-li-danger/20 text-li-danger"
                            )}
                          >
                            {event.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filtered.length === 0 && (
                  <div className="py-12 text-center text-sm text-li-text-muted">
                    No audit events found
                  </div>
                )}
              </div>

              {/* Pagination */}
              {data && data.total_pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-li-text-muted font-data">
                    Page {data.page} of {data.total_pages} ({data.total} total
                    events)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="li-btn-ghost p-2 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setPage(Math.min(data.total_pages, page + 1))
                      }
                      disabled={page >= data.total_pages}
                      className="li-btn-ghost p-2 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
