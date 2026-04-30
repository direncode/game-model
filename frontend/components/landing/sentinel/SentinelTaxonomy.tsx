"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

// Auto-discovered taxonomy. The "novel" flag is the headline — TCD-JEPA
// surfaces a previously unseen structural class without any labels, and
// the null test backs it.
const FAMILIES = [
  {
    code: "C-01",
    name: "Beaconed C2",
    pop: 14_812,
    rarity: 0.41,
    novel: false,
    note: "Periodic outbound, jittered. Known TTP cluster.",
  },
  {
    code: "C-02",
    name: "Lateral RDP",
    pop: 8_104,
    rarity: 0.37,
    novel: false,
    note: "Internal RDP fan-out from svc accounts.",
  },
  {
    code: "C-03",
    name: "Living-off-the-land",
    pop: 5_661,
    rarity: 0.59,
    novel: false,
    note: "powershell.exe + WMIC + bitsadmin chains.",
  },
  {
    code: "C-04",
    name: "Misconfigured backup",
    pop: 4_207,
    rarity: 0.22,
    novel: false,
    note: "Benign. Surfaced for whitelist promotion.",
  },
  {
    code: "C-05",
    name: "DNS exfil",
    pop: 1_944,
    rarity: 0.71,
    novel: false,
    note: "TXT record bursts, encoded payloads.",
  },
  {
    code: "C-06",
    name: "Token replay",
    pop: 612,
    rarity: 0.83,
    novel: false,
    note: "Kerberos ticket reuse across hosts.",
  },
  {
    code: "C-07",
    name: "HALCYON-7",
    pop: 47,
    rarity: 0.971,
    novel: true,
    note: "Novel structural class. Lateral movement masked as TLS keep-alive. z = 41.7 σ.",
  },
];

export function SentinelTaxonomy() {
  return (
    <section className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-purple mb-4">
            Auto-discovered structural taxonomy
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Patterns no signature<br />
            <span className="text-white/40">had a name for.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl">
            TCD-JEPA crystallizes structural classes from telemetry without
            labels, without rules, without retraining. Known families are
            confirmed. Novel families surface as new components in the
            persistence diagram. Sentinel does not need a CVE or a YARA rule
            to find what is structurally rare.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-12 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="grid grid-cols-[80px_1fr_120px_120px_120px] px-5 py-3 border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
            <div>Class</div>
            <div>Family</div>
            <div className="text-right">Population</div>
            <div className="text-right">Rarity</div>
            <div className="text-right">Status</div>
          </div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            {FAMILIES.map((f) => (
              <motion.div
                key={f.code}
                variants={fadeUp}
                className={`grid grid-cols-[80px_1fr_120px_120px_120px] items-center px-5 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] ${
                  f.novel ? "bg-li-purple/[0.04]" : ""
                }`}
              >
                <div className="font-mono text-xs text-white/50">{f.code}</div>
                <div>
                  <div
                    className={`text-sm tracking-tight ${
                      f.novel ? "text-li-purple font-medium" : "text-white"
                    }`}
                  >
                    {f.name}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">{f.note}</div>
                </div>
                <div className="text-right font-mono text-sm text-white/80 tabular-nums">
                  {f.pop.toLocaleString()}
                </div>
                <div
                  className={`text-right font-mono text-sm tabular-nums ${
                    f.rarity >= 0.9
                      ? "text-li-green"
                      : f.rarity >= 0.7
                        ? "text-li-cyan"
                        : "text-white/70"
                  }`}
                >
                  {f.rarity.toFixed(3)}
                </div>
                <div className="text-right">
                  {f.novel ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-li-purple/40 bg-li-purple/10 font-mono text-[10px] uppercase tracking-widest text-li-purple">
                      <span className="w-1 h-1 rounded-full bg-li-purple animate-pulse" />
                      Novel
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                      Confirmed
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Stat
            label="Classes discovered"
            value="7"
            sub="without labels, without rules"
            tone="cyan"
          />
          <Stat
            label="Novel families (90 d)"
            value="1"
            sub="HALCYON-7 · z = 41.7 σ"
            tone="purple"
          />
          <Stat
            label="Re-classification cost"
            value="0"
            sub="taxonomy is a query, not a retrain"
            tone="green"
          />
        </motion.div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "cyan" | "green" | "purple";
}) {
  const color =
    tone === "green"
      ? "text-li-green"
      : tone === "purple"
        ? "text-li-purple"
        : tone === "cyan"
          ? "text-li-cyan"
          : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">
        {label}
      </div>
      <div className={`font-display text-3xl tabular-nums tracking-tight ${color}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[10px] font-mono text-white/40">{sub}</div>}
    </div>
  );
}
