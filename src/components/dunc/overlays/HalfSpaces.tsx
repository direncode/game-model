"use client";

import { useDuncStore } from "@/lib/dunc/store";
import { PITCH_X, PITCH_Y } from "@/lib/dunc/types";

const ZONES = [
  { label: "L Flank", y0: 0, y1: 13.6 },
  { label: "L Half", y0: 13.6, y1: 27.2 },
  { label: "Central", y0: 27.2, y1: 40.8 },
  { label: "R Half", y0: 40.8, y1: 54.4 },
  { label: "R Flank", y0: 54.4, y1: PITCH_Y },
];

const FILLS = ["#6366f1", "#818cf8", "#6366f1", "#818cf8", "#6366f1"];

export function HalfSpaces() {
  const players = useDuncStore((s) => s.players);

  // Count players per zone per team
  const counts = ZONES.map((z) => {
    let home = 0;
    let away = 0;
    for (const p of players) {
      if (p.y >= z.y0 && p.y < z.y1) {
        if (p.team === "home") home++;
        else away++;
      }
    }
    return { home, away };
  });

  return (
    <g className="half-spaces">
      {ZONES.map((z, i) => (
        <g key={z.label}>
          <rect
            x={0}
            y={z.y0}
            width={PITCH_X}
            height={z.y1 - z.y0}
            fill={FILLS[i]}
            opacity={0.07}
          />
          <text
            x={2}
            y={z.y0 + 2.5}
            fontSize={2}
            fill="#fff"
            opacity={0.7}
          >
            {z.label} H:{counts[i].home} A:{counts[i].away}
          </text>
        </g>
      ))}
    </g>
  );
}
