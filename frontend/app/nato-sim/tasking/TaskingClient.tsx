"use client";

/**
 * Tasking — interactive client.
 *
 * Big paste area, "Operationalize" button, structured response below.
 * Each task in the response is rendered as a card:
 *   priority dot · task statement
 *   what we know (InrProse-rendered, with citations)
 *   what we don't know (gap)
 *   recommended agencies (chips)
 *   specific collection ask
 *   pin / open-finding controls
 */

import Link from "next/link";
import { useRef, useState } from "react";
import { InrProse } from "../_components/inr/InrProse";

interface TaskResponse {
  task: string;
  what_we_know?: string;
  what_we_dont_know?: string;
  recommended_agencies?: string[];
  specific_collection?: string;
  priority?: "HIGH" | "MEDIUM" | "LOW" | string;
  finding_id?: string;
  gap_id?: string;
  sources?: { title: string | null; origin: string | null; url: string | null }[];
  error?: string;
}

interface OperationalizeResult {
  memo_source?: string;
  extracted_count?: number;
  tasks?: TaskResponse[];
  error?: string;
  raw?: string;
  persisted_findings?: string[];
  persisted_gaps?: string[];
}

const SAMPLE_MEMO = `TOP SECRET // NOFORN // UMBRA
The Bureau of Intelligence and Research, Washington, DC
1 April 2030

Collection Orders
Subject: Initial orders under UMBRA

The Department of State Bureau of Intelligence and Research is hereby ordered to undertake the following:

1. Monitor foreign news sources and social media to assess allied and enemy disposition.
2. Identify the positions of NATO government decision makers on commitment to Article 5 responses.
3. Ensure NATO NIFC is apprised of relevant non-NOFORN and REL TO NATO intelligence to nations that have been cleared by the NSA and/or FBI in light of the Riga cyberattack.
4. Standing order: Keep communication with other teams and organize storylines.
5. Prepare public affairs materials to allies smoothing things over and trying to get them to align with American interests.

— Jack Barr, DNI`;

function priorityClasses(p: string | undefined) {
  if (p === "HIGH") return { dot: "bg-li-red", text: "text-li-red" };
  if (p === "MEDIUM") return { dot: "bg-li-yellow", text: "text-li-yellow" };
  if (p === "LOW") return { dot: "bg-li-green", text: "text-li-green" };
  return { dot: "bg-li-gray-700", text: "text-li-text-muted" };
}

export function TaskingClient() {
  const [content, setContent] = useState("");
  const [source, setSource] = useState("DNI tasking memo");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OperationalizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function operationalize(e?: React.FormEvent) {
    e?.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/nato_sim/operationalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, source }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`failed (${res.status}): ${txt.slice(0, 220)}`);
        return;
      }
      const j = (await res.json()) as OperationalizeResult;
      setResult(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Source */}
      <section>
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-2">
          Memo Source
        </div>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="DNI tasking memo · agency RFI · embassy cable · etc."
          className="w-full bg-transparent border-0 border-b border-li-border outline-0 px-1 py-2 text-[14px] font-mono text-li-text-primary placeholder:text-li-text-muted focus:border-li-cyan/60"
        />
      </section>

      {/* Paste area */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
            Tasking Memo
          </div>
          <button
            type="button"
            onClick={() => {
              setContent(SAMPLE_MEMO);
              taRef.current?.focus();
            }}
            className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted hover:text-li-cyan"
          >
            paste sample
          </button>
        </div>
        <textarea
          ref={taRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") operationalize();
          }}
          rows={14}
          className="w-full bg-li-black-surface/40 border border-li-border outline-0 px-4 py-3 text-[13px] font-mono text-li-text-primary leading-[1.6] resize-y focus:border-li-cyan/60 placeholder:text-li-text-muted"
          placeholder="paste the full tasking memo here…&#10;&#10;the system will extract each numbered/bulleted tasking line and:&#10;  1. RAG-answer each from current corpus + graph&#10;  2. surface the residual evidence gap&#10;  3. recommend 1-3 IC agencies + a concrete collection ask&#10;  4. persist a finding + a gap row per task&#10;&#10;⌘/Ctrl+↵ to submit · ~8 grok-4 calls per typical 5-task memo · ~$2-4 in credits"
        />
        <div className="mt-2 flex items-center justify-between font-mono text-[10.5px]">
          <span className="text-li-text-muted">
            {content.length} chars · {content.split(/\s+/).filter(Boolean).length} words
          </span>
          <button
            onClick={operationalize}
            disabled={!content.trim() || submitting}
            className="px-5 py-1.5 bg-li-cyan/15 hover:bg-li-cyan/25 border border-li-cyan/40 text-li-cyan rounded-sm tracking-[0.32em] uppercase disabled:opacity-30 transition-colors"
          >
            {submitting ? "operationalizing…" : "operationalize"}
          </button>
        </div>
        {error && <div className="mt-2 text-[11px] text-li-red font-mono">{error}</div>}
      </section>

      {/* Result */}
      {result && (
        <section className="mt-12 space-y-8">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted">
            Operationalized · {result.extracted_count ?? 0} tasks ·{" "}
            <span className="text-li-green normal-case tracking-normal">
              {result.persisted_findings?.length ?? 0} findings
            </span>
            {" · "}
            <span className="text-li-yellow normal-case tracking-normal">
              {result.persisted_gaps?.length ?? 0} gaps
            </span>
          </div>

          {result.error && (
            <div className="border-l-2 border-li-red pl-4 py-2">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-li-red">
                error
              </div>
              <p className="text-[12.5px] text-li-text-secondary mt-1">{result.error}</p>
              {result.raw && (
                <pre className="mt-2 text-[10.5px] font-mono text-li-text-muted whitespace-pre-wrap">
                  {result.raw}
                </pre>
              )}
            </div>
          )}

          {result.tasks?.map((t, idx) => {
            const pri = priorityClasses(t.priority);
            return (
              <article
                key={idx}
                className="border-l-2 border-li-cyan/40 pl-5 space-y-4"
              >
                <header className="flex items-baseline gap-3">
                  <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
                    <span
                      className={`font-mono text-[10px] tracking-[0.2em] uppercase ${pri.text}`}
                    >
                      {t.priority ?? "—"}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-li-text-muted">
                    T{String(idx + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-[18px] text-li-text-primary leading-snug flex-1">
                    {t.task}
                  </h2>
                </header>

                {t.error ? (
                  <div className="text-[11.5px] font-mono text-li-red">{t.error}</div>
                ) : (
                  <>
                    {t.what_we_know && (
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-1.5">
                          What We Know
                        </div>
                        <InrProse text={t.what_we_know} />
                      </div>
                    )}

                    {t.what_we_dont_know && (
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-yellow/80 mb-1.5">
                          Residual Gap
                        </div>
                        <p className="text-[13px] text-li-text-secondary leading-relaxed">
                          {t.what_we_dont_know}
                        </p>
                      </div>
                    )}

                    {(t.recommended_agencies?.length ?? 0) > 0 && (
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-1.5">
                          Recommended Tasking
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {t.recommended_agencies?.map((a) => (
                            <span
                              key={a}
                              className="px-1.5 py-0.5 text-[10px] font-mono border border-li-cyan/40 text-li-cyan bg-li-cyan/[0.05] rounded-sm"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                        {t.specific_collection && (
                          <p className="text-[13px] text-li-text-secondary leading-relaxed">
                            {t.specific_collection}
                          </p>
                        )}
                      </div>
                    )}

                    {(t.sources?.length ?? 0) > 0 && (
                      <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-li-text-muted">
                        <span className="tracking-[0.32em] uppercase">retrieved</span>
                        {t.sources?.map((s, i) => (
                          <span key={i} className="text-li-cyan/85">
                            {s.title ?? s.origin}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-4 text-[10px] font-mono">
                      {t.gap_id && (
                        <Link
                          href="/nato-sim/gaps"
                          className="text-li-text-muted hover:text-li-cyan tracking-wider"
                        >
                          → see in Gaps
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
