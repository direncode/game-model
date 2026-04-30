"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const EDITIONS = [
  {
    name: "Cloud Edition",
    tagline: "Managed. Scale-out. Shared fleet.",
    features: [
      "Fully managed by Latent Ocean",
      "Per-customer isolated forks",
      "Docker SDK + Kubernetes orchestration",
      "Materializer writes to your database",
      "Stripe-metered billing",
      "SSO: SAML 2.0 + OIDC",
      "SOC 2 Type II (in progress)",
      "99.9% uptime SLA",
    ],
    accent: "#00d4ff",
  },
  {
    name: "Edge Edition",
    tagline: "Air-gapped. FIPS. Classification-aware.",
    features: [
      "Deploys inside your perimeter",
      "Zero external network calls",
      "Classification marking (UNCLASSIFIED → TOP SECRET)",
      "Hash-chained immutable audit log",
      "FIPS 140-2 compliant crypto",
      "Ed25519-signed offline updates",
      "Clearance-based module access",
      "Hardened container image",
    ],
    accent: "#a371f7",
  },
];

export function Enterprise() {
  return (
    <section id="enterprise" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/45 mb-4">
            Enterprise
          </p>
          <h2 className="font-display font-medium text-5xl md:text-7xl tracking-[-0.035em] text-white mb-6 max-w-4xl">
            Two editions.<br />
            <span className="text-white/40">One engine.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            The same intelligence primitives, packaged for how your organization actually operates.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {EDITIONS.map((ed) => (
            <div
              key={ed.name}
              className="relative border border-white/10 rounded-2xl bg-[#0a0a10] p-10 overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ backgroundColor: ed.accent, opacity: 0.6 }}
              />
              <div
                className="w-2 h-2 rounded-full mb-6"
                style={{ backgroundColor: ed.accent, boxShadow: `0 0 16px ${ed.accent}80` }}
              />
              <div className="font-display text-4xl text-white mb-2">{ed.name}</div>
              <div className="text-sm text-white/60 mb-8">{ed.tagline}</div>
              <ul className="space-y-3">
                {ed.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 flex-shrink-0" style={{ color: ed.accent }}>
                      <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* Franklin Street — Edge Edition validation */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-16"
        >
          <motion.div variants={fadeUp}>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#a371f7] mb-4">
              Edge Edition &mdash; live validation
            </p>
          </motion.div>
          <Link href="/franklin">
            <motion.div
              variants={fadeUp}
              className="group relative border border-[#a371f7]/20 rounded-2xl bg-[#0a0a10] p-10 hover:border-[#a371f7]/40 transition-colors overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-[#a371f7] opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#a371f7]/5 to-transparent pointer-events-none" />
              <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 rounded-full bg-[#a371f7]" style={{ boxShadow: "0 0 16px #a371f780" }} />
                    <div className="font-display text-3xl text-white">Franklin Street Data</div>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed mb-6 max-w-2xl">
                    606 Chapel Hill venues. Full BTUT mean-field game pipeline running air-gapped at the edge.
                    Zero external network calls. Real-time heatmaps, density analysis, convergence detection,
                    and venue intelligence &mdash; computed entirely within the perimeter.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: "Venues", value: "606" },
                      { label: "Live signals", value: "8" },
                      { label: "External calls", value: "0" },
                      { label: "Pipeline", value: "Full BTUT" },
                    ].map((stat) => (
                      <div key={stat.label} className="border border-white/5 rounded-lg bg-white/[0.02] px-4 py-3">
                        <div className="font-mono text-2xl text-white">{stat.value}</div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="font-mono text-[11px] text-white/30 tracking-wide">
                    BTUT MFG &middot; Heatmap &middot; Density &middot; Convergence &middot; Venue Intel &middot; Edge-native
                  </div>
                </div>
                <div className="hidden lg:flex flex-col items-center gap-3">
                  <div
                    className="font-mono text-xs uppercase tracking-[0.15em] text-[#a371f7] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Explore live &rarr;
                  </div>
                </div>
              </div>
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
