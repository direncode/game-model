import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Verifier } from "./Verifier";

export const metadata: Metadata = {
  title: "Receipt · Verify · Latent Ocean",
  description:
    "Paste any Receipt and confirm its hash bit-for-bit, in your browser, with no backend round-trip. Then verify the full chain from the published artifact. Then verify the chain head's OpenTimeStamps Bitcoin anchor with ots verify.",
};

export default function ReceiptVerifyPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-12 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Receipt · paste-and-verify
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              Verify any receipt.<br />
              <span className="text-white/45">In your browser.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              The receipt hash function is a pure SHA-256 over a fixed
              concatenation of fields. There is no Latent Ocean trust
              dependency. The TypeScript implementation runs in your browser
              via <code className="font-mono text-sm">crypto.subtle.digest</code>;
              the Python operator-script implementation is at{" "}
              <code className="font-mono text-sm">scripts/receipt_hash.py</code>{" "}
              in the repo. Both produce byte-identical hashes.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              The full receipt list is at{" "}
              <Link href="/receipt/sec-edgar" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/receipt/sec-edgar</Link>.
              Each receipt there has a &quot;verify this receipt&quot; button
              that uses the same code as below.
            </p>
          </div>
        </section>

        <section className="px-6 py-12">
          <div className="max-w-[1100px] mx-auto">
            <Verifier />
          </div>
        </section>
      </main>
    </div>
  );
}
