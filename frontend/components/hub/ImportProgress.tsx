"use client";

import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface ImportProgressProps {
  status: "importing" | "success" | "error";
  datasetName?: string;
  datasetId?: string;
  error?: string;
  onViewDataset?: () => void;
  onDismiss: () => void;
}

export default function ImportProgress({
  status,
  datasetName,
  datasetId,
  error,
  onViewDataset,
  onDismiss,
}: ImportProgressProps) {
  return (
    <div className="li-card px-4 py-3 flex items-center gap-3">
      {status === "importing" && (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-li-primary flex-shrink-0" />
          <p className="text-sm text-li-text-secondary flex-1">
            Importing <span className="text-white font-medium">{datasetName}</span>...
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          <p className="text-sm text-li-text-secondary flex-1">
            <span className="text-white font-medium">{datasetName}</span>{" "}
            imported successfully.
          </p>
          {onViewDataset && (
            <button
              onClick={onViewDataset}
              className="text-xs text-white hover:text-li-gray-300 transition-colors"
            >
              View
            </button>
          )}
        </>
      )}

      {status === "error" && (
        <>
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400 flex-1">
            Failed to import{" "}
            <span className="font-medium">{datasetName}</span>
            {error && `: ${error}`}
          </p>
        </>
      )}

      <button
        onClick={onDismiss}
        className="text-xs text-li-text-muted hover:text-li-text-secondary transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
