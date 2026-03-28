"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import { formatDate, formatCompactNumber } from "@/lib/utils";
import type { Dataset } from "@/lib/types";
import { Plus, Database } from "lucide-react";

export default function DatasetsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => api.listDatasets() as Promise<{ items: Dataset[] }>,
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-display text-li-text-primary">
                Datasets
              </h1>
              <p className="text-sm text-li-text-secondary mt-1">
                Manage your graph datasets and discover hidden structures
              </p>
            </div>
            <Link href="/datasets/new" className="li-btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Dataset
            </Link>
          </div>

          {/* Content */}
          {isLoading ? (
            <PageLoader />
          ) : error ? (
            <div className="li-card text-center py-12">
              <p className="text-li-danger">Failed to load datasets</p>
            </div>
          ) : data?.items && data.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.items.map((dataset: Dataset) => (
                <Link
                  key={dataset.id}
                  href={`/datasets/${dataset.id}`}
                  className="li-card group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-li-primary/10 flex items-center justify-center">
                        <Database className="w-5 h-5 text-li-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-li-text-primary group-hover:text-li-primary transition-colors">
                          {dataset.name}
                        </h3>
                        <p className="text-xs text-li-text-muted font-data">
                          {formatDate(dataset.created_at)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={dataset.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-li-border">
                    <div className="text-center">
                      <p className="text-lg font-display text-li-text-primary">
                        {formatCompactNumber(dataset.entity_count)}
                      </p>
                      <p className="text-xs text-li-text-muted">Entities</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-display text-li-text-primary">
                        {formatCompactNumber(dataset.edge_count)}
                      </p>
                      <p className="text-xs text-li-text-muted">Edges</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-display text-li-text-primary">
                        {dataset.density.toFixed(3)}
                      </p>
                      <p className="text-xs text-li-text-muted">Density</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Database}
              title="No datasets yet"
              description="Upload your first dataset to get started. We support CSV, JSON, and GraphML formats."
              action={
                <Link href="/datasets/new" className="li-btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Upload Dataset
                </Link>
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}
