"use client";

import { useEffect, useState } from "react";
import { X, ArrowDownToLine, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface DatasetPreviewModalProps {
  datasetId: string;
  onClose: () => void;
  onImport: (datasetId: string, config?: string, split?: string) => void;
  importing?: boolean;
}

interface DatasetInfo {
  id: string;
  name: string;
  author: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  configs: string[];
  splits: string[];
  columns: Array<{ name: string; type: string }>;
  sample_rows: Array<Record<string, any>>;
}

export default function DatasetPreviewModal({
  datasetId,
  onClose,
  onImport,
  importing,
}: DatasetPreviewModalProps) {
  const [info, setInfo] = useState<DatasetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [selectedSplit, setSelectedSplit] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getHubDatasetInfo(datasetId)
      .then((data: any) => {
        if (!cancelled) {
          setInfo(data);
          if (data.configs?.length > 0) setSelectedConfig(data.configs[0]);
          if (data.splits?.length > 0) setSelectedSplit(data.splits[0]);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="li-card w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-li-border">
          <div>
            <h2 className="text-lg font-display font-semibold text-white">
              {info?.name || datasetId}
            </h2>
            {info?.author && (
              <p className="text-xs text-li-text-muted">by {info.author}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-li-text-muted hover:text-li-text-primary hover:bg-li-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-li-primary" />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 text-center py-8">{error}</div>
          )}

          {info && !loading && (
            <>
              {/* Description */}
              {info.description && (
                <p className="text-sm text-li-text-secondary">{info.description}</p>
              )}

              {/* Config / Split selectors */}
              <div className="grid grid-cols-2 gap-3">
                {info.configs.length > 1 && (
                  <div>
                    <label className="block text-xs text-li-text-muted mb-1">
                      Config
                    </label>
                    <select
                      value={selectedConfig}
                      onChange={(e) => setSelectedConfig(e.target.value)}
                      className="li-input w-full text-sm"
                    >
                      {info.configs.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {info.splits.length > 1 && (
                  <div>
                    <label className="block text-xs text-li-text-muted mb-1">
                      Split
                    </label>
                    <select
                      value={selectedSplit}
                      onChange={(e) => setSelectedSplit(e.target.value)}
                      className="li-input w-full text-sm"
                    >
                      {info.splits.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Column schema */}
              {info.columns.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-li-text-muted uppercase tracking-wider mb-2">
                    Schema ({info.columns.length} columns)
                  </h3>
                  <div className="border border-li-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-li-surface">
                          <th className="px-3 py-2 text-left text-li-text-muted font-medium">
                            Column
                          </th>
                          <th className="px-3 py-2 text-left text-li-text-muted font-medium">
                            Type
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {info.columns.map((col, i) => (
                          <tr
                            key={col.name}
                            className={
                              i % 2 === 0 ? "" : "bg-li-surface/50"
                            }
                          >
                            <td className="px-3 py-1.5 font-mono text-white">
                              {col.name}
                            </td>
                            <td className="px-3 py-1.5 text-li-text-secondary">
                              {typeof col.type === "string" ? col.type : JSON.stringify(col.type)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sample rows */}
              {info.sample_rows.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-li-text-muted uppercase tracking-wider mb-2">
                    Sample Rows ({info.sample_rows.length})
                  </h3>
                  <div className="border border-li-border rounded-lg overflow-x-auto">
                    <table className="text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-li-surface">
                          {Object.keys(info.sample_rows[0]).map((key) => (
                            <th
                              key={key}
                              className="px-3 py-2 text-left text-li-text-muted font-medium"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {info.sample_rows.map((row, i) => (
                          <tr
                            key={i}
                            className={i % 2 === 0 ? "" : "bg-li-surface/50"}
                          >
                            {Object.values(row).map((val, j) => (
                              <td
                                key={j}
                                className="px-3 py-1.5 text-li-text-secondary max-w-[200px] truncate"
                              >
                                {typeof val === "object"
                                  ? JSON.stringify(val).slice(0, 50)
                                  : String(val ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-li-border">
          <button
            onClick={onClose}
            className="li-btn-secondary px-4 py-2 text-sm"
          >
            Close
          </button>
          <button
            onClick={() =>
              onImport(
                datasetId,
                selectedConfig || undefined,
                selectedSplit || undefined
              )
            }
            disabled={importing || loading}
            className="li-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <ArrowDownToLine className="w-4 h-4" />
            {importing ? "Importing..." : "Import Dataset"}
          </button>
        </div>
      </div>
    </div>
  );
}
