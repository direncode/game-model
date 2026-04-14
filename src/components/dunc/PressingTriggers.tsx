"use client";

// PressingTriggers — tactical scenario controls with descriptions,
// hold-state visual, and per-scenario configuration panel.

import { useState } from "react";
import { duncApi } from "@/lib/dunc/api";
import { useDuncStore } from "@/lib/dunc/store";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Settings2, Zap } from "lucide-react";

type TriggerDef = {
  key: string;
  label: string;
  description: string;
  group: "pressing" | "block" | "marking" | "line";
  config: ConfigField[];
};

type ConfigField = {
  key: string;
  label: string;
  type: "range" | "select";
  min?: number;
  max?: number;
  step?: number;
  default: number | string;
  options?: { label: string; value: string }[];
};

const TRIGGERS: TriggerDef[] = [
  {
    key: "high_press", label: "High press", group: "pressing",
    description: "Entire outfield surges 30m forward. Aggressive press on the ball carrier — high risk, high reward.",
    config: [
      { key: "intensity", label: "Intensity", type: "range", min: 50, max: 100, step: 5, default: 85 },
      { key: "duration", label: "Duration (s)", type: "range", min: 4, max: 15, step: 1, default: 10 },
    ],
  },
  {
    key: "counter_press", label: "Counter-press", group: "pressing",
    description: "Immediate press on loss of possession. 5-second window to win the ball back before resetting.",
    config: [
      { key: "intensity", label: "Intensity", type: "range", min: 60, max: 100, step: 5, default: 90 },
    ],
  },
  {
    key: "trap_sideline", label: "Sideline trap", group: "pressing",
    description: "Funnel the opposition toward the touchline. Wide players narrow, forcing the carrier into a dead zone.",
    config: [
      { key: "side", label: "Side", type: "select", default: "left", options: [{ label: "Left", value: "left" }, { label: "Right", value: "right" }] },
    ],
  },
  {
    key: "trap_corner", label: "Corner trap", group: "pressing",
    description: "Collapse the entire block toward the nearest corner flag. Extreme pressure in a small area.",
    config: [],
  },
  {
    key: "mid_block", label: "Mid block", group: "block",
    description: "Compact shape around the halfway line. Deny space between the lines. Controlled and disciplined.",
    config: [
      { key: "line_height", label: "Line height (m)", type: "range", min: 35, max: 55, step: 1, default: 45 },
    ],
  },
  {
    key: "low_block", label: "Low block", group: "block",
    description: "Deep defensive block behind the ball. Invite pressure, protect the box, spring on the counter.",
    config: [
      { key: "compactness", label: "Compactness", type: "range", min: 50, max: 100, step: 5, default: 80 },
    ],
  },
  {
    key: "man_mark", label: "Man mark", group: "marking",
    description: "Each home outfielder shadows the nearest opponent. High energy cost but eliminates passing lanes.",
    config: [],
  },
  {
    key: "zonal", label: "Zonal reset", group: "marking",
    description: "Return to base formation. Clear all tactical overrides and hold zonal defensive shape.",
    config: [],
  },
  {
    key: "drop_deep", label: "Drop deep", group: "line",
    description: "Defensive line drops 15m. Creates space between midfield and attack — absorb and counter.",
    config: [
      { key: "depth", label: "Drop (m)", type: "range", min: 5, max: 25, step: 1, default: 15 },
    ],
  },
  {
    key: "hold_line", label: "Hold line", group: "line",
    description: "Back four compresses to a flat line at the same x-coordinate. Offside trap ready.",
    config: [],
  },
  {
    key: "step_up", label: "Step up", group: "line",
    description: "Defensive line pushes 12m up the pitch. Squeeze the opposition into a narrower band.",
    config: [
      { key: "distance", label: "Step (m)", type: "range", min: 5, max: 20, step: 1, default: 12 },
    ],
  },
];

const GROUP_LABELS: Record<string, { label: string; color: string }> = {
  pressing: { label: "Pressing", color: "text-li-red" },
  block: { label: "Block", color: "text-li-yellow" },
  marking: { label: "Marking", color: "text-li-purple" },
  line: { label: "Line", color: "text-li-green" },
};

export function PressingTriggers({ matchId }: { matchId: string }) {
  const activeScenarios = useDuncStore((s) => s.activeScenarios);
  const activeNames = new Set(activeScenarios.map((s) => s.name));

  const [expanded, setExpanded] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, Record<string, number | string>>>({});

  async function fire(key: string) {
    try {
      await duncApi.trigger(matchId, key as any);
    } catch (e) {
      console.error("dunc: trigger failed", e);
    }
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  function getConfigVal(triggerKey: string, fieldKey: string, defaultVal: number | string) {
    return configValues[triggerKey]?.[fieldKey] ?? defaultVal;
  }

  function setConfigVal(triggerKey: string, fieldKey: string, val: number | string) {
    setConfigValues((prev) => ({
      ...prev,
      [triggerKey]: { ...(prev[triggerKey] || {}), [fieldKey]: val },
    }));
  }

  const groups = ["pressing", "block", "marking", "line"] as const;

  return (
    <div className="border border-li-border bg-li-black-surface rounded-md">
      <div className="flex items-center justify-between px-3 py-2 border-b border-li-border">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            Tactical triggers
          </div>
          <div className="text-sm font-display text-li-white leading-none mt-0.5">
            Manager console
          </div>
        </div>
        {activeScenarios.length > 0 && (
          <span className="text-[10px] font-mono text-li-cyan animate-pulse motion-reduce:animate-none">
            {activeScenarios.length} active
          </span>
        )}
      </div>

      <div className="divide-y divide-li-border">
        {groups.map((g) => {
          const gInfo = GROUP_LABELS[g];
          const triggers = TRIGGERS.filter((t) => t.group === g);
          return (
            <div key={g} className="px-3 py-2">
              <div className={cn("text-[9px] uppercase tracking-widest font-mono mb-1.5", gInfo.color)}>
                {gInfo.label}
              </div>
              <div className="space-y-1" role="group" aria-label={`${gInfo.label} triggers`}>
                {triggers.map((t) => {
                  const isActive = activeNames.has(t.key);
                  const isExpanded = expanded === t.key;
                  const activeSc = activeScenarios.find((s) => s.name === t.key);

                  return (
                    <div key={t.key}>
                      {/* Trigger row */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => fire(t.key)}
                          className={cn(
                            "flex-1 flex items-center justify-between px-2.5 py-1.5 text-left rounded-sm transition-all",
                            "border",
                            "focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black",
                            isActive
                              ? "bg-li-cyan/15 border-li-cyan/40 text-li-cyan"
                              : "bg-li-black-elevated border-li-border text-li-text-secondary hover:border-li-cyan/40 hover:text-li-white",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-li-cyan animate-pulse motion-reduce:animate-none" />
                            )}
                            <span className="text-[11px] font-mono uppercase tracking-wider">
                              {t.label}
                            </span>
                          </div>
                          {isActive && activeSc && (
                            <span className="text-[9px] font-mono tabular-nums text-li-cyan/70">
                              {activeSc.remaining_sec.toFixed(0)}s · {activeSc.affected_count}p
                            </span>
                          )}
                        </button>
                        {t.config.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(t.key)}
                            aria-label={`Configure ${t.label}`}
                            className={cn(
                              "p-1.5 rounded-sm border transition-colors",
                              "focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black",
                              isExpanded
                                ? "border-li-cyan/40 text-li-cyan bg-li-cyan/10"
                                : "border-li-border text-li-text-muted hover:text-li-white",
                            )}
                          >
                            <Settings2 className="w-3 h-3" />
                            <span className="sr-only">Settings</span>
                          </button>
                        )}
                      </div>

                      {/* Description — always visible */}
                      <div className="text-[10px] text-li-text-muted leading-snug mt-0.5 ml-0.5">
                        {t.description}
                      </div>

                      {/* Config panel */}
                      {isExpanded && t.config.length > 0 && (
                        <div className="mt-1.5 ml-0.5 p-2 bg-li-black-elevated border border-li-border rounded-sm space-y-2">
                          <div className="text-[9px] uppercase tracking-widest text-li-cyan font-mono">
                            Configuration
                          </div>
                          {t.config.map((field) => (
                            <div key={field.key}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] text-li-text-secondary">
                                  {field.label}
                                </span>
                                <span className="text-[10px] font-mono text-li-white tabular-nums">
                                  {getConfigVal(t.key, field.key, field.default)}
                                  {field.type === "range" ? (field.key.includes("duration") || field.key.includes("depth") || field.key.includes("distance") || field.key.includes("height") ? "m" : "%") : ""}
                                </span>
                              </div>
                              {field.type === "range" && (
                                <input
                                  type="range"
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  value={getConfigVal(t.key, field.key, field.default) as number}
                                  onChange={(e) => setConfigVal(t.key, field.key, Number(e.target.value))}
                                  className="w-full h-1 bg-li-gray-900 rounded-full appearance-none cursor-pointer accent-li-cyan"
                                />
                              )}
                              {field.type === "select" && field.options && (
                                <select
                                  value={getConfigVal(t.key, field.key, field.default) as string}
                                  onChange={(e) => setConfigVal(t.key, field.key, e.target.value)}
                                  className="w-full bg-li-black-surface border border-li-border rounded-sm px-2 py-1 text-[10px] font-mono text-li-white"
                                >
                                  {field.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => fire(t.key)}
                            className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider bg-li-cyan text-li-black rounded-sm hover:bg-li-cyan/90 focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black"
                          >
                            <Zap className="w-3 h-3" />
                            Apply {t.label}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
