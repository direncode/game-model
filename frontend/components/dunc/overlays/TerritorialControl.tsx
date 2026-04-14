"use client";

import { useDuncStore } from "@/lib/dunc/store";
import { PITCH_X, PITCH_Y } from "@/lib/dunc/types";

const COLS = 7;
const ROWS = 5;
const CELL_W = PITCH_X / COLS;
const CELL_H = PITCH_Y / ROWS;

export function TerritorialControl() {
  const players = useDuncStore((s) => s.players);
  const matchInfo = useDuncStore((s) => s.matchInfo);

  const homeColor = matchInfo?.home_color ?? "#3b82f6";
  const awayColor = matchInfo?.away_color ?? "#ef4444";

  // Build grid
  const cells: { x: number; y: number; color: string }[] = [];

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const cx = (col + 0.5) * CELL_W;
      const cy = (row + 0.5) * CELL_H;

      let homeCount = 0;
      let awayCount = 0;

      for (const p of players) {
        const dist = Math.hypot(p.x - cx, p.y - cy);
        // Weight by proximity — closer players count more
        const weight = Math.max(0, 1 - dist / 20);
        if (p.team === "home") homeCount += weight;
        else awayCount += weight;
      }

      const color = homeCount >= awayCount ? homeColor : awayColor;
      cells.push({ x: col * CELL_W, y: row * CELL_H, color });
    }
  }

  return (
    <g className="territorial-control">
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width={CELL_W}
          height={CELL_H}
          fill={c.color}
          opacity={0.08}
        />
      ))}
    </g>
  );
}
