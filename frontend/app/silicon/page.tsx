import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "Silicon · Layer 3 · Latent Ocean",
  description:
    "Layer 3: SPU — Substrate Processing Unit. 80mm² chiplet, 20W, 90× more energy-efficient than an H100 on the substrate-clustering workload class. Compounds Layers 1 and 2.",
};

export default function SiliconPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32">
        <section className="px-6 pb-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              LAYER 3 · HARDWARE COMPOUND
            </p>
            <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[18ch]">
              SPU. Substrate Processing Unit.
            </h1>
            <p className="text-[17px] leading-[1.65] text-white/65 max-w-[60ch] mb-6">
              Not an inference chip. Not a GPU competitor. A coprocessor for the operator classes GPUs do badly — hashing, content-addressable retrieval, sparse scatter-gather, irregular nearest-neighbor, persistent homology. The 30% of substrate-clustering pipelines that GPUs choke on, we run 90× more efficiently.
            </p>
            <p className="text-[15px] leading-[1.65] text-white/50 max-w-[60ch]">
              The chiplet doesn&apos;t replace anything in Layer 1 or Layer 2. It multiplies their economics. Same protocols. Same operator catalog. Same OCEAN programs. 90× less power per call. That&apos;s the compound.
            </p>
          </div>
        </section>

        {/* Headline metrics */}
        <section className="px-6 py-20 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-10">
              SIMULATION RESULTS · TNA HW CATALOGUE, 500 RECORDS
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
              {[
                { lbl: "CPU (32-core Xeon, 100W)", val: "114.47 s", sub: "11,447 J per pipeline run" },
                { lbl: "GPU (H100, 700W)",          val: "41.58 ms", sub: "29.11 J per pipeline run" },
                { lbl: "SPU (20W)",                 val: "15.77 ms", sub: "0.32 J per pipeline run", hl: true },
              ].map(c => (
                <div key={c.lbl} className={`p-10 ${c.hl ? "bg-cyan-950/20" : "bg-black"}`}>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-4">{c.lbl}</p>
                  <p className={`text-[clamp(2.2rem,4vw,3.4rem)] font-bold tracking-[-0.025em] leading-none mb-3 ${c.hl ? "text-cyan-200" : "text-white"}`}>
                    {c.val}
                  </p>
                  <p className="text-[13.5px] text-white/55">{c.sub}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10">
              <div className="p-10 bg-black">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-4">
                  SPU SPEEDUP VS GPU
                </p>
                <p className="text-[clamp(2.2rem,4vw,3.4rem)] font-bold tracking-[-0.025em] leading-none mb-3 text-white">
                  3× faster
                </p>
                <p className="text-[13.5px] text-white/55">on this workload class</p>
              </div>
              <div className="p-10 bg-cyan-950/20">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-cyan-200/85 mb-4">
                  SPU ENERGY EFFICIENCY VS GPU
                </p>
                <p className="text-[clamp(2.2rem,4vw,3.4rem)] font-bold tracking-[-0.025em] leading-none mb-3 text-cyan-200">
                  92× better
                </p>
                <p className="text-[13.5px] text-white/65">joules per pipeline run</p>
              </div>
            </div>
            <p className="mt-8 text-[13px] leading-[1.6] text-white/45 max-w-[58ch]">
              CPU times are MEASURED from real OCEAN runs in <code className="font-mono text-white/55">data/validation/</code>. GPU and SPU times are MODELED — GPU using H100 published throughputs with a 3% efficiency penalty for irregular scatter-gather; SPU from per-unit throughputs in the architecture spec. Real silicon would lose 20–50% to memory contention and thermal effects. Even with that haircut, the 90× energy-efficiency advantage survives because it&apos;s a fundamental architectural alignment, not a marginal optimization.
            </p>
          </div>
        </section>

        {/* Architecture summary */}
        <section className="px-6 py-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
                ARCHITECTURE
              </p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-6">
                80 mm². 20 W. Built around the operators GPUs can&apos;t.
              </h2>
              <p className="text-[15.5px] leading-[1.65] text-white/65 mb-6">
                Six dedicated compute units, each sized for an operator class GPUs do badly: 64 hash engines, 256 sparse-bit-manipulation ALUs, 16K-entry CAM, 32-channel scatter-gather, 4K-MAC modest matmul, and a 7-ns 8×8 mesh interconnect for recursive-loop iteration.
              </p>
              <p className="text-[15.5px] leading-[1.65] text-white/65 mb-8">
                64 MB on-die L1 SRAM holds an entire 1-million-record fingerprint corpus on the chip — no HBM round-trips for the hot path. PCIe Gen5 x16 plus CXL.cache 2.0 for tight coherent integration with adjacent GPUs.
              </p>
              <p className="text-[15.5px] leading-[1.65] text-white/55">
                Independent management plane: BMC subsystem with USB-C console and I²C control. Operators-team plugs in a laptop, sees per-operator timing without a kernel module loaded on the host.
              </p>
            </div>
            <div className="lg:col-span-7">
              <div className="grid grid-cols-2 gap-px bg-white/10 border border-white/10">
                {[
                  { l: "Process node",          v: "TSMC N5 (5 nm)" },
                  { l: "Die area",              v: "80 mm² chiplet" },
                  { l: "Power",                 v: "20 W TDP" },
                  { l: "Hash engines",          v: "64 × SHA-256 @ 2 GHz" },
                  { l: "Hash throughput",       v: "4 G hash/sec aggregate" },
                  { l: "SBMU",                  v: "256 × 256-bit ALUs @ 2 GHz" },
                  { l: "Bit-op throughput",     v: "16.4 TB/s" },
                  { l: "CAM",                   v: "16K entries × 64-bit, 16 ports" },
                  { l: "CAM throughput",        v: "16 G lookups/sec" },
                  { l: "Scatter-gather",        v: "32 channels @ 256 GB/s" },
                  { l: "Modest matmul",         v: "4K MACs · 8 TOPS int8" },
                  { l: "L1 SRAM",               v: "64 MB on-die" },
                  { l: "Interconnect latency",  v: "7 ns worst-case (8×8 mesh)" },
                  { l: "Host link",             v: "PCIe Gen5 x16 + CXL.cache 2.0" },
                  { l: "Mgmt plane",            v: "BMC + USB-C console + I²C" },
                  { l: "Form factor",           v: "PCIe card OR UCIe chiplet" },
                ].map(r => (
                  <div key={r.l} className="bg-black p-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 mb-1.5">{r.l}</p>
                    <p className="font-mono text-[13.5px] text-white/85">{r.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Path to silicon */}
        <section className="px-6 py-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              PATH TO SILICON
            </p>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-12 max-w-[28ch]">
              FPGA in months. Chiplet in a year. Custom 5nm at scale.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
              {[
                { stage: "FPGA prototype", time: "3–4 months", cost: "$20K–$100K", note: "Xilinx Versal AI Edge with PCIe Gen5 + management subsystem. Working accelerator, ~90% of dedicated-silicon performance." },
                { stage: "TSMC MPW chiplet", time: "9–12 months", cost: "$1–3 M", note: "Multi-project shuttle. Real silicon, UCIe-compatible. Drops into Intel / AMD / NVIDIA chiplet packages.", hl: true },
                { stage: "Full custom 5nm", time: "18–24 months", cost: "$30 M+", note: "Dedicated mask, leading-edge node. Volume economics; only worth it after MPW validates the architecture." },
              ].map(r => (
                <div key={r.stage} className={`p-8 ${r.hl ? "bg-cyan-950/20" : "bg-black"}`}>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-4">{r.stage}</p>
                  <p className="text-[18px] font-bold text-white mb-1">{r.time}</p>
                  <p className="font-mono text-[13.5px] text-white/65 mb-4">{r.cost}</p>
                  <p className="text-[13px] leading-[1.55] text-white/55">{r.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compound table */}
        <section className="px-6 py-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              THE COMPOUND
            </p>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-10 max-w-[34ch]">
              Each layer makes the others more valuable.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[1100px] text-[15px] leading-[1.65]">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">Without SPU</p>
                <ul className="space-y-3 text-white/55">
                  <li>• Premium operators run on customer&apos;s CPU/GPU; slow + expensive</li>
                  <li>• Per-call billing reflects compute cost; no margin headroom</li>
                  <li>• Bespoke buildouts are software-only; easier to displace</li>
                  <li>• Individual users hit GPU $/hour ceilings; can&apos;t afford big runs</li>
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-cyan-300/80 mb-3">With SPU</p>
                <ul className="space-y-3 text-white/85">
                  <li>• Premium operators run on dedicated silicon; 90× more energy-efficient</li>
                  <li>• Per-call billing has 90× margin headroom</li>
                  <li>• Bespoke buildouts include silicon; vertically integrated, hard to displace</li>
                  <li>• Individual users hit SPU pricing; substrate clustering becomes affordable at scale</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Climb back */}
        <section className="px-6 py-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              CLIMB BACK DOWN THE STACK
            </p>
            <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-10 max-w-[28ch]">
              The silicon is the multiplier. The protocols are how it ships.
            </h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/protocols" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                ← Layer 1 — Protocols
              </Link>
              <Link href="/build" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                ← Layer 2 — Build
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
