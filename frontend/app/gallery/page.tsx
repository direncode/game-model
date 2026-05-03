import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "Gallery · Latent Ocean",
  description:
    "Five corpora, five OCEAN programs, five real artifacts. Substrate clustering on heterogeneous data — arXiv research, WWII intelligence archives, US patents, SEC filings, 180 years of literary drift. Demonstration evidence, not products.",
};

const SHOWCASES = [
  {
    slug: "atlas/arxiv",
    label: "Atlas",
    corpus: "arXiv (700K papers, 1990s–2020s)",
    finding: "Engine groups match 8 archive disciplines unsupervised. Cross-discipline bleed surfaced as emergence candidates — recent papers from one archive that cluster topologically near another.",
    color: "text-cyan-300",
  },
  {
    slug: "bombe",
    label: "Bombe",
    corpus: "TNA HW catalogue (2,169 GC&CS records, 1914–1974)",
    finding: "HW 1 (directorate-to-PM) dominates zero modules across five seeds — content-routes to diplomatic, comintern, and German-Section basins. The engine surfaced that HW 1 is destination-organized, not content-typed, without being told the labels.",
    color: "text-amber-300",
  },
  {
    slug: "pulse/uspto-inventors",
    label: "Pulse",
    corpus: "USPTO inventors (PatentsView, full corpus)",
    finding: "Cross-IPC polymath inventors surfaced; productivity-shift decade clusters; structurally singular records flagged.",
    color: "text-emerald-300",
  },
  {
    slug: "receipt/sec-edgar",
    label: "Receipt",
    corpus: "SEC EDGAR 10-K filings",
    finding: "Filing-chain coherence over decade trajectories; structural signature of distress flagged across categorical signals.",
    color: "text-rose-300",
  },
  {
    slug: "docsouth",
    label: "DocSouth",
    corpus: "Documenting the American South (literary archive, 1740s–1920s)",
    finding: "180 years of structural drift; collection-by-decade composition shows curatorial structure recovered unsupervised; 10 rarest survivors named with author + URL.",
    color: "text-violet-300",
  },
];

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32">
        <section className="px-6 pb-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              GALLERY · DEMONSTRATION EVIDENCE
            </p>
            <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[20ch]">
              Five corpora. Five OCEAN programs. Five real artifacts.
            </h1>
            <p className="text-[17px] leading-[1.65] text-white/65 max-w-[60ch] mb-6">
              Each entry below is a demonstration that the substrate-clustering primitive works on real heterogeneous data. They are not products. They are sales collateral that any prospective integrator can reproduce by running the same OCEAN program on their own infrastructure.
            </p>
            <p className="text-[15px] leading-[1.65] text-white/50 max-w-[60ch]">
              Source NDJSON, OCEAN program, generation seed, output sha256: all published. Same six-line pipeline shape across every showcase — what changes is the corpus, not the operators.
            </p>
          </div>
        </section>

        {/* Cards */}
        <section className="px-6 py-20 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {SHOWCASES.map(s => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-8 transition-colors"
              >
                <p className={`font-mono text-[10.5px] uppercase tracking-[0.22em] ${s.color}/85 mb-3`}>
                  {s.label}
                </p>
                <p className="font-mono text-[12px] text-white/55 mb-5">{s.corpus}</p>
                <p className="text-[14.5px] leading-[1.6] text-white/80 mb-6 min-h-[5em]">
                  {s.finding}
                </p>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">
                  Open showcase →
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* What this is and isn't */}
        <section className="px-6 py-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/80 mb-4">
                What this is
              </p>
              <ul className="space-y-3 text-[15px] leading-[1.65] text-white/75">
                <li>• Proof the substrate handles heterogeneous corpora — text, structured records, time series, graph fragments — through one operator catalog.</li>
                <li>• Demonstration that the same six-line OCEAN pipeline works across vastly different domains. The operators are corpus-agnostic.</li>
                <li>• Evidence that the engine surfaces structural patterns the labels don&apos;t encode — including the directorate_to_pm dispersion finding on the Bombe corpus, replicated across seeds.</li>
                <li>• Reproducible: every artifact ships with the source NDJSON, the OCEAN program, the seed, and the output sha256.</li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber-300/80 mb-4">
                What this isn&apos;t
              </p>
              <ul className="space-y-3 text-[15px] leading-[1.65] text-white/75">
                <li>• Not products. We don&apos;t sell Atlas, Bombe, Pulse, Receipt, or DocSouth. They are example programs.</li>
                <li>• Not analyses-for-hire. We don&apos;t run customer corpora through the substrate as a service.</li>
                <li>• Not novel research findings, mostly. The Bombe HW 1 dispersion is the closest thing — it&apos;s hypothesis-shaped, replicated across five seeds, but a domain historian would investigate it before citing.</li>
                <li>• Not a complete picture of what the substrate can do. The five showcases are five corpora; the substrate handles any NDJSON-shaped corpus.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              REPRODUCE ANY OF THESE
            </p>
            <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-10 max-w-[34ch]">
              The OCEAN program for each showcase is six lines. Bring your own corpus.
            </h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/language" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                The OCEAN Language →
              </Link>
              <Link href="/protocols" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                Layer 1 — Protocols →
              </Link>
              <Link href="/build" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                Layer 2 — Build →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
