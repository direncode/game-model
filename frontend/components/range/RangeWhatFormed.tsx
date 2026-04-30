"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

// What a "formed private model" actually is, as a concrete artifact.
const LAYERS = [
  {
    code: "MOD-01",
    name: "Fingerprint substrate",
    sub: "BTUT · 48-bit deterministic projection per record",
    body: "Every record in the corpus becomes a 48-bit structural fingerprint. The substrate is the model's index over the data — addressable, hashable, and orders of magnitude smaller than the source corpus.",
    accent: "#00d4ff",
    artifact: "fingerprints.btut · 48 bits/record",
  },
  {
    code: "MOD-02",
    name: "Discovered taxonomy",
    sub: "TCD-JEPA · persistent-homology classes",
    body: "Records cluster into structural classes by Hamming neighborhood. The taxonomy is discovered, not declared — surfaces what the corpus actually contains, including classes no analyst named.",
    accent: "#3fb950",
    artifact: "taxonomy.tcd · k classes + persistence diagram",
  },
  {
    code: "MOD-03",
    name: "Lineage ledger",
    sub: "Merkle proofs · OpenTimeStamps anchors",
    body: "Every output the model emits resolves to its originating record bytes via a verifiable Merkle chain. Auditors get cryptographic proof, not narrative explanation.",
    accent: "#d29922",
    artifact: "lineage.merkle · sha256 per output",
  },
  {
    code: "MOD-04",
    name: "Query interface",
    sub: "RangeQL · SQL superset · structural primitives",
    body: "Queries against the formed model are deterministic and replay-able. Same query, same model, same answer, forever. The query log is itself a model artifact.",
    accent: "#a371f7",
    artifact: "queries.log · deterministic Q&A",
  },
];

const SCHEMA = `// model.range  ·  formed private model artifact

{
  "model_id":        "rng_a8e2f04a91c3d7…",
  "corpus":          "nsl-kdd-train",
  "corpus_sha256":   "dbd9937cf2d119…",
  "formed_at":       "2026-04-30T03:49:00Z",
  "seed":            42,

  "fingerprint_substrate": {
    "encoding":  "btut-48bit-v1",
    "records":   125973,
    "size":      "~750 KB",
    "lookup":    "O(1) by record_idx · O(log n) by sha256(record)"
  },

  "taxonomy": {
    "classes":            5,                    // discovered, not declared
    "persistence_diagram": "topology.tcd.bin",
    "novel_classes":      1,                    // outside known taxonomy
    "silhouette":         0.71,
    "null_test_z":        41.7
  },

  "lineage_ledger": {
    "format":   "merkle + ots",
    "anchors":  "calendar.eternitywall.com (cached)",
    "verify":   "offline · no network required"
  },

  "query_interface": {
    "dialect":       "RangeQL · SQL superset",
    "deterministic": true,
    "primitives":    [ "fingerprint()", "lineage()", "replay()", "neighbors()" ]
  }
}`;

export function RangeWhatFormed() {
  return (
    <section className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            What a formed model contains
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            A model is an artifact.<br />
            <span className="text-white/40">Not a service call.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl leading-relaxed">
            Range produces a single self-contained file the enterprise owns.
            It contains the substrate, the taxonomy, the lineage ledger,
            and the query interface. It runs on the same appliance that
            formed it — and on any other appliance that mounts the same
            corpus, byte-identically, forever.
          </p>
        </motion.div>

        {/* Four-layer artifact */}
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
              <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: l.accent, opacity: 0.55 }} />
              <div className="flex items-baseline gap-3 mb-3">
                <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: l.accent }}>{l.code}</span>
                <span className="font-display text-2xl text-white tracking-tight">{l.name}</span>
              </div>
              <div className="font-mono text-[11px] text-white/40 tracking-wide mb-4 uppercase">{l.sub}</div>
              <p className="text-sm text-white/65 leading-relaxed mb-5">{l.body}</p>
              <div className="rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-mono text-[11px] text-li-cyan">
                {l.artifact}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Schema preview */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-10 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-li-green animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green">
                model.range · sample artifact
              </span>
            </div>
            <span className="font-mono text-[10px] text-white/30">enterprise-owned · zero vendor egress</span>
          </div>
          <pre className="p-6 text-[12.5px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{SCHEMA}
          </pre>
        </motion.div>
      </div>
    </section>
  );
}
