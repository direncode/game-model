import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { RangeConsole } from "./RangeConsole";

export const metadata: Metadata = {
  title: "Range · Universal Private Model Former",
  description:
    "Pick a corpus. Watch it become a private model. Real records, real fingerprinting, real null-permutation tests, deterministic across runs. Eight verticals from one engine.",
};

export default function RangePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="mb-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-li-cyan mb-4">
              Range · universal private model former
            </p>
            <h1 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.92] max-w-5xl">
              Pick a corpus.<br />
              <span className="text-white/45">Watch it become a private model.</span>
            </h1>
            <p className="mt-6 text-lg text-white/65 max-w-3xl leading-relaxed">
              Eight different real-world corpora — intrusion data, SEC
              filings, biomedical abstracts, patent filings, trade flows,
              seismicity, crypto markets, macroeconomics — ingested
              record-by-record through one engine. Every event is computed
              from real bytes. Every detection resolves to its originating
              record. Every <code className="font-mono text-li-cyan">response_digest</code>{" "}
              is reproducible bit-for-bit on a fresh appliance.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono text-white/40">
              <span>SEED=42</span>
              <span>·</span>
              <span>SSE STREAM · NO BUFFERING</span>
              <span>·</span>
              <span>REAL FINGERPRINT + REAL NULL TEST</span>
              <span>·</span>
              <span>READ-ONLY DATA MOUNT</span>
              <span>·</span>
              <span>AIR-GAP CAPABLE</span>
            </div>
          </div>

          <RangeConsole />

          <div className="mt-12 text-[12px] font-mono text-white/35 leading-relaxed max-w-3xl">
            Range is the runnable face of the Latent Ocean primitive. The
            same engine that scores SEC filings under one corpus drives
            patent filings, biomedical abstracts, trade flows, intrusion
            telemetry, or any other tabular or document corpus you mount.
            The page issues an SSE request to{" "}
            <code className="text-white/55">/api/sentinel-range?vertical=…</code>;
            the route reads the source corpus, computes a real 48-bit
            structural fingerprint per record, accumulates running statistics,
            runs a real null-permutation test at the close of each phase, and
            emits a deterministic response_digest under seed = 42. Citations
            for each corpus are visible in the corpus card below.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
