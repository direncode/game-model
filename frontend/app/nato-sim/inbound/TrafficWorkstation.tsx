"use client";

/**
 * Traffic Workstation — operator's primary surface during the sim.
 *
 *   1. Bulk paste area at top — accepts a chunk of #comms history,
 *      splits on INTEL INJECT markers, parses + ingests each.
 *   2. Recent ingests below — every message rendered as a structured
 *      card: classification banner top, FROM → TO routing, SUBJECT,
 *      DTG, body, resolved-entity chips, outlier flag, priority dot,
 *      per-card Operationalize button.
 *   3. Filter chips: classification level (TS / S / CUI / U), source
 *      kind (HUMINT / SIGINT / OSINT / OFFICIAL / SOCIAL), outlier-only
 *      toggle, search.
 */

import { useEffect, useMemo, useRef, useState } from "react";

interface ParsedItem {
  id: string;
  classification: string;
  level: "TS" | "S" | "CUI" | "U" | string;
  kind: "HUMINT" | "SIGINT" | "GEOINT" | "MASINT" | "OSINT" | "SOCIAL" | "OFFICIAL" | "OTHER" | string;
  from: string;
  recipients: string[];
  subject: string;
  dtg: string;
  body: string;
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
  raw_json?: any;
}

const LEVEL_STYLES: Record<string, string> = {
  TS: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  S: "bg-li-red/15 text-li-red border-li-red/40",
  CUI: "bg-li-blue/15 text-li-blue border-li-blue/40",
  U: "bg-li-green/15 text-li-green border-li-green/40",
};

const KIND_STYLES: Record<string, string> = {
  HUMINT: "bg-li-purple/15 text-li-purple border-li-purple/40",
  SIGINT: "bg-li-cyan/15 text-li-cyan border-li-cyan/40",
  GEOINT: "bg-li-blue/15 text-li-blue border-li-blue/40",
  MASINT: "bg-li-yellow/15 text-li-yellow border-li-yellow/40",
  OSINT: "bg-li-text-secondary/15 text-li-text-secondary border-li-text-secondary/40",
  SOCIAL: "bg-li-warm/15 text-li-warm border-li-warm/40",
  OFFICIAL: "bg-li-green/15 text-li-green border-li-green/40",
  OTHER: "bg-li-gray-800 text-li-text-muted border-li-border",
};

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

function meta(m: Message): {
  level: string;
  kind: string;
  from: string;
  recipients: string[];
  subject: string;
  dtg: string;
  body: string;
} {
  const r = m.raw_json ?? {};
  return {
    level: r.level || "U",
    kind: r.kind || "OTHER",
    from: r.from || m.author || "",
    recipients: Array.isArray(r.recipients) ? r.recipients : [],
    subject: r.subject || m.channel || "",
    dtg: r.dtg || "",
    body: m.content?.replace(/^SUBJECT:[^\n]+\n+/i, "") || "",
  };
}

export function TrafficWorkstation() {
  const [paste, setPaste] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [parseSummary, setParseSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<string>("all");
  const [outlierOnly, setOutlierOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [operationalizing, setOperationalizing] = useState<Record<string, boolean>>({});
  const [opResults, setOpResults] = useState<Record<string, any>>({});
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/v1/nato_sim/messages?limit=80");
      if (!res.ok) return;
      const j = (await res.json()) as { items: Message[] };
      setMessages(j.items ?? []);
    } catch {
      /* ignore */
    }
  }

  async function ingestBatch() {
    if (!paste.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setParseSummary(null);
    try {
      const res = await fetch("/api/v1/nato_sim/ingest/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: paste }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`batch ingest failed (${res.status}): ${txt.slice(0, 200)}`);
        return;
      }
      const j = (await res.json()) as { count: number; items: ParsedItem[] };
      setParseSummary(
        `parsed ${j.count} ${j.count === 1 ? "inject" : "injects"} · ` +
          `levels ${[...new Set(j.items.map((x) => x.level))].join(",")} · ` +
          `kinds ${[...new Set(j.items.map((x) => x.kind))].join(",")}`,
      );
      setPaste("");
      taRef.current?.focus();
      // give the entity resolver + outlier scorer a beat to finish
      setTimeout(refresh, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown ingest error");
    } finally {
      setSubmitting(false);
    }
  }

  async function operationalize(m: Message) {
    setOperationalizing((s) => ({ ...s, [m.id]: true }));
    try {
      const md = meta(m);
      const memoText = `INTEL INJECT
EXERCISE ${m.raw_json?.classification ?? ""}
FROM: ${md.from}
TO: ${md.recipients.join(", ")}
SUBJECT: ${md.subject}
DTG: ${md.dtg}

${md.body}`;
      const res = await fetch("/api/v1/nato_sim/operationalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: memoText,
          source: `intel-inject:${md.from}`,
        }),
      });
      const j = await res.json();
      setOpResults((s) => ({ ...s, [m.id]: j }));
    } catch (e) {
      setOpResults((s) => ({
        ...s,
        [m.id]: { error: e instanceof Error ? e.message : String(e) },
      }));
    } finally {
      setOperationalizing((s) => ({ ...s, [m.id]: false }));
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (m.source !== "intel-inject" && m.source !== "paste") return false;
      const md = meta(m);
      if (filterLevel !== "all" && md.level !== filterLevel) return false;
      if (filterKind !== "all" && md.kind !== filterKind) return false;
      if (outlierOnly && (m.outlier_score ?? 0) < 0.4) return false;
      if (q) {
        const blob =
          (md.subject + " " + md.from + " " + md.recipients.join(" ") + " " + md.body)
            .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [messages, filterLevel, filterKind, outlierOnly, search]);

  return (
    <div className="space-y-8">
      {/* Bulk paste */}
      <section>
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-2">
          Paste #comms Channel Block
        </div>
        <textarea
          ref={taRef}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") ingestBatch();
          }}
          rows={10}
          className="w-full bg-li-black-surface/40 border border-li-border outline-0 px-4 py-3 text-[12.5px] font-mono text-li-text-primary leading-[1.55] resize-y focus:border-li-cyan/60 placeholder:text-li-text-muted"
          placeholder={`paste a chunk of #comms history…&#10;&#10;the parser will split on each '📡 INTEL INJECT' marker, extract:&#10;  FROM / TO / SUBJECT / DTG / classification / body&#10;dedupe, ingest each through the resolver + outlier scorer,&#10;and surface them as cards below.&#10;&#10;⌘/Ctrl+↵ to submit`}
        />
        <div className="mt-2 flex items-center justify-between font-mono text-[10.5px]">
          <span className="text-li-text-muted">
            {paste.length} chars · {paste.split(/\s+/).filter(Boolean).length} words
          </span>
          <button
            onClick={ingestBatch}
            disabled={!paste.trim() || submitting}
            className="px-5 py-1.5 bg-li-cyan/15 hover:bg-li-cyan/25 border border-li-cyan/40 text-li-cyan rounded-sm tracking-[0.32em] uppercase disabled:opacity-30 transition-colors"
          >
            {submitting ? "ingesting…" : "ingest batch"}
          </button>
        </div>
        {parseSummary && (
          <div className="mt-2 text-[11px] font-mono text-li-green">{parseSummary}</div>
        )}
        {error && <div className="mt-2 text-[11px] font-mono text-li-red">{error}</div>}
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted">
            level
          </span>
          {["all", "TS", "S", "CUI", "U"].map((lv) => (
            <button
              key={lv}
              onClick={() => setFilterLevel(lv)}
              className={
                "px-2 py-0.5 text-[10.5px] font-mono border rounded-sm " +
                (filterLevel === lv
                  ? "border-li-cyan/60 text-li-cyan bg-li-cyan/10"
                  : "border-li-border text-li-text-muted hover:text-li-text-primary")
              }
            >
              {lv}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted">
            kind
          </span>
          {["all", "HUMINT", "SIGINT", "OSINT", "OFFICIAL", "SOCIAL", "OTHER"].map((k) => (
            <button
              key={k}
              onClick={() => setFilterKind(k)}
              className={
                "px-2 py-0.5 text-[10.5px] font-mono border rounded-sm " +
                (filterKind === k
                  ? "border-li-cyan/60 text-li-cyan bg-li-cyan/10"
                  : "border-li-border text-li-text-muted hover:text-li-text-primary")
              }
            >
              {k}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOutlierOnly((v) => !v)}
          className={
            "px-2 py-0.5 text-[10.5px] font-mono border rounded-sm " +
            (outlierOnly
              ? "border-li-purple/60 text-li-purple bg-li-purple/10"
              : "border-li-border text-li-text-muted hover:text-li-text-primary")
          }
        >
          ✦ outlier only
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search subject / from / body…"
          className="ml-auto w-72 bg-transparent border border-li-border rounded-sm px-2 py-1 text-[11px] font-mono text-li-text-primary placeholder:text-li-text-muted focus:border-li-cyan/60 outline-0"
        />
      </section>

      {/* Cable cards */}
      <section className="space-y-4">
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
          Cables · {filtered.length}
        </div>
        {filtered.length === 0 ? (
          <div className="text-[12.5px] text-li-text-muted font-mono py-6 italic">
            no traffic matching filters.
          </div>
        ) : (
          filtered.map((m) => {
            const md = meta(m);
            const score = m.outlier_score ?? 0;
            const isOutlier = score >= 0.4;
            const sigs = (m.outlier_signals ?? "")
              .split(",")
              .map((s) => SIG_LABEL[s.trim()] ?? s.trim())
              .filter(Boolean)
              .join(" · ");
            const pri = priColor(m.priority);
            const opr = opResults[m.id];
            const isOp = operationalizing[m.id];

            return (
              <article
                key={m.id}
                className={
                  "border border-li-border bg-li-black-surface/40 " +
                  (isOutlier ? "border-l-2 border-l-li-purple" : "")
                }
              >
                {/* Classification banner */}
                <div
                  className={
                    "px-4 py-1 text-center font-mono text-[10px] tracking-[0.32em] uppercase border-b " +
                    (LEVEL_STYLES[md.level] ?? LEVEL_STYLES.U)
                  }
                >
                  {m.raw_json?.classification || "UNCLASSIFIED // FOR EXERCISE USE"}
                </div>

                <div className="p-5 space-y-3">
                  {/* Top row: priority + kind + outlier */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${pri}`} />
                      <span className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-li-text-secondary">
                        {m.priority ?? "ROUTINE"}
                      </span>
                    </span>
                    <span
                      className={
                        "px-1.5 py-0.5 text-[9.5px] font-mono border rounded-sm " +
                        (KIND_STYLES[md.kind] ?? KIND_STYLES.OTHER)
                      }
                    >
                      {md.kind}
                    </span>
                    {isOutlier && (
                      <span className="text-[10px] font-mono text-li-purple">
                        ✦ outlier {Math.round(score * 100)} · {sigs}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-li-text-muted">
                      {fmtTs(m.ts)}Z
                    </span>
                  </div>

                  {/* FROM / TO / DTG */}
                  <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-x-4 gap-y-1 font-mono text-[11px]">
                    {md.from && (
                      <>
                        <span className="text-li-text-muted tracking-wider uppercase">from</span>
                        <span className="text-li-text-primary">{md.from}</span>
                      </>
                    )}
                    {md.recipients.length > 0 && (
                      <>
                        <span className="text-li-text-muted tracking-wider uppercase">to</span>
                        <span className="text-li-text-secondary">
                          {md.recipients.map((r, i) => {
                            const isUs =
                              /\bINR\b/i.test(r) || /\bSTATE[\s-]?INR\b/i.test(r);
                            return (
                              <span
                                key={i}
                                className={
                                  isUs ? "text-li-cyan font-medium" : ""
                                }
                              >
                                {r}
                                {i < md.recipients.length - 1 ? " · " : ""}
                              </span>
                            );
                          })}
                        </span>
                      </>
                    )}
                    {md.dtg && (
                      <>
                        <span className="text-li-text-muted tracking-wider uppercase">dtg</span>
                        <span className="text-li-text-secondary">{md.dtg}</span>
                      </>
                    )}
                  </div>

                  {/* Subject */}
                  {md.subject && (
                    <h3 className="font-display text-[16px] text-li-text-primary leading-snug">
                      {md.subject}
                    </h3>
                  )}

                  {/* Body */}
                  {md.body && (
                    <p className="text-[13px] text-li-text-secondary leading-relaxed whitespace-pre-wrap">
                      {md.body}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="pt-2 flex items-center gap-3 border-t border-li-border/60">
                    <button
                      onClick={() => operationalize(m)}
                      disabled={isOp}
                      className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-cyan hover:text-li-text-primary disabled:opacity-40"
                    >
                      {isOp ? "operationalizing…" : "→ operationalize"}
                    </button>
                  </div>

                  {/* Operationalize result inline */}
                  {opr && (
                    <div className="mt-3 border-t border-li-cyan/30 pt-3 space-y-3">
                      {opr.error ? (
                        <div className="text-[11px] font-mono text-li-red">
                          {opr.error}
                        </div>
                      ) : (
                        <>
                          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-cyan">
                            Operationalized · {opr.tasks?.length ?? 0} task{(opr.tasks?.length ?? 0) === 1 ? "" : "s"}
                          </div>
                          {opr.tasks?.map((t: any, ti: number) => (
                            <div
                              key={ti}
                              className="border-l-2 border-li-cyan/30 pl-4 space-y-1"
                            >
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono text-[10px] text-li-text-muted">
                                  T{String(ti + 1).padStart(2, "0")}
                                </span>
                                <span className="font-display text-[14px] text-li-text-primary">
                                  {t.task}
                                </span>
                              </div>
                              {t.what_we_dont_know && (
                                <div className="text-[12px] text-li-yellow/80">
                                  gap: {t.what_we_dont_know}
                                </div>
                              )}
                              {t.recommended_agencies?.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                  {t.recommended_agencies.map((a: string) => (
                                    <span
                                      key={a}
                                      className="px-1.5 py-0.5 text-[10px] font-mono border border-li-cyan/40 text-li-cyan bg-li-cyan/[0.05] rounded-sm"
                                    >
                                      {a}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {t.specific_collection && (
                                <div className="text-[12px] text-li-text-secondary">
                                  → {t.specific_collection}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
