import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "Build · Layer 2 · Latent Ocean",
  description:
    "Layer 2: build with the substrate. Universal extension (HTTP/SDKs/CLI), bespoke contract buildouts for massive systems only, individual self-serve via the OCEAN language. Three sub-channels, one operator catalog underneath.",
};

export default function BuildPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32">
        <section className="px-6 pb-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              LAYER 2 · SYSTEM BUILDOUT
            </p>
            <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[20ch]">
              Three ways to build on the substrate. Pick your scale.
            </h1>
            <p className="text-[17px] leading-[1.65] text-white/65 max-w-[60ch]">
              Layer 2 is what you build with the protocols. Three sub-channels, scaled by who&apos;s integrating: a universal HTTP API for everyone with a network connection, defined-scope contract buildouts for systems too massive to self-serve, and a free language for individuals to compose their own pipelines. The operator catalog is the same across all three.
            </p>
          </div>
        </section>

        {/* 2a — Universal extension */}
        <section id="universal" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-cyan-300/80 mb-4">
                2A · UNIVERSAL EXTENSION
              </p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-6">
                HTTP, SDKs, CLI. Speak any protocol — we serve OCEAN.
              </h2>
              <p className="text-[15.5px] leading-[1.65] text-white/65 mb-6">
                The HTTP API exposes the same operator catalog as MCP and Postgres, but over plain REST with an OpenAPI 3.1 spec auto-served at <code className="font-mono text-[13.5px] text-cyan-200">/docs</code>. OpenAI Custom GPTs, Gemini tools, Mistral function-calling, n8n, Zapier, internal microservices, plain <code className="font-mono text-[13.5px] text-cyan-200">curl</code>: any HTTP-speaking caller integrates in minutes.
              </p>
              <p className="text-[15.5px] leading-[1.65] text-white/55">
                Bearer-token auth. Free tier hits free operators. Premium operators (BTUT, TCD-JEPA, content_fp48, dispersion) gate behind a paid key — calls without one return HTTP 402.
              </p>
            </div>
            <div className="lg:col-span-7 font-mono text-[12.5px] leading-[1.7] text-white/85 bg-white/[0.03] border border-white/10 rounded-md p-7 overflow-x-auto">
              <p className="text-white/40 mb-2">$ POST /v1/run with API key</p>
              <pre className="whitespace-pre-wrap">{`curl -X POST https://api.latentocean.com/v1/run \\
  -H 'Authorization: Bearer lo_pk_...' \\
  -H 'Content-Type: application/json' \\
  -d '{"source":"
    load tmp/corpus.ndjson take 500 records
    embed text into 128 dimensions
    cluster for 16 rounds energy = corpus mean
    align modules using 50 nearest records
    find dispersion of each label
    save to data/result.json
  "}'`}</pre>
              <p className="text-white/40 mt-6 mb-2">// → response</p>
              <pre className="whitespace-pre-wrap text-cyan-200/85">{`{
  "ok": true,
  "timings": [...],
  "artifact_path": "data/result.json",
  "artifact": { "modules_formed": [...], ... }
}`}</pre>
            </div>
          </div>
        </section>

        {/* 2b — Bespoke contract buildouts */}
        <section id="buildouts" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber-300/80 mb-4">
              2B · BESPOKE BUILDOUTS
            </p>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-8 max-w-[28ch]">
              For systems too massive to self-serve. Five strict rules.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-[1100px]">
              {[
                { i: "01", t: "Massive systems only", b: "~$10M ARR or ~10 PB-scale data minimum. Below that, self-serve via Layer 1 or 2a." },
                { i: "02", t: "Our stack as backend", b: "OCEAN + operators + (eventually) SPU. We don't write generic software — we integrate ours." },
                { i: "03", t: "Contract basis", b: "Fixed-price, defined deliverable, hard scope. Not ongoing managed services." },
                { i: "04", t: "Customer takes ownership", b: "We hand over at completion. They run it on our protocols. No retainer relationship." },
                { i: "05", t: "Output is reusable", b: "Each contract widens the moat. Nothing throwaway-bespoke." },
              ].map(r => (
                <div key={r.i} className="border border-white/10 bg-white/[0.02] p-6 rounded-md">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber-300/80 mb-3">{r.i}</p>
                  <p className="text-[15px] font-semibold text-white mb-2 leading-[1.25]">{r.t}</p>
                  <p className="text-[13px] leading-[1.55] text-white/55">{r.b}</p>
                </div>
              ))}
            </div>
            <p className="mt-12 text-[15px] leading-[1.65] text-white/55 max-w-[60ch]">
              Customer profile: hyperscalers, sovereign AI builds, large intel/defense agencies, top-10 banks, top-50 research institutions. Few accounts, large contracts, well-defined integration scope. Comparable to a Palantir Foundry deployment — but narrower (just the substrate-clustering layer, not the whole platform).
            </p>
          </div>
        </section>

        {/* 2c — Individual */}
        <section id="individual" className="px-6 py-24 border-b border-white/5 scroll-mt-24">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/80 mb-4">
                2C · INDIVIDUAL SYSTEM-BUILDING
              </p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-6">
                Free language. Free reference operators. Pay only for what you actually use.
              </h2>
              <p className="text-[15.5px] leading-[1.65] text-white/65 mb-6">
                Devs and analysts use OCEAN as their substrate when they build their own products. The language is open-source; the reference operators ship free. Premium operators (the proprietary ones — BTUT, TCD-JEPA, content_fp48, dispersion) bill per call when invoked through the protocols above.
              </p>
              <p className="text-[15.5px] leading-[1.65] text-white/55">
                The PostgreSQL adoption pattern: free database, hosted service generates revenue. We&apos;re the same shape, with the operators as the proprietary core.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/language" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">
                  OCEAN Language →
                </Link>
                <Link href="/gallery" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border-b border-white/40 hover:border-white pb-1">
                  Example Gallery →
                </Link>
              </div>
            </div>
            <div className="lg:col-span-7 font-mono text-[12.5px] leading-[1.7] text-white/85 bg-white/[0.03] border border-white/10 rounded-md p-7 overflow-x-auto">
              <p className="text-white/40 mb-2"># tna_pipeline.ocean — six lines, zero config</p>
              <pre className="whitespace-pre-wrap text-emerald-200/85">{`load tmp/bombe_tna_full.ndjson take 500 records balanced by archive
embed text into 128 dimensions
cluster for 16 rounds max 24 modules energy = corpus mean
align modules using 50 nearest records
find dispersion of each label
save to data/validation/tna_run.json`}</pre>
              <p className="text-white/40 mt-6 mb-2">$ python -m scripts.run_universal_pipeline \\
                <br />&nbsp;&nbsp;&nbsp;&nbsp;--config tna_pipeline.ocean</p>
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
              Layer 2 is what you build. Layer 3 is what compounds it.
            </h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/protocols" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                ← Layer 1 — Protocols
              </Link>
              <Link href="/silicon" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                Layer 3 — Silicon →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
