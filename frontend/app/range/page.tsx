import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { RangeHero } from "@/components/range/RangeHero";
import { RangeBeyondLLM } from "@/components/range/RangeBeyondLLM";
import { RangeWhatFormed } from "@/components/range/RangeWhatFormed";
import { RangeQuery } from "@/components/range/RangeQuery";
import { RangeAirGap } from "@/components/range/RangeAirGap";
import { RangeAccess } from "@/components/range/RangeAccess";
import { RangeOperator } from "@/components/range/RangeOperator";
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
                Run · form a model · gallery of formed artifacts
              </p>
              <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.92] max-w-5xl">
                Point at any corpus.<br />
                <span className="text-white/45">A private model lands.</span>
              </h2>
              <p className="mt-6 text-lg text-white/65 max-w-3xl leading-relaxed">
                Built-in corpora (NSL-KDD, EDGAR, Titan validation), pasted
                JSON / NDJSON / CSV, or any local file path the appliance
                can read. The generic adapter detects shape, the
                schema-agnostic projection fingerprints every record, the
                Hamming-neighborhood crystallizer discovers a taxonomy,
                and the artifact lands at{" "}
                <code className="font-mono text-li-cyan">/data/formed_models/[id].range.json</code>.
                If <code className="font-mono text-li-cyan">BTUT_BRIDGE_URL</code>{" "}
                is configured, fingerprinting HTTP-bridges to the real
                Python BTUT pipeline. If <code className="font-mono text-li-cyan">RUNPOD_API_KEY</code>{" "}
                is set, full TCD-JEPA crystallization runs async on RunPod GPU.
              </p>
            </div>
            <RangeConsole />
          </div>
        </section>

        <RangeQuery />

        {/* Lineage verifier (anchor target for "open in live replay" deep links) */}
        <div id="replay-anchor" />
        <SentinelReplay />

        <RangeOperator />
        <RangeAirGap />
        <RangeAccess />
      </main>
      <Footer />
    </div>
  );
}
