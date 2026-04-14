"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { useDataEstateStore } from "@/lib/data-estate/store";
import {
  createAllocationRequest,
  fetchAllocations,
} from "@/lib/data-estate/api";
import type { AllocationRequest } from "@/lib/data-estate/types";
import {
  Wallet,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Flag,
  AlertCircle,
  BarChart3,
} from "lucide-react";

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color: "text-green-400 bg-green-400/10 border-green-400/20",
    icon: CheckCircle2,
  },
  denied: {
    label: "Denied",
    color: "text-red-400 bg-red-400/10 border-red-400/20",
    icon: XCircle,
  },
  flagged: {
    label: "Flagged",
    color: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    icon: Flag,
  },
};

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState<AllocationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [amount, setAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [categoryTag, setCategoryTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadAllocations = async () => {
    try {
      const data = await fetchAllocations();
      setAllocations(data);
    } catch {
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0 || !justification.trim() || !categoryTag.trim()) return;

    setSubmitting(true);
    setToast(null);
    try {
      await createAllocationRequest({
        amount: amountNum,
        justification: justification.trim(),
        category_tag: categoryTag.trim(),
      });
      setToast({
        type: "success",
        message: "Allocation request submitted and scored by AI.",
      });
      setAmount("");
      setJustification("");
      setCategoryTag("");
      await loadAllocations();
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Request failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-cyan-400" />
            Allocation Requests
          </h1>
          <p className="text-sm text-li-text-muted mt-1">
            Submit and track allocation requests with AI scoring
          </p>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-5 flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${
              toast.type === "success"
                ? "bg-green-400/10 text-green-400 border-green-400/20"
                : "bg-red-400/10 text-red-400 border-red-400/20"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {toast.message}
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Request form */}
          <form onSubmit={handleSubmit} className="li-card p-5 space-y-4 col-span-1">
            <h2 className="text-sm font-medium text-white">New Request</h2>

            <div>
              <label className="block text-xs text-li-text-muted mb-1">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-white placeholder:text-li-text-muted focus:outline-none focus:border-cyan-500/40"
              />
            </div>

            <div>
              <label className="block text-xs text-li-text-muted mb-1">
                Category
              </label>
              <input
                type="text"
                value={categoryTag}
                onChange={(e) => setCategoryTag(e.target.value)}
                placeholder="e.g. research, infrastructure"
                required
                className="w-full px-3 py-2 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-white placeholder:text-li-text-muted focus:outline-none focus:border-cyan-500/40"
              />
            </div>

            <div>
              <label className="block text-xs text-li-text-muted mb-1">
                Justification
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why is this allocation needed?"
                required
                rows={4}
                className="w-full px-3 py-2 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-white placeholder:text-li-text-muted focus:outline-none focus:border-cyan-500/40 resize-y"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors w-full justify-center"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>

          {/* Existing requests */}
          <div className="col-span-2 space-y-3">
            <h2 className="text-sm font-medium text-white mb-3">
              Existing Requests
            </h2>

            {loading ? (
              <div className="text-li-text-muted text-sm">Loading...</div>
            ) : allocations.length === 0 ? (
              <div className="li-card p-8 text-center">
                <BarChart3 className="w-8 h-8 text-li-text-muted mx-auto mb-2" />
                <p className="text-li-text-muted">
                  No allocation requests yet.
                </p>
              </div>
            ) : (
              allocations.map((alloc) => {
                const sc = statusConfig[alloc.status] ?? statusConfig.pending;
                const StatusIcon = sc.icon;
                const aiScore =
                  alloc.score_result && typeof alloc.score_result === "object"
                    ? (alloc.score_result as any).total
                    : null;

                return (
                  <div key={alloc.id} className="li-card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-white">
                          ${alloc.amount.toLocaleString()} &middot;{" "}
                          <span className="text-li-text-muted">
                            {alloc.category_tag}
                          </span>
                        </div>
                        <p className="text-xs text-li-text-muted mt-1 line-clamp-2">
                          {alloc.justification}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border flex-shrink-0 ${sc.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-li-text-muted">
                      <span>
                        {new Date(alloc.created_at).toLocaleDateString()}
                      </span>
                      {aiScore !== null && aiScore !== undefined && (
                        <span className="text-cyan-400 font-medium">
                          AI Score: {(aiScore * 100).toFixed(0)}%
                        </span>
                      )}
                      {alloc.decision_note && (
                        <span>Note: {alloc.decision_note}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
