import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { ALL_SHOWCASES, productBySlug } from "@/lib/products/data";

export const metadata: Metadata = {
  title:       "Vault · Private Banking · Latent Ocean",
  description: "Vault is the engine underneath your AI product when your customers are banks, hospitals, law firms, or governments. Private Banking tier — by application, fully bespoke, long-term partnership.",
};

export default function VaultPage() {
  const product = productBySlug("vault");
  if (!product) return null;
  const plan = product.plans[0];

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32 pb-32">
        {/* Hero — more spacious, more reserved */}
        <section className="relative px-6 border-b border-white/[0.04] pb-32 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex items-baseline gap-3 mb-9">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-white/45">
                Latent Ocean · Vault
              </span>
              <span className="inline-flex items-center h-6 px-3 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] border border-white text-white">
                Private Banking
              </span>
            </div>

            <h1 className="font-display font-medium tracking-[-0.04em] text-white leading-[0.95] max-w-4xl text-[clamp(48px,7vw,108px)]">
              Private Banking<br />
              <span className="text-white/45">for AI on regulated data.</span>
            </h1>

            <div className="mt-12 max-w-2xl space-y-6 text-[16.5px] text-white/80 leading-relaxed">
              <p>
                Vault is the engine underneath your product when your customers
                are banks, hospitals, law firms, or governments. Each one of
                your customers gets a fully isolated private model on their own
                data — separation enforced at the storage layer, encryption at
                rest, an audit log on every output, a citable receipt on every
                decision.
              </p>
              <p>
                Eighteen months of compliance engineering — done. A dedicated
                relationship manager throughout your engagement. White-glove
                onboarding for your team. Quarterly architectural reviews. A
                small number of partners at any time, by application.
              </p>
            </div>
          </div>
        </section>

        {/* The properties — quieter, gold-ish accent */}
        <section className="relative px-6 py-24 border-b border-white/[0.04]">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-white/45 mb-12">
              The properties of the engagement
            </p>

            <div className="space-y-12">
              {[
                {
                  title: "Hard tenant isolation",
                  body:  "Cross-tenant access fails by construction, not by application policy. The store's getModel(id, tenant_id) is the gate; cross-tenant queries return 404. You can sell to a bank and a competing bank in the same week and neither knows the other exists on your stack.",
                },
                {
                  title: "Encrypted at rest, key custody on the appliance",
                  body:  "AES-256-GCM with per-appliance master keys, generated and held local. No vendor escrow. No key in a foreign cloud. Your customer's data is encrypted with a key your customer controls. We hold no copy.",
                },
                {
                  title: "Append-only audit, SIEM-ingestible",
                  body:  "Every form, query, delete, export, and authentication event is logged. Output formats: CEF for ArcSight, QRadar, and Splunk legacy ingest; OCSF JSON for Sentinel, Chronicle, and modern SIEMs. Your customer's security team integrates with their existing pipeline on day one.",
                },
                {
                  title: "Single binary, deployable anywhere",
                  body:  "Helm chart, Terraform module, Docker Compose, static binary, or sealed offline tarball — your call. VPC, on-premise, fully air-gapped — your customer's call. We support all five postures with the same artifact.",
                },
                {
                  title: "Citable receipts on every output",
                  body:  "Every model decision your product produces returns a sha256 response_digest. Same input, same output, same receipt — byte-identical, decade after decade. Your customer's regulator can ask you to reproduce a finding from 2026; you can.",
                },
                {
                  title: "Substrate roadmap input",
                  body:  "Quarterly reviews with our engineering team. Your priorities feed our roadmap. The substrate work that ships in our next release is, in part, the work you needed for your next customer.",
                },
              ].map((item, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_2.5fr] gap-6 md:gap-12 pb-12 border-b border-white/[0.04] last:border-b-0 last:pb-0">
                  <div className="font-display text-2xl md:text-3xl tracking-[-0.025em] text-white leading-[1.1]">
                    {item.title}
                  </div>
                  <div className="text-[15px] text-white/70 leading-relaxed">
                    {item.body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Selection criteria */}
        <section className="relative px-6 py-24 border-b border-white/[0.04]">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-white/45 mb-6">
              Who we work with
            </p>
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1.05] mb-10 max-w-3xl">
              A small number of partners.<br />
              <span className="text-white/45">Long relationships, shared roadmap.</span>
            </h2>
            <div className="max-w-2xl space-y-5 text-[15.5px] text-white/75 leading-relaxed">
              <p>
                {product.who_for}
              </p>
              <p>
                Selection is by application. We accept a small number of new
                partners each quarter. The criteria are not financial — they
                are about the seriousness of the engagement and the depth of
                the regulatory environment your customers operate in. We work
                best with founders building real products for real customers,
                not with companies that need a vendor name to put on a
                roadmap slide.
              </p>
            </div>
          </div>
        </section>

        {/* The shape of the engagement */}
        <section className="relative px-6 py-24 border-b border-white/[0.04]">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-white/45 mb-6">
              The shape of the engagement
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 items-baseline">
              <div className="font-display text-4xl md:text-6xl tracking-[-0.035em] text-white leading-[1]">
                By invitation
              </div>
              <div className="space-y-4 text-[15px] text-white/70 leading-relaxed max-w-xl">
                <p>
                  Vault is a long-term partnership, not a transactional
                  product. We accept a small number of partners at any
                  time, on application. The engagement is structured
                  around your business — what you're shipping, who your
                  customers are, what regulatory environment you operate
                  in.
                </p>
                <p>
                  We discuss the practical shape of the engagement —
                  scope, deployment posture, pace, terms — in our
                  discovery call once we have decided we are both right
                  for each other.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Public reference deployments — Vault's substrate, demonstrated four times */}
        <section className="relative px-6 py-24 border-b border-white/[0.04]">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-white/45 mb-6">
              Public reference deployments
            </p>
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1.05] mb-6 max-w-3xl">
              Five citable showcases.<br />
              <span className="text-white/45">Four buyer categories. One substrate.</span>
            </h2>
            <p className="text-[15.5px] text-white/65 leading-relaxed mb-12 max-w-2xl">
              The four artifacts below all run on the Vault substrate. Each is third-party-verifiable: hashes pinned, receipts attestable, re-derivable byte-for-byte. Your customers&apos; deployments will look the same shape.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ALL_SHOWCASES.map((s) => (
                <Link
                  key={s.slug}
                  href={s.href}
                  className="block rounded-xl p-5 border border-white/10 bg-[#0a0a0a] hover:border-white/30 transition-colors"
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

        {/* CTA */}
        <section className="relative px-6 pt-32">
          <div className="max-w-[1100px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-12 items-end">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-white/45 mb-6">
                  Apply
                </p>
                <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1] mb-8">
                  Tell us<br />who you serve.
                </h2>
                <p className="text-[15.5px] text-white/65 leading-relaxed max-w-md mb-10">
                  We respond within two business days. If we are right for
                  each other, the discovery call is the next step.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-end">
                <Link
                  href="/contact?product=vault&tier=private_banking"
                  className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors"
                >
                  Apply for Vault
                </Link>
                <Link
                  href="/method"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors"
                >
                  See the substrate
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
