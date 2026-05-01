import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { ConstellationsWidget } from "@/components/landing/widgets/ConstellationsWidget";
import { FindingsCatalogWidget } from "@/components/landing/widgets/FindingsCatalogWidget";

export const metadata: Metadata = {
  title: "DocSouth · Constellations · 100 Findings",
  description:
    "An entity-co-occurrence engine over the corpus surfacing hub texts and cross-collection bridges, plus a curated 100-finding catalog connecting DocSouth to UNC's institutional history and the present and future of the South.",
};

export default function DocSouthConstellationsPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-20 pt-12">
          <div className="max-w-[1200px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              DocSouth · constellations · 100 findings
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              The hidden network,<br />
              <span className="text-white/45">surfaced and named.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              Two layers, one page. The first is the{" "}
              <Link href="#engine" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">constellation engine</Link>:
              a regex-based named-entity extractor over all 37,505 records,
              ranking entities by cross-text spread, surfacing hub texts
              and cross-collection bridges. The second is a{" "}
              <Link href="#catalog" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">curated 100-finding catalog</Link>{" "}
              that traces specific connections, with primary-source
              citation, from individual DocSouth nodes outward to the
              broader Black/Southern intellectual tradition, into UNC's
              institutional history, and forward to the present and
              future of the South. The prototype connection — Ridgel →
              Turner → Blyden → Crummell → Du Bois — is finding 1 of 100.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              Both layers are loaded from the same{" "}
              <code className="font-mono text-white/85 text-sm">/api/range-public/showcase/*</code>{" "}
              public endpoints. The engine output is reproducible (regex over
              the deterministic corpus); the curated catalog is a
              hand-traced research artifact whose claims are sourced.
            </p>
          </div>
        </section>

        {/* Constellation engine */}
        <section id="engine" className="relative px-6 py-20 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1200px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Layer 1 · the engine
            </p>
            <h2 className="font-display font-medium text-4xl md:text-5xl tracking-[-0.035em] text-white leading-[1] mb-6 max-w-3xl">
              Top entities, hub texts,<br />
              <span className="text-white/45">cross-collection bridges.</span>
            </h2>
            <p className="text-[15.5px] text-white/65 leading-snug mb-10 max-w-3xl">
              The engine reads the full corpus, extracts proper-noun
              named entities (titled clergy, place names, ships,
              institutions), deduplicates at file level, ranks
              entities by cross-text spread, builds the
              entity-co-occurrence graph, and surfaces three kinds of
              structural objects: top entities (the most-cited names),
              hub texts (the documents naming 5+ top entities — these
              are the citation epicenters of the whole archive), and
              cross-collection bridges (entities that appear in 3+ of
              DocSouth's four collections, marking the curatorial
              boundaries the engine identifies as porous).
            </p>
            <ConstellationsWidget />
          </div>
        </section>

        {/* 100 findings catalog */}
        <section id="catalog" className="relative px-6 py-20 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1200px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Layer 2 · the curated catalog
            </p>
            <h2 className="font-display font-medium text-4xl md:text-5xl tracking-[-0.035em] text-white leading-[1] mb-6 max-w-3xl">
              100 findings,<br />
              <span className="text-white/45">named, sourced, traced forward.</span>
            </h2>
            <p className="text-[15.5px] text-white/65 leading-snug mb-10 max-w-3xl">
              Four categories. Twenty-five connections within DocSouth
              the curators filed across collections. Twenty-five
              outward to the broader Black and Southern intellectual
              tradition. Twenty-five into UNC's institutional history,
              including the parts the institution is still reckoning
              with. Twenty-five forward to the present and future of
              UNC and the South — the 21st-century reckoning, the
              institutional reform, the technological infrastructure
              this archive enables, the open questions of the next
              decade.
            </p>
            <FindingsCatalogWidget />
          </div>
        </section>

        {/* CTA */}
        <section className="relative px-6 pt-28">
          <div className="max-w-[1080px] mx-auto text-center">
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white mb-6">
              The substrate. The catalog. The chain.
            </h2>
            <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-snug">
              711 source texts, one engine, 100 traced findings, one public
              artifact. Anyone with the four DocSouth ZIPs can re-derive
              the engine output. The curated catalog is sourced and
              click-throughable. The chain runs from 1730s narratives to
              this 2026 deployment.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/docsouth"
                className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors"
              >
                The scholarly artifact
              </Link>
              <Link
                href="/method"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors"
              >
                Method (engineering)
              </Link>
              <a
                href="/api/range-public/showcase/docsouth-findings"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors"
              >
                Findings JSON
              </a>
              <a
                href="/api/range-public/showcase/docsouth-constellations"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors"
              >
                Constellations JSON
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
