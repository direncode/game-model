"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  degree: number;
}
interface Link extends d3.SimulationLinkDatum<Node> {
  from_entity: string;
  to_entity: string;
  kind: string;
  weight: number;
}

const TYPE_COLOR: Record<string, string> = {
  actor: "#00d4ff",
  place: "#3fb950",
  event: "#d29922",
  system: "#a371f7",
  region: "#388bfd",
  claim: "#f85149",
};

export default function NetworkGraphClient({
  nodes: rawNodes,
  edges: rawEdges,
}: {
  nodes: { id: string; name: string; type: string; degree: number }[];
  edges: {
    from_entity: string;
    to_entity: string;
    kind: string;
    weight: number;
  }[];
}) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const { width, height } = (
      ref.current.parentElement as HTMLElement
    ).getBoundingClientRect();

    const nodes: Node[] = rawNodes.map((n) => ({ ...n }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: Link[] = rawEdges
      .filter((e) => nodeIds.has(e.from_entity) && nodeIds.has(e.to_entity))
      .map((e) => ({
        ...e,
        source: e.from_entity,
        target: e.to_entity,
      }));

    const sim = d3
      .forceSimulation<Node, Link>(nodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(links)
          .id((d) => d.id)
          .distance(80)
          .strength(0.3),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(18));

    const link = svg
      .append("g")
      .attr("stroke", "#2a2a2a")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke-width", (d) => 0.4 + d.weight * 1.2)
      .attr("stroke-opacity", 0.4);

    const nodeGroup = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("cursor", "grab")
      .call(
        d3
          .drag<SVGGElement, Node>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    nodeGroup
      .append("circle")
      .attr("r", (d) => 4 + Math.min(d.degree, 15))
      .attr("fill", (d) => TYPE_COLOR[d.type] ?? "#9a9a9a")
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5);

    nodeGroup
      .append("text")
      .attr("x", 10)
      .attr("y", 4)
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-size", 10)
      .attr("fill", "#d4d4d4")
      .text((d) => d.name);

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as Node).x!)
        .attr("y1", (d) => (d.source as Node).y!)
        .attr("x2", (d) => (d.target as Node).x!)
        .attr("y2", (d) => (d.target as Node).y!);
      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
    };
  }, [rawNodes, rawEdges]);

  return <svg ref={ref} className="w-full h-full" />;
}
