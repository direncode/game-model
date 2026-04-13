"use client";

// /dunc landing page — demo match selector.
//
// Minimal: a hero, a "Start demo match" CTA, and a list of any currently
// running matches. Clicking a match takes you into the live dashboard.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { duncApi } from "@/lib/dunc/api";
import type { DuncMatchSummary } from "@/lib/dunc/types";
import { RoleSwitcher } from "@/components/dunc/RoleSwitcher";

export default function DuncHomePage() {
  const router = useRouter();
  const [matches, setMatches] = useState<DuncMatchSummary[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hz, setHz] = useState(30);

  useEffect(() => {
    let mounted = true;
    duncApi
      .listMatches()
      .then((m) => mounted && setMatches(m))
      .catch((e) => mounted && setError((e as Error).message));
    return () => {
      mounted = false;
    };
  }, []);

  async function startDemo() {
    setStarting(true);
    setError(null);
    try {
      const m = await duncApi.createMatch("demo", null, hz);
      router.push(`/match/${m.id}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  async function startPLMatch() {
    setStarting(true);
    setError(null);
    try {
      const m = await duncApi.createMatch("Arsenal vs Manchester City", null, hz, "ars_vs_mci");
      router.push(`/match/${m.id}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-li-border">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl tracking-tight">D-U-N-C</span>
          <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            Tactical Football Intelligence · Latent Ocean
          </span>
        </div>
        <RoleSwitcher />
      </header>

      {/* Hero */}
      <main className="flex-1 px-6 py-12 max-w-6xl w-full mx-auto">
        <div className="max-w-3xl">
          <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono mb-3">
            Live match intelligence
          </div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.04] tracking-tight">
            Wearable data, live.
            <br />
            <span className="text-li-text-secondary">Tactical, finally.</span>
          </h1>
          <p className="mt-5 text-li-text-secondary max-w-xl leading-relaxed">
            Digital twins of every player on the pitch. Real-time detection of
            under-runs, pressing shifts, and central overloads. An AI assistant
            that answers in the voice of your role. All running on the Latent
            Ocean BTUT → TCD-JEPA pipeline.
          </p>

          {/* Premier League Match Card */}
          <div className="mt-8 border border-[#37003c]/60 bg-gradient-to-r from-[#37003c]/20 to-[#37003c]/5 rounded-md p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-[10px] uppercase tracking-widest text-[#ff2882] font-mono">
                Premier League · Title Decider
              </div>
            </div>
            <div className="flex items-center gap-6 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#EF0107", color: "white" }}>
                  ARS
                </div>
                <div>
                  <div className="text-lg font-bold text-white">Arsenal</div>
                  <div className="text-[10px] text-li-text-muted font-mono">Arteta · 4-3-3 · Pressing</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-[#37003c]">vs</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#6CABDD", color: "white" }}>
                  MCI
                </div>
                <div>
                  <div className="text-lg font-bold text-white">Manchester City</div>
                  <div className="text-[10px] text-li-text-muted font-mono">Guardiola · 4-3-3 · Possession</div>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-li-text-secondary mb-4">
              Final day. Arsenal lead by 1 point. A draw is enough for Arsenal. City must win for a record 5th consecutive title. Emirates Stadium, 60,000 capacity. Everything on the line.
            </div>
            <button
              type="button"
              onClick={startPLMatch}
              disabled={starting}
              className="px-6 py-2.5 bg-[#37003c] text-white font-bold tracking-wide hover:bg-[#37003c]/80 disabled:opacity-50 transition-colors rounded-sm"
            >
              {starting ? "Setting up…" : "⚽ Simulate Title Decider"}
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={startDemo}
              disabled={starting}
              className="px-5 py-2.5 bg-li-white text-li-black font-medium tracking-wide hover:bg-li-primary-hover disabled:opacity-50 transition-colors"
            >
              {starting ? "Starting…" : "Start generic demo"}
            </button>

            {/* Hz selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
                Tick rate
              </span>
              <select
                value={hz}
                onChange={(e) => setHz(Number(e.target.value))}
                className="bg-li-black-surface border border-li-border rounded-sm px-2 py-1.5 text-[12px] font-mono text-li-white focus:outline-none focus:border-li-cyan appearance-none cursor-pointer"
              >
                <option value={10}>10 Hz</option>
                <option value={20}>20 Hz</option>
                <option value={30}>30 Hz</option>
                <option value={60}>60 Hz</option>
              </select>
            </div>

            <Link
              href="#active"
              className="text-sm text-li-text-secondary hover:text-li-white"
            >
              View active matches →
            </Link>
          </div>
          {error && (
            <div className="mt-4 text-sm text-li-red font-mono">{error}</div>
          )}
        </div>

        {/* Active matches */}
        <section id="active" className="mt-20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
              Active matches
            </h2>
            <span className="text-[10px] font-mono text-li-text-muted">
              {matches.length} running
            </span>
          </div>
          {matches.length === 0 ? (
            <div className="border border-dashed border-li-border rounded-md p-6 text-sm text-li-text-muted text-center">
              No active matches. Start a demo above.
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/match/${m.id}`}
                    className="block border border-li-border bg-li-black-surface rounded-md p-3 hover:border-li-cyan transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-li-white">
                        {m.id}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono tracking-widest ${
                          m.status === "running"
                            ? "text-li-green"
                            : "text-li-text-muted"
                        }`}
                      >
                        ● {m.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-li-text-secondary mt-1">
                      clock {Math.floor(m.clock_sec / 60)}:
                      {Math.floor(m.clock_sec % 60)
                        .toString()
                        .padStart(2, "0")}{" "}
                      · {m.subscribers} subscribers · {m.hz} Hz
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Three articulated demo scenarios */}
        <section className="mt-20">
          <div className="mb-5">
            <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono mb-1">
              Demo scenarios
            </div>
            <h2 className="font-display text-2xl text-li-white leading-tight">
              Three frictions D-U-N-C removes from a matchday
            </h2>
            <p className="text-sm text-li-text-secondary mt-2 max-w-2xl">
              Every scenario below is scripted in the live match demo. Trigger
              it from the manager console and watch the pitch, the twins, and
              the backchannel line up behind a single shared picture.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScenarioCard
              tag="Scenario 01 · Accountability"
              title="The striker under-ran, then blamed the midfield"
              situation="9 peels off, the line drops three metres, and the ball dies between the lines. Two seconds later he's screaming at the 8 and the 10."
              friction="Manager has no way to prove, in the moment, who actually broke the line. Without evidence, the row stays a row."
              resolution="D-U-N-C freezes the frame, highlights the striker's under-run with position delta, velocity drop and timestamp. One tap surfaces a clip the manager can put in front of the player."
              trigger="Under-run"
            />
            <ScenarioCard
              tag="Scenario 02 · Translation"
              title="Technical staff saw a convergence the manager can't read"
              situation="Three central midfielders collapse on the ball carrier inside a 6m radius for 1.4s — a complex, multi-body convergence pattern the analysts picked up live."
              friction="On the touchline, the manager doesn't have 20 seconds to parse a heatmap. He needs one sentence, now."
              resolution="D-U-N-C compresses the convergence into a single line addressed to the manager's role — 'Away 6-8-10 collapsing central, left half-space open 18m' — with a one-click jump to the live overlay."
              trigger="Convergence"
            />
            <ScenarioCard
              tag="Scenario 03 · Alignment"
              title="Manager wants the whole staff on a new pressing model"
              situation="Opposition are playing through the first line. The manager decides mid-half to shift from mid-block to high press with a sideline trap."
              friction="Normally this takes three separate conversations — GK coach, analysts, assistant — and by the time everyone is aligned the window has closed."
              resolution="Manager issues one instruction. D-U-N-C pushes the new pressing model to every staff screen, updates the block lines and pressing traps overlay, and confirms affected players and duration in the active-scenario banner."
              trigger="Pressing shift"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function ScenarioCard({
  tag,
  title,
  situation,
  friction,
  resolution,
  trigger,
}: {
  tag: string;
  title: string;
  situation: string;
  friction: string;
  resolution: string;
  trigger: string;
}) {
  return (
    <div className="border border-li-border bg-li-black-surface rounded-md p-5 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono">
        {tag}
      </div>
      <div className="font-display text-lg text-li-white leading-snug">
        {title}
      </div>
      <ScenarioRow label="Situation" body={situation} />
      <ScenarioRow label="Friction" body={friction} />
      <ScenarioRow label="D-U-N-C" body={resolution} />
      <div className="mt-auto pt-3 border-t border-li-border flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-li-text-muted font-mono">
          Trigger in match
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-li-cyan border border-li-cyan/30 rounded-sm px-1.5 py-0.5">
          {trigger}
        </span>
      </div>
    </div>
  );
}

function ScenarioRow({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-li-text-muted font-mono mb-0.5">
        {label}
      </div>
      <div className="text-[13px] text-li-text-secondary leading-relaxed">
        {body}
      </div>
    </div>
  );
}
