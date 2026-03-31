"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { fetchFSDModules, triggerFSDCrystallization, type FSDModuleSummary } from "@/lib/fsd-api";
import { Boxes, Clock, Zap, DollarSign, ChevronDown } from "lucide-react";

const SINGLETON_THRESHOLD = 2; // modules with ≤ this many venues get collapsed

const MONTHLY_BUDGET_USD = 50;
const COST_PER_RUN_USD = 1;

function ModuleCard({ module }: { module: FSDModuleSummary }) {
  return (
    <div className="p-3 rounded-lg bg-li-gray-900 border border-li-border hover:border-li-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-medium text-white leading-tight">{module.name}</p>
          {module.dominant_type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-li-cyan/10 text-li-cyan border border-li-cyan/20 mt-1 inline-block">
              {module.dominant_type}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-li-text-muted flex-shrink-0">
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
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["fsd-modules"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchFSDModules(token);
    },
    staleTime: 5 * 60_000,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 10_000 : false,
  });

  const handleCrystallize = async () => {
    setTriggering(true);
    setTriggerError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await triggerFSDCrystallization(token);
      // Start polling
      queryClient.invalidateQueries({ queryKey: ["fsd-modules"] });
    } catch (e: any) {
      setTriggerError(e.message || "Failed to trigger");
    } finally {
      setTriggering(false);
    }
  };

  const [othersExpanded, setOthersExpanded] = useState(false);
  const isRunning = data?.status === "running" || triggering;

  const { mainModules, otherModules, otherVenueCount } = useMemo(() => {
    const modules = data?.modules ?? [];
    // Sort all modules by entity_count descending
    const sorted = [...modules].sort((a, b) => b.entity_count - a.entity_count);
    const main: FSDModuleSummary[] = [];
    const other: FSDModuleSummary[] = [];
    for (const m of sorted) {
      if (m.entity_count <= SINGLETON_THRESHOLD) {
        other.push(m);
      } else {
        main.push(m);
      }
    }
    return {
      mainModules: main,
      otherModules: other,
      otherVenueCount: other.reduce((s, m) => s + m.entity_count, 0),
    };
  }, [data?.modules]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-li-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Boxes className={`w-4 h-4 ${isRunning ? "text-li-yellow animate-pulse" : "text-li-cyan"}`} />
          <h3 className="text-sm font-medium text-white">Crystallized Modules</h3>
        </div>
        {data?.timestamp && !isRunning && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-li-text-muted">
            <Clock className="w-3 h-3" />
            <span>{new Date(data.timestamp).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Crystallize button + budget */}
      <div className="px-4 py-3 border-b border-li-border flex-shrink-0">
        <button
          onClick={handleCrystallize}
          disabled={isRunning}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
            bg-li-cyan/10 border border-li-cyan/30 text-li-cyan
            hover:bg-li-cyan/20 hover:border-li-cyan/50
            active:scale-[0.98]"
        >
          {isRunning ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-li-cyan/30 border-t-li-cyan rounded-full animate-spin" />
              Crystallizing...
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              Crystallize Now
            </>
          )}
        </button>

        {/* Budget indicator */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-[10px] text-li-text-muted">
            <DollarSign className="w-3 h-3" />
            <span>~${COST_PER_RUN_USD}/run · ${MONTHLY_BUDGET_USD}/mo cap</span>
          </div>
          <span className="text-[10px] font-mono text-li-text-muted">H100 · RunPod</span>
        </div>

        {triggerError && (
          <p className="text-[11px] text-li-red mt-1.5">{triggerError}</p>
        )}
      </div>

      {/* Module results or empty state */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-li-gray-700 border-t-li-cyan rounded-full animate-spin" />
        </div>
      ) : isRunning && !data?.modules?.length ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-li-gray-700 border-t-li-cyan rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-li-text-muted">TCD-JEPA running on H100...</p>
            <p className="text-[10px] text-li-gray-600 mt-1">~15 min · 100 epochs</p>
          </div>
        </div>
      ) : data?.modules?.length ? (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {mainModules.map((m) => (
              <ModuleCard key={m.id} module={m} />
            ))}
          </div>

          {/* Collapsed "Other" group for tiny modules */}
          {otherModules.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setOthersExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-li-gray-900/50 border border-li-border hover:border-li-gray-700 transition-colors text-left"
              >
                <span className="text-xs text-li-text-muted">
                  Other{" "}
                  <span className="font-mono text-li-cyan">
                    {otherModules.length} modules · {otherVenueCount} venues
                  </span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-li-text-muted transition-transform ${
                    othersExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>
              {othersExpanded && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {otherModules.map((m) => (
                    <ModuleCard key={m.id} module={m} />
                  ))}
                </div>
              )}
            </div>
          )}

          {data.module_count > 0 && (
            <p className="text-[10px] font-mono text-li-text-muted text-center mt-3">
              {data.module_count} modules · {data.modules.reduce((s, m) => s + m.entity_count, 0)} venues clustered
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <p className="text-sm text-li-text-muted mb-1">No crystallization yet</p>
            <p className="text-xs text-li-gray-600">
              Run TCD-JEPA to discover hidden structure in the venue graph.
            </p>
          </div>
        </div>
      )}

      {data?.status === "failed" && (
        <div className="px-4 py-2 border-t border-li-red/20 bg-li-red/5 flex-shrink-0">
          <p className="text-xs text-li-red">Failed: {data.error || "Unknown error"}</p>
        </div>
      )}
    </div>
  );
}
