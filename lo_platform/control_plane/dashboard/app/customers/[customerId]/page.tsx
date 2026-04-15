"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  CreditCard,
  GitFork,
  ExternalLink,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ForkStatusBadge, HealthBadge } from "@/components/ForkStatusBadge";
import { controlPlaneAPI } from "@/lib/api";
import type { Customer, Fork, Invoice, CustomerTier } from "@/lib/types";

const tierBadge: Record<CustomerTier, string> = {
  starter: "bg-cp-gray-700/50 text-cp-gray-400 border-cp-gray-700",
  growth: "bg-cp-cyan/15 text-cp-cyan border-cp-cyan/30",
  enterprise: "bg-cp-purple/15 text-cp-purple border-cp-purple/30",
};

function generateMockCustomer(id: string): Customer {
  return {
    id,
    name: "Acme Corp",
    email: "admin@acme.com",
    tier: "enterprise",
    fork_count: 3,
    total_entities: 720000,
    mrr: 15000,
  };
}

function generateMockForks(): Fork[] {
  return [
    {
      id: "fork-001",
      customer_id: "cust-001",
      subdomain: "acme.latentocean.io",
      status: "active",
      entity_count: 245000,
      last_reduction_at: new Date(Date.now() - 3600000).toISOString(),
      queries_served_total: 87432,
      storage_used_bytes: 12.4e9,
      enabled_modules: ["fsd", "btut"],
      health_status: "healthy",
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    },
    {
      id: "fork-002",
      customer_id: "cust-001",
      subdomain: "acme-staging.latentocean.io",
      status: "active",
      entity_count: 120000,
      last_reduction_at: new Date(Date.now() - 7200000).toISOString(),
      queries_served_total: 23100,
      storage_used_bytes: 5.2e9,
      enabled_modules: ["fsd"],
      health_status: "healthy",
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: "fork-003",
      customer_id: "cust-001",
      subdomain: "acme-dev.latentocean.io",
      status: "suspended",
      entity_count: 50000,
      last_reduction_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      queries_served_total: 4500,
      storage_used_bytes: 1.1e9,
      enabled_modules: ["fsd", "btut", "qr-identity"],
      health_status: "degraded",
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
  ];
}

function generateMockInvoices(): Invoice[] {
  return [
    { id: "INV-2026-042", customer_id: "cust-001", customer_name: "Acme Corp", amount_usd: 15000, status: "paid", issued_at: "2026-04-01", due_at: "2026-04-15" },
    { id: "INV-2026-031", customer_id: "cust-001", customer_name: "Acme Corp", amount_usd: 14200, status: "paid", issued_at: "2026-03-01", due_at: "2026-03-15" },
    { id: "INV-2026-019", customer_id: "cust-001", customer_name: "Acme Corp", amount_usd: 13800, status: "paid", issued_at: "2026-02-01", due_at: "2026-02-15" },
  ];
}

function formatBytes(bytes: number): string {
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [forks, setForks] = useState<Fork[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await controlPlaneAPI.getCustomer(customerId);
        setCustomer(data?.id ? data : generateMockCustomer(customerId));
      } catch {
        setCustomer(generateMockCustomer(customerId));
      }
      setForks(generateMockForks());
      setInvoices(generateMockInvoices());
      setLoading(false);
    })();
  }, [customerId]);

  if (loading || !customer) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cp-cyan border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/customers")}
            className="rounded p-1 text-cp-gray-500 hover:bg-cp-gray-800 hover:text-cp-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-cp-white">{customer.name}</h1>
            <div className="mt-1 flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tierBadge[customer.tier]}`}
              >
                {customer.tier}
              </span>
              <span className="flex items-center gap-1 text-xs text-cp-gray-500">
                <Mail className="h-3 w-3" />
                {customer.email}
              </span>
              <span className="font-mono text-xs text-cp-gray-600">{customer.id}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <select className="rounded-md border border-cp-border bg-cp-black-elevated px-3 py-1.5 text-xs text-cp-gray-300 focus:border-cp-cyan/40 focus:outline-none">
            <option value="enterprise">Enterprise</option>
            <option value="growth">Growth</option>
            <option value="starter">Starter</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Monthly Revenue"
          value={`$${customer.mrr.toLocaleString()}`}
          change={5.6}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard title="Forks" value={customer.fork_count} icon={<GitFork className="h-4 w-4" />} />
        <StatCard title="Total Entities" value={customer.total_entities.toLocaleString()} change={8.2} />
        <StatCard title="Tier" value={customer.tier} />
      </div>

      {/* Forks table */}
      <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
          Customer Forks
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-cp-gray-600">
              <th className="pb-2 text-left font-medium">Subdomain</th>
              <th className="pb-2 text-left font-medium">Status</th>
              <th className="pb-2 text-left font-medium">Entities</th>
              <th className="pb-2 text-left font-medium">Storage</th>
              <th className="pb-2 text-left font-medium">Health</th>
            </tr>
          </thead>
          <tbody>
            {forks.map((fork) => (
              <tr key={fork.id} className="border-t border-cp-border/30">
                <td className="py-2.5">
                  <Link
                    href={`/forks/${fork.id}`}
                    className="font-medium text-cp-gray-200 hover:text-cp-cyan"
                  >
                    {fork.subdomain}
                  </Link>
                </td>
                <td className="py-2.5">
                  <ForkStatusBadge status={fork.status} />
                </td>
                <td className="py-2.5 font-mono text-cp-gray-300">
                  {fork.entity_count.toLocaleString()}
                </td>
                <td className="py-2.5 font-mono text-cp-gray-300">
                  {formatBytes(fork.storage_used_bytes)}
                </td>
                <td className="py-2.5">
                  <HealthBadge health={fork.health_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoices */}
      <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
          Invoice History
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-cp-gray-600">
              <th className="pb-2 text-left font-medium">Invoice</th>
              <th className="pb-2 text-left font-medium">Issued</th>
              <th className="pb-2 text-left font-medium">Due</th>
              <th className="pb-2 text-left font-medium">Status</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-cp-border/30">
                <td className="py-2.5 font-mono text-xs text-cp-gray-400">{inv.id}</td>
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
  );
}
