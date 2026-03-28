"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { cn } from "@/lib/utils";
import {
  Search,
  Loader2,
  Database,
  ArrowRight,
} from "lucide-react";

interface SimilarResult {
  entity_name: string;
  entity_type: string;
  similarity: number;
  module_id?: string;
  module_name?: string;
}

export default function EntitySearchPage() {
  const params = useParams();
  const datasetId = params.id as string;

  const [entityName, setEntityName] = useState("");
  const [topK, setTopK] = useState(10);
  const [results, setResults] = useState<SimilarResult[] | null>(null);

  const searchMutation = useMutation({
    mutationFn: () =>
      api.querySimilar(entityName, topK, datasetId) as Promise<SimilarResult[]>,
    onSuccess: (data) => {
      setResults(Array.isArray(data) ? data : []);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entityName.trim()) return;
    searchMutation.mutate();
  }

  function similarityColor(score: number): string {
    if (score >= 0.8) return "bg-li-accent";
    if (score >= 0.5) return "bg-li-warning";
    return "bg-li-danger";
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-64 pt-16">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-display text-li-text-primary flex items-center gap-3">
              <Search className="w-6 h-6 text-li-primary" />
              Entity Search
            </h1>
            <p className="text-sm text-li-text-secondary mt-1">
              Find similar entities using embedding similarity
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="li-card mb-8">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm text-li-text-secondary mb-1.5">
                  Entity Name
                </label>
                <input
                  type="text"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  className="li-input w-full"
                  placeholder="Enter entity name to search..."
                />
              </div>
              <div className="w-48">
                <label className="block text-sm text-li-text-secondary mb-1.5">
                  Top K: {topK}
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full accent-li-primary h-2 bg-li-border rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-li-text-muted mt-0.5">
                  <span>1</span>
                  <span>100</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={searchMutation.isPending || !entityName.trim()}
                className="li-btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </button>
            </div>
          </form>

          {/* Error */}
          {searchMutation.isError && (
            <div className="li-card border-li-danger/50 mb-6">
              <p className="text-sm text-li-danger">
                {searchMutation.error?.message || "Search failed"}
              </p>
            </div>
          )}

          {/* Results */}
          {results === null && !searchMutation.isPending && (
            <div className="li-card py-16 text-center">
              <Database className="w-12 h-12 mx-auto mb-3 text-li-text-muted opacity-40" />
              <p className="text-sm text-li-text-muted">
                Enter an entity name to search for similar entities
              </p>
            </div>
          )}

          {searchMutation.isPending && (
            <div className="li-card py-16 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-li-primary animate-spin" />
              <p className="text-sm text-li-text-muted">Searching...</p>
            </div>
          )}

          {results !== null && !searchMutation.isPending && (
            <div className="li-card overflow-x-auto p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-li-border">
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Entity Name
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Type
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Similarity
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Module
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-li-border">
                  {results.map((result, idx) => (
                    <tr
                      key={`${result.entity_name}-${idx}`}
                      className="hover:bg-li-surface-hover transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-li-text-primary font-medium">
                        {result.entity_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="li-badge bg-li-surface text-li-text-secondary border border-li-border text-xs">
                          {result.entity_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-li-border rounded-full overflow-hidden max-w-[120px]">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                similarityColor(result.similarity)
                              )}
                              style={{
                                width: `${(result.similarity * 100).toFixed(0)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-data text-li-text-secondary w-12 text-right">
                            {(result.similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {result.module_id ? (
                          <a
                            href={`/datasets/${datasetId}/modules/${result.module_id}`}
                            className="text-xs text-li-primary hover:underline flex items-center gap-1"
                          >
                            {result.module_name || result.module_id}
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-li-text-muted">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {results.length === 0 && (
                <div className="py-12 text-center text-sm text-li-text-muted">
                  No similar entities found
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
