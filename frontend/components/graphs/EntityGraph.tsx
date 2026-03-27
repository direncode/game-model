"use client";

import React, { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";

export interface EntityNode {
  id: string;
  name: string;
  type: string;
}

export interface EntityEdge {
  source: string;
  target: string;
  type?: string;
}

export interface EntityGraphProps {
  entities: EntityNode[];
  edges: EntityEdge[];
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

function getColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] || TYPE_COLORS.default;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type?: string;
}

export default function EntityGraph({
  entities,
  edges,
  width = 600,
  height = 400,
}: EntityGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const render = useCallback(() => {
    if (!svgRef.current || entities.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const nodes: SimNode[] = entities.map((e) => ({ ...e }));
    const nodeSet = new Set(nodes.map((n) => n.id));
    const links: SimLink[] = edges
      .filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type }));

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(60))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(10));

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#1F2937")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.5);

    const node = g
      .append("g")
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 5)
      .attr("fill", (d) => getColor(d.type))
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#0A0E17")
      .attr("stroke-width", 1)
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

    // Labels for small graphs
    if (entities.length < 50) {
      g.append("g")
        .selectAll<SVGTextElement, SimNode>("text")
        .data(nodes)
        .join("text")
        .attr("font-size", 9)
        .attr("fill", "#9CA3AF")
        .attr("dx", 8)
        .attr("dy", 3)
        .text((d) => d.name.length > 20 ? d.name.slice(0, 20) + "..." : d.name);

      simulation.on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0);
        node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
        g.selectAll<SVGTextElement, SimNode>("text")
          .attr("x", (d) => d.x ?? 0)
          .attr("y", (d) => d.y ?? 0);
      });
    } else {
      simulation.on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0);
        node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      });
    }

    // Tooltip
    node.append("title").text((d) => `${d.name} (${d.type})`);

    return () => {
      simulation.stop();
    };
  }, [entities, edges, width, height]);

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
