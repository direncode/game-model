"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

export function SentinelCTA() {
  return (
    <section className="relative py-40 border-t border-white/5 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,212,255,0.18) 0%, transparent 60%)",
        }}
      />
      <div className="relative max-w-[1280px] mx-auto px-6 text-center">
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-6"
        >
          Stand up Sentinel in your facility
        </motion.p>
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="font-display text-6xl md:text-8xl tracking-[-0.03em] text-white leading-[0.92] max-w-5xl mx-auto"
        >
          Probability is<br />
          <span className="text-white/40">over.</span>
        </motion.h2>
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-8 text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed"
        >
          A 90-day pilot. One appliance. One facility. Three signed success
          metrics. Convertible to Site against the same hashes.
        </motion.p>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.2 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <a
            href="mailto:sales@latentocean.com?subject=Sentinel%20Pilot"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            Start a pilot
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
          <Link
            href="/platform"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-base transition-colors"
          >
            See the underlying primitive →
          </Link>
        </motion.div>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.3 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-mono text-white/30"
        >
          <span>Same engine as Latent Ocean</span>
          <span>·</span>
          <span>Vertical module</span>
          <span>·</span>
          <span>Air-gap default</span>
          <span>·</span>
          <span>Sovereign-ready</span>
        </motion.div>
      </div>
    </section>
  );
}
