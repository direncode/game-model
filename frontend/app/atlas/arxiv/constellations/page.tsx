import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { AtlasFindings } from "./AtlasFindings";

export const metadata: Metadata = {
  title: "Atlas · arXiv · Constellations",
  description:
    "Algorithmic findings catalog for Atlas. Six categories — structurally singular papers, emergence candidates, interdisciplinary bleed, decade drift, baseline comparison, structural anachronisms — derived deterministically from the public artifact JSON.",
};

export default function AtlasConstellationsPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <section className="relative px-6 border-b border-white/5 pb-12 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Atlas · constellations · findings catalog
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              The structural map,<br />
              <span className="text-white/45">finding by finding.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              The Atlas findings catalog is a deterministic byproduct of
              the public artifact at{" "}
              <code className="font-mono text-white/85 text-sm">/api/range-public/showcase/atlas</code>.
              Six categories cover the structural shape of the
              arXiv-substrate run: structurally singular papers,
              candidate emerged clusters, interdisciplinary bleed,
              decade drift, baseline comparison, and structural
              anachronisms. No human curation in v1; every finding is a
              programmatic read of the public JSON.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              Back to the long-form artifact at{" "}
              <Link href="/atlas/arxiv" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/atlas/arxiv</Link>.
              The DocSouth analog is{" "}
              <Link href="/docsouth/constellations" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/docsouth/constellations</Link>.
            </p>
          </div>
        </section>

        <section className="px-6 py-12">
          <div className="max-w-[1100px] mx-auto">
            <AtlasFindings />
          </div>
        </section>
      </main>
    </div>
  );
}
