"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

export function FinalCTA() {
  return (
    <section className="relative py-32 border-t border-white/5 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,212,255,0.18) 0%, transparent 70%)",
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
          48-hour pilot · no card · no meeting · just a named finding
        </p>
        <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-8">
          Send 10 tickers.<br />
          <span className="text-white/40">Or 10 MeSH terms. Or 10 HS codes.</span>
        </h2>
        <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
          The same engine works on any corpus — SEC filings, PubMed, UN Comtrade,
          NOAA climate, USPTO patents, polymath biographies. We return a
          structural-anomaly report on whatever you upload, within 48 hours.
          If nothing is actionable, we buy you a coffee.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <a
            href="mailto:sales@latentocean.com?subject=48h%20pilot%20request&body=10%20entities%3A%20%0A%0ACorpus%20type%3A%20"
            className="inline-flex items-center justify-center gap-2 h-14 px-10 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            Request 48h pilot
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
          <Link
            href="/watchlist"
            className="inline-flex items-center justify-center h-14 px-8 rounded-full border border-white/20 text-white/90 text-base hover:bg-white/5 transition-colors"
          >
            Try live on EDGAR
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-white/40">
          <span>Seed 42 deterministic</span>
          <span>·</span>
          <span>Null test on demand</span>
          <span>·</span>
          <span>Air-gap capable (FedRAMP IL6)</span>
          <span>·</span>
          <span>15 corpora validated at z ≥ 16 σ</span>
        </div>
      </motion.div>
    </section>
  );
}
