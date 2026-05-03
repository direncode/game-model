import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "Protocols · Layer 1 · Latent Ocean",
  description:
    "Layer 1: protocol-level distribution. MCP server for every AI agent stack, Postgres extension for every data warehouse. The substrate-clustering primitive becomes ambient infrastructure.",
};

const HEAD_KICKER  = "LAYER 1 · PROTOCOL DISTRIBUTION";
const HEAD_TITLE   = "Two protocols. Every AI agent. Every data warehouse.";
const HEAD_LEAD    = `Layer 1 ships OCEAN as protocol-level infrastructure. No accounts. No dashboards. No customer-facing services. An MCP server lets every AI agent platform call substrate-clustering as a tool. A Postgres extension lets every analyst with SQL access call it as a function. Adoption is by integration, not by sale.`;

export default function ProtocolsPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32">
        {/* Hero */}
        <section className="px-6 pb-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              {HEAD_KICKER}
            </p>
            <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[18ch]">
              {HEAD_TITLE}
            </h1>
            <p className="text-[17px] leading-[1.65] text-white/65 max-w-[58ch]">
              {HEAD_LEAD}
            </p>
            <div className="mt-12 flex flex-wrap gap-4">
              <a href="#mcp" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">
                MCP Server →
              </a>
              <a href="#postgres" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">
                Postgres Extension →
              </a>
            </div>
          </div>
        </section>

        {/* MCP */}
        <section id="mcp" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-cyan-300/80 mb-4">
                FIRST CHANNEL · MCP
              </p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-6">
                Anthropic&apos;s Model Context Protocol — every agent stack speaks it.
              </h2>
              <p className="text-[15.5px] leading-[1.65] text-white/65 mb-6">
                The MCP server exposes seven OCEAN tools — compile, validate, run, format, lint, plus operator-catalog and stdlib enumeration. Drop the server into Claude Desktop, Cursor, Continue.dev, Goose, or any hyperscaler agent runtime; the agent gains substrate-clustering as a callable capability.
              </p>
              <p className="text-[15.5px] leading-[1.65] text-white/55">
                Free language and reference operators. Premium operators (BTUT, TCD-JEPA, content_fp48, dispersion) gate behind a bearer-token API key. Metering happens at the protocol layer.
              </p>
            </div>
            <div className="lg:col-span-7 font-mono text-[12.5px] leading-[1.7] text-white/85 bg-white/[0.03] border border-white/10 rounded-md p-7 overflow-x-auto">
              <p className="text-white/40 mb-2">// claude_desktop_config.json</p>
              <pre className="whitespace-pre-wrap">{`{
  "mcpServers": {
    "ocean": {
      "command": "python",
      "args": ["-m", "scripts.operators.ocean.mcp"],
      "env": {
        "OCEAN_API_KEY": "lo_pk_..."
      }
    }
  }
}`}</pre>
              <p className="text-white/40 mt-6 mb-2">// then in any chat</p>
              <pre className="whitespace-pre-wrap text-cyan-200/85">{`> Use ocean_run on this:

  load tmp/corpus.ndjson take 500 records
  embed text into 128 dimensions
  cluster for 16 rounds energy = corpus mean
  align modules using 50 nearest records
  find dispersion of each label
  save to data/result.json`}</pre>
            </div>
          </div>
        </section>

        {/* Postgres */}
        <section id="postgres" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber-300/80 mb-4">
                SECOND CHANNEL · POSTGRES EXTENSION
              </p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-6">
                A SQL function any analyst can call.
              </h2>
              <p className="text-[15.5px] leading-[1.65] text-white/65 mb-6">
                <code className="font-mono text-[14px] text-amber-200/95 bg-white/5 px-1.5 py-0.5 rounded">ocean.run(source TEXT)</code> compiles and executes an OCEAN program inside any Postgres-compatible database. The substrate-clustering primitive becomes a SQL function — usable from any dashboard, scheduled query, or notebook that already speaks SQL.
              </p>
              <p className="text-[15.5px] leading-[1.65] text-white/55">
                Reaches: Postgres, Aurora, AlloyDB, CockroachDB, Yugabyte, Supabase, Neon, TimescaleDB. Effectively every modern data warehouse outside Snowflake/BigQuery — and even those have <code className="font-mono text-[13px] text-white/70">EXTERNAL FUNCTION</code> paths that bridge to this extension.
              </p>
            </div>
            <div className="lg:col-span-7 font-mono text-[12.5px] leading-[1.7] text-white/85 bg-white/[0.03] border border-white/10 rounded-md p-7 overflow-x-auto">
              <p className="text-white/40 mb-2">-- install once</p>
              <pre className="whitespace-pre-wrap">{`CREATE EXTENSION plpython3u;
\\i ocean_pg.sql`}</pre>
              <p className="text-white/40 mt-6 mb-2">-- then call from any SQL</p>
              <pre className="whitespace-pre-wrap text-amber-200/85">{`SELECT ocean.run($$
    load tmp/corpus.ndjson take 500 records
    embed text into 128 dimensions
    cluster for 16 rounds energy = corpus mean
    align modules using 50 nearest records
    find dispersion of each label
    save to data/result.json
$$) AS run_result;`}</pre>
              <p className="text-white/40 mt-6 mb-2">-- enumerate the operator catalog</p>
              <pre className="whitespace-pre-wrap text-amber-200/85">{`SELECT kind, schema FROM ocean.list_operators();`}</pre>
            </div>
          </div>
        </section>

        {/* What's next */}
        <section className="px-6 py-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              CLIMB THE STACK
            </p>
            <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-10 max-w-[28ch]">
              Layer 1 reaches every channel. Layer 2 is what you build with it.
            </h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/build" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                Layer 2 — Build →
              </Link>
              <Link href="/silicon" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                Layer 3 — Silicon →
              </Link>
              <Link href="/language" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                The OCEAN Language →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
