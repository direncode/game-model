"use client";

import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

// What it looks like once the primitive is installed.
// These are intentionally SQL-dialect-agnostic; dialect-specific adapters
// (Postgres extension, Snowflake external function, MongoDB Atlas trigger)
// are documented in /docs/commercial/INTEGRATIONS.md.
const EXAMPLES = [
  {
    label: "Postgres",
    sub: "pg_latentocean extension",
    code: `-- Every row gets a 48-bit structural fingerprint + score columns.
ALTER TABLE filings
  ADD COLUMN lo_fp      bit(48)  GENERATED ALWAYS AS (lo_fingerprint(row_to_json(filings))) STORED,
  ADD COLUMN lo_score   jsonb    GENERATED ALWAYS AS (lo_score(lo_fp)) STORED;

-- Find the top 10 structural outliers in a 61,041-row universe.
SELECT cik, concept, (lo_score ->> 'composite')::float AS composite
FROM   filings
ORDER  BY composite DESC
LIMIT  10;

-- Prove it: run the null-permutation on this universe right now.
SELECT lo_null_test('filings', dims => ARRAY['composite'], iterations => 500);
-- -> {"z_score": 54.68, "p_value": "< 0.001", "seed": 42}`,
  },
  {
    label: "Snowflake",
    sub: "lo_score(row_json) external function",
    code: `-- Same primitive as Postgres, wired through an external function.
CREATE OR REPLACE TABLE customers_structured AS
SELECT *,
       LO_FINGERPRINT(OBJECT_CONSTRUCT(*))           AS lo_fp,
       LO_SCORE(LO_FINGERPRINT(OBJECT_CONSTRUCT(*))) AS lo_score
FROM   customers;

SELECT customer_id, lo_score:composite::float AS composite
FROM   customers_structured
WHERE  lo_score:composite::float >= 0.90;
-- 22 rows — structurally rare customers in a 1.2M-row table.`,
  },
  {
    label: "MongoDB Atlas",
    sub: "lo.fingerprint + lo.score aggregation stage",
    code: `db.papers.aggregate([
  { $lo: { fingerprint: "$$ROOT", bits: 48 } },
  { $lo: { score: "$lo_fp" } },
  { $match: { "lo_score.composite": { $gte: 0.85 } } },
  { $sort:  { "lo_score.composite": -1 } },
  { $limit: 20 }
])
// PubMed: 20 top-divergent biomedical papers in a 35M-record corpus,
//   computed in 0.82s against a warm lo_score index.`,
  },
  {
    label: "Streaming",
    sub: "any event feed",
    code: `// Each Kafka / Kinesis / Pulsar message gets scored in one pass.
const score = lo.scoreStreaming(record, { historyWindow: 400, seed: 42 });
if (score.composite > 0.85) alerts.emit(record.id, score);

// Null-test on demand against the last N records:
const nt = await lo.nullTest("orders", { n: 200, k: 10 });
// -> z = 18.19 σ  |  sig p < 0.05  |  deterministic`,
  },
];

export function PrimitiveInStack() {
  return (
    <section className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            What it looks like once it's in your stack
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95]">
            The primitive,<br />
            <span className="text-white/40">where your data already lives.</span>
          </h2>
          <p className="mt-6 text-lg text-white/60 max-w-3xl mx-auto">
            Connect once. Every row of every table acquires a deterministic
            structural fingerprint and a 4-dimensional score column. Outlierness
            becomes a <span className="text-li-cyan">WHERE</span> clause; peer
            rank becomes an <span className="text-li-cyan">ORDER BY</span>; the
            null test becomes a function call. No new query language, no
            re-platforming.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {EXAMPLES.map((ex) => (
            <motion.div
              key={ex.label}
              variants={fadeUp}
              className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-white">{ex.label}</span>
                  <span className="text-[11px] font-mono text-white/40">
                    {ex.sub}
                  </span>
                </div>
                <div className="w-2 h-2 rounded-full bg-li-cyan/80 shadow-[0_0_8px_rgba(0,212,255,0.6)]" />
              </div>
              <pre className="p-5 text-[12.5px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{ex.code}
              </pre>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-14 rounded-xl border border-li-cyan/20 bg-li-cyan/[0.03] p-8 text-center"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-li-cyan mb-3">
            What this replaces
          </p>
          <p className="text-lg text-white/80 max-w-3xl mx-auto leading-relaxed">
            The bespoke "anomaly detection project" that every data team runs
            quarterly — weeks of feature engineering, a handwritten
            classifier, one-off dashboards, no null test, no reproducibility,
            no survival across team handovers. This replaces all of it with
            two deterministic columns and one function call.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
