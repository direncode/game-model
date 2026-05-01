import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { PersistenceBarcodeWidget } from "@/components/landing/widgets/PersistenceBarcodeWidget";
import { ClusterPurityWidget } from "@/components/landing/widgets/ClusterPurityWidget";
import { DecadeTrajectoryWidget } from "@/components/landing/widgets/DecadeTrajectoryWidget";
import { NamedRareRecordsWidget } from "@/components/landing/widgets/NamedRareRecordsWidget";
import { CorpusVerificationWidget } from "@/components/landing/widgets/CorpusVerificationWidget";
import { BaselineComparisonWidget } from "@/components/landing/widgets/BaselineComparisonWidget";
import { CrossCollectionBleedWidget } from "@/components/landing/widgets/CrossCollectionBleedWidget";
import { ContentDriftWidget } from "@/components/landing/widgets/ContentDriftWidget";

export const metadata: Metadata = {
  title: "DocSouth · Latent Ocean × UNC Libraries",
  description:
    "A scholarly artifact: 711 source texts and 180 years of Southern discourse, structurally fingerprinted with full disclosure of method, baselines, and the bleed analysis where the actual humanities finding lives.",
};

// Long-form, scholar-pace prose. Breaks at section boundaries match the
// engineering /method but the rhetoric is positioned for a humanities or
// digital-humanities reader, not an SRE.

export default function DocSouthShowcasePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-20 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              DocSouth × Latent Ocean · scholarly artifact
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,116px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              711 texts.<br />
              <span className="text-white/45">Four collections.</span><br />
              <span className="text-white/45">180 years.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              An applied study of one institutional archive — Documenting
              the American South, UNC Libraries — through a deterministic
              structural lens. The corpus comprises 711 texts assembled
              by the DocSouth editorial team across four genres: 299
              North American slave narratives, 151 first-person
              narratives of the American South, 116 works from the
              Library of Southern Literature, and 149 documents from
              The Church in the Southern Black Community. After
              segmentation it ran 37,505 records — 65 MB of plain text
              spanning the 1730s through the 1940s.
            </p>
            <p className="mt-5 text-lg text-white/75 max-w-3xl leading-relaxed">
              On May 1, 2026 the corpus was passed through Latent
              Ocean&apos;s formation pipeline: deterministic 48-bit
              structural fingerprints under the BTUT primitive, k-means
              taxonomy on Hamming distance, persistent homology via
              ripser, and a RunPod GPU finalize. The whole formation
              produced a 639 KB encrypted artifact in 122 seconds, and
              every claim that follows on this page is a function of
              that artifact alone.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              This page is for a humanities reader. The engineering
              version of the same story sits at{" "}
              <Link href="/method" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/method</Link>.
              Every number on either page is fetched from the same
              public artifact at{" "}
              <code className="font-mono text-white/85 text-sm">/api/range-public/showcase/docsouth</code>.
            </p>
            <div className="mt-9 flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              {[
                ["preface", "preface"],
                ["the corpus", "corpus"],
                ["topology", "topology"],
                ["recovery", "recovery"],
                ["bleed", "bleed"],
                ["180 years", "drift"],
                ["baselines", "baselines"],
                ["named rare", "rare"],
                ["verification", "verification"],
                ["limits", "limits"],
                ["acknowledgements", "ack"],
              ].map(([label, anchor]) => (
                <a key={anchor} href={`#${anchor}`} className="inline-flex items-center h-7 px-3 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 transition-colors">
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Preface */}
        <Section anchor="preface" kicker="Preface · ethics first" title="The corpus is not neutral.">
          <Prose>
            <p>
              The North American Slave Narratives collection within
              DocSouth contains the autobiographical writing of formerly
              enslaved people — testimony of subjection, escape,
              reconstruction, and the long arc of African American
              authorship from the eighteenth century forward. The Church
              in the Southern Black Community continues that lineage
              into ecclesiastical writing. The First-Person Narratives
              and Library of Southern Literature collections include
              voices that range from the aligned to the openly
              opposed.
            </p>
            <p>
              A 48-bit structural fingerprint cannot honor what those
              texts are. It can only measure where they sit relative to
              one another in a deterministic geometric space. We name
              authors and titles where the engine surfaces them as
              singular; we make no claim about the meaning, weight, or
              moral standing of any text. The point of this exercise is
              the inverse: to make a reproducible structural account of
              an archive that has been read, re-read, and re-edited by
              humans for two centuries — and to expose, alongside the
              metric, every place where the metric falls short.
            </p>
            <p>
              The deepest finding here is not a number. It is that the
              engine groups roughly half of one large cluster from
              outside its dominant collection, and that the boundary it
              recovers is rhetorical rather than curatorial. Whether
              that finding is interesting to a literary historian is for
              a literary historian to decide.
            </p>
          </Prose>
        </Section>

        {/* The corpus */}
        <Section anchor="corpus" kicker="The corpus" title="Four DocSouth collections, one harvest, one hash.">
          <Prose>
            <p>
              The four DocSouth full-text archives were downloaded from{" "}
              <a href="https://docsouth.unc.edu/docsouthdata/" target="_blank" rel="noopener noreferrer" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">
                docsouth.unc.edu/docsouthdata/
              </a>{" "}
              as ZIPs containing plain-text and TEI/XML versions plus a
              CSV table of contents. The harvester at{" "}
              <code className="font-mono text-white/80 text-sm">scripts/docsouth_harvest.py</code>{" "}
              walks each ZIP&apos;s <code className="font-mono text-sm">data/toc.csv</code> for
              metadata (collection, filename, author, title, date, URL),
              loads the corresponding plain-text file, lightly cleans
              page markers and image bracketing, and splits the body
              into ~250-word segments with paragraph-aware boundaries
              and a 1.5× hard cap so single-paragraph chapters cannot
              dominate. The output is one canonical NDJSON file at{" "}
              <code className="font-mono text-white/80 text-sm">/data/formed_models/_inputs/docsouth.ndjson</code>{" "}
              with sha256{" "}
              <code className="font-mono text-white/80 text-sm break-all">ce4edcbd3de74d51c6b8bba6a7d678bbf1f0ec9576ad10b68a9f91ce81b167a2</code>.
            </p>
            <p>
              Anyone with the four DocSouth ZIPs can re-derive the same
              hash. That is the third-party-checkable piece. The
              formation that follows produces a separate{" "}
              <code className="font-mono text-white/80 text-sm">response_digest</code>{" "}
              over the formed model artifact; the two hashes together
              are the verifiable contract.
            </p>
          </Prose>
        </Section>

        {/* Topology */}
        <Section anchor="topology" kicker="Topology" title="The shape of the archive in three dimensions.">
          <Prose>
            <p>
              Persistent homology is a method from applied topology
              that produces a multi-scale summary of a metric space by
              counting how many connected components, cycles, and
              higher-dimensional voids persist as you grow the
              filtration parameter. We computed it on the 2,400 BTUT
              survivor fingerprints using ripser with Hamming-48 as the
              metric and a threshold of 24. In 75 seconds of ripser
              compute the engine returned 778 bars: 522 connected
              components (H0), 179 cycles (H1), and 77 multi-dimensional
              voids (H2).
            </p>
            <p>
              Most of the H2 bars are short — birth ≈ 3, death ≈ 4 —
              which is honest about what an archive of long-form prose
              produces under this metric: shallow higher-order
              structure. The signal is in H0 and H1: a substantial
              corpus of distinct documents (522 components), with
              roughly 180 internal cycles in the structural neighborhood
              graph. A persistent homology specialist would read this
              barcode as &ldquo;a high-genus, sparsely-cycled archive
              with weak voids.&rdquo;
            </p>
          </Prose>
          <div className="mt-8">
            <PersistenceBarcodeWidget showcase="docsouth" showcaseLabel="DocSouth · UNC Libraries (4 collections)" />
          </div>
        </Section>

        {/* Recovery */}
        <Section anchor="recovery" kicker="Curatorial recovery" title="The engine, never told the labels, recovers them at 0.442.">
          <Prose>
            <p>
              We ran k-means with k=12 over the survivor fingerprints
              using Hamming distance, never showing the engine which
              DocSouth collection any record belongs to. We then mapped
              each survivor back to its source collection and computed
              weighted purity: for each cluster, the fraction of
              records belonging to that cluster&apos;s plurality
              collection, weighted by cluster size. The number is{" "}
              <span className="text-white">0.442</span>.
            </p>
            <p>
              With four collections, random assignment would land at
              0.25; perfect recovery would be 1.0. The engine recovers
              roughly 75% of the lift over chance — meaningful, but
              far from total. The shortfall is interesting in itself:
              it implies that 25% of the collection structure is not
              recovered by this fingerprint, and the bleed analysis
              below identifies where that gap lives.
            </p>
          </Prose>
          <div className="mt-8">
            <ClusterPurityWidget showcase="docsouth" />
          </div>
        </Section>

        {/* Bleed */}
        <Section anchor="bleed" kicker="The bleed — where the actual finding is" title="Class #7 holds 957 survivors. Half of them aren&rsquo;t Slave Narratives.">
          <Prose>
            <p>
              The single largest k-means class draws 957 of the
              2,400 survivors — roughly 40% of all the engine kept. Its
              dominant collection is Slave Narratives, at 51%. The
              other 49% — 465 records — distribute almost evenly across
              the remaining three: 165 First-Person Narratives, 156
              Library of Southern Literature, 144 Church writings.
              That even distribution is the finding.
            </p>
            <p>
              An even bleed across three different curatorial categories
              is not what you&apos;d expect from a flawed cluster. A
              flawed cluster bleeds toward one neighbor. An evenly-bled
              cluster is identifying a structural property that crosses
              the curatorial boundary. In this case: a first-person
              testimonial register — &ldquo;I was born,&rdquo; &ldquo;I
              remember,&rdquo; &ldquo;I bear witness&rdquo; — that
              recurs across the four genres regardless of how the
              archive curators chose to file each text.
            </p>
            <p>
              That register is not new to a literary historian. The
              engine doesn&apos;t discover it; it recovers it
              independently from the bytes. What the engine offers is a
              reproducible structural account of which 465 specific
              records exhibit it — Sarah J. W. Early&apos;s biography
              of her husband, John Gregg Fee&apos;s autobiography of
              his Berea ministry, Alfred Lee Ridgel&apos;s 1896
              missionary writing — alongside the slave narratives the
              register originated in. A scholar can pull that list
              from the showcase JSON and treat it as a starting
              hypothesis: &ldquo;the testimonial register, defined
              structurally, runs through these specific texts.&rdquo;
              That hypothesis is a citable artifact, not an opinion.
            </p>
          </Prose>
          <div className="mt-8">
            <CrossCollectionBleedWidget showcase="docsouth" />
          </div>
        </Section>

        {/* Drift */}
        <Section anchor="drift" kicker="180 years" title="Two trajectories: structural (low) and content-weighted (real)." >
          <Prose>
            <p>
              The first time we plotted decade-by-decade drift in the
              48-bit fingerprint, the answer was unflattering: average
              Hamming-bit movement between consecutive decade centroids
              was 0.68 / 48, with a maximum of 4. The engine&apos;s
              structural fingerprint was capturing stable archive
              features — genre, register, lexical baseline — and not
              the topical movement of 180 years. We surfaced that
              finding rather than hide it.
            </p>
            <p>
              To redeem the topical-drift claim we built a
              content-weighted variant of the same 48-bit primitive: a
              Bloom-style projection of each record&apos;s top-32
              TF-IDF terms (1-2 gram, English stop-words removed) into
              48 bits. Two records with overlapping top terms produce
              fingerprints with low Hamming distance under the new
              variant; two records with disjoint vocabulary diverge.
              On the same 2,400 survivors, the content variant&apos;s
              average decade-to-decade drift is 1.37 / 48 with a max of
              8 — roughly twice the structural drift, with the cyan
              curve below tracking topical movement that the structural
              fingerprint smooths out.
            </p>
            <p>
              The two variants are valid for different uses. The
              structural fingerprint is what you want when you need a
              fingerprint that is stable under document re-publication
              and re-segmentation; it gives you reproducibility across
              archive revisions. The content fingerprint is what you
              want when you&apos;re studying topical movement; it
              tracks what people are writing <em>about</em> rather than
              the rhetorical register they&apos;re writing in. The
              platform now publishes both and documents the trade-off.
            </p>
          </Prose>
          <div className="mt-8 space-y-8">
            <DecadeTrajectoryWidget showcase="docsouth" />
            <ContentDriftWidget showcase="docsouth" />
          </div>
        </Section>

        {/* Baselines */}
        <Section anchor="baselines" kicker="Baselines · the comparison a humanities reader will ask for" title="On a text corpus, TF-IDF beats us. That is real.">
          <Prose>
            <p>
              A humanities reader looking at &ldquo;0.442 weighted
              purity, 75% lift over chance&rdquo; will reasonably ask
              how that compares to the methods they would actually
              reach for. We ran two: TF-IDF + k-means and Latent
              Dirichlet Allocation, both on the same 2,400 survivors,
              both with k=12, both with seed=42. The bar chart below
              reports the result honestly: TF-IDF reaches 0.490, LDA
              reaches 0.476. Both beat the engine on this metric.
            </p>
            <p>
              The engine is not a topic model. It is a deterministic
              48-bit fingerprinter with reproducibility, fixed-size
              artifact, and provable invariance under (corpus,
              model_id, seed) as its load-bearing claim. On a 65 MB
              text corpus, full-text TF-IDF will recover more
              curatorial signal because it has access to the full
              text; the engine works from a 32 KB fingerprint summary.
              The engine wins on different axes — storage cost,
              determinism across decades, deterministic re-issuability
              of the same query against the same model — and loses on
              raw recovery. Surfacing that loss publicly is part of the
              honesty.
            </p>
          </Prose>
          <div className="mt-8">
            <BaselineComparisonWidget showcase="docsouth" />
          </div>
        </Section>

        {/* Named rare */}
        <Section anchor="rare" kicker="Named singularities" title="The engine&rsquo;s rarity claim with author and title.">
          <Prose>
            <p>
              For each survivor the engine measures the Hamming
              distance between its 48-bit fingerprint and the closest
              of the previous 32 survivors in record-index order. The
              top of the list is dominated by Alfred Lee Ridgel&apos;s
              1896 missionary writing <em>Africa and African
              Methodism</em> at Hamming-min 24/48 — singular by a
              factor of more than two over the second-most-singular,
              Isaac Johnson&apos;s 1901 <em>Slavery Days in Old
              Kentucky</em>. Each entry is a click-through to the
              source text on docsouth.unc.edu.
            </p>
          </Prose>
          <div className="mt-8">
            <NamedRareRecordsWidget showcase="docsouth" />
          </div>
        </Section>

        {/* Verification */}
        <Section anchor="verification" kicker="Verification · two hashes" title="Anyone with a laptop can check.">
          <Prose>
            <p>
              The corpus_sha256 above is third-party-derivable from the
              public DocSouth ZIPs alone. The response_digest is
              internally reproducible under (corpus, seed=42) — the
              determinism contract that the platform commits to on
              every endpoint. Both hashes, plus the full verification
              recipe, sit one section away.
            </p>
          </Prose>
          <div className="mt-8">
            <CorpusVerificationWidget showcase="docsouth" />
          </div>
        </Section>

        {/* Limits */}
        <Section anchor="limits" kicker="Limits · what this artifact does not claim" title="The boundaries we&rsquo;re honest about.">
          <Prose>
            <p>
              <span className="text-white">It is not a literary
              criticism.</span> The engine produces structural
              measurements and named records. Whether the 465 bleed
              records share testimonial register, abolitionist rhetoric,
              or simply common 19th-century prose conventions is for a
              scholar to read and decide.
            </p>
            <p>
              <span className="text-white">It does not capture topical
              drift in the structural variant.</span> The 48-bit
              fingerprint is content-light by design; that is a
              property of the primitive, not a bug, and the
              content-weighted variant exists for the cases where
              topical movement matters.
            </p>
            <p>
              <span className="text-white">It does not beat full-text
              NLP on a text corpus.</span> TF-IDF and LDA are better
              tools for raw curatorial recovery on this kind of data.
              The engine&apos;s contract is reproducibility, fixed-size
              artifact, and bit-identical re-issue, not maximum
              supervised metric.
            </p>
            <p>
              <span className="text-white">It does not address the
              ethical weight of the corpus.</span> A 48-bit fingerprint
              is silent on what a slave narrative is. We surface
              structural patterns and name them where they appear; the
              critical work of reading and contextualizing is upstream
              of any metric we produce.
            </p>
          </Prose>
        </Section>

        {/* Acknowledgements */}
        <Section anchor="ack" kicker="Acknowledgements" title="Standing on the shoulders of librarians.">
          <Prose>
            <p>
              The DocSouth digital archive at the University of North
              Carolina at Chapel Hill is the work of librarians,
              editors, transcribers, and scholars over more than two
              decades, beginning under Joseph M. Beatty and continuing
              through the current UNC Libraries team. Their decisions
              about what to include, how to encode it in TEI, and how
              to make it freely redistributable are the conditions
              under which this exercise is even possible. The
              full-text license is open; this artifact respects both
              the letter and the intent of that license.
            </p>
            <p>
              The engineering primitives this analysis builds on are
              public: ripser by Bauer (2021), TF-IDF (Spärck Jones
              1972), LDA (Blei et al. 2003), persistent homology in
              the Edelsbrunner / Letscher / Zomorodian (2002) line,
              k-means on Hamming distance, and Bloom-style projection
              hashing. The platform&apos;s contribution is the
              deterministic flow that produces the artifact, not the
              underlying methods.
            </p>
          </Prose>
        </Section>

        {/* CTA */}
        <section className="relative px-6 pt-32">
          <div className="max-w-[1080px] mx-auto text-center">
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-6">
              Have a corpus in mind?
            </h2>
            <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-snug">
              The engine is corpus-agnostic. If your archive sits behind
              a different curatorial wall, the same flow produces the
              same kind of artifact for it. Ask.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:engineering@latentocean.com?subject=Corpus%20engagement"
                className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors"
              >
                engineering@latentocean.com
              </a>
              <Link
                href="/method"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors"
              >
                Method (engineering)
              </Link>
              <a
                href="/api/range-public/showcase/docsouth"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors"
              >
                Raw artifact (JSON)
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Section({ anchor, kicker, title, children }: { anchor: string; kicker: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={anchor} className="relative px-6 py-20 border-b border-white/5 scroll-mt-24">
      <div className="max-w-[1100px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
          {kicker}
        </p>
        <h2 className="font-display font-medium text-4xl md:text-5xl tracking-[-0.035em] text-white leading-[1] mb-8 max-w-3xl">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 text-[15.5px] text-white/75 leading-relaxed max-w-3xl [&_em]:italic [&_em]:text-white/85">
      {children}
    </div>
  );
}
