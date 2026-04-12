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
      const m = await duncApi.createMatch("demo");
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

          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              onClick={startDemo}
              disabled={starting}
              className="px-5 py-2.5 bg-li-white text-li-black font-medium tracking-wide hover:bg-li-primary-hover disabled:opacity-50 transition-colors"
            >
              {starting ? "Starting…" : "Start demo match"}
            </button>
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

        {/* Three scenarios */}
        <section className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScenarioCard
            title="Under-runs"
            body="See exactly who broke from the attacking line, with position, velocity, and timestamp evidence."
          />
          <ScenarioCard
            title="Complex convergence"
            body="When the staff sees a tight central overload, D-U-N-C turns it into a single-sentence picture for the manager."
          />
          <ScenarioCard
            title="Pressing shifts"
            body="One click moves the whole staff to a shared view of the opposition's new block shape."
          />
        </section>
      </main>
    </div>
  );
}

function ScenarioCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-li-border bg-li-black-surface rounded-md p-4">
      <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono mb-2">
        Core scenario
      </div>
      <div className="text-lg text-li-white mb-1">{title}</div>
      <div className="text-sm text-li-text-secondary leading-relaxed">
        {body}
      </div>
    </div>
  );
}
