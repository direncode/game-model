"use client";

// OverlayToggles — toggle panel for advanced analytics overlays.
// Only visible to technical staff. Hidden for manager role.

import { useDuncStore } from "@/lib/dunc/store";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface OverlayDef {
  key: string;
  label: string;
  hint: string;
}

const DEFENSIVE: OverlayDef[] = [
  { key: "cover_shadows", label: "Cover Shadows", hint: "Interception cones behind defenders" },
  { key: "pressing_traps", label: "Pressing Traps", hint: "Defensive compression clusters" },
  { key: "block_lines", label: "Block Lines", hint: "Back 4 + midfield shape lines" },
  { key: "territorial", label: "Territorial Control", hint: "Pitch zone dominance heatmap" },
];

const ATTACKING: OverlayDef[] = [
  { key: "passing_lanes", label: "Passing Lanes", hint: "Available passes from carrier" },
  { key: "half_spaces", label: "Half-Spaces", hint: "5-corridor zone occupancy" },
  { key: "danger_zones", label: "xG Zones", hint: "Shot danger areas near goal" },
  { key: "fatigue", label: "Fatigue Overlay", hint: "Player load visualization" },
];

const SPATIAL: OverlayDef[] = [
  { key: "voronoi", label: "Voronoi", hint: "Territorial control tessellation" },
  { key: "trajectories", label: "Trajectories", hint: "Recent movement trails" },
];

export function OverlayToggles() {
  const role = useDuncStore((s) => s.role);
  const overlays = useDuncStore((s) => s.overlays);
  const toggle = useDuncStore((s) => s.toggleOverlay);
  const [expanded, setExpanded] = useState(true);

  if (role !== "technical_staff") return null;

  const activeCount = overlays.size;

  return (
    <div className="border border-li-purple/30 bg-li-purple/5 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-li-purple/10 transition-colors focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Eye className="w-3 h-3 text-li-purple" />
          <span className="text-[9px] uppercase tracking-widest text-li-purple font-mono font-bold">
            Analytics Overlays
          </span>
          {activeCount > 0 && (
            <span className="text-[9px] font-mono bg-li-purple/20 text-li-purple px-1.5 py-0.5 rounded-sm">
              {activeCount} on
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-li-text-muted" />
        ) : (
          <ChevronDown className="w-3 h-3 text-li-text-muted" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-2">
          <OverlayGroup label="Defensive Analysis" items={DEFENSIVE} overlays={overlays} toggle={toggle} />
          <OverlayGroup label="Attacking Analysis" items={ATTACKING} overlays={overlays} toggle={toggle} />
          <OverlayGroup label="Spatial Analysis" items={SPATIAL} overlays={overlays} toggle={toggle} />
        </div>
      )}
    </div>
  );
}

function OverlayGroup({
  label,
  items,
  overlays,
  toggle,
}: {
  label: string;
  items: OverlayDef[];
  overlays: Set<string>;
  toggle: (key: string) => void;
}) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-widest text-li-text-muted font-mono mb-1">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {items.map((item) => {
          const on = overlays.has(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggle(item.key)}
              title={item.hint}
              role="switch"
              aria-checked={on}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-sm text-[10px] font-mono transition-all text-left",
                "border",
                "focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black",
                on
                  ? "bg-li-purple/15 border-li-purple/40 text-li-purple"
                  : "bg-li-black-elevated border-li-border text-li-text-muted hover:text-li-white hover:border-li-purple/30",
              )}
            >
              {on ? (
                <Eye className="w-2.5 h-2.5 shrink-0" />
              ) : (
                <EyeOff className="w-2.5 h-2.5 shrink-0 opacity-40" />
              )}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
