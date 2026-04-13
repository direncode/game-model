"use client";

import { useDuncStore } from "@/lib/dunc/store";

/** Minimum distance from a point to a line segment */
function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function PassingLanes() {
  const players = useDuncStore((s) => s.players);
  const ball = useDuncStore((s) => s.ball);

  if (!ball || players.length === 0) return <g />;

  // Determine ball carrier
  let minDist = Infinity;
  let carrierId = "";
  let carrierTeam: "home" | "away" = "home";
  for (const p of players) {
    const d = Math.hypot(p.x - ball.x, p.y - ball.y);
    if (d < minDist) {
      minDist = d;
      carrierId = p.id;
      carrierTeam = p.team;
    }
  }

  const teammates = players.filter(
    (p) => p.team === carrierTeam && p.id !== carrierId,
  );
  const opponents = players.filter((p) => p.team !== carrierTeam);

  return (
    <g className="passing-lanes">
      {teammates.map((t) => {
        const dist = Math.hypot(t.x - ball.x, t.y - ball.y);

        let color = "#22c55e"; // green
        if (dist > 25) color = "#ef4444"; // red
        else if (dist > 15) color = "#eab308"; // yellow

        // Check if any opponent is within 3m of the line
        const blocked = opponents.some(
          (o) =>
            pointToSegmentDist(o.x, o.y, ball.x, ball.y, t.x, t.y) < 3,
        );

        return (
          <line
            key={t.id}
            x1={ball.x}
            y1={ball.y}
            x2={t.x}
            y2={t.y}
            stroke={color}
            strokeWidth={0.3}
            opacity={0.6}
            strokeDasharray={blocked ? "1 1" : undefined}
          />
        );
      })}
    </g>
  );
}
