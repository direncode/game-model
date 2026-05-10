import Link from "next/link";

/**
 * HomeMass — the scale-and-assets section beneath HomeLayers.
 *
 * HomeLayers tells the architecture story (protocols / build / silicon).
 * HomeMass tells the built-mass story: how much of that architecture
 * is already in place. Two sub-blocks plus a CTA into /system:
 *
 *   1. By the numbers — six stat tiles
 *   2. Eight assets — each independently valuable, each linked to a home page
 *   3. CTA — into /system for the deep inventory
 *
 * Voice: third-person, numbers-led, no marketing claims.
 */

const STATS: { v: string; l: string }[] = [
  { v: "264,000", l: "lines of original code" },
  { v: "4",       l: "distribution channels live" },
  { v: "16",      l: "backend service modules" },
  { v: "29",      l: "versioned APIs" },
  { v: "100",     l: "frontend routes" },
  { v: "44",      l: "corpus validations" },
];

type Asset = {
  title: string;
  sub: string;
  bullets: string[];
  href: string;
};

const ASSETS: Asset[] = [
  {
    title: "OCEAN — substrate language",
    sub:   "Typed, declarative, deterministic DSL with full toolchain.",
    bullets: [
      "14 modules · 4,393 lines",
      "Lexer, parser, type-check, compiler, LSP, formatter, linter, REPL, FFI, macros",
      "45 conformance tests passing · MCP adapter native",
    ],
    href: "/language",
  },
  {
    title: "Four proprietary operators",
    sub:   "TCD recursive loop · content_fp48 · dispersion · BTUT.",
    bullets: [
      "Trade-secret-protected, mechanical IP boundary at publish time",
      "Run only behind a metered API key",
      "The value-capture hook for every Layer 1 channel",
    ],
    href: "/system",
  },
  {
    title: "SPU silicon architecture",
    sub:   "80 mm² · 20 W · 90× energy efficiency over an H100.",
    bullets: [
      "TNA pipeline: 16 ms vs GPU 41 ms",
      "0.32 J vs GPU 29 J per pipeline run",
      "FPGA prototype 3-4 months out, MPW chiplet 9-12",
    ],
    href: "/silicon",
  },
  {
    title: "Full-stack product surface",
    sub:   "Backend, frontend, integration plane already plumbed.",
    bullets: [
      "109K LOC backend · 64K LOC frontend",
      "16 service modules · 29 v1 APIs · 100 routes · 175 components",
      "Module marketplace, QR identity, range gating wired",
    ],
    href: "/build",
  },
  {
    title: "Eight vertical showcases",
    sub:   "Each near-shippable into a real buyer category.",
    bullets: [
      "/nato-sim · /receipt · /pulse · /atlas · /bombe",
      "/docsouth · /dunc · /franklin",
      "Defense, regtech, IP analytics, scientific, archival",
    ],
    href: "/gallery",
  },
  {
    title: "Validation corpus",
    sub:   "44 corpus runs across regulatory, scientific, archival, security.",
    bullets: [
      "EDGAR · TNA · arXiv · USPTO · DocSouth",
      "NSL-KDD · defense megatest · commercial benchmarks",
      "The empirical proof artifact set",
    ],
    href: "/validation",
  },
  {
    title: "Four-channel distribution",
    sub:   "MCP · Postgres extension · HTTP API · Frontend. All shipping.",
    bullets: [
      "All four share one operator catalog",
      "Reaches every AI agent runtime, every Postgres-compatible database",
      "Reaches every HTTP caller, every browser",
    ],
    href: "/protocols",
  },
  {
    title: "Trade-secret architecture itself",
    sub:   "Mechanical IP boundary enforcement as a reusable pattern.",
    bullets: [
      "vendor_strip.py refuses to exit on leak",
      "Open-core lowers adoption friction",
      "Premium operators capture value behind metered API",
    ],
    href: "/system",
  },
];

export function HomeMass() {
  return (
    <section className="relative bg-black text-white">
      {/* Section header */}
      <div className="px-6 pt-32 pb-16 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/85 mb-6">
            BUILT MASS · THE AUDITABLE AI SUBSTRATE, AS IT EXISTS TODAY
          </p>
          <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[26ch]">
            The architecture is the smaller story. The amount of it already built is the larger one.
          </h2>
          <p className="text-[17px] leading-[1.65] text-white/70 max-w-[64ch] mb-4">
            Built in 402 commits across five weeks by one contributor in one repository. The eight asset surfaces below are what a stranger could not replicate quickly, even with the design in hand. Each is independently valuable. Together they form the substrate primitive missing from the current AI stack.
          </p>
          <p className="text-[15px] leading-[1.65] text-white/45 max-w-[64ch]">
            Auditable AI infrastructure. Deterministic reasoning operators. Hardware-aligned silicon roadmap. Verticalless deployment. The asset profile spans four category-leader shapes simultaneously: auditable AI infrastructure (Anthropic / OpenAI-adjacent), open-core data substrate (Snowflake-adjacent), language for AI pipelines (dbt-adjacent), custom AI silicon (Cerebras-adjacent).
          </p>
        </div>
      </div>

      {/* Numbers strip */}
      <div className="px-6 py-20 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-10">
            BY THE NUMBERS
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-white/10 border border-white/10 rounded-md overflow-hidden">
            {STATS.map((s) => (
              <div key={s.l} className="bg-black p-7">
                <p className="text-[clamp(1.4rem,2.4vw,2.2rem)] font-bold tracking-[-0.02em] leading-none mb-3 text-white tabular-nums">
                  {s.v}
                </p>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/55 leading-snug">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Regime card — campaign findings */}
      <div className="px-6 py-24 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/85 mb-6">
            THE SUBSTRATE OPERATIONAL REGIME CARD · 158 TESTS, $0.10 GPU SPEND
          </p>
          <h3 className="text-[clamp(2rem,4vw,3.2rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-6 max-w-[28ch]">
            Measured boundaries. Not projected. Reproducible for under two dollars.
          </h3>
          <p className="text-[15px] leading-[1.65] text-white/65 max-w-[64ch] mb-10">
            Six-phase overnight campaign measured the operational regime end-to-end. Every number below is a single recorded measurement, not an aggregate, not a forecast. Reproducible from scripts in <code className="font-mono text-[13px] bg-white/[0.05] px-1.5 py-0.5 rounded">scripts/experiments/</code> on any RunPod H100 account.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-md overflow-hidden mb-8">
            {[
              { v: "5 / 5",     l: "modalities at perfect module purity" },
              { v: "16 / 16",   l: "real-data tests at perfect purity" },
              { v: "70%",       l: "signature noise tolerated at perfect purity" },
              { v: "10,000:1",  l: "class imbalance recovered perfectly" },
              { v: "100,000",   l: "entities classified per single H100 job" },
              { v: "6,789",     l: "entities / second / H100 sustained" },
              { v: "$0.0028",   l: "per 100K real records to perfect labels" },
              { v: "$0.10",     l: "total GPU spend for the full 158-test campaign" },
            ].map((s) => (
              <div key={s.l} className="bg-black p-6">
                <p className="text-[clamp(1.4rem,2.4vw,2.2rem)] font-bold tracking-[-0.02em] leading-none mb-3 text-white tabular-nums">
                  {s.v}
                </p>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/55 leading-snug">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/benchmarks"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors px-5 py-2.5"
            >
              Full phase diagram
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/accelerator"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 text-white/85 text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:text-white hover:border-white/35 transition-colors px-5 py-2.5"
            >
              Accelerator architecture
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/contracting"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 text-white/85 text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:text-white hover:border-white/35 transition-colors px-5 py-2.5"
            >
              Contracting model
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 text-white/85 text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:text-white hover:border-white/35 transition-colors px-5 py-2.5"
            >
              System Builder
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Asset tiles */}
      <div className="px-6 py-24 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-10">
            EIGHT ASSETS · EACH INDEPENDENTLY VALUABLE
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ASSETS.map((a) => (
              <Link
                key={a.title}
                href={a.href}
                className="group block border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-7 transition-colors"
              >
                <h3 className="text-[18px] font-bold tracking-[-0.015em] leading-[1.2] mb-2">
                  {a.title}
                </h3>
                <p className="text-[13.5px] leading-[1.55] text-white/55 mb-5">
                  {a.sub}
                </p>
                <ul className="space-y-1.5 text-[12.5px] leading-[1.55] text-white/55 mb-5">
                  {a.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-white/30 shrink-0">→</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 group-hover:text-white border-b border-white/30 group-hover:border-white pb-1">
                  Open →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* CTA into /system */}
      <div className="px-6 py-20 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <Link
            href="/system"
            className="group block border border-white/15 hover:border-white/40 bg-white/[0.02] hover:bg-white/[0.04] rounded-md p-10 transition-colors"
          >
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              FULL SYSTEM INVENTORY
            </p>
            <h3 className="text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-[-0.02em] leading-[1.15] mb-3 max-w-[28ch]">
              See the totality. Moats, adjacencies, saleable units.
            </h3>
            <p className="text-[15px] leading-[1.6] text-white/55 mb-5 max-w-[64ch]">
              The asset profile spans four category-leader shapes simultaneously: auditable AI infrastructure (Anthropic / OpenAI / Pinecone-adjacent), open-core data substrate (Snowflake / Databricks-adjacent), DSL for AI pipelines (dbt-adjacent), and custom AI silicon (Cerebras / Groq-adjacent). Each unit could be unbundled and sold on its own.
            </p>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/65 group-hover:text-white border-b border-white/35 group-hover:border-white pb-1">
              Open the system inventory →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
