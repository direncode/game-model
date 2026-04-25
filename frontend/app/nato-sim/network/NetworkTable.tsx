"use client";

/**
 * Entity table + Outlier-message table — CSV-style, no animation.
 *
 * Each entity row carries a 4-D structural score vector:
 *
 *   centrality          degree, normalized 0-1 against max degree
 *   novelty             age-relative; newer first-seen = higher
 *   peer_rank_anomaly   abs(z-score) of degree within same-type cohort,
 *                       normalized so 5σ caps at 1.0
 *   outlier_assoc       fraction of evidence messages with outlier_score
 *                       >= 0.4
 *
 * Plus a composite ``structural_score`` (mean of the four).
 *
 * The table is sortable by any axis. Default sort is composite — that's
 * the "structural surface" view: the entities most operationally
 * surprising according to all four signals together.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Entity {
  id: string;
  type: string;
  canonical_name: string;
  degree: number;
  out_degree: number;
  claim_count: number;
  first_seen_at: string;
  last_seen_at: string;
  centrality: number;
  novelty: number;
  peer_rank_anomaly: number;
  outlier_assoc: number;
  structural_score: number;
}

interface Message {
  id: string;
  source: string;
  channel: string | null;
  author: string | null;
  content: string;
  ts: string;
  priority: "FLASH" | "IMMEDIATE" | "PRIORITY" | "ROUTINE" | null;
  outlier_score?: number | null;
  outlier_signals?: string | null;
}

const TYPES = ["all", "actor", "place", "event", "system", "region", "claim"];

const SIG_LABEL: Record<string, string> = {
  novel_entity: "novel entity",
  rare_co_occurrence: "rare link",
  sparse_topic: "sparse topic",
  contradicts_kj: "contradicts KJ",
  length_anomaly: "length anomaly",
  burst: "burst",
};

type SortKey =
  | "structural"
  | "degree"
  | "centrality"
  | "novelty"
  | "peer"
  | "outlier"
  | "name"
  | "last_seen";

function priColor(p: string | null | undefined): string {
  switch (p) {
    case "FLASH":
      return "bg-li-red";
    case "IMMEDIATE":
      return "bg-orange-500";
    case "PRIORITY":
      return "bg-li-yellow";
    default:
      return "bg-li-gray-700";
  }
}

function fmtTs(s: string): string {
  if (!s) return "—";
  try {
    return (
      new Date(s + (s.endsWith("Z") ? "" : "Z"))
        .toUTCString()
        .match(/\d{2}:\d{2}:\d{2}/)?.[0] ?? "—"
    );
  } catch {
    return "—";
  }
}

function fmtScore(n: number | undefined | null): string {
  if (n == null) return "—";
  return (n * 100).toFixed(0).padStart(2, " ");
}

function scoreColor(n: number | undefined | null): string {
  if (n == null) return "text-li-text-muted";
  if (n >= 0.6) return "text-li-purple";
  if (n >= 0.35) return "text-li-cyan";
  if (n >= 0.15) return "text-li-text-secondary";
  return "text-li-text-muted";
}

export function NetworkTable() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("structural");
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    try {
      const [eRes, mRes] = await Promise.all([
        fetch("/api/v1/nato_sim/entities?limit=300"),
        fetch("/api/v1/nato_sim/messages?limit=200"),
      ]);
      if (eRes.ok) {
        const j = (await eRes.json()) as { items: Entity[] };
        setEntities(j.items ?? []);
      }
      if (mRes.ok) {
        const j = (await mRes.json()) as { items: Message[] };
        setMessages(j.items ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  const filteredEntities = useMemo(() => {
    let arr = entities;
    if (filter !== "all") arr = arr.filter((e) => e.type === filter);
    arr = [...arr];
    arr.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.canonical_name.localeCompare(b.canonical_name);
        case "last_seen":
          return (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "");
        case "degree":
          return b.degree - a.degree;
        case "centrality":
          return b.centrality - a.centrality;
        case "novelty":
          return b.novelty - a.novelty;
        case "peer":
          return b.peer_rank_anomaly - a.peer_rank_anomaly;
        case "outlier":
          return b.outlier_assoc - a.outlier_assoc;
        case "structural":
        default:
          return b.structural_score - a.structural_score;
      }
    });
    return arr;
  }, [entities, filter, sort]);

  const outliers = useMemo(
    () =>
      messages
        .filter((m) => (m.outlier_score ?? 0) >= 0.4)
        .sort((a, b) => (b.outlier_score ?? 0) - (a.outlier_score ?? 0)),
    [messages],
  );

  return (
    <div className="space-y-12">
      {/* Entities */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
            Entities · {filteredEntities.length}
            {filter !== "all" && (
              <span className="text-li-text-secondary normal-case tracking-normal">
                {" "}— {filter}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={
                "px-2 py-0.5 text-[10.5px] font-mono border rounded-sm " +
                (filter === t
                  ? "border-li-cyan/60 text-li-cyan bg-li-cyan/10"
                  : "border-li-border text-li-text-muted hover:text-li-text-primary")
              }
            >
              {t}
            </button>
          ))}
        </div>

        <div className="border border-li-border bg-li-black-surface/30 overflow-x-auto">
          <table className="w-full font-mono text-[11.5px]">
            <thead className="bg-li-black-surface/60 sticky top-0">
              <tr className="text-[9.5px] tracking-[0.22em] uppercase text-li-text-muted">
                <Th onClick={() => setSort("structural")} active={sort === "structural"} title="composite mean of the 4 axes" extra="text-right w-14">struct</Th>
                <Th onClick={() => setSort("degree")} active={sort === "degree"} title="raw edge count" extra="text-right w-12">deg</Th>
                <Th onClick={() => setSort("centrality")} active={sort === "centrality"} title="degree / max degree" extra="text-right w-12">cent</Th>
                <Th onClick={() => setSort("novelty")} active={sort === "novelty"} title="age-normalized; new = high" extra="text-right w-12">nov</Th>
                <Th onClick={() => setSort("peer")} active={sort === "peer"} title="abs z-score within type cohort" extra="text-right w-12">peer</Th>
                <Th onClick={() => setSort("outlier")} active={sort === "outlier"} title="fraction of evidence messages flagged outlier" extra="text-right w-14">outlr</Th>
                <th className="text-left px-3 py-2 w-16">type</th>
                <Th onClick={() => setSort("name")} active={sort === "name"} title="alphabetical" extra="text-left">canonical name</Th>
                <Th onClick={() => setSort("last_seen")} active={sort === "last_seen"} title="most-recent activity" extra="text-right w-20">last seen</Th>
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-t border-li-border/40">
                    <td colSpan={9} className="px-3 py-2.5">
                      <div className="h-3 rounded-sm bg-gradient-to-r from-li-gray-900 via-li-gray-800 to-li-gray-900 bg-[length:400%_100%] animate-[gradient-shift_2s_ease_infinite]" />
                    </td>
                  </tr>
                ))
              ) : filteredEntities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-li-text-muted py-6 italic">
                    no entities resolved yet
                  </td>
                </tr>
              ) : (
                filteredEntities.map((e) => {
                  const isActor = e.type === "actor";
                  const NameCell = (
                    <span className={isActor ? "text-li-cyan hover:text-li-text-primary" : "text-li-text-primary"}>
                      {e.canonical_name}
                    </span>
                  );
                  return (
                    <tr key={e.id} className="border-t border-li-border/40 hover:bg-li-surface-hover">
                      <td className={`text-right px-3 py-1.5 font-mono ${scoreColor(e.structural_score)}`}>
                        {fmtScore(e.structural_score)}
                      </td>
                      <td className="text-right px-3 py-1.5 text-li-text-secondary">{e.degree}</td>
                      <td className={`text-right px-3 py-1.5 ${scoreColor(e.centrality)}`}>
                        {fmtScore(e.centrality)}
                      </td>
                      <td className={`text-right px-3 py-1.5 ${scoreColor(e.novelty)}`}>
                        {fmtScore(e.novelty)}
                      </td>
                      <td className={`text-right px-3 py-1.5 ${scoreColor(e.peer_rank_anomaly)}`}>
                        {fmtScore(e.peer_rank_anomaly)}
                      </td>
                      <td className={`text-right px-3 py-1.5 ${scoreColor(e.outlier_assoc)}`}>
                        {fmtScore(e.outlier_assoc)}
                      </td>
                      <td className="px-3 py-1.5 text-li-text-muted uppercase tracking-wider text-[10px]">
                        {e.type}
                      </td>
                      <td className="px-3 py-1.5">
                        {isActor ? (
                          <Link href={`/nato-sim/actors/${encodeURIComponent(e.canonical_name)}`}>
                            {NameCell}
                          </Link>
                        ) : (
                          NameCell
                        )}
                      </td>
                      <td className="text-right px-3 py-1.5 text-li-text-muted text-[10.5px]">
                        {fmtTs(e.last_seen_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[10px] text-li-text-muted font-mono leading-relaxed">
          Score axes (0-100): <span className="text-li-text-secondary">struct</span> = composite ·{" "}
          <span className="text-li-text-secondary">cent</span> = degree-normalized centrality ·{" "}
          <span className="text-li-text-secondary">nov</span> = recency relative to oldest entity ·{" "}
          <span className="text-li-text-secondary">peer</span> = abs z-score within type cohort, capped 5σ ·{" "}
          <span className="text-li-text-secondary">outlr</span> = fraction of evidence messages flagged outlier.
          Click any column header to sort.
        </p>
      </section>

      {/* Outlier messages */}
      <section>
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-3">
          Outlier Messages · {outliers.length}
          <span className="text-li-text-secondary normal-case tracking-normal">
            {" "}— score ≥ 0.40
          </span>
        </div>
        <div className="border border-li-border bg-li-black-surface/30 overflow-x-auto">
          <table className="w-full font-mono text-[11.5px]">
            <thead className="bg-li-black-surface/60">
              <tr className="text-[10px] tracking-[0.28em] uppercase text-li-text-muted">
                <th className="text-right px-3 py-2 w-16">score</th>
                <th className="text-left px-3 py-2 w-20">priority</th>
                <th className="text-left px-3 py-2 w-32">signals</th>
                <th className="text-left px-3 py-2 w-28">source</th>
                <th className="text-left px-3 py-2">content</th>
                <th className="text-right px-3 py-2 w-16">ts</th>
              </tr>
            </thead>
            <tbody>
              {outliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-li-text-muted py-6 italic">
                    no outlier messages yet — paste live traffic via Inbound
                  </td>
                </tr>
              ) : (
                outliers.map((m) => {
                  const score = m.outlier_score ?? 0;
                  const sigs = (m.outlier_signals ?? "")
                    .split(",")
                    .map((s) => SIG_LABEL[s.trim()] ?? s.trim())
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={m.id} className="border-t border-li-border/40 hover:bg-li-surface-hover">
                      <td className="text-right px-3 py-1.5 text-li-purple font-mono">
                        ✦ {Math.round(score * 100)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${priColor(m.priority)}`} />
                          <span className="text-[10px] tracking-wider uppercase text-li-text-secondary">
                            {m.priority ?? "—"}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-li-text-secondary text-[10.5px]">{sigs}</td>
                      <td className="px-3 py-1.5 text-li-text-secondary text-[10.5px] truncate">
                        {m.source}
                        {m.channel ? `·${m.channel}` : ""}
                      </td>
                      <td className="px-3 py-1.5 text-li-text-primary line-clamp-2 max-w-md">
                        {m.content}
                      </td>
                      <td className="text-right px-3 py-1.5 text-li-text-muted text-[10px]">
                        {fmtTs(m.ts)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  title,
  extra,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title?: string;
  extra: string;
}) {
  return (
    <th
      title={title}
      onClick={onClick}
      className={
        "cursor-pointer select-none px-3 py-2 hover:text-li-text-primary " +
        (active ? "text-li-cyan" : "") +
        " " +
        extra
      }
    >
      {children}
      {active && " ▾"}
    </th>
  );
}
