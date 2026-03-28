"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Search, Database, Box, Link2, AlertTriangle, ArrowRight } from "lucide-react";

interface SearchResult {
  entity_name: string;
  entity_type: string;
  similarity: number;
  module_id?: string;
}

export default function GlobalSearchPage() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(20);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const data = await api.querySimilar(query.trim(), topK) as SearchResult[];
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white tracking-tight">
          Global Search
        </h1>
        <p className="text-sm text-li-text-secondary mt-2">
          Search across all datasets for entities by embedding similarity
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-li-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for an entity by name..."
              className="li-input pl-12 py-3 text-base"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-li-text-muted whitespace-nowrap">Top</label>
            <input
              type="number"
              value={topK}
              onChange={(e) => setTopK(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
              className="li-input w-16 py-3 text-center"
              min={1}
              max={100}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="li-btn-primary px-6 py-3"
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </div>
      </form>

      {/* Results */}
      {loading && (
        <div className="text-center py-12 text-li-text-muted">
          Searching across all datasets...
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-li-text-muted mx-auto mb-4" />
          <p className="text-li-text-secondary">No matching entities found</p>
          <p className="text-xs text-li-text-muted mt-1">
            Try a different search term or increase the result count
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-li-text-muted mb-4">
            {results.length} results for &ldquo;{query}&rdquo;
          </p>

          {results.map((result, i) => (
            <div
              key={`${result.entity_name}-${i}`}
              className="li-card flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-li-primary/10 flex items-center justify-center">
                  <Box className="w-5 h-5 text-li-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-li-text-primary">
                    {result.entity_name}
                  </h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="li-badge bg-li-surface text-li-text-secondary border border-li-border text-xs">
                      {result.entity_type}
                    </span>
                    {result.module_id && (
                      <span className="text-xs text-li-text-muted">
                        Module: {result.module_id.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Similarity bar */}
                <div className="w-32 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-li-bg rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-li-primary"
                      style={{ width: `${result.similarity * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-data text-li-text-secondary w-12 text-right">
                    {(result.similarity * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasSearched && (
        <div className="text-center py-16">
          <Search className="w-16 h-16 text-li-border mx-auto mb-6" />
          <h3 className="text-lg text-li-text-secondary mb-2">
            Search for entities across all datasets
          </h3>
          <p className="text-sm text-li-text-muted max-w-md mx-auto">
            Enter an entity name to find similar entities using embedding-based
            similarity search powered by the TCD-JEPA engine.
          </p>
        </div>
      )}
    </div>
  );
}
