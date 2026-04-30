"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

export function SentinelHero() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-14 border-b border-white/5">
      {/* Lattice grid backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.18]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,212,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse at center, black 0%, black 35%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 0%, black 35%, transparent 75%)",
          }}
        />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.97) 100%)",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-6 text-center z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-li-cyan/25 bg-li-cyan/[0.04] backdrop-blur mb-10"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-li-green animate-pulse" />
          <span className="text-xs font-mono text-li-cyan/90 tracking-wide">
            LATENT SENTINEL · CYBERSECURITY VERTICAL · AIR-GAP CAPABLE
          </span>
        </motion.div>

        <motion.h1
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="font-display text-[8vw] md:text-[100px] leading-[0.9] tracking-[-0.04em] text-white"
        >
          Every alert,<br />
          <span className="text-white/50">structurally proven.</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-8 text-xl md:text-2xl text-white/80 max-w-3xl mx-auto font-light leading-tight"
        >
          Sentinel turns every Zeek session, every Sysmon event, every NetFlow
          record into a <span className="text-li-cyan">48-bit structural
          fingerprint</span> with bit-identical lineage to the originating bytes.
          No transformer. No softmax. No phone-home.
        </motion.p>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.2 }}
          className="mt-6 text-base text-white/55 max-w-2xl mx-auto font-mono tabular-nums"
        >
          Built on the same Latent Ocean primitive that scores 35M PubMed papers,
          61k SEC filings, and 2.4PB of telemetry — under one seed, one engine,
          one audit trail.
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.3 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <a
            href="mailto:sales@latentocean.com?subject=Sentinel%20Pilot"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            Start a 90-day pilot
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
          <a
            href="#meridian"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-base transition-colors"
          >
            See it deployed at Meridian Defense →
          </a>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.4 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-mono text-white/40"
        >
          <span>SEED=42 DETERMINISTIC</span>
          <span>·</span>
          <span>SHA-256 LINEAGE PROOFS</span>
          <span>·</span>
          <span>BIT-IDENTICAL REPLAY</span>
          <span>·</span>
          <span>SOC 2 / ISO 27001 PATH</span>
          <span>·</span>
          <span>ZERO EXTERNAL I/O</span>
        </motion.div>
      </div>
    </section>
  );
}
