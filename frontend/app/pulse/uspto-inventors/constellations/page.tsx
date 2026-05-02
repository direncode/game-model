import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { PulseFindings } from "./PulseFindings";

export const metadata: Metadata = {
  title: "Pulse · USPTO · Constellations",
  description:
    "Algorithmic findings catalog for Pulse. Five categories — singular inventor candidates, cross-IPC polymaths, structurally singular records, decade shifts, baseline comparison — derived deterministically from the public artifact JSON.",
};

export default function PulseConstellationsPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <section className="relative px-6 border-b border-white/5 pb-12 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Pulse · constellations · findings catalog
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              The disambiguation map,<br />
              <span className="text-white/45">finding by finding.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              The Pulse findings catalog is a deterministic byproduct of the
              public artifact at{" "}
              <code className="font-mono text-white/85 text-sm">/api/range-public/showcase/pulse</code>.
              Five categories cover the structural shape of the
              disambiguated-inventor record set: singular inventor candidates,
              cross-IPC polymaths, structurally singular records, decade
              productivity shifts, and the multi-baseline disambiguation
              comparison. No human curation in v1.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              Back to the long-form artifact at{" "}
              <Link href="/pulse/uspto-inventors" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/pulse/uspto-inventors</Link>.
              Adjacent showcases:{" "}
              <Link href="/atlas/arxiv/constellations" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/atlas/arxiv/constellations</Link>,{" "}
              <Link href="/docsouth/constellations" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/docsouth/constellations</Link>.
            </p>
          </div>
        </section>

        <section className="px-6 py-12">
          <div className="max-w-[1100px] mx-auto">
            <PulseFindings />
          </div>
        </section>
      </main>
    </div>
  );
}
