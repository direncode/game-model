import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { PRODUCTS, TIER_COLORS, TIER_LABELS, type Tier } from "@/lib/products/data";

export const metadata: Metadata = {
  title:       "Pricing · Latent Ocean",
  description: "Five products, three tiers — plus a Private Banking floor for partners shipping AI to regulated customers. Free to start; talk to us when you scale.",
};

const TIER_ORDER: Tier[] = ["consumer", "pro", "enterprise"];

export default function PricingPage() {
  // Build a map: product → tier → plan (for the comparison table)
  const cellPlan = (productSlug: string, tier: Tier) => {
    const p = PRODUCTS.find((x) => x.slug === productSlug);
    return p?.plans.find((pl) => pl.tier === tier);
  };

  // The four tiered products (Pulse, Atlas, Receipt, Studio); Vault sits separately
  const tieredProducts = PRODUCTS.filter((p) => p.slug !== "vault");
  const vault          = PRODUCTS.find((p) => p.slug === "vault")!;

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-24 pt-12">
          <div className="max-w-[1300px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Pricing
            </p>
            <h1 className="font-display font-medium text-[clamp(56px,9vw,128px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl">
              Five products,<br />
              <span className="text-white/45">three tiers, one floor up.</span>
            </h1>
            <p className="mt-8 text-lg text-white/65 max-w-3xl leading-snug">
              Each product is offered on the tiers that make sense for who
              it serves. Pulse, Atlas, and Receipt run on the Consumer ·
              Pro · Enterprise ladder. Studio is an Enterprise concierge
              service. Vault sits one floor up — Private Banking, by
              invitation — and is described separately at the bottom.
            </p>
          </div>
        </section>

        {/* Tier-by-product matrix */}
        <section className="relative px-6 py-20 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1.2fr_repeat(3,_1fr)] border-b border-white/10">
                <div className="p-5 md:p-6 font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 border-r border-white/10">
                  Product / Tier
                </div>
                {TIER_ORDER.map((t) => (
                  <div key={t} className="p-5 md:p-6 border-r border-white/10 last:border-r-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS[t] }} />
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.22em]" style={{ color: TIER_COLORS[t] }}>
                        {TIER_LABELS[t]}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-white/40">
                      {t === "consumer" && "Free to start"}
                      {t === "pro"      && "Subscription"}
                      {t === "enterprise" && "Talk to us"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Product rows */}
              {tieredProducts.map((p) => (
                <div key={p.slug} className="grid grid-cols-[1.2fr_repeat(3,_1fr)] border-b border-white/[0.04] last:border-b-0">
                  <div className="p-5 md:p-6 border-r border-white/10 flex flex-col justify-center">
                    <div className="font-display text-2xl tracking-[-0.025em] text-white mb-1">
                      <Link href={`/${p.slug}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </div>
                    <div className="font-mono text-[11px] text-white/55 leading-snug">
                      {p.tagline}
                    </div>
                  </div>
                  {TIER_ORDER.map((t) => {
                    const plan = cellPlan(p.slug, t);
                    if (!plan) {
                      return (
                        <div key={t} className="p-5 md:p-6 border-r border-white/10 last:border-r-0 flex items-center justify-center">
                          <span className="font-mono text-[10.5px] text-white/25">—</span>
                        </div>
                      );
                    }
                    return (
                      <div key={t} className="p-5 md:p-6 border-r border-white/10 last:border-r-0 flex flex-col">
                        <div className="font-display text-xl md:text-2xl tracking-[-0.02em] text-white mb-0.5">
                          {plan.price}
                        </div>
                        {plan.cadence && (
                          <div className="font-mono text-[10px] text-white/40 mb-3">{plan.cadence}</div>
                        )}
                        <Link
                          href={plan.cta.href}
                          className={`mt-auto inline-flex items-center justify-center h-9 px-3 rounded-full text-[11px] font-medium transition-colors ${
                            t === "consumer"
                              ? "bg-white text-black hover:bg-white/90"
                              : "border border-white/20 text-white/85 hover:text-white hover:border-white/40"
                          }`}
                        >
                          {plan.cta.label}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Vault — Private Banking, separate floor */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1300px] mx-auto">
            <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.02] to-black p-8 md:p-12">
              <div className="flex flex-wrap items-baseline gap-3 mb-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/45">
                  One floor up
                </span>
                <span className="inline-flex items-center h-6 px-3 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] border border-white text-white">
                  Private Banking
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-12">
                <div>
                  <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white leading-[1] mb-7">
                    {vault.name}
                  </h2>
                  <p className="text-[16.5px] text-white/80 leading-relaxed mb-7 max-w-2xl">
                    {vault.what_it_does}
                  </p>
                  <p className="text-[15px] text-white/60 leading-relaxed max-w-2xl">
                    {vault.who_for}
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end justify-between">
                  <div className="md:text-right">
                    <div className="font-display text-3xl md:text-4xl tracking-[-0.025em] text-white mb-1">
                      By invitation
                    </div>
                    <div className="font-mono text-[11px] text-white/40 mb-8">
                      bespoke engagement
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/vault"
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors"
                    >
                      Read the engagement
                    </Link>
                    <Link
                      href="/contact?product=vault&tier=private_banking"
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-white text-white text-[13px] hover:bg-white/[0.04] transition-colors"
                    >
                      Apply
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ-ish strip */}
        <section className="relative px-6 py-20 border-b border-white/5">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-10">
              Common questions
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {[
                {
                  q: "Why three tiers per product?",
                  a: "Because the same engine has very different value to a solo developer with a side project, a 50-person data team, and a Fortune 500 deployment. We price for who you are, not what we cost to run.",
                },
                {
                  q: "Why is Vault separate?",
                  a: "Vault is the Private Banking tier — bespoke, by application, long-term partnership. It is not the top of a ladder; it is a different relationship category. We accept a small number of partners at any time.",
                },
                {
                  q: "Can I move tiers later?",
                  a: "Yes. Consumer to Pro to Enterprise is one signup; the substrate and your data are the same on all three. Enterprise customers often grow into Vault as their customer base demands it.",
                },
                {
                  q: "Is the substrate the same on every tier?",
                  a: "Yes. BTUT, the determinism contract, the encryption at rest, the audit log, the multi-tenant isolation — every tier shares the same engine. The differences are quotas, support, deployment, and bespoke services.",
                },
                {
                  q: "Do I need to host anything?",
                  a: "No on Consumer and Pro — fully managed. Yes optional on Enterprise — single-binary appliance for VPC or on-premise. Yes always on Vault — your customer's posture dictates deployment.",
                },
                {
                  q: "What about academic, nonprofit, or institutional discounts?",
                  a: "Yes, on a case-by-case basis. The DocSouth deployment is the kind of work we want to keep doing. Email engineering@latentocean.com with a one-paragraph description.",
                },
              ].map((item, i) => (
                <div key={i}>
                  <div className="font-display text-xl md:text-2xl tracking-[-0.025em] text-white mb-3">
                    {item.q}
                  </div>
                  <div className="text-[14px] text-white/65 leading-relaxed">
                    {item.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative px-6 pt-24">
          <div className="max-w-[1080px] mx-auto text-center">
            <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white mb-6">
              Start free.<br />Talk to us when you scale.
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
              <Link href="/pulse" className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
                Start with Pulse · Free
              </Link>
              <Link href="/contact" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                Talk to sales
              </Link>
              <Link href="/method" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                See the substrate
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
