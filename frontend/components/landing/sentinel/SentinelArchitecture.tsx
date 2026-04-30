"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const LAYERS = [
  {
    code: "L0",
    name: "Ingest",
    sub: "PCAP · Zeek · Sysmon · NetFlow · EDR · syslog · CEF · ECS",
    body:
      "Schema-aware parsers normalize raw telemetry into row-canonical form. Every byte is hashed on entry; nothing is silently dropped, transformed, or summarized.",
    accent: "#00d4ff",
  },
  {
    code: "L1",
    name: "BTUT substrate",
    sub: "48-bit structural fingerprint · lattice-threaded compression",
    body:
      "The same BTUT engine that backs Latent Ocean. Every event becomes a deterministic 48-bit structural fingerprint, addressable, hashable, and orders of magnitude smaller than the source row.",
    accent: "#3fb950",
  },
  {
    code: "L2",
    name: "TCD-JEPA discovery",
    sub: "unsupervised structural taxonomy · persistent homology",
    body:
      "Topological discovery surfaces structural classes without labels. Novel intrusion families emerge as new components in the persistence diagram, not as a model retraining cycle.",
    accent: "#a371f7",
  },
  {
    code: "L3",
    name: "Lineage ledger",
    sub: "Merkle proofs · OpenTimeStamps anchors",
    body:
      "Every artifact carries a cryptographic chain to its originating bytes. Anchored on demand to a public timestamp authority for legally durable provenance, with no external traffic at runtime.",
    accent: "#d29922",
  },
  {
    code: "L4",
    name: "Replay engine",
    sub: "bit-identical reproduction from any prior state",
    body:
      "Given any output id, Sentinel reconstructs the exact bytes, the exact fingerprints, and the exact score that produced it. Not a similar reconstruction. The same one.",
    accent: "#f85149",
  },
  {
    code: "L5",
    name: "SentinelQL",
    sub: "SQL superset · structural primitives · REPLAY clauses",
    body:
      "A SQL dialect that treats fingerprint, score, lineage, and replay as first-class operators. Hunts written today re-run identically in five years on the same telemetry, on a fresh appliance.",
    accent: "#c9a96e",
  },
];

export function SentinelArchitecture() {
  return (
    <section id="architecture" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Six layers · one deterministic stack
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Auditable<br />
            <span className="text-white/40">end to end.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl">
            Every layer is a pure function of (input bytes, seed, version).
            Same inputs produce byte-identical outputs forever. CI tests this
            invariant on every commit. There is no temperature. There is no
            sampling. There is no drift.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {LAYERS.map((l) => (
            <motion.div
              key={l.code}
              variants={fadeUp}
              className="relative rounded-2xl border border-white/10 bg-[#0a0a10] p-7 overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ backgroundColor: l.accent, opacity: 0.55 }}
              />
              <div className="flex items-baseline gap-3 mb-4">
                <span
                  className="font-mono text-[11px] tracking-[0.2em]"
                  style={{ color: l.accent }}
                >
                  {l.code}
                </span>
                <span className="font-display text-2xl text-white tracking-tight">
                  {l.name}
                </span>
              </div>
              <div className="font-mono text-[11px] text-white/40 tracking-wide mb-4 uppercase">
                {l.sub}
              </div>
              <p className="text-sm text-white/65 leading-relaxed">{l.body}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-12 rounded-xl border border-white/10 bg-white/[0.02] p-7"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3">
            The contract
          </p>
          <pre className="text-sm text-white/80 font-mono overflow-x-auto leading-relaxed">
{`fingerprint(bytes, seed=42, version=v0.9.3)  ≡  same 48 bits, forever
score(fingerprint, seed=42)                   ≡  same 4-D vector, forever
replay(lineage_hash)                          ≡  same input bytes, forever
null_test(table, dims, seed=42, n=500)        ≡  same z-score, forever`}
          </pre>
          <p className="mt-3 text-[11px] font-mono text-white/40">
            Every Sentinel answer is replay-able on a different appliance, in a
            different facility, in a different decade. That is the property no
            transformer-based system can offer.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
