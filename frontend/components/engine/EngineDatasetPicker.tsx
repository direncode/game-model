"use client";

import React from "react";
import Link from "next/link";
import { Database, Library, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-shim";
import { api } from "@/lib/api";
import { useEngineStore } from "@/stores/engine";

export default function EngineDatasetPicker() {
  const { setActiveDataset, addMessage, activeDatasetId } = useEngineStore();
  const { isSignedIn, getToken } = useAuth();

  const { data: datasetsResponse, isLoading, isError } = useQuery({
    queryKey: ["datasets"],
    queryFn: async () => {
      // Ensure token is fresh before making the request
      const token = await getToken();
      if (token) api.setToken(token);
      return api.listDatasets();
    },
    enabled: !!isSignedIn,
    retry: 2,
  });

  const datasets: Array<{
    id: string;
    name: string;
    entity_count?: number;
    edge_count?: number;
    description?: string;
  }> = Array.isArray(datasetsResponse)
    ? datasetsResponse
    : (datasetsResponse as any)?.items || [];

  function handleSelect(ds: (typeof datasets)[0]) {
    if (ds.id === activeDatasetId) return; // Already selected
    setActiveDataset(ds.id, ds.name);
    addMessage("user-action", { datasetName: ds.name, datasetId: ds.id });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-li-surface rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || datasets.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-li-text-muted uppercase tracking-wider font-medium">
          Available Datasets
        </p>
        <div className="li-card px-4 py-6 text-center">
          <p className="text-sm text-li-text-muted">
            {isError
              ? "Failed to load datasets. Make sure the API is running."
              : "No datasets found."}
          </p>
          <Link
            href="/datasets/library"
            className="inline-flex items-center gap-2 text-sm text-white hover:text-li-cyan transition-colors mt-3"
          >
            <Library className="w-3.5 h-3.5" />
            Browse Dataset Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-li-text-muted uppercase tracking-wider font-medium">
        Available Datasets
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {datasets.map((ds) => (
          <button
            key={ds.id}
            onClick={() => handleSelect(ds)}
            className={`group text-left li-card px-4 py-3 transition-all duration-200 cursor-pointer ${
              ds.id === activeDatasetId
                ? "border-li-cyan/50 bg-li-cyan/5"
                : "hover:border-li-gray-600"
            }`}
          >
            <div className="flex items-start gap-3">
              <Database className="w-4 h-4 text-li-text-muted mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-li-cyan transition-colors">
                  {ds.name}
                </p>
                {(ds.entity_count || ds.edge_count) && (
                  <p className="text-xs text-li-text-muted mt-0.5 font-mono">
                    {ds.entity_count?.toLocaleString() || "—"} entities
                    {ds.edge_count ? ` · ${ds.edge_count.toLocaleString()} edges` : ""}
                  </p>
                )}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-li-text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-auto mt-0.5 flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>

      <Link
        href="/datasets/library"
        className="flex items-center gap-2 text-xs text-li-text-muted hover:text-white transition-colors pt-1"
      >
        <Library className="w-3.5 h-3.5" />
        Browse Dataset Library
      </Link>
    </div>
  );
}
