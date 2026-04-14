"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { useDataEstateStore } from "@/lib/data-estate/store";
import { fetchScroll } from "@/lib/data-estate/api";
import type { Submission } from "@/lib/data-estate/types";
import {
  Database,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
} from "lucide-react";
import Link from "next/link";

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  approved: { label: "Approved", color: "text-green-400 bg-green-400/10 border-green-400/20", icon: CheckCircle2 },
  pending: { label: "Pending", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: Clock },
  rejected: { label: "Rejected", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: XCircle },
};

export default function ScrollPage() {
  const [documents, setDocuments] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchScroll()
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.estate_tag.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Database className="w-6 h-6 text-purple-400" />
              The Scroll
            </h1>
            <p className="text-sm text-li-text-muted mt-1">
              Browse approved documents in the estate
            </p>
          </div>
          <Link
            href="/data-estate/scroll/submit"
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit Document
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-li-text-muted" />
          <input
            type="text"
            placeholder="Search documents by title or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-white placeholder:text-li-text-muted focus:outline-none focus:border-cyan-500/40"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-li-text-muted text-sm">Loading documents...</div>
        ) : filtered.length === 0 ? (
          <div className="li-card p-8 text-center">
            <FileText className="w-8 h-8 text-li-text-muted mx-auto mb-2" />
            <p className="text-li-text-muted">
              {search ? "No documents match your search." : "No approved documents yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((doc) => {
              const sc = statusConfig[doc.status] ?? statusConfig.pending;
              const StatusIcon = sc.icon;
              return (
                <div
                  key={doc.id}
                  className="li-card p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-li-text-muted flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {doc.title}
                      </div>
                      <div className="text-xs text-li-text-muted mt-0.5">
                        Tag: {doc.estate_tag} &middot; Submitted{" "}
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${sc.color}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {sc.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
