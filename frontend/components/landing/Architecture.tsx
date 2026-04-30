"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const PRIMITIVES = [
  {
    name: "Reduce",
    subtitle: "8-tier cascade",
    description: "Forward-only Fokker-Planck mean-field solver. One million points of noise become a few hundred of signal.",
    detail: "BTUT · PreFilter · Cascade · Thinning · Quality",
  },
  {
    name: "Represent",
    subtitle: "Manifold projection",
    description: "L2-normalized 8D hypersphere for compute, optional 3D S² for display. Geometry that preserves semantics.",
    detail: "8D unit sphere · 3D stereographic",
  },
  {
    name: "Discover",
    subtitle: "Topology-aware",
    description: "Cross-source causal linking and persistent homology. Find structural connections humans miss.",
    detail: "Causal linking · TCD-JEPA · Homology",
  },
  {
    name: "Monitor",
    subtitle: "Flow engine",
    description: "Wells, wires, circulation rate, friction index. Real-time health of your data lattice.",
    detail: "Well · Wire · FlowGraph · Conformal",
  },
  {
    name: "Query",
    subtitle: "O(1) lookups",
    description: "Indexed access to survivors, anomalies, clusters, and lineage. RAG-enhanced narrative generation.",
    detail: "Indexed · RAG · Narrative",
  },
];

export function Architecture() {
  return (
    <section id="architecture" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/45 mb-4">
            Engine architecture
          </p>
          <h2 className="font-display font-medium text-5xl md:text-7xl tracking-[-0.035em] text-white mb-6 max-w-4xl">
            Five primitives.<br />
            <span className="text-white/40">One engine.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            Everything the platform does composes from these. They run in parallel, in sequence, in any combination.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-20 grid grid-cols-1 md:grid-cols-5 gap-px bg-white/5 border border-white/5 rounded-2xl overflow-hidden"
        >
          {PRIMITIVES.map((p, i) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              className="bg-[#0a0a10] p-8 hover:bg-[#0f0f18] transition-colors"
            >
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/45 mb-4">
                0{i + 1}
              </div>
              <div className="font-display text-3xl text-white mb-2">{p.name}</div>
              <div className="font-mono text-xs uppercase tracking-widest text-white/40 mb-4">
                {p.subtitle}
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-6">{p.description}</p>
              <div className="text-[11px] font-mono text-white/30 leading-relaxed">{p.detail}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
