import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { RangeConsole } from "./RangeConsole";

export const metadata: Metadata = {
  title: "Cyber Range · Latent Sentinel running on real intrusion data",
  description:
    "OPERATION HALCYON-7 against the NSL-KDD corpus: 125,973 labeled network connections, 23 attack classes, deterministic structural taxonomy crystallization with bit-identical replay. Streaming live from the appliance via SSE.",
};

export default function RangePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          {/* Hero */}
          <div className="mb-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-li-red mb-4">
              Cyber Range · OPERATION HALCYON-7 · running on real intrusion data
            </p>
            <h1 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.92] max-w-5xl">
              125,973 connections.<br />
              <span className="text-white/45">23 attack classes.<br/>One deterministic engine.</span>
            </h1>
            <p className="mt-6 text-lg text-white/65 max-w-3xl leading-relaxed">
              The NSL-KDD intrusion-detection corpus, the standard
              academic benchmark since 2009, ingested record-by-record
              through the Latent Sentinel pipeline. Every event you see
              below comes from a real labeled network connection. Every
              detection card resolves to the originating record by
              index. Every <code className="font-mono text-li-cyan">response_digest</code>{" "}
              is reproducible bit-for-bit on a fresh appliance.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono text-white/40">
              <span>SEED=42</span>
              <span>·</span>
              <span>SSE STREAM · NO BUFFERING</span>
              <span>·</span>
              <span>RFC 5737 / RFC 1918 IPS ONLY</span>
              <span>·</span>
              <span>READ-ONLY DATA MOUNT</span>
              <span>·</span>
              <span>AIR-GAP CAPABLE</span>
            </div>
          </div>

          <RangeConsole />

          <div className="mt-12 text-[12px] font-mono text-white/35 leading-relaxed max-w-3xl">
            Corpus: Tavallaee, Bagheri, Lu, Ghorbani (2009).{" "}
            <span className="italic">A Detailed Analysis of the KDD CUP 99 Data Set</span>.
            Mounted into the frontend container at{" "}
            <code className="text-white/55">/data/cache/nsl_kdd_train.txt</code> via the
            production compose volume. This page issues an SSE request to{" "}
            <code className="text-white/55">/api/sentinel-range</code>; the route reads
            the corpus once, caches parsed records in module scope, and emits a
            deterministic 8-phase walk through the data under seed = 42.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
