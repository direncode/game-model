"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const FAILURES = [
  {
    title: "Probabilistic scoring",
    body:
      "EDR vendors ship neural classifiers that emit a confidence number with no path back to the bytes that produced it. Audit asks 'why' — the answer is 'the model said so.' That answer fails ICD 503 and CMMC L3.",
    pill: "BLACK BOX",
    accent: "#f85149",
  },
  {
    title: "Non-deterministic replay",
    body:
      "Two analysts re-run the same query on the same telemetry an hour apart and get different rankings. Same model weights, different hardware path, different floating-point order. Reproducibility ≠ aspirational.",
    pill: "DRIFT",
    accent: "#d29922",
  },
  {
    title: "Lineage gap",
    body:
      "SIEM aggregates events. EDR aggregates verdicts. Neither carries a cryptographic chain back to the originating PCAP / Sysmon row. When the IG asks for source bytes, the SOC opens a ticket to engineering.",
    pill: "NO PROOF",
    accent: "#a371f7",
  },
  {
    title: "Alert volume vs. signal",
    body:
      "A 47k-endpoint estate produces ~38k alerts/day at threshold. Tier-1 dispositions 2%, escalates 0.4%, true-positives ~12 per week. The remaining 99.97% is paid analyst attention spent disproving probabilistic noise.",
    pill: "VOLUME",
    accent: "#00d4ff",
  },
];

export function SentinelBreak() {
  return (
    <section className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-red mb-4">
            What is broken in modern threat intel
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Probability is not<br />
            <span className="text-white/40">an audit trail.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl">
            Every modern EDR / SIEM / XDR stack converges on the same failure
            mode: a probabilistic verdict that cannot be replayed, cannot be
            traced to source bytes, and cannot survive a serious Inspector
            General review. Sentinel is built for the audit, not against it.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {FAILURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="relative rounded-2xl border border-white/10 bg-[#0a0a10] p-8 overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ backgroundColor: f.accent, opacity: 0.55 }}
              />
              <div className="flex items-center gap-2 mb-5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: f.accent, boxShadow: `0 0 10px ${f.accent}80` }}
                />
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.2em]"
                  style={{ color: f.accent }}
                >
                  {f.pill}
                </span>
              </div>
              <div className="font-display text-3xl text-white mb-3 tracking-tight">
                {f.title}
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
