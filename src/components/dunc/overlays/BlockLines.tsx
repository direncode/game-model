"use client";

import { useDuncStore } from "@/lib/dunc/store";
import type { DuncPlayerTick } from "@/lib/dunc/types";

const BACK_FOUR = new Set(["LB", "LCB", "RCB", "RB"]);
const MID_THREE = new Set(["LCM", "CM", "RCM"]);

function sortedByY(group: DuncPlayerTick[]): string {
  return group
    .sort((a, b) => a.y - b.y)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
}

export function BlockLines() {
  const players = useDuncStore((s) => s.players);

  const homePlayers = players.filter((p) => p.team === "home");
  const awayPlayers = players.filter((p) => p.team === "away");

  const lines: {
    key: string;
    points: string;
    color: string;
    dashed: boolean;
  }[] = [];

  for (const [team, list, color] of [
    ["home", homePlayers, "#06b6d4"] as const, // cyan
    ["away", awayPlayers, "#f59e0b"] as const, // amber
  ]) {
    const back = list.filter((p) => BACK_FOUR.has(p.role));
    const mid = list.filter((p) => MID_THREE.has(p.role));

    if (back.length >= 2) {
      lines.push({
        key: `${team}-back`,
        points: sortedByY(back),
        color,
        dashed: false,
      });
    }
    if (mid.length >= 2) {
      lines.push({
        key: `${team}-mid`,
        points: sortedByY(mid),
        color,
        dashed: true,
      });
    }
  }

  return (
    <g className="block-lines">
      {lines.map((l) => (
        <polyline
          key={l.key}
          points={l.points}
          fill="none"
          stroke={l.color}
          strokeWidth={0.4}
          opacity={0.4}
          strokeDasharray={l.dashed ? "1.5 1" : undefined}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}
