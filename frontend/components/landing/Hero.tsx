"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

export function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-14 border-b border-white/5">
      {/* Subtle radial fade only — no canvas, no ornament */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.025) 0%, transparent 60%)",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-6 text-center z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-white/10 bg-white/[0.02] mb-10"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
          <span className="text-[11px] font-mono text-white/60 tracking-[0.18em] uppercase">
            Latent Ocean · Private Modelling
          </span>
        </motion.div>

        <motion.h1
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="font-display text-[8vw] md:text-[112px] leading-[0.92] tracking-[-0.045em] text-white font-medium"
        >
          Private models,<br />
          <span className="text-white/45">deterministic by design.</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-10 text-lg md:text-xl text-white/65 max-w-2xl mx-auto leading-snug font-normal"
        >
          A structural alternative to probabilistic AI. Mount any
          corpus. Form a private model. Same input, byte-identical
          output, forever — never leaves the appliance.
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.18 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/console"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Console
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <a
            href="#primitive"
            className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-white/15 text-white/85 text-sm hover:text-white hover:border-white/30 transition-colors"
          >
            Read the primitive
          </a>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.28 }}
          className="mt-20 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10.5px] font-mono text-white/40 tracking-[0.18em] uppercase"
        >
          <span>Seed 42 · deterministic</span>
          <span>·</span>
          <span>Sha-256 lineage</span>
          <span>·</span>
          <span>Bit-identical replay</span>
          <span>·</span>
          <span>Air-gap capable</span>
          <span>·</span>
          <span>Zero external I/O</span>
        </motion.div>
      </div>
    </section>
  );
}
