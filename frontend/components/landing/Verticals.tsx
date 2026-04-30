"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const VERTICALS = [
  { name: "Threat Intelligence", accent: "#00d4ff", description: "Air-gapped intrusion detection with bit-identical replay against real telemetry", tag: "Zeek · Sysmon · NetFlow · EDR", href: "/range?vertical=cyber", cta: "Form on Range" },
  { name: "Finance", accent: "#388bfd", description: "SEC EDGAR filings, XBRL facts, regulatory overlays", tag: "SEC · XBRL · FINRA", href: "/engine", cta: "Open Engine" },
  { name: "Pharma", accent: "#3fb950", description: "PubMed literature, clinical trials, drug interactions", tag: "PubMed · ClinicalTrials · MeSH", href: "/engine", cta: "Open Engine" },
  { name: "Patents", accent: "#a371f7", description: "USPTO filings, citation graphs, inventor networks", tag: "USPTO · CPC · Citations", href: "/engine", cta: "Open Engine" },
  { name: "Supply Chain", accent: "#c9a96e", description: "UN Comtrade flows, supplier networks, disruption signals", tag: "Comtrade · HS Codes · Logistics", href: "/engine", cta: "Open Engine" },
  { name: "Sports Intelligence", accent: "#f85149", description: "Player tracking, tactical overlays, live match analytics", tag: "DUNC · FIFA · Tactical", href: "/dunc", cta: "Launch D-U-N-C" },
  { name: "Data Governance", accent: "#d29922", description: "Lineage, classification, compliance, audit trails", tag: "SOC2 · GDPR · Lineage", href: "/data-estate", cta: "Open Data Estate" },
];

export function Verticals() {
  return (
    <section id="verticals" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/45 mb-4">
            Vertical modules
          </p>
          <h2 className="font-display font-medium text-5xl md:text-7xl tracking-[-0.035em] text-white mb-6 max-w-4xl">
            Domain-tuned<br />
            <span className="text-white/40">out of the box.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            Nine modules ship enabled. Add yours as a manifest. Customers mix, match, and extend without touching the engine.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {VERTICALS.map((v) => (
            <Link key={v.name} href={v.href}>
              <motion.div
                variants={fadeUp}
                className="group relative border border-white/10 rounded-2xl bg-[#0a0a10] p-8 hover:border-white/20 transition-colors overflow-hidden h-full"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{ backgroundColor: v.accent, opacity: 0.6 }}
                />
                <div
                  className="w-2 h-2 rounded-full mb-6"
                  style={{ backgroundColor: v.accent, boxShadow: `0 0 12px ${v.accent}80` }}
                />
                <div className="font-display text-3xl text-white mb-3">{v.name}</div>
                <p className="text-sm text-white/60 leading-relaxed mb-6">{v.description}</p>
                <div className="font-mono text-[11px] text-white/30 tracking-wide mb-4">{v.tag}</div>
                <div
                  className="font-mono text-xs uppercase tracking-[0.15em] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: v.accent }}
                >
                  {v.cta} &rarr;
                </div>
              </motion.div>
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
