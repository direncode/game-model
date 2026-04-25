"use client";

/**
 * Entity table + Outlier-message table.
 *
 * Both refresh every 6s. Filter chips at the top of the entity table
 * narrow by type (actor / place / event / system / region / claim).
 * Clicking an actor row links to its Country File.
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

export function NetworkTable() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<"degree" | "name" | "last_seen">("degree");

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
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, []);

  const filteredEntities = useMemo(() => {
    let arr = entities;
    if (filter !== "all") arr = arr.filter((e) => e.type === filter);
    arr = [...arr];
    if (sort === "name")
      arr.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
    else if (sort === "last_seen")
      arr.sort((a, b) =>
        (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""),
      );
    else arr.sort((a, b) => b.degree - a.degree);
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
                {" "}— filtered to {filter}
              </span>
            )}
          </div>
          <div className="flex gap-3 font-mono text-[10px] tracking-[0.28em] uppercase">
            <span className="text-li-text-muted">sort</span>
            {(["degree", "name", "last_seen"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={
                  sort === s
                    ? "text-li-cyan"
                    : "text-li-text-muted hover:text-li-text-primary"
                }
              >
                {s.replace("_", " ")}
              </button>
            ))}
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
            <thead className="bg-li-black-surface/60">
              <tr className="text-[10px] tracking-[0.28em] uppercase text-li-text-muted">
                <th className="text-right px-3 py-2 w-12">#</th>
                <th className="text-left px-3 py-2 w-16">type</th>
                <th className="text-left px-3 py-2">canonical name</th>
                <th className="text-right px-3 py-2 w-16">degree</th>
                <th className="text-right px-3 py-2 w-12">out</th>
                <th className="text-right px-3 py-2 w-14">claims</th>
                <th className="text-right px-3 py-2 w-20">last seen</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntities.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-li-text-muted py-6 italic"
                  >
                    no entities resolved yet — running prep populates this
                  </td>
                </tr>
              ) : (
                filteredEntities.map((e, i) => {
                  const isActor = e.type === "actor";
                  const NameCell = (
                    <span
                      className={
                        isActor
                          ? "text-li-cyan hover:text-li-text-primary"
                          : "text-li-text-primary"
                      }
                    >
                      {e.canonical_name}
                    </span>
                  );
                  return (
                    <tr
                      key={e.id}
                      className="border-t border-li-border/40 hover:bg-li-surface-hover"
                    >
                      <td className="text-right px-3 py-1.5 text-li-text-muted">
                        {i + 1}
                      </td>
                      <td className="px-3 py-1.5 text-li-text-secondary uppercase tracking-wider text-[10px]">
                        {e.type}
                      </td>
                      <td className="px-3 py-1.5">
                        {isActor ? (
                          <Link
                            href={`/nato-sim/actors/${encodeURIComponent(
                              e.canonical_name,
                            )}`}
                          >
                            {NameCell}
                          </Link>
                        ) : (
                          NameCell
                        )}
                      </td>
                      <td className="text-right px-3 py-1.5">{e.degree}</td>
                      <td className="text-right px-3 py-1.5 text-li-text-secondary">
                        {e.out_degree}
                      </td>
                      <td className="text-right px-3 py-1.5 text-li-text-secondary">
                        {e.claim_count}
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
                  <td
                    colSpan={6}
                    className="text-center text-li-text-muted py-6 italic"
                  >
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
                    <tr
                      key={m.id}
                      className="border-t border-li-border/40 hover:bg-li-surface-hover"
                    >
                      <td className="text-right px-3 py-1.5 text-li-purple font-mono">
                        ✦ {Math.round(score * 100)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${priColor(m.priority)}`}
                          />
                          <span className="text-[10px] tracking-wider uppercase text-li-text-secondary">
                            {m.priority ?? "—"}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-li-text-secondary text-[10.5px]">
                        {sigs}
                      </td>
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
