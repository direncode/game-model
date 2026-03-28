"use client";

import React from "react";
import { Download } from "lucide-react";
import { downloadCSV } from "@/lib/export";
import { cn } from "@/lib/utils";

interface CSVExportButtonProps {
  data: Record<string, any>[];
  filename: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export default function CSVExportButton({
  data,
  filename,
  label = "Export CSV",
  className,
  disabled = false,
}: CSVExportButtonProps) {
  const handleExport = () => {
    if (data.length === 0) return;
    const exportFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    downloadCSV(data, exportFilename);
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || data.length === 0}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors",
        "border-li-border bg-li-surface text-li-text-secondary",
        "hover:bg-li-surface-hover hover:text-li-text-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <Download className="w-4 h-4" />
      {label}
    </button>
  );
}
