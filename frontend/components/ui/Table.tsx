"use client";

import React, { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Skeleton from "./Skeleton";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  className?: string;
}

export default function Table<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = "No data available",
  onSort,
  className,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    const newDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(newDir);
    onSort?.(key, newDir);
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-li-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-xs font-display font-medium text-li-text-muted uppercase tracking-wider",
                  col.sortable && "cursor-pointer select-none hover:text-li-text-secondary"
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <span className="text-li-text-muted">
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-li-border">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton width="80%" height="16px" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-li-text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={index}
                className="hover:bg-li-surface-hover transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-li-text-primary">
                    {col.render
                      ? col.render(item, index)
                      : (item[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
