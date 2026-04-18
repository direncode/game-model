"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const CONNECTORS = [
  { name: "PostgreSQL", category: "Database", example: "postgresql://..." },
  { name: "MySQL", category: "Database", example: "mysql://..." },
  { name: "MongoDB", category: "Database", example: "mongodb://..." },
  { name: "Snowflake", category: "Warehouse", example: "snowflake://..." },
  { name: "S3", category: "Object Store", example: "s3://bucket/*" },
  { name: "CSV", category: "File", example: "*.csv" },
  { name: "JSON", category: "File", example: "*.json · *.jsonl" },
  { name: "Parquet", category: "File", example: "*.parquet" },
  { name: "Excel", category: "File", example: "*.xlsx" },
  { name: "REST API", category: "API", example: "https://..." },
  { name: "Kafka", category: "Stream", example: "kafka://..." },
];

export function UniversalConnect() {
  return (
    <section id="connect" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Universal connect
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 max-w-4xl">
            One input.<br />
            <span className="text-white/40">Any data source.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            Paste a connection string, a URI, a file path, or drag a file in. The engine figures out the rest.
          </p>
        </motion.div>

        {/* Code-like demo */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-12 border border-white/10 rounded-2xl bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <span className="ml-3 font-mono text-xs text-white/40">connect.py</span>
          </div>
          <pre className="p-6 font-mono text-sm text-white/80 overflow-x-auto">
{`from latentocean import Client

client = Client(api_key="lo_sk_...")

# One call. Any source. Auto-detected.
client.infer("postgresql://user:pass@host/db")
client.infer("s3://acme/exports/2026/*.parquet")
client.infer("https://api.acme.com/v2/orders")
client.infer("/data/customers.csv")`}
          </pre>
        </motion.div>

        {/* Connectors grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
        >
          {CONNECTORS.map((c) => (
            <motion.div
              key={c.name}
              variants={fadeUp}
              className="border border-white/10 rounded-xl bg-[#0a0a10] p-4 hover:border-white/20 hover:bg-[#0f0f18] transition-colors"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
                {c.category}
              </div>
              <div className="text-base text-white">{c.name}</div>
              <div className="font-mono text-[11px] text-white/40 mt-2 truncate">{c.example}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
