"use client";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

const LO_TABLES = [
  { name: "lo_survivors", description: "Signal-rich entities with composite, diversity, reconstruction, and anomaly scores" },
  { name: "lo_connections", description: "Structural relationships discovered between entities" },
  { name: "lo_anomalies", description: "Entities flagged by anomaly detection with severity and narrative" },
  { name: "lo_clusters", description: "Cluster memberships with dominant type and centroid geometry" },
  { name: "lo_magnitude", description: "6-dimensional continuous fingerprints for stability analysis" },
  { name: "lo_quality", description: "Per-run quality metrics: coverage, variance ratio, wall time, cost" },
  { name: "lo_lineage", description: "Full event history with parent-child causal chains" },
];

export function Materialized() {
  return (
    <section className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Materialized intelligence
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 max-w-4xl">
            Intelligence lives in<br />
            <span className="text-white/40">your database.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            Seven native tables written back to your data estate. Query them with SQL. Join them with your existing schema. No new tools.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Left: Code block */}
          <div className="border border-white/10 rounded-2xl bg-[#0a0a10] overflow-hidden">
            <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="ml-3 font-mono text-xs text-white/40">query.sql</span>
            </div>
            <pre className="p-6 font-mono text-sm text-white/80 overflow-x-auto leading-relaxed">
{`-- Top anomalies in your data
SELECT
  s.entity_id,
  s.entity_type,
  s.composite_score,
  s.narrative
FROM `}<span className="text-li-cyan">lo_survivors</span>{` s
WHERE s.anomaly_score > 0.8
ORDER BY s.composite_score DESC
LIMIT 20;

-- Hidden connections across your estate
SELECT
  c.source_id,
  c.target_id,
  c.signal_type,
  c.strength
FROM `}<span className="text-li-cyan">lo_connections</span>{` c
WHERE c.strength > 0.75;`}
            </pre>
          </div>

          {/* Right: Tables list */}
          <div className="space-y-2">
            {LO_TABLES.map((t) => (
              <div
                key={t.name}
                className="border border-white/10 rounded-xl bg-[#0a0a10] p-4 hover:border-white/20 hover:bg-[#0f0f18] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="font-mono text-sm text-li-cyan whitespace-nowrap pt-0.5">
                    {t.name}
                  </div>
                  <div className="text-sm text-white/60 leading-relaxed">{t.description}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
