import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { ALL_SHOWCASES, PRODUCTS, TIER_COLORS, TIER_LABELS } from "@/lib/products/data";

export const metadata: Metadata = {
  title:       "Products · Latent Ocean",
  description: "Five products. Same substrate underneath. Pulse for data dedup. Atlas for reproducible analytics. Receipt for AI attestation. Studio for archive concierge. Vault — Private Banking — for partners shipping AI to regulated customers.",
};

export default function ProductsOverviewPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-24 pt-12">
          <div className="max-w-[1300px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Products · the lineup
            </p>
            <h1 className="font-display font-medium text-[clamp(56px,9vw,128px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl">
              Five products,<br />
              <span className="text-white/45">one substrate underneath.</span>
            </h1>
            <p className="mt-8 text-lg text-white/65 max-w-3xl leading-snug">
              The engine — deterministic structural fingerprints,
              reproducible analyses, multi-tenant isolation, encrypted at
              rest, citable receipts on every output — is one piece of
              engineering. We sell it five ways. Each product addresses a
              different buyer, with the right shape of contract and the
              right tier for who they are. Pick the one that fits.
            </p>
          </div>
        </section>

        {/* The lineup */}
        <section className="relative px-6 py-20 border-b border-white/5">
          <div className="max-w-[1300px] mx-auto space-y-5">
            {PRODUCTS.map((p, i) => {
              const isVault = p.slug === "vault";
              return (
                <Link
                  key={p.slug}
                  href={`/${p.slug}`}
                  className={`block rounded-2xl border p-7 md:p-10 transition-colors ${
                    isVault
                      ? "border-white/25 bg-gradient-to-br from-white/[0.03] to-black hover:border-white/45"
                      : "border-white/10 bg-[#0a0a0a] hover:border-white/25"
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 md:gap-12 items-start">
                    {/* Left — name + tiers */}
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35 mb-3">
                        №{String(i + 1).padStart(2, "0")} · /{p.slug}
                      </div>
                      <div className="font-display text-4xl md:text-6xl tracking-[-0.04em] text-white leading-[0.95] mb-4">
                        {p.name}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.tiers.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center h-6 px-2.5 rounded-full font-mono text-[10px] uppercase tracking-[0.18em]"
                            style={{
                              backgroundColor: `${TIER_COLORS[t]}1a`,
                              border: `1px solid ${TIER_COLORS[t]}55`,
                              color: TIER_COLORS[t],
                            }}
                          >
                            {TIER_LABELS[t]}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right — pitch */}
                    <div>
                      <div className="font-display text-2xl md:text-3xl tracking-[-0.025em] text-white leading-snug mb-5">
                        {p.tagline}
                      </div>
                      <p className="text-[15px] text-white/65 leading-relaxed mb-6 max-w-2xl">
                        {p.what_it_does}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white/70 border-b border-white/30 pb-0.5">
                          Read the {p.name} page
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </span>
                        {p.proof_link && (
                          <span className="font-mono text-[11px] text-white/40">
                            Proof: {p.proof_link.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Public reference deployments — five citable showcases */}
        <section className="relative px-6 py-20 border-b border-white/5">
          <div className="max-w-[1300px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Public reference deployments
            </p>
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1.04] mb-3 max-w-3xl">
              Five citable showcases.<br />
              <span className="text-white/45">Four buyer categories. One substrate.</span>
            </h2>
            <p className="text-[15px] text-white/55 leading-relaxed mb-10 max-w-3xl">
              Every showcase below is a fully-citable, third-party-verifiable artifact running on the substrate underneath all five products. Hashes pinned. Receipts attestable. Re-derivable byte-for-byte.
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
                  <p className="text-[12px] text-white/65 leading-snug">
                    For {s.buyer.toLowerCase()}.
                  </p>
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

        {/* Substrate trust strip */}
        <section className="relative px-6 py-20 border-b border-white/5">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              The same engine on every tier of every product
            </p>
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1.05] mb-10 max-w-3xl">
              Deterministic. Reproducible.<br />
              <span className="text-white/45">Citable, by design.</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.05] border border-white/10 rounded-2xl overflow-hidden">
              {[
                { k: "determinism", v: "byte-identical",  s: "same input → same output → same receipt, decade after decade" },
                { k: "isolation",   v: "hard 404",        s: "tenant boundaries enforced at the storage layer, not in policy" },
                { k: "audit",       v: "CEF + OCSF",      s: "ingest into Splunk, Sentinel, ArcSight, Chronicle out of the box" },
              ].map((s) => (
                <div key={s.k} className="bg-black p-7">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 mb-3">{s.k}</div>
                  <div className="font-display text-[26px] tracking-[-0.025em] text-white leading-[1] mb-3">{s.v}</div>
                  <div className="font-mono text-[11px] text-white/50 leading-snug">{s.s}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/method" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white/70 hover:text-white border-b border-white/30 hover:border-white pb-0.5">
                Read the engineering proof at /method
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative px-6 pt-24">
          <div className="max-w-[1080px] mx-auto text-center">
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white mb-6">
              See the prices.<br />Pick a product.
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
              <Link href="/pricing" className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
                Pricing
              </Link>
              <Link href="/docsouth" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                Studio case study · DocSouth
              </Link>
              <Link href="/method" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                Engineering · /method
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
