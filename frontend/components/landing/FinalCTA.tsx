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
        className="relative max-w-[1100px] mx-auto px-6 text-center"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-6">
          Install the primitive · one connection · every row scored
        </p>
        <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-8">
          Connect your database.<br />
          <span className="text-white/40">Every row acquires a signature.</span>
        </h2>
        <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
          Postgres, Snowflake, MongoDB Atlas, BigQuery, Kafka / Kinesis / Pulsar,
          S3 / GCS / Parquet. The primitive ingests any row-shape and emits a
          48-bit fingerprint plus a 4-dimensional score column. Reproducible at
          bit level. Falsifiable on demand.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <a
            href="mailto:sales@latentocean.com?subject=Platform%20installation&body=Data%20source%3A%20%0AApprox%20row%20volume%3A%20%0AAir-gap%20required%3F%20"
            className="inline-flex items-center justify-center gap-2 h-14 px-10 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            Install on your database
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
          <Link
            href="/platform"
            className="inline-flex items-center justify-center h-14 px-8 rounded-full border border-white/20 text-white/90 text-base hover:bg-white/5 transition-colors"
          >
            Read the primitive spec
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-white/40">
          <span>48-bit fingerprint</span>
          <span>·</span>
          <span>4-dim score vector</span>
          <span>·</span>
          <span>Null-test endpoint</span>
          <span>·</span>
          <span>Seed 42 deterministic</span>
          <span>·</span>
          <span>Air-gap / FedRAMP IL6</span>
        </div>
      </motion.div>
    </section>
  );
}
