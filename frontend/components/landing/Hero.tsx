"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";
import { ReductionCanvas } from "./canvas/ReductionCanvas";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-14">
      {/* Background canvas animation */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <ReductionCanvas />
      </div>

      {/* Radial gradient depth */}
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
            ENGINE v0.1.0 · 11 CONNECTORS · LIVE
          </span>
        </motion.div>

        <motion.h1
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="font-display text-[10vw] md:text-[120px] leading-[0.9] tracking-[-0.04em] text-white"
        >
          Latent Ocean
        </motion.h1>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-8 text-2xl md:text-3xl text-white/80 max-w-3xl mx-auto font-light leading-tight"
        >
          Structural intelligence infrastructure for any database.
        </motion.p>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.2 }}
          className="mt-4 text-base text-white/50 max-w-2xl mx-auto"
        >
          Connect anything. See what matters. Your tables, now with intelligence built in.
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
            href="/watchlist"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            Try it live — 30 seconds
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <Link
            href="/engine"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-base transition-colors"
          >
            Launch full engine
          </Link>
          <a
            href="#proof"
            className="inline-flex items-center justify-center h-12 px-6 text-base text-white/70 hover:text-white transition-colors"
          >
            See proof ↓
          </a>
        </motion.div>
      </div>
    </section>
  );
}
