"use client";

import { useDuncStore } from "@/lib/dunc/store";
import type { DuncPlayerTick } from "@/lib/dunc/types";

/** Simple clustering: find groups of 3+ defending players within 10m of each other */
function findClusters(defenders: DuncPlayerTick[]): DuncPlayerTick[][] {
  const visited = new Set<string>();
  const clusters: DuncPlayerTick[][] = [];

  for (const p of defenders) {
    if (visited.has(p.id)) continue;

    // BFS to find connected component within 10m
    const cluster: DuncPlayerTick[] = [p];
    const queue = [p];
    visited.add(p.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const other of defenders) {
        if (visited.has(other.id)) continue;
        if (Math.hypot(other.x - current.x, other.y - current.y) <= 10) {
          visited.add(other.id);
          cluster.push(other);
          queue.push(other);
        }
      }
    }

    if (cluster.length >= 3) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

export function PressingTraps() {
  const players = useDuncStore((s) => s.players);
  const ball = useDuncStore((s) => s.ball);

  if (!ball || players.length === 0) return <g />;

  // Determine ball carrier team
  let minDist = Infinity;
  let carrierTeam: "home" | "away" = "home";
  for (const p of players) {
    const d = Math.hypot(p.x - ball.x, p.y - ball.y);
    if (d < minDist) {
      minDist = d;
      carrierTeam = p.team;
    }
  }

  const defenders = players.filter((p) => p.team !== carrierTeam);
  const clusters = findClusters(defenders);

  return (
    <g className="pressing-traps">
      {clusters.map((cluster, i) => {
        const xs = cluster.map((p) => p.x);
        const ys = cluster.map((p) => p.y);
        const pad = 1.5;
        const minX = Math.min(...xs) - pad;
        const minY = Math.min(...ys) - pad;
        const maxX = Math.max(...xs) + pad;
        const maxY = Math.max(...ys) + pad;

        return (
          <rect
            key={i}
            x={minX}
            y={minY}
            width={maxX - minX}
            height={maxY - minY}
            fill="#f97316"
            opacity={0.2}
            stroke="#f97316"
            strokeWidth={0.3}
            strokeDasharray="1.5 1"
            rx={1}
          />
        );
      })}
    </g>
  );
}
