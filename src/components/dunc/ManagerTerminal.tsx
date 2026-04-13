"use client";

// ManagerTerminal — direct command interface for the manager.
//
// Scenario 3: "The manager wants to give simple instructions and get the
// entire technical staff aligned on a shift to a different pressing model."
//
// The manager picks a game model preset or types a free-text instruction.
// It gets broadcast to all technical staff screens via the backchannel,
// fires the corresponding scenario trigger on the backend, and highlights
// the relevant configurations the staff need to monitor.

import { useState } from "react";
import { duncApi } from "@/lib/dunc/api";
import { useDuncStore } from "@/lib/dunc/store";
import { useBackchannel } from "@/components/dunc/Backchannel";
import { cn } from "@/lib/utils";
import { Send, Terminal, ChevronDown, Zap, Radio } from "lucide-react";

// ── Game model presets — simple instructions that map to full configurations ──
interface GameModelPreset {
  id: string;
  label: string;
  instruction: string;           // what the manager says
  scenario: string;              // backend trigger key
  description: string;           // what it means tactically
  configurations: string[];      // what the staff should monitor
  highlighted: boolean;          // true = this addresses scenario 3
}

const GAME_MODELS: GameModelPreset[] = [
  {
    id: "high_press",
    label: "High Press",
    instruction: "Press high immediately — win the ball back in their half",
    scenario: "high_press",
    description: "Entire outfield surges forward 30m. Aggressive press on the carrier. 5-second recovery window.",
    configurations: [
      "Defensive line height → 70m+ (very high)",
      "Press trigger → goalkeeper possession",
      "Recovery mode → off (full commit)",
      "Compactness → tight (25m between lines)",
      "Width → narrow (funnel centrally)",
    ],
    highlighted: true,
  },
  {
    id: "mid_block_counter",
    label: "Mid Block → Counter",
    instruction: "Drop into mid-block and hit them on the break",
    scenario: "mid_block",
    description: "Compact shape around halfway. Deny space between lines. Spring the counter when we win it.",
    configurations: [
      "Defensive line height → 45m (halfway)",
      "Inter-line distance → 30m (compact)",
      "Counter-attack trigger → on turnover",
      "Wide players → stay wide for outlet",
      "Striker → hold high, stretch their line",
    ],
    highlighted: true,
  },
  {
    id: "low_block_absorb",
    label: "Low Block & Absorb",
    instruction: "Everyone behind the ball — protect the lead",
    scenario: "low_block",
    description: "Deep defensive block. 10 men behind the ball. Clear everything. Counter only when the break is on.",
    configurations: [
      "Defensive line height → 25m (deep)",
      "All outfielders → behind ball line",
      "Clearance priority → zones not players",
      "Counter mode → only on 3v2 or better",
      "GK distribution → long to target man",
    ],
    highlighted: true,
  },
  {
    id: "gegenpress",
    label: "Gegenpressing",
    instruction: "Counter-press the second we lose it — 5 seconds max",
    scenario: "counter_press",
    description: "Immediate swarm on loss of possession. All nearby players press the ball. 5-second rule — if we don't win it back, reset.",
    configurations: [
      "Press trigger → immediate on loss",
      "Press duration → 5 seconds max",
      "Nearby radius → 10m swarm zone",
      "Fallback → drop to mid-block after 5s",
      "Energy cost → high (monitor fatigue)",
    ],
    highlighted: false,
  },
  {
    id: "hold_shape",
    label: "Hold Shape (Zonal)",
    instruction: "Reset to formation — hold your positions",
    scenario: "zonal",
    description: "Return to base formation. Clear all tactical overrides. Disciplined zonal structure.",
    configurations: [
      "All overrides → cleared",
      "Formation → base 4-3-3",
      "Pressing → passive (react only)",
      "Width → standard",
      "Transition → controlled",
    ],
    highlighted: false,
  },
  {
    id: "trap_sideline",
    label: "Sideline Trap",
    instruction: "Force them to the touchline — double up wide",
    scenario: "trap_sideline",
    description: "Funnel the carrier toward the touchline. The line acts as an extra defender. Double up and win it.",
    configurations: [
      "Wide midfielders → narrow to create funnel",
      "Full-back → hold touchline position",
      "CM → shift to ball-side",
      "Trap zone → within 15m of touchline",
      "Press trigger → when carrier faces sideline",
    ],
    highlighted: false,
  },
];

// ── Quick instructions (free text shortcuts) ──
const QUICK_INSTRUCTIONS = [
  "Push up — we need a goal",
  "Slow it down — keep possession",
  "Target their left side — it's weak",
  "Drop 10 yards deeper",
  "Switch to man marking on #10",
  "Go direct — bypass their press",
];

export function ManagerTerminal({ matchId }: { matchId: string }) {
  const role = useDuncStore((s) => s.role);
  const clockSec = useDuncStore((s) => s.clockSec);
  const send = useBackchannel((s) => s.send);
  const [input, setInput] = useState("");
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(false);

  // Show full terminal for manager, read-only view for staff
  const isManager = role === "manager";

  async function issueInstruction(preset: GameModelPreset) {
    // 1. Fire the backend trigger
    try {
      await duncApi.trigger(matchId, preset.scenario as any);
    } catch (e) {
      console.error("trigger failed", e);
    }

    // 2. Broadcast to all staff via backchannel
    const configText = preset.configurations.join(" | ");
    send({
      from: "manager",
      text: `⚡ GAME MODEL SHIFT: ${preset.label.toUpperCase()} — "${preset.instruction}" — Config: ${configText}`,
      timestamp: clockSec,
    });

    setLastSent(preset.id);
    setTimeout(() => setLastSent(null), 3000);
  }

  async function sendFreeText(text: string) {
    if (!text.trim()) return;
    send({
      from: "manager",
      text: `📢 Manager instruction: "${text.trim()}"`,
      timestamp: clockSec,
    });
    setInput("");
  }

  return (
    <div className="border border-li-cyan/30 bg-li-black-surface rounded-md overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-li-cyan/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-li-cyan" />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono font-bold">
              Manager Terminal
            </div>
            <div className="text-[9px] text-li-text-muted font-mono">
              Issue instructions → align all staff
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-li-green animate-pulse" />
          <span className="text-[9px] font-mono text-li-green">LIVE</span>
        </div>
      </div>

      {/* Game model presets */}
      <div className="p-2 space-y-1">
        <div className="text-[8px] uppercase tracking-widest text-li-text-muted font-mono px-1 mb-1">
          {isManager ? "Game model presets — tap to issue" : "Manager game model — read only"}
        </div>
        {GAME_MODELS.map((model) => (
          <div key={model.id}>
            <button
              type="button"
              onClick={() => isManager ? issueInstruction(model) : setExpandedModel(expandedModel === model.id ? null : model.id)}
              disabled={!isManager && false}
              className={cn(
                "w-full text-left px-2.5 py-2 rounded-sm transition-all border",
                model.highlighted
                  ? "border-li-cyan/30 bg-li-cyan/5 hover:bg-li-cyan/10"
                  : "border-li-border bg-li-black-elevated hover:border-li-cyan/30",
                lastSent === model.id && "ring-1 ring-li-cyan bg-li-cyan/15",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {model.highlighted && (
                    <Zap className="w-3 h-3 text-li-cyan shrink-0" />
                  )}
                  <span className="text-[11px] font-mono font-bold text-li-white">
                    {model.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedModel(expandedModel === model.id ? null : model.id);
                  }}
                  className="text-li-text-muted hover:text-li-white"
                >
                  <ChevronDown className={cn(
                    "w-3 h-3 transition-transform",
                    expandedModel === model.id && "rotate-180"
                  )} />
                </button>
              </div>
              <div className="text-[10px] text-li-text-secondary mt-0.5 italic">
                &ldquo;{model.instruction}&rdquo;
              </div>
              {lastSent === model.id && (
                <div className="text-[9px] text-li-cyan font-mono mt-1 animate-pulse">
                  ✓ Sent to all staff
                </div>
              )}
            </button>

            {/* Expanded configuration details */}
            {expandedModel === model.id && (
              <div className="ml-2 mt-1 p-2 bg-li-black-elevated border border-li-border rounded-sm">
                <div className="text-[10px] text-li-text-secondary mb-1.5">
                  {model.description}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-li-cyan font-mono mb-1">
                  Staff configurations
                </div>
                <ul className="space-y-0.5">
                  {model.configurations.map((cfg, i) => (
                    <li key={i} className="text-[10px] font-mono text-li-white flex items-start gap-1.5">
                      <span className="text-li-cyan shrink-0">→</span>
                      {cfg}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick instructions — manager only */}
      {isManager && <div className="border-t border-li-border px-2 py-1.5">
        <button
          type="button"
          onClick={() => setShowQuick(!showQuick)}
          className="text-[9px] uppercase tracking-widest text-li-text-muted font-mono hover:text-li-white"
        >
          Quick instructions {showQuick ? "▲" : "▼"}
        </button>
        {showQuick && (
          <div className="mt-1 space-y-0.5">
            {QUICK_INSTRUCTIONS.map((qi) => (
              <button
                key={qi}
                type="button"
                onClick={() => sendFreeText(qi)}
                className="block w-full text-left text-[10px] text-li-text-secondary hover:text-li-cyan py-0.5 px-1 rounded-sm hover:bg-li-cyan/5"
              >
                &ldquo;{qi}&rdquo;
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Free text — manager only */}
      {isManager && <form
        onSubmit={(e) => {
          e.preventDefault();
          sendFreeText(input);
        }}
        className="border-t border-li-border px-2 py-1.5 flex gap-1.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type instruction to staff…"
          className="flex-1 bg-li-black-elevated border border-li-border rounded-sm px-2 py-1 text-[11px] text-li-white placeholder:text-li-text-muted focus:outline-none focus:border-li-cyan"
        />
        <button
          type="submit"
          className="px-2 py-1 bg-li-cyan text-li-black rounded-sm hover:bg-li-cyan/90"
        >
          <Send className="w-3 h-3" />
        </button>
      </form>}
    </div>
  );
}
