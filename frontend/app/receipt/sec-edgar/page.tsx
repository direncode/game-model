import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { ReceiptList } from "./ReceiptList";

export const metadata: Metadata = {
  title: "Receipt · SEC EDGAR · Latent Ocean",
  description:
    "1,000 SEC EDGAR 10-K filings summarized once via Claude Sonnet, every summary carries a tamper-proof receipt, the chain head is anchored to the Bitcoin timechain via OpenTimeStamps, anyone can re-derive any receipt's hash and verify the chain end-to-end.",
};

export default function ReceiptSecEdgarShowcasePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-20 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              SEC EDGAR × Latent Ocean · audit-trail showcase
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,116px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              1,000 filings.<br />
              <span className="text-white/45">One model.</span><br />
              <span className="text-white/45">Every receipt verifiable.</span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              An applied study of compliance-grade AI summarization on the
              public SEC EDGAR 10-K record. 1,000 filings stratified across
              industry and year (2018-2025), summarized once via a single
              fixed prompt against Claude Sonnet 4.6, every call attested by
              a tamper-proof receipt, the chain head anchored to the Bitcoin
              timechain via OpenTimeStamps.
            </p>
            <p className="mt-5 text-lg text-white/75 max-w-3xl leading-relaxed">
              Receipt is the structural pivot from the other showcases. There
              is no cluster purity, no decade trajectory, no rare-records
              list. The artifact&apos;s value is per-receipt verifiability:
              given any receipt below, anyone can re-derive its hash from the
              published inputs and confirm it bit-for-bit. A single tampered
              byte breaks the chain. The chain head is anchored externally so
              even retroactive forgery is detectable.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              The dedicated verifier is at{" "}
              <Link href="/receipt/verify" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/receipt/verify</Link>.
              Sibling showcases:{" "}
              <Link href="/docsouth" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/docsouth</Link>,{" "}
              <Link href="/atlas/arxiv" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/atlas/arxiv</Link>,{" "}
              <Link href="/pulse/uspto-inventors" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/pulse/uspto-inventors</Link>.
            </p>
            <div className="mt-9 flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              {[
                ["preface", "preface"],
                ["the corpus", "corpus"],
                ["live receipts", "data"],
                ["limits", "limits"],
                ["acknowledgements", "ack"],
              ].map(([label, anchor]) => (
                <a key={anchor} href={`#${anchor}`} className="inline-flex items-center h-7 px-3 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 transition-colors">
                  {label}
                </a>
              ))}
              <Link href="/receipt/verify" className="inline-flex items-center h-7 px-3 rounded-full bg-white text-black uppercase tracking-[0.18em] font-mono text-[10.5px] hover:bg-white/90 transition-colors">
                verifier · paste-and-check →
              </Link>
            </div>
          </div>
        </section>

        {/* Preface */}
        <Section anchor="preface" kicker="Preface · what a receipt is" title="A receipt proves what was attempted and what was returned.">
          <Prose>
            <p>
              A receipt is a hash chain entry that commits a model call to
              an immutable record. Each receipt is the SHA-256 of the call&apos;s
              inputs (prompt, schema, filing text) and outputs (the JSON the
              model returned), plus a link to the previous receipt&apos;s hash.
              Tampering with any receipt&apos;s output bytes, prompt, or schema
              breaks its hash. Tampering with the chain link breaks every
              subsequent receipt&apos;s prev_hash. The chain head is the SHA-256
              of the final receipt; anchoring it externally proves the run
              completed at the published timestamp.
            </p>
            <p>
              What a receipt does NOT prove: that the model&apos;s output is
              correct, factual, or compliant with whatever standard the
              compliance officer cares about. The receipt attests to the
              record of the call, not the truth of the call&apos;s output. That
              distinction is the entire compliance value: a regulator can
              ask &ldquo;what did your AI tell you about this filing?&rdquo;
              and the answer is a verifiable record, not a reconstruction.
            </p>
            <p>
              LLMs are non-deterministic. Re-running the same prompt against
              the same model the next day produces a different output,
              therefore a different output_sha256, therefore a different
              receipt. The original receipt remains valid — it is the record
              of what the model returned at run-time. Re-running creates a
              new receipt; it does not invalidate the old one.
            </p>
          </Prose>
        </Section>

        {/* The corpus */}
        <Section anchor="corpus" kicker="The corpus" title="1,000 10-Ks pulled from SEC EDGAR, hash-pinned per filing.">
          <Prose>
            <p>
              SEC EDGAR is the public filings system maintained by the U.S.
              Securities and Exchange Commission. It is the canonical source
              for U.S. public-company financial disclosures, including the
              annual 10-K. The harvester at{" "}
              <code className="font-mono text-white/80 text-sm">scripts/receipt_harvest.py</code>{" "}
              reads pre-fetched 10-K filing texts (truncated to Items 1, 1A,
              7, and 8 — Business, Risk Factors, MD&amp;A, Financial
              Statements), computes a corpus_sha256 per filing, and produces
              a deterministic manifest sorted by filing_id ascending.
            </p>
            <p>
              The summarizer at{" "}
              <code className="font-mono text-white/80 text-sm">scripts/receipt_run.py</code>{" "}
              walks the manifest, calls Claude Sonnet 4.6 with a fixed prompt
              (committed at <code className="font-mono text-sm">scripts/receipt_prompt.txt</code>)
              and a fixed JSON schema (committed at{" "}
              <code className="font-mono text-sm">scripts/receipt_schema.json</code>),
              hashes the output, mints the receipt, and appends to{" "}
              <code className="font-mono text-sm">receipts.ndjson</code>.
              After all 1,000 filings the chain head is OpenTimeStamps-stamped
              and the .ots proof file is committed to the repo.
            </p>
            <p>
              The fingerprint payload is the prompt + schema + filing text;
              none of the model_id or timestamp leak into the prompt. The
              receipt commits to the prompt_hash and schema_hash separately,
              so a future change to the prompt produces a clearly different
              receipt shape.
            </p>
          </Prose>
        </Section>

        {/* Live receipts */}
        <Section anchor="data" kicker="Live receipts" title="The 1,000 filings, browseable and verifiable inline.">
          <ReceiptList />
        </Section>

        {/* Limits */}
        <Section anchor="limits" kicker="Limits · what this artifact does not claim" title="The boundaries kept honest.">
          <Prose>
            <p>
              <span className="text-white">It does not prove the AI&apos;s
              output is correct.</span> The receipt attests to what was
              returned, not whether it&apos;s right. That judgment is upstream
              of any audit-trail mechanism.
            </p>
            <p>
              <span className="text-white">It is not a re-run determinism
              claim.</span> LLMs are non-deterministic. Re-running the same
              prompt against the same model produces a different output and
              therefore a different receipt. The published receipts remain
              valid records of what the original run returned.
            </p>
            <p>
              <span className="text-white">It does not include every 10-K.</span>{" "}
              The 1,000-filing sample is stratified across industry and year
              from 2018-2025, not every filer. The recipe re-derives the
              same 1,000 given the same SEC EDGAR snapshot.
            </p>
            <p>
              <span className="text-white">It depends on Anthropic&apos;s
              model_id stability.</span> If <code className="font-mono text-sm">claude-sonnet-4-6-20250929</code>{" "}
              is deprecated, future runs use a different model_id and produce
              different receipts. The published receipts remain valid as
              records of what the original model returned.
            </p>
            <p>
              <span className="text-white">It does not anchor every
              receipt.</span> Only the chain head is OpenTimeStamps-anchored
              to Bitcoin. Per-receipt anchoring would scale poorly; the chain
              structure means anchoring the head suffices to prove the entire
              chain existed at the run timestamp.
            </p>
          </Prose>
        </Section>

        {/* Acknowledgements */}
        <Section anchor="ack" kicker="Acknowledgements" title="Standing on a long compliance lineage.">
          <Prose>
            <p>
              SEC EDGAR is a public service of the U.S. Securities and
              Exchange Commission. Receipt exists only because EDGAR makes
              filings openly redistributable.
            </p>
            <p>
              Claude Sonnet 4.6 is built by Anthropic. The model_id is pinned
              in every receipt; if the model is updated or retired, the
              receipts remain valid records of what was returned at run
              time.
            </p>
            <p>
              OpenTimeStamps is a free public service maintained by the
              Bitcoin community for trusted timestamping via the Bitcoin
              timechain. The chain-head anchor is what makes the full audit
              trail tamper-proof against retroactive modification, and
              demonstrates the company&apos;s broader IP framing (trade
              secrets + OpenTimeStamps).
            </p>
            <p>
              The DocSouth, Atlas, and Pulse showcases are the substrate
              Receipt extends. Four artifacts, four buyer categories, one
              substrate.
            </p>
          </Prose>
        </Section>
      </main>
    </div>
  );
}

function Section({ anchor, kicker, title, children }: { anchor: string; kicker: string; title: string; children: React.ReactNode }) {
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
