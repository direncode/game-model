import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { ALL_SHOWCASES } from "@/lib/products/data";

export const metadata: Metadata = {
  title: "Public Showcases · Latent Ocean",
  description:
    "Five citable, third-party-verifiable public deployments running on Latent Ocean's substrate. DocSouth (humanities), Atlas (science), Pulse (IP), Receipt (compliance), Bombe (intelligence). One substrate, five buyer categories, byte-for-byte reproducible.",
};

const SHOWCASE_DETAIL: Record<string, { headline: string; sections: string[]; recipe: string }> = {
  docsouth: {
    headline: "Studio's flagship engagement: a 200-year archive of the American South, mapped at scholarly pace.",
    sections: [
      "711 source texts from 1730s through 1940s, broken into 37,505 readable chunks.",
      "When grouped by structural similarity alone, 44% of the chunks landed in groups that matched the four source collections UNC's curators had filed them in. Random guessing would have landed at 25%.",
      "One large group of 957 chunks pulled evenly from all four collections — a first-person testimonial voice the engine recognized as one signal regardless of how the curators filed each text.",
      "Companion 100-finding catalog traces specific connections from individual texts outward to UNC's institutional history and present-day North Carolina politics.",
    ],
    recipe: "Re-download the DocSouth ZIPs from UNC Libraries, run our harvester, compare the file fingerprint to ours. Same input → same answer.",
  },
  atlas: {
    headline: "Thirty years of scientific discourse, mapped and re-derivable forever.",
    sections: [
      "500,000 arXiv papers spread evenly across 35 years (1991-2025) and across all eight disciplines arXiv covers.",
      "The engine looks at title and abstract only. It never sees which discipline arXiv has tagged the paper with.",
      "Headline number: how often the engine's groups match the disciplines arXiv's authors chose for themselves. (Chance is 12.5%.)",
      "Decade trajectory: how the discipline mix shifted across thirty years — the rise of computer science, the relative decline of physics.",
      "The engine flags possibly-emerging fields (recent papers, narrow time window, drawing from several disciplines at once) but does not name them. Readers click through to arxiv.org and decide.",
    ],
    recipe: "Re-download the same monthly arXiv snapshot, run our harvester, compare the file fingerprint to ours. Same input → same answer.",
  },
  pulse: {
    headline: "Fifty years of US innovation, deterministically disambiguated.",
    sections: [
      "500,000 inventor-records 1976-2025, drawn from the US Patent Office's open patent record (via PatentsView).",
      "The engine looks at four signals only: the inventor's name (with spelling variations smoothed out), who else was listed on that patent, who the patent was assigned to, and the inventor's city/state/country. Nothing else.",
      "Compared to PatentsView's gold-standard answer for who-each-record-belongs-to, the engine matches most of the time. The naive baseline (collapse identical names) is what the engine has to beat — because two different 'John Smith' patents are often two different people.",
      "Per-group signals (patent count, technology-domain spread, career length, solo-work share) flag possibly-singularly-prolific inventors. No naming. Click through to patents.uspto.gov for each one.",
    ],
    recipe: "Re-download the same PatentsView monthly snapshot, run our harvester, compare the file fingerprint to ours. Same input → same answer.",
  },
  receipt: {
    headline: "1,000 SEC 10-K filings summarized once, every answer verifiable, end of chain anchored to Bitcoin.",
    sections: [
      "1,000 annual reports filed by US public companies (2018-2025), summarized once via Claude Sonnet against a fixed prompt and a fixed output format. Both the prompt and the format are committed to source so anyone can read them.",
      "Each call gets a receipt — a small fingerprint over the prompt, the filing, the model used, the timestamp, and the answer that came back. Receipts are linked together so tampering with any one of them breaks the chain at that point.",
      "The end of the chain is recorded on the Bitcoin timechain via OpenTimeStamps. Backdating the entire chain is detectable by anyone with a Bitcoin node.",
      "The verifier at /receipt/verify runs entirely in your browser. Paste any receipt and confirm the fingerprint matches. Or replay the entire chain from the public source.",
    ],
    recipe: "Refetch the same SEC filings, look up each receipt on /receipt/verify, replay the full chain, run `ots verify` on the chain-head proof against the Bitcoin timechain.",
  },
  bombe: {
    headline: "Bletchley Park, reanalyzed: how Latent Ocean would have made the Bombe a hundred times more efficient.",
    sections: [
      "The Turing Bombe was the WWII codebreaking machine that broke the German Enigma cipher by exhaustive search, validated against suspected plaintext fragments. It was one of the most consequential engineering achievements of the twentieth century — and it was bottlenecked by which intercepted messages to point it at first.",
      "The substrate doesn't break ciphers. What it does is sort messages by how unusual they are, before any decryption attempt. A small number of messages stand structurally apart from the routine traffic — those are the ones worth spending Bombe time on. The rest of the corpus is filtered out cheaply.",
      "Pattern-of-life on intercept metadata — who sent what, when, to whom, on which call-sign, at which hour — is exactly the substrate's wheelhouse. Outliers in metadata structure are signals about which messages are operationally significant.",
      "Reanalysis of the historical decrypted corpus: Bletchley Park has released thousands of decrypted messages. Running the substrate on them would surface structural patterns the original operators didn't catch. Genuinely novel historical analysis on a public-domain wartime corpus.",
      "The honest claim is not 'Latent Ocean cracks the Bombe.' It is 'Latent Ocean would have made the Bombe roughly a hundred times more efficient by directing it at the right messages first.'",
    ],
    recipe: "v1 ships as a conceptual artifact: the substrate's outlier-detection and metadata-pattern-of-life primitives demonstrated against the four other showcases (which have run, or are runbook-ready). The Bletchley corpus harvest is queued as a fifth applied study; when it ships, the recipe will be: re-download the Bletchley archive, run our harvester, compare the file fingerprint to ours.",
  },
};

const PALETTE: Record<string, string> = {
  docsouth: "#7DD3FC",
  atlas:    "#A78BFA",
  pulse:    "#FCD34D",
  receipt:  "#34D399",
  bombe:    "#F87171",
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
              Five citable showcases.<br />
              <span className="text-white/45">One substrate underneath.</span>
            </h1>
            <p className="mt-9 text-lg text-white/65 max-w-3xl leading-snug">
              Each showcase below is a fully-citable, third-party-verifiable
              artifact running on the Latent Ocean substrate. The four
              together cover four buyer categories: research libraries
              (DocSouth), scientific publishers (Atlas), IP &amp; M&amp;A
              (Pulse), compliance &amp; AI governance (Receipt), and the
              underlying outlier-detection problem the Bombe solved at
              Bletchley Park (Bombe). Every output ships with fingerprints
              anyone can re-derive — over the input file, over the
              processed data, over the answer itself, plus chain-head
              proofs anchored to Bitcoin where appropriate. No mocks, no
              marketing demos.
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
              The five showcases above all run on Vault&apos;s engine.
              Tenant isolation enforced at the storage layer. Encryption
              at rest with keys held on your own appliance. SIEM-ready
              audit log wired in by default. A reproducible answer
              fingerprint on every output. Eighteen months of
              compliance engineering — done.
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
