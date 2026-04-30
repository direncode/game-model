"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

type CorpusStub = {
  corpus_id: string;
  survivor_count: number;
  null_test: { max_z_score?: number; significant_05?: number; total_metrics?: number };
  top_entity_name: string | null;
  top_entity_resolved?: { display: string; subtitle?: string; kind?: string };
  readiness_score: number;
};

type UniversalAggregate = {
  corpora_tested: number;
  mean_readiness: number;
  corpora_with_universal_significance: number;
  total_survivors_processed: number;
  max_z_score_across_corpora: number;
};

// Display labels collapse raw corpus ids to domain names a buyer will recognize.
const LABEL: Record<string, string> = {
  edgar_5000: "SEC EDGAR",
  edgar: "SEC EDGAR (cut)",
  polymath: "Polymath biographies",
  heterogeneous: "Mixed historical",
  latk_mini: "Language across time",
  latk_physics: "Physics patents",
  linguistics: "Linguistic evolution",
  tesla_crossera: "Tesla cross-era",
  pubmed: "PubMed biomedical",
  comtrade: "UN Comtrade trade",
  climate: "NOAA climate series",
  patents: "USPTO patents",
  einstein: "Einstein events",
  turing: "Turing events",
  standalone: "Smoke fixture",
};

export function UniversalProof() {
  const [corpora, setCorpora] = useState<CorpusStub[] | null>(null);
  const [agg, setAgg] = useState<UniversalAggregate | null>(null);
  const [validation, setValidation] = useState<{
    passed: number;
    run: number;
    readiness: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/universal", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setCorpora(d.corpora);
        setAgg(d.aggregate);
      })
      .catch(() => {});

    fetch("/api/validation", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setValidation({
          passed: d.tests_passed,
          run: d.tests_run,
          readiness: d.commercial_readiness_score,
        });
      })
      .catch(() => {});
  }, []);

  const topCorpora = (corpora ?? [])
    .filter((c) => (c.null_test?.max_z_score ?? 0) > 0)
    .sort((a, b) => (b.null_test?.max_z_score ?? 0) - (a.null_test?.max_z_score ?? 0))
    .slice(0, 12);

  return (
    <section
      id="proof"
      className="relative py-32 border-t border-white/5 overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(0,212,255,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="text-center mb-12"
        >
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/45 mb-4">
            Primitive validation · identical substrate across {agg?.corpora_tested ?? 15} unrelated data shapes
          </p>
          <h2 className="font-display font-medium text-5xl md:text-7xl tracking-[-0.035em] text-white leading-[0.95]">
            {agg ? (
              <>
                One primitive.{" "}
                <span className="text-white/40">{agg.corpora_tested} data shapes.</span>
              </>
            ) : (
              <>
                One primitive. <span className="text-white/40">Loading…</span>
              </>
            )}
          </h2>
          <p className="mt-6 text-lg text-white/60 max-w-3xl mx-auto">
            The chips below are <em>not product demos</em>. They are the same 48-bit fingerprint
            primitive applied to radically different data types — SEC XBRL filings, NOAA weather
            stations, UN Comtrade flows, PubMed biomedical literature, USPTO patents, biographies,
            physics patents, linguistic evolution. If the primitive only worked because of a tuned
            constant for any one of them, it would fail on the rest. Every number below is
            re-derived on page load from the repo's cached runs.
          </p>
        </motion.div>

        {agg && (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
          >
            <HeadlineStat
              label="Corpora tested"
              value={agg.corpora_tested.toString()}
              sub={`${agg.corpora_with_universal_significance} at universal sig.`}
            />
            <HeadlineStat
              label="Survivors processed"
              value={agg.total_survivors_processed.toLocaleString()}
              sub="finance · climate · trade · patents · bio"
            />
            <HeadlineStat
              label="Max z-score"
              value={`${agg.max_z_score_across_corpora.toFixed(2)} σ`}
              sub="physics patent corpus"
              tone="good"
            />
            <HeadlineStat
              label="Commercial readiness"
              value={
                validation
                  ? `${validation.passed}/${validation.run}`
                  : `${agg.mean_readiness.toFixed(0)}/100`
              }
              sub={
                validation
                  ? `EDGAR validation · ${validation.readiness}/100`
                  : "mean across corpora"
              }
              tone="good"
            />
          </motion.div>
        )}

        {topCorpora.length > 0 && (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {topCorpora.map((c) => (
              <motion.div key={c.corpus_id} variants={fadeUp}>
                <CorpusChip c={c} />
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/universal"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Full universality grid
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <Link
            href="/validation"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
          >
            EDGAR commercial validation
          </Link>
          <Link
            href="/watchlist"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
          >
            Today's top-50 flags
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function HeadlineStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good";
}) {
  const accent = tone === "good" ? "text-li-green" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
        {label}
      </div>
      <div className={`font-display text-3xl tabular-nums tracking-tight ${accent}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-[11px] font-mono text-white/40">{sub}</div>
      )}
    </div>
  );
}

function CorpusChip({ c }: { c: CorpusStub }) {
  const label = LABEL[c.corpus_id] ?? c.corpus_id;
  const z = c.null_test?.max_z_score ?? 0;
  const sig = c.null_test?.significant_05 ?? 0;
  const total = c.null_test?.total_metrics ?? 0;
  const strong = z >= 20;
  return (
    <div
      className={`rounded-lg border p-4 ${
        strong
          ? "border-li-green/25 bg-li-green/[0.03]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-base text-white truncate">{label}</div>
        <span className="text-[10px] font-mono text-white/40 ml-2">{c.corpus_id}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
        <div>
          <span className="text-white/40">n </span>
          <span className="text-white/90">{c.survivor_count.toLocaleString()}</span>
        </div>
        <div className="text-right">
          <span className="text-white/40">sig </span>
          <span className="text-white/90">
            {sig}/{total}
          </span>
        </div>
        <div className="text-right">
          <span className="text-white/40">z </span>
          <span className={strong ? "text-li-green" : "text-li-cyan"}>
            {z.toFixed(1)}σ
          </span>
        </div>
      </div>
      {c.top_entity_name && (
        <div className="mt-2 text-[11px] text-white/50 truncate">
          top: {(c as any).top_entity_resolved?.display ?? c.top_entity_name}
        </div>
      )}
    </div>
  );
}
