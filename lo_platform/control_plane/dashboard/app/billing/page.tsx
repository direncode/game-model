"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { UsageChart } from "@/components/UsageChart";
import type { Invoice } from "@/lib/types";

function generateMockBilling() {
  const mrrHistory = Array.from({ length: 12 }, (_, i) => ({
    date: new Date(2025, 4 + i, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    value: Math.floor(25000 + i * 2000 + Math.random() * 3000),
  }));

  const tierBreakdown = [
    { tier: "Enterprise", customers: 2, mrr: 30000, pct: 63 },
    { tier: "Growth", customers: 2, mrr: 10000, pct: 21 },
    { tier: "Starter", customers: 1, mrr: 1500, pct: 3 },
    { tier: "Module Add-ons", customers: 0, mrr: 6000, pct: 13 },
  ];

  const invoices: Invoice[] = [
    { id: "INV-2026-042", customer_id: "cust-001", customer_name: "Acme Corp", amount_usd: 15000, status: "paid", issued_at: "2026-04-01", due_at: "2026-04-15" },
    { id: "INV-2026-041", customer_id: "cust-004", customer_name: "Umbrella Corp", amount_usd: 15000, status: "paid", issued_at: "2026-04-01", due_at: "2026-04-15" },
    { id: "INV-2026-040", customer_id: "cust-002", customer_name: "Globex Industries", amount_usd: 5000, status: "pending", issued_at: "2026-04-01", due_at: "2026-04-15" },
    { id: "INV-2026-039", customer_id: "cust-005", customer_name: "Hooli Inc", amount_usd: 5000, status: "pending", issued_at: "2026-04-01", due_at: "2026-04-15" },
    { id: "INV-2026-038", customer_id: "cust-003", customer_name: "Initech LLC", amount_usd: 1500, status: "overdue", issued_at: "2026-03-15", due_at: "2026-03-30" },
  ];

  return { mrrHistory, tierBreakdown, invoices, totalMrr: 47500 };
}

export default function BillingPage() {
  const [data, setData] = useState<ReturnType<typeof generateMockBilling> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(generateMockBilling());
    setLoading(false);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cp-cyan border-t-transparent" />
      </div>
    );
  }

  const pendingTotal = data.invoices
    .filter((i) => i.status === "pending")
    .reduce((s, i) => s + i.amount_usd, 0);
  const overdueTotal = data.invoices
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.amount_usd, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-cp-white">Revenue & Billing</h1>
        <p className="mt-1 text-sm text-cp-gray-500">
          Financial overview and invoice management
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total MRR"
          value={`$${data.totalMrr.toLocaleString()}`}
          change={15.2}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="ARR (projected)"
          value={`$${(data.totalMrr * 12).toLocaleString()}`}
          change={15.2}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          title="Pending"
          value={`$${pendingTotal.toLocaleString()}`}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          title="Overdue"
          value={`$${overdueTotal.toLocaleString()}`}
          icon={<AlertCircle className="h-4 w-4" />}
        />
      </div>

      {/* MRR chart + tier breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UsageChart data={data.mrrHistory} label="Monthly Recurring Revenue" color="#3fb950" height={240} />
        </div>
        <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Revenue by Tier
          </p>
          <div className="space-y-4">
            {data.tierBreakdown.map((t) => (
              <div key={t.tier}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-cp-gray-300">{t.tier}</span>
                  <span className="font-mono text-sm text-cp-gray-400">
                    ${t.mrr.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-cp-gray-800">
                  <div
                    className="h-2 rounded-full bg-cp-cyan transition-all duration-500"
                    style={{ width: `${t.pct}%` }}
                  />
                </div>
                <p className="mt-0.5 text-right text-xs text-cp-gray-600">{t.pct}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
          Recent Invoices
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-cp-gray-600">
                <th className="pb-2 text-left font-medium">Invoice</th>
                <th className="pb-2 text-left font-medium">Customer</th>
                <th className="pb-2 text-left font-medium">Issued</th>
                <th className="pb-2 text-left font-medium">Due</th>
                <th className="pb-2 text-left font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-cp-border/30 table-row-hover">
                  <td className="py-2.5 font-mono text-xs text-cp-gray-400">{inv.id}</td>
                  <td className="py-2.5 text-cp-gray-300">{inv.customer_name}</td>
                  <td className="py-2.5 text-cp-gray-400">{inv.issued_at}</td>
                  <td className="py-2.5 text-cp-gray-400">{inv.due_at}</td>
                  <td className="py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.status === "paid"
                          ? "bg-cp-green/15 text-cp-green"
                          : inv.status === "pending"
                          ? "bg-cp-yellow/15 text-cp-yellow"
                          : "bg-cp-red/15 text-cp-red"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-cp-gray-300">
                    ${inv.amount_usd.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
