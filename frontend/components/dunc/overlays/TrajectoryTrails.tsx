"use client";

import { useMemo } from "react";
import type { DuncPlayerTick } from "@/lib/dunc/types";
import { PITCH_X, PITCH_Y } from "@/lib/dunc/types";

interface Props {
  /** History buffer: array of player arrays from recent ticks */
  history: DuncPlayerTick[][];
  width: number;
  height: number;
  maxTrailLength?: number;
  team?: "home" | "away" | "both";
}

export function TrajectoryTrails({ history, width, height, maxTrailLength = 30, team = "both" }: Props) {
  const trails = useMemo(() => {
    const scaleX = width / PITCH_X;
    const scaleY = height / PITCH_Y;

    // Build per-player trail from history
    const playerTrails: Record<string, { points: string; team: string }> = {};
    const recent = history.slice(-maxTrailLength);

    for (const tick of recent) {
      for (const p of tick) {
        if (team !== "both" && p.team !== team) continue;
        if (!playerTrails[p.id]) {
          playerTrails[p.id] = { points: "", team: p.team };
        }
        const px = p.x * scaleX;
        const py = p.y * scaleY;
        playerTrails[p.id].points += `${px},${py} `;
      }
    }

    return Object.entries(playerTrails)
      .filter(([, trail]) => trail.points.trim().includes(" "))
      .map(([id, trail]) => ({
        id,
        points: trail.points.trim(),
        team: trail.team,
      }));
  }, [history, width, height, maxTrailLength, team]);

  return (
    <g className="trajectory-trails">
      {trails.map((trail) => (
        <polyline
          key={trail.id}
          points={trail.points}
          fill="none"
          stroke={trail.team === "home" ? "rgba(0,212,255,0.3)" : "rgba(248,81,73,0.3)"}
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}
