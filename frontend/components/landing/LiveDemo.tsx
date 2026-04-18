"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { fadeUp, viewportOnce } from "@/lib/motion";
import sampleData from "@/data/edgar-sample.json";

type Survivor = {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, unknown>;
  cluster: number;
  scores: {
    composite: number;
    diversity: number;
    reconstruction: number;
    anomaly: number;
  };
};

const TYPE_COLORS: Record<string, string> = {
  company: "#00d4ff",
  filing: "#a371f7",
  financial_fact: "#3fb950",
};

export function LiveDemo() {
  const [selected, setSelected] = useState<Survivor | null>(null);
  const survivors = sampleData.survivors as Survivor[];
  const meta = sampleData.metadata;
  const anomalies = sampleData.anomalies;

  const topSurvivors = [...survivors].sort((a, b) => b.scores.composite - a.scores.composite).slice(0, 20);

  return (
    <section id="live-demo" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Live · Real data · SEC EDGAR
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 max-w-4xl">
            {meta.n_input.toLocaleString()} real companies.<br />
            <span className="text-white/40">{meta.n_survivors} signal-rich survivors.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            This is a live reduction of {meta.n_input.toLocaleString()} real public companies from SEC EDGAR filings,
            computed in {meta.wall_seconds.toFixed(1)} seconds. No mockups. No hand-picking. Scroll and click any entity.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-16 grid grid-cols-12 gap-6"
        >
          {/* Left: Survivors list */}
          <div className="col-span-12 lg:col-span-7 border border-white/10 rounded-2xl bg-[#0a0a10] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-mono text-sm uppercase tracking-widest text-white/60">Top Survivors</h3>
              <span className="text-xs font-mono text-white/40">Ranked by composite score</span>
            </div>
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {topSurvivors.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left px-6 py-4 hover:bg-white/5 transition-colors ${
                    selected?.id === s.id ? "bg-white/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-1.5 h-12 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[s.type] || "#ffffff40" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-white truncate">{s.name}</div>
                      <div className="text-xs font-mono text-white/40 mt-1">
                        {s.type} · cluster {s.cluster}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg text-white tabular-nums">
                        {s.scores.composite.toFixed(3)}
                      </div>
                      {s.scores.anomaly > 0.7 && (
                        <div className="text-xs font-mono text-li-red mt-0.5">
                          anomaly {s.scores.anomaly.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Selected detail + stats */}
          <div className="col-span-12 lg:col-span-5 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="Reduction" value={`${meta.reduction_ratio}:1`} />
              <StatBlock label="Wall time" value={`${meta.wall_seconds.toFixed(1)}s`} />
              <StatBlock label="Clusters" value={meta.n_clusters.toString()} />
              <StatBlock label="Unique fingerprints" value={meta.unique_fingerprints.toString()} />
            </div>

            {/* Detail panel */}
            <div className="border border-white/10 rounded-2xl bg-[#0a0a10] p-6 min-h-[300px]">
              {selected ? (
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-white/40 mb-2">
                    Entity detail
                  </div>
                  <div className="text-2xl text-white mb-4">{selected.name}</div>
                  <dl className="space-y-3 text-sm">
                    <Row k="Type" v={selected.type} />
                    <Row k="Cluster" v={`#${selected.cluster}`} />
                    <Row k="Composite" v={selected.scores.composite.toFixed(4)} />
                    <Row k="Diversity" v={selected.scores.diversity.toFixed(4)} />
                    <Row k="Reconstruction" v={selected.scores.reconstruction.toFixed(4)} />
                    <Row k="Anomaly" v={selected.scores.anomaly.toFixed(4)} />
                  </dl>
                </div>
              ) : (
                <div className="text-white/40 text-sm">
                  Select a survivor to view its structural profile.
                </div>
              )}
            </div>

            {/* Top anomalies */}
            {anomalies.length > 0 && (
              <div className="border border-white/10 rounded-2xl bg-[#0a0a10] p-6">
                <div className="font-mono text-xs uppercase tracking-widest text-white/40 mb-4">
                  Top anomalies
                </div>
                <ul className="space-y-3">
                  {anomalies.slice(0, 5).map((a) => (
                    <li key={a.id} className="text-sm">
                      <div className="text-white">{a.name}</div>
                      <div className="text-xs font-mono text-li-red mt-1">
                        anomaly {a.score.toFixed(3)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 rounded-xl bg-[#0a0a10] p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="font-mono text-2xl text-white mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <dt className="text-white/40 font-mono text-xs uppercase tracking-widest">{k}</dt>
      <dd className="text-white font-mono">{v}</dd>
    </div>
  );
}
