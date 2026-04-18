"use client";

import { useMemo } from "react";
import { Delaunay } from "d3-delaunay";
import type { DuncPlayerTick } from "@/lib/dunc/types";
import { PITCH_X, PITCH_Y } from "@/lib/dunc/types";

interface Props {
  players: DuncPlayerTick[];
  width: number;
  height: number;
  team: "home" | "away" | "both";
  opacity?: number;
}

export function VoronoiOverlay({ players, width, height, team, opacity = 0.08 }: Props) {
  const paths = useMemo(() => {
    const filtered = team === "both"
      ? players
      : players.filter((p) => p.team === team);

    if (filtered.length < 3) return [];

    const scaleX = width / PITCH_X;
    const scaleY = height / PITCH_Y;

    const points = filtered.map((p) => [p.x * scaleX, p.y * scaleY] as [number, number]);
    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, width, height]);

    return filtered.map((p, i) => ({
      path: voronoi.renderCell(i),
      team: p.team,
    }));
  }, [players, width, height, team]);

  return (
    <g className="voronoi-overlay">
      {paths.map((cell, i) => (
        <path
          key={i}
          d={cell.path}
          fill={cell.team === "home" ? "rgba(0,212,255,0.08)" : "rgba(248,81,73,0.08)"}
          stroke={cell.team === "home" ? "rgba(0,212,255,0.15)" : "rgba(248,81,73,0.15)"}
          strokeWidth={0.5}
          style={{ opacity }}
        />
      ))}
    </g>
  );
}
