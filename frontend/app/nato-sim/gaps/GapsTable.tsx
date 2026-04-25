"use client";

/**
 * Gaps table — one row per identified intelligence gap.
 *
 * Cols: priority dot | topic | why-a-gap | agency chips | specific collection ask | controls
 *
 * Controls per row:
 *   ✓  mark resolved (analyst attended to it)
 *
 * Top:
 *   Scan now → POST /api/v1/nato_sim/gaps/scan, refreshes table.
 *   Filter: all / unresolved.
 */

import { useEffect, useMemo, useState } from "react";

interface Gap {
  id: string;
  topic: string;
  why_a_gap: string;
  recommended_agencies: string[] | string | null;
  specific_collection: string;
  priority: "HIGH" | "MEDIUM" | "LOW" | string | null;
  resolved: number | boolean | null;
  generated_at: string;
}

interface AgencyInfo {
  long_name: string;
  strengths: string[];
  best_for_gaps_about: string[];
}

function priorityClasses(p: string | null | undefined) {
  if (p === "HIGH") return { dot: "bg-li-red", text: "text-li-red" };
  if (p === "MEDIUM") return { dot: "bg-li-yellow", text: "text-li-yellow" };
  if (p === "LOW") return { dot: "bg-li-green", text: "text-li-green" };
  return { dot: "bg-li-gray-700", text: "text-li-text-muted" };
}

function parseAgencies(v: Gap["recommended_agencies"]): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function GapsTable() {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [agencies, setAgencies] = useState<Record<string, AgencyInfo>>({});
  const [scanning, setScanning] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const res = await fetch(
        `/api/v1/nato_sim/gaps?only_unresolved=${showResolved ? "false" : "true"}`,
      );
      if (!res.ok) return;
      const j = (await res.json()) as { items: Gap[] };
      setGaps(j.items ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }

  async function loadAgencies() {
    try {
      const res = await fetch("/api/v1/nato_sim/agencies");
      if (!res.ok) return;
      const j = (await res.json()) as { agencies: Record<string, AgencyInfo> };
      setAgencies(j.agencies ?? {});
    } catch {
      /* ignore */
    }
  }

  async function scan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/nato_sim/gaps/scan", { method: "POST" });
      if (!res.ok) {
        const txt = await res.text();
        setError(`scan failed (${res.status}): ${txt.slice(0, 160)}`);
        return;
      }
      await load();
    } catch (e) {
      setError(`scan error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setScanning(false);
    }
  }

  async function resolve(id: string) {
    await fetch(`/api/v1/nato_sim/gaps/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: true }),
    });
    load();
  }

  async function reopen(id: string) {
    await fetch(`/api/v1/nato_sim/gaps/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: false }),
    });
    load();
  }

  useEffect(() => {
    loadAgencies();
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [showResolved]);

  const sortedGaps = useMemo(() => {
    const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return [...gaps].sort((a, b) => {
      const pa = order[a.priority ?? ""] ?? 3;
      const pb = order[b.priority ?? ""] ?? 3;
      if (pa !== pb) return pa - pb;
      return (b.generated_at ?? "").localeCompare(a.generated_at ?? "");
    });
  }, [gaps]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
          Gaps · {sortedGaps.length}
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.28em] uppercase">
          <button
            onClick={() => setShowResolved((v) => !v)}
            className={
              showResolved
                ? "text-li-cyan"
                : "text-li-text-muted hover:text-li-text-primary"
            }
          >
            {showResolved ? "showing all" : "unresolved only"}
          </button>
          <button
            onClick={scan}
            disabled={scanning}
            className="px-3 py-1 bg-li-cyan/15 hover:bg-li-cyan/25 border border-li-cyan/40 text-li-cyan rounded-sm tracking-[0.32em] uppercase disabled:opacity-30 transition-colors"
          >
            {scanning ? "scanning…" : "scan now"}
          </button>
        </div>
      </div>

      {error && <div className="text-[11px] text-li-red font-mono">{error}</div>}

      <div className="border border-li-border bg-li-black-surface/30 overflow-x-auto">
        <table className="w-full font-mono text-[11.5px]">
          <thead className="bg-li-black-surface/60">
            <tr className="text-[10px] tracking-[0.28em] uppercase text-li-text-muted">
              <th className="text-left px-3 py-2 w-20">prio</th>
              <th className="text-left px-3 py-2 w-44">topic</th>
              <th className="text-left px-3 py-2">why a gap</th>
              <th className="text-left px-3 py-2 w-44">recommended</th>
              <th className="text-left px-3 py-2">specific ask</th>
              <th className="text-right px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {!loaded ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-t border-li-border/40">
                  <td colSpan={6} className="px-3 py-3">
                    <div className="h-3 rounded-sm bg-gradient-to-r from-li-gray-900 via-li-gray-800 to-li-gray-900 bg-[length:400%_100%] animate-[gradient-shift_2s_ease_infinite]" />
                  </td>
                </tr>
              ))
            ) : sortedGaps.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-li-text-muted py-6 italic"
                >
                  no gaps yet — click <span className="text-li-cyan">scan now</span>{" "}
                  once findings have populated
                </td>
              </tr>
            ) : (
              sortedGaps.map((g) => {
                const pri = priorityClasses(g.priority);
                const agencyKeys = parseAgencies(g.recommended_agencies);
                const isResolved = !!g.resolved;
                return (
                  <tr
                    key={g.id}
                    className={
                      "border-t border-li-border/40 align-top " +
                      (isResolved ? "opacity-50" : "")
                    }
                  >
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${pri.dot}`}
                        />
                        <span
                          className={`text-[10px] tracking-[0.2em] uppercase ${pri.text}`}
                        >
                          {g.priority ?? "—"}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-li-text-primary font-display text-[13px]">
                      {g.topic}
                    </td>
                    <td className="px-3 py-2.5 text-li-text-secondary leading-snug">
                      {g.why_a_gap}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {agencyKeys.map((a) => {
                          const info = agencies[a];
                          return (
                            <span
                              key={a}
                              className="px-1.5 py-0.5 text-[10px] font-mono border border-li-cyan/40 text-li-cyan bg-li-cyan/[0.05] rounded-sm"
                              title={
                                info
                                  ? `${info.long_name}\nstrengths: ${info.strengths
                                      .slice(0, 2)
                                      .join("; ")}`
                                  : a
                              }
                            >
                              {a}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-li-text-secondary leading-snug">
                      {g.specific_collection}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isResolved ? (
                        <button
                          onClick={() => reopen(g.id)}
                          className="text-li-text-muted hover:text-li-yellow"
                          title="reopen"
                        >
                          ⟲
                        </button>
                      ) : (
                        <button
                          onClick={() => resolve(g.id)}
                          className="text-li-text-muted hover:text-li-green"
                          title="mark resolved"
                        >
                          ✓
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10.5px] text-li-text-muted font-mono leading-relaxed">
        Priority bands: <span className="text-li-red">HIGH</span> = filling
        the gap could promote/demote a watchboard line or change a Key
        Judgment. <span className="text-li-yellow">MEDIUM</span> = sharpens an
        ongoing assessment. <span className="text-li-green">LOW</span> =
        housekeeping. Recommended-agency chips show 1-3 IC components. Hover
        for capability summary.
      </p>
    </div>
  );
}
