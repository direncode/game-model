"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Sparkles, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import DatasetCard from "@/components/hub/DatasetCard";
import CategoryFilter from "@/components/hub/CategoryFilter";
import DatasetPreviewModal from "@/components/hub/DatasetPreviewModal";
import ImportProgress from "@/components/hub/ImportProgress";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HubDataset {
  id: string;
  name: string;
  author?: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  category?: string;
}

interface ImportState {
  status: "importing" | "success" | "error";
  datasetId?: string;
  datasetName?: string;
  newDatasetId?: string;
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DatasetLibraryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [previewDatasetId, setPreviewDatasetId] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────

  const { data: featured = [] } = useQuery({
    queryKey: ["hub-featured"],
    queryFn: () => api.getHubFeatured() as Promise<HubDataset[]>,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["hub-categories"],
    queryFn: () => api.getHubCategories() as Promise<Array<{ name: string; tags: string[] }>>,
  });

  const {
    data: searchResults = [],
    isFetching: searching,
  } = useQuery({
    queryKey: ["hub-search", searchSubmitted, selectedCategory],
    queryFn: () =>
      api.searchHubDatasets(
        searchSubmitted || "popular",
        selectedCategory || undefined
      ) as Promise<HubDataset[]>,
    enabled: true,
  });

  const { data: myDatasets = [] } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => api.listDatasets(),
    select: (data: any) => (Array.isArray(data) ? data : data?.items || []),
  });

  // ── Handlers ──────────────────────────────────────────────────────

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchSubmitted(searchQuery);
  }

  const handleImport = useCallback(
    async (hfDatasetId: string, config?: string, split?: string) => {
      const name = hfDatasetId.split("/").pop() || hfDatasetId;
      setImportState({ status: "importing", datasetId: hfDatasetId, datasetName: name });
      setPreviewDatasetId(null);

      try {
        const result = (await api.importHubDataset({
          hf_dataset_id: hfDatasetId,
          config,
          split,
        })) as any;

        setImportState({
          status: "success",
          datasetId: hfDatasetId,
          datasetName: result.dataset_name || name,
          newDatasetId: result.dataset_id,
        });
        toast.success(`Imported "${result.dataset_name}" — ${result.entity_count} entities`);
        queryClient.invalidateQueries({ queryKey: ["datasets"] });
      } catch (err: any) {
        setImportState({
          status: "error",
          datasetId: hfDatasetId,
          datasetName: name,
          error: err.message,
        });
        toast.error(err.message || "Import failed");
      }
    },
    [queryClient]
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <Sidebar />
      <main className="pl-60 pt-14 min-h-screen bg-li-bg">
        <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-semibold text-white">
                Dataset Library
              </h1>
              <p className="text-sm text-li-text-muted mt-1">
                Browse and import datasets from Hugging Face for TCD-JEPA analysis
              </p>
            </div>
            <a
              href="https://huggingface.co/datasets"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-li-text-secondary hover:text-li-text-primary transition-colors"
            >
              Browse HF
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Import progress */}
          {importState && (
            <ImportProgress
              status={importState.status}
              datasetName={importState.datasetName}
              datasetId={importState.newDatasetId}
              error={importState.error}
              onViewDataset={
                importState.newDatasetId
                  ? () => router.push(`/datasets/${importState.newDatasetId}`)
                  : undefined
              }
              onDismiss={() => setImportState(null)}
            />
          )}

          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-li-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search datasets... (e.g., finance, citation network, social media)"
              className="li-input w-full pl-10 pr-4 py-2.5 text-sm"
            />
          </form>

          {/* Featured */}
          {!searchSubmitted && featured.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-li-primary" />
                <h2 className="text-sm font-medium text-li-text-secondary uppercase tracking-wider">
                  Featured for TCD-JEPA
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featured.map((ds) => (
                  <DatasetCard
                    key={ds.id}
                    dataset={ds}
                    onPreview={setPreviewDatasetId}
                    onImport={(id) => handleImport(id)}
                    importing={
                      importState?.status === "importing" &&
                      importState?.datasetId === ds.id
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* Categories */}
          <section>
            <h2 className="text-sm font-medium text-li-text-secondary uppercase tracking-wider mb-3">
              Categories
            </h2>
            <CategoryFilter
              categories={categories}
              selected={selectedCategory}
              onSelect={(cat) => {
                setSelectedCategory(cat);
                if (!searchSubmitted) setSearchSubmitted("popular");
              }}
            />
          </section>

          {/* Search Results / Browse */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-li-text-secondary uppercase tracking-wider">
                {searchSubmitted
                  ? `Results for "${searchSubmitted}"`
                  : "Hugging Face Datasets"}
              </h2>
              {searching && (
                <span className="text-xs text-li-text-muted animate-pulse">
                  Searching...
                </span>
              )}
            </div>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((ds: HubDataset) => (
                  <DatasetCard
                    key={ds.id}
                    dataset={ds}
                    onPreview={setPreviewDatasetId}
                    onImport={(id) => handleImport(id)}
                    importing={
                      importState?.status === "importing" &&
                      importState?.datasetId === ds.id
                    }
                  />
                ))}
              </div>
            ) : (
              !searching && (
                <div className="li-card px-6 py-10 text-center">
                  <p className="text-sm text-li-text-muted">
                    {searchSubmitted
                      ? "No datasets found. Try a different search term."
                      : "Search for datasets or browse by category."}
                  </p>
                </div>
              )
            )}
          </section>

          {/* My Datasets */}
          {myDatasets.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-li-text-secondary uppercase tracking-wider mb-3">
                My Datasets ({myDatasets.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myDatasets.map((ds: any) => (
                  <div
                    key={ds.id}
                    onClick={() => router.push(`/datasets/${ds.id}`)}
                    className="li-card p-4 cursor-pointer hover:border-li-primary/30 transition-colors"
                  >
                    <p className="text-sm font-medium text-white">{ds.name}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-li-text-muted">
                      {ds.entity_count != null && (
                        <span>{ds.entity_count} entities</span>
                      )}
                      {ds.edge_count != null && (
                        <span>{ds.edge_count} edges</span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          ds.status === "ready"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-li-surface text-li-text-muted"
                        }`}
                      >
                        {ds.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Preview modal */}
      {previewDatasetId && (
        <DatasetPreviewModal
          datasetId={previewDatasetId}
          onClose={() => setPreviewDatasetId(null)}
          onImport={handleImport}
          importing={
            importState?.status === "importing" &&
            importState?.datasetId === previewDatasetId
          }
        />
      )}
    </>
  );
}
