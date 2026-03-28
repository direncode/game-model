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
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";

const RESOURCE_TYPES = [
  { value: "", label: "All Resources" },
  { value: "dataset", label: "Dataset" },
  { value: "module", label: "Module" },
  { value: "connection", label: "Connection" },
  { value: "challenge", label: "Challenge" },
  { value: "user", label: "User" },
  { value: "alert", label: "Alert" },
  { value: "report", label: "Report" },
];

const PER_PAGE = 50;

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Build query string with filters
  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", String(PER_PAGE));
    if (actionFilter) params.set("action", actionFilter);
    if (resourceTypeFilter) params.set("resource_type", resourceTypeFilter);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (searchQuery) params.set("search", searchQuery);
    return params.toString();
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      "audit-log",
      page,
      actionFilter,
      resourceTypeFilter,
      dateFrom,
      dateTo,
      searchQuery,
    ],
    queryFn: async () => {
      const qs = buildQueryString();
      // Use the API client's internal request by constructing the URL with filters
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/admin/audit?${qs}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(typeof window !== "undefined" &&
            localStorage.getItem("li-app-store")
              ? {
                  Authorization: `Bearer ${
                    JSON.parse(
                      localStorage.getItem("li-app-store") || "{}"
                    )?.state?.token || ""
                  }`,
                }
              : {}),
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json() as Promise<PaginatedResponse<AuditEvent>>;
    },
  });

  const events = data?.items || [];

  function resetFilters() {
    setActionFilter("");
    setResourceTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
    setPage(1);
  }

  const hasFilters =
    actionFilter || resourceTypeFilter || dateFrom || dateTo || searchQuery;

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14">
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
          <div className="li-card mb-6">
            <div className="flex flex-wrap items-end gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-li-text-muted mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-li-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="li-input pl-10 w-full"
                    placeholder="Search events..."
                  />
                </div>
              </div>

              {/* Action filter */}
              <div className="w-44">
                <label className="block text-xs text-li-text-muted mb-1">
                  <Filter className="w-3 h-3 inline mr-1" />
                  Action
                </label>
                <input
                  type="text"
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="li-input w-full"
                  placeholder="Filter by action..."
                />
              </div>

              {/* Resource type */}
              <div className="w-44">
                <label className="block text-xs text-li-text-muted mb-1">
                  Resource Type
                </label>
                <select
                  value={resourceTypeFilter}
                  onChange={(e) => {
                    setResourceTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="li-input w-full"
                >
                  {RESOURCE_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date from */}
              <div className="w-40">
                <label className="block text-xs text-li-text-muted mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="li-input w-full"
                />
              </div>

              {/* Date to */}
              <div className="w-40">
                <label className="block text-xs text-li-text-muted mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="li-input w-full"
                />
              </div>

              {/* Reset */}
              {hasFilters && (
                <button
                  onClick={resetFilters}
                  className="li-btn-secondary text-xs"
                >
                  Reset
                </button>
              )}
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
                      <th className="w-8 py-3 px-2" />
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
                    {events.map((event) => (
                      <>
                        <tr
                          key={event.id}
                          onClick={() =>
                            setExpandedRow(
                              expandedRow === event.id ? null : event.id
                            )
                          }
                          className="hover:bg-li-surface-hover transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-2 text-li-text-muted">
                            {expandedRow === event.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </td>
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
                        {expandedRow === event.id && (
                          <tr key={`${event.id}-detail`}>
                            <td colSpan={6} className="bg-li-bg px-6 py-4">
                              <p className="text-xs text-li-text-muted mb-2">
                                Full Event Details
                              </p>
                              <pre className="text-xs font-data text-li-text-secondary bg-li-surface border border-li-border rounded-lg p-4 overflow-x-auto max-h-64">
                                {JSON.stringify(event, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>

                {events.length === 0 && (
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

                    {/* Page number buttons */}
                    {Array.from(
                      { length: Math.min(5, data.total_pages) },
                      (_, i) => {
                        let pageNum: number;
                        if (data.total_pages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= data.total_pages - 2) {
                          pageNum = data.total_pages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={cn(
                              "w-8 h-8 text-xs rounded-md transition-colors",
                              page === pageNum
                                ? "bg-li-primary text-white"
                                : "text-li-text-muted hover:bg-li-surface-hover"
                            )}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                    )}

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
