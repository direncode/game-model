"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { useDataEstateStore } from "@/lib/data-estate/store";
import { fetchLedger, fetchLedgerSummary } from "@/lib/data-estate/api";
import type { LedgerEntry, LedgerSummary } from "@/lib/data-estate/types";
import { Wallet, Filter, BarChart3 } from "lucide-react";

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");

  const loadData = async (category?: string) => {
    setLoading(true);
    try {
      const [ledger, ledgerSummary] = await Promise.all([
        fetchLedger(category || undefined),
        fetchLedgerSummary(),
      ]);
      setEntries(ledger);
      setSummary(ledgerSummary);
    } catch {
      setEntries([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilterChange = (category: string) => {
    setCategoryFilter(category);
    loadData(category || undefined);
  };

  const categories = summary
    ? Object.keys(summary.category_totals)
    : [];

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-green-400" />
            Allocation Ledger
          </h1>
          <p className="text-sm text-li-text-muted mt-1">
            Track all allocation entries across categories
          </p>
        </div>

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="li-card p-4">
              <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                Total Allocated
              </div>
              <div className="text-2xl font-semibold text-white">
                ${summary.total_allocated.toLocaleString()}
              </div>
            </div>
            <div className="li-card p-4">
              <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                Categories
              </div>
              <div className="text-2xl font-semibold text-white">
                {Object.keys(summary.category_totals).length}
              </div>
            </div>
            <div className="li-card p-4">
              <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                Total Entries
              </div>
              <div className="text-2xl font-semibold text-white">
                {summary.entry_count}
              </div>
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="flex items-center gap-3 mb-5">
          <Filter className="w-4 h-4 text-li-text-muted" />
          <select
            value={categoryFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="px-3 py-2 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/40"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-li-text-muted text-sm">Loading ledger...</div>
        ) : entries.length === 0 ? (
          <div className="li-card p-8 text-center">
            <BarChart3 className="w-8 h-8 text-li-text-muted mx-auto mb-2" />
            <p className="text-li-text-muted">No ledger entries found.</p>
          </div>
        ) : (
          <div className="li-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-li-gray-800">
                  <th className="text-left text-xs text-li-text-muted uppercase tracking-wider px-4 py-3">
                    Label
                  </th>
                  <th className="text-left text-xs text-li-text-muted uppercase tracking-wider px-4 py-3">
                    Category
                  </th>
                  <th className="text-right text-xs text-li-text-muted uppercase tracking-wider px-4 py-3">
                    Amount
                  </th>
                  <th className="text-center text-xs text-li-text-muted uppercase tracking-wider px-4 py-3">
                    Version
                  </th>
                  <th className="text-right text-xs text-li-text-muted uppercase tracking-wider px-4 py-3">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-li-gray-900 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 text-sm text-white truncate max-w-[300px]">
                      {entry.label}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                        {entry.category_tag}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white text-right font-mono">
                      ${entry.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-li-text-muted text-center">
                      v{entry.version}
                    </td>
                    <td className="px-4 py-3 text-sm text-li-text-muted text-right">
                      {new Date(entry.effective_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
