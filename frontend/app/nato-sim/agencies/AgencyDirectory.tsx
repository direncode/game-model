"use client";

/**
 * Agency directory — static-ish display sourced from the backend's
 * /api/v1/nato_sim/agencies endpoint. Rendered as a vertical list of
 * cards. Two sections: on-floor sim teams (have a room number) and
 * off-floor IC components (taskable but not staffed).
 */

import { useEffect, useState } from "react";

interface SimTeam {
  room: string;
  director: string;
  members: string[];
}

interface AgencyInfo {
  long_name: string;
  sim_team: SimTeam;
  strengths: string[];
  best_for_gaps_about: string[];
}

export function AgencyDirectory() {
  const [agencies, setAgencies] = useState<Record<string, AgencyInfo>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/v1/nato_sim/agencies")
      .then((r) => (r.ok ? r.json() : { agencies: {} }))
      .then((j: { agencies: Record<string, AgencyInfo> }) => {
        setAgencies(j.agencies ?? {});
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const entries = Object.entries(agencies);
  const onFloor = entries.filter(
    ([, a]) =>
      a.sim_team?.room && !a.sim_team.room.startsWith("(not on"),
  );
  const offFloor = entries.filter(
    ([, a]) =>
      !a.sim_team?.room || a.sim_team.room.startsWith("(not on"),
  );

  if (!loaded) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-sm bg-gradient-to-r from-li-gray-900 via-li-gray-800 to-li-gray-900 bg-[length:400%_100%] animate-[gradient-shift_2s_ease_infinite]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <Section
        title="On the AWIS Floor"
        subtitle="Teams in the building tomorrow with rooms + rosters."
        agencies={onFloor}
      />
      {offFloor.length > 0 && (
        <Section
          title="Off-Floor — Taskable Through ODNI"
          subtitle="IC components not staffed in this exercise but fair game for collection asks."
          agencies={offFloor}
          dim
        />
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  agencies,
  dim = false,
}: {
  title: string;
  subtitle: string;
  agencies: [string, AgencyInfo][];
  dim?: boolean;
}) {
  return (
    <section>
      <div className="mb-4">
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
          {title}
        </div>
        <p className="text-[12px] text-li-text-secondary mt-1">{subtitle}</p>
      </div>
      <div
        className={
          "border border-li-border " + (dim ? "opacity-75" : "")
        }
      >
        {agencies.map(([key, a], idx) => (
          <article
            key={key}
            className={
              "px-5 py-4 grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-x-8 gap-y-2 " +
              (idx > 0 ? "border-t border-li-border/60" : "")
            }
          >
            <header>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-[20px] text-li-text-primary tracking-tight">
                  {key}
                </span>
                <span className="font-mono text-[10px] text-li-text-muted">
                  · {a.sim_team?.room ?? "—"}
                </span>
              </div>
              <div className="text-[11px] text-li-text-secondary leading-snug mt-0.5">
                {a.long_name}
              </div>
              {a.sim_team?.director && a.sim_team.director !== "—" && (
                <div className="mt-2 text-[11px] font-mono">
                  <span className="text-li-text-muted">director: </span>
                  <span className="text-li-cyan">{a.sim_team.director}</span>
                </div>
              )}
              {a.sim_team?.members && a.sim_team.members.length > 0 && (
                <ul className="mt-1 text-[10.5px] font-mono text-li-text-secondary leading-snug">
                  {a.sim_team.members.map((m, i) => (
                    <li key={i}>· {m}</li>
                  ))}
                </ul>
              )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11.5px] leading-relaxed">
              <div>
                <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
                  Strengths
                </div>
                <ul className="text-li-text-secondary space-y-0.5">
                  {a.strengths?.map((s, i) => (
                    <li key={i}>· {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
                  Best for gaps about
                </div>
                <ul className="text-li-text-secondary space-y-0.5">
                  {a.best_for_gaps_about?.map((s, i) => (
                    <li key={i}>· {s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
