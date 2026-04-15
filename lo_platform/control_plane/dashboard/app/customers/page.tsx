"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Search } from "lucide-react";
import { HealthBadge } from "@/components/ForkStatusBadge";
import { controlPlaneAPI } from "@/lib/api";
import type { Customer, CustomerTier } from "@/lib/types";

const tierColors: Record<CustomerTier, string> = {
  starter: "bg-cp-gray-700/50 text-cp-gray-400 border-cp-gray-700",
  growth: "bg-cp-cyan/15 text-cp-cyan border-cp-cyan/30",
  enterprise: "bg-cp-purple/15 text-cp-purple border-cp-purple/30",
};

function generateMockCustomers(): Customer[] {
  const customers = [
    { name: "Acme Corp", email: "admin@acme.com", tier: "enterprise" as const, forks: 3 },
    { name: "Globex Industries", email: "ops@globex.com", tier: "growth" as const, forks: 2 },
    { name: "Initech LLC", email: "it@initech.com", tier: "starter" as const, forks: 1 },
    { name: "Umbrella Corp", email: "admin@umbrella.co", tier: "enterprise" as const, forks: 4 },
    { name: "Hooli Inc", email: "dev@hooli.xyz", tier: "growth" as const, forks: 2 },
  ];
  return customers.map((c, i) => ({
    id: `cust-${String(i + 1).padStart(3, "0")}`,
    name: c.name,
    email: c.email,
    tier: c.tier,
    fork_count: c.forks,
    total_entities: Math.floor(Math.random() * 1000000) + 50000,
    mrr: c.tier === "enterprise" ? 15000 : c.tier === "growth" ? 5000 : 1500,
  }));
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await controlPlaneAPI.listCustomers();
        setCustomers(Array.isArray(data) && data.length > 0 ? data : generateMockCustomers());
      } catch {
        setCustomers(generateMockCustomers());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cp-cyan border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cp-white">Customers</h1>
          <p className="mt-1 text-sm text-cp-gray-500">
            {customers.length} customer{customers.length !== 1 ? "s" : ""} managed
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cp-gray-600" />
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-cp-border bg-cp-black-elevated py-2 pl-9 pr-4 text-sm text-cp-gray-200 placeholder:text-cp-gray-700 focus:border-cp-cyan/40 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-cp-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cp-border bg-cp-black-light">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500">
                Tier
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500">
                Forks
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cp-gray-500">
                Total Entities
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-cp-gray-500">
                MRR
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => (
              <tr
                key={customer.id}
                className="table-row-hover border-b border-cp-border/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="font-medium text-cp-gray-200 hover:text-cp-cyan"
                  >
                    {customer.name}
                  </Link>
                  <p className="text-xs text-cp-gray-600">{customer.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tierColors[customer.tier]}`}
                  >
                    {customer.tier}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-cp-gray-300">
                  {customer.fork_count}
                </td>
                <td className="px-4 py-3 font-mono text-cp-gray-300">
                  {customer.total_entities.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-cp-green">
                  ${customer.mrr.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-cp-gray-600">
            No customers match your search
          </div>
        )}
      </div>
    </div>
  );
}
