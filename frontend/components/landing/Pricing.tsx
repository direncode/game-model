"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const TIERS = [
  {
    name: "Starter",
    price: "2,500",
    period: "/mo",
    tagline: "For teams getting started.",
    features: [
      "1 data source",
      "Up to 3 modules enabled",
      "100K entities/month included",
      "50K queries/month included",
      "Fast profile only",
      "Dashboard + API",
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "15,000",
    period: "/mo",
    tagline: "For serious data estates.",
    features: [
      "5 data sources",
      "Up to 10 modules enabled",
      "1M entities/month included",
      "500K queries/month included",
      "Fast + Deep profiles",
      "CDC · Webhooks",
      "SSO included",
    ],
    cta: "Start 14-day trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "50,000",
    period: "/mo+",
    tagline: "For critical infrastructure.",
    features: [
      "Unlimited sources",
      "Unlimited modules",
      "10M+ entities/month",
      "5M+ queries/month",
      "All profiles + custom tuning",
      "SIEM · Vault · SSO",
      "Edge Edition available",
      "Dedicated support",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp} className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Pricing
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6">
            Pay for depth.<br />
            <span className="text-white/40">Scale with your data.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Dashboard seats are always free. You only pay for intelligence, not for eyeballs.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {TIERS.map((tier) => (
            <motion.div
              key={tier.name}
              variants={fadeUp}
              className={`relative rounded-2xl p-10 ${
                tier.highlighted
                  ? "bg-gradient-to-b from-[#0a0a10] to-[#0f0f18] border border-li-cyan/30 shadow-[0_0_40px_rgba(0,212,255,0.1)]"
                  : "bg-[#0a0a10] border border-white/10"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 h-6 rounded-full bg-li-cyan text-black text-[11px] font-mono uppercase tracking-widest flex items-center">
                  Most popular
                </div>
              )}
              <div className="font-display text-2xl text-white mb-2">{tier.name}</div>
              <div className="text-sm text-white/60 mb-8">{tier.tagline}</div>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="font-mono text-sm text-white/60">$</span>
                <span className="font-mono text-5xl text-white tabular-nums">{tier.price}</span>
                <span className="font-mono text-sm text-white/60">{tier.period}</span>
              </div>
              <button
                className={`w-full h-12 rounded-full text-sm font-medium transition-colors ${
                  tier.highlighted
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                }`}
              >
                {tier.cta}
              </button>
              <ul className="mt-8 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 flex-shrink-0 text-li-cyan">
                      <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
