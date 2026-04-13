"use client";

import { PITCH_X, PITCH_Y } from "@/lib/dunc/types";

// Penalty area dimensions (standard): 16.5m deep x 40.3m wide, centered
const PA_WIDTH = 40.3;
const PA_DEPTH = 16.5;
const PA_Y = (PITCH_Y - PA_WIDTH) / 2;

export function DangerZones() {
  return (
    <g className="danger-zones">
      <defs>
        {/* Left goal (x=0) — gradient fades from goal center outward */}
        <linearGradient id="danger-grad-left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
        </linearGradient>
        {/* Right goal (x=105) — gradient fades from goal center outward */}
        <linearGradient id="danger-grad-right" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
        </linearGradient>
      </defs>

      {/* Left penalty area */}
      <rect
        x={0}
        y={PA_Y}
        width={PA_DEPTH}
        height={PA_WIDTH}
        fill="url(#danger-grad-left)"
      />

      {/* Right penalty area */}
      <rect
        x={PITCH_X - PA_DEPTH}
        y={PA_Y}
        width={PA_DEPTH}
        height={PA_WIDTH}
        fill="url(#danger-grad-right)"
      />
    </g>
  );
}
