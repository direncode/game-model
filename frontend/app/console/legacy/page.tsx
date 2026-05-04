import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { RangeHero } from "@/components/range/RangeHero";
import { RangeBeyondLLM } from "@/components/range/RangeBeyondLLM";
import { RangeWhatFormed } from "@/components/range/RangeWhatFormed";
import { RangeQuery } from "@/components/range/RangeQuery";
import { RangeAirGap } from "@/components/range/RangeAirGap";
import { RangeIntegrations } from "@/components/range/RangeIntegrations";
import { RangeOperator } from "@/components/range/RangeOperator";
import { RangeConsole } from "../RangeConsole";
import { SentinelReplay } from "@/components/landing/sentinel/SentinelReplay";

export const metadata: Metadata = {
  title: "Console · Legacy Formation Runner · Latent Ocean",
  description:
    "Legacy live-formation runner. Form a deterministic private model from any corpus. Preserved for the runtime that drives the appliance's actual model formation; the OCEAN workbench at /console is the new primary surface.",
};

export default function ConsoleLegacyPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main>
        {/* Banner pointing back to the new console */}
        <section className="pt-32 pb-12 px-6 border-b border-amber-500/30 bg-amber-950/10">
          <div className="max-w-[1480px] mx-auto flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber-300/85 mb-2">
                LEGACY · APPLIANCE FORMATION RUNNER
              </p>
              <p className="text-[15px] leading-[1.55] text-white/75 max-w-[60ch]">
                This is the live formation runner that drives the appliance&apos;s actual model formation pipeline. Preserved while the OCEAN workbench takes over as the primary console surface.
              </p>
            </div>
            <Link
              href="/console"
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-4 py-2 rounded-full whitespace-nowrap"
            >
              ← OCEAN Workbench
            </Link>
          </div>
        </section>

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

        {/* Lineage verifier */}
        <div id="replay-anchor" />
        <SentinelReplay />

        <RangeIntegrations />
        <RangeOperator />
        <RangeAirGap />
      </main>
      <Footer />
    </div>
  );
}
