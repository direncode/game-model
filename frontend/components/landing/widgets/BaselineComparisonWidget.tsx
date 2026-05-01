"use client";

import { useEffect, useState } from "react";

// BaselineComparisonWidget
//
// On a text corpus, asking "does our engine beat chance at recovering
// curatorial structure?" is a low bar. The honest comparison is against
// the methods a humanities scholar would actually reach for: TF-IDF +
// k-means and Latent Dirichlet Allocation. We run both on the same 2,400
// BTUT survivors with k=12 and report weighted purity. The result is not
// flattering — and that's the whole point of publishing it.

type Baseline = {
  method: string;
  purity: number;
  k: number;
  note: string;
};

type ShowcaseData = {
  showcase: string;
  baselines?: Baseline[];
  cluster_purity?: { weighted_purity: number };
};

const LABELS: Record<string, { label: string; sub: string; tone: "muted" | "primary" | "neutral" }> = {
  chance:       { label: "chance",                   sub: "1/k random assignment",         tone: "muted" },
  engine:       { label: "engine · BTUT 48-bit + Hamming", sub: "deterministic, schema-agnostic", tone: "primary" },
  tfidf_kmeans: { label: "TF-IDF (1-2 gram, 20k) + KMeans", sub: "sklearn baseline, stop-words off", tone: "neutral" },
  lda_argmax:   { label: "LDA(K=12) argmax",         sub: "sklearn online VB, 20 iter",    tone: "neutral" },
  bert_kmeans:  { label: "BERT embeddings + KMeans", sub: "sentence-transformers · GPU",   tone: "neutral" },
};

type Props = {
  showcase?: string;
  compact?: boolean;
};

export function BaselineComparisonWidget({ showcase = "docsouth", compact = false }: Props) {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/range-public/showcase/${showcase}`, { cache: "force-cache" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [showcase]);

  if (err) return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.04] p-5 font-mono text-[11px] text-rose-300">{err}</div>;
  if (!data) return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">Loading baseline comparison …</div>;

  const baselines = data.baselines ?? [];
  if (!baselines.length) return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/45">No baselines computed for this showcase.</div>;

  const max = Math.max(...baselines.map((b) => b.purity));
  const engine = baselines.find((b) => b.method === "engine");
  const best = baselines.reduce((a, b) => (b.purity > a.purity ? b : a));

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.6fr_1fr]"} gap-6 lg:gap-10`}>
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Baseline comparison · weighted purity (k=12)
          </span>
          <span className="font-mono text-[10px] text-white/35 tabular-nums">
            higher = more curatorial signal recovered
          </span>
        </div>

        {/* Bars */}
        <div className="space-y-3">
          {baselines.map((b) => {
            const meta = LABELS[b.method] ?? { label: b.method, sub: b.note, tone: "neutral" as const };
            const widthPct = (b.purity / 1.0) * 100;
            const fill =
              meta.tone === "muted"   ? "rgba(255,255,255,0.18)" :
              meta.tone === "primary" ? "rgb(125, 211, 252)"     :
                                        "rgba(255,255,255,0.55)";
            const isBest = b.purity === max;
            return (
              <div key={b.method}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-mono text-[11px] text-white/85">
                    {meta.label}
                    {isBest && <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300">best</span>}
                  </span>
                  <span className="font-display text-[16px] tabular-nums text-white">
                    {b.purity.toFixed(3)}
                  </span>
                </div>
                <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${widthPct}%`, backgroundColor: fill, opacity: 0.85 }}
                  />
                </div>
                <div className="font-mono text-[10px] text-white/45 mt-1">{meta.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Honest interpretation bar */}
        <div className="mt-7 pt-5 border-t border-white/[0.06] grid grid-cols-2 gap-px bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
          <Stat
            label="engine vs chance"
            value={engine ? `+${(engine.purity - (baselines.find((b) => b.method === "chance")?.purity ?? 0.25)).toFixed(3)}` : "—"}
            hint={engine ? `${(((engine.purity / 0.25) - 1) * 100).toFixed(0)}% lift over random` : "—"}
          />
          <Stat
            label="engine vs best baseline"
            value={engine && best.method !== "engine" ? `${(engine.purity - best.purity).toFixed(3)}` : "0.000"}
            hint={best.method !== "engine" ? `${best.method} wins on raw recovery` : "engine is best"}
            tone={engine && best.method !== "engine" ? "negative" : "positive"}
          />
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
            What this admits
          </div>
          <p className="text-[13px] text-white/75 leading-snug">
            On a 2,400-record text corpus, full-text TF-IDF beats the
            engine's 48-bit structural fingerprint at curatorial-label
            recovery. So does LDA. The engine is a deterministic
            sampling primitive — not a topic model. It is competitive
            against chance, not against full-text NLP, on the recovery
            metric.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 font-mono text-[10.5px] text-white/55 leading-relaxed">
          <span className="text-white/85">Where the engine wins instead.</span>{" "}
          The engine's 2,400 fingerprints are a 32 KB artifact;
          re-deriving the TF-IDF baseline requires the full 65 MB
          corpus. The fingerprint's response_digest is byte-identical
          across runs forever; the TF-IDF clustering varies with
          random_state, sklearn version, and stop-word lists. The
          engine is sized for cold-storage reproducibility, not for
          maximum supervised metric on a text-rich archive. Surfacing
          this honestly is part of the contract.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint: string; tone?: "neutral" | "positive" | "negative" }) {
  const valueColor = tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-white";
  return (
    <div className="bg-black p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">{label}</div>
      <div className={`font-display text-[20px] tracking-[-0.02em] tabular-nums ${valueColor}`}>{value}</div>
      <div className="font-mono text-[9.5px] text-white/35 mt-1">{hint}</div>
    </div>
  );
}
