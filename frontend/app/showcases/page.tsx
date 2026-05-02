import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { ALL_SHOWCASES } from "@/lib/products/data";

export const metadata: Metadata = {
  title: "Public Showcases · Latent Ocean",
  description:
    "Four citable, third-party-verifiable public deployments running on Latent Ocean's substrate. DocSouth (humanities), Atlas (science), Pulse (IP), Receipt (compliance). One substrate, four buyer categories, byte-for-byte reproducible.",
};

const SHOWCASE_DETAIL: Record<string, { headline: string; sections: string[]; recipe: string }> = {
  docsouth: {
    headline: "Studio's flagship engagement: UNC Libraries' DocSouth archive, structurally fingerprinted.",
    sections: [
      "711 source texts spanning 1730s-1940s, segmented to 37,505 records.",
      "Cluster purity 0.442 against 4 source collections (chance baseline 0.25).",
      "Class #7 holds 957 survivors with even bleed across collections — testimonial register that crosses curatorial boundaries.",
      "Persistent homology: 522 connected components (H0), 179 cycles (H1), 77 voids (H2).",
      "100-finding constellation catalog at /docsouth/constellations traces specific connections out to UNC's institutional history and present-day NC.",
    ],
    recipe: "Re-download the DocSouth ZIPs, re-run scripts/docsouth_harvest.py, compare corpus_sha256 byte-for-byte.",
  },
  atlas: {
    headline: "Thirty years of scientific discourse, structurally mapped, citable forever.",
    sections: [
      "500k stratified arXiv abstracts 1991-2025 across 8 archive-level disciplines.",
      "Fingerprint payload is title + abstract only — categories never enter the engine, so cluster-purity-vs-archives is honest unsupervised recovery.",
      "Coarse purity (8 archives) is the headline; fine purity (~152 subcategories) sits in the verification appendix.",
      "Decade trajectory shows the structural reweighting from early-physics era to 2020s cs/stat dominance.",
      "Static emergence-candidate flag (median pub year, year-spread, Shannon entropy over categories) surfaces young + tight + diverse clusters without naming them — readers click through to arxiv.org.",
    ],
    recipe: "Re-download the Kaggle arXiv snapshot, re-run scripts/arxiv_harvest.py, compare corpus_sha256 byte-for-byte.",
  },
  pulse: {
    headline: "Fifty years of US innovation, deterministically disambiguated against PatentsView gold.",
    sections: [
      "500k inventor-records 1976-2025 from PatentsView's bulk-distributed disambiguated tables.",
      "Fingerprint = canonicalized name (Surname I I) + co-inventor list + assignee_id + city/state/country. PatentsView's gold disambig_inventor_id is held out of the fingerprint entirely.",
      "Two-stage sampling preserves disambiguation signal for typical inventors while down-sampling ultra-common names like 'John Smith'.",
      "Multi-baseline disambiguation panel: engine vs PatentsView (gold) vs naive-name-collision vs chance. The lift over naive-name is the cleaner signal of structural-disambiguation power.",
      "Per-cluster signals (productivity, IPC entropy, career-span, solo-share) flag candidate singularly-prolific inventors. No naming. Top-25 records click through to patents.uspto.gov.",
    ],
    recipe: "Re-download the PatentsView TSVs for the same snapshot, re-run scripts/pulse_harvest.py, compare corpus_sha256 byte-for-byte.",
  },
  receipt: {
    headline: "1,000 SEC 10-K filings summarized once, every receipt verifiable, chain head anchored to Bitcoin.",
    sections: [
      "1,000 SEC EDGAR 10-K filings stratified across industry × year (2018-2025), summarized once via Claude Sonnet 4.6 against a single fixed prompt + JSON output schema (both committed to git).",
      "Each receipt commits to (prev_receipt_hash || prompt_hash || schema_hash || corpus_sha256 || model_id || timestamp || output_sha256). Tampering anywhere breaks the chain at that index.",
      "The chain head is OpenTimeStamps-stamped to the Bitcoin timechain so retroactive forgery is detectable. Run `ots verify` against your own Bitcoin node to confirm independently.",
      "Browser-side verifier at /receipt/verify lets anyone paste a receipt JSON and confirm its hash bit-for-bit via crypto.subtle.digest, plus replay the entire chain from the public chain artifact.",
      "Python + TypeScript hash implementations are kept in sync by an explicit cross-language test contract.",
    ],
    recipe: "Refetch the same SEC 10-K filings, recompute corpus_sha256 per filing, replay the chain in /receipt/verify, run `ots verify receipt.chainhead.ots` against the Bitcoin timechain.",
  },
};

const PALETTE: Record<string, string> = {
  docsouth: "#7DD3FC",
  atlas:    "#A78BFA",
  pulse:    "#FCD34D",
  receipt:  "#34D399",
};

export default function ShowcasesIndexPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-24 pt-12">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Public Showcases · the four-deployment set
            </p>
            <h1 className="font-display font-medium text-[clamp(56px,9vw,128px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl">
              Four citable showcases.<br />
              <span className="text-white/45">One substrate underneath.</span>
            </h1>
            <p className="mt-9 text-lg text-white/65 max-w-3xl leading-snug">
              Each showcase below is a fully-citable, third-party-verifiable
              artifact running on the Latent Ocean substrate. The four
              together cover four buyer categories: research libraries
              (DocSouth), scientific publishers (Atlas), IP &amp; M&amp;A
              (Pulse), compliance &amp; AI governance (Receipt). Every output
              ships with hashes anyone can re-derive: corpus_sha256,
              response_digest, OpenTimeStamps-anchored chain heads where
              appropriate. No mocks, no marketing demos.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              These are the demonstrations behind every product. Each one
              corresponds to a paying product page (Studio, Atlas, Pulse,
              Receipt) and to Vault, the Private Banking platform tier
              underneath them all. Pick any showcase and audit it byte-for-byte.
            </p>
            <div className="mt-9 flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              {ALL_SHOWCASES.map((s) => (
                <a
                  key={s.slug}
                  href={`#${s.slug}`}
                  className="inline-flex items-center h-7 px-3 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 transition-colors"
                >
                  {s.label} →
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* The four showcases, expanded */}
        {ALL_SHOWCASES.map((s) => {
          const detail = SHOWCASE_DETAIL[s.slug];
          const accent = PALETTE[s.slug] ?? "#FFFFFF";
          return (
            <section
              key={s.slug}
              id={s.slug}
              className="relative px-6 py-24 border-b border-white/5 scroll-mt-24"
            >
              <div className="max-w-[1400px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12">
                  {/* Left rail */}
                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] mb-4" style={{ color: accent }}>
                      Showcase · {s.label}
                    </p>
                    <h2
                      className="font-display font-medium text-5xl md:text-7xl tracking-[-0.04em] leading-[0.95] mb-6"
                      style={{ color: "#fff" }}
                    >
                      {s.label}
                    </h2>
                    <p className="font-mono text-[11px] text-white/50 leading-relaxed mb-2">{s.blurb}</p>
                    <p className="text-[12.5px] text-white/65 leading-snug mb-6">For {s.buyer.toLowerCase()}.</p>
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white border-b border-white/35 hover:border-white pb-0.5"
                    >
                      Open the artifact at {s.href}
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </Link>
                  </div>

                  {/* Right rail */}
                  <div>
                    <p className="font-display text-2xl md:text-3xl tracking-[-0.025em] text-white leading-snug mb-6 max-w-2xl">
                      {detail?.headline}
                    </p>
                    <ul className="space-y-3 mb-8">
                      {detail?.sections.map((line, i) => (
                        <li key={i} className="flex gap-3 text-[14px] text-white/75 leading-snug">
                          <span className="font-mono text-[10px] text-white/35 mt-1.5 shrink-0">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="border-l-2 pl-4" style={{ borderColor: `${accent}55` }}>
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 mb-2">
                        Verification recipe
                      </p>
                      <p className="text-[13.5px] text-white/70 leading-snug">
                        {detail?.recipe}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* Substrate close */}
        <section className="relative px-6 py-24">
          <div className="max-w-[1100px] mx-auto text-center">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Substrate · Vault
            </p>
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1.04] mb-6">
              Your customers&apos; deployments<br />
              <span className="text-white/45">will look the same shape.</span>
            </h2>
            <p className="text-[15.5px] text-white/65 leading-relaxed max-w-2xl mx-auto mb-10">
              The four showcases above all run on Vault&apos;s engine.
              Tenant isolation enforced at the storage layer; encryption at
              rest with keys held on the appliance; CEF + OCSF audit log
              wired in by default; deterministic response_digest on every
              output. Eighteen months of compliance engineering, done.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/vault" className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
                Apply for Vault →
              </Link>
              <Link href="/method" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                Engineering proof · /method
              </Link>
              <Link href="/products" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                Five products · /products
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
