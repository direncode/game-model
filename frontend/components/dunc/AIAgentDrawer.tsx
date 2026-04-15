"use client";

// AIAgentDrawer — collapsible side panel with a role-scoped assistant.
//
// Sends questions to POST /api/v1/dunc/agent/query and displays the reply.
// The assistant stub on the backend is LLM-free in v0, but the protocol
// is ready to plug a real model in.

import { useState } from "react";
import { duncApi } from "@/lib/dunc/api";
import { useDuncStore } from "@/lib/dunc/store";
import type { DuncActiveScenario, DuncAgentReply } from "@/lib/dunc/types";
import { cn } from "@/lib/utils";

interface ChatTurn {
  id: string;
  q: string;
  reply: DuncAgentReply | null;
  loading: boolean;
  error: string | null;
}

const SUGGESTED = [
  "Is the striker under-running?",
  "How should we beat their press?",
  "Whose legs are tired?",
  "Are we getting numbers in midfield?",
];

export function AIAgentDrawer({ matchId }: { matchId: string }) {
  const role = useDuncStore((s) => s.role);
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || !matchId) return;
    const id = `t${Date.now()}`;
    setTurns((prev) => [
      ...prev,
      { id, q: trimmed, reply: null, loading: true, error: null },
    ]);
    setInput("");
    try {
      const reply = await duncApi.agentQuery(matchId, role, trimmed);
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, reply, loading: false } : t)),
      );
    } catch (e) {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, loading: false, error: (e as Error).message }
            : t,
        ),
      );
    }
  }

  return (
    <div
      className={cn(
        "fixed right-0 top-0 bottom-0 z-30 flex flex-col bg-li-black-elevated border-l border-li-border transition-all",
        open ? "w-[340px]" : "w-12",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-12 flex items-center justify-center border-b border-li-border hover:bg-li-black-surface focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black"
        aria-label={open ? "Collapse AI agent" : "Expand AI agent"}
        aria-expanded={open}
      >
        <span className="font-mono text-[11px] uppercase tracking-widest text-li-cyan">
          {open ? "◢ D-U-N-C AI" : "AI"}
        </span>
      </button>

      {open && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-[12px]">
            <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
              Assistant — {role === "manager" ? "Manager view" : "Tech staff view"}
            </div>
            <CoreScenarioMonitor />
            <ActiveScenarioDetail />
            {turns.map((t) => (
              <div key={t.id} className="space-y-1">
                <div className="text-li-text-secondary">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-li-text-muted mr-1">
                    You
                  </span>
                  {t.q}
                </div>
                {t.loading && (
                  <div className="text-li-text-muted italic">thinking…</div>
                )}
                {t.error && <div className="text-li-red">Error: {t.error}</div>}
                {t.reply && (
                  <div className="text-li-white border-l-2 border-li-cyan pl-2 py-1">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-li-cyan">
                      D-U-N-C
                    </div>
                    {t.reply.answer}
                    {t.reply.citations.length > 0 && (
                      <div className="text-[9px] font-mono text-li-text-muted mt-1">
                        refs: {t.reply.citations.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Permanent quick-ask buttons */}
          <div className="border-t border-li-border px-3 py-2 space-y-1">
            <div className="text-[9px] uppercase tracking-widest text-li-text-muted font-mono mb-1">
              Quick ask
            </div>
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="block w-full text-left text-[11px] text-li-cyan hover:underline py-0.5 focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black"
              >
                → {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="border-t border-li-border p-2 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the engine…"
              className="flex-1 bg-li-black-surface border border-li-border rounded-sm px-2 py-1 text-[12px] text-li-white placeholder:text-li-text-muted focus:outline-none focus:border-li-cyan"
            />
            <button
              type="submit"
              className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider bg-li-cyan text-li-black rounded-sm hover:bg-li-cyan/90 focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black"
            >
              Ask
            </button>
          </form>
        </>
      )}
    </div>
  );
}

// ── Scenario intelligence cards ───────────────────────────────────────
// The three legacy scenarios get full tactical breakdowns. The newer
// triggers get shorter descriptions since they're user-initiated commands
// rather than engine-detected patterns.

interface ScenarioCard {
  label: string;
  isCore: boolean;              // true = legacy core scenario with deep explanation
  what: string;                 // what is happening
  why: string;                  // why it matters tactically
  data: string;                 // what the engine is measuring
  action: string;               // what the manager should do
  monitoring: string;           // real-time metrics being tracked
}

const SCENARIO_DETAIL: Record<string, ScenarioCard> = {
  // ═══ THE THREE CORE SCENARIOS (deep explanations) ═══
  under_run: {
    label: "UNDER-RUN",
    isCore: true,
    what: "The striker is moving in the opposite direction to the midfield line. While the central midfielders are driving forward with the ball into the attacking phase, the front player is dropping deeper or drifting laterally \u2014 breaking the vertical connection between the lines.",
    why: "This is one of the most common causes of failed attacking transitions in the Premier League. When the striker under-runs, the pass from midfield has no target in behind. The opposition defence doesn\u2019t get pulled, the attacking shape flattens, and the build-up play stalls. It\u2019s often invisible from the touchline because the striker looks busy \u2014 but the data shows the directional mismatch clearly.",
    data: "D-U-N-C measures the velocity vectors (vx) of the ST vs the midfield three (LCM, CM, RCM). An under-run fires when the striker\u2019s vx is negative (moving backward) while 2+ midfielders have vx > 1.5 m/s (driving forward) and the ball is in the attacking half (x > 55m). The gap between the lines is quantified in real time.",
    action: "Tell the striker to hold the last shoulder of the defensive line until possession turns. Don\u2019t drop to receive \u2014 stay high and stretch the backline. The midfield will find you.",
    monitoring: "ST velocity direction \u00b7 Midfield avg forward velocity \u00b7 Vertical gap between lines \u00b7 Ball x-position \u00b7 Pass target availability index",
  },
  pressing_shift: {
    label: "PRESSING SHIFT",
    isCore: true,
    what: "The opposition has moved their entire defensive block forward into our half. This isn\u2019t one or two players pressing \u2014 the whole outfield unit (8\u201310 players) has shifted their resting positions 15\u201325 metres higher up the pitch, compressing the space our team has to build from the back.",
    why: "A pressing shift changes the entire rhythm of the match. Suddenly short passes from the centre-backs are under pressure, the goalkeeper is forced long, and the midfield pivot has no time on the ball. If you don\u2019t recognise it and adapt within 10\u201315 seconds, you\u2019ll give the ball away in dangerous areas. This is how Guardiola\u2019s City and Klopp\u2019s Liverpool win the ball back in the opposition third \u2014 by shifting the block as a unit.",
    data: "D-U-N-C tracks the x-coordinate of every away outfielder every tick. A pressing shift fires when 60%+ of the away outfield is inside x < 75m (well into our half). The engine measures the block centroid, the share of players advanced, and the rate of advance. It also detects whether this is a sustained press or a temporary trigger press.",
    action: "Switch to direct vertical passes immediately. Don\u2019t try to play through the press \u2014 go over it or around it. Pin their full-backs with long diagonal balls to the wingers. Tell the centre-backs to go long to the striker\u2019s chest. The press will break within 8 seconds if you survive the first wave.",
    monitoring: "Away block mean x-position \u00b7 % of outfielders in home half \u00b7 Block advance rate \u00b7 Press duration \u00b7 PPDA (passes per defensive action) \u00b7 Our pass completion under pressure",
  },
  convergence: {
    label: "CONVERGENCE",
    isCore: true,
    what: "Three or more central midfielders have collapsed into a tight spatial cluster \u2014 within 12 metres of each other. This creates a numerical overload in the central channel. The midfield triangle that normally spans 20\u201325m has compressed into a dense pocket of bodies around the ball carrier or the key passing lane.",
    why: "Central convergence is one of the most powerful tactical shapes in football. It\u2019s how Barcelona under Guardiola dominated \u2014 by creating 3v1 or 4v2 situations in the half-spaces. When your midfield three are this close together, every short pass has two backup options. The opposition can\u2019t press one player without leaving another completely free. But it\u2019s also a risk: the wide areas are exposed. The staff need to see this shape and decide whether to exploit it (switch play to the weak side) or sustain it (overload and penetrate centrally).",
    data: "D-U-N-C computes the max pairwise distance between the three central midfielders (LCM, CM, RCM) every tick. Convergence fires when that distance drops below 12m. The BTUT windowed convergence pass also monitors the topological stability of this shape across a 4-second window \u2014 if the shape holds its structure (low Nash gap, stable density), it\u2019s a \u201ctactical lock\u201d rather than a momentary accident.",
    action: "This is the shape the technical staff should show the manager. The overload is real \u2014 look for the switch ball to the weak side where maximum space exists. Or, if the opposition hasn\u2019t adjusted, drive straight through the centre with a quick combination. The window is short \u2014 5\u20138 seconds before the shape disperses.",
    monitoring: "Max pairwise distance (LCM/CM/RCM) \u00b7 Triangle area \u00b7 Central channel density \u00b7 BTUT convergence status \u00b7 Nash gap \u00b7 Weak-side space index \u00b7 Shape hold duration",
  },

  // ═══ TRIGGER SCENARIOS (shorter descriptions) ═══
  high_press:     { label: "HIGH PRESS",     isCore: false, what: "Entire outfield surging 30m forward.", why: "Aggressive press on the ball carrier \u2014 high risk, high reward.", data: "Block centroid, recovery time, defensive line exposure.", action: "Commit fully. Win it back in 5 seconds or reset.", monitoring: "Ball recovery time \u00b7 Press success rate \u00b7 Defensive line height" },
  counter_press:  { label: "COUNTER-PRESS",  isCore: false, what: "Immediate press on loss of possession.", why: "5-second rule \u2014 win the ball back before they transition.", data: "Time-to-regain, pressing trigger zone.", action: "All nearby players swarm the ball. 5 seconds max.", monitoring: "Regain time \u00b7 Pressing zone \u00b7 Transition speed" },
  trap_sideline:  { label: "SIDELINE TRAP",  isCore: false, what: "Funnelling opposition toward the touchline.", why: "Touchline acts as an extra defender \u2014 reduces passing angles to one side.", data: "Carrier lateral position, passing lane density.", action: "Force them wide, then double up. No central escape.", monitoring: "Carrier y-position \u00b7 Passing lane count \u00b7 Touchline distance" },
  trap_corner:    { label: "CORNER TRAP",    isCore: false, what: "Collapsing the block toward the nearest corner flag.", why: "Maximum spatial pressure in a minimal area.", data: "Block centroid shift, carrier isolation.", action: "Collapse and win the ball. Spring the counter.", monitoring: "Block centroid \u00b7 Isolation index \u00b7 Tackle probability" },
  mid_block:      { label: "MID BLOCK",      isCore: false, what: "Compact shape around the halfway line.", why: "Deny space between the lines. Controlled and disciplined.", data: "Inter-line distance, horizontal compactness.", action: "Hold shape. Don\u2019t chase. Let them come to you.", monitoring: "Inter-line gap \u00b7 Compactness \u00b7 Ball progression rate" },
  low_block:      { label: "LOW BLOCK",      isCore: false, what: "Deep defensive block behind the ball.", why: "Invite pressure, protect the box, spring on the counter.", data: "Defensive third occupancy, shot block rate.", action: "Everyone behind the ball. Clear everything. Counter when you win it.", monitoring: "Defensive occupancy \u00b7 Block rate \u00b7 Counter-attack speed" },
  man_mark:       { label: "MAN MARK",       isCore: false, what: "Each home outfielder shadows the nearest opponent.", why: "Eliminates passing lanes but costs energy.", data: "Shadow distance per player, marking breaks.", action: "Stay tight. Don\u2019t get turned. Switch if they rotate.", monitoring: "Shadow distance \u00b7 Break count \u00b7 Energy expenditure" },
  zonal:          { label: "ZONAL RESET",    isCore: false, what: "Returning to base formation.", why: "All tactical overrides cleared. Hold shape.", data: "Positional deviation from base.", action: "Reset. Recover. Reorganize.", monitoring: "Deviation from base \u00b7 Recovery time" },
  drop_deep:      { label: "DROP DEEP",      isCore: false, what: "Defensive line dropping 15m.", why: "Creates space between midfield and attack for counter.", data: "Backline depth, gap between lines.", action: "Absorb. Be patient. Strike on the break.", monitoring: "Backline depth \u00b7 Gap width \u00b7 Channel exposure" },
  hold_line:      { label: "HOLD LINE",      isCore: false, what: "Back four compresses to a flat line.", why: "Offside trap ready. One step catches them all.", data: "Backline flatness, spread.", action: "Stay flat. Step together on the whistle.", monitoring: "Spread \u00b7 Flatness \u00b7 Offside trigger timing" },
  step_up:        { label: "STEP UP",        isCore: false, what: "Defensive line pushes 12m up the pitch.", why: "Squeeze the opposition into a narrower band.", data: "High-line depth, space behind.", action: "Push up as a unit. Keeper sweeps behind.", monitoring: "Line height \u00b7 Space behind \u00b7 Run timing" },
};

function ActiveScenarioDetail() {
  const scenarios = useDuncStore((s) => s.activeScenarios);
  const insights = useDuncStore((s) => s.insights);

  // Also show the 3 core scenarios if they fired recently (even without active trigger)
  const recentCoreKinds = new Set(
    insights
      .filter((i) => ["under_run", "pressing_shift", "convergence"].includes(i.kind))
      .slice(-3)
      .map((i) => i.kind),
  );

  // Merge: active scenarios + recently detected core scenarios
  const toShow: { name: string; remaining_sec: number; affected_count: number; detected: boolean }[] = [];
  for (const sc of scenarios) {
    toShow.push({ ...sc, detected: false });
  }
  for (const kind of Array.from(recentCoreKinds)) {
    if (!toShow.find((s) => s.name === kind)) {
      toShow.push({ name: kind, remaining_sec: 0, affected_count: 0, detected: true });
    }
  }

  if (toShow.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[9px] uppercase tracking-widest text-li-purple font-mono">
        Active tactical intelligence
      </div>
      {toShow.map((sc) => {
        const detail = SCENARIO_DETAIL[sc.name];
        if (!detail) return null;
        return (
          <div
            key={sc.name}
            className={cn(
              "border-l-2 pl-2 py-2 rounded-r-sm",
              detail.isCore
                ? "border-li-red bg-li-red/5"
                : "border-li-purple bg-li-purple/5",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(sc.remaining_sec > 0 || sc.detected) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-li-red animate-pulse motion-reduce:animate-none" />
                )}
                <span className={cn(
                  "text-[11px] font-mono font-bold",
                  detail.isCore ? "text-li-red" : "text-li-purple",
                )}>
                  {detail.label}
                </span>
                {detail.isCore && (
                  <span className="text-[8px] uppercase tracking-widest bg-li-red/20 text-li-red px-1 py-0.5 rounded-sm font-mono">
                    Core
                  </span>
                )}
              </div>
              {sc.remaining_sec > 0 && (
                <span className="text-[9px] font-mono tabular-nums text-li-purple/70">
                  {sc.remaining_sec.toFixed(0)}s \u00b7 {sc.affected_count}p
                </span>
              )}
              {sc.detected && sc.remaining_sec === 0 && (
                <span className="text-[9px] font-mono text-li-red/70">
                  DETECTED
                </span>
              )}
            </div>

            {/* What is happening */}
            <div className="text-[10px] text-li-white mt-1.5 leading-relaxed">
              {detail.what}
            </div>

            {detail.isCore && (
              <>
                {/* Why it matters */}
                <div className="mt-2">
                  <div className="text-[9px] uppercase tracking-widest text-li-text-muted font-mono mb-0.5">
                    Why this matters
                  </div>
                  <div className="text-[10px] text-li-text-secondary leading-relaxed">
                    {detail.why}
                  </div>
                </div>

                {/* What the engine sees */}
                <div className="mt-2">
                  <div className="text-[9px] uppercase tracking-widest text-li-text-muted font-mono mb-0.5">
                    Engine data
                  </div>
                  <div className="text-[10px] text-li-text-secondary leading-relaxed">
                    {detail.data}
                  </div>
                </div>

                {/* What to do */}
                <div className="mt-2">
                  <div className="text-[9px] uppercase tracking-widest text-li-cyan font-mono mb-0.5">
                    Recommended action
                  </div>
                  <div className="text-[10px] text-li-white leading-relaxed font-medium">
                    {detail.action}
                  </div>
                </div>
              </>
            )}

            {!detail.isCore && (
              <div className="text-[10px] text-li-text-secondary mt-1 leading-snug">
                {detail.why}
              </div>
            )}

            {/* Monitoring strip */}
            <div className="mt-1.5 text-[9px] text-li-text-muted font-mono leading-snug">
              {detail.monitoring}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Permanent core scenario monitor — ALWAYS visible ──────────────────
const CORE_SCENARIOS = ["under_run", "pressing_shift", "convergence"] as const;

function CoreScenarioMonitor() {
  const insights = useDuncStore((s) => s.insights);
  const activeScenarios = useDuncStore((s) => s.activeScenarios);
  const activeNames = new Set(activeScenarios.map((s) => s.name));

  // Find the most recent insight for each core scenario
  const latestByKind: Record<string, { t: number; title: string; summary: string }> = {};
  for (const i of insights) {
    if (CORE_SCENARIOS.includes(i.kind as any)) {
      latestByKind[i.kind] = { t: i.t, title: i.title, summary: i.summary };
    }
  }

  return (
    <div className="border border-li-red/20 bg-li-red/5 rounded-md overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-li-red/15 flex items-center justify-between">
        <div className="text-[9px] uppercase tracking-widest text-li-red font-mono font-bold">
          Core scenario monitor
        </div>
        <div className="text-[9px] font-mono text-li-text-muted">
          Always active
        </div>
      </div>
      <div className="divide-y divide-li-red/10">
        {CORE_SCENARIOS.map((kind) => {
          const detail = SCENARIO_DETAIL[kind];
          const latest = latestByKind[kind];
          const isActive = activeNames.has(kind);
          const activeSc = activeScenarios.find((s) => s.name === kind);
          const hasDetected = !!latest;

          return (
            <div key={kind} className="px-2.5 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isActive
                        ? "bg-li-red animate-pulse motion-reduce:animate-none"
                        : hasDetected
                          ? "bg-li-yellow"
                          : "bg-li-gray-700",
                    )}
                  />
                  <span className="text-[10px] font-mono font-bold text-li-white">
                    {detail.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-[9px] font-mono",
                    isActive
                      ? "text-li-red"
                      : hasDetected
                        ? "text-li-yellow"
                        : "text-li-text-muted",
                  )}
                >
                  {isActive
                    ? `LIVE · ${activeSc?.remaining_sec.toFixed(0)}s`
                    : hasDetected
                      ? `last: ${Math.floor(latest.t / 60)}:${String(Math.floor(latest.t % 60)).padStart(2, "0")}`
                      : "monitoring…"}
                </span>
              </div>
              <div className="text-[10px] text-li-text-secondary mt-0.5 leading-snug">
                {detail.what}
              </div>
              {hasDetected && !isActive && (
                <div className="text-[9px] text-li-yellow mt-1 leading-snug">
                  ↳ {latest.summary.slice(0, 120)}
                </div>
              )}
              {isActive && (
                <div className="text-[9px] text-li-red mt-1 font-medium">
                  ↳ {detail.action}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
