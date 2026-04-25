"use client";

/**
 * System-pulse strip — sits below the letterhead on most pages.
 *
 * Shows live counts from the api so the empty state on freshly-spun
 * verticals doesn't look dead. Updates every 4 seconds. Cheap query
 * (handful of COUNTs), safe to poll.
 *
 *   corpus 2 docs · 245k chars   graph 187 ent · 412 edges · 89 claims
 *   findings 1 daily · 4/15 cards · 0/10 watch · 0/5 dissent
 *   traffic 14 msgs · 3 outliers   last event 04:38:21Z (msg.ingested)
 */

import { useEffect, useState } from "react";

interface Status {
  corpus: { docs: number; briefing_chars: number; friday_chars: number };
  graph: { entities: number; claims: number; edges: number };
  findings: Record<string, number>;
  messages: { total: number; outliers: number };
  last_event: { kind: string; ts: string } | null;
}

const TARGET = {
  "actor-card": 15,
  "watchboard-item": 10,
  dissent: 5,
};

export function StatusStrip() {
  const [s, setS] = useState<Status | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/v1/nato_sim/prep-status");
      if (!res.ok) return;
      setS((await res.json()) as Status);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  if (!s) return null;

  const dailyCount = s.findings["daily-read"] ?? 0;
  const actorCount = s.findings["actor-card"] ?? 0;
  const watchCount = s.findings["watchboard-item"] ?? 0;
  const dissentCount = s.findings["dissent"] ?? 0;
  const hcCount = s.findings["hidden-connection"] ?? 0;

  const lastEventTs = s.last_event?.ts
    ? new Date(s.last_event.ts).toUTCString().match(/\d{2}:\d{2}:\d{2}/)?.[0] ?? "—"
    : "—";

  // Heuristic activity indicator: blink green dot if we got an event
  // within the last ~10 seconds (hard to know precisely without server
  // clock skew correction, but close enough).
  const recentlyActive = s.last_event
    ? Date.now() - new Date(s.last_event.ts + "Z").getTime() < 30000
    : false;

  return (
    <div className="border-y border-li-border bg-li-black-surface/40 -mx-10 px-10 py-2 mb-6 font-mono text-[10.5px] text-li-text-secondary">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
        <div>
          <span className="tracking-[0.28em] uppercase text-li-text-muted mr-2">
            corpus
          </span>
          {s.corpus.docs} docs · {Math.round(s.corpus.briefing_chars / 1000)}k briefing · {Math.round(s.corpus.friday_chars / 1000)}k deck
        </div>
        <div>
          <span className="tracking-[0.28em] uppercase text-li-text-muted mr-2">
            graph
          </span>
          {s.graph.entities} ent · {s.graph.edges} edges · {s.graph.claims} claims
        </div>
        <div>
          <span className="tracking-[0.28em] uppercase text-li-text-muted mr-2">
            messages
          </span>
          {s.messages.total} msgs
          {s.messages.outliers > 0 && (
            <span className="text-li-purple ml-1.5">
              · ✦ {s.messages.outliers} outliers
            </span>
          )}
        </div>
        <div className="md:col-span-2 lg:col-span-2">
          <span className="tracking-[0.28em] uppercase text-li-text-muted mr-2">
            findings
          </span>
          <span className={dailyCount ? "text-li-green" : ""}>
            {dailyCount}/1 daily
          </span>
          {" · "}
          <span className={actorCount === TARGET["actor-card"] ? "text-li-green" : actorCount > 0 ? "text-li-yellow" : ""}>
            {actorCount}/{TARGET["actor-card"]} cards
          </span>
          {" · "}
          <span className={watchCount === TARGET["watchboard-item"] ? "text-li-green" : watchCount > 0 ? "text-li-yellow" : ""}>
            {watchCount}/{TARGET["watchboard-item"]} watch
          </span>
          {" · "}
          <span className={dissentCount === TARGET["dissent"] ? "text-li-green" : dissentCount > 0 ? "text-li-yellow" : ""}>
            {dissentCount}/{TARGET["dissent"]} dissent
          </span>
          {hcCount > 0 && <span> · {hcCount} hidden-conn</span>}
        </div>
        <div>
          <span className="tracking-[0.28em] uppercase text-li-text-muted mr-2">
            pulse
          </span>
          <span
            className={
              "inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-baseline " +
              (recentlyActive
                ? "bg-li-green animate-pulse"
                : "bg-li-gray-700")
            }
            aria-label={recentlyActive ? "active" : "idle"}
          />
          {s.last_event ? `${s.last_event.kind} ${lastEventTs}Z` : "no events"}
        </div>
      </div>
    </div>
  );
}
