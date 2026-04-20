"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";
import { ReductionCanvas } from "./canvas/ReductionCanvas";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-14">
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <ReductionCanvas />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-6 text-center z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-white/10 bg-white/5 backdrop-blur mb-10"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-li-green animate-pulse" />
          <span className="text-xs font-mono text-white/70 tracking-wide">
            A NEW DATA PRIMITIVE · 48-BIT · DETERMINISTIC · FALSIFIABLE
          </span>
        </motion.div>

        <motion.h1
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="font-display text-[8vw] md:text-[100px] leading-[0.9] tracking-[-0.04em] text-white"
        >
          Every row,<br />
          <span className="text-white/50">structurally aware.</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-8 text-xl md:text-2xl text-white/80 max-w-3xl mx-auto font-light leading-tight"
        >
          Latent Ocean turns any row of any database into a
          <span className="text-li-cyan"> 48-bit structural fingerprint</span> plus
          a 4-dimensional score vector. Outliers surface. Peer-rank becomes a
          column. Null tests run on demand.
        </motion.p>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.2 }}
          className="mt-6 text-base text-white/60 max-w-2xl mx-auto font-mono tabular-nums"
        >
          Embeddings made vectors a data type. Structural fingerprints make
          outlierness one — deterministic, reproducible, air-gap capable.
        </motion.p>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.25 }}
          className="mt-4 text-sm text-white/50 max-w-3xl mx-auto"
        >
          Two engines, one stack: <span className="text-li-cyan">BTUT</span>{" "}
          for the fingerprint substrate;{" "}
          <span className="text-li-cyan">TCD-JEPA</span>{" "}
          for persistent-homology module crystallization on top.
          Substrate plus deep discovery — in the same deterministic pipeline.
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.3 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/platform"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            See the primitive
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <a
            href="#proof"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-base transition-colors"
          >
            Same engine across 15 unrelated data types →
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
          <span>SHA-256 REPRODUCIBLE</span>
          <span>·</span>
          <span>NULL-TEST ON DEMAND</span>
          <span>·</span>
          <span>FedRAMP IL6 READY</span>
          <span>·</span>
          <span>OFFLINE / AIR-GAP</span>
        </motion.div>
      </div>
    </section>
  );
}
