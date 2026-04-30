"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const TIERS = [
  {
    name: "Pilot",
    duration: "90 days",
    price: "$250k",
    sub: "single appliance · single facility",
    description:
      "One air-gapped appliance, one telemetry stream, one signed evidence package. Convertible to Site within 90 days against the same hashes.",
    features: [
      "Single appliance, single facility",
      "Founder-led integration support",
      "Three success metrics, signed in advance",
      "Lineage proofs delivered with every detection",
      "Bit-identical replay on every alert",
      "Pilot exit: keep evidence even if you do not convert",
    ],
    cta: "Start a pilot",
    accent: "#00d4ff",
    featured: false,
  },
  {
    name: "Site",
    duration: "annual",
    price: "$1.8M",
    sub: "single facility · production",
    description:
      "Production deployment for a single facility. Multi-node within the facility, signed updates via sneakernet, custom taxonomies on request.",
    features: [
      "Multi-node within one facility",
      "Custom structural taxonomies",
      "Signed updates via sneakernet only",
      "On-site cleared engineer (quarterly)",
      "Source escrow under NDA",
      "Lineage anchored to OTS at facility cadence",
    ],
    cta: "Talk to engineering",
    accent: "#3fb950",
    featured: true,
  },
  {
    name: "Sovereign",
    duration: "annual",
    price: "Bespoke",
    sub: "agency · multi-site · cleared",
    description:
      "Multi-facility, multi-classification deployment. On-site cleared engineering, bespoke evidence packages, agency-aligned ATO support.",
    features: [
      "Multi-facility, multi-classification",
      "Cleared resident engineering",
      "Bespoke ATO evidence package",
      "ICD 503 / FedRAMP High alignment",
      "Hardware roots-of-trust on every appliance",
      "Per-classification key separation",
    ],
    cta: "Coordinate with mission",
    accent: "#a371f7",
    featured: false,
  },
];

export function SentinelPilot() {
  return (
    <section id="pilot" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Pilot · Site · Sovereign
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Three doors,<br />
            <span className="text-white/40">same engine.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl">
            Sentinel ships as an appliance. Same binary, same fingerprint,
            same null test, same replay engine across every tier. Tiers
            differ by scope, integration depth, and clearance posture, not
            by capability.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {TIERS.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              className={`relative rounded-2xl border bg-[#0a0a10] p-7 overflow-hidden flex flex-col ${
                t.featured ? "border-li-green/40" : "border-white/10"
              }`}
            >
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ backgroundColor: t.accent, opacity: 0.6 }}
              />
              {t.featured && (
                <span className="absolute top-5 right-5 font-mono text-[10px] uppercase tracking-[0.2em] text-li-green">
                  Most deployed
                </span>
              )}
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: t.accent, boxShadow: `0 0 10px ${t.accent}80` }}
                />
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: t.accent }}
                >
                  {t.name}
                </span>
              </div>
              <div className="font-display text-5xl text-white tracking-tight tabular-nums">
                {t.price}
              </div>
              <div className="font-mono text-[11px] text-white/40 uppercase tracking-widest mt-1 mb-1">
                {t.duration}
              </div>
              <div className="text-[12px] text-white/50 mb-5">{t.sub}</div>
              <p className="text-sm text-white/65 leading-relaxed mb-6">
                {t.description}
              </p>
              <ul className="space-y-2 mb-7 flex-1">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[13px] text-white/70"
                  >
                    <svg
                      className="mt-1 shrink-0"
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                    >
                      <path
                        d="M2 5l2 2 4-4"
                        stroke={t.accent}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={`mailto:sales@latentocean.com?subject=Sentinel%20${encodeURIComponent(
                  t.name,
                )}`}
                className={`inline-flex items-center justify-center h-11 px-5 rounded-full text-sm font-medium transition-colors ${
                  t.featured
                    ? "bg-white text-black hover:bg-white/90"
                    : "border border-white/15 text-white/85 hover:text-white hover:border-white/30"
                }`}
              >
                {t.cta}
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
