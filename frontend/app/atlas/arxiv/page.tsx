import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { AtlasData } from "./AtlasData";

export const metadata: Metadata = {
  title: "Atlas · arXiv · Latent Ocean",
  description:
    "Thirty years of scientific discourse, structurally sampled and citably mapped. A 500k-paper stratified sample across the eight arXiv archive disciplines, fingerprinted under the BTUT primitive, with full disclosure of method, baselines, and the cross-discipline bleed where the actual interdisciplinary finding lives.",
};

export default function AtlasArxivShowcasePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-20 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              arXiv × Latent Ocean · scholarly artifact
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,116px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              500,000 papers.<br />
              <span className="text-white/45">Eight disciplines.</span><br />
              <span className="text-white/45">Thirty years.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              An applied study of one open scientific archive, arXiv,
              hosted at Cornell University and distributed in bulk via
              Kaggle, through a deterministic structural lens. The
              corpus is a stratified representative sample of 500,000
              papers spanning 1991 through 2025: roughly 14,500 papers
              per year, drawn deterministically from the pinned monthly
              snapshot. Eight archive-level disciplines are represented:
              cs, math, physics, q-bio, q-fin, stat, econ, eess.
            </p>
            <p className="mt-5 text-lg text-white/75 max-w-3xl leading-relaxed">
              The corpus is passed through Latent Ocean&apos;s formation
              pipeline: deterministic 48-bit structural fingerprints
              under the BTUT primitive, k-means taxonomy on Hamming
              distance, persistent homology via ripser, and a RunPod GPU
              finalize. Every claim that follows on this page is a
              function of the resulting public artifact alone.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              This page mirrors{" "}
              <Link href="/docsouth" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/docsouth</Link>
              {" "}in shape and rhetoric, applied to a scientific
              archive instead of a humanities one. Every number on this
              page is fetched from the public artifact at{" "}
              <code className="font-mono text-white/85 text-sm">/api/range-public/showcase/atlas</code>.
            </p>
            <div className="mt-9 flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              {[
                ["preface", "preface"],
                ["the corpus", "corpus"],
                ["live artifact", "data"],
                ["limits", "limits"],
                ["acknowledgements", "ack"],
              ].map(([label, anchor]) => (
                <a key={anchor} href={`#${anchor}`} className="inline-flex items-center h-7 px-3 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 transition-colors">
                  {label}
                </a>
              ))}
              <Link href="/atlas/arxiv/constellations" className="inline-flex items-center h-7 px-3 rounded-full bg-white text-black uppercase tracking-[0.18em] font-mono text-[10.5px] hover:bg-white/90 transition-colors">
                constellations · findings catalog →
              </Link>
            </div>
          </div>
        </section>

        {/* Preface */}
        <Section anchor="preface" kicker="Preface · the archive in question" title="arXiv is a working archive of contemporary scientists.">
          <Prose>
            <p>
              Unlike a humanities archive of long-dead authors, arXiv is
              the daily preprint server of working scientists. Every
              paper in the corpus is by a person who is, in the
              statistical majority, still alive, still publishing, and
              still cited. Citation norms apply. Author identity matters.
              The artifact respects the corpus as a living scientific
              record, not a closed historical object.
            </p>
            <p>
              A 48-bit structural fingerprint cannot tell you whether a
              paper is correct, original, or important. It can only
              measure where the paper&apos;s prose sits relative to the
              500,000 other surviving fingerprints in a deterministic
              geometric space. Where the engine surfaces a paper as
              singular, the page names it and links to the canonical
              arxiv.org URL. The page makes no claim about quality,
              priority, or scientific weight; that judgment is upstream
              of any structural metric.
            </p>
            <p>
              The deepest finding here is not a single number. It is
              that the engine, never told the discipline labels,
              recovers the eight-archive structure of arXiv unsupervised
              from abstract+title text alone. The baseline panel below
              is honest about the gap between the engine&apos;s recovery
              and what TF-IDF + k-means or LDA topic-modeling can do on
              the same corpus.
            </p>
          </Prose>
        </Section>

        {/* The corpus */}
        <Section anchor="corpus" kicker="The corpus" title="A pinned Kaggle snapshot, stratified across thirty years.">
          <Prose>
            <p>
              The arXiv metadata is downloaded from{" "}
              <a href="https://www.kaggle.com/datasets/Cornell-University/arxiv" target="_blank" rel="noopener noreferrer" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">
                kaggle.com/datasets/Cornell-University/arxiv
              </a>{" "}
              as a single JSON-lines file (~1.5 GB) representing the
              monthly snapshot of all arXiv records with their title,
              abstract, primary category list, author list, and
              update_date. The harvester at{" "}
              <code className="font-mono text-white/80 text-sm">scripts/arxiv_harvest.py</code>{" "}
              filters withdrawn papers, papers updated after the pinned
              snapshot date, and papers with empty abstracts. It then
              groups by publication year and applies a deterministic
              stride sample to cap each year at the per-year target
              (~14,500). The output is a canonical NDJSON file at{" "}
              <code className="font-mono text-white/80 text-sm">/data/formed_models/_inputs/arxiv.ndjson</code>{" "}
              with two anchored hashes: <code className="font-mono text-sm">corpus_input_sha256</code>{" "}
              over the original Kaggle file, and <code className="font-mono text-sm">corpus_sha256</code>{" "}
              over the harvested NDJSON.
            </p>
            <p>
              The fingerprint payload is the title plus a blank line
              plus the abstract, full stop. Categories and authors are
              kept as metadata fields but never appear in the text the
              engine fingerprints. This is important: cluster-purity
              against arXiv&apos;s primary categories is only an honest
              unsupervised-recovery claim if the engine never saw the
              category labels. Including the categories in the
              fingerprint would make purity-vs-categories a tautology.
            </p>
            <p>
              The 500,000-paper sample size is set by the platform&apos;s
              MAX_CHUNKS = 100 ceiling on a single formation. The full
              arXiv corpus exceeds 2.5 million abstracts; the stratified
              sample preserves the 30-year span, the 8 disciplines, and
              the proportional category distribution at the cost of
              paper-level completeness. The decision is documented in{" "}
              <code className="font-mono text-white/80 text-sm">docs/superpowers/specs/2026-05-02-atlas-arxiv-recon.md</code>.
            </p>
          </Prose>
        </Section>

        {/* The data block — fetches /api/range-public/showcase/atlas */}
        <Section anchor="data" kicker="Live artifact" title="The numbers below are fetched at page-load.">
          <AtlasData />
        </Section>

        {/* Limits */}
        <Section anchor="limits" kicker="Limits · what this artifact does not claim" title="The boundaries kept honest.">
          <Prose>
            <p>
              <span className="text-white">It is not a literature
              review.</span> The engine produces structural measurements
              and named records. Whether an emerging-cluster signal
              represents transformer-era deep learning, mRNA vaccine
              technology, or some other field is for a domain expert to
              read and decide. Atlas refuses to name the candidate
              clusters; it surfaces them and lets the reader judge.
            </p>
            <p>
              <span className="text-white">It does not capture every
              paper.</span> The 500k stratified sample is roughly 20%
              of the full arXiv corpus. The proportional category mix is
              preserved but specific papers are dropped via deterministic
              stride. The verification recipe re-derives the same 500k
              given the same Kaggle snapshot.
            </p>
            <p>
              <span className="text-white">It does not beat full-text
              NLP on a text corpus.</span> TF-IDF and LDA may match or
              exceed the engine&apos;s recovery number on raw archive
              classification. The engine&apos;s contract is reproducibility,
              fixed-size artifact, and bit-identical re-issue, not maximum
              supervised metric.
            </p>
            <p>
              <span className="text-white">It does not handle
              non-English abstracts well.</span> A small fraction of
              arXiv abstracts (mostly French math papers) are in
              non-English languages. They tend to surface in the
              rare-records list because their lexical surface is
              structurally distant from the English-dominated bulk. This
              is honest behavior, not a bug.
            </p>
            <p>
              <span className="text-white">It uses primary category
              only.</span> Papers cross-listed across multiple
              categories (e.g., cs.LG + stat.ML) are credited to their
              first-listed category for the gold-standard purity
              calculation. The full categories list is retained in the
              NDJSON and exposed via the bleed analysis.
            </p>
          </Prose>
        </Section>

        {/* Acknowledgements */}
        <Section anchor="ack" kicker="Acknowledgements" title="Standing on a long open-access lineage.">
          <Prose>
            <p>
              arXiv was launched in 1991 by Paul Ginsparg at Los Alamos
              National Laboratory and is now hosted by the Cornell
              University Library. It is one of the oldest, most
              influential open-preprint archives in any scientific
              discipline. Atlas exists only because arXiv made its
              metadata, abstracts, and structural conventions openly
              redistributable.
            </p>
            <p>
              The Kaggle{" "}
              <a href="https://www.kaggle.com/datasets/Cornell-University/arxiv" target="_blank" rel="noopener noreferrer" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">
                Cornell-University/arxiv
              </a>{" "}
              dataset is maintained as a regular monthly bulk export of
              arXiv metadata and is the upstream source pinned by the{" "}
              <code className="font-mono text-sm">corpus_input_sha256</code>{" "}
              field above. The Kaggle dataset team and the arXiv
              maintainers are the people without whom this artifact is
              not possible.
            </p>
            <p>
              The DocSouth scholarly artifact at{" "}
              <Link href="/docsouth" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/docsouth</Link>{" "}
              is the substrate Atlas is built on. The harvester pattern,
              the analyze script, the constellations catalog, and the
              page voice are all extensions of the DocSouth shape: proof
              that the substrate generalizes from a humanities archive
              to a scientific archive without engine changes.
            </p>
          </Prose>
        </Section>
      </main>
    </div>
  );
}

function Section({
  anchor, kicker, title, children,
}: { anchor: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={anchor} className="px-6 border-b border-white/5 py-20 scroll-mt-24">
      <div className="max-w-[1100px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
          {kicker}
        </p>
        <h2 className="font-display font-medium text-[clamp(28px,4vw,52px)] leading-[1.04] tracking-[-0.025em] text-white max-w-3xl mb-8">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 text-white/75 max-w-3xl text-base leading-relaxed">
      {children}
    </div>
  );
}
