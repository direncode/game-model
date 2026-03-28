"use client";

import { Download, Heart, Eye, ArrowDownToLine } from "lucide-react";

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

interface DatasetCardProps {
  dataset: HubDataset;
  onPreview: (datasetId: string) => void;
  onImport: (datasetId: string) => void;
  importing?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function DatasetCard({
  dataset,
  onPreview,
  onImport,
  importing,
}: DatasetCardProps) {
  return (
    <div className="li-card p-4 flex flex-col gap-3 hover:border-li-primary/30 transition-colors">
      {/* Header */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{dataset.name}</p>
        {dataset.author && (
          <p className="text-xs text-li-text-muted truncate">{dataset.author}</p>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-li-text-secondary line-clamp-2 flex-1">
        {dataset.description || "No description available."}
      </p>

      {/* Tags */}
      {dataset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {dataset.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] bg-li-surface border border-li-border text-li-text-muted"
            >
              {tag}
            </span>
          ))}
          {dataset.tags.length > 3 && (
            <span className="text-[10px] text-li-text-muted">
              +{dataset.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-li-text-muted">
        <span className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          {formatNumber(dataset.downloads)}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="w-3 h-3" />
          {formatNumber(dataset.likes)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-li-border">
        <button
          onClick={() => onPreview(dataset.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-li-text-secondary border border-li-border rounded-lg hover:text-li-text-primary hover:border-li-text-muted transition-colors"
        >
          <Eye className="w-3 h-3" />
          Preview
        </button>
        <button
          onClick={() => onImport(dataset.id)}
          disabled={importing}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-li-bg bg-li-primary rounded-lg hover:bg-li-primary/90 transition-colors disabled:opacity-50"
        >
          <ArrowDownToLine className="w-3 h-3" />
          {importing ? "Importing..." : "Import"}
        </button>
      </div>
    </div>
  );
}
