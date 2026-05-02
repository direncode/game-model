import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { PulseData } from "./PulseData";

export const metadata: Metadata = {
  title: "Pulse · USPTO Inventors · Latent Ocean",
  description:
    "Fifty years of US innovation, deterministically disambiguated. A 500k inventor-record stratified sample across 1976-2025, fingerprinted under the BTUT primitive, with a multi-baseline disambiguation panel (engine vs PatentsView vs naive-name vs chance) at the centerpiece.",
};

export default function PulseUsptoShowcasePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-20 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              USPTO × Latent Ocean · scholarly artifact
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,116px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              500,000 inventor-records.<br />
              <span className="text-white/45">Fifty years.</span><br />
              <span className="text-white/45">One disambiguation.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              An applied study of one open IP archive, the United States Patent
              and Trademark Office&apos;s bulk patent record from 1976 forward,
              through a deterministic structural lens. The corpus is a
              stratified representative sample of 500,000 inventor-records (one
              per inventor-appearance on a granted patent) drawn from
              PatentsView&apos;s monthly bulk distribution, spanning fifty
              years of US innovation across all USPTO IPC classes.
            </p>
            <p className="mt-5 text-lg text-white/75 max-w-3xl leading-relaxed">
              The corpus is passed through Latent Ocean&apos;s formation
              pipeline: deterministic 48-bit structural fingerprints under the
              BTUT primitive, k-means taxonomy on Hamming distance, and a
              RunPod GPU finalize. The fingerprint sees only the inventor&apos;s
              canonicalized name plus their co-inventor list, plus the assignee
              identifier, plus the city/state/country. PatentsView&apos;s gold
              <code className="font-mono text-white/85 text-sm"> disambig_inventor_id </code>
              is held out of the fingerprint payload entirely so the cluster-
              purity claim is honest.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              This page mirrors{" "}
              <Link href="/atlas/arxiv" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/atlas/arxiv</Link>
              {" "}in shape and rhetoric, applied to inventor disambiguation
              instead of paper-level structural mapping. Every number on this
              page is fetched from{" "}
              <code className="font-mono text-white/85 text-sm">/api/range-public/showcase/pulse</code>.
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
              <Link href="/pulse/uspto-inventors/constellations" className="inline-flex items-center h-7 px-3 rounded-full bg-white text-black uppercase tracking-[0.18em] font-mono text-[10.5px] hover:bg-white/90 transition-colors">
                constellations · findings catalog →
              </Link>
            </div>
          </div>
        </section>

        {/* Preface */}
        <Section anchor="preface" kicker="Preface · the archive in question" title="USPTO patents are a working record of contemporary inventors.">
          <Prose>
            <p>
              The US patent record is not a humanities archive of long-dead
              authors. It is the daily public record of applied invention by
              people who are, in the statistical majority, still alive, still
              filing, and still litigating. Inventor identity has direct legal
              consequence (priority, royalty entitlement, employment
              disputes), so the disambiguation claim made here is not academic.
            </p>
            <p>
              A 48-bit structural fingerprint cannot tell you whether a patent
              is novel, valid, or infringed. It can only measure where a given
              inventor-record sits relative to the 500,000 other surviving
              inventor-records in a deterministic geometric space. Where the
              engine surfaces a cluster as a candidate singularly-prolific
              inventor, the page reports the metrics and links to USPTO. The
              page makes no claim about who any cluster represents; that
              identification is upstream of any structural metric.
            </p>
            <p>
              The deepest finding here is not a single number. It is that the
              engine, given only canonicalized name + co-inventor list +
              assignee + city/state/country, recovers the bulk of
              PatentsView&apos;s disambiguation unsupervised, while clearly
              outperforming the naive baseline (collapse all records with
              identical canonical_name) on the cases where common-name
              collision matters most.
            </p>
          </Prose>
        </Section>

        {/* The corpus */}
        <Section anchor="corpus" kicker="The corpus" title="A pinned PatentsView snapshot, two-stage stratified.">
          <Prose>
            <p>
              The PatentsView bulk TSV files are downloaded from{" "}
              <a href="https://patentsview.org/download/data-download-tables" target="_blank" rel="noopener noreferrer" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">
                patentsview.org
              </a>{" "}
              as a coordinated bundle: <code className="font-mono text-sm">g_inventor_disambiguated.tsv</code>{" "}
              (the gold standard), <code className="font-mono text-sm">g_inventor_not_disambiguated.tsv</code>{" "}
              (the raw inventor strings from the patent), <code className="font-mono text-sm">g_assignee_disambiguated.tsv</code>,
              <code className="font-mono text-sm"> g_location_disambiguated.tsv</code>, and <code className="font-mono text-sm">g_patent.tsv</code>.
              The harvester at{" "}
              <code className="font-mono text-white/80 text-sm">scripts/pulse_harvest.py</code>{" "}
              joins these on patent_id, normalizes inventor names to canonical
              &ldquo;Surname I I&rdquo; form (so &ldquo;John W. Smith&rdquo; and
              &ldquo;J. W. Smith&rdquo; become the same fingerprint payload),
              collects each record&apos;s co-inventors and assignee + location
              metadata, and emits one canonical NDJSON record per
              inventor-appearance.
            </p>
            <p>
              The fingerprint payload is the canonicalized name plus the
              pipe-separated co-inventor canonical names plus the assignee
              identifier plus city/state/country, full stop. PatentsView&apos;s
              <code className="font-mono text-sm"> disambig_inventor_id </code>
              is kept as a metadata field but never enters the fingerprint
              text. Including it would make the cluster-purity-vs-PatentsView
              comparison a tautology: the engine would just be parroting the
              gold label it was given. Excluding it makes the recovery claim
              honest.
            </p>
            <p>
              Two-stage sampling preserves the disambiguation signal for
              uncommon-name inventors while down-sampling ultra-common names.
              For canonical_names with at most <code className="font-mono text-sm">per_name_cap</code>
              {" "}appearances (default 100), all records are kept; for
              ultra-common names, stride sampling brings the bucket down to
              the cap. The 500,000-record total is set by the platform&apos;s
              MAX_CHUNKS = 100 ceiling on a single formation. The decision is
              documented in{" "}
              <code className="font-mono text-white/80 text-sm">docs/superpowers/specs/2026-05-02-atlas-arxiv-recon.md</code>.
            </p>
          </Prose>
        </Section>

        {/* The data block — fetches /api/range-public/showcase/pulse */}
        <Section anchor="data" kicker="Live artifact" title="The numbers below are fetched at page-load.">
          <PulseData />
        </Section>

        {/* Limits */}
        <Section anchor="limits" kicker="Limits · what this artifact does not claim" title="The boundaries kept honest.">
          <Prose>
            <p>
              <span className="text-white">It is not literal ground truth.</span>{" "}
              PatentsView&apos;s <code className="font-mono text-sm">disambig_inventor_id</code>{" "}
              is itself an algorithmic disambiguation, not God&apos;s-eye-view
              truth. The multi-baseline panel makes this honest: the engine&apos;s
              recovery is reported alongside the chance baseline, the
              naive-name baseline, and PatentsView itself as the gold by
              definition.
            </p>
            <p>
              <span className="text-white">It does not capture every patent.</span>{" "}
              The 500k stratified sample is a representative subset. Specific
              inventor-records are dropped via deterministic stride. The
              verification recipe re-derives the same 500k given the same
              PatentsView snapshot.
            </p>
            <p>
              <span className="text-white">It does not include patents
              granted before 1976.</span> USPTO bulk distribution starts at
              1976. Mary Anderson&apos;s 1903 windshield-wiper patent (US 743,801)
              and the entire pre-1976 historical record are out of scope.
            </p>
            <p>
              <span className="text-white">It uses primary IPC class only.</span>{" "}
              Patents cross-listed across multiple IPC classes are credited to
              their first-listed class for the polymath-bleed analysis.
            </p>
            <p>
              <span className="text-white">It does not name singular
              inventors.</span> The artifact surfaces clusters that score high
              on productivity, IPC entropy, career span, and solo-share. Readers
              click through to USPTO to identify them. Pulse refuses to make
              the curatorial call from algorithmic signals alone.
            </p>
          </Prose>
        </Section>

        {/* Acknowledgements */}
        <Section anchor="ack" kicker="Acknowledgements" title="Standing on a long disambiguation lineage.">
          <Prose>
            <p>
              PatentsView is a research project of the USPTO Office of the
              Chief Economist that has produced the most-used inventor-
              disambiguation algorithm for academic patent analysis since the
              early 2010s. Pulse exists only because PatentsView made its
              disambiguated bulk data openly redistributable.
            </p>
            <p>
              The USPTO bulk data distribution at{" "}
              <a href="https://bulkdata.uspto.gov" target="_blank" rel="noopener noreferrer" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">
                bulkdata.uspto.gov
              </a>{" "}
              is the upstream source PatentsView itself derives from. The
              chain of custody from raw USPTO XML to PatentsView&apos;s TSVs
              to Pulse&apos;s NDJSON is fully open and auditable.
            </p>
            <p>
              The Atlas scholarly artifact at{" "}
              <Link href="/atlas/arxiv" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/atlas/arxiv</Link>{" "}
              is the substrate Pulse extends. The DocSouth artifact at{" "}
              <Link href="/docsouth" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/docsouth</Link>{" "}
              is the original. Three artifacts, one substrate: humanities,
              science, and applied IP, mapped by the same engine.
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
