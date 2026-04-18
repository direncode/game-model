"use client";

import type { DuncPlayerTick, DuncBallTick } from "@/lib/dunc/types";
import { PITCH_X, PITCH_Y } from "@/lib/dunc/types";

interface Props {
  players: DuncPlayerTick[];
  ball: DuncBallTick;
  width?: number;
  height?: number;
}

export function RadarMiniMap({ players, ball, width = 200, height = 130 }: Props) {
  const scaleX = (v: number) => 4 + (v / PITCH_X) * (width - 8);
  const scaleY = (v: number) => 4 + (v / PITCH_Y) * (height - 8);

  return (
    <div
      className="border border-white/10 rounded bg-black/80 backdrop-blur-sm overflow-hidden"
      style={{ width, height }}
    >
      <svg width={width} height={height}>
        {/* Pitch outline */}
        <rect x={4} y={4} width={width - 8} height={height - 8} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
        <line x1={width / 2} y1={4} x2={width / 2} y2={height - 4} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
        <circle cx={width / 2} cy={height / 2} r={12} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />

        {/* Players */}
        {players.map((p) => (
          <circle
            key={p.id}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r={2.5}
            fill={p.team === "home" ? "#00d4ff" : "#f85149"}
            opacity={0.9}
          />
        ))}

        {/* Ball */}
        <circle cx={scaleX(ball.x)} cy={scaleY(ball.y)} r={3} fill="#ffffff" />
      </svg>
    </div>
  );
}
