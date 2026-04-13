"use client";

import { useDuncStore } from "@/lib/dunc/store";

export function CoverShadows() {
  const players = useDuncStore((s) => s.players);
  const ball = useDuncStore((s) => s.ball);
  const matchInfo = useDuncStore((s) => s.matchInfo);

  if (!ball || players.length === 0) return <g />;

  // Determine ball carrier: nearest player to the ball
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
  const teamColor =
    carrierTeam === "home"
      ? matchInfo?.away_color ?? "#3b82f6"
      : matchInfo?.home_color ?? "#ef4444";

  const CONE_ANGLE_DEG = 40;
  const CONE_HALF_RAD = ((CONE_ANGLE_DEG / 2) * Math.PI) / 180;
  const BASE_LENGTH = 8;

  return (
    <g className="cover-shadows">
      {defenders.map((p) => {
        // Direction away from ball
        const dx = p.x - ball.x;
        const dy = p.y - ball.y;
        const angle = Math.atan2(dy, dx);

        // Scale length by fatigue (0 = fresh = full length, 1 = tired = short)
        const length = BASE_LENGTH * (1 - p.fatigue * 0.6);

        const x1 = p.x + Math.cos(angle - CONE_HALF_RAD) * length;
        const y1 = p.y + Math.sin(angle - CONE_HALF_RAD) * length;
        const x2 = p.x + Math.cos(angle + CONE_HALF_RAD) * length;
        const y2 = p.y + Math.sin(angle + CONE_HALF_RAD) * length;

        const points = `${p.x},${p.y} ${x1},${y1} ${x2},${y2}`;

        return (
          <polygon
            key={p.id}
            points={points}
            fill={teamColor}
            opacity={0.15}
          />
        );
      })}
    </g>
  );
}
