"use client";

import { useDuncStore } from "@/lib/dunc/store";

/** Interpolate green -> yellow -> red based on fatigue 0..1 */
function fatigueColor(fatigue: number): string {
  const t = Math.max(0, Math.min(1, fatigue));
  if (t < 0.5) {
    // green to yellow
    const r = Math.round(255 * (t * 2));
    return `rgb(${r},200,50)`;
  }
  // yellow to red
  const g = Math.round(200 * (1 - (t - 0.5) * 2));
  return `rgb(255,${g},50)`;
}

export function FatigueOverlay() {
  const players = useDuncStore((s) => s.players);

  return (
    <g className="fatigue-overlay">
      {players.map((p) => {
        const r = 0.5 + p.fatigue * 2;
        return (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={r}
            fill={fatigueColor(p.fatigue)}
            opacity={0.25}
          />
        );
      })}
    </g>
  );
}
