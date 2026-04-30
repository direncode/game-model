"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const ROWS: { dim: string; chatgpt: string; finetune: string; range: string; rangeStrong?: boolean }[] = [
  {
    dim: "Output type",
    chatgpt: "Probabilistic text generation",
    finetune: "Probabilistic text generation",
    range: "Deterministic structural model artifact",
    rangeStrong: true,
  },
  {
    dim: "Originality",
    chatgpt: "Asymptotic to training corpus",
    finetune: "Asymptotic + biased to fine-tune set",
    range: "Genuine discovery on your data",
    rangeStrong: true,
  },
  {
    dim: "Privacy",
    chatgpt: "Vendor cloud egress, retention by default",
    finetune: "Cloud upload of training data",
    range: "Air-gap by default · zero external I/O",
    rangeStrong: true,
  },
  {
    dim: "Reproducibility",
    chatgpt: "Non-deterministic; same prompt → different answers",
    finetune: "Non-deterministic; drifts with model updates",
    range: "Bit-identical output under seed=42, forever",
    rangeStrong: true,
  },
  {
    dim: "Audit trail",
    chatgpt: "Opaque; no path to source bytes",
    finetune: "Opaque; no path to fine-tune influence",
    range: "Cryptographic lineage on every output",
    rangeStrong: true,
  },
  {
    dim: "Hallucination risk",
    chatgpt: "Structural — built into the architecture",
    finetune: "Reduced but not eliminated",
    range: "None — outputs reference real source records",
    rangeStrong: true,
  },
  {
    dim: "Update cadence",
    chatgpt: "Vendor-controlled; behavior changes overnight",
    finetune: "Re-train cycles; weeks of work",
    range: "Re-form the model in minutes; old model preserved",
    rangeStrong: true,
  },
  {
    dim: "Cost model",
    chatgpt: "Per-token forever; scales with usage",
    finetune: "Per-token + training spend",
    range: "Fixed appliance cost; queries are free",
  },
];

export function RangeBeyondLLM() {
  return (
    <section className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-red mb-4">
            What LLMs cannot do
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            Probabilistic text<br />
            <span className="text-white/40">is not a private model.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl leading-relaxed">
            ChatGPT, Claude, Gemini, and every fine-tuned variant produce
            probabilistic text that interpolates within their training
            corpus. They cannot tell you what is genuinely rare in your
            own data, cannot reproduce an output bit-for-bit a year later,
            and cannot run on a network that does not reach their cloud.
            Range solves a different problem on the same data.
          </p>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-16 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1.3fr] px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">dimension</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">ChatGPT / Claude</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">fine-tuned LLM</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-cyan">Range · private model</div>
          </div>
          <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={staggerContainer}>
            {ROWS.map((r) => (
              <motion.div
                key={r.dim}
                variants={fadeUp}
                className="grid grid-cols-[1.2fr_1fr_1fr_1.3fr] px-6 py-4 border-b border-white/[0.04] items-start"
              >
                <div className="text-sm text-white/85 tracking-tight pr-3">{r.dim}</div>
                <div className="text-[13px] text-white/55 leading-relaxed pr-3">{r.chatgpt}</div>
                <div className="text-[13px] text-white/55 leading-relaxed pr-3">{r.finetune}</div>
                <div className={`text-[13px] leading-relaxed ${r.rangeStrong ? "text-li-cyan" : "text-white/85"}`}>
                  {r.range}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card
            tone="#a371f7"
            title="The asymptote"
            body="An LLM trained on the public internet has already seen everything an LLM trained on the public internet can be told. Original insight is bounded by what is in the training data, by definition."
          />
          <Card
            tone="#3fb950"
            title="The opening"
            body="Your enterprise data is mostly not in any public corpus. A structural model formed on it surfaces patterns no LLM has been near. That is where the original insight lives."
          />
          <Card
            tone="#00d4ff"
            title="The escape velocity"
            body="Range is not better LLMs. It is what comes after — when the bottleneck shifts from text generation to structural understanding of private corpora."
          />
        </motion.div>
      </div>
    </section>
  );
}

function Card({ tone, title, body }: { tone: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a10] p-7 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: tone, opacity: 0.55 }} />
      <div className="w-1.5 h-1.5 rounded-full mb-4" style={{ backgroundColor: tone, boxShadow: `0 0 10px ${tone}80` }} />
      <div className="font-display text-2xl text-white tracking-tight mb-3">{title}</div>
      <p className="text-sm text-white/65 leading-relaxed">{body}</p>
    </div>
  );
}
