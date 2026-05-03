import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { PulseData } from "./PulseData";

export const metadata: Metadata = {
  title: "Pulse · USPTO Inventors · Latent Ocean",
  description:
    "Fifty years of US innovation, deterministically disambiguated. 500,000 inventor-records 1976-2025 with a multi-baseline panel: engine vs the PatentsView gold answer vs match-by-name-only vs chance.",
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
              The hardest question in patent analytics is also the simplest
              one: which patents were filed by the same person? US patent
              records spell names a hundred different ways. &ldquo;John W.
              Smith&rdquo; on one patent, &ldquo;J. W. Smith&rdquo; on
              another, &ldquo;John Smith&rdquo; on a third. We took 500,000
              inventor-records spanning fifty years and tried to figure out
              which ones are the same person.
            </p>
            <p className="mt-5 text-lg text-white/75 max-w-3xl leading-relaxed">
              The engine looks at four things on each record: the inventor&apos;s
              name (with the spelling variations smoothed out), who else is
              listed as a co-inventor on that patent, who the patent was
              assigned to (Apple Inc., Google LLC, etc.), and the inventor&apos;s
              city, state, and country. Nothing else. The engine never sees
              the gold-standard answer that PatentsView (the standard
              academic disambiguation tool) computed, so when our groups
              match PatentsView&apos;s inventor IDs, that&apos;s a real finding,
              not a parroted answer.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              For the engineering version of this same story, see{" "}
              <Link href="/method" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/method</Link>.
              The companion findings catalog is at{" "}
              <Link href="/pulse/uspto-inventors/constellations" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/pulse/uspto-inventors/constellations</Link>.
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
              The engine cannot tell you whether a patent is novel, valid,
              or being infringed. It only tells you which inventor-records
              look enough like each other to plausibly belong to the same
              person. Where the engine flags a group as a possible
              singularly-prolific inventor, this page reports the
              measurements and links every record to its USPTO page. The
              page does not name who any group represents; that
              identification is for an IP attorney or a domain expert.
            </p>
            <p>
              The deepest finding here is not a single number. It is that
              the engine, given only the four surface signals (name,
              co-inventors, assignee, location), groups records into the
              same buckets PatentsView&apos;s much more elaborate
              disambiguation algorithm produces — most of the time — and
              clearly beats the naive baseline (collapse all records with
              identical names) on the common-name cases where naive
              collision is most damaging.
            </p>
          </Prose>
        </Section>

        {/* The corpus */}
        <Section anchor="corpus" kicker="The corpus" title="A pinned PatentsView snapshot, two-stage stratified.">
          <Prose>
            <p>
              The patent data comes from{" "}
              <a href="https://patentsview.org/download/data-download-tables" target="_blank" rel="noopener noreferrer" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">
                PatentsView
              </a>, an open research project of the US Patent Office that
              publishes monthly bulk exports of the patent record. We pin
              to a specific snapshot date so anyone can re-download the
              same files and reproduce this exact artifact. We normalize
              every inventor&apos;s name to the same shape — so &ldquo;John
              W. Smith&rdquo; and &ldquo;J. W. Smith&rdquo; look identical
              to the engine — and we pull together each record&apos;s
              co-inventors, assignee, and city/state/country.
            </p>
            <p>
              PatentsView publishes its own gold-standard answer for who
              each record belongs to. We deliberately hide that answer
              from the engine. If the engine ever saw the gold ID, the
              comparison between our groups and PatentsView&apos;s would
              be circular — we&apos;d just be repeating the answer we were
              given. Hiding it is the difference between a real
              recovery claim and a parrot.
            </p>
            <p>
              Two-stage sampling: for uncommon names, every record is
              kept (so a real inventor&apos;s career is fully visible); for
              ultra-common names like &ldquo;John Smith,&rdquo; we keep
              only every Nth record (so common-name records don&apos;t
              swamp the corpus). The 500,000-record total is what fits in
              one run on the current platform; the full PatentsView
              record is several times larger.
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
              to Pulse&apos;s processed records is fully open and auditable.
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
