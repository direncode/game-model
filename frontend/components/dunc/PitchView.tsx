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

import { useMemo } from "react";
import { useDuncStore } from "@/lib/dunc/store";
import { PITCH_X, PITCH_Y, type DuncPlayerTick } from "@/lib/dunc/types";
import { cn } from "@/lib/utils";

// Overlay components — lazy-loaded only when toggled on
import { CoverShadows } from "@/components/dunc/overlays/CoverShadows";
import { HalfSpaces } from "@/components/dunc/overlays/HalfSpaces";
import { PassingLanes } from "@/components/dunc/overlays/PassingLanes";
import { PressingTraps } from "@/components/dunc/overlays/PressingTraps";
import { BlockLines } from "@/components/dunc/overlays/BlockLines";
import { DangerZones } from "@/components/dunc/overlays/DangerZones";
import { FatigueOverlay } from "@/components/dunc/overlays/FatigueOverlay";
import { TerritorialControl } from "@/components/dunc/overlays/TerritorialControl";

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
  const prevPlayers = useDuncStore((s) => s.prevPlayers);
  const activeScenarios = useDuncStore((s) => s.activeScenarios);
  const overlays = useDuncStore((s) => s.overlays);

  const hilite = new Set(highlightedIds);
  const roleSet = selectedRoleFilter ? new Set(selectedRoleFilter) : null;
  const hasActiveScenario = activeScenarios.length > 0;

  // Build set of affected player IDs across all active scenarios
  const affectedIds = useMemo(() => {
    const s = new Set<string>();
    for (const sc of activeScenarios) {
      for (const id of sc.affected_ids ?? []) s.add(id);
    }
    return s;
  }, [activeScenarios]);

  // Build a map of previous positions for ghost overlay
  const prevMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const p of prevPlayers) m.set(p.id, { x: p.x, y: p.y });
    return m;
  }, [prevPlayers]);

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
          <marker id="dunc-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4" fill="none" stroke="#00d4ff" strokeWidth="0.5" />
          </marker>
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

        {/* Analytics overlays — toggled by technical staff */}
        {overlays.has("territorial") && <TerritorialControl />}
        {overlays.has("half_spaces") && <HalfSpaces />}
        {overlays.has("danger_zones") && <DangerZones />}
        {overlays.has("fatigue") && <FatigueOverlay />}
        {overlays.has("block_lines") && <BlockLines />}
        {overlays.has("pressing_traps") && <PressingTraps />}
        {overlays.has("cover_shadows") && <CoverShadows />}
        {overlays.has("passing_lanes") && <PassingLanes />}

        {/* Ghost overlay — shows previous positions when a scenario is active */}
        {hasActiveScenario && (
          <g opacity={0.3}>
            {players.map((p) => {
              const prev = prevMap.get(p.id);
              if (!prev) return null;
              const dx = p.x - prev.x;
              const dy = p.y - prev.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 0.5) return null; // no meaningful movement
              const team = TEAM_COLORS[p.team];
              return (
                <g key={`ghost-${p.id}`}>
                  {/* Ghost dot at previous position */}
                  <circle cx={prev.x} cy={prev.y} r={1.4} fill={team} opacity={0.4} />
                  {/* Arrow from previous to current */}
                  <line
                    x1={prev.x}
                    y1={prev.y}
                    x2={p.x}
                    y2={p.y}
                    stroke={team}
                    strokeWidth={0.3}
                    strokeDasharray="1 0.5"
                    opacity={0.5}
                    markerEnd="url(#dunc-arrow)"
                  />
                </g>
              );
            })}
          </g>
        )}

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
                affected={affectedIds.has(p.id)}
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
  affected,
  compact,
}: {
  p: DuncPlayerTick;
  highlighted: boolean;
  affected: boolean;
  compact: boolean;
}) {
  const r = highlighted ? 2.6 : 2.1;
  const team = TEAM_COLORS[p.team];
  const fc = fatigueColor(p.fatigue);

  return (
    <g>
      {/* Scenario-affected outer glow — bright magenta/purple ring */}
      {affected && (
        <g className="motion-reduce:hidden">
          <circle
            cx={p.x}
            cy={p.y}
            r={r + 1.4}
            fill="none"
            stroke="#a371f7"
            strokeWidth={0.6}
            opacity={0.9}
          >
            <animate
              attributeName="r"
              values={`${r + 1.0};${r + 1.8};${r + 1.0}`}
              dur="1.2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9;0.4;0.9"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      )}
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
