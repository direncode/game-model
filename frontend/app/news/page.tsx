import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "News · Latent Ocean",
  description: "Announcements, dispatches, and engineering notes from Latent Ocean. Each entry references the commit and the formed-model digest where it landed.",
};

type Entry = {
  date: string;
  kind: "release" | "engineering" | "dispatch";
  title: string;
  blurb: string;
  link?: { label: string; href: string };
  digest?: string;
};

const ENTRIES: Entry[] = [
  {
    date: "2026 · 05 · 01",
    kind: "dispatch",
    title: "DocSouth · constellation engine + 100 findings · the network DocSouth's curators dispersed",
    blurb:
      "A second-layer artifact landed for DocSouth. Layer one: a regex-based named-entity engine over all 37,505 records, ranked by cross-text spread, surfacing the densest hub texts (C. S. Smith's AME History at 76 entities; Horace Talbert's Sons of Allen at 75; Richard R. Wright's Centennial Encyclopaedia at 74; A. W. Wayman's Cyclopaedia of African Methodism at 62 — the AME institutional autobiography in four volumes) AND the orthogonal Confederate-memoir cluster (Mosby, Boggs, Early, Gordon, Taylor, plus W. W. Holden — NC's impeached Reconstruction governor, the inverse moral arc). 192 cross-collection bridge entities span 3+ DocSouth collections; the engine output is at /api/range-public/showcase/docsouth-constellations. Layer two: a curated 100-finding catalog tracing connections from individual DocSouth nodes outward — 25 within DocSouth (testimonial register crosses Slave Narratives + First-Person + Library + Church via class #7), 25 to broader Black/Southern intellectual history (Ridgel→Turner→Blyden→Crummell→Du Bois→Coates is a 5-step chain inside primary sources), 25 into UNC's institutional history (Saunders Hall, Spencer, Silent Sam, Hannah-Jones, the $19M Reckoning commitment), and 25 forward to NC's present and future (Anderson Clayton's NC Democratic chairmanship at 25; Moore v. Harper; Saint Augustine's accreditation fight; the Smithfield-Mountaire labor lineage; Anita Earls's NC Supreme Court trajectory). Both layers loaded by the same /api/range-public/showcase/* public endpoints. The page is at /docsouth/constellations.",
    link: { label: "100 findings · constellations", href: "/docsouth/constellations" },
    digest: "08cea801c24e0f1c9aad12facee1e12ff469142aad8ba19385f80f84801ed714",
  },
  {
    date: "2026 · 05 · 01",
    kind: "dispatch",
    title: "DocSouth showcase · baselines, bleed, and a humanities-pace artifact at /docsouth",
    blurb:
      "The DocSouth deployment now ships at scholarly pace — a long-form artifact at /docsouth covering preface (the corpus is not neutral), method, topology, recovery, bleed analysis, 180-year drift, baselines, named singularities, verification, limits, and acknowledgements. Three new findings landed alongside it. (1) Baselines: TF-IDF + KMeans reaches 0.490 weighted purity on the same 2,400 survivors with k=12; LDA reaches 0.476; the engine's deterministic 48-bit fingerprint reaches 0.442. Honest finding: full-text NLP beats the engine on raw curatorial recovery on a text corpus. The engine wins on different axes (32 KB fixed-size artifact vs the 65 MB needed to re-derive TF-IDF, deterministic re-issuability, version-stable). (2) Bleed: class #7 holds 957 survivors; 51% are Slave Narratives, the remaining 49% spread almost evenly across the other three collections (165 First-Person, 156 Library, 144 Church). An even bleed across three different curatorial categories is structural similarity that crosses the curatorial boundary — a testimonial register the engine reads as one signal regardless of where the archive's editors filed each text. (3) Content drift redeemed: a Bloom-style 48-bit projection of each record's top-32 TF-IDF terms produces a content-weighted fingerprint variant; average decade-to-decade drift roughly doubles (0.68 → 1.37 bits, +0.69 lift) and peaks at 8/48. Both variants are valid for different uses; both are published. Plus: PersistenceBarcodeWidget gains an expand-all toggle (522 H0 + 179 H1 + 77 H2 bars browsable from /method · section 6); /docsouth and /method both load from the same public artifact at /api/range-public/showcase/docsouth. The artifact is snapshot at git tag docsouth-v1 internally and served publicly from the EC2 endpoint above.",
    link: { label: "Open the scholarly artifact", href: "/docsouth" },
    digest: "08cea801c24e0f1c9aad12facee1e12ff469142aad8ba19385f80f84801ed714",
  },
  {
    date: "2026 · 04 · 30",
    kind: "release",
    title: "Range Console 1.0",
    blurb:
      "Universal private model former. Generic adapter for JSON / NDJSON / CSV / plaintext, real Python BTUT bridge, sparse-operator fallback chain (MinHash · SimHash · Bloom · byte-hash), chunked formation with no record cap, RunPod async, encrypted artifact store, internal HMAC auth, tenant isolation, ten stack integrations with live emulation. The whole substrate end-to-end on production.",
    link: { label: "Open the workbench", href: "/console" },
    digest: "8571c974391da62724abbecdcb356f83ddf614f44aff9b71cc8168219c03963f",
  },
  {
    date: "2026 · 04 · 29",
    kind: "engineering",
    title: "The 5,000-record bridge cap is gone",
    blurb:
      "Previously the BTUT bridge took the first 5,000 records and stopped. Today's commit chunked the formation: 26 chunks of 5,000 each merge into one formed-model artifact for the full NSL-KDD corpus (125,973 records, 19 MB) in 6.1 seconds. Adapter chain telemetry is now persisted on every artifact.",
    link: { label: "API surface", href: "/api-docs" },
  },
  {
    date: "2026 · 04 · 30",
    kind: "engineering",
    title: "Sparse-operator fallback chain online",
    blurb:
      "When the primary BTUT path can't fit a corpus shape, the orchestrator now falls through to MinHash 128-permutation, then SimHash 48-bit shingle, then Bloom-projection of sparse boolean features, then byte-hash as the failsafe. Each strategy reports records-covered + wall-time on the formed model. No corpus rejected; coverage_pct on every artifact.",
  },
  {
    date: "2026 · 04 · 28",
    kind: "release",
    title: "Operator console — audit + encryption + identity",
    blurb:
      "Append-only audit log with CEF and OCSF export for SIEM ingest. AES-256-GCM at rest with auto-generated per-appliance master key. Internal HMAC bearer tokens. Tenant-scoped formed-model store. Identity strip on every console page showing user, tenant, encryption key fingerprint, BTUT bridge URL, RunPod availability.",
    link: { label: "Read the API", href: "/api-docs" },
  },
  {
    date: "2026 · 04 · 27",
    kind: "dispatch",
    title: "From Sentinel to Console",
    blurb:
      "The defense-flavored Sentinel page was retired. Range was rebuilt as the universal Console — eight verticals, one engine, no per-vertical hardcoding. The cybersecurity story is now one of many; the engine generalised across SEC EDGAR filings, PubMed abstracts, USPTO patents, UN Comtrade flows, USGS seismicity, and crypto markets without code changes.",
  },
  {
    date: "2026 · 04 · 26",
    kind: "engineering",
    title: "Real Python BTUT over an HTTP bridge",
    blurb:
      "The Node frontend container now HTTP-bridges to the api container's run_btut_pipeline. fingerprinter_mode = btut on every formation response; bridge URL exposed via x-range-bridge-url header. The whole 8-tier BTUT pipeline runs on real corpora with 300 survivors per chunk and real persistence-homology output.",
  },
  {
    date: "2026 · 04 · 25",
    kind: "release",
    title: "Determinism contract on every endpoint",
    blurb:
      "Every response from /api/range-* now carries a sha256-canonicalized response_digest. Re-issuing the same call against the same model returns byte-identical bytes. CI tests this on every commit. The digest is the single load-bearing claim of the platform.",
  },
];

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-24">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              News · dispatches
            </p>
            <h1 className="font-display font-medium text-[clamp(56px,9vw,128px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl">
              What changed,<br />
              <span className="text-white/45">and the digest where it landed.</span>
            </h1>
            <p className="mt-8 text-lg text-white/65 max-w-3xl leading-snug">
              Every release, every engineering note, every dispatch from
              the engine. Each entry references the commit hash and, where
              applicable, the formed-model digest the change made
              reproducible. No marketing posts. No quarterly fluff.
            </p>
          </div>
        </section>

        {/* Feed */}
        <section className="relative px-6 py-12">
          <div className="max-w-[1080px] mx-auto">
            <div className="space-y-3">
              {ENTRIES.map((e, i) => (
                <article
                  key={e.title}
                  className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-7 md:p-9 hover:border-white/20 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-3 mb-4">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
                      {e.date} · {e.kind}
                    </div>
                    <div className="font-mono text-[10px] text-white/30 tabular-nums">
                      № {String(ENTRIES.length - i).padStart(3, "0")}
                    </div>
                  </div>
                  <h2 className="font-display font-medium text-2xl md:text-4xl tracking-[-0.025em] text-white mb-4 leading-tight">
                    {e.title}
                  </h2>
                  <p className="text-[15px] text-white/65 leading-snug max-w-3xl mb-5">{e.blurb}</p>
                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                    {e.link ? (
                      <Link
                        href={e.link.href}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white/70 hover:text-white border-b border-white/30 hover:border-white pb-0.5 self-start"
                      >
                        {e.link.label}
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </Link>
                    ) : (
                      <span className="hidden md:block" />
                    )}
                    {e.digest && (
                      <code className="font-mono text-[10.5px] text-white/40 truncate max-w-full">
                        digest · sha256:{e.digest.slice(0, 22)}…
                      </code>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* RSS / subscribe */}
        <section className="relative px-6 py-24 border-t border-white/5">
          <div className="max-w-[1080px] mx-auto text-center">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Subscribe · low-volume
            </p>
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white mb-6">
              One dispatch per material change.
            </h2>
            <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-snug">
              Engineering-only. No newsletters. We send when a release
              ships or when the determinism contract changes shape — about
              once every two weeks. RSS available for the dispatched.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:engineering@latentocean.com?subject=Subscribe%20to%20dispatches"
                className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors"
              >
                Subscribe by email
              </a>
              <Link
                href="/feed.xml"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors"
              >
                RSS · /feed.xml
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
