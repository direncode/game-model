"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

// Dummy customer — fictional Tier-1 DIB prime running a classified Tier-3 SOC.
// Numbers are illustrative, deliberately specific to make the page feel real.
const BEFORE_AFTER = [
  {
    metric: "Daily alert volume",
    before: "38,412",
    after: "6,104",
    delta: "−84%",
    deltaTone: "good",
    note: "Structural rarity collapses ML-noise tail.",
  },
  {
    metric: "Mean time to lineage",
    before: "4 h 22 m",
    after: "210 ms",
    delta: "75,000× faster",
    deltaTone: "good",
    note: "REPLAY clause returns originating bytes inline.",
  },
  {
    metric: "Reproducibility (IG)",
    before: "Material weakness",
    after: "Cleared",
    delta: "ICD 503 §6.1",
    deltaTone: "good",
    note: "Bit-identical reruns confirmed across 3 facilities.",
  },
  {
    metric: "Tier-1 disposition rate",
    before: "2.0%",
    after: "61.4%",
    delta: "30× lift",
    deltaTone: "good",
    note: "Analysts triage rarity, not probability.",
  },
  {
    metric: "Novel families surfaced (90 d)",
    before: "0",
    after: "1 confirmed",
    delta: "HALCYON-7",
    deltaTone: "novel",
    note: "z = 41.7 σ on host DCDA-WS-0419 lateral movement.",
  },
  {
    metric: "External I/O during analysis",
    before: "Vendor cloud egress",
    after: "Zero",
    delta: "Air-gap",
    deltaTone: "good",
    note: "Appliance never opens an outbound socket.",
  },
];

const PROFILE = [
  { k: "Customer", v: "Meridian Defense Systems (illustrative)" },
  { k: "Tier", v: "DIB prime · Tier-3 SOC · TS/SCI" },
  { k: "Estate", v: "47,212 endpoints · 11 facilities · 2.4 PB/day telemetry" },
  { k: "Stack at install", v: "Splunk Enterprise · CrowdStrike · Zeek · Sysmon" },
  { k: "Annual SIEM cost", v: "$14.2M (pre-Sentinel)" },
  { k: "Compliance regime", v: "NIST 800-171 · CMMC L3 · ICD 503" },
];

export function SentinelMeridian() {
  return (
    <section id="meridian" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-warm mb-4">
            Reference deployment · illustrative
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Meridian Defense<br />
            <span className="text-white/40">90 days in.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl">
            A Tier-1 systems integrator runs a classified SOC for a federal
            customer. They installed Sentinel in March on a single appliance
            per facility, in parallel with their existing Splunk and EDR
            stack. They did not rip anything out. The appliance never opened
            an outbound socket. These are their numbers at day 90.
          </p>
        </motion.div>

        {/* Profile card */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-12 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-6 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-li-green animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green">
                Profile
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
              Illustrative · names redacted
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {PROFILE.map((p, i) => (
              <div
                key={p.k}
                className={`px-6 py-4 ${
                  i < PROFILE.length - 1 ? "border-b border-white/[0.04]" : ""
                } ${i % 2 === 0 ? "md:border-r md:border-white/[0.04]" : ""}`}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                  {p.k}
                </div>
                <div className="text-sm text-white/85">{p.v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Before / after */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {BEFORE_AFTER.map((row) => {
            const tone =
              row.deltaTone === "novel"
                ? "text-li-purple"
                : row.deltaTone === "good"
                  ? "text-li-green"
                  : "text-white/70";
            return (
              <motion.div
                key={row.metric}
                variants={fadeUp}
                className="rounded-2xl border border-white/10 bg-[#0a0a10] p-6"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
                  {row.metric}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">
                      Before
                    </div>
                    <div className="font-display text-xl text-white/55 tabular-nums leading-tight">
                      {row.before}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">
                      After
                    </div>
                    <div className="font-display text-xl text-white tabular-nums leading-tight">
                      {row.after}
                    </div>
                  </div>
                </div>
                <div className={`font-mono text-xs tabular-nums ${tone} mb-2`}>
                  {row.delta}
                </div>
                <div className="text-[12px] text-white/50 leading-relaxed">
                  {row.note}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Pull quote — fictional but grounded */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-14 rounded-2xl border border-li-warm/20 bg-li-warm/[0.03] p-10"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-li-warm mb-4">
            From the customer
          </p>
          <p className="font-display text-2xl md:text-3xl text-white/90 leading-snug tracking-tight max-w-4xl">
            “The first time the IG asked for the source bytes behind a flagged
            beacon, the analyst pasted a lineage hash, hit replay, and the
            originating PCAP rendered in the same window. The audit finding
            was closed in the meeting.”
          </p>
          <div className="mt-6 font-mono text-[11px] text-white/40">
            Director, Cyber Operations · Meridian Defense Systems · illustrative
          </div>
        </motion.div>
      </div>
    </section>
  );
}
