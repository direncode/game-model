import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { AtlasData } from "./AtlasData";

export const metadata: Metadata = {
  title: "Atlas · arXiv · Latent Ocean",
  description:
    "Thirty years of scientific discourse, mapped and re-derivable forever. A reproducible map of 500,000 arXiv papers across all eight disciplines, with full disclosure of method, baselines, and where disciplines bleed into each other.",
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
              A reproducible map of arXiv — Cornell University&apos;s
              public preprint archive, the daily reading list for working
              scientists. We took 500,000 papers spread evenly across 35
              years (1991-2025) and across all eight disciplines arXiv
              covers — computer science, math, physics, biology, finance,
              statistics, economics, electrical engineering — and ran
              them through our engine. Every paper got a compact
              reproducible signature. We grouped the signatures and
              checked whether the groups matched the disciplines.
            </p>
            <p className="mt-5 text-lg text-white/75 max-w-3xl leading-relaxed">
              The point of this page is not the engine. The point is
              that every number you see can be re-derived. Anyone who
              downloads the same arXiv snapshot will produce identical
              signatures, identical groups, identical findings. No
              guessing, no version drift, no model retraining changes
              the answer. Decade after decade, the same input gives the
              same result.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              For the engineering version of the same story, with the
              technical primitives and library calls documented in full,
              see{" "}
              <Link href="/method" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/method</Link>.
              The companion findings catalog is at{" "}
              <Link href="/atlas/arxiv/constellations" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/atlas/arxiv/constellations</Link>.
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
              The engine cannot tell you whether a paper is correct,
              original, or important. It only measures whether a paper
              looks like the others in the corpus, or stands apart from
              them. Where the engine flags a paper as standing apart,
              this page names it and links to the original on
              arxiv.org. The page makes no claim about quality or
              priority; that judgment is for a domain expert.
            </p>
            <p>
              The deepest finding here is not a single number. It is
              that the engine, never told which discipline a paper
              belongs to, sorts the 500,000 papers into groups that
              mostly match the discipline labels arXiv&apos;s authors
              chose for themselves. The baseline panel below is honest
              about how the engine compares to standard text-clustering
              tools on the same corpus.
            </p>
          </Prose>
        </Section>

        {/* The corpus */}
        <Section anchor="corpus" kicker="The corpus" title="A pinned Kaggle snapshot, stratified across thirty years.">
          <Prose>
            <p>
              The arXiv data comes from{" "}
              <a href="https://www.kaggle.com/datasets/Cornell-University/arxiv" target="_blank" rel="noopener noreferrer" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">
                Cornell University&apos;s public arXiv dataset
              </a>{" "}
              — a monthly snapshot of every paper&apos;s title, abstract,
              authors, and discipline tags. We pin to a specific
              snapshot date so that anyone, anywhere, can re-download
              the same file and reproduce the entire artifact byte for
              byte. We sample evenly across the 35 years (about 14,500
              papers per year) so the artifact represents the full span
              of arXiv&apos;s history, not just the recent boom.
            </p>
            <p>
              The engine looks at the title and the abstract. That is
              all. It never sees which discipline arXiv has tagged the
              paper with. This is on purpose: claiming the engine
              recovers arXiv&apos;s discipline structure on its own
              would be meaningless if the engine had been told the
              answer. By holding the discipline tags out of view, the
              recovery — when it happens — is a real finding.
            </p>
            <p>
              The 500,000-paper sample is what fits in a single run on
              the current platform. The full arXiv archive is roughly
              five times larger. The sample preserves the 35-year
              span, all eight disciplines, and the proportional mix
              between them; what it sacrifices is paper-level
              completeness.
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
              review.</span> The engine produces signatures and named
              records. Whether an emerging-group signal
              represents transformer-era deep learning, mRNA vaccine
              technology, or some other field is for a domain expert to
              read and decide. Atlas refuses to name the candidate
              clusters; it surfaces them and lets the reader judge.
            </p>
            <p>
              <span className="text-white">It does not capture every
              paper.</span> The 500,000-paper sample is roughly 20% of
              everything arXiv has ever published. The discipline mix
              and the year mix are preserved; specific papers are not
              all there. Anyone with the same monthly snapshot of arXiv
              can re-derive the exact same 500,000.
            </p>
            <p>
              <span className="text-white">It is not the strongest
              text-mining tool you could point at arXiv.</span>{" "}
              Specialized text-clustering tools may match or beat the
              engine on this kind of data. What the engine offers
              instead is reproducibility — same input today, same answer
              in 2030 — and a small, citable artifact you can attach to
              a paper or a contract.
            </p>
            <p>
              <span className="text-white">It does not handle
              non-English abstracts well.</span> A small fraction of
              arXiv abstracts (mostly French math papers) are not in
              English. They tend to come up as outliers in the
              rare-records list, because their language stands apart
              from the English-dominated bulk. That&apos;s honest
              behavior, not a bug.
            </p>
            <p>
              <span className="text-white">It uses each paper&apos;s
              first-listed discipline.</span> Papers tagged with
              several disciplines (e.g., a machine-learning paper
              tagged both computer-science and statistics) are
              credited to whichever the author listed first.
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
              dataset is the monthly bulk export of arXiv metadata; it
              is the public source we pinned this artifact to. Without
              the Kaggle dataset team and the arXiv maintainers, none
              of this exists.
            </p>
            <p>
              The DocSouth artifact at{" "}
              <Link href="/docsouth" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/docsouth</Link>{" "}
              is the original engagement Atlas is built on. The same
              engine that mapped a humanities archive of slave
              narratives, southern literature, and church history now
              maps a scientific archive of computer science, math, and
              physics — without any change to the engine itself.
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
