"use client";

import Link from "next/link";
import { ALL_SHOWCASES, TIER_COLORS, TIER_LABELS, type Product, type Tier } from "@/lib/products/data";

// ProductPage is the shared template every product page renders. It accepts
// a Product object and decides layout treatment based on the product's tier
// list — "private_banking" gets the more reserved Vault-style layout, the
// rest get the Consumer/Pro/Enterprise pricing grid.

export function ProductPage({ product }: { product: Product }) {
  const isPrivateBanking = product.tiers.includes("private_banking") && product.tiers.length === 1;
  const tierBadgeList = product.tiers
    .map((t) => ({ tier: t, label: TIER_LABELS[t], color: TIER_COLORS[t] }));

  return (
    <main className="pt-28 pb-32">
      {/* Hero */}
      <section className="relative px-6 border-b border-white/5 pb-20">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
              Latent Ocean · {product.name}
            </span>
            {tierBadgeList.map((b) => (
              <span
                key={b.tier}
                className="inline-flex items-center h-6 px-2.5 rounded-full font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{
                  backgroundColor: `${b.color}1a`,
                  border: `1px solid ${b.color}55`,
                  color: b.color,
                }}
              >
                {b.label}
              </span>
            ))}
          </div>

          <h1 className={`font-display font-medium tracking-[-0.045em] text-white leading-[0.92] max-w-5xl ${
            isPrivateBanking
              ? "text-[clamp(48px,7vw,108px)]"
              : "text-[clamp(56px,9vw,128px)]"
          }`}>
            {product.tagline}
          </h1>

          <p className="mt-9 text-lg md:text-xl text-white/75 max-w-3xl leading-relaxed">
            {product.what_it_does}
          </p>

          {/* Highlights strip */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.05] border border-white/10 rounded-2xl overflow-hidden">
            {product.highlights.map((h) => (
              <div key={h.label} className="bg-black p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 mb-3">
                  {h.label}
                </div>
                <div className="font-display text-[24px] md:text-[28px] tracking-[-0.025em] text-white leading-[1]">
                  {h.value}
                </div>
                <div className="font-mono text-[10px] text-white/40 mt-3 leading-snug">
                  {h.hint}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for + Why */}
      <section className="relative px-6 py-20 border-b border-white/5">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Who it's for
            </p>
            <p className="text-[15.5px] text-white/85 leading-relaxed">{product.who_for}</p>
          </div>
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Why it matters
            </p>
            <p className="text-[15.5px] text-white/85 leading-relaxed">{product.why_matters}</p>
          </div>
        </div>
      </section>

      {/* Tier grid (or single Private Banking card) */}
      <section className="relative px-6 py-20 border-b border-white/5">
        <div className="max-w-[1200px] mx-auto">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
            {isPrivateBanking ? "The engagement" : "Tiers · what's in each"}
          </p>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1.05] mb-12 max-w-3xl">
            {isPrivateBanking ? (
              <>
                A small number of partners at a time.<br />
                <span className="text-white/45">Long relationships, shared roadmap.</span>
              </>
            ) : (
              <>
                Three tiers, three relationships.<br />
                <span className="text-white/45">Same engine underneath each one.</span>
              </>
            )}
          </h2>

          <div className={`grid gap-5 ${
            product.plans.length === 1 ? "grid-cols-1 max-w-2xl mx-auto" :
            product.plans.length === 2 ? "grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto" :
            "grid-cols-1 md:grid-cols-3"
          }`}>
            {product.plans.map((plan) => (
              <PricingCard key={plan.tier} plan={plan} />
            ))}
          </div>
        </div>
      </section>

      {/* Proof link — primary showcase for THIS product */}
      {product.proof_link && (
        <section className="relative px-6 py-20 border-b border-white/5">
          <div className="max-w-[1200px] mx-auto text-center">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              See it for yourself
            </p>
            <Link
              href={product.proof_link.href}
              className="inline-flex items-center gap-2 font-display text-2xl md:text-3xl tracking-[-0.025em] text-white hover:text-white/85 border-b border-white/30 hover:border-white pb-1 transition-colors"
            >
              {product.proof_link.label}
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Link>
          </div>
        </section>
      )}

      {/* Public reference deployments — same substrate, four buyer categories */}
      <section className="relative px-6 py-20 border-b border-white/5">
        <div className="max-w-[1300px] mx-auto">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
            Public reference deployments
          </p>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white leading-[1.04] mb-3 max-w-3xl">
            Four citable showcases.<br />
            <span className="text-white/45">Four buyer categories. One substrate.</span>
          </h2>
          <p className="text-[15px] text-white/55 leading-relaxed mb-10 max-w-3xl">
            Every showcase below is a fully-citable, third-party-verifiable artifact running on the same engine that powers {product.name}. Every number, every cluster, every receipt is anchored by a hash that anyone can re-derive. Pick any one and audit it byte-for-byte.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ALL_SHOWCASES.map((s) => {
              const isCurrent = s.slug === product.slug;
              return (
                <Link
                  key={s.slug}
                  href={s.href}
                  className={`block rounded-xl p-5 transition-colors border ${
                    isCurrent
                      ? "border-white/45 bg-white/[0.04] hover:border-white/70"
                      : "border-white/10 bg-[#0a0a0a] hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display text-2xl tracking-[-0.025em] text-white">
                      {s.label}
                    </span>
                    {isCurrent && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">
                        for {product.name}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-white/50 leading-relaxed mb-2">{s.blurb}</p>
                  <p className="text-[12px] text-white/65 leading-snug">
                    For {s.buyer.toLowerCase()}.
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 hover:text-white border-b border-white/20 pb-0.5">
                    {s.href}
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 pt-24">
        <div className="max-w-[1080px] mx-auto text-center">
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-[-0.035em] text-white mb-6">
            {isPrivateBanking ? "Apply to work with us." : "Try it."}
          </h2>
          <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-snug">
            {isPrivateBanking
              ? "Tell us about your customers, your data, and what you're trying to ship. We respond within two business days. If we work together, we work together for years."
              : `Tell us about your data and we will set you up. Same engine on every tier.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {product.plans.map((plan) => (
              <Link
                key={plan.tier}
                href={plan.cta.href}
                className={`inline-flex items-center justify-center h-11 px-6 rounded-full text-[13px] font-medium transition-colors ${
                  plan.tier === "consumer"
                    ? "bg-white text-black hover:bg-white/90"
                    : plan.tier === "private_banking"
                    ? "border border-white text-white hover:bg-white/[0.04]"
                    : "border border-white/20 text-white/85 hover:text-white hover:border-white/35"
                }`}
              >
                {plan.cta.label}
              </Link>
            ))}
            <Link
              href="/products"
              className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/15 text-white/70 text-[13px] hover:text-white hover:border-white/30 transition-colors"
            >
              Compare all 5 products
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function PricingCard({ plan }: { plan: import("@/lib/products/data").PricingPlan }) {
  const color = TIER_COLORS[plan.tier];
  const label = TIER_LABELS[plan.tier];
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-7 md:p-8 flex flex-col">
      <div className="flex items-center gap-2 mb-5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em]" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="font-display text-2xl md:text-3xl tracking-[-0.025em] text-white leading-snug mb-2">
        {plan.headline}
      </div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-6">
        {plan.shape}
      </div>

      <ul className="space-y-2.5 mb-7 flex-1">
        {plan.bullets.map((b, i) => (
          <li key={i} className="text-[13.5px] text-white/75 leading-snug flex items-start gap-2.5">
            <span className="font-mono text-[10px] mt-1 shrink-0" style={{ color }}>+</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {plan.best_for && (
        <div className="font-mono text-[10.5px] text-white/45 leading-snug mb-6 pb-5 border-b border-white/[0.06]">
          <span className="text-white/65">Best for:</span> {plan.best_for}
        </div>
      )}

      <Link
        href={plan.cta.href}
        className={`inline-flex items-center justify-center h-11 rounded-full text-[12.5px] font-medium transition-colors ${
          plan.tier === "consumer"
            ? "bg-white text-black hover:bg-white/90"
            : plan.tier === "private_banking"
            ? "border border-white text-white hover:bg-white/[0.04]"
            : "border border-white/25 text-white/90 hover:text-white hover:border-white/55"
        }`}
      >
        {plan.cta.label}
      </Link>
    </div>
  );
}
