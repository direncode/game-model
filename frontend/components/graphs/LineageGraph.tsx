"use client";

import React, { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";

export interface LineageEvent {
  id: string;
  type: string;
  action: string;
  timestamp: string;
  parent_ids?: string[];
}

export interface LineageGraphProps {
  events: LineageEvent[];
  width?: number;
  height?: number;
}

interface LayoutNode {
  id: string;
  type: string;
  action: string;
  timestamp: string;
  x: number;
  y: number;
}

export default function LineageGraph({
  events,
  width = 800,
  height = 300,
}: LineageGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const render = useCallback(() => {
    if (!svgRef.current || events.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Sort events by timestamp for left-to-right layout
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // Build parent map
    const parentMap = new Map<string, string[]>();
    events.forEach((e) => {
      if (e.parent_ids) parentMap.set(e.id, e.parent_ids);
    });

    // Calculate layers using BFS from roots
    const layerMap = new Map<string, number>();
    const roots = sorted.filter((e) => !e.parent_ids || e.parent_ids.length === 0);
    const queue: Array<{ id: string; layer: number }> = roots.map((r) => ({ id: r.id, layer: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, layer } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      layerMap.set(id, layer);

      // Find children
      sorted.forEach((e) => {
        if (e.parent_ids?.includes(id) && !visited.has(e.id)) {
          queue.push({ id: e.id, layer: layer + 1 });
        }
      });
    }

    // Assign unvisited
    sorted.forEach((e, i) => {
      if (!layerMap.has(e.id)) layerMap.set(e.id, i);
    });

    const maxLayer = Math.max(...Array.from(layerMap.values()), 0);

    // Group by layer for vertical positioning
    const layerGroups = new Map<number, string[]>();
    sorted.forEach((e) => {
      const l = layerMap.get(e.id) ?? 0;
      if (!layerGroups.has(l)) layerGroups.set(l, []);
      layerGroups.get(l)!.push(e.id);
    });

    // Layout nodes
    const nodes: LayoutNode[] = sorted.map((e) => {
      const layer = layerMap.get(e.id) ?? 0;
      const group = layerGroups.get(layer) ?? [e.id];
      const idx = group.indexOf(e.id);
      const count = group.length;
      return {
        ...e,
        x: margin.left + (maxLayer > 0 ? (layer / maxLayer) * innerW : innerW / 2),
        y: margin.top + ((idx + 1) / (count + 1)) * innerH,
      };
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Build edges
    const edges: Array<{ source: LayoutNode; target: LayoutNode }> = [];
    events.forEach((e) => {
      if (e.parent_ids) {
        e.parent_ids.forEach((pid) => {
          const src = nodeMap.get(pid);
          const tgt = nodeMap.get(e.id);
          if (src && tgt) edges.push({ source: src, target: tgt });
        });
      }
    });

    // Arrow marker
    svg
      .append("defs")
      .append("marker")
      .attr("id", "lineage-arrow")
      .attr("viewBox", "0 0 10 6")
      .attr("refX", 10)
      .attr("refY", 3)
      .attr("markerWidth", 8)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L10,3 L0,6 Z")
      .attr("fill", "#374151");

    // Draw edges
    g.append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y)
      .attr("stroke", "#374151")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#lineage-arrow)");

    // Draw nodes
    const nodeGroup = g
      .append("g")
      .selectAll<SVGGElement, LayoutNode>("g")
      .data(nodes)
      .join("g")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

    nodeGroup.each(function (d) {
      const el = d3.select(this);
      const isData = d.type.toLowerCase().includes("data") || d.type.toLowerCase().includes("entity");

      if (isData) {
        el.append("circle")
          .attr("r", 10)
          .attr("fill", "#3B82F6")
          .attr("fill-opacity", 0.8)
          .attr("stroke", "#0A0E17")
          .attr("stroke-width", 1.5);
      } else {
        el.append("rect")
          .attr("x", -9)
          .attr("y", -9)
          .attr("width", 18)
          .attr("height", 18)
          .attr("rx", 3)
          .attr("fill", "#10B981")
          .attr("fill-opacity", 0.8)
          .attr("stroke", "#0A0E17")
          .attr("stroke-width", 1.5);
      }

      // Label
      el.append("text")
        .attr("dy", 22)
        .attr("text-anchor", "middle")
        .attr("fill", "#9CA3AF")
        .attr("font-size", 9)
        .text(d.action.length > 18 ? d.action.slice(0, 18) + "..." : d.action);
    });

    // SVG title tooltip
    nodeGroup.append("title").text((d) => `${d.action}\n${d.type}\n${d.timestamp}`);
  }, [events, width, height]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="block bg-li-bg rounded-lg"
    />
  );
}
