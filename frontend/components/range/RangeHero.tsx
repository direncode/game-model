"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

export function RangeHero() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-14 border-b border-white/5">
      {/* lattice backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.18]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,212,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.55) 1px, transparent 1px)",
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
            RANGE · PRIVATE MODEL FORMER · AIR-GAP BY DEFAULT
          </span>
        </motion.div>

        <motion.h1
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="font-display text-[8.5vw] md:text-[110px] leading-[0.88] tracking-[-0.045em] text-white"
        >
          Form a private model<br />
          <span className="text-white/45">from any corpus.</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-10 text-xl md:text-2xl text-white/80 max-w-3xl mx-auto font-light leading-snug"
        >
          The deterministic alternative to probabilistic AI. Mount your
          data once. Range produces a <span className="text-li-cyan">structurally
          fingerprinted, taxonomy-crystallized, lineage-anchored private
          model</span> — auditable to source bytes, reproducible across
          runs, and never leaves the appliance.
        </motion.p>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.18 }}
          className="mt-7 text-base text-white/55 max-w-2xl mx-auto leading-relaxed"
        >
          LLMs are asymptotic — they interpolate within their training corpus
          and cannot produce original insight on data they have never seen.
          Range is structural. It surfaces what is genuinely rare, genuinely
          new, and genuinely yours.
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.28 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <a
            href="#range-console"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            Form a model now
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
          <Link
            href="#access"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-base transition-colors"
          >
            Request enterprise access →
          </Link>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.4 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto"
        >
          <Pill k="seed" v="42" sub="every layer" />
          <Pill k="external i/o" v="zero" sub="appliance never opens a socket" />
          <Pill k="output" v="deterministic" sub="byte-identical across runs" />
          <Pill k="lineage" v="cryptographic" sub="every output traceable" />
        </motion.div>
      </div>
    </section>
  );
}

function Pill({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left backdrop-blur">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1.5">{k}</div>
      <div className="font-display text-2xl text-white tracking-tight tabular-nums">{v}</div>
      <div className="font-mono text-[10px] text-white/35 mt-1">{sub}</div>
    </div>
  );
}
