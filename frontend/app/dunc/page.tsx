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
      router.push(`/dunc/match/${m.id}`);
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
      router.push(`/dunc/match/${m.id}`);
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

      <main className="flex-1 px-6 py-8 max-w-6xl w-full mx-auto">
        {/* ═══ Slim hero ═══ */}
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono mb-2">
            D-U-N-C · Tactical Football Intelligence
          </div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.04] tracking-tight">
            Wearable data, live. <span className="text-li-text-secondary">Tactical, finally.</span>
          </h1>
        </div>

        {/* ═══ THE THREE CORE SCENARIOS ═══ */}
        <section className="mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-[10px] uppercase tracking-widest text-li-red font-mono">
              Core scenarios
            </div>
            <div className="flex-1 h-px bg-li-red/20" />
          </div>

          <div className="space-y-6">
            {/* Scenario 1: Under-run */}
            <div className="border border-li-red/30 bg-li-red/5 rounded-md p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-li-red/20 flex items-center justify-center text-lg font-bold text-li-red shrink-0">
                  1
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-li-red font-mono mb-1">
                    The striker under-ran tremendously
                  </div>
                  <div className="text-xl font-display text-white mb-3">
                    Then screamed at the midfielders. Now the manager wants to show exactly who is at fault.
                  </div>
                  <div className="text-sm text-li-text-secondary leading-relaxed mb-4">
                    The striker dropped deep while the midfield three were driving forward with the ball. The pass had no target. The attack broke down. The striker blamed the midfielders for not finding him. The manager saw it differently.
                  </div>
                  <div className="border-l-2 border-li-cyan pl-3">
                    <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono mb-1">
                      What D-U-N-C shows
                    </div>
                    <div className="text-sm text-li-white leading-relaxed">
                      Synchronized velocity data proves the striker's vx was negative (-1.5 m/s, moving backward) while the midfield average was +2.1 m/s (driving forward). The ball was at x=62m in the attacking half. The under-run broke the vertical connection between the lines. The data is timestamped, irrefutable, and displayed on the pitch with directional arrows. The manager shows the striker exactly where the disconnect happened.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scenario 2: Complex convergence */}
            <div className="border border-li-purple/30 bg-li-purple/5 rounded-md p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-li-purple/20 flex items-center justify-center text-lg font-bold text-li-purple shrink-0">
                  2
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-li-purple font-mono mb-1">
                    The technical staff saw a complex data convergence
                  </div>
                  <div className="text-xl font-display text-white mb-3">
                    They need to convey it to the manager in simple, visual terms.
                  </div>
                  <div className="text-sm text-li-text-secondary leading-relaxed mb-4">
                    The three central midfielders collapsed into a tight 8-metre triangle around the ball carrier. The BTUT convergence detector flagged it as a topological lock — the shape held for 6 seconds, creating a 3v1 numerical superiority in the central channel. The technical staff can see it in the data. But the manager needs it in one sentence.
                  </div>
                  <div className="border-l-2 border-li-cyan pl-3">
                    <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono mb-1">
                      What D-U-N-C shows
                    </div>
                    <div className="text-sm text-li-white leading-relaxed">
                      The staff uses the backchannel to send one message to the manager: "Central overload — 3v1 in the half-space. Switch to the weak side." The manager's screen shows the compressed triangle on the pitch with a pulsing highlight. The AI drawer explains it in plain tactical terms. The Game Approach window already suggests "Switch ball to the far side — maximum space." One complex data pattern, one clear action.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scenario 3: Pressing model shift */}
            <div className="border border-li-green/30 bg-li-green/5 rounded-md p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-li-green/20 flex items-center justify-center text-lg font-bold text-li-green shrink-0">
                  3
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-li-green font-mono mb-1">
                    The manager wants to shift to a different pressing model
                  </div>
                  <div className="text-xl font-display text-white mb-3">
                    One instruction needs to align the entire technical staff instantly.
                  </div>
                  <div className="text-sm text-li-text-secondary leading-relaxed mb-4">
                    It's minute 65. The opposition has started to dominate possession. The manager decides to switch from a high press to a mid-block counter-attack system. Every coach, analyst, and physio needs to understand the shift, see it on their screens, and adjust their monitoring in real time.
                  </div>
                  <div className="border-l-2 border-li-cyan pl-3">
                    <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono mb-1">
                      What D-U-N-C shows
                    </div>
                    <div className="text-sm text-li-white leading-relaxed">
                      The manager taps "MID BLOCK" in the tactical triggers panel. Instantly: the cyan banner shows "MID BLOCK — active", every affected player gets a purple pulsing ring on the pitch, the formation visibly shifts as players' targets move 15m deeper, and the AI drawer updates with block shape monitoring metrics. The technical staff see the same shift on their screens — with the additional analytics overlays showing the new defensive line height, inter-line compactness, and block shape flatness. Everyone is aligned. One tap.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SIMULATE IT — PL MATCH CARD ═══ */}
        <section className="mt-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-[10px] uppercase tracking-widest text-[#ff2882] font-mono">
              Try it now
            </div>
            <div className="flex-1 h-px bg-[#37003c]/30" />
          </div>

          <div className="border border-[#37003c]/60 bg-gradient-to-r from-[#37003c]/20 to-[#37003c]/5 rounded-md p-6">
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#EF0107", color: "white" }}>
                  ARS
                </div>
                <div>
                  <div className="text-xl font-bold text-white">Arsenal</div>
                  <div className="text-[10px] text-li-text-muted font-mono">Arteta · 4-3-3 · Pressing</div>
                </div>
              </div>
              <div className="text-3xl font-bold text-[#ff2882]">vs</div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#6CABDD", color: "white" }}>
                  MCI
                </div>
                <div>
                  <div className="text-xl font-bold text-white">Manchester City</div>
                  <div className="text-[10px] text-li-text-muted font-mono">Guardiola · 4-3-3 · Possession</div>
                </div>
              </div>
            </div>
            <div className="text-sm text-li-text-secondary mb-5 max-w-2xl leading-relaxed">
              Final day of the season. Arsenal lead City by 1 point. A draw is enough for Arsenal. City must win for a record 5th consecutive title. Emirates Stadium, 60,000 capacity. Real player data. Real tactical philosophies. Everything on the line.
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={startPLMatch}
                disabled={starting}
                className="px-8 py-3 bg-[#37003c] text-white text-lg font-bold tracking-wide hover:bg-[#37003c]/80 disabled:opacity-50 transition-colors rounded-sm"
              >
                {starting ? "Setting up…" : "⚽ Simulate Title Decider"}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">Hz</span>
                <select
                  value={hz}
                  onChange={(e) => setHz(Number(e.target.value))}
                  className="bg-li-black-surface border border-li-border rounded-sm px-2 py-1.5 text-[12px] font-mono text-li-white focus:outline-none focus:border-li-cyan appearance-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </div>
              <span className="text-li-text-muted">|</span>
              <button
                type="button"
                onClick={startDemo}
                disabled={starting}
                className="px-5 py-2.5 bg-li-black-surface border border-li-border text-li-white font-medium tracking-wide hover:border-li-cyan disabled:opacity-50 transition-colors rounded-sm"
              >
                {starting ? "Starting…" : "Generic demo"}
              </button>
            </div>
            {error && (
              <div className="mt-3 text-sm text-li-red font-mono">{error}</div>
            )}
          </div>
        </section>

        {/* ═══ ACTIVE MATCHES ═══ */}
        <section id="active" className="mt-16">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
                Active matches
              </div>
              <div className="flex-1 h-px bg-li-border" />
            </div>
            <span className="text-[10px] font-mono text-li-text-muted">
              {matches.length} running
            </span>
          </div>
          {matches.length === 0 ? (
            <div className="border border-dashed border-li-border rounded-md p-6 text-sm text-li-text-muted text-center">
              No active matches. Start a simulation above.
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/dunc/match/${m.id}`}
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
                      {Math.floor(m.clock_sec / 60)}:
                      {Math.floor(m.clock_sec % 60)
                        .toString()
                        .padStart(2, "0")}{" "}
                      · {m.subscribers} subs · {m.hz} Hz
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
