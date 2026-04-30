"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

// The integrated story: Sentinel slots into the SAME Latent Ocean primitive
// (lo_fingerprint / lo_score / lo_null_test) but is applied to telemetry
// tables. Customers who already run Latent Ocean against SEC, PubMed, etc.
// switch on the threat-intel module by adding a manifest.
const EXAMPLES = [
  {
    label: "Zeek conn.log",
    sub: "lo_fingerprint over network sessions",
    code: `-- Every TCP/UDP/ICMP session becomes a deterministic 48-bit fingerprint
-- plus a 4-D score column. Same primitive as your filings table — just
-- pointed at conn.log.
ALTER TABLE zeek_conn
  ADD COLUMN lo_fp    bit(48) GENERATED ALWAYS AS
              (lo_fingerprint(row_to_json(zeek_conn))) STORED,
  ADD COLUMN lo_score jsonb   GENERATED ALWAYS AS
              (lo_score(lo_fp)) STORED,
  ADD COLUMN lo_lin   bytea   GENERATED ALWAYS AS
              (lo_lineage(row_to_json(zeek_conn))) STORED;

-- Top 50 structurally rare egress sessions in the last 24h.
SELECT id_orig_h, id_resp_h, service,
       (lo_score ->> 'composite')::float AS composite,
       encode(lo_lin, 'hex')             AS lineage
FROM   zeek_conn
WHERE  ts > now() - interval '24 hours'
ORDER  BY composite DESC
LIMIT  50;`,
  },
  {
    label: "Sysmon EVTX",
    sub: "process / network / image-load events",
    code: `-- Same engine, this time on Windows endpoint telemetry.
SELECT host, image, parent_image, command_line,
       lo_score(lo_fp)->>'composite' AS rarity,
       lo_replay_id(lo_lin)          AS replay_id
FROM   sysmon_events
WHERE  event_id IN (1, 3, 7, 11)
  AND  (lo_score(lo_fp)->>'composite')::float >= 0.92
ORDER  BY rarity DESC;

-- Null test: is the rarity tail of THIS host/process pair structurally real,
-- or could it be reproduced by chance?  Run it now, on demand.
SELECT lo_null_test('sysmon_events',
                    dims => ARRAY['composite','divergence'],
                    iterations => 500,
                    where_clause => 'host = ''DCDA-WS-0419''');
-- -> {"z_score": 41.7, "p_value": "< 0.001", "seed": 42}`,
  },
  {
    label: "NetFlow / IPFIX",
    sub: "PB-scale streaming fingerprint",
    code: `// Each NetFlow record is scored in one pass. Sentinel keeps a rolling
// lattice window per /24 + per ASN; rarity is computed against the
// lattice, not against a model checkpoint.
const score = sentinel.scoreStreaming(record, {
  lattice: ["asn", "subnet24", "service"],
  historyWindow: 1_000_000,
  seed: 42,
});

if (score.composite > 0.93) {
  alerts.emit({
    record_id: record.id,
    score,
    lineage: score.lineage,         // sha-256 over input bytes
    replay_id: score.replay_id,     // bit-identical reproducer
  });
}`,
  },
  {
    label: "Splunk / Elastic",
    sub: "drop-in lineage column",
    code: `// Sentinel ships as a stage between your forwarders and your SIEM.
// Splunk keeps doing what Splunk does. Each event arrives with three
// extra fields:
{
  "_raw": "...original event bytes...",
  "lo_fp":      "0x9c4a7f0e3b21",
  "lo_score":   { "composite": 0.971, "divergence": 0.83 },
  "lo_lineage": "sha256:7b1d…f04a"
}

// SPL queries can now rank by structural rarity, and every alert is
// one click away from the bit-identical input bytes that produced it:
index=zeek lo_score.composite>=0.92
| sort - lo_score.composite
| eval replay_url="/sentinel/replay/" . lo_lineage`,
  },
];

export function SentinelStack() {
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
            Same primitive, threat-intel surface
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95]">
            Where your telemetry<br />
            <span className="text-white/40">already lives.</span>
          </h2>
          <p className="mt-6 text-lg text-white/60 max-w-3xl mx-auto">
            Sentinel is not a new SIEM. It is a deterministic{" "}
            <span className="text-li-cyan">lineage column</span> grafted onto
            the telemetry tables you already have. Splunk keeps Splunk. Elastic
            keeps Elastic. Sentinel adds the audit-grade layer underneath.
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
            The custom anomaly model that the SOC hand-tuned, ships only on
            one analyst&apos;s laptop, has never passed a null test, and breaks
            silently every time the telemetry schema rotates. Replaced with
            three deterministic columns and one function call per ingest.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
