"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageLoader } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Share2, Search, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface EntityNode {
  id: string;
  name: string;
  type: string;
  moduleId: string;
  moduleName: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface EntityEdge {
  source: string;
  target: string;
  similarity: number;
}

// Module colors for entity coloring
const MODULE_COLORS = [
  "#06B6D4", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
  "#D946EF", "#0EA5E9", "#22C55E", "#E11D48", "#A855F7",
];

export default function DatasetGraphPage() {
  const params = useParams();
  const datasetId = params.id as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<EntityNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ["modules", datasetId],
    queryFn: () => api.listModules(datasetId) as Promise<any[]>,
  });

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery({
    queryKey: ["connections-graph", datasetId],
    queryFn: () => api.listConnections(datasetId, 1, 500) as Promise<any>,
  });

  const isLoading = modulesLoading || connectionsLoading;

  const { nodes, edges, moduleColorMap } = useMemo(() => {
    if (!modules) return { nodes: [], edges: [], moduleColorMap: new Map() };

    const moduleList = Array.isArray(modules) ? modules : (modules as any)?.items || [];
    const connectionList = connectionsData
      ? Array.isArray(connectionsData) ? connectionsData : (connectionsData as any)?.items || []
      : [];

    const colorMap = new Map<string, string>();
    moduleList.forEach((m: any, i: number) => {
      colorMap.set(m.id, MODULE_COLORS[i % MODULE_COLORS.length]);
    });

    // Create nodes from module anchor entities
    const entityNodes: EntityNode[] = [];
    moduleList.forEach((mod: any) => {
      const anchors = mod.anchor_entities || [];
      anchors.forEach((anchor: any, idx: number) => {
        entityNodes.push({
          id: `${mod.id}-${anchor.name || anchor}`,
          name: typeof anchor === "string" ? anchor : anchor.name,
          type: mod.dominant_type || "Unknown",
          moduleId: mod.id,
          moduleName: mod.name,
        });
      });

      // If no anchors, create a representative node
      if (anchors.length === 0) {
        entityNodes.push({
          id: `${mod.id}-repr`,
          name: mod.name,
          type: mod.dominant_type || "Module",
          moduleId: mod.id,
          moduleName: mod.name,
        });
      }
    });

    // Create edges from connections
    const entityEdges: EntityEdge[] = connectionList.map((c: any) => ({
      source: c.source_entity || c.source_module_id,
      target: c.target_entity || c.target_module_id,
      similarity: c.similarity_score || c.connection_strength || 0.5,
    }));

    // Apply simple force layout
    const numNodes = entityNodes.length;
    const radius = Math.max(200, numNodes * 8);
    entityNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / numNodes;
      const moduleIdx = moduleList.findIndex((m: any) => m.id === node.moduleId);
      const clusterAngle = (2 * Math.PI * moduleIdx) / moduleList.length;
      const clusterRadius = radius * 0.4;

      node.x = Math.cos(clusterAngle) * clusterRadius + Math.cos(angle) * 40 + radius;
      node.y = Math.sin(clusterAngle) * clusterRadius + Math.sin(angle) * 40 + radius;
    });

    return { nodes: entityNodes, edges: entityEdges, moduleColorMap: colorMap };
  }, [modules, connectionsData]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(offset.x + rect.width / 2, offset.y + rect.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-rect.width / 2, -rect.height / 2);

    // Draw edges
    ctx.globalAlpha = 0.15;
    edges.forEach((edge) => {
      const source = nodes.find((n) => n.id.includes(edge.source));
      const target = nodes.find((n) => n.id.includes(edge.target));
      if (source?.x && source?.y && target?.x && target?.y) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = "#4B5563";
        ctx.lineWidth = edge.similarity * 2;
        ctx.stroke();
      }
    });

    // Draw nodes
    ctx.globalAlpha = 1;
    const searchLower = searchTerm.toLowerCase();
    nodes.forEach((node) => {
      if (!node.x || !node.y) return;

      const color = moduleColorMap.get(node.moduleId) || "#6B7280";
      const isMatch = searchTerm && node.name.toLowerCase().includes(searchLower);
      const isSelected = selectedEntity?.id === node.id;

      const nodeRadius = isSelected ? 8 : isMatch ? 7 : 4;

      // Glow for search matches
      if (isMatch || isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = isSelected ? `${color}44` : `${color}22`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = searchTerm && !isMatch ? `${color}33` : color;
      ctx.fill();

      // Labels for search matches or selected
      if (isMatch || isSelected) {
        ctx.fillStyle = "#F9FAFB";
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.name, node.x, node.y - nodeRadius - 6);
      }
    });

    ctx.restore();
  }, [nodes, edges, moduleColorMap, zoom, offset, searchTerm, selectedEntity]);

  if (isLoading) return <PageLoader />;

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={Share2}
        title="No graph data"
        description="Run crystallization to discover entities and their relationships."
      />
    );
  }

  const moduleList = Array.isArray(modules) ? modules : (modules as any)?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-display text-li-text-primary">
            Entity Graph
          </h2>
          <p className="text-sm text-li-text-secondary mt-1">
            {nodes.length} entities across {moduleList.length} modules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-li-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search entities..."
              className="li-input pl-9 py-1.5 text-sm w-48"
            />
          </div>
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.3, 5))}
            className="p-2 rounded-lg bg-li-surface border border-li-border hover:bg-li-surface-hover"
          >
            <ZoomIn className="w-4 h-4 text-li-text-secondary" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.3, 0.2))}
            className="p-2 rounded-lg bg-li-surface border border-li-border hover:bg-li-surface-hover"
          >
            <ZoomOut className="w-4 h-4 text-li-text-secondary" />
          </button>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="p-2 rounded-lg bg-li-surface border border-li-border hover:bg-li-surface-hover"
          >
            <Maximize2 className="w-4 h-4 text-li-text-secondary" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="li-card p-0 overflow-hidden" style={{ height: "calc(100vh - 260px)" }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ display: "block" }}
        />
      </div>

      {/* Module Color Legend */}
      <div className="li-card">
        <h3 className="text-sm font-display text-li-text-primary mb-3">
          Module Colors
        </h3>
        <div className="flex flex-wrap gap-3">
          {moduleList.map((mod: any, i: number) => (
            <div key={mod.id} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: MODULE_COLORS[i % MODULE_COLORS.length] }}
              />
              <span className="text-li-text-secondary">{mod.name}</span>
              <span className="text-li-text-muted font-data">
                ({mod.entity_count})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
