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
    title: "DocSouth · 4 collections · 711 texts · 180 years · named on every claim",
    blurb:
      "First public showcase deployment, end-to-end on a real institutional archive. Documenting the American South — UNC Libraries' digitized archive of Southern history. 37,505 segments across all four DocSouth collections (North American Slave Narratives, First-Person Narratives of the American South, Library of Southern Literature, The Church in the Southern Black Community), 65 MB from 711 source texts. Formation 121.8 s via real Python BTUT bridge in 8 merged chunks, 2,400 BTUT survivor fingerprints, fingerprinter_mode=btut. Sparse fallback dormant by design. (1) Persistent homology via ripser — Hamming-48 Vietoris-Rips, threshold 24, on 600 stride-sampled survivors in 74.5 s: H0 = 522 components, H1 = 179 cycles, H2 = 77 voids. Now rendered live on /method · topology, fetched from /api/range-public/showcase/docsouth — public, no auth. (2) Curatorial recovery: 12 unsupervised k-means classes vs four DocSouth collections — weighted purity 0.442, ~75% of the lift over chance. The largest class (957 survivors, 51% Slave Narratives) is structurally cohesive; the 9 'novel' classes are the genuine inter-collection overlap regions. (3) 180-year trajectory: 20 decades from the 1730s to the 1940s, peak 1850s with 340 survivors, drift across the centroid timeline averaging under 4 Hamming bits — the engine's 48-bit fingerprint captures stable archive features rather than topical drift, an honest finding now visible on /method · decade. (4) Named rarities: top-10 most structurally singular survivors, joined back to author + title + year + source URL. The single-most singular: Alfred Lee Ridgel's 'Africa and African Methodism' (1896, AME Church), Hamming-min 24/48 from its 32-record neighborhood. Followed by Isaac Johnson's 'Slavery Days in Old Kentucky' (1901). (5) RunPod GPU finalize — cuda, 50 epochs, 3 modules, final AUC 0.9045, 65 s end-to-end. (6) Verifiability: corpus_sha256 = ce4edcbd…, third-party-derivable from the public DocSouth ZIPs; response_digest = 08cea801…, internally reproducible under seed=42. Encrypted at rest (AES-256-GCM). Tenant: docsouth_showcase. Model: rng_772c6fb01bea38cb6a3a.",
    link: { label: "Open the showcase", href: "/method#docsouth" },
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
