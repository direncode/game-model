import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { RangeHero } from "@/components/range/RangeHero";
import { RangeBeyondLLM } from "@/components/range/RangeBeyondLLM";
import { RangeWhatFormed } from "@/components/range/RangeWhatFormed";
import { RangeQuery } from "@/components/range/RangeQuery";
import { RangeAirGap } from "@/components/range/RangeAirGap";
import { RangeAccess } from "@/components/range/RangeAccess";
import { RangeConsole } from "./RangeConsole";
import { SentinelReplay } from "@/components/landing/sentinel/SentinelReplay";

export const metadata: Metadata = {
  title: "Range · Private Model Former",
  description:
    "Form a deterministic private model from any corpus. The air-gap-by-default alternative to probabilistic AI. Real records, real fingerprinting, byte-identical replay across runs.",
};

export default function RangePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main>
        <RangeHero />
        <RangeBeyondLLM />
        <RangeWhatFormed />

        {/* Runnable formation console */}
        <section id="range-console" className="relative py-24 border-t border-white/5">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6">
            <div className="mb-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-li-cyan mb-4">
                Run · form a model now
              </p>
              <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.92] max-w-5xl">
                Pick a corpus.<br />
                <span className="text-white/45">Watch it become a model.</span>
              </h2>
              <p className="mt-6 text-lg text-white/65 max-w-3xl leading-relaxed">
                Eight different real-world corpora streamed through the
                Range pipeline live. Every event is computed from real
                bytes. Every detection resolves to its originating
                record. Every <code className="font-mono text-li-cyan">response_digest</code>{" "}
                is reproducible bit-for-bit on a fresh appliance.
              </p>
            </div>
            <RangeConsole />
          </div>
        </section>

        <RangeQuery />

        {/* Lineage verifier (anchor target for "open in live replay" deep links) */}
        <div id="replay-anchor" />
        <SentinelReplay />

        <RangeAirGap />
        <RangeAccess />
      </main>
      <Footer />
    </div>
  );
}
