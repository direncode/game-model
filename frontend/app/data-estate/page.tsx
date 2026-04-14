"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { useDataEstateStore } from "@/lib/data-estate/store";
import {
  Database,
  FileText,
  BarChart3,
  MessageSquare,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";

export default function DataEstatePage() {
  const dashboard = useDataEstateStore((s) => s.dashboard);
  const loading = useDataEstateStore((s) => s.loading);
  const loadDashboard = useDataEstateStore((s) => s.loadDashboard);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-cyan-400" />
            Data Estate
          </h1>
          <p className="text-sm text-li-text-muted mt-1">
            Living knowledge base — documents crystallized into searchable, routable modules
          </p>
        </div>

        {loading && !dashboard ? (
          <div className="text-li-text-muted text-sm">Loading estate metrics...</div>
        ) : dashboard ? (
          <div className="space-y-6">
            {/* Top stats row */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                icon={<FileText className="w-5 h-5 text-cyan-400" />}
                label="Total Submissions"
                value={dashboard.total_submissions}
              />
              <StatCard
                icon={<Clock className="w-5 h-5 text-yellow-400" />}
                label="Pending Review"
                value={dashboard.pending_submissions}
              />
              <StatCard
                icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
                label="Approved"
                value={dashboard.approved_submissions}
              />
              <StatCard
                icon={<Layers className="w-5 h-5 text-purple-400" />}
                label="Crystallized Modules"
                value={dashboard.total_modules}
              />
            </div>

            {/* Module type breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  H0 Attractors (Stable)
                </div>
                <div className="text-2xl font-semibold text-cyan-400">
                  {dashboard.modules_by_type.attractor ?? 0}
                </div>
              </div>
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  H1 Cycles (Evolving)
                </div>
                <div className="text-2xl font-semibold text-yellow-400">
                  {dashboard.modules_by_type.cycle ?? 0}
                </div>
              </div>
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  H2 Boundaries (Gaps)
                </div>
                <div className="text-2xl font-semibold text-red-400">
                  {dashboard.modules_by_type.boundary ?? 0}
                </div>
              </div>
            </div>

            {/* Allocation summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  Ledger Total
                </div>
                <div className="text-2xl font-semibold text-white">
                  ${dashboard.ledger_total.toLocaleString()}
                </div>
              </div>
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  Categories
                </div>
                <div className="text-2xl font-semibold text-white">
                  {dashboard.ledger_categories}
                </div>
              </div>
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  Pending Allocations
                </div>
                <div className="text-2xl font-semibold text-yellow-400">
                  {dashboard.allocation_requests_pending}
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-4">
              <a
                href="/data-estate/scroll/submit"
                className="li-card p-4 hover:border-cyan-500/30 transition-colors group"
              >
                <FileText className="w-5 h-5 text-cyan-400 mb-2" />
                <div className="text-sm font-medium text-white group-hover:text-cyan-400">
                  Submit Document
                </div>
                <div className="text-xs text-li-text-muted mt-0.5">
                  Add to the estate
                </div>
              </a>
              <a
                href="/data-estate/scroll"
                className="li-card p-4 hover:border-cyan-500/30 transition-colors group"
              >
                <Database className="w-5 h-5 text-purple-400 mb-2" />
                <div className="text-sm font-medium text-white group-hover:text-purple-400">
                  Browse Scroll
                </div>
                <div className="text-xs text-li-text-muted mt-0.5">
                  Approved documents
                </div>
              </a>
              <a
                href="/data-estate/ledger"
                className="li-card p-4 hover:border-cyan-500/30 transition-colors group"
              >
                <Wallet className="w-5 h-5 text-green-400 mb-2" />
                <div className="text-sm font-medium text-white group-hover:text-green-400">
                  View Ledger
                </div>
                <div className="text-xs text-li-text-muted mt-0.5">
                  Allocation tracking
                </div>
              </a>
              <a
                href="/data-estate/chat"
                className="li-card p-4 hover:border-cyan-500/30 transition-colors group"
              >
                <MessageSquare className="w-5 h-5 text-blue-400 mb-2" />
                <div className="text-sm font-medium text-white group-hover:text-blue-400">
                  Estate Chat
                </div>
                <div className="text-xs text-li-text-muted mt-0.5">
                  Ask the knowledge base
                </div>
              </a>
            </div>
          </div>
        ) : (
          <div className="li-card p-8 text-center">
            <AlertCircle className="w-8 h-8 text-li-text-muted mx-auto mb-2" />
            <p className="text-li-text-muted">
              No estate data yet. Submit your first document to get started.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="li-card p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-li-text-muted uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
