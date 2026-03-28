"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageLoader } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import Module3DExplorer from "@/components/graphs/Module3DExplorer";
import { Compass } from "lucide-react";

interface Module {
  id: string;
  module_index: number;
  name: string;
  description?: string;
  entity_count: number;
  dominant_type: string;
  purity_score: number;
  confidence: number;
  type_distribution?: Record<string, number>;
}

interface Connection {
  id: string;
  source_module_id: string;
  target_module_id: string;
  connection_strength: number;
  shared_entity_count: number;
}

export default function ExplorerPage() {
  const params = useParams();
  const datasetId = params.id as string;

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ["modules", datasetId],
    queryFn: () => api.listModules(datasetId) as Promise<Module[]>,
  });

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery({
    queryKey: ["connections", datasetId, "all"],
    queryFn: () => api.listConnections(datasetId, 1, 1000) as Promise<{ items: Connection[] }>,
  });

  const isLoading = modulesLoading || connectionsLoading;

  const explorerData = useMemo(() => {
    if (!modules || !connectionsData) return null;

    const moduleList = Array.isArray(modules) ? modules : (modules as any)?.items || [];
    const connections = Array.isArray(connectionsData)
      ? connectionsData
      : (connectionsData as any)?.items || [];

    return {
      modules: moduleList.map((m: Module) => ({
        id: m.id,
        name: m.name,
        entity_count: m.entity_count,
        dominant_type: m.dominant_type,
        purity_score: m.purity_score,
        confidence: m.confidence,
      })),
      connections: connections
        .filter((c: any) => c.source_module_id && c.target_module_id)
        .map((c: any) => ({
          source: c.source_module_id,
          target: c.target_module_id,
          strength: c.connection_strength || c.similarity_score || 0.5,
        })),
    };
  }, [modules, connectionsData]);

  if (isLoading) return <PageLoader />;

  if (!explorerData || explorerData.modules.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="No modules to explore"
        description="Run a crystallization job first to discover modules and their relationships."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display text-li-text-primary">
          3D Module Explorer
        </h2>
        <p className="text-sm text-li-text-secondary mt-1">
          Interactive 3D visualization of discovered modules and their relationships.
          Click and drag to rotate. Scroll to zoom. Hover for details.
        </p>
      </div>

      <div className="li-card p-0 overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        <Module3DExplorer
          modules={explorerData.modules}
          connections={explorerData.connections}
        />
      </div>

      {/* Legend */}
      <div className="li-card">
        <h3 className="text-sm font-display text-li-text-primary mb-3">Legend</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400" />
            <span className="text-li-text-secondary">Module node (size = entity count)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-gray-500" />
            <span className="text-li-text-secondary">Connection (opacity = strength)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-li-text-muted font-data">{explorerData.modules.length} modules</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-li-text-muted font-data">{explorerData.connections.length} connections</span>
          </div>
        </div>
      </div>
    </div>
  );
}
