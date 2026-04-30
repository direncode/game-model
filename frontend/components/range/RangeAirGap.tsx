"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const PROFILES = [
  {
    name: "Workgroup appliance",
    sub: "single team · departmental corpus",
    cpu: "16 vCPU",
    ram: "64 GB",
    disk: "2 TB NVMe",
    gpu: "optional",
    corpora: "≤ 10 GB",
    formed_models: "up to 50",
    queries_per_sec: "~120 deterministic q/s",
  },
  {
    name: "Department appliance",
    sub: "division · multi-team",
    cpu: "32 vCPU",
    ram: "256 GB",
    disk: "12 TB NVMe",
    gpu: "1× A6000 / H100 (optional, RunPod-bridge)",
    corpora: "≤ 200 GB",
    formed_models: "up to 500",
    queries_per_sec: "~600 deterministic q/s",
  },
  {
    name: "Sovereign cluster",
    sub: "enterprise · multi-site replicated",
    cpu: "128+ vCPU per node",
    ram: "1 TB+ per node",
    disk: "100 TB+ NVMe per node",
    gpu: "8× H100 / B200 per node",
    corpora: "petabyte-class",
    formed_models: "unbounded",
    queries_per_sec: "~10k+ deterministic q/s",
  },
];

const POSTURE = [
  { k: "external network calls during formation", v: "0", strong: true },
  { k: "external network calls during query",     v: "0", strong: true },
  { k: "telemetry / phone-home",                  v: "none", strong: true },
  { k: "license check-in",                        v: "none · offline-first", strong: true },
  { k: "updates",                                 v: "signed · sneakernet only", strong: false },
  { k: "audit log",                               v: "append-only · cryptographic", strong: false },
  { k: "key custody",                             v: "appliance-local HSM (TPM 2.0)", strong: false },
  { k: "physical attestation",                    v: "secure boot · measured launch", strong: false },
];

export function RangeAirGap() {
  return (
    <section id="airgap" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Air-gap deployment · zero external I/O
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Your data stays<br />
            <span className="text-white/40">where it already is.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl leading-relaxed">
            Range runs on a single appliance you own, on a network that
            does not need to exist outside your organization. The corpus
            is mounted read-only. The formed model is written to local
            storage. The query interface listens on an internal address.
            Nothing leaves the rack.
          </p>
        </motion.div>

        {/* Diagram */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-12 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              Topology · all internal · no egress
            </span>
          </div>
          <pre className="p-7 text-[12.5px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{`     ┌──────────────────────────┐
     │ enterprise data lake      │
     │  (postgres / S3 / on-prem)│
     └────────────┬──────────────┘
                  │  read-only mount
                  ▼
     ┌──────────────────────────┐    ┌──────────────────┐
     │  Range appliance          │◄──►│ analysts / SOC   │
     │   ├─ ingest (L0)          │    │  (internal LAN)  │
     │   ├─ BTUT (L1)            │    └──────────────────┘
     │   ├─ TCD-JEPA (L2)        │
     │   ├─ lineage ledger (L3)  │    ┌──────────────────┐
     │   ├─ replay (L4)          │◄──►│ audit / IG team  │
     │   └─ RangeQL (L5)         │    │  (read-only API) │
     │                           │    └──────────────────┘
     │  formed_models/*.range    │
     └────────────┬──────────────┘
                  │  signed updates only
                  ▼
            ╳   no internet   ╳
            ╳   no telemetry  ╳
            ╳   no phone-home ╳`}
          </pre>
        </motion.div>

        {/* Posture grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-8 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green">
              Network posture · default-deny
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {POSTURE.map((p, i) => (
              <div
                key={p.k}
                className={`flex items-center justify-between gap-4 px-6 py-4 ${
                  i < POSTURE.length - 1 ? "border-b border-white/[0.04]" : ""
                } ${i % 2 === 0 ? "md:border-r md:border-white/[0.04]" : ""}`}
              >
                <span className="font-mono text-[11px] text-white/55">{p.k}</span>
                <span className={`font-mono text-[12.5px] tabular-nums ${p.strong ? "text-li-green" : "text-white/85"}`}>
                  {p.v}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Hardware profiles */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {PROFILES.map((p) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              className="rounded-2xl border border-white/10 bg-[#0a0a10] p-6"
            >
              <div className="font-display text-2xl text-white tracking-tight mb-1">{p.name}</div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40 mb-5">{p.sub}</div>
              <Spec k="cpu" v={p.cpu} />
              <Spec k="ram" v={p.ram} />
              <Spec k="disk" v={p.disk} />
              <Spec k="gpu" v={p.gpu} />
              <div className="my-3 h-px bg-white/[0.06]" />
              <Spec k="corpora" v={p.corpora} />
              <Spec k="formed models" v={p.formed_models} />
              <Spec k="query rate" v={p.queries_per_sec} highlight />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Spec({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40 shrink-0">{k}</span>
      <span className={`font-mono text-[12.5px] tabular-nums text-right ${highlight ? "text-li-cyan" : "text-white/85"}`}>{v}</span>
    </div>
  );
}
