"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { fetchFSDModules, type FSDModuleSummary } from "@/lib/fsd-api";
import { Boxes, Clock } from "lucide-react";

function ModuleCard({ module }: { module: FSDModuleSummary }) {
  return (
    <div className="p-3 rounded-lg bg-li-gray-900 border border-li-border hover:border-li-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-medium text-white">{module.name}</p>
          {module.dominant_type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-li-cyan/10 text-li-cyan border border-li-cyan/20">
              {module.dominant_type}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-li-text-muted">
          #{module.module_index}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-li-text-muted">
          {module.entity_count} venue{module.entity_count !== 1 ? "s" : ""}
        </span>
        {module.purity_score != null && (
          <span className="font-mono text-li-cyan">
            {(module.purity_score * 100).toFixed(0)}% pure
          </span>
        )}
      </div>
    </div>
  );
}

export default function ModulePanel() {
  const { getToken } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["fsd-modules"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchFSDModules(token);
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-li-gray-700 border-t-li-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.status === "no_data") {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-li-border">
          <Boxes className="w-4 h-4 text-li-text-muted" />
          <h3 className="text-sm font-medium text-white">Crystallized Modules</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <p className="text-sm text-li-text-muted mb-1">No crystallization yet</p>
            <p className="text-xs text-li-gray-600">
              Modules appear after the daily TCD-JEPA run discovers structure in the venue graph.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = data.status === "running";

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-li-border">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-li-cyan" />
          <h3 className="text-sm font-medium text-white">Crystallized Modules</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-li-text-muted">
          {isRunning ? (
            <span className="text-li-yellow">crystallizing...</span>
          ) : data.timestamp ? (
            <>
              <Clock className="w-3 h-3" />
              <span>{new Date(data.timestamp).toLocaleString()}</span>
            </>
          ) : null}
        </div>
      </div>

      {data.status === "failed" && (
        <div className="px-4 py-2 bg-li-red/10 border-b border-li-red/20">
          <p className="text-xs text-li-red">
            Crystallization failed: {data.error || "Unknown error"}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {data.modules.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {data.modules.map((m) => (
              <ModuleCard key={m.id} module={m} />
            ))}
          </div>
        ) : isRunning ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-li-gray-700 border-t-li-cyan rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-li-text-muted">TCD-JEPA is running...</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-li-text-muted text-center py-4">
            No modules discovered in last run.
          </p>
        )}
      </div>

      {data.module_count > 0 && (
        <div className="px-4 py-2 border-t border-li-border">
          <span className="text-[10px] font-mono text-li-text-muted">
            {data.module_count} module{data.module_count !== 1 ? "s" : ""} ·{" "}
            {data.modules.reduce((sum, m) => sum + m.entity_count, 0)} venues clustered
          </span>
        </div>
      )}
    </div>
  );
}
