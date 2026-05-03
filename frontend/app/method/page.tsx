import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { ALL_SHOWCASES } from "@/lib/products/data";
import { MultiTenantSplitWidget } from "@/components/landing/widgets/MultiTenantSplitWidget";
import { SparseFallbackChainWidget } from "@/components/landing/widgets/SparseFallbackChainWidget";
import { RangeQLPlaygroundWidget } from "@/components/landing/widgets/RangeQLPlaygroundWidget";
import { LineageMerkleProofWidget } from "@/components/landing/widgets/LineageMerkleProofWidget";
import { AuditFeedTerminalWidget } from "@/components/landing/widgets/AuditFeedTerminalWidget";
import { PersistenceBarcodeWidget } from "@/components/landing/widgets/PersistenceBarcodeWidget";
import { NullTestPermutationWidget } from "@/components/landing/widgets/NullTestPermutationWidget";
import { ClusterPurityWidget } from "@/components/landing/widgets/ClusterPurityWidget";
import { DecadeTrajectoryWidget } from "@/components/landing/widgets/DecadeTrajectoryWidget";
import { NamedRareRecordsWidget } from "@/components/landing/widgets/NamedRareRecordsWidget";
import { CorpusVerificationWidget } from "@/components/landing/widgets/CorpusVerificationWidget";
import { BaselineComparisonWidget } from "@/components/landing/widgets/BaselineComparisonWidget";
import { CrossCollectionBleedWidget } from "@/components/landing/widgets/CrossCollectionBleedWidget";
import { ContentDriftWidget } from "@/components/landing/widgets/ContentDriftWidget";

export const metadata: Metadata = {
  title: "Method · Latent Ocean",
  description:
    "The engine in motion. Seven concrete demonstrations of what the deterministic substrate does — multi-tenant isolation, sparse fallback, RangeQL, lineage, audit, topology, statistical falsifiability.",
};

type SectionProps = {
  kicker: string;
  title: React.ReactNode;
  body: string;
  children: React.ReactNode;
  anchor: string;
};

function Section({ kicker, title, body, children, anchor }: SectionProps) {
  return (
    <section id={anchor} className="relative px-6 py-24 border-b border-white/5 scroll-mt-24">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
          {kicker}
        </p>
        <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white leading-[0.96] mb-6 max-w-4xl">
          {title}
        </h2>
        <p className="text-[15.5px] text-white/65 max-w-3xl leading-snug mb-12">
          {body}
        </p>
        {children}
      </div>
    </section>
  );
}

export default function MethodPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-20 pt-12">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Method · the engine in motion
            </p>
            <h1 className="font-display font-medium text-[clamp(56px,9vw,128px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl">
              Seven proofs.<br />
              <span className="text-white/45">One substrate.</span>
            </h1>
            <p className="mt-8 text-lg text-white/65 max-w-3xl leading-snug">
              The platform's claims are testable. Each section below is a
              live exercise of one capability against the same backend
              that the workbench runs on. Every widget either calls a real{" "}
              <code className="font-mono text-white/85">/api/range-*</code>{" "}
              endpoint or computes from Web Crypto in your browser. No
              mocks. No vertical-flavoring. The corpus is generic; the
              behaviour is the engine.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-snug">
              <span className="text-white/80">This page is for engineering evaluators</span> — your
              CTO, your head of platform, your security architect. It is
              the proof that the substrate underneath every Latent Ocean
              product is real. If you are evaluating Latent Ocean as a
              business, the simpler path is{" "}
              <a href="/products" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white pb-px">
                /products
              </a>{" "}
              and{" "}
              <a href="/how-it-works" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white pb-px">
                /how-it-works
              </a>
              . If you are evaluating the engine, this is the page.
            </p>
            <div className="mt-10 flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              {[
                "isolation", "resilience", "query", "provenance",
                "audit", "topology", "falsifiability",
                "curatorial recovery", "decade drift", "named rare", "verifiable",
                "baselines", "bleed", "content drift",
              ].map((t, i) => (
                <a
                  key={t}
                  href={`#section-${i + 1}`}
                  className="inline-flex items-center h-7 px-3 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 transition-colors"
                >
                  {String(i + 1).padStart(2, "0")} · {t}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Public reference deployments — four showcases on the same substrate */}
        <section className="relative px-6 py-20 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Public reference deployments
            </p>
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1.04] mb-3 max-w-3xl">
              Five citable showcases, every output third-party-verifiable.
            </h2>
            <p className="text-[15px] text-white/55 leading-relaxed mb-10 max-w-3xl">
              The seven proofs below are the engine&apos;s isolated capabilities.
              Below are four end-to-end deployments that exercise the entire
              substrate — corpus harvest, fingerprinting, formation, audit
              log, public artifact — against four different buyer-category
              datasets. Every receipt, every cluster, every chain head is
              re-derivable from the published hashes.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ALL_SHOWCASES.map((s) => (
                <Link
                  key={s.slug}
                  href={s.href}
                  className="block rounded-xl p-5 border border-white/10 bg-[#0a0a0a] hover:border-white/25 transition-colors"
                >
                  <div className="font-display text-2xl tracking-[-0.025em] text-white mb-2">
                    {s.label}
                  </div>
                  <p className="font-mono text-[11px] text-white/50 leading-relaxed mb-2">{s.blurb}</p>
                  <p className="text-[12px] text-white/65 leading-snug">For {s.buyer.toLowerCase()}.</p>
                  <span className="mt-3 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 border-b border-white/20 pb-0.5">
                    {s.href}
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 1. Multi-tenant isolation */}
        <Section
          anchor="section-1"
          kicker="01 · Isolation · two tenants, one substrate"
          title={<>Hard tenant boundaries.<br /><span className="text-white/45">Same backend, two artifact stores.</span></>}
          body="Two short-lived demo tokens are minted. Two formations fire concurrently — one for tenant α, one for tenant β. Each tenant gets its own artifact ID and its own response digest. Then each tenant's bearer token is used to GET the OTHER tenant's artifact ID. The route's getModel(id, tenant_id) is the gate; both probes return 404, which is the proof."
        >
          <MultiTenantSplitWidget />
        </Section>

        {/* 2. Sparse fallback chain */}
        <Section
          anchor="section-2"
          kicker="02 · Resilience · five strategies, zero rejections"
          title={<>The orchestrator falls through<br /><span className="text-white/45">until something fits.</span></>}
          body="When the primary BTUT path can't fit a corpus shape, the orchestrator cascades through MinHash, SimHash, Bloom-projection, and byte-hash failsafe. The widget posts a generic corpus to /api/range-form, then renders which strategy actually produced coverage and how many records each attempt absorbed. The names are public crypto primitives; the cascade is the contribution."
        >
          <SparseFallbackChainWidget />
        </Section>

        {/* 3. RangeQL playground */}
        <Section
          anchor="section-3"
          kicker="03 · Query · the SQL-shaped surface"
          title={<>Same model, same question,<br /><span className="text-white/45">byte-identical hash.</span></>}
          body="Six canned queries run against a live formed model. The response includes the answer text, citations into the source corpus, computed metrics, and a sha256 response_digest. Re-issue the same query against the same model and the digest is byte-identical — that is the determinism contract, surfaced where you can read it."
        >
          <RangeQLPlaygroundWidget />
        </Section>

        {/* 4. Lineage Merkle proof */}
        <Section
          anchor="section-4"
          kicker="04 · Provenance · cryptographically verifiable history"
          title={<>Every event in the chain<br /><span className="text-white/45">is in or out — no maybe.</span></>}
          body="A generic eight-event lineage chain. Click any leaf to render its Merkle inclusion proof to root. The proof is computed in your browser using Web Crypto SHA-256. Tamper with one byte anywhere and the recomputed root diverges. Merkle trees have been published cryptography since Ralph Merkle, 1979."
        >
          <LineageMerkleProofWidget />
        </Section>

        {/* 5. Audit feed terminal */}
        <Section
          anchor="section-5"
          kicker="05 · Audit · CEF, OCSF, append-only"
          title={<>Three formats of the same<br /><span className="text-white/45">SIEM-ingestible byte stream.</span></>}
          body="Live tail of the appliance's audit log. Switch between human-readable, CEF (ArcSight / QRadar / Splunk legacy ingest), and OCSF JSON (modern SIEM standard). The chain bar runs SHA-256 forward across canonical(event); tamper with one byte and the head diverges. Verification runs in your browser using the same primitive the appliance uses at write time."
        >
          <AuditFeedTerminalWidget />
        </Section>

        {/* 6. Persistence barcode — now backed by the live DocSouth showcase */}
        <Section
          anchor="section-6"
          kicker="06 · Topology · H0, H1, H2 — DocSouth · UNC Libraries"
          title={<>The shape of a real corpus,<br /><span className="text-white/45">in three dimensions.</span></>}
          body="Persistent homology over the BTUT survivor fingerprints of Documenting the American South — UNC Libraries' digitized archive of Southern history. Computed end-to-end via the api container's ripser endpoint with Hamming-48 metric and threshold 24. The bars below are not illustrative. They are what the engine produces from this specific corpus under seed=42. Re-running the formation produces byte-identical bars."
        >
          <PersistenceBarcodeWidget showcase="docsouth" showcaseLabel="DocSouth · UNC Libraries (4 collections)" />
        </Section>

        {/* 7. Null test */}
        <Section
          anchor="section-7"
          kicker="07 · Falsifiability · 5,000 permutations"
          title={<>If the structure is real,<br /><span className="text-white/45">shuffles destroy it.</span></>}
          body="A 40-record synthetic corpus is generated from a fixed seed; the row order encodes a real structural regime in the first 30 rows. The widget runs 5,000 random shuffles and recomputes the rarity statistic each time. The observed value lands in the tail of the null distribution at p < 1/5000. Permutation testing has been the gold standard for 'is this signal real or shuffle-luck' since E.J.G. Pitman, 1937."
        >
          <NullTestPermutationWidget />
        </Section>

        {/* DocSouth showcase — separator + sub-hero */}
        <section id="docsouth" className="relative px-6 py-24 border-b border-white/5 scroll-mt-24 bg-white/[0.01]">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              DocSouth · UNC Libraries · the engine on a real archive
            </p>
            <h2 className="font-display font-medium text-[clamp(48px,7vw,108px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl">
              711 source texts.<br />
              <span className="text-white/45">180 years of Southern discourse.</span>
            </h2>
            <p className="mt-8 text-lg text-white/65 max-w-3xl leading-snug">
              The four sections below are the engine's findings on
              Documenting the American South — UNC Libraries' digitized
              archive of Southern history (Slave Narratives, First-Person
              Narratives, Library of Southern Literature, Church in the
              Southern Black Community). 37,505 segments, 65 MB, formed
              in 122s via real Python BTUT bridge, 2,400 survivors, 12
              k-means classes, ripser-computed H0/H1/H2 persistence, and
              a RunPod GPU finalize. Every number on this page is
              fetched from{" "}
              <code className="font-mono text-white/85">/api/range-public/showcase/docsouth</code>{" "}
              — public, no auth, cacheable.
            </p>
          </div>
        </section>

        {/* 8. Cluster purity */}
        <Section
          anchor="section-8"
          kicker="08 · Curatorial recovery · unsupervised"
          title={<>Does the engine find<br /><span className="text-white/45">the archive's curatorial structure?</span></>}
          body="The engine never sees the collection labels during formation. After k-means crystallizes 12 classes from 2,400 BTUT survivor fingerprints, we project each survivor back to its DocSouth collection and measure how well the unsupervised clustering recovers the four curatorial boundaries. Weighted purity at 0.44 — chance is 0.25 with four collections, so the engine recovers ~75% of the lift over random. The 9 classes the taxonomy reports as 'novel' are the regions where the four collections genuinely overlap structurally."
        >
          <ClusterPurityWidget showcase="docsouth" />
        </Section>

        {/* 9. Decade trajectory */}
        <Section
          anchor="section-9"
          kicker="09 · 180 years · 1730s → 1940s"
          title={<>Composition through time,<br /><span className="text-white/45">drift through Hamming space.</span></>}
          body="Each column is one decade of DocSouth's coverage. Bar height is how many BTUT survivors that decade contributed; the stacked colors show which collection contributed them. The cyan dot above each column is the Hamming distance from the previous decade's centroid. The 1850s are the corpus' peak decade with 340 survivors. Drift dots are small across the timeline — an honest finding: the 48-bit fingerprint captures stable archive features, not topical decade-to-decade drift. To capture topical movement, the formation pipeline would need a content-weighted fingerprint variant."
        >
          <DecadeTrajectoryWidget showcase="docsouth" />
        </Section>

        {/* 10. Named rare records */}
        <Section
          anchor="section-10"
          kicker="10 · Named singularities · joinable to source"
          title={<>The engine's rarity claim,<br /><span className="text-white/45">with author, title, and year.</span></>}
          body="The 10 most structurally singular BTUT survivors in the DocSouth model. Each entry is the result of a back-join from the survivor's recordIdx into the corpus metadata, surfacing collection / author / title / year and a click-through to the source text on docsouth.unc.edu. Same model + same seed produces the same ranking, forever."
        >
          <NamedRareRecordsWidget showcase="docsouth" />
        </Section>

        {/* 11. Verification */}
        <Section
          anchor="section-11"
          kicker="11 · Externally verifiable"
          title={<>Two hashes.<br /><span className="text-white/45">Either anyone can check.</span></>}
          body="The corpus_sha256 is third-party-derivable from the public DocSouth ZIP archives — re-download, re-harvest, re-hash, compare. The response_digest is invariant under (corpus, model_id, seed=42) and reproduces internally. The full verification recipe is one block away. The 2,400 BTUT-survivor fingerprint hex strings themselves stay private; everything that lets you verify the claim publicly does not."
        >
          <CorpusVerificationWidget showcase="docsouth" />
        </Section>

        {/* 12. Baseline comparison */}
        <Section
          anchor="section-12"
          kicker="12 · Baselines · TF-IDF, LDA, chance"
          title={<>The honest comparison.<br /><span className="text-white/45">On a text corpus, full-text NLP wins curatorial recovery.</span></>}
          body="A humanities reader will reasonably ask how 0.442 weighted purity compares to TF-IDF + k-means or LDA. We ran both on the same 2,400 survivors with k=12 and seed=42. TF-IDF reaches 0.490; LDA reaches 0.476. Both beat the engine's structural fingerprint on this metric. The engine wins on different axes — fixed-size 32 KB artifact vs the 65 MB corpus required to re-derive TF-IDF, deterministic re-issuability, version-stable across sklearn upgrades. Surfacing the loss publicly is the contract."
        >
          <BaselineComparisonWidget showcase="docsouth" />
        </Section>

        {/* 13. Cross-collection bleed */}
        <Section
          anchor="section-13"
          kicker="13 · Bleed · where the actual finding is"
          title={<>Class #7 is 51% Slave Narratives.<br /><span className="text-white/45">The other 49% is the finding.</span></>}
          body="The single largest k-means class is dominated by Slave Narratives at 51% — and the remaining 49% spreads almost evenly across the other three collections (165 First-Person, 156 Library, 144 Church). An even bleed across three different curatorial categories is structural similarity that crosses the curatorial boundary — a testimonial register the engine reads as one signal regardless of where the archive's editors filed each text. Click any class to inspect its breakdown, year range, and most-frequent bleed authors."
        >
          <CrossCollectionBleedWidget showcase="docsouth" />
        </Section>

        {/* 14. Content drift */}
        <Section
          anchor="section-14"
          kicker="14 · Content drift · the structural variant redeemed"
          title={<>The structural fingerprint flatlines.<br /><span className="text-white/45">A content-weighted variant doesn&rsquo;t.</span></>}
          body="The structural 48-bit fingerprint shows ~0–4 Hamming bits of decade-to-decade drift across 180 years — content-light by design. We built a content-weighted variant (Bloom-style 48-bit projection of each record's top-32 TF-IDF terms) and recomputed decade centroids on the same 2,400 survivors. Average drift roughly doubles (0.68 → 1.37 bits, +0.69 lift); peak drift hits 8/48. Both variants are valid; the platform now publishes both and documents the trade-off."
        >
          <ContentDriftWidget showcase="docsouth" />
        </Section>

        {/* CTA */}
        <section className="relative px-6 pt-32">
          <div className="max-w-[1080px] mx-auto text-center">
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-6">
              Now run it on your bytes.
            </h2>
            <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-snug">
              The widgets above are the same engine. Drop a corpus into
              the workbench, or read the API surface and bridge it to
              your stack. Same determinism, same isolation, same proofs.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/console"
                className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors"
              >
                Open the workbench
              </Link>
              <Link
                href="/api-docs"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors"
              >
                Read the API
              </Link>
              <Link
                href="/platform"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors"
              >
                The primitive
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
