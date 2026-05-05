import Link from "next/link";

/**
 * HomeLayers — the architecture-shaped scroll-down on the home page.
 *
 * Replaces the old per-product showcase scroller. Visitors arrive at the
 * hero, scroll, and the next thing they see is the three-layer business
 * architecture: protocols, build, silicon. Each layer is a card linking
 * to its dedicated page.
 *
 * No client-services framing. No "products" grid. Just: the substrate
 * is shipped as protocols, used through three sub-channels, and
 * compounded by silicon.
 */

const LAYERS = [
  {
    badge: "L1",
    color: "cyan",
    href: "/protocols",
    title: "Protocols",
    pitch: "Two protocols. Every AI agent. Every data warehouse.",
    body:
      "The MCP server makes substrate clustering callable from every AI agent platform — Claude Desktop, Cursor, Goose, hyperscaler agent runtimes. The Postgres extension makes it callable as SQL from every Postgres-compatible database. Free language. Free reference operators. Premium operators metered through the protocol.",
    bullets: [
      "MCP server — JSON-RPC over stdio",
      "Postgres extension — PL/Python in any Postgres",
      "Premium operators (BTUT, TCD, content_fp48) gate behind API key",
    ],
  },
  {
    badge: "L2",
    color: "amber",
    href: "/build",
    title: "Build",
    pitch: "Three ways to build on the substrate. Pick your scale.",
    body:
      "Universal HTTP API for every webhook, every agent, every microservice. Bespoke contract buildouts for systems too massive to self-serve — strict rules: our stack as backend, contract basis, customer takes ownership. Free language for individuals to compose their own pipelines.",
    bullets: [
      "2a — Universal extension via FastAPI / SDKs / CLI",
      "2b — Bespoke buildouts for hyperscale + sovereign customers",
      "2c — Individual self-serve via the OCEAN language",
    ],
  },
  {
    badge: "L3",
    color: "violet",
    href: "/silicon",
    title: "Silicon",
    pitch: "SPU — 90× more energy-efficient than an H100 on this workload class.",
    body:
      "The Substrate Processing Unit is an 80mm² chiplet at 20W with dedicated silicon for the operator classes GPUs do badly: hashing, content-addressable retrieval, sparse scatter-gather, irregular nearest-neighbor, persistent homology. Doesn't replace the GPU — sits alongside it, and compounds the economics of every layer above.",
    bullets: [
      "16ms vs GPU's 41ms vs CPU's 114s on TNA pipeline",
      "0.32J per run vs GPU's 29J — 92× energy advantage",
      "FPGA prototype 3-4 months. MPW chiplet 9-12 months.",
    ],
  },
];

const COLORS: Record<string, { dot: string; accent: string; ring: string; gradient: string }> = {
  cyan: {
    dot:      "bg-cyan-300",
    accent:   "text-cyan-200/85",
    ring:     "group-hover:border-cyan-300/40",
    gradient: "from-cyan-500/10 to-transparent",
  },
  amber: {
    dot:      "bg-amber-300",
    accent:   "text-amber-200/85",
    ring:     "group-hover:border-amber-300/40",
    gradient: "from-amber-500/10 to-transparent",
  },
  violet: {
    dot:      "bg-violet-300",
    accent:   "text-violet-200/85",
    ring:     "group-hover:border-violet-300/40",
    gradient: "from-violet-500/10 to-transparent",
  },
};

export function HomeLayers() {
  return (
    <section id="beneath" className="relative bg-black text-white">
      {/* Intro */}
      <div className="px-6 pt-32 pb-16 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/85 mb-6">
            AUDITABLE AI INFRASTRUCTURE · THREE LAYERS
          </p>
          <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[24ch]">
            The interpretability-by-construction substrate underneath the AI stack.
          </h2>
          <p className="text-[17px] leading-[1.65] text-white/70 max-w-[64ch] mb-4">
            LLMs hallucinate. Vector databases retrieve, they do not reason. Latent Ocean ships substrate clustering as the audit-tier of the AI stack — deterministic operators, linear decision logs, cryptographic citations, bit-identical reproducibility. The reasoning is yours; the audit trail is mechanical.
          </p>
          <p className="text-[15px] leading-[1.65] text-white/55 max-w-[64ch] mb-4">
            Distribution happens through standards. MCP for every AI agent. Postgres extension for every data warehouse. HTTP for every microservice. Frontend for every browser. One operator catalog. Four channels. Premium operators metered through API key.
          </p>
          <p className="text-[15px] leading-[1.65] text-white/45 max-w-[64ch]">
            The same way Stripe sold the payments primitive and Snowflake sold the warehouse engine, Latent Ocean ships the auditable-reasoning primitive. The substrate, never the analyses on top of it. <Link href="/interpretability" className="text-emerald-300/85 hover:text-emerald-200 border-b border-emerald-300/40 hover:border-emerald-200 pb-0.5 transition-colors">See the interpretability proof →</Link>
          </p>
        </div>
      </div>

      {/* Three layer cards */}
      <div className="px-6 py-20 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {LAYERS.map(layer => {
            const c = COLORS[layer.color];
            return (
              <Link
                key={layer.badge}
                href={layer.href}
                className={`group relative block border border-white/10 ${c.ring} bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-8 transition-colors overflow-hidden`}
              >
                {/* Subtle gradient accent in the corner */}
                <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl ${c.gradient} blur-3xl opacity-50 pointer-events-none`} />

                {/* Layer badge */}
                <div className="relative flex items-center gap-2.5 mb-7">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  <span className={`font-mono text-[10.5px] uppercase tracking-[0.22em] ${c.accent}`}>
                    Layer {layer.badge.slice(1)} · {layer.title}
                  </span>
                </div>

                <h3 className="relative text-[22px] font-bold tracking-[-0.015em] leading-[1.15] mb-5">
                  {layer.pitch}
                </h3>
                <p className="relative text-[14px] leading-[1.6] text-white/60 mb-6">
                  {layer.body}
                </p>

                <ul className="relative space-y-2 text-[12.5px] leading-[1.55] text-white/55 mb-8">
                  {layer.bullets.map(b => (
                    <li key={b} className="flex gap-2">
                      <span className="text-white/30 shrink-0">→</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <span className="relative inline-block font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">
                  Open Layer {layer.badge.slice(1)} →
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Compound callout */}
      <div className="px-6 py-24 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
            HOW THE LAYERS COMPOUND
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-6">
              <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.025em] leading-[1.1] mb-6 max-w-[22ch]">
                Each layer makes the layers below it more valuable.
              </h2>
              <p className="text-[16px] leading-[1.65] text-white/65 mb-4">
                Layer 1 is the surface anyone integrates against — open protocols, free language, no account required. Layer 2 is what gets built on top — universal interface, scoped contracts, individual programs. Layer 3 is dedicated silicon that compounds Layer 2&apos;s economics by 90× for the operator classes GPUs do badly.
              </p>
              <p className="text-[15px] leading-[1.55] text-white/45">
                No customer-facing services. No SaaS dashboards. No managed deployments. Just protocols, operators, and silicon.
              </p>
            </div>
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-md overflow-hidden">
              {[
                { l: "CPU on TNA pipeline",  v: "114.47 s",     sub: "11,447 J / run" },
                { l: "GPU (H100) same task", v: "41.58 ms",     sub: "29.11 J / run" },
                { l: "SPU same task",        v: "15.77 ms",     sub: "0.32 J / run", hl: true },
                { l: "Energy advantage",     v: "92× over GPU", sub: "joules per run", hl: true },
              ].map(c => (
                <div key={c.l} className={`p-7 ${c.hl ? "bg-violet-950/20" : "bg-black"}`}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">{c.l}</p>
                  <p className={`text-[clamp(1.5rem,2.5vw,2.2rem)] font-bold tracking-[-0.02em] leading-none mb-2 ${c.hl ? "text-violet-200" : "text-white"}`}>
                    {c.v}
                  </p>
                  <p className="text-[12px] text-white/55">{c.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Three CTAs */}
      <div className="px-6 py-24 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
            WHERE TO GO NEXT
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/language" className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-7 transition-colors">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/80 mb-4">
                THE LANGUAGE
              </p>
              <h3 className="text-[20px] font-bold tracking-[-0.015em] leading-[1.2] mb-3">
                OCEAN — typed, declarative, deterministic.
              </h3>
              <p className="text-[13.5px] leading-[1.55] text-white/55 mb-5">
                Full DSL with lexer, parser, type checker, compiler, REPL, formatter, linter, doc-gen, LSP, FFI, macros. 45 conformance tests, all passing.
              </p>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">
                Read the spec →
              </span>
            </Link>

            <Link href="/gallery" className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-7 transition-colors">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-rose-300/80 mb-4">
                THE GALLERY
              </p>
              <h3 className="text-[20px] font-bold tracking-[-0.015em] leading-[1.2] mb-3">
                Five corpora. Five OCEAN programs. Five real artifacts.
              </h3>
              <p className="text-[13.5px] leading-[1.55] text-white/55 mb-5">
                arXiv, WWII intelligence archives, US patents, SEC filings, 180 years of literary drift. Demonstration evidence — not products. Reproducible.
              </p>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">
                See the showcases →
              </span>
            </Link>

            <Link href="/console" className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-7 transition-colors">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-4">
                THE WORKBENCH
              </p>
              <h3 className="text-[20px] font-bold tracking-[-0.015em] leading-[1.2] mb-3">
                Form a deterministic model on any corpus, right now.
              </h3>
              <p className="text-[13.5px] leading-[1.55] text-white/55 mb-5">
                Mount any NDJSON corpus, compose an OCEAN pipeline, run it deterministically. The internal console where new operators get tested.
              </p>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">
                Open console →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
