import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "Interpretability · Latent Ocean",
  description:
    "Auditable AI infrastructure. Linear decision logs, computed outcomes, cryptographic citations, bit-identical reproducibility — the substrate primitive missing from the current AI stack. Live demonstration: same OCEAN program, different embedder, different finding, and you can see why.",
};

const PROOFS: { v: string; l: string }[] = [
  { v: "100%",     l: "deterministic given seed and inputs" },
  { v: "0",        l: "hallucinations possible by construction" },
  { v: "sha256",   l: "citation per source record" },
  { v: "replay",   l: "verifiable across years" },
];

const PRIMITIVES = [
  {
    num: "01",
    title: "Linear decision logs",
    body: "Every OCEAN program is a directed acyclic graph of typed operators. Each step has typed inputs and outputs, is deterministic given seed and inputs, is reviewable as source code, and is replayable years later. The decision log is not generated about the computation. It is the computation, recorded.",
  },
  {
    num: "02",
    title: "Computed outcomes",
    body: "Outputs derive mechanically from inputs through declared operators. There is no 'the model decided.' There is load → embed → cluster → align → measure dispersion → save. The output is the input, transformed by named functions. No magic, no hallucination, no post-hoc rationalization.",
  },
  {
    num: "03",
    title: "Cryptographic citations",
    body: "Every input record is identifiable by sha256 hash. Every output cites the records that produced it. The chain of custody is preserved end-to-end. Tampering is detectable. A regulator who wants to verify a claim can do so by recomputing it from the cited records.",
  },
  {
    num: "04",
    title: "Bit-identical reproducibility",
    body: "Re-running an OCEAN program five years later with the same seed and inputs produces the same output. Bit-identical. This is the property regulators actually require: not 'explainability' as a soft narrative, but verifiability as a hard fact you can reproduce on demand.",
  },
];

const REGULATIONS = [
  { reg: "EU AI Act",                    status: "Law (enforcement Aug 2024)",          require: "Auditable decision trails for high-risk AI" },
  { reg: "NIST AI Risk Management Framework", status: "Federal procurement standard",  require: "Documentation of AI decision logic" },
  { reg: "SR 11-7 (US Federal Reserve)", status: "Regulation since 2011",               require: "Model risk management for financial AI" },
  { reg: "GDPR Article 22",              status: "Law (EU)",                            require: "Right to explanation for automated decisions" },
  { reg: "HIPAA + AI",                   status: "Active rulemaking",                   require: "Auditable AI for clinical decisions" },
  { reg: "SEC AI proposed rules",        status: "Active rulemaking",                   require: "Disclosure of AI in trading and advisory" },
];

const DISPERSION_TABLE = [
  { archive: "british_sigint_history",  n: 40, tfidf: "0.000", transformer: "1.000", delta: "+1.000" },
  { archive: "comintern_decrypts",      n: 40, tfidf: "0.000", transformer: "0.975", delta: "+0.975" },
  { archive: "diplomatic_decrypts",     n: 40, tfidf: "0.127", transformer: "1.000", delta: "+0.873" },
  { archive: "directorate_policy",      n: 40, tfidf: "0.000", transformer: "1.000", delta: "+1.000" },
  { archive: "directorate_to_pm (HW1)", n: 39, tfidf: "0.000", transformer: "0.769", delta: "+0.769", hl: true },
  { archive: "german_machine_decrypts", n: 37, tfidf: "0.948", transformer: "1.000", delta: "+0.052" },
];

export default function InterpretabilityPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32">

        {/* ===================== HERO ===================== */}
        <section className="px-6 pb-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/85 mb-6">
              AUDITABLE AI INFRASTRUCTURE
            </p>
            <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[20ch]">
              Interpretability is not an afterthought. It is the architecture.
            </h1>
            <p className="text-[18px] leading-[1.6] text-white/75 max-w-[64ch] mb-6">
              LLMs hallucinate by construction. Vector databases retrieve, they do not reason. OCEAN reasons through declared operators with deterministic seeds, linear decision logs, and cryptographic citations.
            </p>
            <p className="text-[15px] leading-[1.6] text-white/55 max-w-[60ch] mb-12">
              The first AI substrate where every answer is verifiable by replay. Not because interpretability got bolted on. Because the substrate has no other shape.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#primitives"     className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">Four primitives →</a>
              <a href="#demo"           className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">Live demonstration →</a>
              <a href="#disagreement"   className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">Cross-embedder primitive →</a>
              <a href="#regulation"     className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">Regulatory tailwind →</a>
              <a href="#position"       className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">Architectural position →</a>
            </div>
          </div>
        </section>

        {/* ===================== PROOF STRIP ===================== */}
        <section className="px-6 py-20 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-10">
              THE PROPERTIES, NUMERICALLY
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-md overflow-hidden">
              {PROOFS.map((p) => (
                <div key={p.l} className="bg-black p-7">
                  <p className="text-[clamp(1.6rem,2.6vw,2.4rem)] font-bold tracking-[-0.02em] leading-none mb-3 text-emerald-200 tabular-nums">
                    {p.v}
                  </p>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/55 leading-snug">
                    {p.l}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== THE GAP ===================== */}
        <section className="px-6 py-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
                THE INTERPRETABILITY GAP
              </p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-6">
                LLMs are black boxes by construction. The research catching up is decades behind the deployment.
              </h2>
            </div>
            <div className="lg:col-span-7 space-y-5">
              <p className="text-[16px] leading-[1.65] text-white/70">
                Mechanistic interpretability research — Anthropic Circuits, attention attribution, sparse autoencoders, RLHF auditing — is heroic, expensive, and slow. Production-grade interpretability of a frontier LLM does not exist and is not arriving in 2026. What exists today is post-hoc rationalization: the model generates the answer, then generates an explanation about the answer, often unrelated to the actual computation.
              </p>
              <p className="text-[16px] leading-[1.65] text-white/70">
                For any decision that must be defensible in court, before a regulator, in an audit, or in a compliance review, post-hoc rationalization is not enough. The decision must be reproducible. The reasoning must be reviewable. The chain of custody must be cryptographically intact.
              </p>
              <p className="text-[16px] leading-[1.65] text-white/55">
                Interpretability-by-research and interpretability-by-construction are different categories. OCEAN provides the second.
              </p>
            </div>
          </div>
        </section>

        {/* ===================== FOUR PRIMITIVES ===================== */}
        <section id="primitives" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/85 mb-6">
              WHAT OCEAN PROVIDES — for the first time at infrastructure tier
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.025em] leading-[1.1] mb-12 max-w-[26ch]">
              Four properties. Each delivered by construction, not by promise.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRIMITIVES.map((p) => (
                <div key={p.num} className="border border-white/10 bg-white/[0.02] rounded-md p-8">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/80 mb-4">
                    PRIMITIVE {p.num}
                  </p>
                  <h3 className="text-[20px] font-bold tracking-[-0.015em] leading-[1.2] mb-4">
                    {p.title}
                  </h3>
                  <p className="text-[14.5px] leading-[1.65] text-white/65">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== LIVE DEMO ===================== */}
        <section id="demo" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/85 mb-6">
              A LIVE DEMONSTRATION
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.025em] leading-[1.1] mb-6 max-w-[28ch]">
              Same OCEAN program. Different embedder. Different finding. And you can see exactly why.
            </h2>
            <p className="text-[16px] leading-[1.65] text-white/65 max-w-[64ch] mb-12">
              The TNA HW catalogue (UK National Archives, GCHQ records 1939–1945). 236 records, 6 archive series, balanced. The same OCEAN program runs twice — once with TF-IDF embeddings, once with a transformer (sentence-transformers/all-MiniLM-L6-v2, 22.7M params, 6 layers, 384-dim). Identical clustering. Identical dispersion measure. Only the embedder swapped.
            </p>

            {/* Code block */}
            <div className="font-mono text-[12.5px] leading-[1.7] text-white/85 bg-white/[0.03] border border-white/10 rounded-md p-7 mb-12 overflow-x-auto">
              <p className="text-white/40 mb-2">// the OCEAN program</p>
              <pre className="whitespace-pre-wrap text-emerald-200/85">{`load tmp/bombe_tna.ndjson take 240 records balanced by archive
embed text into 384 dimensions using minilm   # swap this line to change the finding
cluster for 32 rounds max 12 modules
align modules using 50 nearest records label is archive
find dispersion of each archive
save to dispersion_transformer.json`}</pre>
            </div>

            {/* Result table */}
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-[13.5px]">
                <thead>
                  <tr>
                    <th className="text-left font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 pb-3 pr-6">Archive (TNA HW series)</th>
                    <th className="text-right font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 pb-3 px-6">n</th>
                    <th className="text-right font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 pb-3 px-6">TF-IDF self_basin</th>
                    <th className="text-right font-mono text-[10.5px] uppercase tracking-[0.18em] text-emerald-300/85 pb-3 px-6">Transformer self_basin</th>
                    <th className="text-right font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 pb-3 pl-6">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {DISPERSION_TABLE.map((r) => (
                    <tr key={r.archive} className={r.hl ? "bg-emerald-950/20" : ""}>
                      <td className={`py-3 pr-6 border-t border-white/10 ${r.hl ? "text-emerald-200 font-bold" : "text-white/85"}`}>
                        {r.archive}
                      </td>
                      <td className="py-3 px-6 border-t border-white/10 text-right text-white/55 tabular-nums">{r.n}</td>
                      <td className="py-3 px-6 border-t border-white/10 text-right text-white/65 tabular-nums">{r.tfidf}</td>
                      <td className={`py-3 px-6 border-t border-white/10 text-right tabular-nums font-bold ${r.hl ? "text-emerald-200" : "text-emerald-300/90"}`}>{r.transformer}</td>
                      <td className="py-3 pl-6 border-t border-white/10 text-right text-white/45 tabular-nums">{r.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-10 text-[15px] leading-[1.7] text-white/65 max-w-[64ch]">
              The HW1 (directorate_to_pm) self-basin moved from 0.000 to 0.769 just by swapping the embedder. Same input, same algorithm, same parameters. Different model. The decision logic is mechanical and reviewable: TF-IDF clusters by shared vocabulary; the transformer clusters by structural meaning. Each finding is correct for its question. The substrate lets you see the question and the answer at the same time.
            </p>
            <p className="mt-5 text-[14px] leading-[1.6] text-white/45 max-w-[60ch]">
              Reproducible artifact: <code className="font-mono text-white/65">data/validation/tna_dispersion_transformer_seed42.json</code> · script: <code className="font-mono text-white/65">scripts/experiments/transformer_embed_dispersion.py</code>.
            </p>
          </div>
        </section>

        {/* ===================== CROSS-EMBEDDER DISAGREEMENT ===================== */}
        <section id="disagreement" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/85 mb-4">
                A NEW PRIMITIVE
              </p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-6">
                Cross-embedder disagreement, as a first-class signal.
              </h2>
              <p className="text-[15.5px] leading-[1.65] text-white/65">
                When two embedders agree, that is robust signal. When they disagree, the disagreement is itself signal. Off-the-shelf clustering libraries pick one embedding and cluster. None offer disagreement as a primitive output.
              </p>
            </div>
            <div className="lg:col-span-7">
              <div className="font-mono text-[12.5px] leading-[1.7] text-white/85 bg-white/[0.03] border border-white/10 rounded-md p-7 overflow-x-auto">
                <p className="text-white/40 mb-2">// future OCEAN — disagreement as a first-class operator</p>
                <pre className="whitespace-pre-wrap text-emerald-200/85">{`load tmp/corpus.ndjson take 5000 records
embed text into 384 dim using minilm    as Z_neural
embed text into 128 dim using tf-idf    as Z_lexical
cluster Z_neural  for 32 rounds          as M_neural
cluster Z_lexical for 32 rounds          as M_lexical
disagreement between M_neural and M_lexical  as cross_view
save cross_view to disagreement_signal.json`}</pre>
              </div>
              <p className="mt-6 text-[14px] leading-[1.6] text-white/55">
                Records that cluster together under one embedder but apart under another are the records whose meaning is contested between vocabulary-level and semantic-level views. Those are the records a human expert most needs to look at. The substrate surfaces them mechanically.
              </p>
            </div>
          </div>
        </section>

        {/* ===================== REGULATORY TAILWIND ===================== */}
        <section id="regulation" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              THE REGULATORY TAILWIND
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.025em] leading-[1.1] mb-6 max-w-[26ch]">
              The market for auditable AI is being created by regulators, not by founders.
            </h2>
            <p className="text-[16px] leading-[1.65] text-white/65 max-w-[64ch] mb-12">
              Every regulated industry on Earth is moving toward mandating decision-log auditability for AI systems. LLMs structurally cannot meet this requirement. OCEAN-shaped primitives are the only known way to meet it for substantive decisions.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-[13.5px]">
                <thead>
                  <tr>
                    <th className="text-left font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 pb-3 pr-6">Regulation / Framework</th>
                    <th className="text-left font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 pb-3 px-6">Status</th>
                    <th className="text-left font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 pb-3 pl-6">Binding requirement</th>
                  </tr>
                </thead>
                <tbody>
                  {REGULATIONS.map((r) => (
                    <tr key={r.reg}>
                      <td className="py-3 pr-6 border-t border-white/10 text-white/85 font-medium">{r.reg}</td>
                      <td className="py-3 px-6 border-t border-white/10 text-white/55">{r.status}</td>
                      <td className="py-3 pl-6 border-t border-white/10 text-white/65">{r.require}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ===================== ARCHITECTURAL POSITION ===================== */}
        <section id="position" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              ARCHITECTURAL POSITION
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.025em] leading-[1.1] mb-12 max-w-[28ch]">
              Complementary to LLMs. Underneath them. Where the audit lives.
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-md overflow-hidden">
              <div className="bg-black p-8">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-rose-300/80 mb-4">LLM TIER</p>
                <h3 className="text-[20px] font-bold tracking-[-0.015em] leading-[1.2] mb-4">Generation, summarization, conversation.</h3>
                <p className="text-[13.5px] leading-[1.6] text-white/55">Claude. GPT. Gemini. Llama. The soft work — language fluency, creative synthesis, conversational interface. Hallucinates by construction; not the layer where audit lives.</p>
              </div>
              <div className="bg-black p-8 ring-1 ring-emerald-500/20">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/85 mb-4">OCEAN TIER</p>
                <h3 className="text-[20px] font-bold tracking-[-0.015em] leading-[1.2] mb-4">Structure, decision, audit.</h3>
                <p className="text-[13.5px] leading-[1.6] text-white/65">Substrate clustering. Dispersion analysis. Cross-embedder disagreement. Deterministic by construction. Cited by sha256. Replayable across years. The load-bearing audit layer for any system that must answer to a regulator.</p>
              </div>
              <div className="bg-black p-8">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-cyan-300/80 mb-4">MCP TIER</p>
                <h3 className="text-[20px] font-bold tracking-[-0.015em] leading-[1.2] mb-4">Composition, orchestration.</h3>
                <p className="text-[13.5px] leading-[1.6] text-white/55">Anthropic's protocol. Glue between LLM agents and substrate operators. The agent decides whether to handle internally or delegate to OCEAN. For substantive decisions on data, the agent invokes OCEAN tools and presents the answer with citations preserved.</p>
              </div>
            </div>
            <p className="mt-10 text-[15px] leading-[1.65] text-white/55 max-w-[64ch]">
              The path-to-safe-AI architecture is not LLM-versus-substrate. It is LLM-plus-substrate-plus-protocol. The frontier labs (Anthropic, OpenAI, DeepMind) increasingly know their systems need verifiable substrate primitives. OCEAN is positioned as partner to that direction, not competitor.
            </p>
          </div>
        </section>

        {/* ===================== WHERE TO GO NEXT ===================== */}
        <section className="px-6 py-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              WHERE TO GO NEXT
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link href="/protocols" className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-7 transition-colors">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-cyan-300/80 mb-4">LAYER 1</p>
                <h3 className="text-[19px] font-bold tracking-[-0.015em] leading-[1.2] mb-3">Protocols.</h3>
                <p className="text-[13px] leading-[1.55] text-white/55 mb-5">MCP server. Postgres extension. The two channels every AI agent and every data warehouse can adopt without an account.</p>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">Open →</span>
              </Link>
              <Link href="/silicon" className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-7 transition-colors">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-violet-300/80 mb-4">LAYER 3</p>
                <h3 className="text-[19px] font-bold tracking-[-0.015em] leading-[1.2] mb-3">Silicon.</h3>
                <p className="text-[13px] leading-[1.55] text-white/55 mb-5">SPU — 80 mm² chiplet at 20 W. 90× more energy-efficient than an H100 on the substrate-clustering workload class.</p>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">Open →</span>
              </Link>
              <Link href="/system" className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-7 transition-colors">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-4">SYSTEM</p>
                <h3 className="text-[19px] font-bold tracking-[-0.015em] leading-[1.2] mb-3">The full system.</h3>
                <p className="text-[13px] leading-[1.55] text-white/55 mb-5">Eight assets. Five replication moats. Four strategic adjacencies. The unbundled view.</p>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">Open →</span>
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
