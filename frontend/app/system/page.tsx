import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "System · Latent Ocean",
  description:
    "Full system inventory — eight independently valuable assets, five replication moats, four strategic adjacencies (Snowflake, dbt, Palantir, Cerebras), and the saleable-units view.",
};

const STATS: { v: string; l: string }[] = [
  { v: "264,000", l: "lines of original code" },
  { v: "47,000",  l: "lines of documentation" },
  { v: "1,500+",  l: "source files" },
  { v: "402",     l: "commits in five weeks" },
  { v: "16",      l: "backend service modules" },
  { v: "29",      l: "versioned APIs" },
  { v: "100",     l: "frontend routes" },
  { v: "175",     l: "frontend components" },
  { v: "44",      l: "corpus validations" },
  { v: "14",      l: "OCEAN language modules" },
  { v: "4",       l: "proprietary operators" },
  { v: "90×",     l: "SPU energy efficiency over GPU" },
];

type Asset = {
  num: string;
  kicker: string;
  title: string;
  body: string[];
  meta: string[];
  adjacency?: { label: string; comp: string };
  href?: { label: string; url: string };
};

const ASSETS: Asset[] = [
  {
    num: "01",
    kicker: "ASSET 01 · LANGUAGE",
    title: "OCEAN — substrate language",
    body: [
      "A working domain-specific language with the full surrounding toolchain. Not a parser. Not a syntax-only DSL. Lexer, parser, AST, type-checker, compiler, LSP server, formatter, linter, REPL, FFI bridge, macros, and doc-generator. Every piece you would expect of a modern programming language.",
      "Most domain-specific languages stop at the parser. OCEAN does not. It is a substrate language with the same kind of surrounding infrastructure that mature general-purpose languages provide. The MCP adapter is built into the language tooling itself — every Claude / Cursor / Continue / Goose / hyperscaler agent runtime gets OCEAN as a native callable capability the moment the server starts.",
    ],
    meta: ["14 modules · 4,393 lines", "45 conformance tests passing", "MCP adapter built in"],
    adjacency: { label: "Adjacency", comp: "Same shape as dbt for AI and data pipelines. dbt Labs reached $4.2B at peak on the strength of the language layer." },
    href: { label: "Open the language", url: "/language" },
  },
  {
    num: "02",
    kicker: "ASSET 02 · OPERATORS",
    title: "Four proprietary operators",
    body: [
      "TCDRecursiveLoop, ContentFp48Embedder, DispersionAnalysis, BTUT. Each is a novel algorithm with measured performance characteristics. Together they form the value-capture hook for every distribution channel.",
      "Trade-secret-protected: each operator class lives only in private code and on the metered runtime. Mechanical IP boundary enforcement at publish time means the open-core wheel ships with stubs only. Programs that reference premium operators still compile and type-check; they just route to api.latentocean.com when actually invoked.",
      "Without these, the open-core wheel is a language plus reference implementations — a freemium nothing. With them, the metering hook exists and every channel converts to revenue when premium operators get called.",
    ],
    meta: ["4 algorithms · trade-secret protected", "AST-stripped from public wheel", "Routed to metered runtime"],
    href: { label: "See the protocol surface", url: "/protocols" },
  },
  {
    num: "03",
    kicker: "ASSET 03 · SILICON",
    title: "SPU silicon architecture",
    body: [
      "Substrate Processing Unit. 80 mm² chiplet at 20 W with dedicated silicon for the operator classes GPUs do badly: hashing, content-addressable retrieval, sparse scatter-gather, irregular nearest-neighbor, persistent homology.",
      "Simulated 90× energy efficiency over an H100 on the substrate-clustering workload class. Real silicon would lose 20–50% to memory contention and thermal effects. Even with that haircut, the energy-efficiency advantage survives because the win is architectural alignment, not marginal optimization.",
      "FPGA prototype 3–4 months out. MPW chiplet 9–12 months out.",
    ],
    meta: ["80 mm² · 20 W chiplet", "16 ms vs GPU 41 ms · 0.32 J vs GPU 29 J", "Architecture spec + simulator"],
    adjacency: { label: "Adjacency", comp: "Same shape as Cerebras and Groq for substrate-shaped workloads. Cerebras raised at $4B+ pre-revenue largely on the silicon-moat story." },
    href: { label: "Open the silicon page", url: "/silicon" },
  },
  {
    num: "04",
    kicker: "ASSET 04 · PRODUCT SURFACE",
    title: "Full-stack product surface",
    body: [
      "Backend, frontend, and integration plane already in place. 109,713 lines of FastAPI backend across 16 service modules and 29 versioned API endpoints. 64,466 lines of Next.js frontend across 100 page routes, 30 API routes, and 175 components.",
      "The shapes of multiple monetization paths are already pre-built in code: module marketplace, QR identity, range gating, dataset library, contestation flow, governance, lineage, audit. None of these is a stub. Each has its own service module, schema, and frontend pages.",
    ],
    meta: ["109K LOC backend · 64K LOC frontend", "16 services · 29 APIs · 100 routes · 175 components", "Module marketplace, QR identity, range gating wired"],
    href: { label: "Open the build layer", url: "/build" },
  },
  {
    num: "05",
    kicker: "ASSET 05 · SHOWCASES",
    title: "Eight vertical showcases",
    body: [
      "Each is a credibility artifact that doubles as a near-shippable product into a defined buyer category:",
      "/nato-sim — twelve sub-pages, full intelligence-simulation vertical for defense, government, think tanks. /receipt/sec-edgar — provenance audit trail for regulatory filings; every public company is a target. /pulse/uspto-inventors — innovator graph analytics; IP firms, VCs, R&D departments. /atlas/arxiv — scientific corpus constellations; research-funding agencies, universities. /bombe — archival provenance over The National Archives Kew; museums, archives, intelligence services. /docsouth, /dunc, /franklin — additional credibility surfaces.",
    ],
    meta: ["8 verticals · each one buyer-category-shaped", "Defense, regtech, IP, scientific, archival, historical", "Each near-shippable as a Layer 2b contract"],
    adjacency: { label: "Adjacency", comp: "Same shape as Palantir Forward Deploy for vertical AI. Forward Deploy contracts run $1M–50M each." },
    href: { label: "See the showcase gallery", url: "/gallery" },
  },
  {
    num: "06",
    kicker: "ASSET 06 · VALIDATION",
    title: "Validation corpus",
    body: [
      "44 corpus runs spanning regulatory (EDGAR), cryptographic (TNA), scientific (arXiv), patent (USPTO), historical (DocSouth), defense (megatest), security (NSL-KDD), and commercial (Yahoo finance, Titan benchmarks) domains.",
      "Replicating this corpus from scratch is itself a multi-month research project before a single line of substrate code is written. The accumulated runs are the empirical proof artifact set that makes the substrate-works-on-real-data claim defensible without hand-waving.",
    ],
    meta: ["44 corpus validations · 8 domains", "Regulatory · scientific · patent · archival · security · commercial · defense", "Reproducible from harvesters in scripts/"],
    href: { label: "See validation runs", url: "/validation" },
  },
  {
    num: "07",
    kicker: "ASSET 07 · DISTRIBUTION",
    title: "Four-channel distribution",
    body: [
      "Most ML and data startups address one distribution channel. Latent Ocean addresses four simultaneously, all sharing one operator catalog:",
      "MCP server — every Claude / Cursor / Continue / Goose / hyperscaler agent runtime. Postgres extension — every Postgres-compatible database (Aurora, AlloyDB, Cockroach, Yugabyte, Supabase, Neon, TimescaleDB). HTTP API — every webhook, every microservice, every CI/CD pipeline. Frontend — every browser.",
      "All four are shipping. Anything that implements any one of them gets the full operator catalog. The compounding is structurally unusual.",
    ],
    meta: ["4 channels · all shipping", "One shared operator catalog across all four", "Reaches agents, databases, webhooks, browsers"],
    adjacency: { label: "Adjacency", comp: "Same shape as Snowflake and Databricks for data substrate. Both became category leaders by addressing distribution at the protocol layer rather than the SaaS layer." },
    href: { label: "Open the protocol layer", url: "/protocols" },
  },
  {
    num: "08",
    kicker: "ASSET 08 · IP ARCHITECTURE",
    title: "Trade-secret architecture itself",
    body: [
      "Open-core boundary enforcement as a reusable architectural pattern. vendor_strip.py walks the operator tree at publish time, removes proprietary class definitions via AST surgery, and refuses to exit cleanly if any leak is detected.",
      "The pattern composes: open-core lowers adoption friction (free PyPI / npm install, no paywall, no signup), premium operators capture value through the metered API gate. Programs that reference premium operators still compile in the public wheel. They simply route to the hosted runtime when invoked.",
      "This is itself extractable IP. The pattern could be packaged and licensed as an open-core boundary kit for other companies pursuing the same architecture.",
    ],
    meta: ["AST-level mechanical enforcement", "Refuses to publish on leak detection", "Reusable as an open-core boundary kit"],
  },
];

type Moat = { num: string; title: string; body: string };
const MOATS: Moat[] = [
  {
    num: "01",
    title: "Trade-secret operators",
    body: "Legal moat (private repo, NDA chain, mechanical strip at publish time) layered on execution moat (running them at scale requires the runtime infrastructure plus eventually the SPU). Two independent barriers, not one.",
  },
  {
    num: "02",
    title: "Multi-protocol simultaneity",
    body: "Building MCP or Postgres or HTTP or a frontend is feasible for one team. Building all four to feature parity at the same time, all sharing one operator catalog, is the structurally hard problem most competitors will not solve.",
  },
  {
    num: "03",
    title: "Cross-domain corpus validation",
    body: "Replicating 44 validation runs spanning regulatory, scientific, archival, patent, security, commercial, and defense corpora is a multi-month research project before a single line of substrate code is written.",
  },
  {
    num: "04",
    title: "SPU spec coupled to the workload",
    body: "The 90× energy-efficiency number depends on understanding scatter-gather plus hashing plus content-addressable retrieval as the workload shape. It does not transfer to a generic AI accelerator. A competitor would have to first re-derive the workload analysis.",
  },
  {
    num: "05",
    title: "OCEAN language with full toolchain",
    body: "Most domain-specific languages are parsers. OCEAN is parser plus type system plus LSP plus formatter plus linter plus REPL plus macros plus FFI plus doc-generator plus MCP adapter. Approximately 6–18 person-months of compiler engineering to recreate from a clean sheet.",
  },
];

type Adjacency = { shape: string; comp: string; position: string };
const ADJACENCIES: Adjacency[] = [
  {
    shape: "Open-core data substrate",
    comp: "Snowflake / Databricks",
    position: "Distribution at the protocol layer, not the SaaS layer. The substrate-clustering primitive becomes ambient infrastructure the same way SQL did.",
  },
  {
    shape: "DSL for AI and data pipelines",
    comp: "dbt Labs",
    position: "Language is the moat. dbt won by being the lingua franca of the analytics-engineering layer. OCEAN is positioned to be the lingua franca of the substrate-clustering layer.",
  },
  {
    shape: "Vertical AI for compliance, IP, intelligence",
    comp: "Palantir Forward Deploy",
    position: "High-ARPU bespoke buildouts on top of the substrate. Eight verticals are already plumbed in code. Each contract is sold scoped, our stack as backend, customer takes ownership at handover.",
  },
  {
    shape: "Custom AI silicon for substrate workloads",
    comp: "Cerebras / Groq",
    position: "Hardware moat at category-defining efficiency. Not an inference chip. A coprocessor for the operator classes GPUs do badly. Compounds the economics of every layer above by 90×.",
  },
];

type Saleable = { num: string; title: string; buyer: string; body: string };
const SALEABLE: Saleable[] = [
  {
    num: "01",
    title: "Language plus toolchain",
    buyer: "AI-tooling acquirer",
    body: "The OCEAN compiler, type-checker, LSP server, and surrounding tooling stand alone. A buyer in the AI-developer-tools category — Cursor, Continue, Anthropic itself — could absorb this directly.",
  },
  {
    num: "02",
    title: "Premium operators",
    buyer: "ML-infrastructure acquirer",
    body: "Each algorithm is independently extractable as an embedded library or hosted service. The four together are a complete substrate-clustering toolkit.",
  },
  {
    num: "03",
    title: "SPU silicon spec",
    buyer: "Silicon acquirer or strategic partner",
    body: "The architecture spec plus simulator results are a hardware-roadmap document with measured performance. A silicon company or hyperscaler partnership could license or acquire.",
  },
  {
    num: "04",
    title: "Vertical showcases",
    buyer: "Vertical SaaS rollups",
    body: "Each showcase is a near-shippable product in a defined buyer category. RegTech (receipt/sec-edgar), IP analytics (pulse), defense (nato-sim), scientific (atlas) — all are independently sellable units.",
  },
  {
    num: "05",
    title: "Validation corpus and harvesters",
    buyer: "Research-data licensor",
    body: "The harvesters for EDGAR, TNA, arXiv, USPTO, DocSouth, plus the validation runs themselves, can be licensed as research-data infrastructure.",
  },
];

export default function SystemPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32">
        {/* Hero */}
        <section className="px-6 pb-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              FULL SYSTEM INVENTORY
            </p>
            <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[20ch]">
              The system, in totality.
            </h1>
            <p className="text-[17px] leading-[1.65] text-white/65 max-w-[60ch] mb-6">
              Eight independently valuable assets. Five replication moats. Four strategic adjacencies — Snowflake, dbt, Palantir, Cerebras. The scale that makes the substrate-clustering primitive a position rather than a product.
            </p>
            <p className="text-[15px] leading-[1.65] text-white/45 max-w-[60ch]">
              Built in 402 commits across five weeks by one contributor in one repository. The shape of an asset that could be unbundled and sold five different ways.
            </p>
            <div className="mt-12 flex flex-wrap gap-4">
              <a href="#assets"     className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">Eight assets →</a>
              <a href="#moats"      className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">Five moats →</a>
              <a href="#adjacencies" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">Four adjacencies →</a>
              <a href="#saleable"   className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">Saleable units →</a>
            </div>
          </div>
        </section>

        {/* Numbers strip */}
        <section className="px-6 py-20 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-10">
              BY THE NUMBERS
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px bg-white/10 border border-white/10 rounded-md overflow-hidden">
              {STATS.map((s) => (
                <div key={s.l} className="bg-black p-7">
                  <p className="text-[clamp(1.3rem,2.2vw,2rem)] font-bold tracking-[-0.02em] leading-none mb-3 text-white tabular-nums">
                    {s.v}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55 leading-snug">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Eight assets */}
        <section id="assets" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              EIGHT ASSETS
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.025em] leading-[1.1] mb-12 max-w-[24ch]">
              Each independently valuable. None replaceable from the others.
            </h2>
            <div className="space-y-px bg-white/10 border border-white/10 rounded-md overflow-hidden">
              {ASSETS.map((a) => (
                <article key={a.num} className="bg-black p-8 lg:p-10">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
                        {a.kicker}
                      </p>
                      <h3 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold tracking-[-0.02em] leading-[1.15] mb-6">
                        {a.title}
                      </h3>
                      <ul className="space-y-2 text-[12.5px] leading-[1.55] text-white/55 mb-6">
                        {a.meta.map((m) => (
                          <li key={m} className="flex gap-2">
                            <span className="text-white/30 shrink-0">→</span>
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                      {a.href && (
                        <Link
                          href={a.href.url}
                          className="inline-block font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/65 hover:text-white border-b border-white/30 hover:border-white pb-1 transition-colors"
                        >
                          {a.href.label} →
                        </Link>
                      )}
                    </div>
                    <div className="lg:col-span-8 space-y-4">
                      {a.body.map((p, i) => (
                        <p key={i} className="text-[15.5px] leading-[1.65] text-white/65">
                          {p}
                        </p>
                      ))}
                      {a.adjacency && (
                        <div className="mt-6 border-l-2 border-white/15 pl-5 py-1">
                          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 mb-2">
                            {a.adjacency.label}
                          </p>
                          <p className="text-[14px] leading-[1.6] text-white/55">
                            {a.adjacency.comp}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Five moats */}
        <section id="moats" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              FIVE REPLICATION MOATS
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.025em] leading-[1.1] mb-12 max-w-[24ch]">
              What makes it hard to copy, even with the design in hand.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOATS.map((m) => (
                <div key={m.num} className="border border-white/10 bg-white/[0.02] rounded-md p-7">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
                    MOAT {m.num}
                  </p>
                  <h3 className="text-[18px] font-bold tracking-[-0.015em] leading-[1.2] mb-4">
                    {m.title}
                  </h3>
                  <p className="text-[14px] leading-[1.6] text-white/55">
                    {m.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Four adjacencies */}
        <section id="adjacencies" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              FOUR STRATEGIC ADJACENCIES
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.025em] leading-[1.1] mb-12 max-w-[28ch]">
              The asset spans four category-leader profiles simultaneously.
            </h2>
            <div className="space-y-px bg-white/10 border border-white/10 rounded-md overflow-hidden">
              {ADJACENCIES.map((a) => (
                <div key={a.shape} className="bg-black p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
                      SHAPE
                    </p>
                    <h3 className="text-[18px] font-bold tracking-[-0.015em] leading-[1.2] mb-3">
                      {a.shape}
                    </h3>
                  </div>
                  <div className="lg:col-span-3">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
                      COMPARABLE
                    </p>
                    <p className="text-[15.5px] font-medium text-white/85 leading-tight">
                      {a.comp}
                    </p>
                  </div>
                  <div className="lg:col-span-5">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
                      POSITION
                    </p>
                    <p className="text-[14.5px] leading-[1.6] text-white/65">
                      {a.position}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[14px] leading-[1.6] text-white/45 max-w-[64ch]">
              Most assets at this scale occupy one of these four shapes. This one occupies all four. Choosing which to lead with is a strategic decision; having any single one of them already built to this state is rare.
            </p>
          </div>
        </section>

        {/* Saleable units */}
        <section id="saleable" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              INDEPENDENTLY SALEABLE UNITS
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.025em] leading-[1.1] mb-6 max-w-[28ch]">
              The unbundled view.
            </h2>
            <p className="text-[15.5px] leading-[1.65] text-white/55 mb-12 max-w-[60ch]">
              If broken up, the carve-up looks like this. Each unit is independently coherent and sellable. That optionality is itself a value component most companies of this scale do not have.
            </p>
            <div className="space-y-px bg-white/10 border border-white/10 rounded-md overflow-hidden">
              {SALEABLE.map((s) => (
                <div key={s.num} className="bg-black p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-1">
                    <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-white/45">
                      {s.num}
                    </p>
                  </div>
                  <div className="lg:col-span-4">
                    <h3 className="text-[18px] font-bold tracking-[-0.015em] leading-[1.2] mb-2">
                      {s.title}
                    </h3>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                      → {s.buyer}
                    </p>
                  </div>
                  <div className="lg:col-span-7">
                    <p className="text-[14.5px] leading-[1.6] text-white/65">
                      {s.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA */}
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
              <Link href="/build" className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-7 transition-colors">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber-300/80 mb-4">LAYER 2</p>
                <h3 className="text-[19px] font-bold tracking-[-0.015em] leading-[1.2] mb-3">Build.</h3>
                <p className="text-[13px] leading-[1.55] text-white/55 mb-5">Universal HTTP API. Bespoke buildouts. Individual self-serve via OCEAN. Three ways to build on top of the substrate.</p>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">Open →</span>
              </Link>
              <Link href="/silicon" className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-7 transition-colors">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-violet-300/80 mb-4">LAYER 3</p>
                <h3 className="text-[19px] font-bold tracking-[-0.015em] leading-[1.2] mb-3">Silicon.</h3>
                <p className="text-[13px] leading-[1.55] text-white/55 mb-5">SPU — 80 mm² chiplet at 20 W. 90× more energy-efficient than an H100 on the substrate-clustering workload class.</p>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">Open →</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
