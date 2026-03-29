"use client";

import type { FSDStatus } from "@/lib/fsd-api";
import { Radio } from "lucide-react";

interface StatusBarProps {
  status: FSDStatus | undefined;
  isLoading: boolean;
}

export default function StatusBar({ status, isLoading }: StatusBarProps) {
  const activeFeedCount = status
    ? Object.values(status.data_feeds).filter((s) => s === "active" || s === "available").length
    : 0;
  const totalFeeds = status ? Object.keys(status.data_feeds).length : 0;

  return (
    <div className="flex items-center gap-4 text-[11px] font-mono text-li-text-muted">
      <div className="flex items-center gap-1.5">
        <Radio className={`w-3 h-3 ${status?.status === "operational" ? "text-li-green" : "text-li-yellow"}`} />
        <span className={status?.status === "operational" ? "text-li-green" : "text-li-yellow"}>
          {isLoading ? "connecting..." : status?.status === "operational" ? "OPERATIONAL" : "DEGRADED"}
        </span>
      </div>
      {status && (
        <>
          <span className="text-li-gray-700">|</span>
          <span>
            {activeFeedCount}/{totalFeeds} feeds live
          </span>
          <span className="text-li-gray-700">|</span>
          <span>v{status.version}</span>
          <span className="text-li-gray-700">|</span>
          <span>605 venues</span>
        </>
      )}
    </div>
  );
}
