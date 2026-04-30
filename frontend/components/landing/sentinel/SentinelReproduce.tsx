"use client";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

export function SentinelReproduce() {
  return (
    <section className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Reproduce · the property no transformer can match
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Same input.<br />
            <span className="text-white/40">Same answer. Forever.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl">
            Every claim on this page is reproducible from a single command on
            an air-gapped Sentinel appliance. No license server. No cloud
            check-in. The appliance verifies its own integrity, replays from
            its own ledger, and signs the evidence with its own key.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-12 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-li-green animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-li-green">
              Reproducer
            </span>
            <span className="font-mono text-[11px] text-white/30 ml-auto">
              air-gapped · no external i/o
            </span>
          </div>
          <pre className="p-6 text-[13px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{`# 1. Drop a sample telemetry shard onto a fresh appliance.
sentinel ingest --source zeek_conn --path /media/usb/conn.tsv.zst
# -> 4,182,917 sessions ingested · sha256 4ae9…b2c1

# 2. Score every session under seed=42.
sentinel score --table zeek_conn --seed 42
# -> 4,182,917 fingerprints written · digest_top100 b71f…0e27

# 3. Run the null test.
sentinel null-test zeek_conn --dims composite,divergence --iterations 500
# -> z = 41.7 σ · p < 0.001 · seed = 42 · deterministic

# 4. Discover the structural taxonomy.
sentinel taxonomy crystallize --table zeek_conn --persist
# -> 7 classes · 1 novel (HALCYON-7) · entropy gap 3.42 bits

# 5. Replay any detection back to source bytes.
sentinel replay 7b1df0e4cb37…f04a --evidence-out ig.tar.zst
# -> 4 hops verified · ots anchor block 845921 · 1.4s wall

# Every digest above will match on every fresh appliance, in every
# facility, for every fiscal year, under seed=42.`}
          </pre>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Pill
            label="seed"
            value="42"
            sub="every layer"
          />
          <Pill
            label="determinism contract"
            value="byte-identical"
            sub="CI-tested per commit"
          />
          <Pill
            label="external network calls"
            value="0"
            sub="appliance never opens a socket"
          />
        </motion.div>
      </div>
    </section>
  );
}

function Pill({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">
        {label}
      </div>
      <div className="font-display text-3xl text-white tracking-tight">{value}</div>
      <div className="mt-1 text-[10px] font-mono text-white/40">{sub}</div>
    </div>
  );
}
