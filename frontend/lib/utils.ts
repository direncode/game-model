import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

/**
 * Merge Tailwind classes with clsx for conditional class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string or Date object into a readable format.
 */
export function formatDate(date: string | Date, formatStr = "MMM d, yyyy HH:mm"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, formatStr);
}

/**
 * Format a date as relative time (e.g., "3 minutes ago").
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Format a number with locale-aware separators, with compact shorthand for large values.
 */
export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("en-US", options).format(n);
}

/**
 * Format a number as a compact representation (e.g., 1.2K, 3.4M).
 */
export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

/**
 * Format a percentage value.
 */
export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len).trimEnd() + "...";
}

/**
 * Format bytes into human-readable file sizes.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format duration in seconds to a human-readable string.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * Generate a color from a string (for consistent entity/module colors).
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

/**
 * Return a Tailwind color class based on a percentage value.
 */
export function percentColor(pct: number): string {
  if (pct >= 90) return "text-li-accent";
  if (pct >= 70) return "text-li-warning";
  return "text-li-danger";
}

/**
 * Return Tailwind badge classes for a given status string.
 */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    ready: "bg-li-accent/20 text-li-accent",
    completed: "bg-li-accent/20 text-li-accent",
    accepted: "bg-li-accent/20 text-li-accent",
    processing: "bg-li-primary/20 text-li-primary",
    running: "bg-li-primary/20 text-li-primary",
    under_review: "bg-li-primary/20 text-li-primary",
    uploading: "bg-li-warning/20 text-li-warning",
    pending: "bg-li-warning/20 text-li-warning",
    open: "bg-li-warning/20 text-li-warning",
    deferred: "bg-li-text-muted/20 text-li-text-muted",
    failed: "bg-li-danger/20 text-li-danger",
    rejected: "bg-li-danger/20 text-li-danger",
    error: "bg-li-danger/20 text-li-danger",
  };
  return map[status] || "bg-li-border/20 text-li-text-secondary";
}

/**
 * Format a date for display in short form.
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
