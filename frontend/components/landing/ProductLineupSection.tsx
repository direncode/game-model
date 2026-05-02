"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { PRODUCTS, TIER_COLORS, TIER_LABELS } from "@/lib/products/data";

// ProductLineupSection — the first scroll-stop on /, after HomeHero.
// Five product tiles, each with name, tier badges, tagline. Vault is
// rendered with a distinct treatment to signal Private Banking.

export function ProductLineupSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <section ref={ref} id="lineup" className="relative px-6 py-32 border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
            The lineup · five products, one substrate
          </p>
          <h2 className="font-display font-medium text-[clamp(48px,8vw,116px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl mb-16">
            Pick the one<br />
            <span className="text-white/45">that fits your buyer.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRODUCTS.map((p, i) => {
            const isVault = p.slug === "vault";
            return (
              <motion.div
                key={p.slug}
                initial={{ opacity: 0, y: 18 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className={isVault ? "lg:col-span-3" : ""}
              >
                <Link
                  href={`/${p.slug}`}
                  className={`group block h-full rounded-2xl border p-7 md:p-8 transition-colors ${
                    isVault
                      ? "border-white/25 bg-gradient-to-br from-white/[0.03] to-black hover:border-white/55"
                      : "border-white/10 bg-[#0a0a0a] hover:border-white/30"
                  }`}
                >
                  <div className={`flex items-start ${isVault ? "md:items-center md:gap-12 md:flex-row" : "flex-col"}`}>
                    <div className={isVault ? "md:flex-[1.2]" : ""}>
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
                          № {String(i + 1).padStart(2, "0")}
                        </span>
                        {p.tiers.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center h-5 px-2 rounded-full font-mono text-[9.5px] uppercase tracking-[0.18em]"
                            style={{
                              backgroundColor: `${TIER_COLORS[t]}1f`,
                              border: `1px solid ${TIER_COLORS[t]}55`,
                              color: TIER_COLORS[t],
                            }}
                          >
                            {TIER_LABELS[t]}
                          </span>
                        ))}
                      </div>
                      <div className={`font-display tracking-[-0.04em] text-white leading-[0.95] mb-4 ${
                        isVault ? "text-5xl md:text-7xl" : "text-3xl md:text-4xl"
                      }`}>
                        {p.name}
                      </div>
                    </div>
                    <div className={isVault ? "md:flex-[1.6]" : ""}>
                      <p className={`text-white/85 leading-snug mb-5 ${
                        isVault ? "text-lg md:text-xl" : "text-[14.5px]"
                      }`}>
                        {p.tagline}
                      </p>
                      <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white transition-colors">
                        Open /{p.slug}
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Footer: pricing + method links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-12 flex flex-wrap items-center justify-between gap-5"
        >
          <p className="font-mono text-[11px] text-white/45 max-w-2xl leading-relaxed">
            Same engine on every tier of every product. The plain-language explainer is at
            <Link href="/how-it-works" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white pb-px ml-1">
              /how-it-works
            </Link>
            ; the engineering proof is at
            <Link href="/method" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white pb-px ml-1">
              /method
            </Link>
            ; the flagship Studio engagement is at
            <Link href="/docsouth" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white pb-px ml-1">
              /docsouth
            </Link>
            .
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/products" className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-white text-black text-[12px] font-medium hover:bg-white/90 transition-colors">
              Compare all 5
            </Link>
            <Link href="/pricing" className="inline-flex items-center justify-center h-10 px-5 rounded-full border border-white/25 text-white/85 text-[12px] hover:text-white hover:border-white/55 transition-colors">
              Pricing
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
