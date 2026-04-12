"use client";

// PitchView — SVG top-down 105×68 football pitch with live digital twins.
//
// Design choices:
// - Pure SVG (not Three.js) for instant loads and zero dependencies. Three.js
//   is already in package.json but buying 800kb for a top-down pitch is wasteful.
// - Uses a fixed viewBox so the pitch scales smoothly with container size.
// - Home team is cyan, away team is warm/amber. Both from the existing li-*
//   palette so the vertical visually belongs to Latent Ocean.
// - Fatigue is shown as a thin ring around the dot that turns warm → red as
//   the player approaches match-end load.

import { useDuncStore } from "@/lib/dunc/store";
import { PITCH_X, PITCH_Y, type DuncPlayerTick } from "@/lib/dunc/types";
import { cn } from "@/lib/utils";

const TEAM_COLORS = {
  home: "#00d4ff", // li-cyan
  away: "#c9a96e", // li-warm
};

function fatigueColor(f: number): string {
  // 0 (fresh) → green, 0.5 → yellow, 1 → red.
  if (f < 0.33) return "#3fb950";
  if (f < 0.66) return "#d29922";
  return "#f85149";
}

export function PitchView({
  highlightedIds = [],
  selectedRoleFilter,
  compact = false,
}: {
  highlightedIds?: string[];
  selectedRoleFilter?: string[];
  compact?: boolean;
}) {
  const ball = useDuncStore((s) => s.ball);
  const players = useDuncStore((s) => s.players);

  const hilite = new Set(highlightedIds);
  const roleSet = selectedRoleFilter ? new Set(selectedRoleFilter) : null;

  return (
    <div className={cn("relative w-full", compact ? "aspect-[105/68]" : "aspect-[105/68]")}>
      <svg
        viewBox={`-2 -2 ${PITCH_X + 4} ${PITCH_Y + 4}`}
        className="w-full h-full"
        role="img"
        aria-label="Live tactical pitch view"
      >
        {/* Pitch background */}
        <defs>
          <linearGradient id="dunc-pitch-bg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0a1f14" />
            <stop offset="100%" stopColor="#05140c" />
          </linearGradient>
          <pattern id="dunc-stripes" width="14" height="1" patternUnits="userSpaceOnUse">
            <rect width="7" height="1" fill="#0a1f14" />
            <rect x="7" width="7" height="1" fill="#081a10" />
          </pattern>
        </defs>
        <rect
          x={0}
          y={0}
          width={PITCH_X}
          height={PITCH_Y}
          fill="url(#dunc-pitch-bg)"
        />
        <rect
          x={0}
          y={0}
          width={PITCH_X}
          height={PITCH_Y}
          fill="url(#dunc-stripes)"
          opacity={0.35}
        />

        {/* Pitch markings */}
        <g stroke="#2b5e49" strokeWidth={0.25} fill="none">
          <rect x={0} y={0} width={PITCH_X} height={PITCH_Y} />
          <line x1={PITCH_X / 2} y1={0} x2={PITCH_X / 2} y2={PITCH_Y} />
          <circle cx={PITCH_X / 2} cy={PITCH_Y / 2} r={9.15} />
          <circle cx={PITCH_X / 2} cy={PITCH_Y / 2} r={0.3} fill="#2b5e49" />
          {/* Penalty areas */}
          <rect x={0} y={13.84} width={16.5} height={40.32} />
          <rect x={PITCH_X - 16.5} y={13.84} width={16.5} height={40.32} />
          {/* 6-yard */}
          <rect x={0} y={24.84} width={5.5} height={18.32} />
          <rect x={PITCH_X - 5.5} y={24.84} width={5.5} height={18.32} />
          {/* Goals */}
          <rect x={-0.5} y={30.34} width={0.5} height={7.32} stroke="#3fb950" />
          <rect x={PITCH_X} y={30.34} width={0.5} height={7.32} stroke="#3fb950" />
        </g>

        {/* Players */}
        <g>
          {players.map((p) => {
            const visible = !roleSet || roleSet.has(p.role);
            if (!visible) return null;
            return (
              <PlayerDot
                key={p.id}
                p={p}
                highlighted={hilite.has(p.id)}
                compact={compact}
              />
            );
          })}
        </g>

        {/* Ball */}
        {ball && (
          <g>
            <circle
              cx={ball.x}
              cy={ball.y}
              r={1.0}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth={0.15}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function PlayerDot({
  p,
  highlighted,
  compact,
}: {
  p: DuncPlayerTick;
  highlighted: boolean;
  compact: boolean;
}) {
  const r = highlighted ? 2.6 : 2.1;
  const team = TEAM_COLORS[p.team];
  const fc = fatigueColor(p.fatigue);

  return (
    <g>
      {/* Fatigue ring */}
      <circle
        cx={p.x}
        cy={p.y}
        r={r + 0.55}
        fill="none"
        stroke={fc}
        strokeWidth={0.4}
        opacity={0.85}
      />
      {/* Body */}
      <circle
        cx={p.x}
        cy={p.y}
        r={r}
        fill={team}
        stroke={highlighted ? "#ffffff" : "#000000"}
        strokeWidth={highlighted ? 0.5 : 0.2}
      />
      {/* Shirt number */}
      {!compact && (
        <text
          x={p.x}
          y={p.y + 0.6}
          textAnchor="middle"
          fontSize={2}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
          fill="#000000"
        >
          {p.number}
        </text>
      )}
      {/* Velocity tick */}
      <line
        x1={p.x}
        y1={p.y}
        x2={p.x + p.vx * 0.35}
        y2={p.y + p.vy * 0.35}
        stroke={team}
        strokeWidth={0.35}
        opacity={0.7}
      />
    </g>
  );
}
