"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

export function FinalCTA() {
  return (
    <section className="relative py-32 border-t border-white/5 overflow-hidden">
      {/* Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,212,255,0.15) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="relative max-w-[1000px] mx-auto px-6 text-center"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-6">
          Ready to see what matters?
        </p>
        <h2 className="font-display text-6xl md:text-8xl tracking-[-0.03em] text-white leading-[0.95] mb-8">
          Structural intelligence,<br />
          <span className="text-white/40">in one API call.</span>
        </h2>
        <p className="text-lg text-white/60 max-w-xl mx-auto mb-12">
          Connect your database. The engine does the rest. Intelligence appears in tables you already query.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/engine"
            className="inline-flex items-center justify-center gap-2 h-14 px-10 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            Launch Engine
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <a
            href="mailto:sales@latentocean.com"
            className="inline-flex items-center justify-center h-14 px-8 rounded-full border border-white/20 text-white/90 text-base hover:bg-white/5 transition-colors"
          >
            Contact sales
          </a>
        </div>
      </motion.div>
    </section>
  );
}
