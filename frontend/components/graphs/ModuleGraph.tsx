"use client";

import React, { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";

export interface ModuleNode {
  id: string;
  name: string;
  entity_count: number;
  dominant_type?: string;
  purity_score: number;
}

export interface ModuleRelationship {
  source: string;
  target: string;
  strength: number;
}

export interface ModuleGraphProps {
  modules: ModuleNode[];
  relationships: ModuleRelationship[];
  width?: number;
  height?: number;
}

const TYPE_COLORS: Record<string, string> = {
  person: "#3B82F6",
  organization: "#10B981",
  location: "#F59E0B",
  event: "#EF4444",
  concept: "#8B5CF6",
  product: "#EC4899",
  default: "#6B7280",
};

function getColor(type?: string): string {
  return TYPE_COLORS[type?.toLowerCase() ?? ""] || TYPE_COLORS.default;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  entity_count: number;
  dominant_type?: string;
  purity_score: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  strength: number;
}

export default function ModuleGraph({
  modules,
  relationships,
  width = 600,
  height = 400,
}: ModuleGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  const render = useCallback(() => {
    if (!svgRef.current || modules.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Prepare data
    const nodes: SimNode[] = modules.map((m) => ({ ...m }));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: SimLink[] = relationships
      .filter((r) => nodeMap.has(r.source) && nodeMap.has(r.target))
      .map((r) => ({
        source: r.source,
        target: r.target,
        strength: r.strength,
      }));

    // Size scale
    const maxCount = Math.max(...modules.map((m) => m.entity_count), 1);
    const radiusScale = d3.scaleSqrt().domain([0, maxCount]).range([8, 30]);

    // Force simulation
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<SimNode>().radius((d) => radiusScale(d.entity_count) + 4));

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#1F2937")
      .attr("stroke-width", (d) => Math.max(1, d.strength * 4))
      .attr("stroke-opacity", 0.6);

    // Draw nodes
    const node = g
      .append("g")
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => radiusScale(d.entity_count))
      .attr("fill", (d) => getColor(d.dominant_type))
      .attr("fill-opacity", 0.8)
      .attr("stroke", "#0A0E17")
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        router.push(`/modules/${d.id}`);
      })
      .call(
        d3.drag<SVGCircleElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Tooltip group
    const tooltip = g.append("g").attr("class", "tooltip").style("display", "none");
    const tooltipBg = tooltip
      .append("rect")
      .attr("fill", "#111827")
      .attr("stroke", "#1F2937")
      .attr("rx", 4);
    const tooltipText = tooltip.append("text").attr("fill", "#F9FAFB").attr("font-size", 11);
    const tooltipLine1 = tooltipText.append("tspan").attr("x", 8).attr("dy", 16);
    const tooltipLine2 = tooltipText
      .append("tspan")
      .attr("x", 8)
      .attr("dy", 14)
      .attr("fill", "#9CA3AF")
      .attr("font-size", 10);

    node
      .on("mouseenter", (_event, d) => {
        tooltipLine1.text(d.name || `Module ${d.id}`);
        tooltipLine2.text(`Purity: ${(d.purity_score * 100).toFixed(1)}%`);
        const bbox = tooltipText.node()?.getBBox();
        if (bbox) {
          tooltipBg.attr("width", bbox.width + 16).attr("height", bbox.height + 10);
        }
        tooltip
          .attr("transform", `translate(${(d.x ?? 0) + radiusScale(d.entity_count) + 6}, ${(d.y ?? 0) - 20})`)
          .style("display", null);
      })
      .on("mouseleave", () => {
        tooltip.style("display", "none");
      });

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [modules, relationships, width, height, router]);

  useEffect(() => {
    const cleanup = render();
    return () => cleanup?.();
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
